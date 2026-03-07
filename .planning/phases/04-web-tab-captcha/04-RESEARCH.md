# Phase 4: Web Tab CAPTCHA - Research (Corrected)

**Researched:** 2026-03-07 (second pass, after UAT bugs found)
**Domain:** Chrome Extension MV3 CAPTCHA solving via browser tabs
**Confidence:** HIGH

## Summary

Phase 4 was previously planned and executed (plans 04-01 through 04-04), but UAT testing revealed two critical bugs and several incorrect assumptions baked into the implementation. The old plans were based on wrong assumptions about what the MV2 extension actually did. After reading the actual old MV2 source code, the corrected CONTEXT.md is now the ground truth. This research supports a corrected re-plan.

The core issue is that the current MV3 implementation diverges from the old MV2 extension in several ways: (1) it added features that never existed (5-minute countdown, auto-skip), (2) it shows skip buttons for the MyJD flow when they should be hidden, (3) `captchaSolverContentscript.js` activates on arbitrary websites instead of only JD localhost pages, and (4) the extension has no independent CAPTCHA detection -- it requires my.jdownloader.org to be open, which users report was NOT required by the old extension.

**Primary recommendation:** Fix the two critical bugs (BUG 1: add CAPTCHA polling, BUG 2: URL gate on captchaSolverContentscript.js), remove features that never existed in the old extension (countdown, auto-skip), and correct the MyJD flow to hide skip buttons -- making the extension functionally identical to the old MV2 version.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Functionally identical to old MV2 extension, 100% MV3 compliant**
- Native helper is abandoned -- web tab is the sole CAPTCHA path
- No new features beyond what the old extension did
- Both localhost and MyJD flows must work
- Skip buttons: localhost only (hidden for MyJD), matching old behavior
- JD protocol callbacks (loaded/canClose/mouse-move): localhost only, matching old behavior
- Auto-close tab after solve (~2 seconds), matching old behavior
- loginNeeded.html shown when CAPTCHA triggers but extension not connected to MyJD
- No 5-minute countdown timer -- DROPPED per user decision (old extension never had one)
- No auto-skip on timeout -- DROPPED per user decision (old extension never had one)
- Content script ONLY activates on #rc2jdt hash (MyJD flow) or JD localhost URL (localhost flow)

