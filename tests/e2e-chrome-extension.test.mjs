import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROMIUM_PATH = 'C:\\Users\\admin\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe';
const EXTENSION_DIR = 'd:\\extension\\UK-vehicle extension';
const DEBUG_PORT = 9345;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTargets(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const sw = list.find(
          (t) => t.type === 'service_worker' && t.url.includes('service-worker.js')
        );
        if (sw) return { list, sw };
      }
    } catch (_) {
      // retry
    }
    await sleep(300);
  }
  throw new Error('Timed out waiting for extension service worker target');
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        }
      });
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });

    ws.addEventListener('error', (err) => reject(err));
  });
}

test('E2E Chrome Extension: Popup layout (Focus Grid, single scroll, big hover image) & In-Page Plate Lookup Button on UKPC Verification screen', async () => {
  // Mimic UKPC portal: host shell /app/central-verifications/... embeds the verification app in an iframe
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.url.startsWith('/app/')) {
      const innerUrl = req.url.replace('/app/', '/');
      res.end(`<!DOCTYPE html><html><body style="margin:0"><iframe id="mfe" src="${innerUrl}" style="width:100%;height:600px;border:0"></iframe></body></html>`);
      return;
    }
    // Real DOM snapshot from UKPC staging (central-verifications/verification/148496)
    res.end(fs.readFileSync(path.join(EXTENSION_DIR, 'tests', 'fixtures', 'ukpc-staging-verification-page.html'), 'utf8'));
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const serverPort = server.address().port;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uk-ext-e2e-'));
  const chromeProc = spawn(
    CHROMIUM_PATH,
    [
      '--headless=new',
      `--user-data-dir=${userDataDir}`,
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--no-first-run',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  try {
    const { sw } = await waitForTargets(DEBUG_PORT);
    const extId = new URL(sw.url).host;

    await sleep(500);
    const swCdp = await createCdpClient(sw.webSocketDebuggerUrl);
    await swCdp.send('Runtime.enable');
    await swCdp.send('Runtime.evaluate', {
      expression: `chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })`,
      awaitPromise: true
    });

    const popupUrl = `chrome-extension://${extId}/popup.html`;
    let popupTarget = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await listRes.json();
      popupTarget = targets.find((t) => t.url === popupUrl);
      if (popupTarget) break;
    }
    assert.ok(popupTarget, 'Popup tab target should be created');

    const cdp = await createCdpClient(popupTarget.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await sleep(800);

    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const input = document.getElementById('vrnInput');
          input.value = 'DN16FTK';
          document.getElementById('searchForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `,
      returnByValue: true
    });

    let uiSnapshot = null;
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const loadingEl = document.getElementById('loadingState');
            if (!loadingEl) return null;
            const loading = !loadingEl.classList.contains('hidden');
            const hasResult = !document.getElementById('resultContainer').classList.contains('hidden');
            if (loading || !hasResult) return null;
            return JSON.stringify({
              bodyWidth: getComputedStyle(document.body).width,
              tabPanelOverflowY: getComputedStyle(document.getElementById('tab-overview')).overflowY,
              focusText: document.getElementById('focusGrid').innerText,
              statusText: document.getElementById('statusGrid').innerText,
              heroImgSrc: document.querySelector('.hero-img')?.src || ''
            });
          })()
        `,
        returnByValue: true
      });
      if (evalRes.result && evalRes.result.value) {
        uiSnapshot = JSON.parse(evalRes.result.value);
        break;
      }
    }

    assert.ok(uiSnapshot, 'Popup search should complete');
    assert.equal(uiSnapshot.bodyWidth, '600px', 'Popup width should be 600px');
    assert.equal(uiSnapshot.tabPanelOverflowY, 'visible', 'Tab panel should not have a second vertical scrollbar');
    assert.match(uiSnapshot.focusText, /SUV\s*\(Car\)/i);
    assert.match(uiSnapshot.focusText, /GREY/i);
    assert.match(uiSnapshot.focusText, /NON-EV/i);
    assert.match(uiSnapshot.statusText, /TAX:\s*Taxed/i);
    assert.match(uiSnapshot.heroImgSrc, /Nissan-Qashqai/i);
    cdp.close();

    // Part 2: Test the In-Page Lookup Button on the simulated UKPC Verification screen (Plate: LV24PWO)
    const testPageUrl = `http://127.0.0.1:${serverPort}/app/central-verifications/verification/148496?mode=audit`;
    await swCdp.send('Runtime.evaluate', {
      expression: `chrome.tabs.create({ url: '${testPageUrl}' })`,
      awaitPromise: true
    });

    let pageTarget = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await listRes.json();
      pageTarget = targets.find((t) => t.url === testPageUrl);
      if (pageTarget) break;
    }
    assert.ok(pageTarget, 'Verification test page should open');

    const pageCdp = await createCdpClient(pageTarget.webSocketDebuggerUrl);
    await pageCdp.send('Runtime.enable');

    // Wait for content script to inject .uk-vehicle-ext-inline-lookup-btn next to LV24PWO and click it
    let btnClicked = false;
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      const clickRes = await pageCdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const doc = document.getElementById('mfe')?.contentDocument;
            if (!doc) return false;
            if (document.querySelector('.uk-vehicle-ext-inline-lookup-btn')) return false;
            const btns = doc.querySelectorAll('.uk-vehicle-ext-inline-lookup-btn');
            if (btns.length !== 1) return false;
            const btn = btns[0];
            // Must sit right after the yellow plate box inside the Plate row
            if (!btn.parentElement.classList.contains('css-amj7dw')) return false;
            btn.click();
            return true;
          })()
        `,
        returnByValue: true
      });
      if (clickRes.result && clickRes.result.value === true) {
        btnClicked = true;
        break;
      }
    }
    assert.equal(btnClicked, true, 'Inline lookup button should be injected next to Plate and clicked');

    // Wait for Shadow DOM popover to render LV24PWO result (Ford Transit Custom Panel Van)
    let popoverText = '';
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      const popRes = await pageCdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const doc = document.getElementById('mfe')?.contentDocument;
            const host = doc && doc.getElementById('uk-vehicle-ext-popover-host');
            if (!host || !host.shadowRoot) return '';
            return host.shadowRoot.innerHTML;
          })()
        `,
        returnByValue: true
      });
      const html = (popRes.result && popRes.result.value) || '';
      if (html.includes('Transit Custom')) {
        popoverText = html;
        break;
      }
    }

    assert.match(popoverText, /Transit Custom/i, 'Popover should show Ford Transit Custom for LV24PWO');
    assert.match(popoverText, /Panel Van\s*\(LCV\)/i, 'Popover should highlight Panel Van (LCV)');
    assert.match(popoverText, /Grey/i, 'Popover should highlight Grey colour');
    assert.match(popoverText, /NON-EV/i, 'Popover should highlight non-EV status');

    pageCdp.close();

    // Part 3: Verify the Diagnostic & Error Trace Logs page (logs.html) recorded the lookups
    const logsUrl = `chrome-extension://${extId}/logs.html`;
    await swCdp.send('Runtime.evaluate', {
      expression: `chrome.tabs.create({ url: '${logsUrl}' })`,
      awaitPromise: true
    });
    swCdp.close();

    let logsTarget = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await listRes.json();
      logsTarget = targets.find((t) => t.url === logsUrl);
      if (logsTarget) break;
    }
    assert.ok(logsTarget, 'Logs viewer page should open');

    const logsCdp = await createCdpClient(logsTarget.webSocketDebuggerUrl);
    await logsCdp.send('Runtime.enable');
    await sleep(600);

    const logsRes = await logsCdp.send('Runtime.evaluate', {
      expression: `document.getElementById('logContainer')?.innerText || ''`,
      returnByValue: true
    });
    const logsText = (logsRes.result && logsRes.result.value) || '';
    assert.match(logsText, /Completed vehicle lookup/i, 'Logs page should display completed lookup entries');
    assert.match(logsText, /DN16FTK/i, 'Logs page should include DN16FTK trace');
    assert.match(logsText, /LV24PWO/i, 'Logs page should include LV24PWO trace');
    logsCdp.close();
  } finally {
    chromeProc.kill();
    server.close();
    await sleep(800);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    } catch (_) {
      // Ignore Windows file-lock EPERM on temporary profile cleanup
    }
  }
});
