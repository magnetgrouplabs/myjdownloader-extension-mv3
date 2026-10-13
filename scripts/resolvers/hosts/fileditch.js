/*
 * FileDitch resolver (fileditchfiles.me and fileditchvids.st, same page template).
 *
 * The file page embeds the direct link as https://<any host>/<token> where token
 * is base64url of "<unix seconds>:<signature>:<server>/.../<id>/<filename>" (the
 * bucket segment between server and id is not assumed; only the last two path
 * segments, <id>/<filename>, are compared). The timestamp is the link expiry.
 * Works on HTML text only.
 *
 * match() is host only: any http(s) URL on fileditchfiles.me or fileditchvids.st
 * (exact host, optional www). A page that is not a file page (the host root, say)
 * matches but extracts to {error:'not-found'}, because it has no <id>/<filename>.
 *
 * The direct host is not hard-coded. Every URL whose whole path is one long
 * base64url token (32+ chars) is a candidate; a candidate is accepted only when
 * it decodes to the expected shape AND its <id>/<filename> equals the page's.
 * A candidate that does not decode to the expected shape is ignored entirely:
 * it counts toward neither 'mismatch' nor a result. 'mismatch' means at least
 * one candidate decoded to the right shape but belongs to another file;
 * otherwise the result is 'not-found'.
 */
(function (root) {
  'use strict';

  var registry = root.MyjdHostResolvers ||
    (typeof require === 'function' ? require('../hostResolvers') : null);
  if (!registry) return;

  var HOST_RE = /^https?:\/\/(www\.)?(fileditchfiles\.me|fileditchvids\.st)(?::\d+)?(?:[\/?#]|$)/i;
  var CANDIDATE_RE = /https?:\/\/[a-z0-9.-]+\/([A-Za-z0-9_-]{32,}={0,2})(?![A-Za-z0-9_\/.%=-])/gi;

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // Last two path segments ("<id>/<filename>") of a page URL, percent-decoded
  // per segment; null when the path has fewer than two segments.
  function pagePathKey(pageUrl) {
    var m = /^https?:\/\/[^\/?#]+([^?#]*)/i.exec(String(pageUrl || ''));
    if (!m) return null;
    var segs = m[1].split('/').filter(Boolean);
    if (segs.length < 2) return null;
    return safeDecode(segs[segs.length - 2]) + '/' + safeDecode(segs[segs.length - 1]);
  }

  function decodeToken(token) {
    try {
      var b64 = token.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64);
      var m = /^(\d+):([^:]*):(.*)$/.exec(bin);
      if (!m) return null;
      var segs = m[3].split('/').filter(Boolean);
      // server / ... / id / filename
      if (segs.length < 3) return null;
      var rest = segs[segs.length - 2] + '/' + segs[segs.length - 1];
      // The filename may be UTF-8 bytes in a binary string.
      try { rest = decodeURIComponent(escape(rest)); } catch (e) { /* keep raw */ }
      return { seconds: parseInt(m[1], 10), key: rest };
    } catch (e) {
      return null;
    }
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
        if (!info || !info.key) continue;
        shaped++;
        if (wanted === null) continue;
        if (info.key === wanted) {
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
    label: 'FileDitch (fileditchfiles.me, fileditchvids.st)',
    match: function (url) {
      return typeof url === 'string' && HOST_RE.test(url);
    },
    extractFromHtml: extractFromHtml
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
