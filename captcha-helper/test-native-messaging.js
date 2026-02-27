const log = document.getElementById('log');

function logMsg(msg, type) {
    const logEl = document.getElementById('log');
    const span = document.createElement('span');
    span.className = type || '';
    span.textContent = msg + '\n';
    logEl.appendChild(span);
    logEl.scrollTop = logEl.scrollHeight;
}

function send(msg) {
    logMsg('→ ' + JSON.stringify(msg), 'info');
    chrome.runtime.sendNativeMessage('org.jdownloader.captcha_helper', msg, response => {
        if (chrome.runtime.lastError) {
            logMsg('← Error: ' + chrome.runtime.lastError.message, 'error');
        } else {
            logMsg('← ' + JSON.stringify(response), 'success');
        }
    });
}

document.getElementById('status').addEventListener('click', () => {
    send({action: 'status'});
});

document.getElementById('testV2').addEventListener('click', () => {
    const siteKey = document.getElementById('siteKeyV2').value;
    send({
        action: 'captcha_new',
        siteKey: siteKey,
        siteKeyType: 'normal',
        challengeType: 'recaptchav2',
        callbackUrl: 'http://127.0.0.1:9666/captcha/recaptchav2/test?id=TEST',
        hoster: 'test.local'
    });
});

document.getElementById('testV3').addEventListener('click', () => {
    const siteKey = document.getElementById('siteKeyV3').value;
    send({
        action: 'captcha_new',
        siteKey: siteKey,
        siteKeyType: 'INVISIBLE',
        challengeType: 'recaptchav3',
        callbackUrl: 'http://127.0.0.1:9666/captcha/recaptchav3/test?id=TEST',
        hoster: 'test.local'
    });
});

document.getElementById('testHCaptcha').addEventListener('click', () => {
    const siteKey = document.getElementById('siteKeyHCaptcha').value;
    send({
        action: 'captcha_new',
        siteKey: siteKey,
        siteKeyType: 'normal',
        challengeType: 'HCaptchaChallenge',
        callbackUrl: 'http://127.0.0.1:9666/captcha/hcaptcha/test?id=TEST',
        hoster: 'test.local'
    });
});

document.getElementById('testCustom').addEventListener('click', () => {
    const siteKey = document.getElementById('customSiteKey').value;
    const type = document.getElementById('customType').value;
    const hoster = document.getElementById('customHoster').value;
    if (!siteKey) { logMsg('Error: Enter a site key', 'error'); return; }
    send({
        action: 'captcha_new',
        siteKey: siteKey,
        siteKeyType: 'normal',
        challengeType: type,
        callbackUrl: 'http://127.0.0.1:9666/captcha/test?id=TEST',
        hoster: hoster
    });
});

// Test mode button - generates a fake CAPTCHA for testing the window
document.getElementById('testMode').addEventListener('click', () => {
    send({
        action: 'captcha_new',
        siteKey: 'test-mode',
        siteKeyType: 'normal',
        challengeType: 'recaptchav2',
        callbackUrl: 'http://127.0.0.1:9666/captcha/test?id=TEST',
        hoster: 'TEST MODE - Click to Solve',
        test: true
    });
});

document.getElementById('skipHoster').addEventListener('click', () => {
    const url = document.getElementById('skipCallbackUrl').value;
    if (!url) { logMsg('Error: Enter callback URL', 'error'); return; }
    send({action: 'skip', callbackUrl: url, skipType: 'hoster'});
});

document.getElementById('skipPackage').addEventListener('click', () => {
    const url = document.getElementById('skipCallbackUrl').value;
    if (!url) { logMsg('Error: Enter callback URL', 'error'); return; }
    send({action: 'skip', callbackUrl: url, skipType: 'package'});
});

document.getElementById('skipAll').addEventListener('click', () => {
    const url = document.getElementById('skipCallbackUrl').value;
    if (!url) { logMsg('Error: Enter callback URL', 'error'); return; }
    send({action: 'skip', callbackUrl: url, skipType: 'all'});
});

document.getElementById('cancel').addEventListener('click', () => {
    const url = document.getElementById('skipCallbackUrl').value;
    if (!url) { logMsg('Error: Enter callback URL', 'error'); return; }
    send({action: 'cancel', callbackUrl: url, captchaId: 'TEST'});
});

document.getElementById('clearLog').addEventListener('click', () => {
    document.getElementById('log').textContent = '';
});