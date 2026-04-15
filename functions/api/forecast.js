/**
 * GET /api/forecast?lat=XX&lon=YY
 *
 * Proxies the Open-Meteo forecast API with a 1-hour cache.
 * Forecast data updates hourly so there's no benefit fetching it
 * more often — and caching at the edge means the first visitor
 * per hour pays the cost, everyone else gets an instant response.
 */

const UPSTREAM  = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL = 60 * 60; // 1 hour in seconds

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

    const cacheKey = `forecast_${latN}_${lonN}_${hourKey()}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const params = new URLSearchParams({
      latitude:      latN,
      longitude:     lonN,
      daily:         'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
      hourly:        'temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code',
      forecast_days: '7',
      timezone:      'Europe/London',
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

function hourKey() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}_${d.getUTCHours()}`;
}

function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
