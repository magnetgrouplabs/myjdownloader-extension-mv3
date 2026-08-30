/*
 MyJDownloader API Javascript Client Library
 - - -
 @version 1.0.1
 @author AppWork GmbH

 Dependencies:
 - jQuery
 - CryptoJS (core, hmac-sha256, aes)
 - requirejs

 (c) 2013-2015 by AppWork GmbH. All rights reserved.
 */

define("coreCrypto", [],function () {
	/**
	 * Extend CryptoJS with function to split WordArray
	 */
	CryptoJS.lib.WordArray.firstHalf = function () {
		if (!this._firstHalf) {
			this._firstHalf = new CryptoJS.lib.WordArray.init(this.words.slice(0, this.words.length / 2));
		}
		return this._firstHalf;
	};
	CryptoJS.lib.WordArray.secondHalf = function () {
		if (!this._secondHalf) this._secondHalf = new CryptoJS.lib.WordArray.init(this.words
			.slice(this.words.length / 2, this.words.length));
		return this._secondHalf;
	};
	return CryptoJS;
});
define("coreCryptoUtils",["coreCrypto"], function(CoreCrypto) {
	/**
	 * Utility Object for cryptography functions
	 */
	var CryptoUtils = {
		/* hash a password with the given pass and domain as salt */
		hashPassword: function(email, pass, domain) {
			return CoreCrypto.SHA256(CoreCrypto.enc.Utf8.parse(email.toLowerCase() + pass + domain.toLowerCase()));
		},
		/* convert pass to secret hashes and delete it afterwards */
		processPassword: function(options) {
			if (!options.email || !options.pass) {
				throw "processPassword requires set options.email and options.pass";
			}

			options.loginSecret = this.hashPassword(options.email, options.pass, "server");
			options.deviceSecret = this.hashPassword(options.email, options.pass, "device");
			delete options.pass;
		},
		/* initialise the tokens after a successful handshake or update tokens after a reconnect */
		initialiseConnection: function(options, sessiontoken, regaintoken) {
			if (!options.loginSecret && !options.serverEncryptionToken) {
				throw "either loginSecret or serverEncryptionToken must be set, probably should call processPassword(options) first";
			} else if(!options.deviceSecret){
				throw "deviceSecret not set";
			} else if(!sessiontoken || !regaintoken){
				throw "sessiontoken and regaintoken are required to initialise connection";
			}
			options.sessiontoken = sessiontoken;
			options.regaintoken = regaintoken;

			var ses = CoreCrypto.enc.Hex.parse(options.sessiontoken);
			if (options.loginSecret) {
				// calculate initial secret
				var tot = options.loginSecret.concat(ses);
				// keep old token to decrypt requests that got sent before a reconnect
				options.serverEncryptionTokenOld = options.serverEncryptionToken;
				options.serverEncryptionToken = CoreCrypto.SHA256(tot);
				delete options.loginSecret;
			} else {
				// calculate new secret
				options.serverEncryptionTokenOld = options.serverEncryptionToken;
				var tot = options.serverEncryptionToken.concat(ses);
				options.serverEncryptionToken = CoreCrypto.SHA256(tot);
			}

			var deviceSecret = options.deviceSecret.clone();
			var totDev = deviceSecret.concat(ses);
			// keep old device encryption token for decrypting old
			// requests after reconnect
			options.deviceEncryptionTokenOld = options.deviceEncryptionToken;
			// set new device encryption token
			options.deviceEncryptionToken = CoreCrypto.SHA256(totDev);
		},
		/*
		 * @param secret: CoreCrypto.lib.WordArray used as secret
		 * @param plain: the JSON object to encrypt
		 */
		encryptJSON: function (secret, plain, rsaPublicKey) {
            if (!secret) {
				var result = {"data": plain};
				return result;
            }

			var iv;
			var key;
			if (rsaPublicKey) {
				var keySize = 32; // AES256
				var cryptoObj = window.crypto || window.msCrypto;
				if (Uint8Array && cryptoObj && cryptoObj.getRandomValues) {
					try {
						iv = new Uint8Array(16);
						key = new Uint8Array(keySize);
						cryptoObj.getRandomValues(iv);
						cryptoObj.getRandomValues(key);

						// No WordArray constructor that takes Uint8Array, thus Hex as intermediate (Uint8Array -> Hex String -> WordArray)
						var ivHex = this.ua2hex(iv);
						var keyHex = this.ua2hex(key);
						iv = CryptoJS.enc.Hex.parse(ivHex);
						key = CryptoJS.enc.Hex.parse(keyHex);
					} catch (exception) {
						// Browser failed to do his job
					}
				}
				if (!(iv && key)) {
					// we still need keys
					iv = CoreCrypto.lib.WordArray.random(16);
					key = CoreCrypto.lib.WordArray.random(keySize);
				}
			} else {
				iv = secret.firstHalf();
				key = secret.secondHalf();
			}

			var aesEncrypted = CoreCrypto.AES.encrypt(JSON.stringify(plain), key, {
				mode: CoreCrypto.mode.CBC,
				iv: iv
			});

			var result = {};

			if (rsaPublicKey) {
				var encrypt = new JSEncrypt();
				encrypt.setPublicKey(rsaPublicKey);
				var stringHexIv = CryptoJS.enc.Hex.stringify(iv);
				var stringHexKey = CryptoJS.enc.Hex.stringify(key);
				var rsaEncrypted = encrypt.encrypt(stringHexIv + stringHexKey);
				result["rsa"] = rsaEncrypted;
				result["contentType"] = "application/rsajson; charset=utf-8";
				result["iv"] = iv;
				result["key"] = key;
				// Delimiter between rsa key and aes encrypted content is |
				result["data"] = rsaEncrypted + "|" + aesEncrypted.toString();
			} else {
				result["contentType"] = "application/aesjson; charset=utf-8";
				result["iv"] = secret.firstHalf();
				result["key"] = secret.secondHalf();
				result["data"] = aesEncrypted.toString();
			}
			return result;
		},
		ua2hex: function (ua) {
			// Converts Uint8Array to Hex String
			var h = '';
			for (var i = 0; i < ua.length; i++) {
				var temp = ua[i].toString(16);
				if (temp.length < 2) {
					temp = "0" + temp;
				}
				h += temp;
			}
			return h;
		},
		decryptJSON: function (iv, key, encrypted) {
			try {
				var plain = null;
				var plain_raw = CoreCrypto.AES.decrypt(encrypted, key, {
					mode: CoreCrypto.mode.CBC,
					iv: iv
				}).toString(CoreCrypto.enc.Utf8);
				if (plain_raw && typeof plain_raw === "string") {
					plain = JSON.parse(plain_raw);
				}
				return plain;
			} catch (e) {
				return encrypted;
			}
		},

		decryptRsaJSON: function (rsaIv, rsaKey, encrypted) {
			var jsEncrypt = new JSEncrypt();
			jsEncrypt.setPrivateKey(rsaIv + rsaKey);
			var rsaDecrypted = jsEncrypt.decrypt(encrypted);
			try {
				return this.decryptJSON(rsaDecrypted.token.firstHalf(), rsaDecrypted.token.secondHalf(), rsaDecrypted.data);
			} catch (e) {
				return encrypted;
			}
		}

	};


	return CryptoUtils;
});
define("coreRequest", ["coreCrypto", "coreCryptoUtils"], function (CoreCrypto, CryptoUtils) {

    /**
     * Static variables and functions
     */
    var requestCount = 0;

    var processOptions = function (options) {
        // SERVER_CALL
        // TODO: options.jdAction should be absolute e.g. /my/feedback vs. /feedback
        // if URL params are included build querystring with
        // sessiontoken and signature
        if (options.jdParams) {
            if (options.serverEncryptionToken !== undefined) {
                options = addConverters(options, options.serverEncryptionToken.firstHalf(), options.serverEncryptionToken.secondHalf());
            }
            if (options.type === "GET") {
                var queryString = options.jdAction + "?sessiontoken=" + options.sessiontoken + "&rid=" + options.rid + "&" + $.param(options.jdParams);
            } else {
                if (options.serverEncryptionToken) {
                    options.contentType = "application/json; charset=utf-8";
                    var queryString;
                    var unencrypted;
                    if (options.jdAction === "requestterminationemail") {
                        queryString = "/my/" + options.jdAction + "?sessiontoken=" + options.sessiontoken + "&" + $
                            .param(options.jdParams) + "&rid=" + options.rid;
                    } else {
                        queryString = options.jdAction + "?sessiontoken=" + options.sessiontoken + "&rid=" + options.rid;
                        unencrypted = {
                            "apiVer": 1,
                            "params": [],
                            "url": queryString,
                            "rid": options.rid
                        };

                        if (JSON.stringify(options.jdParams) !== "{}") {
                            // Do net send empty param
                            unencrypted.params = [options.jdParams];
                        }

                        var encryptedJSON = CryptoUtils.encryptJSON(options.serverEncryptionToken, unencrypted);
                        // server expects application/json 26.06.2017 TODO add support for application/aesjson server side
                        encryptedJSON.contentType = "application/json; charset=UTF-8";
                        options.data = encryptedJSON.data;
                        options.contentType = encryptedJSON.contentType;
                        options = addConverters(options, encryptedJSON.iv, encryptedJSON.key);

                        queryString += "&signature=" + CoreCrypto
                            .HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), options.serverEncryptionToken)
                            .toString(options.TRANSFER_ENCODING);
                    }
                    options.url = options.API_ROOT + queryString;
                } else {
                    logger.error("[MYJD] [JSAPI] [REQUEST] [FAILED] Server encryption token missing. Action: " + JSON.stringify(options ? options.jdAction : "NO_ACTION"));
                }
            }

        } else {
            if (options.deviceEncryptionToken) {
                var encryptedJSON = CryptoUtils.encryptJSON(options.deviceEncryptionToken, options.jdData, options.rsaPublicKey);
                options.contentType = encryptedJSON.contentType;
                options.data = encryptedJSON.data;
                options = addConverters(options, encryptedJSON.iv, encryptedJSON.key);
            options.url = options.API_ROOT + "/t_" + options.sessiontoken + "_" + options.deviceId + options.jdAction;
            } else {
                logger.error("[MYJD] [JSAPI] [REQUEST] [FAILED] " + JSON.stringify((options ? options.type : "NO_OPTIONS")) + " Error: Device encryption token missing!");
            }
        }
    };

    var addConverters = function (options, aesIv, aesKey) {
        options.converters = {
            "* aesjson-server": CryptoUtils.decryptJSON.bind(this, aesIv, aesKey),
            "* aesjson": CryptoUtils.decryptJSON.bind(this, aesIv, aesKey)
        };
        return options;
    };

    /**
     * Constructor for new JDAPIRequest Object
     */
    var JDAPIRequest = function (options) {

        // options.jdParams = options.jdParams || {};
        var self = this;
        /*
         * processes the options object e.g. encrypting everything
         * with the required secrets
         */
        processOptions(options);
        this.options = options;
    };
    $.extend(JDAPIRequest.prototype, {
        send: function () {
            var filter = $.Deferred();
            var self = this;
            var options = this.options;
            var apiRequest = $.ajax(this.options);

            apiRequest.done(function (response) {
                logger.log("[MYJD] [JSAPI] [REQUEST] " + JSON.stringify(options ? options.type : "NO_TYPE") + " " + JSON.stringify(options ? options.url : "NO_URL") + "\nOPTIONS:\n" + JSON.stringify(options ? options : "NO_OPTIONS") + "\n\nRESPONSE:\n" + JSON.stringify(response));
                filter.resolve(response);
            });
            apiRequest.fail(function (error) {
                try {
                    if (error.responseText !== undefined) {
                        filter.reject(JSON.parse(error.responseText));
                    } else {
                        if (error.statusText !== undefined) {
                            if (error.statusText === "error") {
                                filter.reject({
                                    type: "CONNECTION_REFUSED"
                                });
                            } else if (error.statusText === "timeout") {
                                filter.reject({
                                    type: "TIMEOUT"
                                });
                            } else {
                                filter.reject({
                                    type: "UNKNOWN_ERROR"
                                });
                            }
                        } else {
                            filter.reject({
                                type: "UNKNOWN_ERROR"
                            });
                        }
                    }
                } catch (e) {
                    filter.reject({
                        type: "UNKNOWN_ERROR"
                    });
                }
                logger.error("[MYJD] [JSAPI] [REQUEST] [FAILED] " + JSON.stringify(options ? options.type : "NO_TYPE") + " " + JSON.stringify(options ? options.url : "NO_URL") + "\nOPTIONS:\n" + JSON.stringify(options ? options : "NO_OPTIONS") + "\n\nRESPONSE:\n" + JSON.stringify(error));
            });
            return filter;
        }
    });
    return JDAPIRequest;
});
define("coreRequestHandler", ["coreCrypto", "coreCryptoUtils"], function (CoreCrypto, CryptoUtils) {
    var LOCAL_STORAGE_RECONNECT_LOCK_KEY = "jdapi/src/core/coreRequestHandler.js";
    var JDAPICoreRequestHandler = function (appKey, transferEncoding, LOCAL_STORAGE_KEY, apiRoot) {
        this.appKey = appKey;
        this.transferEncoding = transferEncoding;
        this.LOCAL_STORAGE_KEY = LOCAL_STORAGE_KEY;
        this.apiRoot = apiRoot;
    };
    $.extend(JDAPICoreRequestHandler.prototype, {
        connect: function (options) {
            var handshake = $.Deferred();
            //PERFORM LOGIN
            if (options && options.email && options.pass) {
                // Generate login secret
                CryptoUtils.processPassword(options);

                // craft query string
                var params = {};
                var action;

                params.email = options.email;
                action = "/my/connect";
                params.appkey = this.appKey;
                params.rid = 0;

                var queryString = action + "?" + $.param(params);
                queryString += "&signature=" + CoreCrypto.HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), options.loginSecret).toString(this.transferEncoding);

                // issue authentication request
                var auth = $.ajax({
                    url: this.apiRoot + queryString,
                    type: "POST",
                    async: true,
                    dataType: "aesjson-server",
                    converters: {
                        "* aesjson-server": CryptoUtils.decryptJSON.bind(this, options.loginSecret.firstHalf(),options.loginSecret.secondHalf())
                    }
                });
                // if authentication fails, reject the handshake
                auth.fail(handshake.reject);
                // if the handshake gets rejected beforehand (e.g. because of a disconnect() call), abort the authentication request
                handshake.fail(auth.abort);
                // if authentication is successful, initialize connection
                auth.done((function (data) {
                    if (data.rid !== params.rid) return handshake.reject(undefined, "replay attack");
                    CryptoUtils.initialiseConnection(options, data.sessiontoken, data.regaintoken);
                    dataStore.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(options)).then(function () {
                        handshake.resolve(options);
                    });
                }).bind(this));

                // ATTEMPT RESUME FROM LOCALSTORAGE
            } else {
                var localStorageKey = this.LOCAL_STORAGE_KEY;
                dataStore.getItem(localStorageKey).then(function (result) {
                    var restoredOptions;
                    try {
                        restoredOptions = JSON.parse(result[localStorageKey]);
                        if (!restoredOptions) {
                            handshake.reject();
                        } else {
                            options = $.extend({}, restoredOptions);
                            //Convert JSON back to CoreCrypto.lib.WordArray instance
                            if (restoredOptions.serverEncryptionToken) {
                                options.serverEncryptionToken = CoreCrypto.lib.WordArray.random(restoredOptions.serverEncryptionToken.sigBytes);
                                options.serverEncryptionToken.words = restoredOptions.serverEncryptionToken.words;
                            }
                            if (restoredOptions.deviceEncryptionToken) {
                                options.deviceEncryptionToken = CoreCrypto.lib.WordArray.random(restoredOptions.deviceEncryptionToken.sigBytes);
                                options.deviceEncryptionToken.words = restoredOptions.deviceEncryptionToken.words;
                            }
                            if (restoredOptions.deviceSecret) {
                                options.deviceSecret = CoreCrypto.lib.WordArray.random(restoredOptions.deviceSecret.sigBytes);
                                options.deviceSecret.words = restoredOptions.deviceSecret.words;
                            }
                            handshake.resolve(options);
                        }
                    } catch (e) {
                        handshake.reject();
                    }
                });
            }
            return handshake;
        },
        reconnect: function (options, rid) {
            var handshake = $.Deferred();
            var self = this;
            /*
             * ReconnectLock localStorage functionality to handle multiple browser tabs
             */
            // If lock can be acquired reconnect yourself, else wait
            // for other tab to finish reconnect
            var reconnectLock;
            dataStore.getItem(LOCAL_STORAGE_RECONNECT_LOCK_KEY).then(function (result) {
                try {
                    reconnectLock = JSON.parse(result[LOCAL_STORAGE_RECONNECT_LOCK_KEY]);
                } catch (e) {
                }
                //lock exists and is not timed out
                if (reconnectLock && (new Date().getTime() - reconnectLock.time) < 5000) {
                    // wait for reconnect
                    // listen to local storage
                    window.addEventListener('storage', function (event) {
                        if (event.key === this.LOCAL_STORAGE_KEY) {
                            if (!e.newValue) {
                                handshake.reject();
                            } else {
                                handshake.resolve();
                            }
                        }
                    }, false);
                } else {
                    //create lock
                    dataStore.setItem(LOCAL_STORAGE_RECONNECT_LOCK_KEY, JSON.stringify({
                        time: new Date().getTime()
                    })).then(function () {
                        // do the reconnect in this tab
                        // craft query string
                        var params = {};
                        var action;

                        action = "/my/reconnect";
                        params.appkey = self.appKey;
                        params.sessiontoken = options.sessiontoken;
                        params.regainToken = options.regaintoken;
                        params.rid = rid;

                        var queryString = action + "?" + $.param(params);
                        queryString += "&signature=" + CoreCrypto.HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), options.serverEncryptionToken).toString(this.transferEncoding);

                        //reconnect yourself
                        var reauth = $.ajax({
                            url: options.API_ROOT + queryString,
                            type: "POST",
                            async: true,
                            dataType: "aesjson-server",
                            converters: {
                                "* aesjson-server": CryptoUtils.decryptJSON.bind(this, options.serverEncryptionToken.firstHalf(), options.serverEncryptionToken.secondHalf())
                            }
                        });
                        // if authentication fails, reject the handshake
                        reauth.fail(handshake.reject.bind(handshake));
                        // if the handshake gets rejected beforehand (e.g. because of a disconnect() call), abort the authentication request
                        handshake.fail(reauth.abort.bind(reauth));
                        // if authentication is successful, initialize connection
                        reauth.done((function (data) {
                            CryptoUtils.initialiseConnection(options, data.sessiontoken, data.regaintoken);
                            dataStore.removeItem(LOCAL_STORAGE_RECONNECT_LOCK_KEY);
                            dataStore.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(options)).then(handshake.resolve);
                        }).bind(self));
                    });
                }
            });

            return handshake;
        },
        disconnect: function (options) {
            var params =
            {
                rid: options.rid,
                sessiontoken: options.sessiontoken
            };
            var queryString = "/my/disconnect?" + $.param(params);
            queryString += "&signature=" + CoreCrypto.HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), options.serverEncryptionToken).toString(this.transferEncoding);

            var disconnect = $.ajax({
                url: this.apiRoot + queryString,
                async: true,
                type: "POST",
                dataType: "aesjson-server",
                converters: {
                    "* aesjson-server": CryptoUtils.decryptJSON.bind(this, options.serverEncryptionToken.firstHalf(),options.serverEncryptionToken.secondHalf())
                }
            }).done((function (data) {
                if (data.rid !== options.rid) return this.connection.reject(undefined, "replay attack");
            }).bind(this));

            return disconnect;
        }
    });

    return JDAPICoreRequestHandler;
});
define("coreCore", ["coreCrypto", "coreCryptoUtils", "coreRequest", "coreRequestHandler"], function (CoreCrypto, CryptoUtils, JDAPIRequest, JDAPICoreRequestHandler) {
    "use strict";

    var TRANSFER_ENCODING = CoreCrypto.enc.Hex;
    var API_ROOT;
    if (window && window.location && window.location.protocol) {
        if (window.location.protocol === "https:" || window.location.protocol === "http:") {
            API_ROOT = window.location.protocol + "//api.jdownloader.org";
        } else if (window.location.protocol === "chrome-extension:" || window.location.protocol === "moz-extension:" || window.location.protocol === "ms-browser-extension:") {
            // default to https
            API_ROOT = "https://api.jdownloader.org"
        } else {
            throw new Error("MyJDownloader JS API: Unknown host protocol " + window.location.protocol);
        }
    } else {
        throw new Error("MyJDownloader JS API: Failed to initialize API Root");
    }

    var LOCAL_STORAGE_KEY = "jdapi/src/core/core.js";

    // API States
    var CONNECTED_STATE = 0;
    var PENDING_STATE = 1;
    var RECONNECT_STATE = 2;
    var DISCONNECTED_STATE = 3;

    /**
     * GLOBAL STATE VARIABLES
     * TODO: Not compatible with multiple JDAPICore instances as it is global singleton
     */
    var APIState = (function () {
        // Private variables
        var apiState = PENDING_STATE;
        var onChangeCallbacks = new Array();
        // Public interface
        return {
            setAPIState: function (STATE) {
                apiState = STATE;
                onChangeCallbacks.forEach(function (callback) {
                    try {
                        callback(apiState);
                    } catch (e) {
                        // console.error(e);
                    }
                });
            },
            getAPIState: function () {
                return apiState;
            },
            addAPIStateChangeListener: function (callback) {
                if (callback && typeof callback === "function") {
                    if (onChangeCallbacks.indexOf(callback) === -1) {
                        onChangeCallbacks.push(callback);
                    }
                } else {
                    throw new TypeError("APIStateChangeListener must be of type function");
                }
            }
        };
    })();
    //Default App Key
    var APP_KEY = "myjd_webextension_firefoxself_3_2_34"; //"org.jdownloader.my_web_0.1.657"

    // Global Request Queue
    var jdapiRequestQueue = new Array();
    var coreRequestHandler = new JDAPICoreRequestHandler(APP_KEY, TRANSFER_ENCODING, LOCAL_STORAGE_KEY, API_ROOT);

    // RID
    var lastrid = 0;
    var getRID = function () {
        var rid = (new Date()).getTime();
        if (lastrid === rid) {
            rid++;
        }
        lastrid = rid;
        return rid;
    };

    /**
     * Constructor for Main JDAPICore Object, that gets exported
     */
    var JDAPICore = function (options, onConnected, APP_KEY_PARAM) {
        if (APP_KEY_PARAM) APP_KEY = APP_KEY_PARAM;
        // If options object available, initialize with connect(options)
        APIState.setAPIState(PENDING_STATE);
        options = options || {};
        this.options = options;
        this.TRANSFER_ENCODING = TRANSFER_ENCODING;
        if (onConnected && $.isFunction(onConnected.promise)) {
            this.connect(this.options).then(function () {
                    //defer to next event loop event
                    setTimeout(function () {
                        onConnected.resolve();
                    }, 0);
                },
                function () {
                    //defer to next event loop event
                    setTimeout(function () {
                        onConnected.reject();
                    }, 0);
                });
        } else if (onConnected && $.isFunction(onConnected)) {
            this.connect(this.options).done(function () {
                //defer to next event loop event
                setTimeout(function () {
                    onConnected();
                }, 0);
            });
        } else {
            this.connect(this.options);
        }
        //initialize local storage listener to refresh options if reconnect happened in other browser tab
        window.addEventListener('storage', function (e) {
            if (e.key === LOCAL_STORAGE_KEY) {
                if (!e.newValue) {
                    this.disconnect();
                } else {
                    this.connect();
                }
            }
        }.bind(this), false);
    };
    $.extend(JDAPICore.prototype, {
        /**
         * Initialize Session either with given @email and @pass or with stored session
         */
        requestCount: 0,
        connect: function (options) {
            APIState.setAPIState(PENDING_STATE);
            var filter = $.Deferred();
            var connectCall = coreRequestHandler.connect(options);
            connectCall.done(function (options) {
                options.API_ROOT = API_ROOT;
                this.options = options;
                APIState.setAPIState(CONNECTED_STATE);
                this._handleEnqueuedRequestsAndSetConnected();
                filter.resolve(options);
            }.bind(this));
            connectCall.fail(function (err) {
                APIState.setAPIState(DISCONNECTED_STATE);
                filter.reject(err);
            }.bind(this));
            return filter;
        },
        getRID: getRID,
        reconnect: function () {
            var reconnectDef = $.Deferred();
            // IF RECONNECT NOT ALREADY IN PROGRESS
            if (APIState.getAPIState() == CONNECTED_STATE || APIState.getAPIState() == PENDING_STATE) {
                // START RECONNECTING
                APIState.setAPIState(RECONNECT_STATE);
                var reconnect = coreRequestHandler.reconnect(this.options, getRID());
                reconnect.done(function () {
                    this._handleEnqueuedRequestsAndSetConnected();
                }.bind(this));
                reconnect.fail(function () {
                    // FAIL FINALLY, TRIGGER LOGOUT ACTIONS ETC
                    this.disconnect();
                }.bind(this));
                reconnect.then(reconnectDef.resolve, reconnectDef.reject);
            } else {
                //RECONNECT ALREADY HAPPENING -> RESOLVE
                //TODO: Not dependent on reconnect outcome
                reconnectDef.resolve();
            }
            return reconnectDef;
        },
        disconnect: function () {
            //If already disconnected
            if (APIState.getAPIState() === DISCONNECTED_STATE) {
                var ret = $.Deferred();
                ret.resolve();
                return ret;
            }
            //Else make disconnect call
            var disconnectCall = coreRequestHandler.disconnect({
                serverEncryptionToken: this.options.serverEncryptionToken,
                sessiontoken: this.options.sessiontoken,
                rid: getRID()
            });
            disconnectCall.always(function () {
                this.options = {};
                dataStore.removeItem(LOCAL_STORAGE_KEY);
                APIState.setAPIState(DISCONNECTED_STATE);
            }.bind(this));
            return disconnectCall;
        },
        /* send request to list all available devices */
        serverCall: function (action, params, urlParams, type) {
            // Create request object
            params = params || {};
            var reqOptions = {
                jdAction: action,
                jdParams: params,
                urlParams: urlParams,
                type: type || "POST",
                dataType: "aesjson-server",
                serverEncryptionToken: this.options.serverEncryptionToken,
                TRANSFER_ENCODING: TRANSFER_ENCODING,
                API_ROOT: API_ROOT,
                sessiontoken: this.options.sessiontoken,
                rid: getRID()
            };
            // Send and return the deferred
            return this._call(reqOptions);
        },
        /* wraps jd api call in reconnect handling jQuery ajax call */
        deviceCall: function (deviceId, action, postData, rsaPublicKey, timeout) {
            postData = postData || [];
            var rID = getRID();
            var reqOptions = {
                jdAction: action,
                jdData: {
                    url: action,
                    params: postData,
                    apiVer: 1,
                    rid:rID
                },
                deviceId: deviceId,
                type: "POST",
                dataType: "aesjson-server",
                deviceEncryptionToken: this.options.deviceEncryptionToken,
                //rsaPublicKey: rsaPublicKey,
                TRANSFER_ENCODING: TRANSFER_ENCODING,
                API_ROOT: API_ROOT,
                sessiontoken: this.options.sessiontoken,
                rid:rID
            };
            if (timeout) {
                reqOptions.timeout = timeout;
            }
            return this._call(reqOptions);
        },
        /* wraps jd local call in reconnect handling jQuery ajax call */
        localDeviceCall: function (localURL, deviceId, action, postData, rsaPublicKey, timeout) {
            postData = postData || [];
            var rID = getRID();
            var reqOptions = {
                jdAction: action,
                jdData: {
                    url: action,
                    params: postData,
                    apiVer: 1,
                    rid:rID
                },
                deviceId: deviceId,
                type: "POST",
                dataType: "aesjson-server",
                deviceEncryptionToken: this.options.deviceEncryptionToken,
                //rsaPublicKey: rsaPublicKey,
                TRANSFER_ENCODING: TRANSFER_ENCODING,
                API_ROOT: localURL,
                sessiontoken: this.options.sessiontoken,
                rid: rID
            };
            if (timeout) {
                reqOptions.timeout = timeout;
            }
            return this._call(reqOptions);
        },
        getSessionToken: function () {
            return this.options.sessiontoken;
        },
        getSessionInfo: function () {
            return this.options;
        },
        addAPIStateChangeListener: function (callback) {
            APIState.addAPIStateChangeListener(callback);
        },
        getAPIState: function () {
            return APIState.getAPIState();
        },
        getAPIStatePlain: function () {
            switch (APIState.getAPIState()) {
                case 0:
                    return "CONNECTED_STATE";
                    break;
                case 1:
                    return "PENDING_STATE";
                    break;
                case 2:
                    return "RECONNECT_STATE";
                    break;
                case 3:
                    return "DISCONNECTED_STATE";
                    break;
                default:
                    return "INVALID";
            }
        },
        getCurrentUser: function () {
            return {
                loggedIn: (this.getAPIState() !== 3),
                name: this.options.email
            };
        },
        API_ROOT: API_ROOT,
        APP_KEY: APP_KEY,
        _rebuildRequestOptions: function (reqOptions) {
            if (reqOptions.deviceEncryptionToken) {
                reqOptions.deviceEncryptionToken = this.options.deviceEncryptionToken;
                reqOptions.deviceEncryptionTokenOld = this.options.deviceEncryptionTokenOld;
            }

            if (reqOptions.serverEncryptionToken) {
                reqOptions.serverEncryptionToken = this.options.serverEncryptionToken;
            }

            reqOptions.sessiontoken = this.options.sessiontoken;

            reqOptions.rid = getRID();
            return reqOptions;
        },
        _handleEnqueuedRequestsAndSetConnected: function () {
            APIState.setAPIState(CONNECTED_STATE);
            while (jdapiRequestQueue.length > 0) {
                var queuedRequest = jdapiRequestQueue.shift();
                var requestOptions = this._rebuildRequestOptions(queuedRequest.options);
                // fire async, TODO: Could fail ?!?!
                setTimeout(function () {
                    var call = this._call(requestOptions, 1);
                    call.done(queuedRequest.deferred.resolve);
                    call.fail(queuedRequest.deferred.reject);
                }.bind(this), 10);
            }
        },
        // function that either makes or enqueues the request dependent on API state
        _call: function (reqOptions, count) {
            count = count || 0;
            var def = $.Deferred();
            // IF CONNECTED, MAKE CALL!
            if (APIState.getAPIState() === CONNECTED_STATE) {
                var initialRequest = new JDAPIRequest(reqOptions).send();
                // Initial call successful, just resolve the deferred
                initialRequest.done(def.resolve);
                initialRequest.fail(function (error) {
                    if (error.type && "TOKEN_INVALID" === error.type && count === 0) {
                        jdapiRequestQueue.push({
                            deferred: def,
                            options: reqOptions
                        });
                        this.reconnect();
                    } else if (error.type && "AUTH_FAILED" === error.type) {
                        console.error("AUTH FAILED", reqOptions, " ERROR ", error);
                        def.reject(error);
                        this.disconnect();
                    } else {
                        // TODO: Probably causes disc if listen fails
                        def.reject(error);
                        // this.disconnect();
                    }
                }.bind(this));
                // IF NOT CONNECTED, ENQUEUE FOR WHEN CONNECTED
            } else {
                jdapiRequestQueue.push({
                    deferred: def,
                    options: reqOptions
                });
            }
            return def;
        }
    });
    return JDAPICore;
});
define("device",[], function() {
	/**
	 * API to handle device (device == JDownloader) calls
	 *
	 * data.rsaPublicKey
	 */
	var JDAPIDevice = function(jdAPICore, data) {
		this.jdAPICore = jdAPICore;
		this.state = "OFFLINE";
		this.deviceId = data.id;
		this.rsaPublicKey = data.rsaPublicKey;
		this.deviceName = data.name;
	};
	$.extend(JDAPIDevice.prototype, {
		call: function(action, params, localModeCallback) {
			if (this.localURL) {
				if(localModeCallback)	localModeCallback(true);
				return this.jdAPICore.localDeviceCall(this.localURL, this.deviceId, action, params, this.rsaPublicKey);
			} else {
				if(localModeCallback)	localModeCallback(false);
				return this.jdAPICore.deviceCall(this.deviceId, action, params , this.rsaPublicKey);
			}
		},
		setLocalURL: function(localURL) {
			this.localURL = localURL;
		},
		setPublicKey: function (publicKey) {
			this.publicKey = publicKey;
		},
		getURL: function() {
			if (this.localURL) {
				return this.localURL;
			} else {
				return this.jdAPICore.API_ROOT;
			}
		},
		isInLocalMode: function() {
			if (this.localURL) return true;
			return false;
		}
	});
	return JDAPIDevice;
});
define("serverServer", ["coreCrypto", "coreCryptoUtils"], function (CoreCrypto, CryptoUtils) {
    /**
     * API to handle server calls
     */
    var JDAPIServer = function (jdapiCore) {
        this.jdapiCore = jdapiCore;
    };
    $.extend(JDAPIServer.prototype, {
        listDevices: function () {
            return this.jdapiCore.serverCall("/my/listdevices");
        },
        /**
         * Calls that don't require authentication, and thus are made directly and not via the JDAPICore
         */
        getCaptcha: function () {
            var request = $.ajax({
                url: this.jdapiCore.API_ROOT + "/captcha/getCaptcha",
                type: "post",
                dataType: "json"
            });
            return request;
        },
        /* Register a new user account on the api */
        registerUser: function (data) {
            data.referrer = "webui";
            var requestURL = this.jdapiCore.API_ROOT + "/my/requestregistrationemail?email=" + encodeURIComponent(data.email) + "&captchaResponse=" + encodeURIComponent(data.captchaResponse) + "&captchaChallenge=" + encodeURIComponent(data.captchaChallenge) + "&referer=" + encodeURIComponent(data.referrer);
            return $.ajax({
                url: requestURL,
                type: "POST",
                dataType: "text"
            });
        },
        /* send email validationkey to the server */
        confirmEmail: function (email, validationkey, pass) {
            if (!pass) throw "No credentials given";
            var action = "/my/finishregistration";
            var loginSecret = CryptoUtils.hashPassword(email, pass, "server");
            var registerKey = CoreCrypto.enc.Hex.parse(validationkey);
            var iv = registerKey.firstHalf();
            var key = registerKey.secondHalf();
            var encrypted = CoreCrypto.AES.encrypt(loginSecret, key, {
                mode: CoreCrypto.mode.CBC,
                iv: iv
            });
            var stringEnc = CoreCrypto.enc.Hex.stringify(encrypted.ciphertext);
            var queryString = action + "?email=" + encodeURIComponent(email) + "&loginSecret=" + encodeURIComponent(stringEnc);
            queryString += "&signature=" + encodeURIComponent(CoreCrypto
                .HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), registerKey).toString(this.jdapiCore.TRANSFER_ENCODING));
            var confirm = $.ajax({
                url: this.jdapiCore.API_ROOT + queryString,
                type: "POST",
                dataType: "text"
            });
            return confirm;
        },
        /* send request to server to send password change email */
        requestPasswordChangeEmail: function (email, captchaChallenge, captchaResponse) {
            // craft query string
            var params = {};
            var action = "/my/requestpasswordresetemail";

            params.email = email;
            params.captchaResponse = captchaResponse;
            params.captchaChallenge = captchaChallenge;

            var queryString = action + "?" + $.param(params);

            // issue authentication request
            var confirm = $.ajax({
                url: this.jdapiCore.API_ROOT + queryString,
                type: "POST",
                dataType: "text"
            });

            return confirm;
        },
        requestTerminationEmail: function (captchaChallenge, captchaResponse) {
            return this.jdapiCore.serverCall("requestterminationemail", {
                captchaResponse: captchaResponse,
                captchaChallenge: captchaChallenge
            });
        },
        finishTermination: function (email, pw, keyParam, captchaChallenge, captchaResponse) {
            var options = {email: email, pass: pw};
            CryptoUtils.processPassword(options);
            var action = "/my/finishtermination";
            var keyHex = CoreCrypto.enc.Hex.parse(keyParam);
            var iv = keyHex.firstHalf();
            var key = keyHex.secondHalf();
            var encrypted = CoreCrypto.AES.encrypt(options.loginSecret, key, {
                mode: CoreCrypto.mode.CBC,
                iv: iv
            });
            var stringEnc = CoreCrypto.enc.Hex.stringify(encrypted.ciphertext);
            var queryString = action + "?email=" + encodeURIComponent(email) + "&loginSecret=" + encodeURIComponent(stringEnc) + "&captchaResponse=" + encodeURIComponent(captchaResponse) + "&captchaChallenge=" + encodeURIComponent(captchaChallenge);
            queryString += "&signature=" + encodeURIComponent(CoreCrypto
                .HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), keyHex).toString(this.jdapiCore.transferEncoding));
            var finish = $.ajax({
                url: this.jdapiCore.API_ROOT + queryString,
                type: "POST",
                dataType: "text"
            });
            return finish;
        },
        /* send request to server to change password */
        changePassword: function (email, newpass, key) {

            // craft query string
            var action = "/my/finishpasswordreset";

            var loginSecret = CryptoUtils.hashPassword(email, newpass, "server");
            var registerKey = CoreCrypto.enc.Hex.parse(key);

            var iv = registerKey.firstHalf();
            var key = registerKey.secondHalf();

            var encrypted = CoreCrypto.AES.encrypt(loginSecret, key, {
                mode: CoreCrypto.mode.CBC,
                iv: iv
            });

            var stringEnc = CoreCrypto.enc.Hex.stringify(encrypted.ciphertext);
            var queryString = action + "?email=" + encodeURIComponent(email) + "&loginSecret=" + encodeURIComponent(stringEnc);

            queryString += "&signature=" + encodeURIComponent(CoreCrypto
                .HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), registerKey).toString(this.jdapiCore.TRANSFER_ENCODING));

            // issue authentication request
            var confirm = $.ajax({
                url: this.jdapiCore.API_ROOT + queryString,
                type: "POST",
                dataType: "text"
            });
            return confirm;
        },
        /* send feedback message to the server */
        feedback: function (data) {
            return this.jdapiCore.serverCall("/my/feedback", data);
        },
        subscribePushNotifications: function (subscriptionId, deviceId, types) {
            return this.jdapiCore.serverCall("/notify/register", types, {
                receiverid: subscriptionId,
                deviceid: deviceId
            }, "POST");
        },
        unsubscribePushNotifications: function (subscriptionId, deviceId, types) {

        }
    });
    return JDAPIServer;
});
define("serviceService", ["coreCryptoUtils", "coreCrypto"], function (CryptoUtils, CoreCrypto) {
	/**
	 * API to handle service calls, eg the stats server
	 */
	var JDAPIService = function(jdapiCore) {
		this.jdapiCore = jdapiCore;
	};
	$.extend(JDAPIService.prototype, {
		/**
		 * Services Stuff
		 */
		serviceAccessTokens: {},
		requestAccessToken: function(servicename) {
			//token already available
			if (this.serviceAccessTokens[servicename]) {
				var tokens = $.Deferred();
				tokens.resolve(this.serviceAccessTokens[servicename]);
				return tokens;
			}
			//else request token first!
			//create container object
			this.serviceAccessTokens[servicename] = {};
			var serviceAccessTokensContainer = this.serviceAccessTokens[servicename];

			if (serviceAccessTokensContainer.requestOnTheWay) {
				var enqueueDef = $.Deferred();
				serviceAccessTokensContainer.deferredQueue = serviceAccessTokensContainer.deferredQueue || new Array();
				serviceAccessTokensContainer.deferredQueue.push(enqueueDef);
				return enqueueDef;
			}
			//flag request is on the way
			serviceAccessTokensContainer.requestOnTheWay = true;
			// if token request already sent, queue return value
			var params = {};
			var action = "";
			action = "/my/requestaccesstoken";
			params.service = servicename;
			var request = this.jdapiCore.serverCall(action, params);
			request.done(function(tokens){
				$.extend(serviceAccessTokensContainer, tokens);
			});
			return request;
		},
		send: function(servicename, url, action, params) {
			var returnDeferred = $.Deferred();
			var self = this;
			this.requestAccessToken(servicename).done(function(tokens) {
				var queryString = action + "?" + params + "&rid=" + 12 + "&accesstoken=" + tokens.accessToken;
				queryString = encodeURI(queryString);
				queryString += "&signature=" + CoreCrypto.HmacSHA256(CoreCrypto.enc.Utf8.parse(queryString), CoreCrypto.enc.Hex.parse(tokens.accessSecret)).toString(CoreCrypto.enc.Hex);

				var confirm = $.ajax({
					url: url + queryString,
					type: "GET"
				});
				confirm.done(function(res) {
					//increment successful request count
					if (self.serviceAccessTokens[servicename]) {
						var tokens = self.serviceAccessTokens[servicename];
						tokens.used++;
					}
					returnDeferred.resolve(res);
				}).fail(function(res) {
					if (self.serviceAccessTokens[servicename] && self.serviceAccessTokens[servicename].count > 0) {
						//retry with new token
						delete self.serviceAccessTokens[servicename];
						self.sendServiceRequest(servicename, url, action, params).then(returnDeferred.resolve, returnDeferred.reject);
					} else {
						//fail finally
						delete self.serviceAccessTokens[servicename];
						returnDeferred.reject(res);
					}
				});
			}).fail(function(err) {
				returnDeferred.reject(err);
			});
			return returnDeferred;
		}
	});
	return JDAPIService;
});
define("deviceController", ["device"], function (JDAPIDevice) {

    /* Timeouts for direct connection mode detection */
    var GET_DIRECT_CONNECTION_INFOS_TIMEOUT = 5000;
    var PING_TIMEOUT = 5000;

    /* Iterator http://stackoverflow.com/questions/12079417/javascript-iterators */
    var Iterator = function (items) {
        this.index = 0;
        this.items = items || [];
    };

    $.extend(Iterator.prototype, {
        first: function () {
            this.reset();
            return this.next();
        },
        next: function () {
            return this.items[this.index++];
        },
        hasNext: function () {
            return this.index < this.items.length;
        },
        reset: function () {
            this.index = 0;
        },
        each: function (callback) {
            for (var item = this.first(); this.hasNext(); item = this.next()) {
                callback(item);
            }
        }
    });

    var JDAPIDeviceController = function (jdAPIServer, jdAPICore) {
        this.jdAPIServer = jdAPIServer;
        this.jdAPICore = jdAPICore;
        this.devices = {};
    };

    $.extend(JDAPIDeviceController.prototype, {
        refreshAllDeviceAPIs: function () {
            var deviceListDef = $.Deferred();
            var deviceListDefLocalMode = $.Deferred();
            var listCall = this.jdAPIServer.listDevices();
            var self = this;

            listCall.done(function (devices) {
                var devicesResult = Object.create(null);
                var listResult = [];
                $.each(devices.list, function (index, device) {
                    devicesResult[device.id] = new JDAPIDevice(self.jdAPICore, device);
                    listResult.push(device);
                });
                deviceListDef.resolve(listResult);
                self.devices = devicesResult;
                self._checkForLocalMode(devices.list).done(deviceListDefLocalMode.resolve).fail(deviceListDefLocalMode.reject);
                /*self._iterateAndCheckForSessionPublicKey(new Iterator(devices.list), function () {
                    for (var i = 0; i < devices.list.length; i++) {

                    }
                 });*/
            });
            listCall.fail(function (error) {
                deviceListDefLocalMode.reject(error);
                deviceListDef.reject(error);
            });
            return {
                deviceList: deviceListDef,
                deviceListLocalMode: deviceListDefLocalMode
            };
        },
        _checkForLocalMode: function (devices) {
            if (devices !== undefined && devices.length !== undefined && devices.length != 0) {
                var self = this;
                var resultDef = $.Deferred();
                var devicePromises = [];
                $.each(devices, function (index, dev) {
                    self.devices[dev.id] = new JDAPIDevice(self.jdAPICore, dev);
                    var deviceDef = $.Deferred();
                    self.jdAPICore.deviceCall(dev.id, "/device/getDirectConnectionInfos", [], undefined, GET_DIRECT_CONNECTION_INFOS_TIMEOUT).always(function (result) {
                        if (result !== undefined && result.data !== undefined && result.data.infos !== undefined && result.data.infos !== null && result.data.infos.length !== 0) {
                            var pingPromises = self._pingForAvailability(result.data.infos, dev);
                            $.when.apply(this, pingPromises).done(function () {
                                deviceDef.resolve(dev);
                            }).fail(deviceDef.reject);
                        }
                    });
                    devicePromises.push(deviceDef);
                });
                $.when.apply(this, devicePromises).done(
                    function (result) {
                        resultDef.resolve(result)
                    }).fail(function (error) {
                    resultDef.reject(error)
                });
                return resultDef;
            } else {
                var def = $.Deferred();
                def.resolve(devices);
                return def;
            }
        },
        _pingForAvailability: function (addresses, device) {
            if (addresses !== undefined && addresses.length !== undefined && addresses.length !== 0) {
                var self = this;
                var bestLocalUrl;
                var pingPromises = [];
                $.each(addresses, function (index, deviceAddress) {
                    var def = $.Deferred();
                    pingPromises.push(def);
                    var localURL;
                    var unknownProtocol = window.location.protocol === undefined || (window.location.protocol !== "https:" && window.location.protocol !== "http:");
                    if (unknownProtocol || window.location.protocol === "https:") {
                        // dyndns service for wildcard certificate
                        localURL = "https://" + deviceAddress.ip.replace(new RegExp("\\.", 'g'), "-") + ".mydns.jdownloader.org:" + deviceAddress.port;
                    } else if (window.location.protocol && window.location.protocol === "http:") {
                        localURL = "http://" + deviceAddress.ip + ":" + deviceAddress.port;
                    }

                    var pingCall = self.jdAPICore.localDeviceCall(localURL, device.id, "/device/ping", [], undefined, PING_TIMEOUT);
                    pingCall.done(function () {
                        if (bestLocalUrl === undefined || (localURL !== undefined && localURL.indexOf("127.0.0.1") !== -1 || localURL.indexOf("127-0-0-1.mydns.") !== -1)) {
                            bestLocalUrl = localURL;
                            self.devices[device.id].setLocalURL(localURL);
                        }
                        def.resolve(self.devices[device.id]);
                    });
                    pingCall.fail(function () {
                        def.resolve(self.devices[device.id]);
                    });
                });
                return pingPromises;
            } else {
                var def = $.Deferred();
                def.resolve();
                return def;
            }
        },
        _iterateAndCheckForSessionPublicKey: function (iterator, finishedCallback) {
            var dev = iterator.next();
            //Last element reached
            if (!dev) {
                finishedCallback();
                return;
            }
            //put device on device list
            this.devices[dev.id] = this.devices[dev.id] || new JDAPIDevice(this.jdAPICore, dev);
            var self = this;
            this.jdAPICore.deviceCall(dev.id, "/device/getSessionPublicKey", [], undefined).done(function (result) {
                if (!result || !result.data) {
                    self._iterateAndCheckForSessionPublicKey(iterator, finishedCallback);
                } else {
                    self.devices[dev.id].rsaPublicKey = "-----BEGIN RSA PRIVATE KEY-----" + result.data + "-----END RSA PRIVATE KEY-----";
                }
            }).fail(function () {
                //on fail, just skip this device
                self._iterateAndCheckForSessionPublicKey(iterator, finishedCallback);
            });
        },

        /**
         * Construct reusable deviceAPI Interface for given deviceId
         */
        getDeviceAPIForId: function (deviceId) {
            var ret = $.Deferred();
            var self = this;

            var deviceQuery = $.Deferred();
            if (!self.devices[deviceId]) {
                deviceQuery = self.refreshAllDeviceAPIs().deviceList;
            } else {
                deviceQuery.resolve();
            }

            deviceQuery.always(function () {
                ret.resolve({
                    call: function (action, params) {
                        var innerRet = $.Deferred();
                        var device = self.devices[deviceId];
                        if (!device) {
                            innerRet.reject({
                                responseText: {
                                    type: "DEVICE_NOT_EXISTING"
                                }
                            });
                        } else {
                            device.call(action, params).then(innerRet.resolve, innerRet.reject, innerRet.progress);
                        }
                        return innerRet;
                    },
                    getURL: function () {
                        var device = self.devices[deviceId];
                        if (!device) throw "Device with id " + deviceId + " not found";
                        return device.getURL();
                    },
                    getTokenRoot: function () {
                        var device = self.devices[deviceId];
                        if (!device) throw "Device with id " + deviceId + " not found";
                        return device.getURL() + "/t_" + self.jdAPICore.getSessionToken() + "_" + deviceId;
                    },
                    isInLocalMode: function () {
                        var device = self.devices[deviceId];
                        return device.isInLocalMode();
                    },
                    deviceId: deviceId
                });
            });

            return ret;
        }
    });

    return JDAPIDeviceController;
});
var dataStore;
if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
    // web extension storage
    var dataStore = Object.create(null);
    dataStore.setItem = function (key, value) {
        var def = $.Deferred();
        var setObject = Object.create(null);
        setObject[key] = value;
        chrome.storage.local.set(setObject, def.resolve);
        return def;
    };
    dataStore.getItem = function (key) {
        var def = $.Deferred();
        chrome.storage.local.get(key, function (result) {
            if (result) {
                var resultObject = Object.create(null);
                resultObject[key] = result[key];
                def.resolve(resultObject);
            } else {
                def.reject();
            }
        });
        return def;
    };
    dataStore.removeItem = function (key) {
        var def = $.Deferred();
        chrome.storage.local.remove(key, def.resolve);
        return def;
    };

    dataStore.clear = function () {
        var def = $.Deferred();
        chrome.storage.local.clear(def.resolve);
        return def;
    };
} else {
    // DOM storage
    var dataStore = Object.create(null);
    dataStore.setItem = function (key, value) {
        var result = $.Deferred();
        result.resolve(window.localStorage.setItem(key, value));
        return result;
    };

    dataStore.getItem = function (key) {
        var result = $.Deferred();
        var resultObject = Object.create(null);
        resultObject[key] = window.localStorage.getItem(key);
        result.resolve(resultObject);
        return result;
    };

    dataStore.removeItem = function (key) {
        var result = $.Deferred();
        result.resolve(window.localStorage.removeItem(key));
        return result;
    };

    dataStore.clearStorage = function () {
        var result = $.Deferred();
        result.resolve(window.localStorage.clear());
        return result;
    };
}

