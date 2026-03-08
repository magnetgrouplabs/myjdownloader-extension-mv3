# Phase 5: CAPTCHA E2E Testing - Research

**Researched:** 2026-03-07
**Domain:** Manual E2E testing of Chrome Extension CAPTCHA solving flow with live JDownloader instance
**Confidence:** HIGH

## Summary

Phase 5 validates that the CAPTCHA solving implementation built in Phase 4 works end-to-end with a real JDownloader instance. This is primarily a manual testing phase, not a code implementation phase. The user's JDownloader runs on a NAS (Unraid) and connects through MyJDownloader cloud API -- there is no localhost JDownloader.

The testing approach is Claude-driven: Claude uses browser MCP controls to navigate and verify extension state, while the user's only participation is solving the actual CAPTCHA widget and confirming JDownloader started the download. Claude is responsible for finding CAPTCHA-gated download links, triggering the flow, and documenting results.

**Primary recommendation:** Create a structured E2E test script that walks through the MYJD remote CAPTCHA flow with real file hosters. Verify the localhost flow through code review only (user has no local JD). Test with whatever CAPTCHA types JDownloader naturally encounters -- do not force specific types. Debug and fix inline if anything breaks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude-driven testing using browser MCP controls
- User's only participation: solving the actual CAPTCHA when it appears, and confirming JDownloader started the download
- Claude researches which file hosters trigger CAPTCHAs for free-tier users (user is premium on pixeldrain -- skip that hoster)
- Claude finds existing CAPTCHA-gated download links or uploads a small test file to trigger CAPTCHAs
- **MyJD remote flow (live test)**: Full E2E -- trigger CAPTCHA, verify tab opens, user solves, confirm download starts in JD
- **Localhost flow (code review only)**: User's JD is on NAS, not local PC. Verify localhost path through code inspection, not live testing
- Test whatever CAPTCHA types JDownloader encounters naturally (reCAPTCHA v2, v3, hCaptcha all supported)
- **Pass**: CAPTCHA tab appears -> user solves -> token submits -> JDownloader starts the download (user confirms)
- **Fail**: Any break in the chain (tab doesn't open, widget doesn't render, token doesn't submit, JD doesn't receive token)
- On failure: Debug and fix inline during testing
- Test documentation format and location at Claude's discretion

### Claude's Discretion
- Which file hosters to use for triggering CAPTCHAs
- Whether to upload test files or find existing download links
- Test script format and location
- Order of testing steps
- How to verify extension state via browser MCP during testing

### Deferred Ideas (OUT OF SCOPE)
- Automated CAPTCHA E2E testing with mock JD server (QA-03 in v2 requirements)
- Playwright E2E tests for non-CAPTCHA flows (QA-01 in v2 requirements)
- CAPTCHA solving service integration (ECAP-03 in v2 requirements)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Manual E2E test script documents full CAPTCHA flow (extension detects -> web tab -> solve -> token submitted -> download proceeds) | Test script structure, MYJD flow verification steps, file hoster research for triggering CAPTCHAs |
| TEST-02 | JDownloader localhost CAPTCHA page validated to render standalone (no extension enhancement needed) | Code review of `captchaSolverContentscript.js` -- confirms it enhances but does not create the CAPTCHA page; JD renders its own page at `http://127.0.0.1:PORT/captcha/TYPE/HOSTER/?id=ID` |
| TEST-03 | Both web tab and native helper modes tested with reCAPTCHA v2 and hCaptcha | MYJD remote flow tested live; native helper mode not applicable (abandoned); localhost flow verified via code review; CAPTCHA types depend on what JD encounters naturally |
</phase_requirements>

## Standard Stack

