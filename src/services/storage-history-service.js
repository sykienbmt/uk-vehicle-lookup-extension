/**
 * Manages vehicle lookup history and cached results in chrome.storage.local.
 */

const HISTORY_KEY = 'uk_vehicle_lookup_history_v1';
const LAST_VRN_KEY = 'uk_vehicle_last_vrn_v1';
const PENDING_VRN_KEY = 'uk_vehicle_pending_vrn_v1';
const MAX_HISTORY_ITEMS = 15;

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

/**
 * Loads the list of recent vehicle lookup entries.
 * @returns {Promise<Array<object>>}
 */
export async function getLookupHistory() {
  if (!hasChromeStorage()) return [];
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

/**
 * Saves a completed vehicle lookup result into history and sets it as the last viewed VRN.
 * @param {object} lookupPayload
 * @returns {Promise<Array<object>>}
 */
export async function saveLookupToHistory(lookupPayload) {
  if (!hasChromeStorage() || !lookupPayload || !lookupPayload.vrn) {
    return [];
  }

  const history = await getLookupHistory();
  const filtered = history.filter((item) => item.vrn !== lookupPayload.vrn);
  const updated = [lookupPayload, ...filtered].slice(0, MAX_HISTORY_ITEMS);

  await chrome.storage.local.set({
    [HISTORY_KEY]: updated,
    [LAST_VRN_KEY]: lookupPayload.vrn
  });

  return updated;
}

/**
 * Clears all saved lookup history.
 * @returns {Promise<void>}
 */
export async function clearLookupHistory() {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.remove([HISTORY_KEY, LAST_VRN_KEY]);
}

/**
 * Stores a pending VRN triggered from the right-click context menu.
 * @param {string} vrn
 * @returns {Promise<void>}
 */
export async function setPendingContextMenuVrn(vrn) {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [PENDING_VRN_KEY]: vrn });
}

/**
 * Consumes and removes any pending VRN triggered from the context menu,
 * or returns the last searched VRN if none is pending.
 * @returns {Promise<{ pendingVrn: string|null, lastVrn: string|null }>}
 */
export async function consumePendingOrLastVrn() {
  if (!hasChromeStorage()) {
    return { pendingVrn: null, lastVrn: null };
  }
  const data = await chrome.storage.local.get([PENDING_VRN_KEY, LAST_VRN_KEY]);
  const pendingVrn = data[PENDING_VRN_KEY] || null;
  if (pendingVrn) {
    await chrome.storage.local.remove(PENDING_VRN_KEY);
  }
  return {
    pendingVrn,
    lastVrn: data[LAST_VRN_KEY] || null
  };
}

