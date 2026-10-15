(function() {
'use strict';

// JDownloader's browser solver serves its challenge pages on the loopback
// interface: http://127.0.0.1:<port>/captcha/<type>/<siteDomain>?id=<challengeId>
// where <type> is recaptchav2, recaptchav3 or hcaptcha.
//
// None of those pages contains a widget or loads a provider api.js:
// recaptcha.html and hcaptcha.html are the same "Browser extension required"
// page, because the challenge has to run on the hoster's own domain. The
// challenge data sits in meta tags for the extension to pick up, which is what
// the MV2 extension's browserSolverEnhancer.js did. That hand-off was not
// ported to MV3, so the tab just sits on the install page while
// captchaSolverContentscript.js polls for a token that can never appear
// (issues #5, #22, #25).
//
// This bridge reads the meta tags and hands the job to the service worker,
// which navigates the tab to the hoster URL with #rc2jdt where
// myjdCaptchaSolver.js renders and solves the challenge. The token then travels
// back through the existing captcha-solved handler to JDownloader's callback.

var isLoopback = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(window.location.origin);
if (!isLoopback) return;

// RecaptchaV2Challenge.getCaptchaNameSpace() / HCaptchaChallenge in JDownloader
var typeMatch = /^\/captcha\/(recaptchav2|recaptchav3|hcaptcha)\//.exec(window.location.pathname);
if (!typeMatch) return;

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
if (!siteKey || !siteUrl || !/^https?:\/\//i.test(siteUrl)) {
    console.log('[JD Browser Solver Bridge] No usable challenge data on this page, leaving it alone');
    return;
}

// JDownloader writes the v3 action as a JSON map, {"action":"login"}; the
// solver passes it to grecaptcha.execute() as { action: v3action }.
function v3ActionName(raw) {
    if (!raw) return '';
    try {
        var parsed = JSON.parse(raw);
        return (parsed && typeof parsed.action === 'string') ? parsed.action : '';
    } catch (e) {
        return raw;
    }
}

var pathParts = window.location.pathname.split('/');
var jobDetails = {
    captchaType: typeMatch[1],
    siteKey: siteKey,
    siteKeyType: meta('sitekeyType') || '',
    v3action: v3ActionName(meta('v3action')),
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
