# Phase 4: Web Tab CAPTCHA - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Content script on JDownloader's localhost CAPTCHA page (`http://127.0.0.1:PORT/captcha/...`) that detects CAPTCHA challenges, polls for solved tokens, injects skip buttons and countdown timer, and relays results to the service worker. This is the **only** CAPTCHA solving mode — the native messaging helper is being abandoned.

</domain>

<decisions>
## Implementation Decisions

### CAPTCHA mode
- Web tab is the **sole CAPTCHA path** — NOT a fallback
- Native helper is abandoned; no dual-mode detection needed
- CAP-08 reinterpreted: there is only web tab mode (no native helper when installed)
- Rc2Service's `handleRequest()` must stop closing the localhost CAPTCHA tab

### Skip button appearance
- Extension-styled buttons (blue/white color scheme matching the extension's UI)
- Show hoster name in skip labels for context (e.g., "Skip rapidgator CAPTCHAs")
- All four skip types available: hoster, package, all, single

### Skip button placement
- Claude's discretion — pick what works best with JDownloader's localhost page layout

### Countdown display
- 5-minute timeout, hardcoded (matches JDownloader's CAPTCHA timeout)
- Placement and format at Claude's discretion
- Visual urgency styling (e.g., color change near expiry) at Claude's discretion

### Auto-skip on timeout
- Send **skip(single)** when 5-minute countdown expires — only skips this one CAPTCHA
- JDownloader may present the next CAPTCHA after single skip

### Tab close behavior
- Closing CAPTCHA tab sends skip — exact skip type at Claude's discretion
- Use `chrome.tabs.onRemoved` listener to detect tab closure

### Post-solve behavior
- Auto-close the CAPTCHA tab after a brief delay (~2 seconds) once token is submitted
- No success message — just close

### Claude's Discretion
- Skip button placement (above/below CAPTCHA, floating bar, etc.)
- Countdown format (mm:ss, text, progress bar)
- Countdown visual urgency styling
- Tab close skip type (hoster vs single)
- Content script injection strategy (static manifest vs dynamic chrome.scripting)
- Token polling implementation details

</decisions>

<specifics>
## Specific Ideas

- User wants hoster name visible in skip UI so they know what they're skipping — implies content script should extract hoster info from URL or page content
- Auto-close after solve matches existing Rc2Service behavior (2-second delay before `chrome.tabs.remove`)
- Skip(single) on timeout is deliberately less aggressive than skip(hoster) — user prefers to give each CAPTCHA a chance

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Rc2Service.js:handleRequest()` (line 43): Already detects CAPTCHA URL pattern `http://127.0.0.1:\d+/captcha/(recaptchav2|v3|hcaptcha)/.*?id=\d+` — currently closes tab, needs to stop doing that
- `Rc2Service.js:sendRc2SolutionToJd()` (line 72): Submits solved token to JDownloader via HTTP callback or MYJD API — reusable for web tab token relay
- `Rc2Service.js:onSkipRequest()` (line 289): Already handles all 4 skip types (hoster/package/all/single) via HTTP callback — reusable for skip button actions
- `CaptchaNativeService.js`: Will be deprecated — its `sendCaptcha()`, `skipCaptcha()`, `submitTokenToJDownloader()` methods need replacement
- `webinterfaceEnhancer.js`: Content script pattern for `my.jdownloader.org` — message routing pattern reusable for new localhost content script
- `ExtensionMessagingService`: Message routing framework — `addListener(service, action, handler)` and `sendMessage(service, action, data)` pattern for content script ↔ service worker communication

### Established Patterns
- Content scripts use `chrome.runtime.sendMessage` to communicate with service worker context
- `ExtensionMessagingService` wraps chrome messaging with service/action routing
- Tab lifecycle managed via `chrome.tabs.onRemoved` and `PopupCandidatesService.addRemovedTabListener()`
- HTTP callbacks to JDownloader use `XMLHttpRequest` with `X-Myjd-Appkey` header
- `captchaInProgress` dedup guard (BUG-02 fix) prevents duplicate CAPTCHA jobs per dedupKey

### Integration Points
- `manifest.json` content_scripts array: needs new entry for `http://127.0.0.1/*` (or dynamic injection via `chrome.scripting`)
- `Rc2Service.handleRequest()`: must be modified to NOT close CAPTCHA tab (CAP-09)
- `Rc2Service.onNewCaptchaAvailable()`: currently calls `CaptchaNativeService.sendCaptcha()` — needs to route to web tab instead
- `background.js` or Rc2Service: needs `chrome.tabs.onRemoved` listener for CAPTCHA tabs to send skip on close (CAP-07)

</code_context>

<deferred>
## Deferred Ideas

- Native helper removal/cleanup — code can be removed in a future cleanup phase; not blocking web tab implementation
- CaptchaNativeService.js deprecation — mark as unused but don't delete during this phase

</deferred>

---

*Phase: 04-web-tab-captcha*
*Context gathered: 2026-03-07*
