"use strict"

angular.module('myjdWebextensionApp')
    .controller('DeviceCtrl', ['$scope', '$timeout', '$interval', 'StringUtilsService', 'ApiErrorService', 'myjdDeviceClientFactory', function ($scope, $timeout, $interval, StringUtilsService, ApiErrorService, myjdDeviceClientFactory) {
        var deviceCtrl = this;

        var states = {
            RUNNING: "RUNNING",
            PAUSE: "PAUSE",
            STOPPED_STATE: "STOPPED_STATE",
            STOPPING: "STOPPING",
            IDLE: "IDLE"//default
        };

        $scope.controlRequestRunning = false;

        this.rawStatus = {};

        $scope.states = states;

        function reset() {
            $scope.error = {};
            $scope.deviceStatus = {
                eta: "~",
                speed: "~",
                done: "~",
                total: "~",
                state: states.IDLE
            };
        }

        /*
         * The panel talks to the device through the same direct cloud client
         * that loads the device list and sends links. The poll used to be
         * asked of the background script, which has never done it: the panel
         * showed "~" for every number and the state stayed IDLE, so Pause and
         * Stop never even rendered.
         *
         * Each panel builds its own client, so two devices do not share one.
         * The client calls back in process; a chrome.runtime message would
         * never arrive, because the popup would be both sender and receiver.
         */
        var deviceClient = myjdDeviceClientFactory.get($scope.device);

        deviceClient.onStatus(function (data) {
            if (data && data.data && !data.error) {
                deviceCtrl.rawStatus = data.data;
                var result = {};
                if (data.data.eta && data.data.eta > 0) {
                    result.eta = StringUtilsService.createEtaText(data.data.eta);
                } else {
                    result.eta = "~";
                }
                if (data.data.done && data.data.done > 0) {
                    result.done = StringUtilsService.bytesToSizeSanitized(data.data.done, 2);
                } else {
                    result.done = "~";
                }
                if (data.data.speed && data.data.speed > 0) {
                    result.speed = StringUtilsService.bytesToSizeSanitized(data.data.speed, 2) + "/s";
                } else {
                    result.speed = "~";
                }
                if (data.data.total && data.data.total > 0) {
                    result.total = StringUtilsService.bytesToSizeSanitized(data.data.total, 2);
                } else {
                    result.total = "~";
                }
                if (data.data.state) {
                    result.state = data.data.state;
                } else {
                    result.state = states.IDLE;
                }
                digestNow(function () {
                    $scope.deviceStatus = result;
                });
            } else if (data && data.error) {
                handleApiError(data.error);
            }
        });

        reset();

        deviceClient.oneTimePoll();
        var intervalPromise = $interval(function () {
            deviceClient.oneTimePoll();
        }, 4000);

        $scope.start = function () {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = $scope.states.RUNNING;
                sendControlRequest(deviceClient.sendRequest("/downloads/start"));
            }
        };

        $scope.pause = function (pause) {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = pause ? $scope.states.PAUSE : $scope.states.RUNNING;
                // The api takes a boolean. A bitwise or was sending 0 or 1.
                sendControlRequest(deviceClient.sendRequest("/downloadcontroller/pause", !!pause));
            }
        };

        $scope.stop = function () {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = $scope.states.STOPPED_STATE;
                sendControlRequest(deviceClient.sendRequest("/downloadcontroller/stop"));
            }
        };

        $scope.getEncodedDeviceId = function (device) {
            return encodeURIComponent(device.id);
        };

        // A control request that never left the popup must say so. It used to
        // clear the spinner and look like it had worked while JDownloader
        // carried on downloading.
        function sendControlRequest(request) {
            if (!request || typeof request.done !== 'function') {
                showError({message: "API not connected. Please log in again."});
                handleApiRequestDone();
                return;
            }
            request.done(function () {
                handleApiRequestDone();
            }).fail(function (error) {
                handleApiError(error);
                handleApiRequestDone();
            });
        }

        function handleApiError(error) {
            var apiError = ApiErrorService.createApiError(error);
            showError(ApiErrorService.createReadableApiError(apiError));
        }

        // The cloud client resolves outside angular, so the error has to be
        // set inside a digest to reach the panel.
        function showError(readableError) {
            digestNow(function () {
                $scope.error = readableError;
            });
        }

        function handleApiRequestDone() {
            digestNow(function () {
                $scope.controlRequestRunning = false;
            });
        }

        function digestNow(fnct) {
            $timeout(function () {
                fnct();
            }, 0);
        }

        $scope.$on('$destroy', function () {
            if (intervalPromise !== undefined) {
                $interval.cancel(intervalPromise);
            }
        });
    }]);