### Claude's Discretion
- Whether to use one content script or two (user doesn't care, just needs to work)
- DOM building approach (template file vs programmatic)
- MV3 implementation details for script injection
- Token polling interval (old uses 500ms)
- How to transfer CAPTCHA data to content script (chrome.storage.session vs messaging)
- CAPTCHA polling interval and implementation details (for BUG 1 fix)

### Deferred Ideas (OUT OF SCOPE)
- Native helper removal/cleanup -- code can be removed in a future cleanup phase
- CaptchaNativeService.js deprecation -- removed from DI but file stays on disk
- Incognito/privacy CAPTCHA mode -- disabled even in MV2; out of scope
- MYJD skip via API (/captcha/skip) -- old extension had TODO for this; consider in Phase 5
- Window cleanup on tab close (old extension's close-me handler)
- Skip buttons for MyJD flow -- not in old extension, could be future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAP-01 | Content script on localhost detects JD CAPTCHA pages | BUG 2 fix: URL gate on captchaSolverContentscript.js to ONLY match `http://127.0.0.1:\d+/captcha/...` |
| CAP-02 | Token polling (g-recaptcha-response / h-captcha-response) | Already implemented in both content scripts; 500ms interval matches old extension |
| CAP-03 | Solved token relayed to service worker via chrome.runtime.sendMessage | Already implemented correctly in both content scripts |
| CAP-04 | Service worker submits token to JD callback URL via HTTP | Already implemented in background.js (captcha-solved handler) and Rc2Service |
| CAP-05 | Skip buttons (hoster/package/all/single) | REINTERPRET: localhost flow only. Hidden for MyJD flow (`display:none`). Currently shown incorrectly in myjdCaptchaSolver.js |
| CAP-06 | 5-minute countdown with auto-skip | DROPPED: Old extension never had this. Remove from both content scripts |
| CAP-07 | Tab close triggers skip | REINTERPRET: Localhost = HTTP skip to callbackUrl. MyJD = tab-closed message to my.jdownloader.org tabs. Already partially implemented |
| CAP-08 | Dual-mode native/web | REINTERPRET: Dual-FLOW (localhost + MyJD), not dual-MODE. Both flows must work. Native helper abandoned |
| CAP-09 | Rc2Service no longer closes JD's CAPTCHA tab when using web tab mode | Already correct -- handleRequest() just logs, doesn't close |
| CAP-10 | Works with reCAPTCHA v2, v3, hCaptcha | Already supported in both content scripts |
</phase_requirements>

## Existing Code Analysis

### What Works Correctly (DO NOT touch)
| Component | File | Status |
|-----------|------|--------|
| WebInterface bridge | `contentscripts/webinterfaceEnhancer.js` | Identical to MV2. Correct. |
| Token submission (localhost) | `Rc2Service.js` sendRc2SolutionToJd() | Correct for localhost flow |
| Token submission (MyJD) | `background.js` captcha-solved handler | Correct; routes through my.jdownloader.org tabs |
| Tab close behavior (MyJD) | `background.js` tabs.onRemoved | Correct; sends tab-closed message |
| Tab close behavior (localhost) | `background.js` tabs.onRemoved | Correct; sends HTTP skip |
| CSP stripping | `background.js` addCspStrippingRule/removeCspStrippingRule | Correct |
| MYJD tab preparation | `background.js` myjd-prepare-captcha-tab handler | Correct |
| MAIN world CAPTCHA execution | `background.js` myjd-captcha-execute handler | Correct |
| loginNeeded.html | `loginNeeded.html` | Correct |
| Rc2Service tab URL detection | `Rc2Service.js` chrome.tabs.onUpdated | Correct for MyJD hash trigger |
| Rc2Service MyJD API queries | `Rc2Service.js` onWebInterfaceCaptchaJobFound | Correct |
| JD protocol callbacks (in Rc2Service) | `Rc2Service.js` tabmode-init, loaded, mouse-move, canClose | Correct |
| Session storage for CAPTCHA data | `background.js` chrome.storage.session | Correct |

### What Needs Fixing

#### BUG 1 (CRITICAL): No independent CAPTCHA detection
**Current state:** The ONLY way a CAPTCHA gets detected for the MyJD flow is:
1. User has `my.jdownloader.org` open in a browser tab
2. `webinterfaceEnhancer.js` detects a trigger from the web interface
3. Tab URL changes to include `#rc2jdt&c={captchaId}`
4. `Rc2Service.js` `chrome.tabs.onUpdated` (line 290-324) catches the hash

**Problem:** Without my.jdownloader.org open, CAPTCHAs are silently ignored. The user confirmed this was NOT how the old extension worked.

**Fix:** Add CAPTCHA job polling. When logged into MyJD, periodically call `/captcha/getCaptchaJob` to check for pending jobs. When found, call `onWebInterfaceCaptchaJobFound()` directly. The API calls already exist in Rc2Service (lines 300-311). Use `myjdClientFactory` and `myjdDeviceClientFactory` (already injected).

**Implementation details:**
- Polling should start when connected to MyJD, stop when disconnected
- Polling interval: 3-5 seconds is reasonable (balances responsiveness vs. API load)
- Must avoid duplicate detection (track processed captchaIds)
- The `webinterfaceEnhancer.js` trigger should continue to work (it becomes an additional, faster path)
- Need a new tab for the CAPTCHA (not updating an existing tab since there is no trigger tab)

**Where to implement:** Could be in `Rc2Service.js` (has access to myjdClientFactory, myjdDeviceClientFactory) or in `background.js` (service worker; simpler lifecycle). Recommended: `Rc2Service.js` since it already has all the dependencies and CAPTCHA flow logic.

**Key challenge for service worker context:** `Rc2Service.js` runs in the AngularJS context (popup/offscreen), NOT in the service worker. The service worker (`background.js`) does not have access to `myjdClientFactory` or `myjdDeviceClientFactory`. Options:
1. Add polling in the offscreen document (has AngularJS context) -- but offscreen may not always be running
2. Add polling in `background.js` using direct MyJD API calls (bypass AngularJS services)
3. Use `chrome.alarms` API in background.js for periodic checks, forwarding to offscreen for API calls

**Recommendation:** Option 3 is most robust. The service worker already has a keepAlive alarm. Add a CAPTCHA poll alarm that fires every 3-5s while connected. When it fires, send a message to offscreen/popup to execute the API call and report back. This keeps API logic centralized where the MyJD client already exists.

**Alternative (simpler):** The old MV2 extension used a persistent background page where Rc2Service ran continuously. In MV3, the equivalent is the offscreen document (which bootstraps AngularJS). If we ensure the offscreen document stays alive while connected, we can add polling directly in Rc2Service.js using setInterval -- closest to the old extension's architecture.

#### BUG 2: captchaSolverContentscript.js leaks onto random websites
**Current state:** Lines 17-22 detect CAPTCHA widgets on ANY website:
```javascript
var recaptchaEl = document.querySelector('.g-recaptcha, [data-sitekey]');
var hcaptchaEl = document.querySelector('.h-captcha');
if (!recaptchaEl && !hcaptchaEl) return;
```
This injects skip buttons and countdown onto NitroFlare, Google, and any other site with a CAPTCHA.

**Fix:** Add URL gate at the top of the script. Only proceed if `window.location.href` matches `http://127.0.0.1:\d+/captcha/(recaptchav(2|3)|hcaptcha)/`. This matches how `myjdCaptchaSolver.js` has its `#rc2jdt` hash gate at line 5.

```javascript
// URL gate: only activate on JD localhost CAPTCHA pages
if (!/^http:\/\/127\.0\.0\.1:\d+\/captcha\/(recaptchav(2|3)|hcaptcha)\//.test(window.location.href)) return;
```

The `isJdLocalhost` variable already exists (line 6) but the else branch (lines 17-33) executes on ALL OTHER websites. Remove the entire else branch.

#### myjdCaptchaSolver.js: skip buttons shown when they should be hidden
**Current state:** `injectSkipButtons(job)` is called unconditionally at line 148.

**Old MV2 behavior:** rc2Contentscript.js line 496-498:
```javascript
if (job.callbackUrl === "MYJD") {
    var captchaControls = document.getElementById("captchaControlsContainer");
    captchaControls.style = "display:none;";
}
```
Skip buttons are always created but hidden when `callbackUrl === "MYJD"`.

**Fix:** After creating skip buttons, hide the container if `job.callbackUrl === 'MYJD'`. The `callbackUrl` is already present in the job object written to `chrome.storage.session`.

#### myjdCaptchaSolver.js: 5-minute countdown that never existed
**Current state:** `startCountdown(job)` is called at line 151. This creates a countdown timer and auto-skips on expiry.

**Old MV2 behavior:** rc2Contentscript.js has NO countdown timer. No `setTimeout` or `setInterval` for timeout. The only auto-close is the `canClose` polling from JD localhost (which sends `do=canClose` to JD's localhost URL).

**Fix:** Remove `startCountdown()` function entirely. Remove the call at line 151. Remove the `countdownHandle` variable.

#### captchaSolverContentscript.js: same countdown and auto-skip issues
**Current state:** Lines 61-62 call `startCountdown(callbackUrl)` and the function (lines 190-233) has the same 5-minute countdown with auto-skip.

**Fix:** Remove `startCountdown()` function and its call. Remove `countdownHandle` variable.

## Architecture Patterns

### Old MV2 Flow (ground truth for reimplementation)

#### Localhost Flow (JD on same machine)
```
JD opens browser tab to http://127.0.0.1:PORT/captcha/recaptchav2/hoster/?id=123
    |
    v Rc2Service.handleRequest() detects localhost URL pattern
    |
    v executeBrowserSolverScripts() injects browserSolverEnhancer.js
    |
    v browserSolverEnhancer reads meta tags (sitekey, challengeType, etc.)
    |
    v Sends myjdrc2:captcha-new with callbackUrl = localhost URL
    |
    v onNewCaptchaAvailable() stores params, navigates tab to targetDomain#rc2jdt
    |
    v Tab loads -> rc2Contentscript.js injected -> sends captcha-get -> receives captcha-set
    |
    v Clears DOM, loads solver template, renders CAPTCHA widget
    |
    v Skip buttons VISIBLE, JD protocol callbacks ACTIVE
    |
    v Token solved -> HTTP GET to localhost callbackUrl -> tab closes after 2s
```

#### MyJD Flow (JD on remote NAS/server) -- with BUG 1 fix (polling)
```
CAPTCHA polling detects pending job via MyJD API
    |  (OR: webinterfaceEnhancer.js triggers #rc2jdt&c=CAPTCHAID in existing tab)
    |
    v Rc2Service queries /captcha/getCaptchaJob -> /captcha/get
    |
    v onWebInterfaceCaptchaJobFound() -> myjd-prepare-captcha-tab message to SW
    |
    v SW writes job to chrome.storage.session, adds CSP rule, navigates/creates tab
    |
    v myjdCaptchaSolver.js reads job, clears DOM, renders CAPTCHA widget
    |
    v Skip buttons HIDDEN, NO JD protocol callbacks
    |
    v Token solved -> message to my.jdownloader.org tabs -> webinterfaceEnhancer relays
    |
    v Tab closes after 2s
```

### Content Script Architecture Decision

**Recommendation: Keep two content scripts** (one for each flow).

| Script | Flow | Activation | Registration |
|--------|------|------------|-------------|
| `captchaSolverContentscript.js` | Localhost | URL matches `http://127.0.0.1:\d+/captcha/...` | manifest.json (document_end) |
| `myjdCaptchaSolver.js` | MyJD | Hash starts with `#rc2jdt` | manifest.json (document_start) |

Rationale:
1. The two flows have different activation patterns (URL vs. hash)
2. Different data sources (meta tags from JD page vs. chrome.storage.session)
3. Different behaviors (skip buttons visible/hidden, protocol callbacks yes/no)
4. Different token routing (HTTP to localhost vs. message to my.jdownloader.org)
5. Single script would require complex branching; two clean scripts are easier to maintain

### MV3 Compliance Patterns (already established)

| MV2 Pattern | MV3 Replacement | Status |
|-------------|-----------------|--------|
| `chrome.tabs.executeScript` | `chrome.scripting.executeScript` or manifest content_scripts | Done |
| Inline `<script>` injection | External `<script>` elements + MAIN world execution | Done |
| `webRequestBlocking` CSP strip | `declarativeNetRequest` modifyHeaders | Done |
| Persistent background page | Service worker + offscreen document | Done |
| Template XHR loading | Programmatic DOM building | Done |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP stripping for CAPTCHA domains | Manual webRequest interception | `declarativeNetRequest` modifyHeaders with tabIds | Already done; MV3 compliant |
| CAPTCHA API loading | Inline script tags | External `<script>` elements (`api.js`) | MV3 CSP prohibits inline scripts |
| Invisible/v3 execution | Inline JS in content script | `chrome.scripting.executeScript({world: 'MAIN'})` | Content scripts cannot access page JS globals |
| Tab-scoped rules | Global static rules | Session rules with `tabIds` condition | Prevents CSP stripping on non-CAPTCHA tabs |

## Common Pitfalls

### Pitfall 1: Service Worker Lifecycle and Polling
**What goes wrong:** Service worker goes idle after 30s and terminates, killing `setInterval` CAPTCHA polls.
**Why it happens:** MV3 service workers are ephemeral.
**How to avoid:** Use `chrome.alarms` API for periodic work. The keepAlive alarm already exists (4 min). For CAPTCHA polling, add a separate alarm at 3-5s interval. Alarms survive SW termination.
**Warning signs:** Polling stops after approximately 30s of inactivity.

### Pitfall 2: Content Script Running on Wrong Pages
**What goes wrong:** `captchaSolverContentscript.js` registered on `*://*/*` injects UI onto any page with a CAPTCHA widget.
**Why it happens:** Missing URL gate; the script checks for DOM elements instead of URL pattern.
**How to avoid:** ALWAYS gate content scripts with URL/hash checks at the very top. Return immediately if conditions not met.
**Warning signs:** Skip buttons appearing on Google, NitroFlare, or other sites not served by JDownloader.

### Pitfall 3: Duplicate CAPTCHA Job Processing
**What goes wrong:** Polling detects the same CAPTCHA job multiple times, opening multiple tabs.
**Why it happens:** MyJD API returns the same pending job on consecutive calls until it is solved/skipped.
**How to avoid:** Track processed captchaIds in a Set. Clear entries after solve/skip/timeout.
**Warning signs:** Multiple CAPTCHA tabs opening for the same challenge.

### Pitfall 4: AngularJS Context Not Available in Service Worker
**What goes wrong:** Trying to use `myjdClientFactory` or `myjdDeviceClientFactory` in `background.js`.
**Why it happens:** These are AngularJS services only available in popup/offscreen contexts.
**How to avoid:** Route API calls through offscreen document or popup. Service worker acts as coordinator only.
**Warning signs:** `ReferenceError: myjdClientFactory is not defined` in service worker console.

### Pitfall 5: Tab Creation vs Update for Polling-Triggered CAPTCHAs
**What goes wrong:** Polling finds a job but there is no "trigger tab" to navigate. Using `chrome.tabs.update` fails because there is no tabId.
**Why it happens:** The `webinterfaceEnhancer.js` path has a specific tab that navigated to `#rc2jdt`. Polling does not.
**How to avoid:** When polling detects a job, use `chrome.tabs.create()` to open a new tab. Store the tabId for cleanup.
**Warning signs:** Console errors about invalid tabId, or navigation failing silently.

### Pitfall 6: Offscreen Document Not Running
**What goes wrong:** CAPTCHA polling relies on offscreen document for API calls, but offscreen is not always alive.
**Why it happens:** Offscreen documents are created on-demand and may be closed.
**How to avoid:** Ensure offscreen document is created before polling starts. Use `createOffscreenDocument()` pattern already in background.js.
**Warning signs:** Polling alarm fires but no API call happens.

### Pitfall 7: Chrome Alarms Minimum Interval
**What goes wrong:** `chrome.alarms.create` with periodInMinutes below 0.5 (30 seconds) is silently clamped to 30s in packed extensions.
**Why it happens:** Chrome enforces minimum 30s for alarms in production extensions. Unpacked extensions (development) may allow lower values.
**How to avoid:** For sub-30s polling, use `setInterval` in the offscreen document instead of `chrome.alarms`. The offscreen document can stay alive via its justification reason. Alternatively, accept 30s intervals if responsiveness is acceptable.
**Warning signs:** Polling interval appears to be 30s regardless of what you set.

## Code Examples

### BUG 2 Fix: URL Gate for captchaSolverContentscript.js
```javascript
// Source: old MV2 browserSolverEnhancer.js pattern + myjdCaptchaSolver.js line 5
(function() {
'use strict';

// URL gate: only activate on JD localhost CAPTCHA pages
if (!/^http:\/\/127\.0\.0\.1:\d+\/captcha\/(recaptchav(2|3)|hcaptcha)\//.test(window.location.href)) return;

// ... rest of localhost content script (remove the else branch entirely)
})();
```

### Skip Buttons Hidden for MyJD Flow
```javascript
// Source: old MV2 rc2Contentscript.js lines 496-498
function renderCaptchaWidget(job) {
    // ... render widget ...

    // Skip buttons -- always create, hide for MyJD
    injectSkipButtons(job);
    if (job.callbackUrl === 'MYJD') {
        var controls = document.getElementById('myjd-captcha-controls');
        if (controls) controls.style.display = 'none';
    }

    // NO countdown timer (old extension never had one)

    // Token polling
    pollingHandle = startTokenPolling(job);
}
```

### CAPTCHA Polling Architecture (BUG 1 Fix)
```javascript
// In background.js -- alarm-based polling coordination
const CAPTCHA_POLL_ALARM = 'captchaPoll';
let processedCaptchaIds = new Set();

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CAPTCHA_POLL_ALARM) {
        pollForCaptchaJobs();
    }
});

function startCaptchaPolling() {
    chrome.alarms.create(CAPTCHA_POLL_ALARM, {
        periodInMinutes: 0.5  // 30s minimum in packed; lower in unpacked
    });
}

function stopCaptchaPolling() {
    chrome.alarms.clear(CAPTCHA_POLL_ALARM);
    processedCaptchaIds.clear();
}

async function pollForCaptchaJobs() {
    // Route through offscreen document to access MyJD API
    try {
        const result = await sendToOffscreen('offscreen-poll-captcha');
        if (result && result.job && !processedCaptchaIds.has(result.job.captchaId)) {
            processedCaptchaIds.add(result.job.captchaId);
            handlePolledCaptchaJob(result.job);
        }
    } catch (e) {
        console.error('Background: CAPTCHA poll failed:', e);
    }
}

function handlePolledCaptchaJob(job) {
    // Create new tab for CAPTCHA (no trigger tab exists)
    chrome.tabs.create({ url: job.targetUrl + '#rc2jdt', active: true }, (tab) => {
        chrome.storage.session.set({ myjd_captcha_job: job });
        addCspStrippingRule(tab.id);
        activeCaptchaTabs[tab.id] = {
            callbackUrl: 'MYJD',
            captchaId: job.captchaId,
            captchaType: job.captchaType,
            hoster: job.hoster,
            detectedAt: Date.now()
        };
    });
}
```

### Alternative: setInterval in Offscreen Document (faster polling)
```javascript
// In offscreen.js or Rc2Service.js (AngularJS context)
// Use when < 30s polling is needed
let captchaPollingHandle = null;
let processedIds = new Set();

function startCaptchaPolling() {
    if (captchaPollingHandle) return;
    captchaPollingHandle = setInterval(function() {
        if (!myjdClientFactory.get().isConnected()) return;
        myjdClientFactory.get().getDeviceList().then(function(deviceResponse) {
            deviceResponse.result.forEach(function(device) {
                myjdDeviceClientFactory.get(device)
                    .sendRequest("/captcha/getCaptchaJob", "")
                    .then(function(captchaData) {
                        if (captchaData && captchaData.data && captchaData.data.id) {
                            if (!processedIds.has(captchaData.data.id)) {
                                processedIds.add(captchaData.data.id);
                                // Fetch full job details and trigger CAPTCHA flow
                                myjdDeviceClientFactory.get(device)
                                    .sendRequest("/captcha/get",
                                        JSON.stringify(captchaData.data.id), "rawtoken")
                                    .then(function(jobResponse) {
                                        if (jobResponse && jobResponse.data) {
                                            onWebInterfaceCaptchaJobFound(
                                                null, // no trigger tab
                                                captchaData.data,
                                                jobResponse.data
                                            );
                                        }
                                    });
                            }
                        }
                    }).catch(function() { /* no pending jobs */ });
            });
        });
    }, 5000); // 5 second interval
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 inline scripts | External script elements + MAIN world | MV3 migration | Already done |
| `chrome.tabs.executeScript` | `chrome.scripting.executeScript` / manifest | MV3 migration | Already done |
| `webRequestBlocking` | `declarativeNetRequest` | MV3 migration | Already done |
| Persistent background page | Service worker + offscreen | MV3 migration | Affects CAPTCHA polling design |

## Open Questions

1. **Chrome Alarms minimum interval vs. setInterval in offscreen**
   - What we know: Chrome enforces minimum 30 seconds for `chrome.alarms` in packed extensions. `setInterval` in offscreen has no such limit.
   - What is unclear: Is 30s acceptable for CAPTCHA detection? The old MV2 extension with persistent background could respond faster via the webinterfaceEnhancer trigger.
   - Recommendation: Use `setInterval` in the offscreen document (or Rc2Service.js within offscreen). 5-second interval is responsive enough. Keep offscreen alive while connected. This is closest to old MV2 architecture.

2. **onWebInterfaceCaptchaJobFound needs tab ID for polling path**
   - What we know: `onWebInterfaceCaptchaJobFound(tab, captchaData, captchaJob)` takes a `tab` parameter (the trigger tab to navigate). When polling detects a job, there is no existing tab.
   - What is unclear: Should we create the tab first then pass its ID, or modify the function to handle `null` tabId by creating a new tab?
   - Recommendation: Modify `onWebInterfaceCaptchaJobFound` (or the `myjd-prepare-captcha-tab` handler in background.js) to create a new tab when `tabId` is null/undefined. Cleanest approach.

3. **getCaptchaJob API parameter**
   - What we know: The `webinterfaceEnhancer.js` path passes a specific `captchaId` to `/captcha/getCaptchaJob`. Polling needs to check for ANY pending job.
   - What is unclear: What parameter to pass for "give me any pending job." Looking at line 304: `sendRequest("/captcha/getCaptchaJob", captchaId)`. For polling, we likely pass an empty string or null.
   - Recommendation: Test with empty/null parameter during implementation. The MyJD API likely returns the first pending job when no specific ID is given.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 with jsdom |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --verbose` |
| Full suite command | `npx jest --verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | Localhost URL gate on captchaSolverContentscript.js | unit (structural) | `npx jest scripts/services/__tests__/captchaSolverContentscript.test.js -x` | Yes -- needs update |
| CAP-02 | Token polling (500ms interval) | unit (structural) | `npx jest scripts/services/__tests__/captchaSolverContentscript.test.js -x` | Yes |
| CAP-03 | Token relay via chrome.runtime.sendMessage | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes |
| CAP-04 | Service worker token submission | unit (structural) | `npx jest scripts/services/__tests__/background-captcha.test.js -x` | Yes |
| CAP-05 | Skip buttons hidden for MYJD flow | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes -- needs update |
| CAP-06 | Countdown REMOVED | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes -- needs update |
| CAP-07 | Tab close behavior | unit (structural) | `npx jest scripts/services/__tests__/background-captcha.test.js -x` | Yes |
| CAP-08 | Dual-flow (localhost + MyJD) | manual | N/A | N/A |
| CAP-09 | Rc2Service does not close tab | unit (structural) | `npx jest scripts/services/__tests__/Rc2Service.test.js -x` | Yes |
| CAP-10 | reCAPTCHA v2/v3/hCaptcha support | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes |

### Sampling Rate
- **Per task commit:** `npx jest --verbose`
- **Per wave merge:** `npx jest --verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- Update `captchaSolverContentscript.test.js` -- needs tests for URL gate (reject non-localhost URLs); remove countdown timer tests
- Update `myjdCaptchaSolver.test.js` -- needs test that skip buttons have `display:none` for MYJD; remove countdown timer tests
- New tests for CAPTCHA polling logic (if implemented in background.js or offscreen.js)

## Detailed File Change Map

### Files to Modify

| File | Changes | Complexity |
|------|---------|------------|
| `contentscripts/captchaSolverContentscript.js` | Add URL gate at top; remove else branch (arbitrary site detection); remove countdown function and call | Low |
| `contentscripts/myjdCaptchaSolver.js` | Hide skip buttons for MYJD flow; remove countdown function and call | Low |
| `scripts/services/Rc2Service.js` or `background.js` + `offscreen.js` | Add CAPTCHA job polling when connected | Medium-High |
| `background.js` | Start/stop polling based on connection state; handle polled jobs (create new tab when no trigger tab exists) | Medium |
| Test files (3-4 files) | Update tests to match corrected behavior; add new tests for URL gate and polling | Medium |

### Files to NOT Modify
| File | Reason |
|------|--------|
| `contentscripts/webinterfaceEnhancer.js` | Identical to MV2, correct as-is |
| `manifest.json` | Content script registrations are correct as-is |
| `loginNeeded.html` | Correct as-is |
| `popup.js` / `popup.html` | Not part of CAPTCHA flow |

## Sources

### Primary (HIGH confidence)
- Old MV2 extension source: `C:\Users\anthony\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\fbcohnmimjicjdomonkcbcpbpnhggkip\3.3.20_0\` -- rc2Contentscript.js (627 lines), browserSolverEnhancer.js (130 lines), Rc2Service.js (397 lines), webinterfaceEnhancer.js (64 lines), browser_solver_template.html (62 lines)
- Current MV3 source: all files in project root -- direct code inspection of every relevant file
- `04-CONTEXT.md` (corrected): user-confirmed ground truth after reading old MV2 source
- `.continue-here.md`: UAT bug details from real Chrome CDP testing with live extension

### Secondary (MEDIUM confidence)
- Chrome Extensions MV3 documentation for chrome.alarms, chrome.scripting, declarativeNetRequest, offscreen documents
- Existing project patterns from Phases 1-3 (chrome.storage.session usage, offscreen document management)

### Tertiary (LOW confidence)
- Chrome alarms minimum interval behavior (30s for packed, lower for unpacked) -- needs validation during implementation

## Metadata

**Confidence breakdown:**
- Bug fixes (BUG 2, countdown removal, skip button hiding): HIGH -- clear from line-by-line old MV2 source comparison
- Architecture (CAPTCHA polling / BUG 1): MEDIUM -- multiple implementation approaches; service worker lifecycle adds complexity; needs experimentation
- Test updates: HIGH -- structural tests follow established project patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable; Chrome extension APIs unlikely to change)
