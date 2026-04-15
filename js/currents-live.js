// Live ocean current particle animation
// Powered by NOAA CoastWatch SSH-derived geostrophic currents (ugos/vgos)

/* ── Named major surface currents (for hover labels) ────────────────────────── */
const OCEAN_CURRENTS = [
  // Warm currents
  { name: 'Gulf Stream / N. Atlantic Drift', type: 'warm',
    coords: [[-80,24],[-79,26],[-78,28],[-77,30],[-76,32],[-75,35],[-72,38],[-68,40],[-62,43],[-55,46],[-47,49],[-40,51],[-32,53],[-22,55],[-14,57],[-5,58],[5,60],[15,63]] },
  { name: 'Kuroshio Current', type: 'warm',
    coords: [[130,18],[130,22],[131,26],[134,30],[138,34],[141,37],[143,40],[147,43],[155,45],[165,46],[175,46]] },
  { name: 'North Pacific Current', type: 'warm',
    coords: [[175,46],[185,47],[195,48],[205,49],[215,49],[225,48],[233,46]] },
  { name: 'East Australian Current', type: 'warm',
    coords: [[154,-14],[154,-18],[154,-22],[153,-26],[152,-30],[151,-34],[150,-38],[149,-42]] },
  { name: 'Agulhas Current', type: 'warm',
    coords: [[42,-10],[43,-14],[42,-18],[41,-22],[38,-26],[35,-30],[33,-34],[28,-37],[20,-40],[15,-42],[8,-42],[0,-40]] },
  { name: 'Brazil Current', type: 'warm',
    coords: [[-35,-10],[-36,-14],[-38,-18],[-39,-22],[-42,-26],[-45,-30],[-48,-34],[-52,-38],[-55,-42]] },
  { name: 'N. Equatorial Current (Atlantic)', type: 'warm',
    coords: [[-18,14],[-25,14],[-32,13],[-40,12],[-48,11],[-55,11],[-60,12]] },
  { name: 'N. Equatorial Current (Pacific)', type: 'warm',
    coords: [[-115,14],[-125,14],[-135,14],[-145,13],[-155,13],[-165,13],[-175,13],[-185,13],[-195,14],[-205,15],[-215,15],[-232,16]] },
  { name: 'S. Equatorial Current (Atlantic)', type: 'warm',
    coords: [[-8,-4],[-15,-4],[-22,-4],[-30,-4],[-38,-4],[-46,-4],[-52,-2]] },
  { name: 'S. Equatorial Current (Pacific)', type: 'warm',
    coords: [[-80,-5],[-90,-5],[-100,-5],[-110,-5],[-120,-5],[-130,-6],[-140,-7],[-150,-8],[-160,-8],[-170,-8],[-180,-8],[-190,-8],[-205,-8],[-215,-8]] },
  // Cold currents
  { name: 'Labrador Current', type: 'cold',
    coords: [[-60,65],[-58,60],[-56,55],[-54,52],[-53,48],[-54,44],[-56,42]] },
  { name: 'Canary Current', type: 'cold',
    coords: [[-14,56],[-14,50],[-13,44],[-12,38],[-11,32],[-14,26],[-17,20],[-18,15]] },
  { name: 'California Current', type: 'cold',
    coords: [[-128,50],[-127,46],[-126,42],[-125,38],[-122,34],[-118,30],[-113,25],[-110,20]] },
  { name: 'Benguela Current', type: 'cold',
    coords: [[18,-35],[15,-30],[13,-24],[12,-18],[11,-12],[10,-6]] },
  { name: 'Humboldt (Peru) Current', type: 'cold',
    coords: [[-68,-54],[-72,-48],[-76,-42],[-76,-36],[-74,-30],[-73,-24],[-72,-18],[-75,-12],[-78,-6],[-82,-2]] },
  { name: 'Oyashio Current', type: 'cold',
    coords: [[148,52],[147,48],[146,44],[145,42],[144,40],[143,38]] },
  { name: 'Antarctic Circumpolar Current', type: 'cold',
    coords: [[-180,-57],[-160,-59],[-140,-59],[-120,-58],[-100,-57],[-80,-58],[-60,-59],[-40,-58],[-20,-57],[0,-56],[20,-56],[40,-57],[60,-58],[80,-58],[100,-57],[120,-57],[140,-58],[160,-58],[180,-57]] },
];

