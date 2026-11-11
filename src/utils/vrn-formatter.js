/**
 * Utility functions for UK Vehicle Registration Number (VRN) normalization,
 * validation, display formatting, EV classification, and colour swatch mapping.
 */

/**
 * Strips spaces, hyphens, and non-alphanumeric characters and converts to uppercase.
 * @param {string} rawInput
 * @returns {string} Clean VRN (e.g., "DN16FTK")
 */
export function normalizeVrn(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return '';
  }
  return rawInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

/**
 * Validates whether a normalized VRN looks like a valid UK number plate (2 to 8 alphanumeric chars).
 * @param {string} vrn
 * @returns {boolean}
 */
export function isValidUkVrn(vrn) {
  const clean = normalizeVrn(vrn);
  if (clean.length < 2 || clean.length > 8) {
    return false;
  }
  return /[A-Z]/.test(clean) && /[0-9]/.test(clean);
}

/**
 * Formats a clean VRN into standard UK plate spacing for display (e.g., "DN16FTK" -> "DN16 FTK").
 * @param {string} vrn
 * @returns {string}
 */
export function formatVrnDisplay(vrn) {
  const clean = normalizeVrn(vrn);
  if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(clean)) {
    return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  }
  if (/^[A-Z][0-9]{1,3}[A-Z]{3}$/.test(clean)) {
    return `${clean.slice(0, clean.length - 3)} ${clean.slice(clean.length - 3)}`;
  }
  if (/^[A-Z]{3}[0-9]{1,3}[A-Z]$/.test(clean)) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

/**
 * Classifies whether a vehicle is Pure Electric (EV), Hybrid, or Non-EV (ICE).
 * @param {string} fuelType
 * @param {string} co2Emissions
 * @returns {{ kind: 'ev'|'hybrid'|'ice', badgeText: string, detailText: string }}
 */
export function classifyEvStatus(fuelType, co2Emissions = '') {
  const fuel = (fuelType || '').trim().toUpperCase();
  const co2 = (co2Emissions || '').trim();

  if (
    fuel === 'ELECTRIC' ||
    fuel === 'ELECTRICITY' ||
    fuel === 'BEV' ||
    (fuel.includes('ELECTRIC') && !fuel.includes('HYBRID') && !fuel.includes('PETROL') && !fuel.includes('DIESEL')) ||
    (/^0\s*g\/km/i.test(co2) && !fuel.includes('PETROL') && !fuel.includes('DIESEL'))
  ) {
    return {
      kind: 'ev',
      badgeText: '⚡ ELECTRIC (EV)',
      detailText: fuel || 'ELECTRIC (0 g/km)'
    };
  }

  if (
    fuel.includes('HYBRID') ||
    fuel.includes('ELECTRIC') ||
    fuel.includes('PHEV') ||
    fuel.includes('HEV')
  ) {
    return {
      kind: 'hybrid',
      badgeText: `🔌 HYBRID (${fuel})`,
      detailText: fuel
    };
  }

  return {
    kind: 'ice',
    badgeText: `⛽ NON-EV (${fuel || 'PETROL/DIESEL'})`,
    detailText: fuel || 'N/A'
  };
}

/**
 * Maps a UK DVLA vehicle colour name to a CSS colour hex for visual verification.
 * @param {string} colourName
 * @returns {string}
 */
export function getColourSwatchHex(colourName) {
  const c = (colourName || '').trim().toUpperCase();
  const map = {
    WHITE: '#f8fafc',
    BLACK: '#09090b',
    GREY: '#64748b',
    GRAY: '#64748b',
    SILVER: '#cbd5e1',
    BLUE: '#2563eb',
    RED: '#dc2626',
    GREEN: '#16a34a',
    YELLOW: '#facc15',
    ORANGE: '#ea580c',
    BROWN: '#78350f',
    BEIGE: '#d6d3d1',
    GOLD: '#eab308',
    PURPLE: '#9333ea',
    PINK: '#ec4899',
    MAROON: '#7f1d1d',
    TURQUOISE: '#0d9488',
    BRONZE: '#92400e',
    CREAM: '#fef3c7'
  };
  return map[c] || '#94a3b8';
}

/**
 * Builds a concise single-line summary for clipboard copying.
 * @param {object} mergedData
 * @returns {string}
 */
export function buildClipboardSummary(mergedData) {
  if (!mergedData || !mergedData.vrn) {
    return '';
  }
  const ev = classifyEvStatus(mergedData.fuelType, mergedData.co2Emissions);
  const parts = [
    formatVrnDisplay(mergedData.vrn),
    [mergedData.make, mergedData.model, mergedData.bodyStyle ? `(${mergedData.bodyStyle})` : ''].filter(Boolean).join(' '),
    mergedData.colour ? `Colour: ${mergedData.colour}` : '',
    ev.badgeText,
    mergedData.year ? `Year: ${mergedData.year}` : '',
    mergedData.taxStatus ? `Tax: ${mergedData.taxStatus}${mergedData.taxDue ? ` (${mergedData.taxDue})` : ''}` : '',
    mergedData.motStatus ? `MOT: ${mergedData.motStatus}${mergedData.motExpiry ? ` (${mergedData.motExpiry})` : ''}` : ''
  ].filter(Boolean);

  return parts.join(' | ');
}
