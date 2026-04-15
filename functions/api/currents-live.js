/**
 * GET /api/currents-live
 *
 * Fetches surface ocean geostrophic current velocity (ugos, vgos) from the
 * NOAA CoastWatch ERDDAP server and returns a compact JSON grid for the
 * browser particle animation engine.
 *
 * Data source:
 *   Dataset:    nesdisSSH1day (NOAA CoastWatch)
 *   Product:    Sea Surface Height Anomalies & Geostrophic Currents (altimetry)
 *   Variables:  ugos (eastward, m/s), vgos (northward, m/s)
 *   Resolution: 0.25°, daily, global, NRT (~3-5 day lag)
 *   Auth:       none — public ERDDAP endpoint
 *
 * No Cloudflare secrets required.
 * Uses KV binding CLIMATE_CACHE (12-hour TTL) when available.
 */

const CACHE_TTL   = 60 * 60 * 12; // 12 hours — data updates once daily
const GRID_STEP   = 4;            // output degrees (stride 16 on 0.25° native grid)
const GRID_STRIDE = 16;           // 16 × 0.25° = 4° per output cell → ~260 KB response

const ERDDAP_BASE  = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap';
const DATASET_ID   = 'nesdisSSH1day';

// Grid bounds (SSH altimetry covers ~80S–80N)
const LAT_MIN = -80, LAT_MAX = 80;
const LON_MIN = -180, LON_MAX = 180;

export async function onRequestGet({ env }) {
  try {
    // ── KV cache ─────────────────────────────────────────────────────────────
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `currents_ssh_${today}_${GRID_STEP}deg`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Build ERDDAP griddap URL ──────────────────────────────────────────────
    // (last) = latest available timestep; stride = GRID_STRIDE for downsampling
    const latRange = `(${LAT_MIN}.0):${GRID_STRIDE}:(${LAT_MAX}.0)`;
    const lonRange = `(${LON_MIN}.0):${GRID_STRIDE}:(${LON_MAX}.0)`;
    const sel      = `[(last):1:(last)][${latRange}][${lonRange}]`;
    const query    = `ugos${sel},vgos${sel}`;
    const url      = `${ERDDAP_BASE}/${DATASET_ID}.json?${encodeURIComponent(query)}`;

    const upstream = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return json(
        { error: `ERDDAP ${upstream.status}: ${err.slice(0, 300)}` },
        502,
      );
    }

    const raw  = await upstream.json();
    const grid = buildGrid(raw);

    const payload = JSON.stringify(grid);
    if (env.CLIMATE_CACHE) {
      // fire-and-forget — don't block the response
      env.CLIMATE_CACHE.put(cacheKey, payload, { expirationTtl: CACHE_TTL });
    }

    return json(payload, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

/**
 * Convert an ERDDAP griddap JSON table to a regular 2° grid.
 *
 * ERDDAP format:
 *   { table: { columnNames: [...], rows: [[time, lat, lon, u, v], ...] } }
 *
 * Output:
 *   { step, width, height, latMin, latMax, lonMin, lonMax, u[], v[] }
 */
function buildGrid(raw) {
  const step   = GRID_STEP;
  const width  = Math.round((LON_MAX - LON_MIN) / step) + 1; // 91  (at 4°)
  const height = Math.round((LAT_MAX - LAT_MIN) / step) + 1; // 41  (at 4°)

  const u = new Float32Array(width * height); // default 0
  const v = new Float32Array(width * height);

  const cols = raw.table.columnNames;
  const latI = cols.indexOf('latitude');
  const lonI = cols.indexOf('longitude');
  const uI   = cols.indexOf('ugos');
  const vI   = cols.indexOf('vgos');

  for (const row of raw.table.rows) {
    const lat = row[latI];
    const lon = row[lonI];
    const uv  = row[uI];
    const vv  = row[vI];
    if (lat == null || lon == null || uv == null || vv == null) continue;

    // North-at-top convention so bilinear() in the browser matches toGridXY()
    // which returns y=0 for latMax and y=(height-1) for latMin.
    const col  = Math.round((lon - LON_MIN) / step);
    const rowI = Math.round((LAT_MAX - lat) / step); // row 0 = north
    if (col < 0 || col >= width || rowI < 0 || rowI >= height) continue;

    u[rowI * width + col] = uv;
    v[rowI * width + col] = vv;
  }

  return {
    step, width, height,
    latMin: LAT_MIN, latMax: LAT_MAX,
    lonMin: LON_MIN, lonMax: LON_MAX,
    u: Array.from(u),
    v: Array.from(v),
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  });
}
