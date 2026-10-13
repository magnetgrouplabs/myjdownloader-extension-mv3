const fs = require('fs');
const path = require('path');
const reg = require('../hostResolvers');
require('../hosts/fileditch');

const page = fs.readFileSync(path.join(__dirname, 'fixtures', 'fileditch-filepage.html'), 'utf8');
const PAGE_URL = 'https://fileditchfiles.me/beta10/0123456789abcdef0123/sample_video.mp4';
const resolver = reg.findResolver(PAGE_URL);
const b64u = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = (plain) => 'https://blehpooffileditchvidsstuff.org/' + b64u(plain);

describe('fileditch resolver', () => {
  test('match is host only', () => {
    expect(resolver && resolver.id).toBe('fileditch');
    expect(resolver.match('http://www.FileDitchFiles.me/beta/abc123/a b.mp4')).toBe(true);
    expect(resolver.match('https://fileditchfiles.me/')).toBe(true);
    expect(resolver.match('https://fileditchfiles.me')).toBe(true);
    expect(resolver.match('https://fileditchfiles.me/beta10/')).toBe(true);
    expect(resolver.match('https://fileditchfiles.me/about')).toBe(true);
    expect(resolver.match('https://fileditchfiles.me.evil.com/beta10/abc123/a.mp4')).toBe(false);
    expect(resolver.match('https://evil-fileditchfiles.me/beta10/abc123/a.mp4')).toBe(false);
    expect(resolver.match('https://evil.com/?u=https://fileditchfiles.me/a/b')).toBe(false);
    expect(resolver.match('ftp://fileditchfiles.me/a/b')).toBe(false);
    expect(resolver.match('https://other.me/beta10/0123456789abcdef0123/a.mp4')).toBe(false);
    expect(resolver.match('garbage')).toBe(false);
  });

  test('match accepts fileditchvids.st pages including its root', () => {
    expect(resolver.match('https://fileditchvids.st/beta10/0123456789abcdef0123/sample_video.mp4')).toBe(true);
    expect(resolver.match('https://WWW.FileDitchVids.ST/beta/abc123/a%20b.mp4')).toBe(true);
    expect(resolver.match('https://fileditchvids.st/')).toBe(true);
    expect(resolver.match('https://fileditchvids.st/beta10/')).toBe(true);
    expect(resolver.match('https://fileditchvids.st.evil.com/beta10/abc123/a.mp4')).toBe(false);
  });

  test('extraction works for a vids.st page url on the existing fixture', () => {
    const u = 'https://fileditchvids.st/beta10/0123456789abcdef0123/sample_video.mp4';
    expect(resolver.extractFromHtml(page, u).url).toMatch(/^https:\/\/blehpooffileditchvidsstuff\.org\//);
  });

  test('extraction works when the direct host is something else', () => {
    const tok = b64u('1791924206:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4');
    const html = '<source src="https://cdn.example.net/' + tok + '?x=1#frag">';
    expect(resolver.extractFromHtml(html, PAGE_URL).url).toBe('https://cdn.example.net/' + tok);
  });

  test('a base64-looking string that does not decode to a page token is ignored', () => {
    const junk = 'https://cdn.example.net/' + 'A'.repeat(60);
    const notShaped = 'https://cdn.example.net/' + b64u('hello world, this is not a token at all');
    expect(resolver.extractFromHtml(junk, PAGE_URL)).toEqual({ error: 'not-found' });
    expect(resolver.extractFromHtml(notShaped, PAGE_URL)).toEqual({ error: 'not-found' });
    // ignored candidates do not block a real one
    const real = link('1791924206:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4');
    expect(resolver.extractFromHtml(junk + ' ' + real, PAGE_URL).url).toBe(real);
  });

  test('a token with more path after it is not a candidate', () => {
    const tok = b64u('1791924206:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4');
    expect(resolver.extractFromHtml('https://cdn.example.net/' + tok + '/extra', PAGE_URL)).toEqual({ error: 'not-found' });
  });

  test('extracts the direct URL from the sanitized page', () => {
    const r = resolver.extractFromHtml(page, PAGE_URL);
    expect(r.url).toMatch(/^https:\/\/blehpooffileditchvidsstuff\.org\/[A-Za-z0-9_-]+$/);
    const decoded = Buffer.from(r.url.split('/').pop().replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    expect(decoded).toBe('1791924206:TESTSIGNATURE_0000000000000000000000000000:701/beta10/0123456789abcdef0123/sample_video.mp4');
    // expiresAt is only present while the fixture timestamp is still in the future.
    if (1791924206000 > Date.now()) expect(r.expiresAt).toBe(1791924206000);
    else expect(r.expiresAt).toBeUndefined();
  });

  test('expiresAt is ms since epoch when the timestamp is in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const html = '<source src="' + link(future + ':SIG:701/beta10/0123456789abcdef0123/sample_video.mp4') + '">';
    expect(resolver.extractFromHtml(html, PAGE_URL).expiresAt).toBe(future * 1000);
  });

  test('expiresAt is omitted when the timestamp is in the past', () => {
    const html = link('1000000000:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4');
    const r = resolver.extractFromHtml(html, PAGE_URL);
    expect(r.url).toBe(html);
    expect(r.expiresAt).toBeUndefined();
  });

  test('mismatch when the token belongs to another file', () => {
    const html = '<a href="' + link('1791924206:SIG:701/beta10/ffffffffffffffffffff/sample_video.mp4') + '">';
    expect(resolver.extractFromHtml(html, PAGE_URL)).toEqual({ error: 'mismatch' });
  });

  test('non-file pages on the host match but extract to not-found', () => {
    ['https://fileditchfiles.me/', 'https://fileditchvids.st/about', 'https://fileditchfiles.me/one'].forEach((u) => {
      expect(resolver.match(u)).toBe(true);
      expect(resolver.extractFromHtml(page, u)).toEqual({ error: 'not-found' });
    });
  });

  test('any bucket segment works, including none', () => {
    const tok = b64u('1791924206:SIG:701/0123456789abcdef0123/sample_video.mp4');
    const html = 'https://cdn.example.net/' + tok;
    expect(resolver.extractFromHtml(html, 'https://fileditchvids.st/0123456789abcdef0123/sample_video.mp4')).toBeDefined();
    // a decoded path with only server/id/file has 3 segments, so it is accepted
    expect(resolver.extractFromHtml(html, 'https://fileditchvids.st/0123456789abcdef0123/sample_video.mp4').url).toBe(html);
    expect(resolver.extractFromHtml(page, 'https://fileditchvids.st/zz9/0123456789abcdef0123/sample_video.mp4').url).toBeDefined();
  });

  test('not-found when the page has no token', () => {
    expect(resolver.extractFromHtml('<html><body>nothing</body></html>', PAGE_URL)).toEqual({ error: 'not-found' });
    expect(resolver.extractFromHtml('', PAGE_URL)).toEqual({ error: 'not-found' });
  });

  test('percent-encoded filename in pageUrl still matches', () => {
    const html = '<a href="' + link('1791924206:SIG:701/beta10/0123456789abcdef0123/my file (1).mp4') + '">';
    const r = resolver.extractFromHtml(html, 'https://fileditchfiles.me/beta10/0123456789abcdef0123/my%20file%20(1).mp4');
    expect(r.error).toBeUndefined();
    expect(r.url).toBeDefined();
  });

  test('JSON-escaped and HTML-escaped tokens are found', () => {
    const u = link('1791924206:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4');
    const jsonEsc = '{"src":"' + u.replace(/\//g, '\\/') + '"}';
    expect(resolver.extractFromHtml(jsonEsc, PAGE_URL).url).toBe(u);
    expect(resolver.extractFromHtml('<a href="' + u + '&amp;x=1">', PAGE_URL).url).toBe(u);
  });

  test('padded and standard-alphabet tokens decode', () => {
    const plain = '1791924206:SIG:701/beta10/0123456789abcdef0123/sample_video.mp4';
    const padded = Buffer.from(plain).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const u = 'https://blehpooffileditchvidsstuff.org/' + padded;
    expect(resolver.extractFromHtml(u, PAGE_URL).url).toBe(u);
  });

  test('garbage input never throws', () => {
    [undefined, null, 42, {}, '\u0000￿<<>>', 'https://blehpooffileditchvidsstuff.org/!!!',
      'https://blehpooffileditchvidsstuff.org/AAAA', 'x'.repeat(100000)].forEach((h) => {
      expect(() => resolver.extractFromHtml(h, PAGE_URL)).not.toThrow();
      expect(() => resolver.extractFromHtml(page, h)).not.toThrow();
    });
    expect(resolver.extractFromHtml('https://blehpooffileditchvidsstuff.org/AAAA', PAGE_URL)).toEqual({ error: 'not-found' });
  });
});
