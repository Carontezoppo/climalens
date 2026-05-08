/**
 * GET /api/normals?lat=XX&lon=YY
 *
 * Fetches ERA5 daily weather for 2000–2024, averages by calendar month, and
 * returns { high, low, rain, sun, wind, windGust, snow } — 12 values each.
 * Temperature/wind are averaged per day then per month; precipitation, sunshine,
 * and snow are summed per calendar month then averaged across years, so the
 * values represent typical monthly totals rather than daily averages.
 *
 * Cached in KV for 30 days. Cache key bumped to v2 to invalidate old temp-only
 * entries from the previous version of this endpoint.
 */

const UPSTREAM  = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 60 * 60 * 24 * 90; // 90 days — ERA5 normals are static
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
    const cacheKey = `normals_v2_${latN}_${lonN}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const params = new URLSearchParams({
      latitude:   latN,
      longitude:  lonN,
      start_date: START,
      end_date:   END,
      daily:      'temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,wind_speed_10m_max,wind_gusts_10m_max,snowfall_sum',
      timezone:   'UTC',
    });

    let upstream = await fetch(`${UPSTREAM}?${params}`);
    // Single retry on rate-limit — wall-clock sleep, no CPU cost
    if (upstream.status === 429) {
      await new Promise(r => setTimeout(r, 1500));
      upstream = await fetch(`${UPSTREAM}?${params}`);
    }
    const body = await upstream.text();
    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).reason || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, 503);
    }

    const raw    = JSON.parse(body);
    const time   = raw.daily.time;
    const tmax   = raw.daily.temperature_2m_max;
    const tmin   = raw.daily.temperature_2m_min;
    const precip = raw.daily.precipitation_sum;
    const sun    = raw.daily.sunshine_duration;
    const wind   = raw.daily.wind_speed_10m_max;
    const gust   = raw.daily.wind_gusts_10m_max;
    const snow   = raw.daily.snowfall_sum;

    // Daily-averaged-per-month accumulators (temperature, wind)
    const sumHigh = Array(12).fill(0), sumLow  = Array(12).fill(0);
    const sumWind = Array(12).fill(0), sumGust = Array(12).fill(0);
    const count   = Array(12).fill(0);

    // Per year-month total accumulators (precipitation, sunshine, snowfall)
    const ymRain = {}, ymSun = {}, ymSnow = {};

    time.forEach((t, i) => {
      const d  = new Date(t + 'T00:00:00Z');
      const yr = d.getUTCFullYear();
      const m  = d.getUTCMonth(); // 0–11
      const ym = yr * 12 + m;    // unique key per year-month

      if (tmax[i] != null && !isNaN(tmax[i])) { sumHigh[m] += tmax[i]; count[m]++; }
      if (tmin[i] != null && !isNaN(tmin[i])) sumLow[m] += tmin[i];
      if (wind[i] != null && !isNaN(wind[i])) sumWind[m] += wind[i];
      if (gust[i] != null && !isNaN(gust[i])) sumGust[m] += gust[i];

      ymRain[ym]  = (ymRain[ym]  || 0) + (precip[i] || 0);
      ymSun[ym]   = (ymSun[ym]   || 0) + (sun[i]    || 0);
      ymSnow[ym]  = (ymSnow[ym]  || 0) + (snow[i]   || 0);
    });

    // Average monthly totals from year-month buckets
    const rainTot = Array(12).fill(0), sunTot  = Array(12).fill(0), snowTot = Array(12).fill(0);
    const ymCount = Array(12).fill(0);
    for (const ym in ymRain) {
      const m = ym % 12; // ym = yr*12+m, so ym%12 === m
      rainTot[m] += ymRain[ym];
      sunTot[m]  += ymSun[ym];
      snowTot[m] += ymSnow[ym];
      ymCount[m]++;
    }

    const result = {
      high:    sumHigh.map((v, m) => count[m]   > 0 ? Math.round(v / count[m])          : null),
      low:     sumLow.map((v, m)  => count[m]   > 0 ? Math.round(v / count[m])          : null),
      rain:    rainTot.map((v, m) => ymCount[m] > 0 ? Math.round(v / ymCount[m])        : null),
      sun:     sunTot.map((v, m)  => ymCount[m] > 0 ? Math.round(v / ymCount[m] / 3600) : null),
      wind:    sumWind.map((v, m) => count[m]   > 0 ? Math.round(v / count[m])          : null),
      windGust: sumGust.map((v, m) => count[m]  > 0 ? Math.round(v / count[m])          : null),
      snow:    snowTot.map((v, m) => ymCount[m] > 0 ? +(v / ymCount[m]).toFixed(1)      : null),
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
