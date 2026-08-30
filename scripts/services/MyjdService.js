'use strict';

angular.module('myjdWebextensionApp')
    .service('MyjdService', ['$q', '$http', 'ApiErrorService', 'StorageService', 'ExtensionMessagingService',
        function ($q, $http, ApiErrorService, StorageService, ExtensionMessagingService) {

            this.CONNECTION_STATES = {
                CONNECTING: "CONNECTING",
                CONNECTED: "CONNECTED",
                DISCONNECTED: "DISCONNECTED",
                RECONNECTING: "RECONNECTING"
            };

            this.LOCAL_STORAGE_KEY = "jdapi/src/core/core.js";
            this.CREDS_STORAGE_KEY = "myjd_creds";
            this.SESSION_STORAGE_KEY = "myjd_session";
            var myjdService = this;
            this.api = null;
            this.lastConnectionState = -1;

            this.isConnected = function () {
                return myjdService.lastConnectionState === 0;
            };

            this.apiStateChanceListener = function (state) {
                if (myjdService.lastConnectionState === state) return;
                console.log("MyjdService: connection state change, new state ", state);
                myjdService.lastConnectionState = state;
                var CONNECTED_STATE = 0;
                var PENDING_STATE = 1;
                var RECONNECT_STATE = 2;
                var DISCONNECTED_STATE = 3;

                if (state === CONNECTED_STATE) {
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.CONNECTED));
                    myjdService.persistSession();
                    chrome.runtime.sendMessage({
                        name: "myjd-toolbar",
                        action: "CONNECTION_STATE_CHANGE",
                        data: myjdService.CONNECTION_STATES.CONNECTED
                    }, function () {
                        if (chrome.runtime.lastError != null && chrome.runtime.lastError.message != null) console.log(chrome.runtime.lastError.message);
                    });
                } else if (state === RECONNECT_STATE) {
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.RECONNECTING));
                } else if (state === DISCONNECTED_STATE) {
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.DISCONNECTED));
                    ExtensionMessagingService.sendMessage("myjd-toolbar", "session-change", { isLoggedIn: false });
                    myjdService.clearSession();
                } else if (state === PENDING_STATE) {
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.CONNECTING));
                }
            };

            this.apiConnectionObserver = new Rx.BehaviorSubject();
            this.apiDeviceListObserver = new Rx.BehaviorSubject();

            this.getConnectionObservable = function () {
                return myjdService.apiConnectionObserver;
            };

            this.getDeviceListObservable = function () {
                return myjdService.apiDeviceListObserver;
            };

            this.persistSession = function() {
                if (myjdService.api && myjdService.api.jdAPICore && myjdService.api.jdAPICore.options) {
                    var sessionData = JSON.stringify(myjdService.api.jdAPICore.options);
                    StorageService.set(myjdService.SESSION_STORAGE_KEY, sessionData);
                    localStorage.setItem(myjdService.LOCAL_STORAGE_KEY, sessionData);
                }
            };

            this.clearSession = function() {
                StorageService.set(myjdService.SESSION_STORAGE_KEY, null);
                localStorage.removeItem(myjdService.LOCAL_STORAGE_KEY);
            };

            this.restoreSession = function(callback) {
                StorageService.get(myjdService.SESSION_STORAGE_KEY, function(result) {
                    var sessionData = null;
                    if (result && result[myjdService.SESSION_STORAGE_KEY]) {
                        sessionData = result[myjdService.SESSION_STORAGE_KEY];
                        localStorage.setItem(myjdService.LOCAL_STORAGE_KEY, sessionData);
                    }
                    if (callback) callback(sessionData);
                });
            };

            this.disconnect = function () {
                return $q(function (resolve, reject) {
                    if (!myjdService.api) {
                        resolve();
                        return;
                    }
                    myjdService.api.disconnect().done(function () {
                        myjdService.clearSession();
                        resolve();
                    }).fail(reject);
                });
            };

            this.connect = function (credentials, forceReinit) {
                return $q(function (resolve, reject) {
                    // Try to restore session first if no credentials provided
                    if (!credentials && !forceReinit) {
                        myjdService.restoreSession(function(sessionData) {
                            if (sessionData) {
                                internalConnect(null, resolve, reject);
                            } else {
                                resolve(); // No session to restore
                            }
                        });
                    } else {
                        internalConnect(credentials, resolve, reject);
                    }
                });
            };

            function internalConnect(credentials, resolve, reject) {
                var API_CONSTRUCTOR = window.API || window.jdapi;
                if (typeof API_CONSTRUCTOR === 'undefined') {
                    console.error('MyjdService: API constructor not found on window');
                    reject(new Error('API not available'));
                    return;
                }

                if (!myjdService.api) {
                    myjdService.api = new API_CONSTRUCTOR({
                        API_ROOT: "https://api.jdownloader.org",
                        APP_KEY: "myjd_webextension_chrome"
                    });
                    myjdService.api.addAPIStateChangeListener(myjdService.apiStateChanceListener);
                }

                var creds = {};
                if (credentials && credentials.email && credentials.password) {
                    creds = { email: credentials.email, pass: credentials.password };
                }

                myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.CONNECTING));

                myjdService.api.connect(creds).done(function (data) {
                    myjdService.persistSession();
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.CONNECTED));
                    resolve();
                }).fail(function (e) {
                    myjdService.apiConnectionObserver.onNext(createObservableValue(myjdService.CONNECTION_STATES.DISCONNECTED, ApiErrorService.createApiError(e)));
                    reject(ApiErrorService.createApiError(e));
                });
            }

            this.getDeviceList = function () {
                return $q(function (resolve, reject) {
                    if (!myjdService.api) {
                        reject(new Error("API not initialized"));
                        return;
                    }
                    myjdService.api.listDevices().done(function (data) {
                        resolve(createObservableValue(data));
                    }).fail(function (e) {
                        reject(ApiErrorService.createApiError(e));
                    });
                });
            };

            this.whoami = function () {
                if (!this.api || !this.api.jdAPICore) return null;
                try {
                    return this.api.jdAPICore.getCurrentUser().name;
                } catch (e) {
                    return null;
                }
            };

            this.send = function (deviceId, call, params) {
                if (!this.api) return;
                this.api.setActiveDevice(deviceId);
                return this.api.send(call, params);
            };

            function createObservableValue(result, error) {
                return { result: result, error: error };
            }

            // Init call moved to connect() pattern to avoid race conditions
            myjdService.connect();
        }])
    ;
