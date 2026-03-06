# Pitfalls Research

**Domain:** Chrome MV3 Extension (JDownloader integration with native messaging, AngularJS UI, service worker)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Service Worker State Loss on Termination

**What goes wrong:**
The `requestQueue` object in `background.js` (line 27) and `requestIDCounter` (line 28) are held in global variables. Chrome terminates the service worker after 30 seconds of inactivity. When the user right-clicks a link after a pause, the service worker wakes up with an empty `requestQueue`, and previously stacked links are gone. The 4-minute keepalive alarm (line 594) only fires periodically -- between alarms, the 30-second idle timer still runs and Chrome terminates the worker if no events arrive. The `cnlRequestQueue` (line 546) is also memory-only.

**Why it happens:**
MV3 service workers are not persistent background pages. Global variables are destroyed on termination and re-initialized as empty on wake. The current code initializes `requestQueue = {}` at module scope with no restoration from persistent storage. Chrome's official documentation states: "After 30 seconds of inactivity, receiving an event or calling an extension API resets this timer."

**How to avoid:**
1. Persist `requestQueue` to `chrome.storage.session` (not `local` -- session data clears on browser close, which is correct for transient link queues)
2. On service worker startup, restore from `chrome.storage.session` before processing any messages
3. After every `requestQueue` mutation (add, remove, clear), write back to storage
4. Use `chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` if content scripts need direct queue access
5. Do NOT use `chrome.storage.local` for this -- link queues should not persist across browser restarts

**Warning signs:**
- Right-click a link, wait 2 minutes (no other extension interaction), right-click another link. If toolbar shows only 1 link, state was lost
- In DevTools service worker panel: observe "Idle" and "Terminated" lifecycle states between user actions
- Add `console.log("SW WAKE: requestQueue size=", Object.keys(requestQueue).length)` at top of background.js -- if this logs 0 when it should not, state was lost

**Phase to address:**
Must be addressed in the bug-fix phase (multi-link stacking), before any feature work that relies on `requestQueue`

---

### Pitfall 2: Chrome Web Store Rejection for `<all_urls>` Without Adequate Justification

**What goes wrong:**
The manifest requests `"host_permissions": ["<all_urls>", ...]` (manifest.json line 65). Extensions with `<all_urls>` receive extended manual review and are frequently rejected under the "Use of Permissions" policy (Purple Potassium violation). Broad host permissions combined with `nativeMessaging` + `tabs` + `scripting` + `offscreen` permissions create a high-scrutiny profile. Reviews can take 1-3 weeks instead of 1-3 days.

**Why it happens:**
`<all_urls>` is required for three legitimate features: context menu on all pages, toolbar injection into any page via `chrome.scripting.executeScript()`, and CNL interception on any page. But reviewers see a broad permission without automatic knowledge of its necessity.

**How to avoid:**
1. Fill out the Chrome Web Store "Permission Justification" field for every permission:
   - `<all_urls>`: context menu on all pages, toolbar injection into any page user triggers it from, CNL interception from any page
   - `nativeMessaging`: CAPTCHA solver helper (Rust binary with WebView2)
   - `tabs`: reading tab URLs for CAPTCHA flow routing (Rc2Service.js line 322 accesses `tabInfo.url`)
   - `scripting`: programmatic content script injection for toolbar
   - `offscreen`: JDownloader API operations requiring DOM/localStorage (RequireJS + jdapi)
   - `declarativeNetRequest`: CNL request interception rules
2. Write a clear "Single Purpose" description
3. Include screenshots showing each feature in action
4. Provide a privacy policy URL covering data handling (missing = immediate "Purple Lithium" rejection)
5. Consider moving `<all_urls>` to `optional_host_permissions` with `activeTab` -- but this changes UX (runtime permission prompts)

**Warning signs:**
- Review takes longer than 3 days -- expect permission questions
- Rejection email citing "Use of Permissions" policy
- Chrome DevTools shows excessive permission warnings at `chrome://extensions`

**Phase to address:**
MV3 compliance audit phase, before Chrome Web Store submission

---

### Pitfall 3: RequireJS `eval()` Causing CSP Violation or Store Rejection

**What goes wrong:**
RequireJS at `vendor/js/require.js` line 2140 contains `return eval(text)`. MV3 extensions cannot include `unsafe-eval` in their CSP -- Chrome blocks it at install time with: "'content_security_policy.extension_pages': Insecure CSP value 'unsafe-eval' in directive 'script-src'." Even if this code path never executes, Chrome Web Store automated review may flag it as a code policy violation (Blue Argon). The `eval()` exists in code loaded by three extension pages: popup.html (line 75), toolbar.html (line 35), and offscreen.html (line 29).

