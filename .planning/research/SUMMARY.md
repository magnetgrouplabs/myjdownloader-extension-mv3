# Research Summary: MyJDownloader MV3 Extension - Bug Fixes & Enhancements

**Domain:** Chrome MV3 Extension (Download Manager Integration)
**Researched:** 2026-03-06
**Overall confidence:** HIGH

## Executive Summary

This research covers the technology stack and architectural patterns needed for the current milestone: fixing multi-link stacking, adding directory history persistence, setting up CAPTCHA E2E testing infrastructure, and preparing for Chrome Web Store MV3 submission.

The existing stack (AngularJS 1.8.3, Rust native helper, Chrome MV3 APIs) requires no major changes. The key additions are: (1) adopting `chrome.storage.session` for the link queue to survive service worker restarts, (2) extending the existing `StorageService.js` + `chrome.storage.local` pattern for directory history, (3) adding Playwright for E2E testing, and (4) upgrading Jest from 27.5.1 to 29.7.0 for improved stability without the breaking changes of Jest 30.

The most significant technical risk is the service worker termination behavior that silently destroys the in-memory `requestQueue`. This is the root cause of the multi-link stacking issue and the fix is well-understood: move transient state to `chrome.storage.session`. For Chrome Web Store submission, the `<all_urls>` host permission and `nativeMessaging` permission will trigger extended review and require thorough justification documentation.

No framework migrations, no new build tools, and no architectural changes are needed. This is a focused improvement milestone within the existing architecture.

## Key Findings

**Stack:** No framework changes needed. Add Playwright for E2E testing. Upgrade Jest to 29.7.0. Move link queue to `chrome.storage.session`. Minimum Node.js version should be 18+.

**Architecture:** Service worker state must be persisted to survive restarts. Use `chrome.storage.session` for transient queue data, `chrome.storage.local` for directory history. All event listeners must be registered synchronously at the top level of background.js.

**Critical pitfall:** In-memory `requestQueue` is lost on service worker termination (~30s idle). This is the root cause of the multi-link stacking bug. Secondary risk: `<all_urls>` + `nativeMessaging` permissions may trigger extended Chrome Web Store review.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Bug Fixes & Queue Persistence** - Fix known bugs + migrate requestQueue to chrome.storage.session
   - Addresses: Multi-link stacking root cause, duplicate URL patterns, double CAPTCHA sends, native helper panics
   - Avoids: Building features on top of a broken queue system

2. **UI Enhancements** - Directory history dropdown + multi-link toolbar UX
   - Addresses: Directory history persistence, clear history button, toolbar link accumulation display
   - Avoids: Scope creep into framework migration

3. **CAPTCHA E2E Testing** - Set up Playwright infrastructure + WordPress test page
   - Addresses: Zero test coverage on the most complex feature
   - Avoids: Shipping untested native messaging integration to Web Store

4. **MV3 Compliance Audit** - Permission justification, privacy policy, submission prep
   - Addresses: Chrome Web Store requirements for approval
   - Avoids: Rejection for easily fixable compliance gaps

**Phase ordering rationale:**
- Queue persistence fix must come first because it is the foundation for multi-link stacking
- Bug fixes in phase 1 prevent double CAPTCHA sends that would confuse E2E testing in phase 3
- UI enhancements (phase 2) depend on the queue being reliable from phase 1
- CAPTCHA testing (phase 3) comes after bugs are fixed to avoid testing broken code
- Compliance audit (phase 4) is last because it needs a stable, feature-complete extension to audit

**Research flags for phases:**
- Phase 1: Standard patterns, well-documented. Low risk.
- Phase 2: May need reference to MV2 extension for exact multi-link stacking UX behavior.
- Phase 3: Playwright extension testing requires careful fixture setup (persistent context, Chromium channel). CAPTCHA tests cannot run headless.
- Phase 4: Chrome Web Store review outcomes are unpredictable. May need iteration with review team.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new frameworks. Playwright and Jest 29 are well-documented. chrome.storage APIs verified against official docs. |
| Features | HIGH | Feature gaps clearly identified from PROJECT.md and codebase analysis. Implementation patterns are standard. |
| Architecture | HIGH | chrome.storage.session for queues, chrome.storage.local for history are the canonical MV3 patterns. Verified against Chrome developer documentation. |
| Pitfalls | HIGH for technical (storage, listeners), MEDIUM for Web Store review (inherently uncertain) | Service worker termination and async listener risks are well-documented. Web Store review outcomes vary. |
| Testing | HIGH for unit/integration, MEDIUM for CAPTCHA E2E | Playwright extension support is mature. CAPTCHA E2E is inherently semi-manual (human solves CAPTCHA). |

## Gaps to Address

- Exact Chrome Web Store review timeline is unpredictable (1 day to 3+ weeks)
- RequireJS eval() audit needed: must search vendor/js/require.js for eval patterns before submission
- Whether `<all_urls>` should be moved to `optional_host_permissions` requires careful analysis of which content scripts truly need all-page access vs. which could use narrower patterns
- Privacy policy needs to be created and hosted (required for extensions that handle user credentials)
- Native helper installer UX for end users who do not have the native messaging host registered (Windows registry setup)
