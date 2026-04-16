// Initialisation for index.html — Weather & Forecast

function init() {
  // ── Location picker ───────────────────────────────────────────────────────
  const locationBtn       = document.getElementById('locationSelectBtn');
  const locationLabel     = document.getElementById('locationSelectLabel');
  const locationDropdown  = document.getElementById('locationDropdown');
  const locationSearch    = document.getElementById('locationSearch');
  const locationList      = document.getElementById('locationList');
  const locationNoResults = document.getElementById('locationNoResults');

  function selectLocation(idx) {
    currentLocation = LOCATIONS[idx];
    locationLabel.textContent = LOCATIONS[idx].name;
    locationList.querySelectorAll('.location-option').forEach(el => {
      el.classList.toggle('active', +el.dataset.idx === idx);
    });
    locationDropdown.classList.remove('open');
    locationSearch.value = '';
    filterLocations('');
    updateMap();
    loadForecast();
    loadAirQuality();
  }

  const groupHeaders = [];
  let globalIdx = 0;
  LOCATION_GROUPS.forEach(group => {
    const header = document.createElement('div');
    header.className = 'location-optgroup-label';
    header.textContent = group.continent;
    locationList.appendChild(header);
    const itemsInGroup = [];
    group.locations.forEach(loc => {
      const item = document.createElement('div');
      item.className = 'location-option';
      item.textContent = loc.name;
      item.dataset.idx = globalIdx++;
      item.addEventListener('click', () => selectLocation(+item.dataset.idx));
      locationList.appendChild(item);
      itemsInGroup.push(item);
    });
    groupHeaders.push({ header, items: itemsInGroup });
  });

  function filterLocations(query) {
    const q = query.trim().toLowerCase();
    let anyVisible = false;
    groupHeaders.forEach(({ header, items }) => {
      let groupVisible = false;
      items.forEach(item => {
        const match = !q || item.textContent.toLowerCase().includes(q);
        item.style.display = match ? '' : 'none';
        if (match) groupVisible = true;
      });
      header.style.display = groupVisible ? '' : 'none';
      if (groupVisible) anyVisible = true;
    });
    locationNoResults.style.display = anyVisible ? 'none' : 'block';
  }

  locationSearch.addEventListener('input', () => filterLocations(locationSearch.value));
  locationSearch.addEventListener('click', e => e.stopPropagation());

  locationLabel.textContent = LOCATIONS[0].name;
  locationList.querySelector('.location-option').classList.add('active');

  locationBtn.addEventListener('click', e => {
    e.stopPropagation();
    const opening = !locationDropdown.classList.contains('open');
    locationDropdown.classList.toggle('open');
    if (opening) {
      locationSearch.value = '';
      filterLocations('');
      locationSearch.focus();
    }
  });
  locationDropdown.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => {
    locationDropdown.classList.remove('open');
    locationSearch.value = '';
    filterLocations('');
  });

  // ── Mobile nav hamburger ──────────────────────────────────────────────────
  const navHamburger = document.getElementById('navHamburger');
  const pageTabsNav  = document.getElementById('pageTabsNav');
  if (navHamburger && pageTabsNav) {
    navHamburger.addEventListener('click', () => {
      const isOpen = pageTabsNav.classList.toggle('open');
      document.getElementById('navHamburgerIcon').textContent = isOpen ? '✕' : '☰';
      navHamburger.setAttribute('aria-expanded', String(isOpen));
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        pageTabsNav.classList.remove('open');
        document.getElementById('navHamburgerIcon').textContent = '☰';
        navHamburger.setAttribute('aria-expanded', 'false');
      }
    });
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

  // ── Initial load ──────────────────────────────────────────────────────────
  initMap();
  initAirQuality();
  loadForecast();
  loadAirQuality();
}
init();
