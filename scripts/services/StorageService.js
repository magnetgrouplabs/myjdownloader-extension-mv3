'use strict';

angular.module('myjdWebextensionApp')
    .service('StorageService', [
        function () {
            this.STORAGE_FEEDBACK_MSG_DRAFT = "STORAGE_FEEDBACK_MSG_DRAFT";
            this.STORAGE_DEVICE_LIST_KEY = "CACHED_DEVICE_LIST";
            this.ADD_LINK_CACHED_OPTIONS = "ADD_LINK_CACHED_OPTIONS";
            this.ADD_LINK_CACHED_HISTORY = "ADD_LINK_CACHED_HISTORY";
            this.CLIPBOARD_HISTORY = "CLIPBOARD_HISTORY";
            this.SETTINGS_ADD_LINKS_DIALOG_ACTIVE = "ADD_LINKS_DIALOG_ACTIVE";
            this.SETTINGS_COUNTDOWN_ACTIVE = "COUNTDOWN_ACTIVE";
            this.SETTINGS_COUNTDOWN_VALUE = "COUNTDOWN_VALUE";
            this.SETTINGS_CLIPBOARD_OBSERVER = "CLIPBOARD_OBSERVER";
            this.SETTINGS_CONTEXT_MENU_SIMPLE = "CONTEXT_MENU_SIMPLE";
            this.SETTINGS_DEFAULT_PREFERRED_JD = "DEFAULT_PREFERRED_JD";
            this.SETTINGS_DEFAULT_PRIORITY = "DEFAULT_PRIORITY";
            this.SETTINGS_DEFAULT_DEEPDECRYPT = "DEFAULT_DEEPDECRYPT";
            this.SETTINGS_DEFAULT_AUTOSTART = "DEFAULT_AUTOSTART";
            this.SETTINGS_DEFAULT_AUTOEXTRACT = "DEFAULT_AUTOEXTRACT";
            this.SETTINGS_ENHANCE_CAPTCHA_DIALOG = "ENHANCE_CAPTCHA_DIALOG";
            this.SETTINGS_CAPTCHA_PRIVACY_MODE = "CAPTCHA_PRIVACY_MODE";
            this.SETTINGS_DEFAULT_OVERWRITE_PACKAGIZER = "DEFAULT_OVERWRITE_PACKAGIZER";
            this.SETTINGS_CLICKNLOAD_ACTIVE = "CLICKNLOAD_ACTIVE";
            this.SaveForLaterDevice = {id: "SaveForLaterDevice", name: "Save for later"};
            this.AskEveryTimeDevice = {id: "AskEveryTimeDevice", name: "Ask every time"};
            this.LastUsedDevice = {id: "LastUsedDevice", name: "Last Used"};

            this.priorityValues = {
                UNSET: {id: -10, text: "Unset", value: "UNSET"},
                HIGHEST: {id: 3, text: "Highest", value: "HIGHEST"},
                HIGHER: {id: 2, text: "Higher", value: "HIGHER"},
                HIGH: {id: 1, text: "High", value: "HIGH"},
                DEFAULT: {id: 0, text: "Default", default: true, value: "DEFAULT"},
                LOW: {id: -1, text: "Low", value: "LOW"},
                LOWER: {id: -2, text: "Lower", value: "LOWER"},
                LOWEST: {id: -3, text: "Lowest", value: "LOWEST"}
            };

            this.remotePriorityValues = {
                HIGHEST: {id: 3, text: "Highest", value: "HIGHEST"},
                HIGHER: {id: 2, text: "Higher", value: "HIGHER"},
                HIGH: {id: 1, text: "High", value: "HIGH"},
                DEFAULT: {id: 0, text: "Default", default: true, value: "DEFAULT"},
                LOW: {id: -1, text: "Low", value: "LOW"},
                LOWER: {id: -2, text: "Lower", value: "LOWER"},
                LOWEST: {id: -3, text: "Lowest", value: "LOWEST"}
            };

            let StorageService = this;

            this.settingsKeys = {
                ENHANCE_CAPTCHA_DIALOG: {key: StorageService.SETTINGS_ENHANCE_CAPTCHA_DIALOG, defaultValue: true},
                ADD_LINKS_DIALOG_ACTIVE: {key: StorageService.SETTINGS_ADD_LINKS_DIALOG_ACTIVE, defaultValue: true},
                COUNTDOWN_ACTIVE: {key: StorageService.SETTINGS_COUNTDOWN_ACTIVE, defaultValue: true},
                COUNTDOWN_VALUE: {key: StorageService.SETTINGS_COUNTDOWN_VALUE, defaultValue: 3},
                CLIPBOARD_OBSERVER: {key: StorageService.SETTINGS_CLIPBOARD_OBSERVER, defaultValue: false},
                CAPTCHA_PRIVACY_MODE: {key: StorageService.SETTINGS_CAPTCHA_PRIVACY_MODE, defaultValue: true},
                CONTEXT_MENU_SIMPLE: {key: StorageService.SETTINGS_CONTEXT_MENU_SIMPLE, defaultValue: true},
                DEFAULT_PREFERRED_JD: {
                    key: StorageService.SETTINGS_DEFAULT_PREFERRED_JD,
                    defaultValue: StorageService.AskEveryTimeDevice
                },
                DEFAULT_PRIORITY: {
                    key: StorageService.SETTINGS_DEFAULT_PRIORITY,
                    defaultValue: StorageService.priorityValues.UNSET
                },
                DEFAULT_DEEPDECRYPT: {
                    key: StorageService.SETTINGS_DEFAULT_DEEPDECRYPT,
                    defaultValue: "unset"
                },
                DEFAULT_AUTOSTART: {
                    key: StorageService.SETTINGS_DEFAULT_AUTOSTART,
                    defaultValue: "unset"
                },
                DEFAULT_AUTOEXTRACT: {
                    key: StorageService.SETTINGS_DEFAULT_AUTOEXTRACT,
                    defaultValue: "unset"
                },
                DEFAULT_OVERWRITE_PACKAGIZER: {
                    key: StorageService.SETTINGS_DEFAULT_OVERWRITE_PACKAGIZER,
                    defaultValue: "unset"
                },
                CLICKNLOAD_ACTIVE: {
                    key: StorageService.SETTINGS_CLICKNLOAD_ACTIVE,
                    defaultValue: true
                }
            };

            this.set = function (key, value, callback, error) {
                if (key) {
                    StorageService.getAll(function (data) {
                        let newData = data || {};
                        newData[key] = value;
                        chrome.storage.local.set(newData, callback);
                    });
                } else {
                    if (error) error("no key provided");
                }
            };

            this.clear = function (callback) {
                chrome.storage.local.clear(callback);
            };

            this.get = function (key, callback) {
                chrome.storage.local.get(key, callback);
            };

            this.getAll = function (callback) {
                chrome.storage.local.get(undefined, callback);
            };

            this.setCollection = function (collection, callback, error) {
                StorageService.getAll(function (data) {
                    let newData = data || {};
                    $.each(collection, function (index, val) {
                        if (!val.key || !val.value) {
                            if (error) error("invalid argument, needs [{key: 'key', value: 'value'}]");
                        }
                        newData[val.key] = val.value;
                    });
                    chrome.storage.local.set(newData, callback);
                });
            };

            this.getCollection = function (keys, callback, error) {
                StorageService.getAll(function (data) {
                    let result = {};
                    if (data === undefined || data.length === 0) callback(result);
                    $.each(keys, function (index, key) {
                        if (key && data[key] !== undefined) {
                            result[key] = data[key];
                        }
                    });
                    callback(result);
                });
            };

            this.getSettings = function (callback) {
                let keys = [];
                let result = {};
                $.each(StorageService.settingsKeys, function (index, settingsKey) {
                    keys.push(settingsKey.key);
                });

                StorageService.getCollection(keys, function (settings) {
                    $.each(keys, function (index, key) {
                        if (settings[key] !== undefined) {
                            result[key] = settings[key];
                        } else {
                            result[key] = StorageService.settingsKeys[key].defaultValue;
                        }
                    });
                    callback(result);
                });
            }
        }]);
