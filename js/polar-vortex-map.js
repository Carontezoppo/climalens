// Animated polar vortex map — 10 hPa wind particles (coloured by speed or
// temperature) + geopotential height contours
// over the polar cap (30°–pole), seen from directly above the pole.
// Data: /api/polar-vortex-map (Open-Meteo ECMWF). Hemisphere follows the selected
// city, like the strength chart; loadVortexData() in polar-vortex.js calls loadVortexMap().

// The map is a fixed dark surface in both themes, like the live currents map,
// so its palette is set here rather than read from the theme.
const VMAP_COLORS = {
  disc:    '#0e121a',
  land:    '#1f2533',
  coast:   'rgba(255,255,255,0.30)',
  edge:    'rgba(255,255,255,0.14)',
  ring60:  'rgba(255,255,255,0.7)',
  contour: 'rgba(129,140,248,0.80)', // --pressure (dark theme)
  contourTemp: 'rgba(255,255,255,0.55)', // indigo would blur into the cold end of the temperature ramp
  label:   'rgba(232,234,240,0.75)',
};
const VMAP_EDGE_LAT   = 30;
const VMAP_EDGE       = Math.cos(VMAP_EDGE_LAT * Math.PI / 180); // disc radius in globe radii
const VMAP_MAX_SPEED  = 80;      // m/s at the top of the speed ramp
// Fixed, so days stay comparable and a warming stands out: a midwinter core sits
// near −80 °C, a warming can push the pole above −30 °C
const VMAP_TEMP_MIN   = -90, VMAP_TEMP_MAX = -10;
const VMAP_SPEED      = 1.1e-4;  // globe radii per frame per m/s
const VMAP_MAX_AGE    = 90;      // frames before a particle respawns
const VMAP_TRAIL      = 0.96;    // share of the previous frame kept each frame

const vmap = {
  hemi: null, data: null, dataCache: {}, land: null,
  wrap: null, bg: null, fx: null, ov: null,
  w: 0, h: 0, cx: 0, cy: 0, R: 0, discR: 0,
  particles: [], raf: null, paused: false, visible: false, mode: 'speed',
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
};

const vmapLandPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')
  .then(r => r.ok ? r.json() : null).catch(() => null);

/* ── Projection (orthographic, centred on the pole, 0° at the bottom in the
      north and at the top in the south — the usual orientation for each) ── */
function vmapSign() { return vmap.hemi === 'n' ? 1 : -1; }

function vmapProject(lat, lon) {
  const s = vmapSign();
  const phi = Math.max(0, s * lat) * Math.PI / 180; // clamp the far hemisphere to the equator
  const d = lon * Math.PI / 180;
  const rho = Math.cos(phi) * vmap.R;
  return [vmap.cx + rho * Math.sin(d), vmap.cy + s * rho * Math.cos(d)];
}

