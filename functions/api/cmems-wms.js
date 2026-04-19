/**
 * GET /api/cmems-wms
 *
 * Proxies Copernicus Marine (CMEMS) Thredds WMS tile requests, injecting
 * Basic-auth credentials from env secrets. Tile responses are cached in KV.
 *
 * All standard WMS query params (SERVICE, REQUEST, LAYERS, BBOX, WIDTH,
 * HEIGHT, FORMAT, CRS, TIME, STYLES …) are forwarded verbatim to the
 * upstream Thredds endpoint. One custom param is stripped before forwarding:
 *
 *   product=seaice   →  OSI-SAF NRT sea ice concentration (default)
 *   product=sst_med  →  Mediterranean SST NRT L4
 *
 * Env:     CMEMS_USERNAME, CMEMS_PASSWORD
 * KV:      CLIMATE_CACHE  (6-hour tile cache)
 */

const THREDDS_WMS = 'https://nrt.cmems-du.eu/thredds/wms';
const CACHE_TTL   = 60 * 60 * 6; // 6 h

// Dataset IDs on CMEMS Thredds (NRT)
const DATASETS = {
  seaice:  'cmems_obs-si_glo_phy-sie_nrt_L4-auto_P1D-m',
  sst_med: 'dataset-sst-med-sst-l4-nrt-observations-010-004-a',
};

export async function onRequestGet({ request, env }) {
  if (!env.CMEMS_USERNAME || !env.CMEMS_PASSWORD) {
    return err('CMEMS credentials not configured (set CMEMS_USERNAME and CMEMS_PASSWORD secrets)', 503);
  }

  const url    = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);

  const product = params.get('product') || 'seaice';
  params.delete('product'); // strip before forwarding

  const dataset = DATASETS[product];
  if (!dataset) return err(`Unknown product: ${product}`, 400);

  const auth        = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);
  const upstreamUrl = `${THREDDS_WMS}/${dataset}?${params.toString()}`;

  // Cache key: hash of the full upstream URL (tiles are fully addressed by params)
  const cacheKey = `cmems_wms_${product}_${simpleHash(upstreamUrl)}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) {
      return tile(cached, { 'X-Cache': 'HIT' });
    }
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
    });
  } catch (e) {
    return err(`Upstream fetch failed: ${e.message}`, 502);
  }

  if (!upstream.ok) {
    // Forward WMS ServiceException XML so we can debug CRS / layer issues
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/xml',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const contentType = upstream.headers.get('Content-Type') || 'image/png';
  const buf = await upstream.arrayBuffer();

  // Only cache actual image responses (not error XML)
  if (env.CLIMATE_CACHE && contentType.startsWith('image/')) {
    await env.CLIMATE_CACHE.put(cacheKey, buf, { expirationTtl: CACHE_TTL });
  }

  return tile(buf, {}, contentType);
}

function tile(body, extraHeaders = {}, contentType = 'image/png') {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

function err(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// Cheap non-cryptographic hash for cache keys (no SubtleCrypto needed)
function simpleHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}
