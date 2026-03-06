# Phase 1: Bug Fixes & Queue Persistence - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 known bugs (BUG-01 through BUG-04) and migrate the service worker's in-memory requestQueue to chrome.storage.session so link state survives service worker termination. This is the foundation phase — all subsequent phases depend on reliable state and bug-free CAPTCHA routing.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation decisions to Claude. The following areas are flexible:

- **Queue persistence timing**: Write-through vs batched writes to chrome.storage.session. Choose based on simplicity and reliability.
- **CAPTCHA dedup behavior**: How to guard against double CAPTCHA job sends (BUG-02). Silent ignore vs user-visible indication — Claude decides.
- **Error verbosity**: Level of detail in native helper error responses replacing unwrap() panics (BUG-03). Balance diagnostic usefulness with simplicity.
- **BUG-01 fix**: Straightforward removal of duplicate URL pattern in Rc2Service tab query.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CaptchaNativeService.js`: Already has `isValidCallbackUrl()` validation and structured message formatting — patterns to follow for error responses
- `background.js:27`: `requestQueue` object keyed by tab ID with duplicate checking (lines 44-51) — migrate this structure to chrome.storage.session
- Integration tests in `captcha-helper/tests/integration_test.rs`: 60 existing tests to ensure Rust changes don't regress

### Established Patterns
- Native messaging protocol uses JSON with `status` and `error` fields — error responses should follow this convention
- Chrome extension uses AngularJS services pattern — bug fixes stay within existing service boundaries
- Rust helper uses `serde_json` for serialization — error handling should use `Result` types and `map_err()`

### Integration Points
- `background.js` requestQueue: consumed by `ToolbarController.js`, `AddLinksController.js`, `BackgroundController.js`
- `Rc2Service.js` CAPTCHA routing: calls `CaptchaNativeService.sendCaptcha()` and has fallback postMessage path (lines 231-271)
- `webview.rs` unwrap sites: lines 107, 129 in webview.rs and line 9 in main.rs
- Tab query duplicate: `Rc2Service.js` lines 195-199, duplicate `http://my.jdownloader.org/*` entry

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Bug fixes are well-defined by the codebase concerns audit.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-bug-fixes-queue-persistence*
*Context gathered: 2026-03-06*
