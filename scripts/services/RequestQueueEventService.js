'use strict';

angular.module('myjdWebextensionApp')
    .service('RequestQueueEventService', [
        function () {
            this.Events = {
                REQUEST_QUEUE_LINK_ADDED: "REQUEST_QUEUE_LINK_ADDED",
                REQUEST_QUEUE_LINK_REMOVED: "REQUEST_QUEUE_LINK_REMOVED",
                REQUEST_QUEUE_LINK_CHANGED: "REQUEST_QUEUE_LINK_CHANGED",
                REQUEST_QUEUE_CHANGED: "REQUEST_QUEUE_CHANGED",
                ADD_LINKS_DIALOG_CLOSE: "ADD_LINKS_DIALOG_CLOSE",
                HIDE_REQUEST_QUEUE: "HIDE_REQUEST_QUEUE",
                COUNTDOWN_FINISHED_SEND_LINKS: "COUNTDOWN_FINISHED_SEND_LINKS",
                SESSION_RECEIVED: "SESSION_RECEIVED",
                DEVICES_RECEIVED: "DEVICES_RECEIVED"
            };
        }
    ]);