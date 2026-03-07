(function() {
'use strict';

// Hash gate: only activate on pages navigated to with #rc2jdt hash
if (!location.hash.startsWith('#rc2jdt')) return;

// --- DOM replacement (defense-in-depth) ---

// Strategy 1: Immediately replace the entire document
document.open();
document.close();

// Build placeholder DOM using createElement only (no inline scripts)
var body = document.createElement('body');
body.id = 'myjd-captcha-body';
body.style.background = '#3c686f';
body.style.color = '#fff';
body.style.fontFamily = 'Arial, sans-serif';
body.style.padding = '32px';
body.style.margin = '0';
var loadingMsg = document.createElement('div');
loadingMsg.textContent = 'Loading CAPTCHA solver...';
loadingMsg.style.textAlign = 'center';
loadingMsg.style.fontSize = '18px';
loadingMsg.style.marginTop = '40px';
body.appendChild(loadingMsg);
document.documentElement.appendChild(body);

// Strategy 2: On readystatechange, clear foreign DOM
var clearDocument = function() {
    var html = document.documentElement;
    if (!html) return;
    var i;
    for (i = html.childNodes.length - 1; i >= 0; i--) {
        var child = html.childNodes[i];
        if (child.nodeName === 'BODY' && child.id === 'myjd-captcha-body') continue;
        if (child.nodeName === 'HEAD') {
            while (child.firstChild) child.removeChild(child.firstChild);
            continue;
        }
        if (child.nodeName !== 'BODY') html.removeChild(child);
    }
};
document.addEventListener('readystatechange', clearDocument);

// Strategy 3: On DOMContentLoaded, remove foreign body elements
document.addEventListener('DOMContentLoaded', function() {
    var bodies = document.querySelectorAll('body');
    var k;
    for (k = 0; k < bodies.length; k++) {
        if (bodies[k].id !== 'myjd-captcha-body') {
            bodies[k].parentNode.removeChild(bodies[k]);
        }
    }
});

// --- Interval handles for cleanup ---
var pollingHandle = null;
var countdownHandle = null;

// --- Read job data from chrome.storage.session ---
chrome.storage.session.get('myjd_captcha_job', function(result) {
    var job = result && result.myjd_captcha_job;
    if (!job) {
        while (body.firstChild) body.removeChild(body.firstChild);
        var errMsg = document.createElement('div');
        errMsg.textContent = 'No CAPTCHA job found. Please try again from the MyJDownloader web interface.';
        errMsg.style.textAlign = 'center';
        errMsg.style.fontSize = '16px';
        errMsg.style.marginTop = '40px';
        body.appendChild(errMsg);
        return;
    }
    renderCaptchaWidget(job);
});

/**
 * Render the CAPTCHA widget, skip buttons, countdown timer, and start token polling.
 */
function renderCaptchaWidget(job) {
    // Clear document head and body children
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
        while (head.firstChild) head.removeChild(head.firstChild);
    }
    while (body.firstChild) body.removeChild(body.firstChild);

    // Set page title
    document.title = 'CAPTCHA - ' + (job.hoster || 'JDownloader');

    // Restyle body for CAPTCHA display
    body.style.background = '#f5f5f5';
    body.style.color = '#333';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';
    body.style.padding = '32px';
    body.style.maxWidth = '600px';
    body.style.margin = '0 auto';

    // Header
    var header = document.createElement('h2');
    header.textContent = 'CAPTCHA for ' + (job.hoster || 'Unknown');
    header.style.marginBottom = '24px';
    header.style.color = '#333';
    body.appendChild(header);

    // CAPTCHA container
    var captchaContainer = document.createElement('div');
    captchaContainer.id = 'captchaContainer';
    captchaContainer.style.marginBottom = '20px';
    body.appendChild(captchaContainer);

    // Determine CAPTCHA type and create widget + script
    var isHcaptcha = job.captchaType && (job.captchaType.toLowerCase().indexOf('hcaptcha') !== -1);
    var widgetDiv = document.createElement('div');
    var script = document.createElement('script');

    if (isHcaptcha) {
        widgetDiv.className = 'h-captcha';
        widgetDiv.setAttribute('data-sitekey', job.siteKey);
        script.src = 'https://hcaptcha.com/1/api.js';
    } else {
        widgetDiv.className = 'g-recaptcha';
        widgetDiv.setAttribute('data-sitekey', job.siteKey);
        if (job.siteKeyType === 'INVISIBLE') {
            widgetDiv.setAttribute('data-size', 'invisible');
        }
        script.src = 'https://www.google.com/recaptcha/api.js';
    }

    captchaContainer.appendChild(widgetDiv);

    // For invisible/v3 CAPTCHAs, request MAIN world execution after script loads
    if (job.siteKeyType === 'INVISIBLE') {
        script.addEventListener('load', function() {
            chrome.runtime.sendMessage({
                action: 'myjd-captcha-execute',
                data: { siteKey: job.siteKey, v3action: job.v3action || '' }
            });
        });
    }

    // Load CAPTCHA API script as external element (MV3 CSP compliant)
    captchaContainer.appendChild(script);

    // --- Skip buttons ---
    injectSkipButtons(job);

    // --- Countdown timer ---
    startCountdown(job);

    // --- Token polling ---
    pollingHandle = startTokenPolling(job);
}

/**
 * Inject skip buttons with extension-themed styling.
 * Uses event delegation on the container for MV3 CSP compliance.
 */
function injectSkipButtons(job) {
    var container = document.createElement('div');
    container.id = 'myjd-captcha-controls';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.marginTop = '16px';

    var buttons = [
        { type: 'hoster', label: 'Skip ' + (job.hoster || 'Hoster') + ' CAPTCHAs' },
        { type: 'package', label: 'Skip Package' },
        { type: 'all', label: 'Skip All' },
        { type: 'single', label: 'Skip This' }
    ];

    var j;
    for (j = 0; j < buttons.length; j++) {
        var btn = document.createElement('button');
        btn.textContent = buttons[j].label;
        btn.dataset.skipType = buttons[j].type;
        btn.style.padding = '8px 16px';
        btn.style.border = '1px solid #2196F3';
        btn.style.borderRadius = '4px';
        btn.style.background = '#fff';
        btn.style.color = '#2196F3';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '13px';

        btn.addEventListener('mouseenter', function() {
            this.style.background = '#2196F3';
            this.style.color = '#fff';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.background = '#fff';
            this.style.color = '#2196F3';
        });

        container.appendChild(btn);
    }

    // Event delegation: single click listener on container
    container.addEventListener('click', function(e) {
        var skipType = e.target.dataset.skipType;
        if (skipType) {
            chrome.runtime.sendMessage({
                action: 'captcha-skip',
                data: {
                    callbackUrl: 'MYJD',
                    captchaId: job.captchaId,
                    skipType: skipType
                }
            });
        }
    });

    body.appendChild(container);
}

/**
 * Poll for solved CAPTCHA tokens at 500ms interval.
 * Checks both reCAPTCHA and hCaptcha textareas.
 */
function startTokenPolling(job) {
    var handle = setInterval(function() {
        // reCAPTCHA: textarea id starts with "g-recaptcha-response"
        var recaptchaTextareas = document.querySelectorAll('textarea[id^="g-recaptcha-response"]');
        var i;
        for (i = 0; i < recaptchaTextareas.length; i++) {
            if (recaptchaTextareas[i].value && recaptchaTextareas[i].value.length > 30) {
                clearInterval(handle);
                pollingHandle = null;
                chrome.runtime.sendMessage({
                    action: 'captcha-solved',
                    data: {
                        token: recaptchaTextareas[i].value,
                        callbackUrl: 'MYJD',
                        captchaId: job.captchaId
                    }
                });
                return;
            }
        }

        // hCaptcha: textarea name is "h-captcha-response"
        var hcaptchaTextareas = document.querySelectorAll('textarea[name="h-captcha-response"]');
        for (i = 0; i < hcaptchaTextareas.length; i++) {
            if (hcaptchaTextareas[i].value && hcaptchaTextareas[i].value.length > 30) {
                clearInterval(handle);
                pollingHandle = null;
                chrome.runtime.sendMessage({
                    action: 'captcha-solved',
                    data: {
                        token: hcaptchaTextareas[i].value,
                        callbackUrl: 'MYJD',
                        captchaId: job.captchaId
                    }
                });
                return;
            }
        }
    }, 500);

    return handle;
}

/**
 * 5-minute countdown timer with visual urgency.
 * Sends skip(single) with MYJD callbackUrl on expiry.
 */
function startCountdown(job) {
    var TIMEOUT_MS = 5 * 60 * 1000; // 300000ms = 5 minutes
    var startTime = Date.now();

    var timerEl = document.createElement('div');
    timerEl.id = 'myjd-countdown';
    timerEl.style.textAlign = 'center';
    timerEl.style.marginTop = '12px';
    timerEl.style.fontSize = '14px';
    timerEl.style.color = '#666';
    body.appendChild(timerEl);

    countdownHandle = setInterval(function() {
        var elapsed = Date.now() - startTime;
        var remaining = Math.max(0, TIMEOUT_MS - elapsed);
        var minutes = Math.floor(remaining / 60000);
        var seconds = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = 'Time remaining: ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

        if (remaining < 60000) {
            timerEl.style.color = '#f44336';
            timerEl.style.fontWeight = 'bold';
        }

        if (remaining <= 0) {
            clearInterval(countdownHandle);
            countdownHandle = null;
            if (pollingHandle) {
                clearInterval(pollingHandle);
                pollingHandle = null;
            }
            timerEl.textContent = 'Timed out - skipping...';
            chrome.runtime.sendMessage({
                action: 'captcha-skip',
                data: {
                    callbackUrl: 'MYJD',
                    captchaId: job.captchaId,
                    skipType: 'single'
                }
            });
        }
    }, 1000);
}

// Cleanup on unload to prevent memory leaks
window.addEventListener('beforeunload', function() {
    if (pollingHandle) clearInterval(pollingHandle);
    if (countdownHandle) clearInterval(countdownHandle);
});

})();
