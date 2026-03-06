# Phase 1: Bug Fixes & Queue Persistence - Research

**Researched:** 2026-03-06
**Domain:** Chrome Extension MV3 service worker state management, Rust error handling, Chrome tabs API
**Confidence:** HIGH

## Summary

Phase 1 addresses four well-defined bugs in the MyJDownloader MV3 extension. All four are scoped to specific files with clear fix strategies. BUG-01 is a trivial duplicate URL pattern removal. BUG-02 requires adding a deduplication guard to the CAPTCHA routing path. BUG-03 requires replacing four `.unwrap()` calls in Rust production code with proper error handling. BUG-04 is the most substantial change -- migrating the in-memory `requestQueue` in `background.js` to `chrome.storage.session` so links survive service worker termination.

The codebase already has established patterns for error handling (structured `{"status":"error"}` JSON in the native helper), validation (`CaptchaNativeService.js` has `isValidCallbackUrl()`), and storage (uses `chrome.storage.local` for settings/session). The existing test suites (14+ Rust integration tests, 30+ Rust unit tests, Jest tests for JS) provide a safety net for regressions.

**Primary recommendation:** Fix each bug independently in its own task, with BUG-04 (queue persistence) being the most complex and requiring the most testing. Use write-through caching for the queue -- write to `chrome.storage.session` on every mutation, read from it on service worker startup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- user deferred all implementation decisions to Claude.

### Claude's Discretion
- **Queue persistence timing**: Write-through vs batched writes to chrome.storage.session. Choose based on simplicity and reliability.
- **CAPTCHA dedup behavior**: How to guard against double CAPTCHA job sends (BUG-02). Silent ignore vs user-visible indication -- Claude decides.
- **Error verbosity**: Level of detail in native helper error responses replacing unwrap() panics (BUG-03). Balance diagnostic usefulness with simplicity.
- **BUG-01 fix**: Straightforward removal of duplicate URL pattern in Rc2Service tab query.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Duplicate URL pattern in Rc2Service tab query is removed (only one `*://127.0.0.1*` match) | Two locations identified in Rc2Service.js (lines 91-96, 194-199) with duplicate `"http://my.jdownloader.org/*"` entries. Straightforward array dedup. |
| BUG-02 | Double CAPTCHA job send prevented -- `captchaInProgress` guard ensures only one solving context per CAPTCHA ID | `onNewCaptchaAvailable()` in Rc2Service.js (line 231) has no dedup guard. Add a `Map` keyed by captchaId/callbackUrl to track in-progress jobs. |
| BUG-03 | Native helper `.unwrap()` panics replaced with error handling that returns structured `{"status":"error"}` responses | Four production `.unwrap()` calls identified: main.rs:9, main.rs:20, webview.rs:107, webview.rs:129. All are `serde_json::to_vec()` on a known-good struct -- very unlikely to fail but must not panic since `panic = "abort"` in release profile. |
| BUG-04 | Service worker `requestQueue` persists to `chrome.storage.session` and survives termination/restart cycles | `chrome.storage.session` confirmed: 10MB quota, survives SW restarts within browser session, cleared on browser restart/extension reload. Write-through pattern is the correct approach. |
</phase_requirements>

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | MV3 | `chrome.storage.session`, `chrome.tabs.query`, `chrome.runtime` | Platform APIs, no alternatives |
| serde / serde_json | 1.0 | Rust JSON serialization/deserialization | Standard Rust JSON handling |
| ureq | 2.9 | HTTP client for JDownloader callbacks | Already in use |
| crossbeam | 0.8 | Channels for webview communication | Already in use |
| wry | 0.40 | WebView2 integration | Already in use |
| tao | 0.26 | Window management | Already in use |
| AngularJS | 1.8.3 | Extension UI framework | Already in use, no migration this phase |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jest | 27.5.1 | JavaScript unit tests | JS-side bug fix validation |
| jest-chrome | 0.8.0 | Chrome API mocks for Jest | Mocking `chrome.storage.session` |
| mockito | 1.4 | Rust HTTP mocking | Rust integration tests |
| cargo test | (built-in) | Rust test runner | All Rust changes |

**No new dependencies needed.** All fixes use existing libraries and APIs.

## Architecture Patterns

### BUG-01: Duplicate URL Pattern Removal

**What:** Two `chrome.tabs.query()` calls in `Rc2Service.js` contain a duplicate `"http://my.jdownloader.org/*"` entry in the URL array.

**Locations (exact lines):**

