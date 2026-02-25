'use strict';

console.log('[Offscreen] Starting MyJDownloader offscreen document...');

var api = null;
var isReady = false;

// Get absolute path to vendor/js directory
var scriptPath = chrome.runtime.getURL('vendor/js/');
console.log('[Offscreen] Script path:', scriptPath);

// Use RequireJS to load jdapi module
// baseUrl is relative to the HTML file location (offscreen.html)
// The jdapi.js defines module "jdapi" which depends on other modules
require.config({
    baseUrl: './vendor/js',
    paths: {
        'jquery': 'jquery',
        'jdapi': 'jdapi'
    },
    waitSeconds: 60
});

console.log('[Offscreen] RequireJS configured, loading jdapi...');

// jdapi.js defines several modules: coreCrypto, coreCryptoUtils, coreRequest,
// coreRequestHandler, coreCore, device, serverServer, serviceService, deviceController, jdapi
// The jdapi module is the main one we need
require(['jdapi'], function(API) {
    console.log('[Offscreen] jdapi module loaded successfully, API:', typeof API);

    if (typeof API === 'undefined') {
        console.error('[Offscreen] API is undefined after loading!');
        return;
    }

    try {
        api = new API({
            API_ROOT: "https://api.jdownloader.org",
            APP_KEY: "myjd_webextension_chrome"
        });
        console.log('[Offscreen] API created successfully');

        // Restore session: put stored session into localStorage so jdapi can find it,
        // then call api.connect() to let jdapi do a proper reconnection handshake.
        chrome.storage.local.get(['myjd_session'], function(result) {
            if (result.myjd_session) {
                try {
                    localStorage.setItem("jdapi/src/core/core.js", result.myjd_session);
                    console.log('[Offscreen] Session data placed in localStorage, connecting...');
                    api.connect({}).done(function() {
                        isReady = true;
                        console.log('[Offscreen] Connected successfully via restored session');
                    }).fail(function(err) {
                        console.warn('[Offscreen] Session restore connect failed:', err);
                        isReady = true;
                    });
                } catch(e) {
                    console.error('[Offscreen] Failed to restore session:', e);
                    isReady = true;
                }
            } else {
                isReady = true;
                console.log('[Offscreen] No session to restore');
            }
        });
    } catch(e) {
        console.error('[Offscreen] Failed to create API:', e);
        console.error('[Offscreen] Error stack:', e.stack);
    }
}, function(err) {
    console.error('[Offscreen] Failed to load jdapi module:', err);
    console.error('[Offscreen] RequireJS error:', JSON.stringify(err));

    // Log missing modules
    if (err.requireType === 'timeout') {
        console.error('[Offscreen] Module load timeout');
    }
    if (err.requireModules) {
        console.error('[Offscreen] Missing modules:', err.requireModules.join(', '));
    }
});

// Handle messages from service worker ONLY — ignore messages not targeted at offscreen
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Only handle messages explicitly targeted at the offscreen document.
    // Without this guard, we intercept toolbar/popup messages and break their flow.
    if (!request || request.target !== 'offscreen') {
        return false;
    }

    console.log('[Offscreen] Received message:', request.action);

    switch (request.action) {
        case 'offscreen-login':
            if (!api) {
                sendResponse({ error: 'API not initialized' });
                return true;
            }
            var creds = request.credentials || {};
            api.connect({ email: creds.email, pass: creds.password }).done(function(data) {
                var sessionData = JSON.stringify(api.jdAPICore.options);
                chrome.storage.local.set({ 'myjd_session': sessionData });
                localStorage.setItem("jdapi/src/core/core.js", sessionData);
                sendResponse({ success: true, data: data });
            }).fail(function(err) {
                sendResponse({ success: false, error: err.message || err });
            });
            return true;

        case 'offscreen-logout':
            if (!api) {
                sendResponse({ success: true });
                return true;
            }
            api.disconnect().always(function() {
                chrome.storage.local.remove('myjd_session');
                localStorage.removeItem("jdapi/src/core/core.js");
                api = null;
                sendResponse({ success: true });
            });
            return true;

        case 'offscreen-get-devices':
            if (!api) {
                sendResponse({ error: 'API not initialized' });
                return true;
            }
            if (!api.jdAPICore || !api.jdAPICore.options.sessiontoken) {
                sendResponse({ error: 'Not logged in' });
                return true;
            }
            api.listDevices().done(function(devices) {
                console.log('[Offscreen] Devices found:', devices);
                sendResponse({ success: true, devices: devices });
            }).fail(function(err) {
                console.error('[Offscreen] listDevices failed:', err);
                sendResponse({ success: false, error: err.message || err });
            });
            return true;

        case 'offscreen-add-link':
            if (!api) {
                sendResponse({ error: 'API not initialized' });
                return true;
            }
            var deviceId = request.deviceId;
            var query = request.query || {};
            api.setActiveDevice(deviceId);
            api.send('/linkgrabberv2/addLinks', {
                links: query.links,
                packageName: query.packageName,
                autoExtract: query.autoExtract,
                autostart: query.autostart,
                priority: query.priority,
                downloadPassword: query.downloadPassword,
                extractPassword: query.extractPassword,
                destinationFolder: query.destinationFolder
            }).done(function(result) {
                sendResponse({ success: true, result: result });
            }).fail(function(err) {
                sendResponse({ success: false, error: err.message || err });
            });
            return true;

        case 'offscreen-add-cnl':
            if (!api) {
                sendResponse({ error: 'API not initialized' });
                return true;
            }
            var cnlDeviceId = request.deviceId;
            var cnlQuery = request.query || {};
            api.setActiveDevice(cnlDeviceId);
            api.send('/linkgrabberv2/addLinks', {
                links: cnlQuery.links
            }).done(function(result) {
                sendResponse({ success: true, result: result });
            }).fail(function(err) {
                sendResponse({ success: false, error: err.message || err });
            });
            return true;

        case 'offscreen-whoami':
            if (!api || !api.jdAPICore || !api.jdAPICore.getCurrentUser) {
                sendResponse({ error: 'Not logged in' });
                return true;
            }
            try {
                var user = api.jdAPICore.getCurrentUser();
                sendResponse({ success: true, username: user.name });
            } catch(e) {
                sendResponse({ success: false, error: e.message });
            }
            return true;

        case 'offscreen-ping':
            sendResponse({ status: 'ok', ready: isReady, hasApi: !!api });
            return true;

        default:
            sendResponse({ error: 'Unknown action: ' + request.action });
            return true;
    }
});

console.log('[Offscreen] Setup complete, waiting for RequireJS...');
