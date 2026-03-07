# Phase 3: Directory History - Research

**Researched:** 2026-03-07
**Domain:** Chrome Extension storage, AngularJS UI enhancement, HTML5 datalist
**Confidence:** HIGH

## Summary

Phase 3 adds directory history with MRU ordering, case-insensitive dedup, a clear button, and a settings toggle. The existing codebase already has 90% of the infrastructure: `addToHistory()` in AddLinksController.js handles dedup+prepend, `saveOptionsAndHistory()` persists per-device history to `chrome.storage.local`, and the `<datalist id="savetoHistory">` in templateCache.js renders the dropdown. The work is primarily modification of existing functions (not greenfield), plus two small additions to the settings page.

The main risk is subtle: the `addToHistory()` function currently does exact-match dedup via `$.inArray()`. Changing it to case-insensitive + normalized dedup requires careful handling so that (a) the most recent casing wins, (b) trailing slashes are stripped, and (c) the array is capped at 10 entries. The settings toggle is straightforward, following the established `StorageService.settingsKeys` pattern for the AngularJS parts and the `saveSetting()` pattern in `options.js` for the settings page.

**Primary recommendation:** Modify `addToHistory()` to accept normalization+cap options, add a `SETTINGS_DIRECTORY_HISTORY` key to StorageService, wire the clear button into templateCache.js next to the saveto input, and add a checkbox to options.html.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Clear button: Inline icon button (x or trash) next to the saveto input field. Visible only when history has entries. Clears saveto history only. Clears across ALL devices, not just current one. No confirmation required. After clearing, current saveto field value is kept (only dropdown suggestions removed).
- Settings toggle: Add a toggle to the existing extension settings page to disable directory history entirely. When disabled: saveto field becomes a plain text input (no dropdown, no autocomplete, clear button hidden). When disabled: existing saved history is preserved (not purged). New entries simply stop being recorded while disabled.
- History scope: Per-device history. On device switch, saveto field starts empty (do NOT auto-fill with last-used directory).
- Dedup & ordering: Case-insensitive deduplication. Most recent casing replaces old entry. Normalize trailing slashes/backslashes before comparing and storing. MRU ordering. Max 10 entries per device. Oldest silently evicted when cap reached.

### Claude's Discretion
- Icon choice for clear button (x vs trash vs eraser)
- Exact CSS styling and positioning of the clear button
- Settings toggle label and description text
- Whether to add the setting near existing "Add Links Dialog" settings or in its own section

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIR-01 | "Save to" field shows a dropdown of the last 10 used directories | Existing `<datalist id="savetoHistory">` with `ng-repeat="entry in history.saveto"` already renders this. Need to enforce max 10 cap in `addToHistory()`. |
| DIR-02 | Directory history is persisted to `chrome.storage.local` and survives browser restarts | Already implemented via `saveOptionsAndHistory()` which stores to `ADD_LINK_CACHED_HISTORY` key namespaced by device ID. No new storage mechanism needed. |
| DIR-03 | Directory entries are deduplicated case-insensitively (Windows paths) | Current `addToHistory()` uses `$.inArray()` for exact match. Must change to case-insensitive + normalized comparison. |
| DIR-04 | Clear history button removes all saved directories | New clear button in templateCache.js + `$scope.clearSavetoHistory()` function in AddLinksController.js that iterates all device keys in `ADD_LINK_CACHED_HISTORY` and empties their `saveto` arrays. |
| DIR-05 | Most recently used directory appears first in the dropdown | Already handled by `unshift()` in `addToHistory()`. The normalization change must preserve this MRU ordering (remove old entry, unshift new). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AngularJS | 1.x (in vendor/) | UI framework for popup/toolbar | Already in use; all controllers use AngularJS |
| chrome.storage.local | MV3 API | Persistent storage | Already used for history; decision locked |
| HTML5 datalist | Native browser | Dropdown autocomplete | Already wired for saveto field |
| jQuery | In vendor/ | DOM utilities | `$.inArray`, `$.each` already used in AddLinksController |
| Font Awesome | In vendor/ | Icons | `fa-times`, `fa-history`, `fa-cogs` already used in optional values toolbar |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jest | In package.json | Testing | Source-level structural tests (established pattern) |

