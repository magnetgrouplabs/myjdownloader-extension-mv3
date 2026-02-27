# Security Policy

## Security Overview

MyJDownloader MV3 is a Chrome Extension (Manifest V3) that integrates with JDownloader download manager. It provides context menu integration, Click'N'Load interception, and CAPTCHA solving through a native messaging host.

**Key Security Characteristics:**
- Manifest V3 compliant (service worker architecture)
- No remote code execution
- Native messaging for CAPTCHA isolation
- Session data stored in `chrome.storage.local`

---

## Architecture

### Components

| Component | Role | Privileges |
|-----------|------|------------|
| **Service Worker** (`background.js`) | Extension background logic, message routing, context menus | Full extension API access |
| **Popup** (`popup.html`) | Login flow, device management, settings | Limited to popup context |
| **Toolbar** (`toolbar.html`) | In-page add-links interface | Embedded in web pages via iframe |
| **Offscreen Document** (`offscreen.js`) | DOM access for MyJDownloader API operations | Isolated document context |
| **Content Scripts** | Page integration (CNL, toolbar, selection) | Run in web page contexts |
| **Native Messaging Host** | CAPTCHA solving in separate WebView2 window | Native executable, runs outside browser sandbox |

### Communication Flow

```
Web Page → Content Script → Service Worker → Offscreen → MyJDownloader API
                                    ↓
                          Native Messaging Host (CAPTCHA)
```

---

## Permissions Justification

### Extension Permissions

| Permission | Justification |
|------------|---------------|
| `tabs` | Context menu injection, toolbar iframe injection, tab removal after CAPTCHA |
| `storage` | Session persistence (`myjd_session`), user settings |
| `declarativeNetRequest` | Allow Click'NLoad requests to localhost:9666 to bypass CORS |
| `contextMenus` | Right-click "Download with JDownloader" menu items |
| `scripting` | Dynamic content script injection for toolbar |
| `alarms` | Service worker keepalive (4-minute periodic wake) |
| `offscreen` | DOM access for MyJDownloader API (localStorage for session) |
| `nativeMessaging` | Communication with CAPTCHA native helper |

### Host Permissions

| Pattern | Justification |
|---------|---------------|
| `<all_urls>` | Context menu must work on all pages; toolbar injection; content scripts for CNL interception |
| `http://127.0.0.1:9666/*` | JDownloader localhost API (Click'N'Load) |
| `http://localhost:9666/*` | JDownloader localhost API (Click'N'Load) |

### Permission Scope Analysis

- **No `history`** - Extension does not access browsing history
- **No `bookmarks`** - Extension does not access bookmarks
- **No `cookies`** - Extension does not access cookies directly
- **No `webNavigation`** - Extension uses tabs API instead
- **No `downloads`** - Downloads handled by JDownloader, not extension

---

## MV3 Compliance

### Service Worker Architecture
- Background scripts replaced with single service worker (`background.js`)
- No persistent background page
- Uses `chrome.alarms` for keepalive (MV3 lifecycle requirement)

### Content Security Policy

**Violation-Free:**
- All scripts loaded from extension package (no inline scripts)
- `ng-csp` directive enabled in `popup.html` and `toolbar.html` to disable Angular's use of `eval`/`new Function`
- No `eval()` or `new Function()` in custom code (`scripts/`, `contentscripts/`)

**Removed CSP-Violating Files:**
- `contentscripts/rc2Contentscript.js` - Used inline script injection (XSS vulnerability)
- `contentscripts/browserSolverEnhancer.js` - Used `innerHTML` with user content (XSS vulnerability)
- `contentscripts/rc2LoadingIndicator.js` - Dependent on removed CAPTCHA content scripts
- `res/browser_solver_template.html` - Template for removed CAPTCHA solver

### CSP Declaration

The extension relies on Chrome's default CSP for MV3:
```
default-src 'self'; script-src 'self'; object-src 'self'
```

---

## Security Improvements in MV3 Migration

### Critical Fixes

1. **Removed `rc2Contentscript.js` (Critical XSS)**
   - Original code injected `<script>` tags directly into DOM
   - Attack vector: Malicious URLs could execute arbitrary code
   - Fix: Replaced with native messaging CAPTCHA helper

2. **Removed `browserSolverEnhancer.js` (XSS via innerHTML)**
   - Original code used `innerHTML` with unescaped user content
   - Fix: CAPTCHA solving moved to isolated native helper

3. **Replaced `webRequest` Blocking**
   - MV2 used `webRequest` for request interception
   - MV3 uses `declarativeNetRequest` (declarative, no request body access)
   - Reduced attack surface - extension cannot read/modify request bodies

4. **Separated Host Permissions**
   - MV2: Permissions and hosts mixed
   - MV3: `permissions` and `host_permissions` are separate
   - Chrome can prompt users for host access independently

### Architectural Improvements

1. **CAPTCHA Isolation**
   - CAPTCHA widgets render in native WebView2 window
   - Complete isolation from extension context
   - Reduced attack surface for malicious CAPTCHA providers

2. **Service Worker Lifecycle**
   - Non-persistent background reduces attack window
   - 4-minute keepalive alarm for essential functions only

3. **Message Validation**
   - `background.js:289`: Rejects messages from other extensions
   ```javascript
   if (sender.id !== chrome.runtime.id) return false;
   ```

