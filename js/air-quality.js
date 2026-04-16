// Air quality data (CAMS via Open-Meteo)

// AIR QUALITY (Copernicus CAMS via Open-Meteo Air Quality API)
// ============================================================
let aqVisible = true;

async function fetchAirQuality() {
  const qs = [
    `latitude=${currentLocation.lat}`,
    `longitude=${currentLocation.lon}`,
    'hourly=pm10,pm2_5,nitrogen_dioxide,ozone,uv_index,european_aqi,alder_pollen,birch_pollen,grass_pollen',
    'forecast_days=2',
    'timezone=auto',
  ].join('&');
  const res = await fetch(`/api/air-quality?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response from air quality API`);
  }
  if (!res.ok || json.error) throw new Error(json.reason || json.error || 'HTTP ' + res.status);
  return json;
}

function aqiCat(aqi) {
  if (aqi <= 20)  return { label:'Good',          color:'#34d399', advice:'Air quality is satisfactory — enjoy the outdoors.' };
  if (aqi <= 40)  return { label:'Fair',           color:'#a3e635', advice:'Air quality is acceptable.' };
  if (aqi <= 60)  return { label:'Moderate',       color:'#fbbf24', advice:'Unusually sensitive people may be affected.' };
  if (aqi <= 80)  return { label:'Poor',           color:'#f97316', advice:'Sensitive groups should reduce outdoor exertion.' };
  if (aqi <= 100) return { label:'Very Poor',      color:'#ef4444', advice:'Everyone may experience health effects.' };
  return               { label:'Extremely Poor',  color:'#a855f7', advice:'Avoid all outdoor physical activity.' };
}

function uvCat(uv) {
  if (uv <= 2)  return { label:'Low',       color:'#34d399', advice:'No protection needed.' };
  if (uv <= 5)  return { label:'Moderate',  color:'#fbbf24', advice:'Seek shade during midday hours.' };
  if (uv <= 7)  return { label:'High',      color:'#f97316', advice:'Sun protection required.' };
  if (uv <= 10) return { label:'Very High', color:'#ef4444', advice:'Extra protection essential.' };
  return             { label:'Extreme',    color:'#a855f7', advice:'Avoid sun from 10am – 4pm.' };
}

function pollenCat(val) {
  if (val <= 0)  return { label:'None',   color:'var(--text-muted)' };
  if (val <= 10) return { label:'Low',    color:'#34d399' };
  if (val <= 30) return { label:'Medium', color:'#fbbf24' };
  if (val <= 80) return { label:'High',   color:'#f97316' };
  return              { label:'V.High',  color:'#ef4444' };
}