/* ── Grid sampling ─────────────────────────────────────────────────────── */
function vmapSample(field, absLat, lon) {
  const { width, height, latMin, step } = vmap.data;
  const y = Math.min(height - 1, Math.max(0, (absLat - latMin) / step));
  let x = ((lon + 180) / step) % width; if (x < 0) x += width;
  const x0 = Math.floor(x), x1 = (x0 + 1) % width, y0 = Math.floor(y), y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = field[y0 * width + x0], b = field[y0 * width + x1];
  const c = field[y1 * width + x0], d = field[y1 * width + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/* ── Particles: positions live in screen space, because stepping in lat/lon
      blows up near the pole where a degree of longitude shrinks to nothing ── */
function vmapSpawn(p) {
  const r = Math.sqrt(Math.random()) * vmap.discR, a = Math.random() * 2 * Math.PI;
  p.x = vmap.cx + r * Math.cos(a);
  p.y = vmap.cy + r * Math.sin(a);
  p.age = Math.floor(Math.random() * VMAP_MAX_AGE);
  return p;
}

// Screen velocity (px/frame) and speed (m/s) at a screen point, or null outside the disc
function vmapVelocity(x, y) {
  const s = vmapSign();
  const dx = x - vmap.cx, dy = y - vmap.cy;
  const rho = Math.hypot(dx, dy) / vmap.R;
  if (rho > VMAP_EDGE) return null;
  const absLat = Math.acos(rho) * 180 / Math.PI;
  const d = Math.atan2(dx, s * dy);
  const lon = d * 180 / Math.PI;
  const u = vmapSample(vmap.data.u, absLat, lon);
  const v = vmapSample(vmap.data.v, absLat, lon);
  const sinPhi = Math.sqrt(1 - rho * rho); // orthographic shortens north–south by sin φ
  const sd = Math.sin(d), cd = Math.cos(d);
  const k = VMAP_SPEED * vmap.R;
  return {
    vx: k * (u * cd - v * sinPhi * s * sd),
    vy: k * (-u * s * sd - v * sinPhi * cd),
    speed: Math.hypot(u, v),
    temp: vmap.mode === 'temperature' ? vmapSample(vmap.data.t, absLat, lon) : null,
  };
}

// Temperature: blue → grey → orange, the live currents map's cold/warm colours
// (--temp-low-chart / --temp-high-chart, dark theme) with a neutral midpoint
const VMAP_TEMP_STOPS = [[56, 189, 248], [176, 184, 200], [251, 146, 60]];

function vmapColor(vel, alpha) {
  if (vmap.mode === 'temperature') {
    const t = Math.min(1, Math.max(0, (vel.temp - VMAP_TEMP_MIN) / (VMAP_TEMP_MAX - VMAP_TEMP_MIN))) * 2;
    const i = Math.min(1, Math.floor(t)), f = t - i;
    const [a, b] = [VMAP_TEMP_STOPS[i], VMAP_TEMP_STOPS[i + 1]];
    const c = a.map((x, k) => Math.round(x + (b[k] - x) * f));
    return `rgba(${c[0]},${c[1]},${c[2]},${0.85 * alpha})`;
  }
  // Speed: same teal → cyan → white ramp as the live currents map in speed mode
  const t = Math.min(1, vel.speed / VMAP_MAX_SPEED);
  const r = Math.round(40 + t * 215), g = Math.round(130 + t * 125), b = Math.round(160 + t * 95);
  return `rgba(${r},${g},${b},${(0.3 + t * 0.7) * alpha})`;
}

function vmapFrame() {
  const ctx = vmap.fx.getContext('2d');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${1 - VMAP_TRAIL})`;
  ctx.fillRect(0, 0, vmap.w, vmap.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1.5;

  for (const p of vmap.particles) {
    if (++p.age > VMAP_MAX_AGE) { vmapSpawn(p); p.age = 0; continue; }
    const vel = vmapVelocity(p.x, p.y);
    if (!vel) { vmapSpawn(p); p.age = 0; continue; }
    const x0 = p.x, y0 = p.y;
    p.x += vel.vx; p.y += vel.vy;
    const life = p.age / VMAP_MAX_AGE;
    const alpha = life < 0.1 ? life / 0.1 : life > 0.85 ? (1 - life) / 0.15 : 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = vmapColor(vel, alpha);
    ctx.stroke();
  }
}

function vmapLoop() {
  vmap.raf = null;
  if (!vmapShouldRun()) return;
  vmapFrame();
  vmap.raf = requestAnimationFrame(vmapLoop);
}

function vmapShouldRun() {
  return vmap.data && vmap.visible && !vmap.paused && !document.hidden && !vmap.reduceMotion.matches;
}

function vmapUpdateRunning() {
  if (vmapShouldRun()) { if (!vmap.raf) vmap.raf = requestAnimationFrame(vmapLoop); }
  else if (vmap.raf) { cancelAnimationFrame(vmap.raf); vmap.raf = null; }
}

// Reduced motion: one still frame of short streaks traced along the flow
function vmapDrawStill() {
  const ctx = vmap.fx.getContext('2d');
  ctx.clearRect(0, 0, vmap.w, vmap.h);
  ctx.lineWidth = 1.2;
  const n = vmap.particles.length;
  for (let i = 0; i < n; i++) {
    const p = vmapSpawn({});
    for (let k = 0; k < 20; k++) {
      const vel = vmapVelocity(p.x, p.y);
      if (!vel) break;
      const x0 = p.x, y0 = p.y;
      p.x += vel.vx * 2; p.y += vel.vy * 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = vmapColor(vel, (k + 1) / 20);
      ctx.stroke();
    }
  }
}

/* ── Static layers: disc + land below the particles, contours + 60° ring above ── */
function vmapDiscPath(ctx) {
  ctx.beginPath();
  ctx.arc(vmap.cx, vmap.cy, vmap.discR, 0, 2 * Math.PI);
}

function vmapDrawBase() {
  const ctx = vmap.bg.getContext('2d');
  ctx.clearRect(0, 0, vmap.w, vmap.h);
  vmapDiscPath(ctx);
  ctx.fillStyle = VMAP_COLORS.disc;
  ctx.fill();
  if (!vmap.land) return;

  const s = vmapSign();
  ctx.save();
  vmapDiscPath(ctx); ctx.clip();

  // Land fill — rings that sit wholly in the other hemisphere would collapse
  // onto the equator circle and fill the whole disc, so skip them
  ctx.beginPath();
  for (const poly of vmap.land.fill) {
    for (const ring of poly) {
      if (!ring.some(([, lat]) => s * lat > 10)) continue;
      ring.forEach(([lon, lat], i) => {
        const [x, y] = vmapProject(lat, lon);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fillStyle = VMAP_COLORS.land;
  ctx.fill('evenodd');

  // Coastlines — skip the antimeridian seam and the run along the South Pole
  ctx.beginPath();
  for (const line of vmap.land.coast) {
    for (let i = 1; i < line.length; i++) {
      const [lon0, lat0] = line[i - 1], [lon1, lat1] = line[i];
      if (s * lat0 < 10 && s * lat1 < 10) continue;
      if (Math.abs(lat0) > 89.5 && Math.abs(lat1) > 89.5) continue;
      if (Math.abs(lon0) === 180 && Math.abs(lon1) === 180) continue;
      if (Math.abs(lon1 - lon0) > 180) continue;
      const a = vmapProject(lat0, lon0), b = vmapProject(lat1, lon1);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
  }
  ctx.strokeStyle = VMAP_COLORS.coast;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

// Contour spacing: the smallest of these that gives at most 7 lines
function vmapContourStep(z) {
  let lo = Infinity, hi = -Infinity;
  for (const v of z) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [100, 200, 400, 800].find(c => (hi - lo) / c <= 7) || 800;
}

function vmapDrawOverlay() {
  const ctx = vmap.ov.getContext('2d');
  ctx.clearRect(0, 0, vmap.w, vmap.h);
  const { width, height, latMin, step, z } = vmap.data;
  const s = vmapSign();

  ctx.save();
  vmapDiscPath(ctx); ctx.clip();

  // Marching squares over the grid, plus a virtual pole row (mean of the last row)
  // so the innermost contour closes instead of stopping at 85°
  const last = z.slice((height - 1) * width);
  const poleZ = last.reduce((a, b) => a + b, 0) / width;
  const zAt = (r, c) => r === height ? poleZ : z[r * width + (c % width)];
  const latAt = r => s * (r === height ? 90 : latMin + r * step);
  const cStep = vmapContourStep(z);
  let lo = Infinity, hi = -Infinity;
  for (const v of z) { if (v < lo) lo = v; if (v > hi) hi = v; }

  ctx.beginPath();
  for (let level = Math.ceil(lo / cStep) * cStep; level <= hi; level += cStep) {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        // Corners: 0 = (r,c), 1 = (r,c+1), 2 = (r+1,c+1), 3 = (r+1,c)
        const corners = [[r, c], [r, c + 1], [r + 1, c + 1], [r + 1, c]];
        const vals = corners.map(([rr, cc]) => zAt(rr, cc));
        let idx = 0;
        vals.forEach((v, i) => { if (v >= level) idx |= 1 << i; });
        if (idx === 0 || idx === 15) continue;
        // Crossing point on each edge whose ends straddle the level
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const i = e, j = (e + 1) % 4;
          if ((vals[i] >= level) === (vals[j] >= level)) continue;
          const f = (level - vals[i]) / (vals[j] - vals[i]);
          const lat = latAt(corners[i][0]) + (latAt(corners[j][0]) - latAt(corners[i][0])) * f;
          const lon = -180 + (corners[i][1] + (corners[j][1] - corners[i][1]) * f) * step;
          pts.push(vmapProject(lat, lon));
        }
        for (let k = 0; k + 1 < pts.length; k += 2) {
          ctx.moveTo(pts[k][0], pts[k][1]);
          ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
        }
      }
    }
  }
  ctx.strokeStyle = vmap.mode === 'temperature' ? VMAP_COLORS.contourTemp : VMAP_COLORS.contour;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 60° ring — the latitude the strength chart measures
  const r60 = vmap.R * Math.cos(60 * Math.PI / 180);
  ctx.beginPath();
  ctx.arc(vmap.cx, vmap.cy, r60, 0, 2 * Math.PI);
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = VMAP_COLORS.ring60;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.font = "10px 'DM Mono', monospace";
  ctx.fillStyle = VMAP_COLORS.label;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const a = -Math.PI / 4; // upper right
  ctx.fillText(s > 0 ? '60°N' : '60°S', vmap.cx + r60 * Math.cos(a) + 6, vmap.cy + r60 * Math.sin(a) - 6);

  vmapDiscPath(ctx);
  ctx.strokeStyle = VMAP_COLORS.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* ── Sizing ─────────────────────────────────────────────────────────────── */
function vmapResize() {
  const w = vmap.wrap.clientWidth, h = vmap.wrap.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  vmap.w = w; vmap.h = h;
  vmap.cx = w / 2; vmap.cy = h / 2;
  vmap.discR = Math.min(w, h) / 2 - 12;
  vmap.R = vmap.discR / VMAP_EDGE;
  for (const c of [vmap.bg, vmap.fx, vmap.ov]) {
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const count = Math.round(Math.PI * vmap.discR * vmap.discR / 200);
  vmap.particles = Array.from({ length: count }, () => vmapSpawn({}));
  vmapRedraw();
}

function vmapRedraw() {
  if (!vmap.data || !vmap.w) return;
  vmapDrawBase();
  vmapDrawOverlay();
  // Paused or reduced motion: nothing will repaint the particles, so show a still frame
  if (vmap.reduceMotion.matches || vmap.paused) vmapDrawStill();
  else vmap.fx.getContext('2d').clearRect(0, 0, vmap.w, vmap.h);
}

/* ── Side panel + screen-reader summary ────────────────────────────────── */
function vmapFmtLat(lat) { return `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`; }
function vmapFmtLon(lon) {
  lon = ((Math.round(lon) + 540) % 360) - 180;
  return lon === 0 || lon === -180 ? `${Math.abs(lon)}°` : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`;
}

function vmapDescribe() {
  const { width, height, latMin, step, u, v, z, t, time } = vmap.data;
  const s = vmapSign();
  let maxS = -1, maxI = 0, minZ = Infinity, minI = 0, minT = Infinity, minTI = 0, maxT = -Infinity, maxTI = 0;
  for (let i = 0; i < u.length; i++) {
    const sp = Math.hypot(u[i], v[i]);
    if (sp > maxS) { maxS = sp; maxI = i; }
    if (z[i] < minZ) { minZ = z[i]; minI = i; }
    if (t[i] < minT) { minT = t[i]; minTI = i; }
    if (t[i] > maxT) { maxT = t[i]; maxTI = i; }
  }
  const at = i => `${vmapFmtLat(s * (latMin + Math.floor(i / width) * step))} ${vmapFmtLon(-180 + (i % width) * step)}`;
  const coreRow = Math.floor(minI / width);

  const month = +time.slice(5, 7);
  const active = typeof VORTEX_SEASON === 'undefined' || VORTEX_SEASON[vmap.hemi].active.includes(month);
  const date = new Date(time);
  const when = `${date.getUTCDate()} ${VORTEX_MONTHS[date.getUTCMonth()]} ${String(date.getUTCHours()).padStart(2, '0')}:00 UTC`;
  const region = vmap.hemi === 'n' ? 'the Arctic' : 'Antarctica';

  let now;
  if (!active) {
    now = 'Summer circulation: the vortex has broken down for the year, so winds are light and the contours show no closed low over the pole.';
  } else {
    const core = coreRow >= height - 1 ? 'centred over the pole' : `centred near ${at(minI)}`;
    now = `Vortex core ${core}. Strongest wind ${Math.round(maxS)} m/s near ${at(maxI)}.`;
  }
  if (vmap.mode === 'temperature') {
    const deg = x => `${Math.round(x)}`.replace('-', '−') + ' °C';
    now += ` Coldest ${deg(minT)} near ${at(minTI)}, warmest ${deg(maxT)} near ${at(maxTI)}.`;
  }
  document.getElementById('vortexMapNow').textContent = now;
  document.getElementById('vortexMapTime').textContent = `ECMWF · ${when}`;
  document.getElementById('vortexMapContour').textContent = `every ${vmapContourStep(z)} m`;
  document.getElementById('vortexMapRing').textContent = s > 0 ? '60°N' : '60°S';
  document.getElementById('vortexMapCanvas').setAttribute('aria-label',
    `Map of winds at 10 hPa, about 30 km up, over ${region} on ${when}. ${now}`);
}

/* ── Public entry points ───────────────────────────────────────────────── */
function vmapInitDom() {
  if (vmap.wrap) return;
  vmap.wrap = document.getElementById('vortexMapWrap');
  vmap.bg = document.getElementById('vortexMapBase');
  vmap.fx = document.getElementById('vortexMapCanvas');
  vmap.ov = document.getElementById('vortexMapOverlay');

  new ResizeObserver(() => vmapResize()).observe(vmap.wrap);
  new IntersectionObserver(entries => {
    vmap.visible = entries[0].isIntersecting;
    vmapUpdateRunning();
  }).observe(vmap.wrap);
  document.addEventListener('visibilitychange', vmapUpdateRunning);
  vmap.reduceMotion.addEventListener('change', () => { vmapRedraw(); vmapUpdatePlayBtn(); vmapUpdateRunning(); });

  document.querySelectorAll('#vortexMapModeBar .currents-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => vmapSetMode(btn.dataset.mode));
  });

  document.getElementById('vortexMapPlayBtn').addEventListener('click', () => {
    vmap.paused = !vmap.paused;
    vmapUpdatePlayBtn();
    vmapUpdateRunning();
  });
  vmapUpdatePlayBtn();
}

