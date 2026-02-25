'use strict';

console.log("Background: Starting MyJDownloader MV3...");

const STORAGE_KEYS = {
 CLICKNLOAD_ACTIVE: 'settings_clicknload_active',
 CONTEXT_MENU_SIMPLE: 'settings_context_menu_simple',
 DEFAULT_PREFERRED_JD: 'settings_default_preferred_jd'
};

const DEVICE_TYPES = {
 ASK_EVERY_TIME: { id: 'AskEveryTimeDevice', name: 'Ask every time' },
 LAST_USED: { id: 'LastUsedDevice', name: 'Last Used' }
};

let state = {
 isConnected: false,
 devices: [],
 selectedDevice: null
};

let settings = {};

// ============================================================
// Request queue - per-tab link storage for toolbar add-links flow
// ============================================================
let requestQueue = {};
let requestIDCounter = 0;

function addLinkToRequestQueue(link, tab) {
 let time = Date.now();
 let id = "" + tab.id + time + Math.floor(Math.random() * 10000);
 if (!requestQueue[tab.id]) {
  requestQueue[tab.id] = [];
 }
 let newLink = {
  id: id,
  time: time,
  parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
  content: link,
  type: "link"
 };

 // Check for duplicates
 let isDupe = false;
 for (let item of requestQueue[tab.id]) {
  if (item.type === newLink.type && item.content === newLink.content) {
   isDupe = true;
   break;
  }
 }

 if (!isDupe) {
  requestQueue[tab.id].push(newLink);
  notifyContentScript(tab.id);
 }
}

// Send toolbar messages to content script, injecting it first if needed
function notifyContentScript(tabId) {
 chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar", tabId: tabId })
  .then(() => {
   chrome.tabs.sendMessage(tabId, { action: "link-info-update", tabId: tabId }).catch(() => {});
  })
  .catch(() => {
   // Content script not loaded — inject it, then retry
   console.log("Background: Injecting toolbar content script into tab", tabId);
   chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['contentscripts/toolbarContentscript.js']
   }).then(() => {
    // Give content script a moment to initialize, then send messages
    setTimeout(() => {
     chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar", tabId: tabId }).catch(e => {
      console.error("Background: Failed to notify content script after injection:", e);
     });
     chrome.tabs.sendMessage(tabId, { action: "link-info-update", tabId: tabId }).catch(() => {});
    }, 100);
   }).catch(e => {
    console.error("Background: Failed to inject toolbar content script:", e);
   });
  });
}

function addPageToRequestQueue(tab) {
 if (tab && tab.url) {
  addLinkToRequestQueue(tab.url, tab);
 }
}

// ============================================================
// Offscreen document management
// ============================================================
let offscreenDocumentPath = 'offscreen.html';

async function hasOffscreenDocument() {
 const existingContexts = await chrome.runtime.getContexts({
  contextTypes: ['OFFSCREEN_DOCUMENT']
 });
 return existingContexts.length > 0;
}

async function createOffscreenDocument() {
 if (await hasOffscreenDocument()) {
  return;
 }
 console.log("Background: Creating offscreen document...");
 await chrome.offscreen.createDocument({
  url: offscreenDocumentPath,
  justification: 'MyJDownloader API operations require DOM access',
  reasons: ['LOCAL_STORAGE']
 });
 console.log("Background: Offscreen document created");
}

async function closeOffscreenDocument() {
 if (!await hasOffscreenDocument()) {
  return;
 }
 await chrome.offscreen.closeDocument();
 console.log("Background: Offscreen document closed");
}

async function sendToOffscreen(action, data = {}) {
 await createOffscreenDocument();
 return new Promise((resolve) => {
  chrome.runtime.sendMessage({
   target: 'offscreen',
   action: action,
   ...data
  }, (response) => {
   if (chrome.runtime.lastError) {
    console.error("Background: Offscreen error:", chrome.runtime.lastError.message);
    resolve({ error: chrome.runtime.lastError.message });
   } else {
    resolve(response || {});
   }
  });
 });
}

// ============================================================
// Badge and settings
// ============================================================
function updateBadge() {
 let text = state.isConnected ? "" : "!";
 chrome.action.setBadgeText({ text: text });
 chrome.action.setBadgeBackgroundColor({ color: "#f3d435" });
}

