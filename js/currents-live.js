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
  // Indian Ocean
  { name: 'S. Equatorial Current (Indian Ocean)', type: 'warm',
    coords: [[110,-12],[100,-12],[90,-12],[80,-12],[70,-12],[60,-12],[50,-10],[46,-8]] },
  { name: 'East African Coastal Current', type: 'warm',
    coords: [[44,-14],[44,-10],[44,-6],[44,-2],[44,2],[45,6],[46,10],[47,12]] },
  { name: 'North Indian Ocean / Arabian Sea Gyre', type: 'warm',
    coords: [[47,12],[55,14],[65,14],[75,13],[85,12],[92,10],[94,6],[90,2],[80,0],[70,0],[60,2],[55,6],[50,10],[47,12]] },
  { name: 'Bay of Bengal Circulation', type: 'warm',
    coords: [[80,20],[88,20],[94,16],[95,12],[92,8],[86,6],[80,8],[80,12],[80,16],[80,20]] },
  { name: 'West Australian Current', type: 'cold',
    coords: [[113,-35],[112,-28],[110,-22],[108,-16],[106,-10],[103,-5]] },
  { name: 'South Indian Ocean Subtropical Gyre', type: 'warm',
    coords: [[46,-8],[60,-15],[80,-20],[100,-22],[115,-25],[115,-35],[100,-38],[80,-38],[60,-38],[40,-36],[30,-32],[20,-28],[20,-20],[30,-14],[40,-10],[46,-8]] },
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
  // North Pacific
  { name: 'Alaska Current', type: 'warm',
    coords: [[-127,46],[-130,50],[-140,54],[-148,57],[-155,58],[-160,57],[-165,55],[-170,52],[-175,50],[-178,48]] },
  { name: 'North Pacific Countercurrent (W)', type: 'warm',
    coords: [[145,7],[153,7],[163,7],[172,7],[180,7]] },
  { name: 'North Pacific Countercurrent (E)', type: 'warm',
    coords: [[-180,7],[-170,7],[-160,7],[-150,7],[-140,8],[-128,8],[-118,8],[-105,8],[-92,8]] },
  // South Pacific gyre return
  { name: 'South Pacific Current (W)', type: 'cold',
    coords: [[150,-42],[160,-43],[170,-44],[178,-44]] },
  { name: 'South Pacific Current (E)', type: 'cold',
    coords: [[-178,-44],[-165,-43],[-150,-43],[-135,-42],[-120,-42],[-108,-40],[-95,-38],[-80,-36]] },
  // South Atlantic gyre return
  { name: 'South Atlantic Current', type: 'cold',
    coords: [[-52,-42],[-40,-44],[-25,-44],[-10,-44],[5,-44],[18,-42]] },
];

/* ── Grid bounds (must match functions/api/currents-live.js) ────────────────── */
const GRID_LAT_MIN = -80, GRID_LAT_MAX = 80;
const GRID_LON_MIN = -180, GRID_LON_MAX = 180;
const GRID_STEP    = 4; // degrees per output cell (stride 16 × 0.25°)

/* ── Constants ──────────────────────────────────────────────────────────────── */
const PARTICLE_COUNT  = 6000;
const MAX_AGE         = 100;   // frames before a particle respawns
// Geographic speed scale: degrees-per-frame per (m/s) at zoom level 2.
// Higher = faster animation. Divided by 2^(zoom-2) to keep pixel velocity
// roughly constant across zoom levels.
// Target: ~0.5 px/frame for a 0.2 m/s current at zoom 2 (2.84 px/°).
// At 40000: 0.2 m/s → 0.2 × 40000 / 111320 × 2.84 ≈ 0.20 px/frame;
// visible trail of ~45 frames × 0.20 px = 9 px — noticeable even in slow seas.
// Gulf Stream (1.5 m/s) → 1.53 px/frame — clearly energetic without being too fast.
const SPEED_SCALE     = 40000;
const TRAIL_OPACITY   = 0.95;  // how much each frame fades (higher = longer trails)
const PARTICLE_WIDTH  = 1.5;   // stroke width in px

/* ── State ──────────────────────────────────────────────────────────────────── */
let liveCurrentsMap    = null;
let liveCurrentsCanvas = null;
let liveCurrentsCtx    = null;
let animFrameId        = null;
let velocityGrid       = null;  // { width, height, latMin, latMax, lonMin, lonMax, u, v }
let particles          = [];
let liveCurrentsActive = false;

