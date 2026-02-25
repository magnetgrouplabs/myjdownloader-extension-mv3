"use strict"

angular.module('myjdWebextensionApp')
    .controller('DeviceCtrl', ['$scope', '$timeout', '$interval', 'StringUtilsService', 'ApiErrorService', 'BackgroundScriptService', function ($scope, $timeout, $interval, StringUtilsService, ApiErrorService, BackgroundScriptService) {
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

        BackgroundScriptService.onDevicePoll($scope.device.id, function (data) {
            if (data && data.data && !data.error) {
                deviceCtrl.rawStatus = data.result;
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

        BackgroundScriptService.devicePoll($scope.device);
        var intervalPromise = $interval(function () {
            BackgroundScriptService.devicePoll($scope.device);
        }, 2000);

        $scope.start = function () {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = $scope.states.RUNNING;
                BackgroundScriptService.sendApiRequest($scope.device, "/downloads/start").then(function (result) {
                    if (result.data && result.data.error) {
                        handleApiError(result.data.error);
                    } else {
                        handleApiRequestDone();
                    }
                }).catch(function (error) {
                    handleApiError(error);
                });
            }
        };

        $scope.pause = function (pause) {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = pause ? $scope.states.PAUSE : $scope.states.RUNNING;

                BackgroundScriptService.sendApiRequest($scope.device, "/downloadcontroller/pause", (pause | false)).then(function (result) {
                    if (result.data && result.data.error) {
                        handleApiError(result.data.error);
                    } else {
                        handleApiRequestDone();
                    }
                }).catch(function (error) {
                    handleApiError(error);
                });
            }
        };

        $scope.stop = function () {
            if (!$scope.controlRequestRunning) {
                $scope.controlRequestRunning = true;
                $scope.deviceStatus.state = $scope.states.STOPPED_STATE;

                BackgroundScriptService.sendApiRequest($scope.device, "/downloadcontroller/stop").then(function (result) {
                    if (result.data && result.data.error) {
                        handleApiError(result.data.error);
                    } else {
                        handleApiRequestDone();
                    }
                }).catch(function (error) {
                    handleApiError(error);
                });
            }
        };

        $scope.getEncodedDeviceId = function (device) {
            return encodeURIComponent(device.id);
        };

        function handleApiError(error) {
            var apiError = ApiErrorService.createApiError(error);
            var readableError = ApiErrorService.createReadableApiError(apiError);
            $scope.error = readableError;
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
