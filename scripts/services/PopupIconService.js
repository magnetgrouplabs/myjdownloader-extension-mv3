'use strict';

angular.module('myjdWebextensionApp')
    .service('PopupIconService', [
        function () {
            this.updateBadge = function (attributes) {
                // MV3: chrome.action is only available in service worker, not popup
                // In popup context, we need to send a message to the background script
                // For now, just log a warning if API is not available
                var actionApi = typeof chrome !== 'undefined' && (chrome.action || chrome.browserAction);

                if (actionApi) {
                    try {
                        if (attributes.color !== undefined) {
                            actionApi.setBadgeBackgroundColor({color: attributes.color}, function() {
                                if (chrome.runtime.lastError) {
                                    // Ignore - popup context may not have permission
                                }
                            });
                        }
                        if (attributes.text !== undefined) {
                            actionApi.setBadgeText({text: attributes.text}, function() {
                                if (chrome.runtime.lastError) {
                                    // Ignore - popup context may not have permission
                                }
                            });
                        }
                    } catch (e) {
                        // API may not be available in popup context - this is OK
                        // Badge updates should go through background script messaging
                    }
                } else {
                    // In popup context, send message to background to update badge
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({
                            action: 'update-badge',
                            data: attributes
                        }, function() {
                            if (chrome.runtime.lastError) {
                                // Ignore connection errors
                            }
                        });
                    }
                }
            }
        }]);