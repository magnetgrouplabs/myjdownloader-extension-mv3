"use strict";

angular.module('myjdWebextensionApp')
    .service('ClipboardHistoryService', [
        function () {
            this.ITEM_TYPE = {
                TEXT: "text",
                LINK: "link",
                CNL: "cnl"
            }
        }]);