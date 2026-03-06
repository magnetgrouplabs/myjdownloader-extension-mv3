# Architecture Patterns

**Domain:** Download manager browser extension (JDownloader integration)
**Researched:** 2026-03-06

## Current Architecture

The extension follows a standard Chrome MV3 multi-context architecture with an additional native messaging layer for CAPTCHA solving.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Service Worker (background.js) | Central message router, request queue, CNL queue, badge updates, offscreen management, keepalive | All other components via chrome.runtime.onMessage |
| Popup (popup.html + AngularJS) | Login/logout UI, device selection, settings, connected panel | Service worker via chrome.runtime.sendMessage |
| Toolbar (toolbar.html + AngularJS) | In-page add-links dialog, device selection, countdown, send links | Service worker via chrome.runtime.sendMessage; JDownloader API via local myjdDeviceClientFactory |
| Offscreen Document (offscreen.html/js) | MyJDownloader API operations when popup is closed | Service worker via chrome.runtime.sendMessage |
| Content Scripts | CNL interception, clipboard monitoring, toolbar injection, selection capture, web interface bridge | Service worker via chrome.runtime.sendMessage; page DOM directly |
| Native Messaging Host (Rust) | CAPTCHA WebView2 window, token capture, JDownloader HTTP callbacks | Extension via chrome.runtime.sendNativeMessage (stdin/stdout) |

### Data Flow

**Link Download Flow:**
```
User right-clicks link
  -> Context menu click (background.js)
  -> addLinkToRequestQueue() stores in memory
  -> notifyContentScript() injects toolbar iframe
  -> Toolbar loads, fetches queue via "link-info" message
  -> User configures options, selects device
  -> AddLinksController.send() calls JDownloader API via myjdDeviceClientFactory
  -> API responds success
  -> Toolbar closes, queue cleared
```

**Multi-Link Stacking Flow (target behavior):**
```
User right-clicks link A -> added to requestQueue[tabId]
User right-clicks link B -> added to requestQueue[tabId] (no duplicate)
User right-clicks link C -> added to requestQueue[tabId]
  -> Each addition triggers notifyContentScript()
  -> If toolbar already open: "link-info-update" message updates display
  -> If toolbar not open: "open-in-page-toolbar" creates iframe
  -> All links visible in toolbar list
  -> "Send" sends all links in batch
```

**CAPTCHA Flow:**
```
JDownloader opens http://127.0.0.1:PORT/captcha/recaptchav2/...
  -> Rc2Service.handleRequest() detects CAPTCHA URL pattern
  -> Closes the localhost tab
  -> CaptchaNativeService.sendCaptcha() sends native message
  -> Native helper opens WebView2 window with CAPTCHA widget
  -> User solves CAPTCHA in WebView2
  -> Native helper returns token via native messaging
  -> CaptchaNativeService submits token to JDownloader HTTP callback
  -> Download proceeds in JDownloader
```

**CNL Interception Flow:**
```
Website makes fetch/XHR to localhost:9666/flash/addcrypted2
  -> cnlInterceptor.js intercepts (overridden fetch/XHR)
  -> Captures form data (crypted links, passwords, source)
  -> Sends to background.js via "cnl-captured" message
  -> background.js stores in cnlRequestQueue
  -> If add-links dialog active: sets cnl_pending flag for popup
  -> If not: processes directly via offscreen document
```

## Patterns to Follow

### Pattern 1: Message-Based Inter-Context Communication
**What:** All communication between service worker, popup, toolbar, content scripts, and offscreen uses chrome.runtime.sendMessage/onMessage with action-based routing.
**When:** Any time one context needs data from or sends data to another.
**Why:** MV3 requires this pattern; contexts cannot share memory. The service worker is the central hub.

### Pattern 2: Request Queue for Link Accumulation
**What:** Per-tab in-memory queue in the service worker accumulates links before sending.
**When:** User right-clicks multiple links before sending.
**Why:** Decouples link capture (context menu) from link sending (toolbar UI). Allows batch operations.
**Implementation note:** Consider upgrading to chrome.storage.session so the queue survives service worker restarts.

### Pattern 3: Offscreen Document for Background API Calls
**What:** Offscreen document handles MyJDownloader API operations that need DOM/crypto.
**When:** Popup is closed but API operations are needed (CNL auto-send, device polling).
**Why:** MV3 service workers cannot access DOM or certain Web APIs. Offscreen document provides DOM context.

### Pattern 4: Content Script Iframe Injection for Toolbar
**What:** toolbarContentscript.js creates an iframe pointing to toolbar.html, positioned as a sidebar overlay.
**When:** User right-clicks a link or triggers add-links flow.
**Why:** Extension UI must be injected into the page context while maintaining isolation.

### Pattern 5: Native Messaging for CSP-Restricted Operations
**What:** Operations requiring inline scripts or external script loading use native messaging to a local binary.
**When:** CAPTCHA solving (requires loading Google/hCaptcha scripts that violate MV3 CSP).
**Why:** MV3 CSP prohibits inline scripts and external script loading. Native helper runs outside CSP sandbox.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared State Between Contexts
**What:** Storing state that multiple contexts depend on in only one context's memory.
**Why bad:** Service worker can terminate at any time (MV3). In-memory state is lost.
**Instead:** Use chrome.storage.local for persistent state, chrome.storage.session for transient state.

### Anti-Pattern 2: Polling for State Changes
**What:** Using setInterval to check for changes (e.g., Rc2Service 1-second canClose polling).
**Why bad:** Wasteful; prevents service worker from sleeping.
**Instead:** Use event-driven callbacks or chrome.alarms for periodic work.

### Anti-Pattern 3: Duplicating API Call Paths
**What:** Same API call reachable through multiple code paths with different error handling.
**Why bad:** Leads to double CAPTCHA job sends (current bug). Inconsistent error handling.
**Instead:** Single entry point for each API operation with clear fallback gating.

### Anti-Pattern 4: Using eval() or new Function()
**What:** Dynamic code execution.
**Why bad:** Violates MV3 CSP. Chrome Web Store rejection risk.
**Instead:** Static code only. RequireJS eval() is bypassed via ng-csp but should be removed eventually.

## Architecture for New Features

### Multi-Link Stacking
No architectural change needed. The request queue pattern already supports multiple links per tab. The gap is in the toolbar UI -- it needs to re-fetch the queue when new links are added and display all accumulated links.

### Directory History Dropdown
Uses existing chrome.storage.local pattern. Store a DIRECTORY_HISTORY key with bounded array. AddLinksController already manages per-device history; this needs to be elevated to a shared, persistent dropdown.

### CAPTCHA E2E Testing
Playwright test setup requires: persistent browser context, headed Chromium, unpacked extension path. CAPTCHA tests are semi-automated (human solves CAPTCHA, test verifies flow).

## Sources

- Existing codebase analysis: background.js, popup.html, toolbar.html, content scripts
- Chrome MV3 architecture: [Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- Chrome native messaging: [Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- Playwright Chrome extensions: [Playwright Docs](https://playwright.dev/docs/chrome-extensions)
