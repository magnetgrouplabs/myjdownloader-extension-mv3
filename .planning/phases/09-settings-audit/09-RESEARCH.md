# Phase 9: Settings Page Audit & Wiring - Research

**Researched:** 2026-03-08
**Domain:** AngularJS settings UI, chrome.storage key consistency, APP_KEY audit
**Confidence:** HIGH

## Summary

This phase addresses two missing settings toggles (CAPTCHA_PRIVACY_MODE, DIRECTORY_HISTORY_ENABLED) and a thorough audit of chrome.storage key usage across the codebase. Code investigation reveals a significant storage key mismatch between background.js and StorageService -- background.js uses lowercase prefixed keys (`settings_clicknload_active`) while StorageService uses uppercase unprefixed keys (`CLICKNLOAD_ACTIVE`). These are fundamentally different storage keys that never read each other's values.

The standalone options.html/options.js page is a dead-end duplicate of the AngularJS settings route. It uses the wrong APP_KEY (`myjd_webextension_mv3` instead of `myjd_webextension_chrome`), has its own storage key mapping that partially conflicts with both background.js and StorageService, and should be deleted entirely. The manifest already points `options_ui` to `popup.html#!/settings`.

**Primary recommendation:** Delete options.html/options.js, add two missing toggles to the AngularJS template following existing patterns, fix background.js storage keys to match StorageService, and fix the hardcoded key on background.js line 821.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `CAPTCHA_PRIVACY_MODE` toggle to the AngularJS popup settings page (next to existing CAPTCHA settings)
- Label: "CAPTCHA Privacy Mode", Description: "Solve CAPTCHAs without sending page data to third parties"
- Add `DIRECTORY_HISTORY_ENABLED` toggle to the AngularJS popup settings page in the general settings section
- Both toggles must be wired through SettingsController `$watchGroup` -> StorageService
- Delete `options.html` and `options.js` -- MV2 never had a separate options page
- Current MV3 manifest already points `options_ui` to `popup.html#!/settings` -- no manifest change needed
- Audit ALL `chrome.storage.local.get`/`set` calls across the entire codebase
- Flag any call that doesn't go through StorageService or uses hardcoded key strings
- Fix all mismatched keys found -- not just document them
- StorageService is the single source of truth for storage key names
- Grep for `myjd_webextension` across all files and fix any occurrence that doesn't use `myjd_webextension_chrome`

### Claude's Discretion
- Exact placement/ordering of new toggles within the AngularJS template
- Whether to add i18n keys for new toggle labels or use inline English text
- How to structure the storage key audit results (inline comments vs separate report)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SET-01 | CAPTCHA_PRIVACY_MODE setting has a visible UI toggle in the settings page | StorageService already has the key (line 22, 59); $watchGroup already watches it (line 143); only the template checkbox is missing |
| SET-02 | DIRECTORY_HISTORY_ENABLED setting has a visible UI toggle in the AngularJS settings page | StorageService has the key (line 25, 89-92); missing from: template, $scope.settings init, $watchGroup, and changes array |
</phase_requirements>

## Architecture Patterns

### Existing Settings Toggle Pattern (from code investigation)

The AngularJS settings page uses a well-established pattern. All code references below are from direct file reads.

**1. StorageService key registration** (already done for both keys):
```javascript
// scripts/services/StorageService.js
this.SETTINGS_CAPTCHA_PRIVACY_MODE = "CAPTCHA_PRIVACY_MODE";
this.SETTINGS_DIRECTORY_HISTORY_ENABLED = "DIRECTORY_HISTORY_ENABLED";

// In settingsKeys object:
CAPTCHA_PRIVACY_MODE: {key: StorageService.SETTINGS_CAPTCHA_PRIVACY_MODE, defaultValue: true},
DIRECTORY_HISTORY_ENABLED: {key: StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED, defaultValue: true}
```

**2. SettingsController default initialization** (pattern from existing code):
```javascript
// scripts/controllers/SettingsController.js - line ~35-45
$scope.settings[$scope.settingsKeys.SOME_KEY.key] = $scope.settingsKeys[$scope.settingsKeys.SOME_KEY.key].defaultValue;
```
- CAPTCHA_PRIVACY_MODE: NOT initialized in $scope.settings (missing)
- DIRECTORY_HISTORY_ENABLED: NOT initialized in $scope.settings (missing)

**3. $watchGroup entry** (SettingsController line 131-145):
```javascript
$scope.$watchGroup([
    "settings." + $scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key,  // PRESENT (line 143)
    // DIRECTORY_HISTORY_ENABLED is MISSING from $watchGroup
], function(newValues, oldValues, scope) { ... });
```
- CAPTCHA_PRIVACY_MODE: IS in $watchGroup and changes array (line 143, 175)
- DIRECTORY_HISTORY_ENABLED: MISSING from $watchGroup AND changes array

