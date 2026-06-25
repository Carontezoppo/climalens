"""
Generate the land cover globe texture (forest.html current-state view) from
ESA WorldCover 10m 2020 (v100) — a free, anonymous-access AWS Open Data
bucket — instead of a live, paid Sentinel Hub render.

WorldCover's 2651 Cloud-Optimized GeoTIFF tiles are mosaicked via the
official AWS VRT and read at a decimated (downsampled) resolution, so GDAL
only fetches each tile's low-res overview pyramid over HTTP range requests
rather than the full 10m data — a few hundred MB of network traffic total,
not the multi-TB full-resolution archive. This runs once (or whenever ESA
ships a new edition); the output is committed as a static asset and served
directly by Cloudflare Pages, with zero ongoing cost or live dependency.

WorldCover only covers -60°..84° latitude (no Antarctica/high Arctic) —
the rest of the canvas is filled with the snow/ice colour, which is an
accurate description of those regions anyway.

Source: ESA WorldCover 10m 2020 v100, CC-BY 4.0, s3://esa-worldcover
Output: img/worldcover-2020-globe-texture.png — 4096×2048 equirectangular,
        matching the existing globe texture's WIDTH/HEIGHT exactly.

Usage:
    pip install rasterio pillow numpy
    python scripts/build_landcover_texture.py
"""

import os
import numpy as np
import rasterio
from rasterio.env import Env
from rasterio.enums import Resampling
from PIL import Image

VRT_URL = (
    "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
    "v100/2020/ESA_WorldCover_10m_2020_v100_Map_AWS.vrt"
)

CANVAS_W, CANVAS_H = 4096, 2048  # matches js/forest.js's existing globe texture request
LAT_TOP, LAT_BOTTOM = 90.0, -90.0

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "img", "worldcover-2020-globe-texture.png")

# Official ESA WorldCover class legend (https://esa-worldcover.org)
ICE_FILL = (240, 240, 240)
LEGEND = {
    0:   (0, 100, 200),   # no data within the data band = open ocean
    10:  (0, 100, 0),     # tree cover
    20:  (255, 187, 34),  # shrubland
    30:  (255, 255, 76),  # grassland
    40:  (240, 150, 255), # cropland
    50:  (250, 0, 0),     # built-up
    60:  (180, 180, 180), # bare / sparse vegetation
    70:  ICE_FILL,        # snow and ice
    80:  (0, 100, 200),   # permanent water bodies
    90:  (0, 150, 160),   # herbaceous wetland
    95:  (0, 207, 117),   # mangroves
    100: (250, 230, 160), # moss and lichen
}


def main():
    print("Opening ESA WorldCover 2020 VRT…")
    with Env(AWS_NO_SIGN_REQUEST="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(VRT_URL) as ds:
            data_top, data_bottom = ds.bounds.top, ds.bounds.bottom
            row_top = round((LAT_TOP - data_top) / (LAT_TOP - LAT_BOTTOM) * CANVAS_H)
            row_bottom = round((LAT_TOP - data_bottom) / (LAT_TOP - LAT_BOTTOM) * CANVAS_H)
            band_h = row_bottom - row_top
            print(f"  data covers {data_top}°..{data_bottom}° lat -> canvas rows {row_top}..{row_bottom}")

            print(f"  reading decimated to {CANVAS_W}x{band_h} (mode resampling)…")
            data = ds.read(1, out_shape=(band_h, CANVAS_W), resampling=Resampling.mode)

    canvas = np.full((CANVAS_H, CANVAS_W, 3), ICE_FILL, dtype=np.uint8)
    band_rgb = np.zeros((*data.shape, 3), dtype=np.uint8)
    for val, color in LEGEND.items():
        band_rgb[data == val] = color
    canvas[row_top:row_top + data.shape[0]] = band_rgb

    img = Image.fromarray(canvas, "RGB")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    img.save(OUT_PATH, optimize=True)
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"  written to {OUT_PATH}  ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
