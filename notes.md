# ClimaLens — Project Notes

## What this is

A static HTML + vanilla JS weather and climate dashboard, live at **climalens.org** (Cloudflare Pages, auto-deploys from `main`). No build step, no bundler — plain `<script>` tags, CSS variables, Cloudflare Functions as API proxies, KV for caching.

---

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Weather & 7-day forecast |
| `history.html` | Historical climate (ERA5 trend + monthly range) |
| `sea.html` | Sea data: water level, SST, polar ice, ocean currents, paleocoastlines |
| `forest.html` | Land cover: WorldCover 2021 + MODIS animation |
| `about.html` | Static about page |

---

## Work done — feature by feature

### Foundation
- **Initial commit** as "MeteoScope", then refactored from a single-file dashboard into the current multi-file project structure (`js/`, `css/`, `functions/api/`).
- **Cloudflare Pages Functions** added as proxies for all upstream APIs (Open-Meteo forecast, climate, air quality, CMEMS, NOAA, sea level, sea ice). All errors return 503 — never 502, which Cloudflare intercepts.
- **KV caching** (`CLIMATE_CACHE` binding) on all functions. Cache TTL fixed from "midnight of creation date" to a proper rolling 24-hour window (or 1h/12h depending on endpoint).

### Weather page (`index.html`)
- 7-day forecast strip and hourly strip, temperature chart (Chart.js).
- Forecast detail modal (slide-in panel for each day).
- Current conditions card.
- **Day/night detection** — automatically uses night icons (e.g. `Clear_night.svg`) based on Open-Meteo's `is_day` field.
- **Average temperature comparison** strip in the forecast.
- **Dates shown** on each forecast day card.
- **Section title** updates dynamically with selected location.
- **Spinner** shown while data loads; hidden when a location result is already cached.
- **Air quality** card.
- **Windy iframe map** for weather.

### Historical page (`history.html`)
- ERA5 climate trend chart (1970–present), proxied via Cloudflare Function.
- Monthly KPI cards and breakdown table via historical range endpoint.
- Range picker is inline in the Historical Data section (deliberately not in the header).
- Section title updates dynamically with selected location.

### Sea page (`sea.html`)

#### Water level / sea level map
- GMSL sparkline (University of Colorado altimetry data).
- Leaflet map with pulsing city markers. Markers pulse blue (sea level data) or green (has `spatialProof` land cover correlation).
- City detail panel slides in on marker click; zooms map to level 8.
- At zoom ≥ 10 the base layer swaps from Esri satellite to ESA WorldCover tiles.
- Sea level map height increased on mobile.
- Satellite base map (replaced original monochromatic map).
- Extended city dataset with more locations.

#### Sea surface temperature (SST)
- Leaflet map with Copernicus Marine WMS tiles (proxied via `cmems-wms.js`).
- Z-index isolation fix applied to the map container (`isolation: isolate`).

#### Polar sea ice
- Dual Leaflet maps in polar stereographic projections (Arctic EPSG:3413 / Antarctic EPSG:3031).
- Historical mode: NASA GIBS SSMIS tiles (capped at 2020, `GIBS_LAST_YEAR` constant) + AMSRUE 12 km for 2002–2011.
- Live mode: Copernicus OSI-SAF AMSR2 via WMTS GetTile (switched from WMS after Copernicus dropped WMS in 2024). AMSR2 opacity set to 0.85.
- Live mode defaults on page load.
- Layer order: historical first, live on top.
- Fallback handling if live service fails.
- "2021 limit" removed from polar ice maps (earlier constraint lifted).

#### Ocean currents
- Canvas particle animation driven by a velocity grid.
- **Scaffolded with CMEMS**, then **switched to NOAA CoastWatch ERDDAP** (`nesdisSSH1day`, columns `ugos`/`vgos`, stride 16 to stay within CPU budget).
- Grid-building moved from Worker to browser to avoid Cloudflare free-tier CPU limit.
- Particles coloured by current type: orange (warm), blue (cold).
- Solid land fill and clear coastlines on the canvas.
- Static fallback velocity grid included — animation always works; live data upgrades it silently.
- Hover labels on the live particle map.
- Loading warning shown while data fetches; details card shown on load.
- Direct ERDDAP fallback if the Worker proxy is unavailable.

