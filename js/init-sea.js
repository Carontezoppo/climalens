// Initialisation for sea.html — Sea Data

function init() {
  // ── Currents colour-mode toggle ───────────────────────────────────────────
  document.querySelectorAll('.currents-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.currents-mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      colorMode = btn.dataset.mode;
      const isTemp = colorMode === 'temperature';
      document.getElementById('currentsTempLegend').style.display  = isTemp ? '' : 'none';
      document.getElementById('currentsSpeedLegend').style.display = isTemp ? 'none' : '';
    });
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  setTimeout(initWaterLevelSection, 0);
  setTimeout(fetchSSTGlobalTrend, 0);
  setTimeout(fetchEnso, 0);
  setTimeout(initSSTMap, 0);
  setTimeout(loadSeaIceData, 0);
  setTimeout(initLiveCurrentsMap, 0);
  setTimeout(initPaleo, 0);
}
init();
