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
    detail: 'The Mekong Delta is sinking under rapid urbanisation and sand extraction. Relative sea level rise in southern Vietnam is 3–4× the global average, threatening the delta\'s agricultural land and freshwater supply. <p>2026 revisions show that the sea level here was underestimated by nearly 1 metre due to ocean swell. Combined with rapid land sinking, parts of the city are effectively facing 2100-level risks today.',
    spatialProof: 'Mangrove and wetland coverage visible in WorldCover has contracted sharply across the delta. Those coastal forests were a natural tidal buffer — their loss directly amplifies storm surge impact inland and accelerates the salinity intrusion that is already poisoning freshwater sources.',
  },
  {
    id: 'new-orleans',
    name: 'New Orleans', country: 'United States',
    lat: 29.95, lon: -90.07,
    eustaticRate: 3.6, relativeRate: 9,
    cause: 'subsidence',
    detail: 'Much of New Orleans already sits below sea level — kept dry by levees. Sediment compaction and fluid extraction drive subsidence, while eustatic rise steadily raises the flood baseline the city must defend against.',
    spatialProof: 'Louisiana\'s coastal wetlands once formed a vast natural surge buffer between the Gulf of Mexico and the city. WorldCover reveals how much of this fringe has become open water — each kilometre of marsh lost reduces storm surge protection by roughly 8 cm.',
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
    spatialProof: 'The Everglades wetland boundary is visible just south of the city in WorldCover. Saltwater intrusion is already moving this line inland — not through sudden flooding, but through the slow percolation of seawater through porous limestone that no barrier can stop.',
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
    spatialProof: 'The Sundarbans mangrove forest at the delta\'s southern edge — the world\'s largest — is visible in WorldCover. The forest retreats on its seaward side faster than it can expand inland, shrinking the natural buffer between the Bay of Bengal and the communities behind it.',
  },
  {
    id: 'rotterdam',
    name: 'Rotterdam', country: 'Netherlands',
    lat: 51.92, lon: 4.48,
    eustaticRate: 3.6, relativeRate: 3,
    cause: 'mixed',
    detail: 'Two-thirds of the Netherlands lies below sea level or at flood risk. Rotterdam\'s Maeslant Barrier and the broader Delta Works system are among the world\'s most sophisticated flood defences — but they require continuous adaptation as the sea level baseline rises.',
  },
  {
    id: 'london',
    name: 'London', country: 'United Kingdom',
    lat: 51.51, lon: -0.12,
    eustaticRate: 3.2, relativeRate: 4.2,
    cause: 'isostatic',
    detail: 'While global seas rise, South East England is also sinking due to post-glacial isostatic adjustment (the "seesaw" effect as Scotland rises). The Thames Barrier, designed in the 1970s, is being used more frequently than anticipated to manage these compounding risks.',
  },
  {
    id: 'norfolk-va',
    name: 'Norfolk', country: 'USA',
    lat: 36.85, lon: -76.28,
    eustaticRate: 3.1, relativeRate: 5.1,
    cause: 'mixed',
    detail: 'Norfolk experiences some of the highest relative sea level rise on the US East Coast. This is caused by a combination of global rise, land subsidence from groundwater extraction, and the slowing of the Gulf Stream, which allows water to pile up along the coast.',
  },
  {
    id: 'hamburg',
    name: 'Hamburg', country: 'Germany',
    lat: 53.55, lon: 9.99,
    eustaticRate: 3.2, relativeRate: 3.5,
    cause: 'mixed',
    detail: 'As a major port 100km inland on the Elbe River, Hamburg is vulnerable to "storm surge stacking." Rising sea levels push more water into the river funnel, increasing the height and frequency of tidal surges that threaten its historic Speicherstadt district.',
  },
  {
    id: 'shanghai',
    name: 'Shanghai', country: 'China',
    lat: 31.23, lon: 121.47,
    eustaticRate: 3.2, relativeRate: 12.0,
    cause: 'mixed',
    detail: 'Shanghai sits on a low-lying swampy delta. While aggressive groundwater regulations have slowed subsidence recently, the city remains highly vulnerable to "compound flooding"—the simultaneous occurrence of high tides, storm surges, and heavy river runoff.',
  },
  {
    id: 'lagos',
    name: 'Lagos', country: 'Nigeria',
    lat: 6.45, lon: 3.40,
    eustaticRate: 3.5, relativeRate: 5.0,
    cause: 'eustatic',
    detail: 'As Africa\'s largest city, Lagos is built on a series of islands and sandbars. It is exceptionally vulnerable to eustatic rise and coastal erosion. Recent "Great Wall of Lagos" projects aim to protect new developments, but may increase erosion in older, poorer neighborhoods.',
  },
  {
    id: 'alexandria',
    name: 'Alexandria', country: 'Egypt',
    lat: 31.20, lon: 29.91,
    eustaticRate: 3.2, relativeRate: 5.0,
    cause: 'mixed',
    detail: 'The Nile Delta is sinking naturally due to the lack of new silt (trapped by the Aswan High Dam). This, combined with eustatic rise, threatens to displace millions and salinize the fertile agricultural land that feeds much of Egypt.',
    spatialProof: 'WorldCover shows the delta as dense cropland sitting just metres above sea level. Since the Aswan Dam cut the silt supply in 1970, this land has been sinking rather than growing — a delta that once gained ground against the sea now loses it.',
  },
  {
    id: 'galveston',
    name: 'Galveston/Houston', country: 'USA',
    lat: 29.30, lon: -94.79,
    eustaticRate: 3.1, relativeRate: 6.5,
    cause: 'mixed',
    detail: 'The Texas Gulf Coast faces high relative rise due to oil and gas extraction causing land subsidence. This amplifies the impact of increasingly intense hurricanes, leading to the proposed "Ike Dike" coastal spine project.',
  },
  {
    id: 'hull',
    name: 'Kingston upon Hull', country: 'UK',
    lat: 53.74, lon: -0.33,
    eustaticRate: 3.2, relativeRate: 4.5,
    cause: 'isostatic',
    detail: 'Hull is the UK\'s most at-risk city outside London. Because 90% of the city is already below the high-tide line, even the "minor" 25-30cm global underestimation identified in 2026 means their existing flood defenses are under significantly more stress than engineering specs intended.',
  },
  {
    id: 'charleston',
    name: 'Charleston', country: 'USA',
    lat: 32.77, lon: -79.93,
    eustaticRate: 3.1, relativeRate: 4.8,
    cause: 'oceanographic',
    detail: 'Recent data shows that the slowing of the Atlantic Meridional Overturning Circulation (AMOC) is causing water to "pile up" on the US East Coast. Charleston now sees "nuisance flooding" over 50 days a year—a frequency not expected until the 2040s.',
  },
  {
    id: 'dhaka',
    name: 'Dhaka/Ganges Delta', country: 'Bangladesh',
    lat: 23.81, lon: 90.41,
    eustaticRate: 3.3, relativeRate: 25.0,
    cause: 'subsidence',
    detail: 'New 2026 satellite data reveals that the Ganges-Brahmaputra Delta is compacting faster than thought. This "double whammy" of sinking land and a higher-than-assumed ocean baseline puts 15-20 million people in immediate danger of displacement by 2040.',
  },
  {
    id: 'osaka',
    name: 'Osaka', country: 'Japan',
    lat: 34.69, lon: 135.50,
    eustaticRate: 3.2, relativeRate: 3.8,
    cause: 'mixed',
    detail: 'Osaka is highly vulnerable to "compound surges." While it has excellent defenses, the 2026 study suggests that the baseline sea level in the Bay of Osaka is higher than the height used to design its older sea walls, narrowing the safety margin for typhoons.',
  },
  {
    id: 'perth',
    name: 'Perth', country: 'Australia',
    lat: -31.95, lon: 115.86,
    eustaticRate: 3.4, relativeRate: 4.2,
    cause: 'oceanographic',
    detail: 'Western Australia was identified as a region where previous models significantly missed the "swell" effect. Perth’s low-lying Swan River suburbs are seeing salt-water intrusion into parks and roads much earlier than the city\'s 2010-era climate plans predicted.',
  },
  {
    id: 'fairbourne',
    name: 'Fairbourne', country: 'Wales, UK',
    lat: 52.69, lon: -4.05,
    eustaticRate: 3.2, relativeRate: 4.0,
    cause: 'isostatic',
    detail: 'This is the UK\'s first "decommissioned" community. The council has decided it cannot afford to defend it past 2045. Residents aren\'t "underwater" yet, but their home values have vanished, and they are essentially "climate refugees in waiting" while the sun is still shining.',
  },
  {
    id: 'atlantic-city',
    name: 'Atlantic City', country: 'USA',
    lat: 39.36, lon: -74.42,
    eustaticRate: 3.1, relativeRate: 5.5,
    cause: 'subsidence',
    detail: 'The city is sinking while the sea rises. In the 1950s, Atlantic City saw minor flooding once or twice a year. Today, it happens 20–30 times a year. In 2026, many residents "feel" it not through floods, but through astronomical insurance premiums that make living there impossible.',
  },
  {
    id: 'freetown',
    name: 'Freetown', country: 'Sierra Leone',
    lat: 8.48, lon: -13.23,
    eustaticRate: 3.4, relativeRate: 5.0,
    cause: 'topographic',
    detail: 'New 2026 elevation mapping shows that informal settlements along the coast are much lower than satellite data previously suggested. High-tide floods now routinely mix with sewage, creating a permanent health crisis long before the buildings are fully submerged.',
  },
  {
    id: 'vancouver',
    name: 'Vancouver', country: 'Canada',
    lat: 49.28, lon: -123.12,
    eustaticRate: 3.0, relativeRate: 2.5,
    cause: 'oceanographic',
    detail: 'While the land is slightly rising (uplift), the Fraser River Delta is settling. The "surprise" here is salt-water intrusion. Long before the city sinks, the rising sea pushes salt into the water table, killing the billion-dollar agricultural industry in the surrounding valley.',
  },
  {
    id: 'shanghai-pudong',
    name: 'Shanghai (Pudong)', country: 'China',
    lat: 31.22, lon: 121.54,
    eustaticRate: 3.3, relativeRate: 10.0,
    cause: 'urban-loading',
    detail: 'The sheer weight of the skyscrapers in the Pudong district is compacting the soft soil. This "man-made subsidence" means the financial hub is sinking faster than the sea is rising. They are currently building the "Deep Drainage Tunnel" to keep the city dry.',
  },
  {
    id: 'dubai',
    name: 'Dubai', country: 'UAE',
    lat: 25.20, lon: 55.27,
    eustaticRate: 3.1, relativeRate: 3.5,
    cause: 'artificial-land',
    detail: 'Dubai\'s iconic man-made islands (The Palm, The World) are inherently unstable. Even minor sea level rise alters the wave energy around these structures, leading to rapid erosion that requires constant, expensive "re-sanding" to prevent them from disappearing.',
  },
  {
    id: 'senegal-saint-louis',
    name: 'Saint-Louis', country: 'Senegal',
    lat: 16.02, lon: -16.50,
    eustaticRate: 3.4, relativeRate: 6.0,
    cause: 'coastal-erosion',
    detail: 'Known as the "Venice of Africa," it is being eaten by the sea. The 2026 baseline correction shows the Langue de Barbarie (a thin sand spit) is far more fragile than thought. Entire rows of houses are being swallowed by the Atlantic during every storm.',
  },
  {
    id: 'manila',
    name: 'Manila', country: 'Philippines',
    lat: 14.59, lon: 120.98,
    eustaticRate: 3.5, relativeRate: 15.0,
    cause: 'subsidence',
    detail: 'Manila is sinking due to groundwater pumping. The "feeling" for locals is "permanent mud." Even in the dry season, many streets never fully dry out because the sea now blocks the drainage pipes from emptying into the bay.',
  }
];

