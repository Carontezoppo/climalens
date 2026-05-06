"""
Generate ETOPO 2022 elevation grids for the ClimaLens paleocoastlines feature.

Source: ETOPO 2022 via NOAA OPeNDAP (streams only the subset needed).
Output: little-endian Int16 binary, row 0 = 90°N, col 0 = 180°W.

Files generated:
  data/etopo025.bin  —  0.25°  720 × 1440   ~2 MB   (standard quality)
  data/etopo010.bin  —  0.10°  1800 × 3600  ~13 MB  (high quality)

Usage:
    pip install netCDF4 numpy
    python scripts/build_etopo.py           # both files
    python scripts/build_etopo.py --low     # standard only
    python scripts/build_etopo.py --high    # high-res only
"""

import os
import sys
import numpy as np

OPENDAP_URL = (
    "https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/"
    "60s_bed_elev_netcdf/ETOPO_2022_v1_60s_N90W180_bed.nc"
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

CONFIGS = [
    dict(stride=15, out="etopo025.bin", label="0.25°  (~2 MB)"),
    dict(stride=6,  out="etopo010.bin", label="0.10°  (~13 MB)"),
]


def build(ds, stride, out_name, label):
    print(f"\nGenerating {label} — stride {stride}…")
    lat = ds.variables["lat"][::stride]
    lon = ds.variables["lon"][::stride]
    z   = ds.variables["z"][::stride, ::stride]

    print(f"  grid: {z.shape[0]} rows × {z.shape[1]} cols")

    if float(lat[0]) < float(lat[-1]):
        z = z[::-1, :]
        print("  flipped to north-first (row 0 = 90°N)")

    z_filled = np.ma.filled(z, fill_value=0)
    z_int    = np.clip(np.round(z_filled), -32768, 32767).astype("<i2")

    out_path = os.path.join(DATA_DIR, out_name)
    os.makedirs(DATA_DIR, exist_ok=True)
    z_int.tofile(out_path)

    size_mb = os.path.getsize(out_path) / 1_048_576
    print(f"  written to {out_path}  ({size_mb:.1f} MB)")


def main():
    try:
        import netCDF4 as nc
    except ImportError:
        raise SystemExit("netCDF4 not found. Run: pip install netCDF4 numpy")

    args = sys.argv[1:]
    if "--low" in args:
        configs = [CONFIGS[0]]
    elif "--high" in args:
        configs = [CONFIGS[1]]
    else:
        configs = CONFIGS

    print("Opening ETOPO 2022 via OPeNDAP…")
    ds = nc.Dataset(OPENDAP_URL)

    for cfg in configs:
        build(ds, cfg["stride"], cfg["out"], cfg["label"])

    print("\nDone.")


if __name__ == "__main__":
    main()
