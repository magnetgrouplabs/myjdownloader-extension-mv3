---
phase: 1
slug: bug-fixes-queue-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (JS)** | Jest 27.5.1 |
| **Framework (Rust)** | cargo test (built-in) |
| **Config file (JS)** | `jest.config.js` |
| **Config file (Rust)** | `captcha-helper/Cargo.toml` |
| **Quick run command (JS)** | `npx jest --testPathPattern=__tests__` |
| **Quick run command (Rust)** | `cd captcha-helper && cargo test` |
| **Full suite command** | `npx jest && cd captcha-helper && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest` (JS changes) or `cd captcha-helper && cargo test` (Rust changes)
- **After every plan wave:** Run `npx jest && cd captcha-helper && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | BUG-01, BUG-02 | unit | `npx jest --testPathPattern=Rc2Service` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | BUG-04 | unit | `npx jest --testPathPattern=background` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | BUG-03 | unit | `cd captcha-helper && cargo test serialize` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | BUG-01 | unit | `npx jest --testPathPattern=Rc2Service` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | BUG-02 | unit | `npx jest --testPathPattern=Rc2Service` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | BUG-03 | unit | `cd captcha-helper && cargo test` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | BUG-04 | unit | `npx jest --testPathPattern=background` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/services/__tests__/Rc2Service.test.js` — stubs for BUG-01 (duplicate URL) and BUG-02 (CAPTCHA dedup guard)
- [ ] `scripts/__tests__/background.test.js` — stubs for BUG-04 (queue persistence with mocked chrome.storage.session)
- [ ] Rust unit test for `serialize_response()` helper — stubs for BUG-03
- [ ] Jest setup: mock `chrome.storage.session` API in `jest.setup.js`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CAPTCHA window opens exactly once per challenge | BUG-02 | Requires JDownloader + live CAPTCHA | 1. Start JDownloader download with CAPTCHA 2. Observe only one WebView2 window opens 3. Solve CAPTCHA, verify token submitted |
| Queue survives SW termination in real Chrome | BUG-04 | Service worker lifecycle not mockable in Jest | 1. Right-click link, wait 2+ minutes 2. Right-click another link 3. Both appear in toolbar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
