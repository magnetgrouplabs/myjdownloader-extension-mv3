# Web Tab CAPTCHA Approach: Deep Technical Validation

**Project:** MyJDownloader MV3 Extension
**Date:** 2026-03-06
**Verdict:** YES -- Feasible and recommended as cross-platform fallback
**Overall Confidence:** HIGH

---

## 1. Executive Summary

The web tab CAPTCHA approach is technically feasible, fully MV3-compliant, and can serve as a cross-platform alternative to the native messaging helper. The approach works because JDownloader's localhost page already loads and renders CAPTCHA widgets via its own `browserCaptcha.js` script -- the extension does not need to load any external CAPTCHA scripts itself. A content script in the ISOLATED world combined with a MAIN world script can monitor for CAPTCHA solutions, inject skip buttons, and relay tokens back to JDownloader.

However, the approach requires understanding a critical architectural detail: the original MV2 extension (`browserSolverEnhancer.js`) **completely replaced** JDownloader's page content with its own CAPTCHA-rendering implementation. The MV3 version should NOT do this. Instead, it should let JDownloader's page render the CAPTCHA natively and use content scripts only to monitor, enhance, and relay results.

Two implementation paths exist depending on whether JDownloader's localhost page renders a functional CAPTCHA without extension involvement:

- **Path A (JDownloader page works standalone):** Content script monitors the existing page for solution tokens and relays them. Minimal complexity.
- **Path B (JDownloader page needs extension help):** Content script reads meta tags from the page, clears the DOM, builds a CAPTCHA-rendering page (similar to what the MV2 extension did), but using MAIN world injection instead of inline scripts. More complex but still feasible.

The user's ability to coordinate with JDownloader developers opens a **Path C** that is ideal: JDownloader modifies its localhost page to be fully self-contained (renders CAPTCHA, submits token back to itself without extension involvement). The extension's content script then only needs to add UI enhancements (skip buttons, countdown) and close the tab after submission.

---

## 2. MV3 Compliance Assessment

### 2.1 Content Scripts in MV3

**Status: FULLY SUPPORTED**
**Confidence: HIGH**

Content scripts are a core MV3 feature. They can be declared in `manifest.json` with specific URL patterns and run in either ISOLATED or MAIN worlds.

**Evidence:**
- Chrome official docs confirm content scripts work identically in MV3 as in MV2 for declaration and injection
- The `world` property is supported in manifest `content_scripts` declarations (can be `"ISOLATED"` or `"MAIN"`)
- `chrome.scripting.executeScript()` supports `world: "MAIN"` for programmatic injection from the service worker

**Source:** [Content Scripts - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Manifest content_scripts - Chrome Developers](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)

### 2.2 Match Patterns for localhost

**Status: FULLY SUPPORTED**
**Confidence: HIGH**

Chrome match patterns support `http://127.0.0.1/*` and specific port patterns.

**Critical detail:** Chrome supports port numbers in match patterns (e.g., `http://127.0.0.1:9666/*`). Firefox does NOT support port-specific patterns, but this extension targets Chrome only.

**Recommended manifest entry:**
```json
{
  "content_scripts": [{
    "matches": ["http://127.0.0.1/*"],
    "js": ["contentscripts/captchaSolverContentscript.js"],
    "run_at": "document_end"
  }]
}
```

Using `http://127.0.0.1/*` (without port) is safer and more broadly compatible. The content script can further filter by checking `window.location.port` and path patterns at runtime.

**Source:** [Match Patterns - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)

### 2.3 MAIN World Script Injection

**Status: FULLY SUPPORTED**
**Confidence: HIGH**

Two methods are available:

**Method 1 -- Manifest declaration:**
```json
{
  "content_scripts": [{
    "matches": ["http://127.0.0.1/*"],
    "js": ["contentscripts/captchaMainWorld.js"],
    "world": "MAIN",
    "run_at": "document_end"
  }]
}
```

**Method 2 -- Programmatic injection from service worker:**
```javascript
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: monitorCaptchaSolution,
  world: "MAIN"
});
```

Both require `"scripting"` permission (already present in the manifest) and appropriate host permissions (already present: `"http://127.0.0.1:9666/*"`).

**Source:** [chrome.scripting API - Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/scripting)

