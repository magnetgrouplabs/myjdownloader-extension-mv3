'use strict';

(function () {
    var root = document.documentElement;

    // Mark the context: the in-page toolbar (toolbar.html) should get dark
    // components but keep a transparent body backdrop, so the overlay does not
    // sit as a dark box on arbitrary web pages.
    if ((location.pathname || '').indexOf('toolbar.html') !== -1) {
        root.setAttribute('data-context', 'toolbar');
    }

    function resolve(mode) {
        if (mode === 'dark') return 'dark';
        if (mode === 'light') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function apply(mode) {
        root.setAttribute('data-theme', resolve(mode));
    }

    apply('system');

    function reapplyFromStorage() {
        try {
            chrome.storage.local.get('THEME_MODE', function (data) {
                apply((data && data.THEME_MODE) || 'system');
            });
        } catch (e) { /* storage not available in this context */ }
    }

    reapplyFromStorage();

    try {
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area === 'local' && changes.THEME_MODE) {
                apply(changes.THEME_MODE.newValue || 'system');
            }
        });
    } catch (e) { /* onChanged not available */ }

    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reapplyFromStorage);
    } catch (e) { /* matchMedia listener not available */ }
})();
