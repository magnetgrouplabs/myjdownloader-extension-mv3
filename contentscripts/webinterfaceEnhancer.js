(function() {
'use strict'

if (typeof browser !== 'undefined') { chrome = browser; }

var extensionInfo = {
    version: chrome.runtime.getManifest().version
};

var WebinterfaceEnhancer = (function () {
    var active = false;

    window.addEventListener("message", function (e) {
        if (e.origin !== "https://my.jdownloader.org" && e.origin !== "http://my.jdownloader.org:8000")
            return;

        // Legacy MV2: page posts {type:"myjdrc2", name:"captcha-new", data:...}.
        // Forward to the service worker even when the enhance-dialog flag is off
        // — this is the manual solve trigger, not the dialog chrome.
        var data = e.data;
        if (data && data.type === "myjdrc2" && data.name === "captcha-new") {
            chrome.runtime.sendMessage({
                name: "myjdrc2",
                action: "captcha-new",
                data: data.data
            });
            return;
        }

        if (!active) return;
        if (data && data.name === "ping") {
            window.parent.postMessage({
                type: "ping", name: "pong", data: extensionInfo
            }, e.origin);
        }
    }, false);

    function isActive() {
        return active;
    }

    function setActive(newValue) {
        active = newValue;
    }

    return {isActive: isActive, setActive: setActive};
})();

// MyJD web UI shows images/captcha.png in #gwtCaptchasWaiting when a captcha
// is pending. Clicking it does nothing useful for a remote JD without this
// bridge (Rc2Service is never instantiated). Forward the click to the SW,
// which opens the same hoster#rc2jdt tab as remote auto-open — even when the
// auto-open setting is off.
function isCaptchaIconClickTarget(target) {
    if (!target || !target.closest) return false;
    if (target.closest('#gwtCaptchasWaiting')) return true;
    if (target.closest('img[src*="captcha.png"]')) return true;
    if (target.closest('img[src*="/images/captcha"]')) return true;
    return false;
}

document.addEventListener('click', function (ev) {
    if (!isCaptchaIconClickTarget(ev.target)) return;
    chrome.runtime.sendMessage({ action: 'myjd-webui-captcha-click' }, function () {
        void chrome.runtime.lastError;
    });
}, true);

chrome.runtime.sendMessage({
        name: "webinterface-enhancer",
        action: "settings"
    },
    function (response) {
        if (response && response.active !== undefined) {
            WebinterfaceEnhancer.setActive(response.active);
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
