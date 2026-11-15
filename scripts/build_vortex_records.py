"""
Build the per-day record high / low (with year) for the polar vortex chart.

The live NASA GSFC file used by /api/polar-vortex gives each day's record
minimum and maximum, but not the year they were set. This script downloads
every archived season file, finds for each calendar day (MM-DD) the lowest and
highest value and the year it occurred, and writes a small static JSON.

The client only shows a year when the record value here matches the live
file's min/max (±0.05 m/s), so a stale JSON degrades to "no year", never to a
wrong year. Re-run once a year after a season closes (NH: July, SH: January).

Source: https://acd-ext.gsfc.nasa.gov/Data_services/met/metdata/annual/merra2/wind/
Output: data/polar-vortex-records.json
        { "n": { "MM-DD": [min, minYear, max, maxYear], ... }, "s": {...}, "built": "YYYY-MM-DD" }

Usage (stdlib only):
    python scripts/build_vortex_records.py
"""

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import date

BASE = "https://acd-ext.gsfc.nasa.gov/Data_services/met/metdata/annual/merra2/wind"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "polar-vortex-records.json")
ROW = re.compile(r"^(\d{4})-(\d{2})-(\d{2})\s+(-?\d+(?:\.\d+)?)\s")

# Completed seasons only — the current season is not part of the climatology.
# NH files are named by the season's start year (Jul–Jun), SH by calendar year.
today = date.today()
LAST = {
    "n": today.year - 1 if today.month >= 7 else today.year - 2,
    "s": today.year - 1,
}
FIRST = {"n": 1978, "s": 1979}


def fetch(url, attempts=4):
    # The lab server occasionally drops connections mid-run; retry with backoff.
    req = urllib.request.Request(url, headers={"User-Agent": "ClimaLens build script"})
    for i in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if i == attempts - 1:
                raise
            time.sleep(2 ** (i + 1))


def build(hemi):
    records = {}  # "MM-DD" -> [min, minYear, max, maxYear]
    for year in range(FIRST[hemi], LAST[hemi] + 1):
        url = f"{BASE}/u60{hemi}_10_{year}_merra2.txt"
        try:
            text = fetch(url)
        except urllib.error.HTTPError as e:
            print(f"  {hemi} {year}: HTTP {e.code}, skipped")
            continue
        n = 0
        for line in text.splitlines():
            m = ROW.match(line)
            if not m:
                continue
            value = float(m.group(4))
            if value == -9999.0:
                continue
            key, yr = f"{m.group(2)}-{m.group(3)}", int(m.group(1))
            rec = records.get(key)
            if rec is None:
                records[key] = [value, yr, value, yr]
            else:
                if value < rec[0]:
                    rec[0], rec[1] = value, yr
                if value > rec[2]:
                    rec[2], rec[3] = value, yr
            n += 1
        print(f"  {hemi} {year}: {n} days")
        time.sleep(0.3)  # be polite to a lab server
    return dict(sorted(records.items()))


if __name__ == "__main__":
    out = {}
    for hemi in ("n", "s"):
        print(f"Hemisphere {hemi}: seasons {FIRST[hemi]}–{LAST[hemi]}")
        out[hemi] = build(hemi)
    out["built"] = today.isoformat()
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")
