# Phase 2: Multi-Link Stacking - Research

**Researched:** 2026-03-06
**Domain:** Chrome Extension MV3 message passing, AngularJS directive data binding, JDownloader linkgrabberv2 API
**Confidence:** HIGH

## Summary

Phase 2 verifies and completes the multi-link stacking flow end-to-end. The heavy lifting -- queue accumulation, deduplication, persistence, tab cleanup, and real-time toolbar update routing -- was already implemented or fixed in Phase 1. The core remaining work is (a) E2E verification that all six LINK requirements work together, (b) refactoring the `AddLinksController.send()` function to combine multiple links into a single `/linkgrabberv2/addLinks` API call instead of the current one-call-per-link recursive approach, and (c) implementing error resilience so failed batch sends retain links in the queue for retry.

The codebase is in good shape for this phase. Phase 1 fixed the two critical bugs that were breaking link stacking (message routing via `chrome.runtime.sendMessage` and async duplicate check via `await queueReady`). The toolbar template already renders a scrollable `ng-repeat` list with per-item remove buttons. The `myAddLinksPanel` directive passes `state.requestQueue` via two-way `=` binding to `AddLinksCtrl`. The only code changes needed are in `AddLinksController.js` (batch send refactor) and potentially minor UX polish.

**Primary recommendation:** Verify existing E2E flow first (right-click stacking, real-time update, dedup, tab cleanup, queue persistence). Then refactor `sendAddLinkQueries()` in AddLinksController.js to combine all link URLs into a single newline-separated `links` string in one API call. Keep CNL queries separate since they have different payload structures.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Combine all queued link URLs into a single newline-separated string and send one `/linkgrabberv2/addLinks` API call instead of N sequential calls
- On batch failure (network error, JDownloader offline): show error message in toolbar, keep all links in queue so user can retry. Toolbar stays open.

### Claude's Discretion
- **Package name handling**: Whether all links go into one package or are grouped by source page. Decide based on JDownloader API behavior and MV2 conventions.
- **Batch scope for mixed content types**: Whether CNL intercepted links and text selections are included in the same batch call as right-clicked links, or sent separately. Decide based on how the addLinks API handles mixed content.
- **Real-time update UX**: Whether to highlight/flash new entries, scroll behavior, countdown reset when a new link is added while toolbar is open.
- **Edge case handling**: Special link types (magnet, ftp, data URLs), cross-tab behavior, max queue size limits.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LINK-01 | Right-clicking multiple links on the same page accumulates them in the toolbar sidebar | `addLinkToRequestQueue()` in background.js already accumulates links per-tab in `requestQueue[tabKey]`. `notifyContentScript()` opens toolbar and sends `link-info-update` via `chrome.runtime.sendMessage`. Phase 1 fixed the message routing to reach the toolbar iframe. |
| LINK-02 | Toolbar UI updates in real-time when new links are added to an already-open toolbar | ToolbarController.js line 414 listens for `link-info-update` via `chrome.runtime.onMessage` and calls `updateLinks()` which fetches full queue from background and replaces `$scope.state.requestQueue`. Phase 1 fixed this by switching from `chrome.tabs.sendMessage` to `chrome.runtime.sendMessage`. |
| LINK-03 | All stacked links can be sent to JDownloader in a single batch operation | Requires refactoring `sendAddLinkQueries()` in AddLinksController.js. Currently sends one API call per link (recursive). Must combine all link URLs into single newline-separated string. JDownloader's addLinks API accepts newline-delimited URLs in the `links` field. |
| LINK-04 | Link queue survives service worker termination (30s idle) and is restored on wake | Implemented in Phase 1: `persistQueue()` writes to `chrome.storage.session` on every mutation. `restoreRequestQueue()` reads on startup. `queueReady` promise gates all queue access. |
| LINK-05 | Duplicate links on the same tab are deduplicated | Implemented in Phase 1: `addLinkToRequestQueue()` checks `item.type === newLink.type && item.content === newLink.content` for all existing items in the tab's queue. Made async with `await queueReady` to prevent race condition after SW wake. |
| LINK-06 | Link queue for a tab is cleared when the tab is closed | Implemented: `chrome.tabs.onRemoved` listener (background.js line 621) calls `delete requestQueue[String(tabId)]` and `persistQueue()`. |
</phase_requirements>

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | MV3 | `chrome.storage.session`, `chrome.runtime.sendMessage`, `chrome.tabs.onRemoved` | Platform APIs for queue persistence and message routing |
| AngularJS | 1.8.3 | Toolbar UI framework, two-way binding, `ng-repeat` rendering | Already in use throughout extension |
| jQuery | (vendored) | DOM utilities, `$.each`, `$.isArray` | Already in use in controllers |
| jdapi | (vendored) | JDownloader API client (`/linkgrabberv2/addLinks`) | Already in use for all API communication |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jest | 27.5.1 | JavaScript unit tests | Batch send logic validation |
| jest-chrome | 0.8.0 | Chrome API mocks | Queue and message testing |

