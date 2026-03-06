# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Multi-tier hybrid architecture combining Chrome Extension MV3, AngularJS frontend, and native messaging (Rust binary)

**Key Characteristics:**
- Service worker (background.js) manages tab state, messaging, and offscreen document lifecycle
- Offscreen document (offscreen.js) handles JDownloader API operations and session management
- Content scripts intercept browser actions and network requests
- Native messaging host (Rust binary) solves CAPTCHAs via WebView2 to bypass MV3 CSP restrictions
- AngularJS UI (popup/toolbar) provides user interface with reactive state management


## Layers

**Service Worker (Background Layer):**
- Purpose: Central orchestrator managing extension lifecycle, messaging, offscreen documents, and tab-level state
- Location: `background.js`
- Contains: Message routing, request queues, connection state, settings persistence
- Depends on: Chrome runtime API, storage API, tabs API
- Used by: All other extension contexts (popup, content scripts, offscreen)

**Offscreen Document (API Layer):**
- Purpose: Encapsulates JDownloader API operations that require DOM access (localStorage for session handling)
- Location: `offscreen.js`
- Contains: API initialization, login/logout, device listing, link addition
- Depends on: jdapi.js (RequireJS-loaded), chrome.storage, chrome.runtime.sendMessage
- Used by: background.js via sendToOffscreen() message handler

**Content Scripts (Web Intercept Layer):**
- Purpose: Inject into web pages to capture user actions, selection, clipboard, and network requests
- Location: `contentscripts/`
- Contains: 5 content scripts for CNL interception, selection capture, toolbar injection, clipboard monitoring
- Depends on: DOM APIs, chrome.runtime.sendMessage
- Used by: Web pages; communicate with background.js

**UI Layer (AngularJS):**
- Purpose: Provide user interface for login, device selection, link management
- Location: `scripts/` (controllers, directives, services, factories)
- Contains: Controllers (PopupController, ToolbarController, etc.), directives, services, factories
- Depends on: AngularJS, jdapi.js, Chrome extension APIs
- Used by: popup.html (main popup), toolbar.html (in-page toolbar)

**Native Helper Layer (Rust Binary):**
- Purpose: Solve CAPTCHAs in native WebView2 window to bypass MV3 CSP
- Location: `captcha-helper/src/` (Rust sources)
- Contains: Request/response handling, WebView2 management, HTML generation, HTTP callbacks
- Depends on: wry/tao (cross-platform WebView), ureq (HTTP), serde (JSON)
- Used by: Extension via chrome.runtime.sendNativeMessage()

**Native Messaging Protocol:**
- Service: `CaptchaNativeService` (JavaScript)
- Host: `myjd_captcha_helper` (Rust binary)
- Flow: Extension → chrome.runtime.sendNativeMessage() → stdin/stdout protocol → Rust process


## Data Flow

**Login Flow:**

1. User enters credentials in popup → PopupController
2. PopupController calls MyjdService.connect(email, password)
3. MyjdService creates API instance with APP_KEY="myjd_webextension_chrome"
4. MyjdService connects via api.connect() (jdapi handles crypto, handshake)
5. On success: session data saved to chrome.storage.local and localStorage
6. Connection state broadcast via ExtensionMessagingService to background.js
7. Background updates badge ("!" removed if connected)

**Session Persistence:**

1. Offscreen document loads on first API call
2. background.js calls sendToOffscreen('offscreen-get-devices')
3. offscreen.js restores session from localStorage (set by offscreen.js itself on page load)
4. Session data: encrypted token, username, API metadata

**Add Links Flow:**

1. User right-clicks link → background.js context menu handler
2. Link queued in requestQueue[tabId] (in-memory per-tab storage)
3. Toolbar content script notified via chrome.tabs.sendMessage()
4. Toolbar iframe (toolbar.html) displays link preview and device selector
5. User clicks "Add links" → ToolbarController
6. ToolbarController calls background.js "add-link" action
7. background.js forwards to offscreen via sendToOffscreen('offscreen-add-link')
8. offscreen.js calls api.send('/linkgrabberv2/addLinks', {links: ...})

