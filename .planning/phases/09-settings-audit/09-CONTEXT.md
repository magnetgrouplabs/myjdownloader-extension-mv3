# Phase 9: Settings Page Audit & Wiring - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure all StorageService setting keys have corresponding UI controls in the AngularJS settings page, are properly wired to extension behavior, and remove the dead standalone options page. Audit all chrome.storage calls for key consistency and APP_KEY correctness.

</domain>

<decisions>
## Implementation Decisions

### Missing Toggles
- Add `CAPTCHA_PRIVACY_MODE` toggle to the AngularJS popup settings page (next to existing CAPTCHA settings)
- Label: "CAPTCHA Privacy Mode", Description: "Solve CAPTCHAs without sending page data to third parties"
- Add `DIRECTORY_HISTORY_ENABLED` toggle to the AngularJS popup settings page in the general settings section
- Both toggles must be wired through SettingsController `$watchGroup` → StorageService

### Remove Standalone Options Page
- Delete `options.html` and `options.js` — MV2 never had a separate options page
- MV2 used `index.html#!/settings` (AngularJS route) as the options_ui page
- Current MV3 manifest already points `options_ui` to `popup.html#!/settings` — no manifest change needed
- Removes source of storage key mismatches and wrong APP_KEY

### Storage Key Audit
- Audit ALL `chrome.storage.local.get`/`set` calls across the entire codebase
- Flag any call that doesn't go through StorageService or uses hardcoded key strings
- Fix all mismatched keys found — not just document them
- StorageService is the single source of truth for storage key names

### APP_KEY Audit
- Grep for `myjd_webextension` across all files
- Fix any occurrence that doesn't use the correct `myjd_webextension_chrome`
- The wrong `myjd_webextension_mv3` key in options.js goes away with the file deletion

### Claude's Discretion
- Exact placement/ordering of new toggles within the AngularJS template
- Whether to add i18n keys for new toggle labels or use inline English text
- How to structure the storage key audit results (inline comments vs separate report)

</decisions>

<specifics>
## Specific Ideas

- Mirror MV2 behavior: settings live in the AngularJS popup route, no standalone options page
- User wants belt-and-suspenders: audit everything even if the obvious fix (deleting options.js) resolves most issues

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StorageService.settingsKeys` — central registry of all settings with defaults (already has CAPTCHA_PRIVACY_MODE and DIRECTORY_HISTORY_ENABLED)
- `SettingsController.$watchGroup` — already watches CAPTCHA_PRIVACY_MODE but not DIRECTORY_HISTORY_ENABLED
- `partials/templateCache.js` — AngularJS template with existing checkbox pattern for settings toggles
- `scripts/directives/mySettings.js` — directive wiring SettingsCtrl to `partials/controllers/settings.html`

### Established Patterns
- Settings toggles use `ng-model="settings[settingsKeys.KEY.key]"` binding pattern
- SettingsController initializes defaults, then `initSettings()` loads from storage
- `$watchGroup` collects all settings changes and batch-saves via `storageService.setCollection()`
- i18n done via `ExtensionI18nService.getMessage()` with `_locales` JSON files

### Integration Points
- `partials/templateCache.js` — add HTML for new toggles (CAPTCHA_PRIVACY_MODE, DIRECTORY_HISTORY_ENABLED)
- `scripts/controllers/SettingsController.js` — add default init + $watchGroup entries for DIRECTORY_HISTORY_ENABLED
- `manifest.json` — options_ui already points to popup.html#!/settings (no change needed)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-settings-audit*
*Context gathered: 2026-03-08*
