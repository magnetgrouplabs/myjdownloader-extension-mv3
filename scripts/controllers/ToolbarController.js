"use strict";

/**
 * @ngdoc function
 * @name myjdWebextensionApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the myjdWebextensionApp
 */
angular.module("myjdWebextensionApp").controller("ToolbarCtrl", [
  "$q",
  "$rootScope",
  "$scope",
  "$timeout",
  "$interval",
  "RequestQueueEventService",
  "CnlService",
  "ApiErrorService",
  "StorageService",
  "BackgroundScriptService",
  "MyjdService",
  function (
    $q,
    $rootScope,
    $scope,
    $timeout,
    $interval,
    RequestQueueEventService,
    cnlService,
    apiErrorService,
    storageService,
    BackgroundScriptService,
    MyjdService
  ) {
    $rootScope.bodyClass = "";
    $scope.isPopup = getParamValue("popup");
    if ($scope.isPopup) {
      $rootScope.bodyClass = "toolbarPopupContainer";
    }

    var instanceId = getParamValue("id");
    var addLinksDialogTimeout;

    $scope.addLinksDialogActive = true;
    $scope.countdownOptions = {};
    $scope.countdownOptions.seconds = 3;
    $scope.countdownOptions.active = true;

    $scope.initState = {
      session: false,
      links: false,
      devices: false,
      isReady: function () {
        return this.session && this.links && this.devices;
      },
    };

    function initSession() {
      // Check local MyjdService connection state directly
      $timeout(function () {
        $scope.state.isConnecting = false;
        if (MyjdService.isConnected()) {
          $scope.state.loading = false;
          $scope.state.isLoggedIn = true;
        } else {
          // MyjdService may still be connecting (async restore), check storage fallback
          chrome.storage.local.get(['myjd_session'], function (result) {
            $timeout(function () {
              $scope.state.loading = false;
              $scope.state.isLoggedIn = !!result.myjd_session;
            }, 0);
          });
        }
      }, 0);
    }

    function resetScope() {
      $scope.state = {
        loading: false,
        loggedin: false,
        errorMessage: "",
        successMessage: "",
        countdown: -1,
        editMode: true,
        requestQueue: [],
        isRefreshingDevices: false,
        displayQueue: true,
      };

      $scope.closed = false;
      $scope.editMode = true;
      $scope.selection = {};
      $scope.history = {};
      $scope.subscriptions = [];
    }

    function startTimeout() {
      $scope.state.countdown = $scope.countdownOptions.seconds;
      if (addLinksDialogTimeout) {
        $interval.cancel(addLinksDialogTimeout);
      }
      addLinksDialogTimeout = $interval(
        function () {
          $timeout(function () {
            if ($scope.state.countdown !== -1) {
              $scope.state.countdown--;
              if ($scope.state.countdown === 0) {
                $scope.$broadcast(
                  RequestQueueEventService.Events.COUNTDOWN_FINISHED_SEND_LINKS,
                  {}
                );
              }
            }
          }, 0);
        },
        1000,
        $scope.countdownOptions.seconds
      );
    }

    function stopTimeout() {
      if (addLinksDialogTimeout) {
        $interval.cancel(addLinksDialogTimeout);
      }
      $scope.state.countdown = -1;
    }

    resetScope();
    init();

    function init() {
      $scope.closed = true;
      $timeout(function () {
        $scope.closed = false;
      }, 300);
      $scope.state.loading = true;

      storageService.get(
        storageService.STORAGE_DEVICE_LIST_KEY,
        function (result) {
          $timeout(function () {
            $scope.state.loading = false;
            $scope.devices =
              result[storageService.STORAGE_DEVICE_LIST_KEY] || [];
            $scope.devices.push(storageService.SaveForLaterDevice);
            if (
              !$scope.selection.device &&
              $scope.devices &&
              $scope.devices.length > 0
            ) {
              storageService.get(
                [
                  storageService.settingsKeys.DEFAULT_PREFERRED_JD.key,
                  storageService.ADD_LINK_CACHED_OPTIONS,
                ],
                function (result) {
                  if (
                    result[storageService.settingsKeys.DEFAULT_PREFERRED_JD.key]
                  ) {
                    if (result[storageService.ADD_LINK_CACHED_OPTIONS]) {
                      $scope.selection.previousDevice =
                        result[storageService.ADD_LINK_CACHED_OPTIONS].device;
                    }
                    $scope.selection.device = autoSelectDevice(
                      result[
                        storageService.settingsKeys.DEFAULT_PREFERRED_JD.key
                      ],
                      storageService.AskEveryTimeDevice
                    );
                  } else {
                    $scope.selection.device = $scope.devices[0];
                  }
                }
              );
            }
            if (!$scope.devices || $scope.devices.length === 0) {
              $scope.selectDevice("EXTENSION_LINK_QUEUE");
            }
          }, 0);
        }
      );

      storageService.getSettings(function (settings) {
        $scope.addLinksDialogActive =
          settings[storageService.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key] ===
          undefined
            ? storageService.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.defaultValue
            : settings[storageService.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key];
        $scope.countdownOptions.seconds =
          settings[storageService.settingsKeys.COUNTDOWN_VALUE.key] ===
          undefined
            ? storageService.settingsKeys.COUNTDOWN_VALUE.defaultValue
            : settings[storageService.settingsKeys.COUNTDOWN_VALUE.key];
        $scope.countdownOptions.active =
          settings[storageService.settingsKeys.COUNTDOWN_ACTIVE.key] ===
          undefined
            ? storageService.settingsKeys.COUNTDOWN_ACTIVE.defaultValue
            : settings[storageService.settingsKeys.COUNTDOWN_ACTIVE.key];
        updateLinks();
      });
    }

    initSession();

    $scope.selectDevice = function (device) {
      $scope.selection.device = device;
      if (
        device !== "EXTENSION_LINK_QUEUE" &&
        $scope.cachedHistory &&
        $scope.cachedHistory[$scope.selection.device.id]
      ) {
        $scope.history = $scope.cachedHistory[$scope.selection.device.id];
      }
    };

    $scope.enterEditMode = function () {
      $scope.editMode = true;
      $timeout(function () {
        stopTimeout();
      }, 0);
    };

    $scope.$on(
      RequestQueueEventService.Events.ADD_LINKS_DIALOG_CLOSE,
      function (event) {
        $timeout(function () {
          $scope.state.success = true;
          $timeout(function () {
            resetScope();
            closeDialog();
            if ($scope.isPopup) {
              chrome.runtime.sendMessage({
                name: "close-me",
                data: { tabId: instanceId },
              });
            }
          }, 800);
        }, 0);
      }
    );

    $scope.$on(
      RequestQueueEventService.Events.HIDE_REQUEST_QUEUE,
      function (event) {
        $timeout(function () {
          $scope.state.displayQueue = false;
        }, 0);
      }
    );

    $scope.cancel = function () {
      closeDialog();
      resetScope();
    };

    function closeDialog() {
      $scope.closed = true;
      chrome.runtime.sendMessage(
        {
          name: "myjd-toolbar",
          action: "close-in-page-toolbar",
          data: { tabId: instanceId },
        },
        function (response) {
          if (chrome.runtime.lastError != null) {
            console.log(chrome.runtime.lastError.message);
          }
        }
      );

      chrome.runtime.sendMessage(
        {
          name: "myjd-toolbar",
          action: "remove-all-requests",
          data: { tabId: instanceId },
        },
        function (response) {
          if (chrome.runtime.lastError != null) {
            console.log(chrome.runtime.lastError.message);
          }
        }
      );

      if (
        window.parent == window &&
        chrome.runtime
          .getURL("toolbar.html")
          .indexOf(window.location.origin) !== -1
      ) {
        // we are an add links popup and need to close ourselves (otherwise content script will remove the iframe we are in)
        chrome.runtime.sendMessage({
          name: "close-me",
          data: { tabId: instanceId },
        });
      }
    }

    $scope.getCnlTitle = function (historyItem) {
      console.log(historyItem);
      return historyItem.content.package || historyItem.parent.title || "";
    };

    $scope.getCnlUrl = function (historyItem) {
      return historyItem.content.source || historyItem.parent.source || "";
    };

    $scope.removeRequest = function (requestId) {
      chrome.runtime.sendMessage(
        {
          name: "myjd-toolbar",
          action: "remove-request",
          data: { tabId: instanceId, requestId: requestId },
        },
        function (response) {
          if (chrome.runtime.lastError != null) {
            console.log(chrome.runtime.lastError.message);
          }
        }
      );

      var newQueue = [];
      $.each($scope.state.requestQueue, function (index, request) {
        if (request.id !== requestId) {
          newQueue.push(request);
        }
      });

      if (newQueue.length === 0) {
        closeDialog();
      }

      $timeout(function () {
        $scope.state.requestQueue = newQueue;
      }, 300);
    };

    $scope.createPreviewText = function (text) {
      return $("<div>" + text + "</div>").text();
    };

    function updateLinks() {
      chrome.runtime.sendMessage(
        {
          name: "myjd-toolbar",
          action: "link-info",
          data: instanceId,
        },
        function (response) {
          if (chrome.runtime.lastError != null) {
            console.log(chrome.runtime.lastError.message);
          }
          $timeout(function () {
            $scope.state.requestQueue = response.data;
            $scope.initState.links = true;
            invalidateInitState();
          }, 0);
        }
      );
    }

    $scope.createPreviewText = function (text) {
      return $("<div>" + text + "</div>").text();
    };

    $scope.refreshDevices = function () {
      if (!$scope.state.isRefreshingDevices) {
        $scope.state.isRefreshingDevices = true;
        $timeout(function () {
          $scope.state.isRefreshingDevices = false;
        }, 1000);
        refreshDevices();
      }
    };

    function refreshDevices() {
      // Use local MyjdService directly instead of routing through background/offscreen
      MyjdService.getDeviceList()
        .then(function (result) {
          $timeout(function () {
            var devices = result.result || result;
            $scope.devices = $.isArray(devices) ? devices : [];
            if ($scope.devices.indexOf(storageService.SaveForLaterDevice) === -1) {
              $scope.devices.push(storageService.SaveForLaterDevice);
            }
            // Cache the device list in storage
            storageService.set(storageService.STORAGE_DEVICE_LIST_KEY, $scope.devices);
            $scope.initState.devices = true;
            invalidateInitState();
            $scope.selection.device = autoSelectDevice(
              $scope.devices[0],
              storageService.AskEveryTimeDevice
            );
          }, 0);
        })
        .catch(function () {
          $timeout(function () {
            $scope.errorMessage =
              "Failed to get a list of connected JDownloaders";
          }, 0);
        });
    }

    $scope.$on(
      "$destroy",
      function () {
        for (var i = 0; i < $scope.subscriptions.length; i++) {
          try {
            $scope.subscription.unsubscribe();
          } catch (e) {}
        }
      }.bind(this)
    );

    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg) {
        if (
          msg.action &&
          msg.action === "link-info-update" &&
          msg.tabId &&
          msg.tabId == instanceId
        ) {
          updateLinks();
          $timeout(function () {
            $scope.initState.links = true;
            invalidateInitState();
          }, 0);
        } else if (msg.name && msg.name === "CONNECTION_STATE_CHANGE") {
          $scope.state.isConnecting = false;
          if (msg.data === "DISCONNECTED") {
            window.localStorage.removeItem("jdapi/src/core/core.js");
            $timeout(function () {
              $scope.state.loading = false;
              $scope.state.isLoggedIn = false;
            }, 0);
          } else if (msg.data === "CONNECTED") {
            initSession();
            $timeout(function () {
              $scope.state.loading = false;
              $scope.state.isLoggedIn = true;
              $scope.initState.session = true;
              invalidateInitState();
            }, 0);
          }
        }
      }
    });

    function invalidateInitState() {
      if ($scope.initState.isReady()) {
        if ($scope.addLinksDialogActive) {
          if ($scope.countdownOptions.active && !$scope.editMode) {
            $timeout(function () {
              stopTimeout();
              startTimeout();
            }, 0);
          }
        } else {
          $timeout(function () {
            $scope.state.countdown = 0;
            $scope.$broadcast(
              RequestQueueEventService.Events.COUNTDOWN_FINISHED_SEND_LINKS,
              {}
            );
          }, 300);
        }
      }
    }

    $scope.$on(RequestQueueEventService.Events.SESSION_RECEIVED, function () {
      $timeout(function () {
        $scope.initState.session = true;
        invalidateInitState();
      }, 0);
    });

    $scope.$on(RequestQueueEventService.Events.DEVICES_RECEIVED, function () {
      $timeout(function () {
        $scope.initState.devices = true;
        invalidateInitState();
      }, 0);
    });

    function getParamValue(paramName) {
      var url = window.location.search.substring(1); //get rid of "?" in querystring
      var qArray = url.split("&"); //get key-value pairs
      for (var i = 0; i < qArray.length; i++) {
        var pArr = qArray[i].split("="); //split key and value
        if (pArr[0] == paramName) return pArr[1]; //return value
      }
    }

    var autoSelectDevice = function (preferredDevice, fallbackDevice) {
      var deviceIdToFind;
      if (preferredDevice) {
        if (
          preferredDevice.id === storageService.LastUsedDevice.id &&
          $scope.selection.previousDevice
        ) {
          deviceIdToFind = $scope.selection.previousDevice.id;
        } else if (
          preferredDevice.id === storageService.SaveForLaterDevice.id
        ) {
          return storageService.SaveForLaterDevice;
        } else if (
          preferredDevice.id === storageService.AskEveryTimeDevice.id
        ) {
          $scope.editMode = true;
          return storageService.AskEveryTimeDevice;
        } else {
          deviceIdToFind = preferredDevice.id;
        }

        if (deviceIdToFind !== undefined) {
          var matchedDevice;
          $.each($scope.devices, function (index, device) {
            if (device.id === deviceIdToFind) {
              matchedDevice = device;
            }
          });
          if (matchedDevice !== undefined) {
            return matchedDevice;
          }
        }
      }

      return fallbackDevice;
    };
  },
]);
