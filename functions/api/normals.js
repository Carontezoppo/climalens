/**
 * GET /api/normals?lat=XX&lon=YY
 *
 * Fetches ERA5 daily high/low temperatures for 2000–2024, averages by calendar
 * month, and returns { high: [Jan..Dec], low: [Jan..Dec] } — 24 rounded °C values.
 *
 * Cached in KV for 30 days; only daily temp variables are fetched so the upstream
 * payload is ~15 KB gzipped rather than the full weather archive request.
 */

const UPSTREAM  = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days
const START     = '2000-01-01';
const END       = '2024-12-31';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (!lat || !lon) return json({ error: 'lat and lon required' }, 400);

    const latN = parseFloat(lat).toFixed(4);
    const lonN = parseFloat(lon).toFixed(4);
    const cacheKey = `normals_${latN}_${lonN}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const params = new URLSearchParams({
      latitude:   latN,
      longitude:  lonN,
      start_date: START,
      end_date:   END,
      daily:      'temperature_2m_max,temperature_2m_min',
      timezone:   'UTC',
    });

    const upstream = await fetch(`${UPSTREAM}?${params}`);
    const body = await upstream.text();
    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).reason || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, upstream.status);
    }

    const raw  = JSON.parse(body);
    const time = raw.daily.time;
    const tmax = raw.daily.temperature_2m_max;
    const tmin = raw.daily.temperature_2m_min;

    const sumHigh  = Array(12).fill(0);
    const sumLow   = Array(12).fill(0);
    const count    = Array(12).fill(0);

    time.forEach((t, i) => {
      const m = new Date(t + 'T00:00:00Z').getUTCMonth();
      if (tmax[i] != null && !isNaN(tmax[i])) { sumHigh[m] += tmax[i]; count[m]++; }
      if (tmin[i] != null && !isNaN(tmin[i])) sumLow[m] += tmin[i];
    });

    const result = {
      high: sumHigh.map((v, m) => count[m] > 0 ? Math.round(v / count[m]) : null),
      low:  sumLow.map((v, m)  => count[m] > 0 ? Math.round(v / count[m]) : null),
    };

    const out = JSON.stringify(result);
    if (env.CLIMATE_CACHE) env.CLIMATE_CACHE.put(cacheKey, out, { expirationTtl: CACHE_TTL });

    return json(out, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
