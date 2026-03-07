# Phase 4: Web Tab CAPTCHA - Research

**Researched:** 2026-03-07 (reevaluated for dual-flow architecture: localhost + MYJD remote)
**Domain:** Chrome Extension MV3 content scripts, CAPTCHA rendering, declarativeNetRequest CSP stripping, MyJDownloader cloud API, dual-flow CAPTCHA architecture
**Confidence:** HIGH

## Summary

This phase implements CAPTCHA solving via browser tabs using two distinct flows. **Flow A (Localhost)** enhances JDownloader's own CAPTCHA page at `http://127.0.0.1:PORT/captcha/...` with skip buttons, countdown timer, token polling, and JD protocol callbacks (canClose, loaded, mouse-move). **Flow B (MYJD Remote)** is the critical path for users whose JDownloader runs on a NAS/server -- when a CAPTCHA triggers on `my.jdownloader.org`, the extension queries the MYJD API for job details, navigates a new tab to the target domain, and a content script at `document_start` replaces the page DOM to render the CAPTCHA widget MV3-compliantly (no inline scripts).

Plans 04-01 and 04-02 were previously executed covering only Flow A. They must be **replanned from scratch** to incorporate Flow B and ensure both flows share common patterns (skip UI, countdown, token polling) while diverging on their plumbing (HTTP callbacks vs MYJD cloud API, content script injection vs JD-rendered page, CSP handling).

The existing codebase already contains substantial infrastructure for the MYJD flow in `Rc2Service.js` (lines 297-331: `chrome.tabs.onUpdated` listener for `#rc2jdt` detection, `/captcha/getCaptchaJob` + `/captcha/get` API calls, `onWebInterfaceCaptchaJobFound()`). The old MV2 `rc2Contentscript.js` demonstrates the DOM replacement pattern using `document.open()`/`document.close()` and external `<script>` element injection -- this pattern is MV3-compatible when combined with `declarativeNetRequest` CSP header stripping. For invisible/v3 CAPTCHA execution, `chrome.scripting.executeScript({world: 'MAIN'})` is the MV3-compliant replacement for inline `<script>` elements.

**Primary recommendation:** Implement three content scripts (captchaSolverContentscript.js for localhost, myjdCaptchaSolver.js for MYJD remote, webinterfaceEnhancer.js extended for CAPTCHA trigger detection) with a shared UI pattern, coordinated through the service worker via `chrome.storage.session` for job data passing and `declarativeNetRequest` session rules for per-tab CSP stripping.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Web tab is the **sole CAPTCHA path** -- native helper is abandoned
- No dual-mode detection needed
- Rc2Service's `handleRequest()` must stop closing the localhost CAPTCHA tab
- **Two distinct CAPTCHA flows:**
  - Flow A: Localhost (JD running locally) -- content script enhances JD's own page
  - Flow B: MyJD Remote (JD on NAS/server) -- content script renders widget on target domain
- **Three content scripts:**
  1. `captchaSolverContentscript.js` -- localhost flow, `document_end`, `*://*/*`
  2. `myjdCaptchaSolver.js` -- MYJD flow, `document_start`, `*://*/*` (exits if no `#rc2jdt` hash)
  3. `webinterfaceEnhancer.js` -- detects CAPTCHA triggers on `my.jdownloader.org`
- All registered statically in `manifest.json`
- MYJD solver receives CAPTCHA job details via `chrome.storage.session`
- MYJD CAPTCHA rendering: navigate to target domain, `document.open()`/`document.close()` DOM replacement, external `<script>` elements only (no inline JS)
- `chrome.scripting.executeScript({world: 'MAIN'})` for reCAPTCHA v3/invisible and hCaptcha execute
- `declarativeNetRequest` rules to strip CSP headers on MYJD CAPTCHA tabs
- JD Protocol Callbacks (localhost only): `loaded` event, `canClose` polling (1s), mouse-move reporting (3s throttle)
- Content script makes HTTP GETs directly for canClose/loaded/mouse-move (not via service worker)
- `X-Myjd-Appkey: webextension-{version}` header on all localhost callbacks
- Extension-styled skip buttons (blue/white), all four types, hoster name in labels
- 5-minute timeout hardcoded, auto-skip(single) on expiry
- Tab close sends skip, auto-close after solve (~2 seconds, no success message)
- canClose=true means immediate tab close (no delay, no message)
- If not connected to MyJD: redirect to `loginNeeded.html`
- MYJD flow token submitted via myjdDeviceClientFactory `/captcha/solve` API

### Claude's Discretion
- Skip button placement
- Countdown format and urgency styling
- Tab close skip type (hoster vs single)
- Content script injection details for MYJD flow
- Token polling implementation details
- `loaded` event element detection strategy (find CAPTCHA iframe by known selectors)

