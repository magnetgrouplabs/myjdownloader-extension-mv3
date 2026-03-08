# Phase 6: MV3 Compliance Audit - Research

**Researched:** 2026-03-08
**Domain:** Chrome Extension Manifest V3 compliance, Chrome Web Store review requirements
**Confidence:** HIGH

## Summary

This phase is a technical audit producing a professional compliance report for JDownloader developers, plus a one-line code change (removing `nativeMessaging` from manifest.json) and a README update. The extension is already MV3-compliant in architecture -- the audit documents and verifies that compliance.

The extension uses AngularJS with `ng-csp` on all UI pages (popup.html, toolbar.html), which correctly prevents AngularJS from using dynamic code generation at runtime by routing expression parsing through `ASTInterpreter` instead of `ASTCompiler`. RequireJS's text-execution path (`req.exec`) is dead code -- it is only invoked for "transpiling loader plugins" per RequireJS's own documentation, and this extension only uses plain `define()` module declarations. The offscreen document does NOT have `ng-csp` but also does not use AngularJS -- it only loads jQuery, CryptoJS, and jdapi via RequireJS. The critical question is whether Chrome's static analysis during CWS review will flag the _presence_ of restricted constructs in vendor code even if they are dead code -- this should be documented as a known consideration in the compliance report.

**Primary recommendation:** Remove `nativeMessaging` from manifest.json, document all permission justifications, audit restricted code paths to confirm they are dead code, run CSP violation checks on all extension pages, document the `postMessage('*')` wildcard as a finding, and produce a professional compliance report for JD developers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove `nativeMessaging` from manifest.json -- native helper is abandoned and unused
- Keep localhost:9666 host_permissions -- other users may run JDownloader locally; the localhost CAPTCHA flow still uses these
- Keep `<all_urls>` -- content scripts need it for CAPTCHA solving on arbitrary domains
- Audit remaining permissions (tabs, storage, declarativeNetRequest, contextMenus, scripting, alarms, offscreen) -- document justification for each
- Audit and document all dynamic code generation usage in vendor files
- Identify which are dead code vs reachable code paths
- Flag any that Chrome would reject during MV3 review
- Do NOT patch vendor files -- document findings for JD developers to decide
- Include RequireJS's restricted code path (CWS-03) specifically
- Document `window.postMessage(msg, '*')` in webinterfaceEnhancer.js as a finding
- Do NOT fix postMessage -- leave for JD developers to decide (they may have reasons for the wildcard)
- Note the recommended fix: replace `'*'` with `'https://my.jdownloader.org'`
- No privacy policy creation (CWS-02) -- JD devs handle this
- No store listing/screenshots (CWS-05, CWS-06) -- JD devs handle this
- No extension description updates -- JD devs handle this
- Focus: CWS-01 (permissions), CWS-03 (restricted code), CWS-04 (CSP), CWS-07 (postMessage)
- Add a "MV2 to MV3 Migration" table to the README

### Claude's Discretion
- How to structure the compliance audit document
- CSP violation testing approach
- Depth of restricted code tracing in vendor code

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CWS-01 | Every permission has written justification | Full manifest.json audit completed; all 8 permissions and 3 host_permissions catalogued with usage evidence |
| CWS-02 | Privacy policy created and hosted | OUT OF SCOPE per CONTEXT.md -- JD devs handle this. Document as "handoff item" in compliance report |
| CWS-03 | RequireJS restricted code path audited -- confirmed dead or patched to throw | RequireJS `req.exec` at line 2140 confirmed dead code (only for loader plugins); AngularJS dynamic code gen bypassed by ng-csp; rx.all.js global detection runs once at init |
| CWS-04 | No CSP violation warnings in any extension page console | Testing approach: load extension, check popup/toolbar/offscreen DevTools consoles for CSP errors |
| CWS-05 | Extension description accurately reflects MV3 features | OUT OF SCOPE per CONTEXT.md -- JD devs handle this |
| CWS-06 | At least 2 screenshots showing core features | OUT OF SCOPE per CONTEXT.md -- JD devs handle this |
| CWS-07 | postMessage wildcard origins replaced with specific origin strings | Document as finding per CONTEXT.md -- do NOT fix, recommend `'https://my.jdownloader.org'` |
</phase_requirements>

## Standard Stack