// ── State ─────────────────────────────────────────────────────────────────────

let wlMap = null;
let wlSatelliteLayer = null;
let wlWorldCoverLayer = null;
let wlActiveMarkerId = null;
let wlSparklineData = null;

const WL_WORLDCOVER_ZOOM = 10; // swap to land cover classification above this zoom
const WL_WORLDCOVER_URL =
  'https://services.terrascope.be/wmts/v2?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
  '&LAYER=WORLDCOVER_2021_MAP&STYLE=&TILEMATRIXSET=EPSG%3A3857' +
  '&TILEMATRIX=EPSG%3A3857%3A{z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fpng';

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

  wlSatelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, Aerogrid, IGN', maxZoom: 19 }
  ).addTo(wlMap);

  wlWorldCoverLayer = L.tileLayer(WL_WORLDCOVER_URL, {
    attribution: 'ESA WorldCover 2021 &copy; ESA · Terrascope',
    maxNativeZoom: 14, maxZoom: 19, opacity: 0.92,
  });

  wlMap.on('zoomend', () => {
    const z = wlMap.getZoom();
    if (z >= WL_WORLDCOVER_ZOOM && !wlMap.hasLayer(wlWorldCoverLayer)) {
      wlSatelliteLayer.remove();
      wlWorldCoverLayer.addTo(wlMap);
    } else if (z < WL_WORLDCOVER_ZOOM && !wlMap.hasLayer(wlSatelliteLayer)) {
      wlWorldCoverLayer.remove();
      wlSatelliteLayer.addTo(wlMap);
    }
  });

  WL_CITIES.forEach((city, i) => {
    const marker = L.marker([city.lat, city.lon], {
      icon: createPulseIcon(i * 0.22, !!city.spatialProof),
      title: city.name,
    }).addTo(wlMap);

    marker.on('click', () => selectCity(city, marker));
  });
}

function createPulseIcon(delaySec, hasSpatialProof) {
  return L.divIcon({
    className: `wl-marker-wrap${hasSpatialProof ? ' wl-marker-spatial' : ''}`,
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
  const causeLabel  = {
    subsidence: 'Subsidence-driven', eustatic: 'Eustatic', mixed: 'Mixed',
    isostatic: 'Isostatic', oceanographic: 'Oceanographic',
    topographic: 'Topographic', 'urban-loading': 'Urban loading',
    'artificial-land': 'Artificial land', 'coastal-erosion': 'Coastal erosion',
  }[city.cause] ?? city.cause;

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
    <div class="wl-city-detail">${city.detail}</div>
    ${city.spatialProof ? `
    <div class="wl-spatial-proof">
      <div class="wl-spatial-proof-label">Land cover signal · zoom in to see</div>
      <p class="wl-spatial-proof-text">${city.spatialProof}</p>
    </div>` : ''}
  `;
}
