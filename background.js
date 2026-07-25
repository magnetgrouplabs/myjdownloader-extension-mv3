'use strict';

console.log("Background: Starting MyJDownloader MV3...");

// Key strings must match StorageService.settingsKeys values
const STORAGE_KEYS = {
 CLICKNLOAD_ACTIVE: 'CLICKNLOAD_ACTIVE',
 CONTEXT_MENU_SIMPLE: 'CONTEXT_MENU_SIMPLE',
 DEFAULT_PREFERRED_JD: 'DEFAULT_PREFERRED_JD'
};

const DEVICE_TYPES = {
 ASK_EVERY_TIME: { id: 'AskEveryTimeDevice', name: 'Ask every time' },
 LAST_USED: { id: 'LastUsedDevice', name: 'Last Used' }
};

let state = {
 isConnected: false,
 devices: [],
 selectedDevice: null,
 updateAvailable: false
};

let settings = {};

// ============================================================
// Request queue - per-tab link storage for toolbar add-links flow
// ============================================================
let requestQueue = {};
let requestIDCounter = 0;

const QUEUE_STORAGE_KEY = 'myjd_request_queue';

async function restoreRequestQueue() {
 try {
  const result = await chrome.storage.session.get(QUEUE_STORAGE_KEY);
  if (result[QUEUE_STORAGE_KEY]) {
   requestQueue = result[QUEUE_STORAGE_KEY];
   console.log('Background: Restored request queue from session storage');
  }
 } catch (e) {
  console.error('Background: Failed to restore queue:', e);
 }
}

function persistQueue() {
 chrome.storage.session.set({ [QUEUE_STORAGE_KEY]: requestQueue }).catch(err => {
  console.error('Background: Failed to persist queue:', err);
 });
}

let queueReady = restoreRequestQueue();

// Make chrome.storage.session accessible from content scripts (for myjdCaptchaSolver.js)
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// ============================================================
// MYJD CAPTCHA CSP rule management
// ============================================================
function addCspStrippingRule(tabId) {
 let ruleId = 10000 + tabId;
 chrome.declarativeNetRequest.updateSessionRules({
  addRules: [{
   id: ruleId,
   priority: 1,
   action: {
    type: 'modifyHeaders',
    responseHeaders: [
     { header: 'Content-Security-Policy', operation: 'remove' },
     { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
     { header: 'X-Content-Security-Policy', operation: 'remove' }
    ]
   },
   condition: {
    tabIds: [tabId],
    resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest']
   }
  }]
 }).catch(function(err) {
  console.error('Background: Failed to add CSP stripping rule for tab', tabId, err);
 });
}

function removeCspStrippingRule(tabId) {
 let ruleId = 10000 + tabId;
 chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [ruleId]
 }).catch(function(err) {
  console.error('Background: Failed to remove CSP stripping rule for tab', tabId, err);
 });
}

async function addLinkToRequestQueue(link, tab) {
 await queueReady;
 let tabKey = String(tab.id);
 let time = Date.now();
 let id = "" + tab.id + time + Math.floor(Math.random() * 10000);
 if (!requestQueue[tabKey]) {
  requestQueue[tabKey] = [];
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
 for (let item of requestQueue[tabKey]) {
  if (item.type === newLink.type && item.content === newLink.content) {
   isDupe = true;
   break;
  }
 }

 if (!isDupe) {
  requestQueue[tabKey].push(newLink);
  persistQueue();
  notifyContentScript(tab.id);
 }
}

// Send toolbar messages to content script, injecting it first if needed
function notifyContentScript(tabId) {
 // open-in-page-toolbar -> content script (shows/creates iframe)
 chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar", tabId: tabId })
  .catch(() => {
   // Content script not loaded — inject it, then retry
   console.log("Background: Injecting toolbar content script into tab", tabId);
   chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['contentscripts/toolbarContentscript.js']
   }).then(() => {
    setTimeout(() => {
     chrome.tabs.sendMessage(tabId, { action: "open-in-page-toolbar", tabId: tabId }).catch(e => {
      console.error("Background: Failed to notify content script after injection:", e);
     });
    }, 100);
    // Delayed link-info-update for freshly created iframe (Angular bootstrap time)
    setTimeout(() => {
     chrome.runtime.sendMessage({ action: "link-info-update", tabId: tabId }).catch(() => {});
    }, 500);
   }).catch(e => {
    console.error("Background: Failed to inject toolbar content script:", e);
   });
  });

 // link-info-update -> all extension contexts (toolbar iframe's ToolbarController listens via chrome.runtime.onMessage)
 chrome.runtime.sendMessage({ action: "link-info-update", tabId: tabId }).catch(() => {});
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