### Deferred Ideas (OUT OF SCOPE)
- Native helper removal/cleanup -- code can be removed in a future cleanup phase
- CaptchaNativeService.js deprecation -- mark as unused but don't delete during this phase
- Incognito/privacy CAPTCHA mode -- disabled even in MV2; out of scope
- MYJD skip via API (`/captcha/skip`) -- old extension had TODO for this; consider in Phase 5 testing
- Window cleanup on tab close (remove empty windows) -- old extension's `close-me` handler did this; minor UX improvement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAP-01 | Content script on `http://127.0.0.1/*` detects CAPTCHA pages via URL path | Existing `captchaSolverContentscript.js` handles this; needs JD protocol callbacks added |
| CAP-02 | Polls `g-recaptcha-response` / `h-captcha-response` textarea (500ms) | Shared polling pattern between Flow A and Flow B; ISOLATED world DOM access sufficient |
| CAP-03 | Solved token relayed to service worker via `chrome.runtime.sendMessage` | Standard messaging pattern; Flow A sends `captcha-solved` with callbackUrl, Flow B sends with `captchaId` + `callbackUrl: "MYJD"` |
| CAP-04 | Service worker submits token to JDownloader callback URL via HTTP | Flow A: HTTP GET to `callbackUrl + "&do=solve&response=TOKEN"`. Flow B: via `myjdDeviceClientFactory.sendRequest("/captcha/solve", ...)` through MyJD cloud API |
| CAP-05 | Skip buttons (hoster/package/all/single) injected via content script | Shared UI component across both flows; extension-themed blue/white; event delegation |
| CAP-06 | 5-minute countdown with auto-skip(single) on expiry | Shared between both flows; `setInterval` timer in content script |
| CAP-07 | Tab close triggers skip via `chrome.tabs.onRemoved` | Flow A: HTTP skip to callbackUrl. Flow B: MYJD `tab-closed` message to webinterfaceEnhancer (existing pattern in Rc2Service `tabmode-init` listener) |
| CAP-08 | ~~Dual-mode~~ Web tab is sole CAPTCHA path | Remove native helper routing; CaptchaNativeService unused |
| CAP-09 | Rc2Service no longer closes CAPTCHA tab | Already implemented in current code |
| CAP-10 | Works with reCAPTCHA v2, v3, hCaptcha | Flow A: JD renders widget, content script polls. Flow B: content script renders widget via external scripts + `chrome.scripting.executeScript({world: 'MAIN'})` for invisible/v3 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | MV3 | Content scripts, tabs, messaging, scripting, declarativeNetRequest, storage.session | Core platform; already used throughout codebase |
| AngularJS | 1.8.3 | Service layer (Rc2Service, myjdDeviceClientFactory, ExtensionMessagingService) | Existing framework; MYJD flow leverages existing API client infrastructure |
| Jest | 27.5.1 | Unit testing | Already configured in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest-chrome | 0.8.0 | Chrome API mocks | Testing content script messaging, declarativeNetRequest rules |
| reCAPTCHA JS API | 3.x | CAPTCHA widget rendering | Flow B only -- loaded as external `<script>` from `google.com/recaptcha/api.js` |
| hCaptcha JS API | 1.x | CAPTCHA widget rendering | Flow B only -- loaded as external `<script>` from `hcaptcha.com/1/api.js` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `declarativeNetRequest` CSP stripping | Page-level meta CSP override | Cannot control meta tags from content scripts; header stripping is cleaner and more reliable |
| `chrome.storage.session` for job data | URL hash parameters | Hash already used for `#rc2jdt` trigger; session storage supports structured data without URL encoding issues |
| `document.open()`/`document.close()` | DOM element clearing | `document.open()` is what the old MV2 extension used; fully replaces document including any CSP meta tags; proven pattern |
| `chrome.scripting.executeScript({world: 'MAIN'})` | `<script>` element with `src` to web_accessible_resource | MAIN world `func` injection is more surgical, avoids web_accessible_resources exposure, no file to maintain |

## Architecture Patterns

### Recommended Project Structure
```
contentscripts/
  captchaSolverContentscript.js    # Flow A: enhance JD localhost page (MODIFIED: add protocol callbacks)
  myjdCaptchaSolver.js             # NEW: Flow B: render CAPTCHA on target domain
  webinterfaceEnhancer.js          # MODIFIED: detect CAPTCHA triggers on my.jdownloader.org
scripts/services/
  Rc2Service.js                    # MODIFIED: MYJD flow orchestration, solution routing
  CaptchaNativeService.js          # UNCHANGED: mark as deprecated
background.js                      # MODIFIED: MYJD CAPTCHA handlers, declarativeNetRequest CSP rules, storage.session job data
manifest.json                      # MODIFIED: add myjdCaptchaSolver entry, declarativeNetRequest permission (already have it)
loginNeeded.html                   # NEW: simple "please log in" page for unauthenticated MYJD flow
```

### Pattern 1: Flow A -- Localhost CAPTCHA Enhancement
**What:** Content script on JD's localhost CAPTCHA page adds UI enhancements and protocol callbacks
**When to use:** JDownloader running locally, opens `http://127.0.0.1:PORT/captcha/...`
**Key behavior:**
- JD renders the CAPTCHA widget; content script enhances the page
- Token polling (500ms) for `g-recaptcha-response` / `h-captcha-response`
- Skip buttons, countdown timer
- JD protocol callbacks (direct HTTP GETs from content script):
  - `loaded` event: sends window geometry after CAPTCHA widget renders
  - `canClose` polling: checks every 1s if CAPTCHA solved elsewhere
  - Mouse-move reporting: throttled to 3s, reports user activity
- Token submitted via service worker HTTP GET to callbackUrl

