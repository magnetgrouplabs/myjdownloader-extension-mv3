# CAPTCHA Solving in Chrome MV3 Extensions: Approaches Comparison

**Project:** MyJDownloader MV3 Extension
**Researched:** 2026-03-06
**Overall Confidence:** HIGH (multiple official sources, real extension analysis, Chromium team discussions)

## Executive Summary

After extensive research into how Chrome MV3 extensions handle CAPTCHA solving, the conclusion is clear: **our native messaging approach is the most robust and reliable option, but a hybrid approach using `chrome.windows.create` with a bundled extension page could work as a simpler alternative for many scenarios.**

The core problem is that MV3's Content Security Policy enforces `script-src 'self'` for all extension pages (popups, options, windows, offscreen documents). This means you **cannot** load `https://www.google.com/recaptcha/api.js` or `https://js.hcaptcha.com/1/api.js` directly in any extension page. There is no CSP override available for `extension_pages` -- Chrome enforces a minimum policy and rejects any attempt to add external script sources.

The ecosystem has converged on three viable patterns:
1. **Content script relay** (what 2Captcha, CapSolver, NopeCHA do) -- detect CAPTCHAs on existing web pages and interact with them via content scripts
2. **Native messaging** (what we do) -- hand off to a native binary with its own browser/webview
3. **Sandbox iframe** (theoretical, partially viable) -- load CAPTCHA scripts in a sandboxed extension page with relaxed CSP

A fourth approach, **CAPTCHA solving services** (AI/human), eliminates the rendering problem entirely by proxying to remote solvers.

---

## Approach 1: Content Script Relay (What 2Captcha/CapSolver Do)

### How It Works

The extension injects content scripts into web pages. These content scripts:
1. **Detect CAPTCHAs** by scanning the DOM for markers (`<div class="g-recaptcha">`, hcaptcha iframes, etc.)
2. **Intercept dynamic loading** by hooking `grecaptcha.render()` and similar methods to catch dynamically injected CAPTCHAs
3. Either **interact with the existing CAPTCHA on the page** (click audio button, solve, inject token) OR **extract parameters** (siteKey, action) and send them to a remote solving service
4. **Inject the solution token** back into the page's CAPTCHA callback

### MV3 Compliance

**Fully MV3-compliant.** Content scripts run in the page's context (or an isolated world), so the page's own CSP governs whether CAPTCHA scripts load -- and they already loaded because the site put them there. The extension never loads external CAPTCHA scripts itself.

### Architecture (2Captcha Solver - MV3)

```
Web Page (has reCAPTCHA)
    |
    v
content/script.js -- periodically checks captcha-widgets collection
    |-- hunter.js -- finds static CAPTCHAs in DOM
    |-- interceptor.js -- hooks dynamic CAPTCHA loading
    |-- processor.js -- handles button placement, answer injection
    |
    v (sends CAPTCHA params to service worker)
Service Worker
    |
    v (forwards to remote API)
2Captcha/CapSolver API (human or AI solvers)
    |
    v (returns token)
Service Worker -> Content Script -> injects token into page
```

### Applicability to Our Use Case

**This does NOT apply to our scenario.** Our extension needs to solve CAPTCHAs that JDownloader presents, not CAPTCHAs on arbitrary web pages. JDownloader's flow is:
1. JDownloader opens `http://127.0.0.1:9666/captcha/recaptchav2/?id=123` in the browser
2. That localhost page needs to render a reCAPTCHA widget with a specific siteKey
3. The user solves it, and the token is submitted back to JDownloader

The localhost page served by JDownloader is a minimal HTML page that loads the reCAPTCHA script. The content script relay approach could theoretically work here IF JDownloader's localhost page already loads and renders the CAPTCHA properly. But the whole reason we need a solution is that JDownloader's localhost page relies on loading external scripts, and the MV2 approach used content scripts that injected inline script tags -- which MV3 CSP prohibits.

**Verdict: NOT DIRECTLY APPLICABLE** for our JDownloader use case. Could work if JDownloader's localhost page already renders the CAPTCHA without extension help, but that depends on JDownloader's implementation.

### Pros
- No native binary needed
- Cross-platform
- No installation complexity
- Well-proven pattern (2Captcha, CapSolver, NopeCHA all use it)

