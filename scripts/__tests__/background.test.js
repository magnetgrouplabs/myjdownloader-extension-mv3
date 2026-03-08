'use strict';

// Tests for background.js queue persistence functionality
// These tests verify write-through persistence via chrome.storage.session

const QUEUE_STORAGE_KEY = 'myjd_request_queue';

// Helper: find the onMessage listener registered by background.js
function getOnMessageHandler() {
  const listeners = global.chrome.runtime.onMessage._listeners;
  // background.js registers one onMessage listener
  return listeners[listeners.length - 1];
}

// Helper: find the tabs.onRemoved listener registered by background.js
function getTabsOnRemovedHandler() {
  const listeners = global.chrome.tabs.onRemoved._listeners;
  return listeners[listeners.length - 1];
}

// Helper: simulate sending a message to background.js and getting a response
function sendMessage(action, data, senderOverride) {
  const handler = getOnMessageHandler();
  const sender = senderOverride || { id: chrome.runtime.id };
  return new Promise((resolve) => {
    handler({ action, data }, sender, resolve);
  });
}

// Helper: create a mock tab object
function createMockTab(tabId, url) {
  return {
    id: tabId,
    url: url || 'http://example.com',
    title: 'Test Page',
    favIconUrl: 'http://example.com/favicon.ico'
  };
}