**CAPTCHA Solving Flow:**

1. JDownloader opens tab: http://127.0.0.1:9666/captcha/recaptchav2/?id=...
2. Rc2Service.handleRequest() detects CAPTCHA URL pattern
3. URL tab is closed immediately (native helper shows its own window)
4. webinterfaceEnhancer (if on my.jdownloader.org) OR local CAPTCHA tab sends: Rc2Service listener
5. Rc2Service calls CaptchaNativeService.sendCaptcha(captchaJob)
6. CaptchaNativeService constructs message with: siteKey, challengeType, callbackUrl, captchaId
7. Sends via chrome.runtime.sendNativeMessage('org.jdownloader.captcha_helper', message)
8. Rust native helper receives message on stdin (native messaging protocol)
9. Native helper validates inputs, generates HTML with reCAPTCHA/hCaptcha widget
10. Opens WebView2 window with HTML and 5-minute timeout countdown
11. User solves CAPTCHA in WebView2
12. Token captured by JavaScript in WebView2, sent back to native helper
13. Native helper sends Response { status: "solved", token: "..." } via stdout
14. Chrome receives response in CaptchaNativeService callback
15. CaptchaNativeService submits token to JDownloader via HTTP callback:
    - If callbackUrl is "MYJD": send message to my.jdownloader.org tab
    - Otherwise: HTTP GET to callbackUrl + "&do=solve&response=" + token
16. JDownloader processes token, closes CAPTCHA job

**CNL (Click'N'Load) Flow:**

1. cnlInterceptor.js content script running on all pages
2. Intercepts fetch() calls to localhost:9666/flash/add or /flash/addcrypted2
3. Captures form data (crypted links or plain URLs)
4. Sends chrome.runtime.sendMessage('cnl-captured', { formData, sourceUrl })
5. background.js receives "cnl-captured" action
6. If settings.add_links_dialog_active: sets 'cnl_pending' flag, stores in cnl_queue
7. If popup is open: popup receives message, displays "CNL captured" indicator
8. If popup is NOT open: background processes via processCnlViaOffscreen()
9. processCnlViaOffscreen() calls sendToOffscreen('offscreen-add-cnl')
10. offscreen.js calls api.send('/linkgrabberv2/addLinks', { links: cnlData.formData.crypted })


## Key Abstractions

**ExtensionMessagingService:**
- Purpose: Centralized message router for service-to-service communication
- Examples: `scripts/services/ExtensionMessagingService.js`
- Pattern: addListener(service, action, handler) and sendMessage(service, action, data)
- Used for: Rc2Service ↔ webinterfaceEnhancer, MyjdService ↔ background

**MyjdService (API Wrapper):**
- Purpose: Encapsulate jdapi instance, handle connection state, session persistence
- Examples: `scripts/services/MyjdService.js`
- Pattern: Rx observables for connection state, promise-based methods (getDeviceList, connect, send)
- Key properties: api, lastConnectionState, apiConnectionObserver, apiDeviceListObserver

**myjdClientFactory / myjdDeviceClientFactory:**
- Purpose: Lazy initialization and caching of API instances
- Examples: `scripts/factories/myjdClientFactory.js`, `scripts/factories/myjdDeviceClientFactory.js`
- Pattern: Factory pattern with singleton API, per-device clients
- Used by: Rc2Service for device-level API calls

**Native Helper Protocol (Request/Response):**
- Purpose: Standardized message format between extension and native binary
- Examples: `captcha-helper/src/captcha.rs` - Request, Response, CaptchaJob structs
- Pattern: Serde JSON serialization over stdin/stdout with 4-byte length prefix
- Request actions: "captcha_new", "skip", "cancel", "status"
- Response statuses: "ok", "opened", "solved", "skipped", "cancelled", "timeout", "error"


## Entry Points

**background.js (Service Worker):**
- Location: `/c/Users/anthony/jdownloader-extension-manifestv3/background.js`
- Triggers: Extension installation, startup, chrome.runtime.onMessage
- Responsibilities:
  - Initialize settings and badge state on startup
  - Route incoming messages from popup, toolbar, content scripts
  - Manage offscreen document lifecycle
  - Maintain per-tab request queues for toolbar flow
  - Handle context menu clicks
  - Manage CNL request queue

