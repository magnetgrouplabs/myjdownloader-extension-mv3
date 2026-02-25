"use strict";

angular.module('myjdWebextensionApp')
    .service('BackgroundScriptService', ['$q', 'ExtensionMessagingService', function ($q, ExtensionMessagingService) {
        function getSessionInfo(targetId) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "session-info", targetId);
        }

        function getUsername() {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "whoami");
        }

        function logout() {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "logout");
        }

        function login(credentials) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "login", credentials);
        }

        function getDevices(targetId) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "devices-pull", targetId);
        }

        function addLink(device, addLinkQuery) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "add-link", {
                device: device,
                query: addLinkQuery
            });
        }

        function sendFeedback(message) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "send-feedback", {
                message: message
            });
        }

        function addCnl(device, addCnlQuery) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "add-cnl", {
                device: device,
                query: addCnlQuery
            });
        }

        function onConnectionChanged(callback) {
            return ExtensionMessagingService.addListener("myjd-toolbar", "session-change", callback);
        }

        function onApiError(callback) {
            return ExtensionMessagingService.addListener("myjd-toolbar", "api-error", callback);
        }

        function onDeviceListChanged(callback) {
            return ExtensionMessagingService.addListener("myjd-toolbar", "devices-change", callback);
        }

        function onDevicePoll(deviceId, callback) {
            return ExtensionMessagingService.addListener("myjd-toolbar", "device-poll-" + deviceId, callback);
        }

        function devicePoll(device) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "device-poll", {
                device: device
            });
        }

        function startDevicePoll(device) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "device-poll-start", {
                device: device
            });
        }

        function stopDevicePoll(device) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "device-poll-stop", {
                device: device
            });
        }

        function sendApiRequest(device, action, params) {
            return ExtensionMessagingService.sendMessage("myjd-toolbar", "send-api-request", {
                device: device,
                action: action,
                params: params
            });
        }

        this.getDevices = getDevices;
        this.addLink = addLink;
        this.addCnl = addCnl;
        this.getSessionInfo = getSessionInfo;
        this.getUsername = getUsername;
        this.logout = logout;
        this.login = login;
        this.startDevicePoll = startDevicePoll;
        this.stopDevicePoll = stopDevicePoll;
        this.onConnectionChanged = onConnectionChanged;
        this.onApiError = onApiError;
        this.onDeviceListChanged = onDeviceListChanged;
        this.onDevicePoll = onDevicePoll;
        this.devicePoll = devicePoll;
        this.sendFeedback = sendFeedback;
        this.sendApiRequest = sendApiRequest;
    }]);