This phase produces documentation and a minor manifest change, not new features. No additional libraries needed.

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| Chrome DevTools | CSP violation detection in extension page consoles | Only way to verify runtime CSP compliance |
| Manual code audit | Restricted code tracing in vendor files | Static analysis of known locations |
| manifest.json editing | Permission removal (nativeMessaging) | Direct manifest modification |

### No New Dependencies
This is an audit phase. All work is documentation, one manifest.json edit, and one README update.

## Architecture Patterns

### Compliance Report Structure
The compliance report should be structured as a standalone document that JD developers can use without context about our development process:

```
.planning/phases/06-mv3-compliance-audit/
  06-COMPLIANCE-REPORT.md    # The main deliverable for JD developers
```

### Recommended Report Sections
```
1. Executive Summary
2. Permission Audit (CWS-01)
   - Permission table with justification
   - Removed permissions
   - Recommendations
3. Code Safety Audit (CWS-03)
   - Dynamic code generation inventory
   - Dead code vs reachable analysis
   - Risk assessment
4. CSP Compliance (CWS-04)
   - Test results per extension page
   - Findings
5. postMessage Security (CWS-07)
   - Wildcard usage inventory
   - Recommended fixes
6. Handoff Items
   - Privacy policy (CWS-02)
   - Store listing (CWS-05, CWS-06)
7. MV2 to MV3 Migration Summary
```

### Anti-Patterns to Avoid
- **Over-engineering the audit:** This is a document, not a code rewrite. Do not patch vendor files.
- **Burying findings:** Each finding should be clearly categorized as PASS/FINDING/BLOCKER so JD developers can prioritize.
- **Missing evidence:** Every claim should cite specific file:line or test result.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP violation detection | Custom CSP parser | Chrome DevTools console | The browser itself is the authoritative source of CSP violations |
| Restricted code scanning | Automated scanner | Manual grep + code reading | Limited set of known locations; manual tracing confirms dead vs reachable |
| Permission justification | Generated docs | Manual write-up per permission | Each justification requires understanding of actual usage context |

## Common Pitfalls

### Pitfall 1: Confusing Code Presence with Code Execution
**What goes wrong:** Reporting restricted constructs in vendor code as a violation when they are never executed at runtime.
**Why it happens:** Static grep finds such patterns in angular.js, require.js, rx.all.js -- but ng-csp prevents AngularJS from using them, and RequireJS's text-execution path is for loader plugins only.
**How to avoid:** Trace each instance to determine if it is reachable in the extension's actual code paths.
**Warning signs:** Reporting "angular.js contains restricted code" without noting ng-csp disables it.

### Pitfall 2: Missing the rx.all.js Global Detection
**What goes wrong:** Overlooking that rx.all.js line 21 uses a `Function` constructor call as the last fallback in a global-object detection chain.
**Why it happens:** It is part of the module initialization code.
**How to avoid:** Document it as a finding. Analyze the short-circuit chain: in browser contexts, earlier checks (`freeWindow`, `freeSelf`, `thisGlobal`) resolve truthy BEFORE this fallback is reached. Verify by checking the console for CSP errors at runtime.
**Warning signs:** CSP error in console about code evaluation being refused.

### Pitfall 3: Reporting offscreen.html ng-csp Missing as a Bug
**What goes wrong:** Flagging that offscreen.html lacks ng-csp.
**Why it happens:** offscreen.html does not use AngularJS -- it loads jQuery, CryptoJS, RequireJS, and jdapi directly.
**How to avoid:** offscreen.html does not need ng-csp because it has no Angular templates to parse.

### Pitfall 4: web_accessible_resources Exposing Test Files
**What goes wrong:** CWS review may question why `captcha-helper/test-native-messaging.html` and `captcha-helper/test-native-messaging.js` are in web_accessible_resources.
**Why it happens:** These are legacy test files for the abandoned native helper.
**How to avoid:** Document this as a finding -- recommend removing these from web_accessible_resources (and possibly from the extension entirely).

### Pitfall 5: CaptchaNativeService.js Still Loaded via Script Tag
**What goes wrong:** popup.html line 43 loads `scripts/services/CaptchaNativeService.js` via a script tag. The service is registered in Angular DI even though it is not injected anywhere.
**Why it happens:** The file was kept on disk per a prior decision, but it is still loaded by popup.html.
**How to avoid:** Document as finding. Removing the script tag (and potentially the file) reduces attack surface and removes dead code. The nativeMessaging permission removal makes this service non-functional anyway.

## Code Examples

