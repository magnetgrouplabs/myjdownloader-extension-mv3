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

/**
 * Regression coverage for the storage-crippled offscreen document.
 *
 * An offscreen document created very early at browser startup can be missing
 * chrome.storage entirely, and it never appears for that instance. The old
 * fallback logged a warning and dead-ended: no session restore, no connect,
 * no state report, "!" badge stuck until the popup was opened. The warm start
 * now hands the session over in the message itself and the worker sets the
 * badge from the direct response.
 */
describe('offscreen warm start - session handoff', () => {
  it('background hands the stored session to the offscreen document', () => {
    expect(background).toMatch(/function warmStartConnect/);
    expect(background).toMatch(/offscreen-restore-session/);
    expect(background).toMatch(/warmStartConnect\(sess\.myjd_session/);
  });

  it('background sets the badge from the restore response, not only from set-connection-state', () => {
    const fn = background.match(/function warmStartConnect[\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    expect(fn[0]).toMatch(/state\.isConnected\s*=\s*true/);
    expect(fn[0]).toMatch(/updateBadge\(\)/);
  });

  it('offscreen handles offscreen-restore-session and waits for jdapi to load first', () => {
    expect(offscreen).toMatch(/case ['"]offscreen-restore-session['"]/);
    expect(offscreen).toMatch(/function waitForApi/);
    const handler = offscreen.match(/case ['"]offscreen-restore-session['"][\s\S]*?return true;/);
    expect(handler).not.toBeNull();
    expect(handler[0]).toMatch(/waitForApi\(/);
    expect(handler[0]).toMatch(/connectWithSession\(/);
  });

  it('the missing-chrome.storage fallback still connects from the localStorage session', () => {
    // The fallback branch must attempt a connect instead of dead-ending after
    // the warning. jdapi reads its session from localStorage, which persists
    // for the extension origin even when chrome.storage is unavailable.
    const fallback = offscreen.match(/No chrome\.storage, restoring from localStorage[\s\S]{0,600}/);
    expect(fallback).not.toBeNull();
    expect(fallback[0]).toMatch(/connectWithSession\(/);
  });

  it('concurrent restore paths share a single connect', () => {
    expect(offscreen).toMatch(/var connectInFlight\s*=\s*null/);
    expect(offscreen).toMatch(/if\s*\(\s*!connectInFlight\s*\)/);
  });
});
