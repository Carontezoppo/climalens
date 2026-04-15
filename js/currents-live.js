// Live ocean current particle animation
// Powered by CMEMS Global Ocean Physics Forecast (uo/vo surface velocity)

/* ── Constants ──────────────────────────────────────────────────────────────── */
const PARTICLE_COUNT  = 4000;
const MAX_AGE         = 80;    // frames before a particle respawns
const SPEED_SCALE     = 18;    // pixels per m/s per frame (tune for visual feel)
const TRAIL_OPACITY   = 0.92;  // how much each frame fades (higher = longer trails)
const PARTICLE_WIDTH  = 1.5;   // stroke width in px
const FADE_COLOR      = '20, 24, 33'; // matches --bg-card (#141821) in RGB

/* ── State ──────────────────────────────────────────────────────────────────── */
let liveCurrentsMap    = null;
let liveCurrentsCanvas = null;
let liveCurrentsCtx    = null;
let animFrameId        = null;
let velocityGrid       = null;  // { width, height, latMin, latMax, lonMin, lonMax, u, v }
let particles          = [];
let liveCurrentsActive = false;

/* ── Grid interpolation ─────────────────────────────────────────────────────── */
function bilinear(field, width, height, x, y) {
  x = Math.max(0, Math.min(width  - 1.001, x));
  y = Math.max(0, Math.min(height - 1.001, y));
  const x0 = Math.floor(x), x1 = x0 + 1;
  const y0 = Math.floor(y), y1 = y0 + 1;
  const fx = x - x0, fy = y - y0;
  return (
    field[y0 * width + x0] * (1 - fx) * (1 - fy) +
    field[y0 * width + x1] *      fx  * (1 - fy) +
    field[y1 * width + x0] * (1 - fx) *      fy  +
    field[y1 * width + x1] *      fx  *      fy
  );
}

// Convert geographic coordinates to fractional grid indices
function toGridXY(lat, lon, grid) {
  const x = (lon - grid.lonMin) / (grid.lonMax - grid.lonMin) * (grid.width  - 1);
  const y = (grid.latMax - lat) / (grid.latMax - grid.latMin) * (grid.height - 1);
  return { x, y };
}

// Look up interpolated u (east) and v (north) velocity at a lat/lon
function getVelocity(lat, lon) {
  if (!velocityGrid) return { u: 0, v: 0 };
  const { x, y } = toGridXY(lat, lon, velocityGrid);
  return {
    u: bilinear(velocityGrid.u, velocityGrid.width, velocityGrid.height, x, y),
    v: bilinear(velocityGrid.v, velocityGrid.width, velocityGrid.height, x, y),
  };
}

/* ── Particle management ────────────────────────────────────────────────────── */
function randomParticle() {
  return {
    lat: Math.random() * 160 - 80,   // –80 to +80°
    lon: Math.random() * 360 - 180,  // –180 to +180°
    age: Math.floor(Math.random() * MAX_AGE),
  };
}

function initParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, randomParticle);
}

/* ── Speed → colour ─────────────────────────────────────────────────────────── */
// Slow currents: muted blue-grey → fast currents: bright teal/cyan
function speedColor(speed) {
  // speed in m/s, typical range 0–1.5 m/s
  const t = Math.min(1, speed / 1.2);
  if (t < 0.3) {
    // slow: dim blue-grey
    const v = Math.round(80 + t / 0.3 * 60);
    return `rgba(${v}, ${v + 20}, ${v + 40}, ${0.3 + t * 0.4})`;
  }
  // fast: bright teal→cyan→white
  const r = Math.round(40  + t * 215);
  const g = Math.round(160 + t * 95);
  const b = Math.round(200 + t * 55);
  return `rgba(${r}, ${g}, ${b}, ${0.5 + t * 0.5})`;
}

