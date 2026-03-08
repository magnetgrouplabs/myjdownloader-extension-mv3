---
phase: 5
slug: captcha-e2e-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27.5.1 + jest-chrome 0.8.0 |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest` |
| **Full suite command** | `npx jest --coverage` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest`
- **After every plan wave:** Run `npx jest --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green + manual E2E results documented
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TEST-01 | manual E2E | N/A (manual browser testing) | Will create test script | ⬜ pending |
| 05-01-02 | 01 | 1 | TEST-02 | code review | N/A (code inspection) | Existing structural tests | ⬜ pending |
| 05-01-03 | 01 | 1 | TEST-03 | manual E2E + code review | N/A (manual for MYJD, code review for localhost) | Will create test results | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* This phase is primarily manual E2E testing with real JDownloader, not automated test development. Jest suite (216 tests, 10 suites) already validates structural/unit concerns.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full CAPTCHA flow E2E (MYJD remote) | TEST-01 | Requires real JDownloader instance + real CAPTCHA challenge + real user solving | 1. Add CAPTCHA-gated link to JD. 2. Wait for CAPTCHA tab. 3. Solve CAPTCHA. 4. Verify download starts. |
| Localhost CAPTCHA page renders standalone | TEST-02 | User's JD is on NAS — can't test locally. Code review validates implementation. | Code-review captchaSolverContentscript.js for correctness |
| Both reCAPTCHA v2 and hCaptcha tested | TEST-03 | Depends on which CAPTCHA type file hosters serve | Test with multiple hosters until both types are observed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
