const reg = require('../hostResolvers');
require('../hosts/fileditch');

const b64u = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const TARGET = 'https://fileditchvids.st/balpha28/0123456789abcdef0123/sample_video.mp4';
const WRAPPED = 'https://forum.example.org/redirect/?to=' + b64u(TARGET) + '&e=1&m=b64';

describe('fileditch balpha bucket', () => {
  const resolver = reg.findResolver(TARGET);

  test('match accepts a /balpha28/ page', () => {
    expect(resolver && resolver.id).toBe('fileditch');
    expect(resolver.match('https://fileditchfiles.me/beta10/0123456789abcdef0123/a.mp4')).toBe(true);
  });

  test('extracts a token whose decoded path uses balpha28', () => {
    const tok = b64u('1791924206:SIG:701/balpha28/0123456789abcdef0123/sample_video.mp4');
    const html = '<source src="https://cdn.example.net/' + tok + '">';
    expect(resolver.extractFromHtml(html, TARGET).url).toBe('https://cdn.example.net/' + tok);
  });

  test('a balpha token for another id is a mismatch', () => {
    const tok = b64u('1791924206:SIG:701/balpha28/ffffffffffffffffffff/sample_video.mp4');
    expect(resolver.extractFromHtml('https://cdn.example.net/' + tok, TARGET)).toEqual({ error: 'mismatch' });
  });
});

describe('decodeEmbeddedUrls', () => {
  test('base64url target in a query parameter', () => {
    expect(reg.decodeEmbeddedUrls(WRAPPED)).toEqual([TARGET]);
  });

  test('percent-encoded url= parameter', () => {
    const u = 'https://x.example.org/away?url=' + encodeURIComponent(TARGET);
    expect(reg.decodeEmbeddedUrls(u)).toEqual([TARGET]);
  });

  test('plain, unencoded url= parameter and fragment', () => {
    expect(reg.decodeEmbeddedUrls('https://x.example.org/go?u=' + TARGET)).toEqual([TARGET]);
    expect(reg.decodeEmbeddedUrls('https://x.example.org/go#' + encodeURIComponent(TARGET))).toEqual([TARGET]);
  });

  test('double-wrapped redirect yields both levels, outer first', () => {
    const inner = 'https://inner.example.org/leave?target=' + encodeURIComponent(TARGET);
    const outer = 'https://outer.example.org/redirect?to=' + b64u(inner);
    expect(reg.decodeEmbeddedUrls(outer)).toEqual([inner, TARGET]);
  });

  test('depth is capped and cycles do not loop', () => {
    let u = TARGET;
    for (let i = 0; i < 6; i++) u = 'https://w' + i + '.example.org/r?to=' + encodeURIComponent(u);
    const out = reg.decodeEmbeddedUrls(u);
    expect(out.length).toBe(3);
    expect(out).not.toContain(TARGET);
    const self = 'https://loop.example.org/r?to=https%3A%2F%2Floop.example.org%2Fr%3Fto%3Dx';
    expect(() => reg.decodeEmbeddedUrls(self)).not.toThrow();
  });

  test('plain links and garbage give an empty list and never throw', () => {
    expect(reg.decodeEmbeddedUrls('https://example.com/a/b.mp4')).toEqual([]);
    expect(reg.decodeEmbeddedUrls('https://example.com/?a=1&b=hello&c=aGVsbG8gd29ybGQ')).toEqual([]);
    [undefined, null, 5, {}, '', '???###', 'to=%E0%A4%A', 'https://x/?to=%'].forEach((v) => {
      expect(() => reg.decodeEmbeddedUrls(v)).not.toThrow();
      expect(Array.isArray(reg.decodeEmbeddedUrls(v))).toBe(true);
    });
  });
});

describe('looksLikeInterstitial', () => {
  test('true for redirect-style paths and parameter names', () => {
    expect(reg.looksLikeInterstitial(WRAPPED)).toBe(true);
    expect(reg.looksLikeInterstitial('https://a.example.org/link-confirmation?id=1')).toBe(true);
    expect(reg.looksLikeInterstitial('https://a.example.org/out')).toBe(true);
    expect(reg.looksLikeInterstitial('https://a.example.org/x?destination=abc')).toBe(true);
    expect(reg.looksLikeInterstitial('https://a.example.org/x?foo=1&U=abc')).toBe(true);
    expect(reg.looksLikeInterstitial('https://a.example.org/exit.php')).toBe(true);
  });

  test('false for ordinary links, garbage and non-strings', () => {
    expect(reg.looksLikeInterstitial('https://a.example.org/about/team')).toBe(false);
    expect(reg.looksLikeInterstitial('https://a.example.org/file.mp4?id=3&page=2')).toBe(false);
    [undefined, null, 5, '', 'garbage'].forEach((v) => expect(reg.looksLikeInterstitial(v)).toBe(false));
  });

  test('hints are a growable data array on the module', () => {
    expect(Array.isArray(reg.interstitialHints.path)).toBe(true);
    expect(Array.isArray(reg.interstitialHints.params)).toBe(true);
    reg.interstitialHints.path.push('bounce');
    expect(reg.looksLikeInterstitial('https://a.example.org/bounce/1')).toBe(true);
    reg.interstitialHints.path.pop();
  });
});

describe('resolveTarget', () => {
  test('direct resolvable link', () => {
    const r = reg.resolveTarget(TARGET);
    expect(r.url).toBe(TARGET);
    expect(r.resolver.id).toBe('fileditch');
  });

  test('base64 wrapped link', () => {
    const r = reg.resolveTarget(WRAPPED);
    expect(r.url).toBe(TARGET);
    expect(r.resolver.id).toBe('fileditch');
  });

  test('percent-encoded url= and double-wrapped', () => {
    expect(reg.resolveTarget('https://x.example.org/away?url=' + encodeURIComponent(TARGET)).url).toBe(TARGET);
    const inner = 'https://inner.example.org/leave?target=' + encodeURIComponent(TARGET);
    expect(reg.resolveTarget('https://outer.example.org/redirect?to=' + b64u(inner)).url).toBe(TARGET);
  });

  test('plain unresolvable link and garbage give null', () => {
    expect(reg.resolveTarget('https://example.com/a.mp4')).toBeNull();
    expect(reg.resolveTarget('https://example.com/r?to=' + encodeURIComponent('https://example.com/b'))).toBeNull();
    [undefined, null, 5, {}, '', 'garbage'].forEach((v) => expect(reg.resolveTarget(v)).toBeNull());
  });
});
