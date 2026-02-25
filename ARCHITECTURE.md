# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) for MyJDownloader - a service that connects to JDownloader instances (running locally or on remote servers) to manage downloads. Converted from the original Manifest V2 extension.

## MV3 Migration Status

**Current State: COMPLETE - ALL CORE FEATURES WORKING**

### Working Features
- Login/logout via popup
- Device discovery and selection
- Right-click context menu "Download with JDownloader" with in-page toolbar
- Add-links dialog with countdown, device selection, optional parameters
- Click'N'Load (CNL) interception
- Session persistence across popup open/close cycles
- Options/settings page (via AngularJS route)
- Captcha solving (RC2) flow

## Architecture

```
+-------------------------------------------------------------------+
| Chrome Extension (MV3)                                            |
+-------------------------------------------------------------------+
| Service Worker    | Popup Page        | Toolbar (iframe)          |
| (background.js)  | (popup.html)      | (toolbar.html)            |
|                   |                   |                           |
| - Context menus   | popup-app.js      | toolbar.js                |
| - Request queue   |  (module+routes)  |  (module+routes)          |
| - DNR rules (CNL) | popup.js          | Loads jdapi via RequireJS |
| - Badge updates   |  (RequireJS+boot) | Own MyjdService instance  |
| - Message routing | Loads jdapi       | Direct API calls          |
| - Content script  |  directly         |  (no offscreen needed)    |
|   injection       |                   |                           |
|                   | Offscreen         |                           |
|                   | (offscreen.html)  |                           |
|                   | - jdapi for CNL   |                           |
|                   |   when popup is   |                           |
|                   |   closed          |                           |
+-------------------------------------------------------------------+
```

### Key Architecture Decisions

1. **Three independent Angular apps**: popup, toolbar, and settings each create their own `myjdWebextensionApp` module (with dependency array = new module). They don't share Angular scope.

2. **Toolbar uses local API**: The toolbar loads jdapi via RequireJS and has its own MyjdService. It sends links directly to JDownloader devices via `myjdDeviceClientFactory` -- no routing through background/offscreen. This avoids race conditions and session mismatch issues.

3. **Offscreen is minimal**: Only used for CNL processing when the popup is closed. All interactive flows (popup login, toolbar add-links) use their own jdapi instances.

4. **Session shared via chrome.storage.local**: All contexts (popup, toolbar, offscreen) restore sessions from `chrome.storage.local` key `myjd_session`. The jdapi library reads from `localStorage` key `jdapi/src/core/core.js`.

5. **APP_KEY standardized**: All contexts use `"myjd_webextension_chrome"` (matching the original MV2 extension). Different APP_KEYs cause token mismatch since jdapi derives encryption keys from it.

## Key Files

### Core Extension Files
- `manifest.json` - MV3 manifest
- `background.js` - Service worker: context menus, request queue, message routing, DNR rules
- `popup.html` / `scripts/popup-app.js` / `scripts/popup.js` - Popup UI
- `toolbar.html` / `scripts/toolbar.js` - In-page toolbar for add-links dialog
- `offscreen.html` / `offscreen.js` - API operations when popup closed (CNL only)

### AngularJS Application (`scripts/`)
- `services/MyjdService.js` - Main API client (jdapi wrapper, session management)
- `services/MyjdDeviceService.js` - Per-device API operations (sendRequest, polling)
- `factories/myjdClientFactory.js` - Returns MyjdService singleton
- `factories/myjdDeviceClientFactory.js` - Creates device-specific API clients
- `services/BackgroundScriptService.js` - Chrome messaging abstraction
- `services/StorageService.js` - chrome.storage.local wrapper
- `controllers/PopupController.js` - Login form, session check
- `controllers/ConnectedController.js` - Device list, logout confirmation
- `controllers/ToolbarController.js` - Toolbar init, countdown, device selection
- `controllers/AddLinksController.js` - Link sending (uses myjdDeviceClientFactory directly)
- `controllers/SettingsController.js` - Extension settings
- `controllers/ReallyLogoutController.js` - Logout confirmation
- `partials/templateCache.js` - All HTML templates pre-compiled

### Content Scripts
- `cnlInterceptor.js` - Intercepts CNL requests (fetch/XHR to localhost:9666)
- `toolbarContentscript.js` - Injects toolbar iframe into web pages
- `rc2Contentscript.js` - Captcha solving (RC2) handler
- `webinterfaceEnhancer.js` - my.jdownloader.org web interface integration

## Message Flow

### Context Menu -> Add Link
1. User right-clicks link -> `background.js` context menu handler
2. Link added to per-tab `requestQueue`
3. `notifyContentScript(tabId)` sends `open-in-page-toolbar` to content script
4. Content script injects `toolbar.html` as iframe
5. Toolbar loads jdapi, restores session, shows add-links dialog
6. User clicks send -> `AddLinksController` uses `myjdDeviceClientFactory.get(device).sendRequest()` directly
7. jdapi sends encrypted request to api.jdownloader.org -> JDownloader device

### Authentication
1. Popup opens -> `MyjdService.connect()` auto-restores session from `chrome.storage.local`
2. jdapi does HMAC-SHA256 handshake with `api.jdownloader.org`
3. Session tokens persisted to both `localStorage` (for jdapi) and `chrome.storage.local` (cross-context)

## Storage Keys

```javascript
LOCAL_STORAGE_KEY = "jdapi/src/core/core.js"  // jdapi internal session (localStorage)
SESSION_STORAGE_KEY = "myjd_session"           // Session backup (chrome.storage.local)
CREDS_STORAGE_KEY = "myjd_creds"               // Saved email only (no password)
```

## Security Notes

- `background.js` validates `sender.id === chrome.runtime.id` on all messages
- Only `toolbar.html`, `autograbber-indicator.html`, and `browser_solver_template.html` are web-accessible
- Credentials (passwords) are never stored; only email and session tokens are persisted
- `offscreen.js` only handles messages with `target: 'offscreen'` to prevent interception
- All API communication uses HTTPS (`https://api.jdownloader.org`)

## Development

### Loading for Testing
1. Go to `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" -> select this directory

### Debugging
- **Service Worker**: `chrome://extensions/` -> click "service worker" link
- **Popup**: Click extension icon -> right-click popup -> "Inspect"
- **Toolbar**: Right-click the injected toolbar iframe -> "Inspect"
- **Content Scripts**: Browser DevTools on web pages

---

**Last Updated**: 2026-02-25
**Migration Status**: COMPLETE
