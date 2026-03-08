---
phase: 07-requirements-docs-cleanup
plan: 01
subsystem: documentation
tags: [requirements, roadmap, cleanup, audit-closure]
dependency_graph:
  requires: [v1.0-MILESTONE-AUDIT.md]
  provides: [corrected-requirement-text, synced-roadmap]
  affects: [REQUIREMENTS.md, ROADMAP.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
decisions:
  - "CAP-06 marked complete — no countdown timer matches implementation and CLAUDE.md"
  - "CAP-08 marked complete — web tab only, native helper abandoned"
  - "TEST-03 text corrected but kept unchecked — verification deferred to Phase 8"
metrics:
  duration: 2min
  completed: 2026-03-08
---

# Phase 07 Plan 01: Fix Obsolete Requirement Text & Sync ROADMAP Summary

Corrected 5 requirement descriptions (CAP-06, CAP-08, TEST-03, CWS-01, CWS-05) to match actual implementation — removed native helper, nativeMessaging, and countdown timer references identified by v1.0 milestone audit.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Fix obsolete requirement text in REQUIREMENTS.md | `2c8f780` | CAP-06/CAP-08 text+checkbox, TEST-03/CWS-01/CWS-05 text, traceability table |
| 2 | Sync ROADMAP checkboxes and progress to reality | (no changes needed) | ROADMAP already synced during Phase 7 planning |

## Changes Made

### Task 1: REQUIREMENTS.md corrections
- **CAP-06**: Changed from "5-minute timeout countdown displayed" to "No countdown timer"; marked `[x]`
- **CAP-08**: Changed from "Dual-mode: uses native helper" to "Web tab CAPTCHA solving only"; marked `[x]`
- **TEST-03**: Changed from "Both web tab and native helper modes" to "Web tab mode tested"; kept `[ ]`
- **CWS-01**: Removed `nativeMessaging` from permission justification list
- **CWS-05**: Changed from "including native helper requirement" to "(web tab CAPTCHA, no native helper)"
- **Traceability**: CAP-06 and CAP-08 updated to Phase 4, 7 / Complete

### Task 2: ROADMAP verification
No changes required. Phase 3/5/6 checkboxes were already `[x]`, plan counts already in N/N format, Phase 7 already listed with 1 plan, progress table already showing 0/1 In Progress. All corrections were made during Phase 7 planning before this plan was created.

## Deviations from Plan

### Task 2 — No changes needed
- **Found during:** Task 2 execution
- **Issue:** ROADMAP.md was already in the correct state — all checkboxes, counts, and progress table entries specified by the plan were already updated during Phase 7 planning
- **Action:** Verified all items correct, no commit created (no changes to commit)
- **Impact:** None — the plan's goal (accurate ROADMAP) was already met

## Decisions Made

1. **CAP-06 marked complete** — Implementation correctly has no countdown timer; CLAUDE.md and Phase 4 success criteria #6 confirm this is intended behavior
2. **CAP-08 marked complete** — Web tab CAPTCHA solving is fully implemented; native helper was abandoned per project decision
3. **TEST-03 kept unchecked** — Text corrected to reflect reality but verification deferred to Phase 8

## Verification Results

| Check | Result |
|-------|--------|
| CAP-06 says "No countdown timer" | PASS |
| CAP-08 says "Web tab CAPTCHA solving only" | PASS |
| TEST-03 says "Web tab mode tested" | PASS |
| CWS-01 does not contain "nativeMessaging" | PASS |
| CWS-05 does not contain "native helper requirement" | PASS |
| Phase 3/5/6 plan checkboxes show [x] | PASS |
| Phase 7 shows 1 plan in ROADMAP | PASS |

## Self-Check: PASSED
