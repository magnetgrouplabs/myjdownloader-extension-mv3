'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'contentscripts', 'webinterfaceEnhancer.js'),
  'utf8'
);

describe('webinterfaceEnhancer — MyJD captcha icon bridge', () => {
  it('listens for clicks on the captcha.png / #gwtCaptchasWaiting control', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]click['"]/);
    expect(source).toMatch(/captcha\.png/);
    expect(source).toMatch(/gwtCaptchasWaiting/);
  });

  it('sends myjd-webui-captcha-click to the service worker on icon click', () => {
    expect(source).toMatch(/action:\s*['"]myjd-webui-captcha-click['"]/);
  });

  it('forwards window myjdrc2/captcha-new messages even when enhance-dialog is inactive', () => {
    expect(source).toMatch(/type === ["']myjdrc2["']/);
    expect(source).toMatch(/name === ["']captcha-new["']/);
    expect(source).toMatch(/action:\s*["']captcha-new["']/);
    // Forward happens before the active gate.
    const forwardIdx = source.indexOf('captcha-new');
    const activeGateIdx = source.indexOf('if (!active) return');
    expect(forwardIdx).toBeGreaterThan(-1);
    expect(activeGateIdx).toBeGreaterThan(forwardIdx);
  });

  it('still answers the page ping/pong so jd.extensionInstalled can be set', () => {
    expect(source).toMatch(/name === ["']ping["']/);
    expect(source).toMatch(/name:\s*["']pong["']/);
  });
});
