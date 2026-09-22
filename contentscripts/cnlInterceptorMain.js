'use strict';

/**
 * CNL (Click'N'Load) Interceptor - MAIN world part.
 *
 * This MUST run in the page's MAIN world, not the isolated content-script
 * world. Overriding window.fetch / window.XMLHttpRequest from an isolated
 * content script has no effect on the page's own network calls, since
 * MV3 isolated-world content scripts get a separate JS realm that only
 * shares the DOM with the page, not window-level objects like fetch/XHR.
 * (Same reason CAPTCHA execution elsewhere in this extension already uses
 * world: 'MAIN' - see background.js myjd-captcha-execute handler.)
 *
 * This script has NO access to chrome.runtime (MAIN world scripts don't),
 * so captured CNL data is handed off via window.postMessage to
 * cnlInterceptor.js, which runs in the isolated world and forwards it to
 * the background service worker.
 *
 * Because this runs in the MAIN world of EVERY page, every hook it installs
 * must fail soft: see override() / installHook() below.
 */

(function() {
    if (window.__myjdCnlInterceptorMainInstalled) return;
    window.__myjdCnlInterceptorMainInstalled = true;

    console.log('[CNL Interceptor/MAIN] Installed');

    const LOCALHOST_PATTERNS = [
        'localhost:9666',
        '127.0.0.1:9666'
    ];

    const CNL_ENDPOINTS = {
        JD_CHECK: '/jdcheck.js',
        CROSSDOMAIN: '/crossdomain.xml',
        ADD_CRYPTED: '/flash/addcrypted2',
        ADD: '/flash/add'
    };

    const BRIDGE_MARKER = '__myjd_cnl_bridge__';

    const CROSSDOMAIN_XML = `<?xml version="1.0"?>
<cross-domain-policy>
  <site-control permitted-cross-domain-policies="master-only"/>
  <allow-access-from domain="*"/>
  <allow-http-request-headers-from domain="*" headers="*"/>
</cross-domain-policy>`;

    function isCnlUrl(url) {
        return LOCALHOST_PATTERNS.some(pattern => url.includes(pattern));
    }

    function getEndpointType(url) {
        if (url.includes(CNL_ENDPOINTS.JD_CHECK)) return 'JD_CHECK';
        if (url.includes(CNL_ENDPOINTS.CROSSDOMAIN)) return 'CROSSDOMAIN';
        if (url.includes(CNL_ENDPOINTS.ADD_CRYPTED)) return 'ADD_CRYPTED';
        if (url.includes(CNL_ENDPOINTS.ADD)) return 'ADD';
        return 'UNKNOWN';
    }

    // Capture form data from various formats. Only plain-object-able
    // inputs are forwarded (postMessage cannot structured-clone Blob/
    // ArrayBuffer usefully for our purposes here, so those degrade to a
    // string marker instead of silently dropping data).
    function captureFormData(data) {
        if (!data) return null;

        if (data instanceof FormData) {
            const result = {};
            for (const [key, value] of data.entries()) {
                result[key] = (value instanceof Blob) ? '[blob]' : value;
            }
            return result;
        }

        if (data instanceof URLSearchParams) {
            const result = {};
            for (const [key, value] of data.entries()) {
                result[key] = value;
            }
            return result;
        }

        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (e) {
                // Not JSON — the common CNL case is an
                // application/x-www-form-urlencoded body ("urls=...&source=...").
                // Without parsing it here everything ended up as
                // {rawData: "..."}, so the dummycnl URL built from it carried
                // none of the keys JDownloader looks at (urls/crypted/jk): the
                // send reported success but nothing arrived in JDownloader.
                if (data.indexOf('=') !== -1) {
                    try {
                        const params = new URLSearchParams(data);
                        const result = {};
                        let hasKeys = false;
                        for (const [key, value] of params.entries()) {
                            result[key] = value;
                            hasKeys = true;
                        }
                        if (hasKeys) return result;
                    } catch (e2) { /* fall through to rawData below */ }
                }
                return { rawData: data };
            }
        }

        if (typeof data === 'object' && !(data instanceof Blob) && !(data instanceof ArrayBuffer)) {
            return data;
        }

        return { rawData: String(data) };
    }

    // Hand captured CNL data to the isolated-world bridge via postMessage.
    function sendCnlData(type, url, data, sourceUrl) {
        try {
            window.postMessage({
                [BRIDGE_MARKER]: true,
                type: type,
                url: url,
                formData: data,
                sourceUrl: sourceUrl,
                timestamp: Date.now()
            }, window.location.origin);
            console.log('[CNL Interceptor/MAIN] Handed off to bridge:', type);
        } catch (e) {
            console.error('[CNL Interceptor/MAIN] Failed to postMessage:', e);
        }
    }

    // Every override below runs on every page we are injected into, so a
    // failure to install one must never take the host page down with it.
    function installHook(name, install) {
        try {
            install();
        } catch (e) {
            console.warn('[CNL Interceptor/MAIN] ' + name + ' hook not installed:', e && e.message);
        }
    }

    // Replace a method with a wrapper, preserving the original property
    // attributes. Plain assignment is NOT usable here: sites harden
    // themselves against monkey-patching by redefining these as
    // non-writable (mega.nz's secureboot.js does exactly this to
    // XMLHttpRequest.prototype.open/send), and under 'use strict' a [[Set]]
    // against a non-writable property throws — which is what took mega.nz
    // down entirely. defineProperty still succeeds as long as the property
    // is configurable, so the hook installs and the page keeps working.
    function override(target, prop, makeWrapper) {
        const original = target[prop];
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        Object.defineProperty(target, prop, {
            value: makeWrapper(original),
            writable: descriptor ? descriptor.writable : true,
            configurable: descriptor ? descriptor.configurable : true,
            enumerable: descriptor ? descriptor.enumerable : false
        });
        return original;
    }

    // ---- fetch override ----
    installHook('fetch', function() {
        override(window, 'fetch', function(originalFetch) {
            return async function(url, options) {
                const urlString = url.toString();

                if (isCnlUrl(urlString)) {
                    console.log('[CNL Interceptor/MAIN] Intercepted fetch:', urlString);
                    const type = getEndpointType(urlString);

                    if (type === 'JD_CHECK') {
                        return new Response('var jdownloader = true;', {
                            status: 200,
                            headers: { 'Content-Type': 'text/javascript' }
                        });
                    }

                    if (type === 'CROSSDOMAIN') {
                        return new Response(CROSSDOMAIN_XML, {
                            status: 200,
                            headers: { 'Content-Type': 'text/xml' }
                        });
                    }

                    if (type === 'ADD_CRYPTED' || type === 'ADD') {
                        const formData = captureFormData(options && options.body);
                        sendCnlData(type, urlString, formData, window.location.href);
                        return new Response('OK', { status: 200 });
                    }
                }

                return originalFetch.apply(this, arguments);
            };
        });
    });

    // ---- XMLHttpRequest override ----
    // Patch the prototype methods rather than wrapping the constructor and
    // assigning per-instance `open`/`send`. Per-instance assignment is a
    // [[Set]], which consults the prototype chain and throws in strict mode
    // when the inherited property is non-writable (a frozen prototype). It
    // also broke `instanceof XMLHttpRequest` for page code.
    installHook('XMLHttpRequest', function() {
        const xhrProto = window.XMLHttpRequest.prototype;

        // Fake a completed 200 response on an XHR we are short-circuiting.
        function fakeResponse(xhr, responseText) {
            Object.defineProperty(xhr, 'responseText', { get: () => responseText, configurable: true });
            Object.defineProperty(xhr, 'response', { get: () => responseText, configurable: true });
            Object.defineProperty(xhr, 'status', { get: () => 200, configurable: true });
            Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
            setTimeout(function() {
                if (xhr.onreadystatechange) xhr.onreadystatechange();
                if (xhr.onload) xhr.onload();
                xhr.dispatchEvent(new Event('readystatechange'));
                xhr.dispatchEvent(new Event('load'));
                xhr.dispatchEvent(new Event('loadend'));
            }, 0);
        }

        override(xhrProto, 'open', function(originalOpen) {
            return function(method, url) {
                this.__myjdCnlUrl = url;
                return originalOpen.apply(this, arguments);
            };
        });

        override(xhrProto, 'send', function(originalSend) {
            return function(body) {
                const requestUrl = this.__myjdCnlUrl || '';

                if (isCnlUrl(requestUrl)) {
                    console.log('[CNL Interceptor/MAIN] Intercepted XHR:', requestUrl);
                    const type = getEndpointType(requestUrl);

                    if (type === 'JD_CHECK') {
                        fakeResponse(this, 'var jdownloader = true;');
                        return;
                    }

                    if (type === 'CROSSDOMAIN') {
                        fakeResponse(this, CROSSDOMAIN_XML);
                        return;
                    }

                    if (type === 'ADD_CRYPTED' || type === 'ADD') {
                        sendCnlData(type, requestUrl, captureFormData(body), window.location.href);
                        fakeResponse(this, 'OK');
                        return;
                    }
                }

                return originalSend.apply(this, arguments);
            };
        });
    });

    // ---- classic CNLPOP form submission ----
    // Some hosters still submit CNL via a plain HTML <form target="hidden">
    // POST (the CNLPOP() pattern) instead of fetch/XHR. Intercept
    // HTMLFormElement.prototype.submit and form "submit" events targeting
    // our localhost endpoints so that path is covered too.
    function handleFormSubmit(form) {
        if (!form) return false;

        // form.action is shadowed by any control named "action", so read the
        // attribute directly rather than the (possibly Element-valued) prop.
        const action = form.getAttribute && form.getAttribute('action');
        if (!action || typeof action !== 'string') return false;
        if (!isCnlUrl(action)) return false;

        const type = getEndpointType(action);
        if (type !== 'ADD_CRYPTED' && type !== 'ADD') return false;

        const formData = {};
        Array.from(form.elements || []).forEach(el => {
            if (el.name) formData[el.name] = el.value;
        });

        sendCnlData(type, action, formData, window.location.href);
        return true;
    }

    installHook('form submit', function() {
        override(HTMLFormElement.prototype, 'submit', function(originalFormSubmit) {
            return function() {
                try {
                    if (handleFormSubmit(this)) return;
                } catch (e) {
                    console.warn('[CNL Interceptor/MAIN] form submit check failed:', e && e.message);
                }
                return originalFormSubmit.apply(this, arguments);
            };
        });

        window.addEventListener('submit', function(e) {
            try {
                if (handleFormSubmit(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } catch (err) {
                console.warn('[CNL Interceptor/MAIN] form submit check failed:', err && err.message);
            }
        }, true);
    });

    console.log('[CNL Interceptor/MAIN] Ready');
})();
