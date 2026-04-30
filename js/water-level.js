// ── City data ─────────────────────────────────────────────────────────────────
// eustaticRate: current global average from satellite altimetry (IPCC AR6)
// relativeRate: what the city actually experiences (eustatic + local subsidence)
// Source: IPCC AR6 WG1 Ch.9, PSMSL tide gauge records, peer-reviewed subsidence literature

const WL_CITIES = [
  {
    id: 'jakarta',
    name: 'Jakarta', country: 'Indonesia',
    lat: -6.15, lon: 106.85,
    eustaticRate: 3.6, relativeRate: 80,
    cause: 'subsidence',
    detail: 'Parts of North Jakarta have sunk more than 4 metres since the 1970s due to groundwater extraction and urban load. The global sea level component is a fraction of the total — some neighbourhoods are sinking at 25 cm per year.',
  },
  {
    id: 'bangkok',
    name: 'Bangkok', country: 'Thailand',
    lat: 13.75, lon: 100.52,
    eustaticRate: 3.6, relativeRate: 20,
    cause: 'subsidence',
    detail: 'Bangkok sits on soft delta clay. Decades of groundwater extraction have caused widespread subsidence — parts of the city sink 10–30 mm per year, far outpacing any eustatic contribution.',
  },
  {
    id: 'hcmc',
    name: 'Ho Chi Minh City', country: 'Vietnam',
    lat: 10.78, lon: 106.70,
    eustaticRate: 3.6, relativeRate: 16,
    cause: 'subsidence',
    detail: 'The Mekong Delta is sinking under rapid urbanisation and sand extraction. Relative sea level rise in southern Vietnam is 3–4× the global average, threatening the delta\'s agricultural land and freshwater supply.',
  },
  {
    id: 'new-orleans',
    name: 'New Orleans', country: 'United States',
    lat: 29.95, lon: -90.07,
    eustaticRate: 3.6, relativeRate: 9,
    cause: 'subsidence',
    detail: 'Much of New Orleans already sits below sea level — kept dry by levees. Sediment compaction and fluid extraction drive subsidence, while eustatic rise steadily raises the flood baseline the city must defend against.',
  },
  {
    id: 'maldives',
    name: 'Maldives', country: 'Indian Ocean',
    lat: 3.2, lon: 73.22,
    eustaticRate: 3.6, relativeRate: 4,
    cause: 'eustatic',
    detail: 'With an average elevation of 1.5 metres, the Maldives has almost no buffer against sea level rise. There is no high ground to retreat to. The government has begun constructing Hulhumalé — a raised artificial island built to house the population.',
  },
  {
    id: 'kiribati',
    name: 'Kiribati', country: 'Pacific Ocean',
    lat: 1.33, lon: 172.98,
    eustaticRate: 3.6, relativeRate: 4,
    cause: 'eustatic',
    detail: 'The government of Kiribati has purchased land in Fiji as a potential relocation site. Storm surge already regularly floods freshwater reserves and agricultural land. Wind-driven sea level variability pushes local rise above the global mean.',
  },
  {
    id: 'solomon-islands',
    name: 'Solomon Islands', country: 'Pacific Ocean',
    lat: -9.43, lon: 160.03,
    eustaticRate: 3.6, relativeRate: 7,
    cause: 'eustatic',
    detail: 'Five of the Solomon Islands\' low-lying islands have already been lost to the sea. Local rise is amplified by tectonic subsidence and wind-driven sea level variability in the western Pacific — well above the global average.',
  },
  {
    id: 'venice',
    name: 'Venice', country: 'Italy',
    lat: 45.44, lon: 12.33,
    eustaticRate: 3.6, relativeRate: 3,
    cause: 'mixed',
    detail: 'The MOSE flood barrier, completed in 2020, now protects Venice from the worst acqua alta events. But barriers delay — they do not reverse — the underlying trend. Sea level is projected to overtop the barriers by 2100 under high-emission scenarios.',
  },
  {
    id: 'miami',
    name: 'Miami', country: 'United States',
    lat: 25.77, lon: -80.19,
    eustaticRate: 3.6, relativeRate: 5,
    cause: 'eustatic',
    detail: 'Miami sits on porous limestone — conventional flood barriers are physically impossible here. Seawater already bubbles up through bedrock during king tides. The city is raising roads and infrastructure at enormous cost, buying decades rather than centuries.',
  },
  {
    id: 'mumbai',
    name: 'Mumbai', country: 'India',
    lat: 19.08, lon: 72.88,
    eustaticRate: 3.6, relativeRate: 4,
    cause: 'eustatic',
    detail: 'Mumbai\'s 20 million residents face compound risk: eustatic rise, intensifying monsoon rainfall, and a low-lying geography shaped by centuries of land reclamation. Both the eastern and western waterfronts are exposed.',
  },
  {
    id: 'bangladesh',
    name: 'Bangladesh Coast', country: 'Bangladesh',
    lat: 22.35, lon: 90.40,
    eustaticRate: 3.6, relativeRate: 14,
    cause: 'mixed',
    detail: 'The Ganges–Brahmaputra delta is sinking as the Bay of Bengal rises. Cyclone storm surges that once struck once a generation now arrive every few years. Around 20 million people live in the coastal at-risk zone — one of the largest climate displacement threats on Earth.',
  },
  {
    id: 'rotterdam',
    name: 'Rotterdam', country: 'Netherlands',
    lat: 51.92, lon: 4.48,
    eustaticRate: 3.6, relativeRate: 3,
    cause: 'mixed',
    detail: 'Two-thirds of the Netherlands lies below sea level or at flood risk. Rotterdam\'s Maeslant Barrier and the broader Delta Works system are among the world\'s most sophisticated flood defences — but they require continuous adaptation as the sea level baseline rises.',
  },
];

