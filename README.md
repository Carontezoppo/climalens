# ClimaLens

ClimaLens makes climate data easier to read. It turns satellite observations, ocean measurements and historical records into a visual story that people without a background in climate science can follow.

Live at **[climalens.org](https://climalens.org)**.

## Pages

| Page | What it shows |
|---|---|
| **Weather** (`index.html`) | Current conditions, a 9-day forecast with hourly breakdown, temperature chart, air quality and a live wind map |
| **History** (`history.html`) | Climate trend since 1981, jet stream position (NAO / SAM), polar vortex strength and the animated polar vortex map, historical statistics and a monthly breakdown for the selected city |
| **Sea** (`sea.html`) | Global mean sea level and city water-level map, sea surface temperature, El Niño / La Niña, Arctic and Antarctic sea ice, live ocean currents |
| **Land Cover** (`forest.html`) | ESA WorldCover land cover globe and a MODIS land cover animation from 2001 to 2024 |
| **Footprint** (`footprint.html`) | Air pollution (aerosol optical depth) and light pollution seen from space |
| **About** (`about.html`) | The project, and credits for every data source |

The Weather and History pages follow the city chosen in the header, and the choice is remembered between visits.

## Polar vortex map

On the History page, below the polar vortex strength chart, an animated map shows the stratosphere about 30 km up (10 hPa), seen from directly above the pole.

- **Moving particles** follow the winds. Colour them by **speed** (the default) or by **temperature**. On the temperature scale, near-average air is pale and faint, while extremes stand out, from electric blue below −78 °C (cold enough for polar stratospheric clouds) to red-orange.
- **Contour lines** show the height of the 10 hPa surface. The innermost, lowest ring is the vortex core, so a vortex that has been pushed off the pole or split in two is visible even in a still frame.
- A **dashed 60° ring** marks the latitude the strength chart above it measures.
- A **day slider** with Play steps through today plus 10 days of ECMWF forecast. The particles keep moving when the day changes, so the flow shifts into the new pattern.
- A **side panel** explains how to read the map and says in words where the vortex core and the strongest winds are. It also gives the average west–east wind at 60°, the same measure as the strength chart, so the two can be compared.
- The hemisphere follows the selected city, and the map is hidden for tropical cities, matching the strength chart.
- **Accessibility:** "Pause wind" stops the animation, the summary is read out to screen readers, and with reduced motion the map shows a still frame of short streaks instead of moving particles.

**Data:** ECMWF IFS open data via [Open-Meteo](https://open-meteo.com). Open-Meteo bills each grid point and allows 600 per minute, so the server function (`functions/api/polar-vortex-map.js`) requests about 440 points, fewer towards the pole, and converts them into a regular 5° grid covering 30° to 85°. Responses are cached for 6 hours, with a 30-day fallback copy if Open-Meteo is unavailable.

**Rendering:** `js/polar-vortex-map.js` draws on plain canvas with no map library. Leaflet's Mercator projection can't show the pole, so the map uses an orthographic projection centred on it. Particles move in screen coordinates, because stepping in latitude and longitude breaks down near the pole.

## How it's built

- **No build step.** Static HTML, one stylesheet (`css/dashboard.css`) and plain `<script>` tags. Scripts share globals instead of using ES modules or a bundler.
- **Cloudflare Pages** hosts the site. Every data request goes through a Cloudflare Function in `functions/api/` that calls the upstream API, reshapes the response and caches it in Workers KV (`CLIMATE_CACHE` binding).
- **Dark and light themes**, both designed to meet WCAG 2.1 AA.

## Running locally

```bash
npm install
npx wrangler pages dev . --port 8788
```

Then open <http://localhost:8788>.

The `/api/*` endpoints are Cloudflare Functions, so they only work under `wrangler pages dev`. A plain static server (Live Server, `python -m http.server`) loads the pages, but every data request returns 404.

Some endpoints need credentials. Put them in a `.dev.vars` file, which is gitignored:

```
CMEMS_USERNAME=...
CMEMS_PASSWORD=...
ECMWF_TOKEN=...
```

- `CMEMS_USERNAME` / `CMEMS_PASSWORD`: a free [Copernicus Marine](https://marine.copernicus.eu) account, for the sea ice and sea surface temperature maps.
- `ECMWF_TOKEN`: an API key from [api.ecmwf.int](https://api.ecmwf.int), for the Footprint page's air pollution layer. Without it, that layer returns 503.

KV caching is skipped locally, so every request goes to the upstream API. Some providers rate-limit repeated requests. Open-Meteo, for example, slows responses down once its per-minute allowance is used up.

## Deployment

A push to `main` deploys automatically through Cloudflare Pages. There is no CI pipeline. The Pages project needs the `CLIMATE_CACHE` KV namespace bound and the same three credentials set as secrets.

## Data sources

Full credits are on the [About page](https://climalens.org/about.html). The main sources are MET Norway (forecast), NASA POWER / MERRA-2 (historical climate), NASA GSFC (polar vortex strength), Open-Meteo (ECMWF data for the polar vortex map, CAMS air quality, ERA5 marine data), NOAA (jet stream indices, El Niño, ocean currents), the University of Colorado (sea level), Copernicus Marine and NASA GIBS (sea ice, sea surface temperature), ESA WorldCover and MODIS (land cover), and NASA Black Marble (light pollution).
