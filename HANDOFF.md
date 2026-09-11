# MyJDownloader Extension (MV3): handoff

Start every session here, then `CLAUDE.md` for the branching, versioning, landmines and testing
rules that do not change with the week. Moved out of `CLAUDE.md` on 2026-09-02 so that dated state
stops loading at every session launch.

Newest block first. The 2026-07-21 block is kept for history and is superseded by the 2026-07-25
block above it; issue #5 and the update-notifier item are restated in "Known-unresolved" at the
bottom, which is the list to work from.

## Where things stand (2026-09-11)

**dev is ahead of master by the update notifier plus three fixes, all pushed (`9f37da6`).** CI green
on dev. Nothing released; master is still v2026.7.4. `master..dev` is the queue.

Landed on dev today:
- PR #23 (BlackScript) merged as `a2b2373`: the CAPTCHA provider script is loaded in the MAIN world
  via `chrome.scripting`, because a `<script src>` appended from a content script is blocked by the
  isolated-world CSP (Chrome docs, and a live console capture by Morialkar on PR #19). Before this the
  widget never rendered.
- Issue #21 fix (`b576059`): the popup device panel now polls its device in process every 4 s and
  routes Start/Pause/Stop through the direct cloud client. Nothing polled in any MV3 build, and the
  three buttons were dead too (their message had no handler and the ack was mistaken for success).
  Contract test `backgroundMessageContract.test.js` now fails on any popup action background.js only
  acknowledges (no allowlist left since the feedback form was removed, see below).
- Issue #20 fix (`fb3412e`): clipboard observer wired (setting read by the service worker, copy event
  handled, Ctrl+Shift+X command listener). Copy path opens the toolbar only when the selection carries
  a link; right-click path unchanged. Never worked in any MV3 build; not Brave-specific.
- `9f37da6`: dead device-poll stubs removed from background.js.

Suite is 297 tests / 17 suites on dev.

**Root cause of the whole CAPTCHA saga, verified against JDownloader's source (mirror/jdownloader
master):** recaptcha.html and hcaptcha.html are byte-identical "install the extension" pages with no
widget. The MV2 extension read their meta tags and took the challenge over on the hoster's domain; MV3
never ported that hand-off. PR #19 (BlackScript) adds it but only for hCaptcha; review posted
2026-09-11 asking for the gate to cover recaptchav2/v3 (that is issue #22) and for the duplicate
solver UI on the hoster page to be suppressed. PR #18 (web-interface ping) was held with a review:
it announces a capability whose consumer (Rc2Service) was never ported, and it does not touch
JDownloader's pages. Both reviews are on GitHub under magnetgrouplabs.

**Owed before promoting dev to master (one browser pass, Docker JD):**
- Device panel: status row fills in, Pause really pauses JD, two devices update independently.
- Clipboard: copied link opens the toolbar, copied sentence does not, Ctrl+Shift+X flips the setting,
  setting survives a service-worker restart.
- CAPTCHA end to end: once PR #19 is resubmitted, add a datavaults.co link (reCAPTCHA v2, issue #22)
  and a ddownload.com link (hCaptcha, issue #5) with the browser solver on, and watch for `do=solve`
  in JD's log. Nobody on our side has ever seen this succeed; Morialkar has, for hCaptcha, on Vivaldi.
- Update notifier items from the 2026-07-25 block below.

**Not posted yet:** replies on issues #20, #21, #22 and the CAPTCHA tracking issue (Anthony approved
the idea, text not drafted). The full review report is in the local claude-reports folder, dated
2026-09-11.

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

2026-09-11: 297 tests / 17 suites on dev; master is behind at v2026.7.4 with 215 / 12. The count
grows as PRs merge, so treat these as a snapshot and run `npx jest` for the real number.

## Known-unresolved

- **CAPTCHA has never been confirmed end-to-end by us.** Root cause known since 2026-09-11 (JD's
  solver pages need the extension to take the challenge over; MV3 never did). PR #23 merged, PR #19
  awaiting the author's changes. One third-party success report (Morialkar, hCaptcha, Vivaldi).
  Test links: datavaults.co (reCAPTCHA v2, #22), ddownload.com (hCaptcha, #5).
- **Issues #5 and #22** stay open until #19 lands and someone confirms on the thread.
- **Feedback form removed** (`cf9c4b7`, merged `7c6897d`): it sent `send-feedback`, which background.js only
  acknowledged, so nothing ever left the browser. Orphaned `.feedbackPanel` CSS in styles/main.css and the
  unused `STORAGE_FEEDBACK_MSG_DRAFT` constant remain; harmless.
- **Update notifier is unverified in a browser.** The logic is proven against the live API
  via `npm run test:live`, but the badge, the settings banner, and storage surviving a
  service-worker restart have not been watched in Chrome. Owed before dev promotes to master.
