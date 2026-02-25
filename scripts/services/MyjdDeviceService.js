'use strict';

angular.module('myjdWebextensionApp')
    .service('MyjdDeviceService', ['$timeout', 'myjdClientFactory', 'ApiErrorService', 'ExtensionMessagingService',
        function ($timeout, myjdClientFactory, apiErrorService, ExtensionMessagingService) {
            this.MyJDDeviceService = function (device) {
                this.device = device;
                var subjects = {};
                var runningPoll;
                var runningEventsLongPoll;

                this.setDevice = function (device) {
                    this.device = device;
                };

                this.getActiveDevice = function () {
                    return this.device;
                };

                this.isPolling = function () {
                    return runningPoll !== undefined;
                };

                this.subscribeToEvents = function (subscriptions, exclusions) {
                    if (!subjects.eventsSubscription) {
                        subjects.eventsSubscription = new Rx.BehaviorSubject();
                    }
                    myjdClientFactory.get().send(device.id, "/events/subscribe", [JSON.stringify([].concat(subscriptions)), JSON.stringify([].concat(exclusions))]).done(function (result) {
                        if (result) {
                            subjects.eventsSubscription.onNext(result);
                        } else {
                            subjects.eventsSubscription.onError(apiErrorService.createApiError(error));
                        }
                    }).fail(function (error) {
                        subjects.eventsSubscription.onError(apiErrorService.createApiError(error));
                    });
                    return subjects.eventsSubscription;
                };

                this.eventsListen = function (subscription) {
                    if (!subjects.eventsListen) {
                        subjects.eventsListen = new Rx.BehaviorSubject();
                    }

                    myjdClientFactory.get().send(device.id, "/events/listen", [subscription.id]).done(function (result) {
                        if (result) {
                            subjects.eventsListen.onNext(result);
                        } else {
                            subjects.eventsListen.onError(apiErrorService.createApiError(error));
                        }
                    }).fail(function (error) {
                        subjects.eventsListen.onError(apiErrorService.createApiError(error));
                    });

                    return subjects.eventsListen;
                };

                var publishAggregatedNumbers = function (stats) {
                    if (stats.data && stats.data[0] && stats.data[1]) {
                        var deviceStatus = {};
                        deviceStatus.state = stats.data[0].eventData.data;
                        deviceStatus.eta = stats.data[1].eventData.data.eta;
                        deviceStatus.speed = stats.data[1].eventData.data.downloadSpeed;
                        deviceStatus.done = stats.data[1].eventData.data.loadedBytes;
                        deviceStatus.total = stats.data[1].eventData.data.totalBytes;
                        ExtensionMessagingService.sendMessage("myjd-toolbar", "device-poll-" + device.id, deviceStatus);
                    }
                };

                function pollRequest(thisService, interval) {
                    thisService.getAggregatedNumbers(thisService).done(function (stats) {
                        publishAggregatedNumbers(stats);
                        if (interval && interval > 0) {
                            thisService.stopPolling();
                            thisService._poll(interval, false);
                        }
                    }).fail(function (error) {
                        if (subjects.poll) {
                            subjects.poll.onError(apiErrorService.createApiError(error));
                        }
                    });
                }

                this.oneTimePoll = function () {
                    this.getAggregatedNumbers().done(function (stats) {
                        publishAggregatedNumbers(stats);
                    }).fail(function (error) {
                        ExtensionMessagingService.sendMessage("myjd-toolbar", "device-poll-" + device.id, {error: error});
                    });
                };

                this.getAggregatedNumbers = function () {
                    return myjdClientFactory.get().send(this.device.id, "/polling/poll", [JSON.stringify({
                        "jdState": true,
                        "aggregatedNumbers": true
                    })]);
                };

                this.poll = function (interval) {
                    return this._poll(interval, true, true);
                };

                this._poll = function (interval, cancelRunning, initialRequest) {
                    if (this.isPolling() && !cancelRunning) {
                        return;
                    }

                    if (!subjects.poll) {
                        subjects.poll = new Rx.BehaviorSubject();
                    }

                    if (!interval) {
                        interval = 4000;
                    }

                    if (this.isPolling() && cancelRunning) {
                        $timeout.cancel(runningPoll);
                    }

                    if (initialRequest) {
                        // Not yet polling, do not wait for interval to get the numbers
                        this.getAggregatedNumbers().done(function (stats) {
                            publishAggregatedNumbers(stats);
                        }).fail(function (error) {
                            if (subjects.poll) {
                                subjects.poll.onError(apiErrorService.createApiError(error));
                            }
                        });
                    }

                    runningPoll = $timeout(function (thisService, interval) {
                        pollRequest(thisService, interval);
                    }, interval, true, this, interval);

                    return subjects.poll;
                };

                this.sendRequest = function (call, ...params) {
                  var realParams = [...params].filter(el => {return el != null;});
                  return myjdClientFactory.get().send(this.device.id, call, [].concat(realParams));
                };

                this.stopPolling = function () {
                    if (this.isPolling()) {
                        $timeout.cancel(runningPoll);
                        runningPoll = undefined;
                    }
                };

                return this;
            }
        }]);
