---
phase: 03-directory-history
verified: 2026-03-07T17:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open Add Links dialog, type a directory path in Save To, send links, reopen dialog"
    expected: "The previously typed path appears in the Save To dropdown on next use"
    why_human: "Requires live extension with chrome.storage.local interaction in a real browser"
  - test: "Type the same path with different casing (e.g. C:\\Downloads vs c:\\downloads)"
    expected: "Only one entry appears in the dropdown (case-insensitive dedup)"
    why_human: "Requires live AngularJS runtime with actual DOM rendering"
  - test: "Type path with trailing backslash (e.g. C:\\Downloads\\), send links, check dropdown"
    expected: "Entry stored without trailing slash, showing C:\\Downloads"
    why_human: "Requires runtime normalization to be observable through real UI"
  - test: "Add 11 different directory paths across 11 send operations, check dropdown"
    expected: "Dropdown shows exactly 10 entries, oldest dropped, newest first"
    why_human: "Requires live multi-send workflow in browser"
  - test: "Click the clear button (x icon) next to Save To field"
    expected: "Dropdown empties immediately, clear button disappears, storage is cleared for all devices"
    why_human: "Requires live chrome.storage.local read-back to confirm all-device clear"
  - test: "Uncheck 'Remember download directories' in Settings, then open Add Links and send"
    expected: "No new entries added to dropdown, dropdown and clear button both hidden"
    why_human: "Requires live options page toggle + cross-page storage propagation"
  - test: "Close and reopen the browser, open Add Links dialog"
    expected: "Previous directory history is still present in dropdown (survives restart)"
    why_human: "Requires actual browser restart to test chrome.storage.local persistence"
---

# Phase 03: Directory History Verification Report

**Phase Goal:** Users can quickly re-select previously used download directories without retyping
**Verified:** 2026-03-07T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sending links to a directory adds it to the dropdown on next use | VERIFIED | `AddLinksController.js` line 355-357: saveto guarded by `directoryHistoryEnabled`, calls `addToHistory("saveto", ...)` in `saveOptionsAndHistory`; history persisted to `ADD_LINK_CACHED_HISTORY` in `chrome.storage.local` via `storageService.set` |
| 2 | Dropdown shows at most 10 entries, most recently used first | VERIFIED | `AddLinksController.js` lines 321-324: `$scope.history[key].unshift(normalized)` then `if ($scope.history[key].length > 10) { $scope.history[key].length = 10; }` |
| 3 | Duplicate paths (case-insensitive, trailing-slash-normalized) are collapsed to one entry | VERIFIED | `AddLinksController.js` lines 308-319: `value.replace(/[\\/]+$/, '')` normalization then loop with `.toLowerCase()` comparison; existing entry spliced before unshift |
| 4 | Clear button removes saveto history for ALL devices and hides itself | VERIFIED | `AddLinksController.js` lines 278-296: `clearSavetoHistory` iterates `Object.keys($scope.cachedHistory)`, zeroes all device saveto arrays, then calls `storageService.get(ADD_LINK_CACHED_HISTORY)` + `storageService.set`; `templateCache.js` line 532: clear button has `ng-if="directoryHistoryEnabled && history.saveto.length > 0"` — hides when empty |
| 5 | Settings toggle disables history recording, hides dropdown and clear button, preserves existing data | VERIFIED | `AddLinksController.js` line 355: guard `$scope.directoryHistoryEnabled` on `addToHistory` call; `templateCache.js` lines 529, 532: datalist and clear button both gated on `ng-if="directoryHistoryEnabled"`; setting only controls recording and display, not stored data |
| 6 | History survives browser restart (persisted to chrome.storage.local) | VERIFIED | `AddLinksController.js` lines 365-425: `saveOptionsAndHistory` writes to `storageService.set(ADD_LINK_CACHED_HISTORY, ...)` which calls `chrome.storage.local.set`; `restoreOptionsAndHistory` reads it back on init via `storageService.get` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/services/StorageService.js` | SETTINGS_DIRECTORY_HISTORY_ENABLED constant and settingsKeys entry | VERIFIED | Line 25: `this.SETTINGS_DIRECTORY_HISTORY_ENABLED = "DIRECTORY_HISTORY_ENABLED"`. Lines 89-92: `DIRECTORY_HISTORY_ENABLED: { key: StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED, defaultValue: true }` in settingsKeys |
| `scripts/controllers/AddLinksController.js` | Enhanced addToHistory with normalization/cap, clearSavetoHistory function, directoryHistoryEnabled flag | VERIFIED | Lines 269-276: `directoryHistoryEnabled` flag with storage read. Lines 278-296: `clearSavetoHistory`. Lines 302-330: enhanced `addToHistory` with saveto branch |
| `partials/templateCache.js` | Conditional datalist with ng-if, inline clear button | VERIFIED | Lines 529-537: `ng-if="directoryHistoryEnabled"` on datalist; `ng-if="directoryHistoryEnabled && history.saveto.length > 0"` on clear button with `fa-times` icon |
| `options.html` | Directory history toggle checkbox | VERIFIED | Lines 56-59: `<input type="checkbox" id="directory_history_enabled" checked>` with label "Remember download directories" |
| `options.js` | DIRECTORY_HISTORY_ENABLED storage key and change listener | VERIFIED | Line 7: `DIRECTORY_HISTORY_ENABLED: 'DIRECTORY_HISTORY_ENABLED'` (raw string, matching StorageService). Lines 62-64: load logic. Lines 146-148: change listener calling `saveSetting` |
| `styles/main.css` | Clear button styling | VERIFIED | Lines 667-679: `.clear-saveto-btn` rule with cursor, color, margin; `.clear-saveto-btn:hover` with `color: #c9302c` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AddLinksController.js` | `StorageService.js` | `storageService.SETTINGS_DIRECTORY_HISTORY_ENABLED` constant | WIRED | Line 270: `storageService.get(storageService.SETTINGS_DIRECTORY_HISTORY_ENABLED, ...)` — uses constant, not hardcoded string |
| `options.js` | `chrome.storage.local` | `saveSetting` with `'DIRECTORY_HISTORY_ENABLED'` key matching StorageService | WIRED | `STORAGE_KEYS.DIRECTORY_HISTORY_ENABLED = 'DIRECTORY_HISTORY_ENABLED'` matches `StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED` exactly. `saveSetting` calls `chrome.storage.local.set({ [key]: value })` |
| `partials/templateCache.js` | `AddLinksController.js` | `ng-if='directoryHistoryEnabled'` and `ng-click='clearSavetoHistory()'` | WIRED | Line 529: `ng-if="directoryHistoryEnabled"` on datalist. Line 533: `ng-click="clearSavetoHistory()"` on clear button. Both bound to controller scope |
| `AddLinksController.js` | `chrome.storage.local` | `storageService.get/set` for `ADD_LINK_CACHED_HISTORY` clear-all-devices | WIRED | `clearSavetoHistory` lines 287-295: calls `storageService.get(storageService.ADD_LINK_CACHED_HISTORY, ...)` then `storageService.set(storageService.ADD_LINK_CACHED_HISTORY, history)` after zeroing all device saveto arrays |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIR-01 | 03-01-PLAN.md | "Save to" field shows a dropdown of the last 10 used directories | SATISFIED | `templateCache.js` datalist `ng-repeat="entry in history.saveto"`; capped at 10 in `addToHistory`; settings toggle hides dropdown when disabled |
| DIR-02 | 03-01-PLAN.md | Directory history is persisted to `chrome.storage.local` and survives browser restarts | SATISFIED | `saveOptionsAndHistory` persists via `storageService.set(ADD_LINK_CACHED_HISTORY, ...)`; `restoreOptionsAndHistory` reloads on init |
| DIR-03 | 03-01-PLAN.md | Directory entries are deduplicated case-insensitively (Windows paths) | SATISFIED | `addToHistory` saveto branch: `value.replace(/[\\/]+$/, '')` then `.toLowerCase()` comparison loop; duplicate spliced before re-insertion |
| DIR-04 | 03-01-PLAN.md | Clear history button removes all saved directories | SATISFIED | `clearSavetoHistory` zeros all device saveto arrays in `$scope.cachedHistory` AND in `chrome.storage.local`; clear button shows only when `history.saveto.length > 0` |
| DIR-05 | 03-01-PLAN.md | Most recently used directory appears first in the dropdown | SATISFIED | `addToHistory` uses `$scope.history[key].unshift(normalized)` after removing existing entry — MRU ordering guaranteed |