**Why it happens:**
RequireJS is a 2013-era module loader that uses `eval()` for its text plugin. The extension relies on RequireJS exclusively in `offscreen.js` (line 29: `require(['jdapi'], ...)`) to load the jdapi module. The `ng-csp` directive prevents AngularJS from using eval, but RequireJS has its own independent eval path.

**How to avoid:**
1. Set a breakpoint at require.js:2140 to determine if eval is actually triggered during normal use
2. If eval IS triggered: pre-bundle jdapi and dependencies; remove RequireJS from offscreen document
3. If eval is NOT triggered: patch line 2140 to `throw new Error("eval not allowed in MV3")` so any future invocation fails loudly
4. In Chrome Web Store submission, note in "Additional Notes" that RequireJS is bundled but eval() is not invoked
5. Long-term: remove RequireJS entirely; replace with modern ES module bundling

**Warning signs:**
- Console CSP violation warnings in popup.html, toolbar.html, or offscreen.html DevTools
- Store review feedback mentioning "remotely-hosted code" or "eval()"
- Offscreen document `jdapi` module fails to load silently

**Phase to address:**
Must be investigated during MV3 compliance audit phase; if eval executes, fix before submission

---

### Pitfall 4: Double CAPTCHA Job Sending

**What goes wrong:**
In `Rc2Service.js` lines 231-271, `onNewCaptchaAvailable()` sends the CAPTCHA job to the native helper via `CaptchaNativeService.sendCaptcha()`. If the native helper rejects (not installed, crashes, partial failure), the `.catch()` block falls back to sending the same job to the web interface via `postMessage` to my.jdownloader.org tabs. There is a timing window where the native helper starts (opens a WebView2 window) but then fails, causing the catch handler to also dispatch to the web interface -- two solving windows for one CAPTCHA.

**Why it happens:**
`chrome.runtime.sendNativeMessage()` is async with a single response callback. The native helper may partially succeed (open window) before failing (WebView2 init error), triggering both the "opened" action and eventually an error response that activates the catch handler.

**How to avoid:**
1. Add a `captchaInProgress` map keyed by `captchaId` that prevents duplicate dispatch
2. Before falling back to web interface, call `CaptchaNativeService.checkStatus()` to confirm native helper is truly unavailable
3. Add a short delay (500ms) before fallback to let the native helper either succeed or fail cleanly
4. Clear the `captchaInProgress` flag on solved/skipped/timeout/error

**Warning signs:**
- Two CAPTCHA windows appearing for the same challenge
- JDownloader receiving two token submissions
- Kill native helper binary mid-CAPTCHA; observe fallback behavior

**Phase to address:**
Bug fix phase -- documented in CONCERNS.md

---

### Pitfall 5: Native Helper Panics Crash Without Error Response

**What goes wrong:**
The Rust native helper uses `.unwrap()` on message serialization and I/O operations in `webview.rs` lines 107-108 and 130. If serialization fails or stdout write fails, the process panics and terminates without sending an error response. The extension receives `chrome.runtime.lastError: "Native host has exited"` with no structured error information, and the CAPTCHA job hangs indefinitely because `CaptchaNativeService.sendCaptcha()` has no timeout.

**Why it happens:**
Rust's `.unwrap()` on a `Result` type panics on `Err`. The native messaging protocol requires writing a 4-byte length prefix followed by JSON to stdout. A panic before this write produces no response.

**How to avoid:**
1. Replace all `.unwrap()` in message I/O paths with `.map_err()` that logs to stderr and writes an error response before exiting
2. In `CaptchaNativeService.sendCaptcha()`, add a timeout wrapper: if no response within 10 seconds, reject the promise and trigger fallback
3. Wrap the top-level message loop with `std::panic::catch_unwind()` to catch panics
4. Write a structured error response before exiting: `{"status": "error", "error": "internal error"}`

**Warning signs:**
- CAPTCHA jobs hang indefinitely with no response
- "Native host has exited" in chrome://extensions error log
- Solve flow stuck in "loading" state with no timeout

**Phase to address:**
Bug fix phase -- documented in CONCERNS.md

---

### Pitfall 6: CAPTCHA Token Lost When Popup Context Closes

**What goes wrong:**
CAPTCHA solving can take 30 seconds to several minutes (user must interact with the challenge). `CaptchaNativeService.sendCaptcha()` runs in the popup context (popup.html loads Rc2Service.js and CaptchaNativeService.js). The popup closes when the user clicks away. The native helper was launched via `chrome.runtime.sendNativeMessage()` from the popup context, and the response callback is bound to that context. Once the popup closes, the callback is garbage collected and the solved token has no handler.

