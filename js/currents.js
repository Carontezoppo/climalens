// Ocean currents map — hand-crafted major surface circulation paths

const OCEAN_CURRENTS = [
  // Warm currents
  { name: 'Gulf Stream / N. Atlantic Drift', type: 'warm',
    coords: [[-80,24],[-79,26],[-78,28],[-77,30],[-76,32],[-75,35],[-72,38],[-68,40],[-62,43],[-55,46],[-47,49],[-40,51],[-32,53],[-22,55],[-14,57],[-5,58],[5,60],[15,63]] },
  { name: 'Kuroshio Current', type: 'warm',
    coords: [[130,18],[130,22],[131,26],[134,30],[138,34],[141,37],[143,40],[147,43],[155,45],[165,46],[175,46]] },
  { name: 'North Pacific Current', type: 'warm',
    coords: [[175,46],[185,47],[195,48],[205,49],[215,49],[225,48],[233,46]] },
  { name: 'East Australian Current', type: 'warm',
    coords: [[154,-14],[154,-18],[154,-22],[153,-26],[152,-30],[151,-34],[150,-38],[149,-42]] },
  { name: 'Agulhas Current', type: 'warm',
    coords: [[42,-10],[43,-14],[42,-18],[41,-22],[38,-26],[35,-30],[33,-34],[28,-37],[20,-40],[15,-42],[8,-42],[0,-40]] },
  { name: 'Brazil Current', type: 'warm',
    coords: [[-35,-10],[-36,-14],[-38,-18],[-39,-22],[-42,-26],[-45,-30],[-48,-34],[-52,-38],[-55,-42]] },
  { name: 'N. Equatorial Current (Atlantic)', type: 'warm',
    coords: [[-18,14],[-25,14],[-32,13],[-40,12],[-48,11],[-55,11],[-60,12]] },
  { name: 'N. Equatorial Current (Pacific)', type: 'warm',
    coords: [[-115,14],[-125,14],[-135,14],[-145,13],[-155,13],[-165,13],[-175,13],[-185,13],[-195,14],[-205,15],[-215,15],[-232,16]] },
  { name: 'S. Equatorial Current (Atlantic)', type: 'warm',
    coords: [[-8,-4],[-15,-4],[-22,-4],[-30,-4],[-38,-4],[-46,-4],[-52,-2]] },
  { name: 'S. Equatorial Current (Pacific)', type: 'warm',
    coords: [[-80,-5],[-90,-5],[-100,-5],[-110,-5],[-120,-5],[-130,-6],[-140,-7],[-150,-8],[-160,-8],[-170,-8],[-180,-8],[-190,-8],[-205,-8],[-215,-8]] },
  // Cold currents
  { name: 'Labrador Current', type: 'cold',
    coords: [[-60,65],[-58,60],[-56,55],[-54,52],[-53,48],[-54,44],[-56,42]] },
  { name: 'Canary Current', type: 'cold',
    coords: [[-14,56],[-14,50],[-13,44],[-12,38],[-11,32],[-14,26],[-17,20],[-18,15]] },
  { name: 'California Current', type: 'cold',
    coords: [[-128,50],[-127,46],[-126,42],[-125,38],[-122,34],[-118,30],[-113,25],[-110,20]] },
  { name: 'Benguela Current', type: 'cold',
    coords: [[18,-35],[15,-30],[13,-24],[12,-18],[11,-12],[10,-6]] },
  { name: 'Humboldt (Peru) Current', type: 'cold',
    coords: [[-68,-54],[-72,-48],[-76,-42],[-76,-36],[-74,-30],[-73,-24],[-72,-18],[-75,-12],[-78,-6],[-82,-2]] },
  { name: 'Oyashio Current', type: 'cold',
    coords: [[148,52],[147,48],[146,44],[145,42],[144,40],[143,38]] },
  { name: 'Antarctic Circumpolar Current', type: 'cold',
    coords: [[-180,-57],[-160,-59],[-140,-59],[-120,-58],[-100,-57],[-80,-58],[-60,-59],[-40,-58],[-20,-57],[0,-56],[20,-56],[40,-57],[60,-58],[80,-58],[100,-57],[120,-57],[140,-58],[160,-58],[180,-57]] },
];

function calcCurrentBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function initCurrentsMap() {
  if (!window.L) return;
  const map = L.map('currentsMap', {
    center: [10, 0], zoom: 2, minZoom: 2, maxZoom: 6,
    zoomSnap: 0, worldCopyJump: false, attributionControl: true,
    maxBounds: [[-90, -220], [90, 260]],
    maxBoundsViscosity: 0.8
  });

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      const w = map.getContainer().offsetWidth;
      const h = map.getContainer().offsetHeight;
      const coverZoom = Math.log2(Math.max(w, h) / 256);
      map.setView([10, 0], Math.max(2, coverZoom));
    }
  }, 200);

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')
    .then(r => r.json())
    .then(topo => {
      const raw = topojson.mesh(topo, topo.objects.land);
      const lines = [];
      raw.coordinates.forEach(line => {
        let seg = [line[0]];
        for (let i = 1; i < line.length; i++) {
          if (Math.abs(line[i][0] - line[i - 1][0]) > 180) {
            if (seg.length > 1) lines.push(seg);
            seg = [line[i]];
          } else { seg.push(line[i]); }
        }
        if (seg.length > 1) lines.push(seg);
      });
      L.geoJSON(
        { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines }, properties: {} },
        { style: { fill: false, color: 'rgba(255,255,255,0.18)', weight: 0.8, opacity: 1 }, interactive: false }
      ).addTo(map);

      OCEAN_CURRENTS.forEach(current => {
        const warmColor = 'rgba(251,146,60,0.85)';
        const coldColor = 'rgba(56,189,248,0.85)';
        const color = current.type === 'warm' ? warmColor : coldColor;
        // coords stored as [lng, lat]; Leaflet polyline needs [lat, lng]
        const llCoords = current.coords.map(([lng, lat]) => [lat, lng]);
        L.polyline(llCoords, { color, weight: 2.5, opacity: 1, smoothFactor: 1.5, interactive: false }).addTo(map);

        // Arrow markers at evenly-spaced intervals
        const n = current.coords.length;
        const step = Math.max(2, Math.floor(n / Math.max(2, Math.floor(n / 3))));
        for (let i = step - 1; i < n - 1; i += step) {
          const [lng1, lat1] = current.coords[i];
          const [lng2, lat2] = current.coords[Math.min(i + 1, n - 1)];
          const b = calcCurrentBearing(lat1, lng1, lat2, lng2);
          const arrowFill = current.type === 'warm' ? 'rgba(251,146,60,0.95)' : 'rgba(56,189,248,0.95)';
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:12px;height:12px;transform:rotate(${b}deg);display:flex;align-items:center;justify-content:center;pointer-events:none;">` +
              `<svg width="12" height="12" viewBox="0 0 12 12" style="overflow:visible">` +
              `<polygon points="6,0 11,11 6,8 1,11" fill="${arrowFill}" stroke="none"/>` +
              `</svg></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6]
          });
          L.marker([lat1, lng1], { icon, interactive: false, keyboard: false }).addTo(map);
        }
      });
    });
}
