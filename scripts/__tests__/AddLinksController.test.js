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
const sendCnlQueriesBody = extractFunction(source, 'sendCnlQueries');
const addToHistoryBody = extractFunction(source, 'addToHistory');
const saveOptionsAndHistoryBody = extractFunction(source, 'saveOptionsAndHistory');

describe('AddLinksController - Directory History (DIR-01..05)', () => {

  it('addToHistory function should exist', () => {
    expect(addToHistoryBody).not.toBeNull();
  });

  it('addToHistory saveto branch should use toLowerCase() for case-insensitive comparison', () => {
    expect(addToHistoryBody).toMatch(/toLowerCase\(\)/);
  });

  it('addToHistory saveto branch should normalize trailing slashes/backslashes', () => {
    expect(addToHistoryBody).toMatch(/replace\s*\(\s*\/\[.*\\\\.*\].*\/\s*,\s*['"]['"].*\)/);
  });

  it('addToHistory saveto branch should cap array at 10 entries', () => {
    const hasCap = /length\s*>\s*10/.test(addToHistoryBody) || /\.length\s*=\s*10/.test(addToHistoryBody);
    expect(hasCap).toBe(true);
  });

  it('addToHistory saveto branch should use splice to remove old entry and unshift for MRU', () => {
    expect(addToHistoryBody).toMatch(/splice/);
    expect(addToHistoryBody).toMatch(/unshift/);
  });

  it('addToHistory should preserve original behavior for non-saveto keys ($.inArray)', () => {
    expect(addToHistoryBody).toMatch(/\$\.inArray/);
  });

  it('clearSavetoHistory function should exist on $scope', () => {
    expect(source).toMatch(/\$scope\.clearSavetoHistory\s*=\s*function/);
  });

  it('clearSavetoHistory should empty saveto array', () => {
    // Look for pattern setting saveto to empty array
    const clearFuncMatch = source.match(/clearSavetoHistory\s*=\s*function[\s\S]*?(?=\$scope\.\w+\s*=\s*function|\}\s*;?\s*$)/);
    expect(clearFuncMatch).not.toBeNull();
    expect(clearFuncMatch[0]).toMatch(/\.saveto\s*=\s*\[\]/);
  });

  it('clearSavetoHistory should iterate all device keys in cached history', () => {
    const clearFuncMatch = source.match(/clearSavetoHistory\s*=\s*function[\s\S]*?(?=\$scope\.\w+\s*=\s*function|\}\s*;?\s*$)/);
    expect(clearFuncMatch).not.toBeNull();
    expect(clearFuncMatch[0]).toMatch(/Object\.keys/);
  });

  it('clearSavetoHistory should persist via storageService.set with ADD_LINK_CACHED_HISTORY', () => {
    const clearFuncMatch = source.match(/clearSavetoHistory\s*=\s*function[\s\S]*?(?=\$scope\.\w+\s*=\s*function|\}\s*;?\s*$)/);
    expect(clearFuncMatch).not.toBeNull();
    expect(clearFuncMatch[0]).toMatch(/storageService\.set.*ADD_LINK_CACHED_HISTORY/s);
  });

  it('saveOptionsAndHistory saveto section should be guarded by directoryHistoryEnabled', () => {
    expect(saveOptionsAndHistoryBody).toMatch(/directoryHistoryEnabled/);
  });

  it('source should read DIRECTORY_HISTORY_ENABLED setting', () => {
    expect(source).toMatch(/SETTINGS_DIRECTORY_HISTORY_ENABLED|DIRECTORY_HISTORY_ENABLED/);
  });
});

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

  it('sendCnlQueries should remain as a separate function', () => {
    // CNL queries must not be merged into the link batch
    expect(sendCnlQueriesBody).not.toBeNull();
    expect(sendCnlQueriesBody).toMatch(/sendRequest/);
  });
});
