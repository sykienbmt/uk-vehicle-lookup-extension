/**
 * HTML parser for GOV.UK Vehicle Enquiry Service (vehicleenquiry.service.gov.uk).
 * Pure string/regex implementation so it runs inside MV3 Service Workers and Node tests.
 */

/**
 * Decodes common HTML entities and strips tags/extra whitespace.
 * @param {string} htmlFragment
 * @returns {string}
 */
export function cleanHtmlText(htmlFragment) {
  if (!htmlFragment) return '';
  return htmlFragment
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&pound;|&#xA3;|&#163;/gi, '£')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8322;/g, '₂')
    .replace(/[✓✗]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the authenticity_token specifically for the /vehicle-enquiry/save form.
 * @param {string} html
 * @returns {string|null}
 */
export function extractGovUkFormToken(html) {
  if (!html) return null;
  const saveFormMatch = html.match(
    /action="\/vehicle-enquiry\/save[^"]*"[^>]*>[\s\S]*?<input[^>]+name="authenticity_token"[^>]+value="([^"]+)"/i
  );
  if (saveFormMatch && saveFormMatch[1]) {
    return saveFormMatch[1];
  }
  const metaMatch = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i);
  return metaMatch ? metaMatch[1] : null;
}

/**
 * Parses the intermediate confirmation page ("Is this the vehicle you are looking for?").
 * @param {string} html
 * @returns {{ isConfirmPage: boolean, isNotFound: boolean, errorMessage: string|null, token: string|null, preview: object }}
 */
export function parseGovUkConfirmPage(html) {
  const isConfirmPage = /Is this the vehicle you are looking for\?/i.test(html);
  const isNotFound =
    /Vehicle details could not be found/i.test(html) ||
    /You must enter your registration number in a valid format/i.test(html) ||
    /registration number you have provided is invalid/i.test(html);

  let errorMessage = null;
  if (isNotFound) {
    errorMessage = /is invalid|valid format/i.test(html)
      ? 'Registration number is not valid on DVLA (GOV.UK).'
      : 'Vehicle details could not be found on DVLA (GOV.UK).';
  }

  const preview = {};
  const rowRegex = /<div\s+class="govuk-summary-list__row"[^>]*>[\s\S]*?<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>[\s\S]*?<\/div>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const label = cleanHtmlText(match[1]);
    const value = cleanHtmlText(match[2]);
    if (label && value) {
      preview[label] = value;
    }
  }

  return {
    isConfirmPage,
    isNotFound,
    errorMessage,
    token: extractGovUkFormToken(html),
    preview
  };
}

/**
 * Parses the final GOV.UK Vehicle Tax and MOT status results page.
 * @param {string} html
 * @returns {object}
 */
export function parseGovUkResultPage(html) {
  const details = {};
  const fieldsById = {};

  // Extract all summary list rows
  const rowRegex = /<div\s+class="govuk-summary-list__row"(?:\s+id="([^"]+)")?[^>]*>[\s\S]*?<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>[\s\S]*?<\/div>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowId = match[1] || '';
    const label = cleanHtmlText(match[2]);
    const value = cleanHtmlText(match[3]);
    if (label && value) {
      details[label] = value;
      if (rowId) {
        fieldsById[rowId] = value;
      }
    }
  }

  // Extract Tax Panel
  const taxPanelMatch = html.match(/id="tax-status-panel"[^>]*>([\s\S]*?)(?:<details|id="mot-status-panel"|$)/i);
  const taxBlock = taxPanelMatch ? taxPanelMatch[1] : html;
  const taxTitleMatch = taxBlock.match(/<h2[^>]*class="[^"]*govuk-panel__title[^"]*"[^>]*>[\s\S]*?<span\s+aria-hidden="true">([\s\S]*?)<\/span>/i);
  const taxBodyMatch = taxBlock.match(/<div[^>]*class="[^"]*govuk-panel__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  const taxStatus = taxTitleMatch ? cleanHtmlText(taxTitleMatch[1]) : (fieldsById.vehicleStatus || 'Unknown');
  const taxDueRaw = taxBodyMatch ? cleanHtmlText(taxBodyMatch[1]) : '';
  const taxDue = taxDueRaw.replace(/^Tax due:\s*/i, '').trim();

  // Extract MOT Panel
  const motPanelMatch = html.match(/id="mot-status-panel"([^>]*)>([\s\S]*?)(?:<details|class="govuk-warning-text"|$)/i);
  const motAttrs = motPanelMatch ? motPanelMatch[1] : '';
  const motBlock = motPanelMatch ? motPanelMatch[2] : html;
  const motTitleSpanMatch = motBlock.match(/<h2[^>]*class="[^"]*govuk-panel__title[^"]*"[^>]*>[\s\S]*?<span\s+aria-hidden="true">([\s\S]*?)<\/span>/i);
  const motTitlePlainMatch = motBlock.match(/<h2[^>]*class="[^"]*govuk-panel__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
  const motBodyStrongMatch = motBlock.match(/<div[^>]*class="[^"]*govuk-panel__body[^"]*"[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i);
  const motBodyMatch = motBlock.match(/<div[^>]*class="[^"]*govuk-panel__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  const motStatus = motTitleSpanMatch
    ? cleanHtmlText(motTitleSpanMatch[1])
    : (motTitlePlainMatch ? cleanHtmlText(motTitlePlainMatch[1]) : 'Unknown');
  const motExpiryRaw = motBodyStrongMatch
    ? cleanHtmlText(motBodyStrongMatch[1])
    : (motBodyMatch ? cleanHtmlText(motBodyMatch[1]) : '');
  const motExpiry = motExpiryRaw.replace(/^Expires:\s*/i, '').trim();

  const isTaxValid = /^taxed$/i.test(taxStatus) || (/taxed/i.test(taxStatus) && !/untaxed/i.test(taxStatus));
  const isMotValid =
    /govuk-panel--confirmation/i.test(motAttrs) ||
    /^mot$/i.test(motStatus) ||
    (/valid/i.test(motStatus) && !/no\s+mot|expired/i.test(motStatus));

  // Plate shown in the results header, used to verify the page belongs to the queried VRN
  const regMarkMatch = html.match(/<span[^>]*class="[^"]*reg-mark[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const vrn = regMarkMatch ? cleanHtmlText(regMarkMatch[1]).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

  return {
    source: 'vehicleenquiry.service.gov.uk',
    vrn,
    taxStatus,
    taxDue,
    isTaxValid,
    motStatus,
    motExpiry,
    isMotValid,
    make: fieldsById.make || details['Vehicle make'] || '',
    firstRegistration: fieldsById.date_of_first_registration || details['Date of first registration'] || '',
    year: fieldsById.year_of_manufacture || details['Year of manufacture'] || '',
    engineSize: fieldsById.engine_capacity || details['Cylinder capacity'] || '',
    co2Emissions: fieldsById.co2_emissions || details['CO₂ emissions'] || '',
    fuelType: fieldsById.fuel_type || details['Fuel type'] || '',
    euroStatus: fieldsById.euro_status || details['Euro status'] || '',
    rde: fieldsById.real_driving_emissions || details['Real Driving Emissions (RDE)'] || '',
    exportMarker: fieldsById.marked_for_export || details['Export marker'] || '',
    vehicleStatus: fieldsById.vehicleStatus || details['Vehicle status'] || '',
    colour: fieldsById.colour || details['Vehicle colour'] || '',
    typeApproval: fieldsById.type_approval || details['Vehicle type approval'] || '',
    wheelplan: fieldsById.wheelPlan || details['Wheelplan'] || '',
    revenueWeight: fieldsById.revenue_weight || details['Revenue weight'] || '',
    lastV5cDate: fieldsById.date_of_last_v5c_issued || details['Date of last V5C (logbook) issued'] || '',
    rawDetails: details
  };
}
