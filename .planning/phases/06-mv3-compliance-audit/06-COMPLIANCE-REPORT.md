# MyJDownloader MV3 Extension - Compliance Report

**Date:** 2026-03-08
**Extension:** MyJDownloader MV3 (v2026.02.24)
**Manifest Version:** 3
**Prepared for:** JDownloader Development Team (AppWork GmbH)

---

## 1. Executive Summary

This report documents the Manifest V3 compliance posture of the MyJDownloader browser extension following its conversion from Manifest V2. The extension is **architecturally MV3 compliant** and ready for Chrome Web Store submission with the considerations noted below.

**Key findings:**

- **One permission removed:** `nativeMessaging` (native helper abandoned; no longer declared or loaded)
- **Two legacy test files removed** from `web_accessible_resources` (captcha-helper test artifacts)
- **Vendor files contain restricted constructs** that are **dead code at runtime** due to `ng-csp` and standard module usage patterns
- **One postMessage wildcard** documented in `webinterfaceEnhancer.js` (low risk, functionally scoped)
- **No CSP-violating code** in extension-authored files

**Overall assessment:** READY FOR SUBMISSION with noted considerations for CWS static analysis of vendor files.

---

## 2. Permission Audit (CWS-01)

### Active Permissions

| Permission | Justification | Used By |
|-----------|---------------|---------|
| `tabs` | CAPTCHA tab management (create, update, remove, onUpdated listener), toolbar injection (executeScript), tab close detection for skip signals | `background.js`, `scripts/services/Rc2Service.js` |
| `storage` | Session/settings persistence (`chrome.storage.local`), CAPTCHA job transfer between service worker and content scripts (`chrome.storage.session`), request queue persistence | `background.js`, `offscreen.js`, content scripts, popup controllers |
| `declarativeNetRequest` | CSP header stripping on CAPTCHA tabs (allows reCAPTCHA/hCaptcha script loading on sites with restrictive CSP), CNL localhost rules | `background.js` (dynamic rules with `updateSessionRules`) |
| `contextMenus` | "Download with JDownloader" right-click context menu on links, images, selections, and pages | `background.js` (`chrome.contextMenus.create`) |
| `scripting` | MAIN world script execution for reCAPTCHA v3/invisible CAPTCHAs (`chrome.scripting.executeScript`), toolbar content script injection | `background.js` |
| `alarms` | Service worker keep-alive timer (4-minute interval) to maintain active connections and CAPTCHA polling | `background.js` (`chrome.alarms.create`) |
| `offscreen` | Offscreen document creation for jdapi operations requiring DOM/localStorage access (service workers have no DOM) | `background.js` (`chrome.offscreen.createDocument`), `offscreen.js` |

### Host Permissions

| Host Permission | Justification | Used By |
|----------------|---------------|---------|
| `<all_urls>` | Content scripts must run on arbitrary domains for: CNL interception, toolbar injection, CAPTCHA solving on any file hoster domain, clipboard monitoring | All content scripts in `contentscripts/` |
| `http://127.0.0.1:9666/*` | JDownloader local API endpoint (for users running JD locally) | `contentscripts/captchaSolverContentscript.js`, `contentscripts/cnlInterceptor.js` |
| `http://localhost:9666/*` | JDownloader local API endpoint alias | Same as above |

### Removed Permissions

| Permission | Status | Reason |
|-----------|--------|--------|
| ~~`nativeMessaging`~~ | **REMOVED** | Native messaging host (`captcha-helper/`) is abandoned and unused. `CaptchaNativeService.js` script tag removed from `popup.html`. File kept on disk but not loaded. |

**Assessment:** PASS -- All active permissions have clear justification with file-level evidence. No unnecessary permissions remain.

---

## 3. Code Safety Audit (CWS-03)

### Restricted Code Inventory

The following restricted constructs were found in vendor files. Each is analyzed for reachability in the extension's runtime code paths.

#### 3.1 require.js line 2140: req.exec text-execution path

- **Code:** `req.exec` function wrapping a text-execution call
- **Purpose:** Execute text for transpiling loader plugins (text!, css!, etc.)
- **Reachable?** NO -- This function is only invoked by RequireJS loader plugins. The extension uses only `define()` and `require()` with pre-bundled modules. No loader plugins are configured or used.
- **Risk:** NONE at runtime
- **Assessment:** FINDING -- Dead code. Presence may trigger CWS static analysis.
- **Recommendation:** Document for CWS review if flagged. Future option: remove RequireJS dependency entirely (MOD-01).

#### 3.2 angular.js line 1292: CSP detection probe