### Alternatives Considered
None needed -- all technology choices are locked by existing codebase.

## Architecture Patterns

### Existing Data Flow (no change needed)
```
User types directory in saveto field
         |
         v
$scope.send() -> saveOptionsAndHistory()
         |
         v
addToHistory("saveto", value) -> unshift into $scope.history.saveto
         |
         v
storageService.set(ADD_LINK_CACHED_HISTORY, ...) -> chrome.storage.local
         |
         v
On next load: restoreOptionsAndHistory() -> chrome.storage.local.get()
         |
         v
$scope.history.saveto populated -> datalist renders via ng-repeat
```

### Pattern 1: Modified addToHistory with Normalization
**What:** Enhance existing `addToHistory()` to support case-insensitive dedup, trailing slash normalization, casing replacement, and max cap.
**When to use:** Only for the "saveto" key; other history fields (comment, packageName, archivepw, downloadpw) keep current exact-match behavior.
**Example:**
```javascript
// Current implementation (line 273):
function addToHistory(key, value) {
    if ($scope.history[key] === undefined) {
        $scope.history[key] = [];
    }
    if ($.inArray(value, $scope.history[key]) === -1) {
        $scope.history[key].unshift(value);
    }
}

// Modified implementation:
function addToHistory(key, value) {
    if ($scope.history[key] === undefined) {
        $scope.history[key] = [];
    }
    if (key === 'saveto') {
        // Normalize: strip trailing slashes/backslashes
        var normalized = value.replace(/[\\/]+$/, '');
        // Case-insensitive dedup: find existing entry
        var existingIdx = -1;
        for (var i = 0; i < $scope.history[key].length; i++) {
            if ($scope.history[key][i].toLowerCase() === normalized.toLowerCase()) {
                existingIdx = i;
                break;
            }
        }
        if (existingIdx !== -1) {
            // Remove old entry (might have different casing)
            $scope.history[key].splice(existingIdx, 1);
        }
        // Prepend with most recent casing (normalized)
        $scope.history[key].unshift(normalized);
        // Cap at 10
        if ($scope.history[key].length > 10) {
            $scope.history[key].length = 10;
        }
    } else {
        if ($.inArray(value, $scope.history[key]) === -1) {
            $scope.history[key].unshift(value);
        }
    }
}
```

### Pattern 2: Settings Toggle via StorageService.settingsKeys
**What:** Add a new settings key with default value following existing pattern.
**When to use:** For the directory history enabled/disabled toggle.
**Example:**
```javascript
// In StorageService.js, add constant:
this.SETTINGS_DIRECTORY_HISTORY_ENABLED = "DIRECTORY_HISTORY_ENABLED";

// In settingsKeys object:
DIRECTORY_HISTORY_ENABLED: {
    key: StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED,
    defaultValue: true
}
```

### Pattern 3: Settings Page Toggle (options.js / options.html)
**What:** Add a checkbox to options.html and wire it via options.js following existing checkbox patterns.
**When to use:** For the settings page toggle.
**Example:**
```html
<!-- In options.html, inside the "General" panel-body -->
<label class="checkbox">
    <input type="checkbox" id="directory_history_enabled" checked>
    Remember download directories
</label>
```
```javascript
// In options.js STORAGE_KEYS:
DIRECTORY_HISTORY_ENABLED: 'DIRECTORY_HISTORY_ENABLED'

// Load:
if (result[STORAGE_KEYS.DIRECTORY_HISTORY_ENABLED] !== undefined) {
    document.getElementById('directory_history_enabled').checked =
        result[STORAGE_KEYS.DIRECTORY_HISTORY_ENABLED];
} else {
    document.getElementById('directory_history_enabled').checked = true; // default
}

// Save:
document.getElementById('directory_history_enabled').addEventListener('change', function() {
    saveSetting(STORAGE_KEYS.DIRECTORY_HISTORY_ENABLED, this.checked);
});
```

