/**
 * GET /api/currents-live
 *
 * Fetches real-time surface geostrophic currents from Copernicus Marine
 * Service (CMEMS), builds a compact velocity grid server-side, and caches
 * it in KV for 12 hours.
 *
 * Data source:
 *   Product:  GLOBAL_ANALYSISFORECAST_PHY_001_024
 *   Dataset:  cmems_mod_glo_phy_anfc_0.083deg_P1D-m
 *   Variables: uo (eastward, m/s), vo (northward, m/s)
 *   Depth:    surface (~0.494 m)
 *   Stride:   48 × 0.083° ≈ 4° output resolution  (~3 600 cells)
 *   Auth:     HTTP Basic — credentials in env secrets CMEMS_USERNAME / CMEMS_PASSWORD
 *
 * Response shape (pre-built grid, ~30 KB):
 *   { step, width, height, latMin, latMax, lonMin, lonMax, u[], v[] }
 * The browser uses this directly — no JSON parsing of raw tables needed.
 *
 * KV binding: CLIMATE_CACHE (12-hour TTL)
 */

const CACHE_TTL = 60 * 60 * 12; // 12 hours

const CMEMS_ERDDAP = 'https://nrt.cmems-du.eu/erddap/griddap';
const DATASET_ID   = 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m';

// Stride 48 on 0.083° grid ≈ 4° resolution — matches our static grid step
const STRIDE  = 48;
const LAT_MIN = -80, LAT_MAX = 80;
const LON_MIN = -180, LON_MAX = 179; // avoid duplicate at ±180

export async function onRequestGet({ env }) {
  try {
    // ── KV cache (pre-built grid) ─────────────────────────────────────────────
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `currents_cmems_grid_${today}_s${STRIDE}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return respond(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Credentials ───────────────────────────────────────────────────────────
    if (!env.CMEMS_USERNAME || !env.CMEMS_PASSWORD) {
      const missing = [!env.CMEMS_USERNAME && 'CMEMS_USERNAME', !env.CMEMS_PASSWORD && 'CMEMS_PASSWORD'].filter(Boolean);
      return error(`CMEMS credentials missing: ${missing.join(', ')}`, 503);
    }
    const auth = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);

    // ── Build ERDDAP griddap URL ──────────────────────────────────────────────
    // Dimensions: [time][depth][latitude][longitude]
    // (last) = most recent available day; depth fixed at surface (~0.494 m)
    const sel = `[(last):1:(last)][(0.494):1:(0.494)][(${LAT_MIN}.0):${STRIDE}:(${LAT_MAX}.0)][(${LON_MIN}.0):${STRIDE}:(${LON_MAX}.0)]`;
    const url = `${CMEMS_ERDDAP}/${DATASET_ID}.json?uo${sel},vo${sel}`;

    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      const msg = await upstream.text();
      return error(`CMEMS HTTP ${upstream.status}: ${msg.slice(0, 300)}`);
    }

    const ct = upstream.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      const msg = await upstream.text();
      return error(`CMEMS unexpected content-type "${ct}": ${msg.slice(0, 200)}`);
    }

    // ── Parse + build compact grid (30 s CPU budget makes this easy) ──────────
    const raw  = await upstream.json();
    const grid = buildGrid(raw.table);

    const payload = JSON.stringify(grid);

    // ── KV cache write (fire-and-forget) ──────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, payload, { expirationTtl: CACHE_TTL });
    }

    return respond(payload, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return error(err.message);
  }
}

/* ── Grid builder ────────────────────────────────────────────────────────────
 * Converts an ERDDAP JSON table (CMEMS or NOAA) into a compact velocity grid.
 * Column names handled: uo/vo (CMEMS) and ugos/vgos (NOAA legacy).
 * Output: { step, width, height, latMin, latMax, lonMin, lonMax, u[], v[] }
 * North-at-top layout: row 0 = latMax, matching the browser's toGridXY().
 */
function buildGrid(table) {
  const cols = table.columnNames;
  const rows = table.rows;

  const latI = cols.indexOf('latitude');
  const lonI = cols.indexOf('longitude');
  const uI   = cols.findIndex(c => c === 'uo'   || c === 'ugos');
  const vI   = cols.findIndex(c => c === 'vo'   || c === 'vgos');

  if (latI < 0 || lonI < 0 || uI < 0 || vI < 0) {
    throw new Error(`Unexpected ERDDAP columns: ${cols.join(', ')}`);
  }

  // Collect unique sorted coordinate values to determine grid shape
  const latSet = new Set(), lonSet = new Set();
  for (const row of rows) {
    if (row[latI] != null) latSet.add(+row[latI].toFixed(4));
    if (row[lonI] != null) lonSet.add(+row[lonI].toFixed(4));
  }

  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);

  const latMin = lats[0],      latMax = lats[lats.length - 1];
  const lonMin = lons[0],      lonMax = lons[lons.length - 1];
  const height = lats.length;
  const width  = lons.length;
  const step   = lats.length > 1 ? +(lats[1] - lats[0]).toFixed(4) : 4;

  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);

  for (const row of rows) {
    const lat = row[latI], lon = row[lonI];
    const uv  = row[uI],   vv  = row[vI];
    if (lat == null || lon == null || uv == null || vv == null) continue;
    if (isNaN(uv) || isNaN(vv)) continue;

    // North-at-top: row 0 = latMax
    const col  = Math.round((lon - lonMin) / step);
    const rowI = Math.round((latMax - lat) / step);
    if (col < 0 || col >= width || rowI < 0 || rowI >= height) continue;

    u[rowI * width + col] = uv;
    v[rowI * width + col] = vv;
  }

  return {
    step, width, height, latMin, latMax, lonMin, lonMax,
    u: Array.from(u),
    v: Array.from(v),
  };
}

function respond(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  });
}

function error(msg, status = 502) {
  return respond({ error: msg }, status);
}