- **Code:** `noUnsafeEval()` function (lines 1289-1296) attempts to create a dynamic function to test CSP restrictions
- **Purpose:** Runtime CSP detection -- probes whether dynamic code constructs are allowed
- **Reachable?** NO -- The `ng-csp` attribute on `<body>` in `popup.html` (line 13) and `toolbar.html` (line 14) causes AngularJS to skip this probe entirely:
  - Lines 1269-1278: When `[ng-csp]` element is found, `noUnsafeEval` is set to `true` directly from the attribute
  - The `noUnsafeEval()` function at line 1289 is never called
- **Risk:** NONE
- **Assessment:** PASS -- Bypassed by `ng-csp` attribute

#### 3.3 angular.js line 16548: ASTCompiler dynamic function generation

- **Code:** ASTCompiler creates dynamic functions for AngularJS expression compilation
- **Purpose:** Compiles AngularJS expressions into optimized JavaScript functions
- **Reachable?** NO -- Line 17339: `this.astCompiler = options.csp ? new ASTInterpreter($filter) : new ASTCompiler($filter);`
  - With `ng-csp` present, `options.csp` is `true`, so `ASTInterpreter` is used instead of `ASTCompiler`
  - `ASTInterpreter` does NOT use dynamic code generation
- **Risk:** NONE
- **Assessment:** PASS -- Bypassed by `ng-csp` routing to `ASTInterpreter`

#### 3.4 rx.all.js line 21: Global object detection fallback

- **Code:** UMD global detection chain: `var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || /* final fallback */;`
- **Purpose:** UMD global object detection with multiple fallbacks. The final fallback uses a Function constructor to get the global object.
- **Reachable?** NO (in browser contexts) -- Short-circuit evaluation prevents reaching the final fallback:
  - `freeGlobal` = `null` (no Node.js global in browser)
  - `freeWindow` = `window` object (truthy in extension pages)
  - `freeSelf` = `self` object (truthy in extension pages)
  - `thisGlobal` = `window` (in non-strict mode)
  - The chain resolves to `freeWindow` or `freeSelf` before reaching the final fallback
- **Risk:** NONE at runtime in browser contexts
- **Assessment:** FINDING -- Dead code due to short-circuit evaluation. Presence may trigger CWS static analysis.

#### 3.5 rx.all.js line 1303: postMessage scheduling test

- **Code:** `root.postMessage('', '*');` inside `postMessageSupported()` function
- **Purpose:** Internal feature detection for async scheduling mechanism
- **Reachable?** YES -- Called during RxJS initialization to determine available scheduling strategy
- **Risk:** NONE -- Internal self-messaging with empty string payload; not cross-origin communication
- **Assessment:** PASS -- Internal scheduling mechanism, not a security concern

### ng-csp Analysis

The `ng-csp` directive is the key mechanism ensuring AngularJS never uses dynamic code generation at runtime:

| Page | Has ng-csp? | Has AngularJS? | Analysis |
|------|-------------|----------------|----------|
| `popup.html` | YES (line 13: `<body ... ng-csp>`) | YES | AngularJS uses `ASTInterpreter`, skips CSP probe. SAFE. |
| `toolbar.html` | YES (line 14: `<body ... ng-csp>`) | YES | Same as popup.html. SAFE. |
| `offscreen.html` | NO | NO | Does not load AngularJS. Loads jQuery, CryptoJS, RequireJS. No `ng-csp` needed. SAFE. |
| `loginNeeded.html` | N/A | NO | Pure HTML/CSS. No JavaScript loaded. SAFE. |
| `background.js` | N/A | NO | Service worker. No DOM, no AngularJS. SAFE. |

### CWS Review Consideration

Chrome's static analysis during CWS review may flag the **presence** of restricted constructs in vendor files (`require.js`, `angular.js`, `rx.all.js`) even though they are dead code at runtime. If this causes rejection, the recommended remediation options are:

1. **Add explanatory comments** in vendor files near flagged constructs documenting why they are dead code
2. **Remove RequireJS** (MOD-01) -- eliminates the text-execution path; largest impact
3. **Contact Chrome Web Store support** with this dead-code analysis as evidence
4. **Replace rx.all.js** with a minimal RxJS build that excludes the Function constructor fallback

---

## 4. CSP Compliance (CWS-04)

### MV3 Default CSP

MV3 enforces the following Content Security Policy for extension pages:

```
script-src 'self'; object-src 'self';
```

This prohibits:
- Inline script execution (script tags with inline code)
- Dynamic code generation (restricted constructs)
- Script loading from external origins