let creatingOffscreenDocument = null;
async function createOffscreenDocument() {
 if (await hasOffscreenDocument()) {
  return;
 }
 // Lock: initSettings (warm start) and sendToOffscreen can arrive here almost
 // simultaneously. Without this shared promise two createDocument() calls run
 // in parallel → "Only a single offscreen document may be created". The second
 // caller waits on the first instead.
 if (!creatingOffscreenDocument) {
  console.log("Background: Creating offscreen document...");
  creatingOffscreenDocument = chrome.offscreen.createDocument({
   url: offscreenDocumentPath,
   justification: 'MyJDownloader API operations require DOM access',
   reasons: ['LOCAL_STORAGE']
  }).then(() => {
   console.log("Background: Offscreen document created");
  }).finally(() => {
   creatingOffscreenDocument = null;
  });
 }
 await creatingOffscreenDocument;
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
 // Connection problems ("!") take precedence over the update hint.
 let text = state.isConnected ? "" : "!";
 let color = "#f3d435";
 if (text === "" && state.updateAvailable) {
  text = "NEW";
  color = "#4a90d9";
 }
 chrome.action.setBadgeText({ text: text });
 chrome.action.setBadgeBackgroundColor({ color: color });
}

// ============================================================
// Update notifier
// ============================================================
//
// This extension is installed unpacked (Load unpacked from a release zip), so
// Chrome's auto-update never runs and users have no way to learn that a new
// release exists. A daily alarm asks the GitHub releases API for the latest
// tag and, when it is newer than the running version, stores the release info
// and shows a "NEW" badge plus a banner in the settings view. Only DATA is
// fetched — no code is downloaded or executed (MV3 remotely-hosted-code
// policy). The user still updates manually from the releases page.
const UPDATE_CHECK_ALARM = 'updateCheck';
const UPDATE_STORAGE_KEY = 'myjd_update_available';
const RELEASES_API = 'https://api.github.com/repos/magnetgrouplabs/myjdownloader-extension-mv3/releases/latest';
const RELEASES_PAGE = 'https://github.com/magnetgrouplabs/myjdownloader-extension-mv3/releases/latest';

// Numeric per-component compare so zero-padded tags ("2026.07.20") and the
// 4th-component re-release scheme ("2026.7.13.1" > "2026.7.13") both order
// correctly. Returns > 0 when a is newer than b.
//
// This is only a FALLBACK for ordering releases. It cannot be trusted on its
// own: the third component changed meaning on 2026-07-21, from the day of the
// month to a per-month release counter. Numerically 2026.7.4 < 2026.7.13.1,
// but 2026.7.4 (the 4th July release, published 2026-07-21) is in fact newer
// than 2026.7.13.1 (published 2026-07-13). Ordering by publish date instead
// is what makes the notifier correct across that discontinuity, and keeps it
// correct if the scheme ever changes again. See isNewerRelease().
function compareVersions(a, b) {
 const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
 const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
 const len = Math.max(pa.length, pb.length);
 for (let i = 0; i < len; i++) {
  const d = (pa[i] || 0) - (pb[i] || 0);
  if (d !== 0) return d;
 }
 return 0;
}

// buildMeta.json is written by the release workflow and ships inside the zip.
// Its "timestamp" is when this build was cut, which is the only local value
// that can be compared against a release's publish date. Cached because the
// file never changes for the life of a build.
let buildTimestampPromise = null;
function getBuildTimestamp() {
 if (!buildTimestampPromise) {
  buildTimestampPromise = (async () => {
   try {
    const resp = await fetch(chrome.runtime.getURL('buildMeta.json'));
    if (!resp.ok) return 0;
    const meta = await resp.json();
    const ts = Number(meta && meta.timestamp);
    return Number.isFinite(ts) && ts > 0 ? ts : 0;
   } catch (e) {
    // Dev checkout without a generated buildMeta.json.
    return 0;
   }
  })();
 }
 return buildTimestampPromise;
}

