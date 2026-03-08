---
phase: 6
slug: mv3-compliance-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27.5.1 with jsdom |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="__tests__" -x` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="__tests__" -x`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CWS-01 | manual-only | N/A — documentation review | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | CWS-01 | unit | `npx jest -x` (regression after manifest change) | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | CWS-03 | manual-only | N/A — code analysis, documentation | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | CWS-07 | manual-only | N/A — documentation review | N/A | ⬜ pending |
| 06-02-01 | 02 | 2 | CWS-04 | manual-only | N/A — requires loading extension in Chrome | N/A | ⬜ pending |
| 06-02-02 | 02 | 2 | CWS-01 | manual-only | N/A — README documentation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

This phase is primarily documentation/audit. The existing 216 unit tests provide regression coverage for the manifest.json change (removing nativeMessaging). No new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Permission justification documented | CWS-01 | Documentation output, not testable code | Review compliance report for completeness |
| Restricted code paths are dead code | CWS-03 | Requires source code analysis, not runtime testing | Verify eval/Function() usage documented with dead-code reasoning |
| No CSP violations in consoles | CWS-04 | Requires loading extension in Chrome browser | Load extension, open DevTools on popup/toolbar/CAPTCHA tab, check for CSP errors |
| postMessage wildcard documented | CWS-07 | Documentation output, not testable code | Review compliance report for postMessage findings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
