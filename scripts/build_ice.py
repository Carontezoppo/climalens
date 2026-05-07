"""
Generate paleo ice sheet coverage grids for ClimaLens paleocoastlines.

Two supported input modes — the script auto-detects based on the argument:

MODE A — single GLAC NetCDF file (recommended):
  Accepts a file containing an ICEM ice-mask variable with a time dimension.
  Example: TOPicemsk.GLACD26kN9894GE90227A6005GGrBgic.nc
  Time convention: negative ka BP (0 = today, -26 = 26 ka BP).

MODE B — directory of per-step ICE-7G_NA files (legacy):
  Scans for files named I7G_NA.VM7_1deg.{N}.nc where N = ka BP.

Both modes cover 0–26 ka BP. Steps beyond 26 ka fall back to the oldest
available time step (LGM approximation). The UI note in sea.html flags this.

Usage:
    python3 scripts/build_ice.py path/to/TOPicemsk...nc          # Mode A
    python3 scripts/build_ice.py ~/Downloads/ice7g/              # Mode B
    python3 scripts/build_ice.py <path> --check                  # dry run

Output:
    data/ice_cover.bin  —  21 × 180 × 360 raw uint8 bytes (1° grid)
    Layer order matches CURVE in js/paleo-sea.js:
      layer 0 = today (0 ka), ..., layer 20 = 100 ka BP
    Value 1 = ice present, 0 = no ice
    Resolution: 1° — row 0 = 90°N, col 0 = 180°W
"""

import os
import sys
import re
import numpy as np

CURVE_YEARS = [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000,
               45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000,
               85000, 90000, 95000, 100000]

ICE_THRESHOLD = 100   # metres, used only for thickness variables (not ICEM)
OUT_ROWS      = 180   # 1° latitude,  row 0 = 90°N
OUT_COLS      = 360   # 1° longitude, col 0 = 180°W

OUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'ice_cover.bin')

KA_RE = re.compile(r'\.(\d+(?:\.\d+)?)\.nc$', re.IGNORECASE)


# ── Mode A: single GLAC NetCDF ────────────────────────────────────────────────

def build_from_glac(nc_path, check_only=False):
    import netCDF4 as nc_lib

    print(f"Opening {os.path.basename(nc_path)} …")
    ds   = nc_lib.Dataset(nc_path)
    lat  = np.array(ds.variables['YLATGLOBP5'][:])   # 360 values, 0.5°, –90→90
    lon  = np.array(ds.variables['XLONGLOB1'][:])    # 360 values, 1°,  0.5→359.5
    time = np.array(ds.variables['T122KP11'][:])     # negative ka BP

    print(f"  time: {time[0]:.1f} → {time[-1]:.1f} ka  (n={len(time)}, step~{abs(time[1]-time[0]):.2f})")

    # Ice variable: prefer ICEM (binary mask) over thickness variables
    if 'ICEM' in ds.variables:
        ice_var  = 'ICEM'
        use_mask = True
        print(f"  using ICEM (ice mask, binary)")
    else:
        candidates = ['stgit', 'lithk', 'ice_thickness', 'thk']
        ice_var = next((v for v in candidates if v in ds.variables), None)
        if not ice_var:
            ds.close()
            raise SystemExit(f"No ice variable found. Variables: {list(ds.variables.keys())}")
        use_mask = False
        print(f"  using {ice_var} (ice thickness, threshold {ICE_THRESHOLD} m)")

    # Precompute source lat row indices for 1° output grid
    # Source (north-flipped): src_lat[r] = 89.8 – r × 0.5
    # Target:                  tgt_lat[r] = 89.5 – r × 1.0
    # nearest src row for tgt r: round((89.8 – tgt_lat) / 0.5) = round(0.6 + 2r)
    src_rows = np.clip(np.round(0.6 + 2 * np.arange(OUT_ROWS)).astype(int), 0, len(lat) - 1)

    nsteps = len(CURVE_YEARS)
    print(f"\nMapping {nsteps} curve steps:")
    plan = []
    for step_idx, years_bp in enumerate(CURVE_YEARS):
        ka_bp    = years_bp / 1000.0
        t_target = -ka_bp          # file uses negative convention
        t_idx    = int(np.argmin(np.abs(time - t_target)))
        gap      = abs(time[t_idx] - t_target)
        flag     = f"  (nearest, gap={gap:.1f} ka)" if gap > 0.1 else ""
        print(f"  step {step_idx:2d}  {years_bp:6d} ya  →  t={time[t_idx]:.2f} ka{flag}")
        plan.append(t_idx)

    if check_only:
        ds.close()
        return

    print("\nBuilding ice grid…")
    out = np.zeros((nsteps, OUT_ROWS, OUT_COLS), dtype=np.uint8)

    for step_idx, t_idx in enumerate(plan):
        raw = np.array(ds.variables[ice_var][t_idx])

        # Flip to north-first if needed
        if lat[0] < lat[-1]:
            raw = raw[::-1, :]

        # Downsample lat: 360 rows (0.5°) → 180 rows (1°)
        raw = raw[src_rows, :]

        # Roll lon: 0→360 convention → –180→180 (roll right by 180)
        raw = np.roll(raw, 180, axis=1)

        if use_mask:
            out[step_idx] = (raw > 0).astype(np.uint8)
        else:
            out[step_idx] = (raw >= ICE_THRESHOLD).astype(np.uint8)

        print(f"  [{step_idx+1}/{nsteps}] t={time[t_idx]:.2f} ka  "
              f"({out[step_idx].sum()} ice cells)")

    ds.close()
    _write(out)