**No new dependencies needed.** All changes use existing libraries and APIs.

## Architecture Patterns

### Current Data Flow (E2E)
```
User right-clicks link
       |
       v
chrome.contextMenus.onClicked (background.js)
       |
       v
addLinkToRequestQueue(link, tab) [async, awaits queueReady]
  - String(tab.id) as key
  - Dedup check (type + content)
  - Push to requestQueue[tabKey]
  - persistQueue() -> chrome.storage.session
       |
       v
notifyContentScript(tabId)
  - chrome.tabs.sendMessage -> "open-in-page-toolbar" [content script]
  - chrome.runtime.sendMessage -> "link-info-update" [extension contexts]
       |
       v
toolbarContentscript.js
  - Creates/shows iframe with toolbar.html?id=tabId
       |
       v
ToolbarController.js (in iframe)
  - chrome.runtime.onMessage listener catches "link-info-update"
  - Calls updateLinks() -> sends "link-info" to background
  - Background returns requestQueue[tabKey]
  - $scope.state.requestQueue = response.data
       |
       v
templateCache.js toolbar template
  - ng-repeat="historyItem in state.requestQueue | orderBy: '-time'"
  - Renders scrollable list with type icons, content, metadata, remove buttons
       |
       v
myAddLinksPanel directive
  - Two-way binding: requests="state.requestQueue"
  - AddLinksCtrl receives as $scope.requests
       |
       v
AddLinksCtrl.send()
  - Iterates $scope.requests, builds addLinksQueries[]
  - Calls sendAddLinkQueries() [CURRENTLY: one API call per query, recursive]
  - On success: emits ADD_LINKS_DIALOG_CLOSE
  - ToolbarCtrl.closeDialog() -> removes iframe + clears queue
```

### Batch Send Refactor Pattern

**What:** Combine multiple link-type queue items into a single `/linkgrabberv2/addLinks` call.

**Current (broken pattern -- one call per link):**
```javascript
// AddLinksController.js sendAddLinkQueries() - lines 606-635
// Sends queries recursively, one at a time
function sendAddLinkQueries(addLinksQueries, callback) {
  if (addLinksQueries.length > 0) {
    deviceClient.sendRequest("/linkgrabberv2/addLinks",
      JSON.stringify(addLinksQueries[0]));
    // .done -> splice(0,1) -> recurse
  }
}
```

**Target (batch pattern):**
```javascript
// Combine all link URLs into a single newline-separated string
// Send ONE API call with combined links field
function sendAddLinkQueries(addLinksQueries, callback) {
  if (addLinksQueries.length === 0) {
    if (callback) callback();
    return;
  }

  // Merge all link queries into a single query object
  var combinedLinks = addLinksQueries
    .map(function(q) { return q.links; })
    .join("\r\n");

  // Use first query as base (carries user-set options like saveto, password, etc.)
  var batchQuery = angular.copy(addLinksQueries[0]);
  batchQuery.links = combinedLinks;

  var deviceClient = myjdDeviceClientFactory.get($scope.selection.device);
  var result = deviceClient.sendRequest(
    "/linkgrabberv2/addLinks",
    JSON.stringify(batchQuery)
  );
  // ... done/fail handlers
}
```

**Why `\r\n`:** The existing codebase uses `"\r\n"` for link concatenation in the CNL path (AddLinksController.js line 773: `query.links = query.links + "\r\n" + request.content.urls`). JDownloader's link parser splits on whitespace and newlines, so both `\n` and `\r\n` work. Use `\r\n` for consistency with the existing codebase.

