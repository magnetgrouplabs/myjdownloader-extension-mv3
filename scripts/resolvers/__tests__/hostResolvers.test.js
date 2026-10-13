const fs = require('fs');
const path = require('path');
const reg = require('../hostResolvers');
require('../hosts/fileditch');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const good = () => ({ id: 'x', label: 'X', match: () => false, extractFromHtml: () => ({ error: 'not-found' }) });

describe('MyjdHostResolvers registry', () => {
  test('is exposed on globalThis and as module export', () => {
    expect(globalThis.MyjdHostResolvers).toBe(reg);
    expect(Array.isArray(reg.resolvers)).toBe(true);
  });

  test('register validates shape', () => {
    expect(() => reg.register(null)).toThrow();
    expect(() => reg.register({})).toThrow();
    expect(() => reg.register({ ...good(), id: '' })).toThrow();
    expect(() => reg.register({ ...good(), label: 5 })).toThrow();
    expect(() => reg.register({ ...good(), match: null })).toThrow();
    expect(() => reg.register({ ...good(), extractFromHtml: 'no' })).toThrow();
  });

  test('register accepts a good resolver and rejects a duplicate id', () => {
    const r = { ...good(), id: 'tmp-test' };
    reg.register(r);
    expect(reg.resolvers).toContain(r);
    expect(() => reg.register({ ...good(), id: 'tmp-test' })).toThrow();
    reg.resolvers.splice(reg.resolvers.indexOf(r), 1);
  });

  test('list returns id and label', () => {
    expect(reg.list()).toContainEqual({ id: 'fileditch', label: 'FileDitch (fileditchfiles.me, fileditchvids.st)' });
  });

  test('findResolver never throws and returns null for junk', () => {
    [undefined, null, 5, {}, '', 'not a url', 'https://example.com/'].forEach((v) => {
      expect(reg.findResolver(v)).toBeNull();
    });
    const thrower = { ...good(), id: 'thrower', match: () => { throw new Error('boom'); } };
    reg.register(thrower);
    expect(() => reg.findResolver('https://x.test/')).not.toThrow();
    reg.resolvers.splice(reg.resolvers.indexOf(thrower), 1);
  });

  test('isChallengePage', () => {
    expect(reg.isChallengePage(fx('cloudflare-challenge.html'))).toBe(true);
    expect(reg.isChallengePage(fx('fileditch-filepage.html'))).toBe(false);
    expect(reg.isChallengePage('<title>\n Just a moment... </title>')).toBe(true);
    expect(reg.isChallengePage('<script src="https://challenges.cloudflare.com/x.js"></script>')).toBe(true);
    expect(reg.isChallengePage('<div id="challenge-running"></div>')).toBe(true);
    expect(reg.isChallengePage('<form id="challenge-form">')).toBe(true);
    expect(reg.isChallengePage('<div class="x cf-turnstile y"></div>')).toBe(true);
    expect(reg.isChallengePage('')).toBe(false);
    expect(reg.isChallengePage(null)).toBe(false);
  });
});
