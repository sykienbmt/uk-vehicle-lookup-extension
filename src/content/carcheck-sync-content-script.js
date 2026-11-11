/**
 * Content script for https://www.carcheck.co.uk/*
 * Extracts vehicle specification tables from the live DOM when a user views
 * a vehicle report on carcheck.co.uk and syncs them back to the extension.
 */

(function extractAndSyncCarCheckDom() {
  try {
    if (document.title.includes('Just a moment')) {
      return;
    }

    const fields = {};
    const rows = document.querySelectorAll('table tr');
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll('th, td');
      if (cells.length >= 2) {
        const label = (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
        const value = (cells[1].textContent || '').replace(/\s+/g, ' ').trim();
        if (
          label &&
          value &&
          label.length < 50 &&
          value.length < 120 &&
          !/buy|unlock|premium|check now/i.test(value)
        ) {
          fields[label] = value;
        }
      }
    });

    if (Object.keys(fields).length === 0) {
      return;
    }

    const h1 = document.querySelector('h1');
    const title = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : document.title;

    chrome.runtime.sendMessage({
      type: 'CARCHECK_DOM_SYNC',
      url: window.location.href,
      title,
      fields
    });
  } catch (_) {
    // Ignore errors in content script
  }
})();

