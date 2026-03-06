# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
myjdownloader-extension-mv3/
├── background.js                  # Service worker (central orchestrator)
├── popup.html                     # Main popup UI template
├── popup.js                       # Popup RequireJS loader
├── toolbar.html                   # In-page toolbar template
├── offscreen.html                 # Offscreen document for DOM access
├── offscreen.js                   # Offscreen RequireJS loader and message handler
├── options.html                   # Settings page (legacy)
├── autograbber-indicator.html     # Auto-grab indicator overlay
├── manifest.json                  # MV3 manifest
├── package.json                   # JavaScript dev dependencies
├── jest.config.js                 # Jest test configuration
├── jest.setup.js                  # Jest setup file
├── .gitignore                     # Git exclusions
├── LICENSE                        # GPL-3.0
├── README.md                      # Project README
│
├── scripts/                       # AngularJS application
│   ├── app.js                     # Main Angular module definition
│   ├── popup-app.js               # Popup-specific Angular setup
│   ├── popup.js                   # Popup RequireJS + bootstrap
│   ├── toolbar.js                 # Toolbar RequireJS + bootstrap
│   ├── toolbarApi.js              # Toolbar API helper
│   │
│   ├── controllers/               # AngularJS controllers
│   │   ├── PopupController.js
│   │   ├── ToolbarController.js
│   │   ├── ConnectedController.js
│   │   ├── AddLinksController.js
│   │   ├── DeviceController.js
│   │   ├── SettingsController.js
│   │   ├── BackgroundController.js
│   │   ├── ClipboardHistoryController.js
│   │   └── ReallyLogoutController.js
│   │
│   ├── services/                  # AngularJS services (core business logic)
│   │   ├── MyjdService.js         # JDownloader API wrapper + session management
│   │   ├── Rc2Service.js          # CAPTCHA routing service
│   │   ├── CaptchaNativeService.js # Native messaging wrapper
│   │   ├── ExtensionMessagingService.js # Message routing
│   │   ├── BrowserService.js      # Browser-specific utilities
│   │   ├── StorageService.js      # chrome.storage wrapper
│   │   ├── ApiErrorService.js     # Error wrapping
│   │   ├── CnlService.js          # Click'N'Load handling
│   │   ├── MyjdDeviceService.js   # Device operations
│   │   ├── RequestQueueEventService.js # Toolbar link queue
│   │   ├── PopupCandidatesService.js # Tab management
│   │   ├── ClipboardHistoryService.js # Clipboard tracking
│   │   ├── ExtensionI18nService.js # Internationalization
│   │   ├── FilterService.js       # Link filtering
│   │   ├── PopupIconService.js    # Icon management
│   │   ├── StringUtilsService.js  # String utilities
│   │   └── __tests__/             # Jest unit tests
│   │       └── CaptchaNativeService.test.js
│   │
│   ├── factories/                 # AngularJS factories (singletons)
│   │   ├── myjdClientFactory.js   # Global API instance
│   │   └── myjdDeviceClientFactory.js # Per-device API clients
│   │
│   ├── directives/                # AngularJS custom directives
│   │   ├── myConnectedPanel.js    # Connected state panel
│   │   ├── myAddLinksPanel.js     # Add links dialog
│   │   ├── myDevice.js            # Device selector
│   │   ├── mySettings.js          # Settings panel
│   │   ├── myReallyLogoutPanel.js # Logout confirmation
│   │   ├── myClipboardHistory.js  # Clipboard history
│   │   └── imgErrorHide.js        # Image error handling
│   │
│   ├── filters/                   # AngularJS filters
│   │   └── translationFilter.js   # i18n filter
│   │
│   └── partials/                  # AngularJS templates
│       └── controllers/
│           ├── popup.html
│           ├── toolbar.html
│           ├── connected.html
│           ├── addLinks.html
│           ├── settings.html
│           ├── clipboardHistory.html
│           └── reallyLogout.html
│
├── contentscripts/                # Content scripts injected into web pages
│   ├── cnlInterceptor.js          # Intercepts fetch/XHR for CNL requests
│   ├── toolbarContentscript.js    # Injects toolbar iframe, manages link queue
│   ├── onCopyContentscript.js     # Clipboard copy listener
│   ├── selectionContentscript.js  # Text selection handler
│   └── webinterfaceEnhancer.js    # my.jdownloader.org page integration
│
├── vendor/                        # Third-party libraries
│   ├── js/                        # JavaScript libs
│   │   ├── jdapi.js               # JDownloader API (requires.js bundles many modules)
│   │   ├── jquery.js              # jQuery (required by jdapi)
│   │   ├── require.js             # RequireJS loader
│   │   ├── angular.js             # AngularJS framework
│   │   ├── angular-*.js           # AngularJS modules (animate, cookies, etc.)
│   │   └── rxjs.min.js            # RxJS observables
│   │
│   └── css/                       # Stylesheets
│       └── bootstrap.css          # Bootstrap styling
│
├── images/                        # Extension icons
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
├── captcha-helper/                # Native messaging host (Rust binary)
│   ├── src/
│   │   ├── main.rs                # Binary entry point (message loop)
│   │   ├── lib.rs                 # Module exports
│   │   ├── native.rs              # stdin/stdout protocol (length-prefixed JSON)
│   │   ├── captcha.rs             # Request/Response types, handle_request routing
│   │   ├── validation.rs          # Input validation (site key, URL, skip type)
│   │   ├── escape.rs              # XSS prevention (HTML/JS escaping)
│   │   ├── html.rs                # CAPTCHA HTML generation (reCAPTCHA/hCaptcha)
│   │   ├── http.rs                # HTTP client for JDownloader callbacks
│   │   └── webview.rs             # WebView2 window management (Windows only)
│   │
│   ├── tests/
│   │   └── integration_test.rs    # Integration tests with mock server
│   │
│   ├── Cargo.toml                 # Rust dependencies
│   ├── Cargo.lock                 # Dependency lockfile
│   ├── myjd-native-host.json      # Native messaging manifest (registry pointer)
│   └── target/                    # Build artifacts (not committed)
│
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Codebase analysis (this directory)
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
└── .github/
    └── workflows/                 # CI/CD (if applicable)
