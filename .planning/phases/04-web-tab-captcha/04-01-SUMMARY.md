---
phase: 04-web-tab-captcha
plan: 01
subsystem: captcha
tags: [content-script, recaptcha, hcaptcha, chrome-extension, mv3, dom-polling]

# Dependency graph
requires:
  - phase: 01-bug-fixes
    provides: CAPTCHA deduplication guard (BUG-02)
provides:
  - CAPTCHA solver content script with token polling, skip buttons, countdown timer
  - Manifest registration for localhost CAPTCHA pages
  - Structural test suite (36 tests) for CAP-01, CAP-02, CAP-05, CAP-06, CAP-10
affects: [04-02-service-worker-handlers, 05-captcha-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [content-script-dom-polling, token-textarea-detection, event-delegation-skip-buttons]

key-files:
  created:
    - contentscripts/captchaSolverContentscript.js
    - scripts/services/__tests__/captchaSolverContentscript.test.js
  modified:
    - manifest.json

key-decisions:
  - "IIFE with var declarations for content script consistency with existing codebase"
  - "Event delegation on skip button container for MV3 CSP compliance"
  - "500ms polling interval for token detection (balances responsiveness and CPU)"
  - "beforeunload cleanup for both polling and countdown intervals"

patterns-established:
  - "Content script URL gating: broad manifest match + runtime pathname check for selective activation"
  - "Token polling: querySelectorAll with prefix/name selectors for multi-instance CAPTCHA textareas"
  - "Extension-to-service-worker messaging: {action, data} format with callbackUrl in every message"

requirements-completed: [CAP-01, CAP-02, CAP-05, CAP-06, CAP-10]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 4 Plan 1: CAPTCHA Content Script Summary

**Content script for JDownloader localhost CAPTCHA pages with reCAPTCHA/hCaptcha token polling, 4-type skip buttons, and 5-minute countdown timer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T17:52:58Z
- **Completed:** 2026-03-07T17:56:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created CAPTCHA solver content script (6.7KB) with all 5 functional areas: URL detection, token polling, skip buttons, countdown timer, and messaging
- Registered content script in manifest.json for `http://127.0.0.1/*` with `document_end` and `all_frames: false`
- Built 36 structural tests verifying CAP-01, CAP-02, CAP-05, CAP-06, CAP-10 requirements
- Full test suite (113 tests across 8 suites) passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CAPTCHA solver content script** - `90ca903` (feat)
2. **Task 2: Register content script in manifest and create structural tests** - `6319810` (feat)

## Files Created/Modified
- `contentscripts/captchaSolverContentscript.js` - CAPTCHA page enhancer: URL detection, token polling (g-recaptcha-response + h-captcha-response), skip buttons (hoster/package/all/single), 5-minute countdown with red urgency, chrome.runtime.sendMessage for all 3 message types
- `manifest.json` - Added content_scripts entry for `http://127.0.0.1/*` pointing to captchaSolverContentscript.js
- `scripts/services/__tests__/captchaSolverContentscript.test.js` - 36 structural tests covering URL detection, token polling, skip buttons, countdown timer, multi-type support, messaging format, manifest registration, and cleanup

## Decisions Made
- Used `var` declarations and `function` statements throughout for consistency with existing content scripts (webinterfaceEnhancer.js uses the same style)
- Event delegation on the skip button container with `dataset.skipType` rather than per-button listeners for cleaner MV3 CSP compliance
- Hover effects via mouseenter/mouseleave listeners rather than CSS pseudo-classes (content scripts cannot inject stylesheets easily)
- Placed CAPTCHA content script entry before webinterfaceEnhancer in manifest (both use `document_end`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Content script is ready; Plan 04-02 will implement the service worker message handlers (captcha-tab-detected, captcha-solved, captcha-skip) in background.js and modify Rc2Service to stop closing CAPTCHA tabs
- The content script sends messages that currently have no receivers -- this is expected and will be connected in 04-02

---
*Phase: 04-web-tab-captcha*
*Completed: 2026-03-07*