### Core (Testing Infrastructure -- already in place)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Jest | 27.5.1 | Unit test runner | Already configured; 216 tests passing across 10 suites |
| jest-chrome | 0.8.0 | Chrome API mocks | Already configured for structural tests |
| Browser MCP | N/A | Claude-driven browser interaction | User decision: Claude navigates and verifies via MCP controls |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Chrome DevTools Console | Verify extension state, check for errors | During E2E testing to inspect `chrome.storage.session`, service worker logs |
| chrome://extensions | Reload extension, check errors | Before each test run |
| my.jdownloader.org | Trigger CAPTCHA flow, verify connection | Must be open in a tab during MYJD remote flow testing |

### No New Dependencies
This phase does not require installing any new libraries. All testing is manual E2E with existing browser tools.

## Architecture Patterns

### CAPTCHA E2E Test Flow (MYJD Remote)

The flow to test end-to-end:

```
1. Prerequisites:
   - Extension loaded and logged in to MyJD
   - my.jdownloader.org open in a browser tab
   - JDownloader running on NAS and connected to MyJD account
   - JDownloader browser solver enabled in Settings > Captchas

2. Trigger:
   - Add a CAPTCHA-gated download link to JDownloader
   - JDownloader encounters CAPTCHA during processing

3. Extension detection:
   - webinterfaceEnhancer.js on my.jdownloader.org detects trigger
   - Tab navigates to URL with #rc2jdt&c=CAPTCHAID hash
   - Rc2Service detects hash, queries MyJD API for job details

4. Tab preparation:
   - Rc2Service sends myjd-prepare-captcha-tab to service worker
   - Service worker writes job to chrome.storage.session
   - Service worker adds CSP stripping rule
   - Service worker navigates tab to targetUrl#rc2jdt

5. Content script activation:
   - myjdCaptchaSolver.js activates (hash gate passes)
   - DOM replaced, CAPTCHA widget rendered
   - Skip buttons and countdown timer displayed

6. User solves CAPTCHA:
   - Token written to textarea by reCAPTCHA/hCaptcha
   - Content script polls, detects token (500ms interval)
   - Sends captcha-solved message to service worker

7. Token delivery:
   - Service worker routes to my.jdownloader.org tabs
   - webinterfaceEnhancer.js relays to MyJD web interface
   - MyJD cloud API delivers token to JDownloader
   - Tab auto-closes after 2 seconds

8. Verification:
   - JDownloader shows download progressing
   - User confirms download started
```

### File Hosters That Trigger CAPTCHAs

Based on research, these file hosters commonly require CAPTCHAs for free-tier downloads:

| Hoster | CAPTCHA Type | Notes | Confidence |
|--------|-------------|-------|------------|
| Rapidgator | reCAPTCHA v2 | Most popular, frequently uses reCAPTCHA for free downloads | MEDIUM |
| Nitroflare | reCAPTCHA v2/hCaptcha | Common CAPTCHA requirement for free tier | MEDIUM |
| Turbobit | reCAPTCHA | Free downloads require CAPTCHA solving | MEDIUM |
| DDownload | reCAPTCHA/hCaptcha | May require CAPTCHA for free downloads | LOW |
| Uploaded.net | reCAPTCHA v2 | Traditional CAPTCHA requirement | MEDIUM |

**Important caveats:**
- File hosters frequently change their CAPTCHA implementations
- Some hosters may have disabled free downloads entirely
- The specific CAPTCHA type encountered depends on the hoster's current configuration
- JDownloader plugin compatibility with specific hosters can break when hosters update
- The user is premium on pixeldrain -- skip that hoster

**Recommended approach:** Try Rapidgator or Nitroflare first as they are the most established hosters with consistent CAPTCHA requirements. If those don't trigger CAPTCHAs, try others. The goal is to get JDownloader to encounter ANY CAPTCHA -- the specific hoster doesn't matter.

### Localhost Flow Code Review (TEST-02)

