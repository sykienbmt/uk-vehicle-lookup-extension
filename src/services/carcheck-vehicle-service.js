/**
 * Service for querying CarCheck.co.uk and instant UK vehicle technical specifications.
 * Logs lookup status, latency, and any errors to diagnostic-logger.
 */

import {
  parseCarCheckDirectHtml,
  parseExtendedSpecHtml
} from '../parsers/carcheck-html-parser.js';
import { logInfo, logWarn, logError } from '../utils/diagnostic-logger.js';

const CARCHECK_URL_TEMPLATE = 'https://www.carcheck.co.uk/reg?i=';
const EXTENDED_SPEC_URL_TEMPLATE = 'https://totalcarcheck.co.uk/FreeCheck?regno=';

/**
 * Fetches vehicle specs and CarCheck details for a given UK VRN.
 * @param {string} vrn Normalized VRN (e.g., "DN16FTK")
 * @returns {Promise<{ ok: boolean, data?: object, carCheckDirectStatus: string, directUrl: string, error?: string }>}
 */
export async function fetchCarCheckVehicleInfo(vrn) {
  const directUrl = `${CARCHECK_URL_TEMPLATE}${encodeURIComponent(vrn)}`;
  const specUrl = `${EXTENDED_SPEC_URL_TEMPLATE}${encodeURIComponent(vrn)}`;
  const startMs = Date.now();

  const [carCheckOutcome, specOutcome] = await Promise.allSettled([
    fetch(directUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/html,application/xhtml+xml' }
    }).then(async (res) => ({
      status: res.status,
      finalUrl: res.url || directUrl,
      html: await res.text()
    })),
    fetch(specUrl, {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' }
    }).then(async (res) => ({
      status: res.status,
      html: await res.text()
    }))
  ]);

  let carCheckDirect = { isGated: true, title: '', fields: {} };
  let carCheckDirectStatus = 'unreachable';
  let resolvedCarCheckUrl = directUrl;

  if (carCheckOutcome.status === 'fulfilled') {
    resolvedCarCheckUrl = carCheckOutcome.value.finalUrl || directUrl;
    carCheckDirect = parseCarCheckDirectHtml(carCheckOutcome.value.html);
    carCheckDirectStatus = carCheckDirect.isGated ? 'cloudflare_gated' : 'direct_ok';
  } else {
    await logWarn('carcheck-service', 'Direct carcheck.co.uk fetch rejected', {
      vrn,
      reason: String(carCheckOutcome.reason)
    });
  }

  let extendedSpecs = { fields: {} };
  if (specOutcome.status === 'fulfilled' && specOutcome.value.status === 200) {
    extendedSpecs = parseExtendedSpecHtml(specOutcome.value.html);
  } else {
    await logError('carcheck-service', 'Extended spec fetch failed', {
      vrn,
      status: specOutcome.status === 'fulfilled' ? specOutcome.value.status : 'rejected',
      reason: specOutcome.status === 'rejected' ? String(specOutcome.reason) : ''
    });
  }

  const mergedFields = {
    ...(extendedSpecs.fields || {}),
    ...(carCheckDirect.fields || {})
  };

  const hasData = Object.keys(mergedFields).length > 0;
  if (!hasData && carCheckDirectStatus !== 'direct_ok') {
    await logWarn('carcheck-service', 'No vehicle spec fields found', {
      vrn,
      carCheckDirectStatus,
      elapsedMs: Date.now() - startMs
    });
    return {
      ok: false,
      carCheckDirectStatus,
      directUrl: resolvedCarCheckUrl,
      error: 'CarCheck.co.uk requires browser verification. Click "Open CarCheck" to view directly.'
    };
  }

  await logInfo('carcheck-service', 'CarCheck & Specs lookup succeeded', {
    vrn,
    model: extendedSpecs.model || carCheckDirect.fields['Model'] || '',
    bodyStyle: extendedSpecs.bodyStyle || '',
    carCheckDirectStatus,
    elapsedMs: Date.now() - startMs
  });

  return {
    ok: true,
    carCheckDirectStatus,
    directUrl: resolvedCarCheckUrl,
    data: {
      title: carCheckDirect.title || [extendedSpecs.make, extendedSpecs.model].filter(Boolean).join(' '),
      make: extendedSpecs.make || carCheckDirect.fields['Make'] || '',
      model: extendedSpecs.model || carCheckDirect.fields['Model'] || '',
      modelDetail: extendedSpecs.modelDetail || carCheckDirect.fields['Variant'] || '',
      colour: extendedSpecs.colour || carCheckDirect.fields['Colour'] || '',
      vehicleType: extendedSpecs.vehicleType || '',
      bodyStyle: extendedSpecs.bodyStyle || carCheckDirect.fields['Body style'] || '',
      fuelType: extendedSpecs.fuelType || carCheckDirect.fields['Fuel type'] || '',
      engineSize: extendedSpecs.engineSize || carCheckDirect.fields['Engine size'] || '',
      euroStatus: extendedSpecs.euroStatus || carCheckDirect.fields['Euro status'] || '',
      bhp: extendedSpecs.bhp || carCheckDirect.fields['Power'] || '',
      vehicleAge: extendedSpecs.vehicleAge || '',
      registeredDate: extendedSpecs.registeredDate || '',
      v5cIssueDate: extendedSpecs.v5cIssueDate || '',
      registeredNear: extendedSpecs.registeredNear || '',
      year: extendedSpecs.year || carCheckDirect.fields['Year'] || '',
      insuranceGroup: extendedSpecs.insuranceGroup || '',
      mpgUrban: extendedSpecs.mpgUrban || '',
      mpgExtraUrban: extendedSpecs.mpgExtraUrban || '',
      mpgCombined: extendedSpecs.mpgCombined || '',
      topSpeed: extendedSpecs.topSpeed || carCheckDirect.fields['Top speed'] || '',
      zeroToSixty: extendedSpecs.zeroToSixty || '',
      tax12Months: extendedSpecs.tax12Months || '',
      tax6Months: extendedSpecs.tax6Months || '',
      co2Output: extendedSpecs.co2Output || '',
      vehicleImage: extendedSpecs.vehicleImage || '',
      makeLogo: extendedSpecs.makeLogo || '',
      carCheckFields: carCheckDirect.fields,
      allSpecFields: mergedFields
    }
  };
}
