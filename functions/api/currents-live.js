/**
 * GET /api/currents-live
 *
 * CORS proxy for NOAA CoastWatch ERDDAP (nesdisSSH1day).
 * Returns the raw ERDDAP JSON table — the browser does all parsing and
 * grid-building so the Worker stays well within the free-tier 10 ms CPU limit.
 *
 * Data source:
 *   Dataset:   nesdisSSH1day (NOAA CoastWatch)
 *   Variables: ugos (eastward, m/s), vgos (northward, m/s)
 *   Res:       0.25°, daily NRT, global (~80S–80N)
 *   Auth:      none — public ERDDAP endpoint
 *
 * Uses KV binding CLIMATE_CACHE (12-hour TTL) when available.
 */

const CACHE_TTL   = 60 * 60 * 12; // 12 hours
const GRID_STRIDE = 16;            // 16 × 0.25° = 4° output resolution

const ERDDAP_BASE = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap';
const DATASET_ID  = 'nesdisSSH1day';

const LAT_MIN = -80, LAT_MAX = 80;
const LON_MIN = -180, LON_MAX = 180;

export async function onRequestGet({ env }) {
  try {
    // ── KV cache (stores raw ERDDAP response text) ────────────────────────────
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `currents_erddap_raw_${today}_s${GRID_STRIDE}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return respond(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Fetch from ERDDAP ─────────────────────────────────────────────────────
    // Literal brackets required — encodeURIComponent breaks ERDDAP griddap syntax.
    const latRange = `(${LAT_MIN}.0):${GRID_STRIDE}:(${LAT_MAX}.0)`;
    const lonRange = `(${LON_MIN}.0):${GRID_STRIDE}:(${LON_MAX}.0)`;
    const sel      = `[(last):1:(last)][${latRange}][${lonRange}]`;
    const query    = `ugos${sel},vgos${sel}`;
    const url      = `${ERDDAP_BASE}/${DATASET_ID}.json?${query}`;

    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!upstream.ok) {
      const msg = await upstream.text();
      return error(`ERDDAP HTTP ${upstream.status}: ${msg.slice(0, 300)}`);
    }

    const ct = upstream.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      const msg = await upstream.text();
      return error(`ERDDAP unexpected content-type "${ct}": ${msg.slice(0, 200)}`);
    }

    // Read as plain text — avoids JSON.parse in the Worker (CPU-intensive).
    // The browser parses and builds the velocity grid instead.
    const body = await upstream.text();

    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL });
    }

    return respond(body, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return error(err.message);
  }
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
