// Polar Sea Ice Coverage — NSIDC Sea Ice Index G02135 v3.0

let seaIceCharts = {};

function seaIceColor(anomaly) {
  // Negative anomaly (less ice than baseline) → warm orange/red
  // Positive anomaly (more ice than baseline) → cool blue
  const t = Math.max(-1, Math.min(1, anomaly / 2));
  if (t <= 0) {
    // below baseline: blue → white
    const f = -t;
    const r = Math.round(56 + 199 * (1 - f));
    const g = Math.round(189 + 66 * (1 - f));
    const b = 248;
    return `rgba(${r},${g},${b},${(0.5 + f * 0.45).toFixed(2)})`;
  } else {
    // above baseline: white → orange
    const r = 255;
    const g = Math.round(255 - 150 * t);
    const b = Math.round(255 - 200 * t);
    return `rgba(${r},${g},${b},${(0.5 + t * 0.45).toFixed(2)})`;
  }
}

function renderPoleChart(pole, data, canvasId, title) {
  const { years, extents, anomalies, baseline } = data;
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  if (seaIceCharts[canvasId]) {
    seaIceCharts[canvasId].destroy();
    delete seaIceCharts[canvasId];
  }

  const baselineArr = years.map(() => baseline);

  seaIceCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Extent',
          data: extents,
          backgroundColor: anomalies.map(a => seaIceColor(a)),
          borderWidth: 0,
          barPercentage: 0.95,
          categoryPercentage: 0.98,
          order: 2,
        },
        {
          label: '1981–2010 baseline',
          data: baselineArr,
          type: 'line',
          borderColor: 'rgba(251,146,60,0.85)',
          borderDash: [6, 4],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            autoSkip: false,
            callback: (_, i) => years[i] % 5 === 0 ? years[i] : '',
            font: { size: 10 },
          },
        },
        y: {
          grid: { color: 'rgba(30,36,51,0.7)' },
          ticks: { callback: v => v.toFixed(1) + ' M km²' },
          grace: '8%',
          title: {
            display: true,
            text: 'Million km²',
            color: 'var(--text-muted)',
            font: { size: 10 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `${title} ${items[0].label}`,
            label: ctx => {
              if (ctx.dataset.label === '1981–2010 baseline') {
                return `Baseline: ${ctx.parsed.y.toFixed(2)} M km²`;
              }
              const anom = anomalies[ctx.dataIndex];
              const sign = anom >= 0 ? '+' : '';
              return `Extent: ${ctx.parsed.y.toFixed(2)} M km²  (${sign}${anom.toFixed(2)} vs baseline)`;
            },
          },
          backgroundColor: 'rgba(14,18,28,0.95)',
          titleFont: { family: "'DM Mono', monospace", size: 11 },
          bodyFont: { family: "'DM Mono', monospace", size: 11 },
          padding: 12,
          borderColor: 'rgba(30,36,51,0.9)',
          borderWidth: 1,
        },
      },
    },
  });
}

function renderPoleStats(data, rowId, lastLabel, anomalyLabel) {
  const {
    lastYear, lastExtent, lastAnomaly,
    recordLowExtent, recordLowYear,
    baseline,
  } = data;

  const sign = v => v > 0 ? '+' : '';

  document.getElementById(rowId).innerHTML = `
    <div class="climate-stat-card">
      <div class="climate-stat-label">${lastLabel}</div>
      <div class="climate-stat-value" style="color:var(--text-primary)">${lastExtent?.toFixed(2)}<span class="climate-stat-unit"> M km²</span></div>
      <div class="climate-stat-note">${lastYear}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">${anomalyLabel}</div>
      <div class="climate-stat-value" style="color:${lastAnomaly < 0 ? '#fb923c' : '#38bdf8'}">${sign(lastAnomaly)}${lastAnomaly?.toFixed(2)}<span class="climate-stat-unit"> M km²</span></div>
      <div class="climate-stat-note">vs 1981–2010 baseline</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Record Low</div>
      <div class="climate-stat-value" style="color:#ef4444">${recordLowExtent?.toFixed(2)}<span class="climate-stat-unit"> M km²</span></div>
      <div class="climate-stat-note">${recordLowYear}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">1981–2010 Baseline</div>
      <div class="climate-stat-value" style="color:var(--text-secondary)">${baseline?.toFixed(2)}<span class="climate-stat-unit"> M km²</span></div>
      <div class="climate-stat-note">WMO reference period</div>
    </div>`;
}

