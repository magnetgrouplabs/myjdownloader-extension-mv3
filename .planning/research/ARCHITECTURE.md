# Architecture Patterns

**Domain:** Chrome Extension (Manifest V3) — Multi-item state management, service worker persistence, message passing with queued items
**Researched:** 2026-03-06

## Recommended Architecture

### Overview

The extension has five execution contexts that must coordinate: service worker (background.js), offscreen document (offscreen.js), content scripts, toolbar iframe (toolbar.html), and the popup. The critical architectural problem is that the service worker's `requestQueue` lives in volatile memory and is lost on service worker termination (every 30 seconds of inactivity). Multi-link stacking, directory history, and CAPTCHA state management all require rethinking around this constraint.

### Architecture Diagram

```
                           chrome.storage.session (transient queue state)
                           chrome.storage.local (persistent preferences/history)
                                    |
                    +---------------+---------------+
                    |                               |
           [Service Worker]                 [Offscreen Document]
           background.js                    offscreen.js
           - Queue orchestrator             - JDownloader API
           - Message router                 - Session management
           - Context menu handler           - Link submission
           - State hydration on wake        - localStorage bridge
                    |
        +-----------+-----------+
        |           |           |
  [Content         [Toolbar    [Popup
   Scripts]        iframe]      Page]
  - CNL intercept  - Queue UI   - Login/settings
  - Toolbar inject - Add links  - Device management
  - Selection      - Device sel - Clipboard history
  - Web interface  - Countdown
```

### Component Boundaries

| Component | Responsibility | Communicates With | State Ownership |
|-----------|---------------|-------------------|-----------------|
| **Service Worker** (background.js) | Central orchestrator: routes messages, manages request queue, handles context menu clicks, manages offscreen lifecycle | All components via chrome.runtime.sendMessage; offscreen via targeted messages; content scripts via chrome.tabs.sendMessage | Owns requestQueue (must persist to chrome.storage.session); owns connection state, settings cache |
| **Offscreen Document** (offscreen.js) | JDownloader API operations: login, logout, device listing, link submission. Bridges localStorage for jdapi session tokens | Service worker only (via message target filtering) | Owns API instance and session state; persists session to chrome.storage.local |
| **Content Scripts** (5 scripts) | Page-level concerns: CNL interception (cnlInterceptor), toolbar iframe injection (toolbarContentscript), text selection capture (selectionContentscript), clipboard monitoring (onCopyContentscript), web interface integration (webinterfaceEnhancer) | Service worker via chrome.runtime.sendMessage; toolbar iframe via DOM injection | Stateless (state lives in service worker or storage) |
| **Toolbar iframe** (toolbar.html) | Displays queued links, device selector, add-links form with optional parameters, countdown timer. Runs its own AngularJS instance independent from popup | Service worker via chrome.runtime.sendMessage for queue data; creates its own jdapi connection for direct device communication | Owns UI display state; reads queue from service worker; reads/writes history to chrome.storage.local |
| **Popup** (popup.html) | Login/logout, device management, settings, clipboard history | Service worker for connection state; its own jdapi instance for API calls | Owns login UI state; shares settings via chrome.storage.local |
| **Native Helper** (myjd-captcha-helper.exe) | CAPTCHA solving in WebView2 window; receives jobs via native messaging, returns tokens | Extension pages via chrome.runtime.sendNativeMessage (toolbar or popup context) | Owns WebView2 window state; stateless between invocations |

### Data Flow

#### Multi-Link Queuing Flow (Current + Recommended Fix)

**Current flow (broken on service worker termination):**
```
1. User right-clicks link A -> context menu handler in service worker
2. addLinkToRequestQueue() stores in in-memory requestQueue[tabId]
3. notifyContentScript() tells content script to open toolbar iframe
4. User right-clicks link B -> same flow, appends to requestQueue[tabId]
5. Toolbar fetches queue via "link-info" message
6. User clicks "Add links" -> ToolbarController sends to JDownloader

PROBLEM: If service worker sleeps between steps 2 and 5,
         requestQueue is wiped. Toolbar gets empty array.
```

