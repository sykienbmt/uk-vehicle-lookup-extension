/**
 * Structured diagnostic & error logger for UK Vehicle Plate Lookup Extension.
 * Persists detailed trace logs to chrome.storage.local (accessible via logs.html
 * and downloadable as a .log / .jsonl file) without cluttering the Popup UI.
 */

const LOG_STORAGE_KEY = 'uk_vehicle_diagnostic_logs_v1';
const MAX_LOG_ENTRIES = 300;

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

/**
 * Appends a structured log entry.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} scope e.g. 'govuk-service', 'carcheck-service', 'coordinator', 'service-worker'
 * @param {string} message
 * @param {object} [meta]
 * @returns {Promise<object>}
 */
export async function writeDiagnosticLog(level, scope, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...meta
  };

  const prefix = `[UK-Vehicle-Ext][${entry.timestamp}][${level}][${scope}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, meta);
  } else if (level === 'WARN') {
    console.warn(prefix, message, meta);
  } else {
    console.info(prefix, message, meta);
  }

  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(LOG_STORAGE_KEY);
      const existing = Array.isArray(data[LOG_STORAGE_KEY]) ? data[LOG_STORAGE_KEY] : [];
      const updated = [entry, ...existing].slice(0, MAX_LOG_ENTRIES);
      await chrome.storage.local.set({ [LOG_STORAGE_KEY]: updated });
    } catch (_) {
      // Ignore storage write errors
    }
  }

  return entry;
}

export function logInfo(scope, message, meta = {}) {
  return writeDiagnosticLog('INFO', scope, message, meta);
}

export function logWarn(scope, message, meta = {}) {
  return writeDiagnosticLog('WARN', scope, message, meta);
}

export function logError(scope, message, meta = {}) {
  return writeDiagnosticLog('ERROR', scope, message, meta);
}

/**
 * Reads all stored diagnostic log entries.
 * @returns {Promise<Array<object>>}
 */
export async function getDiagnosticLogs() {
  if (!hasChromeStorage()) return [];
  const data = await chrome.storage.local.get(LOG_STORAGE_KEY);
  return Array.isArray(data[LOG_STORAGE_KEY]) ? data[LOG_STORAGE_KEY] : [];
}

/**
 * Clears all stored diagnostic log entries.
 * @returns {Promise<void>}
 */
export async function clearDiagnosticLogs() {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.remove(LOG_STORAGE_KEY);
}

/**
 * Formats log entries into a plain-text .log file content for downloading/tracing.
 * @param {Array<object>} logs
 * @returns {string}
 */
export function formatLogsAsTextFile(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return '# UK Vehicle Plate Lookup — Diagnostic Log (Empty)\n';
  }
  return logs
    .map((item) => {
      const { timestamp, level, scope, message, ...rest } = item;
      const metaStr = Object.keys(rest).length > 0 ? ` | ${JSON.stringify(rest)}` : '';
      return `${timestamp} [${level}] [${scope}] ${message}${metaStr}`;
    })
    .join('\n');
}

