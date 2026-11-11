# UK Vehicle Plate Lookup — Chrome Extension (MV3)

Instant UK vehicle registration (VRN) lookup combining **GOV.UK DVLA Vehicle Enquiry** and **CarCheck / Extended UK Specs** directly inside Chrome and inline on the **UKPC Centralised Verification** screen.

---

## ✨ Key Features

- **Priority Verification Focus Grid**: Highlights **Vehicle Type / Body Style**, **Colour** (with visual colour swatch), and **EV / Fuel Status** (`⚡ ELECTRIC (EV)`, `🔌 HYBRID`, `⛽ NON-EV`) at the top.
- **Inline Lookup on UKPC Centralised Verification**: Automatically injects a compact lookup icon button right next to the yellow **Plate** box (`<Row label="Plate">`), working seamlessly inside micro-frontend iframes (`all_frames: true`) without interfering with verification hotkeys (`Enter`, `Esc`, `Backspace`, `F`, `P`, `A`).
- **Hover-to-Zoom Vehicle Image**: Hover over the vehicle photo in the popup or in-page popover to enlarge it (`3.4x` zoom) for visual comparison with ANPR camera photos.
- **Single-Scroll 600px Popup & Side Panel**: Clean layout with **Tax** and **MOT** badges placed at the bottom and zero nested scrollbars.
- **Diagnostic & Error Trace Logs (`logs.html`)**: Built-in background logger (`INFO`, `WARN`, `ERROR`) with search/level filtering and 1-click **`.log` file export** (`⬇ Download .log File`).

---

## 📦 Installation (from GitHub Releases)

1. Go to the [**Releases**](../../releases) page and download the latest `uk-vehicle-lookup-v*.zip` file.
2. Extract the `.zip` archive to a folder on your computer.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** (top-left) and select the extracted folder.

---

## 🛠️ Development & Testing

```powershell
# Run unit + E2E Chromium extension tests
node --test tests/parsers-and-live-lookup.test.mjs tests/e2e-chrome-extension.test.mjs

# Build release zip package (dist/uk-vehicle-lookup-v<version>.zip)
powershell -ExecutionPolicy Bypass -File scripts/build-chrome-web-store-zip.ps1
```

