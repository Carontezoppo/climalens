// Air pollution (CAMS AOD) and light pollution (NASA Black Marble) map

(function () {

  // NASA GIBS Black Marble annual composites; update NIGHT_MAX_YEAR each January
  // when NASA publishes the previous year's composite.
  const NIGHT_MIN_YEAR = 2012;
  const NIGHT_MAX_YEAR = 2016; // GIBS only holds 2012 and 2016 annual composites

  const GIBS_BASE    = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
  const BORDERS_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

  let pollutionMap    = null;
  let dayLayer        = null;
  let nightLayer      = null;
  let activeNightYear = NIGHT_MAX_YEAR;
  let mode            = 'night';

  // Split each LineString at antimeridian crossings (longitude jumps > 180°).
  // Produces two clean segments with a tiny invisible gap at ±180° instead of
  // drawing a line across the full map width.
  function splitAtAntimeridian(lines) {
    const out = [];
    for (const line of lines) {
      let seg = [line[0]];
      for (let i = 1; i < line.length; i++) {
        if (Math.abs(line[i][0] - line[i - 1][0]) > 180) {
          if (seg.length >= 2) out.push(seg);
          seg = [line[i]];
        } else {
          seg.push(line[i]);
        }
      }
      if (seg.length >= 2) out.push(seg);
    }
    return out;
  }

  function init() {
    pollutionMap = L.map('pollutionMap', {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      worldCopyJump: true,
    });

    // Day layer — ECMWF CAMS NRT Aerosol Optical Depth at 550 nm.
    // Sits directly on the dark CSS background — no basemap tile layer.
    // TIME omitted: ECMWF serves their default (most recent available step).
    // Style sh_BuYlRd_aod: blue (clean) → yellow → red (heavy aerosol loading).
    dayLayer = L.tileLayer.wms('/api/ecmwf-pm25', {
      layers:      'composition_aod550',
      styles:      'sh_BuYlRd_aod',
      format:      'image/png',
      transparent: true,
      version:     '1.3.0',
      opacity:     0.8,
      tileSize:    256,
      attribution: 'AOD: CAMS NRT &middot; ECMWF / Copernicus',
    });

    // Night layer — NASA Black Marble VNP46A4 annual composite via NASA GIBS.
    // Not added to the map until night mode is activated.
    nightLayer = L.tileLayer(blackMarbleUrl(NIGHT_MAX_YEAR), {
      tileSize:    256,
      noWrap:      false,
      opacity:     1,
      attribution: 'Night lights: NASA Black Marble &middot; VIIRS &middot; NASA GIBS',
    }).addTo(pollutionMap);

    // Country borders pane — sits above the day layer only. Hidden in night mode.
    const bordersPane = pollutionMap.createPane('bordersPane');
    bordersPane.style.zIndex        = 450;
    bordersPane.style.pointerEvents = 'none';
    bordersPane.style.display       = 'none'; // hidden in night mode (default)

    fetch(BORDERS_URL)
      .then(r => r.json())
      .then(world => {
        const borders = topojson.mesh(world, world.objects.countries);
        borders.coordinates = splitAtAntimeridian(borders.coordinates);
        L.geoJSON(borders, {
          pane:  'bordersPane',
          style: { color: 'rgb(255, 255, 255)', weight: 1 },
        }).addTo(pollutionMap);
      });

    // Mode toggle
    document.getElementById('pollutionModeDay').addEventListener('click',
      () => setMode('day'));
    document.getElementById('pollutionModeNight').addEventListener('click',
      () => setMode('night'));

    // Night year toggle buttons (only 2012 and 2016 available on GIBS)
    document.getElementById('nightYear2012').addEventListener('click', () => setNightYear(2012));
    document.getElementById('nightYear2016').addEventListener('click', () => setNightYear(2016));
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

    const bordersEl = pollutionMap.getPane('bordersPane');

    if (mode === 'night') {
      dayBtn.classList.remove('active');
      dayBtn.setAttribute('aria-pressed', 'false');
      nightBtn.classList.add('active');
      nightBtn.setAttribute('aria-pressed', 'true');
      nightCtrl.hidden   = false;
      dayStatus.hidden   = true;
      dayLegend.hidden   = true;
      nightLegend.hidden = false;
      bordersEl.style.display = 'none';
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
      bordersEl.style.display = '';
      pollutionMap.removeLayer(nightLayer);
      dayLayer.addTo(pollutionMap);
    }
  }

  function setNightYear(year) {
    activeNightYear = year;
    document.getElementById('nightYear2012').classList.toggle('active', year === 2012);
    document.getElementById('nightYear2016').classList.toggle('active', year === 2016);
    if (mode === 'night') nightLayer.setUrl(blackMarbleUrl(year));
  }

  function blackMarbleUrl(year) {
    // GIBS Black Marble (VNP46A4) annual composites — only 2012 and 2016 available.
    // TileMatrixSet: GoogleMapsCompatible_Level8 (256px, up to zoom 8). Format: png.
    return `${GIBS_BASE}/VIIRS_Black_Marble/default/${year}-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
  }

  init();

})();
