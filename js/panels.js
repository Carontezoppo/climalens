// Drill-down panel logic

// DRILL-DOWN PANEL LOGIC
// ============================================================
const overlay = document.getElementById('panelOverlay');
const panelEl = document.getElementById('drillPanel');
const panelBody = document.getElementById('panelBody');
const panelBreadcrumb = document.getElementById('panelBreadcrumb');
let drillChart = null;

function openPanel() {
  overlay.classList.add('open');
  panelEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePanel() {
  overlay.classList.remove('open');
  panelEl.classList.remove('open');
  document.body.style.overflow = '';
  if (drillChart) { drillChart.destroy(); drillChart = null; }
}
overlay.addEventListener('click', closePanel);
document.getElementById('panelClose').addEventListener('click', closePanel);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

function getCSSColor(varStr) {
  const t = document.createElement('div');
  t.style.color = varStr;
  document.body.appendChild(t);
  const c = getComputedStyle(t).color;
  document.body.removeChild(t);
  return c;
}

// ---- MONTHLY VIEW ----
function showMonthlyDrill(key) {
  const def = METRIC_DEFS[key];
  const mData = DATA[def.monthKey];
  const stats = def.statsFn(mData);
  const color = getCSSColor(def.color);
  const rgb = color.match(/\d+/g);
  const ca = rgb ? 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',' : 'rgba(100,100,100,';

  panelBreadcrumb.innerHTML =
    '<span class="crumb" onclick="closePanel()">Overview</span>' +
    '<span class="sep">\u203A</span>' +
    '<span class="crumb active">'+def.label+'</span>';

  let h = '<div class="panel-animate">';
  h += '<div class="panel-metric-header">' +
    '<div class="panel-metric-icon" style="background:'+ca+'0.12);font-size:28px;">'+def.icon+'</div>' +
    '<div><div class="panel-metric-name">'+def.label+'</div>' +
    '<div class="panel-metric-range">Oct 2025 \u2014 Mar 2026 \u00B7 Monthly breakdown</div></div></div>';

  h += '<div class="panel-stats-row">';
  stats.forEach(s => {
    h += '<div class="panel-stat"><div class="panel-stat-label">'+s.label+'</div>' +
      '<div class="panel-stat-value" style="color:'+def.color+'">'+s.value +
      '<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">'+s.unit+'</span></div></div>';
  });
  h += '</div>';

  h += '<div class="panel-chart-wrap"><div class="panel-chart-title">'+def.label+' by Month</div>' +
    '<div class="panel-chart-sub">'+def.aggLabel+' per month in '+def.unit+'</div>' +
    '<div class="panel-chart-container"><canvas id="drillCanvas"></canvas></div></div>';

  h += '<div class="panel-hint">Select a month for daily breakdown</div><div class="month-pills">';
  for (let i = 0; i < 6; i++) {
    h += '<div class="month-pill" onclick="showDailyDrill(\''+key+'\','+i+')">' +
      '<div><div class="month-pill-name">'+MONTHS_FULL[i]+'</div></div>' +
      '<div style="display:flex;align-items:center;">' +
      '<span class="month-pill-value" style="color:'+def.color+'">'+mData[i]+' '+def.unit+'</span>' +
      '<span class="month-pill-arrow">\u2192</span></div></div>';
  }
  h += '</div></div>';

  panelBody.innerHTML = h;
  panelBody.scrollTop = 0;

  if (drillChart) drillChart.destroy();
  const ctx = document.getElementById('drillCanvas').getContext('2d');
  const maxV = Math.max(...mData);

  if (def.chartType === 'bar') {
    drillChart = new Chart(ctx, {
      type:'bar',
      data:{ labels:MONTHS_FULL, datasets:[{
        data:mData,
        backgroundColor: mData.map(v => v === maxV ? color : ca+'0.45)'),
        borderRadius:{topLeft:6,topRight:6,bottomLeft:0,bottomRight:0}, barPercentage:0.55,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>v+' '+def.unit } } },
        plugins:{ tooltip:{ callbacks:{ label:c=>c.parsed.y+' '+def.unit } } },
        onClick:(e,els)=>{ if(els.length) showDailyDrill(key, els[0].index); }
      }
    });
  } else {
    drillChart = new Chart(ctx, {
      type:'line',
      data:{ labels:MONTHS_FULL, datasets:[{
        data:mData, borderColor:color, backgroundColor:ca+'0.08)', fill:true, tension:0.4,
        pointRadius:6, pointBackgroundColor:color, pointBorderColor:'#111520', pointBorderWidth:2,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ y:{ ticks:{ callback:v=>v+' '+def.unit } } },
        plugins:{ tooltip:{ callbacks:{ label:c=>c.parsed.y+' '+def.unit } } },
        onClick:(e,els)=>{ if(els.length) showDailyDrill(key, els[0].index); }
      }
    });
  }
  openPanel();
}

// ---- DAILY VIEW ----
function showDailyDrill(key, mi) {
  const def = METRIC_DEFS[key];
  const daily = generateDailyData(mi);
  const color = getCSSColor(def.color);
  const rgb = color.match(/\d+/g);
  const ca = rgb ? 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',' : 'rgba(100,100,100,';
  const mn = MONTHS_FULL[mi], yr = MONTH_YEARS[mi];

  const vals = daily.map(d => d[def.dailyKey]);
  const total = vals.reduce((a,b)=>a+b,0);
  const avg = total / vals.length;
  const maxV = Math.max(...vals);
  const maxDay = daily[vals.indexOf(maxV)];
  const nonZero = vals.filter(v=>v>0).length;

  panelBreadcrumb.innerHTML =
    '<span class="crumb" onclick="closePanel()">Overview</span><span class="sep">\u203A</span>' +
    '<span class="crumb" onclick="showMonthlyDrill(\''+key+'\')">'+def.label+'</span><span class="sep">\u203A</span>' +
    '<span class="crumb active">'+mn+' '+yr+'</span>';

  let h = '<div class="panel-animate">';
  h += '<div class="panel-metric-header">' +
    '<div class="panel-metric-icon" style="background:'+ca+'0.12);font-size:28px;">'+def.icon+'</div>' +
    '<div><div class="panel-metric-name">'+mn+' '+yr+'</div>' +
    '<div class="panel-metric-range">'+def.label+' \u00B7 Daily breakdown \u00B7 '+MONTH_DAYS[mi]+' days</div></div></div>';

  h += '<div class="panel-stats-row">';
  if (def.aggLabel === 'Total') {
    h += '<div class="panel-stat"><div class="panel-stat-label">Total</div><div class="panel-stat-value" style="color:'+def.color+'">'+total.toFixed(1)+'<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">'+def.unit+'</span></div></div>';
    h += '<div class="panel-stat"><div class="panel-stat-label">Active Days</div><div class="panel-stat-value" style="color:'+def.color+'">'+nonZero+'</div></div>';
  } else {
    h += '<div class="panel-stat"><div class="panel-stat-label">Average</div><div class="panel-stat-value" style="color:'+def.color+'">'+avg.toFixed(1)+'<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">'+def.unit+'</span></div></div>';
  }
  h += '<div class="panel-stat"><div class="panel-stat-label">Peak</div><div class="panel-stat-value" style="color:'+def.color+'">'+maxV.toFixed(1)+'<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">'+def.unit+'</span></div></div>';
  h += '<div class="panel-stat"><div class="panel-stat-label">Peak Day</div><div class="panel-stat-value" style="color:'+def.color+'">'+maxDay.date+'</div></div>';
  h += '</div>';

  h += '<div class="panel-chart-wrap"><div class="panel-chart-title">Daily '+def.label+'</div>' +
    '<div class="panel-chart-sub">'+mn+' '+yr+' \u2014 each day in '+def.unit+'</div>' +
    '<div class="panel-chart-container"><canvas id="drillCanvas"></canvas></div></div>';

  h += '<div class="panel-hint">Day-by-day readings</div>';
  h += '<table class="daily-table"><thead><tr><th>Day</th><th>High °C</th><th>Low °C</th>';
  def.dailyCols.forEach(c => h += '<th>'+c.label+'</th>');
  h += '</tr></thead><tbody>';
  daily.forEach(d => {
    h += '<tr><td>'+d.date+'</td><td style="color:var(--temp-high)">'+d.high+'</td><td style="color:var(--temp-low)">'+d.low+'</td>';
    def.dailyCols.forEach(c => {
      const v = d[c.key];
      h += '<td style="color:'+c.color+'">'+(typeof v==='number'?(v%1===0?v:v.toFixed(1)):v)+'</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';

  panelBody.innerHTML = h;
  panelBody.scrollTop = 0;

  if (drillChart) drillChart.destroy();
  const ctx = document.getElementById('drillCanvas').getContext('2d');
  const labels = daily.map(d => d.day);

  if (def.chartType === 'bar') {
    drillChart = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{
        data:vals,
        backgroundColor: vals.map(v => v === maxV ? color : ca+'0.45)'),
        borderRadius:{topLeft:3,topRight:3,bottomLeft:0,bottomRight:0}, barPercentage:0.7,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{beginAtZero:true,ticks:{callback:v=>v+' '+def.unit}} },
        plugins:{ tooltip:{ callbacks:{ title:it=>'Day '+it[0].label, label:c=>c.parsed.y+' '+def.unit } } }
      }
    });
  } else {
    drillChart = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{
        data:vals, borderColor:color, backgroundColor:ca+'0.08)', fill:true, tension:0.35,
        pointRadius:2.5, pointBackgroundColor:color, pointBorderColor:'#111520', pointBorderWidth:1, borderWidth:2,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{callback:v=>v+' '+def.unit}} },
        plugins:{ tooltip:{ callbacks:{ title:it=>'Day '+it[0].label, label:c=>c.parsed.y+' '+def.unit } } }
      }
    });
  }
}


