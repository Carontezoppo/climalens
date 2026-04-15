/**
 * GET /api/climate?lat=XX&lon=YY
 *
 * Proxies the Open-Meteo ERA5 archive API and caches responses in
 * Cloudflare KV for 24 hours. This keeps the heavy daily-data
 * requests (one per city, ~150 KB each) off the client's API quota
 * and makes them instant for anyone who visits after the first load.
 *
 * KV binding: CLIMATE_CACHE  (configure in Cloudflare Pages dashboard
 *             or in wrangler.toml for local dev)
 */

const UPSTREAM = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const lat    = url.searchParams.get('lat');
  const lon    = url.searchParams.get('lon');

  if (!lat || !lon) {
    return json({ error: 'lat and lon query parameters are required' }, 400);
  }

  // Normalise to 4 decimal places so minor float drift doesn't bust the cache
  const latN = parseFloat(lat).toFixed(4);
  const lonN = parseFloat(lon).toFixed(4);

  // Key is location + UTC date so cache refreshes daily
  const today    = new Date().toISOString().slice(0, 10);
  const cacheKey = `climate_${latN}_${lonN}_${today}`;

  // ── KV cache read ──────────────────────────────────────────────────────────
  if (env.CLIMATE_CACHE) {
    const cached = await env.CLIMATE_CACHE.get(cacheKey);
    if (cached) {
      return json(cached, 200, { 'X-Cache': 'HIT' });
    }
  }

  // ── Fetch from Open-Meteo ──────────────────────────────────────────────────
  const endYear = new Date().getFullYear() - 1;
  const params  = new URLSearchParams({
    latitude:   latN,
    longitude:  lonN,
    start_date: '1970-01-01',
    end_date:   `${endYear}-12-31`,
    daily:      'temperature_2m_max,temperature_2m_min',
    timezone:   'UTC',
  });

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM}?${params}`);
  } catch (err) {
    return json({ error: `Upstream fetch failed: ${err.message}` }, 502);
  }

  const body = await upstream.text();

  if (!upstream.ok) {
    // Don't cache error responses
    return json(body, upstream.status, { 'X-Cache': 'MISS' });
  }

  // ── KV cache write ─────────────────────────────────────────────────────────
  if (env.CLIMATE_CACHE) {
    // Fire-and-forget — don't await so the response isn't delayed
    env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL });
  }

  return json(body, 200, { 'X-Cache': 'MISS' });
}

// ── Helper ─────────────────────────────────────────────────────────────────
function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      // Allow the browser on any origin to call this endpoint
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  });
}