### Pattern 4: Clear Button in templateCache.js
**What:** Add an inline icon button next to the saveto input that calls `$scope.clearSavetoHistory()`.
**When to use:** For the clear history functionality.
**Example:**
```javascript
// In templateCache.js, after the saveto datalist closing tag (line 531):
"                            <a ng-if=\"history.saveto.length > 0\" " +
"                               ng-click=\"clearSavetoHistory()\" " +
"                               class=\"clear-saveto-btn\" " +
"                               title=\"Clear directory history\">" +
"                               <i class=\"fa fa-times\" aria-hidden=\"true\"></i></a>\n" +
```

### Pattern 5: Conditional Datalist Rendering
**What:** Hide datalist and clear button when directory history is disabled.
**When to use:** When settings toggle is off.
**Example:**
```javascript
// Wrap datalist in ng-if checking a scope variable:
"                            <datalist id=\"savetoHistory\" ng-if=\"directoryHistoryEnabled\">\n" +
// Also wrap clear button:
"                            <a ng-if=\"directoryHistoryEnabled && history.saveto.length > 0\" ...
```

Note: `ng-if` on `<datalist>` removes it from DOM, but the `list` attribute on the input still references it. When the datalist is removed, the input simply acts as a plain text input -- which is the desired behavior when history is disabled.

### Pattern 6: Clear Across All Devices
**What:** The clear button must remove saveto history from ALL device entries in `ADD_LINK_CACHED_HISTORY`, not just the current device.
**When to use:** When implementing `$scope.clearSavetoHistory()`.
**Example:**
```javascript
$scope.clearSavetoHistory = function() {
    // Clear local scope
    $scope.history.saveto = [];
    // Clear cached history for all devices
    if ($scope.cachedHistory) {
        Object.keys($scope.cachedHistory).forEach(function(deviceId) {
            if ($scope.cachedHistory[deviceId] && $scope.cachedHistory[deviceId].saveto) {
                $scope.cachedHistory[deviceId].saveto = [];
            }
        });
    }
    // Persist to storage
    storageService.get(storageService.ADD_LINK_CACHED_HISTORY, function(result) {
        var history = result[storageService.ADD_LINK_CACHED_HISTORY] || {};
        Object.keys(history).forEach(function(deviceId) {
            if (history[deviceId] && history[deviceId].saveto) {
                history[deviceId].saveto = [];
            }
        });
        storageService.set(storageService.ADD_LINK_CACHED_HISTORY, history);
    });
};
```

### Anti-Patterns to Avoid
- **Changing other history fields:** The normalization and cap logic should ONLY apply to `saveto`. The comment, packageName, archivepw, downloadpw fields must keep their current exact-match behavior.
- **Purging history when disabling:** The settings toggle must NOT delete existing history. It only stops recording new entries.
- **Auto-filling saveto on device switch:** CONTEXT.md explicitly says "On device switch, saveto field starts empty." The existing `selectDevice()` function already handles this correctly (sets `$scope.history` from cached but does not set `$scope.selection.saveto`).
- **Using ng-show for datalist:** Use `ng-if` so the datalist is fully removed from DOM when disabled, rather than hidden.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown autocomplete | Custom dropdown component | HTML5 `<datalist>` | Already in use; native browser behavior; accessible |
| Persistent storage | Manual localStorage wrapper | `chrome.storage.local` via `StorageService` | Already wired; handles MV3 service worker lifecycle |
| Icon set | SVG icons or custom images | Font Awesome `fa-*` classes | Already loaded in extension; consistent with existing UI |

**Key insight:** This phase is about enhancing existing infrastructure, not building new components. Every piece (storage, UI, settings) already has an established pattern to follow.

## Common Pitfalls

### Pitfall 1: StorageService.set() reads-then-writes (not atomic)
**What goes wrong:** `StorageService.set()` calls `getAll()` first, then `chrome.storage.local.set()`. If two writes happen in quick succession, the second read may not see the first write.
**Why it happens:** The extension's storage abstraction uses read-modify-write instead of direct `chrome.storage.local.set({key: value})`.
**How to avoid:** The `clearSavetoHistory()` function should use `storageService.get()` to read only the `ADD_LINK_CACHED_HISTORY` key, modify it, then use `storageService.set()` to write it back. Avoid calling clear and save in rapid succession.
**Warning signs:** History reappearing after clear.