**4. Template checkbox** (partials/templateCache.js):
```html
<!-- Existing pattern (e.g., CLICKNLOAD_ACTIVE toggle): -->
<div class="inlineSettingsContainer" id="clicknloadSettings">
    <label for="clicknload_active">
        <input type="checkbox" id="clicknload_active"
            ng-model="settings[settingsKeys.CLICKNLOAD_ACTIVE.key]" />
        {{'ui_settings_cnl_via_myjd' | translate}}
    </label>
    <div style="clear:both;"></div>
    <p class="description">
        <small>{{'ui_settings_cnl_via_myjd_description' | translate}}</small>
    </p>
</div>
```
- CAPTCHA_PRIVACY_MODE: NO checkbox in template
- DIRECTORY_HISTORY_ENABLED: NO checkbox in template

### Storage Key Mismatch Analysis (CRITICAL FINDING)

**StorageService (source of truth) key values:**
| Constant | Actual Key String |
|----------|-------------------|
| `SETTINGS_CLICKNLOAD_ACTIVE` | `"CLICKNLOAD_ACTIVE"` |
| `SETTINGS_CONTEXT_MENU_SIMPLE` | `"CONTEXT_MENU_SIMPLE"` |
| `SETTINGS_DEFAULT_PREFERRED_JD` | `"DEFAULT_PREFERRED_JD"` |
| `SETTINGS_ADD_LINKS_DIALOG_ACTIVE` | `"ADD_LINKS_DIALOG_ACTIVE"` |

**background.js STORAGE_KEYS (lines 5-9):**
| Constant | Actual Key String | MATCHES StorageService? |
|----------|-------------------|------------------------|
| `CLICKNLOAD_ACTIVE` | `'settings_clicknload_active'` | NO -- different key |
| `CONTEXT_MENU_SIMPLE` | `'settings_context_menu_simple'` | NO -- different key |
| `DEFAULT_PREFERRED_JD` | `'settings_default_preferred_jd'` | NO -- different key |

**background.js hardcoded key (line 821):**
```javascript
const settings = await chrome.storage.local.get(['settings_add_links_dialog_active', 'settings_default_preferred_jd']);
```
Both are WRONG -- should be `'ADD_LINKS_DIALOG_ACTIVE'` and `'DEFAULT_PREFERRED_JD'`.

**options.js STORAGE_KEYS (lines 4-8):**
| Constant | Actual Key String | MATCHES StorageService? |
|----------|-------------------|------------------------|
| `CLICKNLOAD_ACTIVE` | `'settings_clicknload_active'` | NO |
| `CONTEXT_MENU_SIMPLE` | `'settings_context_menu_simple'` | NO |
| `DEFAULT_PREFERRED_JD` | `'settings_default_preferred_jd'` | NO |
| `DIRECTORY_HISTORY_ENABLED` | `'DIRECTORY_HISTORY_ENABLED'` | YES |

**Impact:** When SettingsController saves `CLICKNLOAD_ACTIVE` via StorageService, background.js reads `settings_clicknload_active` -- a DIFFERENT key. Settings changes in the popup may not propagate to the service worker and vice versa.

### APP_KEY Audit Results

| File | APP_KEY Used | Correct? |
|------|-------------|----------|
| `scripts/services/MyjdService.js:131` | `myjd_webextension_chrome` | YES |
| `offscreen.js:40` | `myjd_webextension_chrome` | YES |
| `options.js:25` | `myjd_webextension_mv3` | NO -- wrong key |
| `vendor/js/jdapi.js:582` | `myjd_webextension_firefoxself_3_2_34` | OK -- vendor default, overridden at init |

options.js has the wrong APP_KEY, but deleting the file resolves this.

### Other Direct chrome.storage Calls (Outside StorageService)

