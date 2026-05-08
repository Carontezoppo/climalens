// Jet stream index — NAO (NH) / SAM (SH) via NOAA Climate Prediction Center

let jetStreamChartInstance = null;
let jetStreamLoaded = false;
const jetStreamCache = {};

async function fetchJetStreamData() {
  const hemisphere = currentLocation.lat >= 0 ? 'nh' : 'sh';
  if (jetStreamCache[hemisphere]) return jetStreamCache[hemisphere];

  const res  = await fetch(`/api/jet-stream?lat=${currentLocation.lat}&lon=${currentLocation.lon}`);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}: unexpected response`);
  }
  if (!res.ok || data.error) throw new Error(data.error || 'HTTP ' + res.status);

  jetStreamCache[hemisphere] = data;
  return data;
}

function indexColor(v) {
  const t = Math.max(-1, Math.min(1, v / 1.5));
  if (t >= 0) {
    const r = 255, g = Math.round(80 * (1 - t)), b = Math.round(80 * (1 - t));
    return `rgba(${r},${g},${b},${(0.45 + t * 0.5).toFixed(2)})`;
  } else {
    const r = Math.round(50 * (1 + t)), g = Math.round(120 * (1 + t)), b = 235;
    return `rgba(${r},${g},${b},${(0.45 + (-t) * 0.5).toFixed(2)})`;
  }
}

function renderJetStreamData(data) {
  const { index, annual } = data;
  const years  = annual.map(d => d.year);
  const values = annual.map(d => d.value);
  const last   = annual[annual.length - 1];

  const maxEntry  = annual.reduce((a, b) => b.value > a.value ? b : a);
  const minEntry  = annual.reduce((a, b) => b.value < a.value ? b : a);
  const negYears  = annual.filter(d => d.value < 0).length;
  const s = v => v > 0 ? '+' : '';

  document.getElementById('jetStreamStatsRow').innerHTML = `
    <div class="climate-stat-card">
      <div class="climate-stat-label">Most Negative Year</div>
      <div class="climate-stat-value" style="color:#38bdf8">${minEntry.year}<span class="climate-stat-unit"> (${minEntry.value})</span></div>
      <div class="climate-stat-note">Jet furthest equatorward — highest cold risk</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Most Positive Year</div>
      <div class="climate-stat-value" style="color:#fb923c">${maxEntry.year}<span class="climate-stat-unit"> (${s(maxEntry.value)}${maxEntry.value})</span></div>
      <div class="climate-stat-note">Jet furthest poleward — mildest conditions</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">Negative Years</div>
      <div class="climate-stat-value">${negYears}<span class="climate-stat-unit"> / ${years.length}</span></div>
      <div class="climate-stat-note">Annual mean below zero 2000–${last.year}</div>
    </div>
    <div class="climate-stat-card">
      <div class="climate-stat-label">${last.year} Index</div>
      <div class="climate-stat-value" style="color:${last.value < 0 ? '#38bdf8' : '#fb923c'}">${s(last.value)}${last.value}</div>
      <div class="climate-stat-note">${last.value < 0 ? 'Negative — jet displaced equatorward' : 'Positive — jet in normal or poleward position'}</div>
    </div>`;

  if (jetStreamChartInstance) { jetStreamChartInstance.destroy(); jetStreamChartInstance = null; }

  jetStreamChartInstance = new Chart(document.getElementById('jetStreamChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: index + ' Index',
          data: values,
          backgroundColor: values.map(v => indexColor(v)),
          borderWidth: 0,
          barPercentage: 0.95,
          categoryPercentage: 0.98,
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
            callback: (_, i) => years[i] % 5 === 0 ? years[i] : '',
            font: { size: 11 },
          },
        },
        y: {
          grid: { color: 'rgba(30,36,51,0.7)' },
          ticks: { callback: v => (v > 0 ? '+' : '') + v.toFixed(1) },
          grace: '10%',
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `Year ${items[0].label}`,
            label: ctx => {
              const v = ctx.parsed.y;
              const phase = v < 0 ? 'Negative — jet equatorward, cold risk' : 'Positive — jet poleward, mild';
              return `${index}: ${v > 0 ? '+' : ''}${v.toFixed(2)} · ${phase}`;
            },
          },
        },
      },
    },
  });

  const indexFull = index === 'NAO' ? 'North Atlantic Oscillation' : 'Southern Annular Mode';
  const titleEl = document.getElementById('jetStreamChartTitle');
  const subEl   = document.getElementById('jetStreamChartSub');
  if (titleEl) titleEl.textContent = `Annual ${index} Index`;
  if (subEl)   subEl.textContent   = `${indexFull} · NOAA Climate Prediction Center`;
  document.getElementById('jetStreamNote').textContent =
    `${indexFull} · Annual means · NOAA Climate Prediction Center · 2000–${last.year}`;

  const desc = document.getElementById('jetStreamDesc');
  if (desc) {
    desc.textContent = index === 'NAO'
      ? 'The North Atlantic Oscillation (NAO) measures the state of the polar jet stream over the North Atlantic. A positive phase means the jet is strong and sits in its normal poleward position, keeping mild Atlantic air flowing into Europe. A negative phase means it has weakened and shifted toward the equator — allowing cold polar air to break through, driving the kind of sudden cold snaps that can reach as far south as the Mediterranean.'
      : 'The Southern Annular Mode (SAM) measures the strength and position of the westerly wind belt around Antarctica. A positive phase shifts the belt poleward, bringing milder conditions to the mid-latitudes. A negative phase shifts it equatorward, exposing southern cities to colder, stormier air from the Southern Ocean.';
  }

  document.getElementById('jetStreamPrompt').style.display  = 'none';
  document.getElementById('jetStreamContent').style.display = '';
  jetStreamLoaded = true;
}

async function loadJetStreamData() {
  if (jetStreamLoaded) {
    document.getElementById('jetStreamStatsRow').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:16px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted)">Updating&hellip;</div>`;
    if (jetStreamChartInstance) { jetStreamChartInstance.destroy(); jetStreamChartInstance = null; }
  }
  try {
    const data = await fetchJetStreamData();
    if (data.tropical) {
      const el = document.getElementById('jetStreamLoading');
      el.textContent = `${currentLocation.name} is in the tropics — the polar jet stream does not directly influence this region.`;
      el.style.color = '';
      document.getElementById('jetStreamContent').style.display = 'none';
      document.getElementById('jetStreamPrompt').style.display  = '';
      if (jetStreamChartInstance) { jetStreamChartInstance.destroy(); jetStreamChartInstance = null; }
      jetStreamLoaded = false;
      return;
    }
    renderJetStreamData(data);
  } catch (err) {
    const el = document.getElementById('jetStreamLoading');
    if (el) { el.textContent = 'Jet stream data unavailable: ' + err.message; el.style.color = 'var(--negative)'; }
    if (jetStreamLoaded) {
      document.getElementById('jetStreamStatsRow').innerHTML =
        `<div style="grid-column:1/-1;color:var(--negative);font-family:'DM Mono',monospace;font-size:11px;padding:16px;">Jet stream data unavailable: ${err.message}</div>`;
    }
  }
}
