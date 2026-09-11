'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'browserSolverBridge.js');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

/**
 * Coverage for the hand-off from JDownloader's own browser solver page
 * (issue #5).
 *
 * JDownloader serves its challenge pages on the loopback interface. Its
 * recaptcha.html embeds the widget and submits the token itself; its
 * hcaptcha.html contains no widget and no hCaptcha api.js at all — it is only
 * the "Browser extension required" page, because hCaptcha has to run on the
 * hoster's domain. The challenge data is in meta tags for the extension to
 * pick up.
 */
describe('browserSolverBridge — JD browser solver hand-off (issue #5)', () => {
    const HCAPTCHA_METAS = {
        sitekey: '10000000-ffff-ffff-ffff-000000000001',
        sitekeyType: 'NORMAL',
        v3action: '',
        challengeType: 'hcaptcha',
        siteDomain: 'ddownload.com',
        siteUrl: 'https://ddownload.com/file/abc',
        challengeId: '1735689600123'
    };

    function run({
        url = 'http://127.0.0.1:9666/captcha/hcaptcha/ddownload.com?id=1735689600123',
        metas = HCAPTCHA_METAS
    } = {}) {
        const parsed = new URL(url);
        const sent = [];

        const doc = {
            querySelector: (selector) => {
                const match = /^meta\[name="(.+)"\]$/.exec(selector);
                if (!match) return null;
                const value = metas[match[1]];
                if (value === undefined) return null;
                return { getAttribute: () => value };
            }
        };

        const win = {
            location: {
                origin: parsed.origin,
                pathname: parsed.pathname,
                search: parsed.search,
                href: url
            }
        };

        const chromeMock = {
            runtime: {
                lastError: null,
                sendMessage: (msg, cb) => {
                    sent.push(msg);
                    if (cb) cb({ status: 'ok' });
                }
            }
        };

        const fn = new Function('window', 'document', 'chrome', 'URLSearchParams', 'console', source);
        fn(win, doc, chromeMock, URLSearchParams, { log: () => {}, warn: () => {} });

        return sent;
    }

    it('hands an hCaptcha challenge to the service worker', () => {
        const sent = run();

        expect(sent).toHaveLength(1);
        expect(sent[0].action).toBe('jd-browser-solver-job');
    });

    it('maps the meta tags onto the job fields the solver expects', () => {
        const [message] = run();

        expect(message.data.jobDetails).toEqual({
            captchaType: 'hcaptcha',
            siteKey: '10000000-ffff-ffff-ffff-000000000001',
            siteKeyType: 'NORMAL',
            v3action: '',
            hoster: 'ddownload.com',
            targetUrl: 'https://ddownload.com/file/abc',
            captchaId: '1735689600123'
        });
    });

    it('passes JDownloader\'s own URL as the callback so the token goes back there', () => {
        const url = 'http://127.0.0.1:9666/captcha/hcaptcha/ddownload.com?id=42';
        const [message] = run({ url, metas: Object.assign({}, HCAPTCHA_METAS, { challengeId: '42' }) });

        expect(message.data.callbackUrl).toBe(url);
    });

    it('leaves reCAPTCHA pages alone — JDownloader solves those on its own page', () => {
        const sent = run({
            url: 'http://127.0.0.1:9666/captcha/recaptchav2/example.org?id=7',
            metas: Object.assign({}, HCAPTCHA_METAS, { challengeType: 'recaptchav2' })
        });

        expect(sent).toHaveLength(0);
    });

    it('ignores pages that are not on the loopback interface', () => {
        const sent = run({ url: 'https://example.com/captcha/hcaptcha/ddownload.com?id=7' });

        expect(sent).toHaveLength(0);
    });

    it('ignores unfilled template placeholders', () => {
        const sent = run({
            metas: Object.assign({}, HCAPTCHA_METAS, {
                sitekey: '%%%sitekey%%%',
                siteUrl: '%%%siteUrl%%%'
            })
        });

        expect(sent).toHaveLength(0);
    });

    it('does not navigate anywhere when the site URL is missing', () => {
        const metas = Object.assign({}, HCAPTCHA_METAS);
        delete metas.siteUrl;

        expect(run({ metas })).toHaveLength(0);
    });

    it('falls back to the URL path and query when optional metas are absent', () => {
        const metas = {
            sitekey: 'key-only',
            siteUrl: 'https://ddownload.com/file/abc'
        };

        const [message] = run({
            url: 'http://localhost:3128/captcha/hcaptcha/ddownload.com?id=99',
            metas
        });

        expect(message.data.jobDetails).toMatchObject({
            captchaType: 'hcaptcha',
            hoster: 'ddownload.com',
            captchaId: '99',
            siteKeyType: '',
            v3action: ''
        });
    });
});
