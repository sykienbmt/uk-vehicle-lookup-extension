/**
 * UI Renderer for the UK Vehicle Plate Lookup Popup / Side Panel (English UI).
 * Prioritizes Vehicle Type/Model, Colour, and Electric (EV) check at the top,
 * with Tax & MOT placed at the bottom and no nested scrollbars.
 */

import { classifyEvStatus, getColourSwatchHex } from '../utils/vrn-formatter.js';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTableHtml(rows) {
  const validRows = rows.filter(([, val]) => val && String(val).trim() !== '');
  if (validRows.length === 0) {
    return '<p style="color:#94a3b8;font-size:12px;">No detailed data available.</p>';
  }
  const trs = validRows
    .map(
      ([label, val]) =>
        `<tr><td class="label-col">${escapeHtml(label)}</td><td class="val-col">${escapeHtml(val)}</td></tr>`
    )
    .join('');
  return `<table class="data-table"><tbody>${trs}</tbody></table>`;
}

/**
 * Renders the complete lookup result into the DOM elements.
 * @param {object} payload Result from lookupUkVehicle
 * @param {object} elements DOM references
 */
function pendingSourceHint(payload) {
  if (payload.pending?.carcheck) return 'Loading image & specs...';
  if (payload.pending?.govuk) return 'Loading DVLA tax & MOT...';
  return '';
}