function vmapSetMode(mode) {
  if (mode === vmap.mode) return;
  vmap.mode = mode;
  const isTemp = mode === 'temperature';
  document.querySelectorAll('#vortexMapModeBar .currents-mode-btn').forEach(b => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  document.getElementById('vortexMapSpeedKey').hidden = isTemp;
  document.getElementById('vortexMapTempKey').hidden = !isTemp;
  document.getElementById('vortexMapContourSwatch').classList.toggle('vortex-map-swatch-contour-temp', isTemp);
  if (!vmap.data) return;
  vmapDescribe();
  vmapRedraw(); // clears the old-colour trails and redraws the contours in the new colour
}

function vmapUpdatePlayBtn() {
  const btn = document.getElementById('vortexMapPlayBtn');
  btn.hidden = vmap.reduceMotion.matches; // nothing moves, so nothing to pause
  btn.textContent = vmap.paused ? '▶ Play' : '⏸ Pause';
  btn.setAttribute('aria-label', vmap.paused ? 'Play wind animation' : 'Pause wind animation');
}

async function loadVortexMap(hemi) {
  vmapInitDom();
  if (vmap.hemi === hemi && vmap.data) return;
  vmap.hemi = hemi;
  const status = document.getElementById('vortexMapStatus');
  status.textContent = 'Loading wind data…';
  status.style.color = '';
  status.hidden = false;

  try {
    if (!vmap.dataCache[hemi]) {
      const res = await fetch(`/api/polar-vortex-map?hemi=${hemi}`);
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      vmap.dataCache[hemi] = data;
    }
    if (!vmap.land) {
      const topo = await vmapLandPromise;
      if (topo && window.topojson) {
        vmap.land = {
          fill: topojson.feature(topo, topo.objects.land).features
            .flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates),
          coast: topojson.mesh(topo, topo.objects.land).coordinates,
        };
      }
    }
    if (vmap.hemi !== hemi) return; // the city changed hemisphere while loading
    vmap.data = vmap.dataCache[hemi];
    status.hidden = true;
    vmapDescribe();
    vmapResize();
    vmapUpdateRunning();
  } catch (err) {
    if (vmap.hemi !== hemi) return;
    vmap.data = null;
    vmapUpdateRunning();
    for (const c of [vmap.bg, vmap.fx, vmap.ov]) c.getContext('2d').clearRect(0, 0, vmap.w, vmap.h);
    status.textContent = 'Wind map unavailable: ' + err.message;
    status.style.color = 'var(--negative)';
  }
}
