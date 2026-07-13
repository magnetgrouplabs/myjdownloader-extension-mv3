'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const controller = fs.readFileSync(
    path.join(root, 'scripts', 'controllers', 'ConnectedController.js'), 'utf8');
const templateCache = fs.readFileSync(
    path.join(root, 'partials', 'templateCache.js'), 'utf8');

/**
 * Regression coverage for issue #4 ("Saved tab not working").
 *
 * partials/directives/myconnectedpanel.html has always wired the popup's
 * "Saved" nav entry to showClipboardHistoryPanel() / isShowingClipboard(),
 * but neither was ever ported to MV3. Angular silently no-ops an ng-click
 * whose expression resolves to undefined, so the button did nothing and the
 * panel could never be reached. The feedback entry was dead for the same
 * reason.
 *
 * Rather than pin the two known names, extract every handler the connected
 * panel actually calls and assert the controller defines all of them, so a
 * future template edit cannot reintroduce a dead button silently.
 */
describe('ConnectedController — popup nav handlers (issue #4)', () => {
    // Isolate the myconnectedpanel template from the concatenated cache.
    function connectedPanelTemplate() {
        const start = templateCache.indexOf("$templateCache.put('partials/directives/myconnectedpanel.html'");
        expect(start).toBeGreaterThan(-1);
        const next = templateCache.indexOf('$templateCache.put(', start + 1);
        return templateCache.slice(start, next === -1 ? undefined : next);
    }

    function handlersCalledBy(template) {
        // ng-click="foo()" and ng-class="{'selected': bar()}" -> foo, bar
        const names = new Set();
        const re = /ng-(?:click|class|if|show)=\\?"[^"]*?([a-zA-Z_$][\w$]*)\s*\(/g;
        let m;
        while ((m = re.exec(template)) !== null) names.add(m[1]);
        return names;
    }

    function definedOnScope(src) {
        const names = new Set();
        const re = /\$scope\.([a-zA-Z_$][\w$]*)\s*=/g;
        let m;
        while ((m = re.exec(src)) !== null) names.add(m[1]);
        return names;
    }

    it('defines every handler the connected panel calls', () => {
        const called = handlersCalledBy(connectedPanelTemplate());
        const defined = definedOnScope(controller);

        // Angular built-ins and filters the template may reference.
        const builtins = new Set(['translate']);

        // Pre-existing dead template code, deliberately not wired up here.
        // Both sit inside blocks that cannot render today, so unlike the
        // Saved/feedback entries they are not reachable dead buttons:
        //   stopAutoGrabber -> gated on ng-if="autoGrabberState.isActive",
        //     and autoGrabberState is never set on any scope, so the whole
        //     grabber-running-container never renders.
        //   sendError -> gated on ng-if="state.error.log", which no error
        //     path currently sets.
        // Tracked separately; listing them keeps this guard honest instead
        // of silently passing.
        const knownUnwired = new Set(['stopAutoGrabber', 'sendError']);

        const missing = [...called].filter((fn) =>
            !defined.has(fn) && !builtins.has(fn) && !knownUnwired.has(fn));
        expect(missing).toEqual([]);
    });

    it('defines the Saved nav handlers specifically', () => {
        expect(controller).toMatch(/\$scope\.showClipboardHistoryPanel\s*=/);
        expect(controller).toMatch(/\$scope\.isShowingClipboard\s*=/);
    });

    it('defines the feedback nav handlers specifically', () => {
        expect(controller).toMatch(/\$scope\.toggleFeedbackPanel\s*=/);
        expect(controller).toMatch(/\$scope\.isShowingFeedbackPanel\s*=/);
    });

    it('routes the Saved view through a distinct viewstate', () => {
        expect(controller).toMatch(/viewstate\s*=\s*'CLIPBOARD_HISTORY'/);
        expect(controller).toMatch(/viewstate\s*===\s*'CLIPBOARD_HISTORY'/);
    });

    it('injects BackgroundScriptService for feedback submission', () => {
        // A DI array that misses the dependency throws on controller
        // instantiation, which would blank the whole popup.
        const diMatch = controller.match(/\.controller\('ConnectedCtrl',\s*\[([^\]]*)\]/);
        expect(diMatch).not.toBeNull();
        expect(diMatch[1]).toMatch(/BackgroundScriptService/);

        const fnMatch = controller.match(/function\s*\(([^)]*)\)/);
        expect(fnMatch[1]).toMatch(/BackgroundScriptService/);
    });
});
