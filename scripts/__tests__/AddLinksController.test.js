'use strict';

const fs = require('fs');
const path = require('path');

// Read the source file for structural/behavioral verification
const source = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'AddLinksController.js'), 'utf8'
);

/**
 * Extract a named function body from source using brace counting.
 * Finds `function <name>(` and returns everything between its opening
 * and closing braces (inclusive).
 */
function extractFunction(src, name) {
  const startPattern = new RegExp('function\\s+' + name + '\\s*\\(');
  const match = startPattern.exec(src);
  if (!match) return null;

  let idx = src.indexOf('{', match.index);
  if (idx === -1) return null;

  let depth = 0;
  let start = idx;
  for (let i = idx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    if (depth === 0) {
      return src.substring(start, i + 1);
    }
  }
  return null;
}

const sendAddLinkQueriesBody = extractFunction(source, 'sendAddLinkQueries');

describe('AddLinksController - Batch Send Refactor', () => {

  it('sendAddLinkQueries function should exist in source', () => {
    expect(sendAddLinkQueriesBody).not.toBeNull();
  });

  it('sendAddLinkQueries should batch links with join("\\r\\n") concatenation', () => {
    // The batch pattern must join all link URLs with \r\n separator
    // Accept .join("\r\n") or .join("\\r\\n") in source
    const hasJoin = /\.join\s*\(\s*["']\\r\\n["']\s*\)/.test(sendAddLinkQueriesBody) ||
                    /\.join\s*\(\s*["']\r\n["']\s*\)/.test(sendAddLinkQueriesBody);
    expect(hasJoin).toBe(true);
  });

  it('sendAddLinkQueries should NOT recursively call itself', () => {
    // The old pattern had sendAddLinkQueries(addLinksQueries, callback) inside itself
    // Remove the function declaration match to only look at the body contents
    const bodyWithoutDeclaration = sendAddLinkQueriesBody.replace(
      /^function\s+sendAddLinkQueries\s*\([^)]*\)\s*\{/, ''
    );
    const hasRecursiveCall = /sendAddLinkQueries\s*\(/.test(bodyWithoutDeclaration);
    expect(hasRecursiveCall).toBe(false);
  });

  it('sendAddLinkQueries fail handler should set requestStates.ERROR', () => {
    // The .fail handler must set error state
    const failBlock = sendAddLinkQueriesBody.match(/\.fail\s*\(\s*function[\s\S]*?\}\s*\)/);
    expect(failBlock).not.toBeNull();
    expect(failBlock[0]).toMatch(/requestStates\.ERROR|requestStates\['ERROR'\]/);
  });

  it('sendAddLinkQueries fail handler should NOT call successClose or donecallback or callback', () => {
    // Extract the .fail handler block
    const failBlock = sendAddLinkQueriesBody.match(/\.fail\s*\(\s*function[\s\S]*?\}\s*\)/);
    expect(failBlock).not.toBeNull();
    const failContent = failBlock[0];
    expect(failContent).not.toMatch(/successClose\s*\(/);
    expect(failContent).not.toMatch(/donecallback\s*\(/);
    // callback() in fail means queue not retained -- should NOT appear
    expect(failContent).not.toMatch(/callback\s*\(/);
  });
});

describe('AddLinksController - CNL handoff (cleartext vs. encrypted)', () => {

  it('sends cleartext CNL links (urls) directly instead of as a dummycnl URL', () => {
    // Plain /flash/add delivers the links in cleartext. Wrapped into a
    // dummycnl URL JDownloader does NOT evaluate them (dummycnl only carries
    // crypted + jk/k) — the send reported success but nothing arrived.
    expect(source).toMatch(/query\.links\s*=\s*cnlParams\.urls/);
  });

  it('builds the dummycnl URL only behind a crypted guard', () => {
    expect(source).toMatch(/if\s*\(\s*cnlParams\.crypted\s*!==\s*undefined\s*\)/);
    // The dummycnl construction must no longer run unconditionally for every formData
    expect(source).not.toMatch(/genericDummyCnl/);
  });

  it('re-splits rawData bodies (urlencoded) into CNL fields', () => {
    expect(source).toMatch(/URLSearchParams\s*\(\s*cnlParams\.rawData\s*\)/);
  });

  it('forwards package and passwords from the CNL formData to the query', () => {
    expect(source).toMatch(/query\.packageName\s*=\s*cnlParams\.package/);
    expect(source).toMatch(/query\.downloadPassword\s*=\s*cnlParams\.passwords/);
  });
});

const toolbarSource = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'ToolbarController.js'), 'utf8'
);

describe('AddLinksController - device selection / connection race', () => {

  it('does not lock selection.device to a cold-cache SaveForLater placeholder', () => {
    // loadCachedDevices must only adopt a real cached device as the default.
    expect(source).toMatch(/hadCachedDevices\s*=\s*cachedDevices\.length\s*>\s*0/);
    expect(source).toMatch(/if\s*\(\s*!\$scope\.selection\.device\s*&&\s*hadCachedDevices\s*\)/);
  });

  it('gates the live device load on an established connection', () => {
    expect(source).toMatch(/function whenConnectionSettled/);
    expect(source).toMatch(/getConnectionObservable\(\)\.subscribe/);
    expect(source).toMatch(/whenConnectionSettled\(function \(\)/);
  });

  it('emits DEVICES_RECEIVED only after the live load (not from the cache)', () => {
    // The cache load must not emit DEVICES_RECEIVED; only the successful live
    // load does. The cache is display-only — arming the countdown from it
    // would outrun the real device list.
    const cacheFn = extractFunction(source, 'loadCachedDevices');
    expect(cacheFn).not.toBeNull();
    // No emit call in the cache path (a mentioning comment is fine).
    expect(cacheFn).not.toMatch(/\$emit\s*\([\s\S]{0,80}DEVICES_RECEIVED/);
  });

  it('does NOT arm the countdown on a failed device load (no silent Save-for-later)', () => {
    // The live-load catch branch must not emit DEVICES_RECEIVED. Doing so would
    // arm the auto-send countdown with no device selected, and send() would
    // silently fall back to the Save-for-later pseudo-device — re-introducing
    // exactly the bug this PR fixes. On failure the user stays in manual mode
    // with the error visible.
    const loadFn = extractFunction(source, 'whenConnectionSettled');
    expect(loadFn).not.toBeNull();
    const catchMatch = source.match(/\.catch\(function\s*\(\)\s*\{[\s\S]*?\}\);/);
    expect(catchMatch).not.toBeNull();
    // No DEVICES_RECEIVED emit in the failure path (a mentioning comment is fine).
    expect(catchMatch[0]).not.toMatch(/\$emit\s*\([\s\S]{0,80}DEVICES_RECEIVED/);
    // But the error message must still be surfaced.
    expect(catchMatch[0]).toMatch(/\$scope\.error\s*=/);
  });
});

describe('ToolbarController - cold-cache device default', () => {
  it('does not seed selection.device from an empty cache (SaveForLater)', () => {
    expect(toolbarSource).toMatch(/hadCachedDevices\s*=\s*cachedDevices\.length\s*>\s*0/);
    expect(toolbarSource).toMatch(/else if \(hadCachedDevices\)/);
  });
});
