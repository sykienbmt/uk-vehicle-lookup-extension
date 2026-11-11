/**
 * Light / dark theme preference shared by the popup, side panel and in-page popover.
 * Stored in chrome.storage.local so every surface picks up a change immediately.
 */

// Keep in sync with THEME_STORAGE_KEY in src/content/inpage-lookup-popover.js
export const THEME_STORAGE_KEY = 'uk_vehicle_ui_theme_v1';
const DEFAULT_THEME = 'dark';

function sanitizeTheme(value) {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

export async function getThemePreference() {
  try {
    const data = await chrome.storage.local.get(THEME_STORAGE_KEY);
    return sanitizeTheme(data[THEME_STORAGE_KEY]);
  } catch (_) {
    return DEFAULT_THEME;
  }
}

export async function setThemePreference(theme) {
  try {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: sanitizeTheme(theme) });
  } catch (_) {
    // Storage unavailable: the theme still applies for this view
  }
}

/**
 * Applies the stored theme to the document, wires the toggle button,
 * and follows changes made from other surfaces (e.g. the in-page popover).
 * @param {HTMLButtonElement|null} toggleBtn
 */
export async function initThemeToggle(toggleBtn) {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    if (toggleBtn) {
      toggleBtn.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
      toggleBtn.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }
  };

  apply(await getThemePreference());

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      apply(next);
      setThemePreference(next);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[THEME_STORAGE_KEY]) {
      apply(sanitizeTheme(changes[THEME_STORAGE_KEY].newValue));
    }
  });
}
