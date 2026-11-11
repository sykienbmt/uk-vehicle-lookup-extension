/**
 * Renders the floating UK Vehicle Lookup Popover (Shadow DOM, English UI)
 * on the tenant-centralization-verification page when clicking the lookup icon next to Plate.
 */

(function initUkVehiclePopover() {
  if (window.__ukVehicleExtPopover) return;

  const SWATCH_MAP = {
    WHITE: '#f8fafc', BLACK: '#09090b', GREY: '#64748b', GRAY: '#64748b',
    SILVER: '#cbd5e1', BLUE: '#2563eb', RED: '#dc2626', GREEN: '#16a34a',
    YELLOW: '#facc15', ORANGE: '#ea580c', BROWN: '#78350f', BEIGE: '#d6d3d1',
    GOLD: '#eab308', PURPLE: '#9333ea', PINK: '#ec4899', MAROON: '#7f1d1d'
  };

  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getEvMeta(fuelType, co2) {
    const f = String(fuelType || '').trim().toUpperCase();
    if (
      f === 'ELECTRIC' || f === 'ELECTRICITY' || f === 'BEV' ||
      (f.includes('ELECTRIC') && !f.includes('HYBRID') && !f.includes('PETROL') && !f.includes('DIESEL')) ||
      (/^0\s*g\/km/i.test(String(co2 || '')) && !f.includes('PETROL') && !f.includes('DIESEL'))
    ) {
      return { cls: 'ev-yes', title: '⚡ ELECTRIC (EV)', sub: f || 'ELECTRIC (0 g/km)' };
    }
    if (f.includes('HYBRID') || f.includes('ELECTRIC') || f.includes('PHEV')) {
      return { cls: 'ev-hybrid', title: '🔌 HYBRID', sub: f };
    }
    return { cls: 'ev-no', title: '⛽ NON-EV', sub: f || 'PETROL / DIESEL' };
  }

  const { css: POPOVER_CSS, THEME_STORAGE_KEY } = window.__ukVehiclePopoverStyles;
  let hostEl = null;
  let shadowRoot = null;
  let currentTheme = 'dark';

  function ensureHost() {
    if (hostEl && document.body.contains(hostEl)) return shadowRoot;
    hostEl = document.createElement('div');
    hostEl.id = 'uk-vehicle-ext-popover-host';
    hostEl.dataset.theme = currentTheme;
    hostEl.style.cssText = 'position:fixed;z-index:2147483646;top:72px;left:340px;font-family:system-ui,-apple-system,sans-serif;';
    ['keydown', 'keyup', 'keypress', 'click', 'mousedown'].forEach((ev) => {
      hostEl.addEventListener(ev, (e) => e.stopPropagation());
    });
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);
    return shadowRoot;
  }

  // Set when the user closes the popover, so a lookup still in flight does not reopen it
  let dismissed = false;

  function closePopover() {
    dismissed = true;
    if (hostEl) hostEl.remove();
  }

  function applyTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    if (!hostEl) return;
    hostEl.dataset.theme = currentTheme;
    const btn = shadowRoot && shadowRoot.getElementById('themePop');
    if (btn) btn.textContent = currentTheme === 'light' ? '🌙' : '☀️';
  }

  // Header buttons shared by every popover state: theme toggle + close
  const HEADER_BUTTONS = `<div class="hdr-actions">
      <button class="close-btn theme-btn" id="themePop" title="Toggle light / dark theme"></button>
      <button class="close-btn" id="closePop" title="Close (Esc)">✕</button>
    </div>`;

  function wireHeader(root) {
    root.getElementById('closePop').onclick = closePopover;
    root.getElementById('themePop').onclick = () => {
      const next = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try {
        chrome.storage.local.set({ [THEME_STORAGE_KEY]: next });
      } catch (_) {
        // Extension context invalidated (extension reloaded): keep the local theme only
      }
    };
    applyTheme(currentTheme);
  }

  try {
    chrome.storage.local.get(THEME_STORAGE_KEY).then((data) => applyTheme(data[THEME_STORAGE_KEY]));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[THEME_STORAGE_KEY]) applyTheme(changes[THEME_STORAGE_KEY].newValue);
    });
  } catch (_) {
    // Storage unavailable: stay on the dark default
  }

  // Close on click outside the popover or on Escape (capture phase so page handlers cannot swallow it)
  document.addEventListener('mousedown', (e) => {
    if (hostEl && hostEl.isConnected && !e.composedPath().includes(hostEl)) closePopover();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hostEl && hostEl.isConnected) closePopover();
  }, true);

  function showLoading(vrn, anchorRect) {
    dismissed = false;
    const root = ensureHost();
    if (anchorRect) {
      hostEl.style.top = `${Math.max(16, Math.min(window.innerHeight - 460, anchorRect.top - 20))}px`;
      hostEl.style.left = `${Math.min(window.innerWidth - 570, anchorRect.right + 14)}px`;
    }
    root.innerHTML = `<style>${POPOVER_CSS}</style>
      <div class="card">
        <div class="hdr">
          <span class="plate-tag">${esc(vrn)}</span>
          <span style="color:var(--muted);font-size:12px;">Searching GOV.UK &amp; CarCheck...</span>
          ${HEADER_BUTTONS}
        </div>
        <div style="padding:18px;text-align:center;color:var(--soft);">⏳ Fetching Vehicle Type, Colour &amp; EV Status...</div>
      </div>`;
    wireHeader(root);
  }

  function showResult(payload) {
    if (dismissed) return;
    const root = ensureHost();
    if (!payload || !payload.ok) {
      root.innerHTML = `<style>${POPOVER_CSS}</style>
        <div class="card">
          <div class="hdr"><span class="plate-tag">${esc(payload?.vrn || '')}</span>${HEADER_BUTTONS}</div>
          <div style="color:var(--error);padding:10px;">${esc(payload?.govuk?.error || payload?.error || 'Vehicle details could not be found.')}</div>
        </div>`;
      wireHeader(root);
      return;
    }

    const m = payload.merged || {};
    const ev = getEvMeta(m.fuelType, m.co2Emissions);
    const swatch = SWATCH_MAP[String(m.colour || '').trim().toUpperCase()] || '#94a3b8';
    const typeLabel = [m.bodyStyle, m.vehicleType ? `(${m.vehicleType})` : ''].filter(Boolean).join(' ') || m.typeApproval || 'Car';
    const rows = [
      ['Make & Model', [m.make, m.model].filter(Boolean).join(' ')],
      ['Variant / Trim', m.modelDetail],
      ['Engine & Power', [m.engineSize, m.bhp].filter(Boolean).join(' • ')],
      ['Year / First Reg', [m.year, m.firstRegistration].filter(Boolean).join(' • ')],
      ['Emissions & Euro', [m.euroStatus ? `Euro ${m.euroStatus}` : '', m.co2Emissions].filter(Boolean).join(' • ')],
      ['Last V5C / Export', [m.lastV5cDate, m.exportMarker ? `Export: ${m.exportMarker}` : ''].filter(Boolean).join(' • ')]
    ].filter(([, v]) => v);
    const govPending = Boolean(payload.pending?.govuk);
    const pendingHint = payload.pending?.carcheck ? 'Loading image &amp; specs...' : (govPending ? 'Loading DVLA tax &amp; MOT...' : '');
    const statusPill = (label, status, detail, isValid) => govPending
      ? `<div class="st-pill st-wait"><span>⏳ ${label}: Loading...</span></div>`
      : `<div class="st-pill ${isValid ? 'st-ok' : 'st-bad'}">
            <span>${isValid ? '✓' : '✗'} ${label}: ${esc(status || 'N/A')}</span>
            <span style="font-weight:500;font-size:11px;">${esc(detail || '')}</span>
          </div>`;

    root.innerHTML = `<style>${POPOVER_CSS}</style>
      <div class="card">
        <div class="hdr">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="plate-tag">${esc(m.displayVrn || payload.vrn)}</span>
            <span style="font-size:12px;color:var(--muted);font-weight:600;">UK Vehicle Lookup</span>
          </div>
          ${HEADER_BUTTONS}
        </div>
        <div class="hero">
          <div>
            <div class="h-title">${esc([m.make, m.model].filter(Boolean).join(' ') || m.displayVrn)}</div>
            ${m.modelDetail ? `<div class="h-sub">${esc(m.modelDetail)}</div>` : ''}
            <div style="font-size:11.5px;color:var(--soft);margin-top:4px;">${esc([m.year, m.engineSize, m.bhp].filter(Boolean).join(' • '))}</div>
            ${pendingHint ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">⏳ ${pendingHint}</div>` : ''}
          </div>
          ${m.vehicleImage ? `<img class="car-img" src="${esc(m.vehicleImage)}" alt="Vehicle" title="Hover to enlarge vehicle image" />` : ''}
        </div>
        <div class="focus-grid">
          <div class="f-box">
            <div class="f-lbl">Vehicle Type / Body</div>
            <div class="f-val">${esc(typeLabel)}</div>
            <div class="f-sub">${esc([m.make, m.year].filter(Boolean).join(' • '))}</div>
          </div>
          <div class="f-box">
            <div class="f-lbl">Colour</div>
            <div class="f-val"><span class="dot" style="background:${swatch}"></span><span>${esc(m.colour || 'N/A')}</span></div>
            <div class="f-sub">DVLA Registered</div>
          </div>
          <div class="f-box ${ev.cls}">
            <div class="f-lbl">EV / Fuel Status</div>
            <div class="f-val">${esc(ev.title)}</div>
            <div class="f-sub">Fuel: ${esc(ev.sub)}</div>
          </div>
        </div>
        <table class="tbl"><tbody>
          ${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}
        </tbody></table>
        <div class="status-row">
          ${statusPill('TAX', m.taxStatus, m.taxDue, m.isTaxValid)}
          ${statusPill('MOT', m.motStatus, m.motExpiry, m.isMotValid)}
        </div>
        <div class="actions">
          <a class="btn" href="${esc(m.govUkUrl)}" target="_blank" rel="noopener">🏛️ Open GOV.UK</a>
          <a class="btn" href="${esc(m.carCheckUrl)}" target="_blank" rel="noopener">🚗 Open CarCheck</a>
        </div>
      </div>`;
    wireHeader(root);
  }

  window.__ukVehicleExtPopover = { showLoading, showResult };
})();
