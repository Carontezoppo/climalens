/**
 * GET /api/sst-climatology?lat=X&lon=Y&month=M
 *
 * Returns the 1981-2010 climatological mean SST for a given location and month,
 * sourced from NOAA ERSSTv5 via the CoastWatch ERDDAP server.
 *
 * ERSSTv5 is 2° resolution; lat/lon are snapped to the nearest grid point.
 * The mean is computed from 30 values (one per year, 1981-2010) for the
 * requested calendar month, averaging out noise and giving a true climatology.
 *
 * KV cache TTL: 30 days — ERSSTv5 climatology never changes.
 */

const ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiErsstv5_LonPM180.json';
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

function snapLat(lat) {
  // ERSSTv5 lat grid: -88 to 88 at 2° spacing
  return Math.min(88, Math.max(-88, Math.round(lat / 2) * 2));
}

function snapLon(lon) {
  // ERSSTv5 lon grid: -180 to 178 at 2° spacing
  // Normalise to [-180, 180) first to handle antimeridian crossing
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  let s = Math.round(lon / 2) * 2;
  if (s >= 180) s -= 360;
  return Math.min(178, Math.max(-180, s));
}

export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const lat   = parseFloat(url.searchParams.get('lat'));
  const lon   = parseFloat(url.searchParams.get('lon'));
  const month = parseInt(url.searchParams.get('month'), 10);

  if (isNaN(lat) || isNaN(lon) || isNaN(month) || month < 1 || month > 12) {
    return err('lat, lon, and month (1-12) are required', 400);
  }

  const sLat = snapLat(lat);
  const sLon = snapLon(lon);
  const mm   = String(month).padStart(2, '0');
  const cacheKey = `sst_clim_v1_${sLat}_${sLon}_${mm}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey);
    if (cached) return json(cached, { 'X-Cache': 'HIT' });
  }

  // Stride-12 query: returns one May (or whichever month) value per year, 1981-2010
  const q = `sst[(1981-${mm}-15T00:00:00Z):12:(2010-${mm}-15T00:00:00Z)]` +
            `[(0.0):1:(0.0)][(${sLat}):1:(${sLat})][(${sLon}):1:(${sLon})]`;

  let upstream;
  try {
    upstream = await fetch(`${ERDDAP}?${q}`);
  } catch (e) {
    return err(`ERDDAP fetch failed: ${e.message}`, 503);
  }

  if (!upstream.ok) {
    return err(`ERDDAP returned ${upstream.status}`, 503);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return err('ERDDAP response parse error', 503);
  }

  // ERDDAP table rows: [time, depth, latitude, longitude, sst]
  const rows = data?.table?.rows;
  if (!rows?.length) return json(JSON.stringify({ mean: null }));

  const vals = rows.map(r => r[4]).filter(v => v != null && isFinite(v));
  if (!vals.length) return json(JSON.stringify({ mean: null }));

  const mean = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  const body = JSON.stringify({ mean, n: vals.length });

  if (env.CLIMATE_CACHE) {
    await env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL });
  }

  return json(body);
}

function json(body, extraHeaders = {}) {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

function err(msg, status = 503) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
