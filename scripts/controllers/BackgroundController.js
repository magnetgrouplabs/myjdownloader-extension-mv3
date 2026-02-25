'use strict';

/**
 * @ngdoc function
 * @name myjdWebextensionApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the myjdWebextensionApp
 */

angular.module('myjdWebextensionApp')
  .controller('BackgroundCtrl', ['$scope', '$timeout', '$q', 'Rc2Service', 'BrowserService', 'PopupIconService', 'CnlService', 'StorageService', 'ClipboardHistoryService', 'StringUtilsService', 'myjdClientFactory', 'myjdDeviceClientFactory', 'ExtensionMessagingService', 'PopupCandidatesService', 'ExtensionI18nService',
    function ($scope, $timeout, $q, Rc2Service, BrowserService, PopupIconService, cnlService, StorageService, ClipboardHistoryService, StringUtilsService, myjdClientFactory, myjdDeviceClientFactory, ExtensionMessagingService, PopupCandidatesService, ExtensionI18nService) {
      let urlRegexp = new RegExp("([a-zA-Z0-9]+://)?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+@)?([a-zA-Z0-9.-]+\\.[A-Za-z]{2,4})(:[0-9]+)?(/.*)?");
      let requestIDCounter = 0;
      let requestQueue = {
        contains: function (request, tabId) {
          if (this[tabId] === undefined || this[tabId].length === 0) {
            return false;
          } else {
            let dupe = false;
            $.each(this[tabId], function (index, value) {
              if (request.type !== undefined && request.type === value.type) {
                if (request.type === ClipboardHistoryService.ITEM_TYPE.LINK) {
                  if (request.content !== undefined && request.content === value.content) {
                    dupe = true;
                    return false;
                  }
                }
              }
            });
            return dupe;
          }
        }
      };

      $scope.state = {
        isConnected: false,
        clipboardObserver: false
      };

      $scope.state.isConnected = false;
      let settings = {};
      let lastKnownConnectionState = myjdClientFactory.get().CONNECTION_STATES.DISCONNECTED;

      function updateBadge(state) {
        let popupAttr = { text: "" };
        if (!state.isConnected) {
          popupAttr.text = "!";
          popupAttr.color = "#f3d435";
        }
        if (state.clipboardObserver === true) {
          popupAttr.text = "Clip";
          PopupIconService.updateBadge({ text: "Clip", color: "#368a8f" });
        }
        PopupIconService.updateBadge(popupAttr);
      }

      let Params = function (url) {
        this.params = url.split("?")[1].split("&");
      };

      Params.prototype.get = function (name) {
        let ret;
        this.params.forEach(function (param) {
          if (param.indexOf(name + "=") !== -1) {
            let split = param.split("=");
            ret = split[1];
            return false;
          }
        });
      };

      function initSettings() {
        return $q(function (resolve, reject) {
          try {
            StorageService.getCollection([StorageService.SETTINGS_CLIPBOARD_OBSERVER, StorageService.SETTINGS_CONTEXT_MENU_SIMPLE, StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG], function (result) {
              if (result[StorageService.SETTINGS_CLIPBOARD_OBSERVER] !== undefined) {
                settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER] = result[StorageService.SETTINGS_CLIPBOARD_OBSERVER];
              } else {
                settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER] = false;
              }
              $scope.state.clipboardObserver = settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER];
              if (result[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE] !== undefined) {
                settings[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE] = result[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE];
              } else {
                settings[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE] = true;
              }
              if (result[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG] !== undefined) {
                settings[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG] = result[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG];
              } else {
                settings[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG] = true;
              }
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        });
      }

      let replaceWithCnlPopup = function (requestDetails) {
        let isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
        let options = {
          "width": 420,
          "height": 384
        };
        if (!isOpera) {
          // workaround for opera bug that updates wrong tab if window type is popup
          options.type = "popup";
        }
        chrome.windows.create(options, function (window) {
          setTimeout(function () {
            // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1408446
            let updateInfo = {
              width: window.width,
              height: window.height + 1
            };
            chrome.windows.update(window.id, updateInfo);
          }, 800);

          chrome.tabs.query({ windowId: window.id }, function (tabs) {
            if (tabs == null || tabs.length === 0 || tabs[0] == null) {
              chrome.tabs.create({ windowId: window.id }, function (tab) {
                chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("toolbar.html?id=" + tab.id + "&popup=true") }, function () {
                  requestDetails.tabId = tab.id;
                  addCNLRequestToQeue(tab, requestDetails);
                  toggleToolbar(tab.id);
                });
              });
            } else {
              let tab = tabs[0];
              chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("toolbar.html?id=" + tab.id + "&popup=true") }, function () {
                requestDetails.tabId = tab.id;
                addCNLRequestToQeue(tab, requestDetails);
                toggleToolbar(tab.id);
              });
            }
          });

        });
      };

      function interceptRequest(requestDetails) {
        if ($scope.state.isConnected) {
          if (cnlService.isJDCheckUrl(requestDetails.url)) {
            // adblocker workaround - MV3: Use chrome.scripting.executeScript
            chrome.scripting.executeScript({
              target: { tabId: requestDetails.tabId },
              func: function() {
                let script = document.createElement("script");
                script.text = "window.jdownloader=true";
                (document.body || document.head || document.documentElement).appendChild(script);
              }
            }).catch(function(err) {
              console.warn('BackgroundController: Failed to inject JD check script:', err);
            });
            // Redirect to a positive response
            return {
              redirectUrl: cnlService.JD_CHECK_TRUE_RESPONSE_DATA_URI
            };
          } else if (requestDetails.url.indexOf("127.0.0.1:9666/crossdomain.xml") !== -1 || requestDetails.url.indexOf("localhost:9666/crossdomain.xml") !== -1) {
            return {
              cancel: false
            };
          } else if (requestDetails.url.indexOf("127.0.0.1:9666/flash/addcrypted2?fromExtension") !== -1 || requestDetails.url.indexOf("localhost:9666/flash/addcrypted2?fromExtension") !== -1) {
            return {
              cancel: false
            };
          } else if (requestDetails.url.indexOf("?fromExtension") !== -1) {
            return {
              cancel: false
            };
          } else if (cnlService.isFlashAddUrl(requestDetails.url) || cnlService.isFlashAddCryptedUrl(requestDetails.url)) {
            if (requestDetails.type === "main_frame") {
              chrome.tabs.get(requestDetails.tabId, function (tab) {
                PopupCandidatesService.checkIfPopup(tab, Date.now())
                  .then(function (isPopup) {
                    if (isPopup) {
                      chrome.tabs.remove(tab.id, BrowserService.chromeErrorCallback);
                      replaceWithCnlPopup(requestDetails);
                    } else {
                      handleCnlNewTab(tab, requestDetails);
                    }
                  });
              });
              return flashAddCrypted(requestDetails);
            } else if (requestDetails.type === "sub_frame") {
              if (requestDetails.tabId) {
                chrome.tabs.get(requestDetails.tabId, function (tab) {
                  if (tab) {
                    chrome.windows.get(tab.windowId, { populate: true }, function (window) {
                      if (window.type === "popup") {
                        // some sites request from a popup
                        replaceWithCnlPopup(requestDetails);
                      } else {
                        // behaviour-based check for popup as we can not rely on window.type === "popup"
                        PopupCandidatesService.checkIfPopup(tab, Date.now())
                          .then(function (isPopup) {
                            if (isPopup) {
                              replaceWithCnlPopup(requestDetails);
                            } else {
                              flashAddCrypted(requestDetails);
                            }
                          });
                      }
                    });
                  } else {
                    // tab may already be auto-closed
                    replaceWithCnlPopup(requestDetails);
                  }
                });
                return {
                  cancel: true
                };
              }
            } else {
              return flashAddCrypted(requestDetails);
            }
          }
        }
      }

      function handleCnlNewTab(tab, requestDetails) {
        try {
          chrome.tabs.remove(tab.id, BrowserService.chromeErrorCallback);
        } catch (e) {
          // best effort
        }
        if (tab && tab.openerTabId) {
          chrome.tabs.get(tab.openerTabId, function (tab) {
            if (tab) {
              addCNLRequestToQeue(tab, requestDetails);
              toggleToolbar(tab.id);
            }
          });
        } else {
          // openerTabId is optional (e.g. Firefox)
          try {
            chrome.tabs.remove(requestDetails.tabId, BrowserService.chromeErrorCallback);
          } catch (e) {
            // best effort
          }
          chrome.tabs.query({}, function (tabs) {
            if (tabs !== undefined && tabs.length > 0) {
              $.each(tabs, function (index, tab) {
                if (tab.active && tab.highlighted) {
                  requestDetails.tabId = tab.id;
                  addCNLRequestToQeue(tab, requestDetails);
                  toggleToolbar(tab.id);
                  return false; // brake out of $.each
                }
              });
            }
          });
        }
      }

      chrome.tabs.onRemoved.addListener(function (tab) {
        delete requestQueue[tab];
      });

      function parseRawPostBody(body) {
        // .replace(/\+/g, ' ') because of decodeURIComponent does not decode + -> space
        let result = {};
        let vars = body.split("&");
        for (let i = 0; i < vars.length; i++) {
          let pair = vars[i].split("=");
          if (typeof result[pair[0]] === "undefined") {
            result[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
          } else if (typeof result[pair[0]] === "string") {
            let arr = [result[pair[0]], decodeURIComponent(pair[1].replace(/\+/g, ' '))];
            result[pair[0]] = arr;
          } else {
            result[pair[0]].push(decodeURIComponent(pair[1].replace(/\+/g, ' ')));
          }
        }
        return result;
      }

      function addCNLRequestToQeue(tab, details, openerTab) {
        requestIDCounter++;
        let time = Date.now();
        let detailsTab = openerTab ? openerTab : tab;
        if (details && details.requestBody && details.requestBody.raw && details.requestBody.raw[0] && details.requestBody.raw[0].bytes) {
          try {
            // remove after request.requestBody.formData is available in firefox release channel
            let rawPostBody = readArrayBuffer(details.requestBody.raw);
            details.requestBody.formData = parseRawPostBody(rawPostBody);
          } catch (e) {
            console.log(e);
          }
        }

        details.source = ($.isArray(details.requestBody.formData.source)) ? details.requestBody.formData.source[0] : details.requestBody.formData.source;
        details.urls = details.requestBody.formData.urls;
        details.passwords = details.requestBody.formData.passwords;
        details.package = ($.isArray(details.requestBody.formData.package)) ? details.requestBody.formData.package[0] : details.requestBody.formData.package;

        let parentUrl;
        if (detailsTab.url && detailsTab.url.indexOf("chrome://newtab") === -1) {
          parentUrl = detailsTab.url;
          if (!parentUrl && details.source) {
            parentUrl = details.source;
          }
        }

        let faviconUrl = detailsTab.favIconUrl;
        if (!faviconUrl && details.source && urlRegexp.test(details.source)) {
          faviconUrl = ((details.source.startsWith("http://") || details.source.startsWith("https://")) ? details.source : "https://" + details.source) + "/favicon.ico";
        }

        let title = detailsTab.title;
        if (!title && details.package) {
          title = details.package;
        }

        let newRequest = {
          id: "" + requestIDCounter + time + Math.random() * 10000,
          type: ClipboardHistoryService.ITEM_TYPE.CNL,
          time: time,
          parent: {
            url: parentUrl,
            title: title,
            favIconUrl: faviconUrl
          },
          content: details
        };
        if (requestQueue[detailsTab.id]) {
          requestQueue[detailsTab.id].push(newRequest);
        } else {
          requestQueue[detailsTab.id] = [newRequest];
        }
      }

      function readArrayBuffer(buffers) {
        let binary = '';
        for (let j = 0; j < buffers.length; j++) {
          let bytes = new Uint8Array(buffers[j].bytes);
          let len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
        }
        return window.atob(window.btoa(binary));
      }

      function flashAddCrypted(details) {
        if (details.tabId !== -1) {
          chrome.tabs.get(details.tabId, function (tab) {
            addCNLRequestToQeue(tab, details);
            toggleToolbar(tab.id);
          });
        }

        return {
          cancel: true
        };
      }

      function toggleToolbar(sender) {
        if (!isNaN(parseFloat(sender))) {
          // FROM CONTENT SCRIPT, sender is a number
          let tabid = parseFloat(sender);
          chrome.tabs.sendMessage(tabid, { action: "open-in-page-toolbar", tabId: tabid });
          chrome.tabs.sendMessage(tabid, { action: "link-info-update", tabId: tabid });
        } else if (sender === "close-in-page-toolbar") {
          // FROM BACKGROUND SCRIPT
          chrome.tabs.get({ active: true, lastFocusedWindow: true }, function (tabs) {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "close-in-page-toolbar", tabId: sender });
            }
          });
        } else if (sender === "open-in-page-toolbar") {
          // FROM BACKGROUND SCRIPT
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "open-in-page-toolbar", tabId: tabs[0].id });
              chrome.tabs.sendMessage(tabs[0].id, { action: "link-info-update", tabId: tabs[0].id });
            }
          });
        }
      }

      ExtensionMessagingService.addListener("myjd-toolbar", "session-info", function (request, sender, sendResponse) {
        if (myjdClientFactory.get().api !== undefined && myjdClientFactory.get().api.jdAPICore !== undefined) {
          let thisSession = myjdClientFactory.get().api.jdAPICore.options;
          sendResponse({ data: { isLoggedIn: thisSession.sessiontoken !== undefined && thisSession.sessiontoken.length > 0 } });
        } else {
          sendResponse({ data: { isLoggedIn: false } });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "logout", function (request, sender, sendResponse) {
        StorageService.clear();
        myjdClientFactory.get().disconnect().then(function () {
          sendResponse({ data: true });
          ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", { isLoggedIn: false });
          initDisconnected();
        }, function (error) {
          sendResponse({ data: false, error: error });
          ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", { isLoggedIn: false });
          initDisconnected();
        });
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "devices-pull", function (request, sender, sendResponse) {
        myjdClientFactory.get().getDeviceList().then(function (result) {
          sendResponse({ data: { devices: result.result } });
          ExtensionMessagingService.sendMessage("myjd-toolbar", "devices-change", { devices: result.result });
        }, function (error) {
          try {
            sendResponse({ error: error });
            ExtensionMessagingService.sendMessage("myjd-toolbar", "devices-change", { error: error });
            ExtensionMessagingService.sendMessage("myjd-toolbar", "api-error", { error: error });
          } catch (e) {
            //console.error(e);
          }
        });
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "send-feedback", function (request, sender, sendResponse) {
        if (request.data && request.data.message) {
          myjdClientFactory.get().sendFeedback(request.data.message).done(function () {
            sendResponse({});
          }).fail(function (e) {
            sendResponse({ error: e });
          });
        } else {
          sendResponse({ error: "Invalid request" });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "add-link", function (request, sender, sendResponse) {
        if (request.data && request.data.query && request.data.device) {
          remoteAddLink(request.data.device, request.data.query).then(function () {
            sendResponse({});
          }).catch(function (error) {
            sendResponse({ error: error });
          });
        } else {
          sendResponse({ error: "Invalid request" });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "tab-contentscript-injected", function (request, sender, sendResponse) {
        if (sender !== undefined && sender.tab.id) {
          delete requestQueue[sender.tab.id];
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "add-cnl", function (request, sender, sendResponse) {
        if (request.data && request.data.query && request.data.device) {
          remoteAddCnl(request.data.device, request.data.query);
          sendResponse({});
        } else {
          sendResponse({ error: "Invalid request" });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "link-info", function (request, sender, sendResponse) {
        let localRequestQueue = requestQueue[request.data];
        if (localRequestQueue) {
          sendResponse({ data: localRequestQueue });
        } else {
          sendResponse({ error: "not_found" });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "remove-all-requests", function (request, sender, sendResponse) {
        requestQueue[request.data.tabId] = [];
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "whoami", function (request, sender, sendResponse) {
        sendResponse({ username: myjdClientFactory.get().api.jdAPICore.options.email });
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "remove-request", function (request, sender, sendResponse) {
        let newQueue = [];
        let requestId = request.data.requestId;
        $.each(requestQueue[request.data.tabId], function (index, localRequest) {
          if (requestId !== localRequest.id) {
            newQueue.push(localRequest);
          }
        });
        requestQueue[request.data.tabId] = newQueue;
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "new-copy-event", function (request, sender, sendResponse) {
        if (sender.tab) {
          if (settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER] && settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER] === true) {
            chrome.tabs.sendMessage(sender.tab.id, { action: "get-selection", tabId: sender.tab.id });
          }
        }
      });

      ExtensionMessagingService.addListener("webinterface-enhancer", "settings", function (request, sender, sendResponse) {
        if (sender.tab) {
          sendResponse({ active: settings[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG] });
        }
      });

      ExtensionMessagingService.addListener("myjd-selection", "new-selection", function (request, sender, sendResponse) {
        if (sender.tab) {
          addTextToRequestQueue(request.data.text, request.data.html, sender.tab);
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "login", function (request, sender, sendResponse) {
        if (request.data && request.data.credentials) {
          myjdClientFactory.get().connect(request.data.credentials).then(function () {
            sendResponse({ data: true });
            ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", {
              isLoggedIn: true
            });
            injectContentScripts();
            initSettings().then(initConnected);
          }
          ).catch(function (error) {
            sendResponse({ data: false, error: error });
            ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", {
              isLoggedIn: false
            });
            initDisconnected();
          })
            ;
        } else {
          sendResponse({ error: "credentials missing" });
          ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", {
            isLoggedIn: false
          }
          );
          initDisconnected();
        }
      });

      ExtensionMessagingService.addListener("close-me", function (request, sender, sendResponse) {
        try {
          if (request.data && request.data.tabId) {
            let tabId = Number.parseInt(request.data.tabId);
            if (request.data.tabId === "self") {
              tabId = sender.tab.id;
            }
            chrome.tabs.get(tabId, function (tab) {
              chrome.tabs.remove(tabId, BrowserService.chromeErrorCallback);
              chrome.windows.get(tab.windowId, { populate: true }, function (window) {
                let isNewTab = false;
                if (window.tabs.length === 1) {
                  isNewTab = window.tabs[0].url === "about:newtab";
                }
                if (window.tabs.length === 0 || isNewTab) {
                  chrome.windows.remove(window.id, BrowserService.chromeErrorCallback);
                }
              });
            });
          }
        } catch (e) {
        }
      });

      /*ExtensionMessagingService.addListener("autograbber", "is-active", function (request, sender, sendResponse) {
          sendResponse({data: {active: DownloadsAutograbberService.hasActiveTab()}})
      });

      ExtensionMessagingService.addListener("autograbber", "is-active-on-tab", function (request, sender, sendResponse) {
          sendResponse({
              data: {
                  active: DownloadsAutograbberService.isTabActive(sender.tab.id),
                  tabId: sender.tabId
              }
          })
      });


      ExtensionMessagingService.addListener("autograbber", "stop-single-tab", function (request, sender, sendResponse) {
          let tabId = request.data.id ? request.data.id : request.tab.id;
          DownloadsAutograbberService.toggleTab(tabId);
          try {
              chrome.tabs.sendMessage(Number.parseInt(tabId), {
                  action: "autograbber-stopped-in-tab",
                  tabId: tabId
              });
          } catch (e) {
              console.error(e);
          }
      });


      ExtensionMessagingService.addListener("autograbber", "get-active-tabs", function (request, sender, sendResponse) {
          let grabberTabs = DownloadsAutograbberService.getActiveTabsData();
          let promises = [];
          let keys = Object.keys(grabberTabs);
          for (let idx = 0; idx < keys.length; idx++) {
              promises.push(new Promise(function (resolve, reject) {
                  let grabberData = grabberTabs[keys[idx]].links;
                  try {
                      chrome.tabs.get(Number.parseInt(keys[idx]), function (tab) {
                          if (tab) {
                              resolve({tab: tab, data: grabberData});
                          } else {
                              DownloadsAutograbberService.toggleTab(keys[idx]);
                              resolve();
                          }
                      })
                  } catch (e) {
                      resolve();
                  }
              }));
          }
          let tabsPromise = Promise.all(promises);
          tabsPromise.then(function (results) {
              sendResponse({
                  data: {
                      active: results.filter(function (result) {
                          if (result != null) return result
                      })
                  }
              });
          }).catch(function (error) {
              sendResponse({data: {active: []}})
          });
      });*/

      ExtensionMessagingService.addListener("myjd-toolbar", "device-poll", function (request, sender, sendResponse) {
        if (request.data.device !== undefined) {
          myjdDeviceClientFactory.get(request.data.device).oneTimePoll();
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "send-api-request", function (request, sender, sendResponse) {
        if (request.data.device !== undefined && request.data.action !== undefined) {
          myjdDeviceClientFactory.get(request.data.device).sendRequest(request.data.action, request.data.params).done(function (result) {
            sendResponse({ data: result });
          }).fail(function (error) {
            sendResponse({ error: error });
          });
        }
      });

      ExtensionMessagingService.addListener("myjd-toolbar", "close-in-page-toolbar", function (request, sender, sendResponse) {
        let tabid;
        if (request && request.data && request.data.tabId) {
          try {
            tabid = parseFloat(request.data.tabId);
          } catch (e) {
            console.error(e);
          }
        }
        if (tabid) {
          chrome.tabs.sendMessage(tabid, {
            action: "close-in-page-toolbar",
            tabId: request.data.tabId
          });
          delete requestQueue[tabid];
        } else {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
            if (tabs && tabs.length > 0 && tabs[0] !== undefined && tabs[0].id !== undefined) {
              delete requestQueue[tabs[0].id];
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "close-in-page-toolbar",
                tabId: request.data.tabId
              });
            }
          });
        }
      });

      /*ExtensionMessagingService.addListener("autograbber", "stop", function (request, sender, sendReponse) {
          DownloadsAutograbberService.clearAllAutograbbers();
      });*/

      ExtensionMessagingService.addListener("myjd-toolbar", "CONNECTION_STATE_CHANGE", function (request, sender, sendResponse) {
        if (request.data && request.data === myjdClientFactory.get().CONNECTION_STATES.CONNECTED && lastKnownConnectionState !== request.data) {
          if (lastKnownConnectionState !== myjdClientFactory.get().CONNECTION_STATES.CONNECTED) {
            lastKnownConnectionState = myjdClientFactory.get().CONNECTION_STATES.CONNECTED;
            ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", { isLoggedIn: true });
            chrome.tabs.query({}, function (tabs) {
              for (let i = 0; i < tabs.length; ++i) {
                chrome.tabs.sendMessage(tabs[i].id, {
                  name: "myjd-toolbar",
                  action: "CONNECTION_STATE_CHANGE",
                  data: "CONNECTED"
                });
              }
            });
          }
        } else if (request.data && request.data === myjdClientFactory.get().CONNECTION_STATES.DISCONNECTED && lastKnownConnectionState !== request.data) {
          lastKnownConnectionState = myjdClientFactory.get().CONNECTION_STATES.DISCONNECTED;
          ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", { isLoggedIn: false });
          initDisconnected();
          chrome.tabs.query({}, function (tabs) {
            for (let i = 0; i < tabs.length; ++i) {
              chrome.tabs.sendMessage(tabs[i].id, {
                name: "myjd-toolbar",
                action: "CONNECTION_STATE_CHANGE",
                data: "DISCONNECTED"
              });
            }
          });
        }
      });

      function addPageToRequestQueue(tab) {
        let time = Date.now();
        let id = "" + tab.id + time + Math.random() * 10000;
        if (!requestQueue[tab.id]) {
          requestQueue[tab.id] = [];
        }

        let newLink = {
          id: id,
          time: time,
          parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
          content: tab.url,
          type: ClipboardHistoryService.ITEM_TYPE.LINK
        };

        if (!requestQueue.contains(newLink, tab.id)) {
          requestQueue[tab.id].push(newLink);
          chrome.tabs.sendMessage(tab.id, { action: "open-in-page-toolbar", tabId: tab.id });
          chrome.tabs.sendMessage(tab.id, { action: "link-info-update", tabId: tab.id });
        }
      }

      let tabUpdateCallbacks = {};
      chrome.tabs.onUpdated.addListener(function (tabId, update) {
        let listener = tabUpdateCallbacks[tabId];
        if (listener && update.status === "complete") {
          listener();
          delete tabUpdateCallbacks[tabId];
        }
      });

      function addLinkToRequestQueue(link, tab) {
        let time = Date.now();
        let id = "" + tab.id + time + Math.random() * 10000;
        if (!requestQueue[tab.id]) {
          requestQueue[tab.id] = [];
        }
        let newLink = {
          id: id,
          time: time,
          parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
          content: link,
          type: ClipboardHistoryService.ITEM_TYPE.LINK
        };

        if (!requestQueue.contains(newLink, tab.id)) {
          requestQueue[tab.id].push(newLink);
          chrome.tabs.sendMessage(tab.id, { action: "open-in-page-toolbar", tabId: tab.id });
          chrome.tabs.sendMessage(tab.id, { action: "link-info-update", tabId: tab.id });
        }
      }

      function addTextToRequestQueue(previewText, content, tab) {
        // MV3: Use chrome.scripting.executeScript
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["contentscripts/toolbarContentscript.js"]
        }).then(function() {
          chrome.tabs.sendMessage(tab.id, { action: "open-in-page-toolbar", tabId: tab.id });
          setTimeout(function() {
            let time = Date.now();
            let id = "" + tab.id + time + Math.random() * 10000;
            if (!requestQueue[tab.id]) {
              requestQueue[tab.id] = [];
            }

            requestQueue[tab.id].push({
              id: id,
              time: time,
              parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
              content: content,
              previewText: previewText,
              type: ClipboardHistoryService.ITEM_TYPE.TEXT
            });
            chrome.tabs.sendMessage(tab.id, { action: "link-info-update", tabId: tab.id });
          }, 200);
        }).catch(function(err) {
          console.warn('BackgroundController: Failed to inject toolbar script:', err);
        });
      }

      let menuItems = {};

      let initMenuItems = function () {
        chrome.contextMenus.removeAll();
        if (settings[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE] === true) {
          menuItems.simpleMenuItem = chrome.contextMenus.create({
            id: "simple_menu_item",
            title: ExtensionI18nService.getMessage("context_menu_download_with_jdownloader"),
            contexts: ["all"]
          });
          /*menuItems.simpleMenuItem = chrome.contextMenus.create({
              id: "autograbber_menu_item",
              title: ExtensionI18nService.getMessage("context_menu_toggle_autograbber"),
              contexts: ["all"]
          });*/
        } else {
          menuItems.downloadPageMenuItem = chrome.contextMenus.create({
            id: "download_page",
            title: ExtensionI18nService.getMessage("context_menu_add_page"),
            contexts: ["all"]
          });

          menuItems.downloadSelectionMenuItem = chrome.contextMenus.create({
            id: "download_selection",
            title: ExtensionI18nService.getMessage("context_menu_add_selection"),
            contexts: ["selection"]
          });

          menuItems.downloadLinkMenuItem = chrome.contextMenus.create({
            id: "download_link",
            title: ExtensionI18nService.getMessage("context_menu_add_link"),
            contexts: ["link"]
          });

          menuItems.downloadVideoMenuItem = chrome.contextMenus.create({
            id: "download_video",
            title: ExtensionI18nService.getMessage("context_menu_add_video"),
            contexts: ["video"]
          });

          menuItems.downloadAudioMenuItem = chrome.contextMenus.create({
            id: "download_audio",
            title: ExtensionI18nService.getMessage("context_menu_add_audio"),
            contexts: ["audio"]
          });

          menuItems.downloadImageMenuItem = chrome.contextMenus.create({
            id: "download_image",
            title: ExtensionI18nService.getMessage("context_menu_add_image"),
            contexts: ["image"]
          });
        }
      };

      chrome.contextMenus.onClicked.addListener(function (info, tab) {
        switch (info.menuItemId) {
          case "download_page":
            addPageToRequestQueue(tab);
            break;
          case "download_selection":
            chrome.tabs.sendMessage(tab.id, { action: "get-selection", tabId: tab.id });
            break;
          case "simple_menu_item":
            if (info) {
              if (info.selectionText) {
                chrome.tabs.sendMessage(tab.id, { action: "get-selection", tabId: tab.id });
              } else if (info.linkUrl) {
                addLinkToRequestQueue(info.linkUrl, tab);
              } else if (info && info.srcUrl) {
                addLinkToRequestQueue(info.srcUrl, tab);
              } else {
                addPageToRequestQueue(tab);
              }
            }
            break;
          case "download_link":
            if (info && info.linkUrl) {
              addLinkToRequestQueue(info.linkUrl, tab);
            }
            break;
          case "download_video":
          case "download_image":
          case "download_audio":
            if (info && info.srcUrl) {
              addLinkToRequestQueue(info.srcUrl, tab);
            }
            break;
        }
      });

      chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (changes && changes[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE]) {
          settings[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE] = changes[StorageService.SETTINGS_CONTEXT_MENU_SIMPLE].newValue;
          initMenuItems();
        }
        if (changes && changes[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG]) {
          settings[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG] = changes[StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG].newValue;
        }
        if (changes && changes[StorageService.SETTINGS_CLIPBOARD_OBSERVER]) {
          settings[StorageService.SETTINGS_CLIPBOARD_OBSERVER] = changes[StorageService.SETTINGS_CLIPBOARD_OBSERVER].newValue;
          $scope.state.clipboardObserver = changes[StorageService.SETTINGS_CLIPBOARD_OBSERVER].newValue;
          updateBadge($scope.state);
        }
        if (changes && changes[StorageService.SETTINGS_CLICKNLOAD_ACTIVE]) {
          settings[StorageService.SETTINGS_CLICKNLOAD_ACTIVE] = changes[StorageService.SETTINGS_CLICKNLOAD_ACTIVE].newValue;
          if (settings[StorageService.SETTINGS_CLICKNLOAD_ACTIVE] === true) {
            addCnlInterceptor();
          } else if (settings[StorageService.SETTINGS_CLICKNLOAD_ACTIVE] === false) {
            removeCnlInterceptor();
          }
        }
      });

      let removeCnlInterceptor = function () {
        if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onBeforeRequest) {
          chrome.webRequest.onBeforeRequest.removeListener(interceptRequest);
        }
      };

      function removeDialogFromAllTabs() {
        if (typeof chrome === 'undefined' || !chrome.tabs) return;
        chrome.tabs.query({}, function (tabs) {
          $.each(tabs, function (index, tab) {
            try {
              chrome.tabs.sendMessage(tab.id, "remove-dialog", function () {
                // if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
              });
              if (requestQueue[tab.id]) {
                delete requestQueue[tab.id];
              }
            } catch (e) {
              // at least we tried
            }
          });
        });
      }

      function initDisconnected() {
        $scope.state.isConnected = false;
        updateBadge($scope.state);
        if (typeof chrome !== 'undefined' && chrome.contextMenus) {
          chrome.contextMenus.removeAll();
        }
        removeCnlInterceptor();
        removeDialogFromAllTabs();
        addRc2Interceptor();
      }

      let addRequestHeaderInterceptor = function () {
        if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onBeforeSendHeaders) {
          if (!chrome.webRequest.onBeforeSendHeaders.hasListener(interceptHeaders)) {
            chrome.webRequest.onBeforeSendHeaders.removeListener(interceptHeaders);
            chrome.webRequest.onBeforeSendHeaders.addListener(
              interceptHeaders, {
              urls: ["<all_urls>"]
            }, ["blocking", "requestHeaders"]);
          }
        }
      };

      let addCnlInterceptor = function () {
        if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onBeforeRequest) {
          if (!chrome.webRequest.onBeforeRequest.hasListener(interceptRequest)) {
            chrome.webRequest.onBeforeRequest.removeListener(interceptRequest);
            chrome.webRequest.onBeforeRequest.addListener(
              interceptRequest, {
              urls: ["<all_urls>"]
            }, ["requestBody", "blocking"]);
          }
        }
      };

      let addRc2Interceptor = function () {
        if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onBeforeRequest) {
          if (!chrome.webRequest.onBeforeRequest.hasListener(Rc2Service.handleRequest)) {
            chrome.webRequest.onBeforeRequest.removeListener(Rc2Service.handleRequest);
            chrome.webRequest.onBeforeRequest.addListener(
              Rc2Service.handleRequest, {
              urls: ["<all_urls>"]
            }, ["requestBody", "blocking"]);
          }
        }
      };

      function initConnected() {
        addCnlInterceptor();
        initMenuItems();
        $scope.state.isConnected = true;
        updateBadge($scope.state);
        addRc2Interceptor();
      }

      function injectContentScripts() {
        if (typeof chrome === 'undefined' || !chrome.scripting) return;
        chrome.windows.getAll({ populate: true }, function (windows) {
          if (windows !== undefined && windows.length > 0) {
            $.each(windows, function (index, window) {
              if (window.tabs !== undefined && window.tabs.length > 0) {
                let scripts = [];
                for (let i = 0; i < chrome.runtime.getManifest().content_scripts.length; i++) {
                  scripts = scripts.concat(chrome.runtime.getManifest().content_scripts[i].js);
                }
                if (scripts !== undefined && scripts.length > 0) {
                  $.each(window.tabs, function (index, tab) {
                    let isBlockedUrl = (!tab.url.startsWith("http://") &&
                      !tab.url.startsWith("https://")) ||
                      tab.url.startsWith("https://chrome.google.com/webstore/"); // injecting scripts to https://chrome.google.com/webstore/* is blocked by chrome
                    if (!isBlockedUrl) {
                      $.each(scripts, function (index, script) {
                        if (script === "contentscripts/webinterfaceEnhancer.js" && !tab.url.startsWith("https://my.jdownloader.org")) {
                          return;
                        }
                        if (script === "contentscripts/browserSolverEnhancer.js" && !tab.url.match(/http:\/\/127.0.0.1:\d*\/.*\/.?id=\d+/gi)) {
                          return;
                        } else {
                          // MV3: Use chrome.scripting.executeScript
                          chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: [script]
                          }).catch(function(err) {
                            // Silently fail for restricted pages
                          });
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        });
      }

      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({ url: "http://127.0.0.1/*" }, (tabs) => {
          // execute scripts in tabs that were opened before the extension was available
          $.each(tabs, (index, tab) => {
            if (tab.url.match(/http:\/\/127.0.0.1:\d*\/.*\/.?id=\d+/gi)) {
              // MV3: Use chrome.scripting.executeScript
              if (chrome.scripting) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["contentscripts/browserSolverEnhancer.js"]
                }).catch(function(err) {
                  // Silently fail for restricted pages
                });
              }
            }
          });
        });
      }

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener(function (details) {
          if (chrome.runtime.lastError != null) {
            console.log(chrome.runtime.lastError.message);
          }
          if (details.reason === "update" || details.reason === "install") {
            injectContentScripts();
          }
        });
      }

      let init = function () {
        injectContentScripts();
        const myJDClient = myjdClientFactory.get();
        if (myJDClient) {
          myJDClient.connect().then(function () {
            $scope.state.isConnected = true;
            initSettings().then(initConnected);
          }).catch(function (error) {
            console.log("MyJD Extension init [SESSION]", error);
            $scope.state.isConnected = false;
            initSettings().then(initDisconnected);
          });
        } else {
          $scope.state.isConnected = false;
          initSettings().then(initDisconnected);
        }
      };

      function remoteAddLink(device, addLinksQuery) {
        return $q(function (resolve, reject) {
          myjdDeviceClientFactory.get(device).sendRequest("/linkgrabberv2/addLinks", JSON.stringify(addLinksQuery)).done(function (response) {
            resolve();
          }).fail(function (e) {
            reject(e);
          });
        });
      }

      function remoteAddCnl(device, addCnlQuery) {
        return $q(function (resolve, reject) {
          myjdDeviceClientFactory.get(device).sendRequest("/flash/addcnl", JSON.stringify(addCnlQuery)).done(function (response) {
            resolve();
          }).fail(function (e) {
            reject(e);
          });
        });
      }

      if (chrome.commands !== undefined) {
        chrome.commands.onCommand.addListener(function (command) {
          if ($scope.state.isConnected) {
            if (command === "toggle-clipboard-observer") {
              StorageService.getCollection([StorageService.SETTINGS_CLIPBOARD_OBSERVER], function (result) {
                if (result !== undefined) {
                  let value = result[StorageService.SETTINGS_CLIPBOARD_OBSERVER];
                  let newValue = false;
                  if (value !== undefined && typeof value === "boolean") {
                    StorageService.set(StorageService.SETTINGS_CLIPBOARD_OBSERVER, !value);
                    newValue = !value;
                  } else {
                    StorageService.set(StorageService.SETTINGS_CLIPBOARD_OBSERVER, true);
                    newValue = true;
                  }
                  $scope.state.clipboardObserver = newValue;
                  updateBadge($scope.state);
                }
              });
            }
            /* else if (command === "auto-grab-downloads") {
                                        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
                                            if (tabs != null && tabs.length > 0 && tabs[0] != null && tabs[0].id != null) {
                                                try {
                                                    let nowActive = DownloadsAutograbberService.toggleTab(tabs[0].id);
                                                    let action = nowActive ? "autograbber-started-in-tab" : "autograbber-stopped-in-tab";
                                                    chrome.tabs.sendMessage(Number.parseInt(tabs[0].id), {
                                                        action: action,
                                                        tabId: tabs[0].id
                                                    });
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }
                                        });
                                    }*/
          }
        });
      }

      init();
    }
  ]);
