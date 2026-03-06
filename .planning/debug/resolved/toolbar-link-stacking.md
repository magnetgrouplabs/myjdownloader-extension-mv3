---
status: resolved
trigger: "Multi-link stacking in toolbar is broken; duplicate link prevention not working"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T22:00:00Z
---

## Current Focus

hypothesis: Two separate root causes -- (1) race condition between iframe creation and link-info-update message, (2) duplicate check compares object references not values
test: Code trace analysis complete
expecting: N/A
next_action: Return diagnosis

## Symptoms

expected: Right-clicking multiple links should stack them all in the toolbar. Same link twice should appear only once.
actual: Multi-link stacking is inconsistent (sometimes works with delay, then reverts). Duplicates appear.
errors: None reported
reproduction: Right-click link A -> "Download with JDownloader" -> right-click link B -> only link B shown (not both). Right-click same link twice -> appears twice.
started: Unknown

## Eliminated

(none -- direct code trace yielded root causes)

## Evidence

- timestamp: 2026-03-06T00:01:00Z
  checked: background.js notifyContentScript() flow
  found: Two race conditions in message delivery -- see Resolution
  implication: Primary cause of stacking failure

- timestamp: 2026-03-06T00:02:00Z
  checked: background.js addLinkToRequestQueue() duplicate check
  found: Compares item.content === newLink.content, where content is a URL string; this should work for links
  implication: Duplicate check logic is correct for string URLs -- investigate further

- timestamp: 2026-03-06T00:03:00Z
  checked: toolbarContentscript.js iframe lifecycle
  found: createIFrame() creates a NEW iframe with fresh src URL each time if iframe was removed; but if iframe exists, it reuses it. However, createIFrame uses getElementById and creates new if not found.
  implication: Iframe is created once per toolbar init, reused thereafter

- timestamp: 2026-03-06T00:04:00Z
  checked: ToolbarController.js updateLinks()
  found: updateLinks() sends "link-info" message to background, gets full queue, then REPLACES $scope.state.requestQueue entirely (line 353)
  implication: updateLinks() correctly fetches full queue and replaces -- this is correct behavior

- timestamp: 2026-03-06T00:05:00Z
  checked: ToolbarController.js chrome.runtime.onMessage listener (line 414)
  found: Listens for "link-info-update" via chrome.runtime.onMessage -- but the toolbar is in an IFRAME loaded from chrome-extension:// URL
  implication: CRITICAL -- chrome.tabs.sendMessage delivers to content scripts, NOT to extension pages/iframes

- timestamp: 2026-03-06T00:06:00Z
  checked: notifyContentScript() message flow
  found: "open-in-page-toolbar" goes to content script (correct, content script listens). "link-info-update" goes to content script via chrome.tabs.sendMessage -- but toolbarContentscript.js does NOT listen for this message. Only ToolbarController.js listens for it via chrome.runtime.onMessage.
  implication: The link-info-update message is sent to the WRONG target