### Cons
- Only works when CAPTCHAs already exist on a web page
- Cannot create a CAPTCHA widget from scratch
- Requires the hosting page to have loaded the CAPTCHA scripts already

### Real Examples
- **2Captcha Solver** ([GitHub](https://github.com/rucaptcha/2captcha-solver)) -- MV3, content script architecture
- **CapSolver** ([GitHub](https://github.com/capsolver/capsolver-browser-extension)) -- MV3, similar pattern
- **NopeCHA** ([GitHub](https://github.com/NopeCHALLC/nopecha-extension)) -- AI-powered, content script based
- **Buster** ([GitHub](https://github.com/dessant/buster)) -- MV3, audio challenge solver via speech recognition

---

## Approach 2: Native Messaging (Our Current Approach)

### How It Works

The extension sends CAPTCHA parameters to a native binary via `chrome.runtime.sendNativeMessage()`. The native binary opens its own browser window (WebView2 on Windows) with the CAPTCHA widget, the user solves it, and the token is returned via the native messaging protocol.

### MV3 Compliance

**Fully MV3-compliant.** Native messaging is an officially supported MV3 API. The native binary runs outside the extension sandbox and has no CSP restrictions.

### Our Current Architecture

```
JDownloader opens http://127.0.0.1:9666/captcha/recaptchav2/?id=123
    |
    v
Rc2Service detects CAPTCHA URL pattern, closes tab
    |
    v
CaptchaNativeService.sendCaptcha(captchaJob)
    |
    v (chrome.runtime.sendNativeMessage)
myjd-captcha-helper.exe (Rust binary)
    |
    v (Opens WebView2 window)
User solves CAPTCHA in WebView2
    |
    v (Token returned via stdout)
CaptchaNativeService receives token
    |
    v (HTTP GET to callbackUrl)
JDownloader receives token
```

### Pros
- Full control over CAPTCHA rendering environment
- No CSP restrictions in native context
- Can handle any CAPTCHA type
- 5-minute timeout with countdown
- Skip buttons (hoster/package/all/single)
- Robust error handling

### Cons
- **Windows-only** (WebView2 is Windows-specific)
- **Requires native binary installation** (build + registry setup)
- **Complex deployment** (user must run installer as admin)
- **Rust toolchain required** for development/building
- **Cannot be distributed via Chrome Web Store alone** (needs separate installer)
- **No auto-update** for the native binary

### Confidence: HIGH
This is our proven, working approach. Native messaging is well-documented and officially supported.

---

## Approach 3: Sandbox Iframe with Relaxed CSP

### How It Works

Chrome MV3 allows declaring sandbox pages in the manifest. These pages get a more relaxed CSP than regular extension pages:

**Default sandbox CSP:**
```
sandbox allow-scripts allow-forms allow-popups allow-modals;
script-src 'self' 'unsafe-inline' 'unsafe-eval';
child-src 'self';
```

**Customizable to allow external domains:**
```json
{
  "content_security_policy": {
    "sandbox": "sandbox allow-scripts; script-src 'self' https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com"
  },
  "sandbox": {
    "pages": ["captcha-sandbox.html"]
  }
}
```

The sandbox page can then load external CAPTCHA scripts and communicate with the extension via `postMessage()`.

### MV3 Compliance

**Partially MV3-compliant, with significant caveats.** Chrome's official documentation states:

> "Remotely hosted code is supported in sandboxed iframes."
> -- [Chrome MV3 Migration: Improve Security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)

However, there are critical limitations:
1. Sandbox pages have a **null origin**, not a `chrome-extension://` origin
2. reCAPTCHA performs **domain validation** against the siteKey's allowed domains
3. A null origin will likely trigger "Invalid domain for site key" errors
4. The sandbox page cannot access extension APIs -- only `postMessage()`
5. `allow-same-origin` **cannot** be combined with `allow-scripts` in sandbox (security restriction)

### Critical Issue: Domain Validation

reCAPTCHA validates that the domain serving the widget matches the domains registered for the siteKey. A sandboxed page has origin `null`. This means:

- **If the siteKey is registered for a specific domain** (e.g., `example.com`): reCAPTCHA will reject it with "Invalid domain for site key"
- **If domain validation is disabled** in reCAPTCHA admin: It might work, but this is a security risk and not something we control (JDownloader/hoster controls the siteKey)
- **With the test siteKey** (`6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`): Would work, but useless in production

For hCaptcha, the domain validation is less strict, but a null origin may still cause issues.

### Proposed Architecture

```
Extension Page (popup or window)
    |
    v (embeds via iframe)
captcha-sandbox.html (sandboxed page, relaxed CSP)
    |-- Loads https://www.google.com/recaptcha/api.js
    |-- Renders reCAPTCHA widget
    |-- User solves CAPTCHA
    |
    v (postMessage with token)
Extension Page receives token
    |
    v
Submits token to JDownloader via HTTP
```

### Manifest Configuration

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    "sandbox": "sandbox allow-scripts allow-popups; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com; frame-src https://www.google.com https://www.gstatic.com https://hcaptcha.com https://*.hcaptcha.com; connect-src https://www.google.com https://*.google.com https://hcaptcha.com https://*.hcaptcha.com;"
  },
  "sandbox": {
    "pages": ["captcha-sandbox.html"]
  }
}
```

### Pros
- No native binary needed
- Cross-platform (works on Windows, macOS, Linux)
- Extension-only distribution (Chrome Web Store)
- Simpler deployment
- Can embed in a `chrome.windows.create` popup for visible UI

### Cons
- **Domain validation is a likely blocker** -- reCAPTCHA/hCaptcha may reject null origin
- **Untested at scale** -- no widely-used extension uses this pattern for CAPTCHA solving
- **Chrome Web Store review risk** -- loading remote scripts in sandbox may face scrutiny
- **Limited API access** -- sandbox page cannot use chrome.* APIs
- **Communication overhead** -- must use postMessage() for all extension interaction
- **reCAPTCHA v3 may not work** -- invisible challenges require proper domain context

### Confidence: LOW-MEDIUM
The approach is theoretically sound per Chrome documentation, but the domain validation issue is a likely showstopper for our use case. No real-world examples of extensions successfully using this for CAPTCHA solving were found.

---

## Approach 4: Extension Window with Web-Accessible Page

### How It Works

Use `chrome.windows.create()` to open an extension page (e.g., `captcha-window.html`) in a popup window. This page embeds a sandboxed iframe that loads the CAPTCHA.

This is a variation of Approach 3, but with a visible window for the user to interact with.

### MV3 Compliance

Same as Approach 3 -- the extension page itself cannot load external scripts, but a sandboxed iframe within it potentially can.

### Architecture

```
chrome.windows.create({ url: 'captcha-window.html', type: 'popup' })
    |
    v
captcha-window.html (extension page, strict CSP)
    |
    v (embeds)
<iframe src="captcha-sandbox.html"></iframe> (sandboxed, relaxed CSP)
    |-- Loads CAPTCHA script
    |-- Renders widget
    |-- User solves
    |
    v (postMessage)
captcha-window.html receives token
    |
    v (chrome.runtime.sendMessage)
Service worker submits token to JDownloader
```

### Key Issue: Same Domain Validation Problem

The sandboxed iframe still has a null origin, so the same reCAPTCHA domain validation issues from Approach 3 apply.

### Additional Issue: chrome-extension:// URL Resolution

reCAPTCHA's API uses scheme-relative URLs (e.g., `//www.google.com/recaptcha/...`). Inside a `chrome-extension://` page, these resolve to `chrome-extension://www.google.com/...` which fails. The sandbox page mitigates this since it has a null origin, but the behavior is not well-documented.

### Pros
- Visible window for user interaction
- No native binary
- Cross-platform
- Can include skip buttons, countdown, etc. in the extension page surrounding the iframe

### Cons
- Same domain validation blocker as Approach 3
- Complexity of iframe-to-parent communication
- Two layers of pages (window + sandbox iframe)
- UX may feel clunky compared to native window

### Confidence: LOW
Combines the weaknesses of Approach 3 with additional complexity. No real-world examples found.

---

## Approach 5: Open a Regular Web Tab

### How It Works

Instead of rendering the CAPTCHA in an extension context, open a regular web tab to a URL that hosts the CAPTCHA widget. A content script on that page monitors for the CAPTCHA solution and relays it back to the extension.

Options:
- **Option A:** Let JDownloader's localhost page (`http://127.0.0.1:9666/captcha/...`) handle it directly -- the original MV2 approach used content scripts (`rc2Contentscript.js`) injected into this page to enhance it
- **Option B:** Open a purpose-built web page (e.g., hosted on a controlled domain) that renders the CAPTCHA
- **Option C:** Open the actual site that requires the CAPTCHA

### MV3 Compliance

**Fully MV3-compliant.** Regular web tabs have their own CSP (not the extension's), so loading reCAPTCHA/hCaptcha scripts works normally. Content scripts can observe and interact with the page.

### The JDownloader Localhost Problem

JDownloader already serves HTML pages on `http://127.0.0.1:9666/captcha/recaptchav2/...` that include reCAPTCHA widgets. The original MV2 extension enhanced these pages with content scripts (`rc2Contentscript.js`, `browserSolverEnhancer.js`) that:
1. Injected inline scripts to communicate CAPTCHA state
2. Added skip buttons and UI enhancements
3. Relayed solved tokens back to the extension

**The MV3 problem:** These content scripts used `inline script injection` which violates MV3 CSP. Specifically:
- Creating `<script>` elements with inline code
- Using `document.write()` with script tags
- Injecting event handlers via HTML attributes

**The MV3 solution for this approach:** Rewrite the content scripts to avoid inline script injection:
1. Use `chrome.scripting.executeScript()` with MAIN world injection to interact with `grecaptcha` objects
2. Use MutationObserver to detect when CAPTCHA is solved
3. Use `window.postMessage()` for content-script-to-page communication
4. Use `chrome.runtime.sendMessage()` for content-script-to-extension communication

### Architecture

```
JDownloader opens http://127.0.0.1:9666/captcha/recaptchav2/?id=123
    |
    v (browser navigates to localhost page)
JDownloader's localhost page loads reCAPTCHA script
    |
    v
Content script injected via manifest (matches http://127.0.0.1:9666/*)
    |-- Monitors for CAPTCHA solution
    |-- Adds skip buttons
    |-- Adds countdown timer
    |
    v (CAPTCHA solved by user in regular browser tab)
Content script detects token via MutationObserver or grecaptcha callback hook
    |
    v (chrome.runtime.sendMessage)
Service worker receives token
    |
    v (HTTP callback)
JDownloader receives token
```

### Key Technical Requirements

1. **MAIN world script injection** -- to access `grecaptcha` and `hcaptcha` objects on the page:
   ```javascript
   chrome.scripting.executeScript({
     target: { tabId },
     world: 'MAIN',
     files: ['captcha-page-script.js']
   });
   ```

2. **Content script for localhost** -- new manifest entry:
   ```json
   {
     "content_scripts": [{
       "matches": ["http://127.0.0.1:9666/captcha/*"],
       "js": ["contentscripts/captchaSolverContentscript.js"],
       "run_at": "document_end"
     }]
   }
   ```

3. **Communication bridge** -- the MAIN world script detects the token and posts it via `window.postMessage()`, the content script (isolated world) listens and forwards via `chrome.runtime.sendMessage()`.

### Critical Dependency: JDownloader's Localhost Page

This approach depends on JDownloader's localhost server serving a working CAPTCHA page that:
- Loads reCAPTCHA/hCaptcha scripts from CDN
- Renders the widget
- Has the correct siteKey

If JDownloader's localhost page works in a normal browser tab without any extension involvement, this approach is viable. The extension just needs to monitor and relay the solution.

### Pros
- **No native binary** -- eliminates the entire Rust/WebView2 stack
- **Cross-platform** -- works on Windows, macOS, Linux
- **Chrome Web Store compatible** -- no external installer needed
- **Uses standard web page rendering** -- no CSP issues since it's a regular web tab
- **Domain validation works** -- reCAPTCHA sees `127.0.0.1` as the domain (which JDownloader should have configured)
- **User sees standard browser UI** -- familiar experience

### Cons
- **Depends on JDownloader's localhost page working** -- if JDownloader doesn't serve a functional CAPTCHA page, this fails
- **Opens a visible browser tab** -- less polished than a native popup window
- **Content script complexity** -- need to handle MAIN world injection carefully
- **Need to rewrite removed content scripts** -- rc2Contentscript.js needs MV3 rewrite
- **Tab management** -- need to track and close CAPTCHA tabs
- **reCAPTCHA v3 (invisible)** -- may not work if JDownloader's page doesn't support it natively

### Confidence: MEDIUM-HIGH
This approach is architecturally sound and MV3-compliant. The main uncertainty is whether JDownloader's localhost CAPTCHA page works standalone in a browser without extension enhancement. The original MV2 extension enhanced these pages significantly, suggesting they may not be self-contained.

---

## Approach 6: Offscreen Document

### How It Works

Use `chrome.offscreen.createDocument()` to create a hidden DOM-capable document. Load the CAPTCHA in this document.

### MV3 Compliance

**NOT viable for CAPTCHA solving.** Offscreen documents:
1. Are **invisible** -- they have no visible window, so users cannot interact with CAPTCHA widgets
2. Have the same **extension CSP** (`script-src 'self'`) -- cannot load external scripts
3. Only support `chrome.runtime` messaging APIs
4. Are designed for background DOM tasks (audio, clipboard, etc.), not user interaction

### Why This Fails

reCAPTCHA v2 requires user interaction (clicking a checkbox, solving image challenges). Even reCAPTCHA v3, which is invisible, requires a properly rendered page context with domain validation. An offscreen document satisfies neither requirement.

### Confidence: HIGH (that this does NOT work)
Official Chrome documentation is clear about offscreen document limitations.

---

## Approach 7: Side Panel API

### How It Works

Chrome's Side Panel API (`chrome.sidePanel`) allows extensions to display persistent UI alongside web pages. Could we render CAPTCHAs in a side panel?

### MV3 Compliance

**NOT viable for CAPTCHA solving.** Side panel pages are extension pages and subject to the same `script-src 'self'` CSP. They cannot load external reCAPTCHA/hCaptcha scripts.

A sandboxed iframe could be embedded in the side panel (combining with Approach 3), but the domain validation issues still apply.

### Additional Issues
- Side panel is relatively small and may not display CAPTCHA widgets well
- User attention is split between the main page and the side panel
- Not available on all Chrome versions (Chrome 114+)

### Confidence: HIGH (that this does NOT work as standalone approach)

---

## Approach 8: CAPTCHA Solving Services (AI/Human Proxy)

### How It Works

Instead of rendering the CAPTCHA for the user to solve, send the CAPTCHA parameters (siteKey, page URL, type) to a remote solving service. The service either uses AI or human workers to solve the CAPTCHA and returns the token.

### Architecture

```
JDownloader CAPTCHA detected
    |
    v
Extension extracts siteKey, challengeType, siteUrl
    |
    v (fetch to API)
CAPTCHA solving service (2Captcha, CapSolver, Anti-Captcha)
    |-- AI solver (fast, ~2-5 seconds)
    |-- Human solver fallback (10-30 seconds)
    |
    v (returns token)
Extension receives token
    |
    v
Submits to JDownloader via HTTP callback
```

### MV3 Compliance

**Fully MV3-compliant.** Only uses `fetch()` from the service worker to communicate with the API. No CAPTCHA rendering needed in the extension at all.

### Pros
- **Simplest implementation** -- no native binary, no special pages, no content scripts
- **Cross-platform** -- works everywhere
- **No user interaction needed** -- fully automatic
- **Handles all CAPTCHA types** -- including v3 invisible and enterprise
- **Chrome Web Store compatible**

### Cons
- **Costs money** -- typically $1-3 per 1000 solves
- **Requires API key** -- user must sign up for a solving service
- **Privacy concern** -- CAPTCHA data sent to third party
- **Latency** -- 2-30 seconds per solve depending on type and service
- **Not always reliable** -- services can have downtime or fail
- **Ethical/legal gray area** -- CAPTCHA solving services operate in a gray zone
- **Not suitable as default** -- users may not want to pay or share data

### Real Services
- **2Captcha** (https://2captcha.com) -- human + AI, ~$2.99/1000 reCAPTCHAs
- **CapSolver** (https://www.capsolver.com) -- AI-focused, ~$0.80/1000 reCAPTCHAs
- **Anti-Captcha** (https://anti-captcha.com) -- established service
- **SolveCaptcha** -- launched 2025, hybrid AI/human

### Confidence: HIGH (technically works, but has significant non-technical drawbacks)

---

## Approach 9: DeclarativeNetRequest CSP Modification

### How It Works

Use `chrome.declarativeNetRequest` to modify CSP headers on JDownloader's localhost CAPTCHA pages to allow loading external scripts.

### MV3 Compliance

**Technically possible but extremely limited.**

`declarativeNetRequest` can modify response headers, but:
- It can only **remove** or **replace** the entire CSP header -- it cannot append to specific directives
- You would need to **completely replace** the CSP with one that allows reCAPTCHA scripts
- This modifies the **web page's** CSP, not the extension's CSP

### Why This Is Risky

If JDownloader's localhost pages have a restrictive CSP, you could remove it entirely:
```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [{
      "header": "content-security-policy",
      "operation": "remove"
    }]
  },
  "condition": {
    "urlFilter": "http://127.0.0.1:9666/captcha/*",
    "resourceTypes": ["main_frame"]
  }
}
```

However, this assumes JDownloader's pages are being blocked by their own CSP, which is unlikely -- the CSP issue is on the extension side, not the web page side.

### Confidence: LOW
This approach solves a different problem than the one we actually have.

---

## Comparison Matrix

| Approach | MV3 Compliant | Cross-Platform | No Native Binary | No Cost | User Solves | Domain Validation OK | Proven in Production | Complexity |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1. Content Script Relay | Yes | Yes | Yes | Yes | N/A* | Yes | Yes | Medium |
| 2. Native Messaging (current) | Yes | **No** | **No** | Yes | Yes | Yes | Yes | High |
| 3. Sandbox Iframe | Yes | Yes | Yes | Yes | Yes | **Likely No** | **No** | Medium |
| 4. Extension Window + Sandbox | Yes | Yes | Yes | Yes | Yes | **Likely No** | **No** | High |
| 5. Open Web Tab | Yes | Yes | Yes | Yes | Yes | Yes | Partial** | Medium |
| 6. Offscreen Document | **No*** | -- | -- | -- | **No** | -- | **No** | -- |
| 7. Side Panel | **No*** | -- | -- | -- | Limited | **Likely No** | **No** | -- |
| 8. Solving Service | Yes | Yes | Yes | **No** | No (auto) | Yes | Yes | Low |
| 9. DNR CSP Modification | Partial | Yes | Yes | Yes | Yes | Yes | **No** | Low |

\* Content script relay doesn't apply to our use case (JDownloader CAPTCHA)
\** The original MV2 extension used a variant of this
\*** Extension CSP blocks external scripts; offscreen documents are invisible

---

## Recommendation

### Primary: Keep Native Messaging (Approach 2) with Improvements

**Rationale:** Our native messaging approach is the only approach that is:
- Proven to work
- Fully MV3-compliant
- Has no domain validation issues
- Gives full control over the CAPTCHA rendering environment
- Handles all CAPTCHA types reliably

**Suggested improvements:**
- Document the installation process better
- Create an automated installer/setup script
- Explore cross-platform options (wry/tao supports macOS/Linux, but needs testing)
- Consider auto-update mechanism for the native binary

### Secondary: Investigate Web Tab Approach (Approach 5) as Fallback

**Rationale:** The "open a regular web tab" approach is the most promising alternative because:
- It avoids all CSP issues (regular web pages have their own CSP)
- It avoids domain validation issues (reCAPTCHA sees the actual domain)
- It requires no native binary
- It's cross-platform

**What needs validation:**
1. Does JDownloader's localhost CAPTCHA page (`http://127.0.0.1:9666/captcha/...`) render a functional reCAPTCHA widget when opened in a normal browser tab WITHOUT any extension content scripts?
2. If yes, can we write an MV3-compliant content script that monitors the page for a solved CAPTCHA token and relays it back?
3. Does `chrome.scripting.executeScript()` with `world: 'MAIN'` work reliably for accessing `grecaptcha` objects on localhost pages?

**Suggested investigation steps:**
1. Open `http://127.0.0.1:9666/captcha/recaptchav2/?id=...` in a clean Chrome tab (no extension) and see if the CAPTCHA loads
2. If it does: write a content script to monitor and relay the solution
3. If it does not: the web tab approach is not viable without modifying JDownloader

### Optional Add-On: CAPTCHA Solving Service Integration (Approach 8)

**Rationale:** For users willing to pay, integrating a solving service as an optional feature could provide automatic CAPTCHA solving without any user interaction. This would be:
- A settings option (enter API key for 2Captcha/CapSolver)
- A fallback when native helper is not installed
- A convenience feature for power users

### Approaches to Avoid

- **Sandbox iframe (Approaches 3-4):** Domain validation is a likely blocker, and no production extensions use this pattern for CAPTCHA solving. Not worth the risk.
- **Offscreen document (Approach 6):** Invisible documents cannot host interactive CAPTCHAs. Dead end.
- **Side panel (Approach 7):** Same CSP issues as extension pages. Not viable.
- **DNR CSP modification (Approach 9):** Solves the wrong problem.

---

## Migration Path: If Moving Away from Native Messaging

If the web tab approach (Approach 5) proves viable after validation:

### Phase 1: Validate
1. Test JDownloader's localhost CAPTCHA pages in clean browser
2. Prototype a content script for localhost CAPTCHA monitoring
3. Test MAIN world script injection for `grecaptcha` access

### Phase 2: Implement
1. Create `captchaSolverContentscript.js` for `http://127.0.0.1:9666/captcha/*`
2. Create MAIN world bridge script for token extraction
3. Add manifest content_scripts entry for localhost
4. Modify Rc2Service to NOT close the localhost tab
5. Add skip button injection via content script
6. Add countdown timer via content script

### Phase 3: Dual Mode
1. Keep native messaging as primary (better UX)
2. Fall back to web tab approach when native helper is not installed
3. User can choose preferred method in settings

This dual-mode approach gives us the best of both worlds: polished native experience for users who install the helper, and cross-platform fallback for everyone else.

---

## Sources

### Official Chrome Documentation
- [Manifest V3 Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Sandbox Manifest Key](https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/)
- [Improve Extension Security (MV3 Migration)](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- [chrome.offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [chrome.declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)

### Chromium Developer Discussions
- [Serious Issues with MV3 Restrictions -- Captchas and API Calls](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/U6wI28ZBk0I)
- [Content Security Policy Blocking reCAPTCHA in Extension Pages](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/zwUKe98g7r0)
- [reCAPTCHA in Manifest V3 Extension](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/zE_w_Y16jl0)
- [Clarification on Remotely Hosted Code in MV3](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3-0UtxLHAhs)
- [Can declarativeNetRequest Modify CSP Headers?](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/mOveWB_Eot0)
- [MV3 Sandbox Support](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/G8jq4vIog0A)

### Extension Source Code
- [2Captcha Solver (MV3)](https://github.com/rucaptcha/2captcha-solver) -- Content script relay architecture
- [CapSolver Extension](https://github.com/capsolver/capsolver-browser-extension) -- AI-powered content script solver
- [NopeCHA Extension](https://github.com/NopeCHALLC/nopecha-extension) -- Multimodal AI solver
- [Buster Captcha Solver](https://github.com/dessant/buster) -- Audio challenge + speech recognition

### reCAPTCHA Documentation
- [reCAPTCHA Domain/Package Name Validation](https://developers.google.com/recaptcha/docs/domain_validation)
- [reCAPTCHA v3 Documentation](https://developers.google.com/recaptcha/docs/v3)
- [reCAPTCHA iframe sandbox issue](https://github.com/google/recaptcha/issues/162)
- [reCAPTCHA "Invalid domain" in iframe srcdoc](https://github.com/google/recaptcha/issues/379)

### General
- [Blocking webRequest CSP Directives (w3c)](https://github.com/w3c/webextensions/issues/169)
- [Top CAPTCHA-Solving Extensions Comparison](https://incogniton.com/blog/top-captcha-solving-extensions-for-chrome-a-practical-comparison/)
- [Best CAPTCHA Solver Chrome Extension 2026](https://www.capsolver.com/blog/Extension/best-captcha-solver-chrome-extension-in-2026)
- [hCaptcha Developer Guide](https://docs.hcaptcha.com/)

---

*Research completed: 2026-03-06*
