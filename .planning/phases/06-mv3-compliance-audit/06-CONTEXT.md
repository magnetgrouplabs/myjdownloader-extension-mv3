# Phase 6: MV3 Compliance Audit - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure the extension is 100% Manifest V3 compliant and ready for handoff to JDownloader developers for Chrome Web Store submission. This is a technical audit, not a store submission — no privacy policy, screenshots, or listing copy needed. Focus is on code compliance so the handoff doesn't contain MV3 violations.

</domain>

<decisions>
## Implementation Decisions

### Permission cleanup
- Remove `nativeMessaging` from manifest.json — native helper is abandoned and unused
- Keep localhost:9666 host_permissions — other users may run JDownloader locally; the localhost CAPTCHA flow still uses these
- Keep `<all_urls>` — content scripts need it for CAPTCHA solving on arbitrary domains
- Audit remaining permissions (tabs, storage, declarativeNetRequest, contextMenus, scripting, alarms, offscreen) — document justification for each

### RequireJS/AngularJS eval audit
- Audit and document all eval/Function() usage in vendor files
- Identify which are dead code vs reachable code paths
- Flag any that Chrome would reject during MV3 review
- Do NOT patch vendor files — document findings for JD developers to decide
- Include RequireJS's eval path (CWS-03) specifically

### postMessage wildcards
- Document `window.postMessage(msg, '*')` in webinterfaceEnhancer.js as a finding
- Do NOT fix it — leave for JD developers to decide (they may have reasons for the wildcard)
- Note the recommended fix: replace `'*'` with `'https://my.jdownloader.org'`

### Scope
- No privacy policy creation (CWS-02) — JD devs handle this
- No store listing/screenshots (CWS-05, CWS-06) — JD devs handle this
- No extension description updates — JD devs handle this
- Focus: CWS-01 (permissions), CWS-03 (eval), CWS-04 (CSP), CWS-07 (postMessage)

### Claude's Discretion
- How to structure the compliance audit document
- CSP violation testing approach
- Depth of eval/Function() tracing in vendor code

</decisions>

<specifics>
## Specific Ideas

- This is a handoff to JDownloader developers — the audit document should be professional and thorough so "we don't look foolish"
- JD developers will handle store submission, privacy policy, and listing
- The deliverable is a compliance report they can act on, not code changes to vendor files

</specifics>

<code_context>
## Existing Code Insights

### Permissions in manifest.json
- `tabs` — used for CAPTCHA tab management, toolbar injection
- `storage` — chrome.storage.session and chrome.storage.local
- `declarativeNetRequest` — CSP stripping for CAPTCHA tabs
- `contextMenus` — "Download with JDownloader" context menu
- `scripting` — MAIN world CAPTCHA execution (v3/invisible)
- `alarms` — periodic checks
- `offscreen` — API operations when popup closed
- `nativeMessaging` — ABANDONED, needs removal
- `<all_urls>` — content scripts on all pages
- `localhost:9666` — JDownloader local API

### Known eval/Function() locations
- `vendor/js/angular-animate.js`
- `vendor/js/angular-resource.js`
- `vendor/js/angular-route.js`
- `vendor/js/angular-sanitize.js`
- `vendor/js/angular-touch.js`
- RequireJS loader (if present)

### Known postMessage wildcard
- `contentscripts/webinterfaceEnhancer.js` — `window.postMessage(msg, "*")`

### Dead code finding from Phase 5
- `webinterfaceEnhancer.js` lines 56-64: unreachable `captcha-done` branch (duplicate condition)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-mv3-compliance-audit*
*Context gathered: 2026-03-08*
