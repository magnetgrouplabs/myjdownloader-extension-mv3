# MyJDownloader MV3 Extension — Bug Fixes & Enhancements

## What This Is

A Chrome Extension (Manifest V3) that integrates with MyJDownloader to add download links, intercept Click'N'Load requests, and solve CAPTCHAs via a native messaging helper. This is a brownfield project — the MV3 conversion is mostly complete but has several functional issues and missing features that need to be addressed before submitting to the Chrome Web Store.

## Core Value

Users can right-click links on any page and reliably send them to JDownloader, including bulk operations and CAPTCHA-gated downloads, with the same smooth experience as the original MV2 extension.

## Requirements

### Validated

<!-- Existing working capabilities from current codebase -->

- ✓ Login/logout to MyJDownloader account — existing
- ✓ Device discovery and selection — existing
- ✓ Single-link context menu "Download with JDownloader" — existing
- ✓ In-page toolbar sidebar for link preview and send — existing
- ✓ Click'N'Load (CNL) interception — existing
- ✓ Session persistence across browser restarts — existing
- ✓ Settings page via AngularJS route — existing
- ✓ CAPTCHA solving via native helper (reCAPTCHA v2/v3, hCaptcha) — existing (needs E2E testing)
- ✓ Offscreen document for API operations — existing
- ✓ Service worker background orchestration — existing
- ✓ Native messaging host (Rust) with WebView2 — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Multi-link stacking in sidebar — right-clicking multiple links stacks them as a list in the toolbar, all sendable at once (original MV2 behavior)
- [ ] Directory field history dropdown — persistent dropdown on directory input showing last 10 entries, saved to chrome.storage.local
- [ ] Clear history button — link/button to clear the directory history
- [ ] CAPTCHA end-to-end test infrastructure — WordPress test page gating downloads behind reCAPTCHA v2/v3, full flow testing from extension → native helper → solve → download
- [ ] Fix known bugs: duplicate URL pattern in Rc2Service tab query, double CAPTCHA job send, native helper unwrap panics
- [ ] MV3 compliance audit — thorough evaluation of Manifest V3 compliance, CSP adherence, permission justifications, and Chrome Web Store approval readiness

### Out of Scope

<!-- Explicit boundaries -->

- Full AngularJS → modern framework rewrite — too large for this milestone; the existing AngularJS UI works
- RequireJS replacement — not blocking functionality; modernize later
- macOS/Linux native helper support — Windows-only for now; WebView2 is Windows-specific
- Custom filter sets implementation — incomplete infrastructure exists but not user-requested
- Offline support — MyJDownloader is a cloud service requiring internet
- Mobile app — web extension only

## Context

- **Original MV2 extension** available at `C:\Users\anthony\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\fbcohnmimjicjdomonkcbcpbpnhggkip\3.3.20_0\` for reference on original multi-link behavior
- **Codebase map** already generated at `.planning/codebase/` with architecture, concerns, stack, and testing analysis
- **Known bugs** documented in `.planning/codebase/CONCERNS.md` — includes duplicate URL patterns, double CAPTCHA sends, native helper panics on unwrap
- **User has reCAPTCHA v2 and v3** configured on their WordPress domain for CAPTCHA testing; can add hCaptcha if needed
- **User's WordPress site** can host test pages via Elementor HTML widget or similar
- **CAPTCHA test goal**: real-world scenario — link leads to CAPTCHA, solving forwards to page with download

## Constraints

- **MV3 Compliance**: All code must pass Chrome Web Store MV3 requirements — no inline scripts, no eval(), no remote code execution
- **Backward Compatibility**: Must maintain existing APP_KEY `"myjd_webextension_chrome"` for JDownloader API
- **Native Helper**: CAPTCHA solving requires native helper to be built and registered; WebView2 Runtime required on Windows
- **AngularJS**: Must work within existing AngularJS architecture (no framework migration this milestone)
- **Chrome API**: Must use Manifest V3 APIs (service workers, offscreen documents, chrome.storage)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use native messaging for CAPTCHA | MV3 CSP blocks inline CAPTCHA scripts in extension pages | ✓ Good |
| Keep AngularJS for UI | Rewrite too large for this scope; existing UI works | — Pending |
| Persist directory history in chrome.storage.local | Survives browser restarts; consistent with existing session storage pattern | — Pending |
| Test CAPTCHA on user's WordPress domain | Real-world scenario; user already has reCAPTCHA configured | — Pending |
| Add MV3 compliance audit as final phase | Ensures Chrome Web Store approval; catches issues before submission | — Pending |

---
*Last updated: 2026-03-06 after initialization*
