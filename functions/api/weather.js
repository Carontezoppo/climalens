/**
 * GET /api/weather?lat=XX&lon=YY&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Fetches daily data from NASA POWER (MERRA-2, AG community), aggregates
 * it to monthly stats server-side, and caches the compact result in KV
 * for 7 days.
 *
 * Response shape (version 3, pre-aggregated — same as before):
 *   { _v:3,
 *     avgHigh[], avgLow[], rain[], sunHours[], windAvg[], windGust[],
 *     snow[], pressure[], humidity[], rainDays[], frostDays[], uvIndex[] }
 * Each array has one entry per month in the requested range.
 *
 * Notes:
 * - sunHours is approximated from ALLSKY_SFC_SW_DWN (radiation MJ/m²/day) ÷ 2.5
 * - windGust is not available in NASA POWER, always returns 0
 * - pressure is PS (surface, kPa) × 10 → hPa (close to MSL for low-elevation sites)
 *
 * KV binding: CLIMATE_CACHE
 */

const UPSTREAM  = 'https://power.larc.nasa.gov/api/temporal/daily/point';
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

    const cacheKey = `weather5_${latN}_${lonN}_${start}_${end}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // NASA POWER expects YYYYMMDD; incoming dates are YYYY-MM-DD
    const startNASA = start.replace(/-/g, '');
    const endNASA   = end.replace(/-/g, '');
    const query = `parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M_MAX,PRECSNO,RH2M,PS,ALLSKY_SFC_UV_INDEX&community=AG&longitude=${lonN}&latitude=${latN}&start=${startNASA}&end=${endNASA}&format=JSON`;

    const upstream = await fetch(`${UPSTREAM}?${query}`, {
      headers: { 'User-Agent': 'ClimaLens/1.0' },
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).errors?.[0] || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, 503, { 'X-Cache': 'MISS' });
    }

    const raw = JSON.parse(body);
    if (raw.errors && raw.errors.length > 0) {
      return json({ error: raw.errors[0] }, 503, { 'X-Cache': 'MISS' });
    }

    const monthDefs  = buildMonthDefs(start, end);
    const aggregated = aggregateToMonthly(raw.properties.parameter, monthDefs);

    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(aggregated), { expirationTtl: CACHE_TTL });
    }

    return json(aggregated, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

// Returns [[year, month], ...] for every calendar month between start and end.
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

function aggregateToMonthly(p, monthDefs) {
  // Bucket daily NASA POWER values by "YYYYMM"
  const buckets = {};
  for (const dateKey of Object.keys(p.T2M_MAX)) {
    const ym = dateKey.slice(0, 6);
    if (!buckets[ym]) buckets[ym] = {
      highs: [], lows: [], wind: [], rh: [], pressure: [], uv: [],
      rain: 0, rad: 0, snow: 0, rainDays: 0, frostDays: 0,
    };
    const b  = buckets[ym];
    const mx = p.T2M_MAX[dateKey],  mn = p.T2M_MIN[dateKey];
    const pr = p.PRECTOTCORR[dateKey], rd = p.ALLSKY_SFC_SW_DWN[dateKey];
    const ws = p.WS10M_MAX[dateKey],  sn = p.PRECSNO[dateKey];
    const rh  = p.RH2M[dateKey],              ps  = p.PS[dateKey];
    const uvi = p.ALLSKY_SFC_UV_INDEX[dateKey];

    if (mx  > -998) b.highs.push(mx);
    if (mn  > -998) { b.lows.push(mn); if (mn < 0) b.frostDays++; }
    if (ws  > -998) b.wind.push(ws);
    if (rh  > -998) b.rh.push(rh);
    if (ps  > -998) b.pressure.push(ps);
    if (uvi > -998) b.uv.push(uvi);
    if (pr  > -998) { b.rain += pr; if (pr >= 1) b.rainDays++; }
    if (rd  > -998) b.rad += rd;
    if (sn  > -998) b.snow += sn;
  }

  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

  const out = {
    _v: 3,
    avgHigh: [], avgLow: [], rain: [], sunHours: [], windAvg: [],
    windGust: [], snow: [], pressure: [], humidity: [],
    rainDays: [], frostDays: [], uvIndex: [],
  };

  for (const [yr, mo] of monthDefs) {
    const ym = `${yr}${String(mo).padStart(2, '0')}`;
    const b  = buckets[ym] || {};

    out.avgHigh.push(  +(avg(b.highs    || [])).toFixed(1));
    out.avgLow.push(   +(avg(b.lows     || [])).toFixed(1));
    out.rain.push(     +(b.rain         || 0).toFixed(0));
    out.sunHours.push( Math.round((b.rad || 0) / 2.5));
    out.windAvg.push(  Math.round(avg(b.wind     || []) * 3.6));
    out.windGust.push( 0);
    out.snow.push(     +(b.snow         || 0).toFixed(1));
    out.pressure.push( Math.round(avg(b.pressure || []) * 10));
    out.humidity.push( Math.round(avg(b.rh       || [])));
    out.rainDays.push( b.rainDays  || 0);
    out.frostDays.push(b.frostDays || 0);
    out.uvIndex.push(  +(avg(b.uv || [])).toFixed(1));
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
