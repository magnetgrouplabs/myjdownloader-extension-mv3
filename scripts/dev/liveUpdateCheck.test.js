/**
 * @jest-environment node
 */
'use strict';

// Live probe for the update notifier. Run it with:
//
//     npm run test:live
//
// It runs the real update-notifier code from background.js against the REAL
// GitHub releases API and the REAL buildMeta.json on disk, and prints what a
// build of this checkout would actually see. Use it to verify the notifier end
// to end WITHOUT cutting a release.
//
// It lives outside __tests__ on purpose: jest.config testMatch only picks up
// **/__tests__/**/*.test.js, so `npm test` and CI skip it. It needs network
// and is subject to GitHub rate limits, neither of which belongs in CI.
//
// The assertion at the bottom assumes this checkout is older than the latest
// release, which is true whenever you are working ahead of a tag. Right after
// cutting a release it will correctly report "no update" and fail; that is the
// probe telling you the truth, not a broken test.

const fs = require('fs');
const path = require('path');
const https = require('https');

// Jest 27's node environment does not expose global fetch, so do the real
// request over https and wrap it in the shape background.js expects.
function realGet(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'myjd-live-probe' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(body))
          })
        );
      }
    ).on('error', reject);
  });
}

const UPDATE_STORAGE_KEY = 'myjd_update_available';
const REPO_ROOT = path.resolve(__dirname, '../..');

function sendMessage(action, data) {
  const listeners = global.chrome.runtime.onMessage._listeners;
  const handler = listeners[listeners.length - 1];
  return new Promise((resolve) => handler({ action, data }, { id: chrome.runtime.id }, resolve));
}

describe('LIVE update check against the real GitHub API', () => {
  it('reports what the running build would actually see', async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
    const buildMeta = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'buildMeta.json'), 'utf8'));

    global.chrome.runtime.getManifest.mockReturnValue(manifest);

    const seen = [];
    global.fetch = (url) => {
      seen.push(String(url));
      if (String(url).includes('buildMeta.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(buildMeta) });
      }
      return realGet(String(url));
    };

    require('../../background.js');
    const response = await sendMessage('check-for-update');

    // Show the real API payload alongside the verdict.
    const apiResp = await realGet(
      'https://api.github.com/repos/magnetgrouplabs/myjdownloader-extension-mv3/releases/latest'
    );
    const release = await apiResp.json();

    console.log('\n================ LIVE UPDATE CHECK ================');
    console.log('running manifest version :', manifest.version);
    console.log('local build timestamp    :', buildMeta.timestamp, '=>', new Date(buildMeta.timestamp).toISOString());
    console.log('---- what api.github.com actually returned ----');
    console.log('tag_name                 :', release.tag_name);
    console.log('published_at             :', release.published_at, '=>', Date.parse(release.published_at));
    console.log('html_url                 :', release.html_url);
    console.log('---- verdict from the real background.js ----');
    console.log('update reported          :', JSON.stringify(response.update));
    console.log('urls fetched             :', seen.join(', '));
    console.log('===================================================\n');

    // The response shape the code depends on must exist for real.
    expect(typeof release.tag_name).toBe('string');
    expect(Number.isFinite(Date.parse(release.published_at))).toBe(true);

    // This checkout predates the latest release, so it MUST see an update.
    // Under the old numeric compare this returned null: 2026.7.4 < 2026.7.13.1.
    expect(response.update).not.toBeNull();
    expect(response.update.version).toBe(release.tag_name.replace(/^v/, ''));
    expect(response.update.publishedAt).toBe(Date.parse(release.published_at));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ [UPDATE_STORAGE_KEY]: expect.anything() })
    );
  }, 30000);
});