1. `sendRc2SolutionToJd()` at lines 91-96:
```javascript
chrome.tabs.query({
  url: [
    "http://my.jdownloader.org/*",
    "https://my.jdownloader.org/*",
    "http://my.jdownloader.org/*"  // <-- DUPLICATE, remove this
  ]
}, function (tabs) { ... });
```

2. `tabmode-init` listener at lines 194-199:
```javascript
chrome.tabs.query({
  url: [
    "http://my.jdownloader.org/*",
    "https://my.jdownloader.org/*",
    "http://my.jdownloader.org/*"  // <-- DUPLICATE, remove this
  ]
}, function (tabs) { ... });
```

**Fix:** Remove the third duplicate entry from each URL array. The correct pattern should include both `http://` and `https://` variants only (two entries, not three).

**Note:** The CONTEXT.md mentions `*://127.0.0.1*` as the pattern -- but the actual code has duplicate `http://my.jdownloader.org/*`. The requirement description says "only one `*://127.0.0.1*` match" but the actual duplicate is the jdownloader.org URL. The fix is the same: remove the duplicate entry.

### BUG-02: CAPTCHA Deduplication Guard

**What:** `onNewCaptchaAvailable()` in `Rc2Service.js` can be called multiple times for the same CAPTCHA challenge, sending duplicate jobs to the native helper.

**Pattern: In-progress tracking Map**

```javascript
// Add at service level (inside the Rc2Service factory function)
let captchaInProgress = {};

function onNewCaptchaAvailable(tabId, callbackUrl, params) {
    // Dedup key: use captchaId if available, fall back to callbackUrl
    var dedupKey = params.captchaId || callbackUrl;

    if (captchaInProgress[dedupKey]) {
        console.log('Rc2Service: CAPTCHA already in progress for', dedupKey);
        return; // Silent ignore -- no user indication needed
    }

    captchaInProgress[dedupKey] = true;

    // ... existing CaptchaNativeService.sendCaptcha() call ...

    CaptchaNativeService.sendCaptcha(captchaJob).then(function(response) {
        delete captchaInProgress[dedupKey];
        // ... rest of success handling ...
    }).catch(function(error) {
        delete captchaInProgress[dedupKey];
        // ... rest of error handling ...
    });
}
```

**Recommendation: Silent ignore.** The user does not need to see "duplicate CAPTCHA" -- they just need the CAPTCHA window to appear once. A `console.log` is sufficient for debugging.

### BUG-03: Replace `.unwrap()` with Error Handling

**What:** Four `.unwrap()` calls on `serde_json::to_vec(&response)` in production code can panic. With `panic = "abort"` in the release profile, this instantly kills the native helper process with no error message to the extension.

**Production `.unwrap()` sites:**

| File | Line | Expression | Risk Level |
|------|------|-----------|------------|
| `main.rs` | 9 | `serde_json::to_vec(&response).unwrap()` | LOW (Response struct is well-defined) |
| `main.rs` | 20 | `serde_json::to_vec(&response).unwrap()` | LOW (error response is simple) |
| `webview.rs` | 107 | `serde_json::to_vec(&response).unwrap()` | LOW (solved/skipped response) |
| `webview.rs` | 129 | `serde_json::to_vec(&response).unwrap()` | LOW (skipped response on close) |

**While the risk is low** (serializing a simple struct with only String/Option fields will essentially never fail), the principle is correct: production code should not panic. The fix pattern:

```rust
// Before (panics on failure):
let response_json = serde_json::to_vec(&response).unwrap();

// After (graceful error handling):
let response_json = match serde_json::to_vec(&response) {
    Ok(json) => json,
    Err(e) => {
        // Fallback: manually construct minimal error JSON
        let fallback = format!(r#"{{"status":"error","error":"Serialization failed: {}"}}"#, e);
        fallback.into_bytes()
    }
};
```

**Recommendation:** Extract a helper function to avoid repeating this pattern at four call sites:

```rust
fn serialize_response(response: &Response) -> Vec<u8> {
    serde_json::to_vec(response).unwrap_or_else(|e| {
        format!(r#"{{"status":"error","error":"Serialization failed: {}"}}"#, e).into_bytes()
    })
}
```

This can live in `captcha.rs` alongside the `Response` struct since both `main.rs` and `webview.rs` already import from it.

### BUG-04: Queue Persistence via chrome.storage.session

