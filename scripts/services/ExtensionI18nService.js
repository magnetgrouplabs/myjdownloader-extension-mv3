'use strict';

angular.module('myjdWebextensionApp')
    .service('ExtensionI18nService', [
        function () {
            this.getMessage = function (msg) {
                if (!msg) return '';
                var result = chrome.i18n.getMessage(msg);
                // Debug: log when message not found
                if (result === '') {
                    console.log('ExtensionI18nService: No translation for key:', msg);
                }
                return result;
            };

            this.getAcceptLanguages = function () {
                return chrome.i18n.getAcceptLanguages();
            };

            this.getUILanguage = function () {
                return chrome.i18n.getUILanguage();
            };

            this.detectLanguage = function () {
                return chrome.i18n.detectLanguage();
            }
        }]);
