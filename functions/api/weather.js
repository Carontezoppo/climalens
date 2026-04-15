/**
 * GET /api/weather?lat=XX&lon=YY&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Proxies the Open-Meteo archive API for the historical range section.
 * Cached in KV keyed on location + date range — historical data never
 * changes so a 7-day TTL is safe and keeps the cache from growing large.
 */

const UPSTREAM  = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

export async function onRequestGet({ request, env }) {
  try {
    const url   = new URL(request.url);
    const lat   = url.searchParams.get('lat');
    const lon   = url.searchParams.get('lon');
    const start = url.searchParams.get('start');
    const end   = url.searchParams.get('end');

    if (!lat || !lon || !start || !end) {
      return json({ error: 'lat, lon, start and end are required' }, 400);
    }

    const latN     = parseFloat(lat).toFixed(4);
    const lonN     = parseFloat(lon).toFixed(4);
    const cacheKey = `weather_${latN}_${lonN}_${start}_${end}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const params = new URLSearchParams({
      latitude:   latN,
      longitude:  lonN,
      start_date: start,
      end_date:   end,
      daily:      'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunshine_duration,wind_speed_10m_max,wind_gusts_10m_max,precipitation_hours',
      hourly:     'pressure_msl,relative_humidity_2m',
      timezone:   'Europe/London',
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

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
