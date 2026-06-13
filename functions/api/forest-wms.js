/**
 * GET /api/forest-wms
 *
 * Proxies NASA GIBS WMS tiles for MODIS IGBP land cover, adding CORS
 * headers and caching responses in KV. No auth required.
 *
 * All WMS params (SERVICE, REQUEST, LAYERS, BBOX, WIDTH, HEIGHT,
 * FORMAT, CRS, TIME, STYLES …) are forwarded verbatim to upstream.
 * The upstream endpoint is picked from CRS: EPSG:4326 (equirectangular,
 * used for the land cover globe) vs EPSG:3857 (the 2001–2024 animation).
 *
 * KV: CLIMATE_CACHE (24-hour tile cache — annual data never changes)
 */

const GIBS_WMS = {
  'EPSG:3857': 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
  'EPSG:4326': 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
};
const CACHE_TTL = 60 * 60 * 24; // 24 h — annual data never changes

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);

  const crs  = (params.get('CRS') || params.get('SRS') || 'EPSG:3857').toUpperCase();
  const base = GIBS_WMS[crs] || GIBS_WMS['EPSG:3857'];

  const upstreamUrl = `${base}?${params.toString()}`;
  const cacheKey    = `forest_wms_${simpleHash(upstreamUrl)}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) return tile(cached, { 'X-Cache': 'HIT' });
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl);
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
