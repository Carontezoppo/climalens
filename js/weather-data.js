// Fetch historical weather data from Open-Meteo archive API

// FETCH & AGGREGATE
// ============================================================
function pad2(n) { return String(n).padStart(2,'0'); }

async function fetchWeatherData(startYr, startMo, endYr, endMo) {
  const startDate = `${startYr}-${pad2(startMo)}-01`;
  const lastDay = daysInMonth(endYr, endMo);
  const endDate = `${endYr}-${pad2(endMo)}-${pad2(lastDay)}`;
  const res = await fetch(
    `/api/weather?lat=${currentLocation.lat}&lon=${currentLocation.lon}&start=${startDate}&end=${endDate}`
  );
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response from weather API`);
  }
  if (!res.ok || json.error) throw new Error(json.reason || json.error || 'HTTP ' + res.status);
  // _v:3 = Worker pre-aggregated; no daily/hourly fields expected
  if (json._v !== 3) {
    if (!json.daily?.time) throw new Error('API response missing daily data');
    if (!json.hourly?.time) throw new Error('API response missing hourly data');
  }
  return json;
}

function aggregateToMonthly(json, monthDefs) {
  const { daily, hourly } = json;
  const avg = a => a.length ? a.reduce((s,v) => s+v, 0) / a.length : 0;
  const sum = a => a.reduce((s,v) => s+v, 0);
  const out = { avgHigh:[], avgLow:[], rain:[], sunHours:[], windAvg:[], windGust:[], snow:[], pressure:[], humidity:[], rainDays:[], frostDays:[], uvIndex:[] };
  const ymFromStr = t => { const p = t.split('T')[0].split('-'); return [+p[0], +p[1]]; };

  for (const [yr, mo] of monthDefs) {
    const dIdx = daily.time.reduce((acc, t, i) => { const [y,m] = ymFromStr(t); if (y===yr && m===mo) acc.push(i); return acc; }, []);
    const hIdx = hourly.time.reduce((acc, t, i) => { const [y,m] = ymFromStr(t); if (y===yr && m===mo) acc.push(i); return acc; }, []);
    const dv = k => dIdx.map(i => daily[k]?.[i]).filter(v => v != null && !isNaN(v));
    const hv = k => hIdx.map(i => hourly[k]?.[i]).filter(v => v != null && !isNaN(v));

    out.avgHigh.push(+avg(dv('temperature_2m_max')).toFixed(1));
    out.avgLow.push(+avg(dv('temperature_2m_min')).toFixed(1));
    out.rain.push(+sum(dv('precipitation_sum')).toFixed(0));
    out.sunHours.push(Math.round(sum(dv('sunshine_duration')) / 3600));
    out.windAvg.push(Math.round(avg(dv('wind_speed_10m_max'))));
    out.windGust.push(dIdx.length ? Math.round(Math.max(...dv('wind_gusts_10m_max'))) : 0);
    out.snow.push(+sum(dv('snowfall_sum')).toFixed(1));
    out.pressure.push(Math.round(avg(hv('pressure_msl'))));
    out.humidity.push(Math.round(avg(hv('relative_humidity_2m'))));
    out.rainDays.push(dv('precipitation_sum').filter(v => v >= 1).length);
    out.frostDays.push(dv('temperature_2m_min').filter(v => v < 0).length);
    out.uvIndex.push(Math.max(1, Math.round([1,2,3,4,5,6,6,5,4,3,2,1][mo-1] * 0.6)));
  }
  return out;
}