### Permission Justification Format
```markdown
| Permission | Justification | Used By |
|-----------|---------------|---------|
| `tabs` | CAPTCHA tab management, toolbar injection, tab close detection | background.js, Rc2Service.js |
| `storage` | Session/settings persistence, CAPTCHA job transfer, request queue | background.js, offscreen.js, content scripts |
| `declarativeNetRequest` | CSP header stripping on CAPTCHA tabs, CNL localhost rules | background.js |
| `contextMenus` | "Download with JDownloader" right-click menu | background.js |
| `scripting` | MAIN world CAPTCHA execution (v3/invisible), toolbar injection | background.js |
| `alarms` | Service worker keep-alive (4-min interval) | background.js |
| `offscreen` | Offscreen document for jdapi operations needing DOM/localStorage | background.js, offscreen.js |
| ~~`nativeMessaging`~~ | **REMOVED** -- native helper abandoned | (was CaptchaNativeService.js) |
```

### Restricted Code Audit Entry Format
```markdown
#### require.js line 2140: req.exec text-execution path
- **Purpose:** Execute text for transpiling loader plugins
- **Reachable?:** NO -- only called by loader plugins (text!, css!, etc.).
  Extension uses only define() and require() with pre-bundled modules.
- **Risk:** NONE at runtime. Presence may trigger static analysis during CWS review.
- **Recommendation:** Document for JD developers. Future MOD-01 eliminates this.
```

### postMessage Finding Format
```markdown
#### webinterfaceEnhancer.js line 54: window.postMessage(msg, "*")
- **Context:** Reroutes myjdrc2 messages from chrome.runtime.onMessage
  to window context on my.jdownloader.org
- **Risk:** LOW -- content script only runs on *://my.jdownloader.org/*,
  so wildcard is functionally scoped. However, any listener on the page
  can intercept the message.
- **Recommended fix:** Replace "*" with "https://my.jdownloader.org"
- **Note:** Line 18 window.parent.postMessage correctly uses specific origin.
```

## Detailed Findings: Dynamic Code Generation Inventory

### HIGH CONFIDENCE findings from code analysis:

| File | Line | Code | Reachable? | Risk |
|------|------|------|-----------|------|
| `vendor/js/require.js` | 2140 | `req.exec` text-execution | NO -- only for loader plugins, not plain modules | None at runtime |
| `vendor/js/angular.js` | 1292 | CSP detection probe | NO -- skipped when `ng-csp` attribute present (lines 1269-1278) | None |
| `vendor/js/angular.js` | 16548 | ASTCompiler dynamic function generation | NO -- `ASTCompiler` not used when `csp: true` (line 17339 routes to `ASTInterpreter`) | None |
| `vendor/js/angular.js` | 28962 | Code in documentation example string | NO -- inside a doc block, not executable | None |
| `vendor/js/rx.all.js` | 21 | Global object detection fallback via Function constructor | Short-circuited in browser contexts | LOW |
| `vendor/js/rx.all.js` | 1303 | `root.postMessage('', '*')` async scheduling test | MAYBE -- feature detection | LOW -- internal |
| `vendor/js/rx.all.js` | 1341 | `root.postMessage(MSG_PREFIX + id, '*')` | MAYBE -- if postMessage scheduling chosen | LOW -- internal with unique prefix |

### AngularJS ng-csp Analysis (HIGH CONFIDENCE)

The `ng-csp` directive on `<body>` in popup.html (line 13) and toolbar.html (line 14) triggers this behavior:
1. Line 1272-1278: When `[ng-csp]` element is found, `noUnsafeEval` is set to `true` directly from the attribute -- the CSP detection probe at line 1292 is **never called**
2. Line 17339: `this.astCompiler = options.csp ? new ASTInterpreter($filter) : new ASTCompiler(...)` -- with csp=true, the `ASTInterpreter` is used, which does NOT use dynamic code generation
3. Result: **AngularJS never dynamically generates code at runtime** when ng-csp is present

### offscreen.html Analysis (HIGH CONFIDENCE)

offscreen.html does NOT have `ng-csp` and does NOT load AngularJS. It loads:
- jQuery (no dynamic code generation in core paths)
- CryptoJS (no dynamic code generation)
- RequireJS (text-execution only in `req.exec` for loader plugins -- dead code for `define()`/`require()` calls)
- jdapi.js via RequireJS (no dynamic code generation -- uses only `define()`)

### rx.all.js Global Detection Deep Dive

