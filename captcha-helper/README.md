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

After installation, test the native messaging connection:

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
| `src/main.rs` | Main application source |
| `Cargo.toml` | Rust dependencies |
| `install.ps1` | Windows installer script |
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