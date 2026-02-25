'use strict';

angular.module('myjdWebextensionApp')
    .directive('mySettings', function () {
        return {
            controller: 'SettingsCtrl',
            scope: {
                device: '='
            },
            templateUrl: 'partials/controllers/settings.html'
        };
    });