**Recommended architecture -- chrome.storage.session as source of truth:**
```
1. User right-clicks link A -> context menu handler in service worker
2. addLinkToRequestQueue():
   a. Read current queue from chrome.storage.session['requestQueue']
   b. Append new link (with dedup check)
   c. Write back to chrome.storage.session['requestQueue']
   d. Keep in-memory cache for fast access within same wake cycle
3. notifyContentScript() tells content script to open toolbar iframe
4. User right-clicks link B -> same flow, appends to storage
5. Toolbar fetches queue:
   a. "link-info" message to service worker (wakes it, reads from cache/storage)
6. User clicks "Add links" -> submission flow unchanged
7. On service worker wake: hydrate in-memory cache from chrome.storage.session
```

**Why chrome.storage.session (not chrome.storage.local):**
- Request queue is transient: it should not survive browser restart. A stale queue from yesterday confuses users.
- 10MB quota is more than sufficient for link queues (each link is ~500 bytes; 10MB = ~20,000 links).
- Faster than chrome.storage.local because it is in-memory (no disk I/O).
- Automatically cleared on browser close, extension reload, or extension update. This is the correct lifecycle for a pending-action queue.

**Why not IndexedDB:**
- Overkill for JSON queue data. IndexedDB adds complexity for data that chrome.storage handles natively.
- chrome.storage has built-in change listeners (onChanged), which IndexedDB lacks.

**Storage decision matrix:**

| Storage Area | Survives SW Restart | Survives Browser Restart | Limit | Right for Queue? |
|-------------|--------------------|-----------------------|-------|-----------------|
| In-memory variable | NO | NO | N/A | NO -- lost on idle timeout |
| chrome.storage.session | YES | NO | 10 MB | YES -- transient queue data |
| chrome.storage.local | YES | YES | 10 MB | NO -- stale links after restart |
| IndexedDB | YES | YES | Large | NO -- overkill, no change listeners |

#### Directory History Persistence Flow

```
1. User types directory in "Save to" field
2. On successful link send, AddLinksController.saveOptionsAndHistory() fires
3. Appends directory to history[deviceId].saveto array
4. Writes to chrome.storage.local['ADD_LINK_CACHED_HISTORY']
5. On next toolbar open, restoreOptionsAndHistory() reads from storage
6. Directory dropdown populated from history[deviceId].saveto

NEW: Add chrome.storage.local['DIRECTORY_HISTORY'] for a dedicated
     cross-device history limited to last 10 entries with clear button.
```

**Storage key structure for directory history:**
```json
{
  "DIRECTORY_HISTORY": ["/downloads/movies", "/downloads/music", ...]
}
```

This uses chrome.storage.local (not session) because directory history should persist across browser restarts -- it is user preference data, not transient state.

#### CAPTCHA Flow (Current Architecture)

```
1. JDownloader opens http://127.0.0.1:9666/captcha/recaptchav2/?id=...
   OR web interface sends captcha-new event
2. Rc2Service.onNewCaptchaAvailable() receives job
3. CaptchaNativeService.sendCaptcha() sends via chrome.runtime.sendNativeMessage
4. Native helper opens WebView2, user solves CAPTCHA
5. Token returned to CaptchaNativeService callback
6. CaptchaNativeService.submitTokenToJDownloader() sends token via HTTP or postMessage
7. On failure: falls back to web interface postMessage (potential double-send bug)
```

**Architecture concern:** The CAPTCHA service runs in the toolbar/popup AngularJS context, which creates its own jdapi instance. CAPTCHA solving requires an AngularJS page context to be active because `chrome.runtime.sendNativeMessage` is NOT available from a service worker context. The Rc2Service tab listener detects CAPTCHA URLs and routes them to the native helper, but this listener only runs when an AngularJS page has loaded Rc2Service (via toolbar.js or popup.js).

