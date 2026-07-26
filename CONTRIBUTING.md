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

## Bug reports

Use the bug report issue template and include the requested reproduction details: steps,
browser and extension versions, JDownloader version and connection status, and relevant
console output. Reports without reproduction information may be closed as not actionable.