```


## Directory Purposes

**Root Level:**
- Purpose: Entry points and configuration
- Contains: manifest.json, background.js, popup.html, offscreen.html, *.js bootstrap files
- Key files: `manifest.json` (MV3 declaration), `background.js` (service worker), `package.json` (dev deps)

**scripts/:**
- Purpose: AngularJS application code (controllers, services, directives, factories)
- Contains: All business logic for popup and toolbar UIs
- Architecture: Standard AngularJS module pattern with services as singletons
- Note: Separate app.js for main module, popup-app.js for popup-specific setup

**scripts/services/:**
- Purpose: Core services wrapping APIs, messaging, and storage
- Key services:
  - `MyjdService.js`: Wraps jdapi, manages session and API state
  - `Rc2Service.js`: Routes CAPTCHA requests to native helper
  - `CaptchaNativeService.js`: chrome.runtime.sendNativeMessage wrapper
  - `ExtensionMessagingService.js`: Inter-service message routing
- Pattern: Each service is an AngularJS singleton accessed via dependency injection

**scripts/controllers/:**
- Purpose: AngularJS controllers for UI state and actions
- Key controllers:
  - `PopupController.js`: Login, device selection, main popup flow
  - `ToolbarController.js`: Link preview, add-links dialog
  - `ConnectedController.js`: Display when logged in
  - `AddLinksController.js`: Dialog for adding links with options

**scripts/directives/ and partials/:**
- Purpose: Reusable UI components (directives) and templates
- Pattern: Directive + template (.html) pairs
- Key directives: myConnectedPanel, myAddLinksPanel, myDevice, mySettings

**contentscripts/:**
- Purpose: Scripts injected into all web pages to intercept actions
- Key scripts:
  - `cnlInterceptor.js`: Capture fetch/XHR to localhost:9666 (Click'N'Load)
  - `toolbarContentscript.js`: Inject toolbar iframe, forward user actions
  - `onCopyContentscript.js`: Capture clipboard copy events
  - `selectionContentscript.js`: Capture text selection
- Note: No inline scripts allowed in MV3 - all logic must be in separate files

**vendor/js/:**
- Purpose: Third-party libraries loaded via RequireJS
- Key files:
  - `jdapi.js`: JDownloader API implementation (main dependency)
  - `jquery.js`: jQuery (required by jdapi)
  - `require.js`: RequireJS module loader
  - `angular.js`: AngularJS framework

**captcha-helper/ (Rust):**
- Purpose: Native messaging host for CAPTCHA solving
- Architecture: Rust binary that communicates with Chrome extension via stdin/stdout
- Key modules:
  - `main.rs`: Entry point, message loop
  - `captcha.rs`: Request routing and response handling
  - `validation.rs`: Input sanitization
  - `html.rs`: CAPTCHA widget HTML generation
  - `webview.rs`: Windows WebView2 integration


## Key File Locations

**Entry Points:**
- `background.js`: Service worker - handles all messaging and coordination
- `popup.html` + `scripts/popup.js`: Popup UI entry
- `toolbar.html` + `scripts/toolbar.js`: Toolbar UI entry
- `offscreen.html` + `offscreen.js`: Offscreen document for API operations
- `captcha-helper/src/main.rs`: Native helper entry point

**Configuration:**
- `manifest.json`: MV3 manifest (permissions, service worker, content scripts)
- `captcha-helper/myjd-native-host.json`: Native messaging host manifest
- `package.json`: JavaScript dev dependencies (Jest, AngularJS, etc.)
- `Cargo.toml`: Rust dependencies

**Core Logic:**
- `scripts/services/MyjdService.js`: API session management
- `scripts/services/Rc2Service.js`: CAPTCHA job routing
- `scripts/services/CaptchaNativeService.js`: Native messaging interface
- `scripts/services/ExtensionMessagingService.js`: Service-to-service messaging
- `contentscripts/cnlInterceptor.js`: CNL network interception

**Testing:**
- `scripts/services/__tests__/CaptchaNativeService.test.js`: Jest unit test
- `captcha-helper/tests/integration_test.rs`: Rust integration tests
- `jest.config.js`: Jest configuration
- `jest.setup.js`: Jest setup (mock chrome API)


## Naming Conventions

**Files:**
- Controllers: `*Controller.js` (e.g., PopupController.js, ToolbarController.js)
- Services: Descriptive name ending in Service (e.g., MyjdService.js, Rc2Service.js)
- Directives: `my*.js` prefix (e.g., myConnectedPanel.js, myAddLinksPanel.js)
- Content scripts: Descriptive with Contentscript suffix (e.g., toolbarContentscript.js)
- Rust modules: snake_case (e.g., validation.rs, html.rs)
- Tests: `*.test.js` (Jest) or `*_test.rs` (Rust)

**Directories:**
- AngularJS components: lowercase, plural (controllers/, services/, directives/, filters/)
- Rust modules: lowercase in src/ directory
- Templates: plural (partials/)
- Tests: __tests__/ (JavaScript) or tests/ (Rust)

**AngularJS Services/Factories:**
- Services: CamelCase (MyjdService, Rc2Service, CaptchaNativeService)
- Factories: camelCase with descriptive names (myjdClientFactory, myjdDeviceClientFactory)

**Functions/Variables:**
- JavaScript: camelCase (sendMessage, handleRequest, onLoginNeeded)
- Rust: snake_case (read_message, write_message, validate_site_key)

**Constants:**
- JavaScript: UPPER_SNAKE_CASE (STORAGE_KEYS, DEVICE_TYPES, NATIVE_HOST_NAME)
- Rust: UPPER_SNAKE_CASE (VERSION)


## Where to Add New Code

**New Feature (e.g., new link source):**
- Primary code: Create service in `scripts/services/` (e.g., NewSourceService.js)
- Content script: Add to `contentscripts/` if web page integration needed
- Controller: Add controller in `scripts/controllers/` if UI needed
- Directive: Add directive in `scripts/directives/` with template in `scripts/partials/`
- Tests: Add `.test.js` file in `scripts/services/__tests__/`

**New Component/Module (e.g., device selector):**
- Implementation: `scripts/directives/my[FeatureName].js`
- Template: `scripts/partials/components/[featureName].html`
- Controller: Inline in directive or separate in `scripts/controllers/`
- Service: If shared logic, create in `scripts/services/`

**Utilities (e.g., formatting helpers):**
- Shared helpers: `scripts/services/` (create new Service)
- Filters: `scripts/filters/` (AngularJS filters)
- String utils: Add to or create `scripts/services/StringUtilsService.js`

**New Native Helper Feature (Rust):**
- New validation: Add function to `captcha-helper/src/validation.rs`
- New HTML generation: Add to `captcha-helper/src/html.rs`
- New request action: Add case to `handle_request()` in `captcha-helper/src/captcha.rs`
- Tests: Add test module in `captcha-helper/tests/integration_test.rs`

**Background Script Features:**
- Message handlers: Add case to chrome.runtime.onMessage listener in `background.js`
- State management: Add to `state` or `settings` objects at top of `background.js`
- New listeners: chrome.tabs.onRemoved, chrome.storage.onChanged, etc.


## Special Directories

**vendor/js/ (JavaScript Libraries):**
- Purpose: Third-party JS loaded via RequireJS
- Generated: No, manually maintained
- Committed: Yes, jdapi.js and deps bundled for offline use
- Note: RequireJS handles module resolution; baseUrl set to vendor/js in popup.js and offscreen.js

**captcha-helper/target/ (Rust Build Output):**
- Purpose: Cargo build artifacts
- Generated: Yes, by cargo build --release
- Committed: No, in .gitignore
- Location: Binary output goes to target/release/myjd-captcha-helper.exe (Windows)

**.planning/codebase/ (GSD Documentation):**
- Purpose: Codebase analysis for future planning and execution phases
- Generated: By gsd-codebase-mapper agent
- Committed: Yes, part of project git history
- Note: Consumed by gsd-planner and gsd-executor for reference

**scripts/__tests__/ (Jest Test Files):**
- Purpose: Unit tests for JavaScript services
- Generated: No, manually written
- Committed: Yes
- Note: Uses jest-chrome mock for Chrome APIs, jest-angular mock for AngularJS


---

*Structure analysis: 2026-03-06*
