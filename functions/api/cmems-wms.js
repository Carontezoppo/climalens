/**
 * GET /api/cmems-wms
 *
 * Proxies Copernicus Marine teroWmts WMS tile requests, injecting Basic-auth
 * credentials from env secrets. Tile responses are cached in KV.
 *
 * Custom param (stripped before forwarding):
 *   pole=arctic     →  AMSR2 North NRT sea ice concentration
 *   pole=antarctic  →  AMSR2 South NRT sea ice concentration
 *
 * All other WMS params (SERVICE, REQUEST, LAYERS, BBOX, WIDTH, HEIGHT,
 * FORMAT, CRS, TIME, STYLES …) are forwarded verbatim.
 *
 * Env:  CMEMS_USERNAME, CMEMS_PASSWORD
 * KV:   CLIMATE_CACHE  (6-hour tile cache)
 */

const TERO_BASE = 'https://wmts.marine.copernicus.eu/teroWmts';
const PRODUCT   = 'SEAICE_GLO_SEAICE_L4_NRT_OBSERVATIONS_011_001';
const VER       = '202304';
const CACHE_TTL = 60 * 60 * 6; // 6 h

const DATASETS = {
  arctic:    `osisaf_obs-si_glo_phy-sic-north_nrt_amsr2_l4_P1D-m_${VER}`,
  antarctic: `osisaf_obs-si_glo_phy-sic-south_nrt_amsr2_l4_P1D-m_${VER}`,
};

export async function onRequestGet({ request, env }) {
  if (!env.CMEMS_USERNAME || !env.CMEMS_PASSWORD) {
    return err('CMEMS credentials not configured', 503);
  }

  const url    = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);

  const pole = params.get('pole') || 'arctic';
  params.delete('pole');

  const dataset = DATASETS[pole];
  if (!dataset) return err(`Unknown pole: ${pole}`, 400);

  const auth        = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);
  const upstreamUrl = `${TERO_BASE}/${PRODUCT}/${dataset}?${params.toString()}`;

  const cacheKey = `cmems_wms_${pole}_${simpleHash(upstreamUrl)}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) return tile(cached, { 'X-Cache': 'HIT' });
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
    });
  } catch (e) {
    return err(`Fetch failed: ${e.message}`, 503);
  }

  if (!upstream.ok) {
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

function err(msg, status = 503) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function simpleHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}