Note: `style-src` is NOT restricted by default -- inline style tags are allowed.

### Per-Page Analysis

| Page | Scripts | Inline JS? | Inline CSS? | CSP Status |
|------|---------|-----------|-------------|------------|
| `popup.html` | All loaded via external script tags | NO | NO (uses `style` attribute on body) | PASS |
| `toolbar.html` | All loaded via external script tags | NO | NO | PASS |
| `offscreen.html` | All loaded via external script tags | NO | NO (uses inline `style` attribute) | PASS |
| `loginNeeded.html` | None | NO | YES (style block, lines 6-36) | PASS -- CSS allowed under MV3 CSP |
| `background.js` | Service worker, no DOM | N/A | N/A | PASS |

### Runtime Verification Results

Runtime CSP verification performed on 2026-03-08 by loading the extension in Chrome and inspecting DevTools console on each page for "Refused to" or "Content Security Policy" error messages.

| Page | CSP Errors | Console Notes | Status |
|------|-----------|---------------|--------|
| `popup.html` | None | 403 on listdevices (expired session token -- not CSP) | PASS |
| `background.js` (service worker) | None | ERR_CONNECTION_REFUSED on localhost:9666 ping (expected -- JD on NAS, not local) | PASS |
| `toolbar.html` | None | Clean | PASS |
| `offscreen.html` | None | Clean | PASS |
| `loginNeeded.html` | N/A (no scripts) | N/A | PASS |

**Zero CSP violations found.** All console messages were functional (expired auth token, expected localhost timeout) -- none related to Content Security Policy.

**Assessment:** VERIFIED PASS -- Runtime testing confirms zero CSP violations across all extension pages. AngularJS ng-csp mode prevents dynamic code generation. All scripts loaded as external files. MV3 default CSP (`script-src 'self'; object-src 'self'`) fully satisfied.

---

## 5. postMessage Security (CWS-07)

### Finding: Wildcard Origin in webinterfaceEnhancer.js

**File:** `contentscripts/webinterfaceEnhancer.js`
**Line:** 54
**Code:** `window.postMessage(msg, "*");`

- **Context:** Content script reroutes `myjdrc2` messages from `chrome.runtime.onMessage` to the window context on my.jdownloader.org pages. This bridges extension messaging with the page's JavaScript.
- **Content script match pattern:** `*://my.jdownloader.org/*` (manifest.json lines 59-61)
- **Risk:** LOW -- The content script only runs on my.jdownloader.org, so the wildcard `"*"` is functionally scoped to that origin. However, any JavaScript listener on the page can intercept the message.
- **Comparison:** Line 18 uses `window.parent.postMessage({...}, e.origin)` which correctly specifies the origin.
- **Recommended fix:** Replace `"*"` with `"https://my.jdownloader.org"` for defense-in-depth.
- **Decision:** Left unchanged per project decision -- JD developers to evaluate.

**Assessment:** FINDING -- Low risk, recommended fix documented.

### Internal postMessage in rx.all.js (SAFE)

| Line | Code | Purpose | Risk |
|------|------|---------|------|
| 1303 | `root.postMessage('', '*')` | Async scheduling feature detection (one-time test during init) | SAFE -- Internal, empty payload |
| 1341 | `root.postMessage(MSG_PREFIX + id, '*')` | Async task scheduling with unique prefix `ms.rx.schedule` + random | SAFE -- Internal mechanism with random prefix, only received by matching listener on line 1331 |

These are standard RxJS internal scheduling mechanisms, not cross-origin communication. The unique random prefix ensures only the matching RxJS listener processes these messages.

**Assessment:** PASS -- Internal scheduling, not a security concern.

---

## 6. Additional Findings

### 6.1 Dead Code in webinterfaceEnhancer.js (Lines 56-64)

**Severity:** Low
**Type:** FINDING

Lines 56-64 contain an unreachable `captcha-done` branch. The outer `else if` condition on line 56 (`msg.type !== undefined && msg.name !== undefined && msg.data !== undefined`) is identical to the condition on line 51. Since line 51's branch handles the case where this condition is true, the `else if` on line 56 can never execute. The `captcha-done` handler is dead code.

**Recommendation:** Remove lines 56-64 to eliminate dead code.

### 6.2 autograbber-indicator.html Script Tag

**Severity:** Informational
**Type:** FINDING

`autograbber-indicator.html` is listed in `web_accessible_resources`. It contains a script tag pointing to a directory path (`/contentscripts/`) rather than a specific file. This is non-functional but harmless.

**Recommendation:** Fix the script tag to point to the correct file, or remove if the autograbber indicator is not actively used.

