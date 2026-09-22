'use strict';

angular.module('myjdWebextensionApp')
    .factory('myjdDeviceClientFactory', ['MyjdDeviceService', function (MyjdDeviceService) {
        return {
            // One client per call. Called without "new" this returned the
            // service singleton every time, so a second device panel
            // overwrote the first panel's device and closures: its client
            // then polled the wrong device and could no longer cancel its
            // own timer.
            get: function (device) {
                return new MyjdDeviceService.MyJDDeviceService(device);
            }
        }
    }]);