'use strict';

angular.module('myjdWebextensionApp')
    .service('CaptchaNativeService', ['$q', '$http', function ($q, $http) {
        const NATIVE_HOST_NAME = 'org.jdownloader.captcha_helper';
        const APP_KEY = 'myjd-captcha-helper-0.1.0';

        function sendNativeMessage(message) {
            const deferred = $q.defer();
            
            try {
                chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, function (response) {
                    if (chrome.runtime.lastError) {
                        deferred.reject({
                            status: 'error',
                            error: chrome.runtime.lastError.message
                        });
                    } else if (response && response.status === 'error') {
                        deferred.reject(response);
                    } else {
                        deferred.resolve(response);
                    }
                });
            } catch (e) {
                deferred.reject({
                    status: 'error',
                    error: e.message || 'Failed to send native message'
                });
            }
            
            return deferred.promise;
        }

        function submitTokenToJDownloader(callbackUrl, token, captchaId) {
            const deferred = $q.defer();
            
            if (callbackUrl === 'MYJD') {
                // Send via My.JDownloader API - find web interface tab and post message
                chrome.tabs.query({
                    url: [
                        'http://my.jdownloader.org/*',
                        'https://my.jdownloader.org/*'
                    ]
                }, function(tabs) {
                    if (tabs && tabs.length > 0) {
                        for (let i = 0; i < tabs.length; i++) {
                            chrome.tabs.sendMessage(tabs[i].id, {
                                name: 'response',
                                type: 'myjdrc2',
                                data: { captchaId: captchaId, token: token }
                            });
                        }
                        deferred.resolve({ submitted: true });
                    } else {
                        deferred.reject({ error: 'No My.JDownloader tab found' });
                    }
                });
            } else {
                // Send via HTTP callback to localhost JDownloader
                const url = callbackUrl + '&do=solve&response=' + encodeURIComponent(token);
                $http.get(url, {
                    headers: { 'X-Myjd-Appkey': APP_KEY },
                    timeout: 10000
                }).then(function(response) {
                    deferred.resolve({ submitted: true, response: response });
                }).catch(function(error) {
                    deferred.reject({ error: error });
                });
            }
            
            return deferred.promise;
        }

        this.sendCaptcha = function (captchaJob) {
            const message = {
                action: 'captcha_new',
                siteKey: captchaJob.siteKey,
                siteKeyType: captchaJob.siteKeyType || 'normal',
                challengeType: captchaJob.challengeType,
                callbackUrl: captchaJob.callbackUrl,
                captchaId: captchaJob.captchaId,
                hoster: captchaJob.hoster || '',
                v3action: captchaJob.v3action || '',
                enterprise: captchaJob.enterprise || false,
                siteUrl: captchaJob.siteUrl || '',
                siteDomain: captchaJob.siteDomain || ''
            };
            
            return sendNativeMessage(message).then(function(response) {
                // Handle different response statuses
                if (response.status === 'solved' && response.token) {
                    // Token received from native helper - submit to JDownloader
                    return submitTokenToJDownloader(
                        captchaJob.callbackUrl,
                        response.token,
                        captchaJob.captchaId
                    ).then(function() {
                        return { status: 'solved', token: response.token };
                    });
                } else if (response.status === 'skipped') {
                    return { status: 'skipped', skipType: response.skipType };
                } else if (response.status === 'cancelled') {
                    return { status: 'cancelled' };
                } else if (response.status === 'timeout') {
                    return { status: 'timeout' };
                } else {
                    return response;
                }
            });
        };

        this.skipCaptcha = function (callbackUrl, skipType) {
            const message = {
                action: 'skip',
                callbackUrl: callbackUrl,
                skipType: skipType || 'single'
            };
            
            return sendNativeMessage(message);
        };

        this.cancelCaptcha = function (callbackUrl) {
            const message = {
                action: 'cancel',
                callbackUrl: callbackUrl
            };
            
            return sendNativeMessage(message);
        };

        this.checkStatus = function () {
            const message = {
                action: 'status'
            };
            
            return sendNativeMessage(message);
        };
    }]);