**Example -- canClose polling (direct from content script):**
```javascript
// Content script makes HTTP GETs directly -- fully MV3 compliant
// (content scripts on http://127.0.0.1 can make XHR to same origin)
var canCloseHandle = setInterval(function() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', callbackUrl + '&do=canClose', true);
    xhr.setRequestHeader('X-Myjd-Appkey', 'webextension-' + chrome.runtime.getManifest().version);
    xhr.timeout = 5000;
    xhr.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            if (xhr.response === 'true') {
                clearInterval(canCloseHandle);
                window.close(); // or just close tab
            }
        }
    };
    xhr.send();
}, 1000);
```

**Example -- loaded event (direct from content script):**
```javascript
// Find CAPTCHA widget element and report dimensions
function sendLoadedEvent() {
    var element = document.querySelector(
        'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha'
    );
    if (!element) return;
    var bounds = element.getBoundingClientRect();
    var params = 'x=' + (window.screenX || window.screenLeft)
        + '&y=' + (window.screenY || window.screenTop)
        + '&w=' + window.outerWidth + '&h=' + window.outerHeight
        + '&vw=' + window.innerWidth + '&vh=' + window.innerHeight
        + '&eleft=' + bounds.left + '&etop=' + bounds.top
        + '&ew=' + bounds.width + '&eh=' + bounds.height
        + '&dpi=' + window.devicePixelRatio;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', callbackUrl + '&do=loaded&' + params, true);
    xhr.setRequestHeader('X-Myjd-Appkey', 'webextension-' + chrome.runtime.getManifest().version);
    xhr.timeout = 5000;
    xhr.send();
}
```

### Pattern 2: Flow B -- MYJD Remote CAPTCHA Rendering
**What:** When user triggers CAPTCHA via MYJD web interface, extension creates a new tab on the target domain and renders the CAPTCHA widget MV3-compliantly
**When to use:** JDownloader running on NAS/server, user on `my.jdownloader.org`

**Complete flow:**
1. User on `my.jdownloader.org` triggers CAPTCHA (hash `#rc2jdt&c={captchaId}`)
2. `Rc2Service.js` `chrome.tabs.onUpdated` handler detects the hash (already implemented in current code, lines 297-331)
3. Rc2Service queries MYJD API: `/captcha/getCaptchaJob` then `/captcha/get` for job details
4. Service worker writes job details to `chrome.storage.session` (key: `myjd_captcha_job`)
5. Service worker adds `declarativeNetRequest` session rule to strip CSP for the target tab
6. Service worker navigates tab to `targetDomain#rc2jdt`
7. `myjdCaptchaSolver.js` content script (registered at `document_start`, matches `*://*/*`) detects `#rc2jdt` hash
8. Content script calls `document.open()`/`document.close()` to replace page DOM
9. Content script reads job details from `chrome.storage.session`
10. Content script creates external `<script>` elements for reCAPTCHA/hCaptcha API
11. For invisible/v3: service worker calls `chrome.scripting.executeScript({world: 'MAIN', func: ...})` to execute `grecaptcha.execute()`
12. Token detected via polling, submitted via `myjdDeviceClientFactory.sendRequest("/captcha/solve", ...)`
13. Tab auto-closes after 2 seconds

**Example -- service worker prepares MYJD CAPTCHA tab:**
```javascript
// In Rc2Service.onWebInterfaceCaptchaJobFound or background.js MYJD handler:
async function prepareMyjdCaptchaTab(tabId, captchaData, captchaJob) {
    var jobDetails = {
        captchaId: captchaData.id,
        captchaType: captchaData.challengeType || captchaData.type,
        hoster: captchaData.hoster,
        siteKey: captchaJob.siteKey,
        siteKeyType: captchaJob.type, // "NORMAL" or "INVISIBLE"
        v3action: captchaJob.v3Action,
        targetUrl: captchaJob.siteUrl || captchaJob.contextUrl,
        callbackUrl: 'MYJD'
    };

    // 1. Store job details in session storage
    await chrome.storage.session.set({ myjd_captcha_job: jobDetails });

    // 2. Add CSP stripping rule for this tab
    await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
            id: 10000 + tabId, // unique rule ID per tab
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'Content-Security-Policy', operation: 'remove' },
                    { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
                    { header: 'X-Content-Security-Policy', operation: 'remove' }
                ]
            },
            condition: {
                tabIds: [tabId],
                resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest']
            }
        }]
    });

    // 3. Navigate to target domain
    chrome.tabs.update(tabId, { url: jobDetails.targetUrl + '#rc2jdt' });
}
```