### 2.4 Tab Management

**Status: FULLY SUPPORTED**
**Confidence: HIGH**

`chrome.tabs.create()`, `chrome.tabs.remove()`, `chrome.tabs.query()`, and `chrome.tabs.onUpdated` are all available in MV3 service workers. The extension already uses these APIs extensively.

**Source:** Current codebase (`background.js`, `Rc2Service.js`) already uses all these APIs.

---

## 3. How JDownloader's Localhost CAPTCHA Page Works

### 3.1 Architecture (from source code analysis)

**Confidence: MEDIUM-HIGH** (based on GitHub mirror of JDownloader source + MV2 extension content scripts)

JDownloader runs a localhost HTTP server (default port 9666) that serves CAPTCHA pages:

**URL patterns:**
- `http://127.0.0.1:9666/captcha/recaptchav2/{siteDomain}?id={captchaId}`
- `http://127.0.0.1:9666/captcha/recaptchav3/{siteDomain}?id={captchaId}`
- `http://127.0.0.1:9666/captcha/hcaptcha/{siteDomain}?id={captchaId}`

**Page structure:**
The `recaptcha.html` template contains:
1. **Meta tags** with CAPTCHA parameters (populated by JDownloader at serve time):
   - `<meta name="sitekey" content="%%%sitekey%%%"/>`
   - `<meta name="v3action" content="%%%v3action%%%"/>`
   - `<meta name="sitekeyType" content="%%%sitekeyType%%%"/>`
   - `<meta name="challengeType" content="%%%challengeType%%%"/>`
   - `<meta name="siteDomain" content="%%%siteDomain%%%"/>`
   - `<meta name="siteUrl" content="%%%siteUrl%%%"/>`
   - `<meta name="enterprise" content="%%%enterprise%%%"/>`

2. **JavaScript** (`/resource?browserCaptcha.js`) that handles:
   - Loading the reCAPTCHA/hCaptcha widget
   - Rendering the challenge
   - Detecting the solution
   - Submitting the token back to JDownloader via callback URL

3. **Token submission** via GET request:
   - `{callbackUrl}&do=solve&response={token}`
   - JDownloader validates the token matches pattern `^[\w-_]{30,}`

4. **Additional features:**
   - Browser extension download prompts (for users without the extension)
   - `browserCaptcha.js` handles the actual CAPTCHA rendering

### 3.2 Does It Work Without the Extension?

**YES, with qualifications.**
**Confidence: MEDIUM**

Based on source code analysis:

1. JDownloader's `browserCaptcha.js` (served from localhost) handles loading the reCAPTCHA/hCaptcha API scripts and rendering the widget
2. The page can render the CAPTCHA and submit the token back to JDownloader without any browser extension
3. The page includes a built-in success handler that submits solved tokens via XMLHttpRequest with `&do=solve&response=` parameter
4. JDownloader acts as a proxy for Google's reCAPTCHA resources, forwarding headers like User-Agent and referer

**The page is designed to be functional standalone.** The extension in MV2 enhanced the experience (added skip buttons, replaced the page styling) but was not strictly required for basic CAPTCHA solving.

**Validation required:** The user should manually open a JDownloader CAPTCHA URL in a clean browser tab (without the extension) to confirm this. If the reCAPTCHA widget loads and solving submits the token, no JDownloader changes are needed.

### 3.3 How the MV2 Extension Enhanced the Page

The MV2 extension had two content scripts for CAPTCHA pages:

**`browserSolverEnhancer.js`** (injected on `127.0.0.1:*` pages):
- Read CAPTCHA parameters from meta tags (`sitekey`, `sitekeyType`, `siteDomain`, etc.)
- Sent a `captcha-new` message to the extension background
- Replaced the page body with a loading message
- Acted as a bridge between the page and the extension

**`rc2Contentscript.js`** (injected on all pages, activated by `#rc2jdt` hash):
- Completely replaced the page DOM
- Loaded `browser_solver_template.html` from extension resources
- Created `<script>` elements to load reCAPTCHA/hCaptcha API scripts (MV3 violation)
- Used inline JavaScript for callbacks (MV3 violation)
- Added skip buttons (hoster, package, all, single)
- Polled for solution tokens via `g-recaptcha-response` / `h-captcha-response` textarea elements
- Sent solved tokens back via `chrome.runtime.sendMessage`

