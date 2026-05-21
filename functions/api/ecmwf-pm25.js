/**
 * GET /api/ecmwf-pm25
 *
 * Proxies ECMWF ecCharts WMS tile requests for CAMS NRT atmospheric
 * composition data (PM2.5), injecting the API token from env.
 *
 * All WMS params (SERVICE, REQUEST, LAYERS, STYLES, BBOX, WIDTH, HEIGHT,
 * CRS, FORMAT …) are forwarded verbatim. If no TIME param is present the
 * function inserts the latest available CAMS analysis run (00:00 or 12:00 UTC,
 * with a 4-hour safety margin for processing delay).
 *
 * To get your ECMWF token:
 *   1. Register at https://api.ecmwf.int
 *   2. Log in → your profile → API key
 *   3. Add ECMWF_TOKEN to .dev.vars and Cloudflare Pages env secrets
 *
 * Layer: composition_pm2p5_surface  (CAMS NRT surface PM2.5, µg m⁻³)
 * Env:   ECMWF_TOKEN — API key from api.ecmwf.int
 * KV:    CLIMATE_CACHE (1-hour tile cache)
 */

const ECCHARTS_WMS = 'https://eccharts.ecmwf.int/wms/';
const CACHE_TTL    = 60 * 60; // 1 hour — CAMS NRT updates twice daily

export async function onRequestGet({ request, env }) {
  if (!env.ECMWF_TOKEN) {
    return err('ECMWF_TOKEN not configured', 503);
  }

  const url    = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);

  params.set('token', env.ECMWF_TOKEN);

  // Do not inject TIME — ECMWF uses its own default (most recent available step).
  // The composition layers run on 3-hourly steps; injecting 00:00/12:00 UTC causes
  // a ServiceException for invalid time values.

  const upstreamUrl = `${ECCHARTS_WMS}?${params.toString()}`;
  const cacheKey    = `ecmwf_pm25_${simpleHash(upstreamUrl)}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) return tile(cached, { 'X-Cache': 'HIT' }, 'image/png');
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
      status: upstream.status === 502 ? 503 : upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/xml',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const contentType = upstream.headers.get('Content-Type') || 'image/png';
  const buf         = await upstream.arrayBuffer();

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
    h  = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}
