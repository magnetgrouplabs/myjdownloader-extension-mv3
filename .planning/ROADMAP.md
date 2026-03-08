# Roadmap: MyJDownloader MV3 Extension — Bug Fixes & Enhancements

## Overview

This milestone takes the mostly-complete MV3 conversion and makes it release-ready: fix known bugs and state persistence issues, restore the MV2 multi-link stacking UX, add directory history, implement MV3-compliant web tab CAPTCHA solving via MyJD, validate CAPTCHA end-to-end, and pass Chrome Web Store MV3 compliance review.

## Phases

- [x] **Phase 1: Bug Fixes & Queue Persistence** - Fix known bugs and migrate requestQueue to chrome.storage.session (completed 2026-03-06)
- [x] **Phase 2: Multi-Link Stacking** - Restore MV2-style link accumulation in toolbar sidebar (completed 2026-03-06)
- [x] ~~**Phase 3: Directory History**~~ - SCRAPPED (feature removed, original MV2 saveto behavior preserved)
- [x] **Phase 4: Web Tab CAPTCHA** - MV3-compliant CAPTCHA solving via MyJD web interface (completed 2026-03-07)
- [x] **Phase 5: CAPTCHA E2E Testing** - Validate CAPTCHA flow end-to-end with real JDownloader (completed 2026-03-08)
- [x] **Phase 6: MV3 Compliance Audit** - Permission justification, privacy policy, CWS submission prep (completed 2026-03-08)
- [x] **Phase 7: Requirements & Docs Cleanup** - Fix obsolete requirement text and sync ROADMAP state (completed 2026-03-08)
- [ ] **Phase 8: Phase 5 Verification & TEST-03 Closure** - Create missing VERIFICATION.md, verify CAPTCHA types
- [x] **Phase 9: Settings Page Audit & Wiring** - Ensure all settings have UI controls and are properly wired (completed 2026-03-08)

## Phase Details

### Phase 1: Bug Fixes & Queue Persistence
**Goal**: Eliminate known bugs and make service worker state reliable — the foundation for all subsequent phases
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. Right-click a link, wait 2 minutes, right-click another — both links appear in toolbar
  2. Only one CAPTCHA solving window opens per CAPTCHA challenge (no duplicates)
  3. Malformed native messaging request produces structured error JSON (no crash)
  4. Rc2Service tab query uses a single URL pattern for localhost
**Plans:** 3 plans

Plans:
- [x] 01-01: Service worker queue persistence (chrome.storage.session migration)
- [x] 01-02: Rc2Service and native helper bug fixes
- [x] 01-03: Gap closure — fix message routing and async duplicate check (UAT)

### Phase 2: Multi-Link Stacking
**Goal**: Restore the MV2 experience where right-clicking multiple links stacks them in the toolbar for batch sending
**Depends on**: Phase 1 (reliable queue persistence required)
**Requirements**: LINK-01, LINK-02, LINK-03, LINK-04, LINK-05, LINK-06
**Success Criteria** (what must be TRUE):
  1. Right-clicking 5 links on a page shows all 5 in toolbar sidebar
  2. Adding a link while toolbar is open updates the list without reopening
  3. "Add links" sends all stacked links in one JDownloader API call
  4. Closing a tab clears its link queue
  5. Same URL right-clicked twice appears only once
**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Batch send refactor: structural tests + sendAddLinkQueries single-call implementation
- [x] 02-02-PLAN.md — E2E verification: automated test suite + manual browser verification of all LINK requirements

### Phase 3: Directory History — SCRAPPED
Feature removed. The original MV2 saveto history/autofill behavior is preserved as-is.

