// 7-day forecast fetch and render

// FORECAST
// ============================================================
async function fetchForecast() {
  const qs = [
    `latitude=${currentLocation.lat}`, `longitude=${currentLocation.lon}`,
    'daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
    'hourly=temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code',
    'forecast_days=7',
    'timezone=Europe%2FLondon',
  ].join('&');
  const res = await fetch(`/api/forecast?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response from forecast API`);
  }
  if (!res.ok || json.error) throw new Error(json.reason || json.error || 'HTTP ' + res.status);
  return json;
}

function weatherIcon(code) {
  if (code === 0)  return { icon: 'weather_icon/Clear.svg',        label: 'Clear' };
  if (code <= 2)   return { icon: 'weather_icon/Partly_cloudy.svg', label: 'Partly cloudy' };
  if (code === 3)  return { icon: 'weather_icon/Overcast.svg',      label: 'Overcast' };
  if (code <= 49)  return { icon: 'weather_icon/Fog.svg',           label: 'Fog' };
  if (code <= 57)  return { icon: 'weather_icon/Drizzle.svg',       label: 'Drizzle' };
  if (code <= 67)  return { icon: 'weather_icon/Rain.svg',          label: 'Rain' };
  if (code <= 77)  return { icon: 'weather_icon/Snow_showers.svg',  label: 'Snow' };
  if (code <= 82)  return { icon: 'weather_icon/Showers.svg',       label: 'Showers' };
  if (code <= 86)  return { icon: 'weather_icon/Snow_showers.svg',  label: 'Snow showers' };
  return           { icon: 'weather_icon/Thunderstorm.svg',         label: 'Thunderstorm' };
}

let forecastChartInstance = null;
let forecastData = null; // stored for drill-down access

