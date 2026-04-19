// Initialisation for sea.html — Sea Data

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

  // ── Section nav — smooth scroll ──────────────────────────────────────────
  document.querySelectorAll('.section-nav-btn[href^="#"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(btn.getAttribute('href'));
      if (!target) return;
      const targetY  = target.getBoundingClientRect().top + window.scrollY - 16;
      const startY   = window.scrollY;
      const dist     = targetY - startY;
      const duration = 900;
      const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
      let t0 = null;
      const step = ts => {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / duration, 1);
        window.scrollTo(0, startY + dist * ease(p));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // ── Currents colour-mode toggle ───────────────────────────────────────────
  document.querySelectorAll('.currents-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.currents-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      colorMode = btn.dataset.mode;
      const isTemp = colorMode === 'temperature';
      document.getElementById('currentsTempLegend').style.display  = isTemp ? '' : 'none';
      document.getElementById('currentsSpeedLegend').style.display = isTemp ? 'none' : '';
    });
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  setTimeout(initSSTMap, 0);
  setTimeout(loadSeaIceData, 0);
  setTimeout(initLiveCurrentsMap, 0);
}
init();
