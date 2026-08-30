'use strict';

/**
 * Popup bootstrap script.
 *
 * Loads jdapi via RequireJS, then bootstraps the Angular application.
 * This runs AFTER all Angular services/controllers/directives have been
 * registered (they're loaded via <script> tags before this file).
 *
 * The module is created by popup-app.js (loaded earlier in popup.html).
 */

console.log('popup.js: Configuring RequireJS...');
require.config({
    baseUrl: 'vendor/js',
    paths: {
        'jdapi': 'jdapi'
    }
});

console.log('popup.js: Loading jdapi via RequireJS...');
require(['jdapi'], function (API) {
    console.log('popup.js: jdapi loaded, API type:', typeof API);

    // Export to global scope so MyjdService can find it
    window.API = API;

    // Bootstrap Angular
    console.log('popup.js: Bootstrapping Angular...');
    angular.element(document).ready(function () {
        try {
            angular.bootstrap(document, ['myjdWebextensionApp']);
            console.log('popup.js: Angular bootstrapped successfully');
        } catch (e) {
            console.error('popup.js: Angular bootstrap failed:', e);
        }
    });
}, function(err) {
    console.error('popup.js: Failed to load jdapi via RequireJS:', err);
    // Fallback: bootstrap anyway so user sees an error message
    angular.element(document).ready(function () {
        angular.bootstrap(document, ['myjdWebextensionApp']);
    });
});
