---
phase: 01-bug-fixes-queue-persistence
plan: 03
subsystem: ui
tags: [chrome-extension, messaging, service-worker, toolbar, duplicate-detection]

# Dependency graph
requires:
  - phase: 01-bug-fixes-queue-persistence (plan 01)
    provides: Queue persistence via chrome.storage.session and queueReady gate
  - phase: 01-bug-fixes-queue-persistence (plan 02)
    provides: Bug fixes for Rc2Service, CaptchaNativeService, native helper
provides:
  - Fixed notifyContentScript message routing (link-info-update via chrome.runtime.sendMessage)
  - Async addLinkToRequestQueue with queueReady gate for duplicate prevention
  - Simultaneous toolbar message dispatch (no promise chaining)
affects: [02-multi-link-stacking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "chrome.runtime.sendMessage for cross-context messaging (background -> toolbar iframe)"
    - "chrome.tabs.sendMessage for background -> content script messaging"
    - "async addLinkToRequestQueue with await queueReady for race condition prevention"

key-files:
  created: []
  modified:
    - background.js
    - scripts/__tests__/background.test.js

key-decisions:
  - "Use chrome.runtime.sendMessage for link-info-update (reaches all extension contexts including toolbar iframe)"
  - "Keep chrome.tabs.sendMessage for open-in-page-toolbar (only content scripts need this)"
  - "Fire both messages simultaneously on happy path, delayed link-info-update (500ms) on injection path"

patterns-established:
  - "chrome.runtime.sendMessage for messages targeting extension iframes (not content scripts)"
  - "await queueReady in any function that reads requestQueue to prevent race conditions after SW wake"

requirements-completed: [BUG-04]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 01 Plan 03: Gap Closure - Message Routing and Async Duplicate Check Summary

**Fixed notifyContentScript to route link-info-update via chrome.runtime.sendMessage and made addLinkToRequestQueue async with queueReady gate**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T21:17:51Z
- **Completed:** 2026-03-06T21:22:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed link-info-update routing: now sent via `chrome.runtime.sendMessage` which reaches the toolbar iframe's `ToolbarController` listener (was incorrectly using `chrome.tabs.sendMessage` which only reaches content scripts)
- Made `addLinkToRequestQueue` async with `await queueReady` as first line, preventing duplicate check from running against empty in-memory queue after service worker wake
- Both `open-in-page-toolbar` and `link-info-update` now fire simultaneously without promise chaining on the happy path
- Content script injection path uses 500ms delayed `link-info-update` for Angular bootstrap time
- All 47 tests pass across 3 test suites with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests (TDD RED)** - `61729ef` (test)
2. **Task 2: Fix notifyContentScript and async addLinkToRequestQueue (TDD GREEN)** - `05f3607` (fix)

## Files Created/Modified
- `background.js` - Fixed notifyContentScript message routing and made addLinkToRequestQueue async
- `scripts/__tests__/background.test.js` - Added 3 gap closure tests, updated existing test timing for async behavior

## Decisions Made
- Used `chrome.runtime.sendMessage` for `link-info-update` because ToolbarController in the toolbar iframe listens via `chrome.runtime.onMessage`, not `chrome.tabs.sendMessage` which only reaches content scripts
- Kept `chrome.tabs.sendMessage` for `open-in-page-toolbar` because only the content script needs to receive this message to show/create the iframe
- Added 500ms delay for `link-info-update` on the content script injection path because Angular needs time to bootstrap and register the ToolbarController's listener
- Made `addLinkToRequestQueue` async rather than modifying callers, since all callers use fire-and-forget patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing test timing for async addLinkToRequestQueue**
- **Found during:** Task 2
- **Issue:** Existing "persistQueue writes to chrome.storage.session" test failed because `addLinkToRequestQueue` is now async (fire-and-forget from the selection-result handler), so `sendResponse` fires before the async function completes
- **Fix:** Added `await new Promise(resolve => setTimeout(resolve, 50))` after awaiting sendResponse to allow the async addLinkToRequestQueue to complete
- **Files modified:** scripts/__tests__/background.test.js
- **Verification:** Test passes
- **Committed in:** 05f3607 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary timing fix for existing test due to the async change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 01 gap closure complete - all message routing and duplicate detection bugs fixed
- Ready to proceed with Phase 02 (Multi-Link Stacking) or Phase 03 (Directory History)
- UAT re-test recommended to verify toolbar stacking and duplicate prevention in browser

## Self-Check: PASSED

- FOUND: background.js
- FOUND: scripts/__tests__/background.test.js
- FOUND: 01-03-SUMMARY.md
- FOUND: 61729ef (test commit)
- FOUND: 05f3607 (fix commit)
- All 47 tests pass (11 background + 10 Rc2Service + 26 CaptchaNativeService)

---
*Phase: 01-bug-fixes-queue-persistence*
*Completed: 2026-03-06*
