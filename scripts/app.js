'use strict';
if (typeof browser !== 'undefined') { chrome = browser; }

angular
    .module('myjdWebextensionApp', [
        'ngAnimate',
        'ngCookies',
        'ngResource',
        'ngRoute',
        'ngSanitize',
        'ngTouch'
    ])
    .config(function ($routeProvider) {
        $routeProvider
            .when('/popup', {
                templateUrl: 'partials/controllers/popup.html',
                controller: 'PopupCtrl',
                controllerAs: 'popup'
            })
            .when('/toolbar/:instanceId', {
                templateUrl: 'partials/controllers/toolbar.html',
                controller: 'ToolbarCtrl',
                controllerAs: 'toolbar'
            })
            .when('/settings', {
                templateUrl: 'partials/controllers/settings.html',
                controller: 'SettingsCtrl',
                controllerAs: 'settings'
            })
            .when('/', {
                templateUrl: 'partials/controllers/background.html',
                controller: 'BackgroundCtrl',
                controllerAs: 'background'
            })
            .otherwise({
                redirectTo: '/popup'
            });
    });

// Module definition - bootstrap handled by popup.js
