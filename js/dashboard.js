// Chart rendering and KPI dashboard

// RENDER DASHBOARD
// ============================================================
// Track Chart instances so we can destroy them on re-render
const chartInstances = {};

function renderDashboard(normals = null) {
  const loadingMsg = document.getElementById('loadingMsg');
  if (loadingMsg) loadingMsg.remove();

  // Destroy existing charts before re-rendering
  Object.values(chartInstances).forEach(c => c.destroy());
  Object.keys(chartInstances).forEach(k => delete chartInstances[k]);

  // Update header period
  const n = MONTHS.length;
  document.getElementById('headerPeriod').textContent =
    `${MONTHS[0]} — ${MONTHS[n-1]} · ${n}-month window`;

  // KPI CARDS
  const n6 = n; // actual month count
  const kpiDefs = [
    { cls:'rain',     value: DATA.rain.reduce((a,b)=>a+b,0).toFixed(0),          unit:'mm',  note:`${n6}-month total` },
    { cls:'sun',      value: DATA.sunHours.reduce((a,b)=>a+b,0).toFixed(0),     unit:'hrs', note:`${n6}-month total` },
    { cls:'wind',     value: (DATA.windAvg.reduce((a,b)=>a+b,0)/n6).toFixed(1), unit:'km/h',note:`${n6}-month avg`   },
    { cls:'snow',     value: DATA.snow.reduce((a,b)=>a+b,0).toFixed(1),          unit:'cm',  note:`${n6}-month total` },
    { cls:'pressure', value: Math.round(DATA.pressure.reduce((a,b)=>a+b,0)/n6), unit:'hPa', note:'avg'               },
    { cls:'humidity', value: Math.round(DATA.humidity.reduce((a,b)=>a+b,0)/n6), unit:'%',   note:'avg'               },
  ];
  const kpiRow = document.getElementById('kpiRow');
  kpiRow.innerHTML = '';
  kpiDefs.forEach(k => {
    const def = METRIC_DEFS[k.cls];
    kpiRow.innerHTML += `
      <div class="kpi-card ${k.cls}" data-metric="${k.cls}">
        <div class="kpi-label">${def.label}</div>
        <div class="kpi-value">${k.value}<span class="kpi-unit"> ${k.unit}</span></div>
        <div class="kpi-delta neutral">— <span style="opacity:.6">${k.note}</span></div>
        <div class="tap-hint">Click to explore →</div>
      </div>`;
  });

  // CHART DEFAULTS
  Chart.defaults.color = '#8891a5';
  Chart.defaults.borderColor = '#1e2433';
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a1f2b';
  Chart.defaults.plugins.tooltip.borderColor = '#2a3148';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };
  Chart.defaults.scale.grid.color = 'rgba(30,36,51,0.7)';

  // MAP NORMALS TO CURRENT MONTHS
  // MONTHS_FULL is ['January', 'February', ...] for each month slot in the selected range.
  // MONTH_NAMES_FULL is the canonical 12-element array from state.js.
  const monthIndices = MONTHS_FULL.map(name => MONTH_NAMES_FULL.indexOf(name));
  const normHigh  = normals && normals.high      ? monthIndices.map(i => normals.high[i])      : null;
  const normLow   = normals && normals.low       ? monthIndices.map(i => normals.low[i])       : null;
  const normRain  = normals && normals.rain      ? monthIndices.map(i => normals.rain[i])      : null;
  const normSun   = normals && normals.sun       ? monthIndices.map(i => normals.sun[i])       : null;
  const normWind  = normals && normals.wind      ? monthIndices.map(i => normals.wind[i])      : null;
  const normUv    = normals && normals.uv        ? monthIndices.map(i => normals.uv[i])        : null;
  const normFrost = normals && normals.frostDays ? monthIndices.map(i => normals.frostDays[i]) : null;

  // UPDATE CHART HEADERS (idempotent — fully replaced each render)
  const normNote = normals ? ' · dashed: 2000–2024 avg' : '';
  const normLegendItems = (items) => normals ? items.map(({ color, label }) =>
    `<div class="legend-item"><div class="legend-dash" style="border-top-color:${color}"></div>${label}</div>`
  ).join('') : '';

  document.getElementById('tempChart').closest('.chart-card').querySelector('.chart-header').innerHTML = `
    <div>
      <div class="chart-title">Temperature Range</div>
      <div class="chart-subtitle">Monthly high &amp; low averages (°C)${normNote}</div>
    </div>
    <div class="chart-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--temp-high)"></div>Avg High</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--temp-low)"></div>Avg Low</div>
      ${normLegendItems([{color:'rgba(251,146,60,0.6)',label:'Norm High'},{color:'rgba(56,189,248,0.6)',label:'Norm Low'}])}
    </div>`;

  document.getElementById('rainChart').closest('.chart-card').querySelector('.chart-header').innerHTML = `
    <div><div class="chart-title">Precipitation</div><div class="chart-subtitle">Rainfall in mm per month${normNote}</div></div>
    ${normals ? '<div class="chart-legend"><div class="legend-item"><div class="legend-dash" style="border-top-color:rgba(78,168,222,0.6)"></div>2000–2024 avg</div></div>' : ''}`;

  document.getElementById('sunChart').closest('.chart-card').querySelector('.chart-header').innerHTML = `
    <div><div class="chart-title">Sunshine Hours</div><div class="chart-subtitle">Total hours of sunlight per month${normNote}</div></div>
    ${normals ? '<div class="chart-legend"><div class="legend-item"><div class="legend-dash" style="border-top-color:rgba(245,166,35,0.6)"></div>2000–2024 avg</div></div>' : ''}`;

  document.getElementById('windChart').closest('.chart-card').querySelector('.chart-header').innerHTML = `
    <div><div class="chart-title">Wind Speed</div><div class="chart-subtitle">Average daily maximum (km/h)${normNote}</div></div>
    <div class="chart-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--wind)"></div>Avg</div>
      ${normLegendItems([{color:'rgba(126,232,168,0.55)',label:'Norm Avg'}])}
    </div>`;

  // MAIN CHARTS
  const tempDs = [
    { label:'Avg High', data:DATA.avgHigh, borderColor:'#fb923c', backgroundColor:'rgba(251,146,60,0.08)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#fb923c', pointBorderColor:'#0c0f14', pointBorderWidth:2 },
    { label:'Avg Low',  data:DATA.avgLow,  borderColor:'#38bdf8', backgroundColor:'rgba(56,189,248,0.08)',  fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#38bdf8', pointBorderColor:'#0c0f14', pointBorderWidth:2 },
  ];
  if (normHigh) tempDs.push({ label:'Norm High', data:normHigh, borderColor:'rgba(251,146,60,0.45)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  if (normLow)  tempDs.push({ label:'Norm Low',  data:normLow,  borderColor:'rgba(56,189,248,0.45)',  borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.temp = new Chart(document.getElementById('tempChart'), {
    type:'line',
    data:{ labels:MONTHS, datasets:tempDs },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, scales:{y:{ticks:{callback:v=>v+'°'},grace:'10%'}}, plugins:{tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y}°C`}}} }
  });

  const rainDs = [
    { data:DATA.rain, backgroundColor:DATA.rain.map(v=>v>75?'#4ea8de':'rgba(78,168,222,0.5)'), borderRadius:{topLeft:6,topRight:6,bottomLeft:0,bottomRight:0}, barPercentage:0.55 },
  ];
  if (normRain) rainDs.push({ type:'line', label:'2000–2024 avg', data:normRain, borderColor:'rgba(78,168,222,0.55)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.rain = new Chart(document.getElementById('rainChart'), {
    type:'bar',
    data:{ labels:MONTHS, datasets:rainDs },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true,ticks:{callback:v=>v+' mm'}}}, plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label==='2000–2024 avg'?`Avg: ${ctx.parsed.y} mm`:`${ctx.parsed.y} mm`}}} }
  });

  const sunDs = [
    { data:DATA.sunHours, backgroundColor:DATA.sunHours.map(v=>v>90?'#f5a623':'rgba(245,166,35,0.45)'), borderRadius:{topLeft:6,topRight:6,bottomLeft:0,bottomRight:0}, barPercentage:0.55 },
  ];
  if (normSun) sunDs.push({ type:'line', label:'2000–2024 avg', data:normSun, borderColor:'rgba(245,166,35,0.55)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.sun = new Chart(document.getElementById('sunChart'), {
    type:'bar',
    data:{ labels:MONTHS, datasets:sunDs },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true,ticks:{callback:v=>v+'h'}}}, plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label==='2000–2024 avg'?`Avg: ${ctx.parsed.y}h`:`${ctx.parsed.y} hours`}}} }
  });

  const windDs = [
    { label:'Avg Speed', data:DATA.windAvg, borderColor:'#7ee8a8', backgroundColor:'rgba(126,232,168,0.1)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#7ee8a8', pointBorderColor:'#0c0f14', pointBorderWidth:2 },
  ];
  if (normWind) windDs.push({ label:'Norm Avg', data:normWind, borderColor:'rgba(126,232,168,0.45)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.wind = new Chart(document.getElementById('windChart'), {
    type:'line',
    data:{ labels:MONTHS, datasets:windDs },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, scales:{y:{beginAtZero:true,ticks:{callback:v=>v+' km/h'}}}, plugins:{tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} km/h`}}} }
  });

  const frostDs = [
    { data:DATA.frostDays, backgroundColor:DATA.frostDays.map(v=>v>0?'rgba(56,189,248,0.7)':'rgba(56,189,248,0.2)'), borderRadius:{topLeft:6,topRight:6,bottomLeft:0,bottomRight:0}, barPercentage:0.55 },
  ];
  if (normFrost) frostDs.push({ type:'line', label:'2000–2024 avg', data:normFrost, borderColor:'rgba(56,189,248,0.5)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.frost = new Chart(document.getElementById('frostChart'), {
    type:'bar',
    data:{ labels:MONTHS, datasets:frostDs },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true,ticks:{callback:v=>v+' d'}}}, plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label==='2000–2024 avg'?`Avg: ${ctx.parsed.y} days`:`${ctx.parsed.y} frost days`}}} }
  });

  const uvDs = [
    { data:DATA.uvIndex, backgroundColor:DATA.uvIndex.map(v=>v>=3?'rgba(251,191,36,0.75)':'rgba(251,191,36,0.3)'), borderRadius:{topLeft:6,topRight:6,bottomLeft:0,bottomRight:0}, barPercentage:0.55 },
  ];
  if (normUv) uvDs.push({ type:'line', label:'2000–2024 avg', data:normUv, borderColor:'rgba(251,191,36,0.55)', borderDash:[5,4], pointRadius:0, fill:false, tension:0, borderWidth:1.5 });
  chartInstances.uv = new Chart(document.getElementById('uvChart'), {
    type:'bar',
    data:{ labels:MONTHS, datasets:uvDs },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true,grace:'10%'}}, plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label==='2000–2024 avg'?`Avg: ${ctx.parsed.y}`:`UV index: ${ctx.parsed.y}`}}} }
  });

  chartInstances.pressure = new Chart(document.getElementById('pressureChart'), {
    type:'line',
    data:{ labels:MONTHS, datasets:[{ data:DATA.pressure, borderColor:'#c084fc', backgroundColor:'rgba(192,132,252,0.08)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#c084fc', pointBorderColor:'#0c0f14', pointBorderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{y:{grace:'5%',ticks:{callback:v=>v+' hPa'}}}, plugins:{tooltip:{callbacks:{label:ctx=>`${ctx.parsed.y} hPa`}}} }
  });

  // DETAIL TABLE
  const table = document.getElementById('detailTable');
  const maxRain = Math.max(...DATA.rain);
  let thead = '<thead><tr>';
  ['Month','Avg High °C','Avg Low °C','Rain (mm)','Rain Days','Sun (hrs)','Wind (km/h)','Snow (cm)','Pressure (hPa)','Humidity (%)','Frost Days','UV Index'].forEach(c => thead += '<th>'+c+'</th>');
  thead += '</tr></thead>';
  let tbody = '<tbody>';
  for (let i = 0; i < MONTHS.length; i++) {
    const bw = Math.round((DATA.rain[i]/maxRain)*48);
    tbody += '<tr><td>'+MONTHS_FULL[i]+'</td>';
    tbody += '<td style="color:var(--temp-high)">'+DATA.avgHigh[i]+'</td>';
    tbody += '<td style="color:var(--temp-low)">'+DATA.avgLow[i]+'</td>';
    tbody += '<td><span class="cell-bar" style="width:'+bw+'px;background:var(--rain)"></span>'+DATA.rain[i]+'</td>';
    tbody += '<td>'+DATA.rainDays[i]+'</td>';
    tbody += '<td style="color:var(--sun)">'+DATA.sunHours[i]+'</td>';
    tbody += '<td>'+DATA.windAvg[i]+'</td>';
    tbody += '<td>'+(DATA.snow[i]||'—')+'</td>';
    tbody += '<td>'+DATA.pressure[i]+'</td><td>'+DATA.humidity[i]+'</td>';
    tbody += '<td>'+DATA.frostDays[i]+'</td><td>'+DATA.uvIndex[i]+'</td></tr>';
  }
  tbody += '</tbody>';
  table.innerHTML = thead + tbody;

  // WIRE UP CLICKS + KEYBOARD
  document.querySelectorAll('.kpi-card[data-metric]').forEach(card => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => showMonthlyDrill(card.dataset.metric));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showMonthlyDrill(card.dataset.metric); }
    });
  });

  // Resize charts when their container changes size (handles both shrink and restore)
  if (window._chartResizeObserver) window._chartResizeObserver.disconnect();
  window._chartResizeObserver = new ResizeObserver(() => {
    Object.values(chartInstances).forEach(c => c.resize());
  });
  document.querySelectorAll('.chart-container').forEach(el => {
    window._chartResizeObserver.observe(el);
  });
}
