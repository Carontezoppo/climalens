#!/bin/bash
# Warms the KV cache for all ClimaLens locations after a deploy.
# Hits /api/climate and /api/normals for each location with a 5-second gap
# between calls to stay within Open-Meteo's per-minute rate limit.
#
# Usage: ./warm-cache.sh [base_url]
# Default base_url: https://climalens.org

BASE="${1:-https://climalens.org}"
DELAY=5

declare -a LOCATIONS=(
  "Birmingham UK|52.48|-1.90"
  "Almeria Spain|36.84|-2.46"
  "Amsterdam Netherlands|52.37|4.90"
  "Athens Greece|37.98|23.72"
  "Berlin Germany|52.52|13.40"
  "Brussels Belgium|50.85|4.35"
  "Budapest Hungary|47.50|19.04"
  "Copenhagen Denmark|55.68|12.57"
  "Dublin Ireland|53.33|-6.25"
  "Edinburgh UK|55.95|-3.19"
  "Elba Italy|42.78|10.23"
  "Florence Italy|43.77|11.25"
  "Grosseto Italy|42.76|11.11"
  "Helsinki Finland|60.17|24.94"
  "Kyiv Ukraine|50.45|30.52"
  "Lisbon Portugal|38.72|-9.14"
  "London UK|51.51|-0.13"
  "Madrid Spain|40.42|-3.70"
  "Manchester UK|53.48|-2.24"
  "Milan Italy|45.46|9.19"
  "Moscow Russia|55.75|37.62"
  "Naples Italy|40.85|14.25"
  "Oslo Norway|59.91|10.75"
  "Paris France|48.85|2.35"
  "Prague Czechia|50.08|14.43"
  "Rome Italy|41.90|12.50"
  "St Petersburg Russia|59.93|30.33"
  "Stockholm Sweden|59.33|18.07"
  "Svalbard Norway|78.22|15.63"
  "Vienna Austria|48.21|16.37"
  "Warsaw Poland|52.23|21.01"
  "Zurich Switzerland|47.37|8.54"
  "Istanbul Turkey|41.01|28.95"
  "Chicago USA|41.88|-87.63"
  "Los Angeles USA|34.05|-118.24"
  "New York USA|40.71|-74.01"
  "Sao Paulo Brazil|-23.55|-46.63"
  "Toronto Canada|43.65|-79.38"
  "Vancouver Canada|49.28|-123.12"
  "Manaus Brazil|-3.11|-60.02"
  "Mexico City Mexico|19.43|-99.13"
  "Buenos Aires Argentina|-34.60|-58.38"
  "Aral Sea Uzbekistan|45.00|60.00"
  "Bangalore India|12.97|77.59"
  "Beijing China|39.90|116.40"
  "Delhi India|28.61|77.21"
  "Dubai UAE|25.20|55.27"
  "Mumbai India|19.07|72.88"
  "Shanghai China|31.23|121.47"
  "Singapore|1.35|103.82"
  "Tokyo Japan|35.68|139.69"
  "Seoul South Korea|37.56|126.97"
  "Ulaanbaatar Mongolia|47.92|106.92"
  "Great Barrier Reef Australia|-18.28|147.69"
  "Melbourne Australia|-37.81|144.96"
  "Sydney Australia|-33.87|151.21"
  "Auckland New Zealand|-36.85|174.76"
  "Wellington New Zealand|-41.29|174.78"
  "Cairo Egypt|30.04|31.24"
  "Cape Town South Africa|-33.92|18.42"
  "Lagos Nigeria|6.52|3.37"
  "Nairobi Kenya|-1.29|36.82"
  "Rabat Morocco|34.02|-6.84"
  "Tunis Tunisia|36.80|10.18"
  "Accra Ghana|5.56|-0.20"
  "Addis Ababa Ethiopia|9.03|38.74"
  "Longyearbyen Svalbard|78.22|15.64"
  "Barrow Alaska|71.29|-156.78"
  "McMurdo Antarctica|-77.85|166.67"
)

TOTAL=${#LOCATIONS[@]}
echo "Warming cache for $TOTAL locations against $BASE"
echo "Estimated time: ~$((TOTAL * DELAY * 2 / 60)) minutes"
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
echo "Done."
