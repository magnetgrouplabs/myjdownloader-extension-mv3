'use strict';

const fs = require('fs');
const path = require('path');

const bgSource = fs.readFileSync(path.join(__dirname, '../../../background.js'), 'utf8');
const offscreenSource = fs.readFileSync(path.join(__dirname, '../../../offscreen.js'), 'utf8');
const solverSource = fs.readFileSync(path.join(__dirname, '../../../contentscripts/myjdCaptchaSolver.js'), 'utf8');
const genericSolverSource = fs.readFileSync(path.join(__dirname, '../../../contentscripts/captchaSolverContentscript.js'), 'utf8');

describe('captcha solve delivery to JD', () => {
  it('offscreen solve uses 3-param rawtoken form with JSON-stringified id', () => {
    expect(offscreenSource).toMatch(/resultFormat \|\| 'rawtoken'/);
    expect(offscreenSource).toMatch(/JSON\.stringify\(request\.captchaId\)/);
    expect(offscreenSource).toMatch(/solveParams = \[solveId, request\.token, resultFormat\]/);
  });

  it('rejects JD accepted===false as failure', () => {
    expect(offscreenSource).toMatch(/accepted === false/);
  });

  it('captcha-solved recovers deviceId/captchaId from session job', () => {
    expect(bgSource).toMatch(/chrome\.storage\.session\.get\('myjd_captcha_job'\)/);
    expect(bgSource).toMatch(/sessionJob\.deviceId/);
  });

  it('captcha-tab-detected preserves existing deviceId', () => {
    expect(bgSource).toMatch(/deviceId: request\.data\.deviceId \|\| prev\.deviceId/);
  });

  it('myjdCaptchaSolver includes deviceId on captcha-solved', () => {
    expect(solverSource).toMatch(/deviceId: job\.deviceId/);
  });

  it('generic captchaSolverContentscript skips #rc2jdt tabs', () => {
    expect(genericSolverSource).toMatch(/#rc2jdt/);
    expect(genericSolverSource).toMatch(/location\.hash\.indexOf\('#rc2jdt'\) === 0/);
  });
});