**Key MV3 violations in the MV2 approach:**
- `document.createElement('script')` with inline `text` content
- Dynamic `<script>` injection for reCAPTCHA rendering
- Inline event handlers (`onclick`)

---

## 4. MAIN World Script Injection: Technical Details

### 4.1 Accessing CAPTCHA Objects

From a MAIN world script, you have full access to page JavaScript objects:

```javascript
// MAIN world script -- has access to page's JavaScript globals
function monitorCaptchaSolution() {
  // reCAPTCHA v2: grecaptcha object is available
  if (typeof grecaptcha !== 'undefined') {
    // Method 1: Hook the callback
    const originalCallback = grecaptcha.__callback;
    // Method 2: Poll grecaptcha.getResponse()
    const token = grecaptcha.getResponse();
  }

  // hCaptcha: hcaptcha object is available
  if (typeof hcaptcha !== 'undefined') {
    const token = hcaptcha.getResponse();
  }
}
```

### 4.2 Solution Detection Methods

**Method 1: Poll textarea elements (simplest, most reliable)**
```javascript
// Works from ISOLATED world -- no MAIN world needed
function pollForSolution() {
  const interval = setInterval(() => {
    // reCAPTCHA stores token in textarea#g-recaptcha-response
    const rcResponse = document.getElementById('g-recaptcha-response');
    if (rcResponse && rcResponse.value && rcResponse.value.length > 30) {
      clearInterval(interval);
      chrome.runtime.sendMessage({
        action: 'captcha-solved',
        token: rcResponse.value
      });
    }

    // hCaptcha stores token in textarea[name="h-captcha-response"]
    const hcResponse = document.querySelector('[name="h-captcha-response"]');
    if (hcResponse && hcResponse.value && hcResponse.value.length > 30) {
      clearInterval(interval);
      chrome.runtime.sendMessage({
        action: 'captcha-solved',
        token: hcResponse.value
      });
    }
  }, 500);
}
```

This is exactly what the MV2 extension's `ResultPoll` class did (see `rc2Contentscript.js` line 37-65). It polled for `g-recaptcha-response` and `h-captcha-response` elements every 500ms.

**Method 2: MutationObserver on the response textarea**
```javascript
// ISOLATED world
function observeSolution() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        const el = document.getElementById('g-recaptcha-response');
        if (el && el.value && el.value.length > 30) {
          observer.disconnect();
          chrome.runtime.sendMessage({
            action: 'captcha-solved',
            token: el.value
          });
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
}
```

**Method 3: MAIN world callback hooking**
```javascript
// MAIN world script
(function() {
  // Wait for grecaptcha to load, then hook the render callback
  const checkInterval = setInterval(() => {
    if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
      clearInterval(checkInterval);
      const originalRender = grecaptcha.render;
      grecaptcha.render = function(container, params) {
        const originalCallback = params.callback;
        params.callback = function(token) {
          window.postMessage({
            type: 'myjd-captcha-solved',
            token: token
          }, '*');
          if (originalCallback) originalCallback(token);
        };
        return originalRender.call(this, container, params);
      };
    }
  }, 100);
})();
```

**Recommended approach: Method 1 (polling).**
- Simplest to implement
- Works from ISOLATED world (no MAIN world injection needed for detection alone)
- Proven pattern (used by the MV2 extension, used by 2Captcha, CapSolver, NopeCHA)
- Works for all CAPTCHA types (reCAPTCHA v2, v3, enterprise, hCaptcha)

### 4.3 Communication Pattern

```
JDownloader localhost page (renders CAPTCHA via browserCaptcha.js)
    |
    v  [user solves CAPTCHA]
    |
Content Script (ISOLATED world)
    |-- Polls for token in g-recaptcha-response / h-captcha-response
    |-- OR: MAIN world script detects via callback hook
    |       --> posts token via window.postMessage()
    |       --> ISOLATED world script receives via window.addEventListener('message')
    |
    v  [chrome.runtime.sendMessage()]
Service Worker (background.js)
    |
    v  [HTTP GET: callbackUrl + "&do=solve&response=" + token]
JDownloader receives token
```

