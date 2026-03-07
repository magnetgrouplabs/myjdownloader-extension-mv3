---
phase: 04-web-tab-captcha
plan: 03
subsystem: captcha
tags: [chrome-extension, mv3, content-script, service-worker, myjd-remote, structural-tests, session-storage, declarativeNetRequest]

# Dependency graph
requires:
  - phase: 04-web-tab-captcha
    provides: CAPTCHA content script with token polling, skip buttons, countdown (Plan 01)
  - phase: 04-web-tab-captcha
    provides: Service worker CAPTCHA message handlers (Plan 02)
provides:
  - Rc2Service MYJD flow wired through service worker myjd-prepare-captcha-tab message
  - myjdCaptchaSolver.js content script for MYJD remote CAPTCHA solving
  - Background.js MYJD handlers (prepare, execute, CSP rules, dual-path solve/skip)
  - Comprehensive structural tests for MYJD content script and handlers
affects: [05-captcha-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [myjd-service-worker-flow, dual-path-captcha-handlers, csp-stripping-rules, session-storage-job-transfer]

key-files:
  created:
    - contentscripts/myjdCaptchaSolver.js
    - scripts/services/__tests__/myjdCaptchaSolver.test.js
  modified:
    - scripts/services/Rc2Service.js
    - background.js
    - manifest.json
    - jest.setup.js
    - scripts/services/__tests__/Rc2Service.test.js
    - scripts/services/__tests__/background-captcha.test.js

key-decisions:
  - "Rc2Service sends myjd-prepare-captcha-tab to service worker instead of old rc2TabUpdateCallbacks pattern"
  - "onNewCaptchaAvailable routes MYJD flow via chrome.runtime.sendMessage (not chrome.tabs.query to web interface)"
  - "myjdCaptchaSolver.js uses document.open/close DOM replacement with clearDocument and DOMContentLoaded defenses"
  - "Session storage job transfer: service worker writes myjd_captcha_job, content script reads it"
  - "CSP stripping via declarativeNetRequest modifyHeaders with tab-scoped rules (ID = 10000 + tabId)"

patterns-established:
  - "MYJD flow: Rc2Service -> service worker (myjd-prepare-captcha-tab) -> session storage + CSP rule + tab navigate -> content script renders widget"
  - "Dual-path handlers: captcha-solved/captcha-skip/onRemoved check callbackUrl === 'MYJD' for MYJD vs localhost routing"
  - "Hash gate pattern: content script at document_start exits immediately if no #rc2jdt hash (zero overhead on normal pages)"

requirements-completed: [CAP-04, CAP-07, CAP-08, CAP-10]

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 4 Plan 3: MYJD CAPTCHA Flow Wiring and Structural Tests Summary

**Rc2Service wired to service worker MYJD CAPTCHA flow with myjdCaptchaSolver.js content script, dual-path background handlers, and 54 new structural tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T20:55:37Z
- **Completed:** 2026-03-07T21:03:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Wired Rc2Service.onWebInterfaceCaptchaJobFound to send myjd-prepare-captcha-tab to service worker instead of old rc2TabUpdateCallbacks pattern
- Created myjdCaptchaSolver.js content script with hash gate, DOM replacement, CAPTCHA widget rendering, token polling, skip buttons, and countdown timer
- Added background.js MYJD infrastructure: setAccessLevel, CSP stripping rules, myjd-prepare-captcha-tab handler, myjd-captcha-execute MAIN world handler
- Updated captcha-solved/captcha-skip/onRemoved handlers for dual MYJD + localhost flow
- Full test suite: 186 tests passing (54 new), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Rc2Service.js to use new MYJD CAPTCHA flow** - `f83cdbc` (feat)
2. **Task 2: Create myjdCaptchaSolver structural tests and update background-captcha and Rc2Service tests** - `c59759a` (feat)

## Files Created/Modified
- `scripts/services/Rc2Service.js` - onWebInterfaceCaptchaJobFound builds jobDetails and sends myjd-prepare-captcha-tab; onNewCaptchaAvailable routes MYJD flow through service worker
- `contentscripts/myjdCaptchaSolver.js` - NEW: MYJD remote CAPTCHA solver content script (hash gate, DOM replacement, session storage read, widget rendering, token polling, skip buttons, countdown)
- `background.js` - Added setAccessLevel, CSP stripping rules, myjd-prepare-captcha-tab handler, myjd-captcha-execute handler, captcha-can-close handler; updated captcha-solved/captcha-skip/onRemoved for dual MYJD+localhost flow
- `manifest.json` - Registered myjdCaptchaSolver.js at document_start with all_frames: false
- `jest.setup.js` - Added setAccessLevel mock to chrome.storage.session
- `scripts/services/__tests__/myjdCaptchaSolver.test.js` - NEW: 29 structural tests for MYJD content script
- `scripts/services/__tests__/background-captcha.test.js` - Added 14 MYJD flow handler tests
- `scripts/services/__tests__/Rc2Service.test.js` - Added 6 MYJD flow tests, updated existing test for new service worker routing

## Decisions Made
- Rc2Service sends myjd-prepare-captcha-tab to service worker instead of calling onNewCaptchaAvailable for MYJD flow (cleaner separation of concerns)
- onNewCaptchaAvailable still handles the captcha-new message path from webinterfaceEnhancer.js but routes through service worker
- myjdCaptchaSolver.js uses three defense layers for DOM replacement: document.open/close, readystatechange clearDocument, and DOMContentLoaded foreign body removal
- CSP rules use 10000 + tabId for rule ID uniqueness (avoids collision with CNL rules at IDs 1-2)
- captcha-can-close handler added as fallback for content scripts that cannot call window.close()

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created myjdCaptchaSolver.js content script (Plan 02 prerequisite)**
- **Found during:** Task 2 (creating structural tests that read the file)
- **Issue:** myjdCaptchaSolver.js did not exist - Plan 02 was replanned after original execution, and the replanned version was never re-executed
- **Fix:** Created the full content script per Plan 02 spec (hash gate, DOM replacement, widget rendering, token polling, skip buttons, countdown, MYJD messaging)
- **Files created:** contentscripts/myjdCaptchaSolver.js
- **Verification:** 29 structural tests pass, manifest registration verified
- **Committed in:** c59759a (Task 2 commit)

**2. [Rule 3 - Blocking] Added background.js MYJD handlers (Plan 02 prerequisite)**
- **Found during:** Task 2 (background-captcha tests need MYJD patterns in source)
- **Issue:** background.js lacked setAccessLevel, CSP stripping rules, myjd-prepare-captcha-tab handler, myjd-captcha-execute handler, and MYJD paths in captcha-solved/captcha-skip/onRemoved
- **Fix:** Added all MYJD infrastructure to background.js per Plan 02 spec
- **Files modified:** background.js, manifest.json, jest.setup.js
- **Verification:** 14 new background-captcha tests pass, existing 16 tests still pass
- **Committed in:** c59759a (Task 2 commit)

**3. [Rule 1 - Bug] Updated existing test for new onNewCaptchaAvailable behavior**
- **Found during:** Task 1 (existing test expected chrome.tabs.query in onNewCaptchaAvailable)
- **Issue:** Test checked for old flow (chrome.tabs.query to my.jdownloader.org) but new flow uses chrome.runtime.sendMessage
- **Fix:** Updated test assertion to verify myjd-prepare-captcha-tab routing
- **Files modified:** scripts/services/__tests__/Rc2Service.test.js
- **Committed in:** f83cdbc (Task 1 commit)

**4. [Rule 1 - Bug] Updated background-captcha onRemoved test regex**
- **Found during:** Task 2 (test regex matched first }); inside MYJD chrome.tabs.query callback)
- **Issue:** Regex /onRemoved\.addListener[\s\S]*?\}\);/ was too greedy early on due to new MYJD nested callbacks
- **Fix:** Updated regex to match full onRemoved section up to keepalive
- **Files modified:** scripts/services/__tests__/background-captcha.test.js
- **Committed in:** c59759a (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking prerequisite, 2 bug fixes)
**Impact on plan:** Blocking prerequisites were necessary because replanned Plan 02 was never re-executed. Bug fixes were direct consequences of the code changes. No scope creep.

## Issues Encountered
None beyond the documented deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Web Tab CAPTCHA) Flow B is now fully wired: my.jdownloader.org trigger -> Rc2Service API query -> service worker prep -> content script render -> token poll -> solve/skip routed back
- Phase 5 (CAPTCHA E2E Testing) can proceed to validate the full CAPTCHA flow end-to-end
- The three MV2 parity features (canClose, loaded, mouse-move) from the .continue-here.md are SEPARATE from this plan and apply to the localhost flow (Plan 01 content script)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 04-web-tab-captcha*
*Completed: 2026-03-07*