### CNL Queries: Keep Separate

CNL (Click'N'Load) intercepted links have a fundamentally different payload structure from regular links. They carry encrypted data, source URLs, form data, and passwords in a special hex-encoded format. CNL queries should NOT be merged into the link batch -- they need their own API call with their specialized `links` field containing the `dummycnl.jdownloader.org` URL.

**Recommendation:** Keep the existing two-track approach (addLinksQueries vs cnlQueries) but batch all regular link/text queries into a single call, and batch all CNL queries into a single call. This is already how the `send()` function structures its flow.

### Package Name Handling (Claude's Discretion)

**Recommendation:** All links go into one package. The JDownloader addLinks API's `packageName` field applies to the entire batch. Users already set a package name (or leave it blank for JDownloader's auto-packagizer) via the toolbar form. This matches MV2 behavior where all queued links are sent with the same user-specified options.

**Rationale:** The user explicitly chose a package name, destination folder, and other options that apply uniformly. Splitting into per-source-page packages would contradict the user's explicit form settings.

### Error Handling Pattern (Locked Decision)

On batch failure:
1. Set `$scope.state.sending.state = requestStates.ERROR`
2. Set `$scope.state.errorMessage` with user-visible error text
3. Do NOT call `successClose()` -- toolbar stays open
4. Do NOT clear the queue -- links remain for retry
5. User can click "Send" again to retry, or modify options