---

## 5. What JDownloader Needs to Change (If Anything)

### 5.1 Path A: Zero Changes (if page works standalone)

If JDownloader's localhost page already renders a functional CAPTCHA widget via `browserCaptcha.js` and submits the token back to itself, **no JDownloader changes are needed**. The extension content script only needs to:
1. Monitor for solution (poll textarea elements)
2. Add UI enhancements (skip buttons, countdown)
3. Close the tab after successful submission
4. Report status back to the extension

**Likelihood:** HIGH that this works. The `browserCaptcha.js` script appears to handle the full lifecycle, and the page includes a built-in XMLHttpRequest success handler.

### 5.2 Path B: Minor Changes (if page needs enhancement)

If the standalone page has issues (e.g., `browserCaptcha.js` fails to load reCAPTCHA resources due to proxy issues), the extension can:
1. Read meta tags from the page (sitekey, challengeType, etc.)
2. Clear the DOM
3. Build a CAPTCHA page using MAIN world injection
4. Load reCAPTCHA/hCaptcha API scripts via dynamic `<script>` elements in the MAIN world

**This is exactly what the MV2 extension did**, but using MAIN world injection instead of inline scripts. MAIN world scripts CAN create `<script>` elements that load external resources because they run under the PAGE's CSP (which has no restrictions on loading from google.com or hcaptcha.com).

```javascript
// MAIN world script -- runs under PAGE's CSP, not extension's
(function() {
  const script = document.createElement('script');
  script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
  script.onload = function() {
    grecaptcha.render('captcha-container', {
      sitekey: document.querySelector('meta[name="sitekey"]').content,
      callback: function(token) {
        window.postMessage({ type: 'myjd-captcha-solved', token: token }, '*');
      }
    });
  };
  document.head.appendChild(script);
})();
```

This is MV3-compliant because the script runs in the page's execution context (MAIN world), not the extension's.

### 5.3 Path C: Ideal (JDownloader cooperation)

If the user can coordinate with JDownloader developers, the ideal changes would be:

1. **Ensure `browserCaptcha.js` is self-contained**: The localhost page should load, render, and handle CAPTCHA solving end-to-end without any extension
2. **Add a `window.postMessage` notification on solve**: After the token is submitted, fire a postMessage event so extensions can detect completion
3. **Include skip button UI natively**: Add skip buttons to the page itself, with HTTP callbacks to JDownloader
4. **Add a CSS class or data attribute on solve**: e.g., `document.body.dataset.captchaSolved = 'true'` for easy detection

With these changes, the extension content script becomes trivially simple: detect solve, close tab.

---

## 6. End-to-End Flow

### 6.1 Complete Flow (Web Tab Approach)

```
1. JDownloader detects CAPTCHA requirement
   |
   v
2. JDownloader opens http://127.0.0.1:9666/captcha/recaptchav2/{domain}?id={id}
   (Opens in user's default browser as a new tab)
   |
   v
3. Content script matches http://127.0.0.1/* and injects
   |-- captchaSolverContentscript.js (ISOLATED world)
   |-- captchaMainWorld.js (MAIN world, if needed)
   |
   v
4. Content script verifies this is a CAPTCHA page
   |-- Checks URL path: /captcha/(recaptchav2|recaptchav3|hcaptcha)/
   |-- Reads meta tags for parameters
   |-- Sends "captcha-tab-detected" to service worker
   |
   v
5. JDownloader's browserCaptcha.js renders the CAPTCHA widget
   (reCAPTCHA or hCaptcha loads from CDN, renders in the page)
   |
   v
6. User solves the CAPTCHA
   |
   v
7. Token appears in g-recaptcha-response or h-captcha-response textarea
   |
   v
8. Content script detects token (poll every 500ms)
   |-- Sends token to service worker via chrome.runtime.sendMessage
   |-- OR: JDownloader's own JS submits token via XMLHttpRequest
   |       (callbackUrl + "&do=solve&response=" + token)
   |
   v
9. Service worker (optional: confirms submission via HTTP)
   |-- GET http://127.0.0.1:9666/...?do=solve&response={token}
   |-- Closes the CAPTCHA tab after 2-second delay
   |
   v
10. JDownloader receives token, continues download
```