| File | Line | Key | Goes Through StorageService? |
|------|------|-----|------------------------------|
| `background.js:34` | `chrome.storage.session.get(QUEUE_STORAGE_KEY)` | `myjd_request_queue` | No -- session storage, not settings (OK) |
| `background.js:45` | `chrome.storage.session.set(...)` | `myjd_request_queue` | No -- session storage (OK) |
| `background.js:219` | `chrome.storage.local.get(Object.values(STORAGE_KEYS))` | Wrong keys | MUST FIX |
| `background.js:398` | `chrome.storage.local.get(['myjd_session'])` | `myjd_session` | No -- session data, not settings (OK) |
| `background.js:620` | `chrome.storage.session.set({myjd_captcha_job:...})` | `myjd_captcha_job` | No -- session storage (OK) |
| `background.js:818` | `chrome.storage.local.set({'cnl_queue':...})` | `cnl_queue` | No -- transient queue (OK) |
| `background.js:821` | Hardcoded `settings_add_links_dialog_active` | Wrong key | MUST FIX |
| `background.js:825` | `chrome.storage.local.set({'cnl_pending':true})` | `cnl_pending` | No -- transient flag (OK) |
| `offscreen.js:46` | `chrome.storage.local.get(['myjd_session'])` | `myjd_session` | No -- session data (OK) |
| `offscreen.js:103` | `chrome.storage.local.set({'myjd_session':...})` | `myjd_session` | No -- session data (OK) |
| `PopupController.js:30` | `chrome.storage.local.get(['myjd_session'])` | `myjd_session` | No -- session data (OK) |
| `ToolbarController.js:67` | `chrome.storage.local.get(['myjd_session'])` | `myjd_session` | No -- session data (OK) |
| `AddLinksController.js:156` | `chrome.storage.local.get(['myjd_session'])` | `myjd_session` | No -- session data (OK) |
| `AddLinksController.js:270` | `storageService.get(storageService.SETTINGS_DIRECTORY_HISTORY_ENABLED,...)` | `DIRECTORY_HISTORY_ENABLED` | YES -- uses StorageService (OK) |
| `myjdCaptchaSolver.js:62` | `chrome.storage.session.get('myjd_captcha_job')` | `myjd_captcha_job` | No -- session storage (OK) |
| `vendor/js/jdapi.js:1382,1387` | `chrome.storage.local.set/get` | Various | Vendor library -- internal API session management (OK) |

### Summary of Required Fixes

**MUST fix:**
1. `background.js` lines 5-8: Change STORAGE_KEYS values to match StorageService
2. `background.js` line 821: Replace hardcoded keys with correct StorageService key strings
3. Delete `options.html` and `options.js`
4. Add CAPTCHA_PRIVACY_MODE checkbox to settings template
5. Add DIRECTORY_HISTORY_ENABLED checkbox to settings template
6. Add DIRECTORY_HISTORY_ENABLED to SettingsController `$scope.settings` init
7. Add DIRECTORY_HISTORY_ENABLED to `$watchGroup` and changes array

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings persistence | Custom storage logic | StorageService.setCollection() | Already handles batch saves, getSettings() loads with defaults |
| Two-way data binding | Manual DOM event listeners | AngularJS ng-model + $watchGroup | Existing pattern; options.js tried manual approach and got keys wrong |

## Common Pitfalls

### Pitfall 1: Storage Key String Mismatch
**What goes wrong:** background.js and StorageService use different string values for the same logical key, so settings changes don't propagate.
**Why it happens:** background.js was written independently from the AngularJS app and defined its own key constants.
**How to avoid:** After fixing, grep the entire codebase for any remaining lowercase `settings_` prefixed keys.
**Warning signs:** Settings changed in popup don't affect service worker behavior (e.g., toggling CNL in popup doesn't enable/disable CNL interception).

### Pitfall 2: Missing $watchGroup Entry
**What goes wrong:** Adding a toggle to the template without adding it to `$watchGroup` means the value is never persisted when changed.
**Why it happens:** The AngularJS settings pattern requires 4 coordinated changes (StorageService, init, $watchGroup, template).
**How to avoid:** Verify each new setting appears in all 4 locations.
**Warning signs:** Toggle appears to work (checkbox changes state) but resets on popup reopen.

### Pitfall 3: $scope.settings Init Missing
**What goes wrong:** If a setting key isn't initialized in `$scope.settings` before `initSettings()` runs, and storage has no saved value, the key won't exist in `$scope.settings` at all.
**Why it happens:** `getSettings()` in StorageService has a bug at line 157 -- it looks up `StorageService.settingsKeys[key]` using the key STRING, but `settingsKeys` is keyed by CONSTANT NAME. This means defaults for keys not previously stored may not load correctly.
**How to avoid:** Always initialize defaults in `$scope.settings` before calling `initSettings()`.

### Pitfall 4: templateCache.js String Concatenation
**What goes wrong:** HTML template is stored as concatenated JavaScript strings in templateCache.js. Typos in quote escaping break the entire settings page.
**Why it happens:** Not a standard HTML file -- it's JS string literals.
**How to avoid:** Carefully follow the existing string concatenation pattern. Test by reloading the extension.

## Code Examples

### Adding a Checkbox Toggle (Complete Pattern)

**Step 1: $scope.settings initialization (SettingsController.js)**
```javascript
// Add alongside existing init lines (around line 45):
$scope.settings[$scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key] = $scope.settingsKeys[$scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key].defaultValue;
$scope.settings[$scope.settingsKeys.DIRECTORY_HISTORY_ENABLED.key] = $scope.settingsKeys[$scope.settingsKeys.DIRECTORY_HISTORY_ENABLED.key].defaultValue;
```

