# MyJDownloader Browser Extension (Manifest V3)

A Chrome Extension that integrates with [JDownloader](https://jdownloader.org/) through the [MyJDownloader](https://my.jdownloader.org/) cloud API. Right-click any link to send it to JDownloader and intercept Click'N'Load requests. CAPTCHA solving in the browser is in progress (see [issue #24](../../issues/24)).

This is a Manifest V3 conversion of the original MV2 MyJDownloader extension.

---

## Features

- **Right-click to download**: Context menu "Download with JDownloader" on any link
- **Multi-link stacking**: Right-click multiple links to queue them, then send all at once
- **In-page toolbar**: Preview and manage queued links before sending
- **Click'N'Load (CNL)**: Intercepts CNL requests and routes them through the in-page toolbar to your selected JDownloader device
- **CAPTCHA solving (in progress)**: Solving reCAPTCHA v2/v3 and hCaptcha in browser tabs when JDownloader needs help is not finished yet. See [issue #24](../../issues/24) for status.
- **Session persistence**: Stays logged in across browser restarts
- **Device selection**: Choose which JDownloader instance receives your downloads
- **Update notifications**: Checks once a day for a new release and flags it with a badge and a banner in Settings. There is also a manual "Check for updates" under Settings > About. This extension is installed unpacked, so Chrome never auto-updates it; you still install new versions yourself from the releases page.

## How It Works

The extension connects to JDownloader through the MyJDownloader cloud API. JDownloader can run anywhere: your NAS, a server, or your local machine. As long as it's connected to MyJDownloader, the extension can send links to it. CAPTCHA solving for it is still in progress (see [issue #24](../../issues/24)).

## CAPTCHA Solving

> **Status: in progress.** CAPTCHA solving has never been verified end to end by the maintainers of this fork. One contributor reported a full hCaptcha solve reaching JDownloader (Vivaldi, macOS) using PR #19 plus the #23 change.
>
> JDownloader's browser-solver pages for reCAPTCHA and hCaptcha (the tab JDownloader opens on `http://127.0.0.1`) carry no widget. They expect the extension to read the challenge from the page and open the hoster's site, where the widget can render. The MV2 extension did that; the MV3 port does not yet. This is not browser-specific.
>
> - Released in v2026.10.1: #23, which loads the captcha provider's script in the page's main world (before this the widget never rendered).
> - Pending: #19, the hand-off from JDownloader's page to the hoster's page (fix for #5, #22, #25).
> - Under review: #26, solving captchas from the my.jdownloader.org web interface (a separate path).
>
> Status and how to help: [issue #24](../../issues/24). If you hit a CAPTCHA that routes to the extension, please [report your experience](../../issues/new?template=captcha-bug-report.yml) whether it works or not.

### How It Should Work

When JDownloader encounters a CAPTCHA it can't solve automatically, the extension opens a browser tab with the CAPTCHA widget. You solve it, and the token is sent back to JDownloader. This is the intended behavior and is still in progress (see [issue #24](../../issues/24)).

### Supported CAPTCHA Types

| Type | Status |
|------|--------|
| reCAPTCHA v2 | In progress (see [#24](../../issues/24)) |
| reCAPTCHA v3 | In progress (see [#24](../../issues/24)) |
| reCAPTCHA Enterprise | In progress (see [#24](../../issues/24)) |
| hCaptcha | In progress (see [#24](../../issues/24)) |

### CAPTCHA Flow (intended)

1. JDownloader opens its browser-solver tab on `http://127.0.0.1`
2. The extension reads the challenge from that page and hands it to the hoster's page, where the widget can render (this hand-off is the part pending in #19)
3. You solve the CAPTCHA
4. The token is sent back to JDownloader, which continues the download
5. The tab auto-closes after ~2 seconds

### CAPTCHA Tab Features

- **Skip buttons**: Skip this CAPTCHA, skip the hoster, skip the package, or skip all
- **Tab close = skip**: Closing the tab sends a skip signal to JDownloader

### JDownloader CAPTCHA Settings

For the extension to handle CAPTCHAs, JDownloader must be configured to use the browser solver:

1. In JDownloader, go to **Settings > CAPTCHA**
2. Enable **Browser Solver** (or **My.JDownloader Remote Solver**)
3. Disable other automatic solvers (9kw, Anti-Captcha, etc.) if you want all CAPTCHAs routed to your browser

If automatic solvers are enabled, JDownloader will try those first and only fall back to the browser extension when they fail.

## Installation

**From a release (recommended):**

1. Download the latest `myjdownloader-extension-mv3-*.zip` from the [Releases page](../../releases/latest)
2. Extract the zip file
3. Open `chrome://extensions/` in Chrome and enable **Developer mode**
4. Click **Load unpacked** and select the extracted folder
5. Log in to your MyJDownloader account via the extension popup

**From source:**

1. Clone this repository
2. Open `chrome://extensions/` in Chrome and enable **Developer mode**
3. Click **Load unpacked** and select the repository directory
4. Log in to your MyJDownloader account via the extension popup

## Reporting Issues

All reports must go through an issue template, and blank issues are disabled. Every bug report, CAPTCHA or otherwise, **requires**:

- Steps to reproduce
- Browser and extension version
- JDownloader version and connection status
- Screenshots if applicable

Issues missing this information cannot be investigated and will be closed with a request to resubmit.

### CAPTCHA Issues

CAPTCHA solving depends on the specific file hoster, CAPTCHA provider, and JDownloader's configuration. Use the [CAPTCHA Bug Report](../../issues/new?template=captcha-bug-report.yml) template, which additionally asks for:

- **The file hoster name** and the type of CAPTCHA (reCAPTCHA, hCaptcha, etc.)
- **What happened**: Did the tab open? Did the widget render? Did the token submit?
- **Service worker console errors**: Go to `chrome://extensions`, find MyJDownloader, click "Inspect views: service worker", and copy any errors from the Console tab
- **Your JDownloader CAPTCHA settings**: Which solvers are enabled/disabled

### General Issues

For everything else, use the [Bug Report](../../issues/new?template=bug-report.yml) template.

## MV2 to MV3 Migration

This extension was converted from Manifest V2 to Manifest V3. Here is a summary of what changed:

| MV2 Approach | MV3 Replacement | Why |
|-------------|-----------------|-----|
| Background page (persistent) | Service worker (event-driven) | MV3 requires non-persistent background contexts |
| `chrome.tabs.executeScript()` | `chrome.scripting.executeScript()` | New API with explicit world targeting (MAIN/ISOLATED) |
| Inline script injection for CAPTCHAs | `chrome.scripting.executeScript({world:'MAIN'})` loads the provider's API script | Content scripts run in an isolated world with its own CSP that blocks a remote `<script src>` appended from there, independently of the page's own CSP |
| `chrome.browserAction` | `chrome.action` | API renamed in MV3 |
| `localStorage` in background page | `chrome.storage.session` + offscreen document | Service workers have no DOM or localStorage access |
| CNL interception from the isolated content script | MAIN-world content script (`world: "MAIN"`) + `webRequest` fallback | Isolated-world scripts can't override the page's `fetch`/`XMLHttpRequest` |
| Unrestricted CSP | Default `script-src 'self'` + `ng-csp` | MV3 enforces strict Content Security Policy |

## Contributing

Pull requests are welcome and target the `dev` branch, which is the integration branch for
changes being tested. `master` always matches the latest published release. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full guidelines.

## License

This project is based on the original MyJDownloader browser extension by AppWork GmbH.