**Why it happens:**
The popup is an ephemeral UI context -- it lives only while the popup is visible. Native messaging calls and their response callbacks are scoped to the initiating context's lifetime. When the popup closes, pending callbacks are destroyed. Note: native messaging connections keep the *service worker* alive (Chrome 105+), but the popup is not a service worker.

**How to avoid:**
1. Move CAPTCHA native messaging to the service worker (background.js). The service worker stays alive while a native messaging connection is active
2. Have the popup send a message to the service worker requesting CAPTCHA dispatch; the service worker handles `sendNativeMessage()` and its response
3. Store CAPTCHA job metadata in `chrome.storage.session` so the service worker can reconstruct context after any disruption
4. Backup path: when native helper responds, if original callback is gone, write the result to storage and let any active context pick it up

**Warning signs:**
- Solve a CAPTCHA while the popup is closed; check if token reaches JDownloader
- Monitor service worker state during CAPTCHA solving in `chrome://extensions`
- "Native host has exited" without corresponding token submissions

**Phase to address:**
CAPTCHA E2E testing phase; architectural change needed

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping RequireJS for jdapi loading | No refactoring needed; jdapi loads fine | eval() risk for CWS review; unmaintained since 2013; CSP fragility | Until CWS submission; must be audited before publishing |
| AngularJS with ng-csp | Working UI without framework migration | 30% slower template evaluation; no security updates since 2018; eval/Function in library code | Acceptable for this milestone; migration is out of scope |
| Global variables in background.js for state | Simple code; easy to understand | State loss on SW termination; race conditions between contexts | Never acceptable in MV3 -- must persist to storage |
| `$timeout(fn, 0)` wrappers everywhere | Quick fix for digest cycle issues | Brittle; easy to forget on new code; hard to audit completeness | Acceptable AngularJS pattern but create a helper function to standardize |
| XHR requests without abstraction in Rc2Service | Direct and simple per-endpoint code | 5 independent XHR creation sites; no shared retry/timeout/error handling | Acceptable short-term; consolidate when adding new HTTP calls |

## Integration Gotchas

