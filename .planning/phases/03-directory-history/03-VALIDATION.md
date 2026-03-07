---
phase: 3
slug: directory-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (jsdom environment) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="AddLinksController" --no-coverage -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="AddLinksController" --no-coverage -x`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | DIR-01..05 | unit (structural) | `npx jest --testPathPattern="AddLinksController" --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DIR-01, DIR-03, DIR-05 | unit (structural) | `npx jest --testPathPattern="AddLinksController" --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | DIR-02 | unit (structural) | `npx jest --testPathPattern="StorageService" --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 2 | DIR-04 | unit (structural) | `npx jest --testPathPattern="AddLinksController" --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 2 | DIR-01 | unit (structural) | `npx jest --testPathPattern="templateCache" --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 3 | DIR-01 | unit (structural) | `npx jest --testPathPattern="options" --no-coverage -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/__tests__/AddLinksController.test.js` — new test cases for addToHistory normalization, cap, clearSavetoHistory (DIR-01..05)
- [ ] `scripts/services/__tests__/StorageService.test.js` — verify SETTINGS_DIRECTORY_HISTORY_ENABLED key and settingsKeys entry (DIR-02)
- [ ] `scripts/__tests__/templateCache.test.js` — verify clear button markup and conditional datalist (DIR-04, DIR-01)
- [ ] `scripts/__tests__/options.test.js` — verify DIRECTORY_HISTORY_ENABLED key present in options.js (DIR-01)

*Note: Project uses source-level structural tests (read file + regex/string matching) rather than runtime AngularJS tests. This is the established pattern from Phase 2.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Datalist dropdown renders in Chrome | DIR-01 | Requires live browser with extension loaded | 1. Load extension 2. Open add-links dialog 3. Type in saveto field 4. Verify dropdown appears with history entries |
| History survives browser restart | DIR-02 | Requires full browser lifecycle | 1. Add links with a directory 2. Close Chrome completely 3. Reopen Chrome and extension 4. Verify history entry persists |
| Clear button visual feedback | DIR-04 | Requires visual inspection | 1. With history entries, click clear button 2. Verify dropdown suggestions removed 3. Verify saveto field value kept |
| Settings toggle effect on popup | DIR-01 | Cross-page interaction (options → popup) | 1. Disable toggle in settings 2. Open add-links dialog 3. Verify no dropdown suggestions appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