// True when the given release is newer than the running build. Prefers publish
// date over version numbers (see compareVersions), and only falls back to the
// numeric compare when there is no usable timestamp on one side.
async function isNewerRelease(version, publishedAt) {
 const current = chrome.runtime.getManifest().version;
 // Numeric equality, not string equality: Chrome strips leading zeros, so the
 // tag "v2026.07.13.1" is the running "2026.7.13.1". Catching that here also
 // keeps the date compare below from ever seeing the release it is running.
 if (compareVersions(version, current) === 0) return false;
 const releasedAt = typeof publishedAt === 'number' ? publishedAt : Date.parse(publishedAt || '');
 const buildAt = await getBuildTimestamp();
 if (buildAt > 0 && Number.isFinite(releasedAt) && releasedAt > 0) {
  return releasedAt > buildAt;
 }
 return compareVersions(version, current) > 0;
}

async function checkForUpdate() {
 try {
  const resp = await fetch(RELEASES_API, {
   headers: { 'Accept': 'application/vnd.github+json' }
  });
  if (!resp.ok) return null;
  const release = await resp.json();
  if (!release || typeof release.tag_name !== 'string') return null;
  const latest = release.tag_name.replace(/^v/, '');
  const publishedAt = Date.parse(release.published_at || '');
  if (await isNewerRelease(latest, publishedAt)) {
   const info = {
    version: latest,
    url: release.html_url || RELEASES_PAGE,
    // Persisted so the restore path in initSettings() can re-apply the same
    // date comparison instead of falling back to the numeric one.
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : null
   };
   await chrome.storage.local.set({ [UPDATE_STORAGE_KEY]: info });
   state.updateAvailable = true;
   updateBadge();
   return info;
  }
  // Up to date (or the user updated in the meantime): clear any stale flag.
  await chrome.storage.local.remove(UPDATE_STORAGE_KEY);
  state.updateAvailable = false;
  updateBadge();
  return null;
 } catch (e) {
  // Offline or rate limited — stay quiet, the next alarm retries.
  return null;
 }
}

async function initSettings() {
 const result = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

 settings[STORAGE_KEYS.CLICKNLOAD_ACTIVE] = result[STORAGE_KEYS.CLICKNLOAD_ACTIVE] ?? true;
 settings[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] = result[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] ?? true;
 settings[STORAGE_KEYS.DEFAULT_PREFERRED_JD] = result[STORAGE_KEYS.DEFAULT_PREFERRED_JD] || DEVICE_TYPES.ASK_EVERY_TIME;

 if (settings[STORAGE_KEYS.CLICKNLOAD_ACTIVE]) {
  addCnlInterceptor();
 }

 // Restore the update hint across service-worker restarts; drop it once the
 // running version has caught up with the stored one.
 const upd = await chrome.storage.local.get(UPDATE_STORAGE_KEY);
 const updInfo = upd[UPDATE_STORAGE_KEY];
 if (updInfo && await isNewerRelease(updInfo.version, updInfo.publishedAt)) {
  state.updateAvailable = true;
 } else if (updInfo) {
  chrome.storage.local.remove(UPDATE_STORAGE_KEY);
 }

 initMenuItems();
 updateBadge();

 // Warm start: hand the stored session to the offscreen document and set the
 // badge from its answer, without the user having to open the popup first.
 // The session travels in the message because an offscreen document created
 // very early at browser startup can be missing chrome.storage entirely (a
 // Chromium quirk); its own restore path then cannot read the session, the
 // connection never happens and the "!" badge stays stuck.
 const sess = await chrome.storage.local.get('myjd_session');
 if (sess.myjd_session) {
  warmStartConnect(sess.myjd_session, false);
 }
}

