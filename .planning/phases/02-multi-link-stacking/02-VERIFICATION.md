---
phase: 02-multi-link-stacking
verified: 2026-03-06T23:00:00Z
status: human_needed
score: 5/6 must-haves verified
re_verification: false
human_verification:
  - test: "Toolbar sidebar auto-dismiss after batch send"
    expected: "After clicking 'Add links' and all links send successfully, toolbar sidebar should close automatically"
    why_human: "Known issue documented in 02-02-SUMMARY.md — toolbar stays open after batch send. Automated tests verify the batch API call succeeds (LINK-03 functional) but cannot assert the UI auto-dismiss behavior. This is a UI regression from the batch send refactor where the successClose callback path may not trigger correctly."
---

# Phase 2: Multi-Link Stacking Verification Report

**Phase Goal:** Multi-link stacking — accumulate links from right-click context menu, real-time toolbar updates, batch send to JDownloader, queue persistence, duplicate detection, tab cleanup
**Verified:** 2026-03-06T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All stacked links are sent to JDownloader in a single API call with newline-separated URLs | VERIFIED | `scripts/controllers/AddLinksController.js` line 617: `.join("\r\n")` collects all URLs into `combinedLinks`; single `sendRequest("/linkgrabberv2/addLinks", ...)` call at line 645; 6 structural tests pass |
| 2 | On batch failure, links remain in queue and toolbar stays open for retry | VERIFIED | `.fail` handler at lines 660-668 sets `requestStates.ERROR` only; does not invoke `callback` or `successClose`; structural test confirms no `callback()` in fail block |
| 3 | CNL queries are sent separately from regular link/text queries | VERIFIED | `sendCnlQueries` function exists separately at line 671; structural test confirms it exists and contains `sendRequest`; `sendAddLinkQueries` does not merge CNL queries |
| 4 | Right-clicking multiple links on a page accumulates them in the toolbar sidebar | VERIFIED | `background.js` lines 52-81: `addLinkToRequestQueue` appends to `requestQueue[tabKey]` per-tab array; context menu handler wires all link types to this function |
| 5 | Toolbar UI updates in real-time when new links are added | VERIFIED | `background.js` line 110: `chrome.runtime.sendMessage({ action: "link-info-update", tabId })` fires on every `addLinkToRequestQueue`; `ToolbarController.js` lines 414-426 listens and calls `updateLinks()` on receipt |
| 6 | Queue survives service worker termination and is restored on wake | VERIFIED | `restoreRequestQueue()` at lines 32-42 reads from `chrome.storage.session` on startup; `persistQueue()` at lines 44-48 writes on every mutation; 2 automated tests cover restore path |
| 7 | Duplicate links on the same tab are deduplicated | VERIFIED | `background.js` lines 68-75: loop checks `item.content === newLink.content` before push; automated test "should detect duplicates in restored queue" passes |
| 8 | Link queue for a tab is cleared when the tab is closed | VERIFIED | `background.js` lines 621-624: `chrome.tabs.onRemoved` listener deletes `requestQueue[String(tabId)]` and calls `persistQueue()`; automated test "should persist queue when a tab is closed" passes |

**Score:** 8/8 truths verified by automated checks (all truths from both plans combined)

