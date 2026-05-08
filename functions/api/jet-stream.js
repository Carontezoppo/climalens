/**
 * GET /api/jet-stream?lat=XX&lon=YY
 *
 * Returns the monthly North Atlantic Oscillation (NAO) index for Northern
 * Hemisphere cities, or the Southern Annular Mode (SAM/AAO) for Southern
 * Hemisphere cities. Tropical cities (|lat| < 20°) return { tropical: true }.
 *
 * Both indices are published by NOAA Climate Prediction Center as plain ASCII
 * tables. Positive phase = jet stream in normal/northward position (mild).
 * Negative phase = jet displaced toward equator (cold air spills south).
 *
 * Response: { index: 'NAO'|'SAM', annual: [{year, value}] }
 *
 * KV binding: CLIMATE_CACHE · TTL: 3 days
 */

const NAO_URL = 'https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.monthly.b5001.current.ascii.table';
const SAM_URL = 'https://www.cpc.ncep.noaa.gov/products/precip/CWlink/daily_ao_index/aao/monthly.aao.index.b79.current.ascii.table';
const CACHE_TTL = 60 * 60 * 24 * 3; // 3 days
const START_YEAR = 2000;

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));

    if (isNaN(lat) || isNaN(lon)) {
      return json({ error: 'lat and lon query parameters are required' }, 400);
    }

    if (Math.abs(lat) < 20) {
      return json({ tropical: true }, 200);
    }

    const isNH      = lat > 0;
    const indexName = isNH ? 'NAO' : 'SAM';
    const sourceUrl = isNH ? NAO_URL : SAM_URL;
    const cacheKey  = `jetstream_v2_${indexName.toLowerCase()}`;

    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'ClimaLens/1.0' } });
    if (!res.ok) return json({ error: `NOAA CPC returned HTTP ${res.status}` }, 503);

    const text   = await res.text();
    const monthly = parseNoaaTable(text);

    if (monthly.length === 0) {
      return json({ error: 'Could not parse NOAA CPC index table' }, 503);
    }

    // Aggregate to annual means from START_YEAR onward
    const yearBuckets = {};
    for (const { year, value } of monthly) {
      if (year < START_YEAR) continue;
      if (!yearBuckets[year]) yearBuckets[year] = { sum: 0, n: 0 };
      yearBuckets[year].sum += value;
      yearBuckets[year].n++;
    }

    const annual = Object.keys(yearBuckets)
      .map(Number).sort((a, b) => a - b)
      .filter(yr => yearBuckets[yr].n >= 10)
      .map(yr => ({ year: yr, value: +(yearBuckets[yr].sum / yearBuckets[yr].n).toFixed(2) }));

    if (annual.length === 0) {
      return json({ error: 'No index data available for the requested period' }, 503);
    }

    const result = JSON.stringify({ index: indexName, annual });
    if (env.CLIMATE_CACHE) {
      env.CLIMATE_CACHE.put(cacheKey, result, { expirationTtl: CACHE_TTL });
    }

    return json(result, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

// Parses NOAA CPC ASCII tables. Each data row: year  v1  v2 ... v12 (Jan–Dec).
// Handles both NAO and SAM formats. Skips header lines and missing-value sentinels.
function parseNoaaTable(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1950 || year > 2100) continue;
    for (let m = 0; m < 12 && m + 1 < parts.length; m++) {
      const v = parseFloat(parts[m + 1]);
      if (isNaN(v) || v < -90) continue; // -99.9 = missing/not yet reported
      results.push({ year, month: m + 1, value: v });
    }
  }
  return results;
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
