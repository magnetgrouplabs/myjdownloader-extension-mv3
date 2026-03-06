# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:**
- Jest 27.5.1
- Config: `jest.config.js`

**Assertion Library:**
- Jest's built-in `expect()` API

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

## Test File Organization

**Location:**
- Co-located with source in `__tests__` subdirectories
- Example: `scripts/services/__tests__/CaptchaNativeService.test.js` tests `scripts/services/CaptchaNativeService.js`
- Rust tests: inline within source modules using `#[cfg(test)] mod tests { ... }`

**Naming:**
- JavaScript: `*.test.js` (matches Jest config pattern `**/__tests__/**/*.test.js`)
- Rust: tests in same file as implementation, under `#[test]` attribute

**Structure:**
```
scripts/
  services/
    CaptchaNativeService.js
    __tests__/
      CaptchaNativeService.test.js
captcha-helper/
  tests/
    integration_test.rs        # Integration tests run via cargo test
  src/
    validation.rs              # Contains #[cfg(test)] mod tests { ... }
    main.rs                    # Contains tests
```

## Test Structure

**Jest Test Structure:**

```javascript
'use strict';

describe('CaptchaNativeService Logic', () => {
    describe('Response Handling', () => {
        it('should handle solved status with token', () => {
            const response = { status: 'solved', token: 'abc123' };
            expect(response.status).toBe('solved');
            expect(response.token).toBe('abc123');
        });

        it('should handle skipped status with skipType', () => {
            const response = { status: 'skipped', skipType: 'hoster' };
            expect(response.status).toBe('skipped');
            expect(response.skipType).toBe('hoster');
        });
    });
});
```

**Rust Test Structure:**

```rust
#[test]
fn test_validate_callback_url_localhost() {
    assert!(validate_callback_url("http://localhost:8080/captcha?id=123").is_ok());
    assert!(validate_callback_url("https://localhost/captcha").is_ok());
}

#[test]
fn test_validate_callback_url_rejects_external() {
    assert!(validate_callback_url("http://example.com/captcha").is_err());
    assert!(validate_callback_url("http://192.168.1.1/captcha").is_err());
}
```

**Patterns:**
- Setup: `const response = { ... }` or `let request = Request { ... }`
- Teardown: Not used (tests are isolated, no shared state)
- Assertions: `expect(...).toBe(...)` in JS; `assert!(...)` / `assert_eq!(...)` in Rust

## Mocking

**Framework:**
- Manual object construction (no Jest mocking library used)
- JavaScript tests create mock request/response objects directly

**Patterns (JavaScript):**

```javascript
it('should format captcha_new message correctly', () => {
    const captchaJob = {
        siteKey: 'test-site-key',
        siteKeyType: 'normal',
        challengeType: 'recaptcha',
        callbackUrl: 'http://127.0.0.1:8080/captcha/123',
        captchaId: 'captcha-123',
        hoster: 'example.com',
        v3action: '',
        enterprise: false,
        siteUrl: 'http://example.com/page',
        siteDomain: 'example.com'
    };

    const message = {
        action: 'captcha_new',
        siteKey: captchaJob.siteKey,
        siteKeyType: captchaJob.siteKeyType || 'normal',
        challengeType: captchaJob.challengeType,
        callbackUrl: captchaJob.callbackUrl,
        ...
    };

    expect(message.action).toBe('captcha_new');
});
```

**What to Mock:**
- CAPTCHA job objects with all required fields
- HTTP response objects (status, token, skipType)
- Request messages for native messaging protocol

**What NOT to Mock:**
- Chrome extension API calls (no mocking setup; tests avoid calling actual Chrome APIs)
- Network requests (tests validate URL/message format, not HTTP behavior)
- Native messaging — tested via integration tests with mock server instead

## Fixtures and Factories

**Test Data:**

Test data is constructed inline within test cases. No shared fixture files.

Example from `CaptchaNativeService.test.js`:
```javascript
const response = { status: 'solved', token: 'abc123' };
const message = {
    action: 'captcha_new',
    siteKey: 'test-site-key',
    siteKeyType: 'normal',
    challengeType: 'recaptcha',
    callbackUrl: 'http://127.0.0.1:8080/captcha/123',
    captchaId: 'captcha-123',
    hoster: 'example.com',
    v3action: '',
    enterprise: false,
    siteUrl: 'http://example.com/page',
    siteDomain: 'example.com'
};
```

**Location:**
- Inline within test functions
- No factory modules or shared test data files
- Rust integration tests: MockServer in `captcha-helper/tests/integration_test.rs`

## Coverage

**Requirements:** No coverage targets enforced

**View Coverage:**
```bash
npm run test:coverage
```

Output in `coverage/` directory (standard Jest coverage).

## Test Types

**Unit Tests:**

**Scope:** Validation logic, message formatting, response handling

**Examples:**
- `CaptchaNativeService.test.js`: Tests response handling (solved, skipped, cancelled, timeout, error)
- `validation.rs` tests: URL validation, skip type validation, site key validation
- No Chrome API mocking; tests focus on pure logic

