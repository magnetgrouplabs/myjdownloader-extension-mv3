'use strict';

angular.module('myjdWebextensionApp')
    .factory('myjdClientFactory', ['MyjdService', function (myjdService) {
        return {
            get: function () {
                return myjdService;
            }
        }
    }]);
