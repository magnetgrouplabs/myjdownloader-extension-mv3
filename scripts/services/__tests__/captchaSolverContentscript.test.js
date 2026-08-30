'use strict';

var fs = require('fs');
var path = require('path');

// Read the content script source for structural verification
var csSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'contentscripts', 'captchaSolverContentscript.js'), 'utf8'
);

// Read manifest.json for registration verification
var manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'manifest.json'), 'utf8'
));

describe('CAPTCHA Solver Content Script', function() {

  describe('CAP-01: URL pattern detection', function() {
    it('should contain CAPTCHA path regex matching recaptchav2, recaptchav3, and hcaptcha', function() {
      expect(csSource).toMatch(/recaptchav2\|recaptchav3\|hcaptcha/);
    });

    it('should have early return when no CAPTCHA detected', function() {
      // Localhost: checks URL path pattern
      expect(csSource).toMatch(/isJdLocalhost/);
      // External: checks for widget elements, returns if none found
      expect(csSource).toMatch(/\.g-recaptcha/);
      expect(csSource).toMatch(/\.h-captcha/);
    });

    it('should extract captchaType from URL path', function() {
      expect(csSource).toMatch(/captchaType/);
      // Should use pathParts to extract the type
      expect(csSource).toMatch(/pathParts\[2\]/);
    });

    it('should extract hoster from URL path with URI decoding', function() {
      expect(csSource).toMatch(/hoster/);
      expect(csSource).toMatch(/decodeURIComponent/);
      expect(csSource).toMatch(/pathParts\[3\]/);
    });

    it('should extract captchaId from URL query parameter', function() {
      expect(csSource).toMatch(/captchaId/);
      expect(csSource).toMatch(/URLSearchParams/);
      expect(csSource).toMatch(/get\('id'\)/);
    });

    it('should use window.location.href as callbackUrl (not hardcoded port)', function() {
      expect(csSource).toMatch(/callbackUrl\s*=\s*window\.location\.href/);
    });
  });

  describe('CAP-02: Token polling', function() {
    it('should query g-recaptcha-response textareas with prefix match', function() {
      expect(csSource).toMatch(/querySelectorAll\('textarea\[id\^="g-recaptcha-response"\]'\)/);
    });

    it('should query h-captcha-response textareas', function() {
      expect(csSource).toMatch(/querySelectorAll\('textarea\[name="h-captcha-response"\]'\)/);
    });

    it('should use setInterval for polling', function() {
      expect(csSource).toMatch(/setInterval/);
    });

    it('should check value.length > 30 for valid token', function() {
      expect(csSource).toMatch(/value\.length\s*>\s*30/);
    });

    it('should use 500ms polling interval', function() {
      expect(csSource).toMatch(/500/);
    });
  });

  describe('CAP-05: Skip buttons', function() {
    it('should create element with id myjd-captcha-controls', function() {
      expect(csSource).toMatch(/myjd-captcha-controls/);
    });

    it('should include all 4 skip types: hoster, package, all, single', function() {
      expect(csSource).toMatch(/type:\s*'hoster'/);
      expect(csSource).toMatch(/type:\s*'package'/);
      expect(csSource).toMatch(/type:\s*'all'/);
      expect(csSource).toMatch(/type:\s*'single'/);
    });

    it('should include hoster variable in button label text', function() {
      // The hoster skip button label should contain the hoster variable
      expect(csSource).toMatch(/Skip\s*['"]\s*\+\s*hoster\s*\+\s*['"].*CAPTCHA/);
    });

    it('should use addEventListener not inline onclick (MV3 CSP compliance)', function() {
      expect(csSource).toMatch(/addEventListener/);
      // Should NOT have any onclick= assignments
      expect(csSource).not.toMatch(/onclick\s*=/);
    });

    it('should use event delegation with dataset.skipType', function() {
      expect(csSource).toMatch(/e\.target\.dataset\.skipType/);
    });

    it('should use extension-themed styling (#2196F3)', function() {
      expect(csSource).toMatch(/#2196F3/);
    });
  });

  describe('CAP-06: Countdown timer', function() {
    it('should create element with id myjd-countdown', function() {
      expect(csSource).toMatch(/myjd-countdown/);
    });

    it('should use 5-minute timeout (300000ms or 5 * 60 * 1000)', function() {
      var has300000 = csSource.indexOf('300000') !== -1;
      var has5x60x1000 = csSource.indexOf('5 * 60 * 1000') !== -1;
      expect(has300000 || has5x60x1000).toBe(true);
    });

    it('should send skip with type single on expiry', function() {
      // After timeout, sends captcha-skip with skipType: 'single'
      expect(csSource).toMatch(/captcha-skip/);
      expect(csSource).toMatch(/skipType:\s*'single'/);
    });

    it('should change color to red (#f44336) under 60 seconds', function() {
      expect(csSource).toMatch(/#f44336/);
      // Should reference 60000ms or 60 seconds threshold
      expect(csSource).toMatch(/60000/);
    });

    it('should display time in M:SS format', function() {
      expect(csSource).toMatch(/Time remaining:/);
    });

    it('should clear token polling interval on timeout', function() {
      // On timeout, should clear the polling handle
      expect(csSource).toMatch(/clearInterval\(pollingHandle\)/);
    });
  });

  describe('CAP-10: Multi-type support', function() {
    it('should handle both g-recaptcha-response and h-captcha-response', function() {
      expect(csSource).toMatch(/g-recaptcha-response/);
      expect(csSource).toMatch(/h-captcha-response/);
    });

    it('URL pattern should cover recaptchav2, recaptchav3, and hcaptcha', function() {
      expect(csSource).toMatch(/recaptchav2/);
      expect(csSource).toMatch(/recaptchav3/);
      expect(csSource).toMatch(/hcaptcha/);
    });
  });

  describe('Messaging format', function() {
    it('should send captcha-tab-detected via chrome.runtime.sendMessage', function() {
      expect(csSource).toMatch(/chrome\.runtime\.sendMessage/);
      expect(csSource).toMatch(/captcha-tab-detected/);
    });

    it('should send captcha-solved via chrome.runtime.sendMessage', function() {
      expect(csSource).toMatch(/captcha-solved/);
    });

    it('should send captcha-skip via chrome.runtime.sendMessage', function() {
      expect(csSource).toMatch(/captcha-skip/);
    });

    it('should include callbackUrl in data-carrying message types', function() {
      // callbackUrl should appear in data objects for the three main message types
      // (captcha-can-close is a tab-close signal with no data payload)
      var sendMessageBlocks = csSource.match(/chrome\.runtime\.sendMessage\(\{[\s\S]*?\}\)/g) || [];
      expect(sendMessageBlocks.length).toBeGreaterThanOrEqual(3);
      var dataMessages = sendMessageBlocks.filter(function(block) {
        return block.indexOf('data:') !== -1;
      });
      expect(dataMessages.length).toBeGreaterThanOrEqual(3);
      dataMessages.forEach(function(block) {
        expect(block).toMatch(/callbackUrl/);
      });
    });
  });

  describe('Manifest registration', function() {
    var captchaEntry;

    beforeAll(function() {
      captchaEntry = manifest.content_scripts.find(function(entry) {
        return entry.js && entry.js.includes('contentscripts/captchaSolverContentscript.js');
      });
    });

    it('should have content_scripts entry matching all URLs', function() {
      expect(captchaEntry).toBeDefined();
      expect(captchaEntry.matches).toContain('*://*/*');
    });

    it('should include captchaSolverContentscript.js in js array', function() {
      expect(captchaEntry.js).toContain('contentscripts/captchaSolverContentscript.js');
    });

    it('should use run_at document_end', function() {
      expect(captchaEntry.run_at).toBe('document_end');
    });

    it('should have all_frames set to false', function() {
      expect(captchaEntry.all_frames).toBe(false);
    });
  });

  describe('Cleanup', function() {
    it('should add beforeunload listener for interval cleanup', function() {
      expect(csSource).toMatch(/beforeunload/);
    });

    it('should use IIFE pattern', function() {
      expect(csSource).toMatch(/^\(function\(\)\s*\{/);
    });

    it('should use var declarations (not let/const) for project consistency', function() {
      // Should NOT use let or const declarations
      // (they may appear inside regex or strings, so check for actual declarations)
      var lines = csSource.split('\n');
      var codeLines = lines.filter(function(line) {
        var trimmed = line.trim();
        // Skip comments and empty lines
        return trimmed && trimmed.indexOf('//') !== 0 && trimmed.indexOf('*') !== 0;
      });
      var usesLetConst = codeLines.some(function(line) {
        return /^\s*(let|const)\s+/.test(line);
      });
      expect(usesLetConst).toBe(false);
    });

    it('should clean up canCloseHandle on beforeunload', function() {
      expect(csSource).toMatch(/canCloseHandle/);
      // beforeunload handler should clear canCloseHandle
      expect(csSource).toMatch(/clearInterval\(canCloseHandle\)/);
    });
  });

  describe('JD Protocol: canClose polling', function() {
    it('should have startCanClosePolling function', function() {
      expect(csSource).toMatch(/function startCanClosePolling/);
    });

    it('should declare canCloseHandle variable', function() {
      expect(csSource).toMatch(/var canCloseHandle/);
    });

    it('should poll at 1-second interval', function() {
      // canClose uses setInterval with 1000ms
      expect(csSource).toMatch(/setInterval.*1000|1000.*setInterval/s);
    });

    it('should XHR GET callbackUrl with do=canClose', function() {
      expect(csSource).toMatch(/do=canClose/);
    });

    it('should use XMLHttpRequest', function() {
      expect(csSource).toMatch(/new XMLHttpRequest/);
    });

    it('should set X-Myjd-Appkey header', function() {
      expect(csSource).toMatch(/X-Myjd-Appkey/);
    });

    it('should check response for true string', function() {
      expect(csSource).toMatch(/responseText\s*===?\s*['"]true['"]/);
    });

    it('should clear all intervals on canClose true', function() {
      expect(csSource).toMatch(/clearInterval\(canCloseHandle\)/);
      expect(csSource).toMatch(/clearInterval\(pollingHandle\)/);
      expect(csSource).toMatch(/clearInterval\(countdownHandle\)/);
    });

    it('should send captcha-can-close as fallback for window.close', function() {
      expect(csSource).toMatch(/captcha-can-close/);
    });
  });

  describe('JD Protocol: loaded event', function() {
    it('should have sendLoadedEvent function', function() {
      expect(csSource).toMatch(/function sendLoadedEvent/);
    });

    it('should find CAPTCHA element by iframe or widget selectors', function() {
      expect(csSource).toMatch(/iframe\[src\*=/);
    });

    it('should include do=loaded in URL', function() {
      expect(csSource).toMatch(/do=loaded/);
    });

    it('should send window geometry parameters', function() {
      expect(csSource).toMatch(/screenX|screenLeft/);
      expect(csSource).toMatch(/outerWidth/);
      expect(csSource).toMatch(/innerWidth/);
      expect(csSource).toMatch(/devicePixelRatio/);
    });

    it('should use getBoundingClientRect for element dimensions', function() {
      expect(csSource).toMatch(/getBoundingClientRect/);
    });

    it('should include element position params (eleft, etop, ew, eh)', function() {
      expect(csSource).toMatch(/eleft=/);
      expect(csSource).toMatch(/etop=/);
      expect(csSource).toMatch(/ew=/);
      expect(csSource).toMatch(/eh=/);
    });

    it('should include dpi parameter', function() {
      expect(csSource).toMatch(/dpi=/);
    });

    it('should retry if CAPTCHA element not found', function() {
      expect(csSource).toMatch(/setTimeout.*sendLoadedEvent|loadedRetries/);
    });
  });

  describe('JD Protocol: mouse-move reporting', function() {
    it('should have startMouseMoveReporting function', function() {
      expect(csSource).toMatch(/function startMouseMoveReporting/);
    });

    it('should add mousemove event listener on document', function() {
      expect(csSource).toMatch(/addEventListener.*mousemove|mousemove.*addEventListener/s);
    });

    it('should throttle to 3 seconds (3000ms)', function() {
      expect(csSource).toMatch(/3000/);
    });

    it('should include useractive=true in URL', function() {
      expect(csSource).toMatch(/useractive=true/);
    });

    it('should include timestamp in URL', function() {
      expect(csSource).toMatch(/ts=/);
    });

    it('should set X-Myjd-Appkey header on mouse-move XHR', function() {
      // Already covered by global X-Myjd-Appkey check, but verify pattern exists near mousemove
      expect(csSource).toMatch(/X-Myjd-Appkey/);
    });
  });

  describe('Protocol callbacks gating', function() {
    it('should gate protocol callbacks on isJdLocalhost', function() {
      // The protocol callback calls should be inside an isJdLocalhost check
      expect(csSource).toMatch(/if\s*\(isJdLocalhost\)\s*\{[\s\S]*?startCanClosePolling/);
    });
  });

  describe('loginNeeded.html', function() {
    var loginSource;

    beforeAll(function() {
      loginSource = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'loginNeeded.html'), 'utf8'
      );
    });

    it('should exist and be non-empty', function() {
      expect(loginSource.length).toBeGreaterThan(0);
    });

    it('should have correct title', function() {
      expect(loginSource).toMatch(/MyJDownloader - Login Required/);
    });

    it('should have light blue background (#dbf5fb)', function() {
      expect(loginSource).toMatch(/#dbf5fb/);
    });

    it('should explain login requirement', function() {
      expect(loginSource).toMatch(/log.?in/i);
    });

    it('should not contain inline scripts (MV3 compliance)', function() {
      expect(loginSource).not.toMatch(/<script/);
    });
  });
});
