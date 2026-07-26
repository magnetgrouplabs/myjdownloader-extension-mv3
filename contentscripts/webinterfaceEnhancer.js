(function() {
'use strict'

if (typeof browser !== 'undefined') { chrome = browser; }

var extensionInfo = {
    version: chrome.runtime.getManifest().version
};

var WebinterfaceEnhancer = (function () {
    var active = false;
    // The setting arrives asynchronously from the service worker, which may
    // still have to spin up. The web interface posts its {name:'ping'} exactly
    // once, right after registering its listener, so a ping that arrives before
    // the answer must not be dropped — otherwise the page never learns the
    // extension is installed and keeps showing "Browser extension required".
    var settingKnown = false;
    var pendingPingOrigin = null;

    function sendPong(origin) {
        window.parent.postMessage({
            type: "ping", name: "pong", data: extensionInfo
        }, origin);
    }

    window.addEventListener("message", function (e) {
        if (e.origin !== "https://my.jdownloader.org" && e.origin !== "http://my.jdownloader.org:8000")
            return;
        if (!e.data || e.data.name !== "ping") return;
        if (!settingKnown) {
            pendingPingOrigin = e.origin;
            return;
        }
        if (active) {
            sendPong(e.origin);
        }
    }, false);

    function isActive() {
        return active;
    }

    function setActive(newValue) {
        active = newValue;
        settingKnown = true;
        if (active && pendingPingOrigin !== null) {
            sendPong(pendingPingOrigin);
            pendingPingOrigin = null;
        }
    }


    return {isActive: isActive, setActive: setActive};
})();

chrome.runtime.sendMessage({
        name: "webinterface-enhancer",
        action: "settings"
    },
    function (response) {
        void chrome.runtime.lastError;
        if (response && response.active !== undefined) {
            WebinterfaceEnhancer.setActive(response.active);
        } else {
            // No usable answer (service worker error, or an older build without
            // the responder). Fall back to the documented default of the
            // ENHANCE_CAPTCHA_DIALOG setting so extension detection still works.
            WebinterfaceEnhancer.setActive(true);
        }
    });

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type !== undefined && msg.name !== undefined && msg.action !== undefined && msg.name === "webinterface-enhancer" && msg.action === "settings") {
        if (msg.type === "change" && msg.data.active !== undefined) {
            WebinterfaceEnhancer.setActive(msg.data.active);
        }
    } else if (msg.type !== undefined && msg.name !== undefined && msg.data !== undefined) {
        if (msg.type === "myjdrc2" && (msg.name === "response" || msg.name === "tab-closed")) {
            // reroute message from chrome to window context
            window.postMessage(msg, "*");
        }
    } else if (msg.type !== undefined && msg.name !== undefined && msg.data !== undefined) {
        if (msg.type === "myjdrc2" && msg.name === "captcha-done") {
            chrome.runtime.sendMessage({
                name: "webinterface-enhancer",
                action: "captcha-done",
                data: msg.data
            });
        }
    }
});
})();