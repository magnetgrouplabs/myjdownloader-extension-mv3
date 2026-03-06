# Codebase Concerns

**Analysis Date:** 2026-03-06

## Tech Debt

**FilterService Custom Filter Sets Not Implemented:**
- Issue: Line 6 in `scripts/services/FilterService.js` contains empty TODO comment for `customFilterSets` variable
- Files: `scripts/services/FilterService.js`
- Impact: Custom file extension filters cannot be created by users; the infrastructure exists but is incomplete
- Fix approach: Implement persistence of custom filter sets to `chrome.storage.local`, add UI in settings page to create/edit filters

**API Error Parsing Incomplete:**
- Issue: Line 145 in `scripts/services/ApiErrorService.js` has empty try-catch for JSON parse error
- Files: `scripts/services/ApiErrorService.js`
- Impact: If API response contains invalid JSON, error is silently ignored with no logging or recovery
- Fix approach: Add console.error() to log parse failures; consider fallback error type or add metrics

**Skip Request API Method Incomplete:**
- Issue: Line 281 in `scripts/services/Rc2Service.js` has TODO: "Send via API" for MYJD skip requests
- Files: `scripts/services/Rc2Service.js`
- Impact: When skipping CAPTCHA through My.JDownloader web interface, the skip request is never sent back; only works for local JDownloader HTTP callbacks
- Fix approach: Implement API method to send skip requests when `callbackUrl === "MYJD"`, similar to how token submission works (lines 37-57 in `scripts/services/CaptchaNativeService.js`)

## Known Bugs

**Rc2Service Duplicate URL Pattern in Tab Query:**
- Symptoms: When skipping CAPTCHA via web interface, tab query may fail to find correct tab
- Files: `scripts/services/Rc2Service.js` lines 195-199
- Details: Array contains duplicate `"http://my.jdownloader.org/*"` entries (http appears twice):
  ```javascript
  url: [
    "http://my.jdownloader.org/*",
    "https://my.jdownloader.org/*",
    "http://my.jdownloader.org/*"  // DUPLICATE
  ]
  ```
- Trigger: User skips CAPTCHA while My.JDownloader web interface is open
- Impact: Second duplicate entry is harmless but indicates copy-paste error
- Fix: Remove one of the duplicate `http://my.jdownloader.org/*` entries

**Double CAPTCHA Job Send in Rc2Service:**
- Symptoms: When CAPTCHA is detected from web interface, job may be sent twice
- Files: `scripts/services/Rc2Service.js` lines 231-271
- Details: Function `onNewCaptchaAvailable()` calls `CaptchaNativeService.sendCaptcha()` but also has fallback code (lines 252-271) that sends the same job via postMessage to web interface, potentially duplicating work
- Trigger: Native helper fails/rejects for any reason
- Impact: User sees two CAPTCHA windows or duplicated solving attempts
- Workaround: None currently - both flows execute if native helper fails
- Fix approach: Either ensure native helper is always available, or make fallback async and prevent double-sending

**Webview Panic on Message Send Errors:**
- Symptoms: If native helper message writing fails, unwrap() in `webview.rs` causes panic
- Files: `captcha-helper/src/webview.rs` lines 107-108, 130
- Details: Code uses `.unwrap()` on message serialization and write operations without error handling
- Trigger: Stdin/stdout communication fails (process pipe broken, permission denied)
- Impact: Native helper crashes without sending error response to extension
- Fix approach: Replace `unwrap()` with proper error handling; log error and send error response to extension

## Security Considerations

**CAPTCHA Token URL Encoding Missing:**
- Risk: Token with special characters (e.g., `&`, `=`, `%`) could break callback URL parsing
- Files: `scripts/services/CaptchaNativeService.js` line 60
- Current code: `const url = callbackUrl + '&do=solve&response=' + encodeURIComponent(token);`
- Current mitigation: Tokens are base64-like alphanumeric strings in practice (no special chars observed)
- Recommendations: Keep `encodeURIComponent()` call (already present) - this is correct. Code is safe.

**PostMessage Wildcard Origin in Web Interface Integration:**
- Risk: Messages from extension can be intercepted by any frame on the page
- Files: `contentscripts/webinterfaceEnhancer.js` line 54
- Current implementation: `window.postMessage(msg, "*");`
- Impact: Low - message content is CAPTCHA responses and status updates, not sensitive
- Mitigation: Required for cross-origin communication with my.jdownloader.org (different origin than extension context)
- Recommendations: Consider narrowing to specific origin if API allows; monitor for CAPTCHA data leakage

**HTTP Localhost Callbacks Without TLS:**
- Risk: CAPTCHA tokens transmitted over unencrypted HTTP
- Files: `scripts/services/CaptchaNativeService.js` line 61, `captcha-helper/src/webview.rs` line 59
- Current implementation: JDownloader API runs on `http://127.0.0.1:9666`
- Mitigation: Localhost traffic never leaves machine; tokens are short-lived and single-use
- Recommendations: This is acceptable for local API. No action needed.