function warmStartConnect(sessionData, isRetry) {
 sendToOffscreen('offscreen-restore-session', { sessionData: sessionData }).then((resp) => {
  if (resp && resp.success) {
   state.isConnected = true;
   updateBadge();
   console.log('Background: warm start connected' + (resp.alreadyConnected ? ' (already connected)' : ''));
  } else {
   console.warn('Background: warm start restore failed:', (resp && resp.error) || 'no response');
   // One retry for startup races (network not up yet). Best effort: if the
   // service worker is suspended before the timer fires, the popup path
   // still connects as before.
   if (!isRetry) {
    setTimeout(() => warmStartConnect(sessionData, true), 15000);
   }
  }
 });
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
//
// IMPORTANT: this extension talks to JDownloader through the MyJDownloader
// *cloud* API - there is no real JDownloader listening on 127.0.0.1:9666 /
// localhost:9666 on the user's machine. CNL-enabled hosters commonly point
// a hidden <iframe> (sub_frame navigation) or a <script> tag directly at
// that address, which is a raw browser-level network request that content
// scripts CANNOT intercept by overriding window.fetch/XMLHttpRequest (that
// only catches JS-initiated calls, not iframe src navigations or classic
// <script src> loads). A previous version of this file only added an
// "allow" declarativeNetRequest rule here, which just lets the request
// proceed to the network unmodified - since nothing is really listening on
// that port, it fails outright ("Links konnten nicht uebertragen werden").
//
// The fix: actually fake the responses at the network layer via
// declarativeNetRequest "redirect" to data: URLs, which works regardless
// of whether the request came from fetch/XHR, a <script> tag, or an
// <iframe> navigation. The CNL payload itself (for add/addcrypted2) is
// captured separately via a non-blocking webRequest.onBeforeRequest
// listener below, which can read the URL's query string (GET-style CNL)
// or the POST body (form-style CNL) before the redirect takes it away.
const CNL_JD_CHECK_RESPONSE = 'var jdownloader = true;\nvar jdownloaderVersion = "2026.03.08";';
const CNL_CROSSDOMAIN_RESPONSE = '<?xml version="1.0"?>\n<cross-domain-policy>\n  <site-control permitted-cross-domain-policies="master-only"/>\n  <allow-access-from domain="*"/>\n  <allow-http-request-headers-from domain="*" headers="*"/>\n</cross-domain-policy>';
const CNL_OK_RESPONSE = 'OK';

function dataUrl(mime, content) {
 return 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(content);
}

const CNL_RULE_IDS = [1, 2, 3, 4, 5, 6];
// Every resource type a hoster's CNL script could plausibly use to reach
// 127.0.0.1:9666 - <script src>, <iframe src>, fetch/XHR, <img>/ping, etc.
const CNL_RESOURCE_TYPES = ['sub_frame', 'xmlhttprequest', 'script', 'ping', 'other', 'object', 'media', 'image'];

function removeCnlInterceptor() {
 chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: CNL_RULE_IDS }).catch(() => {});
}

function addCnlInterceptor() {
 const rules = [
  {
   id: 1, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/javascript', CNL_JD_CHECK_RESPONSE) } },
   condition: { urlFilter: '*://localhost:9666/jdcheck.js*', resourceTypes: CNL_RESOURCE_TYPES }
  },
  {
   id: 2, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/javascript', CNL_JD_CHECK_RESPONSE) } },
   condition: { urlFilter: '*://127.0.0.1:9666/jdcheck.js*', resourceTypes: CNL_RESOURCE_TYPES }
  },
  {
   id: 3, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/xml', CNL_CROSSDOMAIN_RESPONSE) } },
   condition: { urlFilter: '*://localhost:9666/crossdomain.xml*', resourceTypes: CNL_RESOURCE_TYPES }
  },
  {
   id: 4, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/xml', CNL_CROSSDOMAIN_RESPONSE) } },
   condition: { urlFilter: '*://127.0.0.1:9666/crossdomain.xml*', resourceTypes: CNL_RESOURCE_TYPES }
  },
  {
   // covers both /flash/add and /flash/addcrypted2
   id: 5, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/plain', CNL_OK_RESPONSE) } },
   condition: { urlFilter: '*://localhost:9666/flash/add*', resourceTypes: CNL_RESOURCE_TYPES }
  },
  {
   id: 6, priority: 1,
   action: { type: 'redirect', redirect: { url: dataUrl('text/plain', CNL_OK_RESPONSE) } },
   condition: { urlFilter: '*://127.0.0.1:9666/flash/add*', resourceTypes: CNL_RESOURCE_TYPES }
  }
 ];
 chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: CNL_RULE_IDS, addRules: rules }).catch(function(err) {
  console.error('Background: Failed to add CNL redirect rules:', err);
 });
}