The webinterfaceEnhancer content script on my.jdownloader.org can also trigger CAPTCHA jobs independently.

#### CNL (Click'N'Load) Flow

```
1. cnlInterceptor.js intercepts fetch() to localhost:9666
2. Sends "cnl-captured" to service worker
3. Service worker queues in cnlRequestQueue, writes to chrome.storage.local['cnl_queue']
4. If add-links dialog active: sets cnl_pending flag for popup
5. If dialog inactive: processes via offscreen document directly
```

This flow already persists to storage, which is correct.

#### Content Script Notification Flow

When a new link is added to the queue, the content script (toolbar) must be notified:

```
User right-clicks link
    |
    v
Context menu handler (background.js)
    |
    v
addLinkToRequestQueue() -- writes to chrome.storage.session
    |
    v
notifyContentScript(tabId)
    |
    v
chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar" })
    |
    v
Content script (toolbarContentscript.js) creates/shows toolbar iframe
    |
    v
chrome.tabs.sendMessage(tabId, { action: "link-info-update" })
    |
    v
ToolbarController.updateLinks() fetches queue from background
    |
    v
Toolbar UI re-renders link list via ng-repeat
```

## Patterns to Follow

### Pattern 1: Storage-Backed State with In-Memory Cache

**What:** Use chrome.storage.session as source of truth for transient state, with an in-memory cache for performance within a single service worker lifecycle.

**When:** Any state that must survive service worker termination but not browser restart (requestQueue, pending CNL items).

**Example:**

```javascript
// background.js -- Storage-backed request queue

const QUEUE_KEY = 'link_request_queue';

// In-memory cache (fast reads within same wake cycle)
let requestQueueCache = null;

// Hydrate cache on service worker start
async function hydrateRequestQueue() {
  const result = await chrome.storage.session.get(QUEUE_KEY);
  requestQueueCache = result[QUEUE_KEY] || {};
}

// Always called at top level (synchronous registration of intent to hydrate)
hydrateRequestQueue();

async function addLinkToRequestQueue(link, tab) {
  // Ensure cache is hydrated
  if (requestQueueCache === null) {
    await hydrateRequestQueue();
  }

  const tabId = tab.id;
  if (!requestQueueCache[tabId]) {
    requestQueueCache[tabId] = [];
  }

  const newLink = {
    id: `${tabId}${Date.now()}${Math.floor(Math.random() * 10000)}`,
    time: Date.now(),
    parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
    content: link,
    type: "link"
  };

  // Dedup check
  const isDupe = requestQueueCache[tabId].some(
    item => item.type === newLink.type && item.content === newLink.content
  );

  if (!isDupe) {
    requestQueueCache[tabId].push(newLink);
    // Persist to storage (fire-and-forget for speed; debounce in production)
    chrome.storage.session.set({ [QUEUE_KEY]: requestQueueCache });
    notifyContentScript(tabId);
  }
}

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (requestQueueCache && requestQueueCache[tabId]) {
    delete requestQueueCache[tabId];
    chrome.storage.session.set({ [QUEUE_KEY]: requestQueueCache });
  }
});
```

**Confidence:** HIGH -- directly recommended by Chrome's official MV3 migration guide and service worker lifecycle documentation.

### Pattern 2: Synchronous Top-Level Event Registration

**What:** All event listeners must be registered synchronously at the top level of the service worker script. Listeners registered inside async callbacks or conditionals may not fire when the service worker is woken by that event.

**When:** Always. This is a hard MV3 requirement.

**Example:**

```javascript
// CORRECT: Top-level registration
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.storage.onChanged.addListener(handleStorageChange);

// State hydration can be async, but listeners are registered first
async function handleContextMenuClick(info, tab) {
  if (requestQueueCache === null) {
    await hydrateRequestQueue();
  }
  // ... handle click
}

// WRONG: Registering inside async init
// async function init() {
//   await loadSettings();
//   chrome.contextMenus.onClicked.addListener(handler); // MAY NOT FIRE
// }
```

