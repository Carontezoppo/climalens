/* ========= EL NIÑO / ENSO CARD (sea.html) ========= */

// ONI season codes → readable month span
const ENSO_SEASONS = {
  DJF: 'Dec–Feb', JFM: 'Jan–Mar', FMA: 'Feb–Apr', MAM: 'Mar–May', AMJ: 'Apr–Jun', MJJ: 'May–Jul',
  JJA: 'Jun–Aug', JAS: 'Jul–Sep', ASO: 'Aug–Oct', SON: 'Sep–Nov', OND: 'Oct–Dec', NDJ: 'Nov–Jan',
};

// NOAA thresholds: ±0.5 °C for a phase; strength bands are the conventional ones
function ensoPhase(oni) {
  const a = Math.abs(oni);
  if (a < 0.5) return { name: 'Neutral', strength: '' };
  const strength = a < 1.0 ? 'Weak' : a < 1.5 ? 'Moderate' : a < 2.0 ? 'Strong' : 'Very strong';
  return { name: oni > 0 ? 'El Niño' : 'La Niña', strength };
}

function ensoColor(v) {
  if (v >= 0.5)  return 'var(--anomaly-warm)';
  if (v <= -0.5) return 'var(--anomaly-cool)';
  return 'var(--text-primary)';
}

function ensoMonthYear(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function fetchEnso() {
  try {
    const res = await fetch('/api/enso');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderEnsoCard(data);
  } catch {
    const el = document.getElementById('ensoStatus');
    if (el) el.textContent = 'ENSO data temporarily unavailable · NOAA CPC';
  }
}

function renderEnsoCard({ weekly, latest, oni }) {
  const labelEl  = document.getElementById('ensoLabel');
  const valueEl  = document.getElementById('ensoAnomaly');
  const phaseEl  = document.getElementById('ensoPhaseText');
  const statusEl = document.getElementById('ensoStatus');

  const weekOf = new Date(latest.date + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (labelEl) labelEl.textContent = `Niño 3.4 anomaly · week of ${weekOf}`;

  const sign = latest.anom >= 0 ? '+' : '';
  if (valueEl) { valueEl.textContent = `${sign}${latest.anom.toFixed(1)} °C`; valueEl.style.color = ensoColor(latest.anom); }

  const p = ensoPhase(oni.value);
  const oSign = oni.value >= 0 ? '+' : '';
  const phaseText = p.strength ? `${p.strength} ${p.name}` : p.name;
  if (phaseEl) phaseEl.textContent = `${phaseText} · ONI ${oSign}${oni.value.toFixed(2)} (${ENSO_SEASONS[oni.season] || oni.season} ${oni.year})`;

  if (statusEl) statusEl.textContent =
    'NOAA CPC · weekly OISST v2.1 Niño 3.4 (5°N–5°S, 170°W–120°W) · ONI from ERSSTv5 · 1991–2020 baseline';

  renderEnsoSparkline(weekly, latest);
}

function renderEnsoSparkline(weekly, latest) {
  const svg = document.getElementById('ensoSparkline');
  if (!svg || weekly.length < 2) return;

  const W = 600, H = 120, padX = 2, padY = 4;
  const vals = weekly.map(w => w.anom);
  // Always keep the ±0.5 thresholds in range so they are visible
  const minVal = Math.min(-0.8, ...vals);
  const maxVal = Math.max( 0.8, ...vals);

  const sx = i => padX + i / (weekly.length - 1) * (W - 2 * padX);
  const sy = v => H - padY - (v - minVal) / (maxVal - minVal) * (H - 2 * padY);

  const zeroY = sy(0);
  const lineD = 'M ' + weekly.map((w, i) => `${sx(i).toFixed(1)},${sy(w.anom).toFixed(1)}`).join(' L ');
  const fillD = `${lineD} L ${sx(weekly.length - 1).toFixed(1)},${zeroY.toFixed(1)} L ${sx(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const ref   = y => `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${W - padX}" y2="${y.toFixed(1)}"
                        style="stroke:var(--text-muted)" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3,3"/>`;

  // Warm (above zero) drawn red, cool (below zero) drawn blue, split by clip paths
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <clipPath id="ensoClipWarm"><rect x="0" y="0" width="${W}" height="${zeroY.toFixed(1)}"/></clipPath>
      <clipPath id="ensoClipCool"><rect x="0" y="${zeroY.toFixed(1)}" width="${W}" height="${(H - zeroY).toFixed(1)}"/></clipPath>
      <linearGradient id="ensoGradWarm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--anomaly-warm)" stop-opacity="0.35"/><stop offset="100%" style="stop-color:var(--anomaly-warm)" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="ensoGradCool" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" style="stop-color:var(--anomaly-cool)" stop-opacity="0.35"/><stop offset="100%" style="stop-color:var(--anomaly-cool)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${ref(sy(0.5))}${ref(sy(-0.5))}
    <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${W - padX}" y2="${zeroY.toFixed(1)}"
          style="stroke:var(--text-muted)" stroke-opacity="0.5" stroke-width="1"/>
    <path d="${fillD}" fill="url(#ensoGradWarm)" clip-path="url(#ensoClipWarm)"/>
    <path d="${fillD}" fill="url(#ensoGradCool)" clip-path="url(#ensoClipCool)"/>
    <path d="${lineD}" fill="none" style="stroke:var(--anomaly-warm)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#ensoClipWarm)"/>
    <path d="${lineD}" fill="none" style="stroke:var(--anomaly-cool)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#ensoClipCool)"/>
  `;

  const start = ensoMonthYear(weekly[0].date);
  const end   = ensoMonthYear(latest.date);
  const sign  = latest.anom >= 0 ? '+' : '';
  svg.setAttribute('aria-label', `Weekly Niño 3.4 sea surface temperature anomaly, ${start} to ${end}. Latest ${sign}${latest.anom.toFixed(1)} °C.`);
  const startEl = document.getElementById('ensoSparklineStart');
  const endEl   = document.getElementById('ensoSparklineEnd');
  if (startEl) startEl.textContent = start;
  if (endEl)   endEl.textContent   = end;
}
