---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: "04-03 (MV2 parity: canClose, loaded, mouse-move)"
status: executing
last_updated: "2026-03-07T20:10:22.021Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 80
---

# Project State: MyJDownloader MV3 Extension

## Current Position

**Milestone:** v1.0
**Active Phase:** 04-web-tab-captcha
**Current Plan:** 04-03 (MV2 parity: canClose, loaded, mouse-move)
**Status:** In progress — MV2 comparison revealed 3 missing features
**Progress:** [████████░░] 80%

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Bug Fixes & Queue Persistence | Complete (3/3 plans) | Queue persistence + bug fixes + gap closure done |
| 2. Multi-Link Stacking | Complete (2/2 plans) | All LINK requirements verified; sidebar persistence noted |
| 3. Directory History | Complete (1/1 plans) | MRU dropdown, dedup, clear button, settings toggle |
| 4. Web Tab CAPTCHA | In progress (2/3 plans) | MV2 comparison found 3 missing features: canClose, loaded, mouse-move |
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

## Context for Next Session

Phase 4 reopened (2/3 plans). MV2 comparison with old Edge extension (v3.3.20) revealed 3 missing features: canClose polling, loaded event, mouse-move reporting. All are simple HTTP GETs — MV3 compliant. Plan 04-03 needed.
Last session stopped at: MV2 comparison analysis complete, ready for Plan 04-03
Resume file: .planning/phases/04-web-tab-captcha/04-CONTEXT.md

---
*State initialized: 2026-03-06*
*Last updated: 2026-03-07T17:08:12Z*
