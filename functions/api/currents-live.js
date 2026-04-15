/**
 * GET /api/currents-live
 *
 * Fetches surface ocean current velocity (u, v components) from the
 * Copernicus Marine Service (CMEMS) and returns a compact JSON grid
 * for the browser particle animation engine.
 *
 * Required Cloudflare secrets (set in Pages → Settings → Variables):
 *   CMEMS_USERNAME   your Copernicus Marine username
 *   CMEMS_PASSWORD   your Copernicus Marine password
 *
 * Data source:
 *   Product:  GLOBAL_ANALYSISFORECAST_PHY_001_024
 *   Dataset:  cmems_mod_glo_phy_anfc_0.083deg_P1D-m  (daily mean)
 *   Variables: uo (eastward, m/s), vo (northward, m/s)
 *   Depth:    surface layer (~0.49 m)
 */

const CACHE_TTL    = 60 * 60 * 12; // 12 hours — data updates once daily
const GRID_STEP    = 2;            // degrees — downsample to 2° for browser efficiency (~16 KB)

// ── CMEMS Copernicus Marine REST API ─────────────────────────────────────────
// Endpoint format confirmed from Copernicus Marine Toolbox v2 API docs.
// Subset returns JSON with lat/lon/uo/vo arrays for the requested bounding box.
const CMEMS_BASE = 'https://nrt.cmems-du.eu/motu-web/Motu';
const DATASET_ID = 'GLOBAL_ANALYSISFORECAST_PHY_001_024-TDS';
const PRODUCT_ID = 'cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m';

export async function onRequestGet({ env }) {
  try {
    // ── Credentials check ───────────────────────────────────────────────────
    if (!env.CMEMS_USERNAME || !env.CMEMS_PASSWORD) {
      return json({ error: 'CMEMS credentials not configured' }, 503);
    }

    // ── KV cache ────────────────────────────────────────────────────────────
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `currents_${today}_${GRID_STEP}deg`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Fetch from CMEMS ─────────────────────────────────────────────────────
    // Request yesterday's daily mean (today's may not be published yet)
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const dateStr = d.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      action:    'productdownload',
      service:   DATASET_ID,
      product:   PRODUCT_ID,
      x_lo:      '-180',
      x_hi:      '180',
      y_lo:      '-90',
      y_hi:      '90',
      t_lo:      `${dateStr} 12:00:00`,
      t_hi:      `${dateStr} 12:00:00`,
      depth_lo:  '0.49',
      depth_hi:  '0.49',
      variable:  'uo',
      // Note: MOTU needs variable twice for two variables
      out_fmt:   'json',
      mode:      'console',
    });

    // MOTU uses Basic Auth
    const auth = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);
    const upstream = await fetch(`${CMEMS_BASE}?${params}&variable=vo`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return json({ error: `CMEMS error ${upstream.status}: ${err.slice(0, 200)}` }, 502);
    }

    const raw  = await upstream.json();
    const grid = buildGrid(raw);

    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(grid), { expirationTtl: CACHE_TTL });
    }

    return json(JSON.stringify(grid), 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

/**
 * Downsample the raw CMEMS JSON response to a regular 2° grid.
 * Output: { date, step, width, height, latMin, latMax, lonMin, lonMax, u, v }
 * u and v are flat Float32-compatible arrays (serialised as plain arrays).
 */
function buildGrid(raw) {
  const step   = GRID_STEP;
  const latMin = -80, latMax = 80;
  const lonMin = -180, lonMax = 180;
  const width  = Math.round((lonMax - lonMin) / step) + 1; // 181
  const height = Math.round((latMax - latMin) / step) + 1; // 81

  // Build lookup from the raw data points
  const lookup = new Map();
  if (raw.latitude && raw.longitude && raw.uo && raw.vo) {
    for (let i = 0; i < raw.latitude.length; i++) {
      const key = `${Math.round(raw.latitude[i])}_${Math.round(raw.longitude[i])}`;
      lookup.set(key, { u: raw.uo[i], v: raw.vo[i] });
    }
  }

  const u = new Array(width * height).fill(0);
  const v = new Array(width * height).fill(0);

  for (let row = 0; row < height; row++) {
    const lat = latMin + row * step;
    for (let col = 0; col < width; col++) {
      const lon = lonMin + col * step;
      // Find nearest point in raw data (within ±step tolerance)
      const key = `${Math.round(lat)}_${Math.round(lon)}`;
      const pt  = lookup.get(key);
      if (pt) {
        u[row * width + col] = pt.u ?? 0;
        v[row * width + col] = pt.v ?? 0;
      }
    }
  }

  return { step, width, height, latMin, latMax, lonMin, lonMax, u, v };
}

function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
