angular.module('myjdWebextensionApp')
    .service('BrowserService', [function () {
        function chromeErrorCallback() {
            if (chrome.runtime.lastError != null && chrome.runtime.lastError.message) {
                let error = chrome.runtime.lastError;
                console.log(error.message);
            }
        }

        return {
            chromeErrorCallback: chromeErrorCallback
        }
    }]);