function showForecastDrill(dayIdx) {
  if (!forecastData) return;
  const daily  = forecastData.daily;
  const hourly = forecastData.hourly;
  const date   = daily.time[dayIdx];
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date(date + 'T12:00:00');
  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = date === today ? 'Today' : dayNames[d.getDay()];
  const dateLabel = d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  const { icon, label } = weatherIcon(daily.weather_code[dayIdx]);

  // Extract the 24 hourly indices for this date
  const hIdx = hourly.time.reduce((acc, t, i) => {
    if (t.startsWith(date)) acc.push(i);
    return acc;
  }, []);

  const hLabels = hIdx.map(i => hourly.time[i].slice(11, 16)); // "HH:MM"
  const hTemp   = hIdx.map(i => hourly.temperature_2m[i]);
  const hPrecip = hIdx.map(i => hourly.precipitation[i]);
  const hWind   = hIdx.map(i => hourly.wind_speed_10m[i]);
  const hHumid  = hIdx.map(i => hourly.relative_humidity_2m[i]);
  const hCode   = hIdx.map(i => hourly.weather_code[i]);

  panelBreadcrumb.innerHTML =
    `<span class="crumb" onclick="closePanel()">Overview</span>
     <span class="sep">›</span>
     <span class="crumb active">${dayLabel} · ${dateLabel}</span>`;

  // Stats
  const maxTemp = Math.max(...hTemp), minTemp = Math.min(...hTemp);
  const totalPrecip = hPrecip.reduce((a,b)=>a+b,0);
  const maxWind = Math.max(...hWind);
  const avgHumid = Math.round(hHumid.reduce((a,b)=>a+b,0) / hHumid.length);

  let h = '<div class="panel-animate">';
  h += `<div class="panel-metric-header">
    <div class="panel-metric-icon" style="background:rgba(99,102,241,0.12);"><img src="${icon}" alt="${label}" title="${label}"></div>
    <div>
      <div class="panel-metric-name">${dayLabel}</div>
      <div class="panel-metric-range">${dateLabel} · Hourly breakdown</div>
    </div></div>`;

  h += '<div class="panel-stats-row">';
  h += `<div class="panel-stat"><div class="panel-stat-label">High</div><div class="panel-stat-value" style="color:var(--temp-high)">${Math.round(maxTemp)}<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">°C</span></div></div>`;
  h += `<div class="panel-stat"><div class="panel-stat-label">Low</div><div class="panel-stat-value" style="color:var(--temp-low)">${Math.round(minTemp)}<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">°C</span></div></div>`;
  h += `<div class="panel-stat"><div class="panel-stat-label">Precipitation</div><div class="panel-stat-value" style="color:var(--rain)">${totalPrecip.toFixed(1)}<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">mm</span></div></div>`;
  h += `<div class="panel-stat"><div class="panel-stat-label">Max Wind</div><div class="panel-stat-value" style="color:var(--wind)">${Math.round(maxWind)}<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">km/h</span></div></div>`;
  h += `<div class="panel-stat"><div class="panel-stat-label">Avg Humidity</div><div class="panel-stat-value" style="color:var(--humidity)">${avgHumid}<span style="font-size:12px;color:var(--text-secondary);font-weight:400;margin-left:3px;">%</span></div></div>`;
  h += '</div>';

  // Chart
  h += `<div class="panel-chart-wrap">
    <div class="panel-chart-title">Hourly Temperature &amp; Precipitation</div>
    <div class="panel-chart-sub">${dateLabel}</div>
    <div class="panel-chart-container"><canvas id="drillCanvas"></canvas></div>
  </div>`;

  // Hourly table
  h += '<div class="panel-hint">Hour-by-hour breakdown</div>';
  h += '<table class="daily-table"><thead><tr><th>Time</th><th>Conditions</th><th>Temp °C</th><th>Rain (mm)</th><th>Wind (km/h)</th><th>Humidity (%)</th></tr></thead><tbody>';
  hIdx.forEach((_, j) => {
    const { icon: hIcon, label: hLabel } = weatherIcon(hCode[j]);
    h += `<tr>
      <td>${hLabels[j]}</td>
      <td style="text-align:center"><img src="${hIcon}" alt="${hLabel}" title="${hLabel}" style="width:18px;height:18px;vertical-align:middle;"></td>
      <td style="color:${hTemp[j] >= 15 ? 'var(--temp-high)' : hTemp[j] <= 5 ? 'var(--temp-low)' : 'var(--text-primary)'}">${hTemp[j].toFixed(1)}</td>
      <td style="color:var(--rain)">${hPrecip[j] > 0 ? hPrecip[j].toFixed(1) : '—'}</td>
      <td style="color:var(--wind)">${Math.round(hWind[j])}</td>
      <td style="color:var(--humidity)">${hHumid[j]}</td>
    </tr>`;
  });
  h += '</tbody></table></div>';

  panelBody.innerHTML = h;
  panelBody.scrollTop = 0;

  if (drillChart) drillChart.destroy();
  const ctx = document.getElementById('drillCanvas').getContext('2d');
  drillChart = new Chart(ctx, {
    type: 'line',
    data: { labels: hLabels, datasets: [
      { label:'Temperature', data: hTemp, borderColor:'#fb923c', backgroundColor:'rgba(251,146,60,0.08)', fill:true, tension:0.4, pointRadius:2, borderWidth:2, yAxisID:'yTemp' },
      { label:'Precipitation', data: hPrecip, borderColor:'#4ea8de', backgroundColor:'rgba(78,168,222,0.25)', fill:true, tension:0.1, pointRadius:0, borderWidth:1.5, type:'bar', yAxisID:'yPrecip',
        borderRadius:{topLeft:3,topRight:3,bottomLeft:0,bottomRight:0}, barPercentage:0.8 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        yTemp:   { type:'linear', position:'left',  ticks:{ callback: v => v+'°', color:'#fb923c' }, grid:{ color:'rgba(30,36,51,0.7)' }, grace:'10%' },
        yPrecip: { type:'linear', position:'right', ticks:{ callback: v => v+' mm', color:'#4ea8de' }, grid:{ drawOnChartArea:false }, beginAtZero:true, min:0 },
      },
      plugins: { tooltip:{ callbacks:{ label: ctx => ctx.dataset.label === 'Temperature' ? `${ctx.parsed.y}°C` : `${ctx.parsed.y} mm` } } }
    }
  });

  openPanel();
}