// ============================================================
// webRequest-based CNL payload capture (network layer)
// ============================================================
// Fires for every request to /flash/add* on the CNL ports, regardless of
// whether it was triggered by an <iframe> navigation, a <script> tag, or
// fetch/XHR. This is purely observational (no "blocking" extraInfoSpec,
// which MV3 no longer supports for most extensions anyway) - the actual
// fake-success response is produced by the declarativeNetRequest redirect
// rules above; this listener's only job is to read the CNL payload before
// the redirect takes the request away.
function parseCnlRequestBody(details) {
 const formData = {};

 if (details.requestBody) {
  if (details.requestBody.formData) {
   Object.keys(details.requestBody.formData).forEach(function(key) {
    formData[key] = details.requestBody.formData[key][0];
   });
   return formData;
  }
  if (details.requestBody.raw && details.requestBody.raw.length) {
   try {
    const decoder = new TextDecoder('utf-8');
    const rawStr = details.requestBody.raw
     .map(function(chunk) { return chunk.bytes ? decoder.decode(chunk.bytes) : ''; })
     .join('');
    const params = new URLSearchParams(rawStr);
    let any = false;
    for (const [key, value] of params.entries()) { formData[key] = value; any = true; }
    if (any) return formData;
   } catch (e) {
    console.error('Background: Failed to decode CNL raw POST body:', e);
   }
  }
 }

 // GET-style CNL: payload lives in the query string
 try {
  const urlObj = new URL(details.url);
  let any = false;
  for (const [key, value] of urlObj.searchParams.entries()) { formData[key] = value; any = true; }
  if (any) return formData;
 } catch (e) {
  console.error('Background: Failed to parse CNL query string:', e);
 }

 return null;
}

chrome.webRequest.onBeforeRequest.addListener(
 function(details) {
  if (settings[STORAGE_KEYS.CLICKNLOAD_ACTIVE] === false) return;

  const formData = parseCnlRequestBody(details);
  if (!formData || (!formData.crypted && !formData.dlc && !formData.urls)) return;

  const type = details.url.indexOf('addcrypted2') !== -1 ? 'ADD_CRYPTED' : 'ADD';
  console.log('Background: CNL payload captured via webRequest:', type, details.url);
  const cnlPayload = {
   type: type,
   url: details.url,
   formData: formData,
   sourceUrl: details.documentUrl || details.initiator || '',
   timestamp: Date.now()
  };

  if (details.tabId >= 0) {
   chrome.tabs.get(details.tabId, function(tab) {
    handleCnlCaptured(cnlPayload, chrome.runtime.lastError ? null : tab);
   });
  }
 },
 { urls: [ 'http://127.0.0.1:9666/flash/*', 'http://localhost:9666/flash/*' ] },
 ['requestBody']
);


