/**
 * GET /api/weather?lat=XX&lon=YY&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Fetches ERA5 daily+hourly data from Open-Meteo, aggregates it to monthly
 * stats server-side (mirrors js/weather-data.js aggregateToMonthly), and
 * caches the compact result in KV for 7 days.
 *
 * With the paid plan (30 s CPU / request) we can do the number-crunching
 * here instead of shipping ~150 KB of raw records to every browser.
 * The cached payload is ~2 KB — a 75× reduction.
 *
 * Response shape (version 3, pre-aggregated):
 *   { _v:3,
 *     avgHigh[], avgLow[], rain[], sunHours[], windAvg[], windGust[],
 *     snow[], pressure[], humidity[], rainDays[], frostDays[], uvIndex[] }
 * Each array has one entry per month in the requested range.
 *
 * KV binding: CLIMATE_CACHE (reused for all weather/climate caches)
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

    const latN = parseFloat(lat).toFixed(4);
    const lonN = parseFloat(lon).toFixed(4);

    // Versioned cache key (v3 = pre-aggregated monthly stats)
    const cacheKey = `weather3_${latN}_${lonN}_${start}_${end}`;

    // ── KV cache read ─────────────────────────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Fetch raw ERA5 data from Open-Meteo ───────────────────────────────────
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

    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).reason || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, upstream.status, { 'X-Cache': 'MISS' });
    }

    // ── Aggregate: 150 KB raw → ~2 KB monthly stats ───────────────────────────
    const raw        = JSON.parse(body);
    const monthDefs  = buildMonthDefs(start, end);
    const aggregated = aggregateToMonthly(raw, monthDefs);

    // ── KV cache write (fire-and-forget) ──────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(aggregated), { expirationTtl: CACHE_TTL });
    }

    return json(aggregated, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

/* ── Month list builder ──────────────────────────────────────────────────────
 * Returns [[year, month], ...] for every calendar month between start and end.
 * start / end are ISO date strings: "YYYY-MM-DD".
 */
function buildMonthDefs(start, end) {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const defs = [];
  let yr = sy, mo = sm;
  while (yr < ey || (yr === ey && mo <= em)) {
    defs.push([yr, mo]);
    mo++; if (mo > 12) { mo = 1; yr++; }
  }
  return defs;
}

/* ── Monthly aggregation (mirrors js/weather-data.js aggregateToMonthly) ────
 * Input:  raw Open-Meteo JSON  { daily: {...}, hourly: {...} }
 * Output: { _v:3, avgHigh[], avgLow[], rain[], sunHours[], windAvg[],
 *           windGust[], snow[], pressure[], humidity[], rainDays[],
 *           frostDays[], uvIndex[] }
 */
function aggregateToMonthly(raw, monthDefs) {
  const { daily, hourly } = raw;

  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const sum = a => a.reduce((s, v) => s + v, 0);
  const ymFromStr = t => {
    const p = t.split('T')[0].split('-');
    return [+p[0], +p[1]];
  };

  const out = {
    _v: 3,
    avgHigh: [], avgLow: [], rain: [], sunHours: [], windAvg: [],
    windGust: [], snow: [], pressure: [], humidity: [],
    rainDays: [], frostDays: [], uvIndex: [],
  };

  for (const [yr, mo] of monthDefs) {
    const dIdx = daily.time.reduce((acc, t, i) => {
      const [y, m] = ymFromStr(t);
      if (y === yr && m === mo) acc.push(i);
      return acc;
    }, []);

    const hIdx = hourly.time.reduce((acc, t, i) => {
      const [y, m] = ymFromStr(t);
      if (y === yr && m === mo) acc.push(i);
      return acc;
    }, []);

    const dv = k => dIdx.map(i => daily[k]?.[i]).filter(v => v != null && !isNaN(v));
    const hv = k => hIdx.map(i => hourly[k]?.[i]).filter(v => v != null && !isNaN(v));

    const gustVals = dv('wind_gusts_10m_max');

    out.avgHigh.push(+avg(dv('temperature_2m_max')).toFixed(1));
    out.avgLow.push(+avg(dv('temperature_2m_min')).toFixed(1));
    out.rain.push(+sum(dv('precipitation_sum')).toFixed(0));
    out.sunHours.push(Math.round(sum(dv('sunshine_duration')) / 3600));
    out.windAvg.push(Math.round(avg(dv('wind_speed_10m_max'))));
    out.windGust.push(gustVals.length ? Math.round(Math.max(...gustVals)) : 0);
    out.snow.push(+sum(dv('snowfall_sum')).toFixed(1));
    out.pressure.push(Math.round(avg(hv('pressure_msl'))));
    out.humidity.push(Math.round(avg(hv('relative_humidity_2m'))));
    out.rainDays.push(dv('precipitation_sum').filter(v => v >= 1).length);
    out.frostDays.push(dv('temperature_2m_min').filter(v => v < 0).length);
    out.uvIndex.push(Math.max(1, Math.round([1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1][mo - 1] * 0.6)));
  }

  return out;
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
