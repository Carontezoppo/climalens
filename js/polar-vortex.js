// Polar vortex strength — zonal-mean wind at 60°N / 60°S, 10 hPa (NASA GSFC)

let vortexChartInstance = null;
const vortexCache = {};

// Year each daily record was set, pre-built by scripts/build_vortex_records.py.
// Optional: if it fails to load, the tooltip simply shows records without a year.
const vortexRecordsPromise = fetch('/data/polar-vortex-records.json')
  .then(r => r.ok ? r.json() : null).catch(() => null);
let vortexRecords = null;

// Months (1–12) when each vortex exists, and when a reversal counts as an SSW
const VORTEX_SEASON = {
  n: { active: [10, 11, 12, 1, 2, 3, 4], ssw: [11, 12, 1, 2, 3] },
  s: { active: [4, 5, 6, 7, 8, 9, 10, 11], ssw: [6, 7, 8, 9, 10] },
};

async function fetchVortexData(hemi) {
  if (vortexCache[hemi]) return vortexCache[hemi];
  const res  = await fetch(`/api/polar-vortex?hemi=${hemi}`);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response`);
  }
  if (!res.ok || data.error) throw new Error(data.error || 'HTTP ' + res.status);
  vortexCache[hemi] = data;
  return data;
}

// Depends only on the hemisphere, so it's shown before the data arrives
const VORTEX_DESC = {
  n: 'The polar vortex is a ring of strong westerly winds circling the North Pole about 30 km up, in the stratosphere. While it is strong, it keeps frigid air locked over the Arctic. When it weakens or collapses — a <strong>sudden stratospheric warming</strong>, marked by the winds reversing to easterly — the effect works its way down over the following weeks, often pushing the jet stream south and bringing prolonged cold spells to North America, Europe and Asia.',
  s: 'The Antarctic polar vortex is a ring of strong westerly winds circling the South Pole about 30 km up, in the stratosphere. It is stronger and more stable than its Arctic counterpart, so collapses are rare: a full reversal has happened only once on record, in 2002, with a near miss in 2019. When it does weaken sharply (a <strong>sudden stratospheric warming</strong>), the Southern Annular Mode turns negative in the following weeks, typically bringing hotter, drier conditions to eastern Australia and shifting storm tracks over southern South America and New Zealand.',
};

// Row: [date, value, min, p10, p30, mean, p70, p90, max, lead]
function vortexStatus(row, hemi) {
  const [date, v, min, p10, p30, , p70, p90, max] = row;
  const month = +date.slice(5, 7);
  const season = VORTEX_SEASON[hemi];
  if (season.ssw.includes(month) && v < 0) {
    return { label: 'Reversed', note: 'Sudden stratospheric warming — winds at 60° have turned easterly', weak: true };
  }
  if (!season.active.includes(month)) {
    return { label: 'Summer circulation', note: 'The vortex forms in autumn; easterly winds are normal at this time of year', weak: null };
  }
  if (v < min) return { label: 'Record weak',  note: 'Lowest for this date in the satellite-era record', weak: true };
  if (v < p10) return { label: 'Very weak',    note: 'Below the 10th percentile for this date', weak: true };
  if (v < p30) return { label: 'Weak',         note: 'Below the 30th percentile for this date', weak: true };
  if (v <= p70) return { label: 'Normal',      note: 'Within the typical range for this date', weak: null };
  if (v <= p90) return { label: 'Strong',      note: 'Above the 70th percentile for this date', weak: false };
  if (v <= max) return { label: 'Very strong', note: 'Above the 90th percentile for this date', weak: false };
  return { label: 'Record strong', note: 'Highest for this date in the satellite-era record', weak: false };
}

const VORTEX_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const VORTEX_TIP_ORDER = ['This season', 'Forecast', 'Record high', 'Average', 'Record low'];

function vortexDay(date) {
  return `${+date.slice(8, 10)} ${VORTEX_MONTHS[+date.slice(5, 7) - 1]}`;
}

function renderVortexData(data) {
  const { hemi, rows, climatology } = data;
  const analysis = rows.filter(r => r[1] !== null && r[9] === 0);
  const forecast = rows.filter(r => r[1] !== null && r[9] > 0);
  const latest   = analysis[analysis.length - 1];
  const outlook  = forecast[forecast.length - 1];
  const status   = vortexStatus(latest, hemi);
  const lat      = hemi === 'n' ? '60°N' : '60°S';

  // If the winds reversed within the last 30 days but have since recovered,
  // say so — otherwise the headline event is only visible in the chart.
  if (status.label !== 'Reversed') {
    const cutoff = new Date(Date.parse(latest[0]) - 30 * 864e5).toISOString().slice(0, 10);
    const reversed = analysis.filter(r => r[0] >= cutoff && r[1] < 0 &&
      VORTEX_SEASON[hemi].ssw.includes(+r[0].slice(5, 7)));
    if (reversed.length) {
      const a = vortexDay(reversed[0][0]), b = vortexDay(reversed[reversed.length - 1][0]);
      status.note = `Winds reversed ${a === b ? a : `${a} – ${b}`} — a sudden stratospheric warming`;
    }
  }
  const climYears = (climatology || '').replace(/(\d{4})\/\d{4}/g, '$1').replace(' to ', '–');

  const color = status.weak === true ? 'var(--temp-low)' : status.weak === false ? 'var(--temp-high)' : 'var(--text-primary)';
  const fmt   = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
  const diff  = latest[1] - latest[5];
  const trend = outlook ? (outlook[1] > latest[1] + 2 ? 'strengthening' : outlook[1] < latest[1] - 2 ? 'weakening' : 'little change') : '';

  document.getElementById('vortexStatsRow').innerHTML = `
    <div class="climate-stat-card">
      <div class="climate-stat-label">Wind at ${lat} · ${vortexDay(latest[0])}</div>
      <div class="climate-stat-value" style="color:${color}">${fmt(latest[1])}<span class="climate-stat-unit"> m/s</span></div>
      <div class="climate-stat-note">Zonal-mean wind at 10 hPa (~30 km up)</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Status</div>
      <div class="climate-stat-value" style="color:${color}">${status.label}</div>
      <div class="climate-stat-note">${status.note}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">vs Normal</div>
      <div class="climate-stat-value">${fmt(diff)}<span class="climate-stat-unit"> m/s</span></div>
      <div class="climate-stat-note">Average for ${vortexDay(latest[0])}: ${latest[5].toFixed(1)} m/s (${climYears})</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Outlook · ${outlook ? vortexDay(outlook[0]) : '—'}</div>
      <div class="climate-stat-value">${outlook ? fmt(outlook[1]) : '—'}<span class="climate-stat-unit">${outlook ? ' m/s' : ''}</span></div>
      <div class="climate-stat-note">${outlook ? `GEOS FP forecast · ${trend}` : 'No forecast available'}</div>
    </div>`;

  // Chart: this season vs climatology fan. Colours read from the theme at render time.
  const css    = getComputedStyle(document.documentElement);
  const band   = css.getPropertyValue('--temp-low').trim() || '#38bdf8';
  const line   = css.getPropertyValue('--text-primary').trim() || '#e8eaf0';
  const muted  = css.getPropertyValue('--text-muted').trim() || '#afb6c6';
  const grid   = css.getPropertyValue('--border').trim() || '#1e2433';
  const alpha  = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  const labels   = rows.map(r => r[0]);
  const col      = i => rows.map(r => r[i]);
  const lastIdx  = rows.indexOf(latest);
  const seasonLn = rows.map((r, i) => i <= lastIdx ? r[1] : null);
  const fcstLn   = rows.map((r, i) => i >= lastIdx && r[1] !== null ? r[1] : null);
  const edge     = { pointRadius: 0, borderWidth: 0, fill: false };

  if (vortexChartInstance) { vortexChartInstance.destroy(); vortexChartInstance = null; }
  vortexChartInstance = new Chart(document.getElementById('vortexChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Record high', data: col(8), pointRadius: 0, borderWidth: 1, borderColor: muted, borderDash: [2, 3], fill: false },
        { label: '90th percentile', data: col(7), ...edge, fill: '+1', backgroundColor: alpha(band, 0.12) },
        { label: '10th percentile', data: col(3), ...edge },
        { label: '70th percentile', data: col(6), ...edge, fill: '+1', backgroundColor: alpha(band, 0.22) },
        { label: '30th percentile', data: col(4), ...edge },
        { label: 'Average',     data: col(5), pointRadius: 0, borderWidth: 1, borderColor: alpha(band, 0.8), fill: false },
        { label: 'Record low',  data: col(2), pointRadius: 0, borderWidth: 1, borderColor: muted, borderDash: [2, 3], fill: false },
        { label: 'This season', data: seasonLn, pointRadius: 0, borderWidth: 2, borderColor: line, fill: false, spanGaps: false },
        { label: 'Forecast',    data: fcstLn, pointRadius: 0, borderWidth: 2, borderColor: line, borderDash: [5, 4], fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false, maxRotation: 0, font: { size: 11 },
            callback: function (_, i) {
              if (!labels[i].endsWith('-01')) return '';
              const m = +labels[i].slice(5, 7);
              if (this.chart.width < 600 && m % 2 === 0) return '';
              return VORTEX_MONTHS[m - 1];
            },
          },
        },
        y: {
          grid: { color: c => c.tick.value === 0 ? muted : grid, lineWidth: c => c.tick.value === 0 ? 1.5 : 1 },
          ticks: { callback: v => v === 0 ? '0 · reversal' : `${v}` },
          title: { display: true, text: 'm/s', font: { size: 11 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: item => ['This season', 'Forecast', 'Average', 'Record low', 'Record high'].includes(item.dataset.label) && item.parsed.y !== null,
          itemSort: (a, b) => VORTEX_TIP_ORDER.indexOf(a.dataset.label) - VORTEX_TIP_ORDER.indexOf(b.dataset.label),
          callbacks: {
            title: items => vortexDay(items[0].label),
            label: ctx => {
              const v = ctx.parsed.y;
              let text = `${ctx.dataset.label}: ${v.toFixed(1)} m/s`;
              // Add the year only when the pre-built record matches the live value, so a
              // stale records file shows no year rather than a wrong one.
              const rec = vortexRecords?.[hemi]?.[labels[ctx.dataIndex].slice(5)];
              const i = ctx.dataset.label === 'Record low' ? 0 : ctx.dataset.label === 'Record high' ? 2 : -1;
              if (rec && i >= 0 && Math.abs(rec[i] - v) <= 0.05) text += ` (${rec[i + 1]})`;
              return text;
            },
          },
        },
      },
    },
  });

  const canvas = document.getElementById('vortexChart');
  canvas.setAttribute('aria-label',
    `Polar vortex wind at ${lat}, 10 hPa, this season compared with the ${climYears} record. Latest ${fmt(latest[1])} m/s on ${vortexDay(latest[0])}: ${status.label}.`);
  document.getElementById('vortexChartTitle').textContent = `Polar Vortex Strength · ${lat}, 10 hPa`;
  document.getElementById('vortexNote').textContent =
    `NASA GSFC · MERRA-2 reanalysis; values from Aug 2026 onward are GEOS FP operational analyses and may be revised slightly · Climatology ${climYears}`;

  document.getElementById('vortexChartLoading').hidden = true;
  document.getElementById('vortexPrompt').style.display  = 'none';
  document.getElementById('vortexContent').style.display = '';
}

async function loadVortexData() {
  const tropical = Math.abs(currentLocation.lat) < 20;
  const block = document.getElementById('vortexBlock');
  if (block) block.style.display = tropical ? 'none' : '';
  if (tropical) return;

  const hemi = currentLocation.lat >= 0 ? 'n' : 's';
  document.getElementById('vortexDesc').innerHTML = VORTEX_DESC[hemi];
  // First load of this hemisphere: show the stats row, chart card and note at
  // their final size, so the block doesn't grow (and push later sections
  // down, breaking #section- links) when the data arrives
  if (!vortexCache[hemi]) {
    const lat = hemi === 'n' ? '60°N' : '60°S';
    const card = (label, note) => `<div class="climate-stat-card"><div class="climate-stat-label">${label}</div><div class="climate-stat-value">—</div><div class="climate-stat-note">${note}</div></div>`;
    document.getElementById('vortexStatsRow').innerHTML =
      card(`Wind at ${lat}`, 'Zonal-mean wind at 10 hPa (~30 km up)') +
      card('Status', '&nbsp;') + card('vs Normal', '&nbsp;') + card('Outlook', 'GEOS FP forecast');
    document.getElementById('vortexChartTitle').textContent = `Polar Vortex Strength · ${lat}, 10 hPa`;
    document.getElementById('vortexNote').textContent = 'NASA GSFC · MERRA-2 reanalysis; values from Aug 2026 onward are GEOS FP operational analyses and may be revised slightly · Climatology 1979–present';
    document.getElementById('vortexChartLoading').hidden = false;
    document.getElementById('vortexPrompt').style.display  = 'none';
    document.getElementById('vortexContent').style.display = '';
  }

  try {
    const [data, records] = await Promise.all([fetchVortexData(hemi), vortexRecordsPromise]);
    vortexRecords = records;
    renderVortexData(data);
  } catch (err) {
    const el = document.getElementById('vortexLoading');
    if (el) { el.textContent = 'Polar vortex data unavailable: ' + err.message; el.style.color = 'var(--negative)'; }
    document.getElementById('vortexPrompt').style.display  = '';
    document.getElementById('vortexContent').style.display = 'none';
  }
}
