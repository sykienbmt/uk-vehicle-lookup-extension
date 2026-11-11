/**
 * Coordinates parallel vehicle lookups across GOV.UK (vehicleenquiry.service.gov.uk)
 * and CarCheck (www.carcheck.co.uk) + UK extended vehicle specifications.
 */

import { normalizeVrn, formatVrnDisplay } from '../utils/vrn-formatter.js';
import { fetchGovUkVehicleInfo } from './govuk-vehicle-service.js';
import { fetchCarCheckVehicleInfo } from './carcheck-vehicle-service.js';
import { logInfo, logError } from '../utils/diagnostic-logger.js';

/**
 * Performs a parallel lookup for a UK registration plate and merges the results.
 * @param {string} rawVrn
 * @returns {Promise<object>}
 */
export async function lookupUkVehicle(rawVrn) {
  const vrn = normalizeVrn(rawVrn);
  const displayVrn = formatVrnDisplay(vrn);
  const startMs = Date.now();

  await logInfo('coordinator', 'Starting vehicle lookup', { vrn });

  const [govUkResult, carCheckResult] = await Promise.all([
    fetchGovUkVehicleInfo(vrn),
    fetchCarCheckVehicleInfo(vrn)
  ]);

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
    govUkUrl: govUkResult.directUrl,
    carCheckUrl: carCheckResult.directUrl
  };

  const ok = govUkResult.ok || carCheckResult.ok;
  if (!ok) {
    await logError('coordinator', 'Both GOV.UK and CarCheck lookups failed', {
      vrn,
      govError: govUkResult.error,
      carCheckError: carCheckResult.error,
      elapsedMs: Date.now() - startMs
    });
  } else {
    await logInfo('coordinator', 'Completed vehicle lookup', {
      vrn,
      make: merged.make,
      model: merged.model,
      colour: merged.colour,
      fuelType: merged.fuelType,
      elapsedMs: Date.now() - startMs
    });
  }

  return {
    ok,
    vrn,
    displayVrn,
    merged,
    govuk: govUkResult,
    carcheck: carCheckResult
  };
}
