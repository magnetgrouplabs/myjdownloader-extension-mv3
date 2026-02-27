# Security Policy

## Security Overview

The `myjd-captcha-helper` is a native messaging host that enables CAPTCHA solving for the MyJDownloader Chrome extension in a Manifest V3-compliant manner. It runs as a standalone executable on the user's local machine and communicates with the Chrome extension via Chrome's Native Messaging API.

### Security Model

The native helper operates under the following security assumptions:
- The Chrome extension is trusted (validated by Chrome's extension review process)
- JDownloader runs locally on `127.0.0.1` (trusted local application)
- CAPTCHA providers (Google reCAPTCHA, hCaptcha) are trusted third-party services
- The user's local machine is not compromised

---

## Attack Surface

### 1. Native Messaging Endpoint

**Description**: Chrome extension communicates via `chrome.runtime.sendNativeMessage()`

**Entry point**: `read_message()` function reads length-prefixed JSON from stdin

**Risk level**: Medium
- Messages are authenticated by Chrome (only the installed extension can communicate)
- Input is deserialized as JSON; malformed input is handled gracefully
- No arbitrary code execution from message content

### 2. WebView2 CAPTCHA Window

**Description**: External content from Google/hCaptcha is rendered in an embedded browser

**Entry point**: `run_webview_window()` creates a WebView with dynamically generated HTML

**Risk level**: Medium
- Loads external JavaScript from `google.com` and `hcaptcha.com`
- Content Security Policy restricts script sources
- wry/WebView2 sandbox applies additional protections
- No direct DOM access from native code

### 3. HTTP Callbacks to JDownloader

**Description**: HTTP GET requests to `127.0.0.1` for skip operations and token submission

**Entry point**: `http_get()` function makes outbound HTTP requests

**Risk level**: Low
- Callbacks are localhost-only by design
- Tokens are submitted via JDownloader's existing HTTP interface
- 10-second timeout prevents hanging connections

---

## Security Mitigations Implemented

### Input Validation

| Mitigation | Location | Description |
|------------|----------|-------------|
| Message size limit | `read_message()` line 788-793 | Rejects messages >1MB to prevent memory exhaustion |
| JSON parsing | `handle_request()` line 68-83 | Invalid JSON returns error, not crash |
| Action whitelist | `handle_request()` line 93-129 | Only `status`, `captcha_new`, `skip`, `cancel` actions accepted |
| Skip type whitelist | Implicit via JDownloader API | Skip types passed through; JDownloader validates |
| Request timeout | `handle_captcha()` line 166 | 5-minute timeout prevents indefinite operation |

### HTTPS Only for External Resources

| Resource | URL | Enforced |
|----------|-----|----------|
| reCAPTCHA | `https://www.google.com/recaptcha/...` | Yes |
| reCAPTCHA Enterprise | `https://www.google.com/recaptcha/enterprise.js` | Yes |
| hCaptcha | `https://hcaptcha.com/1/api.js` | Yes |

### Content Security Policy

In generated HTML (line 449):
```
default-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://hcaptcha.com https://*.hcaptcha.com
```

Note: `'unsafe-inline'` and `'unsafe-eval'` are required for CAPTCHA widget functionality.

### HTTP Request Controls

| Control | Location | Value |
|---------|----------|-------|
| Timeout | `http_get()` line 771 | 10 seconds |
| User-Agent header | `http_get()` line 768-769 | `myjd-captcha-helper-{version}` |

### Window Security

| Control | Description |
|---------|-------------|
| DevTools | Currently enabled (`with_devtools(true)` at line 266); should be disabled in production builds |
| No file access | WebView is created with HTML content, not file URLs |
| IPC boundary | JavaScript can only communicate via `window.ipc.postMessage()` |

### Build Security (Release Profile)

From `Cargo.toml`:
```toml
[profile.release]
opt-level = "z"      # Size optimization
lto = true           # Link-time optimization (removes dead code)
codegen-units = 1    # Better optimization
panic = "abort"      # No unwinding (smaller binary)
strip = true         # Strip symbols
```

---

## Pre-existing Issues (Inherited from MV2 Extension)

These issues existed in the original Manifest V2 extension and are architectural limitations, not new vulnerabilities introduced by this native helper.

### PostMessage Wildcard Origin

**Location**: Browser extension popup/toolbar

**Description**: The extension uses `window.postMessage()` with `origin: "*"` for cross-origin communication between the extension popup and in-page toolbar.

**Reason**: Architectural requirement for communication between extension contexts and page scripts.

**Mitigation**: Messages are validated by type and structure before processing.

### HTTP Callbacks Without TLS

**Location**: All JDownloader communication

**Description**: JDownloader's local HTTP API runs on `http://127.0.0.1:PORT` without TLS.

**Reason**: JDownloader limitation; would require certificate management for localhost.

**Mitigation**: Callbacks are localhost-only; network-level attacks would require local access.

### Third-party Dependencies (Vendor)

**Location**: `vendor/` directory (jQuery, AngularJS)

**Description**: The extension bundles older versions of jQuery and AngularJS.

**Mitigation**: These run in the extension's sandboxed context; regular updates recommended.

---

## Known Limitations

### JDownloader Localhost Callbacks

- **Issue**: JDownloader API uses HTTP (not HTTPS) on localhost
- **Impact**: CAPTCHA tokens transmitted via HTTP GET parameters
- **Mitigation**: Only accessible on local machine; no remote exposure

### CAPTCHA Token Transmission

- **Issue**: Tokens passed via URL parameters in GET requests
- **Impact**: Tokens may appear in JDownloader logs
- **Mitigation**: Tokens are short-lived; single-use for most CAPTCHA providers

### WebView2 Origin Model

- **Issue**: WebView2 windows don't have a traditional domain origin
- **Impact**: Some security features based on same-origin policy don't apply
- **Mitigation**: CSP restricts resource loading; no user content is rendered

### Native Messaging Authentication

- **Issue**: Native messaging trusts any message from the extension
- **Impact**: A compromised extension could send malicious commands
- **Mitigation**: Chrome's extension review process; user must explicitly install extension

---

## Reporting Vulnerabilities

We appreciate responsible disclosure of security vulnerabilities.

### How to Report

1. **Email**: Send details to security@jdownloader.org
   - Include steps to reproduce
   - Include affected versions
   - Include potential impact assessment

2. **GitHub Security Advisories**: 
   - Go to https://github.com/AppWork/JDownloader/security/advisories
   - Click "Report a vulnerability"
   - Fill in the details

### What to Expect

- Acknowledgment within 48 hours
- Initial assessment within 7 days
- Security fix timeline based on severity:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Next release

### Disclosure Policy

- Please do not disclose publicly until a fix is released
- We will credit responsible disclosure in release notes (optional)

---

## Dependencies

### Direct Dependencies (from Cargo.toml)

| Crate | Version | Purpose | Audit Status |
|-------|---------|---------|--------------|
| `serde` | 1.0 | JSON serialization/deserialization | Well-audited |
| `serde_json` | 1.0 | JSON parsing | Well-audited |
| `ureq` | 2.9 | HTTP client | Minimal attack surface |
| `crossbeam` | 0.8 | Channel-based concurrency | Well-audited |
| `wry` | 0.40 | WebView2 bindings | Regularly updated |
| `tao` | 0.26 | Window management | Regularly updated |
| `url` | 2.5 | URL parsing (transitive) | Well-audited |

### Dependency Security

- All dependencies are from crates.io (official Rust registry)
- Dependencies are pinned to specific versions
- No `*` or range-based version constraints

### Recommended Security Practices

Run regularly:
```bash
cd captcha-helper
cargo audit
cargo outdated
```

Check for known vulnerabilities:
```bash
cargo audit
```

Update dependencies:
```bash
cargo update
```

---

## Security Checklist for Contributors

- [ ] All user input is validated before use
- [ ] No hardcoded credentials or API keys
- [ ] HTTPS used for all external network requests
- [ ] Error messages don't leak sensitive information
- [ ] No SQL injection or command injection vectors
- [ ] Memory safety enforced by Rust compiler
- [ ] No `unwrap()` on user-controlled input
- [ ] Timeouts on all network operations
- [ ] Size limits on inbound data
- [ ] DevTools disabled in release builds

---

## Version History

| Version | Date | Security Changes |
|---------|------|------------------|
| 0.1.0 | Initial | Native messaging implementation for MV3 |

---

## Contact

- **Security Team**: security@jdownloader.org
- **Project Repository**: https://github.com/AppWork/JDownloader
- **Chrome Extension**: Chrome Web Store (search "MyJDownloader")