Common mistakes when connecting to external services and Chrome APIs.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| chrome.runtime.sendNativeMessage() | Assuming synchronous or fast response; no timeout handling | Add timeout wrapper; handle "Native host has exited" error; verify host is registered on startup |
| chrome.offscreen.createDocument() | Assuming document JS is ready immediately after creation | Add readiness handshake: poll with `offscreen-ping` until `{ ready: true, hasApi: true }` before sending commands |
| chrome.storage.local concurrent access | Read-modify-write from multiple contexts (popup + toolbar) | Use direct `chrome.storage.local.set({ key: value })` which merges atomically; avoid read-all/modify/write-all pattern for new code |
| chrome.storage.session | Content scripts cannot access by default | Call `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` if needed; otherwise route through service worker messaging |
| JDownloader API via offscreen | Assuming session persists across SW restarts | Store session in chrome.storage.local (already done); restore in offscreen on creation; add reconnection with readiness check |
| chrome.tabs.sendMessage() | Assuming content script is loaded in target tab | Catch error, inject script via chrome.scripting.executeScript, retry (background.js already handles this correctly) |
| Offscreen document API access | Assuming full Chrome API availability in offscreen | Offscreen documents can only use chrome.runtime for messaging; route all other API calls through service worker |
| Native messaging host name | Mismatch between registry key, manifest JSON `name` field, and `sendNativeMessage()` first argument | All three values must match exactly: `org.jdownloader.captcha_helper`; add startup health check |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Device list query on every tab update (Rc2Service.js line 327) | High API traffic; slow response times | Cache device list with 5-min TTL; refresh only on CONNECTION_STATE_CHANGE or manual refresh | When user has multiple RC2JDT-pattern tabs open |
| 1-second polling for CAPTCHA tab close check (Rc2Service.js line 183) | 1 HTTP request/second per active CAPTCHA tab | Increase to 5 seconds; or replace with event-based notification from native helper | When multiple CAPTCHAs are queued simultaneously |
| Unbounded requestQueue per tab | Memory growth; chrome.storage.session 10MB quota exceeded if persisted | Cap at 100 items per tab; add age-based cleanup (entries older than 1 hour) | Bulk link addition on sites with many download links |
| chrome.storage.session 10MB total quota | Write failures; silent data loss | Monitor total size before writing; compress or trim oldest entries | When many tabs accumulate large queues simultaneously |
| Tab update listener scanning all updates (Rc2Service.js lines 315-349) | CPU overhead on every tab URL change | Add early exit for non-RC2JDT URLs; cache last matched tab ID | User with hundreds of open tabs |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| postMessage with wildcard origin (`"*"`) in webinterfaceEnhancer.js line 54 | Any frame on the page can intercept CAPTCHA messages and tokens | Replace `"*"` with `"https://my.jdownloader.org"`; validate `event.origin` in message listener |
| RequireJS eval() in extension pages | Code injection risk if eval path is triggered with attacker-influenced input | Patch eval() to throw; or remove RequireJS; or move jdapi to sandboxed page |
| Test reCAPTCHA site keys committed to repository | Test keys always pass validation; if used in production, CAPTCHA is bypassed | Use .env files for real keys; .gitignore them; use Google's official test keys for automated tests |
| Native messaging host binary not code-signed | Users or malware could replace binary with a malicious executable | Consider Authenticode signing for release builds; document expected binary hash |
| HTTP callbacks to localhost without TLS (127.0.0.1:9666) | CAPTCHA tokens transmitted unencrypted | Acceptable -- localhost traffic never leaves machine; tokens are single-use and short-lived |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| HTML `<datalist>` for directory history | Users cannot click to browse all options; must type to filter; inconsistent rendering across browsers | Use custom Bootstrap dropdown with `ng-repeat` if "browse all entries" UX is required; or accept `<datalist>` type-to-filter behavior |
| Silent native helper failure | No CAPTCHA window appears, no error shown; downloads stuck indefinitely | Show user-visible error: "CAPTCHA helper not found. Please install it." with instructions link |
| Service worker state loss with no notification | User loses stacked links silently between right-clicks | Persist to storage; if restoration fails, show badge/console warning |
| CAPTCHA token lost when popup closes | User solves CAPTCHA but token never reaches JDownloader; download stuck | Move native messaging to service worker context; SW stays alive during native connections |
| Directory history showing stale data after storage update | AngularJS digest not triggered; UI appears empty until user clicks elsewhere | Wrap all chrome.storage callbacks in `$timeout(fn, 0)` to trigger digest cycle |
| Directory paths case-sensitive on Windows | "C:\Downloads" and "c:\downloads" appear as duplicates in history | Normalize with toLowerCase() for deduplication; display original case |
| Privacy policy missing from CWS listing | Immediate rejection (Purple Lithium violation) | Create privacy policy before submission; must cover credential handling, URL data, storage usage, no tracking |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Multi-link stacking:** Verify links survive service worker restart (not just work in a single session)
- [ ] **Multi-link stacking:** Verify queue is cleared when tab navigates to a completely different domain
- [ ] **Multi-link stacking:** Verify toolbar iframe receives updates when new links are added while toolbar is already open
- [ ] **Directory history dropdown:** Verify UI updates immediately after chrome.storage callback (AngularJS digest triggered)
- [ ] **Directory history dropdown:** Verify history cap (max 10 entries) is enforced; test with 15+ entries
- [ ] **Directory history clear button:** Verify user gets confirmation or undo option before clearing all history
- [ ] **CAPTCHA E2E flow:** Verify timeout handling -- what happens when user never solves (5-min native helper timeout)
- [ ] **CAPTCHA E2E flow:** Verify token submission when popup is closed during solving
- [ ] **CAPTCHA E2E flow:** Verify skip buttons (hoster/package/all/single) reach JDownloader correctly
- [ ] **CAPTCHA E2E flow:** Verify native helper works in headed mode only (WebView2 needs display)
- [ ] **Native helper registration:** Verify helper responds to `status` check before first CAPTCHA job on fresh install
- [ ] **CWS submission:** Verify privacy policy URL is provided and covers all data handling
- [ ] **CWS submission:** Verify listing has at least 2 screenshots showing core features
- [ ] **CWS submission:** Verify every permission has written justification in the CWS dashboard
- [ ] **CWS submission:** Verify no console CSP warnings on any extension page (popup, toolbar, offscreen)
- [ ] **CWS submission:** Verify extension description accurately describes all features (mismatch = Yellow Magnesium rejection)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service worker state loss (1) | LOW | Add chrome.storage.session persistence; ~50 lines of code change; existing code structure supports this |
| CWS rejection for permissions (2) | MEDIUM | Write detailed justifications; resubmit; expect 1-3 week review cycle per resubmission |
| RequireJS eval() flagged (3) | MEDIUM | Patch require.js line 2140 to throw; or pre-bundle jdapi without RequireJS; or move to sandbox page |
| Double CAPTCHA send (4) | LOW | Add captchaInProgress flag and guard; ~20 lines of code change |
| Native helper panic (5) | LOW | Replace .unwrap() with .map_err() error handling; ~10 lines per occurrence in Rust |
| CAPTCHA token lost on popup close (6) | HIGH | Requires moving CAPTCHA messaging from popup context to service worker; architectural refactor affecting Rc2Service, CaptchaNativeService, and background.js |
| Offscreen init race (Integration Gotcha) | LOW | Add readiness handshake with retry loop; ~30 lines in background.js sendToOffscreen() |
| AngularJS digest missed (UX Pitfall) | LOW | Wrap callback in $timeout; ~1 line per occurrence once identified |
| Storage race condition (Tech Debt) | LOW | Low probability in practice; switch to direct chrome.storage.local.set() for new code |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SW state loss (1) | Multi-link stacking / Bug fixes | Right-click link, wait 2 min, right-click another; both appear in toolbar |
| CWS permissions (2) | MV3 compliance audit | All permission justifications written; reviewed before submission |
| RequireJS eval (3) | MV3 compliance audit | No CSP warnings in any extension page console; eval path confirmed dead or removed |
| Double CAPTCHA (4) | Bug fixes | Kill native helper mid-CAPTCHA; only one fallback window appears |
| Native panic (5) | Bug fixes | Send malformed request to helper; structured error response received (not crash) |
| Token lost on popup close (6) | CAPTCHA E2E testing | Solve CAPTCHA with popup closed; token reaches JDownloader |
| Offscreen init race | Bug fixes | Cold start extension; first API call succeeds without "not initialized" error |
| Storage race condition | Directory history feature | Rapid saves from toolbar and popup; all history entries preserved |
| AngularJS digest | Directory history feature | Load history from storage; verify it renders immediately without user interaction |
| postMessage wildcard origin | MV3 compliance audit | postMessage uses specific origin string, not wildcard |
| Queue growth | Multi-link stacking | Add 100+ links to one tab; oldest are pruned; storage write succeeds |
| Native host registry mismatch | CAPTCHA E2E testing | Fresh install; native helper responds to status check before first CAPTCHA job |
| Test key leak | CAPTCHA E2E testing | No reCAPTCHA site keys in committed code; .env file in .gitignore |
| Privacy policy missing | MV3 compliance audit | Privacy policy URL set in CWS listing before first submission |
| Toolbar iframe update routing | Multi-link stacking | Right-click link A, toolbar opens; right-click link B; both A and B visible |