// ── Polar Leaflet Maps ────────────────────────────────────────────────────────

// Minimal binary parser for ESRI Polyline shapefiles (type 3).
// Returns array of coordinate rings: [ [[x,y], ...], ... ]
function parsePolylineShp(buffer) {
  const view  = new DataView(buffer);
  const rings = [];
  let offset  = 100; // skip 100-byte file header
  while (offset + 8 <= buffer.byteLength) {
    const contentLen = view.getInt32(offset + 4, false) * 2; // BE words → bytes
    offset += 8;
    if (offset + contentLen > buffer.byteLength) break;
    const shapeType = view.getInt32(offset, true);
    if (shapeType === 3 || shapeType === 5) {
      let p = offset + 4 + 32; // skip type (4) + bbox (32)
      const numParts  = view.getInt32(p, true); p += 4;
      const numPoints = view.getInt32(p, true); p += 4;
      const parts = Array.from({ length: numParts }, () => { const v = view.getInt32(p, true); p += 4; return v; });
      const pts   = Array.from({ length: numPoints }, () => {
        const x = view.getFloat64(p, true); p += 8;
        const y = view.getFloat64(p, true); p += 8;
        return [x, y];
      });
      for (let i = 0; i < numParts; i++) {
        rings.push(pts.slice(parts[i], i + 1 < numParts ? parts[i + 1] : numPoints));
      }
    }
    offset += contentLen;
  }
  return rings;
}

// target = map or featureGroup so median line always renders on top
async function loadMedianLine(target, pole, month) {
  const url = `/api/sea-ice-median?pole=${pole}&month=${month}`;
  try {
    const buf    = await (await fetch(url)).arrayBuffer();
    const zip    = await JSZip.loadAsync(buf);
    const shpKey = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.shp'));
    const shpBuf = await zip.files[shpKey].async('arraybuffer');
    const rings  = parsePolylineShp(shpBuf);

    const isProjected = rings.some(r => r.some(([x]) => Math.abs(x) > 180));
    const nsidc = pole === 'arctic'
      ? '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +a=6371228 +b=6371228 +units=m +no_defs'
      : '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=6371228 +b=6371228 +units=m +no_defs';

    rings.forEach(ring => {
      const latlngs = ring.map(([x, y]) => {
        if (isProjected) {
          const [lng, lat] = proj4(nsidc, 'WGS84', [x, y]);
          return [lat, lng];
        }
        return [y, x];
      });
      L.polyline(latlngs, { color: '#fb923c', weight: 2.5, opacity: 0.9 }).addTo(target);
    });
  } catch (err) {
    console.warn('Could not load median extent:', err);
  }
}

const _polarMaps = {};