**Broad Host Permission `<all_urls>`:**
- Risk: Extension can inject content scripts into any website
- Files: `manifest.json` line 65
- Purpose: Required for context menu on all pages, toolbar injection, CNL interception
- Mitigation: Content scripts run in isolated worlds; cannot access page JavaScript directly
- Recommendations: Monitor for abuse reports; document permission justification (already present in SECURITY.md)

## Performance Bottlenecks

**Rc2Service Polling Interval - 1 Second Overhead:**
- Problem: Tab close check polls every 1000ms (line 183 in `scripts/services/Rc2Service.js`)
- Files: `scripts/services/Rc2Service.js` line 183
- Cause: Periodic HTTP requests to localhost check if CAPTCHA window can close
- Impact: 1 HTTP request per second per active CAPTCHA tab; small but unnecessary overhead
- Measurement: No metrics collected; assume <10ms per request on localhost
- Improvement path: Replace polling with event-based close notification from native helper; or increase interval to 5000ms if polling is required

**Device List Query on Every Tab Update:**
- Problem: Line 327 in `scripts/services/Rc2Service.js` calls `getDeviceList()` and then queries every device for every URL change in RC2JDT tabs
- Files: `scripts/services/Rc2Service.js` lines 327-343
- Cause: No memoization; queries API even if device list hasn't changed
- Impact: High API traffic if RC2JDT URL pattern appears frequently
- Improvement path: Cache device list with 5-minute TTL; only refresh on manual "refresh" button or on CONNECTION_STATE_CHANGE

**XHR Requests Not Pooled in Rc2Service:**
- Problem: Multiple XMLHttpRequest instances created without reuse (lines 75, 115, 125, 153, 283 in `scripts/services/Rc2Service.js`)
- Files: `scripts/services/Rc2Service.js`
- Cause: No HTTP client abstraction; each callback creates new XHR
- Impact: Small - XMLHttpRequest is lightweight, but violates DRY principle
- Improvement path: Create `HttpCallbackService` wrapper to consolidate logic; add retry and timeout utilities

## Fragile Areas

**Rc2Service - Multiple Callback URL Comparison Patterns:**
- Files: `scripts/services/Rc2Service.js` lines 176, 182, 279
- Why fragile: Multiple identical string checks `!== "undefined"` and `!== "MYJD"` scattered throughout; if callback format changes, all locations must be updated
- Safe modification: Extract validation into function `isValidCallbackUrl(url)` (e.g., `validateCallbackUrl` in test at line 142); reuse everywhere
- Test coverage: CaptchaNativeService has tests for URL validation (CaptchaNativeService.test.js lines 141-185), but Rc2Service has no unit tests

**CaptchaNativeService.js - Promise Chain Complexity:**
- Files: `scripts/services/CaptchaNativeService.js` lines 74-109
- Why fragile: Nested promise chains with multiple error paths; if response format changes, silent failures occur
- Safe modification: Convert to async/await for clarity; add explicit logging at each step
- Test coverage: Only basic message format tests exist; no integration tests with actual Chrome API

**Native Helper Message Serialization Unwraps:**
- Files: `captcha-helper/src/main.rs` line 9, `captcha-helper/src/webview.rs` lines 107, 130
- Why fragile: `.unwrap()` on serde_json serialization will panic if serialization fails; no graceful error path
- Safe modification: Use `.map_err()` to convert to error response; log error details
- Test coverage: Integration tests exist but may not cover serialization edge cases

**webinterfaceEnhancer.js - Unreliable Message Routing:**
- Files: `contentscripts/webinterfaceEnhancer.js`
- Why fragile: Relies on postMessage to communicate with my.jdownloader.org; no ACK mechanism to confirm receipt
- Safe modification: Add response handler to postMessage (third parameter is callback in some cases); add timeout for unresponsive frames
- Test coverage: No tests for cross-origin communication

## Scaling Limits

**RequestQueue Memory Growth - No Cleanup for Long-Lived Browsers:**
- Current capacity: Unlimited per-tab; grows with number of tabs and links added
- Files: `background.js` lines 27, 587-589
- Limit: Browser RAM; unbounded in theory but cleanup on tab close helps
- Risk: If user leaves many tabs open indefinitely, request queue can grow large
- Scaling path: Implement age-based cleanup (remove links older than 1 hour); add storage limit (max 1000 items per tab); persist to IndexedDB if quota needed

**Service Worker Termination on Inactivity:**
- Current: 4-minute keepalive alarm (background.js line 594)
- Limit: Chrome may terminate service worker earlier; background context is non-persistent
- Risk: If toolbar operations take >4 minutes, background.js may be garbage-collected mid-operation
- Scaling path: Monitor actual service worker terminations; consider explicit request from toolbar to keep alive; use longer keepalive if feasible

**Rc2Service Tab Update Listener - Scales Linearly with Tabs:**
- Files: `scripts/services/Rc2Service.js` lines 315-349
- Current: One listener for ALL tab updates; checks every update against RC2JDT pattern
- Limit: Performance degrades if user has hundreds of tabs
- Improvement path: Add early exit for non-RC2JDT URLs; cache last matched tab to reduce regex tests

## Dependencies at Risk

