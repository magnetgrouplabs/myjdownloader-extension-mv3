'use strict';

const fs = require('fs');
const path = require('path');

// Read the source file for structural verification
const bgSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'background.js'), 'utf8'
);

describe('Background CAPTCHA Handlers (CAP-03, CAP-04, CAP-07)', () => {

  describe('CAPTCHA tab tracking', () => {
    it('should declare activeCaptchaTabs variable', () => {
      expect(bgSource).toMatch(/let\s+activeCaptchaTabs\s*=\s*\{\s*\}/);
    });
  });

  describe('captcha-tab-detected handler', () => {
    it('should store tab data in activeCaptchaTabs', () => {
      // Verify the handler stores data using sender.tab.id as key
      expect(bgSource).toMatch(/activeCaptchaTabs\[sender\.tab\.id\]\s*=/);
    });

    it('should store callbackUrl, captchaType, hoster, and captchaId', () => {
      expect(bgSource).toMatch(/callbackUrl:\s*request\.data\.callbackUrl/);
      expect(bgSource).toMatch(/captchaType:\s*request\.data\.captchaType/);
      expect(bgSource).toMatch(/hoster:\s*request\.data\.hoster/);
      expect(bgSource).toMatch(/captchaId:\s*request\.data\.captchaId/);
    });

    it('should store detectedAt timestamp', () => {
      expect(bgSource).toMatch(/detectedAt:\s*Date\.now\(\)/);
    });
  });

  describe('captcha-solved handler (CAP-03, CAP-04)', () => {
    it('should fetch the do=solve&response= URL (MV3 service worker: no XHR)', () => {
      expect(bgSource).toMatch(/fetch\(\s*request\.data\.callbackUrl\s*\+\s*['"]&do=solve&response=['"]\s*\+\s*encodeURIComponent\(request\.data\.token\)/);
    });

    it('should URI-encode the token with encodeURIComponent', () => {
      expect(bgSource).toMatch(/encodeURIComponent\(request\.data\.token\)/);
    });

    it('should call chrome.tabs.remove with setTimeout 2-second delay', () => {
      // Extract the captcha-solved handler section
      const solvedSection = bgSource.match(/action\s*===\s*["']captcha-solved["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(solvedSection).not.toBeNull();
      const solvedCode = solvedSection[0];
      expect(solvedCode).toMatch(/setTimeout\s*\(\s*function\s*\(\)/);
      expect(solvedCode).toMatch(/chrome\.tabs\.remove\(sender\.tab\.id/);
      expect(solvedCode).toMatch(/,\s*2000\s*\)/);
    });

    it('should remove tab from activeCaptchaTabs before sending', () => {
      const solvedSection = bgSource.match(/action\s*===\s*["']captcha-solved["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(solvedSection).not.toBeNull();
      expect(solvedSection[0]).toMatch(/delete\s+activeCaptchaTabs\[sender\.tab\.id\]/);
    });
  });

  describe('captcha-skip handler', () => {
    it('should fetch the do=skip&skiptype= URL (MV3 service worker: no XHR)', () => {
      expect(bgSource).toMatch(/fetch\(\s*request\.data\.callbackUrl\s*\+\s*['"]&do=skip&skiptype=['"]\s*\+\s*request\.data\.skipType/);
    });

    it('should close CAPTCHA tab after 2-second delay', () => {
      // Extract the captcha-skip handler section
      const skipSection = bgSource.match(/action\s*===\s*["']captcha-skip["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(skipSection).not.toBeNull();
      const skipCode = skipSection[0];
      expect(skipCode).toMatch(/setTimeout\s*\(\s*function\s*\(\)/);
      expect(skipCode).toMatch(/chrome\.tabs\.remove\(sender\.tab\.id/);
      expect(skipCode).toMatch(/,\s*2000\s*\)/);
    });

    it('should remove tab from activeCaptchaTabs before sending', () => {
      const skipSection = bgSource.match(/action\s*===\s*["']captcha-skip["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(skipSection).not.toBeNull();
      expect(skipSection[0]).toMatch(/delete\s+activeCaptchaTabs\[sender\.tab\.id\]/);
    });
  });

  describe('Tab close skip-on-close (CAP-07)', () => {
    it('chrome.tabs.onRemoved listener should check activeCaptchaTabs', () => {
      expect(bgSource).toMatch(/onRemoved\.addListener[\s\S]*?activeCaptchaTabs\[tabId\]/);
    });

    it('should send skip with skiptype=single on localhost tab close', () => {
      // The onRemoved listener handles both MYJD (tab-closed) and localhost (HTTP skip)
      // Verify the localhost HTTP skip path is present in the full onRemoved section
      const onRemovedSection = bgSource.match(/onRemoved\.addListener[\s\S]*?console\.log\("Background: Keepalive/);
      expect(onRemovedSection).not.toBeNull();
      expect(onRemovedSection[0]).toMatch(/&do=skip&skiptype=single/);
    });

    it('should delete activeCaptchaTabs entry before sending skip request', () => {
      // Verify deletion happens before the fetch() skip request
      const onRemovedSection = bgSource.match(/if\s*\(activeCaptchaTabs\[tabId\]\)[\s\S]*?fetch\(info\.callbackUrl/);
      expect(onRemovedSection).not.toBeNull();
      const code = onRemovedSection[0];
      const deleteIndex = code.indexOf('delete activeCaptchaTabs[tabId]');
      const fetchIndex = code.indexOf('fetch(info.callbackUrl');
      expect(deleteIndex).toBeLessThan(fetchIndex);
    });
  });

  describe('HTTP request configuration', () => {
    it('all CAPTCHA fetch requests should set the X-Myjd-Appkey header', () => {
      // Count occurrences of the X-Myjd-Appkey header (now in the fetch() headers object)
      const appkeyMatches = bgSource.match(/['"]X-Myjd-Appkey['"]\s*:\s*['"]webextension-['"]/g);
      // At least 3: captcha-solved, captcha-skip, and onRemoved skip
      expect(appkeyMatches).not.toBeNull();
      expect(appkeyMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('should set a 10000ms timeout via AbortSignal.timeout on CAPTCHA requests', () => {
      const timeoutMatches = bgSource.match(/AbortSignal\.timeout\(\s*10000\s*\)/g);
      expect(timeoutMatches).not.toBeNull();
      expect(timeoutMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('must not use XMLHttpRequest (unavailable in MV3 service workers)', () => {
      expect(bgSource).not.toMatch(/new\s+XMLHttpRequest/);
    });
  });

  // ============================================================
  // MYJD CAPTCHA flow handlers (Plan 02/03)
  // ============================================================

  describe('Session storage access level', () => {
    it('should set access level for content scripts', () => {
      expect(bgSource).toMatch(/setAccessLevel/);
      expect(bgSource).toMatch(/TRUSTED_AND_UNTRUSTED_CONTEXTS/);
    });
  });

  describe('CSP stripping rules', () => {
    it('should have addCspStrippingRule function', () => {
      expect(bgSource).toMatch(/function\s+addCspStrippingRule\s*\(\s*tabId\s*\)/);
    });

    it('should have removeCspStrippingRule function', () => {
      expect(bgSource).toMatch(/function\s+removeCspStrippingRule\s*\(\s*tabId\s*\)/);
    });

    it('should strip Content-Security-Policy headers', () => {
      expect(bgSource).toMatch(/Content-Security-Policy/);
    });

    it('should use 10000 as rule ID offset', () => {
      expect(bgSource).toMatch(/10000\s*\+\s*tabId/);
    });
  });

  describe('myjd-prepare-captcha-tab handler', () => {
    it('should handle myjd-prepare-captcha-tab action', () => {
      expect(bgSource).toMatch(/myjd-prepare-captcha-tab/);
    });

    it('should write myjd_captcha_job to session storage', () => {
      expect(bgSource).toMatch(/myjd_captcha_job/);
    });

    it('should call addCspStrippingRule for tab', () => {
      expect(bgSource).toMatch(/addCspStrippingRule\(.*tabId/);
    });

    it('should navigate tab with #rc2jdt hash', () => {
      expect(bgSource).toMatch(/chrome\.tabs\.update.*#rc2jdt/);
    });

    it('should track tab in activeCaptchaTabs with MYJD callbackUrl', () => {
      // The handler stores callbackUrl: 'MYJD' in activeCaptchaTabs
      const section = bgSource.match(/myjd-prepare-captcha-tab[\s\S]*?return\s+true/);
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/activeCaptchaTabs\[tabId\]/);
      expect(section[0]).toMatch(/callbackUrl:\s*['"]MYJD['"]/);
    });
  });

  describe('isCaptchaApiScript allowlist (real function, not just source regex)', () => {
    // Regex-on-source-text assertions can't catch a rewrite that still
    // contains the right substrings (e.g. `url.includes('hcaptcha.com')`
    // would pass a naive check). Extract the actual function body and run it
    // against known-good URLs and plausible bypass shapes instead.
    // Naive brace counting: breaks on a '{' or '}' inside a string or
    // comment within the function body. Fails loudly (missing/garbled
    // match makes new Function(...) throw or the assertions below fail),
    // not silently, so a mismatch turns the suite red instead of leaving a
    // quiet coverage hole.
    function extractFunctionSource(source, name) {
      const startMatch = source.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
      if (!startMatch) throw new Error('function not found in source: ' + name);
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

    const isCaptchaApiScript = new Function(
      'return (' + extractFunctionSource(bgSource, 'isCaptchaApiScript') + ');'
    )();

    it('allows the known hCaptcha and reCAPTCHA API endpoints', () => {
      expect(isCaptchaApiScript('https://hcaptcha.com/1/api.js')).toBe(true);
      expect(isCaptchaApiScript('https://www.google.com/recaptcha/api.js')).toBe(true);
    });

    it('rejects non-https URLs', () => {
      expect(isCaptchaApiScript('http://hcaptcha.com/1/api.js')).toBe(false);
    });

    it('rejects lookalike hostnames (subdomain/prefix/suffix attacks)', () => {
      expect(isCaptchaApiScript('https://hcaptcha.com.evil.tld/1/api.js')).toBe(false);
      expect(isCaptchaApiScript('https://evil-hcaptcha.com/1/api.js')).toBe(false);
      expect(isCaptchaApiScript('https://notgoogle.com/recaptcha/api.js')).toBe(false);
    });

    it('rejects query-string smuggling of an allowed URL', () => {
      expect(isCaptchaApiScript('https://evil.tld/?x=https://hcaptcha.com/1/api.js')).toBe(false);
    });

    it('rejects userinfo smuggling (allowed host as username, not hostname)', () => {
      expect(isCaptchaApiScript('https://hcaptcha.com@evil.tld/1/api.js')).toBe(false);
    });

    it('rejects percent-encoded path smuggling', () => {
      expect(isCaptchaApiScript('https://hcaptcha.com/1/%61pi.js')).toBe(false);
    });

    it('rejects unrelated paths on an allowed host', () => {
      expect(isCaptchaApiScript('https://hcaptcha.com/evil.js')).toBe(false);
    });

    it('rejects non-string, empty, and malformed input', () => {
      expect(isCaptchaApiScript(undefined)).toBe(false);
      expect(isCaptchaApiScript(null)).toBe(false);
      expect(isCaptchaApiScript('')).toBe(false);
      expect(isCaptchaApiScript('not a url')).toBe(false);
    });
  });

  describe('myjd-captcha-load-api handler', () => {
    it('should handle myjd-captcha-load-api action', () => {
      expect(bgSource).toMatch(/myjd-captcha-load-api/);
    });

    it('should validate the URL with isCaptchaApiScript before injecting', () => {
      const section = bgSource.match(/action\s*===\s*["']myjd-captcha-load-api["'][\s\S]*?\n \}/);
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/isCaptchaApiScript\(/);
    });

    it('should load the script in the MAIN world via chrome.scripting.executeScript', () => {
      const section = bgSource.match(/action\s*===\s*["']myjd-captcha-load-api["'][\s\S]*?\n \}/);
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/chrome\.scripting\.executeScript/);
      expect(section[0]).toMatch(/world:\s*['"]MAIN['"]/);
    });

    it('should report load/error back via window.postMessage with target origin \'*\'', () => {
      // Not window.location.origin: on an opaque-origin document that's the
      // string "null", which postMessage rejects with a SyntaxError instead
      // of sending (S7). Same window, no secret in the payload, and the
      // receiver already checks event.source === window.
      const section = bgSource.match(/action\s*===\s*["']myjd-captcha-load-api["'][\s\S]*?\n \}/);
      expect(section).not.toBeNull();
      const postMessageCalls = section[0].match(/window\.postMessage\([^)]*\)/g);
      expect(postMessageCalls).not.toBeNull();
      expect(postMessageCalls.length).toBeGreaterThanOrEqual(2);
      postMessageCalls.forEach(function(call) {
        expect(call).toMatch(/__myjd_captcha_api__/);
        expect(call).toMatch(/,\s*'\*'\s*\)$/);
      });
    });

    it('should respond with status:error when the URL is rejected or injection fails', () => {
      const section = bgSource.match(/action\s*===\s*["']myjd-captcha-load-api["'][\s\S]*?\n \}/);
      expect(section).not.toBeNull();
      const errorResponses = section[0].match(/status:\s*['"]error['"]/g);
      expect(errorResponses).not.toBeNull();
      expect(errorResponses.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('myjd-captcha-execute handler', () => {
    it('should handle myjd-captcha-execute action', () => {
      expect(bgSource).toMatch(/myjd-captcha-execute/);
    });

    it('should use chrome.scripting.executeScript with MAIN world', () => {
      const section = bgSource.match(/myjd-captcha-execute[\s\S]*?return\s+true/);
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/chrome\.scripting\.executeScript/);
      expect(section[0]).toMatch(/world:\s*['"]MAIN['"]/);
    });
  });

  describe('captcha-solved MYJD flow', () => {
    it('should check for MYJD callbackUrl in captcha-solved handler', () => {
      const solvedSection = bgSource.match(/action\s*===\s*["']captcha-solved["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(solvedSection).not.toBeNull();
      expect(solvedSection[0]).toMatch(/callbackUrl\s*===\s*['"]MYJD['"]/);
    });

    it('should route MYJD solutions to my.jdownloader.org tabs', () => {
      const solvedSection = bgSource.match(/action\s*===\s*["']captcha-solved["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(solvedSection).not.toBeNull();
      expect(solvedSection[0]).toMatch(/my\.jdownloader\.org/);
      expect(solvedSection[0]).toMatch(/name:\s*['"]response['"]/);
    });

    it('should clean up CSP rule on MYJD solve', () => {
      const solvedSection = bgSource.match(/action\s*===\s*["']captcha-solved["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(solvedSection).not.toBeNull();
      expect(solvedSection[0]).toMatch(/removeCspStrippingRule/);
    });
  });

  describe('captcha-skip MYJD flow', () => {
    it('should check for MYJD callbackUrl in captcha-skip handler', () => {
      const skipSection = bgSource.match(/action\s*===\s*["']captcha-skip["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(skipSection).not.toBeNull();
      expect(skipSection[0]).toMatch(/callbackUrl\s*===\s*['"]MYJD['"]/);
    });

    it('should send tab-closed to my.jdownloader.org tabs on MYJD skip', () => {
      const skipSection = bgSource.match(/action\s*===\s*["']captcha-skip["'][\s\S]*?return\s+true;\s*\n\s*\}/);
      expect(skipSection).not.toBeNull();
      expect(skipSection[0]).toMatch(/name:\s*['"]tab-closed['"]/);
    });
  });

  describe('Tab close MYJD flow', () => {
    it('should handle MYJD tab close by sending tab-closed message', () => {
      const onRemovedSection = bgSource.match(/onRemoved\.addListener[\s\S]*?console\.log\("Background: Keepalive/);
      expect(onRemovedSection).not.toBeNull();
      expect(onRemovedSection[0]).toMatch(/info\.callbackUrl\s*===\s*['"]MYJD['"]/);
      expect(onRemovedSection[0]).toMatch(/tab-closed/);
    });

    it('should clean up CSP rules on tab removal', () => {
      const onRemovedSection = bgSource.match(/onRemoved\.addListener[\s\S]*?console\.log\("Background: Keepalive/);
      expect(onRemovedSection).not.toBeNull();
      expect(onRemovedSection[0]).toMatch(/removeCspStrippingRule\(tabId\)/);
    });
  });
});