### 6.3 CaptchaNativeService.js on Disk

**Severity:** Informational
**Type:** FINDING

`scripts/services/CaptchaNativeService.js` remains on disk but is no longer loaded by `popup.html` (script tag removed in this audit). The file registers an AngularJS service that depends on `chrome.runtime.connectNative()`, which requires the `nativeMessaging` permission that has been removed.

**Recommendation:** Delete the file entirely to reduce extension package size and avoid confusion. The native messaging host directory (`captcha-helper/`) can also be removed.

---

## 7. Handoff Items for JD Developers

The following items are intentionally out of scope for this technical audit but are required for Chrome Web Store submission:

### CWS-02: Privacy Policy

**Status:** ACTION NEEDED

A privacy policy must be created and hosted at a publicly accessible URL. It should cover:
- **Credential handling:** MyJDownloader login credentials (email/password) are used to authenticate with the MyJD cloud API. Credentials are stored in `chrome.storage.local`.
- **URL data:** URLs from links, pages, and selections are sent to JDownloader through the MyJD cloud API.
- **Storage usage:** `chrome.storage.local` for settings, session data, directory history. `chrome.storage.session` for transient CAPTCHA job data and request queues.
- **Remote connections:** All API communication goes through `my.jdownloader.org`. Localhost connections to `127.0.0.1:9666` / `localhost:9666` for local JDownloader instances.
- **No third-party data sharing:** The extension does not share data with any third party beyond MyJDownloader.

The privacy policy URL must be provided in the Chrome Web Store listing.

### CWS-05: Extension Description

**Status:** ACTION NEEDED

Update the Chrome Web Store listing description to reflect MV3 features. Remove any references to the native messaging helper. Emphasize browser-based CAPTCHA solving.

### CWS-06: Screenshots

**Status:** ACTION NEEDED

At least 2 screenshots are required for the Chrome Web Store listing. Recommended:
1. Extension popup showing login/device selection
2. Context menu "Download with JDownloader" with in-page toolbar
3. (Optional) CAPTCHA solving tab showing reCAPTCHA widget

### Additional Recommended Cleanup

- [ ] Delete `scripts/services/CaptchaNativeService.js` (file on disk, no longer loaded)
- [ ] Delete `captcha-helper/` directory (abandoned native messaging host)
- [ ] Fix postMessage wildcard in `webinterfaceEnhancer.js` line 54 (replace `"*"` with `"https://my.jdownloader.org"`)
- [ ] Remove dead code in `webinterfaceEnhancer.js` lines 56-64 (unreachable captcha-done branch)
- [ ] Fix `autograbber-indicator.html` script tag (points to directory, not file)

---

## 8. Summary of Findings

| # | Area | Category | Finding | Severity |
|---|------|----------|---------|----------|
| 1 | Permissions (CWS-01) | PASS | All 7 permissions justified; `nativeMessaging` removed | -- |
| 2 | Code Safety (CWS-03) | FINDING | `require.js:2140` restricted construct in dead code path | Low |
| 3 | Code Safety (CWS-03) | PASS | `angular.js:1292` CSP probe bypassed by ng-csp | -- |
| 4 | Code Safety (CWS-03) | PASS | `angular.js:16548` ASTCompiler bypassed by ng-csp | -- |
| 5 | Code Safety (CWS-03) | FINDING | `rx.all.js:21` Function constructor fallback (short-circuited) | Low |
| 6 | CSP (CWS-04) | VERIFIED PASS | Runtime test: zero CSP violations on all 5 pages | -- |
| 7 | postMessage (CWS-07) | FINDING | `webinterfaceEnhancer.js:54` wildcard origin | Low |
| 8 | Privacy Policy (CWS-02) | ACTION NEEDED | Must be created and hosted | Required |
| 9 | Description (CWS-05) | ACTION NEEDED | Update for MV3 | Required |
| 10 | Screenshots (CWS-06) | ACTION NEEDED | At least 2 required | Required |
| 11 | Dead Code | FINDING | `webinterfaceEnhancer.js:56-64` unreachable branch | Informational |
| 12 | Dead Code | FINDING | `autograbber-indicator.html` broken script tag | Informational |
| 13 | Dead Code | FINDING | `CaptchaNativeService.js` on disk but unloaded | Informational |

**Overall: The extension is MV3 compliant. No blocking issues for submission.** The three ACTION NEEDED items (privacy policy, description, screenshots) are store listing requirements, not code compliance issues.

---

*Report generated as part of Phase 6: MV3 Compliance Audit*
*Extension version: 2026.02.24 | Manifest V3*