**What:** The `requestQueue` object in `background.js` (line 27) is an in-memory global variable. When the service worker terminates after 30 seconds of inactivity, the queue is lost. Users who right-click a link, wait >30s, then right-click another link will lose the first link.

**chrome.storage.session facts:**
- **Quota:** 10 MB (since Chrome 112)
- **Persistence:** Survives service worker restarts within a browser session
- **Cleared when:** Browser restarts, extension reload/update, extension disable
- **Access:** Async API (`get`/`set`/`remove` return Promises)
- **Performance:** In-memory in the browser process, fast reads/writes

**Pattern: Write-through cache**

The write-through pattern maintains an in-memory copy for synchronous access while persisting every mutation to storage:

```javascript
// --- Startup: restore queue from storage ---
let requestQueue = {};
const QUEUE_STORAGE_KEY = 'myjd_request_queue';

async function restoreRequestQueue() {
    const result = await chrome.storage.session.get(QUEUE_STORAGE_KEY);
    if (result[QUEUE_STORAGE_KEY]) {
        requestQueue = result[QUEUE_STORAGE_KEY];
    }
}

// Call on startup
restoreRequestQueue();

// --- Write-through on every mutation ---
function persistQueue() {
    chrome.storage.session.set({ [QUEUE_STORAGE_KEY]: requestQueue }).catch(err => {
        console.error('Background: Failed to persist queue:', err);
    });
}

function addLinkToRequestQueue(link, tab) {
    // ... existing logic ...
    if (!isDupe) {
        requestQueue[tab.id].push(newLink);
        persistQueue();  // <-- Write-through
        notifyContentScript(tab.id);
    }
}
```

**All mutation points that need `persistQueue()` calls:**

| Function/Handler | Line | Mutation | Current Code |
|-----------------|------|----------|--------------|
| `addLinkToRequestQueue()` | 53-56 | Push new link | `requestQueue[tab.id].push(newLink)` |
| `"remove-request"` handler | 378 | Filter out request | `requestQueue[tabId] = requestQueue[tabId].filter(...)` |
| `"remove-all-requests"` handler | 389 | Delete tab queue | `delete requestQueue[request.data.tabId]` |
| `"close-in-page-toolbar"` handler | 399 | Delete tab queue | `delete requestQueue[tabId]` |
| `tabs.onRemoved` listener | 588 | Delete tab queue | `delete requestQueue[tabId]` |

**Why write-through (not batched):**
- Queue mutations are infrequent (user right-clicks, user clicks send/remove)
- Each mutation is a small write (~few KB at most)
- Write-through is simpler -- no batching timer, no edge cases around timer lifecycle in service workers
- `chrome.storage.session` is in-memory, so writes are fast

**Startup race condition:** When the service worker restarts, `restoreRequestQueue()` is async. Message handlers that read `requestQueue` could fire before restoration completes. Solution: the `restoreRequestQueue()` promise should be awaited in handlers that read the queue.

```javascript
let queueReady = restoreRequestQueue();

// In message handler:
if (action === "link-info") {
    await queueReady;  // Ensure queue is loaded
    let tabId = request.data;
    let queue = requestQueue[tabId] || [];
    sendResponse({ data: queue });
    return true;
}
```

**Important:** The `onMessage` listener must `return true` to indicate async response, which it already does.

### Anti-Patterns to Avoid

- **Using `chrome.storage.local` for the queue:** Wrong -- queue data is transient (should clear on browser restart). `chrome.storage.session` is the correct choice.
- **Relying on keepAlive alarm for state:** The 4-minute keepAlive alarm in `background.js` line 594 prevents termination in some cases but is not a reliable substitute for persistence.
- **Batched/debounced writes:** Over-engineering for this use case. Queue mutations are user-initiated and infrequent.
- **Making message handlers wait for storage in a blocking way:** Must use async/await pattern, not synchronous blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue persistence | Custom IndexedDB wrapper | `chrome.storage.session` | Built-in, correct scope, 10MB quota |
| Response serialization fallback | Ad-hoc error strings | `serialize_response()` helper | Centralizes pattern, prevents future unwraps |
| CAPTCHA dedup | Complex event system | Simple object/Map guard | Only need to track in-progress state |

## Common Pitfalls

### Pitfall 1: Async Restoration Race Condition
**What goes wrong:** Service worker restarts, message arrives before `chrome.storage.session.get()` resolves. Handler reads empty `requestQueue`, returns no links.
**Why it happens:** `chrome.storage.session.get()` is async; message listeners fire immediately on service worker wake.
**How to avoid:** Store the restoration Promise in a module-level variable, `await` it in any handler that reads `requestQueue`.
**Warning signs:** Links disappear intermittently after periods of inactivity.

