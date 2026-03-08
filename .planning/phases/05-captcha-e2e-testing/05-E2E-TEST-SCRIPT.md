# Phase 5: E2E Test Script - MYJD Remote CAPTCHA Flow (TEST-01)

**Created:** 2026-03-08
**Purpose:** Step-by-step test script for live CAPTCHA E2E testing in Plan 02
**Covers:** TEST-01 (full flow), TEST-03 (CAPTCHA type coverage)

---

## Prerequisites Checklist

Before starting any test, confirm all of the following:

- [ ] **Extension loaded** at `chrome://extensions/` with no errors (check for red error badges)
- [ ] **Extension logged in** to MyJD -- open popup, verify connected device is shown
- [ ] **my.jdownloader.org open** in a browser tab, logged in to the same MyJD account
- [ ] **JDownloader running** on NAS (Unraid), connected to MyJD account -- verify at my.jdownloader.org that the device appears online
- [ ] **Browser Solver enabled** in JDownloader: Settings > Captchas > ensure "Browser Solver" is toggled on
- [ ] **No active downloads** in JDownloader -- clear the queue for a clean test
- [ ] **Chrome DevTools open** on the service worker (chrome://extensions/ > "service worker" link) for log monitoring

---

## Test 1: MYJD Remote CAPTCHA Flow -- Full E2E

**Objective:** Verify the complete chain from CAPTCHA trigger to successful download.

### Steps

1. **Find a CAPTCHA-gated download link** (see File Hosters section below for recommendations)
2. **Add the download link to JDownloader** -- use the extension's right-click context menu "Download with JDownloader" on the link, or add it directly in JDownloader's UI / my.jdownloader.org interface
3. **Start the download** in JDownloader (move from linkgrabber to download list, or it may auto-start)
4. **Wait for JDownloader to encounter the CAPTCHA** -- watch the JDownloader status and the service worker console simultaneously
5. **Verify: Extension detects CAPTCHA** -- a new browser tab should open automatically
   - Service worker console should show:
     ```
     Background message: myjd-prepare-captcha-tab from: extension
     Background: MYJD CAPTCHA tab prepared: <tabId> <hoster>
     ```
6. **Verify: Tab navigated to target domain** with `#rc2jdt` hash in the URL
7. **Verify: CAPTCHA widget rendered** -- reCAPTCHA checkbox, hCaptcha widget, or invisible CAPTCHA execution
   - Page should show "CAPTCHA for [hoster]" header
   - Skip buttons visible: "Skip [hoster] CAPTCHAs", "Skip Package", "Skip All", "Skip This"
   - Countdown timer visible, counting down from 5:00
8. **USER ACTION: Solve the CAPTCHA** -- click the checkbox, complete the challenge
9. **Verify: Tab auto-closes** after approximately 2 seconds
   - Service worker console should show:
     ```
     Background message: captcha-solved from: tab:<tabId>
     ```
10. **Verify: JDownloader shows download progressing** -- user confirms download has started or completed in JD
    - If download does not start, check JDownloader status for errors

### Expected Service Worker Console Log Sequence (Full Success)

```
Background message: myjd-prepare-captcha-tab from: extension
Background: MYJD CAPTCHA tab prepared: <tabId> <hoster>
Background message: captcha-solved from: tab:<tabId>
```

For invisible/v3 CAPTCHAs, also expect:
```
Background message: myjd-captcha-execute from: tab:<tabId>
```

### Pass Criteria
- CAPTCHA tab opens automatically
- Widget renders on the page
- After solving, tab auto-closes
- JDownloader shows download progressing or completed

### Fail Criteria
- Tab does not open (flow broken before tab navigation)
- Widget does not render (CSP blocking or job data missing)
- Token does not submit (relay failure to my.jdownloader.org)
- JDownloader does not receive token (download stays stuck on CAPTCHA)

---

## Test 2: CAPTCHA Tab Close = Skip

**Objective:** Verify that closing a CAPTCHA tab sends a skip signal to JDownloader.

### Steps

1. **Trigger another CAPTCHA** -- add another CAPTCHA-gated download link, or wait for the next CAPTCHA in a batch
2. **Wait for CAPTCHA tab to open** -- same verification as Test 1 steps 5-7
3. **Close the CAPTCHA tab manually** (click the X, do NOT solve the CAPTCHA)
4. **Verify: Service worker console shows skip message:**
   ```
   Background: MYJD CAPTCHA tab closed, sent tab-closed for <hoster>
   ```
5. **Verify: JDownloader shows CAPTCHA as skipped** -- check JD status/logs

### Pass Criteria
- Closing the tab triggers the `tab-closed` message in the service worker
- JDownloader receives the skip signal and moves on (skips the CAPTCHA, may retry later or show error)

### Fail Criteria
- No skip message in service worker console (activeCaptchaTabs tracking lost)
- JDownloader remains stuck waiting for CAPTCHA (skip signal not received)

---

## Test 3: Extension State Verification

**Objective:** Verify cleanup of extension internal state after CAPTCHA operations.

### Steps (run between Test 1 and Test 2, or after each test)

1. **Open service worker DevTools console** (chrome://extensions/ > service worker link)

2. **Check session storage for CAPTCHA job:**
   ```javascript
   chrome.storage.session.get('myjd_captcha_job', console.log)
   ```
   - **Expected after tab closes:** Should be empty/undefined (job consumed)

3. **Check CSP stripping rules:**
   ```javascript
   chrome.declarativeNetRequest.getSessionRules(rules => console.log(rules))
   ```
   - **Expected after tab closes:** No rules with ID in the 10000+ range (CSP rules cleaned up)
   - CNL rules (ID 1, 2) may exist -- those are normal

4. **Check service worker console for errors:**
   - Scroll through recent logs
   - **Expected:** No errors related to CAPTCHA handling

5. **Verify activeCaptchaTabs is empty:**
   ```javascript
   // This variable is in the service worker's scope
   console.log(activeCaptchaTabs)
   ```
   - **Expected after all CAPTCHA tabs closed:** Empty object `{}`

### Pass Criteria
- Session storage cleaned up after tab close
- CSP rules removed for closed CAPTCHA tabs
- No errors in service worker console
- activeCaptchaTabs is empty after all tests

---

## Test 4: Countdown Timer and Auto-Skip

**Objective:** Verify the 5-minute countdown expires and sends auto-skip.

### Steps

1. **Trigger a CAPTCHA** (same as Test 1 steps 1-7)
2. **Do NOT solve the CAPTCHA** -- leave the tab open
3. **Verify countdown timer** is visible and counting down from 5:00
4. **Wait approximately 4 minutes** and verify:
   - Timer shows less than 1 minute remaining
   - Timer text turns red and bold (visual urgency)
5. **Wait for timer to reach 0:00**
6. **Verify: Timer shows "Timed out - skipping..."**
7. **Verify: Service worker console shows skip message** (same as tab close skip)

### Pass Criteria
- Countdown displays correctly
- Visual urgency triggers under 60 seconds
- Auto-skip sends `skiptype=single` on expiry

### Fail Criteria
- Timer does not display
- Timer does not count down correctly
- Auto-skip does not fire

**Note:** This test takes 5 minutes of wall-clock time. It may be combined with other testing if time is limited. The countdown and auto-skip are already verified via code review and unit tests -- this is a visual confirmation.

---

## Pass/Fail Criteria (Overall)

### Phase 5 PASS Conditions
- **Test 1 passes:** Full CAPTCHA flow works end-to-end (tab opens, user solves, token submits, download starts)
- **Test 2 passes:** Tab close sends skip signal to JDownloader
- **Test 3 passes:** Extension state is properly cleaned up

### Phase 5 FAIL Conditions
- Any break in the CAPTCHA chain that prevents token delivery to JDownloader
- Extension state leaks (CSP rules not cleaned up, session storage not cleared)

### Acceptable Variations
- Specific hoster plugins may be broken in JDownloader -- try alternative hosters (not an extension bug)
- CAPTCHA type may vary by hoster -- any type working confirms the flow
- my.jdownloader.org may be slow to relay -- small delays are acceptable if the token ultimately arrives

---

## On Failure Protocol

If any test fails, follow these debug steps in order:

### Step 1: Check Service Worker Console
- Look for error messages after the last "Background message:" log
- Note the exact point where the flow breaks

### Step 2: Check chrome.storage.session State
```javascript
chrome.storage.session.get('myjd_captcha_job', console.log)
```
- If job data is present but tab didn't navigate: service worker tab navigation failed
- If job data is empty but widget didn't render: content script activation issue

### Step 3: Check CSP Rules
```javascript
chrome.declarativeNetRequest.getSessionRules(rules => console.log(rules))
```
- If no CSP rule for the tab: CAPTCHA widget scripts may be blocked by the target site's CSP
- Check Network tab for blocked script loads (reCAPTCHA/hCaptcha API)

### Step 4: Check my.jdownloader.org Tab
- Open DevTools on the my.jdownloader.org tab
- Look for `myjdrc2` messages in the console
- Verify `webinterfaceEnhancer.js` is receiving and relaying messages

### Step 5: Check CAPTCHA Tab Console
- If tab is still open, open DevTools
- Look for content script errors
- Check if `#rc2jdt` hash is in the URL
- Verify DOM was replaced (body should have `id="myjd-captcha-body"`)

### Step 6: Fix Inline
- If the issue is a code bug: fix it, reload the extension, and re-test
- If the issue is configuration: fix JDownloader settings and re-test
- Document the fix in test results

---

## File Hosters to Try (Priority Order)

| Priority | Hoster | Expected CAPTCHA | Notes |
|----------|--------|-----------------|-------|
| 1 | Rapidgator | reCAPTCHA v2 | Most established; consistent CAPTCHA requirement for free downloads |
| 2 | Nitroflare | reCAPTCHA v2 or hCaptcha | Common CAPTCHA for free tier |
| 3 | Turbobit | reCAPTCHA | Free downloads require CAPTCHA |
| 4 | DDownload | reCAPTCHA/hCaptcha | May require CAPTCHA for free downloads |
| 5 | Uploaded.net | reCAPTCHA v2 | Traditional CAPTCHA requirement |

**Skip:** pixeldrain (user is premium -- CAPTCHAs will not trigger)

**Strategy:** Start with #1 (Rapidgator). If JDownloader's plugin is broken or the hoster changed their flow, move to #2, and so on. The goal is to get ANY CAPTCHA to trigger -- the specific hoster does not matter.

**Finding download links:** Search for "rapidgator test file" or "nitroflare test download" to find small files hosted on these services. Alternatively, upload a small test file (1KB text file) to a CAPTCHA-gated hoster.

---

## CAPTCHA Type Coverage (TEST-03)

During live testing, document which CAPTCHA types were encountered:

| CAPTCHA Type | Encountered? | Hoster | Working? |
|-------------|-------------|--------|----------|
| reCAPTCHA v2 (checkbox) | | | |
| reCAPTCHA v3 (invisible) | | | |
| reCAPTCHA Enterprise | | | |
| hCaptcha | | | |

**Goal:** At least one CAPTCHA type confirmed working during live testing. The code supports all four types listed above -- the test confirms whichever JDownloader naturally encounters.

**Note:** reCAPTCHA v2 is the most commonly encountered type on file hosting sites. hCaptcha is used by some hosters (e.g., some Nitroflare configurations). v3/invisible and Enterprise are less common but may appear. Do not force specific types -- test what JDownloader encounters naturally.

---

## Reference: Key Message Flow

```
webinterfaceEnhancer.js (my.jdownloader.org tab)
    |  detects #rc2jdt&c=CAPTCHAID in tab URL change
    v
Rc2Service.js (extension popup/offscreen context)
    |  queries MyJD API: /captcha/getCaptchaJob -> /captcha/get
    |  sends: { action: 'myjd-prepare-captcha-tab', data: { tabId, jobDetails } }
    v
background.js (service worker)
    |  writes chrome.storage.session (myjd_captcha_job)
    |  adds CSP stripping rule (declarativeNetRequest)
    |  navigates tab to targetUrl#rc2jdt
    v
myjdCaptchaSolver.js (content script on target domain)
    |  reads job from chrome.storage.session
    |  replaces DOM, renders CAPTCHA widget
    |  starts token polling (500ms), countdown (5min), skip buttons
    v
User solves CAPTCHA
    |  token detected in textarea
    |  sends: { action: 'captcha-solved', data: { token, callbackUrl: 'MYJD', captchaId } }
    v
background.js (service worker)
    |  routes token to my.jdownloader.org tabs via chrome.tabs.sendMessage
    |  { name: 'response', type: 'myjdrc2', data: { captchaId, token } }
    v
webinterfaceEnhancer.js (my.jdownloader.org tab)
    |  relays via window.postMessage to MyJD web interface
    v
MyJD cloud API -> JDownloader (on NAS) receives token -> download proceeds
```
