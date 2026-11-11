/*
 * FileDitch resolver (fileditchfiles.me, fileditchfiles.st, fileditchvids.me and fileditchvids.st, same page template).
 *
 * The file page embeds the direct link as https://<any host>/<token> where token
 * is base64url of "<unix seconds>:<signature>:<server>/.../<filename>". The
 * timestamp is the link expiry. Works on HTML text only.
 *
 * Two page shapes are handled, each percent-decoded per segment:
 *  - three or more path segments (/<bucket>/<id>/<filename>): the token path
 *    must have at least 3 segments and its last two (<id>/<filename>) must equal
 *    the page's last two; the bucket segment between server and id is not assumed.
 *  - exactly two path segments (/<bucket>/<filename>, no id folder): the token
 *    path must have at least 2 segments and its last segment (<filename>) must
 *    equal the page's. The token's bucket may differ from the page's or be absent.
 * A page with fewer than two segments is 'not-found'.
 * A file.php?f=/<bucket>/... page carries the path in the `f` query parameter
 * (percent-decoded once); when present and a path, its segments replace the URL path's.
 *
 * match() is host only: any http(s) URL on fileditchfiles.me, fileditchfiles.st,
 * fileditchvids.me or fileditchvids.st (exact host, optional www and port). A page that is not a file page (the host root, say)
 * matches but extracts to {error:'not-found'}, because it has no <filename> and bucket.
 *
 * The direct host is not hard-coded. Every URL whose whole path is one long
 * base64url token (32+ chars) is a candidate; a candidate is accepted only when
 * it decodes to the expected shape AND its tail equals the page's (see above).
 * A candidate that does not decode to <digits>:<sig>:<path> with a path long
 * enough for the page's comparison is ignored entirely: it counts toward
 * neither 'mismatch' nor a result. 'mismatch' means at least one candidate had
 * the right shape but belongs to another file; otherwise 'not-found'.
 */
(function (root) {
  'use strict';

  var registry = root.MyjdHostResolvers ||
    (typeof require === 'function' ? require('../hostResolvers') : null);
  if (!registry) return;

  var HOST_RE = /^https?:\/\/(www\.)?(fileditchfiles|fileditchvids)\.(me|st)(?::\d+)?(?:[\/?#]|$)/i;
  var CANDIDATE_RE = /https?:\/\/[a-z0-9.-]+\/([A-Za-z0-9_-]{32,}={0,2})(?![A-Za-z0-9_\/.%=-])/gi;

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // Value of query parameter `name`, percent-decoded once ('+' kept literal), or ''.
  function queryParam(query, name) {
    if (!query) return '';
    var parts = query.split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq === -1) continue;
      if (safeDecode(parts[i].slice(0, eq)) === name) return safeDecode(parts[i].slice(eq + 1));
    }
    return '';
  }

  // Comparison key for a page URL, percent-decoded per segment: {need, key}.
  // Three or more segments: need 3, key "<id>/<filename>" (last two).
  // Two segments: need 2, key "<filename>" (last one). Fewer: null.
  function pagePathKey(pageUrl) {
    var m = /^https?:\/\/[^\/?#]+([^?#]*)(?:\?([^#]*))?/i.exec(String(pageUrl || ''));
    if (!m) return null;
    var segs = m[1].split('/').filter(Boolean);
    var fVal = queryParam(m[2], 'f');
    if (fVal && fVal.indexOf('/') !== -1) segs = fVal.split('/').filter(Boolean);
    if (segs.length < 2) return null;
    if (segs.length === 2) return { need: 2, key: safeDecode(segs[1]) };
    return { need: 3, key: safeDecode(segs[segs.length - 2]) + '/' + safeDecode(segs[segs.length - 1]) };
  }

  // Decodes a token to {seconds, segs} where segs are the decoded path segments.
  function decodeToken(token) {
    try {
      var b64 = token.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64);
      var m = /^(\d+):([^:]*):(.*)$/.exec(bin);
      if (!m) return null;
      var segs = m[3].split('/').filter(Boolean).map(function (seg) {
        // The filename may be UTF-8 bytes in a binary string.
        try { seg = decodeURIComponent(escape(seg)); } catch (e) { /* keep raw */ }
        // The site may also percent-encode the filename (Mira%204k.mp4); decode per segment like pagePathKey.
        return safeDecode(seg);
      });
      return { seconds: parseInt(m[1], 10), segs: segs };
    } catch (e) {
      return null;
    }
  }

  // Key of a decoded token for a page's shape, or null when the path is too short.
  function tokenKey(info, need) {
    var segs = info.segs;
    if (segs.length < need) return null;
    return need === 2 ? segs[segs.length - 1] : segs[segs.length - 2] + '/' + segs[segs.length - 1];
  }

  function extractFromHtml(html, pageUrl) {
    try {
      if (typeof html !== 'string' || !html) return { error: 'not-found' };
      var text = html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
      var wanted = pagePathKey(pageUrl);
      if (wanted === null) return { error: 'not-found' };
      var shaped = 0;
      var m;
      CANDIDATE_RE.lastIndex = 0;
      while ((m = CANDIDATE_RE.exec(text)) !== null) {
        var info = decodeToken(m[1]);
        if (!info) continue;
        var key = tokenKey(info, wanted.need);
        if (!key) continue;
        shaped++;
        if (key === wanted.key) {
          var result = { url: m[0] };
          var expiresAt = info.seconds * 1000;
          if (expiresAt > Date.now()) result.expiresAt = expiresAt;
          return result;
        }
      }
      return { error: shaped ? 'mismatch' : 'not-found' };
    } catch (e) {
      return { error: 'not-found' };
    }
  }

  registry.register({
    id: 'fileditch',
    label: 'FileDitch (fileditchfiles.me, fileditchfiles.st, fileditchvids.me, fileditchvids.st)',
    match: function (url) {
      return typeof url === 'string' && HOST_RE.test(url);
    },
    extractFromHtml: extractFromHtml
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
