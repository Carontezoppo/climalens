"""
Generate paleo ice sheet coverage grids for ClimaLens paleocoastlines.

Source: ICE-7G_NA (VM7) reconstruction — Peltier et al.
        Files are individual time slices named I7G_NA.VM7_1deg.{N}.nc
        where N is the time in ka BP (e.g. 0, 5, 10, … 100).

How to get the data (free registration required):
  1. Visit https://www.atmosp.physics.utoronto.ca/~peltier/data.php
  2. Register and download ICE-7G_NA (VM7) — grab one file per time step
     you need. The curve uses 5 ka intervals from 0 to 100 ka BP, so you
     want: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75,
           80, 85, 90, 95, 100
     Files are named I7G_NA.VM7_1deg.{N}.nc (N = ka BP as integer)
  3. Place all downloaded files in one directory (e.g. ~/Downloads/ice7g/)
  4. Run: python3 scripts/build_ice.py ~/Downloads/ice7g/

Output:
  data/ice_cover.bin  —  21 × 180 × 360 raw uint8 bytes (1° grid)
  Layer order matches CURVE in js/paleo-sea.js:
    layer 0 = today (0 ka), layer 1 = 5 ka BP, ..., layer 20 = 100 ka BP
  Value 1 = ice present (thickness >= 100 m), 0 = no ice
  Resolution: 1° — row 0 = 90°N, col 0 = 180°W (or nearest available)

If a file for an exact time step is missing, the nearest available one is used.
Run with --check to see which files were found without writing output.
"""

import os
import sys
import re
import numpy as np

# Time steps in years BP, matching CURVE in js/paleo-sea.js
CURVE_YEARS = [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000,
               45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000,
               85000, 90000, 95000, 100000]

ICE_THRESHOLD = 100  # metres — below this is not treated as ice sheet

OUT_ROWS = 180   # 1° latitude grid, 90°N → 90°S
OUT_COLS = 360   # 1° longitude grid, 180°W → 180°E

OUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'ice_cover.bin')

# Regex to extract ka value from filename, e.g. I7G_NA.VM7_1deg.6.5.nc → 6.5
KA_RE = re.compile(r'\.(\d+(?:\.\d+)?)\.nc$', re.IGNORECASE)


def scan_directory(directory):
    """Return dict of {ka_bp: filepath} for all matching .nc files found."""
    available = {}
    for fname in os.listdir(directory):
        m = KA_RE.search(fname)
        if m and fname.endswith('.nc'):
            ka = float(m.group(1))
            available[ka] = os.path.join(directory, fname)
    return available


def load_slice(nc_path):
    """Load ice thickness from a single-slice ICE-7G NetCDF file."""
    import netCDF4 as nc

    ds = nc.Dataset(nc_path)

    # Find ice thickness variable
    thick_var = None
    for name in ['stgit', 'lithk', 'ice_thickness', 'thickness', 'thk', 'hi']:
        if name in ds.variables:
            thick_var = name
            break
    if not thick_var:
        ds.close()
        raise ValueError(f"No ice thickness variable found in {nc_path}. "
                         f"Variables: {list(ds.variables.keys())}")

    ice = np.ma.filled(np.array(ds.variables[thick_var][:], dtype=float), 0.0)

    # Detect lat orientation — ensure row 0 = 90°N
    lat_var = next((v for v in ['lat', 'LAT', 'latitude'] if v in ds.variables), None)
    if lat_var is not None:
        lat = ds.variables[lat_var][:]
        if float(lat[0]) < float(lat[-1]):
            ice = ice[::-1, :]  # flip to north-first

    # Detect lon convention — remap 0→360 to –180→180 if needed
    lon_var = next((v for v in ['lon', 'LON', 'longitude'] if v in ds.variables), None)
    if lon_var is not None:
        lon = ds.variables[lon_var][:]
        if float(np.max(lon)) > 181:
            half = ice.shape[1] // 2
            ice = np.roll(ice, half, axis=1)

    ds.close()

    # Resample to OUT_ROWS × OUT_COLS if needed
    src_rows, src_cols = ice.shape
    if src_rows != OUT_ROWS or src_cols != OUT_COLS:
        ice_rs = np.zeros((OUT_ROWS, OUT_COLS), dtype=float)
        row_scale = src_rows / OUT_ROWS
        col_scale = src_cols / OUT_COLS
        for r in range(OUT_ROWS):
            sr = min(int(r * row_scale), src_rows - 1)
            for c in range(OUT_COLS):
                sc = min(int(c * col_scale), src_cols - 1)
                ice_rs[r, c] = ice[sr, sc]
        ice = ice_rs

    return (ice >= ICE_THRESHOLD).astype(np.uint8)


def build(directory, check_only=False):
    try:
        import netCDF4  # noqa — just check it's installed
    except ImportError:
        raise SystemExit("netCDF4 not found. Run: pip3 install netCDF4 numpy")

    available = scan_directory(directory)
    if not available:
        raise SystemExit(f"No ICE-7G .nc files found in {directory}\n"
                         f"Expected filenames like I7G_NA.VM7_1deg.25.nc")

    print(f"Found {len(available)} file(s) in {directory}:")
    for ka in sorted(available):
        print(f"  {ka:6.1f} ka BP  →  {os.path.basename(available[ka])}")

    nsteps = len(CURVE_YEARS)
    print(f"\nMapping {nsteps} curve steps to available files:")
    plan = []
    for step_idx, years_bp in enumerate(CURVE_YEARS):
        ka_bp = years_bp // 1000
        nearest_ka = min(available.keys(), key=lambda k: abs(k - ka_bp))
        gap = abs(nearest_ka - ka_bp)
        flag = f"  (nearest, gap={gap} ka)" if gap > 0 else ""
        print(f"  step {step_idx:2d}  {years_bp:6d} ya  →  {nearest_ka:.1f} ka{flag}")
        plan.append(available[nearest_ka])

    if check_only:
        return

    print("\nBuilding ice grid…")
    out = np.zeros((nsteps, OUT_ROWS, OUT_COLS), dtype=np.uint8)
    for step_idx, nc_path in enumerate(plan):
        print(f"  [{step_idx+1}/{nsteps}] {os.path.basename(nc_path)}")
        out[step_idx] = load_slice(nc_path)

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    out.tofile(OUT_FILE)
    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"\nWritten: {OUT_FILE}  ({size_kb:.0f} KB)")
    print(f"Format: {nsteps} steps × {OUT_ROWS} rows × {OUT_COLS} cols  (uint8, 1°)")


if __name__ == "__main__":
    args  = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv

    if not args:
        raise SystemExit(
            "Usage: python3 scripts/build_ice.py <directory-with-nc-files> [--check]"
        )

    build(args[0], check_only=check)
