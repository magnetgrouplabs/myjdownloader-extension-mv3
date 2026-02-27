# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a completed Chrome Extension Manifest V3 conversion of MyJDownloader with native CAPTCHA helper. The extension uses a native messaging host to handle CAPTCHA solving in an MV3-compliant way.

## Directory Structure

```
myjdownloader-extension-mv3/
  README.md                        # GitHub-ready project README
  CLAUDE.md                        # This file
  LICENSE                          # GPL-3.0 license
  .gitignore                      # Git exclusions
  manifest.json                   # MV3 manifest
  background.js                   # Service worker
  popup.html / popup.js           # Login popup
  toolbar.html                    # In-page add-links toolbar
  offscreen.html / offscreen.js   # API operations when popup closed
  scripts/                        # AngularJS application
  vendor/                         # Third-party libraries
  contentscripts/                 # Content scripts
  captcha-helper/                 # Native messaging host (Rust)
    src/main.rs                   # Native helper source
    Cargo.toml                    # Rust dependencies
    myjd-native-host.json         # Native messaging manifest
  .github/workflows/              # CI/CD workflows
```

## Features Status: COMPLETE

All core features working:
- Login/logout
- Device discovery and selection
- Context menu "Download with JDownloader" with in-page toolbar
- Add-links dialog with countdown and options
- Click'N'Load (CNL) interception
- Session persistence
- Settings page (via AngularJS route)
- **CAPTCHA solving via native helper** (reCAPTCHA v2/v3, hCaptcha)

## Native CAPTCHA Helper

### Architecture

The CAPTCHA functionality uses a native messaging host with WebView2 to avoid MV3 CSP violations:

```
Extension (Rc2Service)
       │
       ▼ chrome.runtime.sendNativeMessage()
Native Helper (myjd-captcha-helper.exe)
       │
       ▼ Opens WebView2 window
WebView2 Window (embedded browser)
       │
       ▼ User solves CAPTCHA
Token returned via native messaging
       │
       ▼
Extension submits to JDownloader via HTTP
```

**Flow:**
1. **Extension detects CAPTCHA** → JDownloader opens `http://127.0.0.1:PORT/captcha/...`
2. **Rc2Service sends job to native helper** via `chrome.runtime.sendNativeMessage()`
3. **Native helper** creates WebView2 window with CAPTCHA widget
4. **User solves CAPTCHA** in the WebView2 window
5. **Token returned** to extension via native messaging
6. **Extension submits token** to JDownloader via HTTP POST
7. **Skip buttons** (hoster/package/all/single) available in window
8. **Window close** = skip hoster
9. **5-minute timeout** with countdown display

### Supported CAPTCHA Types

| Type | Support |
|------|---------|
| reCAPTCHA v2 | Full support (checkbox) |
| reCAPTCHA v3 | Full support (invisible) |
| reCAPTCHA Enterprise | Full support |
| hCaptcha | Full support |

### Files

| Component | Location | Purpose |
|-----------|----------|---------|
| Native helper | `captcha-helper/src/main.rs` | WebView2 window, CAPTCHA rendering, native messaging |
| Native host manifest | `captcha-helper/myjd-native-host.json` | Chrome native messaging config |
| Extension service | `scripts/services/CaptchaNativeService.js` | Sends CAPTCHA jobs to native helper |
| Extension integration | `scripts/services/Rc2Service.js` | Routes CAPTCHA jobs, handles responses |

### Dependencies

- **WebView2 Runtime**: Required for WebView2 window
  - Pre-installed on Windows 11
  - Downloadable for Windows 10 from Microsoft
  - Fixed version can be bundled for offline install

### Message Protocol

**Request from extension:**
```json
{
  "action": "captcha_new",
  "captchaType": "recaptcha|hcaptcha",
  "siteKey": "...",
  "callbackUrl": "http://127.0.0.1:PORT/...",
  "captchaUrl": "http://127.0.0.1:PORT/captcha/...",
  "mode": "v2|v3|enterprise",
  "theme": "light|dark"
}
```

```json
{"action": "skip", "callbackUrl": "...", "skipType": "hoster|package|all|single"}
```

```json
{"action": "status"}
```

**Response from native helper:**
```json
{"status": "opened", "captchaType": "recaptcha", "captcha_url": "..."}
```

```json
{"status": "solved", "token": "..."}
```

```json
{"status": "skipped", "skipType": "hoster|package|all|single"}
```

```json
{"status": "timeout"}
```

```json
{"status": "error", "error": "..."}
```

### Building and Registration

Run `magilla-build-test.ps1` as Administrator to:
1. Build the Rust binary with `cargo build --release`
2. Create the native messaging manifest (`myjd-native-host.json`)
3. Register it in Windows registry at `HKCU\Software\Google\Chrome\NativeMessagingHosts\myjd_captcha_helper`
4. Run a quick test to verify installation

**Manual build:**
```powershell
cd captcha-helper
cargo build --release
```

**Manual registration:**
```powershell
# Create manifest pointing to binary
# Add registry key: HKCU\Software\Google\Chrome\NativeMessagingHosts\myjd_captcha_helper
```

## When Working on This Project

1. **Read** `ARCHITECTURE.md` for detailed architecture
2. **Test** by reloading extension at `chrome://extensions/`
3. **Key constraint**: All contexts must use APP_KEY `"myjd_webextension_chrome"`
4. **Key constraint**: Toolbar sends links directly via local `myjdDeviceClientFactory`, not through background/offscreen
5. **Key constraint**: `ng-if` (not `ng-show`) for connected panel to prevent premature controller init
6. **Key constraint**: CAPTCHA requires native helper to be built and registered

## Removed Files (MV3 Compliance)

The following files were removed due to CSP violations (inline scripts):
- `contentscripts/rc2Contentscript.js` - Used inline script injection
- `contentscripts/browserSolverEnhancer.js` - Used inline script injection
- `contentscripts/rc2LoadingIndicator.js` - Related to removed CAPTCHA code
- `res/browser_solver_template.html` - Used by removed content scripts

CAPTCHA solving is now handled by the native messaging host.