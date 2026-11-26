// Air quality data (CAMS via Open-Meteo)

// AIR QUALITY (Copernicus CAMS via Open-Meteo Air Quality API)
// ============================================================
let aqVisible = true;

let aqiChartInstance = null;

async function fetchAirQuality() {
  const res = await fetch(`/api/air-quality?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response from air quality API`);
  }
  if (!res.ok || json.error) throw new Error(json.reason || json.error || 'HTTP ' + res.status);
  return json;
}

function _aqC(key) {
  return getComputedStyle(document.documentElement).getPropertyValue('--status-' + key).trim();
}

function aqiCat(aqi) {
  if (aqi <= 20)  return { label:'Good',          color:_aqC('good'),     advice:'Air quality is satisfactory — enjoy the outdoors.' };
  if (aqi <= 40)  return { label:'Fair',           color:_aqC('fair'),     advice:'Air quality is acceptable.' };
  if (aqi <= 60)  return { label:'Moderate',       color:_aqC('moderate'), advice:'Unusually sensitive people may be affected.' };
  if (aqi <= 80)  return { label:'Poor',           color:_aqC('poor'),     advice:'Sensitive groups should reduce outdoor exertion.' };
  if (aqi <= 100) return { label:'Very Poor',      color:_aqC('verypoor'), advice:'Everyone may experience health effects.' };
  return               { label:'Extremely Poor',  color:_aqC('extreme'),  advice:'Avoid all outdoor physical activity.' };
}

function uvCat(uv) {
  if (uv <= 2)  return { label:'Low',       color:_aqC('good'),     advice:'No protection needed.' };
  if (uv <= 5)  return { label:'Moderate',  color:_aqC('moderate'), advice:'Seek shade during midday hours.' };
  if (uv <= 7)  return { label:'High',      color:_aqC('poor'),     advice:'Sun protection required.' };
  if (uv <= 10) return { label:'Very High', color:_aqC('verypoor'), advice:'Extra protection essential.' };
  return             { label:'Extreme',    color:_aqC('extreme'),  advice:'Avoid sun from 10am – 4pm.' };
}

function pollenCat(val) {
  if (val <= 0)  return { label:'None',   color:'var(--text-muted)' };
  if (val <= 10) return { label:'Low',    color:_aqC('good') };
  if (val <= 30) return { label:'Medium', color:_aqC('moderate') };
  if (val <= 80) return { label:'High',   color:_aqC('poor') };
  return              { label:'V.High',  color:_aqC('verypoor') };
}

// Local "now" at the location as 'YYYY-MM-DDTHH' (hourly.time is local time, timezone=auto)
function aqLocalNow(json) {
  return new Date(Date.now() + json.utc_offset_seconds * 1000).toISOString().slice(0, 13);
}

function renderAirQuality(json) {
  const hourly = json.hourly;
  // The response starts 7 days back (for the chart), so today comes from the clock, not hourly.time[0]
  const todayStr = aqLocalNow(json).slice(0, 10);
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
  const pollColor = (v, safe) => v > safe ? _aqC('poor') : _aqC('good');

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

  // AQI over time: past 7 days + forecast
  h += `<div class="chart-card full-width aq-chart-card">
    <div class="chart-header">
      <div>
        <div class="chart-title">European AQI over time</div>
        <div class="chart-subtitle">Past 7 days and the next few days, hourly</div>
      </div>
      <div class="chart-legend">
        <div class="legend-item"><div class="legend-dash" style="border-top-style:solid;border-color:var(--text-primary)"></div>Past</div>
        <div class="legend-item"><div class="legend-dash" style="border-color:var(--text-primary)"></div>Forecast</div>
      </div>
    </div>
    <div class="chart-container" style="height:260px;"><canvas id="aqiChart" role="img" aria-label="European AQI over the past 7 days and the forecast"></canvas></div>
    <div class="climate-note">CAMS via Open-Meteo · European Air Quality Index (EEA) · Hourly values, local time</div>
  </div>`;

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
  if (aqiChartInstance) { aqiChartInstance.destroy(); aqiChartInstance = null; }
  aqContent.innerHTML = h;
  renderAqiChart(json);
}

