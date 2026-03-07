# Requirements: MyJDownloader MV3 Extension — Bug Fixes & Enhancements

**Defined:** 2026-03-06
**Core Value:** Users can right-click links on any page and reliably send them to JDownloader, including bulk operations and CAPTCHA-gated downloads, with the same smooth experience as the original MV2 extension.

## v1 Requirements

### Bug Fixes

- [x] **BUG-01**: Duplicate URL pattern in Rc2Service tab query is removed (only one `*://127.0.0.1*` match)
- [x] **BUG-02**: Double CAPTCHA job send is prevented — `captchaInProgress` guard ensures only one solving context per CAPTCHA ID
- [x] **BUG-03**: Native helper `.unwrap()` panics replaced with error handling that returns structured `{"status":"error"}` responses
- [x] **BUG-04**: Service worker `requestQueue` persists to `chrome.storage.session` and survives termination/restart cycles

### Multi-Link Stacking

- [x] **LINK-01**: Right-clicking multiple links on the same page accumulates them in the toolbar sidebar
- [x] **LINK-02**: Toolbar UI updates in real-time when new links are added to an already-open toolbar
- [x] **LINK-03**: All stacked links can be sent to JDownloader in a single batch operation
- [x] **LINK-04**: Link queue survives service worker termination (30s idle) and is restored on wake
- [x] **LINK-05**: Duplicate links on the same tab are deduplicated
- [x] **LINK-06**: Link queue for a tab is cleared when the tab is closed

### Directory History

- [x] **DIR-01**: "Save to" field shows a dropdown of the last 10 used directories
- [x] **DIR-02**: Directory history is persisted to `chrome.storage.local` and survives browser restarts
- [x] **DIR-03**: Directory entries are deduplicated case-insensitively (Windows paths)
- [x] **DIR-04**: Clear history button removes all saved directories
- [x] **DIR-05**: Most recently used directory appears first in the dropdown

### Web Tab CAPTCHA (Cross-Platform Fallback)

- [x] **CAP-01**: Content script injected on `http://127.0.0.1/*` detects JDownloader CAPTCHA pages via URL path pattern
- [x] **CAP-02**: Content script polls `g-recaptcha-response` / `h-captcha-response` textarea for solved tokens (500ms interval)
- [ ] **CAP-03**: Solved token is relayed to service worker via `chrome.runtime.sendMessage`
- [ ] **CAP-04**: Service worker submits token to JDownloader callback URL via HTTP
- [x] **CAP-05**: Skip buttons (hoster/package/all/single) injected into CAPTCHA page via content script
- [x] **CAP-06**: 5-minute timeout countdown displayed on CAPTCHA page; auto-skips on expiry
- [ ] **CAP-07**: Closing the CAPTCHA tab triggers skip(hoster) via `chrome.tabs.onRemoved`
- [ ] **CAP-08**: Dual-mode: uses native helper when installed, falls back to web tab when not
- [ ] **CAP-09**: Rc2Service no longer closes JDownloader's CAPTCHA tab when using web tab mode
- [x] **CAP-10**: Works with reCAPTCHA v2 (checkbox), reCAPTCHA v3 (invisible), and hCaptcha

### CAPTCHA Testing

- [ ] **TEST-01**: Manual E2E test script documents full CAPTCHA flow (extension detects -> web tab/native helper -> solve -> token submitted -> download proceeds)
- [ ] **TEST-02**: JDownloader localhost CAPTCHA page validated to render standalone (no extension enhancement needed)
- [ ] **TEST-03**: Both web tab and native helper modes tested with reCAPTCHA v2 and hCaptcha

### MV3 Compliance & CWS Submission

- [ ] **CWS-01**: Every permission has written justification (`<all_urls>`, `nativeMessaging`, `tabs`, `scripting`, `offscreen`, `declarativeNetRequest`)
- [ ] **CWS-02**: Privacy policy created and hosted, covering credential handling, URL data, storage usage
- [ ] **CWS-03**: RequireJS `eval` path audited — confirmed dead or patched to throw
- [ ] **CWS-04**: No CSP violation warnings in any extension page console (popup, toolbar, offscreen)
- [ ] **CWS-05**: Extension description accurately reflects MV3 features including native helper requirement
- [ ] **CWS-06**: At least 2 screenshots showing core features in CWS listing
- [ ] **CWS-07**: `postMessage` wildcard origins replaced with specific origin strings

## v2 Requirements

### Enhanced CAPTCHA

- **ECAP-01**: CAPTCHA privacy mode (solve in incognito context)
- **ECAP-02**: macOS/Linux native helper via wry/tao
- **ECAP-03**: Optional CAPTCHA solving service integration (2Captcha/CapSolver API key)

### Modernization

- **MOD-01**: RequireJS removal — replace with ES module bundling
- **MOD-02**: AngularJS to modern framework migration
- **MOD-03**: Clipboard observer link detection and auto-add

### Quality

- **QA-01**: Playwright E2E tests for non-CAPTCHA flows (login, add link, device selection)
- **QA-02**: CI/CD pipeline with automated testing
- **QA-03**: Mock native messaging host for automated CAPTCHA flow testing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full AngularJS rewrite | Too large; existing UI works fine |
| macOS/Linux native helper | WebView2 is Windows-only; web tab approach provides cross-platform |
| Built-in download manager | Extension is JDownloader integration, not standalone downloader |
| Automated CAPTCHA solving (API) | Violates CWS policies on deceptive behavior |
| Firefox/Safari support | MV3 APIs differ; WebView2 is Windows-only; separate project |
| Custom filter sets | Incomplete infrastructure; not user-requested |
| Inline script injection | Removed for MV3 CSP compliance; replaced by web tab approach |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| BUG-04 | Phase 1 | Complete |
| LINK-01 | Phase 2 | Complete |
| LINK-02 | Phase 2 | Complete |
| LINK-03 | Phase 2 | Complete |
| LINK-04 | Phase 2 | Complete |
| LINK-05 | Phase 2 | Complete |
| LINK-06 | Phase 2 | Complete |
| DIR-01 | Phase 3 | Complete |
| DIR-02 | Phase 3 | Complete |
| DIR-03 | Phase 3 | Complete |
| DIR-04 | Phase 3 | Complete |
| DIR-05 | Phase 3 | Complete |
| CAP-01 | Phase 4 | Complete |
| CAP-02 | Phase 4 | Complete |
| CAP-03 | Phase 4 | Pending |
| CAP-04 | Phase 4 | Pending |
| CAP-05 | Phase 4 | Complete |
| CAP-06 | Phase 4 | Complete |
| CAP-07 | Phase 4 | Pending |
| CAP-08 | Phase 4 | Pending |
| CAP-09 | Phase 4 | Pending |
| CAP-10 | Phase 4 | Complete |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| CWS-01 | Phase 6 | Pending |
| CWS-02 | Phase 6 | Pending |
| CWS-03 | Phase 6 | Pending |
| CWS-04 | Phase 6 | Pending |
| CWS-05 | Phase 6 | Pending |
| CWS-06 | Phase 6 | Pending |
| CWS-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
