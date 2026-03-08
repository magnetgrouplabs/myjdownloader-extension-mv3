# MyJDownloader Browser Extension (Manifest V3)

A Chrome Extension that integrates with [JDownloader](https://jdownloader.org/) through the [MyJDownloader](https://my.jdownloader.org/) cloud API. Right-click any link to send it to JDownloader, intercept Click'N'Load requests, and solve CAPTCHAs directly in your browser.

This is a Manifest V3 conversion of the original MV2 MyJDownloader extension, fully compliant with Chrome Web Store requirements.

---

## Features

- **Right-click to download** — Context menu "Download with JDownloader" on any link
- **Multi-link stacking** — Right-click multiple links to queue them, then send all at once
- **In-page toolbar** — Preview and manage queued links before sending
- **Click'N'Load (CNL)** — Automatic interception of CNL-enabled sites
- **CAPTCHA solving** — Solves reCAPTCHA v2/v3 and hCaptcha in browser tabs when JDownloader needs help
- **Session persistence** — Stays logged in across browser restarts
- **Device selection** — Choose which JDownloader instance receives your downloads

## How It Works

The extension connects to JDownloader through the MyJDownloader cloud API. JDownloader can run anywhere — your NAS, a server, or your local machine. As long as it's connected to MyJDownloader, the extension can send links and solve CAPTCHAs for it.

## CAPTCHA Solving

> **Testing status:** CAPTCHA solving has been verified through code path analysis (67/67 checks passing) and 199 unit tests, but has **not been tested end-to-end with a live JDownloader instance** — JDownloader's built-in solvers handle most CAPTCHAs automatically, making it difficult to trigger the browser extension flow. If you encounter a CAPTCHA that routes to the extension, please [report your experience](../../issues/new?template=captcha-bug-report.yml) whether it works or not. Community testing is how we validate this feature.

### How It Should Work

When JDownloader encounters a CAPTCHA it can't solve automatically, the extension opens a browser tab with the CAPTCHA widget. You solve it, and the token is sent back to JDownloader through MyJDownloader.

### Supported CAPTCHA Types

| Type | Support |
|------|---------|
| reCAPTCHA v2 | Full (checkbox) |
| reCAPTCHA v3 | Full (invisible, MAIN world execution) |
| reCAPTCHA Enterprise | Full |
| hCaptcha | Full |

### CAPTCHA Flow

1. JDownloader encounters a CAPTCHA on a file hoster
2. The extension detects the pending CAPTCHA job via MyJDownloader API
3. A browser tab opens on the target domain with the CAPTCHA widget
4. You solve the CAPTCHA
5. The token is sent back to JDownloader, which continues the download
6. The tab auto-closes after ~2 seconds

### CAPTCHA Tab Features

- **Skip buttons** — Skip this CAPTCHA, skip the hoster, skip the package, or skip all
- **Tab close = skip** — Closing the tab sends a skip signal to JDownloader

### JDownloader CAPTCHA Settings

For the extension to handle CAPTCHAs, JDownloader must be configured to use the browser solver:

1. In JDownloader, go to **Settings > CAPTCHA**
2. Enable **Browser Solver** (or **My.JDownloader Remote Solver**)
3. Disable other automatic solvers (9kw, Anti-Captcha, etc.) if you want all CAPTCHAs routed to your browser

If automatic solvers are enabled, JDownloader will try those first and only fall back to the browser extension when they fail.

## Installation

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select this directory
5. Log in to your MyJDownloader account via the extension popup

## Reporting Issues

### CAPTCHA Issues

CAPTCHA solving depends on the specific file hoster, CAPTCHA provider, and JDownloader's configuration. If you encounter a CAPTCHA that doesn't work:

1. **Use the issue template** — Click [New Issue](../../issues/new?template=captcha-bug-report.yml) and select "CAPTCHA Bug Report"
2. **Include the file hoster name** and the type of CAPTCHA (reCAPTCHA, hCaptcha, etc.)
3. **Check the service worker console** — Go to `chrome://extensions`, find MyJDownloader, click "Inspect views: service worker", and include any errors from the Console tab
4. **Describe what happened** — Did the tab open? Did the widget render? Did the token submit?
5. **Include your JDownloader CAPTCHA settings** — Which solvers are enabled/disabled

### General Issues

For non-CAPTCHA bugs, please include:
- Steps to reproduce
- Browser and extension version
- JDownloader version and connection status
- Screenshots if applicable

## MV2 to MV3 Migration

This extension was converted from Manifest V2 to Manifest V3. Here is a summary of what changed:

| MV2 Approach | MV3 Replacement | Why |
|-------------|-----------------|-----|
| Background page (persistent) | Service worker (event-driven) | MV3 requires non-persistent background contexts |
| `chrome.tabs.executeScript()` | `chrome.scripting.executeScript()` | New API with explicit world targeting (MAIN/ISOLATED) |
| Inline script injection for CAPTCHAs | External script elements + content scripts | MV3 CSP prohibits inline script execution |
| `chrome.browserAction` | `chrome.action` | API renamed in MV3 |
| `localStorage` in background page | `chrome.storage.session` + offscreen document | Service workers have no DOM or localStorage access |
| Unrestricted CSP | Default `script-src 'self'` + `ng-csp` | MV3 enforces strict Content Security Policy |

## License

This project is based on the original MyJDownloader browser extension by AppWork GmbH.
