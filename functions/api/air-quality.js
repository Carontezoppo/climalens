/**
 * GET /api/air-quality?lat=XX&lon=YY
 *
 * Proxies the Open-Meteo air quality API (CAMS) with a 30-minute cache.
 * AQ data updates a few times per day so 30 min is a sensible TTL.
 */

const UPSTREAM  = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const CACHE_TTL = 60 * 30; // 30 minutes in seconds

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
      return json({ error: 'lat and lon query parameters are required' }, 400);
    }

    const latN = parseFloat(lat).toFixed(4);
    const lonN = parseFloat(lon).toFixed(4);

    const cacheKey = `aq_${latN}_${lonN}_${halfHourKey()}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const params = new URLSearchParams({
      latitude:      latN,
      longitude:     lonN,
      hourly:        'pm10,pm2_5,nitrogen_dioxide,ozone,uv_index,european_aqi,alder_pollen,birch_pollen,grass_pollen',
      forecast_days: '2',
      timezone:      'auto',
    });

    const upstream = await fetch(`${UPSTREAM}?${params}`);
    const body     = await upstream.text();

    if (!upstream.ok) return json(body, upstream.status, { 'X-Cache': 'MISS' });

    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL });
    }

    return json(body, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function halfHourKey() {
  const d = new Date();
  const half = Math.floor(d.getUTCMinutes() / 30);
  return `${d.toISOString().slice(0, 10)}_${d.getUTCHours()}_${half}`;
}

function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
