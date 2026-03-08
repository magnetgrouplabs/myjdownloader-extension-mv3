---
phase: 9
slug: settings-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (jsdom) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --no-coverage -x` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --no-coverage -x`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | SET-01, SET-02 | unit | `npx jest --testPathPattern="SettingsController" -x` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | SET-01 | unit | `npx jest --testPathPattern="SettingsController" -x` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | SET-02 | unit | `npx jest --testPathPattern="SettingsController" -x` | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 1 | AUDIT | unit | `npx jest --testPathPattern="background" -x` | ❌ W0 | ⬜ pending |
| 09-01-05 | 01 | 2 | AUDIT | unit | `npx jest --testPathPattern="options" -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/__tests__/SettingsController.test.js` — stubs for SET-01, SET-02 (template checkbox existence, $watchGroup entries)
- [ ] `scripts/__tests__/background.test.js` — add test verifying STORAGE_KEYS match StorageService key strings
- [ ] Update `scripts/__tests__/options.test.js` — adjust for options.js/options.html deletion

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle visible in settings page | SET-01, SET-02 | Visual verification in browser | Load extension, open settings, verify toggles render correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
