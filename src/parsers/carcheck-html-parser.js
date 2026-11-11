/**
 * Parser for CarCheck.co.uk HTML/DOM data and instant UK vehicle spec lookup HTML.
 * Extracts Model, Variant, Body Style, Performance (BHP, Top Speed, 0-60),
 * Fuel Economy (MPG), Tax Costs, Insurance Group, and Registration details.
 */

import { cleanHtmlText } from './govuk-html-parser.js';

const IGNORED_LABELS = new Set([
  'sample report',
  'insurance status',
  'stolen',
  'london ulez compliant',
  'lez scotland compliant',
  'caz compliant',
  'vehicle image'
]);

/**
 * Checks if an HTML page is gated by a Cloudflare challenge ("Just a moment...").
 * @param {string} html
 * @returns {boolean}
 */
export function isCloudflareChallengePage(html) {
  if (!html) return false;
  return (
    /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html) ||
    /cdn-cgi\/challenge-platform/i.test(html)
  );
}

/**
 * Parses generic table rows (`<tr><td>Label</td><td>Value</td></tr>` or `<th>/<td>`)
 * from www.carcheck.co.uk HTML.
 * @param {string} html
 * @returns {{ isGated: boolean, title: string, fields: Record<string, string> }}
 */
export function parseCarCheckDirectHtml(html) {
  if (!html || isCloudflareChallengePage(html)) {
    return { isGated: true, title: '', fields: {} };
  }

  const fields = {};
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1Match ? cleanHtmlText(h1Match[1]) : '';

  const trRegex = /<tr[^>]*>\s*<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const label = cleanHtmlText(match[1]);
    const value = cleanHtmlText(match[2]);
    if (
      label &&
      value &&
      label.length < 45 &&
      value.length < 120 &&
      !IGNORED_LABELS.has(label.toLowerCase()) &&
      !/sign up|reveal|buy|check if/i.test(value)
    ) {
      fields[label] = value;
    }
  }

  return {
    isGated: Object.keys(fields).length === 0,
    title,
    fields
  };
}

/**
 * Parses detailed vehicle specifications from FreeCheck HTML (`cert-label` / `cert-data-text`).
 * @param {string} html
 * @returns {object}
 */
export function parseExtendedSpecHtml(html) {
  if (!html) return { fields: {} };

  const fields = {};
  const trBlockRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trBlockRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const labelMatch = rowHtml.match(/<span\s+class="cert-label">([\s\S]*?)<\/span>/i);
    const valMatch = rowHtml.match(/<span\s+class="cert-data(?:-text)?[^"]*">([\s\S]*?)<\/span>/i);
    if (!labelMatch || !valMatch) continue;

    const label = cleanHtmlText(labelMatch[1]);
    const value = cleanHtmlText(valMatch[1]);
    if (
      label &&
      value &&
      !IGNORED_LABELS.has(label.toLowerCase()) &&
      !/check if|show ulez|show lez|show caz|sign up/i.test(value)
    ) {
      fields[label] = value;
    }
  }

  // Extract vehicle image & make logo if available
  const imgMatch = html.match(/<img\s+id="vehicleImage"[^>]+src="([^"]+)"/i);
  const vehicleImage = imgMatch ? imgMatch[1] : '';

  const logoMatch = html.match(/<img\s+id="vehicleMakeImage"[^>]+src="([^"]+)"/i);
  const makeLogo = logoMatch
    ? (logoMatch[1].startsWith('http') ? logoMatch[1] : `https://totalcarcheck.co.uk${logoMatch[1]}`)
    : '';

  return {
    make: fields['Manufacturer'] || '',
    model: fields['Model'] || '',
    modelDetail: fields['Model Detail'] || '',
    colour: fields['Colour'] || '',
    vehicleType: fields['Vehicle Type'] || '',
    bodyStyle: fields['Body Style'] || '',
    fuelType: fields['Fuel Type'] || '',
    engineSize: fields['Engine Size'] || '',
    euroStatus: fields['Euro Status'] || '',
    bhp: fields['BHP'] || '',
    vehicleAge: fields['Vehicle Age'] || '',
    registeredDate: fields['Registered Date'] || '',
    v5cIssueDate: fields['V5C Issue Date'] || '',
    registeredNear: fields['Registered Near'] || '',
    year: fields['Year of Manf.'] || '',
    insuranceGroup: fields['Insurance Group'] || '',
    mpgUrban: fields['Urban'] || '',
    mpgExtraUrban: fields['Extra-Urban'] || '',
    mpgCombined: fields['Combined'] || '',
    topSpeed: fields['Top Speed'] || '',
    zeroToSixty: fields['0-60 MPH'] || '',
    tax12Months: fields['12 Months Cost'] || '',
    tax6Months: fields['6 Months Cost'] || '',
    co2Output: fields['CO₂ Output'] || '',
    motStatusSummary: fields['MOT Status'] || '',
    motDaysLeft: fields['Days Left'] || '',
    roadTaxSummary: fields['Road Tax Status'] || '',
    exported: fields['Exported'] || '',
    vehicleImage,
    makeLogo,
    fields
  };
}
