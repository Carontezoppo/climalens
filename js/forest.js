// Land cover globe — MODIS IGBP 2024 global composite · NASA GIBS

const LANDCOVER_GLOBE_YEAR = 2024;

function landCoverGlobeImageUrl() {
  return `/api/forest-wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual` +
    `&FORMAT=image%2Fpng&TRANSPARENT=FALSE` +
    `&CRS=EPSG%3A4326&BBOX=-90,-180,90,180` +
    `&WIDTH=4096&HEIGHT=2048&TIME=${LANDCOVER_GLOBE_YEAR}-01-01`;
}

let landcoverGlobe = null;

function initLandCoverGlobe() {
  if (!window.Globe || landcoverGlobe) return;

  const el = document.getElementById('landcoverGlobe');
  if (!el) return;

  landcoverGlobe = Globe()
    .globeImageUrl(landCoverGlobeImageUrl())
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#6366f1')
    .atmosphereAltitude(0.18)
    (el);

  landcoverGlobe.controls().autoRotate = true;
  landcoverGlobe.controls().autoRotateSpeed = 0.6;
  landcoverGlobe.pointOfView({ lat: 15, lng: 10, altitude: 2.2 });

  const resize = () => landcoverGlobe.width(el.offsetWidth).height(el.offsetHeight);
  window.addEventListener('resize', resize);
  setTimeout(resize, 0);

  const rotateBtn = document.getElementById('landcoverRotateBtn');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      const controls = landcoverGlobe.controls();
      controls.autoRotate = !controls.autoRotate;
      rotateBtn.innerHTML = controls.autoRotate ? '&#9646;&#9646; Pause' : '&#9654; Play';
      rotateBtn.classList.toggle('playing', controls.autoRotate);
      rotateBtn.setAttribute('aria-pressed', String(controls.autoRotate));
    });
  }
}

// Forest cover map — MODIS IGBP Land Cover 2001–2024 · NASA GIBS

const FOREST_YEAR_MIN = 2001;
const FOREST_YEAR_MAX = 2024;

const FOREST_YEARS = [];
for (let y = FOREST_YEAR_MIN; y <= FOREST_YEAR_MAX; y++) FOREST_YEARS.push(y);

let forestMap = null, forestLayerA = null, forestLayerB = null, forestActiveSide = 'A';
let forestCurrentYear = FOREST_YEAR_MAX;
let forestPlaying = false;

const FOREST_IMG_BOUNDS = [[-85.051, -180], [85.051, 180]];
const FOREST_IMG_BBOX   = '-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244';
const FRAME_MIN_MS      = 800;

function forestImageUrl(year) {
  return `/api/forest-wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual` +
    `&FORMAT=image%2Fpng&TRANSPARENT=FALSE` +
    `&CRS=EPSG%3A3857&BBOX=${FOREST_IMG_BBOX}` +
    `&WIDTH=4096&HEIGHT=4096&TIME=${year}-01-01`;
}

function forestSliderFill(el) {
  const pct = ((+el.value - +el.min) / (+el.max - +el.min)) * 100;
  el.style.background = `linear-gradient(to right,#6366f1 ${pct}%,#2a3148 ${pct}%)`;
}

function forestGetBuffer() { return forestActiveSide === 'A' ? forestLayerB : forestLayerA; }

function forestSwapLayers() {
  (forestActiveSide === 'A' ? forestLayerA : forestLayerB).setOpacity(0);
  (forestActiveSide === 'A' ? forestLayerB : forestLayerA).setOpacity(0.92);
  forestActiveSide = forestActiveSide === 'A' ? 'B' : 'A';
}

