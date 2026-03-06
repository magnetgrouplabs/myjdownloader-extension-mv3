# Technology Stack

**Project:** MyJDownloader MV3 Extension - Bug Fixes & Enhancements
**Researched:** 2026-03-06

## Recommended Stack

This is a brownfield project. The stack is already established (AngularJS 1.8.3, Rust native helper, Chrome MV3 APIs). These recommendations cover **additions and adjustments** needed for the milestone work: multi-link stacking, directory history, CAPTCHA E2E testing, and Web Store submission.

### Core (No Changes Needed)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Chrome MV3 APIs | Chrome 88+ | Extension runtime | Keep as-is |
| AngularJS | 1.8.3 | Popup/toolbar UI | Keep as-is (out of scope to migrate) |
| Rust (2021 edition) | 1.70+ | Native CAPTCHA helper | Keep as-is |
| wry | 0.40 | WebView2 wrapper | Keep as-is |
| RequireJS | existing | Module loading | Keep as-is (out of scope to replace) |

### Chrome Storage (Directory History Feature)

| Technology | Purpose | Why |
|------------|---------|-----|
| `chrome.storage.local` | Persist directory history (last 10 entries) | Already used throughout codebase for session/settings. Survives browser restarts. 10 MB limit is more than sufficient. Consistent with existing `StorageService.js` pattern. |
| `chrome.storage.session` | Link queue persistence during service worker restarts | Currently `requestQueue` is an in-memory object in `background.js` that is lost on service worker termination. Move to `chrome.storage.session` so queued links survive the ~30s idle timeout. |

**Confidence:** HIGH -- verified against official Chrome developer docs.

**Critical pattern for directory history:**

```javascript
// In StorageService.js, add:
this.DIRECTORY_HISTORY = "DIRECTORY_HISTORY";
this.DIRECTORY_HISTORY_MAX = 10;

// Read/write pattern (stays consistent with existing callback-based API):
this.addDirectoryToHistory = function(dir, callback) {
    StorageService.get(StorageService.DIRECTORY_HISTORY, function(result) {
        let history = result[StorageService.DIRECTORY_HISTORY] || [];
        // Remove duplicates, add to front, cap at max
        history = history.filter(d => d !== dir);
        history.unshift(dir);
        history = history.slice(0, StorageService.DIRECTORY_HISTORY_MAX);
        chrome.storage.local.set(
            { [StorageService.DIRECTORY_HISTORY]: history },
            callback
        );
    });
};
```

**Why NOT `chrome.storage.sync`:** Directory paths are machine-specific (e.g., `C:\Downloads\Movies`). Syncing them across devices would create confusion. `chrome.storage.local` is the correct choice.

**Why NOT `chrome.storage.session` for directory history:** Session storage clears on browser restart. Directory history should persist permanently, just like other settings.

### Service Worker State Management (Multi-Link Fix)

| Pattern | Purpose | Why |
|---------|---------|-----|
| `chrome.storage.session` for `requestQueue` | Survive service worker restarts | The current in-memory `requestQueue` object in `background.js` is lost when the service worker terminates after ~30s idle. `chrome.storage.session` persists for the browser session but clears on browser restart (appropriate for a transient link queue). |
| Top-level event listener registration | Ensure context menu clicks are never missed | Chrome MV3 requires all `chrome.contextMenus.onClicked` and `chrome.runtime.onMessage` listeners to be registered synchronously at the top level of the service worker script. Async registration causes missed events. |

**Confidence:** HIGH -- verified against official Chrome lifecycle documentation.

**Why NOT keep in-memory `requestQueue`:** Service workers terminate after ~30 seconds of inactivity. A user who right-clicks a link, then takes 60 seconds to navigate to a second link, will find the first link lost. `chrome.storage.session` (10 MB limit, memory-backed, cleared on browser exit) solves this without persisting stale data across sessions.

### Testing Infrastructure

#### Unit Testing (Existing -- Minor Upgrade)