# ── Mode B: directory of per-step ICE-7G_NA files ────────────────────────────

def build_from_dir(directory, check_only=False):
    import netCDF4 as nc_lib

    available = {}
    for fname in os.listdir(directory):
        m = KA_RE.search(fname)
        if m and fname.endswith('.nc') and 'I7G_NA' in fname:
            available[float(m.group(1))] = os.path.join(directory, fname)

    if not available:
        raise SystemExit(f"No I7G_NA .nc files found in {directory}")

    print(f"Found {len(available)} ICE-7G_NA files.")
    nsteps = len(CURVE_YEARS)
    print(f"\nMapping {nsteps} curve steps:")
    plan = []
    for step_idx, years_bp in enumerate(CURVE_YEARS):
        ka = years_bp / 1000.0
        nearest = min(available, key=lambda k: abs(k - ka))
        gap  = abs(nearest - ka)
        flag = f"  (nearest, gap={gap:.1f} ka)" if gap > 0.1 else ""
        print(f"  step {step_idx:2d}  {years_bp:6d} ya  →  {nearest:.1f} ka{flag}")
        plan.append(available[nearest])

    if check_only:
        return

    print("\nBuilding ice grid…")
    out = np.zeros((nsteps, OUT_ROWS, OUT_COLS), dtype=np.uint8)

    for step_idx, nc_path in enumerate(plan):
        ds  = nc_lib.Dataset(nc_path)
        lat = np.array(ds.variables['lat'][:])
        lon = np.array(ds.variables['lon'][:])
        raw = np.ma.filled(np.array(ds.variables['stgit'][:], dtype=float), 0.0)
        ds.close()

        if lat[0] < lat[-1]:
            raw = raw[::-1, :]
        if np.max(lon) > 181:
            raw = np.roll(raw, raw.shape[1] // 2, axis=1)

        src_r, src_c = raw.shape
        if src_r != OUT_ROWS or src_c != OUT_COLS:
            rs = np.clip((np.arange(OUT_ROWS) * src_r / OUT_ROWS).astype(int), 0, src_r-1)
            cs = np.clip((np.arange(OUT_COLS) * src_c / OUT_COLS).astype(int), 0, src_c-1)
            raw = raw[np.ix_(rs, cs)]

        out[step_idx] = (raw >= ICE_THRESHOLD).astype(np.uint8)
        print(f"  [{step_idx+1}/{nsteps}] {os.path.basename(nc_path)}  "
              f"({out[step_idx].sum()} ice cells)")

    _write(out)


# ── Shared output ─────────────────────────────────────────────────────────────

def _write(out):
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    out.tofile(OUT_FILE)
    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"\nWritten: {OUT_FILE}  ({size_kb:.0f} KB)")
    print(f"Format: {out.shape[0]} steps × {OUT_ROWS} rows × {OUT_COLS} cols  (uint8, 1°)")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        import netCDF4  # noqa
    except ImportError:
        raise SystemExit("netCDF4 not found. Run: pip3 install netCDF4 numpy")

    args  = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv

    if not args:
        raise SystemExit(
            "Usage:\n"
            "  python3 scripts/build_ice.py path/to/TOPicemsk...nc   # single GLAC file\n"
            "  python3 scripts/build_ice.py ~/Downloads/ice7g/        # per-step directory\n"
            "  Add --check for a dry run."
        )

    target = os.path.expanduser(args[0])

    if os.path.isfile(target):
        build_from_glac(target, check_only=check)
    elif os.path.isdir(target):
        build_from_dir(target, check_only=check)
    else:
        raise SystemExit(f"Not found: {target}")