**JavaScript Test Suite (250 lines):**
- Response Handling: 6 tests
- Message Format Validation: 8 tests (captcha_new, skip, cancel, status, hCaptcha, v3 reCAPTCHA)
- URL Validation: 6 tests (localhost, 127.0.0.1, IPv6, rejections, invalid URLs)
- Skip Type Validation: 4 tests (valid types, invalid defaults, SQL injection attempt)
- Site Key Validation: 5 tests (valid keys, empty, invalid chars, length limits)
- Native Host Name: 1 test

**Rust Unit Tests:**
- `validation.rs`: 20+ tests for URL, skip type, site key validation
- `captcha.rs`: Request/response serialization tests
- `main.rs`: Error handling for malformed JSON

**Integration Tests:**

**Framework:** Rust `#[test]` with mock HTTP server

**Scope:** End-to-end validation request/response flow

**Location:** `captcha-helper/tests/integration_test.rs`

**Approach:**
- Start mock server on `127.0.0.1:3000`
- Send CAPTCHA requests to native helper
- Validate responses match protocol specification

**Example test:**
```rust
#[test]
fn test_status_action() {
    let request = Request {
        action: "status".to_string(),
        site_key: None,
        // ...
    };
    let response = handle_request(request);
    assert_eq!(response.status, "ok");
    assert_eq!(response.version, Some(VERSION.to_string()));
}
```

**E2E Tests:**
- Not present (Chrome extension UI testing not practical without browser automation)
- Manual testing required: reload extension at `chrome://extensions/`, test CAPTCHA flow

## Common Patterns

**Test Naming:**
- Descriptive: `should_handle_solved_status_with_token` (JavaScript)
- Pattern: `test_<action>_<condition>` (Rust)

**Assertions (JavaScript):**

```javascript
expect(value).toBe(expected)           // Exact equality
expect(response.status).toBe('solved') // String matching
expect(value).toBeDefined()            // Defined check
expect(array).toMatch(/pattern/)       // Regex validation
```

**Assertions (Rust):**

```rust
assert_eq!(response.status, "ok")           // Equality
assert!(validate_callback_url(...).is_ok()) // Result success
assert!(validate_callback_url(...).is_err()) // Result failure
assert!(error.contains("localhost"))        // String contains
```

**Async Testing:**

Not directly tested in current suite. Native messaging is promise-based; tests mock response objects instead of calling actual Chrome APIs.

Example from service:
```javascript
return sendNativeMessage(message).then(function(response) {
    if (response.status === 'solved' && response.token) {
        return submitTokenToJDownloader(...);
    } else if (response.status === 'skipped') {
        return { status: 'skipped', skipType: response.skipType };
    }
});
```

Tests verify message format and response handling, not the promise chain itself.

**Error Testing:**

```javascript
it('should handle error status', () => {
    const response = { status: 'error', error: 'Invalid site key' };
    expect(response.status).toBe('error');
    expect(response.error).toBe('Invalid site key');
});

it('should reject empty site keys', () => {
    expect(validateSiteKey('').valid).toBe(false);
    expect(validateSiteKey(null).valid).toBe(false);
});
```

**Rust error tests:**

```rust
#[test]
fn test_skip_validates_url_rejects_external() {
    let request = Request {
        action: "skip".to_string(),
        callback_url: Some("http://evil.com/captcha".to_string()),
        skip_type: Some("hoster".to_string()),
        ...
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("localhost"));
}
```

## Setup and Teardown

**Jest Setup:**

`jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleDirectories: ['node_modules', 'scripts'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {},
  moduleNameMapper: {
    '^angular$': '<rootDir>/node_modules/angular/angular.min.js'
  }
};
```

`jest.setup.js`: Empty (reserved for future setup)

**No per-test setup/teardown used** — tests are isolated and stateless.

## Test Execution

**Running Rust tests:**
```powershell
# In captcha-helper directory
cargo test              # Run all tests
cargo test --release   # Release build tests (faster)
cargo test -- --nocapture  # Show println! output
```

**Running JavaScript tests:**
```bash
npm test              # All tests
npm test CaptchaNativeService  # Single test file
npm run test:coverage # With coverage
```

## Validation Test Coverage

**Comprehensive validation in Rust (60+ tests):**

- **URL Validation:** localhost, 127.0.0.1, 127.*.*.*, IPv6, external rejection, scheme validation
- **Skip Type Validation:** Valid types (hoster, package, all, single), invalid defaults, edge cases
- **Site Key Validation:** Format (alphanumeric, dash, underscore), length (0-256 chars), empty rejection
- **Security Tests:** SQL injection attempts in skip type, XSS attempts in parameters

**Lightweight JavaScript tests (37 tests):**

- **Response formats:** All protocol response types (solved, skipped, cancelled, timeout, error, ok)
- **Message formatting:** Correct structure for captcha_new, skip, cancel, status actions
- **URL validation:** Mirrors Rust validation logic to ensure protocol compliance
- **Native host name:** Correct constant value

---

*Testing analysis: 2026-03-06*
