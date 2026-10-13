# Contributing

Thanks for your interest in improving the extension. A few ground rules keep reviews fast
and releases stable.

## Branch model

- **`dev`** is the default and integration branch. All pull requests target `dev`.
- **`master`** always matches the latest published release. Nothing merges to `master`
  directly; verified changes are promoted from `dev` in batches.
- Releases are cut by tagging `master` (`vYYYY.M.D[.PATCH]`), which triggers the release
  workflow and publishes the packaged zip.

Changes merged to `dev` are tested against a real JDownloader setup before promotion, so
there may be a delay between a merge and the change appearing in a release.

## Pull requests

- Target `dev`, one concern per PR. Bug fix, feature, and CI changes belong in separate
  pull requests; unrelated changes bundled into a PR will hold it up.
- Run the test suite before submitting: `npx jest`. All tests must pass.
- `npm run test:live` is a separate, optional probe that exercises the update notifier against
  the live GitHub releases API. It needs network access and is deliberately excluded from the
  default suite and from CI, so run it by hand if you touch that code.
- Add regression coverage for bug fixes where the suite can express it. Note that jest
  cannot exercise MAIN-world content script or service worker semantics; changes in those
  areas get a live browser test during review, so please describe how you verified them.
- See `ARCHITECTURE.md` for an overview of how the extension is put together.
- To add support for a new file host, see "Adding a host resolver" below.

## Adding a host resolver

Some file hosts sit behind Cloudflare, so JDownloader cannot load their pages. A host
resolver lets the extension read the page in the browser, find the direct download link, and
send that link to JDownloader instead. It runs only for hosts that have a resolver shipped in
the extension. Every other link is sent unchanged. Users control it with the "Resolve in
Browser" checkbox in Settings, under "Add Links Dialog / default values". It is on by default.

A resolver is the right fix when JDownloader reports a Cloudflare block or cannot load the
file page, and the same page opens fine in the browser. If the page does not open in the
browser either, a resolver cannot help.

Resolution tries a plain fetch first. If that fails, it opens the page in an inactive tab. If
Cloudflare shows an interactive challenge, that tab is brought to the front so the user can
solve it. Nothing tries to bypass the challenge. If resolution fails, the original link is
sent and the panel shows a warning.

If you cannot write code, open a "Host resolver request" issue instead.

### Layout

One file per host: `scripts/resolvers/hosts/<id>.js`. It is a plain script, not a module. It
registers itself with `MyjdHostResolvers.register({...})`.

```js
MyjdHostResolvers.register({
  id: 'fileditch',                              // short, lowercase, same as the file name without .js
  label: 'FileDitch (fileditchfiles.me, fileditchvids.st)', // shown to users
  match: function (url) { /* ... */ },          // true only for file pages of that host
  extractFromHtml: function (html, pageUrl) {   // gets the page HTML as text
    return { url: 'https://...', expiresAt: 1791924206000 };  // expiresAt is optional, ms since epoch
    // or { error: 'not-found' }  (nothing usable on the page)
    // or { error: 'mismatch' }   (links found, but none belongs to this page)
  }
});
```

### Rules

- `extractFromHtml` is a pure function of the HTML text and the page URL. No DOM, no network,
  no `eval`.
- It must never throw, whatever the input. Garbage in, `{ error: 'not-found' }` out.
- It must check that the link it returns belongs to the page it was given. The FileDitch
  resolver decodes the token in the link and compares the file id and file name to the page
  path. Return `{ error: 'mismatch' }` when they differ.
- `match` must be true only for file pages of that host, not for the whole site.
- No remote code. All logic ships in the package. This is a Chrome Web Store MV3 requirement.

### Fixture and test

Every resolver needs both of these:

- A saved, sanitized copy of a real file page at
  `scripts/resolvers/__tests__/fixtures/<id>-filepage.html`.
- A Jest test at `scripts/resolvers/__tests__/<id>.test.js` that covers `match`, a successful
  extract on the fixture, the `not-found` case and the `mismatch` case.

Sanitize the fixture before committing it. Check each item:

- Remove personal data: names, email addresses, account details, IP addresses.
- Remove tracking scripts and ad scripts.
- Remove cookies and session tokens.
- Remove Cloudflare ray ids.
- Replace real file names with neutral ones.
- If the direct link carries an encoded token, re-encode the token so it matches the sanitized
  file name. The resolver's check must still pass on the fixture.

### Wiring and testing

Add the resolver file to the `importScripts` list in `background.js` and add a `<script>` tag
for it in both `popup.html` and `toolbar.html`. If you prefer, leave that part out and the
maintainers will add it during review.

Run the resolver tests with:

```
npx jest scripts/resolvers
```

Then run the full suite with `npx jest` before you open the pull request. CI runs the suite on
every pull request into `dev`.

## Bug reports

Use the bug report issue template and include the requested reproduction details: steps,
browser and extension versions, JDownloader version and connection status, and relevant
console output. Reports without reproduction information may be closed as not actionable.