// ── State ─────────────────────────────────────────────────────────────────────

let wlMap = null;
let wlActiveMarkerId = null;
let wlSparklineData = null;

// ── Init ──────────────────────────────────────────────────────────────────────

function initWaterLevelSection() {
  fetchGMSLData();
  initWaterLevelMap();
}

// ── GMSL data & sparkline ─────────────────────────────────────────────────────

async function fetchGMSLData() {
  const statusEl = document.getElementById('wlGmslStatus');
  try {
    const res = await fetch('/api/sea-level');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderGMSL(data);
  } catch {
    if (statusEl) statusEl.textContent = 'Data temporarily unavailable · NASA JPL/PO.DAAC';
  }
}

function renderGMSL({ currentRate, totalRise, latestYear, sparkline }) {
  const rateEl    = document.getElementById('wlGmslRate');
  const totalEl   = document.getElementById('wlGmslTotal');
  const statusEl  = document.getElementById('wlGmslStatus');
  const endLblEl  = document.getElementById('wlSparklineEnd');

  if (rateEl)   rateEl.textContent  = `+${currentRate} mm/yr`;
  if (totalEl)  totalEl.textContent = `+${totalRise} mm since 1993`;
  if (statusEl) statusEl.textContent = `NASA JPL/PO.DAAC merged altimetry · 1993–${latestYear}`;
  if (endLblEl) endLblEl.textContent = String(latestYear);

  wlSparklineData = sparkline;
  renderSparkline(sparkline);
}

function renderSparkline(points) {
  const svg = document.getElementById('wlSparkline');
  if (!svg || !points || points.length < 2) return;

  const W    = 600;
  const H    = 60;
  const padX = 2;
  const padY = 4;

  const vals    = points.map(p => p.value);
  const years   = points.map(p => p.year);
  const minVal  = Math.min(...vals);
  const maxVal  = Math.max(...vals);
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  const sx = yr  => padX + (yr - minYear)  / (maxYear - minYear)  * (W - 2 * padX);
  const sy = val => H - padY - (val - minVal) / (maxVal - minVal) * (H - 2 * padY);

  const pts   = points.map(p => [sx(p.year), sy(p.value)]);
  const lineD = `M ${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')}`;
  const fillD = `${lineD} L ${pts[pts.length - 1][0].toFixed(1)},${H} L ${pts[0][0].toFixed(1)},${H} Z`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="wlSparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#38bdf8" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${fillD}" fill="url(#wlSparkGrad)"/>
    <path d="${lineD}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

// ── Leaflet map ───────────────────────────────────────────────────────────────

function initWaterLevelMap() {
  if (typeof L === 'undefined') return;

  wlMap = L.map('wlMap', {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 14,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, Aerogrid, IGN',
    maxZoom: 19,
  }).addTo(wlMap);

  WL_CITIES.forEach((city, i) => {
    const marker = L.marker([city.lat, city.lon], {
      icon: createPulseIcon(i * 0.22),
      title: city.name,
    }).addTo(wlMap);

    marker.on('click', () => selectCity(city, marker));
  });
}

function createPulseIcon(delaySec) {
  return L.divIcon({
    className: 'wl-marker-wrap',
    html: `<div class="wl-marker-ring" style="animation-delay:${delaySec}s"></div><div class="wl-marker-dot"></div>`,
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });
}

function selectCity(city, marker) {
  wlMap.flyTo([city.lat, city.lon], 8, { duration: 1.2, easeLinearity: 0.4 });
  wlActiveMarkerId = city.id;

  document.querySelectorAll('.wl-marker-wrap').forEach(el => el.classList.remove('wl-marker-active'));
  marker.getElement()?.classList.add('wl-marker-active');

  renderCityPanel(city);
}

// ── City panel ────────────────────────────────────────────────────────────────

function renderCityPanel(city) {
  const panel = document.getElementById('wlCityPanel');
  if (!panel) return;

  const subsidence  = +(city.relativeRate - city.eustaticRate).toFixed(1);
  const isHighLocal = city.relativeRate > city.eustaticRate + 1;
  const causeLabel  = { subsidence: 'Subsidence-driven', eustatic: 'Eustatic', mixed: 'Mixed' }[city.cause];

  panel.innerHTML = `
    <div class="wl-city-name">${city.name}</div>
    <div class="wl-city-country">${city.country}</div>
    <div class="wl-city-rates">
      <div class="wl-rate-row">
        <span class="wl-rate-label">Local rate</span>
        <span class="wl-rate-value${isHighLocal ? ' wl-rate-high' : ' wl-rate-global'}">+${city.relativeRate} mm/yr</span>
      </div>
      <div class="wl-rate-row">
        <span class="wl-rate-label">Global average</span>
        <span class="wl-rate-value wl-rate-global">+${city.eustaticRate} mm/yr</span>
      </div>
      ${subsidence > 0.5 ? `
      <div class="wl-rate-row">
        <span class="wl-rate-label">Land subsidence</span>
        <span class="wl-rate-value wl-rate-high">+${subsidence} mm/yr</span>
      </div>` : ''}
    </div>
    <span class="wl-cause-badge wl-cause-${city.cause}">${causeLabel}</span>
    <p class="wl-city-detail">${city.detail}</p>
  `;
}