// Same six EEA levels and colours as the AQI card (aqiCat)
const AQI_BANDS = [
  { from: 0,   to: 20,  key: 'good',     label: 'Good' },
  { from: 20,  to: 40,  key: 'fair',     label: 'Fair' },
  { from: 40,  to: 60,  key: 'moderate', label: 'Moderate' },
  { from: 60,  to: 80,  key: 'poor',     label: 'Poor' },
  { from: 80,  to: 100, key: 'verypoor', label: 'Very poor' },
  { from: 100, to: Infinity, key: 'extreme', label: 'Extremely poor' },
];
const AQ_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const AQ_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function renderAqiChart(json) {
  const canvas = document.getElementById('aqiChart');
  if (!canvas) return;
  const times = json.hourly.time, all = json.hourly.european_aqi || [];
  // Drop the empty hours at the end, where the CAMS forecast runs out
  let last = all.length - 1;
  while (last >= 0 && all[last] == null) last--;
  if (last < 0) { canvas.closest('.aq-chart-card').hidden = true; return; }
  const labels = times.slice(0, last + 1);
  const values = all.slice(0, last + 1);

  const nowKey = aqLocalNow(json);
  let nowIdx = labels.findIndex(t => t.slice(0, 13) === nowKey);
  if (nowIdx < 0) nowIdx = labels.length - 1;
  const past     = values.map((v, i) => i <= nowIdx ? v : null);
  const forecast = values.map((v, i) => i >= nowIdx ? v : null);

  const css   = getComputedStyle(document.documentElement);
  const line  = css.getPropertyValue('--text-primary').trim();
  const muted = css.getPropertyValue('--text-muted').trim();
  const grid  = css.getPropertyValue('--border').trim();
  const band  = Object.fromEntries(AQI_BANDS.map(b => [b.key, _aqC(b.key)]));
  const tint  = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  const peak = Math.max(...values.filter(v => v != null));
  const yMax = Math.max(100, Math.ceil(peak / 20) * 20); // fixed 0–100 so the bands keep their proportions

  const day   = t => { const d = new Date(t + ':00Z'); return `${AQ_DAYS[d.getUTCDay()]} ${d.getUTCDate()}`; };
  const stamp = t => { const d = new Date(t + ':00Z'); return `${AQ_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${AQ_MONTHS[d.getUTCMonth()]}, ${t.slice(11, 16)}`; };

  // Background bands, their names on the right, and the "now" marker
  const bandsPlugin = {
    id: 'aqiBands',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x, y } } = chart;
      ctx.save();
      for (const b of AQI_BANDS) {
        const top = y.getPixelForValue(Math.min(b.to, yMax)), bottom = y.getPixelForValue(b.from);
        if (bottom <= a.top) continue;
        ctx.fillStyle = tint(band[b.key], 0.13);
        ctx.fillRect(a.left, Math.max(top, a.top), a.right - a.left, bottom - Math.max(top, a.top));
        ctx.fillStyle = band[b.key];
        ctx.font = "10px 'DM Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // In the right margin, so the line never runs through a label
        ctx.fillText(b.label, a.right + 8, (Math.max(top, a.top) + bottom) / 2);
      }
      const nx = x.getPixelForValue(nowIdx);
      ctx.strokeStyle = muted;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(nx, a.top); ctx.lineTo(nx, a.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = muted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Now', nx + 4, a.top + 4);
      ctx.restore();
    },
  };

  aqiChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Past',     data: past,     borderColor: line, borderWidth: 2, pointRadius: 0, tension: 0.25, spanGaps: false },
        { label: 'Forecast', data: forecast, borderColor: line, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, tension: 0.25, spanGaps: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { right: peak > 100 ? 96 : 68 } }, // room for the band names
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false, maxRotation: 0, font: { size: 11 },
            // One label per day, at midnight; every 2nd day under 600px, every 3rd under 450px
            callback: function (_, i) {
              if (!labels[i].endsWith('T00:00')) return '';
              const every = this.chart.width < 450 ? 3 : this.chart.width < 600 ? 2 : 1;
              if (Math.round(i / 24) % every) return '';
              return day(labels[i]);
            },
          },
        },
        y: {
          min: 0, max: yMax,
          grid: { color: grid },
          ticks: { stepSize: 20, font: { size: 11 } },
          title: { display: true, text: 'AQI', font: { size: 11 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          // At "now" both datasets have a value; show it once
          filter: item => item.parsed.y != null && !(item.datasetIndex === 1 && item.dataIndex === nowIdx),
          callbacks: {
            title: items => stamp(labels[items[0].dataIndex]) + (items[0].dataIndex > nowIdx ? ' · forecast' : ''),
            label: item => `European AQI ${Math.round(item.parsed.y)} · ${aqiCat(item.parsed.y).label}`,
          },
        },
      },
    },
    plugins: [bandsPlugin],
  });

  // Text summary for screen readers
  const peakOf = (from, to) => {
    let best = -1, at = -1;
    for (let i = from; i <= to; i++) if (values[i] != null && values[i] > best) { best = values[i]; at = i; }
    return at < 0 ? null : { v: Math.round(best), t: labels[at] };
  };
  const nowV = values[nowIdx], pastPeak = peakOf(0, nowIdx), fcPeak = peakOf(nowIdx + 1, values.length - 1);
  let summary = `European AQI for ${currentLocation.name}, hourly, past 7 days and forecast.`;
  if (nowV != null) summary += ` Now ${Math.round(nowV)}, ${aqiCat(nowV).label}.`;
  if (pastPeak) summary += ` Past-week peak ${pastPeak.v} (${aqiCat(pastPeak.v).label}) on ${stamp(pastPeak.t)}.`;
  if (fcPeak) summary += ` Forecast peak ${fcPeak.v} (${aqiCat(fcPeak.v).label}) on ${stamp(fcPeak.t)}.`;
  canvas.setAttribute('aria-label', summary);
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
  const aqToggleBtn = document.getElementById('aqToggleBtn');
  aqToggleBtn.setAttribute('aria-expanded', 'true');
  aqToggleBtn.addEventListener('click', () => {
    aqVisible = !aqVisible;
    const wrap = document.getElementById('aqWrap');
    wrap.classList.toggle('collapsed', !aqVisible);
    aqToggleBtn.textContent = aqVisible ? 'Hide' : 'Show';
    aqToggleBtn.setAttribute('aria-expanded', String(aqVisible));
  });
}