async function initSettings() {
 const result = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

 settings[STORAGE_KEYS.CLICKNLOAD_ACTIVE] = result[STORAGE_KEYS.CLICKNLOAD_ACTIVE] ?? true;
 settings[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] = result[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] ?? true;
 settings[STORAGE_KEYS.DEFAULT_PREFERRED_JD] = result[STORAGE_KEYS.DEFAULT_PREFERRED_JD] || DEVICE_TYPES.ASK_EVERY_TIME;

 if (settings[STORAGE_KEYS.CLICKNLOAD_ACTIVE]) {
  addCnlInterceptor();
 }

 initMenuItems();
 updateBadge();
}

function initMenuItems() {
 chrome.contextMenus.removeAll();
 if (settings[STORAGE_KEYS.CONTEXT_MENU_SIMPLE]) {
  chrome.contextMenus.create({
   id: "simple_menu_item",
   title: "Download with JDownloader",
   contexts: ["link", "page", "selection", "image", "video", "audio"]
  });
 } else {
  chrome.contextMenus.create({
   id: "download_page",
   title: "Add page to JDownloader",
   contexts: ["page"]
  });
  chrome.contextMenus.create({
   id: "download_link",
   title: "Add link to JDownloader",
   contexts: ["link"]
  });
  chrome.contextMenus.create({
   id: "download_selection",
   title: "Add selection to JDownloader",
   contexts: ["selection"]
  });
  chrome.contextMenus.create({
   id: "download_image",
   title: "Add image to JDownloader",
   contexts: ["image"]
  });
  chrome.contextMenus.create({
   id: "download_video",
   title: "Add video to JDownloader",
   contexts: ["video"]
  });
  chrome.contextMenus.create({
   id: "download_audio",
   title: "Add audio to JDownloader",
   contexts: ["audio"]
  });
 }
}

// ============================================================
// Context menu click handler — adds to request queue + opens toolbar
// ============================================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
 if (!tab || !tab.id) return;
 console.log("Background: Context menu click:", info.menuItemId);

 switch (info.menuItemId) {
  case "simple_menu_item":
   if (info.selectionText) {
    // For selection, send message to content script to get full selection
    chrome.tabs.sendMessage(tab.id, { action: "get-selection", tabId: tab.id });
   } else if (info.linkUrl) {
    addLinkToRequestQueue(info.linkUrl, tab);
   } else if (info.srcUrl) {
    addLinkToRequestQueue(info.srcUrl, tab);
   } else {
    addPageToRequestQueue(tab);
   }
   break;
  case "download_page":
   addPageToRequestQueue(tab);
   break;
  case "download_link":
   if (info.linkUrl) addLinkToRequestQueue(info.linkUrl, tab);
   break;
  case "download_selection":
   chrome.tabs.sendMessage(tab.id, { action: "get-selection", tabId: tab.id });
   break;
  case "download_image":
  case "download_video":
  case "download_audio":
   if (info.srcUrl) addLinkToRequestQueue(info.srcUrl, tab);
   break;
 }
});

// ============================================================
// Storage change listeners
// ============================================================
chrome.storage.onChanged.addListener((changes) => {
 if (changes.myjd_connection_state) {
  state.isConnected = changes.myjd_connection_state.newValue.isConnected;
  updateBadge();
 }
 if (changes[STORAGE_KEYS.CONTEXT_MENU_SIMPLE]) {
  settings[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] = changes[STORAGE_KEYS.CONTEXT_MENU_SIMPLE].newValue;
  initMenuItems();
 }
 if (changes[STORAGE_KEYS.CLICKNLOAD_ACTIVE]) {
  if (changes[STORAGE_KEYS.CLICKNLOAD_ACTIVE].newValue) addCnlInterceptor();
  else removeCnlInterceptor();
 }
 if (changes[STORAGE_KEYS.DEFAULT_PREFERRED_JD]) {
  settings[STORAGE_KEYS.DEFAULT_PREFERRED_JD] = changes[STORAGE_KEYS.DEFAULT_PREFERRED_JD].newValue;
 }
});

// ============================================================
// DeclarativeNetRequest for CNL
// ============================================================
function removeCnlInterceptor() {
 chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1, 2] }).catch(() => {});
}

function addCnlInterceptor() {
 const rules = [
  { id: 1, priority: 1, action: { type: "allow" }, condition: { urlFilter: ".*localhost:9666.*", resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] } },
  { id: 2, priority: 1, action: { type: "allow" }, condition: { urlFilter: ".*127\\.0\\.0\\.1:9666.*", resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] } }
 ];
 chrome.declarativeNetRequest.updateSessionRules({ addRules: rules }).catch(() => {});
}