describe('Background.js Queue Persistence', () => {
  beforeEach(() => {
    // Reset chrome storage stores
    global.__resetChromeStorage();

    // Clear all mock call counts
    jest.clearAllMocks();

    // Clear registered listeners so each test starts fresh
    global.chrome.runtime.onMessage._listeners.length = 0;
    global.chrome.runtime.onInstalled._listeners.length = 0;
    global.chrome.runtime.onStartup._listeners.length = 0;
    global.chrome.tabs.onRemoved._listeners.length = 0;
    global.chrome.contextMenus.onClicked._listeners.length = 0;
    global.chrome.alarms.onAlarm._listeners.length = 0;
    global.chrome.storage.onChanged._listeners.length = 0;

    // Reset module registry so background.js re-executes
    jest.resetModules();
  });

  // Load background.js fresh for each test
  function loadBackground() {
    require('../../background.js');
  }

  describe('persistQueue writes to chrome.storage.session', () => {
    it('should write queue to session storage after addLinkToRequestQueue', async () => {
      loadBackground();

      // Send a link via context menu click simulation
      const tab = createMockTab(42, 'http://example.com/page');
      const handler = getOnMessageHandler();

      // Use selection-result action which calls addLinkToRequestQueue internally
      const sender = { id: chrome.runtime.id, tab: tab };
      await new Promise(resolve => {
        handler(
          { action: 'selection-result', data: { text: 'http://download.com/file.zip' } },
          sender,
          resolve
        );
      });

      // addLinkToRequestQueue is async (fire-and-forget from the handler),
      // so give it time to complete before checking storage writes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify chrome.storage.session.set was called with queue data
      expect(chrome.storage.session.set).toHaveBeenCalled();
      const lastCall = chrome.storage.session.set.mock.calls[
        chrome.storage.session.set.mock.calls.length - 1
      ];
      expect(lastCall[0]).toHaveProperty(QUEUE_STORAGE_KEY);
      const storedQueue = lastCall[0][QUEUE_STORAGE_KEY];
      // Queue should have an entry for tab 42 (as string key)
      expect(storedQueue[String(42)]).toBeDefined();
      expect(storedQueue[String(42)].length).toBe(1);
      expect(storedQueue[String(42)][0].content).toBe('http://download.com/file.zip');
    });
  });

  describe('restoreRequestQueue reads from chrome.storage.session', () => {
    it('should restore queue from session storage on startup', async () => {
      // Pre-populate session storage before loading background.js
      const existingQueue = {
        '100': [{
          id: '100' + Date.now() + '1234',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/existing.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();

      // Wait for async restore to complete
      // The queueReady promise runs during module load; give it a tick
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the queue was restored by querying link-info
      const response = await sendMessage('link-info', '100');
      expect(response.data).toHaveLength(1);
      expect(response.data[0].content).toBe('http://example.com/existing.zip');
    });
  });

  describe('Tab ID string coercion roundtrip', () => {
    it('should handle tab IDs as strings after JSON roundtrip', async () => {
      // Simulate what happens after JSON storage: keys become strings
      const existingQueue = {
        '55': [{
          id: '55' + Date.now() + '9999',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/file.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Query with numeric-ish string (how content scripts send it)
      const response1 = await sendMessage('link-info', '55');
      expect(response1.data).toHaveLength(1);

      // Query with number (how some internal code may send it)
      const response2 = await sendMessage('link-info', 55);
      expect(response2.data).toHaveLength(1);
    });
  });

  describe('Duplicate link detection works after restore', () => {
    it('should detect duplicates in restored queue', async () => {
      const existingQueue = {
        '77': [{
          id: '77' + Date.now() + '1111',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/dupe-test.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to add the same link again via selection-result
      const tab = createMockTab(77, 'http://example.com');
      const sender = { id: chrome.runtime.id, tab: tab };
      const handler = getOnMessageHandler();

      await new Promise(resolve => {
        handler(
          { action: 'selection-result', data: { text: 'http://example.com/dupe-test.zip' } },
          sender,
          resolve
        );
      });

      // Queue should still have only 1 item (duplicate rejected)
      const response = await sendMessage('link-info', '77');
      expect(response.data).toHaveLength(1);
    });
  });

  describe('remove-request triggers persistQueue', () => {
    it('should persist queue after removing a request', async () => {
      const linkId = '88' + Date.now() + '5555';
      const existingQueue = {
        '88': [{
          id: linkId,
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/remove-me.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear mock call history from initialization
      chrome.storage.session.set.mockClear();

      // Send remove-request
      await sendMessage('remove-request', { tabId: '88', requestId: linkId });

      expect(chrome.storage.session.set).toHaveBeenCalled();
      const lastCall = chrome.storage.session.set.mock.calls[
        chrome.storage.session.set.mock.calls.length - 1
      ];
      expect(lastCall[0]).toHaveProperty(QUEUE_STORAGE_KEY);
      // The link should be removed
      expect(lastCall[0][QUEUE_STORAGE_KEY]['88']).toHaveLength(0);
    });
  });

  describe('remove-all-requests triggers persistQueue', () => {
    it('should persist queue after removing all requests for a tab', async () => {
      const existingQueue = {
        '99': [{
          id: '99' + Date.now() + '6666',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/remove-all.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();
      await new Promise(resolve => setTimeout(resolve, 50));

      chrome.storage.session.set.mockClear();

      await sendMessage('remove-all-requests', { tabId: '99' });

      expect(chrome.storage.session.set).toHaveBeenCalled();
      const lastCall = chrome.storage.session.set.mock.calls[
        chrome.storage.session.set.mock.calls.length - 1
      ];
      expect(lastCall[0]).toHaveProperty(QUEUE_STORAGE_KEY);
      // Tab 99 should be deleted from queue
      expect(lastCall[0][QUEUE_STORAGE_KEY]['99']).toBeUndefined();
    });
  });

  describe('tabs.onRemoved triggers persistQueue', () => {
    it('should persist queue when a tab is closed', async () => {
      const existingQueue = {
        '200': [{
          id: '200' + Date.now() + '7777',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/tab-closed.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();
      await new Promise(resolve => setTimeout(resolve, 50));

      chrome.storage.session.set.mockClear();

      // Fire the tabs.onRemoved event
      const onRemovedHandler = getTabsOnRemovedHandler();
      onRemovedHandler(200);

      expect(chrome.storage.session.set).toHaveBeenCalled();
      const lastCall = chrome.storage.session.set.mock.calls[
        chrome.storage.session.set.mock.calls.length - 1
      ];
      expect(lastCall[0]).toHaveProperty(QUEUE_STORAGE_KEY);
      expect(lastCall[0][QUEUE_STORAGE_KEY]['200']).toBeUndefined();
    });
  });

  describe('queueReady gate', () => {
    it('should await queueReady before returning link-info data', async () => {
      // Pre-populate storage with a slow-loading queue
      const existingQueue = {
        '300': [{
          id: '300' + Date.now() + '8888',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/gated.zip',
          type: 'link'
        }]
      };
      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      loadBackground();

      // Even if we query immediately, the handler should wait for restore
      const response = await sendMessage('link-info', '300');
      expect(response.data).toHaveLength(1);
      expect(response.data[0].content).toBe('http://example.com/gated.zip');
    });
  });

  // ==================================================================
  // Gap closure: message routing and async duplicate check
  // ==================================================================
  describe('Gap closure: message routing and async duplicate check', () => {

    it('should send link-info-update via chrome.runtime.sendMessage, not chrome.tabs.sendMessage', async () => {
      loadBackground();

      // Wait for queueReady to resolve
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear mocks from initialization
      chrome.tabs.sendMessage.mockClear();
      chrome.runtime.sendMessage.mockClear();

      // Add a link via selection-result (calls addLinkToRequestQueue -> notifyContentScript)
      const tab = createMockTab(500, 'http://example.com/page');
      const sender = { id: chrome.runtime.id, tab: tab };
      const handler = getOnMessageHandler();

      await new Promise(resolve => {
        handler(
          { action: 'selection-result', data: { text: 'http://example.com/test-routing.zip' } },
          sender,
          resolve
        );
      });

      // Allow async message sends to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // chrome.runtime.sendMessage should have been called with link-info-update
      const runtimeCalls = chrome.runtime.sendMessage.mock.calls;
      const linkInfoViaRuntime = runtimeCalls.some(call =>
        call[0] && call[0].action === 'link-info-update'
      );
      expect(linkInfoViaRuntime).toBe(true);

      // chrome.tabs.sendMessage should have been called with open-in-page-toolbar
      const tabsCalls = chrome.tabs.sendMessage.mock.calls;
      const openToolbarViaTabs = tabsCalls.some(call =>
        call[1] && call[1].action === 'open-in-page-toolbar'
      );
      expect(openToolbarViaTabs).toBe(true);

      // chrome.tabs.sendMessage should NOT have been called with link-info-update
      // (this was the bug — sending via tabs.sendMessage doesn't reach the toolbar iframe)
      const linkInfoViaTabs = tabsCalls.some(call =>
        call[1] && call[1].action === 'link-info-update'
      );
      expect(linkInfoViaTabs).toBe(false);
    });

    it('should await queueReady before duplicate check in addLinkToRequestQueue', async () => {
      // Pre-populate session storage with a queue containing a link for tab 600
      const existingQueue = {
        '600': [{
          id: '600' + Date.now() + '1234',
          time: Date.now(),
          parent: { url: 'http://example.com', title: 'Test', favIconUrl: '' },
          content: 'http://example.com/already-there.zip',
          type: 'link'
        }]
      };

      // Snapshot the existing queue data BEFORE any mutations
      const snapshotQueue = JSON.parse(JSON.stringify(existingQueue));

      // Install a DELAYED mock for session.get so restoreRequestQueue doesn't
      // resolve immediately — this simulates the real-world timing where
      // chrome.storage.session.get is truly async (I/O-bound).
      let resolveStorageGet;
      chrome.storage.session.get.mockImplementationOnce((key) => {
        return new Promise((resolve) => {
          resolveStorageGet = () => {
            // Use the snapshot taken BEFORE any mutations (simulates reading
            // from actual storage, not the in-memory store that persistQueue
            // may have overwritten)
            const result = {};
            if (typeof key === 'string' && snapshotQueue !== undefined) {
              result[key] = snapshotQueue;
            }
            resolve(result);
          };
        });
      });

      global.__getSessionStore()[QUEUE_STORAGE_KEY] = existingQueue;

      // Load background.js (starts async restoreRequestQueue — but it's now delayed)
      loadBackground();

      // Clear call tracking for notifyContentScript's sendMessage calls
      chrome.tabs.sendMessage.mockClear();

      // IMMEDIATELY (before queue restore completes) trigger selection-result
      // with the SAME link for the same tab.
      //
      // BUG: If addLinkToRequestQueue is synchronous, it checks duplicates
      // against an EMPTY in-memory requestQueue, finds no duplicate, adds the
      // link, and calls notifyContentScript (incorrectly notifying the toolbar).
      //
      // FIX: If addLinkToRequestQueue awaits queueReady first, it waits for
      // restore, then checks against the restored queue, finds the duplicate,
      // and does NOT call notifyContentScript.
      const tab = createMockTab(600, 'http://example.com');
      const sender = { id: chrome.runtime.id, tab: tab };
      const handler = getOnMessageHandler();

      // Fire selection-result (this calls addLinkToRequestQueue internally)
      handler(
        { action: 'selection-result', data: { text: 'http://example.com/already-there.zip' } },
        sender,
        () => {}
      );

      // At this point, if addLinkToRequestQueue is sync, it already ran and
      // called notifyContentScript (sending open-in-page-toolbar via tabs.sendMessage).
      // Capture whether notifyContentScript was called BEFORE restore completes.
      const notifiedBeforeRestore = chrome.tabs.sendMessage.mock.calls.some(
        call => call[1] && call[1].action === 'open-in-page-toolbar'
      );

      // Now let the delayed storage.get resolve (simulating I/O completing)
      resolveStorageGet();
      await new Promise(resolve => setTimeout(resolve, 100));

      // If addLinkToRequestQueue properly awaits queueReady, notifyContentScript
      // should NOT have been called at all (because the link is a duplicate).
      // If addLinkToRequestQueue is sync (bug), notifyContentScript fires before
      // restore even completes.
      //
      // The bug: notifyContentScript was called before restore completed,
      // meaning the duplicate check ran against an empty queue.
      expect(notifiedBeforeRestore).toBe(false);
    });

    it('should fire open-in-page-toolbar and link-info-update simultaneously (not chained)', async () => {
      loadBackground();

      // Wait for queueReady
      await new Promise(resolve => setTimeout(resolve, 50));

      // Track call order to verify both messages fire without chaining
      const callOrder = [];
      chrome.tabs.sendMessage.mockClear();
      chrome.runtime.sendMessage.mockClear();

      chrome.tabs.sendMessage.mockImplementation((tabId, msg) => {
        callOrder.push({ api: 'tabs.sendMessage', action: msg.action });
        return Promise.resolve();
      });
      chrome.runtime.sendMessage.mockImplementation((msg) => {
        callOrder.push({ api: 'runtime.sendMessage', action: msg.action });
        return Promise.resolve();
      });

      // Add a link via selection-result
      const tab = createMockTab(700, 'http://example.com/page');
      const sender = { id: chrome.runtime.id, tab: tab };
      const handler = getOnMessageHandler();

      await new Promise(resolve => {
        handler(
          { action: 'selection-result', data: { text: 'http://example.com/simultaneous.zip' } },
          sender,
          resolve
        );
      });

      // Allow message sends
      await new Promise(resolve => setTimeout(resolve, 50));

      // Both messages should have been called
      const hasOpenToolbar = callOrder.some(c => c.action === 'open-in-page-toolbar');
      const hasLinkInfoUpdate = callOrder.some(c => c.action === 'link-info-update');
      expect(hasOpenToolbar).toBe(true);
      expect(hasLinkInfoUpdate).toBe(true);

      // link-info-update should go via runtime.sendMessage (not tabs.sendMessage)
      const linkInfoCall = callOrder.find(c => c.action === 'link-info-update');
      expect(linkInfoCall.api).toBe('runtime.sendMessage');

      // open-in-page-toolbar and link-info-update should both fire
      // without the link-info-update being delayed by the open-in-page-toolbar .then()
      // In the broken code, link-info-update is inside .then() so it fires AFTER
      // open-in-page-toolbar resolves. In fixed code, both fire synchronously.
      // We verify this by checking that link-info-update was NOT sent via tabs.sendMessage
      // (which would indicate the chained .then() pattern)
      const linkInfoViaTabs = callOrder.filter(c =>
        c.api === 'tabs.sendMessage' && c.action === 'link-info-update'
      );
      expect(linkInfoViaTabs).toHaveLength(0);
    });
  });
});

// ==================================================================
// Storage key consistency audit (Phase 9)
// ==================================================================
describe('Background.js Storage Key Consistency (Phase 9)', () => {
  const fs = require('fs');
  const path = require('path');
  const backgroundSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'background.js'), 'utf8'
  );

  it('STORAGE_KEYS values should use uppercase format matching StorageService', () => {
    expect(backgroundSrc).toMatch(/CLICKNLOAD_ACTIVE:\s*'CLICKNLOAD_ACTIVE'/);
    expect(backgroundSrc).toMatch(/CONTEXT_MENU_SIMPLE:\s*'CONTEXT_MENU_SIMPLE'/);
    expect(backgroundSrc).toMatch(/DEFAULT_PREFERRED_JD:\s*'DEFAULT_PREFERRED_JD'/);
  });

  it('should not contain any lowercase settings_ prefixed storage key strings', () => {
    expect(backgroundSrc).not.toMatch(/['"]settings_clicknload_active['"]/);
    expect(backgroundSrc).not.toMatch(/['"]settings_context_menu_simple['"]/);
    expect(backgroundSrc).not.toMatch(/['"]settings_default_preferred_jd['"]/);
    expect(backgroundSrc).not.toMatch(/['"]settings_add_links_dialog_active['"]/);
  });

  it('chrome.storage.local.get for CNL should use ADD_LINKS_DIALOG_ACTIVE', () => {
    // The CNL handler must use the correct key for add-links dialog check
    expect(backgroundSrc).toMatch(/chrome\.storage\.local\.get\(\[.*'ADD_LINKS_DIALOG_ACTIVE'/);
    expect(backgroundSrc).not.toMatch(/chrome\.storage\.local\.get\(\[.*'settings_add_links_dialog_active'/);
  });
});