---

## Pre-existing Security Issues (Inherited from MV2)

These issues existed in the original Chrome Web Store release and are preserved for compatibility:

### 1. PostMessage Wildcard Origin (`webinterfaceEnhancer.js:54`)

```javascript
window.postMessage(msg, "*");
```

**Risk:** Messages can be intercepted by any frame on the page.

**Why it exists:** Required for cross-origin communication with `my.jdownloader.org` web interface. The web interface runs on a different origin and needs to receive extension messages.

**Mitigation:** Message content is not sensitive (CAPTCHA responses, status updates).

### 2. HTTP Callbacks Without TLS

```javascript
httpRequest.open("GET", callbackUrl + "&do=solve&response=" + token, true);
```

**Risk:** CAPTCHA tokens transmitted over unencrypted HTTP to localhost.

**Why it exists:** JDownloader's local API runs on `http://127.0.0.1:9666` without TLS.

**Mitigation:** Localhost traffic never leaves the machine; token validity is short-lived.

### 3. Token Not URL-Encoded

```javascript
httpRequest.open("GET", callbackUrl + "&do=solve&response=" + token, true);
```

**Risk:** Special characters in CAPTCHA tokens could break URL parsing.

**Why it exists:** Original MV2 implementation; tokens are base64-like strings without special characters in practice.

**Status:** Low risk - tokens are alphanumeric in observed cases.

### 4. Broad Host Permission (`<all_urls>`)

**Risk:** Extension can inject content scripts into any page.

**Why it exists:** Required for:
- Context menu on all pages
- Toolbar injection on any page
- Click'N'Load interception on any page

**Mitigation:** Content scripts run in isolated worlds; cannot access page JavaScript directly.

### 5. `eval()` in Third-Party Libraries

**`vendor/js/require.js:2140`:**
```javascript
return eval(text);
```

**`vendor/js/angular.js:1292`:**
```javascript
new Function('');
```
**`vendor/js/angular.js:16548`:**
```javascript
var fn = (new Function('$filter', ...
```

**Risk:** CSP violation if CSP enforcement strict.

**Mitigation:**
- `ng-csp` directive disables Angular's use of `eval`/`new Function` for templates
- RequireJS eval used for module loading from extension package (not remote)
- These are third-party libraries; no custom code uses `eval()` or `new Function()`

---

## Native Messaging Host Security

The CAPTCHA native helper (`myjd-captcha-helper`) runs as a separate executable:

### Security Properties

1. **Manifest Restriction**
   - Native messaging manifest specifies allowed extension ID
   - Only this extension can communicate with the helper

2. **No Network Access**
   - Helper only receives messages from extension
   - CAPTCHA widget loaded in WebView2 from CAPTCHA provider

3. **User Interaction Required**
   - WebView2 window requires user to solve CAPTCHA
   - No automated CAPTCHA solving

4. **Timeout Protection**
   - 5-minute maximum window open
   - Window close = skip CAPTCHA

### Message Protocol

See `CLAUDE.md` for full protocol specification.

---

## Data Handling

### Stored Data

| Data | Storage | Encryption |
|------|---------|------------|
| Session token | `chrome.storage.local` | No (JDownloader API token) |
| Device list | Memory only | N/A |
| CAPTCHA tokens | Transient | N/A |
| User settings | `chrome.storage.local` | No |

### Data Transmission

| Endpoint | Protocol | Data |
|----------|----------|------|
| `api.jdownloader.org` | HTTPS | Login, device queries |
| `my.jdownloader.org` | HTTPS | Web interface sync |
| `127.0.0.1:9666` | HTTP | Click'N'Load, CAPTCHA callbacks |
| Native helper | Native Messaging | CAPTCHA requests/responses |

### No External Data Collection
- Extension does not send telemetry or analytics
- No third-party tracking
- No advertising SDKs

---

## Reporting Vulnerabilities

### Contact

- **Email:** security@jdownloader.org
- **GitHub:** Use [Security Advisories](https://github.com/nicknisi/jdownloader-extension-manifestv3/security/advisories/new)

### Response Timeline

| Stage | Target |
|-------|--------|
| Initial response | 48 hours |
| Triage | 7 days |
| Fix for valid issues | 30 days |

### Scope

**In Scope:**
- Extension code (`scripts/`, `contentscripts/`, `background.js`, `offscreen.js`)
- Native messaging host (`captcha-helper/`)
- Manifest configuration

**Out of Scope:**
- Third-party libraries in `vendor/` (report upstream)
- JDownloader core application
- MyJDownloader web service (`my.jdownloader.org`)

---

## Version History

| Version | Date | Security Changes |
|---------|------|------------------|
| 2026.02.24 | 2026-02-24 | MV3 release with native CAPTCHA, removed CSP-violating files |
| (MV2) | Prior | Original Chrome Web Store release |

---

## Security Checklist for Contributors

- [ ] No inline scripts in HTML files
- [ ] No `eval()` or `new Function()` in custom code
- [ ] `ng-csp` attribute present in Angular templates
- [ ] Message sender validation in `background.js`
- [ ] No secrets in code or configuration
- [ ] Native messaging manifest has correct extension ID
- [ ] Content scripts use `chrome.runtime.getURL()` for resources
- [ ] HTTP-only requests limited to localhost