### 6.2 Failure Points

| Failure Point | Cause | Mitigation |
|---------------|-------|------------|
| Tab doesn't open | JDownloader not running, port blocked | Detect and show error in extension popup |
| Content script doesn't inject | Match pattern miss, Chrome security restriction | Use broad pattern `http://127.0.0.1/*` + runtime URL check |
| CAPTCHA widget fails to load | Network issue, Google/hCaptcha CDN blocked | Show error message in content script UI; user can retry |
| Token not detected | Polling misses token, textarea ID changed | Use multiple detection methods (poll + MutationObserver); validate JDownloader's element IDs |
| Token submission fails | JDownloader callback URL expired, server crashed | Retry with exponential backoff; show error to user |
| User closes tab before solving | User action | Detect via `chrome.tabs.onRemoved`; send skip(hoster) to JDownloader |
| Timeout (>5 min) | User distracted | Content script shows countdown timer; sends skip after timeout |

### 6.3 Tab Close Handling

When the user closes the CAPTCHA tab without solving:

```javascript
// Service worker
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeCaptchaTabs[tabId]) {
    const captchaInfo = activeCaptchaTabs[tabId];
    // Send skip to JDownloader (default: skip hoster)
    fetch(captchaInfo.callbackUrl + '&do=skip&skiptype=hoster', {
      headers: { 'X-Myjd-Appkey': 'webextension-' + version }
    });
    delete activeCaptchaTabs[tabId];
  }
});
```

### 6.4 Skip Buttons

Skip buttons can be injected via content script (ISOLATED world):

```javascript
function injectSkipButtons(callbackUrl) {
  const container = document.createElement('div');
  container.id = 'myjd-captcha-controls';
  container.innerHTML = `
    <div style="display:table; width:100%; margin-top:16px;">
      <button data-skip="hoster">Skip hoster</button>
      <button data-skip="package">Skip package</button>
      <button data-skip="all">Skip all</button>
      <button data-skip="single">Cancel</button>
    </div>
  `;
  container.addEventListener('click', (e) => {
    const skipType = e.target.dataset.skip;
    if (skipType) {
      chrome.runtime.sendMessage({
        action: 'captcha-skip',
        callbackUrl: callbackUrl,
        skipType: skipType
      });
    }
  });
  document.body.appendChild(container);
}
```

This is fully MV3-compliant -- no inline scripts, no inline event handlers, just DOM manipulation and event listener registration.

---

## 7. Chrome Web Store Review Risk

### 7.1 Permission Analysis

**Current permissions already cover this approach:**

| Permission | Already Declared | Needed For |
|------------|:---:|------------|
| `tabs` | Yes | Tab detection, creation, removal |
| `scripting` | Yes | MAIN world injection |
| `<all_urls>` (host) | Yes | Content script on localhost |
| `http://127.0.0.1:9666/*` (host) | Yes | Explicit localhost access |
| `nativeMessaging` | Yes | Existing native helper (keep for dual-mode) |

No new permissions are needed for the web tab approach.

### 7.2 Policy Compliance

**No policy violations identified.**

| Concern | Assessment |
|---------|------------|
| Content scripts on localhost | Not restricted by CWS policies; localhost is explicitly supported in match patterns |
| `<all_urls>` permission | Already declared and justified for context menu/toolbar functionality |
| MAIN world scripts | Officially supported MV3 feature; no policy against it |
| CAPTCHA interaction | The extension helps users solve CAPTCHAs (not bypass them); similar to 2Captcha Solver extension which is on CWS |
| External script loading | Extension does NOT load external scripts; the page's own JS does, which is normal web behavior |

**Source:** [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) -- No policies against localhost content scripts, CAPTCHA-assisting extensions, or MAIN world injection.

### 7.3 Comparison with Existing CWS Extensions

Several MV3 extensions on the Chrome Web Store use content scripts to interact with CAPTCHA widgets on web pages:

- **2Captcha Solver** -- Uses content scripts to detect CAPTCHAs, extract parameters, inject solutions
- **CapSolver** -- Similar content script architecture for CAPTCHA interaction
- **NopeCHA** -- AI-powered solver using content scripts
- **Buster** -- Uses content scripts for audio challenge solving