### Pitfall 2: The `list` attribute stays even when datalist is removed
**What goes wrong:** When `ng-if` removes the `<datalist>`, the `<input list="savetoHistory">` still has the `list` attribute. In most browsers this is harmless (no datalist = no dropdown), but some may show an empty dropdown arrow.
**Why it happens:** HTML5 spec says the `list` attribute references a datalist by ID; if the ID doesn't exist, the attribute is ignored.
**How to avoid:** Test in Chrome (the only target browser). If the arrow artifact appears, conditionally set the `list` attribute via `ng-attr-list`.
**Warning signs:** Phantom dropdown arrow on the saveto input when history is disabled.

### Pitfall 3: options.js uses different storage key names than StorageService.js
**What goes wrong:** `options.js` defines its own `STORAGE_KEYS` object with keys like `settings_clicknload_active`, but `StorageService.js` uses keys like `CLICKNLOAD_ACTIVE`. These are DIFFERENT keys in `chrome.storage.local`.
**Why it happens:** The options page was rewritten for MV3 as a standalone page (no AngularJS), while the popup/toolbar still use the AngularJS StorageService.
**How to avoid:** The new directory history toggle must use the SAME key string in both `options.js` and `StorageService.js`. The AngularJS code uses the raw key string from `StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED`. The options.js must use that exact same string. Verify by checking: `StorageService.SETTINGS_DIRECTORY_HISTORY_ENABLED = "DIRECTORY_HISTORY_ENABLED"` and `options.js STORAGE_KEYS.DIRECTORY_HISTORY_ENABLED = 'DIRECTORY_HISTORY_ENABLED'`.
**Warning signs:** Toggle in settings page doesn't affect popup behavior (or vice versa).

### Pitfall 4: Device switch and saveto auto-fill
**What goes wrong:** If the code auto-fills `$scope.selection.saveto` with the MRU entry on device switch, it violates the user decision "On device switch, saveto field starts empty."
**Why it happens:** The existing `restoreOptionsAndHistory()` function does auto-fill saveto when `autoFill` is enabled (line 468-476).
**How to avoid:** The existing behavior on device switch via `selectDevice()` does NOT call `restoreOptionsAndHistory()` -- it just sets `$scope.history` from `$scope.cachedHistory`. This is correct. Do NOT change this. The auto-fill only happens on initial page load, which is fine.
**Warning signs:** Saveto field pre-populated after clicking a different device.