// ============================================================
// Message handler — central routing for popup, toolbar, content scripts
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
 // Validate message format
 if (!request || typeof request !== 'object') return false;

 // Ignore messages intended for offscreen
 if (request.target === 'offscreen') return false;

 // Security: only accept messages from our own extension
 if (sender.id !== chrome.runtime.id) return false;

 const action = request.action;
 if (!action || typeof action !== 'string') return false;

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

 // --- Update notifier (manual check from the settings view) ---
 if (action === "check-for-update") {
  checkForUpdate().then((info) => sendResponse({ update: info }));
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
  (async () => {
   await queueReady;
   let tabId = String(request.data);
   let queue = requestQueue[tabId] || [];
   sendResponse({ data: queue });
  })();
  return true;
 }

 // Remove a specific request from the queue
 if (action === "remove-request") {
  if (request.data && request.data.tabId && request.data.requestId) {
   let tabId = String(request.data.tabId);
   if (requestQueue[tabId]) {
    requestQueue[tabId] = requestQueue[tabId].filter(r => r.id !== request.data.requestId);
    persistQueue();
   }
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Remove all requests for a tab
 if (action === "remove-all-requests") {
  if (request.data && request.data.tabId) {
   delete requestQueue[String(request.data.tabId)];
   persistQueue();
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // Forward close-toolbar message to the content script in the tab
 if (action === "close-in-page-toolbar") {
  if (request.data && request.data.tabId) {
   let tabId = parseInt(request.data.tabId);
   chrome.tabs.sendMessage(tabId, { action: "close-in-page-toolbar" }).catch(() => {});
   delete requestQueue[String(tabId)];
   persistQueue();
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
  handleCnlCaptured(request.data, sender.tab);
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
 // onCopyContentscript.js replies to "get-selection" with action
 // "new-selection" (data: { text, html }). "selection-result" is kept for
 // compatibility, but nothing ships that name today; handling only it left
 // the whole right-click-with-a-selection path dead (issue #15).
 if (action === "new-selection" || action === "selection-result") {
  if (request.data && request.data.text && sender.tab) {
   addLinkToRequestQueue(request.data.text, sender.tab);
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // ============================================================
 // CAPTCHA tab tracking and message handling
 // ============================================================

 // MYJD CAPTCHA: prepare tab (write session storage, add CSP rule, navigate)
 if (action === "myjd-prepare-captcha-tab") {
  (async () => {
   try {
    let tabId = request.data.tabId;
    let jobDetails = request.data.jobDetails;
    await chrome.storage.session.set({ myjd_captcha_job: jobDetails });
    addCspStrippingRule(tabId);
    chrome.tabs.update(tabId, { url: jobDetails.targetUrl + '#rc2jdt' });
    activeCaptchaTabs[tabId] = {
     callbackUrl: 'MYJD',
     captchaId: jobDetails.captchaId,
     captchaType: jobDetails.captchaType,
     hoster: jobDetails.hoster,
     detectedAt: Date.now()
    };
    console.log('Background: MYJD CAPTCHA tab prepared:', tabId, jobDetails.hoster);
    sendResponse({ status: 'ok' });
   } catch (err) {
    console.error('Background: Failed to prepare MYJD CAPTCHA tab:', err);
    sendResponse({ status: 'error', error: err.message });
   }
  })();
  return true;
 }

 // MYJD CAPTCHA: execute invisible/v3 CAPTCHA in MAIN world
 if (action === "myjd-captcha-execute") {
  if (sender.tab) {
   chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: 'MAIN',
    args: [request.data.siteKey, request.data.v3action],
    func: function(siteKey, v3action) {
     if (typeof grecaptcha !== 'undefined') {
      grecaptcha.ready(function() {
       var opts = v3action ? { action: v3action } : {};
       grecaptcha.execute(siteKey, opts);
      });
     } else if (typeof hcaptcha !== 'undefined') {
      hcaptcha.execute();
     }
    }
   }).catch(function(err) {
    console.error('Background: Failed to execute CAPTCHA in MAIN world:', err);
   });
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 // captcha-can-close: close sender tab (fallback for window.close())
 if (action === "captcha-can-close") {
  if (sender.tab) {
   chrome.tabs.remove(sender.tab.id, function() {
    if (chrome.runtime.lastError) { /* ignore */ }
   });
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 if (action === "captcha-tab-detected") {
  if (sender.tab) {
   activeCaptchaTabs[sender.tab.id] = {
    callbackUrl: request.data.callbackUrl,
    captchaType: request.data.captchaType,
    hoster: request.data.hoster,
    captchaId: request.data.captchaId,
    detectedAt: Date.now()
   };
   console.log('Background: CAPTCHA tab detected:', sender.tab.id, request.data.captchaType);
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 if (action === "captcha-solved") {
  if (sender.tab) {
   delete activeCaptchaTabs[sender.tab.id];
  }
  if (request.data.callbackUrl === 'MYJD' && request.data.captchaId) {
   // MYJD flow: route solution through my.jdownloader.org tabs
   chrome.tabs.query({
    url: ['http://my.jdownloader.org/*', 'https://my.jdownloader.org/*']
   }, function(tabs) {
    if (tabs && tabs.length > 0) {
     for (var i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, {
       name: 'response',
       type: 'myjdrc2',
       data: { captchaId: request.data.captchaId, token: request.data.token }
      }, function() { /* ignore errors */ });
     }
    }
   });
   // Auto-close sender tab and clean up CSP rule
   if (sender.tab) {
    removeCspStrippingRule(sender.tab.id);
    setTimeout(function() {
     chrome.tabs.remove(sender.tab.id, function() {
      if (chrome.runtime.lastError) { /* ignore */ }
     });
    }, 2000);
   }
  } else if (request.data.callbackUrl && request.data.callbackUrl !== 'MYJD') {
   // Localhost flow: submit token via HTTP GET.
   // MV3 service workers have no XMLHttpRequest -> use fetch().
   // AbortSignal.timeout covers ontimeout, the catch covers onerror.
   (async function() {
    try {
     var solveResponse = await fetch(request.data.callbackUrl + '&do=solve&response=' + encodeURIComponent(request.data.token), {
      headers: { 'X-Myjd-Appkey': 'webextension-' + chrome.runtime.getManifest().version },
      signal: AbortSignal.timeout(10000)
     });
     if (solveResponse.ok) {
      console.log('Background: CAPTCHA token submitted to JDownloader');
      if (sender.tab) {
       setTimeout(function() {
        chrome.tabs.remove(sender.tab.id, function() {
         if (chrome.runtime.lastError) { /* ignore - tab may already be closed */ }
        });
       }, 2000);
      }
     } else {
      console.error('Background: CAPTCHA submission failed, HTTP status:', solveResponse.status);
     }
    } catch (e) {
     console.error('Background: CAPTCHA submission network error or timeout for', request.data.callbackUrl, e);
    }
   })();
  } else {
   console.log('Background: CAPTCHA token captured (no JDownloader callback):', request.data.token.substring(0, 20) + '...');
  }
  sendResponse({ status: 'ok' });
  return true;
 }

 if (action === "captcha-skip") {
  if (sender.tab) {
   delete activeCaptchaTabs[sender.tab.id];
  }
  if (request.data.callbackUrl === 'MYJD' && request.data.captchaId) {
   // MYJD flow: send tab-closed to my.jdownloader.org tabs
   chrome.tabs.query({
    url: ['http://my.jdownloader.org/*', 'https://my.jdownloader.org/*']
   }, function(tabs) {
    if (tabs && tabs.length > 0) {
     for (var i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, {
       name: 'tab-closed',
       type: 'myjdrc2',
       data: { captchaId: request.data.captchaId }
      }, function() { /* ignore errors */ });
     }
    }
   });
   // Close sender tab and clean up CSP rule
   if (sender.tab) {
    removeCspStrippingRule(sender.tab.id);
    setTimeout(function() {
     chrome.tabs.remove(sender.tab.id, function() {
      if (chrome.runtime.lastError) { /* ignore */ }
     });
    }, 2000);
   }
  } else if (request.data.callbackUrl && request.data.callbackUrl !== 'MYJD') {
   // Localhost flow: send skip via HTTP GET.
   // MV3 service workers have no XMLHttpRequest -> use fetch().
   (async function() {
    try {
     await fetch(request.data.callbackUrl + '&do=skip&skiptype=' + request.data.skipType, {
      headers: { 'X-Myjd-Appkey': 'webextension-' + chrome.runtime.getManifest().version },
      signal: AbortSignal.timeout(10000)
     });
     console.log('Background: CAPTCHA skip sent to JDownloader, type:', request.data.skipType);
     if (sender.tab) {
      setTimeout(function() {
       chrome.tabs.remove(sender.tab.id, function() {
        if (chrome.runtime.lastError) { /* ignore - tab may already be closed */ }
       });
      }, 2000);
     }
    } catch (e) {
     console.error('Background: CAPTCHA skip network error or timeout for', request.data.callbackUrl, e);
    }
   })();
  } else {
   console.log('Background: CAPTCHA skip captured (no JDownloader callback), type:', request.data.skipType);
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
// A real local JDownloader is not reachable from the browser (it commonly
// runs on a different machine/NAS, e.g. in Docker) - classic ClickNLoad only
// ever works when browser and JDownloader share the same host. So instead of
// trying to talk CNL2 over the (unreachable) network, captured CNL requests
// are routed through the exact same requestQueue + in-page toolbar flow that
// already works for normal "add link" requests. The toolbar UI's
// AddLinksController wraps the raw CNL form data into a
// https://dummycnl.jdownloader.org/#<hex> URL and submits it via the regular
// /linkgrabberv2/addLinks device API call - JDownloader itself recognizes
// that URL and decrypts the embedded CNL2 payload locally. This is the same
// mechanism the official MyJDownloader extension uses for this exact case.
async function handleCnlCaptured(cnlData, tab) {
 await queueReady;

 if (!tab || tab.id === undefined || tab.id === null) {
  console.error('Background: CNL captured but no tab context, dropping:', cnlData.url);
  return;
 }

 let tabKey = String(tab.id);
 let time = Date.now();
 let id = "" + tab.id + time + Math.floor(Math.random() * 10000);

 let newRequest = {
  id: id,
  time: time,
  type: "cnl",
  parent: { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl },
  content: {
   requestBody: { formData: cnlData.formData || {} },
   url: cnlData.sourceUrl,
   source: (cnlData.formData && cnlData.formData.source) || cnlData.sourceUrl
  }
 };

 if (!requestQueue[tabKey]) {
  requestQueue[tabKey] = [];
 }
 requestQueue[tabKey].push(newRequest);
 persistQueue();
 notifyContentScript(tab.id);
}

// ============================================================
// CAPTCHA tab tracking (in-memory, NOT persisted)
// ============================================================
let activeCaptchaTabs = {};

// ============================================================
// Clean up request queue and CAPTCHA tabs when tabs are closed
// ============================================================
chrome.tabs.onRemoved.addListener((tabId) => {
 // Existing: clean up request queue
 delete requestQueue[String(tabId)];
 persistQueue();

 // Always clean up CSP rules for closed tabs
 removeCspStrippingRule(tabId);

 // CAPTCHA: send skip on tab close (CAP-07)
 if (activeCaptchaTabs[tabId]) {
  var info = activeCaptchaTabs[tabId];
  delete activeCaptchaTabs[tabId];
  if (info.callbackUrl === 'MYJD') {
   // MYJD flow: send tab-closed to my.jdownloader.org tabs
   chrome.tabs.query({
    url: ['http://my.jdownloader.org/*', 'https://my.jdownloader.org/*']
   }, function(tabs) {
    if (tabs && tabs.length > 0) {
     for (var i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, {
       name: 'tab-closed',
       type: 'myjdrc2',
       data: { captchaId: info.captchaId }
      }, function() { /* ignore errors */ });
     }
    }
   });
   console.log('Background: MYJD CAPTCHA tab closed, sent tab-closed for', info.hoster);
  } else if (info.callbackUrl) {
   // MV3 service workers have no XMLHttpRequest -> use fetch() (fire-and-forget).
   fetch(info.callbackUrl + '&do=skip&skiptype=single', {
    headers: { 'X-Myjd-Appkey': 'webextension-' + chrome.runtime.getManifest().version },
    signal: AbortSignal.timeout(10000)
   }).catch(function(e) {
    console.error('Background: CAPTCHA tab-close skip network error or timeout for', info.hoster, e);
   });
   console.log('Background: CAPTCHA tab closed, sent skip(single) for', info.hoster);
  } else {
   console.log('Background: CAPTCHA tab closed (no JDownloader callback) for', info.hoster);
  }
 }
});

// ============================================================
// Keep alive + init
// ============================================================
chrome.alarms.create('keepAlive', { periodInMinutes: 4 });
chrome.alarms.create(UPDATE_CHECK_ALARM, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
 if (alarm && alarm.name === UPDATE_CHECK_ALARM) {
  checkForUpdate();
  return;
 }
 console.log("Background: Keepalive alarm");
});

chrome.runtime.onInstalled.addListener(initSettings);
chrome.runtime.onStartup.addListener(initSettings);

initSettings();
console.log("Background ready");
