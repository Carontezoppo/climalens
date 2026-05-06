// Web Worker — renders paleo DEM tiles off the main thread.
// Receives: { type:'init', buffer } once, then { type:'render', id, tx, ty, z, w, h, sl } per tile.
// Responds: { id, buf } where buf is a transferable ArrayBuffer (RGBA pixels).

let grid = null;
let ROWS, COLS, RES;

self.onmessage = function ({ data }) {
  if (data.type === 'init') {
    grid = new Int16Array(data.buffer);
    ROWS = data.rows;
    COLS = data.cols;
    RES  = data.res;
    return;
  }
  if (data.type === 'render') {
    const buf = renderTile(data);
    self.postMessage({ id: data.id, buf }, [buf]);
  }
};

function renderTile({ tx, ty, z, w, h, sl }) {
  const scale = Math.pow(2, z);

  // Precompute DEM row index per canvas row
  const rowIdx = new Int32Array(h);
  for (let py = 0; py < h; py++) {
    const wy  = (ty * h + py) / (scale * h);
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI;
    rowIdx[py] = Math.max(0, Math.min(ROWS - 1, Math.floor((90 - lat) / RES)));
  }

  // Precompute DEM col index per canvas col
  const colIdx = new Int32Array(w);
  for (let px = 0; px < w; px++) {
    const lon = (tx * w + px) / (scale * w) * 360 - 180;
    colIdx[px] = Math.max(0, Math.min(COLS - 1, Math.floor((lon + 180) / RES)));
  }

  const buf = new ArrayBuffer(w * h * 4);
  const d   = new Uint8Array(buf);

  for (let py = 0; py < h; py++) {
    const rBase = rowIdx[py] * COLS;
    const pBase = py * w * 4;

    for (let px = 0; px < w; px++) {
      const elev = grid[rBase + colIdx[px]];
      const pi   = pBase + px * 4;
      let r, g, b;
      if (elev >= 0) {
        r = 62; g = 78; b = 52;        // permanent land
      } else if (elev >= sl) {
        r = 200; g = 168; b = 118;     // exposed continental shelf
      } else {
        const depth = Math.min((sl - elev) / 8000, 1);
        r = Math.round(40 - depth * 25);
        g = Math.round(85 - depth * 55);
        b = Math.round(165 - depth * 100);
      }
      d[pi] = r; d[pi + 1] = g; d[pi + 2] = b; d[pi + 3] = 255;
    }
  }

  return buf;
}
