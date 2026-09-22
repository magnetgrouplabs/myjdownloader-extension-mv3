'use strict';

angular.module('myjdWebextensionApp')
    .directive('myClipboardhistory', function () {
        return {
            controller: 'ClipboardHistoryCtrl',
            scope: {
                device: '='
            },
            templateUrl: 'partials/directives/myclipboardhistory.html'
        };
    });