## Sources

- [The extension service worker lifecycle - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- termination rules: 30s idle, 5min single request, native messaging keeps SW alive
- [Troubleshooting Chrome Web Store violations](https://developer.chrome.com/docs/webstore/troubleshooting) -- rejection codes: Purple Potassium (permissions), Blue Argon (code policy), Red Titanium (obfuscation), Yellow Magnesium (broken functionality), Purple Lithium (disclosure required)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process) -- review timelines, permission scrutiny, triggers for extended review
- [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage) -- session storage, access levels, no transaction support
- [Native messaging - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) -- protocol requirements, host name matching rules, connection keepalive
- [chrome.offscreen API reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen) -- single document limitation, API access restrictions (only chrome.runtime)
- [Manifest V3 Content Security Policy](https://developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy/) -- unsafe-eval prohibition in MV3
- [Concurrent update of chrome.storage.local - Chromium Extensions Group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/y5hxPcavRfU) -- storage race condition discussion, no transaction support
- [Fixing Intermittent Auth Failures in Chrome Manifest V3 - Tweeks](https://www.tweeks.io/blog/auth-mv3-architecture) -- multi-context state management patterns
- [Why Chrome Extensions Get Rejected - Extension Radar](https://www.extensionradar.com/blog/chrome-extension-rejected) -- 15 common rejection reasons with remediation
- [Debug Native Messaging - text/plain](https://textslashplain.com/2022/01/08/debug-native-messaging/) -- native messaging debugging: I/O mode, message format, registry
- [Chrome Extensions: eyeo's journey to testing service worker suspension](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension) -- testing SW suspension patterns
- [Permission warning guidelines - Chrome for Developers](https://developer.chrome.com/extensions/permission_warnings) -- permission justification requirements
- Existing codebase concerns: `.planning/codebase/CONCERNS.md` -- known bugs, tech debt, test coverage gaps

---
*Pitfalls research for: Chrome MV3 JDownloader Extension*
*Researched: 2026-03-06*
