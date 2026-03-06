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
      // (sendRc2SolutionToJd + tabmode-init + possibly fallback in catch)
      expect(jdUrlArrays.length).toBeGreaterThanOrEqual(2);
    });

    it('sendRc2SolutionToJd tab query should have exactly 2 URL entries', () => {
      // The first occurrence of a jd URL array in the file is sendRc2SolutionToJd (around line 91-96)
      expect(jdUrlArrays[0]).toHaveLength(2);
    });

    it('tabmode-init tab query should have exactly 2 URL entries', () => {
      // The second occurrence is in tabmode-init listener (around line 194-199)
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

  describe('BUG-02: CAPTCHA deduplication', () => {
    it('onNewCaptchaAvailable should have captchaInProgress guard', () => {
      // Verify captchaInProgress variable declaration exists
      expect(rc2Source).toMatch(/let\s+captchaInProgress\s*=\s*\{\s*\}/);
    });

    it('captchaInProgress guard should use captchaId or callbackUrl as dedup key', () => {
      // Verify the guard uses params.captchaId || callbackUrl as the dedup key
      expect(rc2Source).toMatch(/params\.captchaId\s*\|\|\s*callbackUrl/);
    });

    it('onNewCaptchaAvailable should check and set the guard before sending', () => {
      // Verify the guard check exists
      expect(rc2Source).toMatch(/if\s*\(\s*captchaInProgress\[dedupKey\]\s*\)/);
      // Verify the guard is set
      expect(rc2Source).toMatch(/captchaInProgress\[dedupKey\]\s*=\s*true/);
    });

    it('captchaInProgress should be cleaned up in success path', () => {
      // Verify delete captchaInProgress[dedupKey] appears in the .then() callback
      // Look for it in the context of the then() block
      const thenBlock = rc2Source.match(/\.then\(function\s*\(\s*response\s*\)\s*\{[\s\S]*?delete\s+captchaInProgress\[dedupKey\]/);
      expect(thenBlock).not.toBeNull();
    });

    it('captchaInProgress should be cleaned up in error path', () => {
      // Verify delete captchaInProgress[dedupKey] appears in the .catch() callback
      const catchBlock = rc2Source.match(/\.catch\(function\s*\(\s*error\s*\)\s*\{[\s\S]*?delete\s+captchaInProgress\[dedupKey\]/);
      expect(catchBlock).not.toBeNull();
    });
  });
});
