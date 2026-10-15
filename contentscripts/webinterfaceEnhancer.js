(function() {
'use strict'

if (typeof browser !== 'undefined') { chrome = browser; }

var extensionInfo = {
    version: chrome.runtime.getManifest().version
};

var WebinterfaceEnhancer = (function () {
    // null until the service worker answers. The site pings exactly once, and
    // that can be before the (possibly sleeping) worker replies, so a ping
    // that arrives early is remembered and answered then.
    var active = null;
    var pendingPingOrigin = null;

    function pong(origin) {
        window.parent.postMessage({
            type: "ping", name: "pong", data: extensionInfo
        }, origin);
    }

    window.addEventListener("message", function (e) {
        if (e.origin !== "https://my.jdownloader.org" && e.origin !== "http://my.jdownloader.org:8000")
            return;
        var data = e.data;
        if (!data) return;
        // Legacy MV2 trigger; a manual solve request, so not gated on the setting
        if (data.type === "myjdrc2" && data.name === "captcha-new") {
            chrome.runtime.sendMessage({ name: "myjdrc2", action: "captcha-new" });
            return;
        }
        if (data.name === "ping") {
            if (active === null) {
                pendingPingOrigin = e.origin;
            } else if (active) {
                pong(e.origin);
            }
        }
    }, false);

    function isActive() {
        return active === true;
    }

    function setActive(newValue) {
        active = newValue !== false;
        if (active && pendingPingOrigin) pong(pendingPingOrigin);
        pendingPingOrigin = null;
    }


    return {isActive: isActive, setActive: setActive};
})();

// The site shows its CAPTCHA icon (#gwtCaptchasWaiting, images/captcha.png)
// while a challenge waits. For a remote JDownloader that click is the only
// trigger for challenges the site cannot hand over itself (hCaptcha), so the
// service worker opens a hoster tab for every pending one.
document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    if (!target.closest('#gwtCaptchasWaiting, img[src*="captcha.png"], img[src*="/images/captcha"]')) return;
    chrome.runtime.sendMessage({ action: 'myjd-webui-captcha-click' }, function () {
        void chrome.runtime.lastError;
    });
}, true);

chrome.runtime.sendMessage({
        name: "webinterface-enhancer",
        action: "settings"
    },
    function (response) {
        void chrome.runtime.lastError;
        // No usable answer: fall back to the setting's default (on)
        WebinterfaceEnhancer.setActive(!(response && response.active === false));
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