/**
 * Content script that injects the UK Vehicle Extension Lookup icon button
 * directly next to the VRN/Plate box in tenant-centralization-verification
 * (apps/web/src/components/verification/left-panel.tsx).
 */

(function initPlateLookupInjector() {
  if (window.__ukPlateLookupInjectorLoaded) return;
  window.__ukPlateLookupInjectorLoaded = true;

  const BTN_CLASS = 'uk-vehicle-ext-inline-lookup-btn';
  // VRN whose full result has not arrived yet; partial results for anything else are stale
  let pendingLookupVrn = null;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'LOOKUP_PARTIAL' || !message.vrn || message.vrn !== pendingLookupVrn) return;
    if (window.__ukVehicleExtPopover) window.__ukVehicleExtPopover.showResult(message.result);
  });

  function sendLog(level, message, meta = {}) {
    try {
      chrome.runtime.sendMessage({
        type: 'WRITE_LOG',
        level,
        scope: 'verification-content-script',
        message,
        meta: { url: window.location.href, ...meta }
      });
    } catch (_) {
      // Ignore if extension context invalidated
    }
  }

  function extractCleanVrn(containerEl) {
    if (!containerEl) return '';
    const inputEl = containerEl.querySelector('input');
    const raw = inputEl ? inputEl.value : containerEl.textContent || '';
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  }

  function createLookupButton(getPlateContainerFn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.className = BTN_CLASS;
    btn.title = 'Lookup UK Vehicle (Type, Colour, EV Status, GOV.UK & CarCheck)';
    btn.setAttribute('aria-label', 'Lookup UK vehicle');
    // MUI-style icon button matching the UKPC Verification UI: car icon + small search badge
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="display:block;fill:currentColor;">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16m11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5M5 11l1.5-4.5h11L19 11z"/>
      </svg>
      <span style="position:absolute;right:2px;bottom:2px;width:13px;height:13px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px currentColor;">
        <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true" style="display:block;fill:currentColor;">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"/>
        </svg>
      </span>
    `;
    btn.style.cssText = [
      'position:relative',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'width:34px',
      'height:34px',
      'padding:0',
      'margin-left:6px',
      'background:#ffffff',
      'color:#1E88C9',
      'border:1px solid #D0D5DD',
      'border-radius:8px',
      'cursor:pointer',
      'box-shadow:0 1px 2px rgba(16,24,40,0.06)',
      'flex-shrink:0',
      'transition:background 0.15s ease, border-color 0.15s ease'
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#EAF5FC';
      btn.style.borderColor = '#1E88C9';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#ffffff';
      btn.style.borderColor = '#D0D5DD';
    });

    // Prevent triggering React PlateInput blur/edit or global Verification hotkeys (Enter/Esc/Backspace/F/P)
    ['mousedown', 'mouseup', 'keydown', 'keyup'].forEach((evName) => {
      btn.addEventListener(evName, (e) => {
        e.stopPropagation();
      });
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.blur();

      const targetContainer = getPlateContainerFn();
      const vrn = extractCleanVrn(targetContainer);
      if (!vrn || vrn.length < 2) {
        sendLog('WARN', 'Clicked inline lookup button but VRN was empty/invalid', { vrn });
        return;
      }

      sendLog('INFO', 'Inline Plate lookup button clicked', { vrn });
      const rect = btn.getBoundingClientRect();
      if (window.__ukVehicleExtPopover) {
        window.__ukVehicleExtPopover.showLoading(vrn, rect);
      }

      pendingLookupVrn = vrn;
      chrome.runtime.sendMessage({ type: 'LOOKUP_VEHICLE', vrn }, (response) => {
        if (pendingLookupVrn === vrn) pendingLookupVrn = null;
        if (chrome.runtime.lastError) {
          sendLog('ERROR', 'Runtime message error on LOOKUP_VEHICLE', {
            vrn,
            error: chrome.runtime.lastError.message
          });
        }
        if (window.__ukVehicleExtPopover) {
          window.__ukVehicleExtPopover.showResult(response || { ok: false, vrn });
        }
      });
    });

    return btn;
  }

  function scanAndInject() {
    // Match <Row label="Plate"> in tenant-centralization-verification left-panel.tsx
    const candidates = document.querySelectorAll('p, span, div, td, label');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (text !== 'Plate' && text !== 'VRN') continue;

      const rowEl = el.parentElement;
      if (!rowEl || rowEl.children.length < 2) continue;

      const valueCol = rowEl.children[1];
      if (!valueCol || valueCol.querySelector(`.${BTN_CLASS}`)) continue;

      const flexContainer = valueCol.firstElementChild || valueCol;
      const plateBoxWrapper = flexContainer.firstElementChild || flexContainer;

      const computedDisplay = window.getComputedStyle(flexContainer).display;
      if (!computedDisplay.includes('flex')) {
        flexContainer.style.display = 'inline-flex';
        flexContainer.style.alignItems = 'center';
      }

      const btn = createLookupButton(() => plateBoxWrapper);
      flexContainer.appendChild(btn);
      sendLog('INFO', 'Injected inline lookup button next to Plate', {
        vrn: extractCleanVrn(plateBoxWrapper),
        inIframe: window !== window.top
      });
    }
  }

  scanAndInject();
  // Debounce scans: script runs in every frame of every site (all_frames), keep it cheap on busy SPAs
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanAndInject();
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
