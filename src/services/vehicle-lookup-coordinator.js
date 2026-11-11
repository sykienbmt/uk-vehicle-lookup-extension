/**
 * Coordinates parallel vehicle lookups across GOV.UK (vehicleenquiry.service.gov.uk)
 * and CarCheck (www.carcheck.co.uk) + UK extended vehicle specifications.
 */

import { normalizeVrn, formatVrnDisplay } from '../utils/vrn-formatter.js';
import { fetchGovUkVehicleInfo } from './govuk-vehicle-service.js';
import { fetchCarCheckVehicleInfo } from './carcheck-vehicle-service.js';
import { logInfo, logError } from '../utils/diagnostic-logger.js';

const PENDING_SOURCE = { ok: false, pending: true, directUrl: '' };

/**
 * Performs a parallel lookup for a UK registration plate and merges the results.
 * When `onPartial` is given, it is called as soon as the first source returns usable data,
 * so the UI can render immediately while the slower source (e.g. vehicle image/specs) is still loading.
 * @param {string} rawVrn
 * @param {{ onPartial?: (partialResult: object) => void }} [options]
 * @returns {Promise<object>}
 */
export async function lookupUkVehicle(rawVrn, { onPartial } = {}) {
  const vrn = normalizeVrn(rawVrn);
  const startMs = Date.now();

  await logInfo('coordinator', 'Starting vehicle lookup', { vrn });

  const govPromise = fetchGovUkVehicleInfo(vrn);
  const carCheckPromise = fetchCarCheckVehicleInfo(vrn);

  if (onPartial) {
    const emitIfUsable = (gov, cc) => {
      const partial = buildLookupResult(vrn, gov, cc);
      if (!partial.ok) return;
      try {
        onPartial(partial);
      } catch (_) {
        // A rendering error in the caller must not break the lookup
      }
    };
    let settled = false;
    govPromise.then((gov) => { if (!settled) emitIfUsable(gov, PENDING_SOURCE); });
    carCheckPromise.then((cc) => { if (!settled) emitIfUsable(PENDING_SOURCE, cc); });
    Promise.all([govPromise, carCheckPromise]).then(() => { settled = true; });
  }

  const [govUkResult, carCheckResult] = await Promise.all([govPromise, carCheckPromise]);
  const result = buildLookupResult(vrn, govUkResult, carCheckResult);

  if (!result.ok) {
    await logError('coordinator', 'Both GOV.UK and CarCheck lookups failed', {
      vrn,
      govError: govUkResult.error,
      carCheckError: carCheckResult.error,
      elapsedMs: Date.now() - startMs
    });
  } else {
    await logInfo('coordinator', 'Completed vehicle lookup', {
      vrn,
      make: result.merged.make,
      model: result.merged.model,
      colour: result.merged.colour,
      fuelType: result.merged.fuelType,
      elapsedMs: Date.now() - startMs
    });
  }

  return result;
}

/**
 * Merges GOV.UK and CarCheck source results into the payload consumed by the UIs.
 * A source still loading is passed as `{ pending: true }` and reported in `pending`.
 */
function buildLookupResult(vrn, govUkResult, carCheckResult) {
  const displayVrn = formatVrnDisplay(vrn);
  const gov = govUkResult.data || {};
  const cc = carCheckResult.data || {};

  const merged = {
    vrn,
    displayVrn,
    queriedAt: new Date().toISOString(),
    make: gov.make || cc.make || '',
    model: cc.model || '',
    modelDetail: cc.modelDetail || '',
    colour: gov.colour || cc.colour || '',
    year: gov.year || cc.year || '',
    firstRegistration: cc.registeredDate || gov.firstRegistration || '',
    registeredNear: cc.registeredNear || '',
    vehicleAge: cc.vehicleAge || '',
    fuelType: gov.fuelType || cc.fuelType || '',
    engineSize: gov.engineSize || cc.engineSize || '',
    bhp: cc.bhp || '',
    bodyStyle: cc.bodyStyle || '',
    vehicleType: cc.vehicleType || '',
    typeApproval: gov.typeApproval || '',
    wheelplan: gov.wheelplan || '',
    euroStatus: (cc.euroStatus && cc.euroStatus !== 'Not available') ? cc.euroStatus : (gov.euroStatus || ''),
    co2Emissions: gov.co2Emissions || cc.co2Output || '',
    exportMarker: gov.exportMarker || cc.exported || '',
    lastV5cDate: gov.lastV5cDate || cc.v5cIssueDate || '',
    taxStatus: (gov.taxStatus && gov.taxStatus !== 'Unknown') ? gov.taxStatus : (cc.allSpecFields?.['Road Tax Status'] ? 'Taxed' : ''),
    taxDue: gov.taxDue || (cc.allSpecFields?.['Road Tax Status'] || '').replace(/^Expires:\s*/i, ''),
    isTaxValid: Boolean(gov.isTaxValid || /expires/i.test(cc.allSpecFields?.['Road Tax Status'] || '')),
    tax12Months: cc.tax12Months || '',
    tax6Months: cc.tax6Months || '',
    motStatus: (gov.motStatus && gov.motStatus !== 'Unknown') ? gov.motStatus : (cc.allSpecFields?.['MOT Status'] ? 'MOT' : ''),
    motExpiry: gov.motExpiry || (cc.allSpecFields?.['MOT Status'] || '').replace(/^Expires:\s*/i, ''),
    isMotValid: Boolean(gov.isMotValid || /expires/i.test(cc.allSpecFields?.['MOT Status'] || '')),
    insuranceGroup: cc.insuranceGroup || '',
    mpgUrban: cc.mpgUrban || '',
    mpgExtraUrban: cc.mpgExtraUrban || '',
    mpgCombined: cc.mpgCombined || '',
    topSpeed: cc.topSpeed || '',
    zeroToSixty: cc.zeroToSixty || '',
    vehicleImage: cc.vehicleImage || '',
    makeLogo: cc.makeLogo || '',
    govUkUrl: govUkResult.directUrl || `https://vehicleenquiry.service.gov.uk/?ext_vrn=${encodeURIComponent(vrn)}`,
    carCheckUrl: carCheckResult.directUrl || `https://www.carcheck.co.uk/reg?i=${encodeURIComponent(vrn)}`
  };

  return {
    ok: Boolean(govUkResult.ok || carCheckResult.ok),
    vrn,
    displayVrn,
    merged,
    pending: {
      govuk: Boolean(govUkResult.pending),
      carcheck: Boolean(carCheckResult.pending)
    },
    govuk: govUkResult,
    carcheck: carCheckResult
  };
}
