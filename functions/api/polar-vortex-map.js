/**
 * GET /api/polar-vortex-map?hemi=n|s
 *
 * Wind, geopotential height and temperature at 10 hPa over the polar cap (30°–85°), for the
 * animated polar vortex map on history.html.
 *
 * Source: Open-Meteo ECMWF IFS endpoint (no key). One frame per day: the
 * 6-hourly step nearest now, then every 24 h out to 10 days. The forecast
 * length doesn't change the call cost (it is billed per location).
 *
 * Open-Meteo bills one call per location and allows 600 per minute, so a
 * regular 5° grid (864 points) would overrun the limit on every refresh.
 * Instead we request a reduced grid — fewer longitudes towards the pole, so
 * points sit ~550 km apart at every latitude (~440 points) — and resample each
 * row onto a regular 5° grid here, so the browser gets a plain lat/lon grid.
 * The pole itself is skipped: east/north wind components are undefined there.
 *
 * Response: { hemi, latMin, step, width, height,
 *             frames: [{ time, u[], v[], z[], t[] }, ...] }   frames[0] = now
 *   rows run from the 30° row towards the pole (row 0 = 30°N or 30°S),
 *   columns from 180°W eastward. u/v in m/s (east/north), z in metres, t in °C.
 *
 * KV binding: CLIMATE_CACHE · TTL: 6 hours, plus a 30-day stale fallback
 */

const API = 'https://api.open-meteo.com/v1/ecmwf';
const STEP = 5;
const LATS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
const WIDTH = 360 / STEP;
const CACHE_TTL       = 60 * 60 * 6;       // 6 hours — ECMWF runs four times a day
const STALE_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days
const DAYS = 10;                           // forecast frames after today's

export async function onRequestGet({ request, env, waitUntil }) {
  const hemi = new URL(request.url).searchParams.get('hemi') === 's' ? 's' : 'n';
  const sign = hemi === 'n' ? 1 : -1;
  const now  = new Date();
  const slot = `${now.toISOString().slice(0, 10)}_${Math.floor(now.getUTCHours() / 6)}`;
  const cacheKey = `polar_vortex_map_v3_${hemi}_${slot}`;
  const staleKey = `polar_vortex_map_v3_${hemi}_stale`;

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
      hourly: 'wind_speed_10hPa,wind_direction_10hPa,geopotential_height_10hPa,temperature_10hPa',
      wind_speed_unit: 'ms',
      forecast_days: String(DAYS + 1),
      temporal_resolution: 'hourly_6',
      timezone: 'GMT',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let upstream;
    try {
      upstream = await fetch(API, { method: 'POST', body, signal: controller.signal });
    } catch (err) {
      // Open-Meteo slows responses (rather than refusing) once the per-minute budget is spent
      return staleOrErr(env, staleKey, err.name === 'AbortError' ? 'Open-Meteo took too long to respond' : err.message);
    } finally { clearTimeout(timer); }
    if (!upstream.ok) return staleOrErr(env, staleKey, `Open-Meteo returned HTTP ${upstream.status}`);

    const points = await upstream.json();
    if (!Array.isArray(points) || points.length !== qLat.length) {
      return staleOrErr(env, staleKey, 'Unexpected response from Open-Meteo');
    }

    // Frames: the 6-hourly step at or before now, then every 4 steps (24 h)
    const times = points[0].hourly.time;
    const nowIso = now.toISOString().slice(0, 13);
    let first = 0;
    while (first + 1 < times.length && times[first + 1] <= nowIso) first++;
    const steps = [];
    for (let i = first; i < times.length && steps.length <= DAYS; i += 4) steps.push(i);

    const frames = [];
    for (const i of steps) {
      // Resample each reduced row onto 72 regular columns (linear in longitude, wrapping)
      const u = [], v = [], z = [], t = [];
      let offset = 0;
      for (let r = 0; r < LATS.length; r++) {
        const n = rows[r];
        const ru = [], rv = [], rz = [], rt = [];
        for (let k = 0; k < n; k++) {
          const h = points[offset + k].hourly;
          const s = h.wind_speed_10hPa[i], d = h.wind_direction_10hPa[i] * Math.PI / 180;
          if (s == null || d == null || h.geopotential_height_10hPa[i] == null || h.temperature_10hPa[i] == null) {
            return staleOrErr(env, staleKey, 'Missing values in Open-Meteo response');
          }
          // Meteorological direction is where the wind blows FROM
          ru.push(-s * Math.sin(d));
          rv.push(-s * Math.cos(d));
          rz.push(h.geopotential_height_10hPa[i]);
          rt.push(h.temperature_10hPa[i]);
        }
        offset += n;
        for (let j = 0; j < WIDTH; j++) {
          const pos = (j * STEP) / (360 / n);
          const k0 = Math.floor(pos) % n, k1 = (k0 + 1) % n, f = pos - Math.floor(pos);
          u.push(round1(ru[k0] + (ru[k1] - ru[k0]) * f));
          v.push(round1(rv[k0] + (rv[k1] - rv[k0]) * f));
          z.push(Math.round(rz[k0] + (rz[k1] - rz[k0]) * f));
          t.push(round1(rt[k0] + (rt[k1] - rt[k0]) * f));
        }
      }
      frames.push({ time: times[i] + 'Z', u, v, z, t });
    }

    const out = JSON.stringify({
      hemi, latMin: LATS[0], step: STEP, width: WIDTH, height: LATS.length, frames,
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
