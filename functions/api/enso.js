/**
 * GET /api/enso
 *
 * Current state of the El Niño–Southern Oscillation, from two NOAA Climate
 * Prediction Center plain-text files:
 *
 *  - wksst9120.for — weekly OISST v2.1 SST anomalies for the Niño regions.
 *    Used for the headline value (freshest signal) and the sparkline.
 *  - oni.ascii.txt — Oceanic Niño Index, 3-month running mean of ERSSTv5
 *    Niño 3.4 anomalies. NOAA's official ENSO index, used for the phase label.
 *
 * Both use NOAA's 1991–2020 base period (not the site's usual 1981–2010) so
 * the values match NOAA's official ENSO status rather than drifting from it.
 *
 * Response: { weekly: [{date, anom}], latest: {date, sst, anom},
 *             oni: {season, year, value}, oniPrev: [{season, year, value}] }
 *
 * KV binding: CLIMATE_CACHE · TTL: 12 hours (weekly file updates on Mondays)
 */

const WEEKLY_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for';
const ONI_URL    = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
const CACHE_TTL  = 60 * 60 * 12; // 12 hours
const WEEKS_KEPT = 156;          // ~3 years for the sparkline

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                 JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

export async function onRequestGet({ env, waitUntil }) {
  try {
    const cacheKey = 'enso_v1';
    if (env.CLIMATE_CACHE) {
      const cached = await env.CLIMATE_CACHE.get(cacheKey);
      if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
    }

    const [wkRes, oniRes] = await Promise.all([fetch(WEEKLY_URL), fetch(ONI_URL)]);
    if (!wkRes.ok)  return json({ error: `NOAA CPC weekly SST returned HTTP ${wkRes.status}` }, 503);
    if (!oniRes.ok) return json({ error: `NOAA CPC ONI returned HTTP ${oniRes.status}` }, 503);

    // Weekly rows look like " 04NOV2026     27.0 5.6     29.5 4.4     30.1 3.3     30.1 1.5".
    // Negative anomalies are glued to the preceding SST ("20.6-0.1"), so extract
    // numbers by regex instead of splitting on whitespace.
    // Order: Niño1+2 SST, SSTA, Niño3 SST, SSTA, Niño3.4 SST, SSTA, Niño4 SST, SSTA.
    const weekly = [];
    for (const line of (await wkRes.text()).split('\n')) {
      const m = line.match(/^\s*(\d{2})([A-Z]{3})(\d{4})\s+(.*)$/);
      if (!m || !MONTHS[m[2]]) continue;
      const nums = m[4].match(/-?\d+\.\d+/g);
      if (!nums || nums.length < 8) continue;
      weekly.push({ date: `${m[3]}-${MONTHS[m[2]]}-${m[1]}`, sst: +nums[4], anom: +nums[5] });
    }

    // ONI rows look like "  ASO 2026  29.23   2.46"
    const oniRows = [];
    for (const line of (await oniRes.text()).split('\n')) {
      const m = line.match(/^\s*([A-Z]{3})\s+(\d{4})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/);
      if (m) oniRows.push({ season: m[1], year: +m[2], value: +m[4] });
    }

    if (!weekly.length || !oniRows.length) {
      return json({ error: 'Could not parse NOAA CPC ENSO files' }, 503);
    }

    const latest = weekly[weekly.length - 1];
    const body = JSON.stringify({
      weekly:  weekly.slice(-WEEKS_KEPT).map(({ date, anom }) => ({ date, anom })),
      latest,
      oni:     oniRows[oniRows.length - 1],
      oniPrev: oniRows.slice(-6, -1),
      baseline: '1991-2020',
    });

    if (env.CLIMATE_CACHE) {
      waitUntil(env.CLIMATE_CACHE.put(cacheKey, body, { expirationTtl: CACHE_TTL }));
    }
    return json(body, 200, { 'X-Cache': 'MISS' });

  } catch (err) {
    return json({ error: err.message }, 503);
  }
}

function json(body, status = 200, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
