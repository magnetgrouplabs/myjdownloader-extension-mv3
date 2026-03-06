# Phase 2: Multi-Link Stacking - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore the MV2 experience where right-clicking multiple links stacks them in the toolbar for batch sending. The core queue accumulation, dedup, persistence, tab cleanup, and toolbar UI rendering already exist in the codebase. This phase verifies the existing path works E2E, fixes any race conditions or timing bugs found, and implements single-call batch sending to JDownloader.

</domain>

<decisions>
## Implementation Decisions

### Batch send strategy
- Combine all queued link URLs into a single newline-separated string and send one `/linkgrabberv2/addLinks` API call instead of N sequential calls
- On batch failure (network error, JDownloader offline): show error message in toolbar, keep all links in queue so user can retry. Toolbar stays open.

### Claude's Discretion
- **Package name handling**: Whether all links go into one package or are grouped by source page. Decide based on JDownloader API behavior and MV2 conventions.
- **Batch scope for mixed content types**: Whether CNL intercepted links and text selections are included in the same batch call as right-clicked links, or sent separately. Decide based on how the addLinks API handles mixed content.
- **Real-time update UX**: Whether to highlight/flash new entries, scroll behavior, countdown reset when a new link is added while toolbar is open.
- **Edge case handling**: Special link types (magnet, ftp, data URLs), cross-tab behavior, max queue size limits.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `background.js:27-82`: `requestQueue` object already accumulates, deduplicates (content+type check), persists to `chrome.storage.session`, and cleans up on tab close. All LINK-01, LINK-04, LINK-05, LINK-06 requirements are implemented at the queue layer.
- `ToolbarController.js:414`: `chrome.runtime.onMessage` listener catches `link-info-update` and calls `updateLinks()` — real-time update path (LINK-02) already wired.
- `templateCache.js:302-406`: `ng-repeat` over `state.requestQueue` already renders scrollable list with type icons, content preview, parent page info, timestamps, and per-item remove buttons.
- `AddLinksController.js:677`: `send()` iterates `$scope.requests` and builds query objects — needs modification to combine into single API call.
- `AddLinksController.js:609-621`: `sendAddLinkQueries()` sends queries recursively one-at-a-time — this is the function to refactor for batch.

### Established Patterns
- Toolbar communicates with background via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`
- AngularJS two-way `=` binding passes `state.requestQueue` from ToolbarCtrl to AddLinksCtrl via `myAddLinksPanel` directive
- Countdown timer resets on each new link addition (`invalidateInitState` → `startTimeout`)
- `notifyContentScript` sends `open-in-page-toolbar` (creates iframe if needed) + `link-info-update` (refreshes data)

### Integration Points
- `background.js:notifyContentScript()`: Entry point for toolbar notifications after queue mutation
- `myAddLinksPanel.js`: Directive bridging ToolbarCtrl → AddLinksCtrl with `requests: '='` binding
- `myjdDeviceClientFactory` / `MyjdDeviceService.sendRequest()`: The actual HTTP transport to JDownloader API
- `toolbarContentscript.js`: Creates/manages the toolbar iframe overlay (410px wide, fixed top-right)

### Known Risk
- Race condition: When toolbar is already open and second link added, the immediate `chrome.runtime.sendMessage` broadcast (line 110) fires before the toolbar's Angular digest. The 500ms delayed update only fires on fresh injection. Need to verify this path works reliably.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants single-call batch sending with error-resilient UX (keep links on failure).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-multi-link-stacking*
*Context gathered: 2026-03-06*
