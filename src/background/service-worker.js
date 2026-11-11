/**
 * Chrome Extension Manifest V3 Background Service Worker.
 * Handles vehicle lookup requests, right-click context menu on selected text,
 * and diagnostic trace logging.
 */

import { normalizeVrn } from '../utils/vrn-formatter.js';
import { lookupUkVehicle } from '../services/vehicle-lookup-coordinator.js';
import {
  saveLookupToHistory,
  setPendingContextMenuVrn
} from '../services/storage-history-service.js';
import { writeDiagnosticLog, logInfo, logError } from '../utils/diagnostic-logger.js';

const CONTEXT_MENU_ID = 'uk-vehicle-plate-lookup';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Search UK Vehicle Plate: "%s"',
    contexts: ['selection']
  });
  logInfo('service-worker', 'Extension installed / reloaded');
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) {
    return;
  }

  const vrn = normalizeVrn(info.selectionText);
  if (!vrn) return;

  await logInfo('service-worker', 'Context menu lookup triggered', { vrn, pageUrl: info.pageUrl });
  await setPendingContextMenuVrn(vrn);

  if (chrome.sidePanel && tab && tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (_) {
      // Fallback: pre-fetch in background so next popup open is instant
    }
  }

  const result = await lookupUkVehicle(vrn);
  if (result.ok) {
    await saveLookupToHistory(result);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'LOOKUP_VEHICLE') {
    (async () => {
      try {
        await logInfo('service-worker', 'LOOKUP_VEHICLE message received', {
          vrn: message.vrn,
          senderUrl: sender?.tab?.url || 'extension-popup'
        });
        const tabId = sender?.tab?.id;
        // Push the first available source to the in-page popover immediately; the full result follows via sendResponse
        const onPartial = tabId === undefined ? undefined : (partial) => {
          chrome.tabs
            .sendMessage(tabId, { type: 'LOOKUP_PARTIAL', vrn: partial.vrn, result: partial }, { frameId: sender.frameId ?? 0 })
            .catch(() => {});
        };
        const result = await lookupUkVehicle(message.vrn, { onPartial });
        if (result.ok) {
          await saveLookupToHistory(result);
        }
        sendResponse(result);
      } catch (err) {
        await logError('service-worker', 'Unhandled exception in LOOKUP_VEHICLE', {
          vrn: message.vrn,
          error: err.message || String(err),
          stack: err.stack || ''
        });
        sendResponse({
          ok: false,
          error: err.message || String(err)
        });
      }
    })();
    return true;
  }

  if (message.type === 'WRITE_LOG') {
    writeDiagnosticLog(
      message.level || 'INFO',
      message.scope || 'content-script',
      message.message || '',
      message.meta || {}
    );
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'OPEN_BOTH_TABS') {
    const vrn = normalizeVrn(message.vrn);
    if (vrn) {
      chrome.tabs.create({
        url: `https://vehicleenquiry.service.gov.uk/?ext_vrn=${encodeURIComponent(vrn)}`,
        active: false
      });
      chrome.tabs.create({
        url: `https://www.carcheck.co.uk/reg?i=${encodeURIComponent(vrn)}`,
        active: true
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
