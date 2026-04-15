// Main initialisation — wires up all sections

function init() {
  // Build custom location dropdown
  const locationBtn      = document.getElementById('locationSelectBtn');
  const locationLabel    = document.getElementById('locationSelectLabel');
  const locationDropdown = document.getElementById('locationDropdown');
  const locationSearch   = document.getElementById('locationSearch');
  const locationList     = document.getElementById('locationList');
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
    const { startYr, startMo, endYr, endMo } = currentRange();
    updateMap();
    loadForecast();
    loadAirQuality();
    loadClimateData();
    loadRange(startYr, startMo, endYr, endMo);
  }

  // Build list: each group gets a header + items; keep a ref to each header
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
  // Prevent closing the dropdown when typing in the search box
  locationSearch.addEventListener('click', e => e.stopPropagation());

  // Set initial state
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

  const { startYr, startMo, endYr, endMo } = defaultRange(6);

  // Set input values
  const fromInput = document.getElementById('rangeFrom');
  const toInput   = document.getElementById('rangeTo');
  fromInput.value = `${startYr}-${pad2(startMo)}`;
  toInput.value   = `${endYr}-${pad2(endMo)}`;

  // Cap max to last fully completed month
  const maxDate = (() => {
    const d = new Date(); d.setDate(1); d.setDate(0);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  })();
  fromInput.max = maxDate;
  toInput.max   = maxDate;

  // Preset buttons
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

  // Apply button
  document.getElementById('rangeApply').addEventListener('click', () => {
    const [fy, fm] = fromInput.value.split('-').map(Number);
    const [ty, tm] = toInput.value.split('-').map(Number);
    if (!fy || !fm || !ty || !tm) return;
    if (fy > ty || (fy === ty && fm > tm)) return;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    loadRange(fy, fm, ty, tm);
  });

  // Section nav — custom scroll so the animation is slow enough to feel deliberate
  document.querySelectorAll('.section-nav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(btn.getAttribute('href'));
      if (!target) return;
      const targetY = target.getBoundingClientRect().top + window.scrollY - 16;
      const startY  = window.scrollY;
      const dist    = targetY - startY;
      const duration = 900; // ms — noticeably slower than the ~300ms browser default
      const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; // ease-in-out cubic
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

  // Initial load — map, forecast, air quality and historical data run in parallel
  initMap();
  initAirQuality();
  initClimate();
  setTimeout(initSSTMap, 0); // defer so Leaflet measures the container after first paint
  setTimeout(initLiveCurrentsMap, 0);
  loadForecast();
  loadAirQuality();
  loadClimateData();
  loadRange(startYr, startMo, endYr, endMo);
}
init();
