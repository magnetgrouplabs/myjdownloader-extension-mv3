'use strict';

angular.module('myjdWebextensionApp').directive('imgErrorHide', function () {
    return {
        restrict: 'E',
        link: function (scope, element, attrs) {
            // show an image-missing image
            element.error(function () {
                element.css('display', 'none');
            });
        }
    }
});