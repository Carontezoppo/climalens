// Shared state: data vars, date utils, data generator, metric definitions

// DATA & DATE RANGE
// ============================================================
let DATA;
let MONTHS, MONTHS_FULL, MONTH_DAYS, MONTH_YEARS;

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysInMonth(yr, mo) {
  return new Date(yr, mo, 0).getDate(); // mo is 1-based here
}

// Returns { startYM, endYM } as [year, month] pairs for a given number of past months
function defaultRange(numMonths) {
  // Use day 0 of the current month = last day of previous month,
  // guaranteeing we only request fully completed months.
  const d = new Date();
  d.setDate(1);
  d.setDate(0); // rewinds to last day of previous month
  const endYr = d.getFullYear(), endMo = d.getMonth() + 1;
  let startMo = endMo - numMonths + 1, startYr = endYr;
  while (startMo < 1) { startMo += 12; startYr--; }
  return { startYr, startMo, endYr, endMo };
}

function buildMonthDefs(startYr, startMo, endYr, endMo) {
  const defs = [];
  let yr = startYr, mo = startMo;
  while (yr < endYr || (yr === endYr && mo <= endMo)) {
    defs.push([yr, mo]);
    mo++; if (mo > 12) { mo = 1; yr++; }
  }
  return defs;
}

function applyMonthDefs(defs) {
  MONTHS       = defs.map(([y,m]) => MONTH_NAMES_SHORT[m-1] + ' ' + String(y).slice(2));
  MONTHS_FULL  = defs.map(([,m]) => MONTH_NAMES_FULL[m-1]);
  MONTH_DAYS   = defs.map(([y,m]) => daysInMonth(y, m));
  MONTH_YEARS  = defs.map(([y]) => y);
}

// ============================================================
// SEEDED DAILY DATA GENERATOR
// ============================================================
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDailyData(monthIdx) {
  const days = MONTH_DAYS[monthIdx];
  const rng = seededRandom(monthIdx * 1000 + 42);
  const result = [];
  const avgH = DATA.avgHigh[monthIdx], avgL = DATA.avgLow[monthIdx];
  const totalRain = DATA.rain[monthIdx], totalSun = DATA.sunHours[monthIdx];
  const avgWind = DATA.windAvg[monthIdx], avgPress = DATA.pressure[monthIdx];
  const avgHum = DATA.humidity[monthIdx], snowMonth = DATA.snow[monthIdx];

  const rainDayCount = DATA.rainDays[monthIdx];
  const rainDaySet = new Set();
  while (rainDaySet.size < rainDayCount) rainDaySet.add(Math.floor(rng() * days));

  const snowDayCount = snowMonth > 0 ? Math.min(Math.ceil(snowMonth / 2), days) : 0;
  const snowDaySet = new Set();
  while (snowDaySet.size < snowDayCount) snowDaySet.add(Math.floor(rng() * days));

  let rainBudget = totalRain, sunBudget = totalSun, snowBudget = snowMonth;

  for (let d = 0; d < days; d++) {
    const high = +(avgH + (rng() - 0.5) * 5).toFixed(1);
    const low = +(Math.min(avgL + (rng() - 0.5) * 4, high - 1)).toFixed(1);

    let rainMm = 0;
    if (rainDaySet.has(d)) {
      const rem = [...rainDaySet].filter(x => x >= d).length;
      rainMm = rem === 1 ? Math.max(0, +rainBudget.toFixed(1)) : +(Math.max(0.2, rng() * (rainBudget / rem) * 2)).toFixed(1);
      rainBudget -= rainMm;
    }

    let snowCm = 0;
    if (snowDaySet.has(d)) {
      const rem = [...snowDaySet].filter(x => x >= d).length;
      snowCm = rem === 1 ? Math.max(0, +snowBudget.toFixed(1)) : +(Math.max(0.1, rng() * (snowBudget / rem) * 2)).toFixed(1);
      snowBudget -= snowCm;
    }

    const sunRem = days - d;
    let sunHrs = sunRem === 1 ? Math.max(0, +sunBudget.toFixed(1)) : +(Math.max(0, (sunBudget / sunRem) + (rng() - 0.5) * 4)).toFixed(1);
    sunHrs = Math.min(sunHrs, rainMm > 2 ? 3 : 14);
    sunBudget -= sunHrs;

    const wind = Math.max(2, +(avgWind + (rng() - 0.5) * 14).toFixed(0));
    const gust = Math.max(10, +(wind + rng() * 30 + 10).toFixed(0));
    const press = +(avgPress + (rng() - 0.5) * 18).toFixed(0);
    const hum = Math.round(Math.min(100, Math.max(40, avgHum + (rng() - 0.5) * 20)));

    result.push({
      day: d + 1,
      date: (d + 1) + ' ' + MONTHS_FULL[monthIdx].slice(0, 3),
      high, low,
      rain: rainMm, sun: Math.max(0, sunHrs),
      wind, gust, snow: snowCm, pressure: press, humidity: hum,
    });
  }
  return result;
}

