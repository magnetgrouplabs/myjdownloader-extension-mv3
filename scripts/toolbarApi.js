// Wait for RequireJS to be available, then configure and load jdapi
(function() {
    function waitForRequire() {
        if (typeof require === 'undefined') {
            setTimeout(waitForRequire, 100);
            return;
        }

        // Configure RequireJS before any module loading
        require.config({
            baseUrl: './vendor/js',
            paths: {
                'jquery': 'jquery',
                'jdapi': 'jdapi'
            },
            waitSeconds: 60
        });

        // Load jdapi and make API global
        require(['jdapi'], function(API) {
            window.API = API;
            console.log('Toolbar API loaded globally');
        });
    }

    waitForRequire();
})();
