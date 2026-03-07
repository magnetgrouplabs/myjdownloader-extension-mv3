---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: Not started
status: planning
last_updated: "2026-03-07T21:35:14.159Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 10
  completed_plans: 10
  percent: 83
---

# Project State: MyJDownloader MV3 Extension

## Current Position

**Milestone:** v1.0
**Active Phase:** 04-web-tab-captcha
**Current Plan:** Not started
**Status:** Ready to plan
**Progress:** [████████░░] 83%

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Bug Fixes & Queue Persistence | Complete (3/3 plans) | Queue persistence + bug fixes + gap closure done |
| 2. Multi-Link Stacking | Complete (2/2 plans) | All LINK requirements verified; sidebar persistence noted |
| 3. Directory History | Complete (1/1 plans) | MRU dropdown, dedup, clear button, settings toggle |
| 4. Web Tab CAPTCHA | Complete (4/4 plans) | Dual-flow CAPTCHA: localhost content script + MYJD remote + service worker handlers + JD protocol callbacks (canClose/loaded/mouse-move) + loginNeeded.html |
| 5. CAPTCHA E2E Testing | Not started | Depends on Phase 4 |
| 6. MV3 Compliance Audit | Not started | Depends on all prior phases |

## Key Decisions

| Decision | Date | Context |
|----------|------|---------|
| Web tab CAPTCHA as cross-platform fallback | 2026-03-06 | Research validated feasibility; content scripts + MAIN world injection are fully MV3 compliant |
| Keep native helper as primary CAPTCHA mode | 2026-03-06 | Proven, better UX; web tab is fallback when native not installed |
| chrome.storage.session for requestQueue | 2026-03-06 | Transient data; survives SW restart but not browser restart |
| chrome.storage.local for directory history | 2026-03-06 | Persistent user preference; survives browser restart |
| HTML5 datalist for directory dropdown | 2026-03-06 | Native autocomplete; no extra JS/AngularJS needed |
| String-normalized tab ID keys | 2026-03-06 | Prevents JSON roundtrip key mismatch in requestQueue |
| IIFE async wrapper for onMessage handlers | 2026-03-06 | chrome.runtime.onMessage does not support async return |
| Fire-and-forget persistQueue() | 2026-03-06 | Non-blocking to avoid slowing mutation paths |
| Source-level structural tests for AngularJS services | 2026-03-06 | Read file + regex validation avoids full DI wiring in Jest |
| captchaInProgress dedup key: captchaId or callbackUrl | 2026-03-06 | Covers both MyJD API and local callback CAPTCHA flows |
| serialize_response with fallback error JSON | 2026-03-06 | Prevents native helper panics on serialization failure |
| chrome.runtime.sendMessage for link-info-update | 2026-03-06 | Reaches toolbar iframe (ToolbarController uses chrome.runtime.onMessage) |
| async addLinkToRequestQueue with await queueReady | 2026-03-06 | Prevents duplicate check against empty queue after SW wake |
| \r\n join for batch link URLs in sendAddLinkQueries | 2026-03-06 | Matches existing CNL separator convention; reduces N API calls to 1 |
| First query object as base for shared options in batch send | 2026-03-06 | All queries share same $scope.selection options; first query is representative |
| First available sourceUrl used for batch context | 2026-03-06 | JDownloader uses first sourceUrl for referrer context |
| Toolbar sidebar persistence is UI polish, not blocker | 2026-03-06 | Links send successfully; sidebar stays visible after batch send; deferred to Phase 6 |
| DIRECTORY_HISTORY_ENABLED raw key (not settings_ prefix) | 2026-03-07 | Must match StorageService constant exactly; existing keys use inconsistent prefix |
| Clear button wipes ALL devices' saveto history | 2026-03-07 | Per DIR-04: clear is global, not per-device |
| Trailing slash/backslash normalization before dedup | 2026-03-07 | Handles both Unix and Windows path formats |
| IIFE with var for content script consistency | 2026-03-07 | Matches webinterfaceEnhancer.js style; avoids let/const in content scripts |
| Event delegation for skip buttons | 2026-03-07 | Single click listener on container, reads dataset.skipType; MV3 CSP compliant |
| 500ms token polling interval | 2026-03-07 | Balances responsiveness and CPU usage for CAPTCHA token detection |
| beforeunload cleanup for both intervals | 2026-03-07 | Prevents memory leaks from polling and countdown on tab close |
| encodeURIComponent on CAPTCHA token | 2026-03-07 | Prevents URL injection via special characters in token string |
| skiptype=single for tab close | 2026-03-07 | Less aggressive than hoster; consistent with timeout behavior |
| Delete activeCaptchaTabs before HTTP send | 2026-03-07 | Prevents race condition with simultaneous captcha-skip message |
| Keep CaptchaNativeService.js file on disk | 2026-03-07 | Deferred deletion per CONTEXT.md; removed from DI but file stays |
| Remove captchaInProgress dedup guard | 2026-03-07 | Only needed for native helper double-sends; web tab flow uses content script |
| Let JD page render CAPTCHA (no domain redirect) | 2026-03-07 | Old MV2 redirected to hoster domain + injected scripts (CSP violation); JD's own page works on localhost |
| 3 missing MV2 features: canClose, loaded, mouse-move | 2026-03-07 | All are HTTP GETs to callbackUrl — fully MV3 compliant; needed for full parity |
| Rc2Service sends myjd-prepare-captcha-tab to service worker | 2026-03-07 | Replaces old rc2TabUpdateCallbacks pattern for MYJD CAPTCHA flow |
| Session storage job transfer for MYJD CAPTCHA | 2026-03-07 | Service worker writes myjd_captcha_job, content script reads it |
| CSP stripping via declarativeNetRequest modifyHeaders | 2026-03-07 | Tab-scoped rules with ID = 10000 + tabId for uniqueness |
| myjdCaptchaSolver.js DOM replacement with 3 defenses | 2026-03-07 | document.open/close + readystatechange clearDocument + DOMContentLoaded body check |
| XMLHttpRequest for JD protocol callbacks | 2026-03-07 | Matches IIFE content script style; not fetch; includes X-Myjd-Appkey header |
| captcha-can-close as fallback after window.close() | 2026-03-07 | Service worker closes tab if window.close fails in content script |
| loadedRetries max 10 at 500ms for element detection | 2026-03-07 | 5s total wait sufficient for CAPTCHA widget render |

## Blockers

None currently.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 4min | 2 | 3 |
| 01 | 02 | 6min | 2 | 6 |
| 01 | 03 | 4min | 2 | 2 |
| 02 | 01 | 2min | 2 | 2 |
| 02 | 02 | 5min | 2 | 0 |
| 03 | 01 | 4min | 2 | 10 |
| 04 | 01 | 3min | 2 | 3 |
| 04 | 02 | 4min | 2 | 4 |
| Phase 04 P02 | 4min | 2 tasks | 4 files |
| 04 | 03 | 8min | 2 | 8 |
| 04 | 04 | 2min | 2 | 3 |

## Context for Next Session

Phase 4 complete (4/4 plans). Dual-flow CAPTCHA architecture fully wired with all MV2 parity features: localhost content script (Plan 01) + service worker handlers (Plan 02) + MYJD remote flow (Plan 03) + JD protocol callbacks canClose/loaded/mouse-move + loginNeeded.html (Plan 04). 216 tests passing across 10 suites.
Last session stopped at: Completed 04-04-PLAN.md
Resume file: None

---
*State initialized: 2026-03-06*
*Last updated: 2026-03-07T21:29:00Z*