| Technology | Current | Recommended | Why |
|------------|---------|-------------|-----|
| Jest | 27.5.1 | **29.7.0** | Upgrade to latest 29.x, not 30.x. Jest 30 (released June 2025) dropped Node 14/16 support, changed JSDOM to v26, and has reported performance regressions. Jest 29 is stable, well-supported, and avoids unnecessary migration risk. |
| jest-chrome | 0.8.0 | **0.8.0** (keep) | Still the best Chrome API mock library. Last published 3+ years ago but works with Jest 27-29 via `overrides` in package.json. No actively-maintained replacement has feature parity. |

**Confidence:** HIGH for Jest 29.7.0 (verified via npm/official docs). MEDIUM for jest-chrome staying at 0.8.0 (unmaintained but functional; no better alternative exists).

**jest-chrome with Jest 29 fix:**
```json
{
  "overrides": {
    "jest-chrome": {
      "jest": "$jest"
    }
  }
}
```

#### End-to-End Testing (New -- CAPTCHA Test Infrastructure)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Playwright | latest (1.50+) | E2E extension testing | Google officially recommends Playwright/Puppeteer. Playwright wins over Puppeteer because: (1) supports headless Chrome extension testing via `channel: 'chromium'`, (2) built-in test runner with fixtures/assertions, (3) auto-waiting reduces flakiness, (4) better parallel execution. |
| @playwright/test | latest | Test runner & assertions | Bundled with Playwright. No need for a separate assertion library. |

**Confidence:** HIGH -- Playwright's Chrome extension support is well-documented in official docs and Google's own extension testing guide.

**Why Playwright over Puppeteer:**
- Puppeteer requires `headless: false` for extensions (needs a display). Playwright supports headless extension testing via the `chromium` channel.
- Playwright has a built-in test runner with fixtures, retries, and parallel execution. Puppeteer requires bolting on Jest/Mocha separately.
- Playwright's `launchPersistentContext` pattern maps cleanly to extension testing needs.
- Google's official E2E testing guide lists Playwright as a first-class option.

**Why NOT Selenium/WebDriverIO:** More complex setup, slower execution, less native Chrome extension support. Overkill for testing a single extension.

**CAPTCHA E2E test architecture:**

```javascript
// playwright.config.js
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  use: {
    // Must use channel: 'chromium' for extension support in headless
    channel: 'chromium',
  },
  projects: [{
    name: 'extension',
    use: {
      // Extension loaded via fixture, not global config
    },
  }],
});
```

```javascript
// e2e/fixtures.js -- Extension loading fixture
const { test: base, chromium } = require('@playwright/test');
const path = require('path');

exports.test = base.extend({
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '..');
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Required for native messaging tests
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    const id = sw.url().split('/')[2];
    await use(id);
  },
});
```

**Important limitation for CAPTCHA E2E:** Tests that involve the native messaging host (myjd-captcha-helper.exe) CANNOT run headless because they open a WebView2 window that requires user interaction. These tests must run with `headless: false` and either:
1. Use a real display (developer machine or CI with a virtual display)
2. Mock the native messaging response at the Chrome API level for automated CI

### MV3 Compliance Tooling

| Technology | Purpose | Why |
|------------|---------|-----|
| Chrome Extension Manifest V3 Lint (manual review) | Audit manifest.json against Web Store requirements | No single automated linter covers all MV3 rules. Manual checklist against official requirements is the reliable approach. |
| Chrome DevTools Extension panel | Runtime compliance checking | Built into Chrome. Inspect service worker lifecycle, check for CSP violations, verify permissions. |

**Confidence:** MEDIUM -- there is no widely-adopted automated MV3 compliance tool. Manual review against official policies is the standard practice.

### Build & Development (No Changes)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| npm | existing | JS package management | Keep |
| Cargo | 1.70+ | Rust builds | Keep |
| PowerShell | existing | Windows build scripts | Keep |
| Node.js | **18+** | Development runtime | Upgrade minimum from 14+ to 18+. Node 14 and 16 are EOL. Jest 29 requires Node 14+ but Playwright requires Node 18+. Standardize on 18+ as the floor. |