Line 21 of rx.all.js uses a fallback chain to find the global object:
```javascript
var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window))
  && freeWindow) || freeSelf || thisGlobal || /* final fallback */;
```

In a Chrome extension context:
- `freeGlobal` = undefined (no Node.js global)
- `freeWindow` = the window object (extension pages have window)
- `thisGlobal` = window (in non-strict mode)

Since `freeWindow` is truthy and `thisGlobal.window === freeWindow`, the expression `(freeWindow !== (thisGlobal && thisGlobal.window))` evaluates to FALSE. Then `freeSelf` or `thisGlobal` will be truthy, so the final fallback is **never reached** due to short-circuit evaluation.

**Confidence:** HIGH -- this is standard UMD global detection; the final fallback only runs if all window/self/this references fail, which does not happen in browser contexts.

## postMessage Wildcard Inventory

| File | Line | Code | Target | Risk |
|------|------|------|--------|------|
| `webinterfaceEnhancer.js` | 54 | `window.postMessage(msg, "*")` | Same window (my.jdownloader.org) | LOW -- only runs on my.jdownloader.org |
| `webinterfaceEnhancer.js` | 18 | `window.parent.postMessage({...}, e.origin)` | Parent frame | SAFE -- uses specific origin |
| `rx.all.js` | 1303 | `root.postMessage('', '*')` | Self (async detect) | SAFE -- internal scheduling test |
| `rx.all.js` | 1341 | `root.postMessage(MSG_PREFIX + id, '*')` | Self (scheduling) | SAFE -- internal with unique prefix |

Only `webinterfaceEnhancer.js` line 54 is a real finding per CWS-07.

## Dead Code in webinterfaceEnhancer.js

Lines 56-64 contain an unreachable `captcha-done` branch (identified in Phase 5):
```javascript
} else if (msg.type !== undefined && msg.name !== undefined
           && msg.data !== undefined) {
    if (msg.type === "myjdrc2" && msg.name === "captcha-done") {
```
This condition is identical to the one on line 51, so it can never be reached (the first branch catches all matching messages). Document as a finding.

## CSP Testing Approach

