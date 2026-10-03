# MyJDownloader Extension (MV3): handoff

Start every session here, then `CLAUDE.md` for the branching, versioning, landmines and testing
rules that do not change with the week. Moved out of `CLAUDE.md` on 2026-09-02 so that dated state
stops loading at every session launch.

Newest block first. Every block below the 2026-10-03 one is kept for history and is superseded by
it; the open items are restated in "Known-unresolved" at the bottom, which is the list to work from.

## Where things stand (2026-10-03)

**v2026.10.1 released 2026-10-03.** dev was merged into master as `e740632` (tree identical to dev
`9767fcf`), tagged `v2026.10.1`; the release workflow was green and the zip is published. Release notes
were rewritten by hand after publish (as for v2026.7.4). CI green on master. `master..dev` is now empty.

Contents: update notifier (#16), PR #23 (CAPTCHA provider script in the MAIN world), issue #20 clipboard
fix, issue #21 device panel fix, feedback form removal. The notes call out the Start/Pause/Stop behavior
change and point CAPTCHA to tracker #24 as in progress.

**Released without the owed browser pass, Anthony's call.** Never watched in a real browser: the clipboard
observer, the update notifier's badge, settings banner and storage across a worker restart. The device
panel was confirmed on dev by the #21 reporter (matand77, 2026-09-22). Issues #20 and #21 are closed with
"shipped in v2026.10.1" comments.

**PR #26 (daailouivan, first-time contributor): consumer for the my.jdownloader.org web-interface captcha
path.** CI runs were approved by us: 331/331, 20 suites, security clean. MV3 clean by reading. Review
verdict HOLD, three must-fix:
- (a) It answers the web interface's ping by default, which makes the site hand reCAPTCHA v2 jobs to a
  "Solve Captcha" button that opens `hoster#rc2jdt?k=..&c=<id>`, a tab nothing in #26 serves.
- (b) `captcha-solved` adopts the parked session job when callbackUrl is missing (`background.js:1250-1253`
  at `8f0e1bb`), so a token from any unrelated captcha page can be sent to JD.
- (c) One shared `myjd_captcha_job` session slot, so two pending captchas can cross.

Nothing posted on #26 yet. #26 does not replace #18's handshake fixes (remembered early ping,
content-script fallback, live setting push, behavioral tests).

**PR #19** unchanged since 2026-07-26; Anthony chose to leave it for now (no nudge posted). Remaining:
widen the `browserSolverBridge.js:30` gate to recaptchav2/v3; suppress the duplicate solver UI on the
#rc2jdt tab (#26's early return does this); awaiting the CSP rule before navigating would help (inferred).
dev+19 merges clean alone; #19 and #26 together conflict in 5 files, all mechanical.

**PR #18** still held; it now conflicts with dev in one STORAGE_KEYS hunk.

**Issue #25** (2026-09-11, uploady.io, reCAPTCHA v2, Vivaldi, v2026.7.4) is the same root cause as #22;
not yet replied to.

**Web Store policy, found 2026-10-03:** the Chrome Web Store MV3 remote-code policy prohibits "Including a
<script> tag that points to a resource that is not within the extension's package", exempting contexts
isolated from extension APIs such as iframes and sandboxed pages; it does not say whether a page's main
world counts. PR #23 (now released) does that. Matters only if Web Store publication unparks.

**Dependabot:** the master push reported 19 alerts on the default branch (9 high); the July count was 15,
all development scope. Not re-checked.

**Tracker #24** body updated 2026-10-03: #23 marked released in v2026.10.1, #26 listed as under review
(separate web-interface path, not the fix for #5, #22 or #25), #25 added to Related.

Full review: the local claude-reports folder, dated 2026-10-03.

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

History: this pass was skipped and v2026.10.1 shipped on 2026-10-03 (see the block above). The CAPTCHA
end to end item is carried in "Known-unresolved".

**Posted 2026-09-11:** fixed-on-dev replies on #20 and #21 (left open until the release), the root-cause reply
on #22, and the pinned tracker #24 "CAPTCHA status: what works, what is pending, how to help". The full
review report is in the local claude-reports folder, dated 2026-09-11.

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

2026-10-03: master and dev have identical content at the release; 297 tests / 17 suites as last
recorded on 2026-09-11 (not re-run locally; CI green on master `e740632`).

2026-09-11: 297 tests / 17 suites on dev; master is behind at v2026.7.4 with 215 / 12. The count
grows as PRs merge, so treat these as a snapshot and run `npx jest` for the real number.

## Known-unresolved

- **CAPTCHA has never been confirmed end-to-end by us.** Root cause known since 2026-09-11 (JD's
  solver pages need the extension to take the challenge over; MV3 never did). PR #19 waiting on its
  author, PR #26 held with three must-fix items, one third-party success report (Morialkar, hCaptcha,
  Vivaldi). Test links: datavaults.co (reCAPTCHA v2, #22), ddownload.com (hCaptcha, #5).
- **Issues #5, #22 and #25** stay open until #19 lands and someone confirms on the thread.
- **Open question before any live loopback test:** whether the Docker JDownloader can open a
  browser-solver tab in Chrome on the Windows desktop at all. If not, the test needs a desktop
  JDownloader on the same PC.
- **Feedback form removed** (`cf9c4b7`, merged `7c6897d`): it sent `send-feedback`, which background.js only
  acknowledged, so nothing ever left the browser. Orphaned `.feedbackPanel` CSS in styles/main.css and the
  unused `STORAGE_FEEDBACK_MSG_DRAFT` constant remain; harmless.
- **Update notifier and clipboard observer: released, never watched in a real browser.** The notifier
  logic is proven against the live API via `npm run test:live`, but the badge, the settings banner, and
  storage surviving a service-worker restart have not been watched in Chrome.
- **Pre-existing dead branch:** the `webinterfaceEnhancer.js` 'captcha-done' branch is unreachable
  (identical condition above it). Not fixed.