function initPolarLeafletMap({ mapId, crsCode, crsProj4, center, pole, month, minYear = 1979, maxYear = 2024 }) {
  if (_polarMaps[mapId]) return;
  const mapEl = document.getElementById(mapId);
  if (!mapEl || !window.L?.Proj) return;

  const R   = 4194304;
  const crs = new L.Proj.CRS(crsCode, crsProj4, {
    origin:      [-R, R],
    resolutions: [8192, 4096, 2048, 1024, 512, 256, 128],
    bounds:      L.bounds(L.point(-R, -R), L.point(R, R)),
  });

  const map = L.map(mapId, {
    crs, center, zoom: 0, minZoom: 0, maxZoom: 4,
    attributionControl: false, zoomControl: true,
  });
  _polarMaps[mapId] = map;

  const epsgId = crsCode.replace(':', '').toLowerCase();

  // Static satellite basemap
  L.tileLayer(
    `https://gibs.earthdata.nasa.gov/wmts/${epsgId}/best/BlueMarble_NextGeneration/default/2004-01-01/500m/{z}/{y}/{x}.jpg`,
    { tileSize: 512, noWrap: true }
  ).addTo(map);

  // Median extent polylines go into a featureGroup so they can be brought to front
  const medianGroup = L.featureGroup().addTo(map);
  loadMedianLine(medianGroup, pole, month);

  // ── Year slider + GIBS sea ice overlay with crossfade ────────────────────
  let iceLayer        = null;
  let currentYear     = maxYear;
  const pendingLayers = new Set();

  function gibsIceUrl(year) {
    const mm  = String(month).padStart(2, '0');
    return `https://gibs.earthdata.nasa.gov/wmts/${epsgId}/best/SSMIS_Sea_Ice_Concentration/default/${year}-${mm}-01/1km/{z}/{y}/{x}.png`;
  }

  function setYear(year, onComplete) {
    currentYear = year;

    // Cancel all previously pending (not yet shown) layers
    pendingLayers.forEach(l => { map.removeLayer(l); });
    pendingLayers.clear();

    const newLayer = L.tileLayer(gibsIceUrl(year), { tileSize: 512, noWrap: true, opacity: 0 }).addTo(map);
    pendingLayers.add(newLayer);

    const activate = () => {
      if (!pendingLayers.has(newLayer)) return; // superseded
      pendingLayers.delete(newLayer);

      const oldLayer = iceLayer;
      iceLayer = newLayer;

      const t0  = performance.now();
      const dur = 400;
      const step = now => {
        const t = Math.min((now - t0) / dur, 1);
        newLayer.setOpacity(t * 0.9);
        if (oldLayer) oldLayer.setOpacity((1 - t) * 0.9);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          if (oldLayer) map.removeLayer(oldLayer);
          medianGroup.bringToFront();
          // Minimum display time before signalling completion during playback
          setTimeout(() => { if (onComplete) onComplete(); }, 250);
        }
      };
      requestAnimationFrame(step);
    };

    let activated = false;
    const safeActivate = () => { if (!activated) { activated = true; activate(); } };
    newLayer.once('load', safeActivate);
    setTimeout(safeActivate, 1800); // fallback if tiles stall

    const slEl = document.getElementById(mapId + 'Slider');
    const yrEl = document.getElementById(mapId + 'Year');
    if (slEl) { slEl.value = year; updateSliderFill(slEl); }
    if (yrEl) yrEl.textContent = year;
  }

  const sliderEl = document.getElementById(mapId + 'Slider');
  if (sliderEl) {
    sliderEl.min   = minYear;
    sliderEl.max   = maxYear;
    sliderEl.value = maxYear;
    updateSliderFill(sliderEl);
    sliderEl.addEventListener('input', () => { updateSliderFill(sliderEl); setYear(+sliderEl.value); });
  }

  let isPlaying = false;
  const playBtn = document.getElementById(mapId + 'PlayBtn');

  function scheduleNext() {
    if (!isPlaying) return;
    if (currentYear >= maxYear) {
      isPlaying = false;
      playBtn.innerHTML = '&#9654; Play';
      return;
    }
    setYear(currentYear + 1, scheduleNext);
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (isPlaying) {
        isPlaying = false;
        playBtn.innerHTML = '&#9654; Play';
      } else {
        isPlaying = true;
        if (currentYear >= maxYear) setYear(minYear);
        playBtn.innerHTML = '&#9646;&#9646; Pause';
        scheduleNext();
      }
    });
  }

  // ── Live (CMEMS current) overlay ─────────────────────────────────────────
  // Fetches the latest OSI-SAF ice concentration via the /api/cmems-wms proxy.
  // TIME defaults to yesterday to ensure data exists (CMEMS has ~1-day lag).
  let liveLayer   = null;
  let liveActive  = false;

  // ── Canvas reprojection layer ─────────────────────────────────────────────
  // Fetches 4 WMTS tiles (WorldCRS84Quad zoom 1) from /api/sea-ice-live and
  // reprojects pixel-by-pixel to the polar CRS using containerPointToLatLng.
  // Zoom 1: 4 cols × 2 rows, each tile 90°×90° at 256×256px.
  // Arctic uses row 0 (90°N→0°), Antarctic uses row 1 (0°→90°S).
  function buildLiveLayer() {
    let cvs        = null;
    const tiles    = {};   // col (0-3) → { data: Uint8ClampedArray }
    let loadCount  = 0;
    let errCount   = 0;
    const latMin   = pole === 'arctic' ?  55 : -90;
    const latMax   = pole === 'arctic' ?  90 : -55;
    const tileRow  = pole === 'arctic' ?   0 :   1;
    const tileLatMax = tileRow === 0 ? 90 : 0; // top latitude of this row

    function render() {
      if (!cvs || loadCount < 4) return;
      const size = map.getSize();
      cvs.width  = size.x;
      cvs.height = size.y;
      const ctx = cvs.getContext('2d');
      const out = ctx.createImageData(size.x, size.y);
      const d   = out.data;

      for (let py = 0; py < size.y; py++) {
        for (let px = 0; px < size.x; px++) {
          const ll  = map.containerPointToLatLng([px, py]);
          const lat = ll.lat, lng = ll.lng;
          if (lat < latMin || lat > latMax) continue;

          let col = Math.floor((lng + 180) / 90); // 0–3
          if (col < 0) col = 0; else if (col > 3) col = 3;
          const tile = tiles[col];
          if (!tile) continue;

          const tx = Math.floor((lng - (-180 + col * 90)) / 90 * 256);
          const ty = Math.floor((tileLatMax - lat) / 90 * 256);
          if (tx < 0 || tx >= 256 || ty < 0 || ty >= 256) continue;

          const si = (ty * 256 + tx) * 4;
          const oi = (py * size.x + px) * 4;
          d[oi] = tile[si]; d[oi+1] = tile[si+1]; d[oi+2] = tile[si+2]; d[oi+3] = tile[si+3];
        }
      }
      ctx.putImageData(out, 0, 0);
      L.DomUtil.setPosition(cvs, map.containerPointToLayerPoint([0, 0]));
    }

    function loadTile(col) {
      fetch(`/api/sea-ice-live?pole=${pole}&z=1&row=${tileRow}&col=${col}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
        .then(blob => createImageBitmap(blob))
        .then(bm => {
          const c = document.createElement('canvas');
          c.width = bm.width; c.height = bm.height;
          c.getContext('2d').drawImage(bm, 0, 0);
          tiles[col] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          loadCount++;
          if (loadCount === 4) { render(); medianGroup.bringToFront(); }
        })
        .catch(e => {
          console.warn(`LiveIceLayer col=${col}:`, e);
          errCount++;
          loadCount++;
          if (errCount === 4) {
            // All tiles failed — revert to historical view and show the error
            disableLive();
            if (liveBtn) liveBtn.classList.remove('active');
            const yrEl = document.getElementById(mapId + 'Year');
            if (yrEl) yrEl.textContent = 'Live unavailable';
            setTimeout(() => { if (yrEl) yrEl.textContent = currentYear; }, 3000);
          }
        });
    }

    const LayerClass = L.Layer.extend({
      onAdd() {
        cvs = L.DomUtil.create('canvas');
        Object.assign(cvs.style, { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' });
        map.getPanes().overlayPane.appendChild(cvs);
        map.on('moveend zoomend resize', render);
        for (let c = 0; c < 4; c++) loadTile(c);
      },
      onRemove() {
        if (cvs) { cvs.remove(); cvs = null; }
        map.off('moveend zoomend resize', render);
      },
    });

    return new LayerClass();
  }

  function enableLive() {
    liveActive = true;
    // Hide the historical GIBS layer
    pendingLayers.forEach(l => map.removeLayer(l));
    pendingLayers.clear();
    if (iceLayer) { iceLayer.setOpacity(0); }

    liveLayer = buildLiveLayer();
    liveLayer.addTo(map);
    medianGroup.bringToFront();

    const yrEl = document.getElementById(mapId + 'Year');
    if (yrEl) yrEl.textContent = 'Live';
  }

  function disableLive() {
    liveActive = false;
    if (liveLayer) { map.removeLayer(liveLayer); liveLayer = null; }
    if (iceLayer) iceLayer.setOpacity(0.9);
    const yrEl = document.getElementById(mapId + 'Year');
    if (yrEl) yrEl.textContent = currentYear;
  }

  const liveBtn = document.getElementById(mapId + 'LiveBtn');
  if (liveBtn) {
    liveBtn.addEventListener('click', () => {
      if (liveActive) {
        disableLive();
        liveBtn.classList.remove('active');
      } else {
        // Pause playback if running
        if (isPlaying) { isPlaying = false; playBtn.innerHTML = '&#9654; Play'; }
        enableLive();
        liveBtn.classList.add('active');
      }
    });
  }

  // Disable live mode when the slider is touched
  if (sliderEl) {
    sliderEl.addEventListener('mousedown', () => {
      if (liveActive) { disableLive(); if (liveBtn) liveBtn.classList.remove('active'); }
    });
  }

  setYear(maxYear);
  setTimeout(() => { map.invalidateSize(); }, 150);
}

async function loadSeaIceData() {
  const arcticStatus    = document.getElementById('arcticIceStatus');
  const antarcticStatus = document.getElementById('antarcticIceStatus');

  try {
    const res  = await fetch('/api/sea-ice');
    const json = await res.json();
    if (json.error) throw new Error(json.error);

    if (arcticStatus)    arcticStatus.style.display    = 'none';
    if (antarcticStatus) antarcticStatus.style.display = 'none';

    renderPoleStats(json.arctic,    'arcticStatsRow',    'Latest Extent', 'Latest Anomaly');
    renderPoleStats(json.antarctic, 'antarcticStatsRow', 'Latest Extent', 'Latest Anomaly');
    renderPoleChart('arctic',    json.arctic,    'arcticIceChart',    'Arctic September');
    renderPoleChart('antarctic', json.antarctic, 'antarcticIceChart', 'Antarctic February');

    // GIBS SSMIS tiles end at 2021; cap the map slider there so the
    // default historical view always loads. LIVE mode covers anything newer.
    const GIBS_LAST_YEAR = 2020;
    const arcticMax    = Math.min(json.arctic.lastYear    ?? GIBS_LAST_YEAR, GIBS_LAST_YEAR);
    const antarcticMax = Math.min(json.antarctic.lastYear ?? GIBS_LAST_YEAR, GIBS_LAST_YEAR);

    initPolarLeafletMap({
      mapId: 'arcticLeafletMap',
      crsCode: 'EPSG:3413',
      crsProj4: '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
      center: [90, 0], pole: 'arctic', month: 9,
      minYear: 1979, maxYear: arcticMax,
    });
    initPolarLeafletMap({
      mapId: 'antarcticLeafletMap',
      crsCode: 'EPSG:3031',
      crsProj4: '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
      center: [-90, 0], pole: 'antarctic', month: 2,
      minYear: 1979, maxYear: antarcticMax,
    });

  } catch (err) {
    const msg = `<div style="font-family:'DM Mono',monospace;font-size:11px;letter-spacing:1px;color:var(--text-muted);text-align:center;padding:40px">Could not load sea ice data: ${err.message}</div>`;
    if (arcticStatus)    arcticStatus.outerHTML = msg;
    if (antarcticStatus) antarcticStatus.outerHTML = msg;
  }
}
