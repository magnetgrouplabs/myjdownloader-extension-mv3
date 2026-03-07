# Phase 4: Web Tab CAPTCHA - Research

**Researched:** 2026-03-07
**Domain:** Chrome Extension MV3 content scripts, CAPTCHA token detection, tab lifecycle management
**Confidence:** HIGH

## Summary

This phase replaces the native messaging CAPTCHA helper with a web-tab-only approach. JDownloader already serves localhost CAPTCHA pages at `http://127.0.0.1:9666/captcha/{type}/{domain}?id={id}` that render functional reCAPTCHA/hCaptcha widgets via its own `browserCaptcha.js` script. The extension's job is to inject a content script that: (1) polls for solved tokens in `g-recaptcha-response` / `h-captcha-response` textareas, (2) relays tokens to the service worker for HTTP submission to JDownloader, (3) injects skip buttons and a countdown timer, and (4) handles tab-close and timeout scenarios.

The approach is fully MV3-compliant and requires no new permissions. All needed permissions (`tabs`, `scripting`, `<all_urls>`, `http://127.0.0.1:9666/*`) are already declared. Content scripts on `http://127.0.0.1/*` match patterns are a core Chrome feature. The ISOLATED world is sufficient for DOM polling and UI injection -- no MAIN world script is needed for the primary flow.