All are approved on the Chrome Web Store, confirming that this pattern is acceptable.

### 7.4 Recommended Approach for Permissions

Use the specific localhost host permission rather than relying solely on `<all_urls>`:

```json
{
  "host_permissions": [
    "<all_urls>",
    "http://127.0.0.1:9666/*",
    "http://localhost:9666/*"
  ]
}
```

The more specific permissions are already declared in the manifest. Adding a content script that matches `http://127.0.0.1/*` is justified by the explicit host permission for that address.

---

## 8. Implementation Architecture

### 8.1 New Files

| File | Purpose | World |
|------|---------|-------|
| `contentscripts/captchaSolverContentscript.js` | ISOLATED world: Detect CAPTCHA page, poll for token, inject UI, relay to service worker | ISOLATED |
| `contentscripts/captchaMainWorld.js` | MAIN world: Access `grecaptcha`/`hcaptcha` objects, hook callbacks (only if polling is insufficient) | MAIN |

### 8.2 Modified Files

| File | Changes |
|------|---------|
| `manifest.json` | Add content_scripts entry for `http://127.0.0.1/*` |
| `background.js` | Add message handlers for `captcha-solved`, `captcha-skip`, `captcha-tab-detected` |
| `Rc2Service.js` | Modify `handleRequest()` to NOT close the CAPTCHA tab (let it stay open for the user) |

### 8.3 Dual-Mode Architecture

```
CAPTCHA detected by Rc2Service
    |
    v
Is native helper installed?
    |
    +-- YES: Use native messaging (current behavior)
    |         Close localhost tab, open WebView2
    |
    +-- NO: Use web tab approach
              Keep localhost tab open
              Content script monitors and relays
```

Detection of native helper availability:
```javascript
// Try to send a status check to native helper
chrome.runtime.sendNativeMessage('org.jdownloader.captcha_helper',
  { action: 'status' },
  (response) => {
    if (chrome.runtime.lastError) {
      // Native helper not installed -- use web tab approach
      useWebTabApproach = true;
    } else {
      // Native helper available -- use native approach
      useWebTabApproach = false;
    }
  }
);
```

### 8.4 Manifest Changes

```json
{
  "content_scripts": [
    // ... existing content scripts ...
    {
      "matches": ["http://127.0.0.1/*"],
      "js": ["contentscripts/captchaSolverContentscript.js"],
      "run_at": "document_end"
    }
  ]
}
```

The MAIN world script should be injected programmatically only when needed, not declaratively, to avoid unnecessary injection on all localhost pages.

---

## 9. Comparison: Web Tab vs Native Helper

| Dimension | Native Helper (current) | Web Tab (proposed) |
|-----------|:-----------------------:|:------------------:|
| Cross-platform | Windows only | All platforms |
| Installation complexity | High (build + registry) | None (extension only) |
| Chrome Web Store distribution | Needs separate installer | Extension only |
| UX polish | Dedicated window | Browser tab |
| CAPTCHA type support | All types | All types |
| Skip buttons | Built into WebView2 | Injected via content script |
| Timeout handling | 5-min countdown in window | 5-min countdown via content script |
| reCAPTCHA v3 (invisible) | Full support | Depends on JD page |
| Auto-update | Manual | Automatic with extension |
| Dependency on JDownloader page | None (builds own page) | Depends on JD localhost page |
| Maintenance burden | Rust binary + WebView2 | JavaScript only |
| Offline capability | N/A (needs JD running) | N/A (needs JD running) |

---

## 10. Recommended Implementation Plan

### Phase 1: Validate JDownloader's Page (1 hour, manual)

1. Start JDownloader with a CAPTCHA-gated download
2. When CAPTCHA tab opens at `http://127.0.0.1:9666/captcha/...`, examine the page
3. Verify: Does the reCAPTCHA/hCaptcha widget render and function?
4. Verify: After solving, does the token submit back to JDownloader?
5. Check if `g-recaptcha-response` or `h-captcha-response` textarea gets populated

**If YES to all:** Proceed with Path A (simplest implementation)
**If NO:** Proceed with Path B (content script renders CAPTCHA) or Path C (coordinate with JDownloader devs)

### Phase 2: Build Content Script (2-3 days)