**Example -- myjdCaptchaSolver.js DOM replacement approach:**
```javascript
(function() {
'use strict';

// Exit immediately if not a CAPTCHA trigger
if (!location.hash.startsWith('#rc2jdt')) return;

// Replace entire page DOM using document.open/close pattern
// (proven by old MV2 rc2Contentscript.js)
try {
    document.open();
    // Insert minimal placeholder HTML via document.open/close
    var placeholderHtml = '<html><head><title>JDownloader CAPTCHA</title></head>'
        + '<body style="margin:0;padding:32px;background:#3c686f;color:#fff;">'
        + 'Loading CAPTCHA solver...</body></html>';
    document.close();
    // Then rebuild DOM using createElement/appendChild
} catch (e) {
    console.error('myjdCaptchaSolver: DOM replacement failed', e);
}

// Read job details from session storage
chrome.storage.session.get('myjd_captcha_job', function(result) {
    var job = result.myjd_captcha_job;
    if (!job) {
        document.body.textContent = 'Error: No CAPTCHA job found';
        return;
    }
    renderCaptchaWidget(job);
});

function renderCaptchaWidget(job) {
    // Clear and rebuild DOM using createElement (no inline scripts)
    while (document.head.firstChild) document.head.removeChild(document.head.firstChild);
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);

    var title = document.createElement('title');
    title.textContent = 'CAPTCHA - ' + (job.hoster || 'JDownloader');
    document.head.appendChild(title);

    var container = document.createElement('div');
    container.id = 'captchaContainer';
    document.body.appendChild(container);

    if (job.captchaType === 'HCaptchaChallenge' || job.captchaType === 'hcaptcha') {
        var div = document.createElement('div');
        div.className = 'h-captcha';
        div.setAttribute('data-sitekey', job.siteKey);
        container.appendChild(div);

        var script = document.createElement('script');
        script.src = 'https://hcaptcha.com/1/api.js';
        document.head.appendChild(script);
    } else {
        // reCAPTCHA (v2, v3, enterprise)
        var div = document.createElement('div');
        div.className = 'g-recaptcha';
        div.setAttribute('data-sitekey', job.siteKey);
        if (job.siteKeyType === 'INVISIBLE') {
            div.setAttribute('data-size', 'invisible');
        }
        container.appendChild(div);

        var script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        document.head.appendChild(script);
    }

    // Start token polling, skip buttons, countdown
    startTokenPolling(job);
    injectSkipButtons(job);
    startCountdown(job);
}
})();
```

### Pattern 3: chrome.storage.session for Job Data Passing
**What:** Service worker writes CAPTCHA job details to session storage; content script reads them
**When to use:** Flow B -- passing structured data from service worker to content script that runs on a different domain
**Why this approach:** `chrome.storage.session` requires `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` to be accessible from content scripts. This must be called once at service worker startup. Session storage is transient (cleared on browser restart), which is appropriate for in-flight CAPTCHA jobs.

**Critical setup (required at service worker startup):**
```javascript
// In background.js, at top level:
chrome.storage.session.setAccessLevel({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
});
```

**Quota:** 10 MB (more than sufficient for CAPTCHA job data which is less than 1KB).

### Pattern 4: declarativeNetRequest Session Rules for Per-Tab CSP Stripping
**What:** Dynamically add/remove CSP header stripping rules scoped to specific tabs
**When to use:** Flow B only -- target domain may have CSP that blocks Google/Cloudflare reCAPTCHA/hCaptcha scripts
**Key details:**
- Session rules support `tabIds` condition (confirmed in Chrome docs) -- this is surgical, not global
- Maximum 5,000 session rules (far more than needed)
- Rules added before tab navigation, cleaned up after CAPTCHA completion
- Must remove `Content-Security-Policy`, `Content-Security-Policy-Report-Only`, and `X-Content-Security-Policy` headers
- Rule ID strategy: `10000 + tabId` for uniqueness

### Pattern 5: chrome.scripting.executeScript for Invisible CAPTCHA Execution
**What:** Execute `grecaptcha.execute()` or `hcaptcha.execute()` in the page's MAIN world
**When to use:** Flow B with invisible/v3 reCAPTCHA or invisible hCaptcha
**Why needed:** These APIs exist on the page's `window` object, not accessible from ISOLATED world
**Key constraint:** MAIN world scripts are subject to the page's CSP. Since we strip CSP headers via declarativeNetRequest AND replace the page via `document.open()` (which removes meta CSP), this is not an issue.

```javascript
// Service worker calls this after reCAPTCHA script loads on the target tab
chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    func: function(siteKey, v3action) {
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.ready(function() {
                var opts = { action: 'login' };
                try { opts = JSON.parse(v3action); } catch(e) {}
                grecaptcha.execute(siteKey, opts).then(function(token) {
                    var el = document.getElementById('g-recaptcha-response');
                    if (el) el.value = token;
                });
            });
        }
    },
    args: [job.siteKey, job.v3action || '']
});
```

### Pattern 6: webinterfaceEnhancer.js CAPTCHA Trigger Detection
**What:** Detect CAPTCHA triggers on `my.jdownloader.org` and forward to service worker
**Current state:** The existing `webinterfaceEnhancer.js` handles ping/pong and routes `myjdrc2` messages. The MYJD CAPTCHA detection is currently handled in `Rc2Service.js` via `chrome.tabs.onUpdated` -- this runs in the offscreen/popup context, not the service worker.
**Problem:** `Rc2Service.js` runs in AngularJS context (offscreen document), which means it may not be alive when the MYJD web interface triggers a CAPTCHA.
**Solution:** Move the `#rc2jdt&c=` detection to `background.js` service worker (via `chrome.tabs.onUpdated` listener at top level). This ensures it fires even when the popup/offscreen doc is closed.