### Pitfall 5: Trailing slash normalization edge cases
**What goes wrong:** A path like `C:\` (root drive) would be normalized to `C:` which is still valid but looks different. An empty string after normalization should be treated as "no value."
**Why it happens:** Regex `replace(/[\\/]+$/, '')` strips all trailing slashes.
**How to avoid:** Only normalize if the value is not empty and the result is not empty. For Windows root paths like `C:\`, `C:` is the correct canonical form (Windows APIs accept it). For Unix-like paths, `/` should not be stripped to empty string, but this is a Windows-targeted extension so not a concern.
**Warning signs:** `C:\` and `C:` treated as different entries.

### Pitfall 6: Storage key name collision for settings
**What goes wrong:** The key `DIRECTORY_HISTORY_ENABLED` is stored at the top level of `chrome.storage.local` alongside `ADD_LINK_CACHED_HISTORY`, `CLICKNLOAD_ACTIVE`, etc.
**Why it happens:** `StorageService.set()` stores at top level.
**How to avoid:** Use a unique, descriptive key name. `DIRECTORY_HISTORY_ENABLED` does not collide with any existing key. Verify against existing keys: `STORAGE_FEEDBACK_MSG_DRAFT`, `CACHED_DEVICE_LIST`, `ADD_LINK_CACHED_OPTIONS`, `ADD_LINK_CACHED_HISTORY`, `CLIPBOARD_HISTORY`, `ADD_LINKS_DIALOG_ACTIVE`, `COUNTDOWN_ACTIVE`, `COUNTDOWN_VALUE`, `CLIPBOARD_OBSERVER`, `CONTEXT_MENU_SIMPLE`, `DEFAULT_PREFERRED_JD`, `DEFAULT_PRIORITY`, `DEFAULT_DEEPDECRYPT`, `DEFAULT_AUTOSTART`, `DEFAULT_AUTOEXTRACT`, `ENHANCE_CAPTCHA_DIALOG`, `CAPTCHA_PRIVACY_MODE`, `DEFAULT_OVERWRITE_PACKAGIZER`, `CLICKNLOAD_ACTIVE`.
**Warning signs:** Settings mysteriously changing on their own.

## Code Examples

Verified patterns from actual source code:

### Existing addToHistory (AddLinksController.js:273-280)
```javascript
function addToHistory(key, value) {
    if ($scope.history[key] === undefined) {
        $scope.history[key] = [];
    }
    if ($.inArray(value, $scope.history[key]) === -1) {
        $scope.history[key].unshift(value);
    }
}
```

### Existing saveto save point (AddLinksController.js:305-306)
```javascript
if ($scope.selection.saveto !== undefined) {
    addToHistory("saveto", $scope.selection.saveto);
}
```
Add a guard here: only call addToHistory if directory history is enabled.

### Existing datalist template (templateCache.js:524-532)
```javascript
"                        <div>\n" +
"                            <label title=\"{{'ui_add_links_save_to' | translate}}\" for=\"saveto\"><img\n" +
"                                    src=\"/images/saveto.png\"/></label><input\n" +
"                                ng-value=\"selection.saveto\" ng-model=\"selection.saveto\"\n" +
"                                id=\"saveto\" name=\"saveto\" type=\"text\" list=\"savetoHistory\">\n" +
"                            <datalist id=\"savetoHistory\">\n" +
"                                <option ng-repeat=\"entry in history.saveto\" value=\"{{entry}}\">\n" +
"                            </datalist>\n" +
"                        </div>\n" +
```

### Existing settingsKeys pattern (StorageService.js:52-88)
```javascript
this.settingsKeys = {
    ENHANCE_CAPTCHA_DIALOG: {key: StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG, defaultValue: true},
    // ... more keys ...
    CLICKNLOAD_ACTIVE: {key: StorageService.SETTINGS_CLICKNLOAD_ACTIVE, defaultValue: true}
};
```

### Existing options.js checkbox pattern (options.js:50-58)
```javascript
if (result[STORAGE_KEYS.CLICKNLOAD_ACTIVE] !== undefined) {
    document.getElementById('clicknload_active').checked = result[STORAGE_KEYS.CLICKNLOAD_ACTIVE];
}
// ...
document.getElementById('clicknload_active').addEventListener('change', function() {
    saveSetting(STORAGE_KEYS.CLICKNLOAD_ACTIVE, this.checked);
});
```

### Existing options.html checkbox (options.html:48-51)
```html
<label class="checkbox">
    <input type="checkbox" id="clicknload_active" checked>
    Enable Click'N'Load (CNL)
