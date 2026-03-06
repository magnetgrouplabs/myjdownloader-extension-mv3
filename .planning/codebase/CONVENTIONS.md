# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- `camelCase.js` for service/controller/utility files (e.g., `CaptchaNativeService.js`, `AddLinksController.js`)
- `snake_case.rs` for Rust modules (e.g., `captcha_helper`, `integration_test.rs`)
- HTML templates: `lowercase.html` (e.g., `popup.html`, `toolbar.html`)
- Content scripts: descriptive names with `Contentscript` suffix (e.g., `toolbarContentscript.js`, `cnlInterceptor.js`)

**Functions:**
- JavaScript: `camelCase` for all function names
  - Service methods: `sendCaptcha()`, `skipCaptcha()`, `checkStatus()`
  - Controllers: `resetScope()`, `onNewCaptchaAvailable()`, `handleRequest()`
  - Private functions: `sendNativeMessage()`, `onLoginNeeded()` (still camelCase even if internal)
- Rust: `snake_case` for all functions
  - Public exports: `validate_callback_url()`, `validate_site_key()`, `handle_request()`
  - Helper functions: `http_get()`, `write_message()`, `read_message()`

**Variables:**
- `camelCase` for all variable declarations (JavaScript)
  - State/config objects: `let state = {}`, `const STORAGE_KEYS = {}`
  - Loop counters: `for (let i = 0; i < tabs.length; i++)`
  - Boolean flags: `let isForcedPrivateMode`, `let isAllowedIncognito`
- `snake_case` for Rust variables and struct fields
  - Request fields: `site_key`, `callback_url`, `challenge_type` (via `#[serde(rename = "...")]` for JSON)
  - Local bindings: `let parsed = Url::parse(url)`, `let response = handle_request()`

**Types:**
- PascalCase for JavaScript objects representing data structures
  - Controllers: `angular.module('...').controller('AddLinksCtrl', [...])`
  - Services: `angular.module('...').service('CaptchaNativeService', [...])`
  - Request/Response objects: defined inline with descriptive properties
- PascalCase for Rust structs and enums
  - `pub struct Request { ... }`, `pub struct Response { ... }`
  - `pub enum CaptchaResult { Solved(String), Skipped(String), Cancelled, Timeout }`

**Constants:**
- UPPERCASE_SNAKE_CASE for truly immutable constants
  - JavaScript: `const NATIVE_HOST_NAME = 'org.jdownloader.captcha_helper'`
  - Rust: `const ALLOWED_SKIP_TYPES: [&str; 4] = ["hoster", "package", "all", "single"]`
- UPPERCASE_SNAKE_CASE for module-level configuration
  - `const STORAGE_KEYS = { CLICKNLOAD_ACTIVE: '...', ... }`
  - `const DEVICE_TYPES = { ASK_EVERY_TIME: {...}, LAST_USED: {...} }`

## Code Style

**Formatting:**
- No ESLint/Prettier config present — convention based on existing code
- 4-space indentation in JavaScript (observed in services)
- 2-space indentation in some controllers (variable across codebase)
- Rust: standard Rust formatting via `rustfmt` (idiomatic)

**Linting:**
- No linting tool configured or enforced
- Follows JavaScript `'use strict';` mode at file top (all service files start with this)
- No TypeScript; pure JavaScript with JSDoc comments where applicable

**Spacing & Braces:**
- Opening braces on same line: `function foo() {` (JavaScript)
- Space after keywords: `if (condition) {`, `for (let i = 0; i < n; i++)`
- No space before method paren: `foo()` not `foo ()`

## Import Organization

**Order (JavaScript):**
1. `'use strict';` directive (first line of service/test files)
2. Module declaration: `angular.module('myjdWebextensionApp').service(...)`
3. Within Angular array syntax: dependencies listed in order of use

**Example from `CaptchaNativeService.js`:**
```javascript
'use strict';

angular.module('myjdWebextensionApp')
    .service('CaptchaNativeService', ['$q', '$http', function ($q, $http) {
        // Implementation
    }]);
```

**Order (Rust):**
1. Module imports (`use` statements) grouped by origin
   - Standard library: `use std::...`
   - External crates: `use crossbeam::...`, `use serde::...`, `use url::...`
   - Local modules: `use crate::...`

**Path Aliases:**
- No path aliases detected in JavaScript
- Rust uses standard `crate::` prefix for internal modules: `use crate::http::http_get`

