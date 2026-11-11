/**
 * Shadow-DOM stylesheet (dark + light themes) for the in-page UK Vehicle Lookup popover.
 * Loaded before inpage-lookup-popover.js; the theme is chosen by `data-theme` on the popover host.
 */

(function defineUkVehiclePopoverStyles() {
  if (window.__ukVehiclePopoverStyles) return;

  const css = `
    :host {
      --bg: #0f172a; --panel: #1e293b; --panel-alt: #263349; --border: #334155;
      --text: #f8fafc; --strong: #ffffff; --muted: #94a3b8; --soft: #cbd5e1; --accent: #38bdf8;
      --divider: rgba(255,255,255,0.06); --dot-border: rgba(255,255,255,0.75); --error: #fca5a5;
      --ev-yes-bg: rgba(6,95,70,0.55); --ev-hybrid-bg: rgba(146,64,14,0.45); --shadow: rgba(0,0,0,0.65);
      color-scheme: dark;
    }
    :host([data-theme="light"]) {
      --bg: #ffffff; --panel: #f8fafc; --panel-alt: #f1f5f9; --border: #cbd5e1;
      --text: #0f172a; --strong: #0f172a; --muted: #64748b; --soft: #475569; --accent: #0284c7;
      --divider: rgba(15,23,42,0.08); --dot-border: rgba(15,23,42,0.35); --error: #b91c1c;
      --ev-yes-bg: rgba(16,185,129,0.14); --ev-hybrid-bg: rgba(245,158,11,0.16); --shadow: rgba(15,23,42,0.28);
      color-scheme: light;
    }
    .card { width: 550px; background: var(--bg); color: var(--text); border: 2px solid var(--border); border-radius: 10px; box-shadow: 0 20px 50px var(--shadow); padding: 12px 14px; font-size: 13px; line-height: 1.45; position: relative; overflow: visible; }
    .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 10px; }
    .hdr-actions { display: flex; gap: 6px; }
    .plate-tag { background: #facc15; color: #09090b; font-weight: 900; font-size: 16px; padding: 3px 10px; border-radius: 5px; border: 2px solid #000; letter-spacing: 1.5px; }
    .close-btn { background: var(--panel); color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 3px 9px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .close-btn:hover { color: var(--strong); border-color: #f87171; }
    .theme-btn { font-size: 12px; }
    .theme-btn:hover { border-color: var(--accent); }
    .hero { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; position: relative; overflow: visible; z-index: 30; }
    .h-title { font-size: 16.5px; font-weight: 800; color: var(--strong); }
    .h-sub { font-size: 12px; color: var(--accent); font-weight: 600; margin-top: 2px; }
    .car-img { width: 158px; height: 92px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; border: 2px solid var(--border); cursor: zoom-in; transform-origin: top left; transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease; position: relative; z-index: 80; }
    .car-img:hover { transform: scale(3.45); box-shadow: 0 20px 55px rgba(0,0,0,0.88); border-color: #facc15; }
    .focus-grid { display: grid; grid-template-columns: 1.15fr 0.9fr 1.2fr; gap: 8px; margin-top: 9px; }
    .f-box { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
    .f-box.ev-yes { background: var(--ev-yes-bg); border-color: #10b981; }
    .f-box.ev-hybrid { background: var(--ev-hybrid-bg); border-color: #f59e0b; }
    .f-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
    .f-val { font-size: 14.5px; font-weight: 800; color: var(--strong); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
    .f-sub { font-size: 11px; color: var(--soft); margin-top: 2px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--dot-border); display: inline-block; flex-shrink: 0; }
    .tbl { width: 100%; border-collapse: collapse; margin-top: 9px; background: var(--panel); border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
    .tbl tr { border-bottom: 1px solid var(--divider); }
    .tbl td { padding: 4.5px 9px; font-size: 12px; }
    .tbl td.k { color: var(--muted); width: 42%; }
    .tbl td.v { font-weight: 600; text-align: right; color: var(--text); }
    .status-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 9px; }
    .st-pill { border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; }
    .st-ok { background: rgba(0, 112, 60, 0.85); border: 1px solid #22c55e; color: #fff; }
    .st-bad { background: rgba(212, 53, 28, 0.85); border: 1px solid #ef4444; color: #fff; }
    .st-wait { background: var(--panel); border: 1px solid var(--border); color: var(--muted); }
    .actions { display: flex; gap: 6px; margin-top: 9px; }
    .btn { flex: 1; background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none; }
    .btn:hover { border-color: var(--accent); }
  `;

  window.__ukVehiclePopoverStyles = {
    css,
    // Keep in sync with THEME_STORAGE_KEY in src/popup/theme-preference.js
    THEME_STORAGE_KEY: 'uk_vehicle_ui_theme_v1'
  };
})();