**RequireJS 2.x - Unmaintained Library:**
- Risk: Last release 2013; no security updates for 13 years
- Files: `vendor/js/require.js`
- Impact: Contains `eval()` (line 2140) which is CSP-violating in strict contexts
- Mitigation: Bypassed with `ng-csp` directive; only evaluates extension-packaged modules
- Migration plan: Replace with native ES6 `import`/`require()` or modern bundler (Webpack, Vite); long-term goal but not urgent since library only loads extension code

**AngularJS 1.6.x - Obsolete Framework:**
- Risk: Angular 1.x is no longer maintained; last release 2018
- Files: `vendor/js/angular.js`
- Impact: Contains `eval()` and `new Function()` calls for template evaluation
- Mitigation: Disabled via `ng-csp` directive in HTML templates
- Migration plan: Replace with modern framework (React, Vue, Svelte) when rewriting UI; significant effort; not blocking MV3

**Wry 0.40 WebView2 Binding - Version Pinned:**
- Risk: Wry 0.40 released 2024; newer versions may have security fixes
- Files: `captcha-helper/Cargo.toml` line 11
- Current version: Fixed at `0.40`
- Recommendation: Consider upgrade to latest wry with review of breaking changes; add `cargo update` to CI/CD pipeline

**Tao 0.26 Window Framework - Older Version:**
- Risk: Tao 0.26 released 2024; newer versions may have stability improvements
- Files: `captcha-helper/Cargo.toml` line 12
- Recommendation: Keep synchronized with Wry updates; test on Windows 10/11 for compatibility

## Missing Critical Features

**No Offline Support:**
- Problem: Extension requires active internet connection to my.jdownloader.org API
- Impact: Cannot use toolbar/context menu if offline; blocks user workflows
- Blocks: Offline browsing scenarios; limited usefulness on cellular/intermittent connections
- Consideration: My.JDownloader service is cloud-based; offline support would require local device mode (not practical)

**No CAPTCHA Auto-Retry on Failure:**
- Problem: If user fails CAPTCHA or closes window, no automatic retry mechanism
- Impact: Single mistake forces user to manually re-trigger CAPTCHA from JDownloader
- Blocks: Smooth user experience for multi-CAPTCHA downloads
- Improvement path: Add "retry" button in webview before timeout; allow skip menu to include "try again" option

**No Bulk Link Operations:**
- Problem: Toolbar only supports adding links one at a time (via multiple context menu clicks)
- Impact: Heavy friction for bulk downloads (e.g., gallery sites)
- Improvement path: Add clipboard paste button; support bulk URL entry in toolbar; add batch-add feature

## Test Coverage Gaps

**Rc2Service - No Unit Tests:**
- What's not tested: Message routing, callback handling, tab state management
- Files: `scripts/services/Rc2Service.js`
- Risk: Regressions in CAPTCHA flow undetected; complex logic with many branches (8 listeners)
- Priority: HIGH - CAPTCHA is core feature
- Recommended tests:
  - Mock chrome.tabs, chrome.runtime
  - Test each listener independently (lines 171-374)
  - Test RC2JDT URL detection and device queries
  - Test fallback when native helper fails

**Background.js - No Unit Tests:**
- What's not tested: Message routing, request queue management, CNL handling
- Files: `background.js`
- Risk: Service worker logic untested; potential race conditions in offscreen coordination
- Priority: HIGH - service worker is critical
- Recommended tests:
  - Mock chrome.* APIs
  - Test message routing (lines 284-541)
  - Test request queue operations (add, remove, cleanup)
  - Test CNL capture and offscreen delegation

**Integration Tests - Limited to Rust Native Helper Only:**
- What's not tested: End-to-end JavaScript<->Rust messaging, WebView2 CAPTCHA window behavior
- Files: `captcha-helper/tests/integration_test.rs` (60 tests for Rust only)
- Risk: Native helper integration issues caught only in manual testing
- Priority: MEDIUM - Rust tests are comprehensive but don't cover Chrome extension interaction
- Recommended tests:
  - Mock native messaging protocol; test extension-to-helper communication
  - Test error responses and timeout handling
  - Test WebView2 window state transitions (opened, solved, skipped, timeout)

**Content Scripts - No Tests:**
- What's not tested: CNL interception, toolbar injection, web interface enhancement
- Files: `contentscripts/cnlInterceptor.js`, `contentscripts/toolbarContentscript.js`, `contentscripts/webinterfaceEnhancer.js`
- Risk: Content script issues only caught in manual browser testing
- Priority: MEDIUM - affects user-facing features
- Recommended tests:
  - Mock chrome.* APIs and postMessage
  - Test CNL request detection and capture
  - Test toolbar injection and message handling
  - Test web interface postMessage communication

**E2E Browser Testing - None:**
- What's not tested: Full user workflows (login, add links, solve CAPTCHA, logout)
- Tools: Playwright, Cypress, or WebDriver could be used
- Risk: Breaking changes in UI or API integration undetected
- Priority: LOW - manual testing covers; automated E2E would improve confidence

---

*Concerns audit: 2026-03-06*