## Error Handling

**Patterns (JavaScript):**
- Promises with `.then()` / `.catch()` chaining
  - Example: `sendNativeMessage(message).then(response => {...}).catch(error => {...})`
- Try/catch blocks for synchronous operations
  - Example in `Rc2Service.js`: Check Chrome API availability with try/catch
- Direct error object inspection: `if (chrome.runtime.lastError) { ... }`
- Reject promises with consistent error object: `{ status: 'error', error: 'message' }`

**Patterns (Rust):**
- `Result<T, String>` return type for fallible operations
  - Example: `pub fn validate_callback_url(url: &str) -> Result<String, String>`
- Match expressions for handling `Ok` / `Err` cases
  - Example from `captcha.rs`:
    ```rust
    let callback_url = match validate_callback_url(&request.callback_url.unwrap_or_default()) {
        Ok(url) => url,
        Err(e) => {
            return Response {
                status: "error".to_string(),
                error: Some(e),
                ...
            };
        }
    };
    ```
- Unwrap only in test/main code, never in library functions
- Return early on validation failure with descriptive error message

**Validation approach:**
- Centralized validation functions in separate modules
  - `validation.rs`: URL, skip type, site key validation
  - Each returns `Result<T, String>` with human-readable error
- Validation happens before business logic

## Logging

**Framework:** `console` object (JavaScript); no logging in Rust executable

**Patterns:**
- `console.log()` for informational messages: `console.log('popup.js: Angular bootstrapped successfully')`
- `console.error()` for error conditions: `console.error('Background: Failed to inject toolbar content script:', e)`
- `console.warn()` for recoverable issues: `console.warn('BackgroundController: Failed to inject JD check script:', err)`
- Prefix with module name for context: `'Rc2Service: Could not check incognito access: '`

**When to log:**
- Entry/exit of major control flows
- Chrome API success/failure states
- Error exceptions and their messages
- CAPTCHA job lifecycle events

## Comments

**When to Comment:**
- Document non-obvious CAPTCHA protocol details
- Explain MV3 API compatibility issues (e.g., why certain APIs require callbacks)
- Mark section boundaries with full-line comments: `// ============================================================`
- Warn about constraints and edge cases

**JSDoc/TSDoc:**
- Not consistently used; some files have JSDoc blocks for file-level documentation
- Example from `popup.js`:
  ```javascript
  /**
   * Configures RequireJS paths and loads the jdapi module
   */
  ```
- Controllers and services lack detailed JSDoc; rely on descriptive function names instead

**Comment style:**
- Single-line: `// Comment explaining the line below`
- Multi-line: `/* Comment spanning multiple lines for complex logic */`
- Mark TODOs: `// TODO: Send via API` (used sparingly)

## Function Design

**Size:**
- Most functions 20-50 lines
- Larger functions (100+ lines) decomposed into smaller helpers with descriptive names
- Example: `onNewCaptchaAvailable()` is ~40 lines handling CAPTCHA job dispatch

**Parameters:**
- Keep under 5 parameters; use object literals for optional parameters
- Example: `captchaJob` object passed to `sendCaptcha()` instead of multiple args
- Angular injection via array syntax: `['$q', '$http', function ($q, $http) { ... }]`

**Return Values:**
- JavaScript services return promises: `return sendNativeMessage(message)`
- Controllers return undefined (side effects only): state updates via `$scope`
- Rust functions return `Result<T, String>` for fallible operations, `T` for pure computations

## Module Design

**Exports:**
- Angular services: expose public methods via `this.methodName = function() { ... }`
  - Only public methods on `this`; private helpers as nested functions
  - Example from `CaptchaNativeService.js`:
    ```javascript
    this.sendCaptcha = function (captchaJob) { ... };
    this.skipCaptcha = function (callbackUrl, skipType) { ... };
    ```
- Rust: explicit `pub fn` for public API; private helper functions with no `pub`

**Barrel Files:**
- No barrel files (`index.js`) detected
- Each service/controller/test is standalone; no re-exports

**Module structure (Rust):**
- `lib.rs` declares public re-exports from submodules
- Each domain gets its own file: `validation.rs`, `html.rs`, `http.rs`, `native.rs`, `webview.rs`
- Tests included inline with `#[cfg(test)] mod tests { ... }` in each module

---

*Convention analysis: 2026-03-06*