This is already partially implemented. The current `.fail()` handler in `sendAddLinkQueries()` sets the error state. The change is ensuring it does NOT proceed to close/clear on failure (which it currently doesn't -- the `donecallback()` is only called on success).

### Anti-Patterns to Avoid

- **Sending one API call per link:** The current recursive `sendAddLinkQueries()` pattern creates N API calls for N links. Each call goes through the full JDownloader API roundtrip (authentication, encryption, HTTP). Combining into one call is dramatically faster and reduces API quota consumption.
- **Clearing queue before confirming send success:** Never delete queue items until the API call succeeds. The user decision explicitly requires keeping links on failure.
- **Using `chrome.tabs.sendMessage` for toolbar updates:** This was the Phase 1 bug. Always use `chrome.runtime.sendMessage` for `link-info-update` since the toolbar is in a `chrome-extension://` iframe, not a content script.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue persistence | Custom IndexedDB/localStorage | `chrome.storage.session` | Already implemented in Phase 1; handles SW lifecycle correctly |
| Duplicate detection | Hash-based dedup | Simple `type + content` string comparison | Already works; URL strings are reliable equality keys |
| Real-time UI updates | WebSocket or polling | `chrome.runtime.sendMessage` + `onMessage` listener | Already wired; immediate push-based updates |
| Link batching | Custom batching library | `Array.map().join("\r\n")` | Trivial string concatenation; JDownloader handles the parsing |

## Common Pitfalls

### Pitfall 1: Countdown Auto-Send Before Links Are Visible
**What goes wrong:** Toolbar opens with countdown active. If countdown reaches 0 before `updateLinks()` completes, `send()` fires with an empty `$scope.requests`.
**Why it happens:** `invalidateInitState()` starts the countdown when `initState.isReady()` is true (session + links + devices all loaded). But `updateLinks()` is async -- it sends a message to background and waits for response.
**How to avoid:** The current code already gates countdown on `$scope.initState.links = true`, which is set after `updateLinks()` response arrives (ToolbarController line 354). Verify this timing is correct during E2E testing.
**Warning signs:** Links sent successfully but nothing appears in JDownloader (empty links string was sent).

### Pitfall 2: Angular Digest Cycle Timing
**What goes wrong:** When `link-info-update` arrives via `chrome.runtime.onMessage`, the `updateLinks()` callback updates `$scope.state.requestQueue` inside a `$timeout()`. If multiple rapid updates arrive, Angular may batch them or drop intermediate states.
**Why it happens:** Chrome messaging is asynchronous; Angular's digest cycle is separate from Chrome's event loop.
**How to avoid:** The existing code wraps `$scope.state.requestQueue = response.data` in `$timeout(function() {...}, 0)` which triggers a digest. This is correct. The full queue replacement (not incremental update) means intermediate states don't matter -- the toolbar always shows the latest full queue.
**Warning signs:** Toolbar shows stale count, requires manual interaction to refresh.

### Pitfall 3: Multiple Rapid Right-Clicks Race
**What goes wrong:** User right-clicks link A, immediately right-clicks link B. Two `addLinkToRequestQueue()` calls fire concurrently. Both `await queueReady`, then both read `requestQueue[tabKey]`. If they interleave between read and write, one link's push might be lost.
**Why it happens:** JavaScript is single-threaded BUT `await queueReady` yields. After both resume, they access the same in-memory object. Since `requestQueue` is an object reference (not immutable), the `push()` calls are sequential within the JS event loop after `queueReady` resolves. Both pushes land.
**How to avoid:** This is NOT actually a problem in practice. After `queueReady` resolves, the JS event loop processes one microtask at a time. Each `addLinkToRequestQueue` call runs its synchronous code block (dedup check + push) completely before yielding. The in-memory array handles concurrent pushes correctly because they're serialized by the event loop.
**Warning signs:** Would manifest as a link disappearing from queue after being briefly visible.

### Pitfall 4: Error Message Not Visible After Failed Send
**What goes wrong:** Error state is set but toolbar UI doesn't show the error because the error template uses `ng-if` conditions that may not match.
**Why it happens:** The `myaddlinkspanel.html` template shows errors when `state.sending.state === requestStates.ERROR` but other conditions may hide the panel.
**How to avoid:** Verify that on error, the addlinkspanel is still visible (not hidden by countdown or success state). The existing code already has this flow: when `send()` is called, `sending.state` is set to `RUNNING`, then on `.fail()`, it's set to `ERROR`. The template condition `ng-if="state.sending.state !== requestStates.SUCCESS"` correctly shows the error panel.
**Warning signs:** User sees no feedback after a failed send.

## Code Examples

### Batch Send Refactor (Primary Change)

```javascript
// Source: Analysis of AddLinksController.js lines 606-635 and 677-847
// BEFORE: One API call per link (recursive)
function sendAddLinkQueries(addLinksQueries, callback) {
  if (addLinksQueries.length > 0) {
    var deviceClient = myjdDeviceClientFactory.get($scope.selection.device);
    var result = deviceClient.sendRequest(
      "/linkgrabberv2/addLinks",
      JSON.stringify(addLinksQueries[0])
    );
    result.done(function () {
      addLinksQueries.splice(0, 1);
      sendAddLinkQueries(addLinksQueries, callback); // recursive
    }).fail(function (e) { /* error handling */ });
  } else if (callback) { callback(); }
}

// AFTER: Single API call with combined links
function sendAddLinkQueries(addLinksQueries, callback) {
  if (addLinksQueries.length === 0) {
    if (callback) callback();
    return;
  }

  // Combine all link URLs into one newline-separated string
  var combinedLinks = addLinksQueries
    .map(function(q) { return q.links; })
    .join("\r\n");

  // Use first query as base for shared options (saveto, password, etc.)
  var batchQuery = {};
  var base = addLinksQueries[0];
  // Copy all option fields from the first query
  if (base.comment !== undefined) batchQuery.comment = base.comment;
  if (base.destinationFolder !== undefined) batchQuery.destinationFolder = base.destinationFolder;
  if (base.extractPassword !== undefined) batchQuery.extractPassword = base.extractPassword;
  if (base.downloadPassword !== undefined) batchQuery.downloadPassword = base.downloadPassword;
  if (base.deepDecrypt !== undefined) batchQuery.deepDecrypt = base.deepDecrypt;
  if (base.autoExtract !== undefined) batchQuery.autoExtract = base.autoExtract;
  if (base.autostart !== undefined) batchQuery.autostart = base.autostart;
  if (base.priority !== undefined) batchQuery.priority = base.priority;
  if (base.packageName !== undefined) batchQuery.packageName = base.packageName;
  if (base.overwritePackagizerRules !== undefined) batchQuery.overwritePackagizerRules = base.overwritePackagizerRules;

  batchQuery.links = combinedLinks;

  // Collect all source URLs for context
  var sourceUrls = addLinksQueries
    .filter(function(q) { return q.sourceUrl; })
    .map(function(q) { return q.sourceUrl; });
  if (sourceUrls.length > 0) {
    batchQuery.sourceUrl = sourceUrls[0]; // JDownloader uses first sourceUrl
  }

  var deviceClient = myjdDeviceClientFactory.get($scope.selection.device);
  var result = deviceClient.sendRequest(
    "/linkgrabberv2/addLinks",
    JSON.stringify(batchQuery)
  );

  if (!result || typeof result.done !== 'function') {
    $timeout(function () {
      $scope.state.sending.state = $scope.requestStates.ERROR;
      $scope.state.errorMessage = "API not connected. Please log in again.";
    }, 0);
    return;
  }

  result.done(function () {
    if (callback) callback();
  }).fail(function (e) {
    $timeout(function () {
      $scope.state.sending.state = $scope.requestStates.ERROR;
      if (e !== undefined) {
        $scope.state.errorMessage = JSON.stringify(e);
        $scope.state.sending.log = JSON.stringify(e);
      }
    }, 0);
  });
}
```

### How Options Apply to Batch

All user-set options (destination folder, package name, passwords, priority, etc.) are set once in the toolbar form and apply to the entire batch. This is correct behavior because:

1. The user fills out the form ONCE for all queued links
2. The `send()` function builds the query object from `$scope.selection.*` (form fields)
3. Each iteration of `$.each($scope.requests, ...)` builds a query with identical options but different `links` content
4. In the batch approach, we use those identical options once and combine the `links` field

### Message Flow for Real-Time Updates

```javascript
// Source: background.js lines 84-111
// When a new link is added to queue while toolbar is already open:

// 1. Background adds link to queue
requestQueue[tabKey].push(newLink);
persistQueue();

// 2. Background notifies all contexts
notifyContentScript(tabId);

// 3. notifyContentScript sends to content script AND extension contexts
chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar", tabId: tabId }); // noop if already open
chrome.runtime.sendMessage({ action: "link-info-update", tabId: tabId }); // reaches toolbar iframe

// 4. ToolbarController receives and fetches updated queue
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.action === "link-info-update" && msg.tabId == instanceId) {
    updateLinks(); // fetches full queue from background, replaces $scope.state.requestQueue
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chrome.tabs.sendMessage` for link-info-update | `chrome.runtime.sendMessage` | Phase 1 (gap closure) | Toolbar iframe now receives real-time updates |
| Synchronous `addLinkToRequestQueue` | `async` with `await queueReady` | Phase 1 (gap closure) | Dedup check works after SW wake |
| In-memory only `requestQueue` | Write-through to `chrome.storage.session` | Phase 1 (BUG-04) | Queue survives SW termination |
| One API call per link (current) | Single batch call (this phase) | Phase 2 (LINK-03) | Faster, fewer API roundtrips |

## Open Questions

1. **Mixed content type batching (CNL + links)**
   - What we know: CNL queries have completely different payload structures (hex-encoded encrypted data, dummycnl URLs). Regular links and text selections both use plain URL strings in the `links` field.
   - What's unclear: Whether text selections should be included in the same batch as link URLs. Text selections may contain HTML or non-URL content.
   - Recommendation: Include text-type and link-type queries in the same batch (both resolve to `query.links = content`). Keep CNL queries separate as they already are. The JDownloader link parser handles mixed content in a single `links` field -- it extracts URLs from arbitrary text.

2. **Real-time update UX polish**
   - What we know: When a new link arrives while toolbar is open, `updateLinks()` replaces the entire `$scope.state.requestQueue` array. Angular's `ng-repeat` re-renders the list. The `orderBy: '-time'` ensures newest items appear first.
   - What's unclear: Whether new items need visual highlighting or scroll-to-top behavior.
   - Recommendation: No extra UX polish needed. The list re-renders with newest-first ordering, so new items naturally appear at the top. The countdown timer already resets via `invalidateInitState()` -> `startTimeout()` when `initState.links` is set. This is sufficient UX.

3. **Max queue size**
   - What we know: `chrome.storage.session` has a 10MB quota. Each queue entry is ~200-300 bytes. That allows ~33,000+ links per tab before hitting limits.
   - Recommendation: No explicit limit needed. The practical limit is far beyond reasonable use.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 + jest-chrome 0.8.0 |
| Config file | `jest.config.js` |
| Quick run command | `npx jest scripts/__tests__/background.test.js --verbose` |
| Full suite command | `npx jest --verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINK-01 | Right-clicking multiple links accumulates in queue | unit | `npx jest scripts/__tests__/background.test.js -t "persistQueue writes" -x` | Existing (partial) |
| LINK-02 | Toolbar updates in real-time | unit | `npx jest scripts/__tests__/background.test.js -t "message routing" -x` | Existing (Phase 1) |
| LINK-03 | Batch send as single API call | unit | `npx jest scripts/__tests__/background.test.js -t "batch send" -x` | Wave 0 |
| LINK-04 | Queue survives SW termination | unit | `npx jest scripts/__tests__/background.test.js -t "restoreRequestQueue" -x` | Existing |
| LINK-05 | Duplicate links deduplicated | unit | `npx jest scripts/__tests__/background.test.js -t "Duplicate link" -x` | Existing |
| LINK-06 | Tab close clears queue | unit | `npx jest scripts/__tests__/background.test.js -t "tabs.onRemoved" -x` | Existing |

### Sampling Rate
- **Per task commit:** `npx jest --verbose`
- **Per wave merge:** `npx jest --verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/__tests__/AddLinksController.test.js` -- covers LINK-03 batch send logic (combining links into single API call, error handling on failure keeping links in queue)

Note: LINK-01, LINK-02, LINK-04, LINK-05, LINK-06 are already covered by existing tests in `scripts/__tests__/background.test.js` from Phase 1. The only new test needed is for the batch send refactor in AddLinksController.

However, since AddLinksController is deeply coupled to AngularJS DI (requires `myjdDeviceClientFactory`, `MyjdService`, `StorageService`, `$scope`, etc.), full unit testing requires AngularJS mock setup with `angular-mocks`. The project already uses a structural testing approach for AngularJS services (read file + regex validation from Phase 1). The same pattern may be appropriate here:

**Alternative:** Structural test that reads `AddLinksController.js` source and verifies:
1. `sendAddLinkQueries` contains `.join("\r\n")` or similar link concatenation
2. `sendAddLinkQueries` makes a single `sendRequest` call (no recursive pattern)
3. Error handler does NOT call `successClose` or `donecallback`

This avoids the complexity of wiring up the full AngularJS DI container in Jest.

## Sources

### Primary (HIGH confidence)
- `background.js` -- Direct code analysis of queue management, message routing, persistence
- `scripts/controllers/AddLinksController.js` -- Direct code analysis of send flow
- `scripts/controllers/ToolbarController.js` -- Direct code analysis of update listener
- `contentscripts/toolbarContentscript.js` -- Direct code analysis of iframe management
- `.planning/debug/resolved/toolbar-link-stacking.md` -- Root cause analysis from Phase 1
- `.planning/phases/01-bug-fixes-queue-persistence/01-03-PLAN.md` -- Phase 1 gap closure fixes

### Secondary (MEDIUM confidence)
- [JDownloader source - LinkCollectorAPIV2.java](https://github.com/mirror/jdownloader/blob/master/src/org/jdownloader/api/linkcollector/v2/LinkCollectorAPIV2.java) -- API interface definition
- [Python JDownloader API wrapper](https://github.com/mmarquezs/My.Jdownloader-API-Python-Library/blob/master/myjdapi/myjdapi.py) -- `add_links` parameter structure
- Existing codebase CNL path (AddLinksController.js line 773) -- Uses `"\r\n"` for link concatenation, confirming the separator format

### Tertiary (LOW confidence)
- [npm jdownloader-api](https://www.npmjs.com/package/jdownloader-api) -- Community wrapper, different separator conventions noted

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all existing libraries
- Architecture: HIGH -- Direct code trace of complete data flow; Phase 1 fixes verified in source
- Pitfalls: HIGH -- Root cause analysis from Phase 1 debug session covers critical timing issues
- Batch send format: MEDIUM -- `\r\n` separator confirmed by existing CNL code pattern and Python wrapper, but not verified against official JDownloader documentation (which is sparse)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- Chrome Extension APIs and AngularJS are not changing)
