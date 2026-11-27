"""
Pre-render the 2001–2024 land cover animation frames on forest.html, recoloured
with the ESA WorldCover palette used by the globe above it, so the two maps
share one colour key.

Source: MODIS Combined (Terra + Aqua) IGBP Land Cover Type 1, annual, 500 m,
via NASA GIBS WMS (EPSG:3857, full world, 4096×4096). GIBS renders the 17 IGBP
classes as flat, exact colours (no anti-aliasing), so each GIBS colour maps
one-to-one onto a class and is replaced with that class's WorldCover colour.

IGBP has classes WorldCover doesn't (five forest types, two shrubland types,
savannas, cropland/natural mosaic). Forest and shrubland types are merged into
WorldCover's Tree cover and Shrubland. Savannas and the mosaic class get their
own colours, chosen between the WorldCover colours they sit between.
The legend in forest.html lists the same colours: keep the two in sync.

Output: img/modis-landcover/<year>.png — 4-bit palette PNGs, committed as
static assets (no live GIBS dependency, smaller than the RGBA frames GIBS
serves). Re-run when NASA publishes a new year, after bumping YEAR_MAX here
and FOREST_YEAR_MAX in js/forest.js.

Usage:
    pip install pillow numpy
    python scripts/build_modis_landcover_frames.py
(on python.org macOS installs: SSL_CERT_FILE=/etc/ssl/cert.pem python …)
"""

import io
import os
import urllib.request

import numpy as np
from PIL import Image

YEAR_MIN, YEAR_MAX = 2001, 2024
SIZE = 4096
BBOX = "-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244"
WMS = (
    "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0"
    "&REQUEST=GetMap&LAYERS=MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"
    "&FORMAT=image%2Fpng&TRANSPARENT=FALSE&CRS=EPSG%3A3857"
    f"&BBOX={BBOX}&WIDTH={SIZE}&HEIGHT={SIZE}&TIME={{year}}-01-01"
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "img", "modis-landcover")

# WorldCover colours (same values as the globe legend in forest.html)
TREE      = (0x00, 0x64, 0x00)
SHRUB     = (0xFF, 0xBB, 0x22)
GRASS     = (0xFF, 0xFF, 0x4C)
CROP      = (0xF0, 0x96, 0xFF)
BUILT     = (0xFA, 0x00, 0x00)
BARE      = (0xB4, 0xB4, 0xB4)
SNOW      = (0xF0, 0xF0, 0xF0)
WATER     = (0x00, 0x64, 0xC8)
WETLAND   = (0x00, 0x96, 0xA0)
# MODIS-only classes
WOODY_SAV = (0x5A, 0x9A, 0x1E)  # between Tree cover and Grassland, closer to trees
SAVANNA   = (0xC2, 0xDC, 0x3A)  # between Tree cover and Grassland, closer to grass
MOSAIC    = (0xF8, 0xCF, 0xFF)  # pale Cropland: part cropland, part natural

# GIBS colour (MODIS_IGBP_Land_Cover_Type colormap) → output colour
REMAP = {
    (33, 138, 33):   TREE,       # 1 Evergreen needleleaf forest
    (49, 204, 49):   TREE,       # 2 Evergreen broadleaf forest
    (152, 204, 49):  TREE,       # 3 Deciduous needleleaf forest
    (150, 250, 150): TREE,       # 4 Deciduous broadleaf forest
    (141, 186, 141): TREE,       # 5 Mixed forest
    (186, 141, 141): SHRUB,      # 6 Closed shrubland
    (245, 222, 179): SHRUB,      # 7 Open shrubland
    (218, 235, 157): WOODY_SAV,  # 8 Woody savanna
    (255, 213, 0):   SAVANNA,    # 9 Savanna
    (240, 185, 103): GRASS,      # 10 Grassland
    (71, 131, 181):  WETLAND,    # 11 Permanent wetland
    (250, 239, 115): CROP,       # 12 Cropland
    (255, 0, 0):     BUILT,      # 13 Urban and built-up
    (153, 147, 86):  MOSAIC,     # 14 Cropland / natural vegetation mosaic
    (255, 255, 255): SNOW,       # 15 Permanent snow and ice
    (191, 191, 189): BARE,       # 16 Barren
    (134, 202, 227): WATER,      # 0, 17 Water
    (100, 100, 100): WATER,      # 255 Unclassified: a 1-px seam at the antimeridian
}

PALETTE = sorted(set(REMAP.values()))  # 12 colours → fits a 4-bit PNG


def build(year):
    with urllib.request.urlopen(WMS.format(year=year), timeout=180) as r:
        rgb = np.array(Image.open(io.BytesIO(r.read())).convert("RGB"))
    key = (rgb[..., 0].astype(np.uint32) << 16) | (rgb[..., 1].astype(np.uint32) << 8) | rgb[..., 2]
    idx = np.full(key.shape, 255, np.uint8)
    for src, dst in REMAP.items():
        idx[key == ((src[0] << 16) | (src[1] << 8) | src[2])] = PALETTE.index(dst)
    if (idx == 255).any():
        raise SystemExit(f"{year}: {int((idx == 255).sum())} pixels with a colour not in REMAP — GIBS palette changed?")
    out = Image.fromarray(idx, "P")
    out.putpalette([c for rgb_ in PALETTE for c in rgb_])
    path = os.path.join(OUT_DIR, f"{year}.png")
    out.save(path, optimize=True, bits=4)
    print(f"{year}: {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for y in range(YEAR_MIN, YEAR_MAX + 1):
        build(y)
