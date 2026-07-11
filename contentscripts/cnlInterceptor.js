'use strict';

/**
 * CNL (Click'N'Load) Interceptor - ISOLATED world bridge.
 *
 * The actual fetch/XHR/form interception happens in cnlInterceptorMain.js,
 * which is injected into the page's MAIN world (see manifest.json) so it
 * can see the real network calls the page makes. This script runs in the
 * normal isolated content-script world, which is the only place with
 * access to chrome.runtime. It just relays what the MAIN-world script
 * hands it via window.postMessage on to the background service worker.
 */

(function() {
    if (window.__myjdCnlInterceptorBridgeInstalled) return;
    window.__myjdCnlInterceptorBridgeInstalled = true;

    console.log('[CNL Interceptor/Bridge] Installed');

    const BRIDGE_MARKER = '__myjd_cnl_bridge__';

    window.addEventListener('message', function(event) {
        // The real security boundary here is event.source === window: only
        // code running in this exact window (i.e. our own MAIN-world script,
        // not an iframe, not another tab, not a malicious page) can ever
        // satisfy that check, since postMessage always sets `source` to the
        // actual sending window and that cannot be spoofed cross-context.
        // We additionally check origin where available, but some engines
        // report an empty origin for same-window self-messaging, so we
        // don't hard-fail on that alone.
        if (event.source !== window) return;
        if (event.origin && event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data[BRIDGE_MARKER] !== true) return;

        chrome.runtime.sendMessage({
            name: 'myjd-toolbar',
            action: 'cnl-captured',
            data: {
                type: data.type,
                url: data.url,
                formData: data.formData,
                sourceUrl: data.sourceUrl,
                timestamp: data.timestamp
            }
        }).then(() => {
            console.log('[CNL Interceptor/Bridge] Forwarded to background:', data.type);
        }).catch(e => {
            console.error('[CNL Interceptor/Bridge] Failed to forward:', e);
        });
    });

    // Listen for extension messages (e.g. health checks)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping-cnl-interceptor') {
            sendResponse({ status: 'active', url: window.location.href });
            return true;
        }
    });

    console.log('[CNL Interceptor/Bridge] Ready');
})();