**Current status:** The existing background.js already follows this pattern for most listeners. Context menu listener, message listener, storage change listener, and tab removal listener are all top-level.

**Confidence:** HIGH -- Chrome official documentation explicitly states this requirement.

### Pattern 3: Targeted Message Routing with Type Discrimination

**What:** Use a `target` field in messages to prevent contexts from stealing each other's messages. The current codebase already does this for offscreen (`request.target === 'offscreen'`), but should formalize it for all contexts.

**When:** Any cross-context message passing.

**Current status:** Partially implemented. offscreen.js correctly filters on `request.target === 'offscreen'`. background.js correctly ignores offscreen-targeted messages. The toolbar and popup use `request.name` and `request.action` via ExtensionMessagingService for routing. This works but is less explicit.

**Recommendation:** Do not refactor ExtensionMessagingService routing in this milestone. The current system works. Any new message types added should use the target field convention.

**Confidence:** HIGH -- partially implemented already, official Chrome docs recommend this pattern.

### Pattern 4: Offscreen Document Lazy Creation with Readiness Check

**What:** Create offscreen document on-demand, verify it is ready before sending API operations.

**When:** Any operation that requires the offscreen document (API calls, session operations).

**Current implementation:** background.js `sendToOffscreen` calls `createOffscreenDocument` first, which checks for existing document via `chrome.runtime.getContexts`. The offscreen document has an `isReady` flag and an `offscreen-ping` handler that returns readiness status. These are already wired correctly.

**Recommendation:** The current approach works adequately. If jdapi loading is slow on some systems, add a retry loop using the existing `offscreen-ping` action.

**Confidence:** MEDIUM -- current approach works but could be tighter.

### Pattern 5: History Bounded Queue with LRU Eviction

**What:** For directory history and other user-input histories, maintain a bounded array with most-recent-first ordering and deduplication.

**When:** Directory history dropdown, package name history, any form field history.

**Example:**

```javascript
// StorageService.js additions
this.DIRECTORY_HISTORY = "DIRECTORY_HISTORY";
this.DIRECTORY_HISTORY_MAX = 10;

this.addDirectoryToHistory = function(dir, callback) {
  if (!dir || !dir.trim()) {
    if (callback) callback();
    return;
  }
  dir = dir.trim();
  StorageService.get(StorageService.DIRECTORY_HISTORY, function(result) {
    let history = result[StorageService.DIRECTORY_HISTORY] || [];
    // Deduplicate (case-insensitive on Windows)
    history = history.filter(d => d.toLowerCase() !== dir.toLowerCase());
    // Prepend most recent
    history.unshift(dir);
    // Cap at max
    if (history.length > StorageService.DIRECTORY_HISTORY_MAX) {
      history = history.slice(0, StorageService.DIRECTORY_HISTORY_MAX);
    }
    chrome.storage.local.set(
      { [StorageService.DIRECTORY_HISTORY]: history },
      callback
    );
  });
};

this.getDirectoryHistory = function(callback) {
  StorageService.get(StorageService.DIRECTORY_HISTORY, function(result) {
    callback(result[StorageService.DIRECTORY_HISTORY] || []);
  });
};

this.clearDirectoryHistory = function(callback) {
  chrome.storage.local.remove(StorageService.DIRECTORY_HISTORY, callback);
};
```

**UI integration:** Use HTML5 `<datalist>` for native autocomplete behavior. It provides type-ahead filtering and keyboard navigation without additional JavaScript or AngularJS directives.

```html
<input type="text" ng-model="selection.saveto" list="dir-history"
       placeholder="Download directory">
<datalist id="dir-history">
    <option ng-repeat="dir in directoryHistory" value="{{dir}}">
</datalist>
<a ng-click="clearDirectoryHistory()" ng-show="directoryHistory.length > 0">
    Clear history
</a>
```

