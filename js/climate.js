// Climate trends — ERA5 via Open-Meteo archive / Copernicus C3S

// CLIMATE TRENDS (ERA5 via Open-Meteo Archive · Copernicus C3S)
// ============================================================
let climateChartInstance = null;
let climateLoaded = false;
let climateCurrentData = null;
const climateCache = {};

async function fetchClimateData() {
  const cacheKey = `${currentLocation.lat}_${currentLocation.lon}`;
  if (climateCache[cacheKey]) return climateCache[cacheKey];
  const today = new Date().toISOString().slice(0, 10);
  const lsKey = `climate_${cacheKey}_${today}`;
  try {
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      climateCache[cacheKey] = parsed;
      return parsed;
    }
  } catch { }
  const endYear = new Date().getFullYear() - 1;
  const qs = [
    `latitude=${currentLocation.lat}`,
    `longitude=${currentLocation.lon}`,
    'start_date=1970-01-01',
    `end_date=${endYear}-12-31`,
    'daily=temperature_2m_max,temperature_2m_min',
    'timezone=UTC',
  ].join('&');
  const res = await fetch('https://archive-api.open-meteo.com/v1/archive?' + qs);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.reason || 'HTTP ' + res.status);
  climateCache[cacheKey] = json;
  try { localStorage.setItem(lsKey, JSON.stringify(json)); } catch { }
  return json;
}

function processClimateData(json) {
  const { daily } = json;
  const buckets = {};
  for (let i = 0; i < daily.time.length; i++) {
    const yr   = +daily.time[i].slice(0, 4);
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    if (tmax == null || tmin == null || isNaN(tmax) || isNaN(tmin)) continue;
    if (!buckets[yr]) buckets[yr] = { sum: 0, n: 0 };
    buckets[yr].sum += (tmax + tmin) / 2;
    buckets[yr].n++;
  }
  // Only include years with ≥ 300 days of data (guards against partial years)
  const years = Object.keys(buckets).map(Number).sort((a,b) => a-b)
    .filter(yr => buckets[yr].n >= 300);
  const means = years.map(yr => +(buckets[yr].sum / buckets[yr].n).toFixed(2));

  // WMO 1981–2010 standard reference period
  const baseVals = means.filter((_, i) => years[i] >= 1981 && years[i] <= 2010);
  const baseline = baseVals.length
    ? +(baseVals.reduce((a,b) => a+b, 0) / baseVals.length).toFixed(2)
    : +(means.reduce((a,b) => a+b, 0) / means.length).toFixed(2);

  const anomalies = means.map(m => +(m - baseline).toFixed(2));

  // Linear regression (index-based for numerical stability)
  const n = years.length;
  const xs = years.map((_, i) => i);
  const sx = xs.reduce((a,b)=>a+b,0), sy = anomalies.reduce((a,b)=>a+b,0);
  const sxy = xs.reduce((a,x,i) => a + x*anomalies[i], 0);
  const sx2 = xs.reduce((a,x) => a + x*x, 0);
  const slope     = (n*sxy - sx*sy) / (n*sx2 - sx*sx);
  const intercept = (sy - slope*sx) / n;
  const trendLine = xs.map(x => +(intercept + slope*x).toFixed(2));

  const decadeRate  = +(slope * 10).toFixed(2);
  const totalChange = +(trendLine[n-1] - trendLine[0]).toFixed(2);
  const maxAnom = Math.max(...anomalies), minAnom = Math.min(...anomalies);

  return {
    years, means, anomalies, trendLine, baseline,
    decadeRate, totalChange,
    warmestYr: years[anomalies.indexOf(maxAnom)], warmestAnom: +maxAnom.toFixed(2),
    coldestYr: years[anomalies.indexOf(minAnom)], coldestAnom: +minAnom.toFixed(2),
    lastYear: years[n-1], lastAnom: anomalies[n-1],
  };
}

function climateAnomalyColor(v) {
  const t = Math.max(-1, Math.min(1, v / 1.5));
  if (t >= 0) {
    const r = 255, g = Math.round(80*(1-t)), b = Math.round(80*(1-t));
    return `rgba(${r},${g},${b},${(0.45 + t*0.5).toFixed(2)})`;
  } else {
    const r = Math.round(50*(1+t)), g = Math.round(120*(1+t)), b = 235;
    return `rgba(${r},${g},${b},${(0.45 + (-t)*0.5).toFixed(2)})`;
  }
}

function drawClimateStripes(years, anomalies) {
  const canvas = document.getElementById('climateStripes');
  if (!canvas || !years) return;
  const w = canvas.offsetWidth || 800;
  canvas.width  = w;
  canvas.height = canvas.offsetHeight || 32;
  const ctx = canvas.getContext('2d');
  const n = years.length;
  const bw = w / n;
  const maxAbs = Math.max(Math.abs(Math.min(...anomalies)), Math.abs(Math.max(...anomalies)));
  anomalies.forEach((v, i) => {
    const t = Math.max(-1, Math.min(1, v / maxAbs));
    let r, g, b;
    if (t >= 0) { r = 255; g = Math.round(80*(1-t)); b = Math.round(80*(1-t)); }
    else        { r = Math.round(50*(1+t)); g = Math.round(130*(1+t)); b = 235; }
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.floor(i*bw), 0, Math.ceil(bw)+1, canvas.height);
  });
}

