'use strict';

console.log('[Offscreen] Starting MyJDownloader offscreen document...');

var api = null;
var isReady = false;

// Report the connection state to the service worker so it can update its
// internal state.isConnected and the "!" badge. The offscreen document
// connects on its own at startup; without this message the background would
// never learn about it.
function reportConnectionState(connected) {
    try {
        chrome.runtime.sendMessage({
            name: 'myjd-toolbar',
            action: 'set-connection-state',
            data: { isConnected: connected }
        }, function() {
            void chrome.runtime.lastError;
        });
    } catch (e) {}
}

// Wait until RequireJS has produced the api object. The onMessage listener
// below registers synchronously at document load, so a message (e.g. the
// service worker's warm-start session handoff) can arrive before jdapi
// finished loading.
function waitForApi(callback, attempts) {
    if (api) {
        callback(true);
    } else if (attempts > 0) {
        setTimeout(function() { waitForApi(callback, attempts - 1); }, 250);
    } else {
        callback(false);
    }
}

// Single connect guard: the startup self-restore and the service worker's
// restore-session message can both try to connect; they must share one
// api.connect() instead of racing two handshakes.
var connectInFlight = null;
function connectWithSession(sessionData, onDone, onFail) {
    if (api && api.jdAPICore && api.jdAPICore.options && api.jdAPICore.options.sessiontoken) {
        onDone(true);
        return;
    }
    if (!connectInFlight) {
        if (sessionData) {
            try {
                localStorage.setItem("jdapi/src/core/core.js", sessionData);
            } catch (e) {}
        }
        connectInFlight = api.connect({});
        connectInFlight.always(function() { connectInFlight = null; });
    }
    connectInFlight.done(function() { onDone(false); }).fail(onFail);
}

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

    // Wait for chrome.storage to be available (race condition on extension reload)
    function waitForChromeStorage(callback, attempts) {
        if (chrome && chrome.storage && chrome.storage.local) {
            callback();
        } else if (attempts > 0) {
            setTimeout(function() { waitForChromeStorage(callback, attempts - 1); }, 100);
        } else {
            console.warn('[Offscreen] chrome.storage not available, proceeding with localStorage fallback');
            callback();
        }
    }

    waitForChromeStorage(function() {
        try {
            api = new API({
                API_ROOT: "https://api.jdownloader.org",
                APP_KEY: "myjd_webextension_chrome"
            });
            console.log('[Offscreen] API created successfully');

            // Restore session from chrome.storage into localStorage so jdapi can find it,
            // then call api.connect() to do a proper reconnection handshake.
            if (chrome && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['myjd_session'], function(result) {
                    if (chrome.runtime.lastError) {
                        console.warn('[Offscreen] Storage read error:', chrome.runtime.lastError.message);
                        isReady = true;
                        return;
                    }
                    if (result.myjd_session) {
                        console.log('[Offscreen] Session data found, connecting...');
                        connectWithSession(result.myjd_session, function() {
                            isReady = true;
                            console.log('[Offscreen] Connected successfully via restored session');
                            reportConnectionState(true);
                        }, function(err) {
                            console.warn('[Offscreen] Session restore connect failed:', err);
                            isReady = true;
                            reportConnectionState(false);
                        });
                    } else {
                        isReady = true;
                        console.log('[Offscreen] No session to restore');
                    }
                });
            } else {
                // chrome.storage can be missing entirely when Chrome creates
                // the offscreen document very early at browser startup, and it
                // never appears for that document instance. jdapi reads its
                // session from localStorage, which persists for the extension
                // origin, so a previous session can still connect without it.
                isReady = true;
                if (localStorage.getItem("jdapi/src/core/core.js")) {
                    console.log('[Offscreen] No chrome.storage, restoring from localStorage session...');
                    connectWithSession(null, function() {
                        console.log('[Offscreen] Connected via localStorage session');
                        reportConnectionState(true);
                    }, function(err) {
                        console.warn('[Offscreen] localStorage session connect failed:', err);
                        reportConnectionState(false);
                    });
                } else {
                    console.log('[Offscreen] No chrome.storage and no localStorage session');
                }
            }
        } catch(e) {
            console.error('[Offscreen] Failed to create API:', e);
            console.error('[Offscreen] Error stack:', e.stack);
            isReady = true;
        }
    }, 30);
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

    // Device-scoped call that goes through jdapi's normal path (Direct Connection
    // / mydns when available, otherwise the api.jdownloader.org relay). Never
    // hardcode cloud URLs here — setActiveDevice + send picks the transport.
    // On a direct-path failure, clear localURL once and retry via the relay so
    // a flaky LAN/mydns host does not stall captcha polling.
    function sendCaptchaDeviceCall(deviceId, action, params) {
        var deferred = $.Deferred();
        if (!api) {
            deferred.reject('API not initialized');
            return deferred;
        }
        if (!api.jdAPICore || !api.jdAPICore.options.sessiontoken) {
            deferred.reject('Not logged in');
            return deferred;
        }
        api.setActiveDevice(deviceId);
        function attempt(isRetry) {
            api.send(action, params).done(function(result) {
                deferred.resolve(result);
            }).fail(function(err) {
                if (isRetry || !api.apiDeviceController || typeof api.apiDeviceController.getDeviceAPIForId !== 'function') {
                    deferred.reject(err);
                    return;
                }
                api.apiDeviceController.getDeviceAPIForId(deviceId).done(function(deviceApi) {
                    if (deviceApi && deviceApi.localURL) {
                        console.warn('[Offscreen] Direct captcha call failed for', action, '- retrying via cloud relay');
                        deviceApi.setLocalURL(null);
                        api.setActiveDevice(deviceId);
                        attempt(true);
                    } else {
                        deferred.reject(err);
                    }
                }).fail(function() {
                    deferred.reject(err);
                });
            });
        }
        attempt(false);
        return deferred;
    }

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
                reportConnectionState(true);
                sendResponse({ success: true, data: data });
            }).fail(function(err) {
                reportConnectionState(false);
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
                reportConnectionState(false);
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

        case 'offscreen-restore-session':
            // Warm-start handoff: the service worker (which always has
            // chrome.storage) reads the stored session itself and delivers it
            // here, so restore works even in a storage-crippled document. The
            // response tells the worker directly whether to clear the badge.
            waitForApi(function(hasApi) {
                if (!hasApi) {
                    sendResponse({ success: false, error: 'API not initialized' });
                    return;
                }
                connectWithSession(request.sessionData, function(alreadyConnected) {
                    reportConnectionState(true);
                    sendResponse({ success: true, connected: true, alreadyConnected: alreadyConnected });
                }, function(err) {
                    reportConnectionState(false);
                    sendResponse({ success: false, error: (err && err.message) || String(err) });
                });
            }, 120);
            return true;


        case 'offscreen-captcha-list':
            if (!request.deviceId) {
                sendResponse({ success: false, error: 'deviceId required' });
                return true;
            }
            sendCaptchaDeviceCall(request.deviceId, '/captcha/list', []).done(function(result) {
                // jdapi may return the list directly or wrapped in {data: ...}
                var jobs = result;
                if (result && result.data !== undefined) jobs = result.data;
                if (!Array.isArray(jobs)) jobs = [];
                sendResponse({ success: true, jobs: jobs });
            }).fail(function(err) {
                sendResponse({ success: false, error: (err && err.message) || String(err) });
            });
            return true;

        case 'offscreen-captcha-get':
            if (!request.deviceId || request.captchaId == null) {
                sendResponse({ success: false, error: 'deviceId and captchaId required' });
                return true;
            }
            // Match Rc2Service: getCaptchaJob then get(..., "rawtoken") for siteKey/siteUrl.
            sendCaptchaDeviceCall(request.deviceId, '/captcha/getCaptchaJob', [request.captchaId]).done(function(jobResult) {
                var job = jobResult && jobResult.data !== undefined ? jobResult.data : jobResult;
                if (!job || job.id == null) {
                    sendResponse({ success: false, error: 'Captcha job not available' });
                    return;
                }
                sendCaptchaDeviceCall(request.deviceId, '/captcha/get', [JSON.stringify(job.id), 'rawtoken']).done(function(challengeResult) {
                    var challenge = challengeResult && challengeResult.data !== undefined ? challengeResult.data : challengeResult;
                    sendResponse({ success: true, job: job, challenge: challenge });
                }).fail(function(err) {
                    sendResponse({ success: false, error: (err && err.message) || String(err) });
                });
            }).fail(function(err) {
                sendResponse({ success: false, error: (err && err.message) || String(err) });
            });
            return true;

        case 'offscreen-captcha-solve':
            if (!request.deviceId || request.captchaId == null || request.token == null) {
                sendResponse({ success: false, error: 'deviceId, captchaId and token required' });
                return true;
            }
            // Match /captcha/get's rawtoken challenge: JD expects the 3-param
            // solve(id, result, resultFormat) when the challenge was fetched as
            // rawtoken (hCaptcha / reCAPTCHA). Id is JSON-stringified like get.
            var solveId = typeof request.captchaId === 'number'
                ? JSON.stringify(request.captchaId)
                : (typeof request.captchaId === 'string' && /^\d+$/.test(request.captchaId)
                    ? request.captchaId
                    : JSON.stringify(request.captchaId));
            var resultFormat = request.resultFormat || 'rawtoken';
            var solveParams = [solveId, request.token, resultFormat];
            console.log('[Offscreen] captcha/solve', request.deviceId, 'id=', solveId, 'format=', resultFormat, 'tokenLen=', String(request.token).length);
            sendCaptchaDeviceCall(request.deviceId, '/captcha/solve', solveParams).done(function(result) {
                // jdapi wraps the boolean in {data: ...} or returns it bare.
                var accepted = result && result.data !== undefined ? result.data : result;
                console.log('[Offscreen] captcha/solve response', JSON.stringify(result));
                if (accepted === false) {
                    sendResponse({ success: false, error: 'JD rejected captcha solution', result: result });
                } else {
                    sendResponse({ success: true, result: result, accepted: accepted });
                }
            }).fail(function(err) {
                var error;
                try { error = (err && typeof err === 'object') ? JSON.parse(JSON.stringify(err)) : err; }
                catch (e) { error = (err && err.message) || String(err); }
                console.warn('[Offscreen] captcha/solve failed', error);
                sendResponse({ success: false, error: error });
            });
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