**Why datalist over custom dropdown:** Native HTML5 `<datalist>` provides browser-native autocomplete behavior (type-ahead filtering, keyboard navigation) without additional JavaScript. Works within AngularJS templates. No additional dependency needed.

**Confidence:** HIGH -- standard HTML5 pattern, well-supported in Chrome.

## Anti-Patterns to Avoid

### Anti-Pattern 1: In-Memory State Without Storage Backing

**What:** Storing critical state only in JavaScript variables in the service worker.

**Why bad:** Service workers terminate after 30 seconds of inactivity. All global variables are lost. The current `requestQueue` in background.js is the primary example.

**Current violations:**
- `requestQueue` (background.js line 27) -- CRITICAL, must fix
- `cnlRequestQueue` (background.js line 546) -- partially backed by chrome.storage.local['cnl_queue'] but in-memory copy drifts
- `state` (background.js line 16) -- connection state, re-hydrated from storage onChange listener
- `settings` (background.js line 22) -- re-read from storage on install/startup events

**Instead:** Back all mutable state with chrome.storage.session (for transient data) or chrome.storage.local (for persistent data). Keep in-memory cache as optimization, not as source of truth.

### Anti-Pattern 2: setTimeout/setInterval in Service Workers

**What:** Using JavaScript timers for delayed or periodic operations.

**Why bad:** Timers are canceled when the service worker terminates.

**Current violation:** `setTimeout` in notifyContentScript (background.js line 73) -- 100ms delay after content script injection. Fragile if service worker goes idle during that window.

**Instead:** Use chrome.alarms for periodic tasks. For short retries, use a message-based acknowledgment pattern where the content script sends back a "ready" message after initialization.

### Anti-Pattern 3: Dual API Instances Without Coordination

**What:** Both toolbar and offscreen document create independent jdapi API instances, each with their own session state.

**Why bad:** Session state can diverge. Token refresh in one context is not reflected in the other.

**Current occurrence:** toolbar.js creates its own API instance via RequireJS. offscreen.js creates another. popup.js creates a third.

**Recommendation for this milestone:** Do not refactor the dual-instance architecture. The toolbar creating its own jdapi instance is how the MV2 extension worked, and it functions correctly for device listing and link submission. The offscreen instance handles cases where the popup/toolbar is closed. Flag as tech debt, not a bug to fix now.

### Anti-Pattern 4: Read-All-Then-Write-Back Storage Pattern

**What:** The current `StorageService.set()` calls `getAll()` then re-saves the entire storage blob.

**Why bad:** Race condition when multiple set operations happen concurrently. Two calls to `set()` can interleave, with the second write overwriting the first's change.

**Current violation:** StorageService.js lines 90-99.

```javascript
// Current (has race condition):
this.set = function(key, value, callback) {
    StorageService.getAll(function(data) {
        let newData = data || {};
        newData[key] = value;
        chrome.storage.local.set(newData, callback);  // Overwrites everything
    });
};

// Better (uses Chrome's built-in merge):
this.set = function(key, value, callback) {
    chrome.storage.local.set({ [key]: value }, callback);
};
```

**Note:** chrome.storage.local.set() is already an atomic merge operation -- it only updates the keys you specify. The read-all-then-write pattern is unnecessary.

**Recommendation:** Do NOT refactor StorageService.set() in this milestone unless it causes a concrete bug. The race window is small. Flag as tech debt.

### Anti-Pattern 5: Unbounded Storage Writes

**What:** Writing to chrome.storage on every small state change without batching.

**Why bad:** chrome.storage has rate limits (MAX_WRITE_OPERATIONS_PER_MINUTE = 120 for local, MAX_WRITE_OPERATIONS_PER_HOUR = 1800). Rapid link additions could hit these limits.