### Pitfall 2: Tab ID Type Mismatch After Storage Roundtrip
**What goes wrong:** `requestQueue` keys are tab IDs (integers), but JSON serialization converts object keys to strings. After restore, `requestQueue["123"]` won't match `requestQueue[123]`.
**Why it happens:** `chrome.storage.session` stores JSON. JavaScript object keys become strings in JSON.
**How to avoid:** Always use string keys: `requestQueue[String(tab.id)]` or convert on restore. Or use `String(tabId)` consistently.
**Warning signs:** Queue appears empty after service worker restart even though storage has data.

### Pitfall 3: `serde_json::to_vec` Fallback Must Produce Valid Native Messaging Format
**What goes wrong:** If the fallback error response doesn't include the 4-byte length prefix, Chrome's native messaging won't parse it.
**Why it happens:** `write_message()` handles the length prefix. The fallback just needs to produce a valid JSON byte vector -- `write_message()` wraps it correctly.
**How to avoid:** Ensure fallback goes through `write_message()` just like normal responses.
**Warning signs:** Extension receives `chrome.runtime.lastError` with "Native host has exited" instead of error response.

### Pitfall 4: CAPTCHA Guard Leak on Unhandled Rejection
**What goes wrong:** If `CaptchaNativeService.sendCaptcha()` rejects without the `.catch()` handler running, the `captchaInProgress` entry is never cleaned up. All future CAPTCHAs for that ID are silently blocked.
**Why it happens:** Unhandled promise rejection edge case (e.g., extension context invalidation during native messaging).
**How to avoid:** Always clean up in both `.then()` and `.catch()` paths. Consider adding a timeout-based cleanup as a safety net.
**Warning signs:** CAPTCHA solving stops working after a failed attempt until service worker restarts.

### Pitfall 5: Duplicate BUG-01 Fix Misses Second Location
**What goes wrong:** The duplicate URL pattern exists in TWO separate `chrome.tabs.query()` calls (lines 91-96 and lines 194-199). Fixing only one leaves the other.
**Why it happens:** Copy-paste in original code.
**How to avoid:** Search for all instances of `"http://my.jdownloader.org/*"` in Rc2Service.js before marking complete.
**Warning signs:** Duplicate tab queries in one code path but not the other.

## Code Examples

### chrome.storage.session Write-Through Cache
```javascript
// Source: Chrome Extension API docs + established pattern from background.js settings
const QUEUE_STORAGE_KEY = 'myjd_request_queue';
let requestQueue = {};
let queueReady;

async function restoreRequestQueue() {
    try {
        const result = await chrome.storage.session.get(QUEUE_STORAGE_KEY);
        if (result[QUEUE_STORAGE_KEY]) {
            requestQueue = result[QUEUE_STORAGE_KEY];
            console.log('Background: Restored request queue from session storage');
        }
    } catch (e) {
        console.error('Background: Failed to restore queue:', e);
    }
}

function persistQueue() {
    chrome.storage.session.set({ [QUEUE_STORAGE_KEY]: requestQueue }).catch(err => {
        console.error('Background: Failed to persist queue:', err);
    });
}

// Initialize on startup
queueReady = restoreRequestQueue();
```

### Rust serialize_response Helper
```rust
// Source: Follows existing Response struct pattern in captcha.rs
fn serialize_response(response: &Response) -> Vec<u8> {
    serde_json::to_vec(response).unwrap_or_else(|e| {
        eprintln!("Failed to serialize response: {}", e);
        format!(
            r#"{{"status":"error","error":"Serialization failed: {}"}}"#,
            e.to_string().replace('"', "'")
        )
        .into_bytes()
    })
}
```