**Primary recommendation:** Build a single content script (`contentscripts/captchaSolverContentscript.js`) registered declaratively in `manifest.json` for `http://127.0.0.1/*`, with runtime URL filtering to only activate on CAPTCHA paths. Modify `Rc2Service.js` to stop closing CAPTCHA tabs and stop routing to `CaptchaNativeService`. Add `chrome.tabs.onRemoved` handler in the service worker for skip-on-close.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Web tab is the **sole CAPTCHA path** -- NOT a fallback. Native helper is abandoned.
- CAP-08 reinterpreted: there is only web tab mode (no native helper detection or dual-mode needed)
- Rc2Service's `handleRequest()` must stop closing the localhost CAPTCHA tab
- Extension-styled buttons (blue/white color scheme matching the extension's UI)
- Show hoster name in skip labels for context (e.g., "Skip rapidgator CAPTCHAs")
- All four skip types available: hoster, package, all, single
- 5-minute timeout, hardcoded (matches JDownloader's CAPTCHA timeout)
- Send skip(single) when 5-minute countdown expires
- Auto-close the CAPTCHA tab after a brief delay (~2 seconds) once token is submitted
- No success message on solve -- just close
- Use `chrome.tabs.onRemoved` listener to detect tab closure

### Claude's Discretion
- Skip button placement (above/below CAPTCHA, floating bar, etc.)
- Countdown format (mm:ss, text, progress bar)
- Countdown visual urgency styling
- Tab close skip type (hoster vs single)
- Content script injection strategy (static manifest vs dynamic chrome.scripting)
- Token polling implementation details

### Deferred Ideas (OUT OF SCOPE)
- Native helper removal/cleanup -- code can be removed in a future cleanup phase; not blocking web tab implementation
- CaptchaNativeService.js deprecation -- mark as unused but don't delete during this phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAP-01 | Content script injected on `http://127.0.0.1/*` detects JDownloader CAPTCHA pages via URL path pattern | Declarative manifest content_scripts entry with `http://127.0.0.1/*` match pattern; runtime URL filter in script checks `/captcha/(recaptchav2\|recaptchav3\|hcaptcha)/` path |
| CAP-02 | Content script polls `g-recaptcha-response` / `h-captcha-response` textarea for solved tokens (500ms interval) | ISOLATED world DOM polling; proven pattern from MV2 extension and 2Captcha/CapSolver extensions |
| CAP-03 | Solved token is relayed to service worker via `chrome.runtime.sendMessage` | Standard content script to service worker messaging; message format: `{action: 'captcha-solved', token, callbackUrl}` |
| CAP-04 | Service worker submits token to JDownloader callback URL via HTTP | Reuse existing `sendRc2SolutionToJd()` pattern: `XMLHttpRequest` GET to `callbackUrl + "&do=solve&response=" + token` |
| CAP-05 | Skip buttons (hoster/package/all/single) injected into CAPTCHA page via content script | DOM element creation with event listeners (no inline handlers); blue/white extension theme; hoster name in labels |
| CAP-06 | 5-minute timeout countdown displayed on CAPTCHA page; auto-skips on expiry | `setInterval` countdown in content script; sends skip(single) via `chrome.runtime.sendMessage` on expiry |
| CAP-07 | Closing the CAPTCHA tab triggers skip via `chrome.tabs.onRemoved` | Service worker tracks active CAPTCHA tabs; onRemoved sends skip HTTP request to JDownloader callback URL |
| CAP-08 | ~~Dual-mode~~ Reinterpreted: web tab is the sole CAPTCHA path | Remove CaptchaNativeService routing from Rc2Service.onNewCaptchaAvailable(); no dual-mode detection needed |
| CAP-09 | Rc2Service no longer closes JDownloader's CAPTCHA tab | Remove `chrome.tabs.remove(request.tabId)` call from `handleRequest()` |
| CAP-10 | Works with reCAPTCHA v2 (checkbox), reCAPTCHA v3 (invisible), and hCaptcha | Polling covers all types; reCAPTCHA v3 populates `g-recaptcha-response` textarea after `grecaptcha.execute()`; hCaptcha uses `h-captcha-response` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | MV3 | Content scripts, tabs, messaging | Core platform; already used throughout codebase |
| AngularJS | 1.8.3 | Service layer (Rc2Service, ExtensionMessagingService) | Existing framework; services modified in-place |
| Jest | 27.5.1 | Unit testing | Already configured in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest-chrome | 0.8.0 | Chrome API mocks | Testing content script messaging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static manifest content_scripts | Dynamic chrome.scripting.executeScript | Static is simpler, auto-injects on page load; dynamic gives more control but requires service worker to be awake |
| ISOLATED world polling | MAIN world callback hooking | ISOLATED polling is simpler and sufficient for token detection; MAIN world only needed if JDownloader page structure changes |
| MutationObserver | setInterval polling | MutationObserver is more elegant but textarea value changes may not trigger mutations; polling is proven and reliable |

## Architecture Patterns

### Recommended Project Structure
```
contentscripts/
  captchaSolverContentscript.js    # NEW: CAPTCHA page content script
scripts/services/
  Rc2Service.js                     # MODIFIED: remove native routing, stop closing tabs
  CaptchaNativeService.js           # UNCHANGED: mark as deprecated but don't delete
background.js                       # MODIFIED: add captcha message handlers + tab tracking
manifest.json                       # MODIFIED: add content_scripts entry
```

### Pattern 1: Content Script URL Detection and Activation
**What:** Content script injected on all `http://127.0.0.1/*` pages, but activates only on CAPTCHA URL paths
**When to use:** When a broad match pattern is needed but the script should only act on specific pages
**Example:**
```javascript
// contentscripts/captchaSolverContentscript.js
(function() {
  'use strict';

  // Only activate on CAPTCHA pages
  const captchaPathPattern = /\/captcha\/(recaptchav2|recaptchav3|hcaptcha)\//;
  if (!captchaPathPattern.test(window.location.pathname)) return;

  // Extract metadata from URL
  const pathParts = window.location.pathname.split('/');
  // URL format: /captcha/{type}/{siteDomain}?id={id}
  const captchaType = pathParts[2];  // recaptchav2, recaptchav3, hcaptcha
  const siteDomain = pathParts[3];   // hoster domain
  const captchaId = new URLSearchParams(window.location.search).get('id');
  const callbackUrl = window.location.href;

  // ... rest of content script
})();
```

### Pattern 2: Token Polling (ISOLATED World)
**What:** Poll DOM textareas for CAPTCHA solution tokens at 500ms interval
**When to use:** Detecting when user solves reCAPTCHA or hCaptcha
**Example:**
```javascript
// Source: MV2 extension pattern (rc2Contentscript.js ResultPoll) + 2Captcha extension pattern
function startTokenPolling(callbackUrl) {
  const POLL_INTERVAL = 500;
  const pollHandle = setInterval(function() {
    // reCAPTCHA v2/v3 stores token in textarea#g-recaptcha-response
    // Note: multiple textareas may exist; check all
    var textareas = document.querySelectorAll('textarea[id^="g-recaptcha-response"]');
    for (var i = 0; i < textareas.length; i++) {
      if (textareas[i].value && textareas[i].value.length > 30) {
        clearInterval(pollHandle);
        onTokenFound(textareas[i].value, callbackUrl);
        return;
      }
    }

    // hCaptcha stores token in textarea[name="h-captcha-response"]
    var hcTextareas = document.querySelectorAll('textarea[name="h-captcha-response"]');
    for (var j = 0; j < hcTextareas.length; j++) {
      if (hcTextareas[j].value && hcTextareas[j].value.length > 30) {
        clearInterval(pollHandle);
        onTokenFound(hcTextareas[j].value, callbackUrl);
        return;
      }
    }
  }, POLL_INTERVAL);

  return pollHandle;
}
```

### Pattern 3: Content Script to Service Worker Messaging
**What:** Send CAPTCHA events from content script to background service worker
**When to use:** Token solved, skip requested, tab detected
**Example:**
```javascript
// Content script sends to service worker
function onTokenFound(token, callbackUrl) {
  chrome.runtime.sendMessage({
    action: 'captcha-solved',
    data: {
      token: token,
      callbackUrl: callbackUrl
    }
  });
}

// Service worker receives and handles
// In background.js onMessage handler:
if (action === 'captcha-solved') {
  var callbackUrl = request.data.callbackUrl;
  var token = request.data.token;
  // Submit to JDownloader via HTTP GET
  var httpRequest = new XMLHttpRequest();
  httpRequest.open('GET', callbackUrl + '&do=solve&response=' + token, true);
  httpRequest.setRequestHeader('X-Myjd-Appkey', 'webextension-' + version);
  httpRequest.onload = function() {
    // Close the CAPTCHA tab after brief delay
    if (sender && sender.tab) {
      setTimeout(function() {
        chrome.tabs.remove(sender.tab.id);
      }, 2000);
    }
  };
  httpRequest.send();
  sendResponse({ status: 'ok' });
  return true;
}
```

### Pattern 4: Active CAPTCHA Tab Tracking
**What:** Service worker maintains a map of active CAPTCHA tab IDs to their callback URLs
**When to use:** Needed for skip-on-close (CAP-07) and dedup guard
**Example:**
```javascript
// Service worker (background.js)
let activeCaptchaTabs = {};

// When content script reports a CAPTCHA tab
if (action === 'captcha-tab-detected') {
  activeCaptchaTabs[sender.tab.id] = {
    callbackUrl: request.data.callbackUrl,
    captchaType: request.data.captchaType,
    hoster: request.data.hoster,
    detectedAt: Date.now()
  };
  sendResponse({ status: 'ok' });
  return true;
}

// When tab is removed -- send skip
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (activeCaptchaTabs[tabId]) {
    var info = activeCaptchaTabs[tabId];
    // Send skip to JDownloader
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', info.callbackUrl + '&do=skip&skiptype=hoster', true);
    httpRequest.setRequestHeader('X-Myjd-Appkey', 'webextension-' + version);
    httpRequest.send();
    delete activeCaptchaTabs[tabId];
  }
});
```

### Anti-Patterns to Avoid
- **Inline event handlers in injected HTML:** MV3 CSP prohibits `onclick="..."` in content scripts. Use `addEventListener()` instead.
- **MAIN world script for simple DOM reads:** The ISOLATED world can read `textarea.value` just fine. Only use MAIN world if you need to access page JavaScript objects like `grecaptcha`.
- **Relying on CaptchaNativeService for token submission:** The web tab flow must bypass native messaging entirely. Use direct HTTP from the service worker.
- **Polling without cleanup:** Always clear the polling interval on token found, skip, timeout, or tab unload to prevent memory leaks.
- **Hardcoding port 9666:** JDownloader's port is configurable. Use `window.location.port` in the content script and `http://127.0.0.1/*` (any port) in the match pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CAPTCHA rendering | Custom CAPTCHA HTML generation | JDownloader's built-in localhost page | JDownloader already renders functional CAPTCHA widgets via `browserCaptcha.js`; page works standalone |
| Token submission protocol | Custom HTTP callback format | Existing `callbackUrl + "&do=solve&response=" + token` pattern | Already proven in Rc2Service.sendRc2SolutionToJd() and CaptchaNativeService |
| Skip HTTP protocol | Custom skip format | Existing `callbackUrl + "&do=skip&skiptype=" + type` pattern | Already proven in Rc2Service.onSkipRequest() |
| Tab removal detection | Custom polling for closed tabs | `chrome.tabs.onRemoved` event API | Built-in Chrome API, already used in codebase (PopupCandidatesService, background.js) |
| Extension messaging format | New message protocol | Existing `{action, data}` pattern from background.js | Consistent with all other content script -> service worker messaging in the codebase |

**Key insight:** JDownloader's localhost page does all the heavy lifting (loading CAPTCHA scripts, rendering widgets, handling Google/hCaptcha domain verification). The content script is an enhancer, not a replacement.

## Common Pitfalls

### Pitfall 1: reCAPTCHA v3 Token Not Appearing in Textarea
**What goes wrong:** reCAPTCHA v3 is invisible. The token only appears after `grecaptcha.execute()` is called by the page's JavaScript. If JDownloader's `browserCaptcha.js` does not auto-execute v3, the textarea remains empty.
**Why it happens:** v3 has no user interaction -- it generates a score-based token programmatically. The page must call `grecaptcha.execute()` explicitly.
**How to avoid:** JDownloader's page should handle v3 execution via `browserCaptcha.js`. The content script polls the same `g-recaptcha-response` textarea -- v3 populates it identically to v2. If v3 tokens appear without user interaction, the content script will detect them within 500ms. Verify during testing that JDownloader's page auto-executes v3.
**Warning signs:** Polling runs for the full 5-minute timeout on v3 pages without finding a token.

### Pitfall 2: Multiple CAPTCHA Textareas
**What goes wrong:** Google may render multiple `g-recaptcha-response` textareas (one per widget instance). Using `getElementById` only finds the first one.
**Why it happens:** The reCAPTCHA API adds an ID like `g-recaptcha-response-100000` for additional instances.
**How to avoid:** Use `document.querySelectorAll('textarea[id^="g-recaptcha-response"]')` to find all matching textareas. Same for hCaptcha: `document.querySelectorAll('textarea[name="h-captcha-response"]')`.
**Warning signs:** Token detection fails on pages with multiple CAPTCHA widgets.

### Pitfall 3: Service Worker Terminated During CAPTCHA Solving
**What goes wrong:** Chrome terminates the service worker after 30 seconds of inactivity. If the user takes 3 minutes to solve a CAPTCHA, the service worker may not be running when the content script sends the solved token.
**Why it happens:** MV3 service workers have a short idle timeout. The keepAlive alarm (every 4 minutes) may not be sufficient.
**How to avoid:** `chrome.runtime.sendMessage()` from the content script will automatically wake the service worker. The `activeCaptchaTabs` map will be lost, but `chrome.tabs.onRemoved` listeners registered at the top level of the service worker survive restarts (Chrome re-registers them). For the solved token path, the content script includes the `callbackUrl` in its message, so the service worker doesn't need prior state.
**Warning signs:** Messages from content script fail with "Could not establish connection" errors.

### Pitfall 4: Callback URL Extraction
**What goes wrong:** The content script needs the JDownloader callback URL to send skip/solve requests, but it's not obvious how to extract it from the page.
**Why it happens:** JDownloader's CAPTCHA page URL IS the callback URL (e.g., `http://127.0.0.1:9666/captcha/recaptchav2/domain?id=123`). The `&do=solve&response=TOKEN` and `&do=skip&skiptype=TYPE` parameters are appended to this URL.
**How to avoid:** Use `window.location.href` as the base callback URL. The URL already contains the `?id=` parameter, so append with `&do=...`.
**Warning signs:** HTTP requests to JDownloader fail with 404 or unexpected responses.

### Pitfall 5: Content Script Injecting on Non-CAPTCHA Localhost Pages
**What goes wrong:** The match pattern `http://127.0.0.1/*` also matches JDownloader's other localhost endpoints (e.g., CNL flash/add pages, status pages).
**Why it happens:** Broad match pattern catches all localhost traffic.
**How to avoid:** First line of the content script must check `window.location.pathname` against the CAPTCHA URL pattern (`/captcha/(recaptchav2|recaptchav3|hcaptcha)/`). Exit immediately if no match.
**Warning signs:** Unexpected DOM modifications on non-CAPTCHA localhost pages.

### Pitfall 6: Race Between JDownloader's Own Token Submission and Extension's
**What goes wrong:** JDownloader's `browserCaptcha.js` may submit the solved token via its own XMLHttpRequest. The extension's content script also detects the token and tells the service worker to submit. Double submission occurs.
**Why it happens:** Both the page's JS and the extension independently detect the token.
**How to avoid:** This is benign -- JDownloader accepts the first valid token and ignores duplicates. The extension's primary role after detecting the token is closing the tab. However, the extension should still send the token to confirm the flow works even if `browserCaptcha.js` is not present or fails.
**Warning signs:** Console logs show two solve requests to the same callback URL. This is harmless.

### Pitfall 7: Tab Removed Before Content Script Fully Loads
**What goes wrong:** If the tab is removed very quickly (before `document_end`), the content script never registers, and the `captcha-tab-detected` message is never sent. The service worker's `onRemoved` handler has no entry in `activeCaptchaTabs` for this tab.
**Why it happens:** User closes tab immediately, or page navigation fails.
**How to avoid:** Also listen for CAPTCHA tabs in `Rc2Service.handleRequest()` -- when a tab matching the CAPTCHA URL pattern is detected via `chrome.tabs.onUpdated`, register it in `activeCaptchaTabs` immediately (don't wait for the content script).
**Warning signs:** Skip-on-close doesn't fire for quickly-closed tabs.

## Code Examples

### Content Script: CAPTCHA Page Detection and UI Injection
```javascript
// Source: project pattern from webinterfaceEnhancer.js + research validation document
(function() {
  'use strict';

  var captchaPathPattern = /\/captcha\/(recaptchav2|recaptchav3|hcaptcha)\//;
  if (!captchaPathPattern.test(window.location.pathname)) return;

  var pathParts = window.location.pathname.split('/');
  var captchaType = pathParts[2];
  var hoster = decodeURIComponent(pathParts[3] || 'Unknown');
  var captchaId = new URLSearchParams(window.location.search).get('id');
  var callbackUrl = window.location.href;

  // Notify service worker this tab is a CAPTCHA tab
  chrome.runtime.sendMessage({
    action: 'captcha-tab-detected',
    data: {
      callbackUrl: callbackUrl,
      captchaType: captchaType,
      hoster: hoster,
      captchaId: captchaId
    }
  });

  // Inject skip buttons
  injectSkipButtons(callbackUrl, hoster);

  // Start token polling
  startTokenPolling(callbackUrl);

  // Start countdown timer
  startCountdown(callbackUrl);
})();
```

### Content Script: Skip Button Injection (Extension-Themed)
```javascript
function injectSkipButtons(callbackUrl, hoster) {
  var container = document.createElement('div');
  container.id = 'myjd-captcha-controls';
  // Use inline styles since content scripts can inject styles safely
  container.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:16px auto;max-width:500px;';

  var buttons = [
    { type: 'hoster', label: 'Skip ' + hoster + ' CAPTCHAs', primary: false },
    { type: 'package', label: 'Skip Package', primary: false },
    { type: 'all', label: 'Skip All', primary: false },
    { type: 'single', label: 'Skip This', primary: false }
  ];

  buttons.forEach(function(btn) {
    var el = document.createElement('button');
    el.textContent = btn.label;
    el.dataset.skipType = btn.type;
    el.style.cssText = 'padding:8px 16px;border:1px solid #2196F3;border-radius:4px;' +
      'background:#fff;color:#2196F3;cursor:pointer;font-size:13px;';
    container.appendChild(el);
  });

  container.addEventListener('click', function(e) {
    var skipType = e.target.dataset.skipType;
    if (skipType) {
      chrome.runtime.sendMessage({
        action: 'captcha-skip',
        data: { callbackUrl: callbackUrl, skipType: skipType }
      });
    }
  });

  document.body.appendChild(container);
}
```

### Content Script: Countdown Timer
```javascript
function startCountdown(callbackUrl) {
  var TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  var startTime = Date.now();

  var timerEl = document.createElement('div');
  timerEl.id = 'myjd-countdown';
  timerEl.style.cssText = 'text-align:center;margin:12px auto;font-size:14px;color:#666;';
  document.body.appendChild(timerEl);

  var timerHandle = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var remaining = Math.max(0, TIMEOUT_MS - elapsed);
    var minutes = Math.floor(remaining / 60000);
    var seconds = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = 'Time remaining: ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

    // Visual urgency under 1 minute
    if (remaining < 60000) {
      timerEl.style.color = '#f44336';
      timerEl.style.fontWeight = 'bold';
    }

    if (remaining <= 0) {
      clearInterval(timerHandle);
      timerEl.textContent = 'Timed out - skipping...';
      chrome.runtime.sendMessage({
        action: 'captcha-skip',
        data: { callbackUrl: callbackUrl, skipType: 'single' }
      });
    }
  }, 1000);

  return timerHandle;
}
```

### Manifest Entry for Content Script
```json
{
  "content_scripts": [
    {
      "matches": ["http://127.0.0.1/*"],
      "js": ["contentscripts/captchaSolverContentscript.js"],
      "run_at": "document_end",
      "all_frames": false
    }
  ]
}
```

### Service Worker: CAPTCHA Message Handlers (background.js additions)
```javascript
// Track active CAPTCHA tabs for skip-on-close
let activeCaptchaTabs = {};

// In the onMessage listener:
if (action === 'captcha-tab-detected') {
  activeCaptchaTabs[sender.tab.id] = {
    callbackUrl: request.data.callbackUrl,
    captchaType: request.data.captchaType,
    hoster: request.data.hoster,
    detectedAt: Date.now()
  };
  sendResponse({ status: 'ok' });
  return true;
}

if (action === 'captcha-solved') {
  // Remove from active tabs
  if (sender.tab) delete activeCaptchaTabs[sender.tab.id];
  // Submit token to JDownloader
  var httpRequest = new XMLHttpRequest();
  httpRequest.open('GET', request.data.callbackUrl + '&do=solve&response=' + request.data.token, true);
  httpRequest.setRequestHeader('X-Myjd-Appkey', 'webextension-' + chrome.runtime.getManifest().version);
  httpRequest.onload = function() {
    if (sender.tab) {
      setTimeout(function() { chrome.tabs.remove(sender.tab.id); }, 2000);
    }
  };
  httpRequest.send();
  sendResponse({ status: 'ok' });
  return true;
}

if (action === 'captcha-skip') {
  // Remove from active tabs
  if (sender.tab) delete activeCaptchaTabs[sender.tab.id];
  // Send skip to JDownloader
  var httpRequest = new XMLHttpRequest();
  httpRequest.open('GET', request.data.callbackUrl + '&do=skip&skiptype=' + request.data.skipType, true);
  httpRequest.setRequestHeader('X-Myjd-Appkey', 'webextension-' + chrome.runtime.getManifest().version);
  httpRequest.onload = function() {
    if (sender.tab) {
      setTimeout(function() { chrome.tabs.remove(sender.tab.id); }, 2000);
    }
  };
  httpRequest.send();
  sendResponse({ status: 'ok' });
  return true;
}

// Tab close handler for skip
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (activeCaptchaTabs[tabId]) {
    var info = activeCaptchaTabs[tabId];
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', info.callbackUrl + '&do=skip&skiptype=hoster', true);
    httpRequest.setRequestHeader('X-Myjd-Appkey', 'webextension-' + chrome.runtime.getManifest().version);
    httpRequest.send();
    delete activeCaptchaTabs[tabId];
  }
});
```

### Rc2Service.js Modifications
```javascript
// BEFORE (current code, line 42-51):
function handleRequest(request) {
  if (request.url.match(/http:\/\/127\.0\.0\.1:\d+\/captcha\/(recaptchav(2|3)|hcaptcha)\/.*\?id=\d+$/gm) !== null) {
    chrome.tabs.remove(request.tabId, function() { ... });
  }
}

// AFTER (web tab mode -- do NOT close the tab):
function handleRequest(request) {
  if (request.url.match(/http:\/\/127\.0\.0\.1:\d+\/captcha\/(recaptchav(2|3)|hcaptcha)\/.*\?id=\d+$/gm) !== null) {
    // Web tab mode: let the CAPTCHA page stay open
    // Content script will handle token detection, skip buttons, and tab lifecycle
    console.log('Rc2Service: CAPTCHA tab detected, letting content script handle:', request.url);
  }
}

// BEFORE (onNewCaptchaAvailable, line 253):
CaptchaNativeService.sendCaptcha(captchaJob).then(...).catch(...)

// AFTER: Remove CaptchaNativeService routing entirely.
// The content script on the CAPTCHA tab handles everything.
// onNewCaptchaAvailable is only needed for MYJD web interface flow.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `<script>` injection (MV2 CSP) | MAIN world scripts via `world: "MAIN"` | Chrome MV3 (2022+) | Content scripts can access page JS objects without CSP violations |
| `chrome.extension.isAllowedIncognitoAccess` | `chrome.runtime.isAllowedIncognitoAccess` | MV3 migration | Already handled in Rc2Service |
| Background pages (always-on) | Service workers (ephemeral) | MV3 | Must handle service worker termination; listeners registered at top level survive restarts |
| `browserSolverEnhancer.js` + `rc2Contentscript.js` (MV2) | `captchaSolverContentscript.js` (MV3) | This phase | Single content script replaces two MV2 scripts; no inline JS needed |
| Native messaging to WebView2 binary | Web tab with content script polling | This phase | Cross-platform, zero installation, simpler maintenance |

**Deprecated/outdated:**
- `CaptchaNativeService.js`: Will be deprecated by this phase (mark as unused, don't delete)
- `captcha-helper/` directory: Native Rust binary no longer used as CAPTCHA path; cleanup deferred
- `browserSolverEnhancer.js`, `rc2Contentscript.js`, `browser_solver_template.html`: Already removed in prior MV3 migration

## Open Questions

1. **Does JDownloader's `browserCaptcha.js` auto-execute reCAPTCHA v3?**
   - What we know: JDownloader's `browserCaptcha.js` handles reCAPTCHA rendering. v3 requires `grecaptcha.execute()` to be called.
   - What's unclear: Whether `browserCaptcha.js` calls `execute()` automatically for v3 challenges or if it renders an "I'm not a robot" button.
   - Recommendation: Test manually. If v3 auto-executes, the content script just polls. If not, the content script may need to click a button or inject a MAIN world script to call `grecaptcha.execute()`. The native helper's `html.rs` shows it handles v3 by rendering an invisible button that calls `executeCaptcha()` -- JDownloader's own page likely does something similar.

2. **Does JDownloader's page submit tokens via its own XHR?**
   - What we know: The `browserCaptcha.js` script includes built-in token submission. The page IS designed to work standalone.
   - What's unclear: Whether the extension should also submit the token (resulting in a benign double-submit) or defer entirely to the page's own submission.
   - Recommendation: The extension should always submit the token as well. This ensures the flow works even if `browserCaptcha.js` fails. JDownloader ignores duplicate token submissions.

3. **Service worker `activeCaptchaTabs` state loss on termination**
   - What we know: `activeCaptchaTabs` is an in-memory object that is lost when the service worker terminates.
   - What's unclear: Whether to persist it to `chrome.storage.session`.
   - Recommendation: Do NOT persist. The content script includes `callbackUrl` in every message, so the service worker doesn't need prior state for the solve/skip paths. For skip-on-close, the `chrome.tabs.onRemoved` handler can fall back to querying for CAPTCHA tabs if `activeCaptchaTabs` is empty. Alternatively, `handleRequest()` in Rc2Service also sees CAPTCHA tabs and could register them via a message to background.js.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 with jsdom |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern=__tests__ -x` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | Content script detects CAPTCHA URL pattern | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | No -- Wave 0 |
| CAP-02 | Token polling finds g-recaptcha-response / h-captcha-response | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | No -- Wave 0 |
| CAP-03 | Token relayed to service worker via chrome.runtime.sendMessage | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | No -- Wave 0 |
| CAP-04 | Service worker submits token to JDownloader callback URL | unit | `npx jest __tests__/background.test.js -x` | No -- Wave 0 |
| CAP-05 | Skip buttons injected with correct labels and handlers | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | No -- Wave 0 |
| CAP-06 | Countdown timer expires and sends skip(single) | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | No -- Wave 0 |
| CAP-07 | Tab close triggers skip via chrome.tabs.onRemoved | unit | `npx jest __tests__/background.test.js -x` | No -- Wave 0 |
| CAP-08 | No dual-mode detection; native routing removed | unit (structural) | `npx jest __tests__/Rc2Service.test.js -x` | Yes (needs update) |
| CAP-09 | handleRequest() no longer closes CAPTCHA tab | unit (structural) | `npx jest __tests__/Rc2Service.test.js -x` | Yes (needs update) |
| CAP-10 | Works with reCAPTCHA v2, v3, hCaptcha | manual-only | Manual E2E test with JDownloader | N/A (Phase 5) |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=__tests__ -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/services/__tests__/captchaSolverContentscript.test.js` -- covers CAP-01, CAP-02, CAP-03, CAP-05, CAP-06 (source-level structural tests matching project pattern)
- [ ] `scripts/services/__tests__/background-captcha.test.js` -- covers CAP-04, CAP-07 (service worker captcha message handlers)
- [ ] Update `scripts/services/__tests__/Rc2Service.test.js` -- covers CAP-08, CAP-09 (structural verification that native routing is removed and tabs not closed)

## Sources

### Primary (HIGH confidence)
- Project source code: `Rc2Service.js`, `CaptchaNativeService.js`, `background.js`, `manifest.json`, `webinterfaceEnhancer.js` -- current implementation patterns
- Project research: `.planning/research/WEB-TAB-CAPTCHA-VALIDATION.md` -- detailed technical validation of web tab approach
- Native helper `html.rs` -- shows CAPTCHA HTML structure, skip buttons, v3 handling patterns
- [Content Scripts - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- MV3 content script capabilities, ISOLATED vs MAIN world
- [Match Patterns - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) -- `http://127.0.0.1/*` pattern support confirmed
- [Manifest content_scripts - Chrome Developers](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- Declarative registration with `world` property
- [reCAPTCHA v3 - Google Developers](https://developers.google.com/recaptcha/docs/v3) -- v3 token via `grecaptcha.execute()`, populates `g-recaptcha-response`

### Secondary (MEDIUM confidence)
- [2Captcha Solver extension](https://github.com/rucaptcha/2captcha-solver) -- MV3 content script pattern for CAPTCHA interaction, confirms approach viability
- [tabs.onRemoved - MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onRemoved) -- Tab removal event API
- JDownloader source (GitHub mirror) -- `recaptcha.html` template structure with meta tags, `browserCaptcha.js` behavior

### Tertiary (LOW confidence)
- reCAPTCHA v3 textarea element naming (`g-recaptcha-response-data-100000`) -- confirmed by Google docs but may vary by version; polling with `querySelectorAll` prefix match handles this

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All APIs already used in codebase; no new dependencies needed
- Architecture: HIGH -- Content script pattern well-established in project; polling proven by MV2 extension and third-party extensions
- Pitfalls: HIGH -- Identified from MV2 codebase analysis, Chrome MV3 service worker behavior, and reCAPTCHA DOM structure
- Token detection: HIGH -- `g-recaptcha-response` textarea is a stable reCAPTCHA API contract; `h-captcha-response` similarly stable
- v3 invisible handling: MEDIUM -- JDownloader's `browserCaptcha.js` likely handles it, but needs manual verification

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable APIs, no fast-moving dependencies)
