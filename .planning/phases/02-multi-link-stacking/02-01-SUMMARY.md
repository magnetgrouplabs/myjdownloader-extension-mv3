---
phase: 02-multi-link-stacking
plan: 01
subsystem: api
tags: [angularjs, jdownloader-api, batch-request, linkgrabber]

# Dependency graph
requires:
  - phase: 01-bug-fixes-queue-persistence
    provides: Queue persistence and request queue infrastructure
provides:
  - Batch send combining multiple link URLs into single /linkgrabberv2/addLinks API call
  - Error-resilient send retaining links in queue on failure
  - Structural tests validating batch send pattern
affects: [02-multi-link-stacking]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-api-call-with-newline-join, structural-source-level-tests]

key-files:
  created:
    - scripts/__tests__/AddLinksController.test.js
  modified:
    - scripts/controllers/AddLinksController.js

key-decisions:
  - "Use \\r\\n join to combine link URLs matching existing CNL separator convention"
  - "First query object used as base for shared options (destinationFolder, comment, etc.)"
  - "First available sourceUrl used for batch context (JDownloader uses first for referrer)"

patterns-established:
  - "Batch API pattern: map+join URLs with \\r\\n separator for /linkgrabberv2/addLinks"
  - "Error resilience: fail handler sets ERROR state without calling callback, retaining queue"

requirements-completed: [LINK-03]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 2 Plan 1: Batch Send Refactor Summary

**Refactored sendAddLinkQueries from recursive one-call-per-link to single batch API call with \r\n-joined URLs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T22:17:10Z
- **Completed:** 2026-03-06T22:19:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced recursive N-call sendAddLinkQueries with single batch API call combining all link URLs via \r\n join
- Error handler retains all links in queue on failure (no successClose or callback invocation)
- 6 new structural tests validating batch pattern, non-recursion, error handling, and CNL separation
- All 53 tests pass (6 new + 47 existing) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create structural test file for batch send (TDD RED)** - `be8c0ff` (test)
2. **Task 2: Refactor sendAddLinkQueries for batch send (TDD GREEN)** - `57b8193` (feat)

_TDD flow: RED (2 tests fail on recursive pattern) then GREEN (all 53 pass after batch refactor)_

## Files Created/Modified
- `scripts/__tests__/AddLinksController.test.js` - 6 structural tests validating batch send pattern via source-level regex
- `scripts/controllers/AddLinksController.js` - sendAddLinkQueries refactored from recursive to batch join

## Decisions Made
- Used `\r\n` as link separator matching existing CNL concatenation convention in the codebase (line 773)
- First query object used as base for shared options (all queries share same options from $scope.selection)
- First available sourceUrl across all queries used for batch context (JDownloader uses first for referrer)
- sendCnlQueries left completely unchanged (CNL queries remain separate per research recommendation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Batch send ready for integration with multi-link stacking UI (Plan 02)
- sendAddLinkQueries now accepts array of queries and batches them in single API call
- Error handling preserves queue for retry, toolbar stays open

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-multi-link-stacking*
*Completed: 2026-03-06*