- timestamp: 2026-03-06T00:07:00Z
  checked: chrome.tabs.sendMessage documentation
  found: chrome.tabs.sendMessage sends to content scripts in that tab. Extension pages embedded as iframes (chrome-extension:// URLs) receive messages via chrome.runtime.onMessage IF they are same extension -- but only chrome.runtime.sendMessage sends to all extension contexts. chrome.tabs.sendMessage ONLY reaches content scripts.
  implication: Confirms link-info-update never reaches ToolbarController

- timestamp: 2026-03-06T00:08:00Z
  checked: How toolbar ever gets initial data
  found: ToolbarController.init() -> storageService.getSettings() callback -> updateLinks() (line 199). This is called once on iframe creation. The iframe src includes tabId as query param.
  implication: Toolbar gets data ONCE on load. If link-info-update never arrives, toolbar only ever shows what was in queue at iframe creation time.

- timestamp: 2026-03-06T00:09:00Z
  checked: Why it sometimes works with delay
  found: First right-click: iframe doesn't exist, gets created with src URL. createIFrame triggers page load -> Angular boots -> updateLinks() fetches queue (which has 1 link). Second right-click: link-info-update sent via chrome.tabs.sendMessage but never reaches toolbar iframe. HOWEVER if user waits long enough and the iframe happens to be receiving the message through some other mechanism... Actually no. The "worked once with substantial delay" is likely because the first right-click created the iframe and it loaded the queue during init. Subsequent right-clicks send link-info-update which never arrives.
  implication: Stacking fails because updates never reach the toolbar after initial load

- timestamp: 2026-03-06T00:10:00Z
  checked: Whether content script forwards link-info-update
  found: toolbarContentscript.js message listener (line 88-107) handles: "open-in-page-toolbar", "close-in-page-toolbar", "remove-dialog", "autograbber-started-in-tab", "autograbber-stopped-in-tab", "autograbber-update-in-tab". It does NOT handle "link-info-update" -- message is silently dropped.
  implication: Confirmed -- link-info-update is not forwarded to the iframe and cannot be received by the toolbar Angular app

- timestamp: 2026-03-06T00:11:00Z
  checked: Duplicate check in addLinkToRequestQueue
  found: The check on line 70 compares item.content === newLink.content where both are strings (URLs). This IS correct for string comparison. BUT there is a subtle issue: the check only runs if the queue already exists. The queue IS initialized on line 57 if missing. The loop correctly iterates existing items. String === comparison works for URLs.
  implication: Duplicate check appears correct. Re-examining user report...

- timestamp: 2026-03-06T00:12:00Z
  checked: Whether queue persists across toolbar close/reopen
  found: closeDialog() in ToolbarController (line 256-296) sends "close-in-page-toolbar" AND "remove-all-requests". The background handler for "close-in-page-toolbar" (line 424-433) already does `delete requestQueue[String(tabId)]`. Then "remove-all-requests" handler (line 413-421) ALSO deletes the queue. So the queue is properly cleaned up on close.
  implication: Queue cleanup is correct but the duplicate issue may be related to the toolbar showing stale data

- timestamp: 2026-03-06T00:13:00Z
  checked: Whether duplicate appears because toolbar iframe is destroyed and recreated
  found: When user closes toolbar (or it auto-closes after send), hideToolbar() is called which does removeIFrame() and `delete window.myJDAddLinksToolbarInjected`. Next right-click: toolbarContentscript.js may or may not be re-injected. If re-injected, guard `window.myJDAddLinksToolbarInjected !== true` is cleared, script re-runs. If not re-injected, existing script handles "open-in-page-toolbar". In both cases, a new iframe may be created. The iframe loads fresh, calls updateLinks() once.
  implication: Each toolbar session starts fresh. Duplicates would only appear if the BACKGROUND queue has duplicates.

- timestamp: 2026-03-06T00:14:00Z
  checked: Could duplicates appear if link-info-update somehow DOES arrive?
  found: If link-info-update reaches ToolbarController, updateLinks() is called which REPLACES the entire requestQueue with the response from background. So even if called multiple times, it would show the same queue (no duplicates from double-fetching). The question is whether the background queue itself has duplicates.
  implication: If duplicate check is working, background queue should not have dupes. Need to re-examine.

- timestamp: 2026-03-06T00:15:00Z
  checked: Re-examine duplicate check edge case
  found: The comparison is `item.content === newLink.content`. For links, `content` is set to the `link` parameter (line 63), which is `info.linkUrl` from context menu. This is a string URL. String === comparison should work. HOWEVER, there is a timing edge case: if the service worker goes to sleep between right-clicks, `requestQueue` may be empty in memory even though session storage has data. The function does NOT await `queueReady` before checking duplicates. Line 52-81 of addLinkToRequestQueue is synchronous -- it does not `await queueReady`. If the service worker woke up fresh, `requestQueue = {}` (line 27) and `queueReady = restoreRequestQueue()` (line 50) is running async. If addLinkToRequestQueue runs before restoreRequestQueue completes, the queue is empty, duplicate check finds nothing, and the link is added again.
  implication: CRITICAL -- race between queue restore and new link addition causes duplicate entries

## Resolution

root_cause: |
  TWO root causes identified:

  **ROOT CAUSE 1: link-info-update message never reaches toolbar iframe (STACKING FAILURE)**

  In `background.js` `notifyContentScript()` (lines 84-107), both "open-in-page-toolbar" and
  "link-info-update" are sent via `chrome.tabs.sendMessage()`. This API delivers messages ONLY
  to content scripts in the specified tab.

  The toolbar UI is an Angular app running inside an iframe with a `chrome-extension://` URL
  (created by `toolbarContentscript.js`). The ToolbarController listens for "link-info-update"
  via `chrome.runtime.onMessage` (line 414 of ToolbarController.js). But `chrome.tabs.sendMessage`
  does NOT deliver to extension iframes -- it only reaches content scripts.

  Furthermore, `toolbarContentscript.js` (the actual content script) does NOT listen for
  "link-info-update" at all. It only handles: "open-in-page-toolbar", "close-in-page-toolbar",
  "remove-dialog", and autograbber messages. The "link-info-update" message is silently dropped.

  Result: The toolbar only shows links that were in the queue at the moment the iframe was
  first created (via `updateLinks()` called during Angular init). Subsequent links added to
  the queue are never reflected in the toolbar because the update notification never arrives.

  This explains why "it worked once with substantial delay" -- the first link was in the queue
  when the iframe loaded. Adding a second link while the iframe is already open fails because
  the update message never reaches it.

  **ROOT CAUSE 2: Queue restore race condition (DUPLICATE ENTRIES)**

  In `background.js`, `addLinkToRequestQueue()` (lines 52-81) is a synchronous function that
  reads from the in-memory `requestQueue` object. However, when the MV3 service worker wakes
  from sleep, `requestQueue` is initialized to `{}` (line 27), and `restoreRequestQueue()`
  (line 32) runs asynchronously to restore from session storage.

  `addLinkToRequestQueue()` does NOT `await queueReady` before accessing the queue. If a
  context menu click wakes the service worker and triggers `addLinkToRequestQueue()` before
  `restoreRequestQueue()` completes, the duplicate check runs against an empty queue and
  always passes. The link is added, then when restore completes, it overwrites with the old
  queue (which may already contain that link), or the old queue is lost and the new one persisted.

  Actually, the race is even worse: the restore may overwrite the newly-added link, OR the
  persist may overwrite the restored data. Either way, the in-memory and persisted states
  can diverge, leading to duplicates or lost links.

  The "link-info" handler (line 390) correctly `await`s `queueReady`, but `addLinkToRequestQueue`
  does not -- it's called synchronously from the context menu click handler.

fix: (not applied -- read-only investigation)
verification: (not applicable)
files_changed: []
