(function() {
'use strict'

if (typeof browser !== 'undefined') { chrome = browser; }

var extensionInfo = {
    version: chrome.runtime.getManifest().version
};

var WebinterfaceEnhancer = (function () {
    var active = false;

    window.addEventListener("message", function (e) {
        if (!active) return;
        if (e.origin !== "https://my.jdownloader.org" && e.origin !== "http://my.jdownloader.org:8000")
            return;
        if (e.data.name === "ping") {
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