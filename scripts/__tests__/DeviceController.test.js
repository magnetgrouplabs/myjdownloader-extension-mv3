'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const controller = fs.readFileSync(
    path.join(root, 'scripts', 'controllers', 'DeviceController.js'), 'utf8');
const backgroundScriptService = fs.readFileSync(
    path.join(root, 'scripts', 'services', 'BackgroundScriptService.js'), 'utf8');

/**
 * Wiring coverage for the device panel (issue #21).
 *
 * The panel's numbers were never filled in and Start / Pause / Stop never
 * reached JDownloader, because both went through background messages that no
 * context handles. Both now use the same direct cloud client that already
 * loads the device list and sends links.
 *
 * Nothing here bootstraps AngularJS, so this is source-text analysis in the
 * style of ConnectedController.test.js. The behavior of the poll itself is
 * covered by scripts/services/__tests__/MyjdDeviceService.test.js.
 */
describe('DeviceController wiring (issue #21)', () => {
    function dependencyAnnotation() {
        const match = controller.match(/\.controller\('DeviceCtrl',\s*\[([\s\S]*?)function\s*\(/);
        expect(match).not.toBeNull();
        return match[1];
    }

    function injectedArguments() {
        const match = controller.match(/\.controller\('DeviceCtrl',[\s\S]*?function\s*\(([^)]*)\)/);
        expect(match).not.toBeNull();
        return match[1];
    }

    function handlerBody(name) {
        const start = controller.indexOf('$scope.' + name + ' = function');
        expect(start).toBeGreaterThan(-1);
        const next = controller.indexOf('\n        $scope.', start + 1);
        return controller.slice(start, next === -1 ? undefined : next);
    }

    it('injects the device client factory', () => {
        expect(dependencyAnnotation()).toMatch(/'myjdDeviceClientFactory'/);
        expect(injectedArguments()).toMatch(/myjdDeviceClientFactory/);
    });

    it('builds its own client for the device the panel renders', () => {
        expect(controller).toMatch(/myjdDeviceClientFactory\.get\(\s*\$scope\.device\s*\)/);
    });

    it('registers a status callback on that client', () => {
        expect(controller).toMatch(/deviceClient\.onStatus\(\s*function/);
    });

    it('polls once immediately and then on an interval', () => {
        const polls = controller.match(/deviceClient\.oneTimePoll\(\)/g) || [];
        expect(polls.length).toBeGreaterThanOrEqual(2);
        expect(controller).toMatch(/\$interval\([\s\S]*?deviceClient\.oneTimePoll\(\)[\s\S]*?\},\s*4000\)/);
    });

    it('stops the interval when the panel is destroyed', () => {
        const destroy = controller.match(/\$scope\.\$on\('\$destroy',[\s\S]*$/);
        expect(destroy).not.toBeNull();
        expect(destroy[0]).toMatch(/\$interval\.cancel\(intervalPromise\)/);
    });

    it('routes start, pause and stop through the same client', () => {
        expect(handlerBody('start')).toMatch(/deviceClient\.sendRequest\("\/downloads\/start"\)/);
        expect(handlerBody('pause')).toMatch(/deviceClient\.sendRequest\("\/downloadcontroller\/pause",/);
        expect(handlerBody('stop')).toMatch(/deviceClient\.sendRequest\("\/downloadcontroller\/stop"\)/);
    });

    it('sends pause a real boolean', () => {
        // "pause | false" is a bitwise or, so it used to send 0 or 1.
        expect(handlerBody('pause')).not.toMatch(/pause\s*\|\s*false/);
        expect(handlerBody('pause')).toMatch(/!!pause/);
    });

    it('guards a control request that did not come back as a deferred', () => {
        // MyjdService.send() returns undefined while the session is restoring,
        // the same guard AddLinksController applies before sending links.
        ['start', 'pause', 'stop'].forEach(name => {
            expect(handlerBody(name)).toMatch(/sendControlRequest\(/);
        });
        expect(controller).toMatch(/typeof\s+request\.done\s*!==\s*'function'/);
    });

    it('shows an error on a failed control request instead of reporting success', () => {
        const failure = controller.match(/\.fail\(function\s*\(error\)\s*\{([\s\S]*?)\}\);/);
        expect(failure).not.toBeNull();
        expect(failure[1]).toMatch(/handleApiError\(error\)/);
    });

    it('shows the api error text when a poll fails', () => {
        const callback = controller.match(/deviceClient\.onStatus\(function\s*\(data\)\s*\{([\s\S]*?)\n\s{8}\}\);/);
        expect(callback).not.toBeNull();
        expect(callback[1]).toMatch(/data\.error/);
        expect(callback[1]).toMatch(/handleApiError\(data\.error\)/);
    });

    it('no longer uses the background messages that nothing handles', () => {
        expect(controller).not.toMatch(/BackgroundScriptService\.devicePoll/);
        expect(controller).not.toMatch(/BackgroundScriptService\.onDevicePoll/);
        expect(controller).not.toMatch(/BackgroundScriptService\.sendApiRequest/);
    });

    it('leaves no unreachable device senders behind in BackgroundScriptService', () => {
        ['device-poll', 'device-poll-start', 'device-poll-stop', 'send-api-request']
            .forEach(action => {
                expect(backgroundScriptService).not.toContain('"' + action + '"');
            });
    });
});
