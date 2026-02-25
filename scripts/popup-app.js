'use strict';

/**
 * Popup-specific Angular module definition.
 *
 * This file replaces app.js in the popup context. It creates the Angular module
 * with ONLY the routes relevant to the popup (no BackgroundCtrl / '/' route).
 *
 * In the old MV2 extension, popup.html loaded its own popup.js which created
 * a separate module instance with only the /popup route. index.html (background)
 * loaded app.js with the full route table. MV3 has no persistent background page,
 * so the popup is the primary UI context.
 */

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
            .when('/add-links', {
                templateUrl: 'partials/directives/myaddlinkspanel.html',
                controller: 'AddLinksCtrl',
                controllerAs: 'addLinks'
            })
            .when('/settings', {
                templateUrl: 'partials/controllers/settings.html',
                controller: 'SettingsCtrl',
                controllerAs: 'settings'
            })
            .otherwise({
                redirectTo: '/popup'
            });
    });
