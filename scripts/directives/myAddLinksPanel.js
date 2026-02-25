'use strict';

angular.module('myjdWebextensionApp')
    .directive('myAddLinksPanel', function () {
        return {
            controller: 'AddLinksCtrl',
            scope: {
                device: '=',
                requests: '=',
                showSaveForLater: '=capturedrequestmode'
            },
            templateUrl: 'partials/directives/myaddlinkspanel.html'
        }
    });