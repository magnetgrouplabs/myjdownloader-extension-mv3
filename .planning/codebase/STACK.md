# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- JavaScript ES6+ - Extension popup, background worker, content scripts, tests
- Rust 2021 - Native CAPTCHA helper (WebView2 wrapper)
- JSON - Configuration and messaging

**Secondary:**
- HTML5 - Popup, offscreen, toolbar UI, test pages
- CSS - Styling (embedded in HTML files)
- PowerShell - Windows build and installation scripts

## Runtime

**Environment:**
- Chrome/Chromium Browser (Manifest V3)
- WebView2 Runtime (Windows only) - For CAPTCHA window rendering
- Node.js 14+ - Development and testing

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)
- Cargo (Rust) with `Cargo.lock` (present)

## Frameworks

**Core - JavaScript:**
- AngularJS 1.8.3 - Frontend framework (popup UI, controllers, services)
- RxJS (Rx) - Observable patterns for connection state management

**Testing:**
- Jest 27.5.1 - JavaScript unit testing
- jest-chrome 0.8.0 - Chrome API mocking for tests
- Mockito 1.4 - Rust mock HTTP server for integration tests

**Build/Dev:**
- Cargo 1.70+ - Rust build system
- RequireJS - JavaScript module loader (vendor libs)
- PowerShell - Build automation scripts

## Key Dependencies

**JavaScript - Critical:**
- angular@1.8.3 - Application framework
- angular-mocks@1.8.3 - Testing utilities
- jest@27.5.1 - Test runner
- jest-chrome@0.8.0 - Chrome API mocking

**Rust - HTTP & IPC:**
- serde@1.0 + serde_json@1.0 - JSON serialization (native messaging protocol)
- ureq@2.9 - HTTP client (JDownloader callback requests)
- crossbeam@0.8 - Multi-threaded channel communication

**Rust - UI:**
- wry@0.40 - WebView2 wrapper (cross-platform web UI)
- tao@0.26 - Window framework (platform events)
- url@2.5 - URL parsing and validation

**Rust - Dev:**
- mockito@1.4 - Mock HTTP server for testing
- tempfile@3.10 - Temporary file handling for tests

## Configuration

**Environment:**
- Chrome: `manifest.json` defines permissions, content scripts, host permissions
- Rust build: Release profile with aggressive optimization (LTO, strip, min code units)
- RequireJS config: `baseUrl: ./vendor/js` in `offscreen.js`
- Storage: Chrome `chrome.storage.local` for session persistence

**Build:**
- Rust release binary: `captcha-helper/Cargo.toml` (profile.release section)
  - opt-level = "z" (size optimization)
  - lto = true (link-time optimization)
  - panic = "abort"
  - strip = true
- Windows installer: `captcha-helper/install.ps1` with WebView2 dependency check
- Windows registry: `HKCU:\Software\Google\Chrome\NativeMessagingHosts\org.jdownloader.captcha_helper`

## Platform Requirements

**Development:**
- Windows 10+ with Rust toolchain (msvc)
- Chrome 88+ for MV3 support
- Node.js 14+ for npm dependencies
- PowerShell for build scripts

**Production:**
- Windows 10 or later
- Chrome/Chromium browser
- WebView2 Runtime (pre-installed on Windows 11, downloadable for Windows 10)
- JDownloader instance running locally on port 9666

**Extension Deployment:**
- Chrome Web Store (update_url: `https://clients2.google.com/service/update2/crx`)
- Manual sideload via `chrome://extensions/` developer mode

## Security Considerations

**Content Security Policy (MV3 Compliance):**
- No inline scripts - CAPTCHA solving moved to native helper via native messaging
- No `eval()` - Removed contentscript CAPTCHA injection
- Web-accessible resources limited to: `toolbar.html`, `autograbber-indicator.html`, test pages

**Native Messaging:**
- IPC Protocol: stdin/stdout with 4-byte little-endian length prefix
- Max message size: 1MB (enforced in `captcha-helper/src/native.rs`)
- Allowed origins: `chrome-extension://fbcohnmimjicjdomonkcbcpbpnhggkip/` only
- Host name: `org.jdownloader.captcha_helper`

**HTTP Communication:**
- Localhost only: `127.0.0.1:9666` or `localhost:9666`
- Custom header: `X-Myjd-Appkey` for app identification
- 10-second timeout on HTTP requests (`captcha-helper/src/http.rs`)

---

*Stack analysis: 2026-03-06*