### What to Test
1. **popup.html** -- Open extension popup, check DevTools console for CSP errors
2. **toolbar.html** -- Right-click a link to trigger toolbar, check iframe's console
3. **offscreen.html** -- Trigger any API operation, inspect offscreen document console
4. **background.js** -- Service worker console (chrome://extensions > inspect views: service worker)
5. **loginNeeded.html** -- Open directly, check console (this page has inline `<style>` but no scripts)

### Expected CSP Policy
MV3 default for extension pages: `script-src 'self'; object-src 'self';`
- No dynamic code execution allowed
- No inline scripts (inline styles are OK per default policy)
- External scripts from extension package only

### How to Test
Load the extension, exercise each page, and check the console for:
- "Refused to evaluate a string as JavaScript..." CSP errors
- "Refused to execute inline script..." CSP errors
- Any other CSP-related console errors

### loginNeeded.html Note
This file has an inline `<style>` tag (lines 7-36). This is CSS, not JavaScript, and is allowed under MV3 default CSP (which only restricts script-src, not style-src). No issue.

## web_accessible_resources Findings

Current `web_accessible_resources` in manifest.json:
```json
{
  "resources": [
    "toolbar.html",
    "autograbber-indicator.html",
    "captcha-helper/test-native-messaging.html",
    "captcha-helper/test-native-messaging.js"
  ],
  "matches": ["*://*/*"]
}
```

Findings:
1. **`captcha-helper/test-native-messaging.html` and `.js`** -- Legacy test files for abandoned native helper. Should be removed from web_accessible_resources. Consider removing files entirely.
2. **`autograbber-indicator.html`** -- Has a `<script src="/contentscripts/">` tag pointing to a directory, not a file. This is non-functional but harmless. Should be documented as dead code.
3. **`toolbar.html`** -- Correctly exposed, needed for iframe injection into web pages.

## MV2 to MV3 Migration Table (for README)

Per CONTEXT.md, add a migration summary table to the README:

```markdown
## MV2 to MV3 Migration

| MV2 Approach | MV3 Replacement | Why |
|-------------|-----------------|-----|
| Background page (persistent) | Service worker (event-driven) | MV3 requires non-persistent background |
| chrome.tabs.executeScript() | chrome.scripting.executeScript() | New API with world targeting |
| Inline script injection for CAPTCHAs | External script elements + content scripts | MV3 CSP prohibits inline scripts |
| chrome.browserAction | chrome.action | API renamed in MV3 |
| localStorage in background page | chrome.storage.session + offscreen document | Service workers have no DOM |
| Unrestricted CSP | Default script-src self + ng-csp | MV3 enforces strict CSP |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 background pages | MV3 service workers | Chrome 88+ (Jan 2021) | Extension already converted |
| chrome.tabs.executeScript | chrome.scripting.executeScript | MV3 | Extension already using new API |
| Unrestricted CSP in extensions | Strict CSP enforced | MV3 | ng-csp handles this for AngularJS |
| MV2 extensions accepted in CWS | MV2 being phased out | June 2025 deadline | This extension is MV3 already |

## Open Questions

1. **rx.all.js global detection -- Does it actually error?**
   - What we know: Short-circuit evaluation should prevent the fallback from executing in browser contexts
   - What is unclear: Whether Chrome's static analysis flags this during CWS review even if it never runs
   - Recommendation: Verify by loading popup.html and checking console. Document actual runtime behavior.

2. **Will CWS review flag restricted code presence in RequireJS even if dead code?**
   - What we know: Chrome does static analysis during review; restricted constructs are present in require.js
   - What is unclear: Whether Chrome's review process distinguishes between reachable and unreachable code
   - Recommendation: Document as "known consideration" in compliance report. If rejected, JD devs can either remove RequireJS (MOD-01) or add a note explaining it is dead code.

3. **CaptchaNativeService.js still loaded in popup.html**
   - What we know: File exists, is loaded via script tag, registers Angular service, but is never injected/used
   - What is unclear: Whether this causes issues with nativeMessaging permission removal
   - Recommendation: Remove the script tag from popup.html when removing nativeMessaging permission. Service will no longer function without the permission.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 with jsdom |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="__tests__" -x` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CWS-01 | Permission justification documented | manual-only | N/A -- documentation review | N/A |
| CWS-02 | Privacy policy (OUT OF SCOPE) | N/A | N/A | N/A |
| CWS-03 | Restricted code paths are dead code | unit | `npx jest --testPathPattern="CaptchaNativeService" -x` (partial) | Yes (partial) |
| CWS-04 | No CSP violations in extension consoles | manual-only | N/A -- requires loading extension in Chrome | N/A |
| CWS-05 | Description (OUT OF SCOPE) | N/A | N/A | N/A |
| CWS-06 | Screenshots (OUT OF SCOPE) | N/A | N/A | N/A |
| CWS-07 | postMessage wildcard documented | manual-only | N/A -- documentation review | N/A |

### Sampling Rate
- **Per task commit:** `npx jest -x` (verify no test regressions from manifest changes)
- **Per wave merge:** `npx jest` (full suite)
- **Phase gate:** Full suite green + manual CSP check before `/gsd:verify-work`

### Wave 0 Gaps
None -- this phase is primarily documentation. The existing 216 unit tests provide regression coverage for the manifest.json change (removing nativeMessaging). No new test files needed.

## Sources

### Primary (HIGH confidence)
- [Chrome MV3 CSP Documentation](https://developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy/) -- Default CSP policy, restricted code prohibition
- [Chrome Web Store MV3 Requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements) -- Additional review requirements
- Direct code analysis of manifest.json, angular.js (ng-csp logic), require.js (text-execution path), rx.all.js (global detection), webinterfaceEnhancer.js (postMessage)

### Secondary (MEDIUM confidence)
- [AngularJS ng-csp documentation](https://docs.angularjs.org/api/ng/directive/ngCsp) -- ng-csp behavior (verified via source code reading)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) -- General review requirements
- [Chromium Extensions Group - content script CSP](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/MPcq-feSK9c) -- Content script CSP rules

### Tertiary (LOW confidence)
- CWS review behavior regarding static detection of restricted code in vendor files (community reports, not official documentation)

## Metadata

**Confidence breakdown:**
- Permission audit: HIGH -- manifest.json fully read, all permissions traced to usage in source code
- Restricted code audit: HIGH -- all vendor files scanned, AngularJS ng-csp behavior verified via source code, RequireJS text-execution path confirmed dead
- CSP testing approach: HIGH -- standard browser DevTools approach, well-documented by Chrome
- postMessage audit: HIGH -- complete grep of all JS files, only one finding
- CWS review behavior for dead restricted code: MEDIUM -- official docs confirm policy, but static analysis behavior during review is not publicly documented

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- MV3 requirements are not changing rapidly)
