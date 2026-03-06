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
});
