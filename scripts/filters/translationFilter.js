angular.module('myjdWebextensionApp')
    .filter('translate', ['ExtensionI18nService', function (ExtensionI18nService) {
        console.log('translate filter registered');
        return function (message) {
            if (!message) return '';
            var result = ExtensionI18nService.getMessage(message);
            // Debug: log when message not found
            if (result === '') {
                console.log('translate filter: No translation for key:', message);
            }
            return result || message;
        }
    }]);