1. Create `captchaSolverContentscript.js`:
   - Detect CAPTCHA URL pattern
   - Poll for solution token
   - Inject skip buttons and countdown timer
   - Send token/skip/timeout to service worker

2. Create `captchaMainWorld.js` (only if needed):
   - Hook `grecaptcha.render` callback
   - Relay token via `window.postMessage`

3. Update `manifest.json` with new content script entry

### Phase 3: Integrate with Service Worker (1 day)

1. Add message handlers in `background.js`:
   - `captcha-solved`: Submit token to JDownloader
   - `captcha-skip`: Submit skip request
   - `captcha-tab-detected`: Track active CAPTCHA tabs

2. Modify `Rc2Service.js`:
   - Add dual-mode logic (native helper vs web tab)
   - Stop closing CAPTCHA tabs when using web tab mode

### Phase 4: Test and Polish (1-2 days)

1. Test with reCAPTCHA v2 (checkbox)
2. Test with reCAPTCHA v3 (invisible)
3. Test with hCaptcha
4. Test skip buttons (all four types)
5. Test timeout handling
6. Test tab close before solving
7. Test dual-mode switching

---

## 11. Open Questions

1. **Does JDownloader's `browserCaptcha.js` work reliably?** Needs manual validation. If it does not render the CAPTCHA, the content script must handle rendering via MAIN world injection.

2. **reCAPTCHA v3 (invisible) handling:** v3 challenges are invisible and require `grecaptcha.execute()` to be called. Does JDownloader's page handle this, or does the extension need to trigger execution? The MV2 extension's `rc2Contentscript.js` created an explicit "I am not a robot" button for invisible challenges.

3. **Domain validation for reCAPTCHA:** reCAPTCHA validates that the domain matches the siteKey's allowed domains. JDownloader appears to proxy reCAPTCHA requests through its localhost server to handle this. Need to verify this proxy still works in current JDownloader versions.

4. **JDownloader port configurability:** The default port is 9666, but JDownloader allows changing this. The content script match pattern `http://127.0.0.1/*` covers all ports. The content script should read the port from `window.location.port` rather than hardcoding.

5. **Multiple simultaneous CAPTCHAs:** Can JDownloader queue multiple CAPTCHA challenges? If so, the extension needs to handle multiple CAPTCHA tabs. The MV2 extension tracked tab-to-captcha mappings via `rc2TabUpdateCallbacks`.

---

## 12. Sources

### Official Chrome Documentation
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- Content script capabilities, world property, MV3 support
- [Match Patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) -- Localhost matching, port support
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- executeScript with world: MAIN
- [Manifest content_scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- Declarative content script registration with world property
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) -- No restrictions on localhost content scripts or CAPTCHA interaction

### JDownloader Source Code
- [recaptcha.html template](https://github.com/mirror/jdownloader/blob/master/src/org/jdownloader/captcha/v2/challenge/recaptcha/v2/recaptcha.html) -- Localhost CAPTCHA page structure
- [RecaptchaV2Challenge.java](https://github.com/mirror/jdownloader/blob/master/src/org/jdownloader/captcha/v2/challenge/recaptcha/v2/RecaptchaV2Challenge.java) -- Server-side template population, token callback handling
- [BrowserSolverConfig.java](https://github.com/mirror/jdownloader/blob/master/src/org/jdownloader/captcha/v2/solver/browser/BrowserCaptchaSolverConfig.java) -- Browser solver configuration options

### MV2 Extension Source (Reference Implementation)
- `browserSolverEnhancer.js` -- MV2 content script that read meta tags and triggered CAPTCHA rendering
- `rc2Contentscript.js` -- MV2 content script that rendered CAPTCHAs with inline script injection (MV3-incompatible)
- `browser_solver_template.html` -- UI template with skip buttons and help text

### CAPTCHA Solver Extensions (Precedent)
- [2Captcha Solver](https://github.com/rucaptcha/2captcha-solver) -- MV3 extension using content scripts for CAPTCHA interaction
- [CapSolver Extension](https://github.com/capsolver/capsolver-browser-extension) -- Similar content script architecture
- [Buster Captcha Solver](https://github.com/dessant/buster) -- MV3 audio challenge solver

---

*Research completed: 2026-03-06*
