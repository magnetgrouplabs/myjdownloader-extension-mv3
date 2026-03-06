'use strict';

angular.module('myjdWebextensionApp')
  .service('Rc2Service', ['BrowserService', 'ExtensionMessagingService', 'PopupCandidatesService', 'myjdClientFactory', 'myjdDeviceClientFactory', 'StorageService', 'CaptchaNativeService',
    function (BrowserService, ExtensionMessagingService, PopupCandidatesService, myjdClientFactory, myjdDeviceClientFactory, StorageService, CaptchaNativeService) {
      const buildVersion = chrome.runtime.getManifest().version;
      let isForcedPrivateMode = false;
      let isAllowedIncognito = false;

      let rc2TabUpdateCallbacks = {};
      let rc2CanCloseIntervalHandles = {};

      StorageService.get(StorageService.settingsKeys.CAPTCHA_PRIVACY_MODE.key, result => {
        isForcedPrivateMode = false //result[StorageService.settingsKeys.CAPTCHA_PRIVACY_MODE.key] ||
        // StorageService.settingsKeys.CAPTCHA_PRIVACY_MODE.defaultValue;
      });

      // MV3: Check incognito access - use callback style for compatibility
      // chrome.extension.isAllowedIncognitoAccess was replaced by chrome.runtime.isAllowedIncognitoAccess in MV3
      // The API may not be available in all contexts, so wrap in try/catch
      try {
        if (chrome.runtime && typeof chrome.runtime.isAllowedIncognitoAccess === 'function') {
          chrome.runtime.isAllowedIncognitoAccess(function(isAllowedAccess) {
            if (chrome.runtime.lastError) {
              console.log('Rc2Service: Could not check incognito access:', chrome.runtime.lastError.message);
              isAllowedIncognito = false;
            } else {
              isAllowedIncognito = isAllowedAccess || false;
              console.log('Rc2Service: isAllowedIncognitoAccess =', isAllowedIncognito);
            }
          });
        } else {
          console.log('Rc2Service: isAllowedIncognitoAccess not available in this context');
          isAllowedIncognito = false;
        }
      } catch (e) {
        console.log('Rc2Service: Error checking incognito access:', e);
        isAllowedIncognito = false;
      }

      function handleRequest(request) {
        if (request.url.match(/http:\/\/127\.0\.0\.1:\d+\/captcha\/(recaptchav(2|3)|hcaptcha)\/.*\?id=\d+$/gm) !== null) {
          // Native helper handles CAPTCHA solving - close the localhost tab
          // The native helper opens its own browser window for solving
          chrome.tabs.remove(request.tabId, function() {
            if (chrome.runtime.lastError) {
              console.log('Rc2Service: Could not close tab:', chrome.runtime.lastError.message);
            }
          });
        }
      }

      function onLoginNeeded(tab) {
        chrome.tabs.update(tab, { url: chrome.runtime.getURL("loginNeeded.html") });
      }

      function onWebInterfaceCaptchaJobFound(tab, captchaData, captchaJob) {
        let params = {};        
        params.challengeType = captchaData.challengeType || captchaData.type;
        params.captchaId = captchaData.id;
        params.hoster = captchaData.hoster;

        params.v3action = captchaJob.v3Action;
        params.siteKey = captchaJob.siteKey;
        params.siteKeyType = captchaJob.type;      
        params.finalUrl = captchaJob.siteUrl || captchaJob.contextUrl;

        onNewCaptchaAvailable(tab, "MYJD", params);
      }

      function sendRc2SolutionToJd(request, sender) {
        // there should be either a local callbackUrl or a captcha id that can be used to solve through MyJDownloader
        if (request.data.callbackUrl !== undefined && request.data.callbackUrl !== "undefined" && request.data.callbackUrl !== "MYJD") {
          // send the solution to local JDownloader
          const httpRequest = new XMLHttpRequest();
          httpRequest.ontimeout = function () {
            console.error("The request for " + request.data.callbackUrl + " timed out.");
          };
          httpRequest.onload = function () {
            if (sender && sender.tab && sender.tab.id) {
              setTimeout(function () {
                chrome.tabs.remove(sender.tab.id);
              }, 2000);
            }
          };
          httpRequest.open("GET", request.data.callbackUrl + "&do=solve&response=" + request.data.token, true);
          httpRequest.setRequestHeader("X-Myjd-Appkey", "webextension-" + buildVersion);
          httpRequest.send();
        } else if (request.data.captchaId && request.data.callbackUrl === "MYJD") {
          // search web interface and send the solution from there
          chrome.tabs.query({
            url: [
              "http://my.jdownloader.org/*",
              "https://my.jdownloader.org/*",
              "http://my.jdownloader.org/*"
            ]
          }, function (tabs) {
            if (tabs !== undefined && tabs.length > 0) {
              for (let i = 0; i < tabs.length; i++) {
                chrome.tabs.sendMessage(tabs[i].id, {
                  name: "response",
                  type: "myjdrc2",
                  data: { captchaId: request.data.captchaId, token: request.data.token }
                }, function (response) {
                  // nothing to do
                });
              }
            }
          });
        }
      }


      function onRc2MouseMove(callbackUrl, timestamp) {
        const httpRequest = new XMLHttpRequest();
        httpRequest.open("GET", callbackUrl + "&do=canClose&useractive=true&ts=" + timestamp, true);
        httpRequest.setRequestHeader("X-Myjd-Appkey", "webextension-" + buildVersion);
        httpRequest.timeout = 5000;
        httpRequest.send();
      }

      function onRc2FrameLoaded(request, sender) {
        let params = request.params;
        let callbackUrl = request.callbackUrl;
        const httpRequest = new XMLHttpRequest();
        let urlParams =
          "&x=" + encodeURIComponent(params.x)
          + "&y=" + encodeURIComponent(params.y)
          + "&w=" + encodeURIComponent(params.w)
          + "&h=" + encodeURIComponent(params.h)
          + "&vw=" + encodeURIComponent(params.vw)
          + "&vh=" + encodeURIComponent(params.vh)
          + "&eleft=" + encodeURIComponent(params.eleft)
          + "&etop=" + encodeURIComponent(params.etop)
          + "&ew=" + encodeURIComponent(params.ew)
          + "&eh=" + encodeURIComponent(params.eh)
          + "&dpi=" + encodeURIComponent(params.dpi);

        httpRequest.open("GET", callbackUrl + "&do=loaded" + urlParams, true);
        httpRequest.timeout = 5000;
        httpRequest.setRequestHeader("X-Myjd-Appkey", "webextension-" + buildVersion);
        httpRequest.send();
      }

      function removeRc2CanCloseCheck(tabId) {
        if (rc2CanCloseIntervalHandles[tabId] !== undefined) {
          clearInterval(rc2CanCloseIntervalHandles[tabId]);
          delete rc2CanCloseIntervalHandles[tabId];
        }
      }

      function checkRc2TabModeCanClose(request, sender) {
        const httpRequest = new XMLHttpRequest();
        httpRequest.ontimeout = function () {
          console.error("The request for " + request.data.callbackUrl + " timed out.");
          removeRc2CanCloseCheck(sender.tab.id);
        };
        httpRequest.onreadystatechange = function () {
          if (this.readyState === 4 && this.status === 200) {
            if (httpRequest.response === "true") {
              removeRc2CanCloseCheck(sender.tab.id);
              chrome.tabs.remove(sender.tab.id, BrowserService.chromeErrorCallback);
            }
          }
        };
        httpRequest.open("GET", request.data.callbackUrl + "&do=canClose", true);
        httpRequest.setRequestHeader("X-Myjd-Appkey", "webextension-" + buildVersion);
        httpRequest.send();
      }

      ExtensionMessagingService.addListener("webinterface-enhancer", "captcha-done", function (request, sender, sendResponse) {
        ExtensionMessagingService.sendMessage("myjdrc2", "captcha-done", request.data);
      });

      ExtensionMessagingService.addListener("myjdrc2", "loaded", function (request, sender, sendResponse) {
        if (request.callbackUrl !== undefined && request.callbackUrl !== "undefined" && request.callbackUrl !== "MYJD") {
          onRc2FrameLoaded(request, sender);
        }
      });

      ExtensionMessagingService.addListener("myjdrc2", "tabmode-init", function (request, sender, sendResponse) {
        if (request.data.callbackUrl !== undefined && request.data.callbackUrl !== "undefined" && request.data.callbackUrl !== "MYJD") {
          let handle = setInterval(() => {
            if (!rc2CanCloseIntervalHandles[sender.tab.id]) {
              clearInterval(handle);
            }
            checkRc2TabModeCanClose(request, sender);
          }, 1000);
          rc2CanCloseIntervalHandles[sender.tab.id] = handle;
          PopupCandidatesService.addRemovedTabListener(sender.tab.id,
            _ => removeRc2CanCloseCheck(sender.tab.id));
        } else if (request.data.captchaId !== undefined) {
          PopupCandidatesService.addRemovedTabListener(sender.tab.id, _ => {
            chrome.tabs.query({
              url: [
                "http://my.jdownloader.org/*",
                "https://my.jdownloader.org/*",
                "http://my.jdownloader.org/*"
              ]
            }, function (tabs) {
              if (tabs !== undefined && tabs.length > 0) {
                for (let i = 0; i < tabs.length; i++) {
                  chrome.tabs.sendMessage(tabs[i].id, {
                    name: "tab-closed",
                    type: "myjdrc2",
                    data: { captchaId: request.data.captchaId }
                  }, function (response) {
                    // nothing to do
                  });
                }
              }
            });
          });
        }
      });

      ExtensionMessagingService.addListener("myjdrc2", "response", function (request, sender, sendResponse) {
        sendRc2SolutionToJd(request, sender);
      });

      ExtensionMessagingService.addListener("myjdrc2", "mouse-move", function (request, sender, sendResponse) {
        onRc2MouseMove(request.callbackUrl, request.timestamp);
      });

      ExtensionMessagingService.addListener("myjdrc2", "captcha-new", function (request, sender, sendResponse) {
        // request.data.params is a string IPC not working with objects
        onNewCaptchaAvailable(sender.tab.id, request.data.callbackUrl, JSON.parse(request.data.params));

      });

      function onNewCaptchaAvailable(tabId, callbackUrl, params) {
        // Use native helper for CAPTCHA solving
        var captchaJob = {
          siteKey: params.siteKey,
          siteKeyType: params.siteKeyType,
          challengeType: params.challengeType,
          callbackUrl: callbackUrl,
          captchaId: params.captchaId,
          hoster: params.hoster,
          v3action: params.v3action,
          siteUrl: params.finalUrl
        };
        
        CaptchaNativeService.sendCaptcha(captchaJob).then(function(response) {
          console.log('Rc2Service: Native helper accepted CAPTCHA job:', response);
          // Native helper handles the solving - close the triggering tab
          chrome.tabs.remove(tabId, function() {
            if (chrome.runtime.lastError) {
              console.log('Rc2Service: Could not close tab:', chrome.runtime.lastError.message);
            }
          });
        }).catch(function(error) {
          console.error('Rc2Service: Native helper failed, falling back to web interface:', error);
          // Fallback: notify web interface if available
          chrome.tabs.query({
            url: [
              "http://my.jdownloader.org/*",
              "https://my.jdownloader.org/*"
            ]
          }, function(tabs) {
            if (tabs !== undefined && tabs.length > 0) {
              for (let i = 0; i < tabs.length; i++) {
                chrome.tabs.sendMessage(tabs[i].id, {
                  name: "captcha-new",
                  type: "myjdrc2",
                  data: { callbackUrl: callbackUrl, params: JSON.stringify(params) }
                });
              }
            }
          });
        });
      }

      ExtensionMessagingService.addListener("myjdrc2", "tabmode-skip-request", function (request, sender, sendResponse) {
        onSkipRequest(sender, request.data);
      });

      function onSkipRequest(sender, data) {
        if (data.callbackUrl !== undefined && data.callbackUrl !== "undefined") {
          if (data.callbackUrl === "MYJD") {
            // TODO: Send via API
          } else {
            const httpRequest = new XMLHttpRequest();
            httpRequest.ontimeout = function () {
              console.error("The request for " + data.callbackUrl + " timed out.");
            };
            httpRequest.onload = function () {
              if (sender && sender.tab && sender.tab.id) {
                setTimeout(function () {
                  // if not already removed, remove the tab now
                  chrome.tabs.remove(sender.tab.id, BrowserService.chromeErrorCallback);
                }, 2000);
              }
            };
            if ("all" === data.skipType) {
              httpRequest.open("GET", data.callbackUrl + "&do=skip&skiptype=all", true);
            } else if ("hoster" === data.skipType) {
              httpRequest.open("GET", data.callbackUrl + "&do=skip&skiptype=hoster", true);
            } else if ("package" === data.skipType) {
              httpRequest.open("GET", data.callbackUrl + "&do=skip&skiptype=package", true);
            } else if ("single" === data.skipType) {
              httpRequest.open("GET", data.callbackUrl + "&do=skip&skiptype=single", true);
            }
            httpRequest.setRequestHeader("X-Myjd-Appkey", "webextension-" + buildVersion);
            httpRequest.send();
          }

        }
      }

      chrome.tabs.onRemoved.addListener((tabId) => {
        delete rc2TabUpdateCallbacks[tabId];
      });

      chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tabInfo) {
        var tabCaptchaInfo = rc2TabUpdateCallbacks[tabId];
        let match;
        if (tabCaptchaInfo != null && changeInfo.status === "complete") {
          let listener = tabCaptchaInfo.callback;
          listener(tabId);
          delete tabCaptchaInfo.callback;
        } else if (tabInfo.url.indexOf("#rc2jdt") !== -1 && (match = tabInfo.url.match("\\&c=(.*)")) != null) {
          let captchaId = match[1];
          if (captchaId != null) {
            const connected = myjdClientFactory.get().isConnected();
            if (connected) {
              myjdClientFactory.get().getDeviceList().then(deviceResponse => {
                deviceResponse.result.map(device => {
                  myjdDeviceClientFactory.get(device).sendRequest("/captcha/getCaptchaJob", captchaId)
                    .then(captchaData => {
                      if (captchaData != null && captchaData.data != null && captchaData.data.id != null) {
                        myjdDeviceClientFactory.get(device)
                          .sendRequest("/captcha/get", JSON.stringify(captchaData.data.id), "rawtoken")
                          .then(captchaJobResponse => {
                            if (captchaJobResponse != null && captchaJobResponse.data != null) {
                              onWebInterfaceCaptchaJobFound(tabId, captchaData.data, captchaJobResponse.data);
                            }
                          })
                          .catch(console.error);
                      }
                    }).catch(console.error);
                });
              });
            } else {
              onLoginNeeded(tabId);
            }
          }
        }
      });

      chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (changes && changes[StorageService.settingsKeys.CAPTCHA_PRIVACY_MODE.key]) {
          isForcedPrivateMode = changes[StorageService.settingsKeys.CAPTCHA_PRIVACY_MODE.key].newValue;
        }
      });

      ExtensionMessagingService.addListener("myjdrc2", "captcha-get", function (request, sender, sendResponse) {
        var tabCaptchaInfo = rc2TabUpdateCallbacks[sender.tab.id];
        if (tabCaptchaInfo == null) {
          console.log("no captcha available:", sender.tab.id);
        } else {
          var captchaParams = tabCaptchaInfo.captchaParams;
          chrome.tabs.sendMessage(sender.tab.id, {
            name: "myjdrc2", action: "captcha-set", data: {
              callbackUrl: captchaParams.callbackUrl,
              params: captchaParams.params
            }
          }, (ev) => {
            console.log("captcha-set", ev);
          });

          console.log("captcha-get", request, sender, captchaParams);
        }
      });

      return {
        handleRequest: handleRequest
      };
    }]);