function renderClimateData(data) {
  climateCurrentData = data;
  const { years, anomalies, trendLine, decadeRate, totalChange,
          warmestYr, warmestAnom, coldestYr, coldestAnom,
          lastYear, lastAnom, baseline } = data;
  const s = v => v > 0 ? '+' : '';

  // Stats cards
  document.getElementById('climateStatsRow').innerHTML = `
    <div class="climate-stat-card">
      <div class="climate-stat-label">Warming Rate</div>
      <div class="climate-stat-value" style="color:${decadeRate >= 0 ? '#fb923c' : '#38bdf8'}">${s(decadeRate)}${decadeRate}<span class="climate-stat-unit"> °C/decade</span></div>
      <div class="climate-stat-note">Linear trend 1970–${lastYear}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Total Change</div>
      <div class="climate-stat-value" style="color:${totalChange >= 0 ? '#fb923c' : '#38bdf8'}">${s(totalChange)}${totalChange}<span class="climate-stat-unit"> °C</span></div>
      <div class="climate-stat-note">Trend 1970 → ${lastYear}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Warmest Year</div>
      <div class="climate-stat-value" style="color:#ef4444">${warmestYr}<span class="climate-stat-unit"> (${s(warmestAnom)}${warmestAnom}°)</span></div>
      <div class="climate-stat-note">vs 1981–2010 baseline</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Coolest Year</div>
      <div class="climate-stat-value" style="color:#38bdf8">${coldestYr}<span class="climate-stat-unit"> (${coldestAnom}°)</span></div>
      <div class="climate-stat-note">vs 1981–2010 baseline</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">${lastYear} Anomaly</div>
      <div class="climate-stat-value" style="color:${lastAnom >= 0 ? '#fb923c' : '#38bdf8'}">${s(lastAnom)}${lastAnom}<span class="climate-stat-unit"> °C</span></div>
      <div class="climate-stat-note">vs 1981–2010 baseline</div>
    </div>`;

  // Anomaly + trend chart
  if (climateChartInstance) { climateChartInstance.destroy(); climateChartInstance = null; }
  climateChartInstance = new Chart(document.getElementById('climateChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Anomaly',
          data: anomalies,
          backgroundColor: anomalies.map(v => climateAnomalyColor(v)),
          borderWidth: 0,
          barPercentage: 0.95,
          categoryPercentage: 0.98,
          order: 2,
        },
        {
          label: 'Trend',
          data: trendLine,
          type: 'line',
          borderColor: 'rgba(251,146,60,0.9)',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            callback: (_, i) => years[i] % 10 === 0 ? years[i] : '',
            font: { size: 11 },
          },
        },
        y: {
          grid: { color: 'rgba(30,36,51,0.7)' },
          ticks: { callback: v => (v > 0 ? '+' : '') + v.toFixed(1) + '°' },
          grace: '10%',
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `Year ${items[0].label}`,
            label: ctx => ctx.dataset.label === 'Trend'
              ? `Trend: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y}°C`
              : `Anomaly: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y}°C vs baseline`,
          },
        },
      },
    },
  });

  // Climate stripes
  drawClimateStripes(years, anomalies);

  // Source note
  document.getElementById('climateNote').textContent =
    `Baseline: ${baseline.toFixed(2)}°C annual mean (1981–2010 WMO reference period) · ERA5 reanalysis via Open-Meteo · Copernicus Climate Change Service (C3S)`;

  // Reveal content
  document.getElementById('climatePrompt').style.display = 'none';
  document.getElementById('climateContent').style.display = '';
  climateLoaded = true;

  // Observe chart container for resize
  if (window._climateResizeObserver) window._climateResizeObserver.disconnect();
  window._climateResizeObserver = new ResizeObserver(() => {
    if (climateChartInstance) climateChartInstance.resize();
    if (climateCurrentData) drawClimateStripes(climateCurrentData.years, climateCurrentData.anomalies);
  });
  const ccWrap = document.querySelector('#climateContent .chart-container');
  if (ccWrap) window._climateResizeObserver.observe(ccWrap);
}

async function loadClimateData() {
  // If already loaded (e.g. location change): show refreshing state
  if (climateLoaded) {
    document.getElementById('climateStatsRow').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:16px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted)">Updating for ${currentLocation.name}&hellip;</div>`;
    if (climateChartInstance) { climateChartInstance.destroy(); climateChartInstance = null; }
  }
  try {
    const json = await fetchClimateData();
    const data = processClimateData(json);
    renderClimateData(data);
  } catch (err) {
    if (climateLoaded) {
      document.getElementById('climateStatsRow').innerHTML =
        `<div style="grid-column:1/-1;color:var(--negative);font-family:'DM Mono',monospace;font-size:11px;padding:16px;">Climate data unavailable: ${err.message}</div>`;
    } else {
      const el = document.getElementById('climateLoading');
      el.textContent = 'Could not load climate data: ' + err.message;
      el.style.color = 'var(--negative)';
    }
  }
}

function initClimate() {}
