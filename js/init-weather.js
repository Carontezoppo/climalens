// Initialisation for index.html — Weather & Forecast

function init() {
  // ── Location picker ───────────────────────────────────────────────────────
  const locationBtn       = document.getElementById('locationSelectBtn');
  const locationLabel     = document.getElementById('locationSelectLabel');
  const locationDropdown  = document.getElementById('locationDropdown');
  const locationSearch    = document.getElementById('locationSearch');
  const locationList      = document.getElementById('locationList');
  const locationNoResults = document.getElementById('locationNoResults');

  function setForecastTitle(name) {
    document.getElementById('forecastSectionTitle').textContent = name + ', 9-Day Forecast';
  }

  function selectLocation(idx) {
    currentLocation = LOCATIONS[idx];
    localStorage.setItem('selectedLocationIdx', String(idx));
    locationLabel.textContent = LOCATIONS[idx].name;
    setForecastTitle(LOCATIONS[idx].name);
    locationList.querySelectorAll('.location-option').forEach(el => {
      const selected = +el.dataset.idx === idx;
      el.classList.toggle('active', selected);
      el.setAttribute('aria-selected', String(selected));
    });
    locationDropdown.classList.remove('open');
    locationBtn.setAttribute('aria-expanded', 'false');
    locationSearch.value = '';
    filterLocations('');
    updateMap();
    loadForecast();
    loadAirQuality();
  }

  locationList.setAttribute('role', 'listbox');
  locationList.setAttribute('aria-label', 'Select city');

  const groupHeaders = [];
  let globalIdx = 0;
  LOCATION_GROUPS.forEach(group => {
    const header = document.createElement('div');
    header.className = 'location-optgroup-label';
    header.setAttribute('role', 'presentation');
    header.textContent = group.continent;
    locationList.appendChild(header);
    const itemsInGroup = [];
    group.locations.forEach(loc => {
      const item = document.createElement('div');
      item.className = 'location-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
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

  locationLabel.textContent = currentLocation.name;
  const _activeIdx = parseInt(localStorage.getItem('selectedLocationIdx'), 10);
  locationList.querySelectorAll('.location-option').forEach(el => {
    const selected = +el.dataset.idx === (_activeIdx || 0);
    el.classList.toggle('active', selected);
    el.setAttribute('aria-selected', String(selected));
  });

  locationBtn.setAttribute('aria-expanded', 'false');
  locationBtn.setAttribute('aria-haspopup', 'listbox');
  locationBtn.setAttribute('aria-controls', 'locationList');
  locationBtn.addEventListener('click', e => {
    e.stopPropagation();
    const opening = !locationDropdown.classList.contains('open');
    locationDropdown.classList.toggle('open');
    locationBtn.setAttribute('aria-expanded', String(opening));
    if (opening) {
      locationSearch.value = '';
      filterLocations('');
      locationSearch.focus();
    }
  });
  locationDropdown.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => {
    locationDropdown.classList.remove('open');
    locationBtn.setAttribute('aria-expanded', 'false');
    locationSearch.value = '';
    filterLocations('');
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  setForecastTitle(currentLocation.name);
  initMap();
  initAirQuality();
  loadForecast();
  loadAirQuality();
}
init();