**Human verification needed:** Toolbar sidebar auto-dismiss after batch send (known UI regression documented in 02-02-SUMMARY.md)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/__tests__/AddLinksController.test.js` | Structural tests for batch send refactor | VERIFIED | 86 lines, 6 tests covering batch pattern, non-recursion, error handling, CNL separation; all 6 pass |
| `scripts/controllers/AddLinksController.js` | Batch send implementation | VERIFIED | `sendAddLinkQueries` at line 606 uses `.join("\r\n")` with single `sendRequest` call; not a stub |
| `background.js` | Queue accumulation, dedup, persistence, tab cleanup | VERIFIED | `addLinkToRequestQueue` (line 52), `persistQueue` (line 44), `restoreRequestQueue` (line 32), `tabs.onRemoved` (line 621) all present and substantive |
| `scripts/controllers/ToolbarController.js` | Real-time update listener | VERIFIED | `link-info-update` listener at line 414 calls `updateLinks()` — substantive, 529 lines total |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AddLinksController.js` | `/linkgrabberv2/addLinks` | `sendAddLinkQueries` batches all link URLs into one `sendRequest` call | WIRED | Line 617: `.join("\r\n")`; line 645: single `sendRequest` call; structural test confirms no recursive self-call |
| `AddLinksController.js` | Error handler | `.fail` handler sets `requestStates.ERROR` without calling `successClose` | WIRED | Lines 660-668: `.fail` sets `$scope.state.sending.state = $scope.requestStates.ERROR`; no `callback()` or `successClose()` call in fail block |
| `background.js` | `chrome.storage.session` | `persistQueue` writes queue on every mutation | WIRED | Line 45: `chrome.storage.session.set({ [QUEUE_STORAGE_KEY]: requestQueue })`; called after push, after remove, after tab close |
| `background.js` | `ToolbarController.js` | `chrome.runtime.sendMessage` with `link-info-update` | WIRED | Line 110: `sendMessage({ action: "link-info-update", tabId })`; ToolbarController line 418 listens for `msg.action === "link-info-update"` |
| `background.js` | `chrome.tabs.onRemoved` | Tab close listener deletes queue for closed tab | WIRED | Lines 621-624: `onRemoved` listener deletes tab entry and calls `persistQueue()` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LINK-01 | 02-02-PLAN.md | Right-clicking multiple links accumulates them in toolbar sidebar | SATISFIED | `addLinkToRequestQueue` appends links per-tab; context menu handler routes all link types through it; 11 background tests pass including queue accumulation |
| LINK-02 | 02-02-PLAN.md | Toolbar UI updates in real-time when new links added to open toolbar | SATISFIED | `chrome.runtime.sendMessage("link-info-update")` fires on every queue mutation; ToolbarController listener confirmed at line 414; automated test "should send link-info-update via chrome.runtime.sendMessage" passes |
| LINK-03 | 02-01-PLAN.md | All stacked links sent to JDownloader in single batch operation | SATISFIED | `sendAddLinkQueries` joins all URLs with `\r\n` into `combinedLinks`; single `sendRequest` call; 6 structural tests pass |
| LINK-04 | 02-02-PLAN.md | Link queue survives service worker termination (30s idle) and restored on wake | SATISFIED | `chrome.storage.session` write-through persistence; `restoreRequestQueue` reads on startup; automated tests "should write queue to session storage" and "should restore queue from session storage on startup" both pass |
| LINK-05 | 02-02-PLAN.md | Duplicate links on the same tab are deduplicated | SATISFIED | Dedup loop in `addLinkToRequestQueue` checks `item.content === newLink.content`; automated test "should detect duplicates in restored queue" passes |
| LINK-06 | 02-02-PLAN.md | Link queue for a tab is cleared when tab is closed | SATISFIED | `chrome.tabs.onRemoved` listener at line 621 deletes tab's queue entry and persists; automated test "should persist queue when a tab is closed" passes |

**No orphaned requirements.** All 6 LINK requirements declared in plan frontmatter are accounted for and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/controllers/AddLinksController.js` | ~698 | `successClose` not called from `sendAddLinkQueries` fail handler | Info | By design — toolbar stays open for retry on error. This is the intended behavior per LINK-03 design decision, not a bug. |

No TODO/FIXME/PLACEHOLDER comments found in modified files. No empty implementations. No stub returns.

---

### Human Verification Required

#### 1. Toolbar Auto-Dismiss After Successful Batch Send

**Test:** Queue 3+ links via right-click context menu, then click "Add links" in the toolbar. Wait for send to complete successfully.

**Expected:** Toolbar sidebar closes automatically after all links are sent to JDownloader (standard `successClose` behavior).

**Why human:** The 02-02-SUMMARY.md documents a known issue: "After successfully sending multiple links via batch send, the toolbar sidebar remains visible instead of auto-dismissing." This is a UI regression — automated tests verify the batch API call reaches JDownloader (LINK-03 functional goal) but cannot assert that the `successClose` callback fires and the sidebar visually disappears. The issue was intentionally deferred and logged as not blocking Phase 2 completion. Needs manual confirmation of severity: if `donecallback -> successClose` is not firing correctly, all sent links may remain visually in the toolbar even though they were sent, which is confusing UX.

**Test path to investigate if it fails:**
- Check that `sendAddLinkQueries` callback at line 871 triggers `requestsState.ADD_LINKS = $scope.requestStates.SUCCESS`
- Confirm `donecallback()` at line 874 gets called when both ADD_LINKS and CNL are not RUNNING
- Confirm `successClose(idsToRemove)` at line 859 is reached

---

### Gaps Summary

No blocking gaps. All 6 LINK requirements have automated test coverage and codebase implementation evidence.

One known issue deferred from execution: toolbar sidebar persistence after batch send (UI regression). This was explicitly accepted as non-blocking in 02-02-SUMMARY.md — "Logged as known issue for future resolution. Does not block any LINK requirement verification." LINK-03's functional goal (batch API call to JDownloader) is verified. The UX polish issue (sidebar auto-dismiss) is flagged for human confirmation.

**All commits verified:**
- `be8c0ff` — test(02-01): add failing structural tests for batch send refactor (86 lines, 1 file)
- `57b8193` — feat(02-01): refactor sendAddLinkQueries for single batch API call (59 insertions, 25 deletions)
- `70af14a` — docs(02-02): complete E2E verification of multi-link stacking

**Test suite results:**
- 53 tests total across 4 suites — all pass
- AddLinksController.test.js: 6/6 pass (LINK-03 structural coverage)
- background.test.js: 11/11 pass (LINK-01, 02, 04, 05, 06 coverage)

---

_Verified: 2026-03-06T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
