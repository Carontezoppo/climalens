// Initialisation for forest.html — Global Forest Cover

function init() {
  // ── Mobile nav hamburger ──────────────────────────────────────────────────
  const navHamburger = document.getElementById('navHamburger');
  const pageTabsNav  = document.getElementById('pageTabsNav');
  if (navHamburger && pageTabsNav) {
    const navOverlay = document.createElement('div');
    navOverlay.className = 'nav-overlay';
    document.body.appendChild(navOverlay);

    const openMenu = () => {
      pageTabsNav.classList.add('open');
      navOverlay.classList.add('open');
      document.getElementById('navHamburgerIcon').textContent = '✕';
      navHamburger.setAttribute('aria-expanded', 'true');
    };
    const closeMenu = () => {
      pageTabsNav.classList.remove('open');
      navOverlay.classList.remove('open');
      document.getElementById('navHamburgerIcon').textContent = '☰';
      navHamburger.setAttribute('aria-expanded', 'false');
    };

    navHamburger.addEventListener('click', () =>
      pageTabsNav.classList.contains('open') ? closeMenu() : openMenu());
    navOverlay.addEventListener('click', closeMenu);
    window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMenu(); });
  }

  // ── WorldCover map: load immediately ─────────────────────────────────────
  setTimeout(initWorldCoverMap, 0);

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
}
init();