function renderAirQuality(json) {
  const hourly = json.hourly;
  const todayStr = hourly.time[0].slice(0, 10);
  const todayIdx = hourly.time.reduce((acc, t, i) => { if (t.startsWith(todayStr)) acc.push(i); return acc; }, []);

  const getVals = k => todayIdx.map(i => hourly[k]?.[i]).filter(v => v != null && !isNaN(v));
  const maxVal  = k => { const v = getVals(k); return v.length ? Math.max(...v) : 0; };
  const meanVal = k => { const v = getVals(k); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : 0; };

  const aqi         = Math.round(maxVal('european_aqi'));
  const pm25        = +meanVal('pm2_5').toFixed(1);
  const pm10        = +meanVal('pm10').toFixed(1);
  const no2         = +meanVal('nitrogen_dioxide').toFixed(1);
  const o3          = +meanVal('ozone').toFixed(1);
  const uv          = +maxVal('uv_index').toFixed(1);
  const alderPollen = Math.round(maxVal('alder_pollen'));
  const birchPollen = Math.round(maxVal('birch_pollen'));
  const grassPollen = Math.round(maxVal('grass_pollen'));

  const ac = aqiCat(aqi);
  const uc = uvCat(uv);
  const pct = (v, max) => Math.min(100, (v / max) * 100).toFixed(0);
  const pollColor = (v, safe) => v > safe ? '#f97316' : '#34d399';

  const pollutants = [
    { label:'PM2.5', val:pm25, unit:'µg/m³', guideline:'Daily mean · WHO: 15 µg/m³', safe:15,  max:75,  color:pollColor(pm25, 15)  },
    { label:'PM10',  val:pm10, unit:'µg/m³', guideline:'Daily mean · WHO: 45 µg/m³', safe:45,  max:150, color:pollColor(pm10, 45)  },
    { label:'NO₂',   val:no2,  unit:'µg/m³', guideline:'Daily mean · WHO: 25 µg/m³', safe:25,  max:200, color:pollColor(no2,  25)  },
    { label:'O₃',    val:o3,   unit:'µg/m³', guideline:'Daily mean · WHO: 100 µg/m³',safe:100, max:240, color:pollColor(o3,  100)  },
  ];

  let h = '<div class="aq-grid">';

  // AQI card
  h += `<div class="aq-aqi-card" style="border-color:${ac.color}33;">
    <div class="aq-aqi-badge" style="background:${ac.color}1a;color:${ac.color};">● European AQI</div>
    <div class="aq-aqi-value" style="color:${ac.color}">${aqi}</div>
    <div class="aq-aqi-status" style="color:${ac.color}">${ac.label}</div>
    <div class="aq-aqi-advice">${ac.advice}</div>
    <div class="aq-aqi-source">Today's peak · CAMS data via Open-Meteo</div>
  </div>`;

  // Pollutant cards
  pollutants.forEach(p => {
    h += `<div class="aq-pollutant-card">
      <div class="aq-pollutant-label">${p.label}</div>
      <div class="aq-pollutant-value" style="color:${p.color}">${p.val}<span class="aq-pollutant-unit"> ${p.unit}</span></div>
      <div class="aq-pollutant-guideline">${p.guideline}</div>
      <div class="aq-bar"><div class="aq-bar-fill" style="width:${pct(p.val,p.max)}%;background:${p.color}"></div></div>
    </div>`;
  });

  h += '</div>'; // end aq-grid

  h += '<div class="aq-bottom-row">';

  // Pollen card
  h += `<div class="aq-card">
    <div class="aq-card-title">🌿 Pollen Forecast</div>
    <div class="aq-card-sub">Today's peak pollen levels (grains/m³)</div>`;
  [{ name:'Alder', val:alderPollen }, { name:'Birch', val:birchPollen }, { name:'Grass', val:grassPollen }].forEach(p => {
    const cat = pollenCat(p.val);
    h += `<div class="aq-pollen-row">
      <div class="aq-pollen-name">${p.name}</div>
      <div class="aq-pollen-track"><div class="aq-pollen-fill" style="width:${pct(p.val, 100)}%;background:${cat.color}"></div></div>
      <div class="aq-pollen-val">${p.val > 0 ? p.val : '—'} <span style="color:${cat.color}">${cat.label}</span></div>
    </div>`;
  });
  h += '</div>';

  // UV card
  h += `<div class="aq-card">
    <div class="aq-card-title">☀️ UV Index</div>
    <div class="aq-card-sub">Today's peak solar UV radiation</div>
    <div class="aq-uv-row">
      <div class="aq-uv-number" style="color:${uc.color}">${uv}</div>
      <div class="aq-uv-info">
        <div class="aq-uv-status" style="color:${uc.color}">${uc.label}</div>
        <div class="aq-uv-advice">${uc.advice}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-top:8px;">Scale: 0 – 11+</div>
      </div>
    </div>
    <div class="aq-bar" style="margin-top:14px;height:5px;">
      <div class="aq-bar-fill" style="width:${pct(uv, 11)}%;background:${uc.color}"></div>
    </div>
  </div>`;

  h += '</div>'; // end aq-bottom-row

  const aqContent = document.getElementById('aqContent');
  aqContent.removeAttribute('style');
  aqContent.innerHTML = h;
}

async function loadAirQuality() {
  try {
    const json = await fetchAirQuality();
    renderAirQuality(json);
  } catch (err) {
    const el = document.getElementById('aqContent');
    el.textContent = 'Air quality data unavailable: ' + err.message;
  }
}

function initAirQuality() {
  document.getElementById('aqToggleBtn').addEventListener('click', () => {
    aqVisible = !aqVisible;
    const wrap = document.getElementById('aqWrap');
    const btn  = document.getElementById('aqToggleBtn');
    wrap.classList.toggle('collapsed', !aqVisible);
    btn.textContent = aqVisible ? 'Hide' : 'Show';
  });
}
