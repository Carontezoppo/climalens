/**
 * GET /api/climate?lat=XX&lon=YY
 *
 * Fetches ERA5 daily temperature data from Open-Meteo, computes the full
 * climate analysis (annual means, 1981-2010 baseline, anomalies, linear
 * trend, stats) server-side, and caches the compact pre-computed result
 * in KV for 24 hours.
 *
 * With the paid plan (30 s CPU / request) we can do the number-crunching
 * here instead of shipping ~150 KB of raw daily records to every browser.
 * The cached payload is ~5 KB — a 30× reduction.
 *
 * Response shape (version 2, pre-computed):
 *   { _v:2, years[], anomalies[], trendLine[], baseline,
 *     decadeRate, totalChange,
 *     warmestYr, warmestAnom, coldestYr, coldestAnom,
 *     lastYear, lastAnom }
 *
 * KV binding: CLIMATE_CACHE
 */

const UPSTREAM  = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 60 * 60 * 24; // 24 hours

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

    // Use a versioned cache key so old raw-data entries are ignored
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `climate2_${latN}_${lonN}_${today}`;

    // ── KV cache read ─────────────────────────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // ── Fetch raw ERA5 data from Open-Meteo ───────────────────────────────────
    const endYear = new Date().getFullYear() - 1;
    const params  = new URLSearchParams({
      latitude:   latN,
      longitude:  lonN,
      start_date: '1970-01-01',
      end_date:   `${endYear}-12-31`,
      daily:      'temperature_2m_max,temperature_2m_min',
      timezone:   'UTC',
    });

    const upstream = await fetch(`${UPSTREAM}?${params}`);
    const body     = await upstream.text();

    if (!upstream.ok) {
      let reason = `HTTP ${upstream.status}`;
      try { reason = JSON.parse(body).reason || reason; } catch { /* non-JSON */ }
      return json({ error: reason }, upstream.status, { 'X-Cache': 'MISS' });
    }

    // ── Process: 150 KB raw → ~5 KB pre-computed ──────────────────────────────
    const raw       = JSON.parse(body);
    const processed = processClimate(raw);

    // ── KV cache write (fire-and-forget) ──────────────────────────────────────
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(processed), { expirationTtl: CACHE_TTL });
    }

    return json(processed, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

/* ── Climate computation (mirrors js/climate.js processClimateData) ───────── */
function processClimate(raw) {
  const { daily } = raw;

  // Bucket daily readings into annual means
  const buckets = {};
  for (let i = 0; i < daily.time.length; i++) {
    const yr   = +daily.time[i].slice(0, 4);
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    if (tmax == null || tmin == null || isNaN(tmax) || isNaN(tmin)) continue;
    if (!buckets[yr]) buckets[yr] = { sum: 0, n: 0 };
    buckets[yr].sum += (tmax + tmin) / 2;
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
    _v: 2, // version flag — browser uses this to skip re-processing
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
