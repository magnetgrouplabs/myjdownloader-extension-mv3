# Phase 5: CAPTCHA E2E Testing - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that the MV3 CAPTCHA solving flow works end-to-end with a real JDownloader instance. The extension must function identically to the old MV2 extension. This is the first live test of the CAPTCHA implementation built in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Testing approach
- Claude-driven testing using browser MCP controls
- User's only participation: solving the actual CAPTCHA when it appears, and confirming JDownloader started the download
- Claude researches which file hosters trigger CAPTCHAs for free-tier users (user is premium on pixeldrain — skip that hoster)
- Claude finds existing CAPTCHA-gated download links or uploads a small test file to trigger CAPTCHAs

### Flow coverage
- **MyJD remote flow (live test)**: Full E2E — trigger CAPTCHA, verify tab opens, user solves, confirm download starts in JD
- **Localhost flow (code review only)**: User's JD is on NAS, not local PC. Verify localhost path through code inspection, not live testing
- Test whatever CAPTCHA types JDownloader encounters naturally (reCAPTCHA v2, v3, hCaptcha all supported)

### Pass/fail criteria
- **Pass**: CAPTCHA tab appears → user solves → token submits → JDownloader starts the download (user confirms)
- **Fail**: Any break in the chain (tab doesn't open, widget doesn't render, token doesn't submit, JD doesn't receive token)

### On failure
- Debug and fix inline during testing — the goal is a working CAPTCHA flow, not just a test report
- If something breaks, diagnose root cause, fix the code, and re-test

### Test documentation
- Claude's discretion on format and location
- Results should capture what was tested, what passed/failed, and any fixes applied

### Claude's Discretion
- Which file hosters to use for triggering CAPTCHAs
- Whether to upload test files or find existing download links
- Test script format and location
- Order of testing steps
- How to verify extension state via browser MCP during testing

</decisions>

<specifics>
## Specific Ideas

- Must be functionally identical to old MV2 extension — this is the validation phase for that guarantee
- The extension handles all MyJD API calls directly — user does NOT need my.jdownloader.org open
- Extension polls for CAPTCHA jobs via MyJD API independently
- User is premium on pixeldrain (CAPTCHAs won't trigger there)
- This is the first time the CAPTCHA flow will be tested live — expect to find and fix bugs

</specifics>

<code_context>
## Existing Code Insights

### Key CAPTCHA Files to Validate
- `contentscripts/myjdCaptchaSolver.js` — Content script that renders CAPTCHA widget on target domain
- `scripts/services/Rc2Service.js` — CAPTCHA orchestration (MyJD API queries, token/skip routing)
- `background.js` — Tab tracking, CSP stripping rules, CAPTCHA message routing
- `contentscripts/webinterfaceEnhancer.js` — Message relay on my.jdownloader.org
- `offscreen.js` — API operations handler (CAPTCHA polling)
- `contentscripts/captchaSolverContentscript.js` — Localhost flow enhancer (code review only)

### Existing Test Infrastructure
- Jest 27.5.1 with 216 passing tests across 10 suites
- Tests are structural/unit — no E2E browser testing exists yet
- `test-captcha-*.html` files in project root (test pages from Phase 4 development)

### Integration Points
- `chrome.storage.session` for CAPTCHA job transfer (service worker → content script)
- `declarativeNetRequest` for CSP header stripping on CAPTCHA tabs
- `chrome.scripting.executeScript({world: 'MAIN'})` for invisible/v3 CAPTCHA execution
- MyJD API endpoints: `/captcha/getCaptchaJob`, `/captcha/get`

</code_context>

<deferred>
## Deferred Ideas

- Automated CAPTCHA E2E testing with mock JD server (QA-03 in v2 requirements)
- Playwright E2E tests for non-CAPTCHA flows (QA-01 in v2 requirements)
- CAPTCHA solving service integration (ECAP-03 in v2 requirements)

</deferred>

---

*Phase: 05-captcha-e2e-testing*
*Context gathered: 2026-03-07*
