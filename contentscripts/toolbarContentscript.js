if (typeof browser !== 'undefined') { chrome = browser; }

if (window.myJDAddLinksToolbarInjected !== true) {
    window.myJDAddLinksToolbarInjected = true;
    var toolbarUI;
    var autograbberFrame;

    chrome.runtime.sendMessage({ name: "myjd-toolbar", action: "tab-contentscript-injected" });

    function createIFrame(tabId) {
        var iframe = document.getElementById("myjd_toolbar_" + tabId);
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.setAttribute("style", "overflow:hidden;height: 100%; margin: 0px; padding: 0px; position: fixed; right: 5px; top: 5px; width: 410px; z-index: 2147483647; border:0px;");
            iframe.setAttribute("id", "myjd_toolbar_" + tabId);
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("src", chrome.runtime.getURL("toolbar.html") + "?id=" + tabId);
        }
        return iframe;
    }

    function removeIFrame() {
        try {
            document.body.removeChild(toolbarUI.iframe);
            toolbarUI.iframe = undefined;
            toolbarUI.visible = false;
        } catch (e) {
            toolbarUI.iframe = undefined;
            toolbarUI.visible = false;
        }
    }

    function appendIFrame(tabId) {
        var iframe = toolbarUI.iframe;
        if (iframe) {
            if (!toolbarUI.visible) {
                document.body.appendChild(toolbarUI.iframe);
                toolbarUI.visible = true;
            }
        } else {
            toolbarUI.iframe = createIFrame(tabId);
            document.body.appendChild(toolbarUI.iframe);
            toolbarUI.visible = true;
        }
    }

    function initToolbar(id) {
        var iframe = createIFrame(id);
        return toolbarUI = {
            iframe: iframe, visible: false
        };
    }

    function showAutoGrabberIndicator() {
        var iframe = document.getElementById("myjd_autograbber_indicator");
        if (iframe == null) {
            iframe = document.createElement("iframe");
            iframe.setAttribute("style", "overflow:hidden;height: 100%; margin: 0px; padding: 0px; position: fixed; right: 5px; top: 5px; width: 410px; z-index: 2147483647; border:0px;");
            iframe.setAttribute("id", "myjd_autograbber_indicator");
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("src", chrome.runtime.getURL("autograbber-indicator.html"));
            document.body.insertBefore(iframe, document.body.children.item(0));
            autograbberFrame = iframe;
        }
    }

    function hideAutoGrabberIndicator() {
        var iframe = document.getElementById("myjd_autograbber_indicator");
        if (iframe != null) {
            document.body.removeChild(iframe);
        }
    }

    function showToolbar(id) {
        if (!toolbarUI.visible) {
            appendIFrame(id);
        }
    }

    function hideToolbar() {
        if (toolbarUI.iframe) {
            removeIFrame();
        }
        delete window.myJDAddLinksToolbarInjected;
    }

    if (window.parent == window) {
        chrome.runtime.onMessage.addListener(function (msg) {
            console.log(msg);
            if (msg.action == null) return;
            if (msg.action === "open-in-page-toolbar") {
                if (!toolbarUI) {
                    toolbarUI = initToolbar(msg.tabId);
                }
                showToolbar(msg.tabId);
            } else if (msg.action === "close-in-page-toolbar") {
                hideToolbar();
            } else if (msg.action === "remove-dialog") {
                hideToolbar();
            } else if (msg.action === "autograbber-started-in-tab") {
                showAutoGrabberIndicator();
            } else if (msg.action === "autograbber-stopped-in-tab") {
                hideAutoGrabberIndicator();
            } else if (msg.action === "autograbber-update-in-tab") {

            }
        }.bind(this));

        chrome.runtime.sendMessage({ name: "autograbber", action: "is-active-on-tab" },
            function (response) {
                if (chrome.runtime.lastError != null &&
                    chrome.runtime.lastError.message.indexOf("Promised response from onMessage listener went out of scope") === -1) {
                    console.log(JSON.stringify(chrome.runtime.lastError));
                }
                if (response != null && response.data != null && response.data.active === true) {
                    showAutoGrabberIndicator();
                }
            });
    }

}
