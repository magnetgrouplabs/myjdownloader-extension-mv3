'use strict';

/**
 * @ngdoc function
 * @name myjdWebextensionApp.controller:SettingsCtrl
 * @description
 * # SettingsCtrl
 * Controller of the myjdWebextensionApp
 */
angular.module('myjdWebextensionApp')
    .controller('SettingsCtrl', ['$scope', '$http', '$timeout', 'StorageService', 'BackgroundScriptService', 'ExtensionI18nService', function ($scope, $http, $timeout, storageService, backgroundScriptService, ExtensionI18nService) {
        $http.get(chrome.runtime.getURL('../../buildMeta.json'),
            { headers: { 'Accept': 'application/json' } }).then(function (buildMeta) {
                $timeout(function () {
                    $scope.buildMeta = buildMeta.data;
                }, 0);
            });

        $scope.priorityValues = storageService.priorityValues;

        $scope.settingsKeys = storageService.settingsKeys;

        $scope.isAllowedIncognito = false;

        $scope.settings = {};

        $scope.reallyLogoutVisible = false;

        $scope.AskEveryTimeDevice = storageService.AskEveryTimeDevice;
        $scope.devices = [];
        $scope.devices.push(storageService.AskEveryTimeDevice);
        $scope.devices.push(storageService.LastUsedDevice);
        $scope.devices.push(storageService.SaveForLaterDevice);

        $scope.settings[$scope.settingsKeys.ENHANCE_CAPTCHA_DIALOG.key] = $scope.settingsKeys[$scope.settingsKeys.ENHANCE_CAPTCHA_DIALOG.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_PRIORITY.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_PRIORITY.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_DEEPDECRYPT.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_DEEPDECRYPT.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_AUTOSTART.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_AUTOSTART.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_AUTOEXTRACT.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_AUTOEXTRACT.key].defaultValue;
        $scope.settings[$scope.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key] = $scope.settingsKeys[$scope.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key].defaultValue;
        $scope.settings[$scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key] = $scope.settingsKeys[$scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key].defaultValue;
        $scope.settings[$scope.settingsKeys.COUNTDOWN_ACTIVE.key] = $scope.settingsKeys[$scope.settingsKeys.COUNTDOWN_ACTIVE.key].defaultValue;
        $scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] = $scope.settingsKeys[$scope.settingsKeys.COUNTDOWN_VALUE.key].defaultValue;
        $scope.settings[$scope.settingsKeys.CLICKNLOAD_ACTIVE.key] = $scope.settingsKeys[$scope.settingsKeys.CLICKNLOAD_ACTIVE.key].defaultValue;

        initSettings();

        $scope.isAfterInit = false;
        $scope.isCnlSupported = true;

        backgroundScriptService.getUsername().then(function (response) {
            if (response !== undefined && response.username !== undefined) {
                $timeout(function () {
                    $scope.username = response.username;
                }, 0);
            }
        });

        chrome.runtime.sendMessage({ name: "cnl-support" }, function (response) {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            if (response !== undefined && response.data !== undefined && response.data.cnlSupported) {
                $timeout(function () {
                    $scope.isCnlSupported = response.data.cnlSupported;
                }, 0);
            }
        });

        function initSettings() {
            storageService.getSettings(function (settings) {
                $timeout(function () {
                    $scope.settings = settings;
                    $scope.isAfterInit = true;
                }, 0);
            });
        }

        $scope.openOptionsTab = function () {
            chrome.runtime.openOptionsPage();
        };

        // MV3: Check incognito access - use callback style for compatibility
        try {
            if (chrome.runtime && typeof chrome.runtime.isAllowedIncognitoAccess === 'function') {
                chrome.runtime.isAllowedIncognitoAccess(function(isAllowedAccess) {
                    if (chrome.runtime.lastError) {
                        console.log('SettingsController: Could not check incognito access:', chrome.runtime.lastError.message);
                        $scope.isAllowedIncognito = false;
                    } else {
                        $timeout(function () {
                            $scope.isAllowedIncognito = isAllowedAccess || false;
                        });
                    }
                });
            }
        } catch (e) {
            console.log('SettingsController: Error checking incognito access:', e);
            $scope.isAllowedIncognito = false;
        }

        chrome.storage.onChanged.addListener(function (changes, namespace) {
            if (changes && changes[$scope.settingsKeys.CLIPBOARD_OBSERVER.key]) {
                $timeout(function () {
                    $scope.settings[$scope.settingsKeys.CLIPBOARD_OBSERVER.key] = changes[$scope.settingsKeys.CLIPBOARD_OBSERVER.key].newValue;
                }, 0);
            }
            if (changes && changes[$scope.settingsKeys.CONTEXT_MENU_SIMPLE.key]) {
                $timeout(function () {
                    $scope.settings[$scope.settingsKeys.CONTEXT_MENU_SIMPLE.key] = changes[$scope.settingsKeys.CONTEXT_MENU_SIMPLE.key].newValue;
                }, 0);
            }
        });

        function getLastKnownDevices() {
            storageService.get(storageService.STORAGE_DEVICE_LIST_KEY, function (data) {
                if (data && data[storageService.STORAGE_DEVICE_LIST_KEY]) {
                    $timeout(function () {
                        $scope.devices = [];
                        $.each(data[storageService.STORAGE_DEVICE_LIST_KEY], function (index, el) {
                            delete el.$$hashKey;
                            $scope.devices.push(el);
                        });
                        $scope.devices.push(storageService.SaveForLaterDevice);
                        $scope.devices.push(storageService.AskEveryTimeDevice);
                        $scope.devices.push(storageService.LastUsedDevice);
                    }, 0);
                }
            });
        }

        $scope.$watchGroup([
            "settings." + $scope.settingsKeys.ENHANCE_CAPTCHA_DIALOG.key,
            "settings." + $scope.settingsKeys.CLIPBOARD_OBSERVER.key,
            "settings." + $scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key,
            "settings." + $scope.settingsKeys.COUNTDOWN_ACTIVE.key,
            "settings." + $scope.settingsKeys.COUNTDOWN_VALUE.key,
            "settings." + $scope.settingsKeys.CONTEXT_MENU_SIMPLE.key,
            "settings." + $scope.settingsKeys.DEFAULT_PREFERRED_JD.key,
            "settings." + $scope.settingsKeys.DEFAULT_PRIORITY.key,
            "settings." + $scope.settingsKeys.DEFAULT_DEEPDECRYPT.key,
            "settings." + $scope.settingsKeys.DEFAULT_AUTOSTART.key,
            "settings." + $scope.settingsKeys.DEFAULT_AUTOEXTRACT.key,
            "settings." + $scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key,
            "settings." + $scope.settingsKeys.CLICKNLOAD_ACTIVE.key,
            "settings." + $scope.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key],
            function (newValues, oldValues, scope) {
                if (!$scope.isAfterInit) return;
                var changes = [];
                changes.push({
                    key: $scope.settingsKeys.CLIPBOARD_OBSERVER.key,
                    value: scope.settings[$scope.settingsKeys.CLIPBOARD_OBSERVER.key]
                });

                changes.push({
                    key: $scope.settingsKeys.ENHANCE_CAPTCHA_DIALOG.key,
                    value: scope.settings[$scope.settingsKeys.ENHANCE_CAPTCHA_DIALOG.key]
                });

                if (scope.settings[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key].id === storageService.AskEveryTimeDevice.id) {
                    scope.settings[$scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key] = true;
                }

                changes.push({
                    key: $scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key,
                    value: scope.settings[$scope.settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key]
                });

                changes.push({
                    key: $scope.settingsKeys.COUNTDOWN_ACTIVE.key,
                    value: scope.settings[$scope.settingsKeys.COUNTDOWN_ACTIVE.key]
                });

                changes.push({
                    key: $scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key,
                    value: scope.settings[$scope.settingsKeys.CAPTCHA_PRIVACY_MODE.key]
                });

                changes.push({
                    key: $scope.settingsKeys.CLICKNLOAD_ACTIVE.key,
                    value: scope.settings[$scope.settingsKeys.CLICKNLOAD_ACTIVE.key]
                });

                if (scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] === undefined || (scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] < 1)) {
                    scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] = 1;
                } else if (scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] > 99) {
                    scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key] = 99;
                }

                changes.push({
                    key: $scope.settingsKeys.COUNTDOWN_VALUE.key,
                    value: scope.settings[$scope.settingsKeys.COUNTDOWN_VALUE.key]
                });

                changes.push({
                    key: $scope.settingsKeys.CONTEXT_MENU_SIMPLE.key,
                    value: scope.settings[$scope.settingsKeys.CONTEXT_MENU_SIMPLE.key]
                });

                changes.push({
                    key: $scope.settingsKeys.DEFAULT_PREFERRED_JD.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key]
                });
                changes.push({
                    key: $scope.settingsKeys.DEFAULT_PRIORITY.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_PRIORITY.key]
                });
                changes.push({
                    key: $scope.settingsKeys.DEFAULT_DEEPDECRYPT.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_DEEPDECRYPT.key]
                });
                changes.push({
                    key: $scope.settingsKeys.DEFAULT_AUTOSTART.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_AUTOSTART.key]
                });
                changes.push({
                    key: $scope.settingsKeys.DEFAULT_AUTOEXTRACT.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_AUTOEXTRACT.key]
                });
                changes.push({
                    key: $scope.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key,
                    value: scope.settings[$scope.settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key]
                });

                storageService.setCollection(changes);
            }
        );

        $scope.hasTargetWithCountdown = function () {
            return !$scope.settings[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key] || $scope.settings[$scope.settingsKeys.DEFAULT_PREFERRED_JD.key].id !== storageService.AskEveryTimeDevice.id;
        };

        $scope.unset = function (key) {
            if (key === $scope.settingsKeys.DEFAULT_PRIORITY.key) {
                $scope.settings[key] = $scope.priorityValues.UNSET;
            } else {
                $scope.settings[key] = 'unset';
            }
        };

        $scope.reallyLogout = function () {
            $scope.reallyLogoutVisible = !$scope.reallyLogoutVisible;
        };

        $scope.translatedPriority = function (prio) {
            return ExtensionI18nService.getMessage("ui_add_links_prio_" + prio.toLowerCase());
        };

        $scope.translatedTarget = function (target) {
            if (target.id === storageService.AskEveryTimeDevice.id) {
                return ExtensionI18nService.getMessage("ui_add_links_target_ask_every_time");
            } else if (target.id === storageService.LastUsedDevice.id) {
                return ExtensionI18nService.getMessage("ui_add_links_target_last_used");
            } else if (target.id === storageService.SaveForLaterDevice.id) {
                return ExtensionI18nService.getMessage("ui_add_links_target_save_for_later");
            } else {
                return target.name;
            }
        };

        getLastKnownDevices();
    }
    ]);
