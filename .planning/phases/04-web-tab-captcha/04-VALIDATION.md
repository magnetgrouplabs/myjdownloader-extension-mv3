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
| **Framework** | Jest 27.5.1 with jsdom |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern=__tests__ -x` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=__tests__ -x`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CAP-01 | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CAP-02 | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CAP-03 | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | CAP-05 | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | CAP-06 | unit | `npx jest __tests__/captchaSolverContentscript.test.js -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | CAP-04 | unit | `npx jest __tests__/background-captcha.test.js -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CAP-07 | unit | `npx jest __tests__/background-captcha.test.js -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | CAP-08 | unit (structural) | `npx jest __tests__/Rc2Service.test.js -x` | ✅ (needs update) | ⬜ pending |
| 04-02-04 | 02 | 2 | CAP-09 | unit (structural) | `npx jest __tests__/Rc2Service.test.js -x` | ✅ (needs update) | ⬜ pending |
| 04-03-01 | 03 | 2 | CAP-10 | manual-only | Manual E2E test with JDownloader | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/services/__tests__/captchaSolverContentscript.test.js` — stubs for CAP-01, CAP-02, CAP-03, CAP-05, CAP-06
- [ ] `scripts/services/__tests__/background-captcha.test.js` — stubs for CAP-04, CAP-07
- [ ] Update `scripts/services/__tests__/Rc2Service.test.js` — verify CAP-08 (no native routing), CAP-09 (no tab close)

*Existing jest infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| reCAPTCHA v2, v3, hCaptcha all function in web tab | CAP-10 | Requires live JDownloader + real CAPTCHA providers | 1. Start JDownloader with CAPTCHA-requiring downloads 2. Verify each CAPTCHA type renders 3. Solve and confirm token submission |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
