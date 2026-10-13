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

describe('AddLinksController - Resolve in Browser', () => {
  const tcSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'partials', 'templateCache.js'), 'utf8'
  );
  const sendStart = source.indexOf('$scope.send = function');
  const sendBody = source.slice(sendStart);

  it('only collects URLs when the stored setting is on and the resolver module exists', () => {
    const fn = extractFunction(source, 'collectResolvableUrls');
    expect(fn).not.toBeNull();
    expect(fn).toMatch(/isResolveInBrowserOn\(\)/);
    expect(fn).toMatch(/window\.MyjdHostResolvers/);
    expect(fn).toMatch(/findResolver/);
    const on = extractFunction(source, 'isResolveInBrowserOn');
    expect(on).toMatch(/optionalDefaults\[key\]/);
    expect(on).toMatch(/RESOLVE_IN_BROWSER\.defaultValue/);
    expect(on).toMatch(/return value === true/);
  });

  it('gate includes URLs the resolver statically targets or that look like an interstitial', () => {
    const fn = extractFunction(source, 'collectResolvableUrls');
    expect(fn).toMatch(/matchesResolverStatically\(resolvers, trimmed\)/);
    expect(fn).toMatch(/looksLikeInterstitial\(resolvers, trimmed\)/);
    const stat = extractFunction(source, 'matchesResolverStatically');
    expect(stat).toMatch(/typeof resolvers\.resolveTarget === "function"/);
    expect(stat).toMatch(/resolvers\.resolveTarget\(url\)/);
    expect(stat).toMatch(/resolvers\.findResolver\(url\)/);
    const loose = extractFunction(source, 'looksLikeInterstitial');
    expect(loose).toMatch(/typeof resolvers\.looksLikeInterstitial === "function"/);
  });

  it('an interstitial absent from the reply produces no warning', () => {
    const idx = sendBody.indexOf('var entry = results[url]');
    const branch = sendBody.slice(idx, sendBody.indexOf('$scope.state.resolving = null', idx));
    expect(branch).toMatch(/\(entry && entry\.error\) \|\|\s*matchesResolverStatically\(window\.MyjdHostResolvers, url\)/);
    expect(branch.match(/warnings\.push/g).length).toBe(1);
  });

  it('runs the existing path untouched when nothing is resolvable', () => {
    expect(sendBody).toMatch(/resolveUrls\.length === 0\)\s*\{\s*sendResolved\(\{\}, \[\]\);/);
  });

  it('only resolves link and text requests', () => {
    const fn = extractFunction(source, 'collectResolvableUrls');
    expect(fn).toMatch(/request\.type !== "link" && request\.type !== "text"/);
  });

  it('substitutes resolved URLs into query.links and keeps sourceUrl as the page url', () => {
    expect(sendBody).toMatch(/resolved\[contentKey\] !== undefined\s*\?\s*resolved\[contentKey\]\s*:\s*request\.content/);
    expect(sendBody).toMatch(/query\.sourceUrl = request\.parent\.url/);
  });

  it('keeps the original content and records a warning for failures', () => {
    expect(sendBody).toMatch(/warnings\.push\(\{ url: url, reason: describeResolveError\(entry\) \}\)/);
    expect(sendBody).toMatch(/"no-reply"/);
    expect(sendBody).toMatch(/entry && entry\.url && !entry\.error/);
    expect(sendBody).toMatch(/reason: "no-reply"/);
    expect(sendBody).toMatch(/state\.sending\.log = JSON\.stringify\(warnings\)/);
  });

  it('shows the resolving state and clears it when the reply arrives', () => {
    expect(sendBody).toMatch(/state\.resolving = \{ count: resolveUrls\.length \}/);
    expect(sendBody).toMatch(/state\.resolving = null/);
  });

  it('suppresses the auto close when there are warnings', () => {
    const idx = sendBody.indexOf('resolveWarnings.length > 0');
    expect(idx).toBeGreaterThan(-1);
    const warnBranch = sendBody.slice(idx, sendBody.indexOf('successClose(idsToRemove)', idx));
    expect(warnBranch).toMatch(/return;/);
    expect(warnBranch).not.toMatch(/successClose/);
  });

  it('Close link emits the same close with the stored ids', () => {
    const close = source.slice(source.indexOf('$scope.closeAfterResolveWarnings'));
    expect(close).toMatch(/resolveIdsToRemove/);
    expect(close).toMatch(/successClose\(idsToRemove\)/);
  });

  it('defines every handler the add-links panel calls', () => {
    const start = tcSource.indexOf("$templateCache.put('partials/directives/myaddlinkspanel.html'");
    expect(start).toBeGreaterThan(-1);
    const next = tcSource.indexOf('$templateCache.put(', start + 1);
    const tpl = tcSource.slice(start, next === -1 ? undefined : next);
    const called = new Set();
    const re = /ng-(?:click|class|if|show)=\\?"[^"]*?([a-zA-Z_$][\w$]*)\s*\(/g;
    let m;
    while ((m = re.exec(tpl)) !== null) called.add(m[1]);
    const defined = new Set();
    const defRe = /\$scope\.([a-zA-Z_$][\w$]*)\s*=/g;
    while ((m = defRe.exec(source)) !== null) defined.add(m[1]);
    // sendError sits in a block that cannot render; removeRequest is inherited from the
    // parent scope (ToolbarController), not defined on this controller.
    const knownUnwired = new Set(['sendError', 'removeRequest']);
    const missing = [...called].filter((n) => !defined.has(n) && n !== 'translate' && !knownUnwired.has(n));
    expect(missing).toEqual([]);
    expect(called.has('closeAfterResolveWarnings')).toBe(true);
  });
});