// ============================================================
// Message handler — central routing for popup, toolbar, content scripts
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
 // Ignore messages intended for offscreen
 if (request.target === 'offscreen') return false;

 // Security: only accept messages from our own extension
 if (sender.id !== chrome.runtime.id) return false;

 const action = request.action;
 console.log("Background message:", action, "from:", sender.tab ? ('tab:' + sender.tab.id) : 'extension');

 // --- Offscreen management ---
 if (action === "check-offscreen") {
  hasOffscreenDocument().then(hasDoc => sendResponse({ exists: hasDoc }));
  return true;
 }

 if (action === "close-offscreen") {
  closeOffscreenDocument().then(() => sendResponse({ closed: true }));
  return true;
 }

 // --- Connection state ---
 if (action === "set-connection-state") {
  state.isConnected = request.data.isConnected;
  updateBadge();
  sendResponse({ status: 'ok' });
  return true;
 }

 // --- Badge update (from popup, which can't access chrome.action) ---
 if (action === "update-badge") {
  try {
   if (request.data && request.data.text !== undefined) {
    chrome.action.setBadgeText({ text: request.data.text });
   }
   if (request.data && request.data.color !== undefined) {
    chrome.action.setBadgeBackgroundColor({ color: request.data.color });
   }
   sendResponse({ status: 'ok' });
  } catch (e) {
   sendResponse({ status: 'error', error: e.message });
  }
  return true;
 }

 // --- Session info (used by popup + toolbar) ---
 if (action === "session-info") {
  chrome.storage.local.get(['myjd_session'], (result) => {
   sendResponse({
    data: {
     isLoggedIn: result.myjd_session ? true : false,
     connectionState: state.isConnected
    }
   });
  });
  return true;
 }

 // --- Wake check ---
 if (action === "wake") {
  sendResponse({ awake: true });
  return true;
 }

 // --- CONNECTION_STATE_CHANGE broadcast from popup's MyjdService ---
 if (action === "CONNECTION_STATE_CHANGE") {
  // Update internal state
  if (request.data === "CONNECTED") {
   state.isConnected = true;
  } else if (request.data === "DISCONNECTED") {
   state.isConnected = false;
  }
  updateBadge();
  sendResponse({ status: 'ok' });
  return true;
 }

 // ============================================================
 // Request queue handlers (for toolbar add-links flow)
 // ============================================================

 // Return the request queue for a specific tab
 if (action === "link-info") {
  let tabId = request.data;
  let queue = requestQueue[tabId] || [];
  sendResponse({ data: queue });
  return true;
 }

 // Remove a specific request from the queue
 if (action === "remove-request") {
  if (request.data && request.data.tabId && request.data.requestId) {
   let tabId = request.data.tabId;
   if (requestQueue[tabId]) {
    requestQueue[tabId] = requestQueue[tabId].filter(r => r.id !== request.data.requestId);
   }
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Remove all requests for a tab
 if (action === "remove-all-requests") {
  if (request.data && request.data.tabId) {
   delete requestQueue[request.data.tabId];
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Forward close-toolbar message to the content script in the tab
 if (action === "close-in-page-toolbar") {
  if (request.data && request.data.tabId) {
   let tabId = parseInt(request.data.tabId);
   chrome.tabs.sendMessage(tabId, { action: "close-in-page-toolbar" }).catch(() => {});
   delete requestQueue[tabId];
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Content script injection acknowledgement
 if (action === "tab-contentscript-injected") {
  sendResponse({ status: 'ok' });
  return true;
 }

 // ============================================================
 // Device polling (from popup's DeviceController)
 // ============================================================
 if (action === "device-poll") {
  // In MV3, device polling happens in the popup's MyjdService directly.
  // Acknowledge the message to prevent errors.
  sendResponse({ status: 'ok' });
  return true;
 }

 if (action === "device-poll-start" || action === "device-poll-stop") {
  sendResponse({ status: 'ok' });
  return true;
 }

 // ============================================================
 // API operations — forwarded to offscreen document
 // ============================================================

 // Device list
 if (action === "devices-pull") {
  sendToOffscreen('offscreen-get-devices').then(result => {
   // Return in format expected by both ToolbarController and ConnectedController
   // ToolbarController expects result.data to be the device array
   // ConnectedController expects result.result.devices or result.devices
   if (result.devices) {
    sendResponse({ data: { devices: result.devices, error: false } });
   } else {
    sendResponse({ data: result });
   }
  }).catch(err => {
   sendResponse({ error: err.message || 'Failed to get devices' });
  });
  return true;
 }

 // Login
 if (action === "login") {
  let creds = request.data;
  sendToOffscreen('offscreen-login', { credentials: creds }).then(result => {
   sendResponse({ data: result });
  }).catch(err => {
   sendResponse({ error: err.message });
  });
  return true;
 }

 // Whoami
 if (action === "whoami") {
  sendToOffscreen('offscreen-whoami').then(result => {
   sendResponse(result);
  }).catch(err => {
   sendResponse({ error: err.message });
  });
  return true;
 }

 // Logout
 if (action === "logout") {
  sendToOffscreen('offscreen-logout').then(result => {
   sendResponse(result);
  }).catch(err => {
   sendResponse({ error: err.message });
  });
  return true;
 }

 // Add link
 if (action === "add-link") {
  const device = request.data ? request.data.device : request.device;
  const query = request.data ? request.data.query : request.query;
  sendToOffscreen('offscreen-add-link', { deviceId: device?.id, query }).then(result => {
   sendResponse(result);
  }).catch(err => {
   sendResponse({ error: err.message });
  });
  return true;
 }

 // Add CNL
 if (action === "add-cnl") {
  const device = request.data ? request.data.device : request.device;
  const query = request.data ? request.data.query : request.query;
  sendToOffscreen('offscreen-add-cnl', { deviceId: device?.id, query }).then(result => {
   sendResponse(result);
  }).catch(err => {
   sendResponse({ error: err.message });
  });
  return true;
 }

 // Send feedback
 if (action === "send-feedback") {
  sendResponse({ status: 'ok' });
  return true;
 }

 // ============================================================
 // CNL captured from content script
 // ============================================================
 if (action === "cnl-captured") {
  console.log("Background: CNL captured:", request.data);
  handleCnlCaptured(request.data);
  sendResponse({ status: 'cnl-received' });
  return true;
 }

 // ============================================================
 // Autograbber status check from content script
 // ============================================================
 if (action === "is-active-on-tab") {
  sendResponse({ data: { active: false } });
  return true;
 }

 // ============================================================
 // Selection from content script
 // ============================================================
 if (action === "selection-result") {
  if (request.data && request.data.text && sender.tab) {
   addLinkToRequestQueue(request.data.text, sender.tab);
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Default: acknowledge unknown actions
 console.log("Background: Unhandled action:", action);
 sendResponse({ forwarded: true, action: action });
 return true;
});

// ============================================================
// CNL handling
// ============================================================
let cnlRequestQueue = [];

async function handleCnlCaptured(cnlData) {
 cnlRequestQueue.push({
  type: cnlData.type,
  url: cnlData.url,
  formData: cnlData.formData,
  sourceUrl: cnlData.sourceUrl,
  timestamp: cnlData.timestamp || Date.now()
 });

 await chrome.storage.local.set({ 'cnl_queue': cnlRequestQueue });

 try {
  const settings = await chrome.storage.local.get(['settings_add_links_dialog_active', 'settings_default_preferred_jd']);
  const shouldOpenPopup = settings.settings_add_links_dialog_active !== false;

  if (shouldOpenPopup) {
   await chrome.storage.local.set({ 'cnl_pending': true });
  } else {
   await processCnlViaOffscreen(cnlData);
  }
 } catch(e) {
  console.error("Background: Failed to handle CNL:", e);
 }
}

async function processCnlViaOffscreen(cnlData) {
 await createOffscreenDocument();
 const query = {
  links: cnlData.formData?.crypted || cnlData.formData?.urls || '',
  sourceUrl: cnlData.sourceUrl
 };
 const result = await sendToOffscreen('offscreen-add-cnl', { query: query });
 console.log("Background: CNL processed:", result);
 return result;
}

// ============================================================
// Clean up request queue when tabs are closed
// ============================================================
chrome.tabs.onRemoved.addListener((tabId) => {
 delete requestQueue[tabId];
});

// ============================================================
// Keep alive + init
// ============================================================
chrome.alarms.create('keepAlive', { periodInMinutes: 4 });
chrome.alarms.onAlarm.addListener(() => {
 console.log("Background: Keepalive alarm");
});

chrome.runtime.onInstalled.addListener(initSettings);
chrome.runtime.onStartup.addListener(initSettings);

initSettings();
console.log("Background ready");