// ============================================================
// METRIC DEFINITIONS
// ============================================================
const METRIC_DEFS = {
  rain: {
    label: 'Total Rainfall', icon: '\u{1F327}', color: 'var(--rain)', bgDim: 'var(--rain-dim)',
    unit: 'mm', monthKey: 'rain', dailyKey: 'rain', chartType: 'bar', aggLabel: 'Total',
    dailyCols: [
      { key: 'rain', label: 'Rain (mm)', color: 'var(--rain)' },
      { key: 'humidity', label: 'Humidity (%)', color: 'var(--humidity)' },
    ],
    statsFn: m => [
      { label: 'Total', value: m.reduce((a,b)=>a+b,0).toFixed(0), unit: 'mm' },
      { label: 'Wettest Month', value: Math.max(...m).toFixed(0), unit: 'mm' },
      { label: 'Driest Month', value: Math.min(...m).toFixed(0), unit: 'mm' },
      { label: 'Avg / Month', value: (m.reduce((a,b)=>a+b,0)/6).toFixed(1), unit: 'mm' },
    ],
  },
  sun: {
    label: 'Sunshine Hours', icon: '\u2600', color: 'var(--sun)', bgDim: 'var(--sun-dim)',
    unit: 'hrs', monthKey: 'sunHours', dailyKey: 'sun', chartType: 'bar', aggLabel: 'Total',
    dailyCols: [{ key: 'sun', label: 'Sun (hrs)', color: 'var(--sun)' }],
    statsFn: m => [
      { label: 'Total', value: m.reduce((a,b)=>a+b,0).toFixed(0), unit: 'hrs' },
      { label: 'Sunniest', value: Math.max(...m).toFixed(0), unit: 'hrs' },
      { label: 'Darkest', value: Math.min(...m).toFixed(0), unit: 'hrs' },
      { label: 'Avg / Month', value: (m.reduce((a,b)=>a+b,0)/6).toFixed(0), unit: 'hrs' },
    ],
  },
  wind: {
    label: 'Avg Wind Speed', icon: '\u{1F4A8}', color: 'var(--wind)', bgDim: 'var(--wind-dim)',
    unit: 'km/h', monthKey: 'windAvg', dailyKey: 'wind', chartType: 'line', aggLabel: 'Average',
    dailyCols: [
      { key: 'wind', label: 'Avg (km/h)', color: 'var(--wind)' },
      { key: 'gust', label: 'Gust (km/h)', color: 'var(--text-muted)' },
    ],
    statsFn: m => [
      { label: 'Avg Speed', value: (m.reduce((a,b)=>a+b,0)/6).toFixed(1), unit: 'km/h' },
      { label: 'Windiest', value: Math.max(...m).toFixed(0), unit: 'km/h' },
      { label: 'Calmest', value: Math.min(...m).toFixed(0), unit: 'km/h' },
      { label: 'Max Gust', value: Math.max(...DATA.windGust).toFixed(0), unit: 'km/h' },
    ],
  },
  snow: {
    label: 'Total Snowfall', icon: '\u2744', color: 'var(--snow)', bgDim: 'var(--snow-dim)',
    unit: 'cm', monthKey: 'snow', dailyKey: 'snow', chartType: 'bar', aggLabel: 'Total',
    dailyCols: [
      { key: 'snow', label: 'Snow (cm)', color: 'var(--snow)' },
      { key: 'low', label: 'Low °C', color: 'var(--temp-low)' },
    ],
    statsFn: m => [
      { label: 'Total', value: m.reduce((a,b)=>a+b,0).toFixed(0), unit: 'cm' },
      { label: 'Peak Month', value: Math.max(...m).toFixed(0), unit: 'cm' },
      { label: 'Snow Months', value: m.filter(v=>v>0).length, unit: '' },
    ],
  },
  pressure: {
    label: 'Avg Pressure', icon: '\u{1F321}', color: 'var(--pressure)', bgDim: 'var(--pressure-dim)',
    unit: 'hPa', monthKey: 'pressure', dailyKey: 'pressure', chartType: 'line', aggLabel: 'Average',
    dailyCols: [{ key: 'pressure', label: 'Pressure (hPa)', color: 'var(--pressure)' }],
    statsFn: m => [
      { label: 'Average', value: Math.round(m.reduce((a,b)=>a+b,0)/6), unit: 'hPa' },
      { label: 'Highest', value: Math.max(...m), unit: 'hPa' },
      { label: 'Lowest', value: Math.min(...m), unit: 'hPa' },
      { label: 'Range', value: Math.max(...m) - Math.min(...m), unit: 'hPa' },
    ],
  },
  humidity: {
    label: 'Avg Humidity', icon: '\u{1F4A7}', color: 'var(--humidity)', bgDim: 'var(--humidity-dim)',
    unit: '%', monthKey: 'humidity', dailyKey: 'humidity', chartType: 'line', aggLabel: 'Average',
    dailyCols: [{ key: 'humidity', label: 'Humidity (%)', color: 'var(--humidity)' }],
    statsFn: m => [
      { label: 'Average', value: Math.round(m.reduce((a,b)=>a+b,0)/6), unit: '%' },
      { label: 'Most Humid', value: Math.max(...m), unit: '%' },
      { label: 'Least Humid', value: Math.min(...m), unit: '%' },
    ],
  },
};
