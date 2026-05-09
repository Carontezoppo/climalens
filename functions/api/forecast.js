/**
 * GET /api/forecast?lat=XX&lon=YY
 *
 * Proxies MET Norway locationforecast/2.0/compact (ECMWF-based, global, ~9 days).
 * Transforms the timeseries into daily + hourly arrays matching the shape the
 * frontend expects, with symbol_code (MET Norway string) instead of WMO integer codes.
 *
 * Wind speed: converted from m/s to km/h.
 * Daily symbol: entry closest to 12:00 UTC per day.
 * Hourly resolution: true hourly for first ~48 h, 6-hourly thereafter.
 *
 * KV binding: CLIMATE_CACHE · TTL: 1 hour
 */

const MET_URL  = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const CACHE_TTL = 60 * 60; // 1 hour

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) return json({ error: 'lat and lon query parameters are required' }, 400);

    const latN = parseFloat(lat).toFixed(4);
    const lonN = parseFloat(lon).toFixed(4);
    const cacheKey = `forecast_met_${latN}_${lonN}_${hourKey()}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const upstream = await fetch(`${MET_URL}?lat=${latN}&lon=${lonN}`, {
      headers: { 'User-Agent': 'ClimaLens/1.0 contact@climalens.org' },
    });
    if (!upstream.ok) return json({ error: `MET Norway returned HTTP ${upstream.status}` }, 503);

    const met = await upstream.json();
    const timeseries = met.properties?.timeseries;
    if (!Array.isArray(timeseries) || !timeseries.length) {
      return json({ error: 'Empty timeseries from MET Norway' }, 503);
    }

    // Parse each timeseries entry into a flat record
    const entries = [];
    for (const entry of timeseries) {
      const t    = entry.time;              // "2024-01-01T12:00:00Z"
      const date = t.slice(0, 10);          // "2024-01-01"
      const hour = parseInt(t.slice(11, 13), 10);
      const inst = entry.data.instant.details;
      const n1   = entry.data.next_1_hours;
      const n6   = entry.data.next_6_hours;

      const sym = n1?.summary?.symbol_code ?? n6?.summary?.symbol_code ?? null;
      if (!sym) continue; // last entry has no next-period data

      entries.push({
        date,
        timeStr: t.slice(0, 16),  // "2024-01-01T12:00"
        hour,
        temp:    inst.air_temperature,
        wind:    (inst.wind_speed ?? 0) * 3.6,
        humid:   inst.relative_humidity ?? 0,
        sym,
        // For 6-hourly entries the precip covers 6 h; for hourly it covers 1 h.
        // We sum raw period amounts for the daily total, which is correct in both cases.
        precip:  n1 ? (n1.details?.precipitation_amount ?? 0) : (n6?.details?.precipitation_amount ?? 0),
        tempMax: n6?.details?.air_temperature_max ?? null,
        tempMin: n6?.details?.air_temperature_min ?? null,
      });
    }

    if (!entries.length) return json({ error: 'No usable forecast data in MET Norway response' }, 503);

    // Group by date, take first 7 complete days
    const dayMap = {};
    for (const e of entries) {
      (dayMap[e.date] ??= []).push(e);
    }
    const days = Object.keys(dayMap).sort().slice(0, 9);

    const daily = {
      time:               days,
      symbol_code:        [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum:  [],
      wind_speed_10m_max: [],
    };

    for (const date of days) {
      const de = dayMap[date];

      // Symbol: entry closest to 12:00 UTC (= daytime representative)
      const noon = de.reduce((best, e) => Math.abs(e.hour - 12) < Math.abs(best.hour - 12) ? e : best);
      daily.symbol_code.push(noon.sym);

      // Temperature: combine instant readings with next_6h max/min for accuracy
      const temps = de.map(e => e.temp);
      const maxes = de.map(e => e.tempMax).filter(v => v !== null);
      const mins  = de.map(e => e.tempMin).filter(v => v !== null);
      daily.temperature_2m_max.push(+Math.max(...temps, ...maxes).toFixed(1));
      daily.temperature_2m_min.push(+Math.min(...temps, ...mins).toFixed(1));

      daily.precipitation_sum.push(+(de.reduce((s, e) => s + e.precip, 0)).toFixed(1));
      daily.wind_speed_10m_max.push(+Math.max(...de.map(e => e.wind)).toFixed(1));
    }

    // Hourly: all entries within the 9-day window
    const cutoff = days[days.length - 1];
    const hourlyEntries = entries.filter(e => e.date <= cutoff);

    const hourly = {
      time:                 hourlyEntries.map(e => e.timeStr),
      symbol_code:          hourlyEntries.map(e => e.sym),
      temperature_2m:       hourlyEntries.map(e => e.temp),
      precipitation:        hourlyEntries.map(e => +e.precip.toFixed(1)),
      wind_speed_10m:       hourlyEntries.map(e => +e.wind.toFixed(1)),
      relative_humidity_2m: hourlyEntries.map(e => e.humid),
    };

    const result = JSON.stringify({ daily, hourly });
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, result, { expirationTtl: CACHE_TTL });
    }
    return json(result, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

function hourKey() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}_${d.getUTCHours()}`;
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
