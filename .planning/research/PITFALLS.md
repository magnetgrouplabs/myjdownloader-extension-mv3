# Domain Pitfalls

**Domain:** Download manager browser extension (JDownloader integration, Chrome MV3)
**Researched:** 2026-03-06

## Critical Pitfalls

Mistakes that cause Chrome Web Store rejection, data loss, or major user-facing breakage.

### Pitfall 1: Chrome Web Store Rejection for Broad Host Permissions
**What goes wrong:** Extension uses `<all_urls>` host permission, which triggers extended review and possible rejection if not justified.
**Why it happens:** Download manager extensions genuinely need broad access (CNL interception on any page, toolbar injection on any page, context menu on any page). But Google reviews this aggressively because malicious extensions abuse broad permissions.
**Consequences:** Rejection delays or requires permission scope reduction, which would break CNL interception.
**Prevention:**
- Document every use of `<all_urls>` in the privacy fields during submission
- Explain that CNL interception must work on any page (standard protocol used by file hosting sites)
- Explain toolbar injection on any page (right-click -> toolbar appears on current page)
- Provide code references showing no browsing history collection or data scraping
- Consider moving `<all_urls>` to optional_host_permissions with runtime permission requests (but this would degrade UX significantly)
**Detection:** Submission enters extended review (>3 days). Review feedback mentions permission scope.

### Pitfall 2: RequireJS eval() Flagged During Review
**What goes wrong:** Chrome Web Store automated scanner or reviewer flags RequireJS's eval() call (line ~2140 in vendor/js/require.js) as a MV3 CSP violation.
**Why it happens:** MV3 prohibits eval() and remote code execution. RequireJS uses eval() internally for module loading. The ng-csp directive prevents AngularJS from using eval(), but RequireJS's eval() is in the vendor code.
**Consequences:** Rejection with "Blue Argon" violation (remotely hosted code / CSP violation).
**Prevention:**
- Test whether RequireJS eval() actually executes in MV3 context (it may not if modules are loaded via script tags instead)
- If it does execute: consider replacing RequireJS with static script tags for jdapi modules
- If it does not execute: document in submission notes that the eval() path is not invoked
- In the worst case: minify/patch RequireJS to remove the eval() call
**Detection:** Automated review rejection mentioning eval() or CSP violation.

### Pitfall 3: Service Worker Termination Loses Request Queue
**What goes wrong:** User right-clicks a link, then takes 30+ seconds before right-clicking another. Service worker terminates. First link is lost because requestQueue is in-memory.
**Why it happens:** MV3 service workers terminate after ~30 seconds of inactivity. The 4-minute keepalive alarm only fires every 4 minutes, not continuously.
**Consequences:** User thinks they queued multiple links but only the most recent one appears in toolbar. Silent data loss.
**Prevention:** Move requestQueue to chrome.storage.session (survives service worker restarts, cleared on browser close) instead of an in-memory variable.
**Detection:** User reports "links disappearing" from toolbar. Hard to reproduce because it depends on timing.

### Pitfall 4: Double CAPTCHA Job Send (Existing Bug)
**What goes wrong:** When native helper fails or rejects, Rc2Service sends the CAPTCHA job to both the native helper AND the web interface, resulting in two solving windows.
**Why it happens:** The catch block in onNewCaptchaAvailable() sends to the web interface as a fallback, but the flow structure allows both paths to execute in race conditions.
**Consequences:** User sees two CAPTCHA windows. Solving one may not cancel the other.
**Prevention:** Add a flag that tracks whether native helper has accepted the job. Only fall back to web interface after a definitive failure.
**Detection:** User reports seeing two CAPTCHA windows. Documented in CONCERNS.md.

## Moderate Pitfalls

### Pitfall 5: Toolbar Iframe Not Receiving Updates After Initial Load
**What goes wrong:** User right-clicks a second link while the toolbar is already open. The toolbar does not update to show the new link.
**Why it happens:** The "link-info-update" message is sent to the content script, but the toolbar iframe may not be listening for it. The ToolbarController only calls updateLinks() on initialization and on explicit "link-info-update" messages routed through chrome.runtime.onMessage.
**Prevention:** Ensure the message routing from background -> content script -> toolbar iframe is working correctly. The content script needs to relay the update into the iframe, or the toolbar needs to listen directly to chrome.runtime.onMessage.
**Detection:** Manual testing: right-click link A, toolbar appears. Right-click link B. Check if B appears in toolbar list.