### CAPTCHA Dedup Guard
```javascript
// Source: Pattern from existing duplicate checking in background.js addLinkToRequestQueue()
let captchaInProgress = {};

function onNewCaptchaAvailable(tabId, callbackUrl, params) {
    var dedupKey = params.captchaId || callbackUrl;

    if (captchaInProgress[dedupKey]) {
        console.log('Rc2Service: Ignoring duplicate CAPTCHA job for:', dedupKey);
        return;
    }

    captchaInProgress[dedupKey] = true;

    var captchaJob = { /* ... existing job construction ... */ };

    CaptchaNativeService.sendCaptcha(captchaJob)
        .then(function(response) {
            delete captchaInProgress[dedupKey];
            // ... existing success handling ...
        })
        .catch(function(error) {
            delete captchaInProgress[dedupKey];
            // ... existing error handling ...
        });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 persistent background page | MV3 service worker (terminates after 30s idle) | Chrome 109 (Jan 2023) | Must persist state to storage |
| `chrome.storage.session` 1MB limit | 10MB limit | Chrome 112 (Apr 2023) | Plenty of room for request queues |
| `.unwrap()` in Rust for infallible ops | `unwrap_or_else` with structured errors | Best practice | Prevents crash-on-serialize in release builds |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (JS) | Jest 27.5.1 |
| Framework (Rust) | cargo test (built-in) |
| Config file (JS) | `jest.config.js` |
| Config file (Rust) | `captcha-helper/Cargo.toml` |
| Quick run command (JS) | `npx jest --testPathPattern=__tests__` |
| Quick run command (Rust) | `cd captcha-helper && cargo test` |
| Full suite command | `npx jest && cd captcha-helper && cargo test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | Duplicate URL pattern removed | unit | `npx jest --testPathPattern=Rc2Service` | No - Wave 0 |
| BUG-02 | CAPTCHA dedup guard blocks double sends | unit | `npx jest --testPathPattern=Rc2Service` | No - Wave 0 |
| BUG-03 | unwrap() replaced with error handling | unit | `cd captcha-helper && cargo test serialize` | No - Wave 0 |
| BUG-04 | Queue persists across SW restart | unit | `npx jest --testPathPattern=background` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest` (JS) or `cd captcha-helper && cargo test` (Rust) depending on changed files
- **Per wave merge:** `npx jest && cd captcha-helper && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/services/__tests__/Rc2Service.test.js` -- covers BUG-01 and BUG-02 (URL dedup, CAPTCHA guard)
- [ ] `scripts/__tests__/background.test.js` -- covers BUG-04 (queue persistence with mocked chrome.storage.session)
- [ ] Rust unit test for `serialize_response()` helper in `captcha.rs` -- covers BUG-03
- [ ] Jest setup: mock `chrome.storage.session` API (currently `jest.setup.js` is empty)

## Open Questions

1. **Tab ID string coercion after storage roundtrip**
   - What we know: JavaScript object keys are strings in JSON. Tab IDs from Chrome are integers.
   - What's unclear: Does the existing code always use integer keys, or is there mixed usage?
   - Recommendation: Standardize on `String(tabId)` for all queue keys. Verify all consumers (`ToolbarController.js`, `AddLinksController.js`, `BackgroundController.js`) send tab IDs consistently.

2. **`handleRequest` tab closure race with handleRequest in Rc2Service**
   - What we know: `handleRequest()` (line 41) closes CAPTCHA tabs via `chrome.tabs.remove()`. `onNewCaptchaAvailable()` also closes tabs after sending to native helper.
   - What's unclear: Can both paths fire for the same tab?
   - Recommendation: Not blocking for Phase 1, but worth noting. The `handleRequest` function closes the tab for ALL localhost CAPTCHA URLs, while `onNewCaptchaAvailable` closes after native helper accepts. These could race -- but this is an existing behavior, not a Phase 1 concern.

## Sources

### Primary (HIGH confidence)
- `background.js` (lines 27-57, 362-403, 587-589) -- requestQueue code, all mutation points
- `Rc2Service.js` (lines 91-96, 194-199, 231-271) -- duplicate URLs, CAPTCHA routing
- `webview.rs` (lines 107, 129) -- unwrap() sites in production
- `main.rs` (lines 9, 20) -- unwrap() sites in production
- `captcha.rs` -- Response struct definition, handle_request patterns
- [Chrome storage.session API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- 10MB quota, in-memory, cleared on browser restart
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- 30s idle termination, state persistence requirements

### Secondary (MEDIUM confidence)
- [chrome.storage.session discussion (w3c/webextensions #350)](https://github.com/w3c/webextensions/issues/350) -- quota details and cross-browser status
- [Migrate to service workers guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) -- write-through cache pattern recommendation

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources or codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all APIs already in use or platform-native
- Architecture: HIGH -- all bug locations identified with exact line numbers, fix patterns verified against existing codebase conventions
- Pitfalls: HIGH -- tab ID coercion is a known JSON roundtrip issue, async race condition is a standard service worker concern, both have documented solutions

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- Chrome extension APIs and Rust std lib are mature)
