(function() {
'use strict';

// JDownloader's browser solver serves its challenge pages on the loopback
// interface: http://127.0.0.1:<port>/captcha/<type>/<siteDomain>?id=<challengeId>
//
// For reCAPTCHA those pages embed the widget and submit the token themselves
// (recaptcha.html reads #g-recaptcha-response and calls &do=solve), so
// captchaSolverContentscript.js is all that is needed there and this bridge
// stays out of the way.
//
// hcaptcha.html is different: it contains no hCaptcha widget and does not load
// hCaptcha's api.js at all. It is only the "Browser extension required" page,
// because hCaptcha has to run on the hoster's own domain. The challenge data
// sits in meta tags for the extension to pick up, which is what the MV2
// extension's browserSolverEnhancer.js did. That hand-off was not ported to
// MV3, so the tab just sits on the install page while
// captchaSolverContentscript.js polls for a token that can never appear
// (issue #5).
//
// This bridge reads the meta tags and hands the job to the service worker,
// which navigates the tab to the hoster URL with #rc2jdt where
// myjdCaptchaSolver.js renders and solves the challenge. The token then travels
// back through the existing captcha-solved handler to JDownloader's callback.

var isLoopback = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(window.location.origin);
if (!isLoopback) return;

// Only the challenge types whose JDownloader page cannot solve on its own.
if (!/^\/captcha\/hcaptcha\//.test(window.location.pathname)) return;

function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    var content = el && el.getAttribute('content');
    if (!content) return null;
    // Unfilled template placeholders look like %%%sitekey%%%
    if (/^%%%.*%%%$/.test(content)) return null;
    return content;
}

var siteKey = meta('sitekey');
var siteUrl = meta('siteUrl');

// Without a site key there is no challenge to take over, and without a site URL
// there is no domain to render it on. Leave the page untouched in that case
// rather than navigating the tab somewhere useless.
if (!siteKey || !siteUrl) {
    console.log('[JD Browser Solver Bridge] No usable challenge data on this page, leaving it alone');
    return;
}

var pathParts = window.location.pathname.split('/');
var jobDetails = {
    captchaType: meta('challengeType') || pathParts[2] || 'hcaptcha',
    siteKey: siteKey,
    siteKeyType: meta('sitekeyType') || '',
    v3action: meta('v3action') || '',
    hoster: meta('siteDomain') || decodeURIComponent(pathParts[3] || 'Unknown'),
    targetUrl: siteUrl,
    captchaId: meta('challengeId') || new URLSearchParams(window.location.search).get('id')
};

console.log('[JD Browser Solver Bridge] Handing', jobDetails.captchaType, 'for', jobDetails.hoster, 'to the service worker');

chrome.runtime.sendMessage({
    action: 'jd-browser-solver-job',
    data: {
        jobDetails: jobDetails,
        // JDownloader expects the token on the very URL that served this page:
        // <callbackUrl>&do=solve&response=<token>
        callbackUrl: window.location.href
    }
}, function(response) {
    void chrome.runtime.lastError;
    if (!response || response.status !== 'ok') {
        console.warn('[JD Browser Solver Bridge] Service worker did not accept the job:', response && response.error);
    }
});
})();
