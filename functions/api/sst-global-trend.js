/**
 * GET /api/sst-global-trend
 *
 * Returns a global ocean surface temperature anomaly time series (1950–present)
 * computed from NOAA ERSSTv5 via ERDDAP. Fetches January values at a sparse
 * spatial grid (every 12° in lat/lon, stride=6 in ERDDAP index terms) and
 * applies cos(lat) area-weighting to approximate the global ocean mean.
 *
 * Anomalies are relative to the 1981–2010 WMO baseline (matching the rest of
 * the site). A linear trend rate (°C/decade) is pre-computed server-side.
 *
 * KV cache TTL: 24 hours — ERSSTv5 updates monthly.
 */

const ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiErsstv5_LonPM180.json';
const START_YEAR     = 1950;
const BASELINE_START = 1981;
const BASELINE_END   = 2010;
const CACHE_TTL = 60 * 60 * 24; // 24 hours

// ERDDAP is shared with currents-live.js and is known to be flaky (occasional
// 522s under load). Keep a long-lived fallback copy so a transient outage
// doesn't break the card — the underlying anomaly series barely moves day to day.
const STALE_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export async function onRequestGet({ env }) {
  const cacheKey  = 'sst_global_trend_v1';
  const staleKey  = 'sst_global_trend_v1_stale';

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey);
    if (cached) return json(cached, { 'X-Cache': 'HIT' });
  }

  const endYear = new Date().getFullYear();
  // stride=12 on monthly time axis → one January per year
  // stride=6 on 2°-resolution lat/lon → sample every 12°
  const q = `sst[(${START_YEAR}-01-15T00:00:00Z):12:(${endYear}-01-15T00:00:00Z)]` +
            `[(0.0):1:(0.0)][(-88.0):6:(88.0)][(-180.0):6:(178.0)]`;

  let upstream;
  try {
    upstream = await fetch(`${ERDDAP}?${q}`);
  } catch (e) {
    return staleOrErr(env, staleKey, `ERDDAP fetch failed: ${e.message}`);
  }

  if (!upstream.ok) return staleOrErr(env, staleKey, `ERDDAP returned ${upstream.status}`);

  let data;
  try { data = await upstream.json(); }
  catch { return staleOrErr(env, staleKey, 'ERDDAP parse error'); }

  const rows = data?.table?.rows;
  if (!rows?.length) return staleOrErr(env, staleKey, 'No data returned');

  // Group rows by year; accumulate cos(lat)-weighted SST sum
  // ERDDAP row order: [time, depth, latitude, longitude, sst]
  const byYear = new Map();
  for (const row of rows) {
    const sst = row[4];
    if (sst == null || !isFinite(sst)) continue;
    const year = parseInt(row[0], 10); // "1950-01-15T…" → 1950
    const lat  = row[2];
    const w    = Math.cos(lat * Math.PI / 180);
    if (!byYear.has(year)) byYear.set(year, { sum: 0, w: 0 });
    const acc = byYear.get(year);
    acc.sum += sst * w;
    acc.w   += w;
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const means = years.map(y => {
    const { sum, w } = byYear.get(y);
    return w > 0 ? sum / w : null;
  });

  // 1981–2010 baseline mean (absolute SST, not anomaly)
  const baselineVals = years
    .map((y, i) => (y >= BASELINE_START && y <= BASELINE_END) ? means[i] : null)
    .filter(v => v != null);
  if (!baselineVals.length) return staleOrErr(env, staleKey, 'Baseline years not in dataset');
  const baselineMean = baselineVals.reduce((a, b) => a + b, 0) / baselineVals.length;

  // Annual anomalies vs 1981–2010
  const anomalies = means.map(m =>
    m != null ? parseFloat((m - baselineMean).toFixed(3)) : null
  );

  // Linear trend via ordinary least squares (anomaly vs year)
  const pairs = years.map((y, i) => [y, anomalies[i]]).filter(([, a]) => a != null);
  const n    = pairs.length;
  const sumX  = pairs.reduce((s, [y]) => s + y, 0);
  const sumY  = pairs.reduce((s, [, a]) => s + a, 0);
  const sumXY = pairs.reduce((s, [y, a]) => s + y * a, 0);
  const sumXX = pairs.reduce((s, [y]) => s + y * y, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const trendPerDecade = parseFloat((slope * 10).toFixed(3));

  const latestIdx = anomalies.length - 1;
  const body = JSON.stringify({
    years,
    anomalies,
    trendPerDecade,
    latestYear:    years[latestIdx],
    latestAnomaly: anomalies[latestIdx],
    baseline: '1981-2010',
  });

  if (env.CLIMATE_CACHE) {
    await env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL });
    await env.CLIMATE_CACHE.put(staleKey, body, { expirationTtl: STALE_CACHE_TTL });
  }

  return json(body);
}

// On any upstream failure, fall back to the last known-good response rather
// than failing outright — annual anomalies move slowly, so a stale copy is
// still accurate, and ERDDAP's intermittent 522s shouldn't break the card.
async function staleOrErr(env, staleKey, msg) {
  if (env.CLIMATE_CACHE) {
    const stale = await env.CLIMATE_CACHE.get(staleKey);
    if (stale) return json(stale, { 'X-Cache': 'STALE' });
  }
  return err(msg, 503);
}

function json(body, extraHeaders = {}) {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

function err(msg, status = 503) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
