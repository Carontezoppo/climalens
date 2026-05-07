// Paleocoastlines — last 100,000 years
// Renders a world map from a 0.25° or 0.10° ETOPO 2022 elevation grid.
// Tile rendering runs in a Web Worker so the main thread is never blocked.
// Optional ice sheet overlay from data/ice_cover.bin (ICE-7G_NA, 21 × 180 × 360 uint8, 1°).

(function () {

  // Global mean sea level relative to today (metres), 5-ka intervals, 0–100 ka BP.
  // Source: Spratt & Lisiecki (2016); Lambeck et al. (2014) for the last 25 ka.
  const CURVE = [
    [0,       0],
    [5000,   -3],
    [10000,  -35],
    [15000,  -85],
    [20000, -120],
    [25000, -130],
    [30000, -110],
    [35000,  -90],
    [40000,  -78],
    [45000,  -67],
    [50000,  -60],
    [55000,  -65],
    [60000,  -72],
    [65000,  -77],
    [70000,  -80],
    [75000,  -68],
    [80000,  -44],
    [85000,  -24],
    [90000,  -43],
    [95000,  -20],
    [100000, -22],
  ];

  const STEPS = CURVE.length;

  let paleoMap   = null;
  let paleoLayer = null;
  let worker     = null;
  let tileSeq    = 0;
  const pending  = new Map();

  // Tracks whether the active worker was initialised with ice data
  let iceAvailable = false;

  // ── Custom Leaflet tile layer ─────────────────────────────────────────────

  const PaleoLayer = L.GridLayer.extend({
    createTile(coords, done) {
      const canvas = document.createElement('canvas');
      const sz = this.getTileSize();
      canvas.width = sz.x;
      canvas.height = sz.y;

      const id = tileSeq++;
      pending.set(id, { canvas, sz, done });
      worker.postMessage({
        type: 'render',
        id, tx: coords.x, ty: coords.y, z: coords.z,
        w: sz.x, h: sz.y,
        sl:      this.options.seaLevel,
        showIce: this.options.showIce,
        iceStep: this.options.iceStep,
      });

      return canvas;
    },
  });

  // ── UI update ─────────────────────────────────────────────────────────────

  // ICE-7G_NA covers 0–26 ka BP; steps beyond this use the LGM as proxy
  const ICE_MAX_STEP = 5; // index of 25 ka in CURVE (last step with real data)

  function updateDisplay(idx) {
    const [years, sl] = CURVE[idx];
    document.getElementById('paleoTimeLabel').textContent =
      years === 0 ? 'Today' : `${years.toLocaleString()} years ago`;
    document.getElementById('paleoSlLabel').textContent =
      sl === 0 ? '± 0 m vs today' : `Sea level ${sl} m vs today`;

    const noteEl = document.getElementById('paleoIceNote');
    if (noteEl && iceAvailable) {
      noteEl.hidden = !(idx > ICE_MAX_STEP && paleoLayer && paleoLayer.options.showIce);
    }

    if (paleoLayer) {
      paleoLayer.options.seaLevel = sl;
      paleoLayer.options.iceStep  = idx;
      paleoLayer.redraw();
    }
  }

  // ── Load gate ─────────────────────────────────────────────────────────────

  const RESOLUTIONS = {
    low:  { file: '/data/etopo025.bin', rows: 720,  cols: 1440, res: 0.25 },
    high: { file: '/data/etopo010.bin', rows: 1800, cols: 3600, res: 0.10 },
  };

  async function loadAndInit(quality) {
    const cfg = RESOLUTIONS[quality];
    const progressBar   = document.getElementById('paleoProgressBar');
    const progressLabel = document.getElementById('paleoProgressLabel');
    const progressWrap  = document.getElementById('paleoProgressWrap');

    document.getElementById('paleoLoadLow').disabled  = true;
    document.getElementById('paleoLoadHigh').disabled = true;

    if (paleoMap) { paleoMap.remove(); paleoMap = null; paleoLayer = null; }
    if (worker)   { worker.terminate(); worker = null; pending.clear(); }
    iceAvailable = false;

    progressBar.style.width = '0%';
    progressLabel.style.color = '';
    progressLabel.textContent = 'Downloading elevation data…';
    progressWrap.hidden = false;
    document.getElementById('paleoLoadedBadge').hidden = true;
    document.getElementById('paleoIceToggle').hidden   = true;

    document.getElementById('paleoGate').hidden       = true;
    document.getElementById('paleoMapSection').hidden = false;
    await new Promise(r => requestAnimationFrame(r));

    // Fetch DEM and ice in parallel; ice failure is silent
    const [demBuffer, iceBuffer] = await Promise.all([
      fetchWithProgress(cfg.file, progressBar, progressLabel),
      fetchSilent('/data/ice_cover.bin'),
    ]);

    if (!demBuffer) {
      document.getElementById('paleoLoadLow').disabled  = false;
      document.getElementById('paleoLoadHigh').disabled = false;
      return;
    }

    progressBar.style.width = '100%';
    progressLabel.textContent = 'Rendering map…';

    // Spawn worker, transferring DEM and ice (if available)
    const transferables = [demBuffer];
    const initMsg = {
      type: 'init',
      buffer: demBuffer,
      rows: cfg.rows, cols: cfg.cols, res: cfg.res,
    };
    if (iceBuffer) {
      initMsg.iceBuffer = iceBuffer;
      initMsg.iceRows   = 180;
      initMsg.iceCols   = 360;
      transferables.push(iceBuffer);
      iceAvailable = true;
    }

    worker = new Worker('js/paleo-worker.js');
    worker.onmessage = ({ data: { id, buf } }) => {
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      const ctx = entry.canvas.getContext('2d');
      ctx.putImageData(new ImageData(new Uint8ClampedArray(buf), entry.sz.x, entry.sz.y), 0, 0);
      entry.done(null, entry.canvas);
    };
    worker.postMessage(initMsg, transferables);

    await new Promise(r => requestAnimationFrame(r));

    const DEFAULT_IDX = 4; // LGM ~20 ka — most visually dramatic
    paleoMap = L.map('paleoMap', {
      center: [20, 15], zoom: 2,
      minZoom: 1, maxZoom: 6,
      zoomControl: true, attributionControl: false,
    });

    paleoLayer = new PaleoLayer({
      tileSize: 256,
      seaLevel: CURVE[DEFAULT_IDX][1],
      showIce:  true,
      iceStep:  DEFAULT_IDX,
    }).addTo(paleoMap);

    paleoLayer.once('load', () => {
      progressWrap.hidden = true;
      document.getElementById('paleoLoadedBadge').hidden = false;

      // Re-enable the other resolution button
      document.getElementById(quality === 'low' ? 'paleoLoadHigh' : 'paleoLoadLow').disabled = false;

      // Show ice toggle and legend item only if ice data loaded successfully
      if (iceAvailable) {
        const btn = document.getElementById('paleoIceToggle');
        btn.hidden = false;
        btn.classList.add('active'); // ON by default
        document.getElementById('paleoIceLegendItem').hidden    = false;
        document.getElementById('paleoSeaIceLegendItem').hidden = false;
      }
    });

    const slider = document.getElementById('paleoSlider');
    slider.max   = STEPS - 1;
    slider.value = DEFAULT_IDX;
    updateDisplay(DEFAULT_IDX);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  async function fetchWithProgress(url, progressBar, progressLabel) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentLength = parseInt(res.headers.get('Content-Length'), 10);
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength) {
          const pct = Math.round(received / contentLength * 100);
          progressBar.style.width = pct + '%';
          progressLabel.textContent = `Downloading ${pct}%`;
        }
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      return merged.buffer;
    } catch (err) {
      progressLabel.textContent = 'Failed: ' + err.message;
      progressLabel.style.color = 'var(--negative)';
      return null;
    }
  }

  async function fetchSilent(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch {
      return null;
    }
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  function initPaleo() {
    document.getElementById('paleoLoadLow').addEventListener('click',  () => loadAndInit('low'));
    document.getElementById('paleoLoadHigh').addEventListener('click', () => loadAndInit('high'));
    document.getElementById('paleoSlider').addEventListener('input', function () { updateDisplay(+this.value); });

    document.getElementById('paleoIceToggle').addEventListener('click', function () {
      if (!paleoLayer) return;
      const isOn = paleoLayer.options.showIce;
      paleoLayer.options.showIce = !isOn;
      this.classList.toggle('active', !isOn);
      const noteEl = document.getElementById('paleoIceNote');
      if (noteEl) noteEl.hidden = isOn || paleoLayer.options.iceStep <= ICE_MAX_STEP;
      paleoLayer.redraw();
    });
  }

  window.initPaleo = initPaleo;

})();