#### Paleocoastlines *(most recent feature)*
- Interactive world map showing coastlines over the last 100,000 years.
- Sea level curve from Spratt & Lisiecki (2016) + Lambeck et al. (2014), 21 time steps in 5 ka intervals.
- Two resolution options: 0.25° (~2 MB) and 0.10° (~33 MB) ETOPO 2022 binary grids stored in `data/`.
- DEM streamed with a live progress bar; handed to a Web Worker via zero-copy `ArrayBuffer` transfer.
- Custom `L.GridLayer` requests tile renders from the Worker; main thread never blocked.
- Slider steps through time; default is LGM (~20,000 years ago, −120 m) — most visually dramatic.
- After load, the alternate resolution button re-enables so the user can switch without refreshing.
- `scripts/build_etopo.py` documents how the `.bin` files were generated from raw ETOPO 2022 data.

### Land cover page (`forest.html`)
- **WorldCover 2021** (ESA, 10 m) via Terrascope WMTS — loads immediately, no gate.
- **MODIS animation** (500 m, 24 frames) — user-triggered via a load gate. Slider available on first frame; play button waits for full cache. `sessionStorage` flag skips the gate on return within the same session.
- Page rebuilt as a proper two-map layout (WorldCover on top, MODIS below).

### Navigation & shared UI
- Nav updated across all pages to reflect page names ("Land Cover", "Sea", etc.).
- Contextual navigation (active state per page).
- Logo links back to portfolio/main site.
- Location picker persists selected location across page navigations via `localStorage`.
- "Journey" section hooks and visual separations between sections added.
- Footer amended for consistency across pages.

### About page (`about.html`)
- Content written and added.
- Minor content amendments.

### Locations
- Added **Elba Island** and **Ulaanbaatar** to `LOCATIONS[]`.
- Extended the water level city dataset with more locations.

### Accessibility & polish
- WCAG 2.1 AA pass: semantic HTML, keyboard navigation, `aria-label` on icon-only buttons, focus styles, `aria-live` regions.
- Number formatting fixed globally: rain/sun as integers, snow to 1 decimal, wind to 1 decimal for averages / integer for individual readings, pressure/humidity as integers.
- Spacing and typography adjustments.
- Polar vortex section updated.

### Analytics & legal
- Cookie consent banner (dedicated implementation).
- Microsoft Clarity tracking added to all pages.
- SEO meta tags and icons (favicon, apple-touch-icon, og-image) added.
- Correct attributions added for all data sources.

---

## Key architectural decisions

- **No build step** — all JS loaded via plain `<script>` tags; globals shared across modules (`currentLocation`, `LOCATIONS`, etc.).
- **503 not 502** on all Cloudflare Functions — 502 gets intercepted by Cloudflare's own error page.
- **Rolling 24h cache TTL** — not fixed midnight, so cache never expires immediately after creation.
- **Web Worker for tile rendering** — paleocoastline tiles rendered off the main thread to keep the UI responsive even at high resolution.
- **Static fallback for currents** — the animation is never broken; live ERDDAP data upgrades it silently when available.
- **WMTS not WMS for sea ice** — Copernicus dropped WMS support in 2024; the live ice layer was rewritten to use WMTS GetTile.

---

## Data sources

| Source | Used for |
|---|---|
| Open-Meteo | Forecast, current conditions, historical ERA5, air quality |
| University of Colorado GMSL | Sea level time series (URL slug must be updated annually) |
| NASA GIBS | Historical polar sea ice (SSMIS, AMSRUE) |
| Copernicus OSI-SAF AMSR2 | Live polar sea ice |
| Copernicus Marine WMS | Sea surface temperature |
| NOAA CoastWatch ERDDAP | Ocean surface currents (`nesdisSSH1day`) |
| Terrascope WMTS | ESA WorldCover 2021 land cover tiles |
| NASA MODIS | Land cover animation (forest page) |
| Esri World Imagery | Satellite base tiles on the water level map |
| ETOPO 2022 | Elevation grid for paleocoastline rendering |
| Spratt & Lisiecki (2016), Lambeck et al. (2014) | Sea level curve for paleocoastlines |
