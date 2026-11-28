// Initialisation for forest.html — Global Forest Cover

function init() {
  // ── Land cover globe: load immediately ────────────────────────────────────
  setTimeout(initLandCoverGlobe, 0);

  // ── MODIS animation: user-triggered via gate ──────────────────────────────
  const forestLoadBtn  = document.getElementById('forestLoadBtn');
  const forestGate     = document.getElementById('forestGate');
  const forestMapSection = document.getElementById('forestMapSection');

  function triggerForestLoad() {
    forestGate.hidden = true;
    forestMapSection.hidden = false;
    sessionStorage.setItem('modisLoaded', '1');
    setTimeout(initForestMap, 0);
  }

  forestLoadBtn.addEventListener('click', triggerForestLoad);

  if (sessionStorage.getItem('modisLoaded')) triggerForestLoad();

  // ── Grassland map: two ~1.3 MB images, so only once it nears the viewport ──
  const grassEl = document.getElementById('grassMap');
  const grassObs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    grassObs.disconnect();
    initGrassMap();
  }, { rootMargin: '400px' });
  grassObs.observe(grassEl);
}
init();
