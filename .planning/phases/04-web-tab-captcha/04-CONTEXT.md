# Phase 4: Web Tab CAPTCHA - Context

**Gathered:** 2026-03-07 (corrected after reading old MV2 extension source code)
**Status:** Ready for replanning

<domain>
## Phase Boundary

MV3-compliant reimplementation of the old MV2 extension's CAPTCHA solving. Must be **functionally identical** to the old extension. No new features, no removed features. The old extension has two CAPTCHA trigger paths (localhost and MyJD) that both result in a CAPTCHA widget rendered on the target domain. The user solves it; the token routes back to JDownloader.

</domain>

<decisions>
## Implementation Decisions

### Core principle
- **Functionally identical to old MV2 extension, 100% MV3 compliant**
- Native helper is abandoned — web tab is the sole CAPTCHA path
- No new features beyond what the old extension did

### How the old MV2 extension works (ground truth)

**Trigger Path A: Localhost (JD running on same machine)**
1. JD opens a browser tab to `http://127.0.0.1:PORT/captcha/recaptchav2/hoster/?id=123`
2. `Rc2Service.handleRequest()` detects the localhost URL pattern
3. Injects `browserSolverEnhancer.js` via `chrome.tabs.executeScript`
4. `browserSolverEnhancer.js` reads meta tags from JD's page (`sitekey`, `challengeType`, `siteDomain`, `siteUrl`, `v3action`, `enterprise`)
5. Sends `myjdrc2:captcha-new` with `callbackUrl = localhost URL` and extracted params
6. `onNewCaptchaAvailable()` stores params in `rc2TabUpdateCallbacks`, navigates tab to `{targetDomain}#rc2jdt`
7. Tab finishes loading → injects `rc2Contentscript.js` via `chrome.tabs.executeScript`
8. Content script sends `captcha-get` message, receives `captcha-set` with CAPTCHA data
9. Clears page DOM, loads `browser_solver_template.html` template, renders CAPTCHA widget
10. Skip buttons visible (hoster/package/all/cancel)
11. JD protocol callbacks active: `loaded`, `canClose` polling (1s), `mouse-move` reporting (3s throttle)
12. Token polling → solved → sends `myjdrc2:response` → `sendRc2SolutionToJd()` sends HTTP GET to localhost `callbackUrl + &do=solve&response=` → tab closes after 2s

**Trigger Path B: MyJD Remote (JD on NAS/server)**
1. `#rc2jdt&c={captchaId}` appears in a tab URL (from my.jdownloader.org web interface)
2. `Rc2Service` `chrome.tabs.onUpdated` catches it, extracts captchaId
3. Checks `myjdClientFactory.get().isConnected()` — if not connected, redirects tab to `loginNeeded.html`
4. Queries MyJD API: `/captcha/getCaptchaJob` → `/captcha/get` for siteKey, type, targetUrl
5. `onWebInterfaceCaptchaJobFound()` → `onNewCaptchaAvailable()` with `callbackUrl = "MYJD"`
6. Same as localhost from step 6: navigates tab to `{targetDomain}#rc2jdt`, injects content script
7. Content script renders CAPTCHA widget
8. **Skip buttons HIDDEN** for MyJD flow (`captchaControlsContainer.style = "display:none"`)
9. **No JD protocol callbacks** for MyJD flow (canClose/loaded/mouse-move only fire when `callbackUrl !== "MYJD"`)
10. Token polling → solved → sends `myjdrc2:response` → `sendRc2SolutionToJd()` finds my.jdownloader.org tabs → sends `{name: "response", type: "myjdrc2", data: {captchaId, token}}` → `webinterfaceEnhancer.js` relays via `window.postMessage` → web interface sends to JD via cloud API → tab closes after 2s

**Tab close behavior (both flows):**
- Localhost: `removeRc2CanCloseCheck()` clears canClose polling, sends HTTP skip
- MyJD: finds my.jdownloader.org tabs, sends `{name: "tab-closed", type: "myjdrc2", data: {captchaId}}`

