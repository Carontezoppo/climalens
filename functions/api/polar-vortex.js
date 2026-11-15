/**
 * GET /api/polar-vortex?hemi=n|s
 *
 * Polar vortex strength: daily zonal-mean zonal wind at 60°N (or 60°S) and
 * 10 hPa — the standard vortex index. A reversal to easterly (negative) winds
 * in winter is the definition of a major sudden stratospheric warming (SSW).
 *
 * Source: NASA GSFC Atmospheric Chemistry and Dynamics Lab, "Annual
 * Meteorological Statistics" — one plain-text file per season with, for every
 * day: the value, that date's climatology (min, 10/30/70/90th percentiles,
 * mean, max over 1978/79–present) and a forecast lead-time column (0 = analysis,
 * >0 = GEOS FP forecast hours, -1 = no data yet). Recent values are GEOS FP
 * (operational) rather than final MERRA-2, so they may be revised slightly.
 *
 * Files: NH seasons run Jul–Jun (u60n_10_<startYear>), SH seasons Jan–Dec
 * (u60s_10_<year>). Falls back to the previous file if the new season's has
 * not been published yet.
 *
 * Response: { hemi, climatology, rows: [[date, value|null, min, p10, p30,
 *             mean, p70, p90, max, lead], ...] }
 *
 * KV binding: CLIMATE_CACHE · TTL: 12 hours, plus a 30-day stale fallback
 */

const BASE = 'https://acd-ext.gsfc.nasa.gov/Data_services/met/metdata/annual/merra2/wind';
const CACHE_TTL       = 60 * 60 * 12;      // 12 hours — file updates daily
const STALE_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days — single lab server, no SLA

export async function onRequestGet({ request, env, waitUntil }) {
  const hemi = new URL(request.url).searchParams.get('hemi') === 's' ? 's' : 'n';
  const cacheKey = `polar_vortex_v1_${hemi}`;
  const staleKey = `${cacheKey}_stale`;

  try {
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const now  = new Date();
    const year = hemi === 'n' && now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

    let upstream = await fetch(fileUrl(hemi, year));
    if (upstream.status === 404) upstream = await fetch(fileUrl(hemi, year - 1));
    if (!upstream.ok) return staleOrErr(env, staleKey, `NASA GSFC returned HTTP ${upstream.status}`);

    const text = await upstream.text();
    const climatology = (text.match(/^Climatology:\s*(.+)$/m) || [])[1]?.trim() || null;

    // Rows: "2026-11-12     -2.12     12.29   21.42   25.97   28.94   31.97   36.52   42.92      0"
    const rows = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2})((?:\s+-?\d+(?:\.\d+)?){9})\s*$/);
      if (!m) continue;
      const n = m[2].trim().split(/\s+/).map(Number);
      rows.push([m[1], n[0] === -9999 ? null : n[0], ...n.slice(1, 8), n[8]]);
    }
    if (!rows.some(r => r[1] !== null)) return staleOrErr(env, staleKey, 'No usable data in NASA GSFC file');

    const body = JSON.stringify({ hemi, climatology, rows });
    if (env.CLIMATE_CACHE) {
      waitUntil(Promise.all([
        env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL }),
        env.CLIMATE_CACHE.put(staleKey, body, { expirationTtl: STALE_CACHE_TTL }),
      ]));
    }
    return json(body, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return staleOrErr(env, staleKey, err.message);
  }
}

function fileUrl(hemi, year) {
  return `${BASE}/u60${hemi}_10_${year}_merra2.txt`;
}

async function staleOrErr(env, staleKey, msg) {
  if (env.CLIMATE_CACHE) {
    const stale = await env.CLIMATE_CACHE.get(staleKey);
    if (stale) return json(stale, 200, { 'X-Cache': 'STALE' });
  }
  return json({ error: msg }, 503);
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