No orphaned requirements — all 5 DIR-01 through DIR-05 IDs appear in the plan and are covered by verified implementation. No Phase 3 requirements in REQUIREMENTS.md beyond DIR-01 through DIR-05.

### Anti-Patterns Found

No anti-patterns detected in any of the 10 modified/created files. No TODO/FIXME/HACK/PLACEHOLDER comments. No empty implementations (return null, return {}, return []). No stub handlers. All functions have substantive implementations.

### Human Verification Required

The following items need human testing in a real browser environment since they involve live AngularJS runtime, chrome.storage.local, and cross-page state propagation:

**1. Basic History Recording**
**Test:** Open Add Links dialog, type a directory path (e.g. `C:\Downloads`) in Save To field, send links, close and reopen Add Links
**Expected:** The previously typed path appears in the Save To dropdown
**Why human:** Requires live chrome.storage.local and AngularJS $scope history binding

**2. Case-Insensitive Deduplication**
**Test:** Send to `C:\Downloads` then `c:\downloads` (different casing)
**Expected:** Only one entry in the dropdown (not two)
**Why human:** Requires live AngularJS runtime with actual DOM rendering of datalist

**3. Trailing Slash Normalization**
**Test:** Send to `C:\Downloads\` (with trailing backslash), check dropdown
**Expected:** Entry stored and shown as `C:\Downloads` (no trailing slash)
**Why human:** Normalization observable only through real UI

**4. 10-Entry Cap**
**Test:** Send links to 11 different directories across 11 operations
**Expected:** Dropdown shows exactly 10 entries, oldest dropped, newest first
**Why human:** Requires multi-send workflow in browser

**5. Clear Button — All Devices**
**Test:** Use two different JDownloader devices to build history, then click the X clear button
**Expected:** Dropdown empties immediately, clear button disappears, and the cleared state persists after reopening
**Why human:** All-device clear requires observing chrome.storage.local state across device selections

**6. Settings Toggle**
**Test:** Uncheck "Remember download directories" in Settings, then send links to a new directory path
**Expected:** Dropdown hidden, clear button hidden, new path NOT added to history
**Why human:** Cross-page chrome.storage.local propagation and AngularJS $scope reaction require live browser

**7. Persistence Across Browser Restart**
**Test:** Build history, close Chrome completely, reopen, open Add Links dialog
**Expected:** Previous directory history still present in dropdown
**Why human:** Actual browser restart needed to test chrome.storage.local persistence

### Gaps Summary

No gaps found. All 6 observable truths are verified. All 6 required artifacts exist, are substantive, and are wired. All 4 key links are connected end-to-end. All 5 DIR requirements are satisfied.

The full test suite (77 tests across 7 suites) passes with no failures. The 4 implementation commits (1e12dda, e6ed5a3, cbc9eb0, e91753f) are confirmed in git history with the expected TDD pattern (RED then GREEN for each task).

---
_Verified: 2026-03-07T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