**Step 2: $watchGroup entry (SettingsController.js)**
```javascript
// CAPTCHA_PRIVACY_MODE is already in $watchGroup (line 143). Add DIRECTORY_HISTORY_ENABLED:
"settings." + $scope.settingsKeys.DIRECTORY_HISTORY_ENABLED.key,
```

**Step 3: Changes array entry (SettingsController.js, inside $watchGroup callback)**
```javascript
// CAPTCHA_PRIVACY_MODE already has a changes.push (line 175). Add:
changes.push({
    key: $scope.settingsKeys.DIRECTORY_HISTORY_ENABLED.key,
    value: scope.settings[$scope.settingsKeys.DIRECTORY_HISTORY_ENABLED.key]
});
```

**Step 4: Template checkbox (templateCache.js)**
```javascript
// Follow existing inlineSettingsContainer pattern:
"    <div class=\"inlineSettingsContainer\" id=\"captchaPrivacySettings\">\n" +
"        <label for=\"captcha_privacy_mode\">\n" +
"            <input type=\"checkbox\" id=\"captcha_privacy_mode\"\n" +
"                ng-model=\"settings[settingsKeys.CAPTCHA_PRIVACY_MODE.key]\" />\n" +
"            CAPTCHA Privacy Mode</label>\n" +
"        <div style=\"clear:both;\"></div>\n" +
"        <p class=\"description\">\n" +
"            <small>Solve CAPTCHAs without sending page data to third parties</small>\n" +
"        </p>\n" +
"    </div>\n" +
```

### Fixing background.js Storage Keys

```javascript
// background.js lines 5-9 - change to match StorageService:
const STORAGE_KEYS = {
 CLICKNLOAD_ACTIVE: 'CLICKNLOAD_ACTIVE',
 CONTEXT_MENU_SIMPLE: 'CONTEXT_MENU_SIMPLE',
 DEFAULT_PREFERRED_JD: 'DEFAULT_PREFERRED_JD'
};
```

```javascript
// background.js line 821 - fix hardcoded keys:
const settings = await chrome.storage.local.get(['ADD_LINKS_DIALOG_ACTIVE', 'DEFAULT_PREFERRED_JD']);
const shouldOpenPopup = settings.ADD_LINKS_DIALOG_ACTIVE !== false;
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (jsdom) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="__tests__" --no-coverage -x` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | CAPTCHA_PRIVACY_MODE has visible toggle | unit (source regex) | `npx jest --testPathPattern="SettingsController" -x` | Needs new test |
| SET-02 | DIRECTORY_HISTORY_ENABLED has visible toggle | unit (source regex) | `npx jest --testPathPattern="SettingsController" -x` | Needs new test |
| AUDIT | background.js keys match StorageService | unit (source regex) | `npx jest --testPathPattern="background" -x` | Needs new test |
| AUDIT | options.html/options.js deleted | unit (file existence) | `npx jest --testPathPattern="options" -x` | Existing options.test.js must be updated |

### Sampling Rate
- **Per task commit:** `npx jest --no-coverage -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `scripts/__tests__/SettingsController.test.js` -- covers SET-01, SET-02 (verify template has checkboxes, $watchGroup has entries)
- [ ] Update `scripts/__tests__/options.test.js` -- remove or update tests since options.js is being deleted
- [ ] `scripts/__tests__/background.test.js` -- add test verifying STORAGE_KEYS values match StorageService key strings

## Open Questions

1. **Should background.js STORAGE_KEYS be reconciled with StorageService?**
   - What we know: They use completely different key strings. background.js cannot import StorageService (it's an AngularJS service).
   - What's clear: background.js must use the same key STRING values, even if it can't reference StorageService constants.
   - Recommendation: Change background.js key values to match StorageService. Add a comment noting they must stay in sync.

2. **i18n for new toggle labels?**
   - What we know: Existing toggles use `{{'key' | translate}}` with `_locales/en/messages.json`. CONTEXT.md leaves this to Claude's discretion.
   - Recommendation: Use inline English text for simplicity. The extension's user base is English-speaking, and adding i18n keys for two labels adds complexity without benefit. Can always add i18n later.

## Sources

### Primary (HIGH confidence)
- Direct file reads: `StorageService.js`, `SettingsController.js`, `templateCache.js`, `background.js`, `options.js`, `options.html`, `manifest.json`
- Grep results: All `chrome.storage` calls across codebase, all `myjd_webextension` occurrences

### Secondary (MEDIUM confidence)
- Pattern analysis: Cross-referencing StorageService key definitions with all consumer files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct code reads of all relevant files
- Architecture: HIGH - existing patterns clearly established in codebase
- Pitfalls: HIGH - storage key mismatch confirmed by direct comparison of string values
- Audit completeness: HIGH - grep covered all .js and .html files for chrome.storage and APP_KEY usage

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable codebase, no external dependencies changing)
