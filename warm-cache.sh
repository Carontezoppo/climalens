#!/bin/bash
# Warms the KV cache for all ClimaLens locations (read from js/config.js)
# after a deploy.
# Hits /api/climate and /api/normals for each location. Both endpoints
# now use NASA POWER which has no meaningful rate limits — 1s delay is
# just courtesy to their servers.
#
# Also warms /api/polar-vortex-map for both hemispheres. Each request costs
# ~440 of Open-Meteo's 600-per-minute allowance, so the two are sent at least
# 65 s apart: north before the city loop, south after it.
#
# Usage: ./warm-cache.sh [base_url]
# Default base_url: https://climalens.org

BASE="${1:-https://climalens.org}"
DELAY=1

# Cities come straight from js/config.js, so the list can't fall behind the
# location picker (a hand-kept copy here once missed 26 cities). Each entry
# there is one line: { name: '…', lat: …, lon: …, … }
CONFIG="$(cd "$(dirname "$0")" && pwd)/js/config.js"
LOCATIONS=()
while IFS= read -r line; do
  LOCATIONS+=("$line")
done < <(sed -n -E "s/.*name: *'([^']+)', *lat: *(-?[0-9.]+), *lon: *(-?[0-9.]+).*/\1|\2|\3/p" "$CONFIG")

if [ "${#LOCATIONS[@]}" -eq 0 ]; then
  echo "No locations found in $CONFIG — has its format changed?" >&2
  exit 1
fi

TOTAL=${#LOCATIONS[@]}
echo "Warming cache for $TOTAL locations against $BASE"
echo "Estimated time: ~$((TOTAL * DELAY * 2 / 60)) minutes"
echo ""

# Polar vortex map — north now, south after the city loop (≥65 s later)
PV_START=$SECONDS
status_pv=$(curl -s -m 40 -o /dev/null -w "%{http_code}" "$BASE/api/polar-vortex-map?hemi=n")
echo "Polar vortex map (north): $status_pv"
echo ""

for i in "${!LOCATIONS[@]}"; do
  IFS='|' read -r name lat lon <<< "${LOCATIONS[$i]}"
  n=$((i + 1))

  printf "[%2d/%d] %-30s" "$n" "$TOTAL" "$name"

  status_c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/climate?lat=$lat&lon=$lon")
  printf " climate:%s" "$status_c"
  sleep $DELAY

  status_n=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/normals?lat=$lat&lon=$lon")
  printf " normals:%s\n" "$status_n"
  sleep $DELAY
done

echo ""
PV_WAIT=$((65 - (SECONDS - PV_START)))
if [ "$PV_WAIT" -gt 0 ]; then
  echo "Waiting ${PV_WAIT}s before the second polar vortex request (Open-Meteo per-minute limit)…"
  sleep "$PV_WAIT"
fi
status_pv=$(curl -s -m 40 -o /dev/null -w "%{http_code}" "$BASE/api/polar-vortex-map?hemi=s")
echo "Polar vortex map (south): $status_pv"

echo ""
echo "Done."
