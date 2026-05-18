// 9-day forecast fetch and render

// FORECAST
// ============================================================
async function fetchForecast() {
  const res = await fetch(`/api/forecast?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response from forecast API`);
  }
  if (!res.ok || json.error) throw new Error(json.reason || json.error || 'HTTP ' + res.status);
  return json;
}

function weatherIcon(sym) {
  if (!sym)                                        return { icon: 'weather_icon/Overcast.svg',            label: 'Cloudy' };
  if (sym.includes('thunder'))                     return { icon: 'weather_icon/Thunderstorm.svg',        label: 'Thunderstorm' };
  if (sym.includes('snow') && sym.includes('shower')) return { icon: 'weather_icon/Snow_showers.svg',    label: 'Snow showers' };
  if (sym.includes('snow'))                        return { icon: 'weather_icon/Snow.svg',                label: 'Snow' };
  if (sym.includes('sleet'))                       return { icon: 'weather_icon/Sleet.svg',               label: 'Sleet' };
  if (sym.includes('shower'))                      return { icon: 'weather_icon/Showers.svg',             label: 'Showers' };
  if (sym.startsWith('lightrain'))                 return { icon: 'weather_icon/Drizzle.svg',             label: 'Drizzle' };
  if (sym.includes('rain'))                        return { icon: 'weather_icon/Rain.svg',                label: 'Rain' };
  if (sym.startsWith('fog'))                       return { icon: 'weather_icon/Fog.svg',                 label: 'Fog' };
  if (sym.startsWith('cloudy'))                    return { icon: 'weather_icon/Overcast.svg',            label: 'Overcast' };
  if (sym.includes('night') || sym.includes('polartwilight')) {
    if (sym.startsWith('clearsky'))                return { icon: 'weather_icon/Clear_night.svg',         label: 'Clear night' };
                                                   return { icon: 'weather_icon/Partly_cloudy_night.svg', label: 'Partly cloudy' };
  }
  if (sym.startsWith('clearsky'))                  return { icon: 'weather_icon/Clear.svg',               label: 'Clear' };
                                                   return { icon: 'weather_icon/Partly_cloudy.svg',       label: 'Partly cloudy' };
}

let forecastChartInstance = null;
let forecastData = null; // stored for drill-down access