### Phase 4: Web Tab CAPTCHA
**Goal**: CAPTCHA solving works identically to old MV2 extension — both localhost and MyJD flows, MV3-compliant, with independent CAPTCHA detection via API polling
**Depends on**: Phase 1 (BUG-02 double-send fix needed before adding another CAPTCHA path)
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09, CAP-10
**Success Criteria** (what must be TRUE):
  1. CAPTCHA detected via MyJD API polling without requiring my.jdownloader.org to be open
  2. Solving CAPTCHA submits token back to JDownloader via MyJD and auto-closes tab
  3. Closing CAPTCHA tab sends skip to JDownloader
  4. Skip buttons visible for localhost flow, hidden for MyJD flow (matches old MV2)
  5. reCAPTCHA v2, v3, and hCaptcha all function
  6. No countdown timer (old MV2 never had one)
  7. Content scripts only activate on correct URLs (localhost CAPTCHA pages or #rc2jdt hash)
**Plans:** 2/2 plans complete

Plans:
- [x] 04-01-PLAN.md — Fix content scripts: URL gate (BUG 2), remove countdown, hide MyJD skip buttons, update tests + CLAUDE.md
- [x] 04-02-PLAN.md — CAPTCHA job polling (BUG 1): offscreen API handler, background alarm coordination, new tab creation

### Phase 5: CAPTCHA E2E Testing
**Goal**: Validated confidence that both CAPTCHA flows work end-to-end with a real JDownloader instance
**Depends on**: Phase 4 (web tab CAPTCHA must be built first)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Written test script covers the full CAPTCHA flow for both modes
  2. Manual test confirms JDownloader receives solved token and proceeds with download
  3. Both reCAPTCHA v2 and hCaptcha tested in at least one mode
**Plans:** 2/2 Complete

Plans:
- [x] 05-01-PLAN.md — Localhost flow code review + E2E test script creation for MYJD remote flow
- [x] 05-02-PLAN.md — Live E2E CAPTCHA testing with real JDownloader and user verification

### Phase 6: MV3 Compliance Audit
**Goal**: Extension passes Chrome Web Store review requirements with no rejections for MV3 violations
**Depends on**: All prior phases (audits the complete, feature-stable extension)
**Requirements**: CWS-01, CWS-02, CWS-03, CWS-04, CWS-05, CWS-06, CWS-07
**Success Criteria** (what must be TRUE):
  1. Every declared permission has documented justification
  2. Privacy policy is hosted at a public URL and linked in CWS listing
  3. RequireJS code path confirmed safe (no runtime CSP violations)
  4. Extension loads cleanly with zero console CSP warnings
  5. postMessage calls use specific origins, not wildcards
**Plans:** 2/2 Complete

Plans:
- [x] 06-01-PLAN.md — Manifest cleanup (remove nativeMessaging, clean web_accessible_resources) + compliance report + README migration table
- [x] 06-02-PLAN.md — CSP runtime verification (checkpoint: load extension, check all page consoles)

### Phase 7: Requirements & Docs Cleanup
**Goal**: Correct obsolete requirement text (native helper references, countdown timer) and sync ROADMAP state to reality
**Depends on**: Phase 6 (audit identified the gaps)
**Requirements**: CAP-06, CAP-08, TEST-03 (text only), CWS-01, CWS-05
**Gap Closure**: Closes requirement text gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. CAP-06 text says "No countdown timer" (matches implementation and CLAUDE.md)
  2. CAP-08 text says "Web tab only" (no native helper reference)
  3. TEST-03 text references web tab mode only (no native helper mode)
  4. CWS-01 justification does not reference nativeMessaging
  5. CWS-05 description does not reference native helper
  6. ROADMAP checkboxes and progress table match actual phase completion state
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md — Fix obsolete requirement text + sync ROADMAP state

### Phase 8: Phase 5 Verification & TEST-03 Closure
**Goal**: Create missing Phase 5 VERIFICATION.md and satisfy TEST-03 by verifying CAPTCHA types in web tab mode
**Depends on**: Phase 7 (requirement text must be correct before verifying against it)
**Requirements**: TEST-03
**Gap Closure**: Closes integration gap (Phase 5 unverified) and TEST-03 requirement
**Success Criteria** (what must be TRUE):
  1. Phase 5 VERIFICATION.md exists with pass/fail for each success criterion
  2. reCAPTCHA v2 verified working in web tab mode
  3. hCaptcha verified working in web tab mode
**Plans:** 1 plan

Plans:
- [ ] 08-01-PLAN.md — Create Phase 5 VERIFICATION.md and close TEST-03 in REQUIREMENTS.md

### Phase 9: Settings Page Audit & Wiring
**Goal**: Ensure all defined settings have UI controls and are properly wired to extension behavior
**Depends on**: Nothing (independent)
**Requirements**: SET-01, SET-02
**Success Criteria** (what must be TRUE):
  1. CAPTCHA_PRIVACY_MODE has a visible toggle in the AngularJS settings page
  2. DIRECTORY_HISTORY_ENABLED has a visible toggle in the AngularJS settings page
  3. All StorageService setting keys have corresponding UI controls
**Plans:** 2/2 plans complete

Plans:
- [x] 09-01-PLAN.md — Storage key audit: fix background.js key mismatches, delete dead options page, update tests
- [ ] 09-02-PLAN.md — Add missing CAPTCHA_PRIVACY_MODE and DIRECTORY_HISTORY_ENABLED toggles to settings UI

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Bug Fixes & Queue Persistence | 3/3 | Complete | 2026-03-06 |
| 2. Multi-Link Stacking | 2/2 | Complete | 2026-03-06 |
| 3. Directory History | - | Scrapped | - |
| 4. Web Tab CAPTCHA | 2/2 | Complete | 2026-03-07 |
| 5. CAPTCHA E2E Testing | 2/2 | Complete | 2026-03-08 |
| 6. MV3 Compliance Audit | 2/2 | Complete | 2026-03-08 |
| 7. Requirements & Docs Cleanup | 1/1 | Complete | 2026-03-08 |
| 8. Phase 5 Verification & TEST-03 | 0/1 | In Progress | - |
| 9. Settings Page Audit & Wiring | 2/2 | Complete   | 2026-03-08 |

---
*Roadmap created: 2026-03-06*
*Last updated: 2026-03-08 (Phase 9 Plan 01 complete)*