**Instead:** Batch writes with a short debounce (200-500ms):

```javascript
let flushTimeout = null;
function scheduleQueueFlush() {
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    chrome.storage.session.set({ [QUEUE_KEY]: requestQueueCache });
    flushTimeout = null;
  }, 300);
}
```

## Testing Architecture

### Unit Test Layer (Jest + jest-chrome)

```
scripts/services/__tests__/
  CaptchaNativeService.test.js    -- EXISTS: Mock chrome.runtime.sendNativeMessage
                                     Test message format, response handling
                                     Test submitTokenToJDownloader paths

  Rc2Service.test.js              -- NEW: Mock chrome.tabs, ExtensionMessagingService
                                     Test URL pattern matching for CAPTCHA detection
                                     Test CAPTCHA job construction
                                     Test fallback behavior on native helper failure
                                     Test duplicate URL pattern bug is fixed

  background.test.js              -- NEW: Mock chrome.* APIs (jest-chrome)
                                     Test requestQueue operations (add, dedup, remove)
                                     Test message routing (each action handler)
                                     Test storage-backed state hydration
                                     Test tab cleanup on removal
```

**Tool:** jest-chrome provides a complete mock of the Chrome API for Jest.

### Integration Test Layer (Native Helper)

```
captcha-helper/tests/
  integration_test.rs            -- EXISTS (60 tests)
                                    Tests Rust native messaging protocol
                                    Uses mock HTTP server for callbacks
                                    Tests validation, HTML generation, escaping
```

### E2E Test Layer (Playwright)

```
e2e/
  fixtures.js                    -- Load extension in Chrome
  login.test.js                  -- Popup login flow
  add-link.test.js               -- Context menu -> toolbar -> send
  multi-link.test.js             -- Multiple links stacking in toolbar
  service-worker-restart.test.js -- Queue persistence across SW termination
  captcha-mock.test.js           -- Mock native host, verify message flow
```

**Playwright fixture pattern:**

```javascript
const { test: base, chromium } = require('@playwright/test');
const path = require('path');

exports.test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${path.resolve(__dirname, '..')}`,
        `--load-extension=${path.resolve(__dirname, '..')}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw.url().split('/')[2]);
  },
});
```

**Native messaging E2E limitation:** The actual native helper requires WebView2 and a display -- cannot run in CI. Create a mock native messaging host (Node.js script using stdin/stdout with 4-byte length prefix) registered under the same host name in test Chrome profiles.

### CAPTCHA Test Page Architecture (WordPress, Manual)

For real-world CAPTCHA testing on the user's WordPress site:
- Page with reCAPTCHA v2 form guarding a download link
- Page with reCAPTCHA v3 (invisible) score check
- Page with hCaptcha widget

These are manual test pages, not automated CI. CAPTCHA tests require human solving.

## Component Communication Matrix

