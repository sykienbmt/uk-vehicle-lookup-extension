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

  let hostEl = null;
  let shadowRoot = null;

  function ensureHost() {
    if (hostEl && document.body.contains(hostEl)) return shadowRoot;
    hostEl = document.createElement('div');
    hostEl.id = 'uk-vehicle-ext-popover-host';
    hostEl.style.cssText = 'position:fixed;z-index:2147483646;top:72px;left:340px;font-family:system-ui,-apple-system,sans-serif;';
    ['keydown', 'keyup', 'keypress', 'click', 'mousedown'].forEach((ev) => {
      hostEl.addEventListener(ev, (e) => e.stopPropagation());
    });
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);
    return shadowRoot;
  }

  const POPOVER_CSS = `
    .card { width: 550px; background: #0f172a; color: #f8fafc; border: 2px solid #334155; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.65); padding: 12px 14px; font-size: 13px; line-height: 1.45; position: relative; overflow: visible; }
    .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px; }
    .plate-tag { background: #facc15; color: #09090b; font-weight: 900; font-size: 16px; padding: 3px 10px; border-radius: 5px; border: 2px solid #000; letter-spacing: 1.5px; }
    .close-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; border-radius: 6px; padding: 3px 9px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .close-btn:hover { color: #fff; border-color: #f87171; }
    .hero { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; position: relative; overflow: visible; z-index: 30; }
    .h-title { font-size: 16.5px; font-weight: 800; color: #fff; }
    .h-sub { font-size: 12px; color: #38bdf8; font-weight: 600; margin-top: 2px; }
    .car-img { width: 158px; height: 92px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; border: 2px solid #475569; cursor: zoom-in; transform-origin: top left; transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease; position: relative; z-index: 80; }
    .car-img:hover { transform: scale(3.45); box-shadow: 0 20px 55px rgba(0,0,0,0.88); border-color: #facc15; }
    .focus-grid { display: grid; grid-template-columns: 1.15fr 0.9fr 1.2fr; gap: 8px; margin-top: 9px; }
    .f-box { background: #263349; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; }
    .f-box.ev-yes { background: rgba(6, 95, 70, 0.55); border-color: #10b981; }
    .f-box.ev-hybrid { background: rgba(146, 64, 14, 0.45); border-color: #f59e0b; }
    .f-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; }
    .f-val { font-size: 14.5px; font-weight: 800; color: #fff; margin-top: 2px; display: flex; align-items: center; gap: 6px; }
    .f-sub { font-size: 11px; color: #cbd5e1; margin-top: 2px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.75); display: inline-block; flex-shrink: 0; }
    .tbl { width: 100%; border-collapse: collapse; margin-top: 9px; background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
    .tbl tr { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .tbl td { padding: 4.5px 9px; font-size: 12px; }
    .tbl td.k { color: #94a3b8; width: 42%; }
    .tbl td.v { font-weight: 600; text-align: right; color: #f8fafc; }
    .status-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 9px; }
    .st-pill { border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; }
    .st-ok { background: rgba(0, 112, 60, 0.85); border: 1px solid #22c55e; }
    .st-bad { background: rgba(212, 53, 28, 0.85); border: 1px solid #ef4444; }
    .actions { display: flex; gap: 6px; margin-top: 9px; }
    .btn { flex: 1; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 6px 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none; }
    .btn:hover { border-color: #38bdf8; }
  `;

  function showLoading(vrn, anchorRect) {
    const root = ensureHost();
    if (anchorRect) {
      hostEl.style.top = `${Math.max(16, Math.min(window.innerHeight - 460, anchorRect.top - 20))}px`;
      hostEl.style.left = `${Math.min(window.innerWidth - 570, anchorRect.right + 14)}px`;
    }
    root.innerHTML = `<style>${POPOVER_CSS}</style>
      <div class="card">
        <div class="hdr">
          <span class="plate-tag">${esc(vrn)}</span>
          <span style="color:#94a3b8;font-size:12px;">Searching GOV.UK &amp; CarCheck...</span>
          <button class="close-btn" id="closePop">✕</button>
        </div>
        <div style="padding:18px;text-align:center;color:#cbd5e1;">⏳ Fetching Vehicle Type, Colour &amp; EV Status...</div>
      </div>`;
    root.getElementById('closePop').onclick = () => hostEl.remove();
  }

  function showResult(payload) {
    const root = ensureHost();
    if (!payload || !payload.ok) {
      root.innerHTML = `<style>${POPOVER_CSS}</style>
        <div class="card">
          <div class="hdr"><span class="plate-tag">${esc(payload?.vrn || '')}</span><button class="close-btn" id="closePop">✕</button></div>
          <div style="color:#fca5a5;padding:10px;">${esc(payload?.govuk?.error || payload?.error || 'Vehicle details could not be found.')}</div>
        </div>`;
      root.getElementById('closePop').onclick = () => hostEl.remove();
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

    root.innerHTML = `<style>${POPOVER_CSS}</style>
      <div class="card">
        <div class="hdr">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="plate-tag">${esc(m.displayVrn || payload.vrn)}</span>
            <span style="font-size:12px;color:#94a3b8;font-weight:600;">UK Vehicle Lookup</span>
          </div>
          <button class="close-btn" id="closePop" title="Close">✕</button>
        </div>
        <div class="hero">
          <div>
            <div class="h-title">${esc([m.make, m.model].filter(Boolean).join(' ') || m.displayVrn)}</div>
            ${m.modelDetail ? `<div class="h-sub">${esc(m.modelDetail)}</div>` : ''}
            <div style="font-size:11.5px;color:#cbd5e1;margin-top:4px;">${esc([m.year, m.engineSize, m.bhp].filter(Boolean).join(' • '))}</div>
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
          <div class="st-pill ${m.isTaxValid ? 'st-ok' : 'st-bad'}">
            <span>${m.isTaxValid ? '✓' : '✗'} TAX: ${esc(m.taxStatus || 'N/A')}</span>
            <span style="font-weight:500;font-size:11px;">${esc(m.taxDue || '')}</span>
          </div>
          <div class="st-pill ${m.isMotValid ? 'st-ok' : 'st-bad'}">
            <span>${m.isMotValid ? '✓' : '✗'} MOT: ${esc(m.motStatus || 'N/A')}</span>
            <span style="font-weight:500;font-size:11px;">${esc(m.motExpiry || '')}</span>
          </div>
        </div>
        <div class="actions">
          <a class="btn" href="${esc(m.govUkUrl)}" target="_blank" rel="noopener">🏛️ Open GOV.UK</a>
          <a class="btn" href="${esc(m.carCheckUrl)}" target="_blank" rel="noopener">🚗 Open CarCheck</a>
        </div>
      </div>`;
    root.getElementById('closePop').onclick = () => hostEl.remove();
  }

  window.__ukVehicleExtPopover = { showLoading, showResult };
})();
