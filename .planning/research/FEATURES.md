# Feature Landscape

**Domain:** Download manager browser extension (JDownloader integration)
**Researched:** 2026-03-06

## Table Stakes

Features users expect from a JDownloader browser extension. Missing = product feels broken or incomplete compared to the original MV2 extension and competing download extensions.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Single-link context menu download | Core action; every download extension offers right-click-to-download | Low | DONE | Working via "Download with JDownloader" context menu |
| Multi-link stacking in toolbar | Original MV2 extension had this; users right-click multiple links and they accumulate in the sidebar before sending all at once | Medium | MISSING | Request queue exists in background.js but toolbar only shows links added one at a time without accumulation UX. This is the #1 missing table-stakes feature. |
| Device discovery and selection | MyJDownloader is multi-device; users must pick which JD instance receives links | Low | DONE | Working in both popup and toolbar |
| Login/logout/session persistence | Cloud-based service requires auth; sessions must survive browser restarts | Low | DONE | Working via chrome.storage.local |
| Click'N'Load (CNL) interception | CNL is the standard protocol for one-click download sites; missing = major gap for power users | High | DONE | Working via cnlInterceptor.js with fetch/XHR override |
| Add-links dialog with options | Users need destination folder, package name, password, priority, auto-extract options when sending links | Medium | DONE | Working via AddLinksController with full option set |
| Auto-send countdown | Original behavior: toolbar appears, counts down, auto-sends to preferred device. Critical for seamless workflow | Low | DONE | Working in ToolbarController with configurable seconds |
| Directory/path history dropdown | Users re-download to the same directories; history dropdown prevents re-typing paths every time. Extremely common UX pattern for download managers. | Medium | MISSING | History array exists in AddLinksController scope but no persistent dropdown UI or chrome.storage.local backing for the "saveto" field specifically |
| CAPTCHA solving support | JDownloader's CAPTCHA pipeline is a core feature. Extension must handle reCAPTCHA v2/v3 and hCaptcha. | High | DONE | Working via native messaging host + WebView2. Needs E2E testing. |
| Settings page | Users configure countdown, context menu style, default device, default options | Low | DONE | Working via AngularJS route #!/settings |
| Badge/icon connection status | Visual indicator of connection state; users need at-a-glance feedback | Low | DONE | Badge shows "!" when disconnected |
| Selection context menu | Right-click selected text containing URLs to send all links at once | Medium | DONE | Working via selectionContentscript.js and onCopyContentscript.js |
| Image/video/audio context menu | Media-specific right-click options for direct media URL capture | Low | DONE | Working via context menu with image/video/audio contexts |

## Differentiators

Features that set this extension apart from generic download extensions. Not expected by every user, but valued by the JDownloader audience.

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| Native CAPTCHA helper with WebView2 | Only MV3-compliant way to solve CAPTCHAs; competitors cannot do this within MV3 CSP. Unique competitive advantage. | High | DONE | Rust native messaging host with WebView2. No other JD extension has this in MV3. |
| CAPTCHA skip buttons (hoster/package/all/single) | Power users managing bulk downloads need granular skip controls, not just "skip all" | Medium | DONE | Implemented in native helper webview with skip types |
| Auto-fill from history | Auto-populates form fields (package name, passwords, directory) from per-device history. Saves repetitive typing for power users. | Medium | PARTIAL | AddLinksController has autoFill toggle and per-device history caching. Needs persistent directory dropdown. |
| Clipboard observer / auto-grab | Detects download links copied to clipboard and auto-adds them. Power feature for sites that require manual URL copying. | Medium | PARTIAL | Toggle exists in settings (CLIPBOARD_OBSERVER); onCopyContentscript.js listens for copy events. Implementation incomplete — no link detection/filtering on clipboard content. |
| Save-for-later queue | Captures links for later download when JDownloader is offline. Unique to this extension. | Low | DONE | SaveForLaterDevice option in toolbar and settings |
| Web interface enhancement | Bridges the extension with my.jdownloader.org web UI for remote CAPTCHA solving and download management | Medium | DONE | webinterfaceEnhancer.js communicates with my.jdownloader.org via postMessage |
| Keyboard shortcuts | Ctrl+Shift+Y for auto-grab toggle, Ctrl+Shift+X for clipboard observer. Power users expect keyboard-driven workflows. | Low | DONE | Defined in manifest.json commands |
| CAPTCHA privacy mode | Option to solve CAPTCHAs in incognito mode to prevent tracking cookies | Low | PARTIAL | Setting exists (CAPTCHA_PRIVACY_MODE) but forced to false in Rc2Service |
| Custom context menu modes | Simple (one item) vs. detailed (separate link/page/selection/image/video/audio items) | Low | DONE | Toggle in settings; background.js creates appropriate menu items |
| Deep decrypt option | JDownloader-specific: recursively decrypts container files (DLC, RSDF, CCF). No other extension exposes this. | Low | DONE | Option in AddLinksController |
| Overwrite packagizer rules | JDownloader-specific: override automatic file organization rules per download | Low | DONE | Option in AddLinksController |