### Pitfall 6: Privacy Policy Missing = Automatic Rejection
**What goes wrong:** Extension submitted without a privacy policy URL.
**Why it happens:** Developer focuses on code and forgets the administrative requirement.
**Consequences:** Immediate rejection. Must resubmit after creating and hosting a privacy policy.
**Prevention:** Create a privacy policy before starting the submission process. Must disclose: MyJDownloader credentials handling, URL data sent to JDownloader, chrome.storage.local usage, no analytics/tracking.
**Detection:** Rejection email mentioning "Purple Lithium" violation (disclosure required).

### Pitfall 7: Native Helper Panics Crash Without Error Response
**What goes wrong:** If native messaging stdin/stdout fails, the Rust native helper calls .unwrap() which panics and kills the process. Extension receives no error response.
**Why it happens:** Several .unwrap() calls in webview.rs (lines 107-108, 130) on serialization and I/O operations.
**Consequences:** Extension hangs waiting for a native message response that never comes. CAPTCHA solving appears to freeze.
**Prevention:** Replace .unwrap() with proper error handling. Add a timeout in CaptchaNativeService.js that rejects after 5 minutes if no response received.
**Detection:** Extension hangs when CAPTCHA is triggered and native helper encounters an I/O error.

### Pitfall 8: Playwright E2E Tests Fail in Headless Mode
**What goes wrong:** E2E tests are set up to run headless for CI, but Chrome extensions require headed mode.
**Why it happens:** Playwright defaults to headless. Extensions are not supported in headless Chromium.
**Consequences:** CI runs green but tests are not actually testing the extension. False confidence.
**Prevention:** Always set headless: false in Playwright config for extension tests. Accept that extension E2E tests cannot run in headless CI.
**Detection:** Tests pass but don't interact with extension elements. Extension ID is undefined.

## Minor Pitfalls

### Pitfall 9: StorageService.set() Race Condition
**What goes wrong:** Two concurrent set() calls both call getAll(), get the same snapshot, and the second write overwrites the first.
**Why it happens:** StorageService.set() reads all storage, modifies the entire object, then writes it back. Not atomic.
**Prevention:** Use chrome.storage.local.set({ key: value }) directly for atomic merge. Do NOT refactor StorageService in this milestone unless a concrete bug manifests.
**Detection:** Settings or history entries disappear intermittently.

### Pitfall 10: Content Script Injection Timing
**What goes wrong:** User right-clicks a link immediately after page load. Content script has not yet injected. Toolbar fails to appear.
**Why it happens:** Content scripts may not be fully initialized when the first message arrives.
**Prevention:** The background.js fallback injection via chrome.scripting.executeScript handles this. Verify the fallback works during testing. The 100ms setTimeout may need to be increased on slow pages.
**Detection:** Toolbar occasionally fails to appear on first right-click after page load.

### Pitfall 11: Directory History Case Sensitivity on Windows
**What goes wrong:** Same directory stored as both "C:\Downloads" and "c:\downloads" in history, appearing as duplicates.
**Why it happens:** Windows paths are case-insensitive but JavaScript string comparison is case-sensitive.
**Prevention:** Normalize with toLowerCase() for deduplication; display original case to user.
**Detection:** Duplicate entries in directory history dropdown.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Bug fixes (Rc2Service) | Double CAPTCHA send fix may break web interface fallback | Test both paths: native helper success AND native helper failure with web interface open |
| Bug fixes (native helper) | Replacing unwrap() may change error behavior | Run full cargo test suite after changes; test with intentionally broken stdin |
| Multi-link stacking | Toolbar iframe message routing complexity | Test with 1, 2, 5 links, and link removal. Verify across page navigations. |
| Directory history | Case sensitivity on Windows paths | Normalize paths with toLowerCase() for deduplication; display original case |
| CAPTCHA E2E testing | reCAPTCHA may block automated browsers | Use real Chrome (not Chromium) if possible; do not automate CAPTCHA solving |
| MV3 compliance | RequireJS eval() flagged | Test if eval() path is actually hit before submission; have removal plan ready |
| Chrome Web Store submission | First-time submission = longer review | Submit early with basic metadata to establish developer account; iterate on updates |

## Sources

- Chrome Web Store review process: [Chrome for Developers](https://developer.chrome.com/docs/webstore/review-process)
- Chrome Web Store troubleshooting: [Chrome for Developers](https://developer.chrome.com/docs/webstore/troubleshooting)
- Chrome MV3 service worker lifecycle: [Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Playwright Chrome extension testing: [BrowserStack](https://www.browserstack.com/guide/playwright-chrome-extension)
- Existing codebase concerns: .planning/codebase/CONCERNS.md
