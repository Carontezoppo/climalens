// Paleocoastlines — last 100,000 years
// Renders a world map from a 0.25° ETOPO 2022 elevation grid (data/etopo025.bin, ~2 MB).
// Tile rendering runs in a Web Worker so the main thread is never blocked.

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
  const pending  = new Map(); // tileSeq → { canvas, sz, done }

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
        w: sz.x, h: sz.y, sl: this.options.seaLevel,
      });

      return canvas;
    },
  });

  // ── UI update ─────────────────────────────────────────────────────────────

  function updateDisplay(idx) {
    const [years, sl] = CURVE[idx];
    document.getElementById('paleoTimeLabel').textContent =
      years === 0 ? 'Today' : `${years.toLocaleString()} years ago`;
    document.getElementById('paleoSlLabel').textContent =
      sl === 0 ? '± 0 m vs today' : `Sea level ${sl} m vs today`;
    if (paleoLayer) {
      paleoLayer.options.seaLevel = sl;
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

    // Disable both buttons while loading
    document.getElementById('paleoLoadLow').disabled  = true;
    document.getElementById('paleoLoadHigh').disabled = true;

    // Tear down any previous map and worker before starting fresh
    if (paleoMap) { paleoMap.remove(); paleoMap = null; paleoLayer = null; }
    if (worker)   { worker.terminate(); worker = null; pending.clear(); }

    // Reset progress bar and badge
    progressBar.style.width = '0%';
    progressLabel.style.color = '';
    progressLabel.textContent = 'Downloading elevation data…';
    progressWrap.hidden = false;
    document.getElementById('paleoLoadedBadge').hidden = true;

    // Show the map section immediately so the progress bar is visible
    document.getElementById('paleoGate').hidden = true;
    document.getElementById('paleoMapSection').hidden = false;
    await new Promise(r => requestAnimationFrame(r));

    // ── Stream the DEM fetch so we can update the progress bar ───────────────
    let demBuffer;
    try {
      const res = await fetch(cfg.file);
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

      // Merge chunks into a single ArrayBuffer
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      demBuffer = merged.buffer;

    } catch (err) {
      progressLabel.textContent = 'Failed: ' + err.message;
      progressLabel.style.color = 'var(--negative)';
      document.getElementById('paleoLoadLow').disabled  = false;
      document.getElementById('paleoLoadHigh').disabled = false;
      return;
    }

    // ── Worker: hand off the DEM buffer (zero-copy transfer) ─────────────────
    progressBar.style.width = '100%';
    progressLabel.textContent = 'Rendering map…';

    worker = new Worker('js/paleo-worker.js');
    worker.onmessage = ({ data: { id, buf } }) => {
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      const ctx = entry.canvas.getContext('2d');
      ctx.putImageData(new ImageData(new Uint8ClampedArray(buf), entry.sz.x, entry.sz.y), 0, 0);
      entry.done(null, entry.canvas);
    };
    worker.postMessage({ type: 'init', buffer: demBuffer, rows: cfg.rows, cols: cfg.cols, res: cfg.res }, [demBuffer]);

    // ── Leaflet map — wait one frame so the container is properly sized ───────
    await new Promise(r => requestAnimationFrame(r));

    const DEFAULT_IDX = 4; // LGM, ~20,000 ya — most visually dramatic
    paleoMap = L.map('paleoMap', {
      center: [20, 15], zoom: 2,
      minZoom: 1, maxZoom: 6,
      zoomControl: true, attributionControl: false,
    });

    paleoLayer = new PaleoLayer({
      tileSize: 256,
      seaLevel: CURVE[DEFAULT_IDX][1],
    }).addTo(paleoMap);

    paleoLayer.once('load', () => {
      progressWrap.hidden = true;
      document.getElementById('paleoLoadedBadge').hidden = false;
      // Re-enable the other button so the user can switch resolution
      document.getElementById(quality === 'low' ? 'paleoLoadHigh' : 'paleoLoadLow').disabled = false;
    });

    const slider = document.getElementById('paleoSlider');
    slider.max   = STEPS - 1;
    slider.value = DEFAULT_IDX;
    updateDisplay(DEFAULT_IDX);
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  function initPaleo() {
    document.getElementById('paleoLoadLow').addEventListener('click',  () => loadAndInit('low'));
    document.getElementById('paleoLoadHigh').addEventListener('click', () => loadAndInit('high'));
    // Registered once here so repeated loads don't stack up listeners
    document.getElementById('paleoSlider').addEventListener('input', function () { updateDisplay(+this.value); });
  }

  window.initPaleo = initPaleo;

})();
