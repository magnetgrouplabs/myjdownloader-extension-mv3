'use strict';

angular.module('myjdWebextensionApp')
    .service('MyjdDeviceService', ['$timeout', 'myjdClientFactory', 'ApiErrorService',
        function ($timeout, myjdClientFactory, apiErrorService) {
            this.MyJDDeviceService = function (device) {
                this.device = device;
                var subjects = {};
                var runningPoll;
                var runningEventsLongPoll;
                var statusCallbacks = [];
                var pollInFlight = false;

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

                /*
                 * Status delivery.
                 *
                 * Callers register with onStatus() and are called back in
                 * process. The poll result used to go out over
                 * chrome.runtime.sendMessage, which works only when the
                 * publisher and the subscriber sit in different contexts. The
                 * poll now runs in the popup, the same frame that renders the
                 * panel, and Chrome never delivers a runtime message back to
                 * the frame that sent it.
                 *
                 * The message handed to a callback has exactly one of two
                 * shapes:
                 *   {data: {eta, speed, done, total, state}}  a poll result
                 *   {error: <api error>}                      a failed poll
                 */
                this.onStatus = function (callback) {
                    if (typeof callback === 'function') {
                        statusCallbacks.push(callback);
                    }
                };

                var notifyStatus = function (message) {
                    statusCallbacks.forEach(function (callback) {
                        try {
                            callback(message);
                        } catch (e) {
                            console.error("MyjdDeviceService: status callback failed", e);
                        }
                    });
                };

                // The poll response carries one entry per subscribed event.
                // Match on the event name, and fall back to the historic
                // positional order (jdState first, aggregatedNumbers second)
                // when the field is absent, so an unnamed envelope still
                // fills the panel.
                var pickEvent = function (entries, eventName, fallbackIndex) {
                    if (!entries) {
                        return undefined;
                    }
                    for (var i = 0; i < entries.length; i++) {
                        if (entries[i] && entries[i].eventName === eventName) {
                            return entries[i];
                        }
                    }
                    return entries[fallbackIndex];
                };

                var publishAggregatedNumbers = function (stats) {
                    var entries = stats ? stats.data : undefined;
                    var jdState = pickEvent(entries, "jdState", 0);
                    var aggregated = pickEvent(entries, "aggregatedNumbers", 1);
                    if (!jdState || !jdState.eventData || !aggregated || !aggregated.eventData) {
                        return;
                    }
                    var numbers = aggregated.eventData.data || {};
                    notifyStatus({
                        data: {
                            state: jdState.eventData.data,
                            eta: numbers.eta,
                            speed: numbers.downloadSpeed,
                            done: numbers.loadedBytes,
                            total: numbers.totalBytes
                        }
                    });
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
                    // A slow cloud round trip must not stack up requests
                    // behind a caller that polls on a fixed interval.
                    if (pollInFlight) {
                        return;
                    }

                    var request = this.getAggregatedNumbers();
                    if (!request || typeof request.done !== 'function') {
                        // MyjdService.send() returns undefined until the
                        // session has been restored from storage.
                        notifyStatus({error: "API not connected"});
                        return;
                    }

                    pollInFlight = true;
                    request.done(function (stats) {
                        pollInFlight = false;
                        publishAggregatedNumbers(stats);
                    }).fail(function (error) {
                        pollInFlight = false;
                        notifyStatus({error: error});
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
