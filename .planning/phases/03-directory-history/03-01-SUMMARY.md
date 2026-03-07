---
phase: 03-directory-history
plan: 01
subsystem: ui
tags: [angularjs, chrome-storage, datalist, settings, history]

# Dependency graph
requires: []
provides:
  - "Persistent MRU directory history dropdown for Save To field"
  - "Case-insensitive, normalized dedup with 10-entry cap"
  - "Clear button to wipe saveto history across all devices"
  - "Settings toggle to enable/disable directory history recording"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural source-level tests for AngularJS controllers and services"
    - "StorageService settingsKeys pattern for new boolean settings"

key-files:
  created:
    - scripts/services/__tests__/StorageService.test.js
    - scripts/__tests__/templateCache.test.js
    - scripts/__tests__/options.test.js
  modified:
    - scripts/services/StorageService.js
    - scripts/controllers/AddLinksController.js
    - scripts/__tests__/AddLinksController.test.js
    - partials/templateCache.js
    - styles/main.css
    - options.html
    - options.js

key-decisions:
  - "DIRECTORY_HISTORY_ENABLED storage key uses raw string (not settings_ prefix) to match StorageService constant exactly"
  - "Clear button wipes saveto history for ALL devices in both scope and chrome.storage.local"
  - "Trailing slash/backslash normalization applied before dedup comparison"

patterns-established:
  - "StorageService constant + settingsKeys entry pattern for new settings"
  - "Structural regex tests for templateCache UI elements"

requirements-completed: [DIR-01, DIR-02, DIR-03, DIR-04, DIR-05]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 03 Plan 01: Directory History Summary

**Persistent MRU dropdown for Save To field with case-insensitive dedup, 10-entry cap, clear-all-devices button, and settings toggle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T17:04:03Z
- **Completed:** 2026-03-07T17:08:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- addToHistory enhanced with saveto-specific branch: trailing slash normalization, case-insensitive dedup via toLowerCase, splice+unshift MRU ordering, 10-entry cap
- clearSavetoHistory clears saveto arrays across all devices in $scope.cachedHistory and persists to chrome.storage.local
- Settings toggle (directoryHistoryEnabled) guards both history recording and datalist/clear button visibility
- Options page checkbox with matching storage key for user control
- Full structural test coverage: 22 new tests across 4 test files, 77 total tests passing

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests for directory history logic** - `1e12dda` (test)
2. **Task 1 GREEN: Implement directory history logic** - `e6ed5a3` (feat)
3. **Task 2 RED: Failing tests for directory history UI** - `cbc9eb0` (test)
4. **Task 2 GREEN: Implement directory history UI** - `e91753f` (feat)

## Files Created/Modified
- `scripts/services/StorageService.js` - Added SETTINGS_DIRECTORY_HISTORY_ENABLED constant and settingsKeys entry
- `scripts/controllers/AddLinksController.js` - Enhanced addToHistory, added clearSavetoHistory, directoryHistoryEnabled flag
- `partials/templateCache.js` - Conditional datalist with ng-if, clear-saveto-btn with fa-times icon
- `styles/main.css` - .clear-saveto-btn styling with hover state
- `options.html` - "Remember download directories" checkbox
- `options.js` - DIRECTORY_HISTORY_ENABLED storage key, load/save logic, change listener
- `scripts/services/__tests__/StorageService.test.js` - New: structural tests for StorageService constant
- `scripts/__tests__/AddLinksController.test.js` - Added 11 directory history structural tests
- `scripts/__tests__/templateCache.test.js` - New: 6 structural tests for UI elements
- `scripts/__tests__/options.test.js` - New: 4 structural tests for options page

## Decisions Made
- Used raw "DIRECTORY_HISTORY_ENABLED" string (not "settings_directory_history_enabled") in options.js to match StorageService constant exactly -- existing keys use inconsistent settings_ prefix pattern
- Clear button wipes ALL devices' saveto history (not just current device) per DIR-04 requirement
- Trailing slash/backslash normalization applied before case-insensitive dedup to handle both Unix and Windows paths

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All DIR requirements (DIR-01 through DIR-05) addressed and verified
- No blockers for subsequent phases
- Feature is self-contained with no cross-phase dependencies

## Self-Check: PASSED

All 10 files verified present. All 4 commits verified in git history.

---
*Phase: 03-directory-history*
*Completed: 2026-03-07*