## Anti-Features

Features to explicitly NOT build. These would hurt the extension, waste effort, or violate Chrome Web Store policies.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Built-in download manager | This is a JDownloader integration extension, not a standalone download manager. Building download management duplicates JD's core functionality and bloats the extension. | Keep the extension focused on link capture and sending to JDownloader. |
| Full page-scraping / "download all links" | DownThemAll and similar extensions own this space. Adding link-scraping creates `<all_urls>` permission justification issues and overlaps with existing tools. The extension already has `<all_urls>` for CNL interception; adding scraping increases review scrutiny without clear JD-specific value. | Rely on selection-based link capture (text selection context menu) and CNL interception for bulk captures. |
| Automated CAPTCHA solving (API-based) | Using paid CAPTCHA solving APIs violates Chrome Web Store policies on deceptive behavior and undermines the manual-solve UX that JDownloader expects. | Keep manual CAPTCHA solving via WebView2 native helper. |
| Remote code execution / eval() | MV3 strictly prohibits remote code and eval(). RequireJS already contains eval() that is bypassed via ng-csp; adding more is a rejection risk. | Use static bundled code only. Plan RequireJS removal in future milestone. |
| Cross-browser (Firefox/Safari) support | MV3 APIs differ significantly across browsers. WebView2 native helper is Windows-only. Supporting multiple browsers fractures development effort for minimal user gain in this milestone. | Focus on Chrome/Chromium. Consider Firefox MV3 as a separate future project. |
| AngularJS rewrite to React/Vue | Massive effort with no user-facing benefit. AngularJS works fine for this extension's UI complexity. The risk of regression far outweighs the DX improvement. | Keep AngularJS; plan rewrite only when a major UI overhaul is needed. |
| Inline script injection for content scripts | Removed during MV3 conversion (rc2Contentscript.js, browserSolverEnhancer.js). Reintroducing inline scripts would violate MV3 CSP. | Use native messaging host and declarativeNetRequest for all dynamic behavior. |
| Notification/toast system for downloads | Chrome already has native notification APIs, but download managers abuse notifications. Users have notification fatigue. JDownloader itself handles download notifications. | Badge icon updates are sufficient for connection state. |
| macOS/Linux native helper | WebView2 is Windows-only. Wry supports WebKitGTK (Linux) and WebKit (macOS) but requires separate build targets, testing, and packaging. Huge scope for marginal user base. | Document as future roadmap item. Windows-only for this milestone. |

## Feature Dependencies

```
Login/Logout --> Device Discovery --> Add Links Dialog
                                  --> Toolbar (requires device for send)
                                  --> CAPTCHA solving (requires device context)

Context Menu Click --> Request Queue (background.js) --> Toolbar Injection
                                                     --> Multi-link stacking*

Multi-link stacking* --> Add Links Dialog (batch send)

Directory History Dropdown* --> chrome.storage.local persistence
                            --> Add Links Dialog UI

CAPTCHA Detection (Rc2Service) --> Native Helper (CaptchaNativeService)
                               --> WebView2 Window
                               --> Token Submission (HTTP callback)
                               --> Web Interface Fallback

CNL Interception --> Background CNL Queue --> Add Links Dialog
                                          --> Direct Offscreen Send

* = Features being built in this milestone
```

## Chrome Web Store MV3 Compliance Features

These are not user-facing features but are required for Chrome Web Store approval.