### Anti-Patterns to Avoid
- **Inline `<script>` elements in DOM replacement:** MV3 CSP blocks inline scripts even with CSP headers stripped (if the extension's own CSP applies). Use external `<script src="...">` elements only. For programmatic execution, use `chrome.scripting.executeScript({world: 'MAIN'})`.
- **Global CSP stripping:** Use `tabIds` condition on declarativeNetRequest rules. Never strip CSP globally.
- **Relying on Rc2Service in offscreen doc for MYJD detection:** The offscreen doc may not be alive. Service worker must handle the `#rc2jdt` URL detection.
- **Storing CAPTCHA job in URL hash parameters:** The hash is limited in size and requires encoding. Use `chrome.storage.session` for structured job data.
- **Using MAIN world for token polling:** Token polling reads textarea values which works fine in ISOLATED world. Only use MAIN world for `grecaptcha.execute()` / `hcaptcha.execute()`.
- **Forgetting to clean up declarativeNetRequest rules:** Always remove the CSP stripping rule when the CAPTCHA tab closes or completes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CAPTCHA rendering (localhost) | Custom widget rendering | JDownloader's built-in localhost page | JD already renders functional widgets via `browserCaptcha.js` |
| MYJD API client | New HTTP client for MyJD | Existing `myjdDeviceClientFactory.sendRequest()` | Already handles authentication, encryption, device routing |
| Tab-scoped CSP removal | Custom request interception | `declarativeNetRequest` session rules with `tabIds` | Built-in Chrome API, surgical per-tab control |
| MAIN world code execution | `<script>` injection or web_accessible_resources | `chrome.scripting.executeScript({world: 'MAIN'})` | Official MV3 API, no CSP issues, no file exposure |
| Job data passing to content script | URL parameters, `postMessage` | `chrome.storage.session` | Structured data, no encoding issues, 10MB quota |
| Tab lifecycle management | Custom polling for tab state | `chrome.tabs.onRemoved` + `chrome.tabs.onUpdated` | Built-in Chrome APIs, already used in codebase |

**Key insight for Flow A:** JDownloader's localhost page renders the CAPTCHA widget. The content script is an enhancer (UI + protocol callbacks), not a renderer.
**Key insight for Flow B:** The content script IS the renderer -- it must create the CAPTCHA widget HTML, load the external scripts, and handle invisible execution. The `document.open()`/`document.close()` pattern from the old MV2 `rc2Contentscript.js` is the proven approach.

## Common Pitfalls

### Pitfall 1: chrome.storage.session Not Accessible from Content Scripts
**What goes wrong:** Content script calls `chrome.storage.session.get()` and gets undefined/error
**Why it happens:** By default, `chrome.storage.session` is only accessible from TRUSTED_CONTEXTS (extension pages). Content scripts run in UNTRUSTED context.
**How to avoid:** Call `chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` once at service worker startup in `background.js`.
**Warning signs:** myjdCaptchaSolver.js gets empty result from session storage despite service worker writing data.

### Pitfall 2: declarativeNetRequest Rules Not Cleaning Up
**What goes wrong:** CSP stripping rules accumulate as CAPTCHA tabs open and close
**Why it happens:** Rules are only removed if explicit cleanup code runs on tab close
**How to avoid:** Add cleanup in `chrome.tabs.onRemoved` handler: `chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [10000 + tabId] })`. Also clean up on CAPTCHA completion (solve/skip).
**Warning signs:** Other tabs on the same domain have CSP stripped unexpectedly. Session rule count grows.

### Pitfall 3: document.open() Timing at document_start
**What goes wrong:** `document.open()` fails or the page's original content still renders
**Why it happens:** At `document_start`, the DOM is minimal but the browser may still be loading. Some sites use complex redirect chains.
**How to avoid:** The old MV2 extension used multiple clearing strategies: `document.open()`/`document.close()`, `clearDocument()` on `readystatechange`, and body element removal on `DOMContentLoaded`. Implement all three as defense in depth. The old code in `rc2Contentscript.js` (lines 546-603) demonstrates this.
**Warning signs:** Original page content flickers before CAPTCHA UI appears.

### Pitfall 4: reCAPTCHA Domain Validation Failure
**What goes wrong:** reCAPTCHA widget shows "ERROR for site owner" or refuses to render
**Why it happens:** reCAPTCHA validates that the site key matches the domain the widget is loaded on. If the content script navigates to the wrong domain, or the domain does not match the site key's registered domains, it fails.
**How to avoid:** Navigate to the exact domain from `captchaJob.siteUrl || captchaJob.contextUrl` (the URL JDownloader provides). This is the domain the hoster registered with Google. The old MV2 extension did exactly this.
**Warning signs:** reCAPTCHA renders error instead of challenge.

### Pitfall 5: MYJD API Calls from Service Worker Context
**What goes wrong:** `myjdDeviceClientFactory` is an AngularJS service -- it cannot be called from the service worker.
**Why it happens:** The service worker (`background.js`) does not have AngularJS. The factory runs in the offscreen document or popup.
**How to avoid:** Two approaches: (a) Route the `/captcha/solve` call through the offscreen document (similar to how `add-link` is handled), or (b) Move the MYJD CAPTCHA detection and API calls to Rc2Service (which runs in the AngularJS context). The existing code already has the MYJD detection in Rc2Service -- keep it there but add the `chrome.storage.session` write and `declarativeNetRequest` rule creation as messages to the service worker.
**Warning signs:** "myjdDeviceClientFactory is not defined" errors in service worker console.

### Pitfall 6: Invisible/v3 CAPTCHA Token Not Appearing
**What goes wrong:** Token polling runs for 5 minutes without finding a token on v3/invisible pages
**Why it happens:** v3/invisible reCAPTCHA requires explicit `grecaptcha.execute()` call. The content script must trigger this in the MAIN world.
**How to avoid:** After the reCAPTCHA script loads (detect via `script.onload` or poll for `grecaptcha` on window), use `chrome.scripting.executeScript({world: 'MAIN'})` to call `grecaptcha.execute()`. For hCaptcha invisible, call `hcaptcha.execute()`. The content script sends a message to the service worker requesting MAIN world execution.
**Warning signs:** CAPTCHA renders but shows no interaction element and token stays empty.

### Pitfall 7: Service Worker Termination During MYJD Flow
**What goes wrong:** Service worker terminates while waiting for MYJD API responses or while user solves CAPTCHA
**Why it happens:** MV3 service workers terminate after 30 seconds of inactivity
**How to avoid:** The keepAlive alarm (every 4 minutes) helps. For the API call sequence, use `chrome.runtime.sendMessage()` which wakes the service worker. The `chrome.storage.session` persists job data across service worker restarts. The `declarativeNetRequest` session rules also persist.
**Warning signs:** CAPTCHA flow stalls after service worker restart.

### Pitfall 8: Race Between Rc2Service and background.js for MYJD Detection
**What goes wrong:** Both `Rc2Service.js` (in offscreen/popup) and `background.js` (service worker) detect the `#rc2jdt` hash, causing duplicate handling
**Why it happens:** `chrome.tabs.onUpdated` fires in all extension contexts
**How to avoid:** Keep the primary detection in Rc2Service (it has API access). Have background.js only ensure the offscreen document is alive when it sees the hash pattern. Use a flag in `chrome.storage.session` to prevent double-handling.
**Warning signs:** Tab navigates twice, duplicate API calls.

## Existing Code Analysis

### Rc2Service.js -- What Already Works
The current `Rc2Service.js` already contains most of the MYJD flow infrastructure:

1. **MYJD CAPTCHA detection** (lines 297-331): `chrome.tabs.onUpdated` listener detects `#rc2jdt&c={captchaId}` hash, queries `/captcha/getCaptchaJob` then `/captcha/get`, calls `onWebInterfaceCaptchaJobFound()`
2. **Login check** (line 326): Redirects to `loginNeeded.html` if not connected
3. **Solution routing** (lines 68-107): `sendRc2SolutionToJd()` has two paths -- localhost HTTP and MYJD message routing through `webinterfaceEnhancer.js`
4. **canClose polling** (lines 148-165, 177-210): Full implementation via `ExtensionMessagingService` -- but this runs in the AngularJS context
5. **Mouse-move** (lines 110-116): HTTP GET with throttling
6. **Loaded event** (lines 118-139): Window geometry reporting
7. **Tab-close for MYJD** (lines 188-209): Sends `tab-closed` message to `my.jdownloader.org` tabs
8. **Skip handling** (lines 256-291): Both localhost HTTP and MYJD (has TODO for API skip)

**What needs to change:**
- The `onNewCaptchaAvailable` currently uses the old MV2 approach (store in `rc2TabUpdateCallbacks`, navigate tab, inject script via `executeScript`). This needs to be replaced with the new Flow B approach (write to session storage, add CSP rule via message to service worker, navigate tab).
- canClose/loaded/mouse-move for localhost flow should move to the content script (direct HTTP) instead of going through Rc2Service messaging. This is simpler and avoids service worker dependency.

### background.js -- What Already Works
1. **CAPTCHA tab tracking** (lines 575-645): `activeCaptchaTabs` map, handlers for `captcha-tab-detected`, `captcha-solved`, `captcha-skip`
2. **Tab close handler** (lines 702-722): Sends skip(single) on tab removal
3. **declarativeNetRequest** (lines 297-307): Already uses session rules for CNL interceptor -- same pattern for CSP stripping

**What needs to change:**
- Add MYJD-specific message handlers for the new flow
- Add `chrome.storage.session.setAccessLevel()` call at startup
- Add CSP rule management for MYJD CAPTCHA tabs
- Add handler for `myjd-captcha-execute` message (MAIN world script injection for v3/invisible)

### webinterfaceEnhancer.js -- What Already Works
1. **Message routing** (lines 46-65): Routes `myjdrc2` messages between chrome runtime and window.postMessage
2. **Ping/pong** (lines 12-21): Extension detection for my.jdownloader.org

**What needs to change:**
- The MYJD CAPTCHA trigger detection (`#rc2jdt&c=` hash) currently lives in Rc2Service's `chrome.tabs.onUpdated` handler, which runs in the AngularJS context. This is actually fine because Rc2Service runs when the popup/offscreen document is alive. However, we should ensure the detection also works from the service worker as a fallback.

### manifest.json -- What Needs Adding
```json
{
    "content_scripts": [
        {
            "all_frames": false,
            "js": ["contentscripts/myjdCaptchaSolver.js"],
            "matches": ["*://*/*"],
            "run_at": "document_start"
        }
    ]
}
```
Note: `declarativeNetRequest` permission is already declared. No new permissions needed.

## Code Examples

### MyJD API Flow -- Getting CAPTCHA Job Details
```javascript
// Source: existing Rc2Service.js lines 297-331 (already in codebase)
// This code already works -- shows the API call sequence:
myjdDeviceClientFactory.get(device)
    .sendRequest("/captcha/getCaptchaJob", captchaId)
    .then(function(captchaData) {
        // captchaData.data = { id, challengeType, type, hoster, ... }
        if (captchaData && captchaData.data && captchaData.data.id) {
            return myjdDeviceClientFactory.get(device)
                .sendRequest("/captcha/get", JSON.stringify(captchaData.data.id), "rawtoken");
        }
    })
    .then(function(captchaJobResponse) {
        // captchaJobResponse.data = { siteKey, siteUrl, contextUrl, type, v3Action, ... }
        // type = "NORMAL" or "INVISIBLE"
        // v3Action = action string for v3 grecaptcha.execute()
    });
```

### MYJD Solution Submission (existing pattern)
```javascript
// Source: existing Rc2Service.sendRc2SolutionToJd lines 86-106
// For MYJD flow, solution goes through webinterfaceEnhancer to my.jdownloader.org
// which then calls the MyJD API to submit the token
chrome.tabs.query({
    url: ["http://my.jdownloader.org/*", "https://my.jdownloader.org/*"]
}, function(tabs) {
    if (tabs && tabs.length > 0) {
        for (var i = 0; i < tabs.length; i++) {
            chrome.tabs.sendMessage(tabs[i].id, {
                name: "response",
                type: "myjdrc2",
                data: { captchaId: captchaId, token: token }
            });
        }
    }
});
```

### loginNeeded.html
```html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>MyJDownloader - Login Required</title>
    <style>
        body {
            background-color: #dbf5fb;
            margin: 0;
            padding: 32px;
            font-family: Arial, sans-serif;
        }
        .message { font-weight: bold; font-size: 16px; color: #333; }
    </style>
</head>
<body>
    <div class="message">
        You need to be logged in with the MyJDownloader Browser extension
        to solve CAPTCHAs remotely.
        Click the MyJDownloader icon in your browser toolbar and log in,
        then try again.
    </div>
</body>
</html>
```

### DOM Replacement Defense-in-Depth (from old MV2 rc2Contentscript.js)
```javascript
// The old MV2 extension used multiple strategies to ensure the target page
// content is fully replaced. This pattern should be replicated:

// Strategy 1: document.open/close at document_start
// (replaces entire document, removes meta CSP)

// Strategy 2: clearDocument on readystatechange
function clearDocument() {
    try {
        var htmls = document.getElementsByTagName("html");
        var children = htmls[0].childNodes;
        for (var i = 0; i < children.length; i++) {
            var parentElement = children[i];
            while (parentElement.childElementCount > 0) {
                parentElement.removeChild(parentElement.lastChild);
            }
        }
    } catch (error) { console.error(error); }
}

// Strategy 3: Remove foreign body elements on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    var bodies = document.getElementsByTagName("body");
    for (var i = 0; i < bodies.length; i++) {
        if (bodies[i].id !== "myjd-captcha-solver") {
            bodies[i].parentElement.removeChild(bodies[i]);
        }
    }
});
```

## State of the Art

| Old Approach (MV2) | Current Approach (MV3) | When Changed | Impact |
|---------------------|------------------------|--------------|--------|
| `chrome.tabs.executeScript()` with inline JS | `chrome.scripting.executeScript({world: 'MAIN', func: ...})` | Chrome MV3 (2022+) | No inline JS; function passed as reference |
| Inline `<script>` elements in DOM | External `<script src="...">` only | Chrome MV3 CSP | Must use `declarativeNetRequest` to strip CSP for external script loading |
| `chrome.extension.isAllowedIncognitoAccess` | `chrome.runtime.isAllowedIncognitoAccess` | MV3 migration | Already handled |
| Background pages (always-on) | Service workers (ephemeral) | MV3 | Must handle SW termination; `chrome.storage.session` + `declarativeNetRequest` session rules persist |
| `browserSolverEnhancer.js` + `rc2Contentscript.js` | `captchaSolverContentscript.js` + `myjdCaptchaSolver.js` | This phase | Separate scripts for separate concerns |
| `webRequest.onHeadersReceived` for CSP modification | `declarativeNetRequest.updateSessionRules` with `modifyHeaders` | MV3 | Declarative, per-tab scoping via `tabIds` |
| Native messaging to WebView2 binary | Web tab with content script rendering | This phase | Cross-platform, zero installation |

**Deprecated/outdated:**
- `CaptchaNativeService.js`: Deprecated by this phase (mark unused, do not delete)
- `captcha-helper/` directory: Native Rust binary no longer used; cleanup deferred
- `browserSolverEnhancer.js`, `rc2Contentscript.js`, `browser_solver_template.html`: Already removed in prior MV3 migration
- Old MV2 `rc2TabUpdateCallbacks` approach in Rc2Service: Replace with `chrome.storage.session` approach

## Open Questions

1. **Content script XHR from localhost page for protocol callbacks**
   - What we know: Content scripts have the extension's host permissions, allowing XHR to `<all_urls>`. The old MV2 extension did NOT make direct XHR from content scripts -- it routed through the background page via `ExtensionMessagingService`.
   - What is unclear: Whether content script XHR to `http://127.0.0.1:PORT` works without CORS issues in MV3 isolated world.
   - Recommendation: Try direct XHR first (simpler). If CORS blocks it, fall back to routing through service worker via `chrome.runtime.sendMessage`. The context decision says "content script polls callbackUrl directly" so this is the intended approach.

2. **MYJD API solution submission architecture**
   - What we know: The existing code routes solutions through `webinterfaceEnhancer.js` on `my.jdownloader.org` tabs. The web interface itself then calls the MYJD API.
   - What is unclear: Whether we should also implement direct `/captcha/solve` API calls from the extension (bypassing the web interface tab).
   - Recommendation: Use the existing pattern first (route through webinterfaceEnhancer). This is proven and does not require new API client code in the service worker. The TODO for direct API skip can remain deferred.

3. **Race condition: Rc2Service `chrome.tabs.onUpdated` vs service worker**
   - What we know: The `#rc2jdt&c=` detection currently runs in Rc2Service (AngularJS context in popup/offscreen). The service worker may need its own handler as a fallback.
   - What is unclear: Whether the offscreen document is reliably alive when my.jdownloader.org triggers a CAPTCHA.
   - Recommendation: Keep the Rc2Service handler as primary (it has `myjdDeviceClientFactory` access). Add a lightweight detection in `background.js` `chrome.tabs.onUpdated` that ensures the offscreen document is alive when it sees `#rc2jdt` patterns. The offscreen doc is created on demand already (via `createOffscreenDocument()`).

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
| CAP-01 | Content script detects CAPTCHA URL pattern (localhost) | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes (needs update for protocol callbacks) |
| CAP-02 | Token polling for g-recaptcha-response / h-captcha-response | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-03 | Token relayed to service worker | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-04 | Service worker submits token (both flows) | unit | `npx jest __tests__/background-captcha.test.js -x` | Partial (needs MYJD flow tests) |
| CAP-05 | Skip buttons with correct labels and handlers | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-06 | Countdown timer with auto-skip | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-07 | Tab close triggers skip (both flows) | unit | `npx jest __tests__/background-captcha.test.js -x` | Partial (needs MYJD flow tests) |
| CAP-08 | Web tab is sole path (no native routing) | unit (structural) | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-09 | handleRequest() no longer closes tab | unit (structural) | `npx jest __tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-10 | reCAPTCHA v2, v3, hCaptcha support | manual-only | Manual E2E with JDownloader | N/A (Phase 5) |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=__tests__ -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/services/__tests__/myjdCaptchaSolver.test.js` -- structural tests for MYJD flow content script (hash detection, DOM replacement, widget rendering)
- [ ] Update `scripts/services/__tests__/captchaSolverContentscript.test.js` -- add tests for canClose polling, loaded event, mouse-move reporting
- [ ] `scripts/services/__tests__/background-captcha.test.js` -- needs MYJD flow handlers (CSP rule management, storage.session, MAIN world execution trigger)

## Sources

### Primary (HIGH confidence)
- Project source code: `Rc2Service.js`, `background.js`, `captchaSolverContentscript.js`, `webinterfaceEnhancer.js`, `manifest.json`, `myjdDeviceClientFactory.js`, `MyjdDeviceService.js`, `MyjdService.js`, `ExtensionMessagingService.js`, `PopupCandidatesService.js`
- Old MV2 extension source: `rc2Contentscript.js` (full MYJD flow with DOM replacement), `browserSolverEnhancer.js` (localhost enhancement), `webinterfaceEnhancer.js` (message routing), old `Rc2Service.js` (identical MYJD detection logic)
- [chrome.declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) -- session rules with `tabIds`, `modifyHeaders` with `remove`, max 5000 session rules
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- `session.setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')`, 10MB quota
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- `executeScript({world: 'MAIN', func, args})`, Chrome 95+
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- MAIN world CSP behavior, ISOLATED world CSP

### Secondary (MEDIUM confidence)
- [Disable-CSP Extension](https://github.com/lisonge/Disable-CSP) -- confirms declarativeNetRequest CSP removal pattern
- [reCAPTCHA v3 docs](https://developers.google.com/recaptcha/docs/v3) -- `grecaptcha.execute()` API, token via textarea
- [hCaptcha docs](https://docs.hcaptcha.com/) -- `hcaptcha.execute()` API, h-captcha-response textarea

### Tertiary (LOW confidence)
- Content script XHR to localhost from ISOLATED world -- believed to work due to extension host permissions, but needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All APIs already used in codebase; no new dependencies
- Architecture (Flow A): HIGH -- Already implemented in 04-01/04-02, just needs protocol callbacks
- Architecture (Flow B): HIGH -- Old MV2 code provides complete reference implementation; MV3 equivalents confirmed via official docs
- declarativeNetRequest CSP stripping: HIGH -- Official docs confirm `tabIds` support and `modifyHeaders` remove operation
- chrome.storage.session access from content scripts: HIGH -- Official docs confirm `setAccessLevel` API
- chrome.scripting.executeScript MAIN world: HIGH -- Official docs, Chrome 95+, JSON-serializable args
- MYJD API integration: HIGH -- Existing codebase has complete implementation in Rc2Service
- document.open()/document.close() at document_start: MEDIUM -- Old MV2 code proves it works, but MV3 behavior needs runtime verification
- Content script direct XHR for protocol callbacks: MEDIUM -- Should work via host permissions, needs testing

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable APIs, no fast-moving dependencies)
