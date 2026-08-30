'use strict';

angular.module('myjdWebextensionApp')
    .factory('myjdDeviceClientFactory', ['MyjdDeviceService', function (MyjdDeviceService) {
        return {
            get: function (device) {
                return MyjdDeviceService.MyJDDeviceService(device);
            }
        }
    }]);