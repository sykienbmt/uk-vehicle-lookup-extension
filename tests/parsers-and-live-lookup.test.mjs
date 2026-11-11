import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  normalizeVrn,
  isValidUkVrn,
  formatVrnDisplay,
  classifyEvStatus,
  getColourSwatchHex,
  buildClipboardSummary
} from '../src/utils/vrn-formatter.js';
import {
  extractGovUkFormToken,
  parseGovUkConfirmPage,
  parseGovUkResultPage
} from '../src/parsers/govuk-html-parser.js';
import {
  isCloudflareChallengePage,
  parseExtendedSpecHtml
} from '../src/parsers/carcheck-html-parser.js';

test('VRN formatter normalizes, validates, and formats UK plates', () => {
  assert.equal(normalizeVrn(' dn16 ftk '), 'DN16FTK');
  assert.equal(normalizeVrn('cu57-abc'), 'CU57ABC');
  assert.equal(isValidUkVrn('DN16FTK'), true);
  assert.equal(isValidUkVrn('ABCDEF'), false);
  assert.equal(formatVrnDisplay('DN16FTK'), 'DN16 FTK');

  assert.equal(classifyEvStatus('ELECTRIC', '0 g/km').kind, 'ev');
  assert.equal(classifyEvStatus('HYBRID ELECTRIC', '92 g/km').kind, 'hybrid');
  assert.equal(classifyEvStatus('PETROL', '133 g/km').kind, 'ice');
  assert.equal(getColourSwatchHex('GREY'), '#64748b');
  assert.equal(getColourSwatchHex('WHITE'), '#f8fafc');

  const summary = buildClipboardSummary({
    vrn: 'DN16FTK',
    make: 'NISSAN',
    model: 'Qashqai N-Connecta Dig-T Cvt',
    year: '2016',
    colour: 'GREY',
    fuelType: 'PETROL',
    engineSize: '1197 cc',
    taxStatus: 'Taxed',
    taxDue: '1 September 2027',
    motStatus: 'MOT',
    motExpiry: '9 September 2027'
  });
  assert.match(summary, /DN16 FTK/);
  assert.match(summary, /NISSAN Qashqai N-Connecta Dig-T Cvt/);
  assert.match(summary, /Tax: Taxed \(1 September 2027\)/);
  assert.match(summary, /MOT: MOT \(9 September 2027\)/);
});

test('GOV.UK HTML parser extracts CSRF token, confirmation page, and final DN16FTK result', () => {
  const sampleConfirmHtml = `
    <form action="/vehicle-enquiry/save?locale=en" method="post">
      <input type="hidden" name="authenticity_token" value="tok_confirm_123" />
      <h1>Is this the vehicle you are looking for?</h1>
      <dl class="summary-no-action">
        <div class="govuk-summary-list__row">
          <dt class="govuk-summary-list__key">Make</dt>
          <dd class="govuk-summary-list__value">NISSAN</dd>
        </div>
        <div class="govuk-summary-list__row">
          <dt class="govuk-summary-list__key">Colour</dt>
          <dd class="govuk-summary-list__value">GREY</dd>
        </div>
      </dl>
    </form>
  `;

  const confirmParsed = parseGovUkConfirmPage(sampleConfirmHtml);
  assert.equal(confirmParsed.isConfirmPage, true);
  assert.equal(confirmParsed.isNotFound, false);
  assert.equal(confirmParsed.token, 'tok_confirm_123');
  assert.equal(confirmParsed.preview['Make'], 'NISSAN');
  assert.equal(confirmParsed.preview['Colour'], 'GREY');

  const sampleResultHtml = `
    <div class="govuk-panel govuk-panel--confirmation" id="tax-status-panel">
      <h2 class="govuk-panel__title"><span aria-hidden="true">✓ Taxed</span></h2>
      <div class="govuk-panel__body"><strong><span>Tax due: 1 September 2027</span></strong></div>
    </div>
    <div class="govuk-panel govuk-panel--confirmation" id="mot-status-panel">
      <h2 class="govuk-panel__title"><span aria-hidden="true">✓ MOT</span></h2>
      <div class="govuk-panel__body"><strong><span>Expires: 9 September 2027</span></strong></div>
    </div>
    <dl class="summary-no-action">
      <div class="govuk-summary-list__row" id="make"><dt>Vehicle make</dt><dd>NISSAN</dd></div>
      <div class="govuk-summary-list__row" id="year_of_manufacture"><dt>Year of manufacture</dt><dd>2016</dd></div>
      <div class="govuk-summary-list__row" id="engine_capacity"><dt>Cylinder capacity</dt><dd>1197 cc</dd></div>
      <div class="govuk-summary-list__row" id="fuel_type"><dt>Fuel type</dt><dd>PETROL</dd></div>
      <div class="govuk-summary-list__row" id="colour"><dt>Vehicle colour</dt><dd>GREY</dd></div>
    </dl>
  `;

  const resultParsed = parseGovUkResultPage(sampleResultHtml);
  assert.equal(resultParsed.taxStatus, 'Taxed');
  assert.equal(resultParsed.taxDue, '1 September 2027');
  assert.equal(resultParsed.isTaxValid, true);
  assert.equal(resultParsed.motStatus, 'MOT');
  assert.equal(resultParsed.motExpiry, '9 September 2027');
  assert.equal(resultParsed.isMotValid, true);
  assert.equal(resultParsed.make, 'NISSAN');
  assert.equal(resultParsed.year, '2016');
  assert.equal(resultParsed.engineSize, '1197 cc');
  assert.equal(resultParsed.fuelType, 'PETROL');
  assert.equal(resultParsed.colour, 'GREY');
  assert.equal(resultParsed.vrn, '');
});