/* ── Static velocity grid from named current paths ─────────────────────────── */
// Builds a velocity field from OCEAN_CURRENTS using Gaussian diffusion.
// Each path segment contributes u/v velocity to nearby grid cells with
// exponential falloff controlled by the current's width (sigma, in degrees).
// Used as the reliable fallback when no live data source is accessible.
function buildStaticGrid() {
  const step   = GRID_STEP;
  const width  = Math.round((GRID_LON_MAX - GRID_LON_MIN) / step) + 1;
  const height = Math.round((GRID_LAT_MAX - GRID_LAT_MIN) / step) + 1;
  const uAcc    = new Float64Array(width * height); // accumulator
  const vAcc    = new Float64Array(width * height);
  const wAcc    = new Float64Array(width * height); // weight sum
  const typeAcc = new Float64Array(width * height); // +w warm, -w cold

  // Typical peak speeds (m/s) and spread (σ, degrees) per current type
  const PARAMS = {
    warm: { speed: 0.55, sigma: 5 },
    cold: { speed: 0.35, sigma: 6 },
  };

  OCEAN_CURRENTS.forEach(current => {
    const { speed, sigma } = PARAMS[current.type];
    const coords = current.coords;
    const r = Math.ceil(sigma * 2.5 / step); // influence radius in cells

    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const dLon = lon2 - lon1, dLat = lat2 - lat1;
      const dist = Math.sqrt(dLon * dLon + dLat * dLat);
      if (dist < 1e-6) continue;

      // Velocity components (u = eastward, v = northward)
      const segU = (dLon / dist) * speed;
      const segV = (dLat / dist) * speed;

      // Sample midpoint of segment
      const mLon = (lon1 + lon2) / 2, mLat = (lat1 + lat2) / 2;
      const cCol = (mLon - GRID_LON_MIN) / step;
      const cRow = (GRID_LAT_MAX - mLat) / step;

      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          const col = Math.round(cCol) + dc;
          const row = Math.round(cRow) + dr;
          if (col < 0 || col >= width || row < 0 || row >= height) continue;

          const cellLon = GRID_LON_MIN + col * step;
          const cellLat = GRID_LAT_MAX - row * step;
          const d2 = (cellLon - mLon) ** 2 + (cellLat - mLat) ** 2;
          const w  = Math.exp(-d2 / (2 * sigma * sigma));
          if (w < 0.005) continue;

          uAcc[row * width + col]    += segU * w;
          vAcc[row * width + col]    += segV * w;
          wAcc[row * width + col]    += w;
          typeAcc[row * width + col] += (current.type === 'warm' ? 1 : -1) * w;
        }
      }
    }
  });

  // Normalise by accumulated weight so overlapping currents blend correctly
  const u       = new Float32Array(width * height);
  const v       = new Float32Array(width * height);
  const warmth  = new Float32Array(width * height); // -1 cold … +1 warm
  for (let i = 0; i < u.length; i++) {
    if (wAcc[i] > 0.01) {
      u[i]      = uAcc[i]    / wAcc[i];
      v[i]      = vAcc[i]    / wAcc[i];
      warmth[i] = typeAcc[i] / wAcc[i];
    }
  }

  return {
    step, width, height,
    latMin: GRID_LAT_MIN, latMax: GRID_LAT_MAX,
    lonMin: GRID_LON_MIN, lonMax: GRID_LON_MAX,
    u: Array.from(u), v: Array.from(v), warmth: Array.from(warmth),
  };
}

