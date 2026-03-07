# Phase 4: Web Tab CAPTCHA - Context

**Gathered:** 2026-03-07 (reevaluated after JDownloader source + MV2 extension review)
**Status:** Ready for replanning

<domain>
## Phase Boundary

Content script on JDownloader's localhost CAPTCHA page (`http://127.0.0.1:PORT/captcha/...`) that detects CAPTCHA challenges, polls for solved tokens, injects skip buttons and countdown timer, relays results to the service worker, and implements JD protocol callbacks (canClose, loaded, mouse-move). **Additionally**, a separate content script for solving CAPTCHAs via the MyJDownloader web interface when JD runs on a remote machine (NAS, server) — navigates to target domain, renders CAPTCHA widget MV3-compliantly, submits token via MYJD cloud API.

</domain>

<decisions>
## Implementation Decisions

### CAPTCHA mode
- Web tab is the **sole CAPTCHA path** — native helper is abandoned
- No dual-mode detection needed
- Rc2Service's `handleRequest()` must stop closing the localhost CAPTCHA tab

### Two distinct CAPTCHA flows

**Flow A: Localhost (JD running locally)**
- Content script enhances JDownloader's own CAPTCHA page
- JD renders the CAPTCHA widget; we add skip buttons, countdown, token polling
- HTTP callbacks to `callbackUrl` for solve/skip/loaded/canClose/mouse-move
- `X-Myjd-Appkey: webextension-{version}` header on all callbacks

**Flow B: MyJD Remote (JD on NAS/server)**
- User on `my.jdownloader.org` triggers CAPTCHA via `#rc2jdt&c={captchaId}` hash
- Extension queries MYJD API: `/captcha/getCaptchaJob` then `/captcha/get` for job details
- Navigates new tab to target domain with `#rc2jdt` hash
- Content script at `document_start` replaces page DOM, renders CAPTCHA widget (no inline scripts)
- Token submitted via myjdDeviceClientFactory `/captcha/solve` API (through MyJD cloud)
- If not connected to MyJD: redirect to `loginNeeded.html` (MV3 compliant)

### JD Protocol Callbacks (localhost flow)
- **`loaded` event**: Send window geometry (`x, y, w, h, vw, vh, eleft, etop, ew, eh, dpi`) after CAPTCHA widget renders. JD uses for auto-click. Send even though auto-click may not work perfectly through browser tab — it's part of the protocol and signals "CAPTCHA is displayed"
- **`canClose` polling**: Content script polls `callbackUrl + "&do=canClose"` every 1 second directly (not via service worker). Returns `"true"` when solved elsewhere — close tab immediately (no message, no delay)
- **Mouse-move reporting**: Match MV2 exactly — 3-second throttle on mousemove events, send `callbackUrl + "&do=canClose&useractive=true&ts=TIMESTAMP"`. Prevents JD from timing out challenges
- All three are HTTP GETs from the content script directly — fully MV3 compliant

### Meta tag extraction
- Extract JD page meta tags for enrichment: `sitekey`, `challengeType`, `challengeId`, `siteDomain`, `siteUrl`
- Use for better skip button labels, richer logging, future-proofing
- **Ignore** `enterprise` flag (JD handles widget rendering)
- **Ignore** `v3action` (JD handles widget rendering)
- URL path remains primary for CAPTCHA type detection (meta tags are supplementary)

### Content script architecture
- **Three scripts, three concerns:**
  1. `captchaSolverContentscript.js` — localhost flow (enhance JD page). `document_end`, `*://*/*`
  2. `myjdCaptchaSolver.js` — MYJD flow (render widget on target domain). `document_start`, `*://*/*` — exits immediately if no `#rc2jdt` hash
  3. `webinterfaceEnhancer.js` — detects CAPTCHA triggers on `my.jdownloader.org` (existing)
- All registered statically in `manifest.json`
- MYJD solver receives CAPTCHA job details via `chrome.storage.session` (service worker writes before navigating)

### MYJD CAPTCHA rendering
- Navigate to target domain (required for reCAPTCHA/hCaptcha origin validation)
- Content script at `document_start`: replace page DOM via `document.open()`/`document.close()` pattern
- Load reCAPTCHA/hCaptcha scripts as external `<script>` elements (no inline JS)
- For reCAPTCHA v3/invisible and hCaptcha execute: use `chrome.scripting.executeScript({world: 'MAIN'})` — explicitly supported in MV3
- Token polling same as localhost flow (500ms, check textarea values)
- `declarativeNetRequest` rules to strip CSP headers on MYJD CAPTCHA tabs (some sites block Google/Cloudflare scripts)