export function renderVehicleResult(payload, elements) {
  const m = payload.merged || {};
  const evInfo = classifyEvStatus(m.fuelType, m.co2Emissions);
  const swatchHex = getColourSwatchHex(m.colour);

  // 1. Hero Card (Make + Model + Variant + Big Hoverable Image)
  const fullTitle = [m.make, m.model].filter(Boolean).join(' ') || m.displayVrn || payload.vrn;
  const badges = [m.displayVrn, m.year, m.engineSize, m.bhp]
    .filter(Boolean)
    .map((b) => `<span class="badge-pill">${escapeHtml(b)}</span>`)
    .join('');

  const imgHtml = m.vehicleImage
    ? `<img class="hero-img" src="${escapeHtml(m.vehicleImage)}" alt="${escapeHtml(fullTitle)}" title="Hover to enlarge vehicle image" />`
    : '';

  elements.vehicleHero.innerHTML = `
    <div>
      <div class="hero-title">${escapeHtml(fullTitle)}</div>
      ${m.modelDetail ? `<div class="hero-subtitle">${escapeHtml(m.modelDetail)}</div>` : ''}
      <div class="hero-badges">${badges}</div>
      ${pendingSourceHint(payload) ? `<div class="hero-pending">⏳ ${escapeHtml(pendingSourceHint(payload))}</div>` : ''}
    </div>
    ${imgHtml}
  `;

  // 2. Top Focus Grid: Vehicle Type / Body | Colour | EV Status
  const vehicleTypeDisplay = [m.bodyStyle, m.vehicleType ? `(${m.vehicleType})` : ''].filter(Boolean).join(' ') || m.typeApproval || 'Car';
  const evCardClass = evInfo.kind === 'ev' ? 'ev-yes' : (evInfo.kind === 'hybrid' ? 'ev-hybrid' : '');
  const evMainLabel = evInfo.kind === 'ev'
    ? '⚡ ELECTRIC (EV)'
    : (evInfo.kind === 'hybrid' ? '🔌 HYBRID' : '⛽ NON-EV');

  if (elements.focusGrid) {
    elements.focusGrid.innerHTML = `
      <div class="focus-card">
        <div class="focus-label">Vehicle Type / Body</div>
        <div class="focus-value">${escapeHtml(vehicleTypeDisplay)}</div>
        <div class="focus-sub">${escapeHtml([m.make, m.year].filter(Boolean).join(' • '))}</div>
      </div>
      <div class="focus-card">
        <div class="focus-label">Colour</div>
        <div class="focus-value">
          <span class="colour-dot" style="background:${escapeHtml(swatchHex)};"></span>
          <span>${escapeHtml(m.colour || 'N/A')}</span>
        </div>
        <div class="focus-sub">DVLA Registered</div>
      </div>
      <div class="focus-card ${evCardClass}">
        <div class="focus-label">EV / Fuel Status</div>
        <div class="focus-value">${escapeHtml(evMainLabel)}</div>
        <div class="focus-sub">Fuel: ${escapeHtml(m.fuelType || 'N/A')}${m.co2Emissions ? ` • ${escapeHtml(m.co2Emissions)}` : ''}</div>
      </div>
    `;
  }

  // 3. Overview Tab (Compact key fields, no nested scroll)
  elements.tabOverview.innerHTML = buildTableHtml([
    ['Make & Model', [m.make, m.model].filter(Boolean).join(' ')],
    ['Variant / Trim', m.modelDetail],
    ['Vehicle Type / Body', [m.bodyStyle, m.vehicleType, m.wheelplan].filter(Boolean).join(' • ')],
    ['Colour', m.colour],
    ['EV / Fuel Type', `${evInfo.badgeText}`],
    ['Engine & Power', [m.engineSize, m.bhp].filter(Boolean).join(' • ')],
    ['Year / First Reg', [m.year, m.firstRegistration].filter(Boolean).join(' • ')],
    ['Registered Near', m.registeredNear],
    ['Emissions & Euro', [m.euroStatus ? `Euro ${m.euroStatus}` : '', m.co2Emissions].filter(Boolean).join(' • ')],
    ['Economy / Top Speed', [m.mpgCombined, m.topSpeed].filter(Boolean).join(' • ')],
    ['Insurance / Last V5C', [m.insuranceGroup ? `Group ${m.insuranceGroup}` : '', m.lastV5cDate ? `V5C: ${m.lastV5cDate}` : ''].filter(Boolean).join(' • ')]
  ]);

  // 4. GOV.UK Tab
  const govRaw = (payload.govuk && payload.govuk.data && payload.govuk.data.rawDetails) || {};
  elements.tabGovuk.innerHTML = buildTableHtml([
    ['Tax Status', m.taxStatus ? `${m.taxStatus}${m.taxDue ? ` (Due: ${m.taxDue})` : ''}` : ''],
    ['MOT Status', m.motStatus ? `${m.motStatus}${m.motExpiry ? ` (Expires: ${m.motExpiry})` : ''}` : ''],
    ...Object.entries(govRaw)
  ]);

  // 5. CarCheck & Specs Tab
  const specRaw = (payload.carcheck && payload.carcheck.data && payload.carcheck.data.allSpecFields) || {};
  elements.tabCarcheck.innerHTML = buildTableHtml(Object.entries(specRaw));

  // 6. Tax & MOT Status Cards (At bottom)
  const taxClass = m.taxStatus ? (m.isTaxValid ? 'valid' : 'invalid') : 'neutral';
  const taxIcon = m.taxStatus ? (m.isTaxValid ? '✓' : '✗') : '•';
  const motClass = m.motStatus ? (m.isMotValid ? 'valid' : 'invalid') : 'neutral';
  const motIcon = m.motStatus ? (m.isMotValid ? '✓' : '✗') : '•';

  elements.statusGrid.innerHTML = `
    <div class="status-card ${taxClass}">
      <div class="status-head">${taxIcon} TAX: ${escapeHtml(m.taxStatus || 'N/A')}</div>
      <div class="status-sub">${escapeHtml(m.taxDue || '')}${m.tax12Months ? ` (${escapeHtml(m.tax12Months)}/yr)` : ''}</div>
    </div>
    <div class="status-card ${motClass}">
      <div class="status-head">${motIcon} MOT: ${escapeHtml(m.motStatus || 'N/A')}</div>
      <div class="status-sub">${escapeHtml(m.motExpiry || '')}</div>
    </div>
  `;
}

/**
 * Renders the list of recent VRN chips.
 */
export function renderHistoryChips(historyList, container, clearBtn, onSelectVrn) {
  const items = historyList && historyList.length > 0
    ? historyList.slice(0, 6)
    : [{ vrn: 'DN16FTK', displayVrn: 'DN16 FTK' }];

  clearBtn.classList.toggle('hidden', !historyList || historyList.length === 0);
  container.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="history-chip" data-vrn="${escapeHtml(item.vrn)}">${escapeHtml(
          item.displayVrn || item.vrn
        )}</button>`
    )
    .join('');

  container.querySelectorAll('.history-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const vrn = chip.getAttribute('data-vrn');
      if (vrn) onSelectVrn(vrn);
    });
  });
}