/* ── ERDDAP → velocity grid ─────────────────────────────────────────────────── */
// Converts the raw ERDDAP griddap JSON table returned by /api/currents-live
// into the flat { step, width, height, latMin, latMax, lonMin, lonMax, u[], v[] }
// object used by the particle animation engine.
function buildGrid(raw) {
  const step   = GRID_STEP;
  const width  = Math.round((GRID_LON_MAX - GRID_LON_MIN) / step) + 1;
  const height = Math.round((GRID_LAT_MAX - GRID_LAT_MIN) / step) + 1;

  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);

  const cols = raw.table.columnNames;
  const latI = cols.indexOf('latitude');
  const lonI = cols.indexOf('longitude');
  const uI   = cols.indexOf('ugos');
  const vI   = cols.indexOf('vgos');

  for (const row of raw.table.rows) {
    const lat = row[latI], lon = row[lonI];
    const uv  = row[uI],   vv  = row[vI];
    if (lat == null || lon == null || uv == null || vv == null) continue;
    const col  = Math.round((lon - GRID_LON_MIN) / step);
    const rowI = Math.round((GRID_LAT_MAX - lat) / step); // row 0 = north
    if (col < 0 || col >= width || rowI < 0 || rowI >= height) continue;
    u[rowI * width + col] = uv;
    v[rowI * width + col] = vv;
  }

  return {
    step, width, height,
    latMin: GRID_LAT_MIN, latMax: GRID_LAT_MAX,
    lonMin: GRID_LON_MIN, lonMax: GRID_LON_MAX,
    u: Array.from(u),
    v: Array.from(v),
  };
}

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

// -1 = cold current, 0 = neutral, +1 = warm current
function getWarmth(lat, lon) {
  if (!velocityGrid?.warmth) return 0;
  const { x, y } = toGridXY(lat, lon, velocityGrid);
  return bilinear(velocityGrid.warmth, velocityGrid.width, velocityGrid.height, x, y);
}

/* ── Particle management ────────────────────────────────────────────────────── */
function randomParticle() {
  let lat, lon;
  if (liveCurrentsMap) {
    // Spawn within the current viewport so density stays constant at all zoom levels.
    // Pad slightly so trails don't pop in right at the edge.
    const b = liveCurrentsMap.getBounds().pad(0.05);
    lat = b.getSouth() + Math.random() * (b.getNorth() - b.getSouth());
    lon = b.getWest()  + Math.random() * (b.getEast()  - b.getWest());
    lat = Math.max(GRID_LAT_MIN, Math.min(GRID_LAT_MAX, lat));
    // Normalise longitude to –180…180
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
  } else {
    lat = Math.random() * 160 - 80;
    lon = Math.random() * 360 - 180;
  }
  return { lat, lon, age: Math.floor(Math.random() * MAX_AGE) };
}

function initParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, randomParticle);
}

/* ── Speed + warmth → colour ────────────────────────────────────────────────── */
// warmth: -1 = cold (blue), 0 = neutral (teal), +1 = warm (orange)
// t (0-1) controls brightness within each hue band.
function speedColor(speed, warmth) {
  const t = Math.min(1, speed / 1.2);
  const a = 0.3 + t * 0.7; // opacity: dim when slow, bright when fast

  if (warmth > 0.25) {
    // Warm current: muted amber → bright orange (#fb923c family)
    const r = Math.round(160 + t * 91);   // 160 → 251
    const g = Math.round(80  + t * 66);   // 80  → 146
    const b = Math.round(20  + t * 40);   // 20  → 60
    return `rgba(${r},${g},${b},${a})`;
  }
  if (warmth < -0.25) {
    // Cold current: muted steel → bright cyan (#38bdf8 family)
    const r = Math.round(30  + t * 26);   // 30  → 56
    const g = Math.round(100 + t * 89);   // 100 → 189
    const b = Math.round(160 + t * 88);   // 160 → 248
    return `rgba(${r},${g},${b},${a})`;
  }
  // Neutral / no-data: existing teal-cyan ramp
  if (t < 0.3) {
    const v = Math.round(80 + t / 0.3 * 60);
    return `rgba(${v},${v + 20},${v + 40},${0.3 + t * 0.4})`;
  }
  const r = Math.round(40  + t * 215);
  const g = Math.round(160 + t * 95);
  const b = Math.round(200 + t * 55);
  return `rgba(${r},${g},${b},${0.5 + t * 0.5})`;
}

