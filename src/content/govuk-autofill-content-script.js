/**
 * Content script for https://vehicleenquiry.service.gov.uk/*
 * Automatically fills the VRN and confirms "Yes" when opened from the extension
 * via ?ext_vrn=<VRN>.
 */

(function autoFillGovUkEnquiry() {
  try {
    const STORAGE_KEY = 'uk_ext_autofill_vrn';
    const params = new URLSearchParams(window.location.search);
    const extVrn = params.get('ext_vrn');

    if (extVrn) {
      sessionStorage.setItem(STORAGE_KEY, extVrn.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    }

    const activeVrn = sessionStorage.getItem(STORAGE_KEY);
    if (!activeVrn) return;

    // Step 1: Enter VRN page
    const vrnInput = document.getElementById('wizard_vehicle_enquiry_capture_vrn_vrn');
    const submitBtn = document.getElementById('submit_vrn_button');
    if (vrnInput && submitBtn) {
      vrnInput.value = activeVrn;
      vrnInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitBtn.click();
      return;
    }

    // Step 2: Confirm "Is this the vehicle you are looking for?" page
    const yesRadio = document.getElementById('yes-vehicle-confirm');
    const confirmBtn = document.getElementById('capture_confirm_button');
    if (yesRadio && confirmBtn) {
      sessionStorage.removeItem(STORAGE_KEY);
      yesRadio.checked = true;
      yesRadio.dispatchEvent(new Event('change', { bubbles: true }));
      confirmBtn.click();
      return;
    }

    // Step 3: Landed on result or error page -> clear stored key
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // Ignore errors in content script
  }
})();