### What does NOT exist in the old extension
- No 5-minute countdown timer — **dropped** per user decision
- No auto-skip on timeout — **dropped** per user decision
- No CAPTCHA widget detection on arbitrary websites — content script ONLY activates on `#rc2jdt` hash
- No skip buttons for MyJD flow — hidden in old extension, same here

### MV3 compliance changes (how to replicate without CSP violations)
- `chrome.tabs.executeScript` → `chrome.scripting.executeScript` or static manifest content_scripts
- Inline `<script>` tag injection (reCAPTCHA/hCaptcha rendering) → external `<script>` elements + `chrome.scripting.executeScript({world: 'MAIN'})` for invisible/v3 execution
- `webRequestBlocking` CSP stripping → `declarativeNetRequest` modifyHeaders rules
- Template loading (`browser_solver_template.html` via XHR) → same approach works in MV3 or build DOM programmatically
- Persistent background page → service worker (already done)

### Claude's Discretion
- Whether to use one content script or two (user doesn't care, just needs to work)
- DOM building approach (template file vs programmatic)
- MV3 implementation details for script injection
- Token polling interval (old uses 500ms)
- How to transfer CAPTCHA data to content script (`chrome.storage.session` vs messaging)

</decisions>

<specifics>
## Specific Ideas

- Must be functionally identical to old MV2 extension — "just make sure it functions the same way as the old one did"
- Both localhost and MyJD flows must work — this is a general-purpose extension, not just for one user's setup
- Skip buttons: localhost only (hidden for MyJD), matching old behavior
- JD protocol callbacks (loaded/canClose/mouse-move): localhost only, matching old behavior
- Auto-close tab after solve (~2 seconds), matching old behavior
- `loginNeeded.html` shown when CAPTCHA triggers but extension not connected to MyJD

</specifics>

<code_context>
## Existing Code Insights

### Old MV2 Source (reference implementation)
- Located at: `C:\Users\anthony\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\fbcohnmimjicjdomonkcbcpbpnhggkip\3.3.20_0\`
- Key files: `Rc2Service.js`, `rc2Contentscript.js`, `browserSolverEnhancer.js`, `webinterfaceEnhancer.js`
- Template: `res/browser_solver_template.html`

### Current MV3 Code (needs correction)
- `Rc2Service.js` — Mostly correct but `onNewCaptchaAvailable()` was changed; needs to match old behavior
- `myjdCaptchaSolver.js` — MyJD flow content script; works but shows skip buttons (should be hidden)
- `captchaSolverContentscript.js` — Has CAPTCHA detection on arbitrary websites (old extension doesn't do this); needs removal or rework
- `background.js` — CAPTCHA handlers mostly correct; has countdown/skip logic that should be removed
- `webinterfaceEnhancer.js` — Unchanged from old extension, correct as-is

### Established Patterns
- Content scripts use `chrome.runtime.sendMessage` to service worker
- `ExtensionMessagingService` wraps chrome messaging with service/action routing
- HTTP callbacks use `XMLHttpRequest` with `X-Myjd-Appkey` header
- `chrome.storage.session` for transient data (Phase 1 precedent)

### Integration Points
- `manifest.json` content_scripts array
- `manifest.json` declarative_net_request (CSP stripping)
- `Rc2Service` — tab update listener, CAPTCHA flow orchestration
- `background.js` — tab tracking, CAPTCHA message routing
- `webinterfaceEnhancer.js` — message relay on my.jdownloader.org

</code_context>

<deferred>
## Deferred Ideas

- Native helper removal/cleanup — code can be removed in a future cleanup phase
- CaptchaNativeService.js deprecation — removed from DI but file stays on disk
- Incognito/privacy CAPTCHA mode — disabled even in MV2; out of scope
- MYJD skip via API (`/captcha/skip`) — old extension had TODO for this; consider in Phase 5
- Window cleanup on tab close (old extension's `close-me` handler)
- Skip buttons for MyJD flow — not in old extension, could be future enhancement

</deferred>

---

*Phase: 04-web-tab-captcha*
*Context gathered: 2026-03-07 (corrected)*
