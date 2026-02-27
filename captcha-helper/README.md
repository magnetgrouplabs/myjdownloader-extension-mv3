# MyJDownloader CAPTCHA Helper

Native Windows application for solving CAPTCHAs in the MyJDownloader Chrome extension (Manifest V3).

## Requirements

- **Windows 10/11**
- **WebView2 Runtime** (usually pre-installed on Windows 11, available for Windows 10)
- **Chrome** with MyJDownloader extension

## Installation

1. Download or build the `myjd-captcha-helper.exe` binary
2. Open PowerShell in this directory
3. Run the installer:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install.ps1
   ```
4. Reload the MyJDownloader extension in Chrome (`chrome://extensions/`)

## Testing

### Automated Tests

Run the complete test suite:

```powershell
.\run-tests.ps1
```

Or run tests separately:

```powershell
# Rust unit tests and integration tests
cargo test

# Rust unit tests only
cargo test --lib

# Rust integration tests only
cargo test --test integration_test

# JavaScript tests (from project root)
npm test
```

### Test Coverage

| Component | Tests | Description |
|-----------|-------|-------------|
| `validation.rs` | 14 | URL validation, site key validation, skip type validation |
| `escape.rs` | 10 | HTML and JavaScript escaping (XSS prevention) |
| `html.rs` | 11 | CAPTCHA HTML generation for all types |
| `captcha.rs` | 9 | Request/response handling, action routing |
| `native.rs` | 1 | Native messaging format |
| `http.rs` | 5 | HTTP client with mock server |
| Integration | 14 | Full request flows with mock JDownloader server |
| JavaScript | 22 | CaptchaNativeService with Chrome API mocks |
| **Total** | **86** | |

### Manual Testing

1. Open Chrome and go to:
   ```
   chrome-extension://fbcohnmimjicjdomonkcbcpbpnhggkip/captcha-helper/test-native-messaging.html
   ```
2. Click **"Check Native Helper Status"** - should show `{"status":"ok","version":"0.1.0"}`
3. Click **"Test Mode (Fake CAPTCHA)"** to test the full flow

## Building from Source

### Prerequisites

- [Rust](https://rustup.rs/) (install with `rustup-init.exe`)
- Visual Studio Build Tools (C++ workload)

### Build

```powershell
cd captcha-helper
cargo build --release
```

The binary will be at `target\release\myjd-captcha-helper.exe`.

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall
```

## How It Works

1. Chrome extension detects CAPTCHA request from JDownloader
2. Extension calls native helper via `chrome.runtime.sendNativeMessage()`
3. Native helper opens a WebView2 window with the CAPTCHA
4. User solves the CAPTCHA
5. Token is returned to extension via native messaging
6. Extension submits token to JDownloader

## Supported CAPTCHA Types

- reCAPTCHA v2 (checkbox)
- reCAPTCHA v3 (invisible)
- reCAPTCHA Enterprise
- hCaptcha

## Architecture

```
Chrome Extension (MyJDownloader)
          │
          │ chrome.runtime.sendNativeMessage()
          ▼
Native Helper (myjd-captcha-helper.exe)
          │
          │ WebView2 Window
          ▼
    CAPTCHA Widget
          │
          │ User interaction
          ▼
    Token returned to extension
          │
          │ HTTP callback
          ▼
      JDownloader
```

## Files

| File | Description |
|------|-------------|
| `src/lib.rs` | Library entry point, re-exports public API |
| `src/main.rs` | Binary entry point, native messaging loop |
| `src/validation.rs` | URL, site key, and skip type validation |
| `src/escape.rs` | HTML and JavaScript escaping utilities |
| `src/html.rs` | CAPTCHA HTML generation |
| `src/http.rs` | HTTP client for JDownloader callbacks |
| `src/native.rs` | Native messaging I/O |
| `src/captcha.rs` | Request/response types and handlers |
| `src/webview.rs` | WebView2 window management (Windows only) |
| `tests/integration_test.rs` | Integration tests with mock server |
| `Cargo.toml` | Rust dependencies |
| `install.ps1` | Windows installer script |
| `run-tests.ps1` | Test runner script |
| `myjd-native-host.json` | Native messaging manifest template |

## Troubleshooting

### "Native host has exited" error

- Run `install.ps1` again to reinstall
- Check that the binary exists at `%LOCALAPPDATA%\MyJDownloader\captcha-helper\`
- Verify registry key exists: `HKCU\Software\Google\Chrome\NativeMessagingHosts\org.jdownloader.captcha_helper`

### CAPTCHA window doesn't open

- Ensure WebView2 Runtime is installed
- Check for WebView2 at: `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\`

### CAPTCHA widget shows "Invalid domain" error

This is expected when using test CAPTCHA keys. The native helper works correctly - the CAPTCHA provider is rejecting the request because:
- Test keys only work on specific domains
- WebView2 windows don't have a traditional domain

For real CAPTCHA solving, JDownloader provides real site keys from actual hosters.

## License

GPL-3.0 (same as MyJDownloader extension)

## Security

See [SECURITY.md](./SECURITY.md) for detailed security information.

### Security Features

The native helper implements several security measures:

- **Callback URL validation** - Only localhost/127.0.0.1 URLs are accepted
- **Input sanitization** - All user-controlled data is escaped before HTML rendering
- **Site key validation** - Alphanumeric characters only, max 256 chars
- **Skip type whitelist** - Only known skip types are accepted
- **DevTools disabled** - In release builds, DevTools is not available
- **Response size limits** - HTTP responses limited to 64KB

### Pre-existing Issues (Inherited from MV2 Extension)

The following security considerations existed in the original MV2 Chrome extension and are maintained for compatibility:

1. **PostMessage Wildcard Origin** - Uses `*` for cross-origin communication with my.jdownloader.org (required for architecture)
2. **HTTP Callbacks** - JDownloader uses HTTP (not HTTPS) for localhost communication
3. **Token URL Parameters** - CAPTCHA tokens transmitted via HTTP GET (JDownloader API design)

These issues were present in the MV2 Chrome Web Store release and do not block MV3 acceptance.

### Reporting Vulnerabilities

Report security issues to: security@jdownloader.org