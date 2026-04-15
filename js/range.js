// Historical range loader and date range picker

// INIT & RANGE PICKER
// ============================================================
async function loadRange(startYr, startMo, endYr, endMo) {
  // Show loading state
  const kpiRow = document.getElementById('kpiRow');
  kpiRow.innerHTML = '';
  if (!document.getElementById('loadingMsg')) {
    const msg = document.createElement('div');
    msg.id = 'loadingMsg';
    msg.style.cssText = 'text-align:center;padding:60px 0;font-family:\'DM Mono\',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted)';
    msg.textContent = 'Loading weather data\u2026';
    kpiRow.before(msg);
  }
  try {
    const monthDefs = buildMonthDefs(startYr, startMo, endYr, endMo);
    applyMonthDefs(monthDefs);
    const json = await fetchWeatherData(startYr, startMo, endYr, endMo);
    DATA = aggregateToMonthly(json, monthDefs);
    renderDashboard();
  } catch (err) {
    const msg = document.getElementById('loadingMsg');
    if (msg) { msg.textContent = 'Could not load weather data: ' + err.message; msg.style.color = 'var(--negative)'; }
  }
}

function currentRange() {
  const [fy, fm] = document.getElementById('rangeFrom').value.split('-').map(Number);
  const [ty, tm] = document.getElementById('rangeTo').value.split('-').map(Number);
  return { startYr: fy, startMo: fm, endYr: ty, endMo: tm };
}

/* ========= SEA SURFACE TEMPERATURE ========= */
