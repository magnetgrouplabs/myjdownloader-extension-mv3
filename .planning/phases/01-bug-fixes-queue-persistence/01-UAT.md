---
status: complete
phase: 01-bug-fixes-queue-persistence
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-03-06T22:10:00Z
updated: 2026-03-06T22:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Multi-Link Stacking in Toolbar
expected: On any page with multiple links, right-click a link and select "Download with JDownloader" — the in-page toolbar appears with that link. Right-click a second different link — toolbar updates showing both links. Right-click a third — all three stacked. Send all at once from the toolbar.
result: pass
note: "Toolbar stays open with empty list after sending instead of closing — cosmetic issue, not stacking-related"

### 2. Duplicate Link Prevention
expected: Right-click the same link twice via "Download with JDownloader". The toolbar should only show it once — no duplicate entry appears.
result: pass

### 3. Queue Survives Service Worker Restart
expected: Stack a few links in the toolbar. Go to chrome://extensions, click the service worker link, click "Stop" (or wait ~30s for idle shutdown). Then right-click another link on the same page. The toolbar should show the previously stacked links PLUS the new one — nothing was lost when the service worker restarted.
result: pass

### 4. Tab Close Cleans Up Queue
expected: Stack links in a tab's toolbar, then close that tab. Open a new tab to the same page and right-click a link — the toolbar should start fresh with only the new link, not carry over the old tab's queue.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
