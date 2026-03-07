'use strict';

const fs = require('fs');
const path = require('path');

// Read the source file for structural/behavioral verification
const rc2Source = fs.readFileSync(
  path.join(__dirname, '..', 'Rc2Service.js'), 'utf8'
);

describe('Rc2Service Bug Fixes', () => {
  describe('BUG-01: Duplicate URL patterns', () => {
    // Extract all chrome.tabs.query url arrays from source
    // Pattern: url: [\n  "..."\n  "..."\n]
    const urlArrayPattern = /url:\s*\[([\s\S]*?)\]/g;
    const urlArrays = [];
    let match;
    while ((match = urlArrayPattern.exec(rc2Source)) !== null) {
      const arrayContent = match[1];
      // Extract individual URL strings from the array
      const urlStrings = arrayContent.match(/"[^"]+"/g) || [];
      urlArrays.push(urlStrings.map(s => s.replace(/"/g, '')));
    }

    // Find specifically the tab query URL arrays (those containing my.jdownloader.org)
    const jdUrlArrays = urlArrays.filter(arr =>
      arr.some(url => url.includes('my.jdownloader.org'))
    );

    it('should have chrome.tabs.query calls with URL arrays', () => {
      // We expect at least 2 query arrays with my.jdownloader.org URLs
      // (sendRc2SolutionToJd + tabmode-init + onNewCaptchaAvailable MYJD flow)
      expect(jdUrlArrays.length).toBeGreaterThanOrEqual(2);
    });

    it('sendRc2SolutionToJd tab query should have exactly 2 URL entries', () => {
      // The first occurrence of a jd URL array in the file is sendRc2SolutionToJd
      expect(jdUrlArrays[0]).toHaveLength(2);
    });

    it('tabmode-init tab query should have exactly 2 URL entries', () => {
      // The second occurrence is in tabmode-init listener
      expect(jdUrlArrays[1]).toHaveLength(2);
    });

    it('all URL arrays should contain both http and https variants', () => {
      jdUrlArrays.forEach((arr, index) => {
        const httpUrls = arr.filter(url => url.startsWith('http://'));
        const httpsUrls = arr.filter(url => url.startsWith('https://'));
        expect(httpUrls.length).toBeGreaterThanOrEqual(1);
        expect(httpsUrls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('no URL array should contain duplicate entries', () => {
      jdUrlArrays.forEach((arr) => {
        const uniqueUrls = [...new Set(arr)];
        expect(arr).toHaveLength(uniqueUrls.length);
      });
    });
  });

  describe('CAP-09: handleRequest should NOT close CAPTCHA tabs', () => {
    it('handleRequest should NOT call chrome.tabs.remove', () => {
      // Extract the handleRequest function body
      const handleRequestMatch = rc2Source.match(/function\s+handleRequest\s*\(\s*request\s*\)\s*\{([\s\S]*?)\n\s{6}\}/);
      expect(handleRequestMatch).not.toBeNull();
      const handleRequestBody = handleRequestMatch[1];
      expect(handleRequestBody).not.toMatch(/chrome\.tabs\.remove/);
    });

    it('handleRequest should log when CAPTCHA tab detected', () => {
      const handleRequestMatch = rc2Source.match(/function\s+handleRequest\s*\(\s*request\s*\)\s*\{([\s\S]*?)\n\s{6}\}/);
      expect(handleRequestMatch).not.toBeNull();
      const handleRequestBody = handleRequestMatch[1];
      expect(handleRequestBody).toMatch(/console\.log/);
      expect(handleRequestBody).toMatch(/content\s*script|web\s*tab/i);
    });

    it('handleRequest should still detect CAPTCHA URLs via regex', () => {
      const handleRequestMatch = rc2Source.match(/function\s+handleRequest\s*\(\s*request\s*\)\s*\{([\s\S]*?)\n\s{6}\}/);
      expect(handleRequestMatch).not.toBeNull();
      const handleRequestBody = handleRequestMatch[1];
      // The source contains escaped regex, so match the literal string "127" and "captcha"
      expect(handleRequestBody).toContain('127');
      expect(handleRequestBody).toContain('captcha');
      expect(handleRequestBody).toContain('request.url.match');
    });
  });

  describe('CAP-08: onNewCaptchaAvailable should NOT use CaptchaNativeService', () => {
    it('onNewCaptchaAvailable should NOT reference CaptchaNativeService', () => {
      // Extract the onNewCaptchaAvailable function body
      const funcMatch = rc2Source.match(/function\s+onNewCaptchaAvailable\s*\([\s\S]*?\n\s{6}\}/);
      expect(funcMatch).not.toBeNull();
      expect(funcMatch[0]).not.toMatch(/CaptchaNativeService/);
    });

    it('Rc2Service DI array should NOT include CaptchaNativeService', () => {
      // Check the .service('Rc2Service', [...]) DI array
      const diArrayMatch = rc2Source.match(/\.service\('Rc2Service',\s*\[([\s\S]*?)\]/);
      expect(diArrayMatch).not.toBeNull();
      expect(diArrayMatch[1]).not.toMatch(/CaptchaNativeService/);
    });

    it('Rc2Service function parameters should NOT include CaptchaNativeService', () => {
      // Check the function parameter list
      const funcParamMatch = rc2Source.match(/function\s*\(BrowserService[\s\S]*?\)\s*\{/);
      expect(funcParamMatch).not.toBeNull();
      expect(funcParamMatch[0]).not.toMatch(/CaptchaNativeService/);
    });

    it('onNewCaptchaAvailable should handle MYJD callbackUrl for web interface flow', () => {
      const funcMatch = rc2Source.match(/function\s+onNewCaptchaAvailable\s*\([\s\S]*?\n\s{6}\}/);
      expect(funcMatch).not.toBeNull();
      expect(funcMatch[0]).toMatch(/callbackUrl\s*===\s*['"]MYJD['"]/);
      expect(funcMatch[0]).toMatch(/chrome\.tabs\.query/);
      expect(funcMatch[0]).toMatch(/my\.jdownloader\.org/);
    });

    it('captchaInProgress variable should NOT exist (dedup no longer needed)', () => {
      expect(rc2Source).not.toMatch(/let\s+captchaInProgress\s*=/);
      expect(rc2Source).not.toMatch(/var\s+captchaInProgress\s*=/);
    });
  });
});
