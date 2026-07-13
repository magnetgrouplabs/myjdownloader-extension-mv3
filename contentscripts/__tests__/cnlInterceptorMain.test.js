'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'cnlInterceptorMain.js');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

/**
 * Regression coverage for the mega.nz breakage (issue #9).
 *
 * cnlInterceptorMain.js runs in the MAIN world of EVERY page. Sites harden
 * themselves against monkey-patching by redefining XMLHttpRequest.prototype
 * methods as non-writable (mega.nz's secureboot.js does exactly this). The
 * original implementation assigned `xhr.open = ...` on the instance, which is
 * a [[Set]] that consults the prototype chain and THROWS under 'use strict'
 * when the inherited property is non-writable — taking the host page down.
 */
describe('cnlInterceptorMain — hardened-page safety (issue #9)', () => {
    function runInterceptor(win) {
        // The script is an IIFE that closes over globals; execute it with the
        // supplied window as both `window` and the global scope.
        const fn = new Function(
            'window', 'HTMLFormElement', 'Response', 'Event', 'setTimeout', 'console',
            source
        );
        fn(win, win.HTMLFormElement, win.Response, win.Event, setTimeout, console);
    }

    function makeWindow({ hardened }) {
        class FakeXHR {
            open() {}
            send() {}
            dispatchEvent() {}
        }

        if (hardened) {
            // Reproduce mega.nz's secureboot.js: open/send become non-writable
            // but remain configurable.
            ['open', 'send'].forEach((prop) => {
                const value = FakeXHR.prototype[prop];
                Object.defineProperty(FakeXHR.prototype, prop, {
                    value,
                    writable: false,
                    configurable: true,
                    enumerable: false
                });
            });
        }

        class FakeForm {
            submit() {}
        }

        return {
            XMLHttpRequest: FakeXHR,
            HTMLFormElement: FakeForm,
            fetch: function nativeFetch() {},
            Response: function Response() {},
            Event: function Event() {},
            location: { origin: 'https://example.com', href: 'https://example.com/' },
            addEventListener: () => {},
            postMessage: () => {}
        };
    }

    it('does not throw while installing on a page that hardens XHR.prototype', () => {
        const win = makeWindow({ hardened: true });
        expect(() => runInterceptor(win)).not.toThrow();
    });

    it('lets a hardened page construct and use an XHR (the mega.nz failure)', () => {
        // This is the actual bug. mega.nz's secureboot.js calls
        // `new XMLHttpRequest()` during boot; the old constructor-wrapping
        // implementation assigned `xhr.open = ...` per instance, which threw
        // "Cannot assign to read only property 'open'" right there and killed
        // the page. Constructing and driving an XHR must stay clean.
        const win = makeWindow({ hardened: true });
        runInterceptor(win);

        expect(() => {
            const xhr = new win.XMLHttpRequest();
            xhr.open('GET', 'https://mega.nz/cs?id=1');
            xhr.send(null);
        }).not.toThrow();
    });

    it('preserves instanceof XMLHttpRequest for page code', () => {
        const win = makeWindow({ hardened: false });
        runInterceptor(win);

        const xhr = new win.XMLHttpRequest();
        expect(xhr).toBeInstanceOf(win.XMLHttpRequest);
    });

    it('still installs the XHR hooks on a hardened page (defineProperty path)', () => {
        const win = makeWindow({ hardened: true });
        runInterceptor(win);

        const proto = win.XMLHttpRequest.prototype;
        expect(proto.open.toString()).toMatch(/__myjdCnlUrl/);
        expect(proto.send.toString()).toMatch(/isCnlUrl/);
    });

    it('installs the XHR hooks on a normal page', () => {
        const win = makeWindow({ hardened: false });
        runInterceptor(win);

        const proto = win.XMLHttpRequest.prototype;
        expect(proto.open.toString()).toMatch(/__myjdCnlUrl/);
        expect(proto.send.toString()).toMatch(/isCnlUrl/);
    });

    it('never assigns open/send directly on an XHR instance', () => {
        // The exact construct that broke mega.nz. A [[Set]] against a
        // non-writable inherited property throws in strict mode; use
        // Object.defineProperty (via override()) instead.
        expect(source).not.toMatch(/xhr\.open\s*=/);
        expect(source).not.toMatch(/xhr\.send\s*=/);
    });

    it('patches the XHR prototype rather than wrapping the constructor', () => {
        // Constructor wrapping also silently broke `instanceof XMLHttpRequest`.
        expect(source).not.toMatch(/window\.XMLHttpRequest\s*=\s*function/);
    });

    it('guards every hook so a failure cannot take the host page down', () => {
        expect(source).toMatch(/function installHook/);
        expect(source).toMatch(/installHook\('fetch'/);
        expect(source).toMatch(/installHook\('XMLHttpRequest'/);
        expect(source).toMatch(/installHook\('form submit'/);
    });

    it('reads the form action attribute, not the shadowable .action property', () => {
        // A control named "action" shadows form.action with an Element, which
        // then blows up isCnlUrl()'s .includes() call.
        expect(source).toMatch(/getAttribute\('action'\)/);
    });
});
