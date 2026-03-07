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
    it('should make HTTP GET with do=solve&response= pattern', () => {
      expect(bgSource).toMatch(/['"]GET['"]\s*,\s*request\.data\.callbackUrl\s*\+\s*['"]&do=solve&response=['"]\s*\+\s*encodeURIComponent\(request\.data\.token\)/);
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
    it('should make HTTP GET with do=skip&skiptype= pattern', () => {
      expect(bgSource).toMatch(/['"]GET['"]\s*,\s*request\.data\.callbackUrl\s*\+\s*['"]&do=skip&skiptype=['"]\s*\+\s*request\.data\.skipType/);
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

    it('should send skip with skiptype=single on tab close', () => {
      // Find the onRemoved listener section that handles CAPTCHA
      const onRemovedSection = bgSource.match(/onRemoved\.addListener[\s\S]*?\}\);/);
      expect(onRemovedSection).not.toBeNull();
      expect(onRemovedSection[0]).toMatch(/&do=skip&skiptype=single/);
    });

    it('should delete activeCaptchaTabs entry before sending skip request', () => {
      // Verify deletion happens before the HTTP request
      const onRemovedSection = bgSource.match(/if\s*\(activeCaptchaTabs\[tabId\]\)[\s\S]*?httpRequest\.send\(\)/);
      expect(onRemovedSection).not.toBeNull();
      const code = onRemovedSection[0];
      const deleteIndex = code.indexOf('delete activeCaptchaTabs[tabId]');
      const sendIndex = code.indexOf('httpRequest.send()');
      expect(deleteIndex).toBeLessThan(sendIndex);
    });
  });

  describe('HTTP request configuration', () => {
    it('all CAPTCHA HTTP requests should set X-Myjd-Appkey header', () => {
      // Count occurrences of X-Myjd-Appkey in the CAPTCHA section
      const appkeyMatches = bgSource.match(/setRequestHeader\s*\(\s*['"]X-Myjd-Appkey['"]/g);
      // At least 3: captcha-solved, captcha-skip, and onRemoved skip
      expect(appkeyMatches).not.toBeNull();
      expect(appkeyMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('should set timeout to 10000ms on CAPTCHA requests', () => {
      const timeoutMatches = bgSource.match(/\.timeout\s*=\s*10000/g);
      expect(timeoutMatches).not.toBeNull();
      expect(timeoutMatches.length).toBeGreaterThanOrEqual(3);
    });
  });
});