/* ── Animation loop ─────────────────────────────────────────────────────────── */
function animateCurrents() {
  if (!liveCurrentsActive) return;
  animFrameId = requestAnimationFrame(animateCurrents);

  const ctx    = liveCurrentsCtx;
  const canvas = liveCurrentsCanvas;
  const map    = liveCurrentsMap;
  if (!ctx || !canvas || !map) return;

  // Fade the previous frame (creates trails)
  ctx.fillStyle = `rgba(${FADE_COLOR}, ${1 - TRAIL_OPACITY})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.age++;
    if (p.age > MAX_AGE) {
      Object.assign(p, randomParticle());
      return;
    }

    const { u, v } = getVelocity(p.lat, p.lon);
    const speed = Math.sqrt(u * u + v * v);
    if (speed < 0.01) { p.age = MAX_AGE; return; } // skip near-zero velocity (land)

    // Convert lat/lon to canvas pixel
    const ptA = map.latLngToContainerPoint([p.lat, p.lon]);

    // Advance position — u is east (+lon), v is north (+lat)
    // Scale speed relative to current zoom so particles don't fly off at high zoom
    const zoom  = map.getZoom();
    const scale = SPEED_SCALE * Math.pow(2, zoom - 2);
    p.lon += (u / speed) * speed * scale / (111320 * Math.cos(p.lat * Math.PI / 180));
    p.lat += (v / speed) * speed * scale / 111320;

    // Wrap longitude
    if (p.lon >  180) p.lon -= 360;
    if (p.lon < -180) p.lon += 360;
    // Kill particle if it drifts out of lat bounds
    if (p.lat > 85 || p.lat < -85) { p.age = MAX_AGE; return; }

    const ptB = map.latLngToContainerPoint([p.lat, p.lon]);

    // Don't draw if the segment jumps across the screen (antimeridian wrap)
    if (Math.abs(ptA.x - ptB.x) > canvas.width / 2) return;

    // Fade in at birth, fade out near death
    const lifeFrac = p.age / MAX_AGE;
    const alpha = lifeFrac < 0.1
      ? lifeFrac / 0.1
      : lifeFrac > 0.85 ? (1 - lifeFrac) / 0.15 : 1;

    ctx.beginPath();
    ctx.moveTo(ptA.x, ptA.y);
    ctx.lineTo(ptB.x, ptB.y);
    ctx.strokeStyle = speedColor(speed).replace('rgba(', `rgba(`).replace(/[\d.]+\)$/, `${alpha})`);
    ctx.lineWidth   = PARTICLE_WIDTH;
    ctx.stroke();
  });
}

/* ── Canvas sizing ──────────────────────────────────────────────────────────── */
function resizeCanvas() {
  if (!liveCurrentsMap || !liveCurrentsCanvas) return;
  const container = liveCurrentsMap.getContainer();
  liveCurrentsCanvas.width  = container.offsetWidth;
  liveCurrentsCanvas.height = container.offsetHeight;
  // Clear on resize so we don't get stretched artefacts
  liveCurrentsCtx.clearRect(0, 0, liveCurrentsCanvas.width, liveCurrentsCanvas.height);
}

/* ── Public init ────────────────────────────────────────────────────────────── */
async function initLiveCurrentsMap() {
  if (!window.L) return;

  // ── Map (same setup as SST / static currents) ─────────────────────────────
  liveCurrentsMap = L.map('liveCurrentsMap', {
    center: [10, 0], zoom: 2, minZoom: 2, maxZoom: 5,
    zoomSnap: 0, worldCopyJump: false, attributionControl: true,
    maxBounds: [[-90, -220], [90, 260]], maxBoundsViscosity: 0.8,
  });

  setTimeout(() => {
    if (!liveCurrentsMap) return;
    liveCurrentsMap.invalidateSize();
    const w = liveCurrentsMap.getContainer().offsetWidth;
    const h = liveCurrentsMap.getContainer().offsetHeight;
    liveCurrentsMap.setView([10, 0], Math.max(2, Math.log2(Math.max(w, h) / 256)));
  }, 200);

  // ── Coastlines (shared world-atlas approach) ───────────────────────────────
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')
    .then(r => r.json())
    .then(topo => {
      const raw   = topojson.mesh(topo, topo.objects.land);
      const lines = [];
      raw.coordinates.forEach(line => {
        let seg = [line[0]];
        for (let i = 1; i < line.length; i++) {
          if (Math.abs(line[i][0] - line[i - 1][0]) > 180) {
            if (seg.length > 1) lines.push(seg);
            seg = [line[i]];
          } else { seg.push(line[i]); }
        }
        if (seg.length > 1) lines.push(seg);
      });
      L.geoJSON(
        { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines }, properties: {} },
        { style: { fill: false, color: 'rgba(255,255,255,0.22)', weight: 0.8, opacity: 1 }, interactive: false }
      ).addTo(liveCurrentsMap);
    });

  // ── Particle canvas overlay ────────────────────────────────────────────────
  // Sits above the Leaflet panes, below the coastline SVG layer
  liveCurrentsCanvas = document.createElement('canvas');
  liveCurrentsCanvas.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;z-index:400;';
  liveCurrentsMap.getContainer().appendChild(liveCurrentsCanvas);
  liveCurrentsCtx = liveCurrentsCanvas.getContext('2d');
  resizeCanvas();

  liveCurrentsMap.on('resize move zoom', resizeCanvas);

  // ── Fetch velocity grid ────────────────────────────────────────────────────
  const statusEl = document.getElementById('liveCurrentsStatus');
  try {
    const res  = await fetch('/api/currents-live');
    const data = await res.json();

    if (!res.ok || data.error) {
      if (statusEl) statusEl.textContent = 'Current data unavailable: ' + (data.error || `HTTP ${res.status}`);
      return;
    }

    velocityGrid = data;
    if (statusEl) statusEl.style.display = 'none';

    initParticles();
    liveCurrentsActive = true;

    // Redraw particles on every map move so they stay aligned
    liveCurrentsMap.on('movestart', () => {
      liveCurrentsCtx.clearRect(0, 0, liveCurrentsCanvas.width, liveCurrentsCanvas.height);
    });

    animateCurrents();

  } catch (err) {
    if (statusEl) statusEl.textContent = 'Could not load current data: ' + err.message;
  }
}

function stopLiveCurrents() {
  liveCurrentsActive = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
}
