/**
 * Main controller for Popup and Side Panel UI (English UI).
 */

import {
  normalizeVrn,
  isValidUkVrn,
  formatVrnDisplay,
  buildClipboardSummary
} from '../utils/vrn-formatter.js';
import { lookupUkVehicle } from '../services/vehicle-lookup-coordinator.js';
import {
  getLookupHistory,
  saveLookupToHistory,
  clearLookupHistory,
  consumePendingOrLastVrn
} from '../services/storage-history-service.js';
import { renderVehicleResult, renderHistoryChips } from './ui-renderer.js';
import { initThemeToggle } from './theme-preference.js';

initThemeToggle(document.getElementById('themeToggleBtn'));

const elements = {
  searchForm: document.getElementById('searchForm'),
  vrnInput: document.getElementById('vrnInput'),
  pasteBtn: document.getElementById('pasteBtn'),
  historyChips: document.getElementById('historyChips'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  loadingState: document.getElementById('loadingState'),
  loadingText: document.getElementById('loadingText'),
  errorState: document.getElementById('errorState'),
  resultContainer: document.getElementById('resultContainer'),
  vehicleHero: document.getElementById('vehicleHero'),
  focusGrid: document.getElementById('focusGrid'),
  statusGrid: document.getElementById('statusGrid'),
  tabOverview: document.getElementById('tab-overview'),
  tabGovuk: document.getElementById('tab-govuk'),
  tabCarcheck: document.getElementById('tab-carcheck'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  openGovUkBtn: document.getElementById('openGovUkBtn'),
  openCarCheckBtn: document.getElementById('openCarCheckBtn'),
  openBothBtn: document.getElementById('openBothBtn'),
  openSidePanelBtn: document.getElementById('openSidePanelBtn')
};

let currentResult = null;

function showError(msg) {
  elements.errorState.textContent = msg;
  elements.errorState.classList.remove('hidden');
}

function hideError() {
  elements.errorState.classList.add('hidden');
}

async function refreshHistoryUi() {
  const history = await getLookupHistory();
  renderHistoryChips(history, elements.historyChips, elements.clearHistoryBtn, (selectedVrn) => {
    elements.vrnInput.value = formatVrnDisplay(selectedVrn);
    const cached = history.find((item) => item.vrn === selectedVrn);
    if (cached) displayResult(cached);
    else executeSearch(selectedVrn);
  });
}

function displayResult(payload) {
  currentResult = payload;
  hideError();
  elements.loadingState.classList.add('hidden');
  elements.resultContainer.classList.remove('hidden');
  renderVehicleResult(payload, elements);
}

let latestSearchId = 0;

async function executeSearch(rawInput) {
  const vrn = normalizeVrn(rawInput);
  if (!isValidUkVrn(vrn)) {
    showError('Please enter a valid UK registration number (e.g. DN16FTK).');
    return;
  }

  elements.vrnInput.value = formatVrnDisplay(vrn);
  hideError();
  elements.resultContainer.classList.add('hidden');
  elements.loadingText.textContent = `Looking up ${formatVrnDisplay(vrn)} on GOV.UK & CarCheck...`;
  elements.loadingState.classList.remove('hidden');

  const searchId = ++latestSearchId;
  try {
    // Render the first source that answers; the slower one (image/specs) fills in afterwards
    const result = await lookupUkVehicle(vrn, {
      onPartial: (partial) => { if (searchId === latestSearchId) displayResult(partial); }
    });
    if (searchId !== latestSearchId) return;
    elements.loadingState.classList.add('hidden');

    if (!result.ok) {
      showError(
        (result.govuk && result.govuk.error) ||
          (result.carcheck && result.carcheck.error) ||
          `No vehicle details found for ${vrn}.`
      );
      return;
    }

    await saveLookupToHistory(result);
    await refreshHistoryUi();
    displayResult(result);
  } catch (err) {
    if (searchId !== latestSearchId) return;
    elements.loadingState.classList.add('hidden');
    showError(`Lookup failed: ${err.message || String(err)}`);
  }
}

elements.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  executeSearch(elements.vrnInput.value);
});

elements.vrnInput.addEventListener('paste', (e) => {
  const pastedText = (e.clipboardData || window.clipboardData).getData('text');
  const clean = normalizeVrn(pastedText);
  if (isValidUkVrn(clean)) {
    e.preventDefault();
    executeSearch(clean);
  }
});

elements.pasteBtn.addEventListener('click', async () => {
  try {
    const clipText = await navigator.clipboard.readText();
    if (clipText) executeSearch(clipText);
  } catch (_) {
    elements.vrnInput.focus();
  }
});

elements.clearHistoryBtn.addEventListener('click', async () => {
  await clearLookupHistory();
  await refreshHistoryUi();
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    ['overview', 'govuk', 'carcheck'].forEach((tabId) => {
      const panel = document.getElementById(`tab-${tabId}`);
      if (panel) panel.classList.toggle('hidden', tabId !== targetTab);
    });
  });
});

elements.copySummaryBtn.addEventListener('click', async () => {
  if (!currentResult || !currentResult.merged) return;
  await navigator.clipboard.writeText(buildClipboardSummary(currentResult.merged));
  const originalLabel = elements.copySummaryBtn.textContent;
  elements.copySummaryBtn.textContent = '✓ Copied!';
  setTimeout(() => { elements.copySummaryBtn.textContent = originalLabel; }, 1500);
});

function getActiveVrn() {
  return normalizeVrn(elements.vrnInput.value) || (currentResult && currentResult.vrn) || '';
}

elements.openGovUkBtn.addEventListener('click', () => {
  const vrn = getActiveVrn();
  if (vrn) chrome.tabs.create({ url: `https://vehicleenquiry.service.gov.uk/?ext_vrn=${encodeURIComponent(vrn)}` });
});

elements.openCarCheckBtn.addEventListener('click', () => {
  const vrn = getActiveVrn();
  if (vrn) chrome.tabs.create({ url: `https://www.carcheck.co.uk/reg?i=${encodeURIComponent(vrn)}` });
});

elements.openBothBtn.addEventListener('click', () => {
  const vrn = getActiveVrn();
  if (vrn) chrome.runtime.sendMessage({ type: 'OPEN_BOTH_TABS', vrn });
});

elements.openSidePanelBtn.addEventListener('click', async () => {
  if (chrome.sidePanel && chrome.windows) {
    const win = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: win.id });
    window.close();
  }
});

(async function initPopup() {
  await refreshHistoryUi();
  const { pendingVrn, lastVrn } = await consumePendingOrLastVrn();
  if (pendingVrn) return executeSearch(pendingVrn);
  const history = await getLookupHistory();
  const cached = lastVrn && history.find((item) => item.vrn === lastVrn);
  if (cached) {
    elements.vrnInput.value = formatVrnDisplay(lastVrn);
    displayResult(cached);
  }
})();

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.uk_vehicle_pending_vrn_v1?.newValue) {
      const { pendingVrn } = await consumePendingOrLastVrn();
      if (pendingVrn) executeSearch(pendingVrn);
    }
  });
}
