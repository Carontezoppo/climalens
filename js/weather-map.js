// Windy weather map (iframe embed)

// WEATHER MAP
// ============================================================
let currentMapLayer = 'wind';
let mapVisible = true;

function buildWindyUrl(layer) {
  const { lat, lon } = currentLocation;
  const zoom = 6;
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=${zoom}&level=surface&overlay=${layer}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
}

function updateMap() {
  document.getElementById('windyFrame').src = buildWindyUrl(currentMapLayer);
}

function initMap() {
  // Layer buttons
  document.getElementById('mapLayerBar').addEventListener('click', e => {
    const btn = e.target.closest('.map-layer-btn');
    if (!btn) return;
    document.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMapLayer = btn.dataset.layer;
    updateMap();
  });

  // Toggle visibility
  document.getElementById('mapToggleBtn').addEventListener('click', () => {
    mapVisible = !mapVisible;
    const wrap = document.getElementById('mapWrap');
    const btn  = document.getElementById('mapToggleBtn');
    wrap.classList.toggle('collapsed', !mapVisible);
    btn.textContent = mapVisible ? 'Hide Map' : 'Show Map';
  });

  updateMap();
}
