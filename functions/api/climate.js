/**
 * GET /api/climate?lat=XX&lon=YY
 *
 * Fetches daily temperature data from NASA POWER (MERRA-2 reanalysis),
 * computes the full climate analysis (annual means, 1981-2010 baseline,
 * anomalies, linear trend, stats) server-side, and caches the compact
 * pre-computed result in KV for 90 days.
 *
 * NASA POWER is free, requires no API key, and has no per-minute or
 * per-day rate limits that affect production use.
 *
 * Response shape (version 2, pre-computed):
 *   { _v:2, years[], anomalies[], trendLine[], baseline,
 *     decadeRate, totalChange,
 *     warmestYr, warmestAnom, coldestYr, coldestAnom,
 *     lastYear, lastAnom }
 *
 * KV binding: CLIMATE_CACHE
 */

const UPSTREAM  = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CACHE_TTL = 60 * 60 * 24 * 90; // 90 days — MERRA-2 data is static once published

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

    const cacheKey = `climate4_${latN}_${lonN}`;

    // ── KV cache read ─────────────────────────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Fetch from NASA POWER ─────────────────────────────────────────────────
    const endYear = new Date().getFullYear() - 1;
    // Build URL manually — URLSearchParams encodes commas as %2C which NASA POWER rejects
    const query = `parameters=T2MMAX,T2MMIN&community=RE&longitude=${lonN}&latitude=${latN}&start=19810101&end=${endYear}1231&format=JSON`;

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

    // ── Process: keyed daily records → ~5 KB pre-computed ────────────────────
    const processed = processClimate(raw);

    // ── KV cache write (fire-and-forget) ──────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(processed), { expirationTtl: CACHE_TTL });
    }

    return json(processed, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

/* ── Climate computation ─────────────────────────────────────────────────── */
function processClimate(raw) {
  const tmax = raw.properties.parameter.T2MMAX;
  const tmin = raw.properties.parameter.T2MMIN;

  // NASA POWER uses YYYYMMDD date keys; -999 means missing
  const buckets = {};
  for (const dateKey of Object.keys(tmax)) {
    const mx = tmax[dateKey];
    const mn = tmin[dateKey];
    if (mx <= -998 || mn <= -998 || isNaN(mx) || isNaN(mn)) continue;
    const yr = +dateKey.slice(0, 4);
    if (!buckets[yr]) buckets[yr] = { sum: 0, n: 0 };
    buckets[yr].sum += (mx + mn) / 2;
    buckets[yr].n++;
  }

  // Drop partial years (< 300 days of data)
  const years = Object.keys(buckets).map(Number).sort((a, b) => a - b)
    .filter(yr => buckets[yr].n >= 300);
  const means = years.map(yr => +(buckets[yr].sum / buckets[yr].n).toFixed(2));

  // WMO 1981–2010 standard reference period baseline
  const baseVals = means.filter((_, i) => years[i] >= 1981 && years[i] <= 2010);
  const baseline = baseVals.length
    ? +(baseVals.reduce((a, b) => a + b, 0) / baseVals.length).toFixed(2)
    : +(means.reduce((a, b) => a + b, 0) / means.length).toFixed(2);

  const anomalies = means.map(m => +(m - baseline).toFixed(2));

  // Linear regression (index-based for numerical stability)
  const n   = years.length;
  const xs  = years.map((_, i) => i);
  const sx  = xs.reduce((a, b) => a + b, 0);
  const sy  = anomalies.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * anomalies[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const slope     = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const trendLine = xs.map(x => +(intercept + slope * x).toFixed(2));

  const decadeRate  = +(slope * 10).toFixed(2);
  const totalChange = +(trendLine[n - 1] - trendLine[0]).toFixed(2);
  const maxAnom     = Math.max(...anomalies);
  const minAnom     = Math.min(...anomalies);

  return {
    _v: 2,
    years, anomalies, trendLine, baseline,
    decadeRate, totalChange,
    warmestYr:   years[anomalies.indexOf(maxAnom)],
    warmestAnom: +maxAnom.toFixed(2),
    coldestYr:   years[anomalies.indexOf(minAnom)],
    coldestAnom: +minAnom.toFixed(2),
    lastYear:    years[n - 1],
    lastAnom:    anomalies[n - 1],
  };
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  });
}