/* ── Animation loop ─────────────────────────────────────────────────────────── */
function animateCurrents() {
  if (!liveCurrentsActive) return;
  animFrameId = requestAnimationFrame(animateCurrents);

  const ctx    = liveCurrentsCtx;
  const canvas = liveCurrentsCanvas;
  const map    = liveCurrentsMap;
  if (!ctx || !canvas || !map) return;

  // Fade the previous frame — destination-out reduces existing pixel alpha
  // toward transparent rather than painting a dark colour, so quiet ocean
  // areas stay see-through and the map tiles show through underneath.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0, 0, 0, ${1 - TRAIL_OPACITY})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  particles.forEach(p => {
    p.age++;
    if (p.age > MAX_AGE) {
      Object.assign(p, randomParticle());
      return;
    }

    const { u, v } = getVelocity(p.lat, p.lon);
    const speed   = Math.sqrt(u * u + v * v);
    const warmth  = getWarmth(p.lat, p.lon);
    // Only skip truly zero cells (land/missing data). Slow ocean currents down to
    // ~3 mm/s are still real signal and should animate — raising this threshold
    // is what made the Mediterranean and other slow-current regions appear static.
    if (speed < 0.003) { p.age = MAX_AGE; return; }

    // Convert lat/lon to canvas pixel
    const ptA = map.latLngToContainerPoint([p.lat, p.lon]);

    // Advance position — u is east (+lon), v is north (+lat)
    // Divide by 2^(zoom-2) so pixel velocity stays roughly constant:
    // higher zoom = more px/° so we need fewer degrees per frame.
    const zoom  = map.getZoom();
    const scale = SPEED_SCALE / Math.pow(2, zoom - 2);
    p.lon += u * scale / (111320 * Math.cos(p.lat * Math.PI / 180));
    p.lat += v * scale / 111320;

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
    // speedColor already returns rgba(...); multiply its alpha by lifeFrac alpha
    ctx.strokeStyle = speedColor(speed, warmth).replace(/[\d.]+\)$/, `${alpha})`);
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
  if (!window.L || liveCurrentsMap) return; // prevent double-init

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

  // ── Velocity grid: static-first, live-upgrade strategy ───────────────────
  // 1. Immediately start the animation with the static grid (built from the
  //    OCEAN_CURRENTS paths — no network, always works, correct directions).
  // 2. Attempt to load real-time ERDDAP data in the background; if it arrives,
  //    silently swap in the live grid so the animation upgrades without any
  //    visible interruption.
  const statusEl = document.getElementById('liveCurrentsStatus');

  // ── Start immediately with static grid ────────────────────────────────────
  velocityGrid = buildStaticGrid();
  if (statusEl) statusEl.style.display = 'none';

  initParticles();
  liveCurrentsActive = true;

  liveCurrentsMap.on('movestart', () => {
    liveCurrentsCtx.clearRect(0, 0, liveCurrentsCanvas.width, liveCurrentsCanvas.height);
  });
  // Respawn all particles within the new viewport after zooming
  liveCurrentsMap.on('zoomend', () => {
    liveCurrentsCtx.clearRect(0, 0, liveCurrentsCanvas.width, liveCurrentsCanvas.height);
    initParticles();
  });

  animateCurrents();

  // ── Background: try to upgrade to live ERDDAP data ────────────────────────
  // NOAA PFEG blocks Cloudflare IPs so the Worker proxy is unreliable.
  // CORS is not enabled on coastwatch.pfeg.noaa.gov so direct browser
  // fetch is blocked too.  Both attempts are best-effort; failure is silent.
  ;(async () => {
    const ERDDAP_DIRECT =
      'https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisSSH1day.json' +
      '?ugos[(last):1:(last)][(-80.0):16:(80.0)][(-180.0):16:(180.0)]' +
      ',vgos[(last):1:(last)][(-80.0):16:(80.0)][(-180.0):16:(180.0)]';

    let data = null;

    // Try Worker proxy (KV-cached)
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      const res  = await fetch('/api/currents-live', { signal: ctrl.signal });
      clearTimeout(tid);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('json')) {
        const j = await res.json();
        if (!j.error) data = j;
      }
    } catch (_) { /* silent — static grid already running */ }

    // Try direct ERDDAP (works only if server adds CORS in future)
    if (!data) {
      try {
        const res = await fetch(ERDDAP_DIRECT, { headers: { Accept: 'application/json' } });
        const ct  = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('json')) {
          const j = await res.json();
          if (j.table) data = j;
        }
      } catch (_) { /* silent */ }
    }

    if (data) {
      // Silently upgrade to live data — animation keeps running uninterrupted
      velocityGrid = data.table ? buildGrid(data) : data;
    }
  })();
}

function stopLiveCurrents() {
  liveCurrentsActive = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
}
