"use strict";

angular.module('myjdWebextensionApp')
    .service('ExtensionMessagingService', ['$q', function ($q) {
        var listeners = Object.create(null);

        this.sendMessage = function (msgName, msgAction, msgData) {
            var promise = $q(function (resolve, reject) {
                try {
                    var message = Object.create(null);
                    if (msgName !== undefined) {
                        message.name = msgName;
                    } else {
                        reject("msgName missing");
                    }

                    if (msgAction !== undefined) {
                        message.action = msgAction;
                    }
                    if (msgData !== undefined) {
                        message.data = msgData;
                    }

                    chrome.runtime.sendMessage(
                        message,
                        function (response) {
                            if (chrome.runtime.lastError != null &&
                                chrome.runtime.lastError.message.indexOf("Promised response from onMessage listener went out of scope") === -1) {
                                console.log(chrome.runtime.lastError.message);
                            }
                            if (response !== undefined && response.error !== undefined) {
                                if (response !== undefined && response.error !== undefined) {
                                    reject(response.error);
                                } else {
                                    reject();
                                }
                            } else {
                                resolve(response);
                            }
                            return true; // needs to return true to prevent port from being closed
                        });
                } catch (e) {
                    reject(e);
                }
            });
            promise.catch(function (e) {
                console.error("ExtensionMessagingService: Failed to send message " + JSON.stringify(e));
            });
            return promise;
        };

        this.addListener = function (msgName, msgAction, callback) {
            var _msgAction = msgAction;
            var _callback = callback;
            if (msgAction !== undefined && typeof msgAction === "function") {
                _callback = msgAction;
                _msgAction = undefined;
            }
            _addListener(msgName, _msgAction, _callback);
        };

        function _addListener(msgName, msgAction, callback) {
            if (msgName !== undefined && callback !== undefined && typeof callback === "function") {
                var msgAction = msgAction === undefined ? "_all" : msgAction;
                if (listeners[msgName] === undefined) {
                    listeners[msgName] = {};
                }
                if (listeners[msgName][msgAction] == undefined) {
                    listeners[msgName][msgAction] = [callback]
                } else {
                    listeners[msgName][msgAction].push(callback);
                }
            }
        }

        this.removeListener = function (msgName, msgAction, callback) {
            if (msgName !== undefined) {
                var msgAction = msgAction === undefined ? "_all" : msgAction;
                if (listeners[msgName][msgAction] !== undefined) {
                    $.each(listeners, function (index, listener) {
                        if (listener === callback || listener === undefined) {
                            listeners[msgName][msgAction] = listeners[msgName][msgAction].splice(index, 1);
                        }
                    });
                }
            }
        };

        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {
                if (request.name) {
                    var msgAction = request.action === undefined ? "_all" : request.action;
                    if (listeners[request.name]) {
                        var callbacks = listeners[request.name][msgAction];
                        if (callbacks !== undefined) {
                            $.each(callbacks, function (index, callback) {
                                if (callback === undefined) {
                                    listeners[request.name][msgAction] = listeners[request.name][msgAction].splice(index, 1);
                                } else {
                                    try {
                                        callback(request, sender, sendResponse);
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                            })
                        }
                    }
                }
                return true;
            });
    }]);