### Skip button appearance
- Extension-styled buttons (blue/white color scheme)
- Show hoster name in skip labels for context
- All four skip types: hoster, package, all, single

### Skip button placement
- Claude's discretion

### Countdown display
- 5-minute timeout, hardcoded
- Placement and format at Claude's discretion
- Visual urgency styling at Claude's discretion

### Auto-skip on timeout
- Send skip(single) when 5-minute countdown expires

### Tab close behavior
- Closing CAPTCHA tab sends skip — exact skip type at Claude's discretion
- `chrome.tabs.onRemoved` listener

### Post-solve behavior
- Auto-close tab after ~2 seconds once token submitted
- No success message

### Claude's Discretion
- Skip button placement
- Countdown format and urgency styling
- Tab close skip type (hoster vs single)
- Content script injection details for MYJD flow
- Token polling implementation details
- `loaded` event element detection strategy (find CAPTCHA iframe by known selectors)

</decisions>

<specifics>
## Specific Ideas

- **User's JD is on a NAS (Unraid)** — localhost CAPTCHA flow does NOT work for their setup. The MYJD remote flow is essential, not optional
- Hoster name visible in skip UI (extract from URL path or meta tags)
- Auto-close after solve matches existing behavior (2-second delay)
- Skip(single) on timeout is less aggressive than skip(hoster) — give each CAPTCHA a chance
- canClose=true means immediate tab close (no delay, no message)
- Mouse-move keeps challenges alive on JD side — critical for slow solvers

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Rc2Service.js:handleRequest()` (line 43): Detects CAPTCHA URL pattern — currently just logs, needs to stay hands-off for localhost flow
- `Rc2Service.js:sendRc2SolutionToJd()` (line 72): Two-path token submission (localhost HTTP vs MYJD messaging) — reusable for MYJD flow
- `Rc2Service.js:onRc2FrameLoaded()` (line 118): Has loaded event HTTP call implementation — but content script will handle this directly now
- `Rc2Service.js:onRc2MouseMove()` (line 110): Has mouse-move HTTP call — but content script will handle directly
- `Rc2Service.js:checkRc2TabModeCanClose()` (line 148): Has canClose polling — but content script will handle directly
- `webinterfaceEnhancer.js`: Content script on `my.jdownloader.org` — bridges myjdrc2 messages. Will be extended for MYJD CAPTCHA detection
- `ExtensionMessagingService`: Message routing framework — still used for MYJD flow communication
- `myjdDeviceClientFactory`: API client for MyJDownloader cloud — needed for `/captcha/getCaptchaJob`, `/captcha/get`, `/captcha/solve`
- `background.js` CAPTCHA handlers (lines 575-722): Tab tracking, solve/skip HTTP callbacks, tabs.onRemoved listener

### Established Patterns
- Content scripts use `chrome.runtime.sendMessage` to communicate with service worker
- `ExtensionMessagingService` wraps chrome messaging with service/action routing
- Tab lifecycle managed via `chrome.tabs.onRemoved`
- HTTP callbacks to JDownloader use `XMLHttpRequest` with `X-Myjd-Appkey` header
- `chrome.storage.session` for transient data (requestQueue precedent from Phase 1)

### Integration Points
- `manifest.json` content_scripts array: needs new `myjdCaptchaSolver.js` entry at `document_start`
- `manifest.json` `declarative_net_request`: needs CSP stripping rules for MYJD CAPTCHA tabs
- `Rc2Service.handleRequest()`: must stay hands-off (not close CAPTCHA tab)
- `Rc2Service` ExtensionMessagingService listeners: existing myjdrc2 handlers may need updates for new MYJD flow
- `background.js`: existing captcha-tab-detected/captcha-solved/captcha-skip handlers need to coexist with MYJD flow
- `webinterfaceEnhancer.js`: needs CAPTCHA job detection logic (detect `#rc2jdt&c=` hash trigger)

</code_context>

<deferred>
## Deferred Ideas

- Native helper removal/cleanup — code can be removed in a future cleanup phase
- CaptchaNativeService.js deprecation — mark as unused but don't delete during this phase
- Incognito/privacy CAPTCHA mode — disabled even in MV2; out of scope
- MYJD skip via API (`/captcha/skip`) — old extension had TODO for this; consider in Phase 5 testing
- Window cleanup on tab close (remove empty windows) — old extension's `close-me` handler did this; minor UX improvement

</deferred>

---

*Phase: 04-web-tab-captcha*
*Context gathered: 2026-03-07 (reevaluated)*