function renderForecast(json, normals) {
  forecastData = json;
  const daily = json.daily;
  const container = document.getElementById('forecastContent');
  const today = new Date().toISOString().slice(0, 10);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let strip = '<div class="forecast-strip">';
  daily.time.forEach((date, i) => {
    const d = new Date(date + 'T12:00:00');
    const isToday = date === today;
    const name = isToday ? 'Today' : `${dayNames[d.getDay()]} ${d.getDate()}`;
    const { icon, label } = weatherIcon(daily.symbol_code[i]);
    const precip = daily.precipitation_sum[i];
    const wind = daily.wind_speed_10m_max[i];
    strip += `
      <div class="forecast-day${isToday ? ' today' : ''}" role="button" tabindex="0" onclick="selectForecastDay(${i})" style="cursor:pointer">
        <div class="forecast-day-name">${name}</div>
        <div class="forecast-icon"><img src="${icon}" alt="${label}" title="${label}"></div>
        <div class="forecast-high">${Math.round(daily.temperature_2m_max[i])}°</div>
        <div class="forecast-low">${Math.round(daily.temperature_2m_min[i])}°</div>
        ${precip > 0.2 ? `<div class="forecast-precip"><img src="weather_icon/Drop.svg" alt="" width="12" height="12"> ${precip.toFixed(1)} mm</div>` : '<div class="forecast-precip" style="opacity:0">·</div>'}
        <div class="forecast-wind"><img src="weather_icon/Wind.svg" alt="" width="12" height="12"> ${Math.round(wind)} km/h</div>
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
          <div class="chart-subtitle">High &amp; low over the next ${daily.time.length} days (°C)${normals ? ' · dashed: 2000–2024 monthly avg' : ''}</div>
        </div>
        <div class="chart-legend">
          <div class="legend-item"><div class="legend-dot" style="background:var(--temp-high)"></div>High</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--temp-low)"></div>Low</div>
          ${normals ? `<div class="legend-item"><div class="legend-dash" style="border-top-color:rgba(251,146,60,0.5)"></div>Avg High</div><div class="legend-item"><div class="legend-dash" style="border-top-color:rgba(56,189,248,0.5)"></div>Avg Low</div>` : ''}
        </div>
      </div>
      <div class="forecast-chart-container"><canvas id="forecastChart"></canvas></div>
    </div>`;

  container.innerHTML = strip;

  container.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const day = e.target.closest('.forecast-day');
    if (day) { e.preventDefault(); day.click(); return; }
    const hour = e.target.closest('.hourly-card');
    if (hour) { e.preventDefault(); hour.click(); }
  });

  selectForecastDay(0); // populate hourly strip with today on first render

  if (forecastChartInstance) forecastChartInstance.destroy();
  const labels = daily.time.map((date, i) => {
    const d = new Date(date + 'T12:00:00');
    return date === today ? 'Today' : dayNames[d.getDay()];
  });
  const _cardBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#0c0f14';
  const datasets = [
    { label:'High', data: daily.temperature_2m_max.map(v => Math.round(v)), borderColor:'#fb923c', backgroundColor:'rgba(251,146,60,0.08)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#fb923c', pointBorderColor:_cardBg, pointBorderWidth:2 },
    { label:'Low',  data: daily.temperature_2m_min.map(v => Math.round(v)), borderColor:'#38bdf8', backgroundColor:'rgba(56,189,248,0.08)',  fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#38bdf8', pointBorderColor:_cardBg, pointBorderWidth:2 },
  ];
  if (normals) {
    const normHigh = daily.time.map(d => normals.high[new Date(d + 'T12:00:00').getMonth()]);
    const normLow  = daily.time.map(d => normals.low[new Date(d + 'T12:00:00').getMonth()]);
    datasets.push({ label:'Avg High', data: normHigh, borderColor:'rgba(251,146,60,0.45)', borderDash:[5,4], pointRadius:0, fill:false, tension:0 });
    datasets.push({ label:'Avg Low',  data: normLow,  borderColor:'rgba(56,189,248,0.45)',  borderDash:[5,4], pointRadius:0, fill:false, tension:0 });
  }
  forecastChartInstance = new Chart(document.getElementById('forecastChart'), {
    type: 'line',
    data: { labels, datasets },
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
  const currentHour = isToday ? new Date().getUTCHours() : -1;
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
    const timeStr = new Date(hourly.time[i] + ':00Z').toLocaleTimeString('en-GB', { timeZone: currentLocation.tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const isNow   = isToday && hour === currentHour;
    const { icon, label } = weatherIcon(hourly.symbol_code[i]);
    const temp    = Math.round(hourly.temperature_2m[i]);
    const precip  = hourly.precipitation[i];
    const wind    = Math.round(hourly.wind_speed_10m[i]);
    const tempColor = temp >= 20 ? 'var(--temp-high)' : temp <= 5 ? 'var(--temp-low)' : 'var(--text-primary)';

    html += `<div class="hourly-card${isNow ? ' now' : ''}" role="button" tabindex="0" onclick="showForecastDrill(${dayIdx})">
      <div class="hourly-time">${isNow ? 'Now' : timeStr}</div>
      <div class="hourly-icon"><img src="${icon}" alt="${label}" title="${label}"></div>
      <div class="hourly-temp" style="color:${tempColor}">${temp}°</div>
      ${precip > 0.1 ? `<div class="hourly-rain"><img src="weather_icon/Drop.svg" alt="" width="9" height="9"> ${precip.toFixed(1)}</div>` : '<div class="hourly-rain" style="opacity:0">·</div>'}
      <div class="hourly-wind"><img src="weather_icon/Wind.svg" alt="" width="9" height="9"> ${wind} km/h</div>
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

async function loadNormals() {
  const cacheKey = `normals_${currentLocation.lat}_${currentLocation.lon}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { ts, data } = JSON.parse(cached);
    if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return data;
  }
  const res = await fetch(`/api/normals?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.high || !data.low) return null;
  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

async function loadForecast() {
  const container = document.getElementById('forecastContent');
  container.innerHTML = '<div class="forecast-loading"><div class="forecast-spinner"></div></div>';
  const cacheKey = `forecast_met_${currentLocation.lat}_${currentLocation.lon}`;
  try {
    const forecastPromise = (async () => {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) return data;
      }
      const json = await fetchForecast();
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: json }));
      return json;
    })();
    const [json, normals] = await Promise.all([forecastPromise, loadNormals().catch(() => null)]);
    renderForecast(json, normals);
  } catch (err) {
    container.textContent = 'Forecast unavailable: ' + err.message;
  }
}
