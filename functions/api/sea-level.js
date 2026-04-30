const CACHE_KEY = 'sea-level-gmsl-v1';
const CACHE_TTL = 86400; // 24 hours

// University of Colorado Sea Level Research Group — merged altimetry GMSL
// Seasonal signals and GIA removed. Update the release slug (2026_rel1) each year.
// Format: two tab-separated columns — decimal year, mm anomaly (no header rows to skip beyond #)
const GMSL_URL =
  'https://sealevel.colorado.edu/files/2026_rel1/gmsl_2026rel1_seasons_rmvd.txt';

export async function onRequest(context) {
  const { env } = context;

  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(CACHE_KEY);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      });
    }
  }

  let text;
  try {
    const res = await fetch(GMSL_URL, { headers: { 'User-Agent': 'ClimaLens/1.0' } });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    text = await res.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch GMSL data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // File format: lines starting with # are comments; data rows are tab-separated:
  //   col 0 — decimal year (e.g. 1992.9594981674402)
  //   col 1 — GMSL anomaly in mm, seasonal signals and GIA removed
  const points = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const cols = t.split(/\s+/);
    if (cols.length < 2) continue;
    const year  = parseFloat(cols[0]);
    const value = parseFloat(cols[1]);
    if (isNaN(year) || isNaN(value)) continue;
    points.push({ year, value });
  }

  if (points.length === 0) {
    return new Response(JSON.stringify({ error: 'No data parsed from GMSL file' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lastYear = points[points.length - 1].year;
  const recent = points.filter(p => p.year >= lastYear - 5);
  const currentRate = Math.round(linearRate(recent) * 10) / 10;
  const totalRise = Math.round(points[points.length - 1].value - points[0].value);

  const result = {
    currentRate,
    totalRise,
    latestYear: Math.floor(lastYear),
    sparkline: annualise(points),
  };

  const json = JSON.stringify(result);
  if (env.CLIMATE_CACHE) {
    await env.CLIMATE_CACHE.put(CACHE_KEY, json, { expirationTtl: CACHE_TTL });
  }

  return new Response(json, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

function linearRate(points) {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.year, 0) / n;
  const my = points.reduce((s, p) => s + p.value, 0) / n;
  const num = points.reduce((s, p) => s + (p.year - mx) * (p.value - my), 0);
  const den = points.reduce((s, p) => s + (p.year - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function annualise(points) {
  const byYear = {};
  for (const { year, value } of points) {
    const y = Math.floor(year);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(value);
  }
  return Object.entries(byYear)
    .map(([y, vals]) => ({
      year: +y,
      value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }))
    .sort((a, b) => a.year - b.year);
}
