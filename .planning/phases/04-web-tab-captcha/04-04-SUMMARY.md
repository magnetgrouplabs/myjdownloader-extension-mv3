---
phase: 04-web-tab-captcha
plan: 04
subsystem: captcha
tags: [xhr, jdownloader-protocol, content-script, mv3, captcha]

# Dependency graph
requires:
  - phase: 04-web-tab-captcha (plan 01)
    provides: captchaSolverContentscript.js with token polling, skip buttons, countdown
  - phase: 04-web-tab-captcha (plan 02)
    provides: background.js captcha-can-close handler
  - phase: 04-web-tab-captcha (plan 03)
    provides: Rc2Service onLoginNeeded reference to loginNeeded.html
provides:
  - JD protocol canClose polling (external solve detection + tab close)
  - JD protocol loaded event (11 geometry params for auto-click coordination)
  - JD protocol mouse-move reporting (3s throttle to prevent activity timeout)
  - loginNeeded.html page for unauthenticated MYJD CAPTCHA flow
affects: [05-captcha-e2e-testing, 06-mv3-compliance-audit]

# Tech tracking
tech-stack:
  added: []
  patterns: [XMLHttpRequest with X-Myjd-Appkey header for JD callbacks, throttled event reporting, retry-with-backoff for DOM element detection]

key-files:
  created: [loginNeeded.html]
  modified: [contentscripts/captchaSolverContentscript.js, scripts/services/__tests__/captchaSolverContentscript.test.js]

key-decisions:
  - "XMLHttpRequest for JD callbacks (not fetch) — matches IIFE content script style"
  - "captcha-can-close as fallback after window.close() try/catch"
  - "loadedRetries with max 10 retries at 500ms for CAPTCHA element detection"

patterns-established:
  - "XHR with X-Myjd-Appkey header for all JD protocol callbacks"
  - "3s mousemove throttle via lastMouseMoveTime timestamp comparison"
  - "isJdLocalhost gate for localhost-only protocol callbacks"

requirements-completed: [CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09, CAP-10]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 4 Plan 4: Gap Closure Summary

**JD protocol callbacks (canClose, loaded, mouse-move) via XMLHttpRequest with X-Myjd-Appkey header, plus loginNeeded.html for unauthenticated MYJD flow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T21:26:52Z
- **Completed:** 2026-03-07T21:29:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented three JD protocol callbacks in captchaSolverContentscript.js: canClose (1s polling, tab close on "true"), loaded (11 geometry params), mouse-move (3s throttled reporting)
- All XHR calls include X-Myjd-Appkey header and 5s timeout; protocol callbacks gated on isJdLocalhost
- Created loginNeeded.html with MV3-compliant styling for unauthenticated MYJD CAPTCHA users
- Added 30 structural tests (canClose: 9, loaded: 8, mouse-move: 6, gating: 1, loginNeeded: 5, cleanup: 1) — all passing
- Full test suite: 216 tests passing with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add JD protocol callbacks and create loginNeeded.html** - `0a9636b` (feat)
2. **Task 2: Add structural tests for protocol callbacks and loginNeeded.html** - `d50e920` (test)

## Files Created/Modified
- `contentscripts/captchaSolverContentscript.js` - Added startCanClosePolling, sendLoadedEvent, startMouseMoveReporting functions with isJdLocalhost gate and beforeunload cleanup
- `loginNeeded.html` - MV3-compliant login-required page with #dbf5fb background, centered card layout
- `scripts/services/__tests__/captchaSolverContentscript.test.js` - 30 new structural tests for protocol callbacks, gating, loginNeeded.html; fixed callbackUrl test for captcha-can-close

## Decisions Made
- Used XMLHttpRequest (not fetch) to match existing IIFE content script style and `var` declaration pattern
- captcha-can-close message always sent after window.close() attempt as fallback (service worker closes tab if window.close fails)
- loadedRetries capped at 10 (5 seconds total) for CAPTCHA element detection — sufficient for widget render
- Fixed existing callbackUrl test to filter data-carrying messages only (captcha-can-close has no data payload)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed existing callbackUrl assertion test**
- **Found during:** Task 2 (structural tests)
- **Issue:** Existing "should include callbackUrl in all message types" test now fails because new captcha-can-close sendMessage has no callbackUrl (it's a tab-close signal, not a data message)
- **Fix:** Updated test to filter for data-carrying messages only, excluding the captcha-can-close signal
- **Files modified:** scripts/services/__tests__/captchaSolverContentscript.test.js
- **Verification:** All 66 content script tests pass
- **Committed in:** d50e920 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for test correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 fully complete (4/4 plans) — all CAPTCHA gap closures done
- Ready for Phase 5 (CAPTCHA E2E Testing) — all CAPTCHA flows wired and tested structurally
- 216 tests passing across 10 test suites

## Self-Check: PASSED

All files verified present on disk. All commit hashes verified in git log.

---
*Phase: 04-web-tab-captcha*
*Completed: 2026-03-07*
