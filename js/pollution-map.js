// Air pollution (CAMS PM2.5) and light pollution (NASA Black Marble) map

(function () {

  // NASA GIBS Black Marble annual composites; update NIGHT_MAX_YEAR each January
  // when NASA publishes the previous year's composite.
  const NIGHT_MIN_YEAR = 2012;
  const NIGHT_MAX_YEAR = 2024;

  const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

  let pollutionMap    = null;
  let dayLayer        = null;
  let nightLayer      = null;
  let activeNightYear = NIGHT_MAX_YEAR;
  let mode            = 'day';

  function init() {
    pollutionMap = L.map('pollutionMap', {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      worldCopyJump: true,
    });

    // Dark basemap — both PM2.5 and night-lights read better against dark
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
          '&copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(pollutionMap);

    // Day layer — ECMWF CAMS NRT PM2.5 via authenticated WMS proxy.
    // TIME is injected server-side by /api/ecmwf-pm25 if omitted here.
    // Layer name: composition_pm2p5_surface (surface PM2.5, µg m⁻³).
    // Style sh_plasma_r_pm2p5 uses the plasma colormap (dark=low, bright=high);
    // falls back to ECMWF default if the style is not supported by your token tier.
    dayLayer = L.tileLayer.wms('/api/ecmwf-pm25', {
      layers:      'composition_pm2p5_surface',
      styles:      'sh_plasma_r_pm2p5',
      format:      'image/png',
      transparent: true,
      version:     '1.3.0',
      opacity:     0.85,
      tileSize:    256,
      attribution: 'PM₂.₅: CAMS NRT &middot; ECMWF / Copernicus',
    }).addTo(pollutionMap);

    // Night layer — NASA Black Marble VNP46A4 annual composite via NASA GIBS.
    // Not added to the map until night mode is activated.
    nightLayer = L.tileLayer(blackMarbleUrl(NIGHT_MAX_YEAR), {
      tileSize:    512,
      noWrap:      false,
      opacity:     1,
      attribution: 'Night lights: NASA Black Marble VNP46A4 &middot; VIIRS',
    });

    // Mode toggle
    document.getElementById('pollutionModeDay').addEventListener('click',
      () => setMode('day'));
    document.getElementById('pollutionModeNight').addEventListener('click',
      () => setMode('night'));

    // Night year slider
    const slider = document.getElementById('nightYearSlider');
    slider.min   = NIGHT_MIN_YEAR;
    slider.max   = NIGHT_MAX_YEAR;
    slider.value = NIGHT_MAX_YEAR;
    updateSliderFill(slider);

    slider.addEventListener('input', () => {
      activeNightYear = +slider.value;
      document.getElementById('nightYearDisplay').textContent = activeNightYear;
      updateSliderFill(slider);
      if (mode === 'night') nightLayer.setUrl(blackMarbleUrl(activeNightYear));
    });

    document.getElementById('dayDataTime').textContent = formatCamsTime();
  }

  function setMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;

    const dayBtn      = document.getElementById('pollutionModeDay');
    const nightBtn    = document.getElementById('pollutionModeNight');
    const nightCtrl   = document.getElementById('nightControls');
    const dayStatus   = document.getElementById('dayStatus');
    const dayLegend   = document.getElementById('dayLegend');
    const nightLegend = document.getElementById('nightLegend');

    if (mode === 'night') {
      dayBtn.classList.remove('active');
      dayBtn.setAttribute('aria-pressed', 'false');
      nightBtn.classList.add('active');
      nightBtn.setAttribute('aria-pressed', 'true');
      nightCtrl.hidden   = false;
      dayStatus.hidden   = true;
      dayLegend.hidden   = true;
      nightLegend.hidden = false;
      pollutionMap.removeLayer(dayLayer);
      nightLayer.addTo(pollutionMap);
    } else {
      nightBtn.classList.remove('active');
      nightBtn.setAttribute('aria-pressed', 'false');
      dayBtn.classList.add('active');
      dayBtn.setAttribute('aria-pressed', 'true');
      nightCtrl.hidden   = true;
      dayStatus.hidden   = false;
      dayLegend.hidden   = false;
      nightLegend.hidden = true;
      pollutionMap.removeLayer(nightLayer);
      dayLayer.addTo(pollutionMap);
    }
  }

  function blackMarbleUrl(year) {
    // January composite used as the annual representative frame.
    // GIBS Black Marble tiles top out at zoom 8 (500m/pixel).
    return `${GIBS_BASE}/VIIRS_Black_Marble/default/${year}-01-01/500m/{z}/{y}/{x}.jpg`;
  }

  // Mirror of the CF Function's latestCamsTime() for the display label only.
  function latestCamsTime() {
    const safeMs = Date.now() - 4 * 3600 * 1000;
    const d      = new Date(safeMs);
    const run    = d.getUTCHours() >= 12 ? 12 : 0;
    const yy     = d.getUTCFullYear();
    const mm     = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd     = String(d.getUTCDate()).padStart(2, '0');
    const hh     = String(run).padStart(2, '0');
    return `${yy}-${mm}-${dd}T${hh}:00:00Z`;
  }

  function formatCamsTime() {
    const iso     = latestCamsTime();
    const d       = new Date(iso);
    const months  = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];
    const hh      = String(d.getUTCHours()).padStart(2, '0');
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${hh}:00 UTC`;
  }

  function updateSliderFill(el) {
    const pct = ((+el.value - +el.min) / (+el.max - +el.min)) * 100;
    el.style.background =
      `linear-gradient(to right,#6366f1 ${pct}%,#2a3148 ${pct}%)`;
  }

  init();

})();
