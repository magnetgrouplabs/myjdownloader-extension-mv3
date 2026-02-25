'use strict';

angular.module('myjdWebextensionApp')
    .directive('myReallyLogoutPanel', function () {
        return {
            controller: 'ReallyLogoutCtrl',
            scope: {
                reallyLogoutDialogShown: "="
            },
            templateUrl: 'partials/directives/myreallylogoutpanel.html'
        };
    });