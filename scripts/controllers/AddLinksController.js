"use strict";

angular.module("myjdWebextensionApp").controller("AddLinksCtrl", [
  "$rootScope",
  "$routeParams",
  "$scope",
  "$timeout",
  "$interval",
  "RequestQueueEventService",
  "CnlService",
  "ApiErrorService",
  "StorageService",
  "BackgroundScriptService",
  "ExtensionI18nService",
  "myjdDeviceClientFactory",
  "MyjdService",
  function (
    $rootScope,
    $routeParams,
    $scope,
    $timeout,
    $interval,
    requestQueueEventService,
    cnlService,
    apiErrorService,
    storageService,
    BackgroundScriptService,
    ExtensionI18nService,
    myjdDeviceClientFactory,
    MyjdService
  ) {
    $scope.SaveForLaterDevice = storageService.SaveForLaterDevice;

    $scope.priorityValues = storageService.remotePriorityValues;

    $scope.optionalDefaults = {};

    $scope.devices = [];

    $scope.requestStates = {
      IDLE: "IDLE",
      SUCCESS: "SUCCESS",
      RUNNING: "RUNNING",
      ERROR: "ERROR",
    };

    $scope.$on(
      requestQueueEventService.Events.COUNTDOWN_FINISHED_SEND_LINKS,
      function () {
        $timeout(function () {
          $scope.selection.showOptionalValues = false;
          $scope.send();
        }, 0);
      }
    );

    function resetScope() {
      $scope.state = {
        loading: false,
        sending: { state: $scope.requestStates.IDLE },
        loggedIn: false,
        removeAfterSend: true,
        requestQueue: [],
      };

      $scope.selection = {};

      $scope.history = {
        archivepw: [],
        downloadpw: [],
        packageName: [],
        saveto: [],
        priority: [],
      };
    }

    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg) {
        if (msg.type && msg.type === "CONNECTION_STATE_CHANGE") {
          if (msg.value && msg.value === "CONNECTED") {
            $timeout(function () {
              $scope.state.loggedIn = true;
            }, 0);
          } else if (msg.value && msg.value === "DISCONNECTED") {
            $timeout(function () {
              $scope.state.loggedIn = true;
            }, 0);
          }
        }
      }
    });

    var loadingIndicatorTimeout;

    var loadDeviceList = function (callback) {
      // Use local MyjdService directly instead of routing through background/offscreen
      MyjdService.getDeviceList()
        .then(function (result) {
          setLoading(false);
          $timeout(function () {
            var devices = result.result || result;
            $scope.$emit(
              requestQueueEventService.Events.DEVICES_RECEIVED,
              {}
            );
            $scope.devices.splice(0, $scope.devices.length);
            if ($.isArray(devices)) {
              $scope.state.lastDeviceReloadResult =
                devices.length +
                " JDs " +
                ExtensionI18nService.getMessage(
                  "ui_add_links_refresh_jd_found"
                );
              $scope.devices = $scope.devices.concat(devices);
              // Also cache the device list in storage for other contexts
              storageService.set(storageService.STORAGE_DEVICE_LIST_KEY, devices);
              if (
                $scope.showSaveForLater &&
                $scope.devices.indexOf($scope.SaveForLaterDevice) === -1
              ) {
                $scope.devices.push($scope.SaveForLaterDevice);
              }
            } else {
              $scope.state.lastDeviceReloadResult =
                ExtensionI18nService.getMessage(
                  "ui_add_links_refresh_no_jd_found"
                );
            }
            $timeout(function () {
              $scope.state.lastDeviceReloadResult = "";
            }, 2000);
            if (callback) {
              callback();
            }
          }, 0);
        })
        .catch(function () {
          setLoading(false);
          $timeout(function () {
            $scope.error = ExtensionI18nService.getMessage(
              "ui_add_links_refresh_failed_to_get_jds"
            );
          }, 0);
          if (callback) {
            callback();
          }
        });
    };

    var loadSessionInfo = function (callback) {
      // Check local MyjdService connection state directly
      var isLoggedIn = MyjdService.isConnected();

      // If not yet connected, also check storage for a session (MyjdService may still be restoring)
      if (!isLoggedIn) {
        chrome.storage.local.get(['myjd_session'], function (result) {
          var hasSession = !!result.myjd_session;
          $timeout(function () {
            $scope.state.isConnecting = false;
            $scope.$emit(requestQueueEventService.Events.SESSION_RECEIVED, {});
            setLoading(false);
            if (hasSession) {
              $scope.state.isLoggedIn = true;
              loadCachedDevices(callback);
            } else {
              $scope.state.isLoggedIn = false;
              resetScope();
              if (callback) callback();
            }
          }, 0);
        });
      } else {
        $timeout(function () {
          $scope.state.isConnecting = false;
          $scope.$emit(requestQueueEventService.Events.SESSION_RECEIVED, {});
          setLoading(false);
          $scope.state.isLoggedIn = true;
          loadCachedDevices(callback);
        }, 0);
      }
    };

    function loadCachedDevices(callback) {
      storageService.get(
        storageService.STORAGE_DEVICE_LIST_KEY,
        function (result) {
          $timeout(function () {
            $scope.devices =
              result[storageService.STORAGE_DEVICE_LIST_KEY] || [];
            if (
              $scope.showSaveForLater &&
              $scope.devices.indexOf($scope.SaveForLaterDevice) === -1
            ) {
              $scope.devices.push($scope.SaveForLaterDevice);
            }
            if (!$scope.selection.device) {
              $scope.selection.device = $scope.devices[0];
            }
            $timeout(function () {
              $scope.$emit(
                requestQueueEventService.Events.DEVICES_RECEIVED,
                {}
              );
            }, 0);
            restoreOptionsAndHistory(function () {
              if (callback) {
                callback();
              }
            });
          }, 0);
        }
      );
    }

    function initDefaultOptionalValues() {
      storageService.getSettings(function (settings) {
        if (settings) {
          $scope.optionalDefaults = settings;
        }
      });
    }

    function init() {
      setLoading(true);
      $scope.selection.device = $scope.device;
      initDefaultOptionalValues();
      loadSessionInfo(function () {
        loadDeviceList();
      });
    }

    function setLoading(loading) {
      if (loading) {
        loadingIndicatorTimeout = $timeout(function () {
          $scope.state.loading = true;
        }, 1000);
      } else {
        if (loadingIndicatorTimeout) {
          $timeout.cancel(loadingIndicatorTimeout);
        }
        $timeout(function () {
          $scope.state.loading = false;
        }, 0);
      }
    }

    resetScope();
    init();

    $scope.selectDevice = function (device) {
      $scope.selection.device = device;
      if ($scope.cachedHistory === undefined) {
        $scope.cachedHistory = {};
      }
      $scope.history = $scope.cachedHistory[$scope.selection.device.id] || {
        archivepw: [],
        downloadpw: [],
        packageName: [],
        saveto: [],
        priority: [],
      };
    };

    $scope.toggleOptionalValues = function () {
      var prevValue = $scope.selection.showOptionalValues || false;
      $scope.selection.showOptionalValues = !prevValue;
    };

    $scope.refreshDevices = function () {
      loadDeviceList();
    };

    function addToHistory(key, value) {
      if ($scope.history[key] === undefined) {
        $scope.history[key] = [];
      }
      if ($.inArray(value, $scope.history[key]) === -1) {
        $scope.history[key].unshift(value);
      }
    }

    $scope.saveOptions = function () {
      var options = {
        removeAfterSend: $scope.selection.removeAfterSend,
        autoFill: $scope.selection.autoFill,
        showOptionalValues: $scope.selection.showOptionalValues,
        autoStart: $scope.selection.autoStart,
      };
      storageService.set(
        storageService.ADD_LINK_CACHED_OPTIONS,
        options,
        function () {
          // Nothing to do
        }
      );
    };

    function saveOptionsAndHistory(callback) {
      if ($scope.selection.comment !== undefined) {
        addToHistory("comment", $scope.selection.comment);
      }
      if ($scope.selection.packageName !== undefined) {
        addToHistory("packageName", $scope.selection.packageName);
      }
      if ($scope.selection.saveto !== undefined) {
        addToHistory("saveto", $scope.selection.saveto);
      }
      if ($scope.selection.archivepw !== undefined) {
        addToHistory("archivepw", $scope.selection.archivepw);
      }
      if ($scope.selection.downloadpw !== undefined) {
        addToHistory("downloadpw", $scope.selection.downloadpw);
      }

      storageService.get(
        [
          storageService.ADD_LINK_CACHED_OPTIONS,
          storageService.ADD_LINK_CACHED_HISTORY,
        ],
        function (result) {
          // Save options
          var options = {
            deepDecrypt: $scope.selection.deepDecrypt,
            autoExtract: $scope.selection.autoExtract,
            autoStart: $scope.selection.autoStart,
            overwritePackagizer: $scope.selection.overwritePackagizer,
            removeAfterSend: $scope.selection.removeAfterSend,
            autoFill: $scope.selection.autoFill,
            showOptionalValues: $scope.selection.showOptionalValues,
          };

          if (
            $scope.selection.device.id !== storageService.AskEveryTimeDevice.id
          ) {
            options.device = $scope.selection.device;
          }

          storageService.set(
            storageService.ADD_LINK_CACHED_OPTIONS,
            options,
            function () {
              // Save value history
              if (!result.ADD_LINK_CACHED_HISTORY) {
                result.ADD_LINK_CACHED_HISTORY = {};
              }
              if (!result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]) {
                result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id] = {};
              }
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].comment = $scope.history.comment;
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].archivepw = $scope.history.archivepw;
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].downloadpw = $scope.history.downloadpw;
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].packageName = $scope.history.packageName;
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].saveto = $scope.history.saveto;
              result.ADD_LINK_CACHED_HISTORY[
                $scope.selection.device.id
              ].priority = $scope.selection.priority;
              storageService.set(
                storageService.ADD_LINK_CACHED_HISTORY,
                result.ADD_LINK_CACHED_HISTORY,
                callback
              );
            }
          );
        }
      );
    }

    var restoreDefaultValues = function () {
      var autoExtract =
        $scope.optionalDefaults[
          storageService.settingsKeys.DEFAULT_AUTOEXTRACT.key
        ];
      if (autoExtract !== "unset") {
        $scope.selection.autoExtract =
          $scope.optionalDefaults[
            storageService.settingsKeys.DEFAULT_AUTOEXTRACT.key
          ];
      }
      var autoStart =
        $scope.optionalDefaults[
          storageService.settingsKeys.DEFAULT_AUTOSTART.key
        ];
      if (autoStart !== "unset") {
        $scope.selection.autoStart =
          $scope.optionalDefaults[
            storageService.settingsKeys.DEFAULT_AUTOSTART.key
          ];
      }
      var deepDecrypt =
        $scope.optionalDefaults[
          storageService.settingsKeys.DEFAULT_DEEPDECRYPT.key
        ];
      if (deepDecrypt !== "unset") {
        $scope.selection.deepDecrypt =
          $scope.optionalDefaults[
            storageService.settingsKeys.DEFAULT_DEEPDECRYPT.key
          ];
      }
      var overwritePackagizer =
        $scope.optionalDefaults[
          storageService.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key
        ];
      if (overwritePackagizer !== "unset") {
        $scope.selection.overwritePackagizer =
          $scope.optionalDefaults[
            storageService.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key
          ];
      }
      var priority =
        $scope.optionalDefaults[
          storageService.settingsKeys.DEFAULT_PRIORITY.key
        ];
      if (priority && priority.id != storageService.priorityValues.UNSET.id) {
        $scope.selection.priority = priority;
      } else {
        $scope.selection.priority = storageService.priorityValues.DEFAULT;
      }
    };

    function restoreOptionsAndHistory(callback) {
      storageService.get(
        [
          storageService.ADD_LINK_CACHED_OPTIONS,
          storageService.ADD_LINK_CACHED_HISTORY,
        ],
        function (result) {
          $timeout(function () {
            if (result && result.ADD_LINK_CACHED_OPTIONS) {
              $scope.selection.autoFill =
                result.ADD_LINK_CACHED_OPTIONS.autoFill;
              $scope.selection.removeAfterSend =
                result.ADD_LINK_CACHED_OPTIONS.removeAfterSend;
              if ($scope.selection.autoFill) {
                $scope.selection.autoExtract =
                  result.ADD_LINK_CACHED_OPTIONS.autoExtract;
                $scope.selection.autoStart =
                  result.ADD_LINK_CACHED_OPTIONS.autoStart;
                $scope.selection.deepDecrypt =
                  result.ADD_LINK_CACHED_OPTIONS.deepDecrypt;
                $scope.selection.overwritePackagizer =
                  result.ADD_LINK_CACHED_OPTIONS.overwritePackagizer;
              } else {
                // Fall back to defaults, if any
                restoreDefaultValues();
              }
              $scope.optionsHistory = result.ADD_LINK_CACHED_OPTIONS;
            }

            if ($scope.selection.device) {
              if (
                result.ADD_LINK_CACHED_HISTORY &&
                result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
              ) {
                if (
                  $scope.selection.autoFill &&
                  result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                ) {
                  $scope.selection.saveto =
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .saveto &&
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .saveto.length > 0
                      ? result.ADD_LINK_CACHED_HISTORY[
                          $scope.selection.device.id
                        ].saveto[0]
                      : undefined;
                  $scope.selection.packageName =
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .packageName &&
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .packageName.length > 0
                      ? result.ADD_LINK_CACHED_HISTORY[
                          $scope.selection.device.id
                        ].packageName[0]
                      : undefined;
                  $scope.selection.archivepw =
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .archivepw &&
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .archivepw.length > 0
                      ? result.ADD_LINK_CACHED_HISTORY[
                          $scope.selection.device.id
                        ].archivepw[0]
                      : undefined;
                  $scope.selection.downloadpw =
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .downloadpw &&
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .downloadpw.length > 0
                      ? result.ADD_LINK_CACHED_HISTORY[
                          $scope.selection.device.id
                        ].downloadpw[0]
                      : undefined;
                  $scope.selection.comment =
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .comment &&
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .comment.length > 0
                      ? result.ADD_LINK_CACHED_HISTORY[
                          $scope.selection.device.id
                        ].comment[0]
                      : undefined;
                  $scope.selection.priority = setIfUndefined(
                    result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id]
                      .priority,
                    $scope.priorityValues.DEFAULT
                  );
                }
                $scope.history =
                  result.ADD_LINK_CACHED_HISTORY[$scope.selection.device.id];
              }
              $scope.cachedHistory = result.ADD_LINK_CACHED_HISTORY || {};
            }
            if (callback) {
              callback();
            }
          }, 0);
        }
      );
    }

    $scope.clearAllOptionalValues = function () {
      $timeout(function () {
        $scope.selection.saveto = undefined;
        $scope.selection.comment = undefined;
        $scope.selection.packageName = undefined;
        $scope.selection.archivepw = undefined;
        $scope.selection.downloadpw = undefined;
        $scope.selection.priority = $scope.priorityValues.DEFAULT;
        $scope.selection.autoExtract = undefined;
        $scope.selection.autoStart = undefined;
        $scope.selection.deepDecrypt = undefined;
        $scope.selection.overwritePackagizer = undefined;
      }, 0);
    };

    $scope.autoFillOptionalValues = function (checkIfActive) {
      if (checkIfActive && !$scope.selection.autoFill) {
        return;
      }
      $timeout(function () {
        if ($scope.selection.device && $scope.history) {
          $scope.selection.saveto = setIfUndefined(
            $scope.selection.saveto,
            $scope.history.saveto[0]
          );
          $scope.selection.packageName = setIfUndefined(
            $scope.selection.packageName,
            $scope.history.packageName[0]
          );
          $scope.selection.archivepw = setIfUndefined(
            $scope.selection.archivepw,
            $scope.history.archivepw[0]
          );
          $scope.selection.downloadpw = setIfUndefined(
            $scope.selection.downloadpw,
            $scope.history.downloadpw[0]
          );
          if ($scope.history.priority) {
            $scope.selection.priority = $scope.history.priority;
          }
        }

        if ($scope.optionsHistory) {
          $scope.selection.autoExtract = setIfUndefined(
            $scope.selection.autoExtract,
            $scope.optionsHistory.autoExtract
          );
          $scope.selection.autoStart = setIfUndefined(
            $scope.selection.autoStart,
            $scope.optionsHistory.autoStart
          );
          $scope.selection.deepDecrypt = setIfUndefined(
            $scope.selection.deepDecrypt,
            $scope.optionsHistory.deepDecrypt
          );
          $scope.selection.overwritePackagizer = setIfUndefined(
            $scope.selection.overwritePackagizer,
            $scope.optionsHistory.overwritePackagizer
          );
        }
      }, 0);
    };

    $scope.autoFillDefaultValues = function () {
      $scope.clearAllOptionalValues();
      $timeout(function () {
        restoreDefaultValues();
      }, 0);
    };

    function setIfUndefined(variable, value) {
      return variable === undefined ? value : variable;
    }

    function sendAddLinkQueries(addLinksQueries, callback) {
      if (addLinksQueries.length > 0) {
        var deviceClient = myjdDeviceClientFactory.get($scope.selection.device);
        var result = deviceClient.sendRequest("/linkgrabberv2/addLinks", JSON.stringify(addLinksQueries[0]));
        if (!result || typeof result.done !== 'function') {
          $timeout(function () {
            $scope.state.sending.state = $scope.requestStates.ERROR;
            $scope.state.errorMessage = "API not connected. Please log in again.";
            $scope.state.sending.log = "API not connected";
          }, 0);
          return;
        }
        result
          .done(function () {
            addLinksQueries.splice(0, 1);
            sendAddLinkQueries(addLinksQueries, callback);
          })
          .fail(function (e) {
            $timeout(function () {
              $scope.state.sending.state = $scope.requestStates.ERROR;
              if (e !== undefined) {
                $scope.state.errorMessage = JSON.stringify(e);
                $scope.state.sending.log = JSON.stringify(e);
              }
            }, 0);
          });
      } else if (callback) {
        callback();
      }
    }

    function sendCnlQueries(cnlQueries, callback) {
      if (cnlQueries.length > 0) {
        var deviceClient = myjdDeviceClientFactory.get($scope.selection.device);
        var result = deviceClient.sendRequest("/linkgrabberv2/addLinks", JSON.stringify({ links: cnlQueries[0].links }));
        if (!result || typeof result.done !== 'function') {
          $timeout(function () {
            $scope.state.sending.state = $scope.requestStates.ERROR;
            $scope.state.sending.log = "API not connected";
          }, 0);
          return;
        }
        result
          .done(function () {
            cnlQueries.splice(0, 1);
            sendCnlQueries(cnlQueries, callback);
          })
          .fail(function (e) {
            $timeout(function () {
              $scope.state.sending.state = $scope.requestStates.ERROR;
              $scope.state.sending.log = JSON.stringify(e);
            }, 0);
          });
      } else if (callback) {
        callback();
      }
    }

    var successClose = function (idsToRemove) {
      $timeout(function () {
        $scope.state.sending.state = $scope.requestStates.SUCCESS;
        $scope.$emit(requestQueueEventService.Events.HIDE_REQUEST_QUEUE);
      }, 0);
      $timeout(function () {
        $scope.$emit(
          requestQueueEventService.Events.ADD_LINKS_DIALOG_CLOSE,
          idsToRemove
        );
      }, 0);
    };

    $scope.send = function (device) {
      if (device !== undefined) {
        $scope.selection.device = device;
      }
      if ($scope.selection.device === undefined) {
        $scope.selection.device = $scope.SaveForLaterDevice;
      }
      if ($scope.state.sending.state === $scope.requestStates.RUNNING) {
        return;
      }
      if ($scope.selection.device.id === $scope.SaveForLaterDevice.id) {
        saveOptionsAndHistory(function () {
          addRequestsToSaveForLater($scope.requests, function () {
            $scope.clearAllOptionalValues();
            $scope.state.sending.state = $scope.requestStates.SUCCESS;
            successClose([]);
          });
        });
      } else {
        $timeout(function () {
          $scope.state.sending.state = $scope.requestStates.RUNNING;
        }, 0);

        var addLinksQueries = [];
        var cnlQueries = [];

        $.each($scope.requests, function (index, request) {
          var query = {};

          if ($scope.selection.comment !== undefined) {
            query.comment = $scope.selection.comment;
          }
          if ($scope.selection.saveto !== undefined) {
            query.destinationFolder = $scope.selection.saveto;
          }
          if ($scope.selection.archivepw !== undefined) {
            query.extractPassword = $scope.selection.archivepw;
          }
          if ($scope.selection.downloadpw !== undefined) {
            query.downloadPassword = $scope.selection.downloadpw;
          }
          if ($scope.selection.deepDecrypt !== undefined) {
            query.deepDecrypt = $scope.selection.deepDecrypt;
          }
          if ($scope.selection.autoExtract !== undefined) {
            query.autoExtract = $scope.selection.autoExtract;
          }
          if ($scope.selection.autoStart !== undefined) {
            query.autostart = $scope.selection.autoStart;
          }
          if ($scope.selection.priority !== undefined) {
            query.priority = $scope.selection.priority.value;
          }
          if ($scope.selection.packageName !== undefined) {
            query.packageName = $scope.selection.packageName;
          }
          if ($scope.selection.overwritePackagizer !== undefined) {
            query.overwritePackagizerRules =
              $scope.selection.overwritePackagizer;
          }

          if (request.type === "cnl") {
            if (
              request.content.requestBody &&
              request.content.requestBody.formData
            ) {
              var data = request.content.requestBody.formData;

              var genericDummyCnl = Object.create(null);
              for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value) && value[0] !== undefined) {
                  genericDummyCnl[key] = value[0];
                } else {
                  genericDummyCnl[key] = value;
                }
              }

              var hexDummyCnl = CryptoJS.enc.Utf8.parse(
                JSON.stringify(genericDummyCnl)
              ).toString(CryptoJS.enc.Hex);
              var dummyCnlUrl =
                "https://dummycnl.jdownloader.org/#" +
                encodeURIComponent(hexDummyCnl);
              query.links = dummyCnlUrl;
            }

            if (request.content.url !== undefined) {
              query.sourceUrl = request.content.url;
            }
            if (request.parent.url !== undefined) {
              query.sourceUrl = request.parent.url;
            }
            if (request.content.source !== undefined) {
              query.sourceUrl = request.content.source;
            }
            if (request.content.urls !== undefined) {
              query.links = query.links + "\r\n" + request.content.urls;
            }
            if (request.content.passwords !== undefined) {
              if (query.downloadPassword !== undefined) {
                query.downloadPassword = query.downloadPassword
                  .concat(request.content.passwords)
                  .join(" ");
              } else {
                query.downloadPassword =
                  request.content.passwords != null &&
                  $.isArray(request.content.passwords)
                    ? request.content.passwords.join(" ")
                    : "";
              }
            }
            query.permission = true;
            addLinksQueries.push(query);
          } else if (request.type === "text" || request.type === "link") {
            query.links = "";
            if (request.previewText) {
              query.links = request.previewText + "\n\n";
            }
            query.links += request.content;

            if (request.parent.url !== undefined) {
              query.sourceUrl = request.parent.url;
            }
            addLinksQueries.push(query);
          }
        });

        saveOptionsAndHistory(function () {
          if (addLinksQueries.length > 0 || cnlQueries.length > 0) {
            var requestsState = {
              ADD_LINKS:
                addLinksQueries.length > 0
                  ? $scope.requestStates.RUNNING
                  : $scope.requestStates.SUCCESS,
              CNL:
                cnlQueries.length > 0
                  ? $scope.requestStates.RUNNING
                  : $scope.requestStates.SUCCESS,
            };

            var donecallback = function () {
              var idsToRemove = [];
              if ($scope.selection.removeAfterSend) {
                $.each($scope.requests, function (index, request) {
                  idsToRemove.push(request.id);
                });
              }

              successClose(idsToRemove);
            };

            if (cnlQueries.length > 0) {
              sendCnlQueries(cnlQueries, function () {
                requestsState.CNL = $scope.requestStates.SUCCESS;
                if (requestsState.ADD_LINKS !== $scope.requestStates.RUNNING) {
                  donecallback();
                }
              });
            }
            if (addLinksQueries.length > 0) {
              sendAddLinkQueries(addLinksQueries, function () {
                requestsState.ADD_LINKS = $scope.requestStates.SUCCESS;
                if (requestsState.CNL !== $scope.requestStates.RUNNING) {
                  donecallback();
                }
              });
            }
          }
        });
      }
    };

    function addRequestsToSaveForLater(requests, callback) {
      storageService.get(storageService.CLIPBOARD_HISTORY, function (result) {
        if (!result.CLIPBOARD_HISTORY) {
          result.CLIPBOARD_HISTORY = {};
        }

        $.each(requests, function (index, value) {
          result.CLIPBOARD_HISTORY[value.id] = value;
        });

        storageService.set(
          storageService.CLIPBOARD_HISTORY,
          result.CLIPBOARD_HISTORY,
          function () {
            if (callback) {
              callback();
            }
          }
        );
      });
    }

    $scope.translatedPriority = function (prio) {
      return ExtensionI18nService.getMessage(
        "ui_add_links_prio_" + prio.toLowerCase()
      );
    };

    $scope.$on(
      "$destroy",
      function () {
        if (loadingIndicatorTimeout) {
          $timeout.cancel(loadingIndicatorTimeout);
        }
        if ($scope.connectionSubscription) {
          $scope.connectionSubscription.dispose();
          delete $scope.connectionSubscription;
        }
      }.bind(this)
    );
  },
]);
