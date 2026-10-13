'use strict';

// Tests for the update notifier in background.js.
//
// Unpacked installs never auto-update, so the background checks the GitHub
// releases API daily and flags a newer release via storage + badge. These
// tests drive the check through the "check-for-update" message action and a
// mocked fetch. Only data is fetched, never code.

const UPDATE_STORAGE_KEY = 'myjd_update_available';

// The running build for all tests in this suite: v2026.7.13.1, cut 2026-07-13.
const RUNNING_VERSION = '2026.7.13.1';
const RUNNING_BUILD_MS = Date.parse('2026-07-13T13:18:13Z');

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

// Routes the two things the notifier fetches: the GitHub releases API and the
// packaged buildMeta.json. Pass buildTimestamp === null to simulate a build
// with no buildMeta.json (dev checkout), which forces the numeric fallback.
function mockRelease(tagName, publishedAt, buildTimestamp) {
  const buildMs = buildTimestamp === undefined ? RUNNING_BUILD_MS : buildTimestamp;
  global.fetch = jest.fn((url) => {
    if (String(url).includes('buildMeta.json')) {
      if (buildMs === null) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: RUNNING_VERSION, timestamp: buildMs })
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        tag_name: tagName,
        published_at: publishedAt || '2026-08-01T00:00:00Z',
        html_url: 'https://github.com/magnetgrouplabs/myjdownloader-extension-mv3/releases/tag/' + tagName
      })
    });
  });
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
      version: RUNNING_VERSION,
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

    expect(response.update).toEqual(expect.objectContaining({
      version: '2026.8.1',
      url: expect.stringContaining('/releases/tag/v2026.8.1')
    }));
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
    // Chrome strips leading zeros, so v2026.07.13.1 IS the running 2026.7.13.1.
    // The publish date here is deliberately later than the build timestamp: the
    // version guard has to win, or the extension nags about its own release.
    mockRelease('v2026.07.13.1', '2026-08-01T00:00:00Z');
    loadBackground();

    const response = await sendMessage('check-for-update');

    expect(response.update).toBeNull();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(UPDATE_STORAGE_KEY);
  });

  it('ignores an older release', async () => {
    mockRelease('v2026.7.13', '2026-07-12T19:37:11Z');
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toBeNull();
  });

  // The reason this notifier orders by publish date at all. On 2026-07-21 the
  // third component stopped meaning "day of month" and started meaning "Nth
  // release this month", so v2026.7.4 was published EIGHT DAYS AFTER the
  // running v2026.7.13.1 while comparing lower numerically. A purely numeric
  // compare tells every user still on a pre-2026.7.4 July build that they are
  // up to date, forever.
  it('flags v2026.7.4 as newer than the running v2026.7.13.1 (July scheme change)', async () => {
    mockRelease('v2026.7.4', '2026-07-21T16:33:43Z');
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toEqual(expect.objectContaining({ version: '2026.7.4' }));
  });

  it('persists the publish date so the restore path can reuse the comparison', async () => {
    mockRelease('v2026.7.4', '2026-07-21T16:33:43Z');
    loadBackground();

    await sendMessage('check-for-update');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [UPDATE_STORAGE_KEY]: expect.objectContaining({
          version: '2026.7.4',
          publishedAt: Date.parse('2026-07-21T16:33:43Z')
        })
      })
    );
  });

  it('falls back to numeric ordering when buildMeta.json is unavailable', async () => {
    // No buildMeta.json (dev checkout): the 4th re-release component still has
    // to order correctly, 2026.7.13.2 > 2026.7.13.1.
    mockRelease('v2026.7.13.2', '2026-07-14T00:00:00Z', null);
    loadBackground();

    const response = await sendMessage('check-for-update');
    expect(response.update).toEqual(expect.objectContaining({ version: '2026.7.13.2' }));
  });

  it('does not flag an update when buildMeta.json is unavailable and the tag is older', async () => {
    mockRelease('v2026.7.4', '2026-07-21T16:33:43Z', null);
    loadBackground();

    // Numeric fallback is wrong across the July discontinuity, but it is the
    // only signal left without a build timestamp. Documented, not desired.
    const response = await sendMessage('check-for-update');
    expect(response.update).toBeNull();
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