function initForestMap() {
  if (!window.L || forestMap) return;

  forestMap = L.map('forestMap', {
    center: [15, 10], zoom: 2, minZoom: 2, maxZoom: 6,
    zoomSnap: 0.5, worldCopyJump: false, attributionControl: true,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19, opacity: 0.6,
  }).addTo(forestMap);

  const latestUrl = forestImageUrl(FOREST_YEAR_MAX);
  forestLayerA = L.imageOverlay(latestUrl, FOREST_IMG_BOUNDS, { opacity: 0.92 }).addTo(forestMap);
  forestLayerB = L.imageOverlay(latestUrl, FOREST_IMG_BOUNDS, { opacity: 0   }).addTo(forestMap);

  const slider        = document.getElementById('forestSlider');
  const yearDisplay   = document.getElementById('forestYearDisplay');
  const playBtn       = document.getElementById('forestPlayBtn');
  const progressWrap  = document.getElementById('forestProgressWrap');
  const progressBar   = document.getElementById('forestProgressBar');
  const progressLabel = document.getElementById('forestProgressLabel');

  slider.min   = FOREST_YEAR_MIN;
  slider.max   = FOREST_YEAR_MAX;
  slider.value = FOREST_YEAR_MAX;
  slider.disabled  = true;
  playBtn.disabled = true;
  forestSliderFill(slider);
  yearDisplay.textContent = FOREST_YEAR_MAX;

  const tickRow   = document.getElementById('forestTickRow');
  const tickYears = [2001, 2004, 2007, 2010, 2013, 2016, 2019, 2024];
  let tickHtml = '';
  tickYears.forEach(y => {
    const pct = ((y - FOREST_YEAR_MIN) / (FOREST_YEAR_MAX - FOREST_YEAR_MIN)) * 100;
    tickHtml += `<span style="position:absolute;left:${pct}%;transform:translateX(-50%)">${y}</span>`;
  });
  tickRow.style.position = 'relative';
  tickRow.style.height   = '16px';
  tickRow.innerHTML      = tickHtml;

  // ---- Preload all years so playback hits browser cache ----
  let settled = 0;
  const total = FOREST_YEARS.length;

  FOREST_YEARS.forEach(year => {
    const img    = new Image();
    const finish = () => {
      settled++;
      const pct = Math.round((settled / total) * 100);
      progressBar.style.width = pct + '%';
      if (slider.disabled) progressLabel.textContent = `Loading ${pct}%`;
      if (settled === total) {
        progressWrap.querySelector('.forest-progress-bg').style.display = 'none';
        progressLabel.textContent = '✓ Animation loaded';
        progressLabel.classList.add('map-loaded-badge');
        playBtn.disabled = false;
      }
    };
    img.onload  = finish;
    img.onerror = finish; // don't stall if one year fails
    img.src = forestImageUrl(year);
  });

  // Unlock slider as soon as the initial frame is visible — play waits for all frames
  forestLayerA.on('load', function onInitialLoad() {
    forestLayerA.off('load', onInitialLoad);
    slider.disabled = false;
    progressLabel.textContent = 'Loading remaining frames…';
  });

  // ---- Double-buffer frame loader (same pattern as SST) ----
  function forestLoadFrame(year, onSwapped) {
    const buffer     = forestGetBuffer();
    const frameStart = Date.now();
    let done         = false;

    buffer.off('load');
    const imgEl = buffer.getElement();
    if (imgEl) imgEl.onerror = null;

    function doSwap() {
      if (done) return;
      done = true;
      buffer.off('load');
      forestSwapLayers();
      slider.value = year;
      forestSliderFill(slider);
      yearDisplay.textContent = year;
      forestCurrentYear       = year;
      if (onSwapped) onSwapped(year);
    }

    buffer.on('load', () => {
      const wait = Math.max(0, FRAME_MIN_MS - (Date.now() - frameStart));
      setTimeout(doSwap, wait);
    });

    buffer.setUrl(forestImageUrl(year));
    const imgAfter = buffer.getElement();
    if (imgAfter) imgAfter.onerror = () => setTimeout(doSwap, FRAME_MIN_MS);
  }

  // ---- Slider scrubbing ----
  let scrubTimer = null;
  slider.addEventListener('input', () => {
    const year = parseInt(slider.value);
    forestSliderFill(slider);
    yearDisplay.textContent = year;
    forestCurrentYear       = year;
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => forestLoadFrame(year, null), 150);
  });

  // ---- Play / pause ----
  function stopPlay() {
    forestPlaying = false;
    playBtn.innerHTML = '&#9654; Play';
    playBtn.classList.remove('playing');
  }

  function forestNextFrame(year) {
    if (!forestPlaying) return;
    const next = year >= FOREST_YEAR_MAX ? FOREST_YEAR_MIN : year + 1;
    forestLoadFrame(next, forestNextFrame);
  }

  playBtn.addEventListener('click', () => {
    if (forestPlaying) {
      stopPlay();
    } else {
      forestPlaying = true;
      playBtn.innerHTML = '&#9646;&#9646; Pause';
      playBtn.classList.add('playing');
      forestNextFrame(forestCurrentYear);
    }
  });

  setTimeout(() => {
    if (!forestMap) return;
    forestMap.invalidateSize();
    const w = forestMap.getContainer().offsetWidth;
    const h = forestMap.getContainer().offsetHeight;
    const coverZoom = Math.log2(Math.max(w, h) / 256);
    forestMap.setView([15, 10], Math.max(2, coverZoom));
  }, 200);
}
