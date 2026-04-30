# Water Level card — brief

## Goal

A 5m sea level rise is invisible on a global map because the coastline stroke is thicker than the actual inundation. We solve this by giving the card two layers of meaning:

- **Global Trend** — the "why". One number, one sparkline, one sentence of context.
- **Local Risk** — the "what". Hotspot markers on coastal cities that drill down into high-resolution detail.

The card should feel alive at a glance and reveal depth on interaction.

---

## Approach — decided

**Card structure: two sections**

- **Section A — Global Vital Sign**
  - Headline: *Global Mean Sea Level (GMSL)*
  - Metric: current rate (e.g. +3.4 mm/year — verify against latest source)
  - Sparkline: same visual language as the existing History graphs
  - Context line: short framing sentence (see "Card copy" below)

- **Section B — Regional Alert (interactive map)**
  - 10–15 pulsing radial markers on coastal mega-cities
  - Soft, semi-transparent blue pulse — the map should look like the ocean is breathing against the coast
  - Click on a marker → map zooms in → base layer swaps to ESA WorldCover (10m) or Copernicus Land Cover (100m) above zoom level 12
  - Card content updates to show that city's local trend, drawing on the existing History tab logic

**Global layer: anomaly, not inundation**

For the zoomed-out world view, render a **Sea Level Anomaly** layer (volume/energy change vs 1993 baseline), not an inundation map. Red = warmer/higher, blue = cooler/lower. This is the only way the global scale carries meaning — inundation only becomes legible at city zoom.

**POI data model: distinguish eustatic from relative rise**

Each hotspot's data should carry both:
- **Eustatic** — the global average component (thermal expansion, meltwater)
- **Relative** — what people actually experience (eustatic + local subsidence)

This lets the UI educate users that climate change isn't the only factor — land use and subsidence matter too, which connects naturally to the existing ESA Land Cover work.

---

## Open questions — please flag before building

1. **Predictive slider in scope?** A "+1m / +5m" user-controlled slider would need a DEM-based approach (CoastalDEM or similar) with vector tiles for performance. This is a much bigger build than the anomaly + hotspots approach above. Is it in scope for this iteration, a follow-up, or out of scope entirely?
2. **Which cities for hotspots?** I had Jakarta, Venice, Miami, Bangkok, Kiribati & Tuvalu, Maldives, Solomon Island, Mekong Delta in Vietnam, Netherlands, even USA east coast cities like New Orleans in mind — but I'd like a recommendation on the most representative 10–15 globally, balanced across regions and rise causes (eustatic-dominated vs subsidence-dominated).
3. **Marker click behaviour — popup vs panel?** Should the per-city detail (relative rise, cause, sparkline) appear in a popup over the map, or should it replace the card content? My instinct is replace, but flag if there's a reason to prefer popup.
4. **Bubble labels?** Possible to show a city name label on hover or click without cluttering the global view?

---

## Data sources — verify endpoints before integrating

> ⚠️ Some of these endpoints are from older documentation. Please verify each is live and returns the expected format before wiring it in. CMEMS in particular reorganised its access — the legacy `nrt.cmems-du.eu` URL may need replacing with the current Marine Data Store endpoint.

| Purpose | Provider | Notes |
|---|---|---|
| Global trend sparkline | NASA JPL / PO.DAAC — Global Sea Level Indicator | Standard CSV/JSON, auto-updating. Likely the most reliable of the four. |
| Global anomaly map layer | Copernicus Marine Service | Sea level gridded data from satellite observations. WMS layer. **Verify current endpoint.** |
| City inundation context | Climate Central — CoastalDEM | Full API is paid; their public Coastal Risk Screening Tool can inform manually-defined "at risk" polygons for hotspots. |
| Local tide gauge history | PSMSL (Permanent Service for Mean Sea Level) | Mostly downloadable data files rather than a live REST API — confirm what's actually available before assuming we can hit it dynamically. |

---

## Card copy — tone and examples

The card should narrate, not just display. Two reference examples for the kind of language I'm after:

**Global context line (Section A):**
> "The ocean is currently rising at nearly double the rate of the 20th century. Since 1993, the global average has risen by ~10 cm."

**City detail (Section B, on Venice click):**
> "Venice, Italy: +25cm relative rise since 1900. A combination of melting ice and subsidence — the land is sinking while the water is rising."

**The "spatial proof" pattern** — where it works, correlate Land Cover change with Sea Level data to turn a statistic into a visible story:
> "This area in Florida was 40% wetland in 1992. Today, it is 80% water. This matches the 12cm sea level rise recorded at the nearest tide gauge."

That last pattern is the one I think is most distinctive — it uses the ESA Land Cover layer we already have to make the sea level data feel concrete rather than abstract.

---

## Legend (for the global anomaly layer)

**Ocean Volume Status**
- Red (+): Thermal expansion and meltwater accumulation
- Blue (−): Temporary cooling (La Niña cycles)
- Note: Global sea level is not a level bathtub — wind and currents cause it to pile up unevenly.