**Confidence:** HIGH -- Node 14/16 are past EOL, verified.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| E2E Testing | Playwright | Puppeteer | No built-in test runner; requires headful for extensions; less ergonomic fixtures |
| E2E Testing | Playwright | Selenium/WebDriverIO | More complex, slower, less native extension support |
| Unit Test Runner | Jest 29.7.0 | Jest 30.x | Breaking JSDOM v26 change, reported perf regressions, unnecessary migration risk for this project |
| Unit Test Runner | Jest 29.7.0 | Vitest | Would require migrating from Jest config/mocks; no benefit for a non-Vite project |
| Chrome API Mocks | jest-chrome 0.8.0 | sinon-chrome | Less comprehensive Chrome API coverage, different mocking paradigm |
| Chrome API Mocks | jest-chrome 0.8.0 | jest-webextension-mock | Targets WebExtensions API (Firefox-style), not Chrome-specific APIs |
| Link Queue Storage | chrome.storage.session | In-memory variable | Lost on service worker termination (~30s idle) |
| Dir History Storage | chrome.storage.local | chrome.storage.sync | Directory paths are machine-specific; syncing causes confusion |
| Dir History Storage | chrome.storage.local | IndexedDB | Overkill for a simple string array of 10 items |

## Installation

```bash
# Existing dependencies (no changes)
npm install

# Upgrade Jest to 29.x
npm install -D jest@^29.7.0

# Add Playwright for E2E testing
npm install -D @playwright/test
npx playwright install chromium

# Add jest-chrome override for Jest 29 compatibility
# (add to package.json "overrides" section, see above)
```

### Updated package.json scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:e2e": "npx playwright test",
    "test:e2e:headed": "npx playwright test --headed"
  }
}
```

## Key Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Use `chrome.storage.session` for link queue | Survives service worker restarts; clears on browser exit (appropriate for transient data) |
| Use `chrome.storage.local` for directory history | Persists across browser restarts; consistent with existing StorageService pattern |
| Playwright for E2E | Headless extension support, built-in test runner, Google-recommended |
| Jest 29 not 30 | Stable, avoids JSDOM v26 breaking changes, jest-chrome compatible with override |
| Keep jest-chrome 0.8.0 | No better alternative exists; works with override |
| Node 18+ minimum | Required by Playwright; 14/16 are EOL |

## Permission Audit Note (Web Store Readiness)

The current `manifest.json` uses `"host_permissions": ["<all_urls>"]`. This is a **red flag** for Chrome Web Store review. Google's review process scrutinizes broad host permissions and may reject or delay approval.

**Recommendation:** Move `<all_urls>` to `"optional_host_permissions"` and use `activeTab` permission where possible. The extension needs broad access for content scripts (CNL interception, toolbar injection), but the Web Store prefers optional permissions that users grant on demand. This needs careful analysis during the MV3 compliance phase to determine which content scripts truly need `<all_urls>` vs. which can work with narrower patterns.

**Confidence:** MEDIUM -- `<all_urls>` is technically still allowed in MV3, but review outcomes vary. Many extensions have been rejected or delayed for it.

## Sources

- [Chrome Storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) -- Official, verified 2026-03-06
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- Official
- [Chrome MV3 End-to-End Testing Guide](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) -- Official
- [Chrome MV3 Requirements for Web Store](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements) -- Official
- [Playwright Chrome Extensions Docs](https://playwright.dev/docs/chrome-extensions) -- Official
- [Chrome Extension Permission Declaration](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) -- Official
- [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) -- Official
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) -- Official
- [jest-chrome npm](https://www.npmjs.com/package/jest-chrome) -- npm registry
- [Jest 30 Release Blog](https://jestjs.io/blog/2025/06/04/jest-30) -- Official Jest blog
- [Local vs Sync vs Session Storage](https://dev.to/notearthian/local-vs-sync-vs-session-which-chrome-extension-storage-should-you-use-5ec8) -- Community (verified against official docs)
