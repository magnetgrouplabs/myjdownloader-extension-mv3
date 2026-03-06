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