| From \ To | Service Worker | Offscreen | Content Scripts | Toolbar | Popup | Native Helper |
|-----------|---------------|-----------|-----------------|---------|-------|---------------|
| **Service Worker** | -- | sendMessage (targeted) | tabs.sendMessage | tabs.sendMessage (into iframe's tab) | sendMessage (broadcast) | N/A |
| **Offscreen** | sendMessage | -- | N/A | N/A | N/A | N/A |
| **Content Scripts** | sendMessage | N/A | N/A | DOM injection (iframe) | N/A | N/A |
| **Toolbar** | sendMessage | N/A (routes via SW) | N/A | -- | N/A | sendNativeMessage |
| **Popup** | sendMessage | N/A (routes via SW) | N/A | N/A | -- | sendNativeMessage |
| **Native Helper** | N/A | N/A | N/A | Response via callback | Response via callback | -- |

**Key constraint:** `chrome.runtime.sendNativeMessage` is NOT available in the service worker context. CAPTCHA handling requires an AngularJS page context (popup or toolbar) to be active.

## Scalability Considerations

| Concern | At 10 links/tab | At 100 links/tab | At 1000 links/tab |
|---------|-----------------|-------------------|---------------------|
| requestQueue size | ~5KB (trivial) | ~50KB (fine) | ~500KB (need pruning; 10MB limit shared) |
| Storage write rate | 1-2 writes/link | Needs batching | Must batch with 500ms debounce |
| Toolbar rendering | Instant | May lag with ng-repeat | Must paginate |
| SW hydration time | ~10ms | ~50ms | ~200ms+ |

## Suggested Build Order

Based on dependency analysis, the recommended implementation order:

### Phase 1: Storage-backed request queue (foundation)
**Must come first** -- every subsequent feature depends on reliable state persistence.
- Migrate requestQueue from in-memory to chrome.storage.session
- Add hydration on service worker wake
- Add debounced write
- Verify toolbar reads queue correctly after SW restart

**Dependencies:** None
**Unblocks:** Multi-link stacking, all queue-dependent features

### Phase 2: Multi-link stacking in toolbar
**Builds on** Phase 1.
- Verify multiple addLinkToRequestQueue calls accumulate correctly
- Ensure toolbar UI updates on new links (link-info-update message)
- Test rapid right-click sequences
- Verify dedup across SW restarts

**Dependencies:** Phase 1

### Phase 3: Directory history dropdown
**Independent of** Phase 2.
- Add DIRECTORY_HISTORY to StorageService
- Implement bounded LRU history helpers
- Add datalist UI in add-links template
- Wire clear history button

**Dependencies:** None

### Phase 4: Bug fixes (CAPTCHA and Rc2Service)
**Can run in parallel with** Phase 3.
- Fix duplicate URL in Rc2Service tab query
- Fix double CAPTCHA job send
- Fix native helper unwrap panics

**Dependencies:** None

### Phase 5: CAPTCHA test infrastructure
**Builds on** Phase 4.
- WordPress test pages
- Mock native messaging host
- Rc2Service unit tests
- E2E framework (Playwright)

**Dependencies:** Phase 4

### Phase 6: MV3 compliance audit
**Must come last** -- validates all previous changes.
- Permission review
- CSP compliance check
- Service worker lifecycle edge cases

**Dependencies:** All prior phases

## Sources

- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- Official: 30s idle termination, 5min event limit, state recovery patterns (HIGH confidence)
- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) -- Official: session is 10MB in-memory, local is 10MB on disk, both support setAccessLevel (HIGH confidence)
- [Chrome Offscreen API Reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen) -- Official: single instance limit, LOCAL_STORAGE reason, no auto-close except AUDIO_PLAYBACK (HIGH confidence)
- [Migrate to Service Workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) -- Official: replace globals with storage, top-level listener registration (HIGH confidence)
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) -- Official: 4-byte length prefix, sendNativeMessage is one-shot, not available in SW (HIGH confidence)
- [Chrome E2E Testing Guide](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) -- Official Puppeteer-based extension testing (HIGH confidence)
- [jest-chrome](https://github.com/extend-chrome/jest-chrome) -- Complete Chrome API mock for Jest (HIGH confidence)
- [eyeo SW Suspension Testing](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension) -- Chrome DevRel blog on testing SW suspension (HIGH confidence)
- [Managing Concurrency in Chrome Extensions](https://www.taboola.com/engineering/managing-concurrency-in-chrome-extensions/) -- Lock mechanisms, queue management (MEDIUM confidence)
- [Fixing Auth in Chrome MV3](https://www.tweeks.io/blog/auth-mv3-architecture) -- chrome.storage race conditions, cross-context coordination (MEDIUM confidence)
- [Storage Type Comparison](https://dev.to/notearthian/local-vs-sync-vs-session-which-chrome-extension-storage-should-you-use-5ec8) -- Community comparison (LOW confidence, consistent with official docs)

---

*Architecture research: 2026-03-06*
