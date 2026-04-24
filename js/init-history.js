// Initialisation for history.html — Historical Climate

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
    document.getElementById('climateSectionTitle').textContent = LOCATIONS[idx].name + ' — Climate Trends';
    locationList.querySelectorAll('.location-option').forEach(el => {
      el.classList.toggle('active', +el.dataset.idx === idx);
    });
    locationDropdown.classList.remove('open');
    locationSearch.value = '';
    filterLocations('');
    const { startYr, startMo, endYr, endMo } = currentRange();
    loadClimateData();
    loadRange(startYr, startMo, endYr, endMo);
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

  // ── Range picker ──────────────────────────────────────────────────────────
  const { startYr, startMo, endYr, endMo } = defaultRange(6);

  const fromInput = document.getElementById('rangeFrom');
  const toInput   = document.getElementById('rangeTo');
  fromInput.value = `${startYr}-${pad2(startMo)}`;
  toInput.value   = `${endYr}-${pad2(endMo)}`;

  const maxDate = (() => {
    const d = new Date(); d.setDate(1); d.setDate(0);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  })();
  fromInput.max = maxDate;
  toInput.max   = maxDate;

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const { startYr:sy, startMo:sm, endYr:ey, endMo:em } = defaultRange(+btn.dataset.months);
      fromInput.value = `${sy}-${pad2(sm)}`;
      toInput.value   = `${ey}-${pad2(em)}`;
      loadRange(sy, sm, ey, em);
    });
  });

  document.getElementById('rangeApply').addEventListener('click', () => {
    const [fy, fm] = fromInput.value.split('-').map(Number);
    const [ty, tm] = toInput.value.split('-').map(Number);
    if (!fy || !fm || !ty || !tm) return;
    if (fy > ty || (fy === ty && fm > tm)) return;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    loadRange(fy, fm, ty, tm);
  });

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

  // ── Initial load ──────────────────────────────────────────────────────────
  document.getElementById('climateSectionTitle').textContent = currentLocation.name + ' — Climate Trends';
  initClimate();
  loadClimateData();
  loadRange(startYr, startMo, endYr, endMo);
}
init();
