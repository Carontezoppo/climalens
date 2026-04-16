// Sea Surface Temperature map — NASA GIBS / GHRSST MUR L4

let sstMap = null, sstLayerA = null, sstLayerB = null, sstActiveSide = 'A', sstMonths = [];
let sstPlaying = false;
const SST_MIN_FRAME_MS = 700; // minimum ms a frame stays visible

function buildSSTMonths() {
  const months = [];
  let y = 2003, m = 1;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  while (new Date(y, m - 1, 1) <= cutoff) {
    months.push(`${y}-${String(m).padStart(2,'0')}-15`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

function sstDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { month:'long', year:'numeric' });
}

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

function sstGetActive() { return sstActiveSide === 'A' ? sstLayerA : sstLayerB; }
function sstGetBuffer() { return sstActiveSide === 'A' ? sstLayerB : sstLayerA; }
function sstSwapLayers() {
  sstGetActive().setOpacity(0);
  sstGetBuffer().setOpacity(0.82);
  sstActiveSide = sstActiveSide === 'A' ? 'B' : 'A';
}

function initSSTMap() {
  if (!window.L || sstMap) return; // prevent double-init
  sstMonths = buildSSTMonths();
  if (!sstMonths.length) return;

  sstMap = L.map('sstMap', {
    center: [0, 0], zoom: 2, minZoom: 2, maxZoom: 6,
    zoomSnap: 0, worldCopyJump: false, attributionControl: true,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0
  });

  const latestDate = sstMonths[sstMonths.length - 1];

  // Single full-world WMS image per date — no tiles, no seams.
  // GIBS EPSG:3857 square world extent: ±20037508.34 m in both axes.
  const SST_IMG_BOUNDS = [[-85.051, -180], [85.051, 180]];
  const SST_IMG_BBOX = '-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244';
  function sstImageUrl(date) {
    return `${GIBS_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=GHRSST_L4_MUR_Sea_Surface_Temperature` +
      `&FORMAT=image%2Fpng&TRANSPARENT=TRUE` +
      `&CRS=EPSG%3A3857&BBOX=${SST_IMG_BBOX}` +
      `&WIDTH=2048&HEIGHT=2048&TIME=${date}`;
  }

  // Double-buffered: layerA = visible, layerB = preloading (opacity 0)
  sstLayerA = L.imageOverlay(sstImageUrl(latestDate), SST_IMG_BOUNDS, { opacity: 0.82 }).addTo(sstMap);
  sstLayerB = L.imageOverlay(sstImageUrl(latestDate), SST_IMG_BOUNDS, { opacity: 0 }).addTo(sstMap);

  // Land overlay: sits above SST tiles so continents show in --bg-card with a
  // light coastline stroke instead of the base layer's black fill.
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')
    .then(r => r.json())
    .then(topo => {
      // Land colour comes from the Leaflet background (#141821) showing through
      // the SST image's naturally transparent land pixels — no fill polygon needed.
      // Only draw the coastline strokes, split at the antimeridian to prevent
      // the ±180° crossing artefact (the horizontal band across the map).
      const raw = topojson.mesh(topo, topo.objects.land);
      const lines = [];
      raw.coordinates.forEach(line => {
        let seg = [line[0]];
        for (let i = 1; i < line.length; i++) {
          if (Math.abs(line[i][0] - line[i - 1][0]) > 180) {
            if (seg.length > 1) lines.push(seg);
            seg = [line[i]];
          } else {
            seg.push(line[i]);
          }
        }
        if (seg.length > 1) lines.push(seg);
      });
      L.geoJSON(
        { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines }, properties: {} },
        { style: { fill: false, color: 'rgba(255,255,255,0.28)', weight: 1.2, opacity: 1 }, interactive: false }
      ).addTo(sstMap);
    });

  // Force Leaflet to recalculate container size, then set a CSS-cover zoom:
  // world pixel width (256 * 2^z) fills the container — no gaps, no tile repetition
  setTimeout(() => {
    if (sstMap) {
      sstMap.invalidateSize();
      const w = sstMap.getContainer().offsetWidth;
      const h = sstMap.getContainer().offsetHeight;
      const coverZoom = Math.log2(Math.max(w, h) / 256);
      sstMap.setView([0, 0], Math.max(2, coverZoom));
    }
  }, 200);

  // Slider
  const slider = document.getElementById('sstSlider');
  slider.max = sstMonths.length - 1;
  slider.value = sstMonths.length - 1;

  // Tick labels — show ~6 year labels evenly spaced
  const tickRow = document.getElementById('sstTickRow');
  const step = Math.floor(sstMonths.length / 6);
  let tickHtml = '';
  for (let i = 0; i < sstMonths.length; i += step) {
    const pct = (i / (sstMonths.length - 1)) * 100;
    tickHtml += `<span style="position:absolute;left:${pct}%;transform:translateX(-50%)">${sstMonths[i].slice(0,4)}</span>`;
  }
  tickRow.style.position = 'relative';
  tickRow.style.height = '16px';
  tickRow.innerHTML = tickHtml;

  // Update date display
  const dateDisplay = document.getElementById('sstDateDisplay');
  dateDisplay.textContent = sstDateLabel(latestDate);

  // ---- Double-buffer frame loader ----
  // Loads `idx` into the hidden buffer layer; swaps when all tiles are ready.
  // Respects SST_MIN_FRAME_MS so fast tiles still linger long enough to read.
  let sstScrubTimer = null;
  function sstLoadFrame(idx, onSwapped) {
    if (!sstLayerA || !sstLayerB) return;
    const buffer = sstGetBuffer();
    const frameStart = Date.now();
    let done = false;

    buffer.off('load');
    const imgEl = buffer.getElement();
    if (imgEl) imgEl.onerror = null;

    function doSwap() {
      if (done) return;
      done = true;
      buffer.off('load');
      sstSwapLayers();
      slider.value = idx;
      dateDisplay.textContent = sstDateLabel(sstMonths[idx]);
      if (onSwapped) onSwapped(idx);
    }

    buffer.on('load', () => {
      const wait = Math.max(0, SST_MIN_FRAME_MS - (Date.now() - frameStart));
      setTimeout(doSwap, wait);
    });

    buffer.setUrl(sstImageUrl(sstMonths[idx]));
    // Fallback: if the image errors, don't stall the animation
    const imgAfter = buffer.getElement();
    if (imgAfter) imgAfter.onerror = () => setTimeout(doSwap, SST_MIN_FRAME_MS);
  }

  slider.addEventListener('input', () => {
    const idx = parseInt(slider.value);
    dateDisplay.textContent = sstDateLabel(sstMonths[idx]);
    clearTimeout(sstScrubTimer);
    sstScrubTimer = setTimeout(() => sstLoadFrame(idx), 150);
  });

  // Play / pause — self-scheduling: each frame triggers the next after its swap
  const playBtn = document.getElementById('sstPlayBtn');

  function sstStopPlay() {
    sstPlaying = false;
    playBtn.textContent = '▶ Play';
    playBtn.classList.remove('playing');
  }

  function sstNextFrame(idx) {
    if (!sstPlaying) return;
    const nextIdx = (idx + 1) % sstMonths.length;
    sstLoadFrame(nextIdx, sstNextFrame);
  }

  playBtn.addEventListener('click', () => {
    if (sstPlaying) {
      sstStopPlay();
    } else {
      sstPlaying = true;
      playBtn.textContent = '⏸ Pause';
      playBtn.classList.add('playing');
      sstNextFrame(parseInt(slider.value));
    }
  });

  // ---- Hover tooltip: live SST + anomaly vs 2003 baseline ----
  // Uses Open-Meteo Marine API — browser-native CORS, no key, ERA5 reanalysis back to 1940.
  const sstTip = document.createElement('div');
  sstTip.className = 'sst-tooltip';
  sstMap.getContainer().appendChild(sstTip);

  const sstCurCache = new Map(); // "dateStr_bucket" → °C | null
  const sstBlCache  = new Map(); // "blDate_bucket"  → °C | null
  let sstHoverTimer = null, sstHoverLL = null;

  // 0.25° buckets — matches Open-Meteo/ERA5 native grid, keeps cache efficient
  function sstBucket(lat, lng) {
    return `${(Math.round(lat * 4) / 4).toFixed(2)}_${(Math.round(lng * 4) / 4).toFixed(2)}`;
  }

  function sstFmtCoord(lat, lng) {
    const la = `${Math.abs(lat).toFixed(1)}°\u202f${lat >= 0 ? 'N' : 'S'}`;
    const lo = `${Math.abs(lng).toFixed(1)}°\u202f${lng >= 0 ? 'E' : 'W'}`;
    return `${la}\u2002${lo}`;
  }

  // Open-Meteo Marine API — returns hourly SST for one day; we take the noon value
  function sstOpenMeteoUrl(lat, lng, dateStr) {
    const d = dateStr.slice(0, 10); // YYYY-MM-DD
    return `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&hourly=sea_surface_temperature&start_date=${d}&end_date=${d}&timezone=UTC`;
  }

  // Parse Open-Meteo Marine JSON → °C (already Celsius, ERA5 reanalysis)
  function sstParseOpenMeteo(data) {
    try {
      if (!data.hourly) return null;
      const temps = data.hourly.sea_surface_temperature;
      // Prefer noon UTC (index 12), fall back to first non-null value
      const val = (temps[12] != null) ? temps[12] : temps.find(t => t != null);
      return val != null ? +parseFloat(val).toFixed(2) : null;
    } catch { return null; }
  }

  function sstRenderTip(ll, temp, base, loading) {
    let h = `<div class="sst-tt-coord">${sstFmtCoord(ll.lat, ll.lng)}</div>`;
    if (loading) {
      h += `<div class="sst-tt-info">loading\u2026</div>`;
    } else if (temp == null) {
      h += `<div class="sst-tt-info">no data at this point</div>`;
    } else {
      h += `<div class="sst-tt-temp">${temp.toFixed(1)}<span class="sst-tt-unit">\u202f°C</span></div>`;
      if (base === undefined) {
        h += `<div class="sst-tt-info">loading baseline\u2026</div>`;
      } else if (base != null) {
        const d = temp - base, s = d >= 0 ? '+' : '';
        h += `<div class="sst-tt-delta ${d >= 0 ? 'pos' : 'neg'}">${s}${d.toFixed(1)}°C vs 2003 ref</div>`;
      }
    }
    sstTip.innerHTML = h;
  }

  function sstMoveTip(cp) {
    const mw = sstMap.getSize().x, off = 14, tw = 168;
    const x = (cp.x + off + tw > mw) ? cp.x - tw - off : cp.x + off;
    sstTip.style.left = x + 'px';
    sstTip.style.top  = Math.max(0, cp.y - 24) + 'px';
  }

  sstMap.on('mousemove', (e) => {
    sstHoverLL = e.latlng;
    sstTip.style.display = 'block';
    sstMoveTip(e.containerPoint);
    clearTimeout(sstHoverTimer);
    sstHoverTimer = setTimeout(async () => {
      const ll      = sstHoverLL;
      const dateStr = sstMonths[parseInt(slider.value)];
      const bucket  = sstBucket(ll.lat, ll.lng);
      const blDate  = `2003-${dateStr.slice(5, 7)}-15`; // same calendar month in 2003
      const curKey  = `${dateStr}_${bucket}`;
      const blKey   = `${blDate}_${bucket}`;

      let temp = sstCurCache.has(curKey) ? sstCurCache.get(curKey) : undefined;
      let base = sstBlCache.has(blKey)   ? sstBlCache.get(blKey)   : undefined;

      if (temp !== undefined && base !== undefined) {
        sstRenderTip(ll, temp, base, false); return;
      }

      sstRenderTip(ll, temp ?? null, base, temp === undefined);

      const fx = [];
      if (temp === undefined) fx.push(
        fetch(sstOpenMeteoUrl(ll.lat, ll.lng, dateStr))
          .then(r => r.json())
          .then(d => { temp = sstParseOpenMeteo(d); sstCurCache.set(curKey, temp); })
          .catch(() => { temp = null; sstCurCache.set(curKey, null); })
      );
      if (base === undefined) fx.push(
        fetch(sstOpenMeteoUrl(ll.lat, ll.lng, blDate))
          .then(r => r.json())
          .then(d => { base = sstParseOpenMeteo(d); sstBlCache.set(blKey, base); })
          .catch(() => { base = null; sstBlCache.set(blKey, null); })
      );
      await Promise.all(fx);
      if (sstTip.style.display !== 'none') sstRenderTip(ll, temp, base, false);
    }, 350);
  });

  sstMap.on('mouseout', () => {
    clearTimeout(sstHoverTimer);
    sstTip.style.display = 'none';
  });
}

/* ========= OCEAN CURRENTS ========= */
