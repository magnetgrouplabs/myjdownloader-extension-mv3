---
status: resolved
phase: 01-bug-fixes-queue-persistence
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-06T21:00:00Z
updated: 2026-03-06T22:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Multi-Link Stacking in Toolbar
expected: On any page with multiple links, right-click a link → "Download with JDownloader" → in-page toolbar appears with that link. Right-click a second link → toolbar updates showing both links. Right-click a third → all three stacked. Send all at once from toolbar.
result: issue
reported: "behavior is inconsistent. it worked the first time I tried it with a substantial delay adding the second link, now its reverted to old behavior"
severity: major

### 2. Duplicate Link Prevention
expected: Right-click the same link twice via "Download with JDownloader". The toolbar should only show it once — no duplicate entry appears.
result: issue
reported: "not working"
severity: major

### 3. Queue Survives Service Worker Restart
expected: Stack a few links in the toolbar. Go to chrome://extensions → click the service worker link → click Stop (or wait ~30s for idle shutdown). Then right-click another link on the same page. The toolbar should show the previously stacked links PLUS the new one — nothing was lost when the service worker restarted.
result: skipped
reason: Blocked by test 1 — stacking itself is broken

### 4. Tab Close Cleans Up Queue
expected: Stack links in a tab's toolbar, then close that tab. Open a new tab to the same page and right-click a link — the toolbar should start fresh with only the new link, not carry over the old tab's queue.
result: skipped
reason: Blocked by test 1 — stacking itself is broken

## Summary

total: 4
passed: 0
issues: 2
pending: 0
skipped: 2

## Gaps

- truth: "Right-click multiple links in succession, each stacks in the toolbar for batch sending to JDownloader"
  status: resolved
  reason: "User reported: behavior is inconsistent. it worked the first time I tried it with a substantial delay adding the second link, now its reverted to old behavior"
  severity: major
  test: 1
  root_cause: "notifyContentScript() chains link-info-update in .then() after open-in-page-toolbar (original fired both simultaneously). On first call, content script injection + iframe creation means Angular hasn't bootstrapped when link-info-update arrives. On subsequent calls, the .then() chaining adds latency. Original BackgroundController.js (lines 749-751) fired both chrome.tabs.sendMessage calls synchronously without chaining."
  artifacts:
    - path: "background.js"
      issue: "notifyContentScript() uses promise chaining instead of firing both messages simultaneously like original BackgroundController.js"
    - path: "scripts/controllers/BackgroundController.js"
      issue: "Lines 749-751 show the original pattern — both messages fired synchronously"
  missing:
    - "Fire both chrome.tabs.sendMessage calls simultaneously like original code"
    - "On content script injection path, increase timeout or re-send link-info-update after iframe load"
  debug_session: ".planning/debug/toolbar-link-stacking.md"
- truth: "Right-clicking the same link twice only shows it once in the toolbar — no duplicate"
  status: resolved
  reason: "User reported: not working"
  severity: major
  test: 2
  root_cause: "addLinkToRequestQueue() does not await queueReady before checking for duplicates. After SW wake, requestQueue is empty ({}) so the duplicate check always passes. The link-info handler correctly awaits queueReady but the add function does not."
  artifacts:
    - path: "background.js"
      issue: "addLinkToRequestQueue (line 52) is synchronous, does not await queueReady before duplicate check"
  missing:
    - "Make addLinkToRequestQueue async and await queueReady before accessing requestQueue"
  debug_session: ".planning/debug/toolbar-link-stacking.md"
