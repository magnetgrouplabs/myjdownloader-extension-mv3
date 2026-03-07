# Roadmap: MyJDownloader MV3 Extension — Bug Fixes & Enhancements

## Overview

This milestone takes the mostly-complete MV3 conversion and makes it release-ready: fix known bugs and state persistence issues, restore the MV2 multi-link stacking UX, add directory history, implement a cross-platform web tab CAPTCHA fallback alongside the existing native helper, validate CAPTCHA end-to-end, and pass Chrome Web Store MV3 compliance review.

## Phases

- [ ] **Phase 1: Bug Fixes & Queue Persistence** - Fix known bugs and migrate requestQueue to chrome.storage.session
- [x] **Phase 2: Multi-Link Stacking** - Restore MV2-style link accumulation in toolbar sidebar (completed 2026-03-06)
- [ ] **Phase 3: Directory History** - Persistent dropdown on "Save to" field with clear button
- [x] **Phase 4: Web Tab CAPTCHA** - Cross-platform CAPTCHA fallback via content script on JDownloader's localhost page (completed 2026-03-07)
- [ ] **Phase 5: CAPTCHA E2E Testing** - Validate both CAPTCHA modes end-to-end with real JDownloader
- [ ] **Phase 6: MV3 Compliance Audit** - Permission justification, privacy policy, CWS submission prep

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

### Phase 3: Directory History
**Goal**: Users can quickly re-select previously used download directories without retyping
**Depends on**: Nothing (independent of phases 1-2)
**Requirements**: DIR-01, DIR-02, DIR-03, DIR-04, DIR-05
**Success Criteria** (what must be TRUE):
  1. After sending links to 3 different directories, all 3 appear in the dropdown on next use
  2. Directory history survives browser restart
  3. Clear button empties the history; dropdown shows no entries afterward
  4. Duplicate paths (case-insensitive) are collapsed to one entry
**Plans:** 1 plan

Plans:
- [ ] 03-01-PLAN.md — StorageService setting key, AddLinksController history logic (normalization, cap, clear), templateCache UI (conditional datalist, clear button), options page toggle

### Phase 4: Web Tab CAPTCHA
**Goal**: CAPTCHA solving works cross-platform without native binary installation, using JDownloader's own localhost CAPTCHA page enhanced by a content script
**Depends on**: Phase 1 (BUG-02 double-send fix needed before adding another CAPTCHA path)
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09, CAP-10
**Success Criteria** (what must be TRUE):
  1. JDownloader CAPTCHA page stays open with skip buttons and countdown timer
  2. Solving CAPTCHA submits token to JDownloader and auto-closes tab
  3. Closing CAPTCHA tab sends skip to JDownloader
  4. 5-minute countdown visible on CAPTCHA page; auto-skips on expiry
  5. reCAPTCHA v2, v3, and hCaptcha all function in web tab mode
**Plans:** 2/2 plans complete

Plans:
- [ ] 04-01-PLAN.md — Content script creation (URL detection, token polling, skip buttons, countdown) + manifest registration + structural tests
- [ ] 04-02-PLAN.md — Service worker CAPTCHA message handlers, Rc2Service modifications (remove native routing + tab closing), tests

### Phase 5: CAPTCHA E2E Testing
**Goal**: Validated confidence that both CAPTCHA modes work end-to-end with a real JDownloader instance
**Depends on**: Phase 4 (web tab CAPTCHA must be built first)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Written test script covers the full CAPTCHA flow for both modes
  2. Manual test confirms JDownloader receives solved token and proceeds with download
  3. Both reCAPTCHA v2 and hCaptcha tested in at least one mode
**Plans**: TBD

Plans:
- [ ] 05-01: E2E test scripts and manual validation

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
**Plans**: TBD

Plans:
- [ ] 06-01: Permission justification and privacy policy
- [ ] 06-02: Code audit (RequireJS, CSP, postMessage origins)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Bug Fixes & Queue Persistence | 3/3 | Complete | 2026-03-06 |
| 2. Multi-Link Stacking | 2/2 | Complete   | 2026-03-06 |
| 3. Directory History | 0/1 | Planning complete | - |
| 4. Web Tab CAPTCHA | 2/2 | Complete   | 2026-03-07 |
| 5. CAPTCHA E2E Testing | 0/1 | Not started | - |
| 6. MV3 Compliance Audit | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-06*
*Last updated: 2026-03-07*