function renderForecast(json) {
  forecastData = json;
  const daily = json.daily;
  const container = document.getElementById('forecastContent');
  const today = new Date().toISOString().slice(0, 10);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let strip = '<div class="forecast-strip">';
  daily.time.forEach((date, i) => {
    const d = new Date(date + 'T12:00:00');
    const isToday = date === today;
    const name = isToday ? 'Today' : dayNames[d.getDay()];
    const { icon, label } = weatherIcon(daily.weather_code[i]);
    const precip = daily.precipitation_sum[i];
    const wind = daily.wind_speed_10m_max[i];
    strip += `
      <div class="forecast-day${isToday ? ' today' : ''}" onclick="selectForecastDay(${i})" style="cursor:pointer">
        <div class="forecast-day-name">${name}</div>
        <div class="forecast-icon"><img src="${icon}" alt="${label}" title="${label}"></div>
        <div class="forecast-high">${Math.round(daily.temperature_2m_max[i])}°</div>
        <div class="forecast-low">${Math.round(daily.temperature_2m_min[i])}°</div>
        ${precip > 0.2 ? `<div class="forecast-precip">💧 ${precip.toFixed(1)} mm</div>` : '<div class="forecast-precip" style="opacity:0">·</div>'}
        <div class="forecast-wind">💨 ${Math.round(wind)} km/h</div>
      </div>`;
  });
  strip += '</div>';

  strip += `
    <div class="hourly-strip-wrap">
      <div class="hourly-strip-header">
        <div class="hourly-strip-label" id="hourlyStripLabel">Today — Hourly</div>
        <button class="hourly-detail-btn" id="hourlyDetailBtn">Full detail →</button>
      </div>
      <div class="hourly-scroll" id="hourlyScroll"></div>
    </div>`;

  strip += `
    <div class="forecast-chart-card">
      <div class="chart-header" style="margin-bottom:12px">
        <div>
          <div class="chart-title">Temperature Forecast</div>
          <div class="chart-subtitle">High &amp; low over the next 7 days (°C)</div>
        </div>
        <div class="chart-legend">
          <div class="legend-item"><div class="legend-dot" style="background:var(--temp-high)"></div>High</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--temp-low)"></div>Low</div>
        </div>
      </div>
      <div class="forecast-chart-container"><canvas id="forecastChart"></canvas></div>
    </div>`;

  container.innerHTML = strip;
  selectForecastDay(0); // populate hourly strip with today on first render

  if (forecastChartInstance) forecastChartInstance.destroy();
  const labels = daily.time.map((date, i) => {
    const d = new Date(date + 'T12:00:00');
    return date === today ? 'Today' : dayNames[d.getDay()];
  });
  forecastChartInstance = new Chart(document.getElementById('forecastChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label:'High', data: daily.temperature_2m_max.map(v => Math.round(v)), borderColor:'#fb923c', backgroundColor:'rgba(251,146,60,0.08)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#fb923c', pointBorderColor:'#0c0f14', pointBorderWidth:2 },
      { label:'Low',  data: daily.temperature_2m_min.map(v => Math.round(v)), borderColor:'#38bdf8', backgroundColor:'rgba(56,189,248,0.08)',  fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#38bdf8', pointBorderColor:'#0c0f14', pointBorderWidth:2 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, scales:{ y:{ ticks:{ callback: v => v+'°' }, grace:'20%' } }, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}°C` } } } }
  });
}

let selectedForecastDay = 0;

function selectForecastDay(dayIdx) {
  selectedForecastDay = dayIdx;
  // Highlight the selected day card
  document.querySelectorAll('.forecast-day').forEach((el, i) => {
    el.classList.toggle('selected', i === dayIdx);
  });
  renderHourlyStrip(dayIdx);
}

function renderHourlyStrip(dayIdx) {
  if (!forecastData) return;
  const daily  = forecastData.daily;
  const hourly = forecastData.hourly;
  const date   = daily.time[dayIdx];
  const today  = new Date().toISOString().slice(0, 10);
  const isToday = date === today;
  const currentHour = isToday ? new Date().getHours() : -1;
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date(date + 'T12:00:00');
  const dayLabel = isToday ? 'Today' : dayNames[d.getDay()];
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  const labelEl = document.getElementById('hourlyStripLabel');
  if (labelEl) labelEl.textContent = `${dayLabel}, ${dateStr}`;

  const detailBtn = document.getElementById('hourlyDetailBtn');
  if (detailBtn) detailBtn.onclick = () => showForecastDrill(dayIdx);

  const hIdx = hourly.time.reduce((acc, t, i) => {
    if (t.startsWith(date)) acc.push(i);
    return acc;
  }, []);

  let html = '';
  hIdx.forEach(i => {
    const hour    = +hourly.time[i].slice(11, 13);
    const timeStr =  hourly.time[i].slice(11, 16);
    const isNow   = isToday && hour === currentHour;
    const { icon, label } = weatherIcon(hourly.weather_code[i]);
    const temp    = Math.round(hourly.temperature_2m[i]);
    const precip  = hourly.precipitation[i];
    const wind    = Math.round(hourly.wind_speed_10m[i]);
    const tempColor = temp >= 20 ? 'var(--temp-high)' : temp <= 5 ? 'var(--temp-low)' : 'var(--text-primary)';

    html += `<div class="hourly-card${isNow ? ' now' : ''}" onclick="showForecastDrill(${dayIdx})">
      <div class="hourly-time">${isNow ? 'Now' : timeStr}</div>
      <div class="hourly-icon"><img src="${icon}" alt="${label}" title="${label}"></div>
      <div class="hourly-temp" style="color:${tempColor}">${temp}°</div>
      ${precip > 0.1 ? `<div class="hourly-rain">💧 ${precip.toFixed(1)}</div>` : '<div class="hourly-rain" style="opacity:0">·</div>'}
      <div class="hourly-wind">${wind} km/h</div>
    </div>`;
  });

  const scrollEl = document.getElementById('hourlyScroll');
  if (!scrollEl) return;
  scrollEl.innerHTML = html;

  if (isToday) {
    const nowCard = scrollEl.querySelector('.hourly-card.now');
    if (nowCard) setTimeout(() => nowCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
  } else {
    scrollEl.scrollLeft = 0;
  }
}

async function loadForecast() {
  try {
    const json = await fetchForecast();
    renderForecast(json);
  } catch (err) {
    document.getElementById('forecastContent').textContent = 'Forecast unavailable: ' + err.message;
  }
}
