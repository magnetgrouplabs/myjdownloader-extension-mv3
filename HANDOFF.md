# MyJDownloader Extension (MV3): handoff

Start every session here, then `CLAUDE.md` for the branching, versioning, landmines and testing
rules that do not change with the week. Moved out of `CLAUDE.md` on 2026-09-02 so that dated state
stops loading at every session launch.

Newest block first. The 2026-07-21 block is kept for history and is superseded by the 2026-07-25
block above it; issue #5 and the update-notifier item are restated in "Known-unresolved" at the
bottom, which is the list to work from.

## Where things stand (2026-07-25)

**dev is ahead of master by the update notifier.** PR #16 merged into dev (merge `b783bfb`),
plus the manual check (`a2395ac`). Nothing released: master is still v2026.7.4. Anthony's
call on 2026-07-25 was to hold the release until there is something more substantial to
ship alongside it. `master..dev` is the queue.

What landed in that batch:
- The notifier now orders releases by **publish date**, not version number. The original
  numeric compare was wrong for every user on a July build (see Versioning in `CLAUDE.md`); it is
  kept only as a fallback for builds with no buildMeta.json.
- Manual "Check for updates" in Settings > About, under the version. Four states, and a
  failed check says so instead of looking like a dead link.
- `npm run test:live` verifies the whole notifier path against the real GitHub API without
  cutting a release (see Testing in `CLAUDE.md`).

Suite is 233 tests / 14 suites on dev.

Still not live-verified in a browser: badge rendering, the settings banner, and storage
surviving a service-worker restart. Do that before promoting dev to master.

## Where things stood (2026-07-21)

**v2026.7.4 released** (initially tagged v2026.7.21, pulled and re-released same day under the
new versioning scheme; see the Versioning section in `CLAUDE.md`). The whole batch shipped from
master after live verification:
PRs #10 (CNL cleartext direct), #11 (device selection), #12 (real 3s auto-send countdown,
behavior change, called out in release notes), #13 (offscreen warm start) plus a hardening
fix for storage-crippled offscreen documents, #14 (dark mode), #17 (CI action bumps), and
the issue #15 fix (selection context menu path was dead; background now handles the
content script's "new-selection" reply). All CNL transports (fetch/XHR/form, cleartext and
encrypted) verified live against Anthony's Docker JD through the cloud API. Badge clears
on its own after browser start, verified on a cold start.

**CI is real now:** PRs into dev run the full Jest suite (215 tests / 12 suites) plus
security scanning. package-lock.json is committed (was gitignored). Dependency graph
enabled in repo settings so the dependency-review job works. ci.yml/security.yml trigger
on master AND dev (they only covered master/nonexistent main before; that gap meant zero
CI on dev PRs after the pipeline switch).

**Open items:**
- Issue #5 (CAPTCHA, Brave + now Vivaldi): the only open issue. Still blocked on nobody
  having a captcha-gated link. CAPTCHA remains never confirmed end-to-end anywhere.
  2026-07-25: Krux86 (a third party) asked Myrothas the right question, whether the tab
  URL starts with `http://127.0.0.1`. Reading the code around that question turned up
  concrete browser-agnostic bugs; see "CAPTCHA path selection" under Landmines in `CLAUDE.md`.
  Not fixed, nothing posted on the issue.
- PR #16 (update notifier): merged to dev 2026-07-25. Live browser verification still owed
  before it promotes to master.

**Testing tool:** a CNL test page (simulates hoster Click'n'Load via fetch/XHR/form +
encrypted payloads against 127.0.0.1:9666) was built in the 2026-07-21 session scratchpad;
scratchpads are disposable, so recreate it from the interceptor's endpoints if needed, or
ask Anthony whether to commit it to the repo as a dev tool.

**Parked ideas:** Chrome Web Store publication (would give real auto-updates and a beta
channel fed from dev) is blocked on license/trademark questions re AppWork GmbH. If it
ever unparks: the MAIN-world hooks and CAPTCHA CSP-stripping need disclosure text for
review; both are compliant but scrutiny magnets.

## Test counts as last recorded

2026-07-25: 233 tests / 14 suites on dev; master is behind at v2026.7.4 with 215 / 12. The count
grows as PRs merge, so treat these as a snapshot and run `npx jest` for the real number.

## Known-unresolved

- **CAPTCHA has never been confirmed end-to-end.** The callback path was dead code (service-worker
  XHR) until v2026.07.13. Nobody has yet watched a token actually reach JDownloader. Needs a
  captcha-gated hoster link to test. As of 2026-07-25 there are also concrete unfixed bugs in
  the path-selection logic (see Landmines in `CLAUDE.md`), which may be the whole story.
- **Issue #5**: CAPTCHA fails in Brave, and in Vivaldi. Not browser-specific after all.
  Left open; Anthony uses neither browser.
- **Update notifier is unverified in a browser.** The logic is proven against the live API
  via `npm run test:live`, but the badge, the settings banner, and storage surviving a
  service-worker restart have not been watched in Chrome. Owed before dev promotes to master.
