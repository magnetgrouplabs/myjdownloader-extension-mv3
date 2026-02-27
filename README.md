# MyJDownloader Browser Extension (Manifest V3)

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Chrome-Compatible-brightgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Community%20Revival-orange?style=for-the-badge" />
</p>

---

## A Note From The Developer

This project required a significant amount of work.

The JDownloader community has been without a working Manifest V3 version of this extension for some time. Converting the original implementation, restructuring the architecture for Service Worker requirements, debugging session handling, and restoring full functionality under modern Chrome policies took substantial effort.

If this extension improves your workflow or saves you time, consider showing your support so I can continue developing projects for the community.

<p align="center">
<a href="https://www.buymeacoffee.com/anthonymichael" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
</p>

## Features

- **One-click downloads**: Right-click any link, image, video, or selected text and send it to JDownloader
- **Device selection**: Choose which JDownloader instance receives the download
- **Click'N'Load (CNL)**: Automatically intercepts CNL requests from supported sites
- **In-page toolbar**: A convenient popup appears on the page for quick device selection and link sending
- **Auto-send countdown**: Optionally auto-send links to your preferred device after a countdown
- **Session persistence**: Stay logged in across browser sessions
- **Captcha solving**: Browser-based captcha solving support (RC2)
- **Configurable options**: Customize context menus, default devices, download priorities, and more

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer Mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select this repository's root directory
6. The MyJDownloader icon will appear in your toolbar

### Prerequisites

- A [MyJDownloader](https://my.jdownloader.org) account
- JDownloader 2 installed and running with MyJDownloader enabled

## Usage

1. Click the extension icon and log in with your MyJDownloader credentials
2. Your connected JDownloader instances will appear in the device list
3. To download a link:
   - **Right-click** a link on any page -> **Download with JDownloader**
   - Select your target device and click send
4. Configure settings via the extension options (right-click extension icon -> Options)

## Architecture

This extension uses a multi-context architecture required by Manifest V3:

| Component | Purpose |
|-----------|---------|
| **Service Worker** (`background.js`) | Context menus, request queue, message routing |
| **Popup** (`popup.html`) | Login UI, device list, settings navigation |
| **Toolbar** (`toolbar.html`) | In-page add-links dialog with device selection |
| **Offscreen** (`offscreen.html`) | API operations when popup is closed (CNL) |
| **Content Scripts** | CNL interception, toolbar injection, captcha handling |

Each UI context (popup, toolbar) loads its own instance of the MyJDownloader API client (`jdapi.js`) via RequireJS, with sessions shared through `chrome.storage.local`.

## Permissions

| Permission | Reason |
|------------|--------|
| `tabs` | Access tab URL/title for download source info |
| `storage` | Persist session tokens and settings |
| `contextMenus` | "Download with JDownloader" right-click menu |
| `scripting` | Inject toolbar content script into pages |
| `declarativeNetRequest` | CNL request interception |
| `alarms` | Service worker keepalive |
| `offscreen` | API operations when popup is closed |
| `<all_urls>` | Content scripts need to run on any page for CNL and context menu support |

## Development

### Project Structure

```
myjdownloader-extension-mv3/
  manifest.json              # Extension manifest (MV3)
  background.js              # Service worker
  popup.html / popup.js      # Login popup
  toolbar.html               # In-page toolbar (iframe)
  offscreen.html / offscreen.js
  scripts/
    popup-app.js             # Popup Angular module + routes
    toolbar.js               # Toolbar Angular module + routes
    controllers/             # AngularJS controllers
    services/                # AngularJS services (API, storage, messaging)
    factories/               # Device client factories
    directives/              # AngularJS directives
    partials/                # Pre-compiled HTML templates
  contentscripts/            # Content scripts for web page interaction
  vendor/                    # Third-party libraries (AngularJS, jQuery, jdapi, CryptoJS)
```

### Debugging

- **Service Worker logs**: `chrome://extensions/` -> click "service worker" link
- **Popup DevTools**: Click extension icon -> right-click popup -> "Inspect"
- **Toolbar DevTools**: Right-click the injected toolbar -> "Inspect"
- **Content Script logs**: Browser DevTools console on web pages

### Key Technical Notes

- The `jdapi.js` library uses AMD/RequireJS and HMAC-SHA256 + AES encryption for API communication
- All contexts use APP_KEY `"myjd_webextension_chrome"` -- changing this breaks session token compatibility
- The toolbar sends links directly via its local `myjdDeviceClientFactory` (no background/offscreen relay)
- `ng-if` (not `ng-show`) is used for the connected panel to prevent premature controller instantiation

## Testing

### Rust Tests (Native Helper)

```powershell
cd captcha-helper

# Run all tests
cargo test

# Run unit tests only
cargo test --lib

# Run integration tests only
cargo test --test integration_test

# Run with output
cargo test -- --nocapture
```

**Test coverage:** 60 tests total
- Unit tests: 46 (validation, escaping, HTML generation, request handling)
- Integration tests: 14 (HTTP mocking, action routing)

### JavaScript Tests (Extension)

```powershell
# From project root
npm test

# With coverage
npm run test:coverage
```

**Test coverage:** 26 tests total
- Response handling, message format validation
- URL validation, skip type validation, site key validation

### Run All Tests

```powershell
.\captcha-helper\run-tests.ps1
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Validation | 14 | URL localhost restriction, site key format, skip type whitelist |
| XSS Prevention | 10 | HTML escaping, JavaScript escaping |
| HTML Generation | 11 | Correct script URLs, CSP headers, test mode |
| Request Handling | 9 | Action routing, error responses, serialization |
| HTTP Client | 5 | Mock server, timeouts, size limits, headers |
| Integration | 14 | Full request flows with mock JDownloader |
| JavaScript | 26 | Service logic, message format, validation |

## Disclaimer

This is a community-maintained conversion of the original MyJDownloader extension. I offer no warranty and do not have plans for active maintenance. The JDownloader developers are welcome to adopt this codebase. I will respond to issues when possible but cannot guarantee ongoing support.

## Original Extension

This is a Manifest V3 conversion of the [MyJDownloader Browser Extension](https://my.jdownloader.org) by AppWork GmbH. The original MV2 source served as the reference implementation for this conversion.

## License

This project is a conversion of the MyJDownloader Browser Extension. All rights to the original extension belong to AppWork GmbH.