</label>
```

### Existing CSS for optionalvaluesform (main.css:643-665)
```css
#optionalvaluesform { margin-top: 8px; }
#optionalvaluesform label { width: 36px; }
#optionalvaluesform input { width: 300px; border: none; padding: 2px; }
#optionalvaluesform label > img { width: 22px; }
```
The clear button must be positioned within the remaining space (total width minus label 36px minus input 300px = remaining for button).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exact-match dedup via $.inArray | Case-insensitive + normalized dedup | This phase | Prevents duplicate entries for Windows paths |
| Unlimited history entries | Max 10 cap | This phase | Prevents dropdown from growing unbounded |
| No settings toggle for history | Configurable via options page | This phase | Users can disable feature if unwanted |

**Not deprecated/outdated:**
- HTML5 `<datalist>` is current and well-supported in Chrome (the only target browser)
- AngularJS 1.x is legacy but is the project's framework -- no migration in this phase
- `chrome.storage.local` is the correct MV3 API for persistent data

## Open Questions

1. **Settings key naming convention**
   - What we know: Existing keys use SCREAMING_SNAKE_CASE without a `SETTINGS_` prefix in storage (e.g., `CLICKNLOAD_ACTIVE` not `SETTINGS_CLICKNLOAD_ACTIVE`). But in options.js, they use `settings_` prefix (e.g., `settings_clicknload_active`).
   - What's unclear: Whether the options.js keys actually match what StorageService reads. Looking at the code, they appear to be DIFFERENT keys (options.js: `settings_clicknload_active` vs StorageService: `CLICKNLOAD_ACTIVE`). This means the AngularJS popup and the options page may be using separate storage entries.
   - Recommendation: Check if this is a known bug or if they're intentionally separate. For the new toggle, use the StorageService key string (`DIRECTORY_HISTORY_ENABLED`) in both places, and add the options.js key to `STORAGE_KEYS` using the same string. The settings toggle behavior is only needed in the AddLinksController (AngularJS context), but the options page needs to write the same key.

2. **Icon choice for clear button**
   - Recommendation: Use `fa-times` (x icon) to match the existing clear-all-optional-values button pattern (templateCache.js line 498). It is already visually established in the same area of the UI.

3. **Settings toggle placement**
   - Recommendation: Add to the "General" panel in options.html, alongside the existing Click'N'Load and Context Menu toggles. This groups all feature toggles together. Label: "Remember download directories" with no additional description needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (jsdom environment) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="AddLinksController" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIR-01 | Datalist shows last 10 directories | unit (structural) | `npx jest --testPathPattern="AddLinksController" -x` | Needs new tests |
| DIR-02 | History persisted to chrome.storage.local | unit (structural) | `npx jest --testPathPattern="AddLinksController" -x` | Needs new tests |
| DIR-03 | Case-insensitive dedup | unit (structural) | `npx jest --testPathPattern="AddLinksController" -x` | Needs new tests |
| DIR-04 | Clear button removes all directories | unit (structural) | `npx jest --testPathPattern="AddLinksController" -x` | Needs new tests |
| DIR-05 | MRU ordering | unit (structural) | `npx jest --testPathPattern="AddLinksController" -x` | Needs new tests |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="AddLinksController" --no-coverage -x`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `scripts/__tests__/AddLinksController.test.js` -- covers DIR-01 through DIR-05 (structural verification of modified `addToHistory`, `clearSavetoHistory`, settings key existence, template datalist conditional rendering)
- [ ] Structural tests for `StorageService.js` -- verify `SETTINGS_DIRECTORY_HISTORY_ENABLED` key and `settingsKeys` entry exist
- [ ] Structural tests for `options.js` -- verify `DIRECTORY_HISTORY_ENABLED` key present
- [ ] Structural tests for `templateCache.js` -- verify clear button markup and conditional datalist

Note: The project uses source-level structural tests (read file + regex/string matching) rather than runtime AngularJS tests. This is the established pattern from Phase 2 and should be continued.

## Sources

### Primary (HIGH confidence)
- `scripts/controllers/AddLinksController.js` - Direct source code analysis of `addToHistory()`, `saveOptionsAndHistory()`, `restoreOptionsAndHistory()`, `selectDevice()`
- `scripts/services/StorageService.js` - Direct source code analysis of storage keys, settings pattern, and API methods
- `partials/templateCache.js` - Direct source code analysis of datalist markup at lines 524-532
- `options.js` - Direct source code analysis of settings page save pattern
- `options.html` - Direct source code analysis of settings page HTML structure
- `styles/main.css` - Direct source code analysis of CSS for `#optionalvaluesform`
- `scripts/__tests__/AddLinksController.test.js` - Existing test pattern (structural/source-level verification)
- `jest.config.js` and `jest.setup.js` - Test framework configuration and Chrome API mocks

### Secondary (MEDIUM confidence)
- Chrome Extension MV3 `chrome.storage.local` API - well-documented, stable API

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries/patterns already in use in the codebase
- Architecture: HIGH - modifying existing functions with well-understood behavior
- Pitfalls: HIGH - identified from direct source code analysis, especially the options.js/StorageService key mismatch
- UI patterns: HIGH - following exact patterns already established in the same files

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependencies changing)
