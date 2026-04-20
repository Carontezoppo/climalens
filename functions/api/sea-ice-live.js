/**
 * GET /api/sea-ice-live?pole=arctic|antarctic&z=1&row=0&col=0
 *
 * WMTS GetTile proxy for Copernicus Marine OSI-SAF AMSR2 sea ice concentration.
 * Injects Basic-auth credentials and caches tiles in KV.
 *
 * WMTS: WorldCRS84Quad, zoom 1 → 4 cols × 2 rows, each tile 90°×90° at 256×256px
 *   Arctic row 0 (90°N → 0°), Antarctic row 1 (0° → 90°S)
 *
 * Returns: PNG tile (256×256)
 * Env: CMEMS_USERNAME, CMEMS_PASSWORD
 * KV:  CLIMATE_CACHE (6-hour tile cache)
 */

const TERO_WMTS = 'https://wmts.marine.copernicus.eu/teroWmts/';
const PRODUCT   = 'SEAICE_GLO_SEAICE_L4_NRT_OBSERVATIONS_011_001';
const VER       = '202304';
const CACHE_TTL = 60 * 60 * 6; // 6 h

const DATASETS = {
  arctic:    `osisaf_obs-si_glo_phy-sic-north_nrt_amsr2_l4_P1D-m_${VER}`,
  antarctic: `osisaf_obs-si_glo_phy-sic-south_nrt_amsr2_l4_P1D-m_${VER}`,
};

function yesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  if (!env.CMEMS_USERNAME || !env.CMEMS_PASSWORD) {
    return err('CMEMS credentials not configured', 503);
  }

  const { searchParams } = new URL(request.url);
  const pole = searchParams.get('pole') || 'arctic';
  const z    = searchParams.get('z')    || '1';
  const row  = searchParams.get('row')  || '0';
  const col  = searchParams.get('col')  || '0';

  const dataset = DATASETS[pole];
  if (!dataset) return err(`Unknown pole: ${pole}`, 400);

  const date     = yesterday();
  const cacheKey = `sea_ice_wmts_${pole}_${date}_z${z}_r${row}_c${col}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) return tileResponse(cached, { 'X-Cache': 'HIT' });
  }

  const auth  = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);
  const layer = `${PRODUCT}/${dataset}/ice_conc`;

  const params = new URLSearchParams({
    SERVICE:       'WMTS',
    REQUEST:       'GetTile',
    VERSION:       '1.0.0',
    LAYER:         layer,
    STYLE:         '',
    FORMAT:        'image/png',
    TILEMATRIXSET: 'EPSG:4326',
    TILEMATRIX:    z,
    TILEROW:       row,
    TILECOL:       col,
    TIME:          date,
  });

  const fetchUrl = `${TERO_WMTS}?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let upstream;
  try {
    upstream = await fetch(fetchUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return err(`Fetch failed: ${e.name === 'AbortError' ? 'timed out' : e.message}`, 503);
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    const body = await upstream.text();
    return err(`Upstream ${upstream.status}: ${body.slice(0, 400)}`, 503);
  }

  const ct = upstream.headers.get('Content-Type') || '';
  if (!ct.startsWith('image/')) {
    const body = await upstream.text();
    return err(`Unexpected content-type "${ct}": ${body.slice(0, 400)}`, 503);
  }

  const buf = await upstream.arrayBuffer();
  if (env.CLIMATE_CACHE) {
    await env.CLIMATE_CACHE.put(cacheKey, buf, { expirationTtl: CACHE_TTL });
  }
  return tileResponse(buf);
}

function tileResponse(buf, extra = {}) {
  return new Response(buf, {
    headers: {
      'Content-Type':                'image/png',
      'Cache-Control':               `public, max-age=${CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  });
}

function err(msg, status = 503) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
