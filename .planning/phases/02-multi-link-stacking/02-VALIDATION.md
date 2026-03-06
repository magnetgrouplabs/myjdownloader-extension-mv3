---
phase: 2
slug: multi-link-stacking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27.5.1 + jest-chrome 0.8.0 |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | LINK-03 | unit (structural) | `npx jest scripts/__tests__/AddLinksController.test.js --verbose` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | LINK-03 | unit (structural) | `npx jest scripts/__tests__/AddLinksController.test.js --verbose` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | LINK-01 | unit | `npx jest scripts/__tests__/background.test.js -t "persistQueue writes" --verbose` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | LINK-02 | unit | `npx jest scripts/__tests__/background.test.js -t "message routing" --verbose` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 1 | LINK-04 | unit | `npx jest scripts/__tests__/background.test.js -t "restoreRequestQueue" --verbose` | ✅ | ⬜ pending |
| 02-02-04 | 02 | 1 | LINK-05 | unit | `npx jest scripts/__tests__/background.test.js -t "Duplicate link" --verbose` | ✅ | ⬜ pending |
| 02-02-05 | 02 | 1 | LINK-06 | unit | `npx jest scripts/__tests__/background.test.js -t "tabs.onRemoved" --verbose` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/__tests__/AddLinksController.test.js` — structural tests for LINK-03 batch send (link concatenation, single API call, error handling retains queue)

*Existing infrastructure covers LINK-01, LINK-02, LINK-04, LINK-05, LINK-06 via `scripts/__tests__/background.test.js`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Right-clicking 5 links shows all 5 in toolbar | LINK-01 | Requires Chrome extension context + real UI | 1. Load extension 2. Right-click 5 links on any page 3. Verify toolbar shows all 5 |
| Real-time toolbar update | LINK-02 | Requires open toolbar + context menu interaction | 1. Right-click one link (toolbar opens) 2. Right-click another link 3. Verify list updates without reopening |
| Batch send to JDownloader | LINK-03 | Requires running JDownloader instance | 1. Queue 3+ links 2. Click "Add links" 3. Verify all appear in JDownloader link grabber |
| Queue survives SW termination | LINK-04 | Requires Chrome DevTools to terminate SW | 1. Queue links 2. Go to chrome://serviceworker-internals 3. Stop the SW 4. Right-click new link 5. Verify previous links still in queue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