The localhost flow does not need live testing (user's JD is on NAS). Instead, verify through code inspection:

**`captchaSolverContentscript.js` analysis:**
- Activates on `http://127.0.0.1:*` pages matching `/captcha/(recaptchav2|recaptchav3|hcaptcha)/` path pattern
- Extracts metadata from URL: captchaType from path[2], hoster from path[3], captchaId from query param `id`
- Uses `window.location.href` as callbackUrl (the full localhost URL)
- Does NOT create the CAPTCHA page -- JDownloader renders it; the content script enhances it with skip buttons, countdown, token polling
- JD protocol callbacks (canClose, loaded, mouse-move) are gated on `isJdLocalhost`

**Key finding for TEST-02:** The localhost CAPTCHA page is rendered by JDownloader itself. The content script adds skip buttons, countdown timer, and token detection on top. The page renders standalone (the CAPTCHA widget is served by JDownloader's built-in HTTP server). The extension enhancement is additive, not required for rendering.

### Test Documentation Format

Recommended format for test results: a markdown document at `.planning/phases/05-captcha-e2e-testing/05-TEST-RESULTS.md` structured as:

```markdown
# Phase 5: CAPTCHA E2E Test Results

## Test Environment
- Browser version, extension version, JD version
- MyJD connection status
- JDownloader NAS configuration

## Test 1: [Test Name]
### Steps
1. [step]
2. [step]
### Expected
[expected behavior]
### Actual
[what happened]
### Result: PASS/FAIL
### Evidence
[screenshots, console output, etc.]
### Fixes Applied (if any)
[description of fix, files changed]
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CAPTCHA widget rendering | Custom CAPTCHA form | reCAPTCHA/hCaptcha official API scripts | Already implemented correctly via external `<script>` elements |
| E2E browser automation | Playwright/Puppeteer setup | Browser MCP controls | User decision; avoids test framework overhead for manual validation |
| Mock JDownloader server | HTTP server simulating JD API | Real JDownloader on NAS | This phase tests the real flow, not a simulation (QA-03 deferred to v2) |
| CAPTCHA token generation | Fake tokens | Real CAPTCHA solving by user | Tokens must be valid for JDownloader to accept them |

## Common Pitfalls

### Pitfall 1: JDownloader Browser Solver Not Enabled
**What goes wrong:** JDownloader encounters CAPTCHA but doesn't signal it to MyJD web interface -- the extension never receives the challenge.
**Why it happens:** JDownloader has a "Browser Solver" setting in Settings > Captchas that must be enabled for CAPTCHAs to be routed to the browser extension.
**How to avoid:** Check JDownloader settings before testing. Ensure browser solver is enabled.
**Warning signs:** Downloads fail with CAPTCHA errors in JDownloader but no tab opens in the browser.

### Pitfall 2: my.jdownloader.org Tab Not Open
**What goes wrong:** The CAPTCHA trigger from JDownloader has no relay path to the extension.
**Why it happens:** The MYJD flow requires `webinterfaceEnhancer.js` running on a `my.jdownloader.org` tab to detect the CAPTCHA trigger and relay it to the extension.
**How to avoid:** Ensure my.jdownloader.org is open and the user is logged in before adding CAPTCHA-gated download links.
**Warning signs:** JDownloader shows CAPTCHA pending but no browser tab opens.

### Pitfall 3: Extension Not Logged In to MyJD
**What goes wrong:** When a CAPTCHA triggers, `loginNeeded.html` is shown instead of the CAPTCHA widget.
**Why it happens:** `Rc2Service` checks `myjdClientFactory.get().isConnected()` -- if false, calls `onLoginNeeded()`.
**How to avoid:** Log in to the extension via popup before testing. Verify connection state.
**Warning signs:** Tab navigates to `loginNeeded.html`.

### Pitfall 4: CSP Blocking CAPTCHA Widget
**What goes wrong:** The reCAPTCHA/hCaptcha script fails to load on the target domain because the site's CSP blocks external scripts.
**Why it happens:** The `declarativeNetRequest` CSP stripping rule may not apply before the page loads, or the rule might not match the correct resource types.
**How to avoid:** Check the Network tab for blocked requests. Verify CSP stripping rule is active (`chrome.declarativeNetRequest.getSessionRules()`).
**Warning signs:** CAPTCHA container shows but widget never renders; console shows CSP violation errors.

### Pitfall 5: Service Worker Terminated During CAPTCHA Flow
**What goes wrong:** The service worker goes idle and terminates while a CAPTCHA tab is open.
**Why it happens:** MV3 service workers terminate after ~30 seconds of inactivity.
**How to avoid:** The extension has a keepAlive alarm (4-minute cycle), and `activeCaptchaTabs` tracking is in-memory. The `chrome.storage.session` job data persists across SW restarts, but `activeCaptchaTabs` does not.
**Warning signs:** Tab close handler fails to send skip signal because `activeCaptchaTabs` was lost.

### Pitfall 6: File Hoster Plugin Broken in JDownloader
**What goes wrong:** JDownloader's plugin for a specific hoster is outdated and can't even reach the CAPTCHA stage.
**Why it happens:** File hosters frequently update their download flows, breaking JDownloader plugins.
**How to avoid:** Try multiple hosters. Check JDownloader logs for plugin errors. Use well-known hosters with stable JD plugins.
**Warning signs:** JDownloader shows "Plugin out of date" or download fails before CAPTCHA stage.

### Pitfall 7: Token Relay Failure to my.jdownloader.org
**What goes wrong:** Token is captured by content script but never reaches JDownloader.
**Why it happens:** The service worker routes the token via `chrome.tabs.sendMessage` to my.jdownloader.org tabs, then `webinterfaceEnhancer.js` relays via `window.postMessage`. If no my.jdownloader.org tab exists, the relay fails silently.
**How to avoid:** Keep my.jdownloader.org tab open throughout testing. Check service worker console for routing logs.
**Warning signs:** Tab auto-closes (indicating token was captured) but JDownloader doesn't show the CAPTCHA as solved.

## Code Examples

### Verifying Extension State via DevTools Console

```javascript
// Check if extension is connected to MyJD
chrome.storage.local.get('myjd_session', console.log);

// Check active CAPTCHA tab state (in service worker console)
// Note: activeCaptchaTabs is in-memory only
console.log(activeCaptchaTabs);

// Check session storage for CAPTCHA job
chrome.storage.session.get('myjd_captcha_job', console.log);

// Check CSP stripping rules
chrome.declarativeNetRequest.getSessionRules(rules => console.log(rules));
```

### Key Message Flow to Monitor in Service Worker Console

```
// Successful MYJD CAPTCHA flow produces these log entries:
"Background message: myjd-prepare-captcha-tab from: extension"
"Background: MYJD CAPTCHA tab prepared: <tabId> <hoster>"
"Background message: myjd-captcha-execute from: tab:<tabId>"     // (invisible/v3 only)
"Background message: captcha-solved from: tab:<tabId>"
"Background: CAPTCHA tab closed, sent tab-closed for <hoster>"   // (on tab close)
```

### Localhost CAPTCHA Page URL Pattern (Code Review Reference)

```
// JDownloader serves CAPTCHA pages at this URL pattern:
http://127.0.0.1:PORT/captcha/recaptchav2/HOSTER/?id=CAPTCHA_ID
http://127.0.0.1:PORT/captcha/recaptchav3/HOSTER/?id=CAPTCHA_ID
http://127.0.0.1:PORT/captcha/hcaptcha/HOSTER/?id=CAPTCHA_ID

// The content script captchaSolverContentscript.js detects this via:
var captchaPathPattern = /\/captcha\/(recaptchav2|recaptchav3|hcaptcha)\//;
var isJdLocalhost = /^http:\/\/127\.0\.0\.1/.test(window.location.href)
    && captchaPathPattern.test(window.location.pathname);
```

## State of the Art

| Old Approach (MV2) | Current Approach (MV3) | Impact |
|---------------------|----------------------|--------|
| Inline `<script>` injection | External `<script>` elements + `executeScript({world: 'MAIN'})` | MV3 CSP compliant |
| `chrome.tabs.executeScript()` | `chrome.scripting.executeScript()` | New API, same functionality |
| Direct localStorage access | Offscreen document for API, `chrome.storage.session` for CAPTCHA jobs | MV3 required workaround |
| Native messaging host (WebView2) | Browser tab CAPTCHA solving | Cross-platform, no native install needed |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 + jest-chrome 0.8.0 |
| Config file | `jest.config.js` |
| Quick run command | `npx jest` |
| Full suite command | `npx jest --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Full CAPTCHA flow E2E test script | manual E2E | N/A (manual browser testing) | Will create test script document |
| TEST-02 | Localhost CAPTCHA page renders standalone | code review | N/A (code inspection) | Existing structural tests cover code patterns |
| TEST-03 | Both modes tested with reCAPTCHA v2 and hCaptcha | manual E2E + code review | N/A (manual for MYJD, code review for localhost) | Will create test results document |

### Sampling Rate
- **Per task commit:** `npx jest` (quick, 1.7s)
- **Per wave merge:** `npx jest --coverage`
- **Phase gate:** Full suite green + manual E2E results documented

### Wave 0 Gaps
None -- existing test infrastructure covers all unit/structural testing needs. This phase is primarily manual E2E testing with real JDownloader, not automated test development.

## Open Questions

1. **Which file hoster will JDownloader's plugin successfully process?**
   - What we know: Rapidgator, Nitroflare, Turbobit commonly require CAPTCHAs for free downloads
   - What's unclear: JDownloader plugin compatibility is fragile; plugins break when hosters update
   - Recommendation: Try multiple hosters during testing. Have 3-4 fallback options ready. The first one that triggers a CAPTCHA is the right one.

2. **Will the my.jdownloader.org tab reliably relay CAPTCHA challenges?**
   - What we know: `webinterfaceEnhancer.js` listens for `message` events and relays `myjdrc2` messages
   - What's unclear: Whether the MyJD web interface's JavaScript reliably fires the trigger event
   - Recommendation: Monitor the my.jdownloader.org tab console during testing for relay activity

3. **Will activeCaptchaTabs survive service worker lifecycle during testing?**
   - What we know: `activeCaptchaTabs` is in-memory only, not persisted. The keepAlive alarm runs every 4 minutes.
   - What's unclear: Whether the SW will stay alive during the CAPTCHA solving period (which can take 5 minutes)
   - Recommendation: If tab close skip fails, check whether the SW was terminated and `activeCaptchaTabs` was lost. This would be a bug to fix.

## Sources

### Primary (HIGH confidence)
- Source code analysis of `contentscripts/myjdCaptchaSolver.js`, `scripts/services/Rc2Service.js`, `background.js`, `contentscripts/captchaSolverContentscript.js`, `contentscripts/webinterfaceEnhancer.js`
- Manifest.json content script registration
- Existing Jest test suites (10 suites, 216 tests passing)
- Phase 4 CONTEXT.md, UAT.md, and implementation summaries
- REQUIREMENTS.md (TEST-01, TEST-02, TEST-03 definitions)

### Secondary (MEDIUM confidence)
- File hoster CAPTCHA requirements based on web search and JDownloader ecosystem research
- JDownloader browser solver configuration requirements from community forums and documentation

### Tertiary (LOW confidence)
- Specific CAPTCHA types used by individual file hosters (changes frequently)
- Current JDownloader plugin compatibility status for specific hosters

## Metadata

**Confidence breakdown:**
- Architecture understanding: HIGH - direct source code analysis of all CAPTCHA components
- Test approach: HIGH - user decisions are clear and locked in CONTEXT.md
- File hoster recommendations: MEDIUM - hosters change their CAPTCHA requirements frequently
- Pitfalls: HIGH - identified from direct code review and known MV3 constraints

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable; test approach locked)
