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

    it('should have early return when pathname does not match', function() {
      // Pattern: if (!captchaPathPattern.test(...)) return;
      expect(csSource).toMatch(/if\s*\(\s*!captchaPathPattern\.test\(/);
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

    it('should include callbackUrl in all message types', function() {
      // callbackUrl should appear in data objects for all three message types
      var sendMessageBlocks = csSource.match(/chrome\.runtime\.sendMessage\(\{[\s\S]*?\}\)/g) || [];
      expect(sendMessageBlocks.length).toBeGreaterThanOrEqual(3);
      sendMessageBlocks.forEach(function(block) {
        expect(block).toMatch(/callbackUrl/);
      });
    });
  });

  describe('Manifest registration', function() {
    var captchaEntry;

    beforeAll(function() {
      captchaEntry = manifest.content_scripts.find(function(entry) {
        return entry.matches && entry.matches.includes('http://127.0.0.1/*');
      });
    });

    it('should have content_scripts entry matching http://127.0.0.1/*', function() {
      expect(captchaEntry).toBeDefined();
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
  });
});
