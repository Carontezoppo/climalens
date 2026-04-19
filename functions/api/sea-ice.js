/**
 * GET /api/sea-ice
 *
 * Fetches NSIDC Sea Ice Index G02135 v3.0 monthly extent CSVs for
 * Arctic September and Antarctic February, computes stats vs the
 * WMO 1981-2010 baseline, and caches the result in KV for 24 hours.
 *
 * Response shape:
 *   { _v:1, arctic: PoleData, antarctic: PoleData }
 *
 * PoleData: { years[], extents[], baseline, anomalies[],
 *             lastYear, lastExtent, lastAnomaly,
 *             recordLowExtent, recordLowYear,
 *             baselineMin, baselineMax }
 *
 * KV binding: CLIMATE_CACHE
 */

const NSIDC_BASE = 'https://noaadata.apps.nsidc.org/NOAA/G02135';
const CACHE_TTL  = 60 * 60 * 24;

// Per-month files (v4.0) — Arctic September minimum, Antarctic February minimum
const SOURCES = {
  arctic:    `${NSIDC_BASE}/north/monthly/data/N_09_extent_v4.0.csv`,
  antarctic: `${NSIDC_BASE}/south/monthly/data/S_02_extent_v4.0.csv`,
};

export async function onRequestGet({ request, env }) {
  try {
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `seaice1_${today}`;

    // ── KV cache check ────────────────────────────────────────────────────────
    if (env?.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(JSON.parse(cached));
    }

    // ── Fetch both CSVs in parallel ───────────────────────────────────────────
    const [arcticCsv, antarcticCsv] = await Promise.all([
      fetchText(SOURCES.arctic),
      fetchText(SOURCES.antarctic),
    ]);

    const arctic    = computePoleStats(parseCsv(arcticCsv));
    const antarctic = computePoleStats(parseCsv(antarcticCsv));

    const payload = { _v: 1, arctic, antarctic };

    if (env?.CLIMATE_CACHE) {
      await env.CLIMATE_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL });
    }

    return json(payload);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ── CSV parsing ───────────────────────────────────────────────────────────────
// NSIDC per-month CSV format: year, mo, data-type, region, extent, area
// Header lines start with non-numeric characters
function parseCsv(text) {
  const rows = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',').map(s => s.trim());
    const year  = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1970 || year > 2100) continue;
    const extent = parseFloat(parts[4]);
    if (isNaN(extent) || extent < 0.5 || extent > 25) continue;
    rows.push({ year, extent });
  }
  return rows.sort((a, b) => a.year - b.year);
}

// ── Stats computation ─────────────────────────────────────────────────────────
function computePoleStats(rows) {
  const years   = rows.map(r => r.year);
  const extents = rows.map(r => r.extent);

  // WMO 1981-2010 baseline
  const baseRows = rows.filter(r => r.year >= 1981 && r.year <= 2010);
  const baseline = baseRows.length
    ? baseRows.reduce((s, r) => s + r.extent, 0) / baseRows.length
    : null;

  const anomalies = extents.map(e => baseline !== null ? +(e - baseline).toFixed(3) : null);

  const last       = rows[rows.length - 1];
  const lastYear   = last?.year ?? null;
  const lastExtent = last?.extent ?? null;
  const lastAnomaly = baseline !== null && lastExtent !== null
    ? +(lastExtent - baseline).toFixed(3) : null;

  let recordLowExtent = Infinity;
  let recordLowYear   = null;
  for (const r of rows) {
    if (r.extent < recordLowExtent) { recordLowExtent = r.extent; recordLowYear = r.year; }
  }

  const baselineMin = baseRows.length ? Math.min(...baseRows.map(r => r.extent)) : null;
  const baselineMax = baseRows.length ? Math.max(...baseRows.map(r => r.extent)) : null;

  return {
    years, extents,
    baseline: baseline !== null ? +baseline.toFixed(3) : null,
    anomalies,
    lastYear, lastExtent, lastAnomaly,
    recordLowExtent: +recordLowExtent.toFixed(3), recordLowYear,
    baselineMin: baselineMin !== null ? +baselineMin.toFixed(3) : null,
    baselineMax: baselineMax !== null ? +baselineMax.toFixed(3) : null,
  };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MeteoScope/1.0' } });
  if (!res.ok) throw new Error(`NSIDC fetch failed: ${res.status} ${url}`);
  return res.text();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':               'public, max-age=3600',
    },
  });
}
