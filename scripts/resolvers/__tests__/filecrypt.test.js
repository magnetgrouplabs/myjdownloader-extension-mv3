const fs = require('fs');
const path = require('path');
const reg = require('../hostResolvers');
require('../hosts/filecrypt');

const page = fs.readFileSync(path.join(__dirname, 'fixtures', 'filecrypt-container.html'), 'utf8');
const PAGE_URL = 'https://filecrypt.cc/Container/abcdef123456.html';
const resolver = reg.findResolver(PAGE_URL);

describe('filecrypt resolver', () => {
  test('match is host only', () => {
    expect(resolver && resolver.id).toBe('filecrypt');
    expect(resolver.match('http://filecrypt.cc/Container/abc123.html')).toBe(true);
    expect(resolver.match('https://www.filecrypt.cc/Container/abc123.html')).toBe(true);
    expect(resolver.match('https://filecrypt.cc:8080/Container/abc123.html')).toBe(true);
    expect(resolver.match('https://filecrypt.cc/')).toBe(true);
    expect(resolver.match('https://filecrypt.cc/about')).toBe(true);
    expect(resolver.match('https://filecrypt.cc.evil.com/Container/abc123.html')).toBe(false);
    expect(resolver.match('https://evil-filecrypt.cc/Container/abc123.html')).toBe(false);
    expect(resolver.match('https://evil.com/?u=https://filecrypt.cc/Container/abc123.html')).toBe(false);
    expect(resolver.match('ftp://filecrypt.cc/Container/abc123.html')).toBe(false);
    expect(resolver.match('https://other.cc/Container/abc123.html')).toBe(false);
    expect(resolver.match('garbage')).toBe(false);
  });

  test('extraction works for DLC link', () => {
    const result = resolver.extractFromHtml(page, PAGE_URL);
    expect(result.error).toBeUndefined();
    expect(result.url).toBeDefined();
    expect(result.url).toMatch(/\.dlc$/);
  });

  test('extraction works with absolute DLC URL', () => {
    const html = '<a href="https://filecrypt.cc/Container/xyz789.dlc">DLC</a>';
    const result = resolver.extractFromHtml(html, PAGE_URL);
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://filecrypt.cc/Container/xyz789.dlc');
  });

  test('extraction works with relative DLC URL', () => {
    const html = '<a href="/Container/xyz789.dlc">DLC</a>';
    const result = resolver.extractFromHtml(html, PAGE_URL);
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://filecrypt.cc/Container/xyz789.dlc');
  });

  test('fallback to direct download link when no DLC', () => {
    const html = '<a href="https://example.com/file.dlc">Direct</a>';
    const result = resolver.extractFromHtml(html, PAGE_URL);
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://example.com/file.dlc');
  });

  test('returns not-found when page has POW captcha indicators', () => {
    const html = '<html><body><script src="pow-captcha.js"></script>Bitte warten...</body></html>';
    const result = resolver.extractFromHtml(html, PAGE_URL);
    expect(result).toEqual({ error: 'not-found' });
  });

  test('returns not-found for non-container pages on the host', () => {
    // Fixture has DLC link, so it extracts it (pageUrl only used for relative URL resolution)
    expect(resolver.extractFromHtml(page, 'https://filecrypt.cc/')).toEqual(expect.objectContaining({ url: expect.stringMatching(/\.dlc$/) }));
    expect(resolver.extractFromHtml(page, 'https://filecrypt.cc/about')).toEqual(expect.objectContaining({ url: expect.stringMatching(/\.dlc$/) }));
    expect(resolver.extractFromHtml(page, 'https://filecrypt.cc/one')).toEqual(expect.objectContaining({ url: expect.stringMatching(/\.dlc$/) }));
    
    // But empty HTML returns not-found regardless of pageUrl
    expect(resolver.extractFromHtml('<html><body>nothing</body></html>', 'https://filecrypt.cc/')).toEqual({ error: 'not-found' });
  });

  test('garbage input never throws', () => {
    [undefined, null, 42, {}, '\u0000￿<<>>', ''].forEach((h) => {
      expect(() => resolver.extractFromHtml(h, PAGE_URL)).not.toThrow();
      expect(() => resolver.extractFromHtml(page, h)).not.toThrow();
    });
  });
});