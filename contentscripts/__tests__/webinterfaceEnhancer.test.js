'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'webinterfaceEnhancer.js');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

const MYJD_ORIGIN = 'https://my.jdownloader.org';

/**
 * Regression coverage for the extension detection handshake (issue #5).
 *
 * my.jdownloader.org registers a `message` listener that sets
 * jd.extensionInstalled = true when it receives {type:'ping', name:'pong'},
 * and then posts {name:'ping'} into its own window exactly ONCE, right after
 * registering that listener. If the single ping goes unanswered, the web
 * interface concludes no extension is installed and shows the
 * "Browser extension required" / install-the-extension page.
 *
 * Two things used to swallow that ping: the enhancer only answers while it
 * believes the enhancement is active, and the answer to its settings request
 * arrives asynchronously from the service worker (which may still be starting).
 */
describe('webinterfaceEnhancer — extension detection handshake (issue #5)', () => {
    function runEnhancer() {
        const messageListeners = [];
        const runtimeListeners = [];
        const postMessage = jest.fn();
        let settingsCallback = null;

        const win = {
            addEventListener: (type, fn) => {
                if (type === 'message') messageListeners.push(fn);
            },
            parent: { postMessage }
        };

        const chromeMock = {
            runtime: {
                getManifest: () => ({ version: '9.9.9' }),
                sendMessage: (msg, cb) => {
                    if (msg && msg.name === 'webinterface-enhancer' && msg.action === 'settings') {
                        settingsCallback = cb;
                    }
                },
                onMessage: { addListener: (fn) => runtimeListeners.push(fn) },
                lastError: null
            }
        };

        // The script is an IIFE closing over `window` and `chrome`; run it with
        // both supplied so the real registration order is exercised.
        const fn = new Function('window', 'chrome', 'console', source);
        fn(win, chromeMock, console);

        return {
            postMessage,
            hasSettingsRequest: () => settingsCallback !== null,
            ping: (origin = MYJD_ORIGIN, data = { name: 'ping' }) =>
                messageListeners.forEach((listener) => listener({ origin, data })),
            answerSettings: (response) => settingsCallback(response),
            pushSettingChange: (active) =>
                runtimeListeners.forEach((listener) => listener({
                    type: 'change',
                    name: 'webinterface-enhancer',
                    action: 'settings',
                    data: { active }
                }))
        };
    }

    const PONG = { type: 'ping', name: 'pong', data: { version: '9.9.9' } };

    it('asks the service worker whether the enhancement is active', () => {
        expect(runEnhancer().hasSettingsRequest()).toBe(true);
    });

    it('answers a ping that arrived before the setting was known', () => {
        const enhancer = runEnhancer();

        // The page pings while the settings round trip is still in flight.
        enhancer.ping();
        expect(enhancer.postMessage).not.toHaveBeenCalled();

        enhancer.answerSettings({ active: true });

        // The queued ping must be answered, because it never comes again.
        expect(enhancer.postMessage).toHaveBeenCalledWith(PONG, MYJD_ORIGIN);
    });

    it('answers a ping that arrives after the setting is known', () => {
        const enhancer = runEnhancer();

        enhancer.answerSettings({ active: true });
        enhancer.ping();

        expect(enhancer.postMessage).toHaveBeenCalledWith(PONG, MYJD_ORIGIN);
    });

    it('answers a queued ping when the setting is pushed live instead', () => {
        const enhancer = runEnhancer();

        enhancer.ping();
        enhancer.pushSettingChange(true);

        expect(enhancer.postMessage).toHaveBeenCalledWith(PONG, MYJD_ORIGIN);
    });

    it('stays silent while the enhancement is switched off', () => {
        const enhancer = runEnhancer();

        enhancer.answerSettings({ active: false });
        enhancer.ping();

        expect(enhancer.postMessage).not.toHaveBeenCalled();
    });

    it('falls back to the documented default when the service worker gives no answer', () => {
        const enhancer = runEnhancer();

        // No usable response (service worker error, or a build without the
        // responder): the ENHANCE_CAPTCHA_DIALOG default is true, so detection
        // must still work instead of silently failing.
        enhancer.answerSettings(undefined);
        enhancer.ping();

        expect(enhancer.postMessage).toHaveBeenCalledWith(PONG, MYJD_ORIGIN);
    });

    it('ignores pings from other origins', () => {
        const enhancer = runEnhancer();

        enhancer.answerSettings({ active: true });
        enhancer.ping('https://evil.example.com');

        expect(enhancer.postMessage).not.toHaveBeenCalled();
    });

    it('survives messages without data and without a name', () => {
        const enhancer = runEnhancer();
        enhancer.answerSettings({ active: true });

        expect(() => enhancer.ping(MYJD_ORIGIN, null)).not.toThrow();
        expect(() => enhancer.ping(MYJD_ORIGIN, {})).not.toThrow();
        expect(enhancer.postMessage).not.toHaveBeenCalled();
    });
});
