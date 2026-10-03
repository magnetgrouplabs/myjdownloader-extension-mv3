'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const templateCache = fs.readFileSync(path.join(root, 'partials', 'templateCache.js'), 'utf8');
const controllerSrc = fs.readFileSync(
    path.join(root, 'scripts', 'controllers', 'SettingsController.js'), 'utf8');
const serviceSrc = fs.readFileSync(
    path.join(root, 'scripts', 'services', 'BackgroundScriptService.js'), 'utf8');
const backgroundSrc = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

/**
 * Coverage for the manual "Check for updates" action in the settings view.
 *
 * The generic handler check below is the important one, and it is the same
 * guard ConnectedController.test.js applies to the popup nav: AngularJS
 * silently no-ops an ng-click whose expression resolves to undefined, so a
 * template can call a handler no controller defines and the control just does
 * nothing. No error, no console warning. Pinning only the known name would let
 * a future settings edit reintroduce a dead control, so every handler the
 * settings template calls is extracted and checked.
 */
describe('Settings view: manual update check', () => {
    // Isolate the settings template from the concatenated cache.
    function settingsTemplate() {
        const start = templateCache.indexOf("$templateCache.put('partials/controllers/settings.html'");
        expect(start).toBeGreaterThan(-1);
        const next = templateCache.indexOf('$templateCache.put(', start + 1);
        return templateCache.slice(start, next === -1 ? undefined : next);
    }

    function handlersCalledBy(template) {
        const names = new Set();
        const re = /ng-(?:click|change|class|if|show)=\\?"[^"]*?([a-zA-Z_$][\w$]*)\s*\(/g;
        let m;
        while ((m = re.exec(template)) !== null) names.add(m[1]);
        return names;
    }

    function definedOnScope(src) {
        const names = new Set();
        const re = /\$scope\.([a-zA-Z_$][\w$]*)\s*=\s*function/g;
        let m;
        while ((m = re.exec(src)) !== null) names.add(m[1]);
        return names;
    }

    it('defines every handler the settings template calls', () => {
        const called = handlersCalledBy(settingsTemplate());
        const defined = definedOnScope(controllerSrc);

        // translate is the angular-translate filter, not a scope handler.
        called.delete('translate');

        const missing = [...called].filter((name) => !defined.has(name));
        expect(missing).toEqual([]);
    });

    it('wires the update check specifically', () => {
        expect(settingsTemplate()).toContain('checkForUpdate()');
        expect(definedOnScope(controllerSrc).has('checkForUpdate')).toBe(true);
    });

    it('reaches the background through the check-for-update action', () => {
        // Controller -> service -> background. A break in any link is a dead
        // control, which is the failure mode this whole file exists to catch.
        expect(controllerSrc).toMatch(/backgroundScriptService\.checkForUpdate\s*\(/);
        expect(serviceSrc).toMatch(/this\.checkForUpdate\s*=\s*checkForUpdate/);
        expect(serviceSrc).toContain('"check-for-update"');
        expect(backgroundSrc).toContain('action === "check-for-update"');
    });

    it('renders a distinct status for every outcome, including failure', () => {
        const template = settingsTemplate();
        // A failed check has to say so. Silently doing nothing is the bug
        // pattern this codebase keeps hitting.
        ['checking', 'current', 'error', 'found'].forEach((state) => {
            expect(template).toContain("updateCheckState === '" + state + "'");
        });
        expect(controllerSrc).toContain("$scope.updateCheckState = 'error'");
    });

    it('has every string the update-check UI renders, in all three locales', () => {
        const keys = [
            'ui_settings_update_check',
            'ui_settings_update_checking',
            'ui_settings_update_uptodate',
            'ui_settings_update_failed',
            'ui_settings_update_available',
            'ui_settings_update_download'
        ];
        ['en', 'de', 'es'].forEach((loc) => {
            const messages = JSON.parse(
                fs.readFileSync(path.join(root, '_locales', loc, 'messages.json'), 'utf8'));
            const missing = keys.filter((k) => !(messages[k] && messages[k].message));
            expect({ locale: loc, missing }).toEqual({ locale: loc, missing: [] });
        });
    });
});
