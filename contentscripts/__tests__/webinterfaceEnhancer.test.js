'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'webinterfaceEnhancer.js'), 'utf8');

/**
 * my.jdownloader.org posts {name:'ping'} exactly once and sets
 * jd.extensionInstalled only on {type:'ping', name:'pong'}; without it the site
 * never hands reCAPTCHA v2 jobs to the extension. The CAPTCHA icon click is the
 * trigger for a remote JDownloader's other challenges (hCaptcha).
 */
describe('webinterfaceEnhancer', () => {
    const SITE = 'https://my.jdownloader.org';

    function load() {
        const windowListeners = [];
        const documentListeners = [];
        const posted = [];
        const sent = [];
        let settingsCallback = null;

        const win = {
            addEventListener: (type, fn) => { if (type === 'message') windowListeners.push(fn); },
            postMessage: (msg, origin) => posted.push({ msg, origin })
        };
        win.parent = win;
        const doc = {
            addEventListener: (type, fn) => { if (type === 'click') documentListeners.push(fn); }
        };
        const chromeMock = {
            runtime: {
                lastError: null,
                getManifest: () => ({ version: '1.2.3' }),
                sendMessage: (msg, cb) => {
                    sent.push(msg);
                    if (msg.action === 'settings') settingsCallback = cb;
                },
                onMessage: { addListener: () => {} }
            }
        };

        new Function('window', 'document', 'chrome', source)(win, doc, chromeMock);

        return {
            posted, sent,
            message: (data, origin = SITE) => windowListeners.forEach(fn => fn({ data, origin })),
            settings: (response) => settingsCallback(response),
            click: (matches) => documentListeners.forEach(fn => fn({ target: { closest: () => (matches ? {} : null) } }))
        };
    }

    const pongs = page => page.posted.filter(p => p.msg.name === 'pong');

    it('answers a ping that arrives before the service worker does', () => {
        const page = load();
        page.message({ name: 'ping' });
        expect(pongs(page)).toHaveLength(0);

        page.settings({ active: true });
        expect(pongs(page)).toEqual([{ msg: { type: 'ping', name: 'pong', data: { version: '1.2.3' } }, origin: SITE }]);
    });

    it('answers a later ping straight away', () => {
        const page = load();
        page.settings({ active: true });
        page.message({ name: 'ping' });
        expect(pongs(page)).toHaveLength(1);
    });

    it('stays silent when Enhance CAPTCHA dialog is off', () => {
        const page = load();
        page.message({ name: 'ping' });
        page.settings({ active: false });
        page.message({ name: 'ping' });
        expect(pongs(page)).toHaveLength(0);
    });

    it('falls back to the default (on) when the service worker gives no answer', () => {
        const page = load();
        page.message({ name: 'ping' });
        page.settings(undefined);
        expect(pongs(page)).toHaveLength(1);
    });

    it('ignores other origins and messages without data', () => {
        const page = load();
        page.settings({ active: true });
        page.message({ name: 'ping' }, 'https://evil.example');
        page.message(undefined);
        expect(pongs(page)).toHaveLength(0);
    });

    it('forwards a click on the CAPTCHA icon, and nothing else', () => {
        const page = load();
        page.click(false);
        page.click(true);
        expect(page.sent.filter(m => m.action === 'myjd-webui-captcha-click')).toHaveLength(1);
    });

    it('forwards the legacy captcha-new from the site', () => {
        const page = load();
        page.message({ type: 'myjdrc2', name: 'captcha-new', data: {} });
        expect(page.sent).toContainEqual({ name: 'myjdrc2', action: 'captcha-new' });
    });
});
