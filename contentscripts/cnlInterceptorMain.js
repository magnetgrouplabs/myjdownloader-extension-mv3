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
 * cnlInterceptorBridge.js, which runs in the isolated world and forwards
 * it to the background service worker.
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

    // ---- fetch override ----
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
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
                const crossdomain = `<?xml version="1.0"?>
<cross-domain-policy>
  <site-control permitted-cross-domain-policies="master-only"/>
  <allow-access-from domain="*"/>
  <allow-http-request-headers-from domain="*" headers="*"/>
</cross-domain-policy>`;
                return new Response(crossdomain, {
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

    // ---- XMLHttpRequest override ----
    const OriginalXHR = window.XMLHttpRequest;

    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        let requestUrl = '';
        let capturedBody = null;

        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
            requestUrl = url;
            return originalOpen.apply(this, arguments);
        };

        const originalSend = xhr.send;
        xhr.send = function(body) {
            capturedBody = body;

            if (isCnlUrl(requestUrl)) {
                console.log('[CNL Interceptor/MAIN] Intercepted XHR:', requestUrl);
                const type = getEndpointType(requestUrl);

                if (type === 'JD_CHECK') {
                    Object.defineProperty(xhr, 'responseText', { get: () => 'var jdownloader = true;' });
                    Object.defineProperty(xhr, 'status', { get: () => 200 });
                    Object.defineProperty(xhr, 'readyState', { get: () => 4 });
                    if (xhr.onload) setTimeout(() => xhr.onload(), 0);
                    if (xhr.onreadystatechange) setTimeout(() => xhr.onreadystatechange(), 0);
                    return;
                }

                if (type === 'CROSSDOMAIN') {
                    const crossdomain = `<?xml version="1.0"?>
<cross-domain-policy>
  <site-control permitted-cross-domain-policies="master-only"/>
  <allow-access-from domain="*"/>
  <allow-http-request-headers-from domain="*" headers="*"/>
</cross-domain-policy>`;
                    Object.defineProperty(xhr, 'responseText', { get: () => crossdomain });
                    Object.defineProperty(xhr, 'status', { get: () => 200 });
                    Object.defineProperty(xhr, 'readyState', { get: () => 4 });
                    if (xhr.onload) setTimeout(() => xhr.onload(), 0);
                    if (xhr.onreadystatechange) setTimeout(() => xhr.onreadystatechange(), 0);
                    return;
                }

                if (type === 'ADD_CRYPTED' || type === 'ADD') {
                    const formData = captureFormData(capturedBody);
                    sendCnlData(type, requestUrl, formData, window.location.href);

                    Object.defineProperty(xhr, 'responseText', { get: () => 'OK' });
                    Object.defineProperty(xhr, 'status', { get: () => 200 });
                    Object.defineProperty(xhr, 'readyState', { get: () => 4 });
                    if (xhr.onload) setTimeout(() => xhr.onload(), 0);
                    if (xhr.onreadystatechange) setTimeout(() => xhr.onreadystatechange(), 0);
                    return;
                }
            }

            return originalSend.apply(this, arguments);
        };

        return xhr;
    };

    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);

    // ---- classic CNLPOP form submission ----
    // Some hosters still submit CNL via a plain HTML <form target="hidden">
    // POST (the CNLPOP() pattern) instead of fetch/XHR. Intercept
    // HTMLFormElement.prototype.submit and form "submit" events targeting
    // our localhost endpoints so that path is covered too.
    function handleFormSubmit(form) {
        if (!form || !form.action) return false;
        if (!isCnlUrl(form.action)) return false;

        const type = getEndpointType(form.action);
        if (type !== 'ADD_CRYPTED' && type !== 'ADD') return false;

        const formData = {};
        Array.from(form.elements || []).forEach(el => {
            if (el.name) formData[el.name] = el.value;
        });

        sendCnlData(type, form.action, formData, window.location.href);
        return true;
    }

    const originalFormSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
        if (handleFormSubmit(this)) return;
        return originalFormSubmit.apply(this, arguments);
    };

    window.addEventListener('submit', function(e) {
        if (handleFormSubmit(e.target)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    console.log('[CNL Interceptor/MAIN] Ready');
})();
