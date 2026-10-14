'use strict';

const fs = require('fs');
const path = require('path');

const bgSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'background.js'), 'utf8'
);
const offscreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'offscreen.js'), 'utf8'
);

function extractFunction(source, name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const startMatch = source.match(re);
  if (!startMatch) throw new Error('function not found: ' + name);
  const start = startMatch.index;
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return source.slice(start, i);
}

describe('Manual remote MyJD captcha open (icon click)', () => {
  describe('jobDetails mapping (mapCaptchaJobToDetails)', () => {
    const mapCaptchaJobToDetails = new Function(
      'return (' + extractFunction(bgSource, 'mapCaptchaJobToDetails') + ');'
    )();

    it('maps list job + rawtoken challenge into the Rc2Service jobDetails shape', () => {
      const details = mapCaptchaJobToDetails(
        { id: 42, hoster: 'upstore.net', type: 'hcaptcha', challengeType: 'hcaptcha' },
        { siteKey: 'site-key-abc', type: 'NORMAL', siteUrl: 'https://upstore.net/file/xyz', v3Action: null },
        'device-1'
      );
      expect(details).toEqual({
        captchaId: 42,
        captchaType: 'hcaptcha',
        hoster: 'upstore.net',
        siteKey: 'site-key-abc',
        siteKeyType: 'NORMAL',
        v3action: null,
        targetUrl: 'https://upstore.net/file/xyz',
        callbackUrl: 'MYJD',
        deviceId: 'device-1'
      });
    });

    it('falls back to contextUrl when siteUrl is missing', () => {
      const details = mapCaptchaJobToDetails(
        { id: 7, hoster: 'ddownload.com', type: 'recaptchav2' },
        { siteKey: 'k', type: 'NORMAL', contextUrl: 'https://ddownload.com/d/1' },
        'dev'
      );
      expect(details.targetUrl).toBe('https://ddownload.com/d/1');
    });
  });

  describe('browser-solvable filter', () => {
    const isBrowserSolvableCaptcha = new Function(
      'return (' + extractFunction(bgSource, 'isBrowserSolvableCaptcha') + ');'
    )();

    it('accepts hcaptcha with siteKey and targetUrl', () => {
      expect(isBrowserSolvableCaptcha({
        captchaType: 'hcaptcha', siteKey: 'k', targetUrl: 'https://x.com'
      })).toBe(true);
    });

    it('accepts recaptchav2 with siteKey and targetUrl', () => {
      expect(isBrowserSolvableCaptcha({
        captchaType: 'recaptchav2', siteKey: 'k', targetUrl: 'https://x.com'
      })).toBe(true);
    });

    it('rejects challenges without a siteKey (image captchas)', () => {
      expect(isBrowserSolvableCaptcha({
        captchaType: 'BasicCaptcha', siteKey: null, targetUrl: 'https://x.com'
      })).toBe(false);
    });
  });

  describe('prepareCaptchaTab creates a tab when tabId is missing', () => {
    it('source calls chrome.tabs.create when tabId is null', () => {
      expect(bgSource).toMatch(/tabs\.create\(\s*\{\s*url:\s*'about:blank'/);
      expect(bgSource).toMatch(/tabId == null \|\| tabId < 0/);
    });

    it('awaits CSP strip rule then navigates via buildCaptchaTabUrl', () => {
      expect(bgSource).toMatch(/function buildCaptchaTabUrl/);
      expect(bgSource).toMatch(/await addCspStrippingRule\(tabId\)/);
      expect(bgSource).toMatch(/const captchaUrl = buildCaptchaTabUrl\(jobDetails\.targetUrl\)/);
      expect(bgSource).toMatch(/chrome\.tabs\.update\(tabId,\s*\{\s*url:\s*captchaUrl\s*\}\)/);
    });
  });

  describe('buildCaptchaTabUrl', () => {
    const buildCaptchaTabUrl = new Function(
      'return (' + extractFunction(bgSource, 'buildCaptchaTabUrl') + ');'
    )();

    it('forces https and #rc2jdt hash', () => {
      expect(buildCaptchaTabUrl('http://upstore.net/abc')).toBe('https://upstore.net/abc#rc2jdt');
    });

    it('adds https when scheme is missing', () => {
      expect(buildCaptchaTabUrl('upstore.net/abc')).toBe('https://upstore.net/abc#rc2jdt');
    });

    it('replaces an existing hash so the content-script gate still matches', () => {
      expect(buildCaptchaTabUrl('https://upstore.net/abc#section')).toBe('https://upstore.net/abc#rc2jdt');
    });
  });

  describe('dedupe / focus', () => {
    it('tracks remoteCaptchaOpen and finds existing tabs', () => {
      expect(bgSource).toMatch(/const remoteCaptchaOpen = \{\}/);
      expect(bgSource).toMatch(/function findTabIdForCaptcha/);
      expect(bgSource).toMatch(/function pruneStaleRemoteCaptchaOpen/);
    });

    it('focuses an already-open tab instead of opening a duplicate', () => {
      expect(bgSource).toMatch(/findTabIdForCaptcha\(captchaId\)/);
      expect(bgSource).toMatch(/chrome\.tabs\.update\(existingTabId,\s*\{\s*active:\s*true\s*\}\)/);
    });
  });

  describe('icon / captcha-new message handlers', () => {
    it('myjd-webui-captcha-click opens pending captchas manually', () => {
      expect(bgSource).toMatch(/action === ["']myjd-webui-captcha-click["']/);
      expect(bgSource).toMatch(/openPendingRemoteCaptchas\(\{\s*manual:\s*true/);
    });

    it('forwards legacy myjdrc2 captcha-new through the same manual open path', () => {
      expect(bgSource).toMatch(/action === ["']captcha-new["']/);
      expect(bgSource).toMatch(/request\.name === ["']myjdrc2["']/);
    });

    it('does not wire AUTO_OPEN_REMOTE_CAPTCHA settings or a poll alarm', () => {
      expect(bgSource).not.toMatch(/STORAGE_KEYS\.AUTO_OPEN_REMOTE_CAPTCHA/);
      expect(bgSource).not.toMatch(/function syncRemoteCaptchaAlarm/);
      expect(bgSource).not.toMatch(/function pollRemoteCaptchas/);
      expect(bgSource).not.toMatch(/REMOTE_CAPTCHA_ALARM/);
    });
  });

  describe('MyJD solve via device API', () => {
    it('exposes solveCaptchaViaMyJdApi that calls offscreen-captcha-solve', () => {
      expect(bgSource).toMatch(/function solveCaptchaViaMyJdApi/);
      expect(bgSource).toMatch(/offscreen-captcha-solve/);
    });

    it('captcha-solved MYJD path prefers the device API before web UI tabs', () => {
      expect(bgSource).toMatch(/action === ["']captcha-solved["']/);
      expect(bgSource).toMatch(/solveCaptchaViaMyJdApi\(solvedDeviceId/);
      expect(bgSource).toMatch(/falling back to web UI tabs/);
    });
  });

  describe('offscreen captcha list/get/solve for the icon path', () => {
    it('defines list, get, and solve handlers', () => {
      expect(offscreenSource).toMatch(/offscreen-captcha-list/);
      expect(offscreenSource).toMatch(/offscreen-captcha-get/);
      expect(offscreenSource).toMatch(/offscreen-captcha-solve/);
    });

    it('routes through setActiveDevice + api.send (not hardcoded api.jdownloader.org)', () => {
      expect(offscreenSource).toMatch(/function sendCaptchaDeviceCall/);
      expect(offscreenSource).toMatch(/api\.setActiveDevice\(deviceId\)/);
      expect(offscreenSource).toMatch(/api\.send\(action,\s*params\)/);
      const captchaSection = offscreenSource.slice(offscreenSource.indexOf('sendCaptchaDeviceCall'));
      expect(captchaSection).not.toMatch(/https:\/\/api\.jdownloader\.org\/captcha/);
    });

    it('retries via relay after clearing localURL on direct-path failure', () => {
      expect(offscreenSource).toMatch(/setLocalURL\(null\)/);
      expect(offscreenSource).toMatch(/retrying via cloud relay/);
    });

    it('uses /captcha/list, /captcha/getCaptchaJob, /captcha/get rawtoken, /captcha/solve', () => {
      expect(offscreenSource).toMatch(/\/captcha\/list/);
      expect(offscreenSource).toMatch(/\/captcha\/getCaptchaJob/);
      expect(offscreenSource).toMatch(/'rawtoken'/);
      expect(offscreenSource).toMatch(/\/captcha\/solve/);
    });
  });
});
