---
phase: 04-web-tab-captcha
plan: 02
subsystem: captcha
tags: [service-worker, message-handlers, xhr, chrome-extension, mv3, tab-lifecycle]

# Dependency graph
requires:
  - phase: 04-web-tab-captcha
    provides: CAPTCHA content script with token polling, skip buttons, countdown timer (Plan 01)
  - phase: 01-bug-fixes
    provides: CAPTCHA deduplication guard (BUG-02, now removed)
provides:
  - Service worker CAPTCHA message handlers (captcha-tab-detected, captcha-solved, captcha-skip)
  - HTTP relay from content script messages to JDownloader localhost callback API
  - Tab lifecycle management (auto-close after solve, skip-on-close)
  - Rc2Service modified to not interfere with web tab CAPTCHA flow
affects: [05-captcha-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [service-worker-message-relay, xhr-callback-api, tab-lifecycle-management]

key-files:
  created:
    - scripts/services/__tests__/background-captcha.test.js
  modified:
    - background.js
    - scripts/services/Rc2Service.js
    - scripts/services/__tests__/Rc2Service.test.js

key-decisions:
  - "encodeURIComponent on CAPTCHA token to prevent URL injection via special characters"
  - "skiptype=single for tab close (less aggressive than hoster, consistent with timeout behavior)"
  - "Delete activeCaptchaTabs entry before sending HTTP request to prevent race condition"
  - "Remove CaptchaNativeService from DI but keep .js file (deferred deletion per CONTEXT.md)"
  - "Remove captchaInProgress dedup guard (was only for native helper double-sends)"

patterns-established:
  - "Service worker XHR relay: content script sends {action, data} message, service worker makes XMLHttpRequest GET to JDownloader localhost"
  - "Tab lifecycle: 2-second auto-close delay after successful solve/skip to allow JDownloader to process"
  - "Skip-on-close: chrome.tabs.onRemoved triggers single skip to prevent hung CAPTCHAs"

requirements-completed: [CAP-03, CAP-04, CAP-07, CAP-08, CAP-09]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 4 Plan 2: Service Worker CAPTCHA Handlers Summary

**Service worker CAPTCHA message relay with XMLHttpRequest to JDownloader callback API, tab auto-close, and Rc2Service native routing removal**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T17:59:53Z
- **Completed:** 2026-03-07T18:03:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added 3 CAPTCHA message handlers to background.js service worker (captcha-tab-detected, captcha-solved, captcha-skip)
- Implemented HTTP relay from content script to JDownloader via XMLHttpRequest GET with X-Myjd-Appkey header
- Tab lifecycle: 2-second auto-close after solve/skip, skip(single) on tab close (CAP-07)
- Modified Rc2Service to stop closing CAPTCHA tabs (CAP-09) and stop routing to CaptchaNativeService (CAP-08)
- Full test suite passes: 132 tests across 9 suites with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CAPTCHA message handlers and tab tracking to background.js** - `8444d6d` (feat)
2. **Task 2: Modify Rc2Service to remove native routing and tab closing, update tests** - `6199f63` (feat)

## Files Created/Modified
- `background.js` - Added activeCaptchaTabs map, captcha-tab-detected/captcha-solved/captcha-skip handlers, updated onRemoved listener for skip-on-close
- `scripts/services/Rc2Service.js` - handleRequest logs instead of closing tab, onNewCaptchaAvailable removed CaptchaNativeService routing, removed CaptchaNativeService from DI, removed captchaInProgress guard
- `scripts/services/__tests__/background-captcha.test.js` - 16 structural tests for service worker CAPTCHA handlers
- `scripts/services/__tests__/Rc2Service.test.js` - Replaced BUG-02 tests with 8 new CAP-08/CAP-09 structural tests, kept 5 BUG-01 URL pattern tests

## Decisions Made
- Used `encodeURIComponent` on CAPTCHA token before URL concatenation to prevent injection
- Chose `skiptype=single` for tab close (user closing tab = skipping one CAPTCHA, not entire hoster)
- Delete activeCaptchaTabs entry before HTTP request to prevent race with simultaneous captcha-skip message
- Kept CaptchaNativeService.js file on disk (not deleted) per CONTEXT.md deferred decisions
- Removed captchaInProgress dedup guard entirely since it was only needed for native helper double-sends

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Web Tab CAPTCHA) is now complete: content script + service worker handlers + Rc2Service modifications
- Phase 5 (CAPTCHA E2E Testing) can proceed to validate the full CAPTCHA flow end-to-end
- The content script sends messages to the service worker, which relays to JDownloader via HTTP GET

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 04-web-tab-captcha*
*Completed: 2026-03-07*
