// Jest setup for Chrome extension testing
// Provides comprehensive Chrome API mocks for background.js and other extension scripts

// In-memory stores for storage mocks
let sessionStore = {};
let localStore = {};

function createStorageArea(store) {
  return {
    get: jest.fn((keys) => {
      if (typeof keys === 'string') {
        const result = {};
        if (store[keys] !== undefined) result[keys] = store[keys];
        return Promise.resolve(result);
      }
      if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(k => { if (store[k] !== undefined) result[k] = store[k]; });
        return Promise.resolve(result);
      }
      if (keys === null || keys === undefined) {
        return Promise.resolve({ ...store });
      }
      // Object with defaults
      const result = {};
      Object.keys(keys).forEach(k => {
        result[k] = store[k] !== undefined ? store[k] : keys[k];
      });
      return Promise.resolve(result);
    }),
    set: jest.fn((items) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => delete store[k]);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(k => delete store[k]);
      return Promise.resolve();
    }),
    // Expose store for test inspection
    _store: store
  };
}

// Listeners collector for event-based APIs
function createEvent() {
  const listeners = [];
  return {
    addListener: jest.fn((fn) => listeners.push(fn)),
    removeListener: jest.fn((fn) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    hasListener: jest.fn((fn) => listeners.includes(fn)),
    _listeners: listeners,
    _fire: (...args) => listeners.forEach(fn => fn(...args))
  };
}

// Build global.chrome mock
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getManifest: jest.fn(() => ({
      name: 'MyJDownloader MV3',
      version: '1.0.0',
      manifest_version: 3
    })),
    sendMessage: jest.fn(() => Promise.resolve()),
    getContexts: jest.fn(() => Promise.resolve([])),
    onInstalled: createEvent(),
    onStartup: createEvent(),
    onMessage: createEvent(),
    lastError: null
  },
  storage: {
    session: createStorageArea(sessionStore),
    local: createStorageArea(localStore),
    onChanged: createEvent()
  },
  tabs: {
    sendMessage: jest.fn(() => Promise.resolve()),
    onRemoved: createEvent()
  },
  action: {
    setBadgeText: jest.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve())
  },
  contextMenus: {
    removeAll: jest.fn(() => Promise.resolve()),
    create: jest.fn(),
    onClicked: createEvent()
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([]))
  },
  alarms: {
    create: jest.fn(),
    onAlarm: createEvent()
  },
  offscreen: {
    createDocument: jest.fn(() => Promise.resolve()),
    closeDocument: jest.fn(() => Promise.resolve())
  },
  declarativeNetRequest: {
    updateSessionRules: jest.fn(() => Promise.resolve())
  }
};

// Helper to reset all storage between tests
global.__resetChromeStorage = function() {
  Object.keys(sessionStore).forEach(k => delete sessionStore[k]);
  Object.keys(localStore).forEach(k => delete localStore[k]);
};

// Helper to get the underlying session store for direct manipulation in tests
global.__getSessionStore = function() { return sessionStore; };
global.__getLocalStore = function() { return localStore; };
