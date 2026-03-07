---
phase: 4
slug: web-tab-captcha
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 with jsdom |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --verbose` |
| **Full suite command** | `npx jest --verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --verbose`
- **After every plan wave:** Run `npx jest --verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CAP-01 | Localhost URL gate on captchaSolverContentscript.js | unit (structural) | `npx jest scripts/services/__tests__/captchaSolverContentscript.test.js -x` | Yes — needs update | ⬜ pending |
| CAP-02 | Token polling (500ms interval) | unit (structural) | `npx jest scripts/services/__tests__/captchaSolverContentscript.test.js -x` | Yes | ⬜ pending |
| CAP-03 | Token relay via chrome.runtime.sendMessage | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes | ⬜ pending |
| CAP-04 | Service worker token submission | unit (structural) | `npx jest scripts/services/__tests__/background-captcha.test.js -x` | Yes | ⬜ pending |
| CAP-05 | Skip buttons hidden for MYJD flow | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes — needs update | ⬜ pending |
| CAP-06 | Countdown REMOVED | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes — needs update | ⬜ pending |
| CAP-07 | Tab close behavior | unit (structural) | `npx jest scripts/services/__tests__/background-captcha.test.js -x` | Yes | ⬜ pending |
| CAP-08 | Dual-flow (localhost + MyJD) | manual | N/A | N/A | ⬜ pending |
| CAP-09 | Rc2Service does not close tab | unit (structural) | `npx jest scripts/services/__tests__/Rc2Service.test.js -x` | Yes | ⬜ pending |
| CAP-10 | reCAPTCHA v2/v3/hCaptcha support | unit (structural) | `npx jest scripts/services/__tests__/myjdCaptchaSolver.test.js -x` | Yes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `captchaSolverContentscript.test.js` — add URL gate tests, remove countdown tests
- [ ] Update `myjdCaptchaSolver.test.js` — add skip button hidden test, remove countdown tests
- [ ] New tests for CAPTCHA polling logic (if added)

*Existing infrastructure covers framework needs. Test file updates needed for corrected behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dual-flow works end-to-end | CAP-08 | Requires real JDownloader + MyJD account | Trigger CAPTCHA from my.jdownloader.org, verify widget renders and token submits |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
