"""
Pre-render the natural vs cultivated grassland map on forest.html (2000 and
2024) from Global Pasture Watch v2.

Source: Global Pasture Watch, annual 30 m grassland maps 2000–2024 (Parente
et al. 2024, Land & Carbon Lab / OpenGeoHub, CC-BY 4.0), read from the public
OpenGeoHub COG mirror. Each year is a 16 GB global GeoTIFF, but COGs carry
low-resolution overviews, so GDAL fetches only those over HTTP range requests
(a few MB per layer).

Why the probability layers, not the dominant-class layer: the class layer's
overviews keep one sample pixel per block, so landscapes of small pasture
fields (western Europe) vanish at global scale. The probability layers'
overviews are block averages (checked against block means of the full-res
data), so at this scale they show how much of an area is cultivated or
natural grassland.

Rendering: colour = whichever of the two is larger (cultivated → violet,
natural → the key's grassland yellow); strength = how much of the area is
grassland, blended over a muted context layer. The context (forest, cropland,
other land, water, snow) comes from the MODIS frame of the same year (2001 for
2000, the earliest MODIS year), so areas that aren't grassland still say what
they are, and the image matches that map's grid exactly (EPSG:3857,
4096×4096, ±85.051°).
Keep the colours in sync with the legend in forest.html.

Output: img/grassland/<year>.png (palette PNGs).

Usage:
    pip install rasterio pillow numpy
    python scripts/build_grassland_frames.py
(on python.org macOS installs: SSL_CERT_FILE=/etc/ssl/cert.pem python …)
Run build_modis_landcover_frames.py first: the context comes from its frames.
"""

import math
import os

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.env import Env

YEARS = (2000, 2024)
SIZE = 4096                      # matches the MODIS frames
MERC_MAX_LAT = 85.0511287798
SRC_ROWS, SRC_COLS = 6000, 8192  # enough rows for Mercator's stretch at 76°N
COG = (
    "/vsicurl/https://s3.eu-central-1.wasabisys.com/arco/"
    "gpw_{layer}_rf.med.filt_p_30m_{y}0101_{y}1231_go_epsg.4326_v2.tif"
)
HERE = os.path.dirname(__file__)
MODIS = os.path.join(HERE, "..", "img", "modis-landcover", "{}.png")
MODIS_YEAR = {2000: 2001, 2024: 2024}   # MODIS starts in 2001
OUT_DIR = os.path.join(HERE, "..", "img", "grassland")

# Muted context colours: dark enough that the grassland colours stay the focus
FOREST = (36, 74, 46)    # MODIS tree cover
CROP   = (92, 84, 72)    # MODIS cropland and cropland/natural mosaic
LAND   = (52, 57, 70)    # other land / not mapped
CONTEXT = (FOREST, CROP, LAND)
NAT   = (255, 255, 76)   # natural / semi-natural grassland (= key's Grassland)
CULT  = (167, 139, 250)  # cultivated grassland
WATER = (0, 100, 200)    # same as the land cover key
SNOW  = (240, 240, 240)
LEVELS = 16              # strength steps per colour (3 contexts × 2 × 15 + 5 ≤ 256)
FULL_AT = 60             # % grassland at which the colour is at full strength
# MODIS frame colours (scripts/build_modis_landcover_frames.py)
M_TREE, M_CROP, M_MOSAIC = (0, 100, 0), (240, 150, 255), (248, 207, 255)


def read_layer(layer, year):
    with rasterio.open(COG.format(layer=layer, y=year)) as ds:
        a = ds.read(1, out_shape=(SRC_ROWS, SRC_COLS), resampling=Resampling.nearest)
        return a, ds.bounds


def to_mercator(src, bounds):
    """Nearest-neighbour resample an EPSG:4326 array onto the 4096² Mercator grid."""
    y = (np.arange(SIZE) + 0.5) / SIZE
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * y))))
    lon = -180 + (np.arange(SIZE) + 0.5) * 360 / SIZE
    rows = np.floor((bounds.top - lat) / (bounds.top - bounds.bottom) * SRC_ROWS).astype(int)
    cols = np.floor((lon - bounds.left) / (bounds.right - bounds.left) * SRC_COLS).astype(int)
    out = np.full((SIZE, SIZE), 255, np.uint8)  # 255 = no data (outside 56°S–76°N too)
    r_ok = (rows >= 0) & (rows < SRC_ROWS)
    c_ok = (cols >= 0) & (cols < SRC_COLS)
    out[np.ix_(r_ok, c_ok)] = src[np.ix_(rows[r_ok], cols[c_ok])]
    return out


def build(year, palette):
    modis = np.array(Image.open(MODIS.format(MODIS_YEAR[year])).convert("RGB"))
    is_ = lambda col: (modis == col).all(-1)
    water, snow = is_(WATER), is_(SNOW)
    ctx = np.full((SIZE, SIZE), 2, np.int16)          # other land
    ctx[is_(M_TREE)] = 0
    ctx[is_(M_CROP) | is_(M_MOSAIC)] = 1

    c, b = read_layer("cultiv.grassland", year)
    n, _ = read_layer("nat.semi.grassland", year)
    c = to_mercator(c, b).astype(np.int16)
    n = to_mercator(n, b).astype(np.int16)
    nodata = (c == 255) | (n == 255)
    c[nodata] = 0
    n[nodata] = 0
    level = np.clip((c + n) * (LEVELS - 1) // FULL_AT, 0, LEVELS - 1)
    # palette: 0 water, 1 snow, 2–4 contexts, then per context: LEVELS-1 natural, LEVELS-1 cultivated
    step = 2 * (LEVELS - 1)
    base = 5 + ctx * step
    idx = np.where(level == 0, 2 + ctx,
                   np.where(c > n, base + (LEVELS - 1) + level - 1, base + level - 1)).astype(np.uint8)
    idx[water] = 0
    idx[snow] = 1
    img = Image.fromarray(idx, "P")
    img.putpalette(palette)
    path = os.path.join(OUT_DIR, f"{year}.png")
    img.save(path, optimize=True)
    print(f"{year}: {os.path.getsize(path) // 1024} KB")


def make_palette():
    def mix(bg, col, t):
        return [round(bg[i] + (col[i] - bg[i]) * t) for i in range(3)]
    pal = [*WATER, *SNOW, *FOREST, *CROP, *LAND]
    for bg in CONTEXT:
        for col in (NAT, CULT):
            for lv in range(1, LEVELS):
                pal += mix(bg, col, lv / (LEVELS - 1))
    return pal


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    pal = make_palette()
    with Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        for y in YEARS:
            build(y, pal)
