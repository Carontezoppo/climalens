/**
 * GET /api/sea-ice-live?pole=arctic|antarctic
 *
 * Fetches the latest OSI-SAF AMSR2 sea ice concentration from Copernicus
 * Marine teroWmts as a plain EPSG:4326 PNG image. The client canvas layer
 * reprojects this to the polar stereographic CRS for display on the map.
 *
 * Returns: PNG image
 * Response headers:
 *   X-LatMin / X-LatMax  — lat bounds of the image (for client reprojection)
 *
 * Env: CMEMS_USERNAME, CMEMS_PASSWORD
 * KV:  CLIMATE_CACHE (6-hour tile cache)
 */

const TERO_WMS = 'https://wmts.marine.copernicus.eu/teroWmts';
const PRODUCT  = 'SEAICE_GLO_SEAICE_L4_NRT_OBSERVATIONS_011_001';
const VER      = '202304';
const CACHE_TTL = 60 * 60 * 6; // 6 h

// Request at 0.25°/pixel — sufficient for polar reprojection at typical zoom levels
// WMS 1.3.0 with EPSG:4326: axis order is latMin,lonMin,latMax,lonMax
const CONFIGS = {
  arctic: {
    dataset: `osisaf_obs-si_glo_phy-sic-north_nrt_amsr2_l4_P1D-m_${VER}`,
    bbox:    '55,-180,90,180',
    latMin: 55, latMax: 90,
    width: 1440, height: 140,
  },
  antarctic: {
    dataset: `osisaf_obs-si_glo_phy-sic-south_nrt_amsr2_l4_P1D-m_${VER}`,
    bbox:    '-90,-180,-55,180',
    latMin: -90, latMax: -55,
    width: 1440, height: 140,
  },
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
  const cfg  = CONFIGS[pole];
  if (!cfg) return err(`Unknown pole: ${pole}`, 400);

  const date     = yesterday();
  const cacheKey = `sea_ice_live_${pole}_${date}`;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
    if (cached) return imgResponse(cached, cfg, { 'X-Cache': 'HIT' });
  }

  const auth = btoa(`${env.CMEMS_USERNAME}:${env.CMEMS_PASSWORD}`);

  const params = new URLSearchParams({
    SERVICE:     'WMS',
    REQUEST:     'GetMap',
    VERSION:     '1.3.0',
    LAYERS:      'ice_conc',
    CRS:         'EPSG:4326',
    BBOX:        cfg.bbox,
    WIDTH:       String(cfg.width),
    HEIGHT:      String(cfg.height),
    FORMAT:      'image/png',
    TRANSPARENT: 'TRUE',
    TIME:        date,
  });

  const fetchUrl = `${TERO_WMS}/${PRODUCT}/${cfg.dataset}?${params}`;

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
  return imgResponse(buf, cfg);
}

function imgResponse(buf, cfg, extra = {}) {
  return new Response(buf, {
    headers: {
      'Content-Type':                'image/png',
      'Cache-Control':               `public, max-age=${CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
      'X-LatMin':                    String(cfg.latMin),
      'X-LatMax':                    String(cfg.latMax),
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
