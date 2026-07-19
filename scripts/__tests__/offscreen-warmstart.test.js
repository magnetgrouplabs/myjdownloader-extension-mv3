'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const offscreen = fs.readFileSync(path.join(root, 'offscreen.js'), 'utf8');

/**
 * Regression coverage for the offscreen warm start.
 *
 * After a service-worker restart nothing established the MyJDownloader
 * connection until the popup was opened: the "!" badge stayed on and captured
 * CNL requests hit a backend that was not connected yet. initSettings now
 * spins up the offscreen document when a session exists, and the offscreen
 * reports its connection state back so the badge clears on its own.
 */
describe('offscreen warm start', () => {
  it('initSettings spins up the offscreen document when a session exists', () => {
    expect(background).toMatch(/chrome\.storage\.local\.get\(['"]myjd_session['"]\)/);
    expect(background).toMatch(/if\s*\(\s*sess\.myjd_session\s*\)/);
    expect(background).toMatch(/createOffscreenDocument\(\)/);
  });

  it('createOffscreenDocument is guarded against concurrent creation', () => {
    expect(background).toMatch(/let creatingOffscreenDocument\s*=\s*null/);
    expect(background).toMatch(/if\s*\(\s*!creatingOffscreenDocument\s*\)/);
  });

  it('offscreen reports connection state to the background', () => {
    expect(offscreen).toMatch(/function reportConnectionState/);
    expect(offscreen).toMatch(/action:\s*['"]set-connection-state['"]/);
    // Reported on connect (restore + login) and on disconnect/logout.
    expect(offscreen).toMatch(/reportConnectionState\(true\)/);
    expect(offscreen).toMatch(/reportConnectionState\(false\)/);
  });

  it('background handles set-connection-state to update the badge', () => {
    expect(background).toMatch(/set-connection-state/);
  });
});
