/**
 * Service for querying GOV.UK Vehicle Enquiry Service (https://vehicleenquiry.service.gov.uk).
 * Performs the 3-step Rails form submission and logs every step to diagnostic-logger.
 */

import {
  extractGovUkFormToken,
  parseGovUkConfirmPage,
  parseGovUkResultPage
} from '../parsers/govuk-html-parser.js';
import { logInfo, logWarn, logError } from '../utils/diagnostic-logger.js';

const GOVUK_BASE_URL = 'https://vehicleenquiry.service.gov.uk';
const GOVUK_SAVE_URL = `${GOVUK_BASE_URL}/vehicle-enquiry/save?locale=en`;

/**
 * Queries vehicleenquiry.service.gov.uk for a normalized UK VRN.
 * @param {string} vrn Normalized VRN (e.g., "DN16FTK")
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, directUrl: string }>}
 */
export async function fetchGovUkVehicleInfo(vrn) {
  const directUrl = `${GOVUK_BASE_URL}/?ext_vrn=${encodeURIComponent(vrn)}`;
  const startMs = Date.now();

  try {
    // Step 1: Load initial form page to get session cookie & authenticity_token
    const step1Res = await fetch(`${GOVUK_BASE_URL}/?locale=en`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/html,application/xhtml+xml' }
    });

    if (!step1Res.ok) {
      await logError('govuk-service', 'Step 1 GET failed', { vrn, status: step1Res.status });
      return {
        ok: false,
        error: `GOV.UK returned HTTP ${step1Res.status}`,
        directUrl
      };
    }

    const step1Html = await step1Res.text();
    const token1 = extractGovUkFormToken(step1Html);
    if (!token1) {
      await logError('govuk-service', 'Failed to extract CSRF token on Step 1', { vrn });
      return {
        ok: false,
        error: 'Could not extract CSRF token from GOV.UK.',
        directUrl
      };
    }

    // Step 2: Submit VRN to /vehicle-enquiry/save?locale=en
    const step2Body = new URLSearchParams({
      authenticity_token: token1,
      'wizard_vehicle_enquiry_capture_vrn[vrn]': vrn
    });

    const step2Res = await fetch(GOVUK_SAVE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml'
      },
      body: step2Body.toString()
    });

    const step2Html = await step2Res.text();
    const confirmInfo = parseGovUkConfirmPage(step2Html);

    if (confirmInfo.isNotFound) {
      await logWarn('govuk-service', 'Vehicle not found on GOV.UK', { vrn, elapsedMs: Date.now() - startMs });
      return {
        ok: false,
        error: confirmInfo.errorMessage || 'Vehicle not found on GOV.UK.',
        directUrl
      };
    }

    if (/id="tax-status-panel"/i.test(step2Html)) {
      const data = parseGovUkResultPage(step2Html);
      await logInfo('govuk-service', 'Resolved GOV.UK result directly on Step 2', { vrn, elapsedMs: Date.now() - startMs });
      return { ok: true, data, directUrl };
    }

    if (!confirmInfo.token) {
      await logError('govuk-service', 'Missing confirmation token on Step 2', { vrn, status: step2Res.status });
      return {
        ok: false,
        error: 'Could not confirm vehicle on GOV.UK (Step 2).',
        directUrl
      };
    }

    // Step 3: Confirm "Yes" on ConfirmVehicle page
    const step3Body = new URLSearchParams({
      authenticity_token: confirmInfo.token,
      'wizard_vehicle_enquiry_capture_confirm_vehicle[confirmed]': 'Yes'
    });

    const step3Res = await fetch(GOVUK_SAVE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml'
      },
      body: step3Body.toString()
    });

    const step3Html = await step3Res.text();
    const parsedResult = parseGovUkResultPage(step3Html);

    if (!parsedResult.make && confirmInfo.preview['Make']) {
      parsedResult.make = confirmInfo.preview['Make'];
    }
    if (!parsedResult.colour && confirmInfo.preview['Colour']) {
      parsedResult.colour = confirmInfo.preview['Colour'];
    }

    await logInfo('govuk-service', 'GOV.UK lookup succeeded', {
      vrn,
      make: parsedResult.make,
      colour: parsedResult.colour,
      taxStatus: parsedResult.taxStatus,
      motStatus: parsedResult.motStatus,
      elapsedMs: Date.now() - startMs
    });

    return { ok: true, data: parsedResult, directUrl };
  } catch (err) {
    await logError('govuk-service', 'Exception during GOV.UK lookup', {
      vrn,
      error: err.message || String(err),
      stack: err.stack || ''
    });
    return {
      ok: false,
      error: `GOV.UK connection error: ${err.message || String(err)}`,
      directUrl
    };
  }
}
