(function() {
'use strict';

// CAP-01: Only activate on JDownloader CAPTCHA URL paths
var captchaPathPattern = /\/captcha\/(recaptchav2|recaptchav3|hcaptcha)\//;
if (!captchaPathPattern.test(window.location.pathname)) return;

// Extract metadata from URL
var pathParts = window.location.pathname.split('/');
var captchaType = pathParts[2];  // recaptchav2, recaptchav3, or hcaptcha
var hoster = decodeURIComponent(pathParts[3] || 'Unknown');
var captchaId = new URLSearchParams(window.location.search).get('id');
var callbackUrl = window.location.href;

// Interval handles for cleanup
var pollingHandle = null;
var countdownHandle = null;

// Send captcha-tab-detected message to service worker
chrome.runtime.sendMessage({
    action: 'captcha-tab-detected',
    data: {
        callbackUrl: callbackUrl,
        captchaType: captchaType,
        hoster: hoster,
        captchaId: captchaId
    }
});

// CAP-05: Inject skip buttons
injectSkipButtons(callbackUrl, hoster);

// CAP-02, CAP-10: Start token polling
pollingHandle = startTokenPolling(callbackUrl);

// CAP-06: Start countdown timer
startCountdown(callbackUrl);

// Cleanup on unload to prevent memory leaks
window.addEventListener('beforeunload', function() {
    if (pollingHandle) clearInterval(pollingHandle);
    if (countdownHandle) clearInterval(countdownHandle);
});

/**
 * CAP-02, CAP-10: Poll for solved CAPTCHA tokens
 * Checks both reCAPTCHA and hCaptcha textareas at 500ms interval.
 */
function startTokenPolling(callbackUrl) {
    var handle = setInterval(function() {
        // reCAPTCHA v2/v3: textarea id starts with "g-recaptcha-response"
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
                        callbackUrl: callbackUrl
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
                        callbackUrl: callbackUrl
                    }
                });
                return;
            }
        }
    }, 500);

    return handle;
}

/**
 * CAP-05: Inject skip buttons with extension-themed styling.
 * Uses event delegation on the container for MV3 CSP compliance.
 */
function injectSkipButtons(callbackUrl, hoster) {
    var container = document.createElement('div');
    container.id = 'myjd-captcha-controls';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.marginTop = '16px';

    var buttons = [
        { type: 'hoster', label: 'Skip ' + hoster + ' CAPTCHAs' },
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

        // Hover effects via mouseenter/mouseleave
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
                    callbackUrl: callbackUrl,
                    skipType: skipType
                }
            });
        }
    });

    document.body.appendChild(container);
}

/**
 * CAP-06: 5-minute countdown timer with visual urgency.
 * Sends skip(single) on expiry.
 */
function startCountdown(callbackUrl) {
    var TIMEOUT_MS = 5 * 60 * 1000; // 300000ms = 5 minutes
    var startTime = Date.now();

    var timerEl = document.createElement('div');
    timerEl.id = 'myjd-countdown';
    timerEl.style.textAlign = 'center';
    timerEl.style.marginTop = '12px';
    timerEl.style.fontSize = '14px';
    timerEl.style.color = '#666';
    document.body.appendChild(timerEl);

    countdownHandle = setInterval(function() {
        var elapsed = Date.now() - startTime;
        var remaining = Math.max(0, TIMEOUT_MS - elapsed);
        var minutes = Math.floor(remaining / 60000);
        var seconds = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = 'Time remaining: ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

        // Visual urgency: red + bold when under 60 seconds
        if (remaining < 60000) {
            timerEl.style.color = '#f44336';
            timerEl.style.fontWeight = 'bold';
        }

        if (remaining <= 0) {
            clearInterval(countdownHandle);
            countdownHandle = null;
            // Also clear token polling on timeout
            if (pollingHandle) {
                clearInterval(pollingHandle);
                pollingHandle = null;
            }
            timerEl.textContent = 'Timed out - skipping...';
            chrome.runtime.sendMessage({
                action: 'captcha-skip',
                data: {
                    callbackUrl: callbackUrl,
                    skipType: 'single'
                }
            });
        }
    }, 1000);
}

})();
