'use strict';

angular.module('myjdWebextensionApp')
  .controller('ClipboardHistoryCtrl', ['$scope', 'myjdClientFactory', 'ApiErrorService', '$timeout', 'RequestQueueEventService', 'StorageService', 'ClipboardHistoryService', function ($scope, myjdClientFactory, apiErrorService, $timeout, requestQueueEventService, storageService, clipboardHistoryService) {
    $scope.views = {
      CLIPBOARD_HISTORY: "CLIPBOARD_HISTORY",
      ADD_LINKS_DIALOG: "ADD_LINKS_DIALOG"
    };
    $scope.state = {};
    $scope.history = {};
    $scope.selection = {};
    $scope.type = clipboardHistoryService.ITEM_TYPE;
    $scope.viewState = {current: $scope.views.CLIPBOARD_HISTORY};

    function init() {
      reloadHistory();
    }

    function reloadHistory() {
      storageService.get(storageService.CLIPBOARD_HISTORY, function (result) {
        $timeout(function () {
          if (result.CLIPBOARD_HISTORY) {
            $.each(result.CLIPBOARD_HISTORY, function (index, entry) {
              if (entry.deleted) {
                delete result.CLIPBOARD_HISTORY[entry.id];
              }
            });
            $scope.history = result.CLIPBOARD_HISTORY;
          }
        }, 0);
      });
    }

    $scope.removeHistoryItem = function (historyItem) {
      var action = {
        startTimeout: function () {
          var action = this;
          action.promise = $timeout(function () {
            $timeout(function () {
              delete $scope.undoableAction;
            }, 0);
          }, 5000);
        },
        restorable: [],
        action: function () {
          var actionScope = this;
          $timeout(function () {
            if ($scope.history[historyItem.id]) {
              var newHistory = $scope.history;
              actionScope.restorable.push(historyItem);
              newHistory[historyItem.id].deleted = true;
              $scope.history = newHistory;
            }
            $scope.selection = {};
            storageService.set(storageService.CLIPBOARD_HISTORY, $scope.history, function (success) {
              // nothing to do
            });
          }, 0);
        },
        undoAction: function () {
          var action = this;
          $timeout(function () {
            $.each(action.restorable, function (index, value) {
              $scope.history[value.id] = value;
              $scope.history[value.id].deleted = false;
            });
            storageService.set(storageService.CLIPBOARD_HISTORY, $scope.history, function (success) {
              // nothing to do
            });
          }, 0);
        }
      };
      executeUndoableAction(action);
    };

    $scope.clearSelection = function () {
      $timeout(function () {
        $scope.selection = {};
      }, 0);
    };

    init();

    $scope.toggleAddLinksDialog = function () {
      $scope.viewState.current = $scope.viewState.current === $scope.views.CLIPBOARD_HISTORY ? $scope.views.ADD_LINKS_DIALOG : $scope.views.CLIPBOARD_HISTORY;
    };

    $scope.undo = function () {
      $timeout(function () {
        $timeout.cancel($scope.undoableAction.promise);
        $scope.undoableAction.undoAction();
        delete $scope.undoableAction;
      }, 0);
    };

    function executeUndoableAction(action) {
      if ($scope.undoableAction && $scope.undoableAction.promise) {
        $timeout.cancel($scope.undoableAction.promise);
      }
      $scope.undoableAction = action;
      $scope.undoableAction.action();
      $scope.undoableAction.startTimeout();
    }

    $scope.createPreviewText = function (text) {
      return $("<div>" + text + "</div>").text();
    };

    $scope.isClipboardHistoryEmpty = function () {
      return $scope.historyToArray().length == 0;
    };

    $scope.nullFilter = function (item) {
      return item !== null;
    };

    $scope.isSelectionActive = function () {
      var result = false;
      $.each($scope.selection, function (key, value) {
        if (value) {
          result = true;
          return false;
        }
      });
      return result;
    };

    $scope.selectionCount = function () {
      var result = 0;
      $.each($scope.selection, function (key, value) {
        if (value) {
          result++;
        }
      });
      return result;
    };

    $scope.deleteSelected = function () {
      $scope.undoableAction = {
        startTimeout: function () {
          var action = this;
          action.promise = $timeout(function () {
            $timeout(function () {
              delete $scope.undoableAction;
            }, 0);
          }, 3000);
        },
        restorable: [],
        action: function () {
          var actionScope = this;
          $timeout(function () {
            var newHistory = $scope.history;
            $.each($scope.selection, function (index, value) {
              if (value === true) {
                actionScope.restorable.push(newHistory[index]);
                newHistory[index].deleted = true;
              }
            });
            $scope.history = newHistory;
            $scope.selection = {};
            storageService.set(storageService.CLIPBOARD_HISTORY, $scope.history, function (success) {
              // nothing to do
            });
          }, 0);
        },
        undoAction: function () {
          var action = this;
          $timeout(function () {
            $.each(action.restorable, function (index, value) {
              $scope.history[value.id].deleted = false;
            });
            storageService.set(storageService.CLIPBOARD_HISTORY, $scope.history, function (success) {
              // nothing to do
            });
          }, 0);
        }
      };
      $scope.undoableAction.action();
      $scope.undoableAction.startTimeout();
    };

    $scope.deselectAll = function () {
      $timeout(function () {
        $.each($scope.history, function (index, historyItem) {
          $scope.selection[historyItem.id] = false;
        });
      }, 0);
    };

    $scope.selectAll = function () {
      $timeout(function () {
        $.each($scope.history, function (index, historyItem) {
          if ($scope.history[historyItem.id] != null && $scope.history[historyItem.id].deleted !== true) {
            $scope.selection[historyItem.id] = true;
          }
        });
      }, 0);
    };

    $scope.selectHistoryItem = function (key) {
      $timeout(function () {
        if ($scope.selection[key] && $scope.selection[key].delete !== true) {
          $scope.selection[key] = true;
        }
      }, 0);
    };

    $scope.deselectHistoryItem = function (key) {
      $timeout(function () {
        $scope.selection[key] = false;
      }, 0);
    };

    $scope.toggleSelectionHistoryItem = function (key) {
      $timeout(function () {
        $scope.selection[key] = !$scope.selection[key];
      }, 0);
    };

    chrome.runtime.sendMessage({
      name: "myjd-toolbar",
      action: "get-clipboard-history"
    }, function (response) {
      $timeout(function () {
        if (response && response.data) {
          $scope.state.requestQueue = response.data;
        } else {
          $scope.state.requestQueue = [];
        }
      }, 300);
    });

    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (changes.CLIPBOARD_HISTORY && changes.CLIPBOARD_HISTORY.newValue) {
        $timeout(function () {
          $scope.history = changes.CLIPBOARD_HISTORY.newValue;
          $.each($scope.selection, function (index, value) {
            if (!$scope.history[index]) {
              delete $scope.selection[index];
            }
          });
          $scope.$broadcast(requestQueueEventService.Events.REQUEST_QUEUE_CHANGED, $scope.history);
        }, 0);
      }
    });

    $scope.$on(requestQueueEventService.Events.ADD_LINKS_DIALOG_CLOSE, function (event, idsToRemove) {
      removeRequests(idsToRemove);
      $scope.viewState.current = $scope.views.CLIPBOARD_HISTORY;
      $scope.clearSelection();
    });

    function removeRequests(ids) {
      storageService.get(storageService.CLIPBOARD_HISTORY, function (result) {
        $.each(ids, function (index, requestid) {
          delete result.CLIPBOARD_HISTORY[requestid];
        });
        storageService.set(storageService.CLIPBOARD_HISTORY, result.CLIPBOARD_HISTORY, function () {
          // Nothing to do
        });
      });
    }

    $scope.historyToArray = function () {
      var result = [];
      if (!$scope.history) return result;
      $.each($scope.history, function (index, item) {
        if (!item.deleted) {
          result.push(item);
        }
      });
      return result;
    };

    $scope.invalidateSelectionHeaderPosition = function () {
      var fromTop = $(window).scrollTop();
      if (fromTop > 0) {
        $scope.isScrolled = true;
        $("#selectionheader").css({'top': '0px'});
      } else {
        $scope.isScrolled = false;
        $("#selectionheader").css({'top': '30px'});
      }
    };

    $scope.selectionToArray = function () {
      var result = [];
      $.each($scope.selection, function (index, item) {
        if (item === true && $scope.history[index]) {
          result.push($scope.history[index]);
        }
      });
      return result;
    };

    $(window).scroll(function () {
      $scope.invalidateSelectionHeaderPosition();
    });

  }
  ]);
