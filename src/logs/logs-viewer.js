/**
 * Controller for logs.html (Diagnostic & Error Trace Viewer and .log File Exporter).
 */

import {
  getDiagnosticLogs,
  clearDiagnosticLogs,
  formatLogsAsTextFile
} from '../utils/diagnostic-logger.js';

const logContainer = document.getElementById('logContainer');
const filterInput = document.getElementById('filterInput');
const levelSelect = document.getElementById('levelSelect');
const refreshBtn = document.getElementById('refreshBtn');
const downloadLogBtn = document.getElementById('downloadLogBtn');
const clearBtn = document.getElementById('clearBtn');

let cachedLogs = [];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getFilteredLogs() {
  const q = (filterInput.value || '').trim().toLowerCase();
  const level = levelSelect.value;

  return cachedLogs.filter((entry) => {
    if (level === 'ERROR' && entry.level !== 'ERROR') return false;
    if (level === 'WARN' && entry.level !== 'WARN' && entry.level !== 'ERROR') return false;
    if (!q) return true;
    return JSON.stringify(entry).toLowerCase().includes(q);
  });
}

function renderLogs() {
  const filtered = getFilteredLogs();
  if (filtered.length === 0) {
    logContainer.innerHTML = '<div style="color:#94a3b8;">No diagnostic log entries match the current filter.</div>';
    return;
  }

  logContainer.innerHTML = filtered
    .map((item) => {
      const { timestamp, level, scope, message, ...meta } = item;
      const metaText = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
      const line = `${timestamp} [${level}] [${scope}] ${message}${metaText}`;
      return `<div class="log-line lvl-${escapeHtml(level)}">${escapeHtml(line)}</div>`;
    })
    .join('');
}

async function loadLogs() {
  cachedLogs = await getDiagnosticLogs();
  renderLogs();
}

filterInput.addEventListener('input', renderLogs);
levelSelect.addEventListener('change', renderLogs);
refreshBtn.addEventListener('click', loadLogs);

clearBtn.addEventListener('click', async () => {
  await clearDiagnosticLogs();
  await loadLogs();
});

downloadLogBtn.addEventListener('click', () => {
  const filtered = getFilteredLogs();
  const textContent = formatLogsAsTextFile(filtered);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uk-vehicle-lookup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uk_vehicle_diagnostic_logs_v1) {
      loadLogs();
    }
  });
}

loadLogs();