/* ── Constants ──────────────────────────────────────────────────────────────── */
const PARTICLE_COUNT  = 4000;
const MAX_AGE         = 90;    // frames before a particle respawns
// Geographic speed scale: degrees-per-frame per (m/s) at zoom level 2.
// Higher = faster animation. Divided by 2^(zoom-2) to keep pixel velocity
// roughly constant across zoom levels.
// Target: ~0.4 px/frame for a 1 m/s current at zoom 2 (2.84 px/°).
// 0.4px / 2.84px_per_deg / 1_m_s × 111320_m_per_deg ≈ 15,700 → use 15000.
const SPEED_SCALE     = 15000;
const TRAIL_OPACITY   = 0.93;  // how much each frame fades (higher = longer trails)
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
    // Divide by 2^(zoom-2) so pixel velocity stays roughly constant:
    // higher zoom = more px/° so we need fewer degrees per frame.
    const zoom  = map.getZoom();
    const scale = SPEED_SCALE / Math.pow(2, zoom - 2);
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

  // ── Particle canvas overlay ────────────────────────────────────────────────
  // z-index 300 = above tile layer (200) but below Leaflet's overlayPane (400)
  // so land fill and coastlines render on top of the particles.
  liveCurrentsCanvas = document.createElement('canvas');
  liveCurrentsCanvas.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;z-index:300;';
  liveCurrentsMap.getContainer().appendChild(liveCurrentsCanvas);
  liveCurrentsCtx = liveCurrentsCanvas.getContext('2d');
  resizeCanvas();

  liveCurrentsMap.on('resize move zoom', resizeCanvas);

  // ── Land fill + coastlines (overlayPane z-400, above canvas z-300) ─────────
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')
    .then(r => r.json())
    .then(topo => {
      // Solid land fill — same colour as map background so ocean stands out
      L.geoJSON(topojson.feature(topo, topo.objects.land), {
        style: { fill: true, fillColor: '#141821', fillOpacity: 1, stroke: false },
        interactive: false,
      }).addTo(liveCurrentsMap);

      // Coastline strokes on top of the fill
      const raw = topojson.mesh(topo, topo.objects.land);
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
        { style: { fill: false, color: 'rgba(255,255,255,0.55)', weight: 1.0, opacity: 1 }, interactive: false }
      ).addTo(liveCurrentsMap);

      // ── Named current hover labels ──────────────────────────────────────
      // Invisible wide polylines — hover anywhere along a current's path
      // to see its name and warm/cold type.
      OCEAN_CURRENTS.forEach(current => {
        const color  = current.type === 'warm' ? '#fb923c' : '#38bdf8';
        const label  = current.type === 'warm' ? '▲ Warm current' : '▽ Cold current';
        // coords stored as [lng, lat]; Leaflet needs [lat, lng]
        const llCoords = current.coords.map(([lng, lat]) => [lat, lng]);
        L.polyline(llCoords, { color: 'transparent', weight: 14, opacity: 0.001 })
          .bindTooltip(
            `<strong style="color:${color}">${current.name}</strong><br>` +
            `<span style="font-size:10px;color:${color};opacity:0.8">${label}</span>`,
            { sticky: true, opacity: 1, className: 'current-label-tooltip' }
          )
          .addTo(liveCurrentsMap);
      });
    });

  // ── Fetch velocity grid ────────────────────────────────────────────────────
  // /api/currents-live proxies NOAA CoastWatch ERDDAP (nesdisSSH1day):
  // SSH-derived geostrophic surface currents, 0.25°, daily NRT, no auth needed.
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
