'use strict';

// Runtime tests for the "resolve-links" action in background.js.
// The host resolver module is mocked on globalThis.MyjdHostResolvers.

const CACHE_KEY = 'myjd_resolved_links';
const HOUR = 60 * 60 * 1000;

function createEvent() {
  const listeners = [];
  return {
    addListener: jest.fn((fn) => listeners.push(fn)),
    removeListener: jest.fn((fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    }),
    _listeners: listeners,
    _fire: (...args) => listeners.slice().forEach((fn) => fn(...args))
  };
}

function sendMessage(action, data) {
  const listeners = global.chrome.runtime.onMessage._listeners;
  const handler = listeners[listeners.length - 1];
  return new Promise((resolve) => {
    handler({ action, data }, { id: chrome.runtime.id }, resolve);
  });
}

// Let pending promise callbacks run (works under fake timers too).
async function flush(n = 30) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

async function waitFor(cond, ms = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 1));
  }
}

const FILE_URL = 'https://files.example/dl/abc';
const LANDING = 'https://fileditch.example/landing/1';
const LANDING2 = 'https://fileditch.example/landing/2';

describe('background.js resolve-links', () => {
  let nextTabId;
  let scriptQueue;
  let resolver;

  function makeResolver() {
    return {
      id: 'fileditch',
      label: 'FileDitch',
      match: (u) => u.includes('fileditch'),
      extractFromHtml: jest.fn((html) => {
        if (html.includes('FILE=')) return { url: FILE_URL };
        if (html.includes('MISMATCH')) return { error: 'mismatch' };
        return { error: 'not-found' };
      })
    };
  }

  function okFetch(html) {
    return jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(html)
    }));
  }

  beforeEach(() => {
    global.__resetChromeStorage();
    jest.clearAllMocks();
    jest.resetModules();

    const c = global.chrome;
    c.runtime.onMessage._listeners.length = 0;
    c.runtime.onInstalled._listeners.length = 0;
    c.runtime.onStartup._listeners.length = 0;
    c.tabs.onRemoved._listeners.length = 0;
    c.contextMenus.onClicked._listeners.length = 0;
    c.alarms.onAlarm._listeners.length = 0;
    c.storage.onChanged._listeners.length = 0;
    c.webRequest.onBeforeRequest._listeners.length = 0;
    c.commands.onCommand._listeners.length = 0;

    nextTabId = 100;
    scriptQueue = [];
    c.tabs.onUpdated = createEvent();
    c.tabs.create = jest.fn(() => Promise.resolve({ id: nextTabId++ }));
    c.tabs.get = jest.fn(() => Promise.resolve({ status: 'loading' }));
    c.tabs.update = jest.fn((id, props, cb) => { if (cb) cb(); });
    c.tabs.remove = jest.fn((id, cb) => { if (cb) cb(); });
    c.scripting.executeScript = jest.fn(() => {
      const next = scriptQueue.length ? scriptQueue.shift() : '<html>FILE=1</html>';
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve([{ result: { title: 't', html: next } }]);
    });

    resolver = makeResolver();
    global.importScripts = jest.fn();
    global.MyjdHostResolvers = {
      findResolver: jest.fn((u) => (resolver.match(u) ? resolver : null)),
      resolveTarget: jest.fn((u) => {
        if (resolver.match(u)) return { url: u, resolver };
        const m = /[?&]to=([^&]+)/.exec(u);
        if (m) {
          const decoded = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          if (resolver.match(decoded)) return { url: decoded, resolver };
        }
        return null;
      }),
      looksLikeInterstitial: jest.fn((u) => /redirect|goto|[?&](url|to)=/.test(u)),
      isChallengePage: jest.fn((html) => typeof html === 'string' && html.includes('CHALLENGE'))
    };
    // Default: the fast path fails on the network so the tab path is used.
    global.fetch = jest.fn(() => Promise.reject(new Error('net')));
    // jsdom has no AbortSignal.timeout; the extension runtime does.
    if (typeof AbortSignal.timeout !== 'function') AbortSignal.timeout = () => new AbortController().signal;

    require('../../background.js');
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.MyjdHostResolvers;
    delete global.importScripts;
  });

  async function startedTab(count = 1) {
    await waitFor(() => chrome.tabs.create.mock.calls.length >= count
      && chrome.tabs.onUpdated._listeners.length > 0);
    return 100 + count - 1;
  }

  it('loads the resolver scripts with importScripts', () => {
    expect(global.importScripts).toHaveBeenCalledWith(
      'scripts/resolvers/hostResolvers.js',
      'scripts/resolvers/hosts/fileditch.js'
    );
  });

  it('leaves a URL with no resolver out of results', async () => {
    const res = await sendMessage('resolve-links', { urls: ['https://other.example/x'] });
    expect(res).toEqual({ results: {} });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('returns a cache hit without fetch or tabs', async () => {
    global.__getSessionStore()[CACHE_KEY] = {
      [LANDING]: { url: 'https://cached.example/f', expiresAt: Date.now() + HOUR }
    };
    const res = await sendMessage('resolve-links', { urls: [LANDING] });
    expect(res.results[LANDING]).toEqual({ url: 'https://cached.example/f', resolver: 'fileditch' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('drops an expired cache entry and resolves again', async () => {
    global.__getSessionStore()[CACHE_KEY] = {
      [LANDING]: { url: 'https://old.example/f', expiresAt: Date.now() - 1000 }
    };
    global.fetch = okFetch('<html>FILE=1</html>');
    const res = await sendMessage('resolve-links', { urls: [LANDING] });
    expect(res.results[LANDING].url).toBe(FILE_URL);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.__getSessionStore()[CACHE_KEY][LANDING].url).toBe(FILE_URL);
  });

  it('resolves through the fetch fast path without opening a tab', async () => {
    global.fetch = okFetch('<html>FILE=1</html>');
    const res = await sendMessage('resolve-links', { urls: [LANDING] });
    expect(res.results[LANDING]).toEqual({ url: FILE_URL, resolver: 'fileditch' });
    expect(global.fetch).toHaveBeenCalledWith(LANDING, expect.objectContaining({
      credentials: 'include',
      redirect: 'follow'
    }));
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('falls through to the tab when the fetch returns a challenge page', async () => {
    global.fetch = okFetch('<html>CHALLENGE</html>');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    const id = await startedTab();
    chrome.tabs.onUpdated._fire(id, { status: 'complete' });
    const res = await p;
    expect(res.results[LANDING].url).toBe(FILE_URL);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: LANDING, active: false });
  });

  it('falls through to the tab on the cf-mitigated header', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (k) => (k === 'cf-mitigated' ? 'challenge' : null) },
      text: () => Promise.resolve('<html>FILE=1</html>')
    }));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    const id = await startedTab();
    chrome.tabs.onUpdated._fire(id, { status: 'complete' });
    const res = await p;
    expect(res.results[LANDING].url).toBe(FILE_URL);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('inspects a tab that was already complete before the listener was attached', async () => {
    chrome.tabs.get = jest.fn(() => Promise.resolve({ status: 'complete' }));
    const res = await sendMessage('resolve-links', { urls: [LANDING] });
    expect(res.results[LANDING]).toEqual({ url: FILE_URL, resolver: 'fileditch' });
    expect(chrome.tabs.get).toHaveBeenCalledWith(100);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));
  });

  it('tab path success removes the tab, drops listeners and caches the result', async () => {
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    const id = await startedTab();
    chrome.tabs.onUpdated._fire(id, { status: 'loading' }); // ignored
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    chrome.tabs.onUpdated._fire(id, { status: 'complete' });
    const res = await p;
    expect(res.results[LANDING]).toEqual({ url: FILE_URL, resolver: 'fileditch' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(id, expect.any(Function));
    expect(chrome.tabs.onUpdated._listeners).toHaveLength(0);
    const cached = global.__getSessionStore()[CACHE_KEY][LANDING];
    expect(cached.url).toBe(FILE_URL);
    expect(cached.expiresAt).toBeGreaterThan(Date.now() + 2 * HOUR);
    expect(cached.expiresAt).toBeLessThanOrEqual(Date.now() + 2.5 * HOUR);
  });

  it('caps a resolver expiresAt at 2.5 hours and keeps a shorter one', async () => {
    resolver.extractFromHtml = jest.fn(() => ({ url: FILE_URL, expiresAt: Date.now() + 10 * HOUR }));
    global.fetch = okFetch('<html>x</html>');
    await sendMessage('resolve-links', { urls: [LANDING] });
    expect(global.__getSessionStore()[CACHE_KEY][LANDING].expiresAt)
      .toBeLessThanOrEqual(Date.now() + 2.5 * HOUR);

    const soon = Date.now() + 60000;
    resolver.extractFromHtml = jest.fn(() => ({ url: FILE_URL, expiresAt: soon }));
    await sendMessage('resolve-links', { urls: [LANDING2] });
    expect(global.__getSessionStore()[CACHE_KEY][LANDING2].expiresAt).toBe(soon);
  });

  it('activates the tab on a challenge page and succeeds after the next complete', async () => {
    scriptQueue.push('<html>CHALLENGE</html>', '<html>FILE=1</html>');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    const id = await startedTab();
    chrome.tabs.onUpdated._fire(id, { status: 'complete' });
    await waitFor(() => chrome.tabs.update.mock.calls.length === 1);
    expect(chrome.tabs.update).toHaveBeenCalledWith(id, { active: true }, expect.any(Function));
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    chrome.tabs.onUpdated._fire(id, { status: 'complete' });
    const res = await p;
    expect(res.results[LANDING].url).toBe(FILE_URL);
    expect(chrome.tabs.update).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(id, expect.any(Function));
  });

  it('yields tab-closed when the user closes the tab, without removing it again', async () => {
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    const id = await startedTab();
    chrome.tabs.onRemoved._fire(id);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'tab-closed', resolver: 'fileditch' });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    expect(chrome.tabs.onUpdated._listeners).toHaveLength(0);
  });

  it('yields timeout after 25 s and removes the tab', async () => {
    jest.useFakeTimers('modern');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(24000);
    await flush();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1500);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'timeout', resolver: 'fileditch' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));
    expect(chrome.tabs.onUpdated._listeners).toHaveLength(0);
  });

  it('extends to 150 s once a challenge is shown, then yields challenge-timeout', async () => {
    jest.useFakeTimers('modern');
    scriptQueue.push(...Array(400).fill('<html>CHALLENGE</html>'));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    expect(chrome.tabs.update).toHaveBeenCalledTimes(1);
    await tick(100000); // past the 25 s limit, inside 150 s
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    await tick(51000);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'challenge-timeout', resolver: 'fileditch' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));
  });

  it('keeps the worker alive with periodic API calls while a resolve is pending', async () => {
    jest.useFakeTimers('modern');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.storage.session.get.mockClear();
    jest.advanceTimersByTime(21000);
    expect(chrome.storage.session.get).toHaveBeenCalledWith(CACHE_KEY);
    jest.advanceTimersByTime(30000);
    await p;
    chrome.storage.session.get.mockClear();
    jest.advanceTimersByTime(60000);
    expect(chrome.storage.session.get).not.toHaveBeenCalled();
  });

  // Advance fake time in 500 ms steps, letting promise callbacks run after each step.
  async function tick(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 500) {
      jest.advanceTimersByTime(500);
      await flush();
    }
  }

  it('passes resolver error codes through once the timer fires', async () => {
    jest.useFakeTimers('modern');
    global.fetch = okFetch('<html>MISMATCH</html>');
    scriptQueue.push(...Array(60).fill('<html>MISMATCH</html>'));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    await tick(26000);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'mismatch', resolver: 'fileditch' });
  });

  it('reports not-found (not timeout) when the page loads but never yields a link', async () => {
    jest.useFakeTimers('modern');
    scriptQueue.push(...Array(80).fill('<html>nothing</html>'));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    await tick(24000);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    await tick(2000);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'not-found', resolver: 'fileditch' });
    expect(chrome.scripting.executeScript.mock.calls.length).toBeGreaterThan(10);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('keeps polling when the extractor fails twice and succeeds on the third poll', async () => {
    jest.useFakeTimers('modern');
    scriptQueue.push('<html>nothing</html>', '<html>nothing</html>', '<html>FILE=1</html>');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    await tick(500);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    await tick(500);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ url: FILE_URL, resolver: 'fileditch' });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(3);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));
  });

  it('activates the tab once for a challenge that appears mid-polling and switches to 150 s', async () => {
    jest.useFakeTimers('modern');
    scriptQueue.push('<html>nothing</html>', '<html>CHALLENGE</html>', '<html>CHALLENGE</html>');
    scriptQueue.push(...Array(400).fill('<html>CHALLENGE</html>'));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    await tick(1000);
    expect(chrome.tabs.update).toHaveBeenCalledTimes(1);
    await tick(60000); // past the 25 s limit
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    await tick(100000);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'challenge-timeout', resolver: 'fileditch' });
    expect(chrome.tabs.update).toHaveBeenCalledTimes(1);
  });

  it('stops polling when the tab is removed', async () => {
    jest.useFakeTimers('modern');
    scriptQueue.push(...Array(50).fill('<html>nothing</html>'));
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush();
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    await flush();
    await tick(1000);
    chrome.tabs.onRemoved._fire(100);
    const res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'tab-closed', resolver: 'fileditch' });
    const calls = chrome.scripting.executeScript.mock.calls.length;
    await tick(5000);
    expect(chrome.scripting.executeScript.mock.calls.length).toBe(calls);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('opens the tab immediately when the fetch page loads but the extractor says not-found', async () => {
    jest.useFakeTimers('modern');
    global.fetch = okFetch('<html>nothing</html>');
    const p = sendMessage('resolve-links', { urls: [LANDING] });
    await flush(); // no timers advanced
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    chrome.tabs.onUpdated._fire(100, { status: 'complete' });
    const res = await p;
    expect(res.results[LANDING].url).toBe(FILE_URL);
  });

  it('yields tab-error when executeScript throws or tabs.create rejects', async () => {
    scriptQueue.push(new Error('cannot access'));
    let p = sendMessage('resolve-links', { urls: [LANDING] });
    chrome.tabs.onUpdated._fire(await startedTab(), { status: 'complete' });
    let res = await p;
    expect(res.results[LANDING]).toEqual({ error: 'tab-error', resolver: 'fileditch' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(100, expect.any(Function));

    chrome.tabs.create = jest.fn(() => Promise.reject(new Error('no window')));
    res = await sendMessage('resolve-links', { urls: [LANDING2] });
    expect(res.results[LANDING2]).toEqual({ error: 'tab-error', resolver: 'fileditch' });
  });

  it('yields no-resolver-module when MyjdHostResolvers is missing', async () => {
    delete global.MyjdHostResolvers;
    const res = await sendMessage('resolve-links', { urls: [LANDING] });
    expect(res.results[LANDING].error).toBe('no-resolver-module');
  });

  it('processes two URLs one tab at a time', async () => {
    const p = sendMessage('resolve-links', { urls: [LANDING, LANDING2] });
    const id1 = await startedTab(1);
    await flush();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1); // second not opened yet
    chrome.tabs.onUpdated._fire(id1, { status: 'complete' });
    await waitFor(() => chrome.tabs.create.mock.calls.length === 2);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(id1, expect.any(Function));
    chrome.tabs.onUpdated._fire(101, { status: 'complete' });
    const res = await p;
    expect(Object.keys(res.results)).toEqual([LANDING, LANDING2]);
    expect(res.results[LANDING2].url).toBe(FILE_URL);
  });

  it('serialises two concurrent requests too', async () => {
    const p1 = sendMessage('resolve-links', { urls: [LANDING] });
    const p2 = sendMessage('resolve-links', { urls: [LANDING2] });
    const id1 = await startedTab(1);
    await flush();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    chrome.tabs.onUpdated._fire(id1, { status: 'complete' });
    await p1;
    await waitFor(() => chrome.tabs.create.mock.calls.length === 2);
    chrome.tabs.onUpdated._fire(101, { status: 'complete' });
    const res2 = await p2;
    expect(res2.results[LANDING2].url).toBe(FILE_URL);
  });

  describe('interstitial links', () => {
    const TARGET = 'https://fileditchvids.st/file/xyz';
    const WRAP_STATIC = 'https://simpcity.cr/redirect/?to='
      + Buffer.from(TARGET).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      + '&e=1&m=b64';
    const WRAP_FETCH = 'https://wrap.example/out?url=opaque-token-123';

    function htmlResp(url, body, extra) {
      return Object.assign({
        ok: true, status: 200, url,
        headers: { get: () => null },
        text: () => Promise.resolve(body)
      }, extra);
    }

    it('resolves a statically decodable wrapper without fetching the interstitial', async () => {
      global.fetch = jest.fn((u) => Promise.resolve(htmlResp(u, '<html>FILE=1</html>')));
      const res = await sendMessage('resolve-links', { urls: [WRAP_STATIC] });
      expect(res.results[WRAP_STATIC]).toEqual({ url: FILE_URL, resolver: 'fileditch', target: TARGET });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toBe(TARGET);
      expect(global.__getSessionStore()[CACHE_KEY][WRAP_STATIC].url).toBe(FILE_URL);
      expect(global.__getSessionStore()[CACHE_KEY][TARGET]).toBeUndefined();
    });

    it('follows the redirect of an undecodable wrapper and uses resp.url', async () => {
      global.fetch = jest.fn((u) => Promise.resolve(u === WRAP_FETCH
        ? htmlResp('https://fileditchvids.st/file/redirected', '<html>nothing useful</html>')
        : htmlResp(u, '<html>FILE=1</html>')));
      const res = await sendMessage('resolve-links', { urls: [WRAP_FETCH] });
      expect(res.results[WRAP_FETCH]).toEqual({
        url: FILE_URL, resolver: 'fileditch', target: 'https://fileditchvids.st/file/redirected'
      });
      expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([
        WRAP_FETCH, 'https://fileditchvids.st/file/redirected'
      ]);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('scans the wrapper page for the first resolvable link', async () => {
      const body = '<a href="https:\/\/other.example\/ad">ad</a>'
        + '<a href="https://fileditchvids.st/file/scan?a=1&amp;b=2">Proceed</a>';
      global.fetch = jest.fn((u) => Promise.resolve(u === WRAP_FETCH
        ? htmlResp(u, body)
        : htmlResp(u, '<html>FILE=1</html>')));
      const res = await sendMessage('resolve-links', { urls: [WRAP_FETCH] });
      expect(res.results[WRAP_FETCH].target).toBe('https://fileditchvids.st/file/scan?a=1&b=2');
      expect(res.results[WRAP_FETCH].url).toBe(FILE_URL);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('does nothing for a plain URL', async () => {
      const res = await sendMessage('resolve-links', { urls: ['https://example.com/page.html'] });
      expect(res.results).toEqual({});
      expect(global.fetch).not.toHaveBeenCalled();
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('leaves a challenged interstitial out of results and opens no tab', async () => {
      global.fetch = jest.fn((u) => Promise.resolve(htmlResp(u, '<html>CHALLENGE</html>')));
      const res = await sendMessage('resolve-links', { urls: [WRAP_FETCH] });
      expect(res.results).toEqual({});
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('leaves an interstitial out of results when its fetch fails or nothing matches', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('net')));
      let res = await sendMessage('resolve-links', { urls: [WRAP_FETCH] });
      expect(res.results).toEqual({});
      global.fetch = jest.fn((u) => Promise.resolve(htmlResp(u, '<a href="https://other.example/x">x</a>')));
      res = await sendMessage('resolve-links', { urls: [WRAP_FETCH] });
      expect(res.results).toEqual({});
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
  });
});
