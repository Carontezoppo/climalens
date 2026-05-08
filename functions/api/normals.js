/**
 * GET /api/normals?lat=XX&lon=YY
 *
 * Fetches daily weather from NASA POWER (MERRA-2, AG community) for
 * 2000–last year, averages by calendar month, and returns
 * { high, low, rain, sun, wind, windGust, snow } — 12 values each.
 *
 * sun is derived from ALLSKY_SFC_SW_DWN (solar radiation MJ/m²/day)
 * divided by 2.5 as an approximation of sunshine hours per month.
 * windGust is not available in NASA POWER and returns null for all months.
 *
 * KV binding: CLIMATE_CACHE · TTL: 90 days
 */

const UPSTREAM  = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CACHE_TTL = 60 * 60 * 24 * 90; // 90 days

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (!lat || !lon) return json({ error: 'lat and lon required' }, 400);

    const latN = parseFloat(lat).toFixed(4);
    const lonN = parseFloat(lon).toFixed(4);
    const cacheKey = `normals_v3_${latN}_${lonN}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const endYear = new Date().getFullYear() - 1;
    const query = `parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M_MAX,PRECSNO&community=AG&longitude=${lonN}&latitude=${latN}&start=20000101&end=${endYear}1231&format=JSON`;

    const upstream = await fetch(`${UPSTREAM}?${query}`, {
      headers: { 'User-Agent': 'ClimaLens/1.0' },
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).errors?.[0] || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, 503);
    }

    const raw = JSON.parse(body);
    if (raw.errors && raw.errors.length > 0) {
      return json({ error: raw.errors[0] }, 503);
    }

    const p    = raw.properties.parameter;
    const tmax = p.T2M_MAX;
    const tmin = p.T2M_MIN;
    const prec = p.PRECTOTCORR;
    const rad  = p.ALLSKY_SFC_SW_DWN;
    const wind = p.WS10M_MAX;
    const snow = p.PRECSNO;

    // Daily-averaged-per-month accumulators (temperature, wind)
    const sumHigh = Array(12).fill(0), sumLow  = Array(12).fill(0);
    const sumWind = Array(12).fill(0);
    const count   = Array(12).fill(0);

    // Per year-month total accumulators (precipitation, radiation, snow)
    const ymPrec = {}, ymRad = {}, ymSnow = {};

    for (const dateKey of Object.keys(tmax)) {
      const mx = tmax[dateKey];
      if (mx <= -998) continue;

      const yr = +dateKey.slice(0, 4);
      const mo = +dateKey.slice(4, 6) - 1; // 0–11
      const ym = yr * 12 + mo;

      sumHigh[mo] += mx;
      count[mo]++;

      const mn = tmin[dateKey];
      if (mn > -998) sumLow[mo] += mn;

      const ws = wind[dateKey];
      if (ws > -998) sumWind[mo] += ws;

      ymPrec[ym] = (ymPrec[ym] || 0) + (prec[dateKey] > -998 ? prec[dateKey] : 0);
      ymRad[ym]  = (ymRad[ym]  || 0) + (rad[dateKey]  > -998 ? rad[dateKey]  : 0);
      ymSnow[ym] = (ymSnow[ym] || 0) + (snow[dateKey] > -998 ? snow[dateKey] : 0);
    }

    // Average monthly totals from year-month buckets
    const rainTot = Array(12).fill(0), radTot = Array(12).fill(0), snowTot = Array(12).fill(0);
    const ymCount = Array(12).fill(0);
    for (const ym in ymPrec) {
      const mo = ym % 12;
      rainTot[mo] += ymPrec[ym];
      radTot[mo]  += ymRad[ym]  || 0;
      snowTot[mo] += ymSnow[ym] || 0;
      ymCount[mo]++;
    }

    const result = {
      high:     sumHigh.map((v, m) => count[m]   > 0 ? Math.round(v / count[m])          : null),
      low:      sumLow.map((v, m)  => count[m]   > 0 ? Math.round(v / count[m])          : null),
      rain:     rainTot.map((v, m) => ymCount[m] > 0 ? Math.round(v / ymCount[m])        : null),
      sun:      radTot.map((v, m)  => ymCount[m] > 0 ? Math.round(v / ymCount[m] / 2.5) : null),
      wind:     sumWind.map((v, m) => count[m]   > 0 ? Math.round(v / count[m])          : null),
      windGust: Array(12).fill(null),
      snow:     snowTot.map((v, m) => ymCount[m] > 0 ? +(v / ymCount[m]).toFixed(1)      : null),
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