test('GOV.UK invalid-VRN page is not treated as confirmable (prevents stale session vehicle)', () => {
  const invalidVrnHtml = `
    <div class="govuk-error-summary" aria-labelledby="error-summary-title" role="alert">
      <h2 class="govuk-error-summary__title" id="error-summary-title">There is a problem</h2>
      <div class="govuk-error-summary__body"><ul><li><a href="#vrn">The registration number you have provided is invalid</a></li></ul></div>
    </div>
    <h1>Enter the registration number of the vehicle</h1>
    <form action="/vehicle-enquiry/save?locale=en" method="post">
      <input type="hidden" name="authenticity_token" value="tok_vrn_form" />
    </form>
  `;
  const parsed = parseGovUkConfirmPage(invalidVrnHtml);
  assert.equal(parsed.isNotFound, true);
  // The service only confirms (Step 3) on the real confirm page, so this page must never be confirmed
  assert.equal(parsed.isConfirmPage, false);
  assert.match(parsed.errorMessage, /not valid/i);

  const resultWithPlate = parseGovUkResultPage(`
    <h1><span class="reg-mark">
      LV24 PWO
    </span></h1>
    <div class="govuk-panel" id="tax-status-panel"><h2 class="govuk-panel__title"><span aria-hidden="true">Taxed</span></h2></div>
  `);
  assert.equal(resultWithPlate.vrn, 'LV24PWO');
});

test('CarCheck & extended spec HTML parser extracts Model, BHP, MPG, and Tax costs', () => {
  assert.equal(isCloudflareChallengePage('<title>Just a moment...</title>'), true);

  const sampleSpecHtml = `
    <img id="vehicleImage" src="https://totalcarcheck.co.uk/VehicleImage/Nissan-Qashqai-BA-SUV-5Doors.png?v=st" />
    <table>
      <tr><td><span class="cert-label">Manufacturer</span></td><td><span class="cert-data-text">Nissan</span></td></tr>
      <tr><td><span class="cert-label">Model</span></td><td><span class="cert-data-text">Qashqai N-Connecta Dig-T Cvt</span></td></tr>
      <tr><td><span class="cert-label">Model Detail</span></td><td><span class="cert-data-text">DIG-T 115 Xtronic Auto</span></td></tr>
      <tr><td><span class="cert-label">Body Style</span></td><td><span class="cert-data-text">SUV</span></td></tr>
      <tr><td><span class="cert-label">BHP</span></td><td><span class="cert-data-text">113 BHP</span></td></tr>
      <tr><td><span class="cert-label">Combined</span></td><td><span class="cert-data-text">48.7 MPG</span></td></tr>
      <tr><td><span class="cert-label">12 Months Cost</span></td><td><span class="cert-data-text">&pound;200</span></td></tr>
    </table>
  `;

  const parsed = parseExtendedSpecHtml(sampleSpecHtml);
  assert.equal(parsed.make, 'Nissan');
  assert.equal(parsed.model, 'Qashqai N-Connecta Dig-T Cvt');
  assert.equal(parsed.modelDetail, 'DIG-T 115 Xtronic Auto');
  assert.equal(parsed.bodyStyle, 'SUV');
  assert.equal(parsed.bhp, '113 BHP');
  assert.equal(parsed.mpgCombined, '48.7 MPG');
  assert.equal(parsed.tax12Months, '£200');
});

test('Live fetch and parse of extended specifications for DN16FTK', async () => {
  const res = await fetch('https://totalcarcheck.co.uk/FreeCheck?regno=DN16FTK', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  const parsed = parseExtendedSpecHtml(html);

  assert.equal(parsed.make, 'Nissan');
  assert.equal(parsed.model, 'Qashqai N-Connecta Dig-T Cvt');
  assert.equal(parsed.modelDetail, 'DIG-T 115 Xtronic Auto');
  assert.equal(parsed.colour, 'Grey');
  assert.equal(parsed.fuelType, 'Petrol');
  assert.equal(parsed.engineSize, '1197 cc');
  assert.equal(parsed.euroStatus, '6b');
  assert.equal(parsed.bhp, '113 BHP');
  assert.equal(parsed.year, '2016');
  assert.equal(parsed.registeredDate, '31 March 2016');
});