/**
 * Wrap console to disable .log output in production
 */

var LOGGING_ENABLED = false;
var logger = {
    log: function (msg) {
        if (LOGGING_ENABLED) console.log(msg);
    },
    warn: function (msg) {
        if (LOGGING_ENABLED) console.warn(msg);
    },
    error: function (msg) {
        if (LOGGING_ENABLED)  console.error(msg);
    }
};
/**
 * Global config variables
 */
define("config/config", [],function () {
    return {
        TRANSFER_ENCODING: CryptoJS.enc.Hex,
        API_ROOT: "//api.jdownloader.org",
        LOCAL_STORAGE_KEY: "api.transport.options",
        APP_KEY: "com.appwork.jdownloader" //"org.jdownloader.my_web_0.1.657"
    };
});

/**
 * Main Library Object, contains all functions the library makes available for clients
 */
define("jdapi", ["coreCore", "device", "serverServer", "serviceService", "deviceController"], function (JDAPICore, JDAPIDevice, JDAPIServer, JDAPIService, JDAPIDeviceController) {
    /**
     *  Constructor method of the API
     *
     *    @param options Example: {email: 'myjd@jdownloader.org', pass: 'mysecretpass'}
     *  @param onConnectedCallback: a function or $.Deferred that gets called/resolved if connect was successful
     *  @param The AppKey to identify the application using the API
     */
    var API = function (options, onConnectedCallback, APP_KEY) {
        // Setup API Components
        this.jdAPICore = new JDAPICore(options, onConnectedCallback, APP_KEY);
        this.apiServer = new JDAPIServer(this.jdAPICore);
        this.apiService = new JDAPIService(this.jdAPICore);
        this.apiDeviceController = new JDAPIDeviceController(this.apiServer, this.jdAPICore);
    };

    $.extend(API.prototype, {
        /**
         * Get captcha challenge from the API used for 'Register Account' and 'Password Recovery'
         *  @returns  deferred object that resolves to captcha object which contains the captcha challenge id
         *              and the captcha challenge image as dataUrl
         */
        getCaptcha: function () {
            return this.apiServer.getCaptcha();
        },
        /**
         *   Connect to the API server and authenticate.
         *   Subscribe to handshake.done to see when the connection
         *   has been established.
         *   @param options: Example: {email: 'myjd@jdownloader.org', pass: 'mysecretpass'}
         *   @returns handshake deferred that gets resolved /rejected
         *            when the authentication has  succeeded/failed
         */
        connect: function (options) {
            return this.jdAPICore.connect(options);
        },
        /**
         *   Register new user at API server, requires a Captcha Challenge to be solved.
         *   Email will be verified via authentication link
         *   @param data: Example: {email: 'myjd@jdownloader.org', catpachaChallenge: '', captchaResponse: ''}
         *   @returns handshake deferred that gets resolved /rejected
         *            when the registration has succeeded/failed
         */
        registerUser: function (data) {
            return this.apiServer.registerUser(data);
        },
        reconnect: function () {
            return this.jdAPICore.reconnect();
        },
        /**
         *   Disconnect from the API server.
         *   @returns a deferred that gets resolved as soon you are disconnected.
         */
        disconnect: function () {
            return this.jdAPICore.disconnect();
        },
        confirmEmail: function (email, validationkey, pass) {
            return this.apiServer.confirmEmail(email, validationkey, pass);
        },
        requestConfirmEmail: function (pass) {
            return this.apiServer.requestConfirmEmail(pass);
        },
        requestPasswordChangeEmail: function (email, captchaChallenge, captchaResponse) {
            return this.apiServer.requestPasswordChangeEmail(email, captchaChallenge, captchaResponse);
        },
        requestTerminationEmail: function (captchaChallenge, captchaResponse) {
            return this.apiServer.requestTerminationEmail(captchaChallenge, captchaResponse);
        },
        finishTermination: function (email, pw, key, captchaChallenge, captchaResponse) {
            return this.apiServer.finishTermination(email, pw, key, captchaChallenge, captchaResponse);
        },
        /**
         * @param newpass The new password
         * @param key The password change validation key
         * @returns
         */
        changePassword: function (email, newpass, key) {
            return this.apiServer.changePassword(email, newpass, key);
        },
        sendServiceRequest: function (serviceName, url, action, params) {
            return this.apiService.send(serviceName, url, action, params);
        },
        listDevices: function (waitForLocalMode) {
            if (waitForLocalMode !== undefined && waitForLocalMode === true) {
                return this.apiDeviceController.refreshAllDeviceAPIs().deviceListLocalMode;
            } else {
                return this.apiDeviceController.refreshAllDeviceAPIs().deviceList;
            }
        },
        /**
         * Set the device id to what device subsequent "send" calls should go
         */
        setActiveDevice: function (deviceId) {
            return this.activeDeviceId = deviceId;
        },
        getActiveDevice: function () {
            return this.activeDeviceId;
        },
        getDirectConnectionInfos: function () {
            return this.transport.getDirectConnectionInfos();
        },
        ping: function () {
            return this.transport.ping();
        },
        /**
         *   Post feedback to the server
         *   @returns a deferred that gets resolved as feedback post returns successfully
         */
        feedback: function (data) {
            return this.apiServer.feedback(data);
        },
        subscribePushNotifications: function (subscriptionId, deviceId, types) {
            return this.apiServer.subscribePushNotifications(subscriptionId, deviceId, types);
        },
        unsubscribePushNotifications: function (subscriptionId, deviceId, types) {

        },
        /**
         *   Start polling events from the server.
         *   Subscribe to listener.notify to receive events.
         *   @returns the listener Deferred
         */
        listen: function (subId) {
            return this.send("/events/listen", [subId]);
        },
        subscribe: function (subscriptions, exclusions) {
            return this.send("/events/subscribe", [JSON.stringify(subscriptions), JSON.stringify(exclusions)]);
        },
        unsubscribe: function (subId) {
            return this.send("/events/unsubscribe", [subId]);
        },
        setSubscriptionId: function (subId) {
            return this.send("/events/getSubscriptionId", [subId]);
        },
        getSubscriptionId: function () {
            return this.send("/events/getSubscriptionId", []);
        },
        addSubscription: function (subId, subscriptions, exclusions) {
            return this.send("/events/addSubscription", [subId, subscriptions, exclusions]);
        },
        setSubscription: function (subId, subscriptions, exclusions) {
            return this.send("/events/setsubscription", [subId, JSON.stringify(subscriptions), JSON.stringify(exclusions)]);
        },
        getSubscription: function (subId) {
            return this.send("/events/getSubscription", [subId]);
        },
        removeSubscription: function (subId, subscriptions, exclusions) {
            return this.send("/events/removeSubscription", [subId, subscriptions, exclusions]);
        },
        changeSubscriptionTimeouts: function (subId, polltimeout, maxkeepalive) {
            return this.send("/events/changeSubscriptionTimeouts", [subId, polltimeout, maxkeepalive]);
        },
        listPublisher: function () {
            return this.transport.listPublisher();
        },
        /**
         *   Stop polling events
         */
        stopListen: function () {
        },
        /**
         *   Send a message with the given params to the server.
         *   Please make sure that you specify the parameters in the correct order.
         *
         *   @param action: The desired action (e.g. "/linkgrabber/add") as a string
         *   @param params: An array of primitives containing the parameters for the action.
         *     @param localModeCallback: OPTIONAL, function that gets called with TRUE if request is sent via localmode
         *   @returns a $.Deferred that gets resolved as soon as the action has been done.
         *   If you are interested in the results, subscribe to returnedDeferred.done
         */
        send: function (action, params, localModeCallback) {
            var ret = $.Deferred();
            this.apiDeviceController.getDeviceAPIForId(this.getActiveDevice()).done(function (deviceAPI) {
                deviceAPI.call(action, params, localModeCallback).then(ret.resolve, ret.reject, ret.progress);
            });
            return ret;
        },
        fetchActiveDeviceURL: function () {
            var ret = $.Deferred();
            this.apiDeviceController.getDeviceAPIForId(this.getActiveDevice()).done(function (deviceAPI) {
                var url = deviceAPI.getURL();
                ret.resolve(url);
            });
            return ret;
        },
        fetchActiveDeviceTokenRoot: function () {
            var ret = $.Deferred();
            this.apiDeviceController.getDeviceAPIForId(this.getActiveDevice()).done(function (deviceAPI) {
                var url = deviceAPI.getTokenRoot();
                ret.resolve(url);
            });
            return ret;
        },
        isActiveDeviceInLocalMode: function () {
            var ret = $.Deferred();
            this.apiDeviceController.getDeviceAPIForId(this.getActiveDevice()).done(function (deviceAPI) {
                var local = deviceAPI.isInLocalMode();
                ret.resolve(local);
            });
            return ret;
        },
        /**
         *   @returns a dictionary (object) containing the necessary data
         *   for the next authentication.
         */
        getAuth: function () {
            return this.transport.getAuth();
        },
        // Register callback function that gets called if api logs out
        // callback function gets called with a 'reason' string object
        addAPIStateChangeListener: function (callback) {
            this.jdAPICore.addAPIStateChangeListener(callback);
        },
        getAPIState: function () {
            return this.jdAPICore.getAPIState();
        },
        getAPIStatePlain: function () {
            return this.jdAPICore.getAPIStatePlain();
        },
        getCurrentUser: function () {
            return this.jdAPICore.getCurrentUser();
        },
        getCurrentSessionInfo: function () {
            var sessionInfo = this.jdAPICore.getSessionInfo();
            var result = {
                s: sessionInfo.sessiontoken,
                r: sessionInfo.regaintoken,
                e: sessionInfo.serverEncryptionToken.toString(CryptoJS.enc.Base64),
                d: sessionInfo.deviceSecret.toString(CryptoJS.enc.Base64)
            };
            return result;
        }
    });
    /**
     * Export jdapi constructor
     */
    return API;
});
