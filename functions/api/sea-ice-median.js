/**
 * GET /api/sea-ice-median?pole=arctic&month=9
 * Proxies the NSIDC median-extent shapefile ZIP to avoid browser CORS restrictions.
 */
export async function onRequestGet({ request }) {
  const { searchParams } = new URL(request.url);
  const pole  = searchParams.get('pole')  || 'arctic';
  const month = searchParams.get('month') || '9';

  const dir    = pole === 'arctic' ? 'north' : 'south';
  const prefix = pole === 'arctic' ? 'N' : 'S';
  const mm     = String(month).padStart(2, '0');
  const src    = `https://noaadata.apps.nsidc.org/NOAA/G02135/${dir}/monthly/shapefiles/shp_median/median_extent_${prefix}_${mm}_1981-2010_polyline_v4.0.zip`;

  try {
    const res = await fetch(src, { headers: { 'User-Agent': 'MeteoScope/1.0' } });
    if (!res.ok) throw new Error(`NSIDC ${res.status}`);
    return new Response(res.body, {
      headers: {
        'Content-Type':                'application/zip',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=86400',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
