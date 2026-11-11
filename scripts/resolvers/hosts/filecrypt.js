/*
 * filecrypt.cc resolver (POW captcha).
 *
 * FileCrypt uses a Proof-of-Work captcha that blocks JDownloader but can be
 * solved in the browser. After solving, the container page exposes Click'n'Load
 * data and DLC download links. This resolver extracts the DLC container URL
 * (which JDownloader can process) from the page.
 *
 * match() accepts any http(s) URL on filecrypt.cc (exact host, optional www and port).
 * A page that is not a container page matches but extracts to {error:'not-found'}.
 *
 * The DLC link is typically found in a <a> tag with href ending in .dlc or
 * a data-container attribute, or via the Click'n'Load form.
 */
(function (root) {
  'use strict';

  var registry = root.MyjdHostResolvers ||
    (typeof require === 'function' ? require('../hostResolvers') : null);
  if (!registry) return;

  // Match filecrypt.cc container pages (exact host, optional www, optional port)
  var HOST_RE = /^https?:\/\/(www\.)?filecrypt\.cc(?::\d+)?(?:[\/?#]|$)/i;

  // Pattern for DLC container links: <a href=".../container/xxx.dlc">
  var DLC_RE = /href\s*=\s*["']([^"']*\.dlc)["']/gi;

  // Pattern for direct download links in the page (after POW solved)
  var DIRECT_RE = /href\s*=\s*["'](https?:\/\/[^"']+\.(?:dlc|ccf|txt))["']/gi;

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function extractFromHtml(html, pageUrl) {
    try {
      if (typeof html !== 'string' || !html) return { error: 'not-found' };

      // Look for DLC container links first (best for JDownloader)
      var m;
      DLC_RE.lastIndex = 0;
      while ((m = DLC_RE.exec(html)) !== null) {
        var dlcUrl = safeDecode(m[1]);
        // Make absolute if relative
        if (dlcUrl.indexOf('http') !== 0) {
          try { dlcUrl = new URL(dlcUrl, pageUrl).href; } catch (e) { continue; }
        }
        return { url: dlcUrl };
      }

      // Fallback: look for direct download links
      DIRECT_RE.lastIndex = 0;
      while ((m = DIRECT_RE.exec(html)) !== null) {
        var directUrl = safeDecode(m[1]);
        if (directUrl.indexOf('http') !== 0) {
          try { directUrl = new URL(directUrl, pageUrl).href; } catch (e) { continue; }
        }
        return { url: directUrl };
      }

      // If page has POW captcha indicators but no links yet, it's not ready
      if (/pow-captcha|proof.?of.?work/i.test(html)) {
        return { error: 'not-found' };
      }

      return { error: 'not-found' };
    } catch (e) {
      return { error: 'not-found' };
    }
  }

  registry.register({
    id: 'filecrypt',
    label: 'filecrypt.cc (POW captcha)',
    match: function (url) {
      return typeof url === 'string' && HOST_RE.test(url);
    },
    extractFromHtml: extractFromHtml
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));