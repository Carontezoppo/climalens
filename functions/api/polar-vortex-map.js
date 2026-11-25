/**
 * GET /api/polar-vortex-map?hemi=n|s
 *
 * Wind and geopotential height at 10 hPa over the polar cap (30°–85°), for the
 * animated polar vortex map on history.html.
 *
 * Source: Open-Meteo ECMWF IFS endpoint (no key), current hour.
 *
 * Open-Meteo bills one call per location and allows 600 per minute, so a
 * regular 5° grid (864 points) would overrun the limit on every refresh.
 * Instead we request a reduced grid — fewer longitudes towards the pole, so
 * points sit ~550 km apart at every latitude (~440 points) — and resample each
 * row onto a regular 5° grid here, so the browser gets a plain lat/lon grid.
 * The pole itself is skipped: east/north wind components are undefined there.
 *
 * Response: { hemi, time, latMin, step, width, height, u[], v[], z[] }
 *   rows run from the 30° row towards the pole (row 0 = 30°N or 30°S),
 *   columns from 180°W eastward. u/v in m/s (east/north), z in metres.
 *
 * KV binding: CLIMATE_CACHE · TTL: 6 hours, plus a 30-day stale fallback
 */

const API = 'https://api.open-meteo.com/v1/ecmwf';
const STEP = 5;
const LATS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
const WIDTH = 360 / STEP;
const CACHE_TTL       = 60 * 60 * 6;       // 6 hours — ECMWF runs four times a day
const STALE_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export async function onRequestGet({ request, env, waitUntil }) {
  const hemi = new URL(request.url).searchParams.get('hemi') === 's' ? 's' : 'n';
  const sign = hemi === 'n' ? 1 : -1;
  const now  = new Date();
  const slot = `${now.toISOString().slice(0, 10)}_${Math.floor(now.getUTCHours() / 6)}`;
  const cacheKey = `polar_vortex_map_v1_${hemi}_${slot}`;
  const staleKey = `polar_vortex_map_v1_${hemi}_stale`;

  try {
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    // Reduced grid: row r has round(72·cos φ) evenly spaced longitudes from 180°W
    const rows = LATS.map(lat => Math.max(4, Math.round(WIDTH * Math.cos(lat * Math.PI / 180))));
    const qLat = [], qLon = [];
    rows.forEach((n, r) => {
      for (let k = 0; k < n; k++) {
        qLat.push(sign * LATS[r]);
        qLon.push(+(-180 + k * 360 / n).toFixed(3));
      }
    });

    // POST: ~440 coordinate pairs would make a very long GET URL
    const body = new URLSearchParams({
      latitude:  qLat.join(','),
      longitude: qLon.join(','),
      hourly: 'wind_speed_10hPa,wind_direction_10hPa,geopotential_height_10hPa',
      wind_speed_unit: 'ms',
      forecast_hours: '1',
      timezone: 'GMT',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let upstream;
    try {
      upstream = await fetch(API, { method: 'POST', body, signal: controller.signal });
    } finally { clearTimeout(timer); }
    if (!upstream.ok) return staleOrErr(env, staleKey, `Open-Meteo returned HTTP ${upstream.status}`);

    const points = await upstream.json();
    if (!Array.isArray(points) || points.length !== qLat.length) {
      return staleOrErr(env, staleKey, 'Unexpected response from Open-Meteo');
    }

    // Resample each reduced row onto 72 regular columns (linear in longitude, wrapping)
    const u = [], v = [], z = [];
    let offset = 0;
    for (let r = 0; r < LATS.length; r++) {
      const n = rows[r];
      const ru = [], rv = [], rz = [];
      for (let k = 0; k < n; k++) {
        const h = points[offset + k].hourly;
        const s = h.wind_speed_10hPa[0], d = h.wind_direction_10hPa[0] * Math.PI / 180;
        if (s == null || d == null || h.geopotential_height_10hPa[0] == null) {
          return staleOrErr(env, staleKey, 'Missing values in Open-Meteo response');
        }
        // Meteorological direction is where the wind blows FROM
        ru.push(-s * Math.sin(d));
        rv.push(-s * Math.cos(d));
        rz.push(h.geopotential_height_10hPa[0]);
      }
      offset += n;
      for (let j = 0; j < WIDTH; j++) {
        const pos = (j * STEP) / (360 / n);
        const k0 = Math.floor(pos) % n, k1 = (k0 + 1) % n, f = pos - Math.floor(pos);
        u.push(round1(ru[k0] + (ru[k1] - ru[k0]) * f));
        v.push(round1(rv[k0] + (rv[k1] - rv[k0]) * f));
        z.push(Math.round(rz[k0] + (rz[k1] - rz[k0]) * f));
      }
    }

    const out = JSON.stringify({
      hemi,
      time: points[0].hourly.time[0] + 'Z',
      latMin: LATS[0], step: STEP, width: WIDTH, height: LATS.length,
      u, v, z,
    });
    if (env.CLIMATE_CACHE) {
      waitUntil(Promise.all([
        env.CLIMATE_CACHE.put(cacheKey, out, { expirationTtl: CACHE_TTL }),
        env.CLIMATE_CACHE.put(staleKey, out, { expirationTtl: STALE_CACHE_TTL }),
      ]));
    }
    return json(out, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return staleOrErr(env, staleKey, err.message);
  }
}

function round1(x) { return Math.round(x * 10) / 10; }

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
