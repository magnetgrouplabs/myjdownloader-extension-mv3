'use strict';

/**
 * CNL (Click'N'Load) Interceptor for MV3
 * Overrides fetch/XHR to capture CNL requests to localhost:9666
 * and forwards them to the extension for processing.
 */

(function() {
    // Prevent double-injection
    if (window.__myjdCnlInterceptorInstalled) return;
    window.__myjdCnlInterceptorInstalled = true;

    console.log('[CNL Interceptor] Installed');

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

    // Capture form data from various formats
    function captureFormData(data) {
        if (!data) return null;

        // If it's already an object, return it
        if (typeof data === 'object' && !(data instanceof Blob) && !(data instanceof ArrayBuffer)) {
            return data;
        }

        // If it's FormData, convert to object
        if (data instanceof FormData) {
            const result = {};
            for (const [key, value] of data.entries()) {
                result[key] = value;
            }
            return result;
        }

        // If it's URLSearchParams, convert to object
        if (data instanceof URLSearchParams) {
            const result = {};
            for (const [key, value] of data.entries()) {
                result[key] = value;
            }
            return result;
        }

        // Try to parse as JSON
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch(e) {
                return { rawData: data };
            }
        }

        return { rawData: String(data) };
    }

    // Send captured CNL data to extension
    async function sendCnlData(type, url, data, sourceUrl) {
        try {
            await chrome.runtime.sendMessage({
                name: 'myjd-toolbar',
                action: 'cnl-captured',
                data: {
                    type: type,
                    url: url,
                    formData: data,
                    sourceUrl: sourceUrl,
                    timestamp: Date.now()
                }
            });
            console.log('[CNL Interceptor] Sent to extension:', type);
        } catch(e) {
            console.error('[CNL Interceptor] Failed to send:', e);
        }
    }

    // Override fetch API
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        const urlString = url.toString();

        if (isCnlUrl(urlString)) {
            console.log('[CNL Interceptor] Intercepted fetch:', urlString);
            const type = getEndpointType(urlString);

            if (type === 'JD_CHECK') {
                // Return mock response for JD check
                return new Response('var jdownloader = true;', {
                    status: 200,
                    headers: { 'Content-Type': 'text/javascript' }
                });
            }

            if (type === 'CROSSDOMAIN') {
                // Return crossdomain.xml
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

            // For add/addcrypted, capture the data
            if (type === 'ADD_CRYPTED' || type === 'ADD') {
                const formData = captureFormData(options.body);
                await sendCnlData(type, urlString, formData, window.location.href);

                // Return success response
                return new Response('OK', { status: 200 });
            }
        }

        // Pass through to original fetch
        return originalFetch.apply(this, arguments);
    };

    // Override XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;

    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        let requestUrl = '';
        let capturedMethod = '';
        let capturedBody = null;

        const originalOpen = xhr.open;
        xhr.open = function(method, url, async, user, password) {
            requestUrl = url;
            capturedMethod = method;
            return originalOpen.apply(this, arguments);
        };

        const originalSend = xhr.send;
        xhr.send = function(body) {
            capturedBody = body;

            if (isCnlUrl(requestUrl)) {
                console.log('[CNL Interceptor] Intercepted XHR:', requestUrl);
                const type = getEndpointType(requestUrl);

                if (type === 'JD_CHECK') {
                    // Mock response for JD check
                    Object.defineProperty(xhr, 'responseText', {
                        get: () => 'var jdownloader = true;'
                    });
                    Object.defineProperty(xhr, 'status', {
                        get: () => 200
                    });
                    Object.defineProperty(xhr, 'readyState', {
                        get: () => 4
                    });

                    // Trigger onload
                    if (xhr.onload) {
                        setTimeout(() => xhr.onload(), 0);
                    }
                    return;
                }

                if (type === 'CROSSDOMAIN') {
                    const crossdomain = `<?xml version="1.0"?>
<cross-domain-policy>
  <site-control permitted-cross-domain-policies="master-only"/>
  <allow-access-from domain="*"/>
  <allow-http-request-headers-from domain="*" headers="*"/>
</cross-domain-policy>`;

                    Object.defineProperty(xhr, 'responseText', {
                        get: () => crossdomain
                    });
                    Object.defineProperty(xhr, 'status', {
                        get: () => 200
                    });
                    Object.defineProperty(xhr, 'readyState', {
                        get: () => 4
                    });

                    if (xhr.onload) {
                        setTimeout(() => xhr.onload(), 0);
                    }
                    return;
                }

                // For add/addcrypted endpoints
                if (type === 'ADD_CRYPTED' || type === 'ADD') {
                    const formData = captureFormData(capturedBody);
                    sendCnlData(type, requestUrl, formData, window.location.href);

                    // Mock success response
                    Object.defineProperty(xhr, 'responseText', {
                        get: () => 'OK'
                    });
                    Object.defineProperty(xhr, 'status', {
                        get: () => 200
                    });
                    Object.defineProperty(xhr, 'readyState', {
                        get: () => 4
                    });

                    if (xhr.onload) {
                        setTimeout(() => xhr.onload(), 0);
                    }
                    return;
                }
            }

            return originalSend.apply(this, arguments);
        };

        return xhr;
    };

    // Copy prototype and static properties
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);

    // Listen for extension messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping-cnl-interceptor') {
            sendResponse({ status: 'active', url: window.location.href });
            return true;
        }
    });

    console.log('[CNL Interceptor] Ready');
})();
