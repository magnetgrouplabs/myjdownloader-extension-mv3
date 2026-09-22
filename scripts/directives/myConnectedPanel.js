'use strict';

angular.module('myjdWebextensionApp')
    .directive('myConnectedPanel', function () {
        return {
            controller: 'ConnectedCtrl',
            templateUrl: 'partials/directives/myconnectedpanel.html'
        };
    });
