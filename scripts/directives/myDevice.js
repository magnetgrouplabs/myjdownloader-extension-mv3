'use strict';

angular.module('myjdWebextensionApp')
    .directive('myDevice', function () {
        return {
            controller: 'DeviceCtrl',
            scope: {
                device: '='
            },
            templateUrl: 'partials/directives/mydevice.html'
        };
    });