**popup.html / popup.js (Main UI):**
- Location: `popup.html`, `scripts/popup.js`, `scripts/popup-app.js`
- Triggers: User clicks extension icon
- Responsibilities:
  - Load jdapi via RequireJS
  - Bootstrap AngularJS app
  - Initialize MyjdService with API connection
  - Display login form or connected device list

**toolbar.html / toolbar.js (In-Page Toolbar):**
- Location: `toolbar.html`, `scripts/toolbar.js`, `contentscripts/toolbarContentscript.js`
- Triggers: Content script injects iframe on link capture
- Responsibilities:
  - Display captured links before adding to JDownloader
  - Show device selector
  - Handle add-links action
  - Send links to background via "add-link" message

**offscreen.html / offscreen.js (Offscreen Document):**
- Location: `offscreen.html`, `offscreen.js`
- Triggers: background.js calls chrome.offscreen.createDocument()
- Responsibilities:
  - Initialize jdapi with APP_KEY="myjd_webextension_chrome"
  - Restore session from chrome.storage.local
  - Handle offscreen-* messages from background
  - Perform API calls (login, devices, add links)
  - Persist session data

**myjd-captcha-helper (Rust Binary):**
- Location: `captcha-helper/src/main.rs`, `captcha-helper/src/lib.rs`
- Triggers: chrome.runtime.sendNativeMessage('org.jdownloader.captcha_helper', ...)
- Responsibilities:
  - Read JSON messages from stdin (Chrome native messaging protocol)
  - Validate inputs (site keys, URLs, skip types)
  - Generate HTML for CAPTCHA widget (reCAPTCHA v2/v3, hCaptcha)
  - Open WebView2 window with widget and 5-minute timeout
  - Capture token from window, send Response via stdout
  - Send HTTP callbacks to JDownloader for token submission


## Error Handling

**Strategy:** Layered error handling with fallbacks

**Patterns:**

1. **API Errors** (`scripts/services/ApiErrorService.js`):
   - Wraps jdapi errors
   - Extracts error message and code
   - Propagates to controllers via promise reject

2. **Message Handler Errors** (background.js):
   - try/catch in message listeners
   - sendResponse({ error: e.message }) on failure
   - chrome.runtime.lastError checks on callback-style APIs

3. **Offscreen Document Errors** (offscreen.js):
   - API not initialized check
   - Session restore failures handled gracefully (isReady = true anyway)
   - Failed API calls return { error: "..." }

4. **Native Helper Errors** (Rust):
   - Input validation with descriptive error messages
   - Response { status: "error", error: Some("...") }
   - Fallback: send HTTP skip request if WebView fails

5. **Content Script Errors** (toolbarContentscript.js):
   - chrome.tabs.sendMessage errors caught with .catch()
   - Script injection retried if message fails
   - console.log for debugging


## Cross-Cutting Concerns

**Logging:**
- Strategy: console.log throughout for debugging
- Patterns: [Component] prefix for context (e.g., "[Offscreen] ...", "[Toolbar] ...", "Rc2Service: ...")
- No persistent log storage in extension

**Validation:**
- Pattern: Validate at boundary layers (content scripts, native helper)
- Examples:
  - Native helper: `validation.rs` validates site keys, URLs, skip types
  - Offscreen: Checks api && api.jdAPICore before operations
  - Background: Checks sender.id === chrome.runtime.id for security

**Authentication:**
- Credential flow: popup.html → MyjdService.connect() → offscreen → jdapi
- Session storage: chrome.storage.local['myjd_session'] (encrypted JSON)
- APP_KEY: "myjd_webextension_chrome" used in all jdapi calls

**Security:**
- CSP: Extensions must use offscreen document for localStorage access
- Native messaging: Only registered hosts allowed (myjd_captcha_helper)
- Incognito: Check chrome.runtime.isAllowedIncognitoAccess before CAPTCHA
- URL validation: Native helper validates callback URLs are localhost:9666

---

*Architecture analysis: 2026-03-06*