| Requirement | Current Status | Action Needed | Complexity |
|-------------|---------------|---------------|------------|
| No remote code execution | COMPLIANT with caveat | RequireJS contains eval() but bypassed via ng-csp. Not actively invoked. Document this in review submission notes. | Low |
| Permission justification | NEEDS WORK | `<all_urls>` host permission requires strong justification: needed for CNL interception on any page, toolbar injection on any page, context menu on any page. Must document each use case. | Medium |
| Privacy policy | MISSING | Required because extension handles user credentials (MyJDownloader login), browsing URLs (sent to JDownloader), and stores data in chrome.storage.local. Must create and host privacy policy page. | Medium |
| Accurate metadata | NEEDS REVIEW | Screenshots, description, and icon need to accurately reflect MV3 version. Description must mention native helper requirement for CAPTCHA. | Low |
| No obfuscated code | COMPLIANT | Code is readable, not obfuscated. vendor/ contains minified but not obfuscated third-party libraries. | Low |
| Single purpose | COMPLIANT | Extension has one clear purpose: integrate browser with JDownloader for download management. | Low |
| Content Security Policy | COMPLIANT | manifest.json uses MV3 defaults (no unsafe-eval, no unsafe-inline). ng-csp directive handles AngularJS CSP compatibility. | Low |
| nativeMessaging permission justification | NEEDS WORK | Must justify why native messaging is required: CAPTCHA solving requires browser window outside extension CSP sandbox. | Medium |

## MVP Recommendation for This Milestone

**Prioritize (Phase 1 - Bug Fixes):**
1. Fix duplicate URL pattern in Rc2Service tab query (trivial, known bug)
2. Fix double CAPTCHA job send in Rc2Service (prevents duplicate solving windows)
3. Fix native helper unwrap panics in webview.rs (prevents crash without error response)

**Prioritize (Phase 2 - Missing Table Stakes):**
1. Multi-link stacking in toolbar -- right-clicking multiple links accumulates them in the sidebar. This is the most requested missing feature from the MV2 extension. The request queue infrastructure already exists in background.js; the gap is the toolbar UI not updating when new links are added to an already-open toolbar.
2. Directory field history dropdown -- persistent dropdown on the "Save to" input showing last 10 used directories from chrome.storage.local. The history data structure already exists in AddLinksController (`$scope.history.saveto`); needs UI dropdown and persistent storage.
3. Clear history button for directory dropdown

**Prioritize (Phase 3 - CAPTCHA E2E Testing):**
1. Set up WordPress test page with reCAPTCHA v2/v3 gating a download link
2. Manual E2E test script documenting the full flow: extension detects CAPTCHA -> native helper opens -> user solves -> token submitted -> download proceeds
3. Playwright-based E2E test for non-CAPTCHA flows (login, add link, device selection)

**Prioritize (Phase 4 - Chrome Web Store Compliance):**
1. MV3 compliance audit (permissions, CSP, metadata)
2. Privacy policy creation and hosting
3. Permission justification documentation
4. Submission preparation (screenshots, description, review notes)

**Defer to Future Milestones:**
- Clipboard observer link detection (PARTIAL; the infrastructure exists but URL filtering/auto-add logic is incomplete)
- Custom filter sets (incomplete infrastructure in FilterService.js; not user-requested)
- CAPTCHA privacy mode (setting exists but disabled; needs incognito window integration)
- RequireJS removal (tech debt; not blocking functionality)
- AngularJS migration (not blocking; works fine for current UI)

## Sources

- Chrome Web Store review process: [Chrome for Developers - Review Process](https://developer.chrome.com/docs/webstore/review-process)
- Chrome Web Store troubleshooting violations: [Chrome for Developers - Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Chrome Web Store program policies: [Chrome for Developers - Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- Chrome MV3 permissions documentation: [Chrome for Developers - Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- DownThemAll extension features: [DownThemAll Chrome Web Store](https://chromewebstore.google.com/detail/downthemall/nljkibfhlpcnanjgbnlnbjecgicbjkge)
- Chrono Download Manager: [Chrono Download Manager](https://www.chronodownloader.net/)
- Playwright Chrome extension testing: [BrowserStack - Playwright Chrome Extension](https://www.browserstack.com/guide/playwright-chrome-extension)
- Puppeteer extension testing: [Chrome for Developers - Test Extensions with Puppeteer](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- Autocomplete UX patterns: [Smart Interface Design Patterns - Autocomplete](https://smart-interface-design-patterns.com/articles/autocomplete-ux/)
- Existing codebase analysis: `.planning/codebase/CONCERNS.md`
- Original MV2 extension reference at `C:\Users\anthony\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\fbcohnmimjicjdomonkcbcpbpnhggkip\3.3.20_0\`
