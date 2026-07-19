'use strict';

// Tests for the update notifier in background.js.
//
// Unpacked installs never auto-update, so the background checks the GitHub
// releases API daily and flags a newer release via storage + badge. These
// tests drive the check through the "check-for-update" message action and a
// mocked fetch. Only data is fetched, never code.

const UPDATE_STORAGE_KEY = 'myjd_update_available';

function getOnMessageHandler() {
  const listeners = global.chrome.runtime.onMessage._listeners;
  return listeners[listeners.length - 1];
}

function sendMessage(action, data) {
  const handler = getOnMessageHandler();
  const sender = { id: chrome.runtime.id };
  return new Promise((resolve) => {
    handler({ action, data }, sender, resolve);
  });
}

function mockRelease(tagName) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        tag_name: tagName,
        html_url: 'https://github.com/magnetgrouplabs/myjdownloader-extension-mv3/releases/tag/' + tagName
      })
    })
  );
}

describe('Background.js update notifier', () => {
  beforeEach(() => {
    global.__resetChromeStorage();
    jest.clearAllMocks();

    global.chrome.runtime.onMessage._listeners.length = 0;
    global.chrome.runtime.onInstalled._listeners.length = 0;
    global.chrome.runtime.onStartup._listeners.length = 0;
    global.chrome.tabs.onRemoved._listeners.length = 0;
    global.chrome.contextMenus.onClicked._listeners.length = 0;
    global.chrome.alarms.onAlarm._listeners.length = 0;
    global.chrome.storage.onChanged._listeners.length = 0;
    global.chrome.webRequest.onBeforeRequest._listeners.length = 0;

    // The running version for all tests in this suite
    global.chrome.runtime.getManifest.mockReturnValue({
      name: 'MyJDownloader MV3',
      version: '2026.7.13.1',
      manifest_version: 3
    });

    jest.resetModules();
  });

  afterEach(() => {
    delete global.fetch;
  });

  function loadBackground() {
    require('../../background.js');
  }

  it('flags a newer release: stores info and shows the NEW badge', async () => {
    mockRelease('v2026.8.1');
    loadBackground();

    // Connected, so the "!" badge does not mask the update hint
    await sendMessage('set-connection-state', { isConnected: true });
    const response = await sendMessage('check-for-update');

    expect(response.update).toEqual({
      version: '2026.8.1',
      url: expect.stringContaining('/releases/tag/v2026.8.1')
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [UPDATE_STORAGE_KEY]: expect.objectContaining({ version: '2026.8.1' })
      })
    );
    const badgeCalls = chrome.action.setBadgeText.mock.calls;
    expect(badgeCalls[badgeCalls.length - 1][0]).toEqual({ text: 'NEW' });
  });

  it('the connection warning outranks the update hint on the badge', async () => {
    mockRelease('v2026.8.1');
    loadBackground();

    // Disconnected: the badge must keep showing "!" even with an update
    await sendMessage('set-connection-state', { isConnected: false });
    await sendMessage('check-for-update');

    const badgeCalls = chrome.action.setBadgeText.mock.calls;
    expect(badgeCalls[badgeCalls.length - 1][0]).toEqual({ text: '!' });
  });

  it('treats a zero-padded tag as the same version (no false update)', async () => {
    // Chrome strips leading zeros, so v2026.07.13.1 IS the running 2026.7.13.1
    mockRelease('v2026.07.13.1');
    loadBackground();

    const response = await sendMessage('check-for-update');

    expect(response.update).toBeNull();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(UPDATE_STORAGE_KEY);
  });

  it('ignores an older release', async () => {
    mockRelease('v2026.7.13');
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toBeNull();
  });

  it('orders the 4th re-release component correctly (2026.7.13.2 > 2026.7.13.1)', async () => {
    mockRelease('v2026.7.13.2');
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toEqual(expect.objectContaining({ version: '2026.7.13.2' }));
  });

  it('stays quiet when the fetch fails (offline / rate limited)', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toBeNull();
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ [UPDATE_STORAGE_KEY]: expect.anything() })
    );
  });

  it('stays quiet on a non-OK response', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 403 }));
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toBeNull();
  });

  it('registers the daily update-check alarm', () => {
    global.fetch = jest.fn();
    loadBackground();

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'updateCheck',
      expect.objectContaining({ periodInMinutes: 24 * 60 })
    );
  });

  it('runs the check when the update alarm fires', async () => {
    mockRelease('v2026.8.1');
    loadBackground();

    const listeners = global.chrome.alarms.onAlarm._listeners;
    listeners.forEach((l) => l({ name: 'updateCheck' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.github.com'),
      expect.anything()
    );
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [UPDATE_STORAGE_KEY]: expect.objectContaining({ version: '2026.8.1' })
      })
    );
  });

  it('keepAlive alarms do not trigger an update check', async () => {
    global.fetch = jest.fn();
    loadBackground();

    const listeners = global.chrome.alarms.onAlarm._listeners;
    listeners.forEach((l) => l({ name: 'keepAlive' }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
