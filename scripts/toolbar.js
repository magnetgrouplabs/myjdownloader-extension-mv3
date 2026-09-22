'use strict';

/**
 * Toolbar-specific Angular module definition.
 * Loaded by toolbar.html (injected as iframe by toolbarContentscript.js).
 * Creates its own module instance -- toolbar is independent from popup.
 * Loads jdapi via RequireJS before bootstrapping Angular so that
 * MyjdService can create a working API connection.
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
            .when('/toolbar', {
                templateUrl: 'partials/controllers/toolbar.html',
                controller: 'ToolbarCtrl',
                controllerAs: 'toolbar'
            })
            .otherwise({
                redirectTo: '/toolbar'
            });
    });

// Load jdapi via RequireJS, then bootstrap Angular
require.config({
    baseUrl: 'vendor/js',
    paths: {
        'jdapi': 'jdapi'
    },
    waitSeconds: 30
});

require(['jdapi'], function (API) {
    console.log('[Toolbar] jdapi loaded, API type:', typeof API);
    window.API = API;
    angular.element(document).ready(function () {
        try {
            angular.bootstrap(document, ['myjdWebextensionApp']);
            console.log('[Toolbar] Angular bootstrapped successfully');
        } catch (e) {
            console.error('[Toolbar] Angular bootstrap failed:', e);
        }
    });
}, function (err) {
    console.error('[Toolbar] Failed to load jdapi:', err);
    // Bootstrap anyway so UI shows an error rather than blank
    angular.element(document).ready(function () {
        angular.bootstrap(document, ['myjdWebextensionApp']);
    });
});
