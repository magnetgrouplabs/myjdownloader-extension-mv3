# Phase 3: Directory History - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent dropdown on the "Save to" field showing recently used download directories, with a clear button and a settings toggle to disable history. Users can quickly re-select previously used directories without retyping.

</domain>

<decisions>
## Implementation Decisions

### Clear button
- Inline icon button (x or trash) next to the saveto input field
- Visible only when history has entries
- Clears saveto history only (not package name, passwords, etc.)
- Clears across ALL devices, not just the current one
- No confirmation required — immediate action
- After clearing, current saveto field value is kept (only dropdown suggestions removed)

### Settings toggle
- Add a toggle to the existing extension settings page to disable directory history entirely
- When disabled: saveto field becomes a plain text input (no dropdown, no autocomplete, clear button hidden)
- When disabled: existing saved history is preserved (not purged) — re-enabling restores old entries
- New entries simply stop being recorded while disabled

### History scope
- Per-device history (keep current behavior — each JDownloader device has its own directory history)
- On device switch, saveto field starts empty (do NOT auto-fill with last-used directory)

### Dedup & ordering
- Case-insensitive deduplication — "Downloads" and "downloads" are the same entry
- When a duplicate with different casing is added, the most recent casing replaces the old entry
- Normalize trailing slashes/backslashes before comparing and storing (e.g., `C:\Downloads\` → `C:\Downloads`)
- MRU ordering — most recently used directory at the top of the dropdown
- Max 10 entries per device — oldest (least recently used) silently evicted when cap reached

### Claude's Discretion
- Icon choice for clear button (x vs trash vs eraser)
- Exact CSS styling and positioning of the clear button
- Settings toggle label and description text
- Whether to add the setting near existing "Add Links Dialog" settings or in its own section

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddLinksController.js:273`: `addToHistory(key, value)` — already deduplicates and prepends entries. Needs modification for case-insensitive dedup, normalization, and max limit.
- `AddLinksController.js:298`: `saveOptionsAndHistory()` — persists history per-device to `chrome.storage.local` via StorageService. Already saves `saveto` history keyed by device ID.
- `templateCache.js:525-530`: `<datalist id="savetoHistory">` with `ng-repeat="entry in history.saveto"` — dropdown UI already wired. Needs conditional rendering when history is disabled.
- `StorageService.js`: Wraps `chrome.storage.local` with `get/set/getAll`. Has `settingsKeys` pattern for settings with defaults — use this for the new history toggle.
- `options.js:129`: `chrome.storage.local.set({ [key]: value })` — settings page save pattern to follow for the new toggle.

### Established Patterns
- Settings use `StorageService.settingsKeys` with `{key, defaultValue}` structure — new toggle follows this
- History stored under `ADD_LINK_CACHED_HISTORY` key, namespaced by `$scope.selection.device.id`
- `addToHistory` uses `$.inArray` for dedup and `unshift` for MRU ordering
- Settings page binds to `chrome.storage.local` changes via direct get/set in `options.js`

### Integration Points
- `AddLinksController.js:68-74`: `$scope.history` initialization — add conditional check for settings toggle
- `AddLinksController.js:305-306`: `saveto` history save point — add conditional check, normalization, and cap enforcement
- `templateCache.js:525-530`: Saveto input area — add clear button markup and conditional datalist rendering
- `options.js` / `partials/templateCache.js` settings section — add new toggle
- `StorageService.js:6-11`: Storage key constants — add new key for history toggle setting

</code_context>

<specifics>
## Specific Ideas

- Clear button should feel native to the existing UI — small, unobtrusive, inline with the field
- The settings toggle should live alongside other extension settings, not in a separate section

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-directory-history*
*Context gathered: 2026-03-07*
