/*
 * Host resolver registry.
 *
 * A resolver turns a file page on a host that JDownloader cannot load (for
 * example a page behind a Cloudflare challenge) into a direct download link.
 * Resolvers work on HTML text, never on a live DOM, so the same code runs in
 * the service worker, the popup and Jest.
 *
 * Resolver shape:
 *   { id, label, match(url) -> boolean,
 *     extractFromHtml(html, pageUrl) -> {url, expiresAt?} | {error} }
 * error is 'not-found' (no candidate on the page) or 'mismatch' (candidates
 * found, none belongs to this page). expiresAt is ms since epoch.
 */
(function (root) {
  'use strict';

  var resolvers = [];

  function register(resolver) {
    if (!resolver || typeof resolver !== 'object') {
      throw new Error('MyjdHostResolvers.register: resolver must be an object');
    }
    if (typeof resolver.id !== 'string' || !resolver.id) {
      throw new Error('MyjdHostResolvers.register: resolver.id must be a non-empty string');
    }
    if (typeof resolver.label !== 'string' || !resolver.label) {
      throw new Error('MyjdHostResolvers.register: resolver.label must be a non-empty string');
    }
    if (typeof resolver.match !== 'function') {
      throw new Error('MyjdHostResolvers.register: resolver.match must be a function');
    }
    if (typeof resolver.extractFromHtml !== 'function') {
      throw new Error('MyjdHostResolvers.register: resolver.extractFromHtml must be a function');
    }
    for (var i = 0; i < resolvers.length; i++) {
      if (resolvers[i].id === resolver.id) {
        throw new Error('MyjdHostResolvers.register: duplicate resolver id "' + resolver.id + '"');
      }
    }
    resolvers.push(resolver);
    return resolver;
  }

  function findResolver(url) {
    if (typeof url !== 'string' || !url) return null;
    for (var i = 0; i < resolvers.length; i++) {
      try {
        if (resolvers[i].match(url)) return resolvers[i];
      } catch (e) { /* a throwing matcher counts as no match */ }
    }
    return null;
  }

  function list() {
    return resolvers.map(function (r) { return { id: r.id, label: r.label }; });
  }

  var TITLE_RE = /<title[^>]*>\s*Just\s+a\s+moment\.\.\.\s*<\/title>/i;
  var SCRIPT_RE = /<script\b[^>]*\bsrc\s*=\s*["']?[^"'>\s]*challenges\.cloudflare\.com/i;
  var ID_RE = /\bid\s*=\s*["']?(?:challenge-running|challenge-form|challenge-error-text)["'\s>\/]/i;
  var CLASS_RE = /\bclass\s*=\s*["'][^"']*cf-turnstile/i;

  function isChallengePage(html) {
    if (typeof html !== 'string' || !html) return false;
    return TITLE_RE.test(html) || SCRIPT_RE.test(html) || ID_RE.test(html) || CLASS_RE.test(html);
  }

  // Links wrapped in redirect or leave pages

  var MAX_DEPTH = 3;

  function isHttpUrl(s) {
    if (typeof s !== 'string' || !/^https?:\/\//i.test(s)) return false;
    try {
      var u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function percentDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // Base64 or base64url text to a string, only when it decodes to an http(s) URL.
  function b64ToUrl(s) {
    try {
      var t = String(s).replace(/\s+/g, '');
      if (t.length < 8 || !/^[A-Za-z0-9+\/_-]+={0,2}$/.test(t)) return null;
      t = t.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4) t += '=';
      var out = atob(t);
      return /^https?:\/\//i.test(out) ? out : null;
    } catch (e) {
      return null;
    }
  }

  // Raw values of every query parameter, plus the fragment (as a whole and,
  // when it looks like key=value pairs, per value).
  function paramValues(url) {
    var values = [];
    var hashAt = url.indexOf('#');
    var beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
    var fragment = hashAt === -1 ? '' : url.slice(hashAt + 1);
    var qAt = beforeHash.indexOf('?');
    var query = qAt === -1 ? '' : beforeHash.slice(qAt + 1);
    [query, fragment].forEach(function (part, idx) {
      if (!part) return;
      if (idx === 1) values.push(part);
      part.split('&').forEach(function (pair) {
        var eq = pair.indexOf('=');
        if (eq === -1) return;
        var v = pair.slice(eq + 1);
        if (v) values.push(v);
      });
    });
    return values;
  }

  function directCandidates(url) {
    var out = [];
    paramValues(url).forEach(function (v) {
      var pd = percentDecode(v);
      [v, pd, b64ToUrl(v), b64ToUrl(pd)].forEach(function (c) {
        if (c && isHttpUrl(c) && out.indexOf(c) === -1) out.push(c);
      });
    });
    return out;
  }

  function collectEmbedded(url, depth, seen) {
    var found = directCandidates(url).filter(function (c) {
      if (seen.indexOf(c) !== -1) return false;
      seen.push(c);
      return true;
    });
    var result = found.slice();
    if (depth < MAX_DEPTH) {
      found.forEach(function (c) {
        collectEmbedded(c, depth + 1, seen).forEach(function (n) { result.push(n); });
      });
    }
    return result;
  }

  // Absolute http(s) URLs hidden in the query parameters or fragment of url
  // (as is, percent-decoded, or base64/base64url-decoded), nested up to depth 3.
  function decodeEmbeddedUrls(url) {
    try {
      if (typeof url !== 'string' || !url) return [];
      return collectEmbedded(url, 1, [url]);
    } catch (e) {
      return [];
    }
  }

  // Extend this to teach looksLikeInterstitial about more redirect shapes.
  // path: lowercase substrings of the URL path (a trailing slash is appended
  // before testing, so '/out/' matches '/out'). params: query parameter names.
  var interstitialHints = {
    path: ['redirect', 'goto', 'link-confirmation', 'leave', 'away', 'exit', '/out/', 'external'],
    params: ['url', 'u', 'to', 'target', 'link', 'dest', 'destination', 'redirect', 'r', 'go']
  };

  function looksLikeInterstitial(url) {
    try {
      if (typeof url !== 'string' || !url) return false;
      var m = /^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*([^?#]*)(?:\?([^#]*))?/i.exec(url);
      if (!m) return false;
      var p = (percentDecode(m[1] || '') + '/').toLowerCase();
      for (var i = 0; i < interstitialHints.path.length; i++) {
        if (p.indexOf(interstitialHints.path[i]) !== -1) return true;
      }
      var names = (m[2] || '').split('&').map(function (pair) {
        return percentDecode(pair.split('=')[0]).toLowerCase();
      });
      for (var j = 0; j < interstitialHints.params.length; j++) {
        if (names.indexOf(interstitialHints.params[j]) !== -1) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Resolvable without network: url itself, or a URL embedded in it.
  function resolveTarget(url) {
    try {
      var direct = findResolver(url);
      if (direct) return { url: url, resolver: direct };
      var cands = decodeEmbeddedUrls(url);
      for (var i = 0; i < cands.length; i++) {
        var r = findResolver(cands[i]);
        if (r) return { url: cands[i], resolver: r };
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  var api = {
    register: register,
    findResolver: findResolver,
    list: list,
    isChallengePage: isChallengePage,
    decodeEmbeddedUrls: decodeEmbeddedUrls,
    looksLikeInterstitial: looksLikeInterstitial,
    resolveTarget: resolveTarget,
    interstitialHints: interstitialHints,
    resolvers: resolvers
  };

  root.MyjdHostResolvers = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
