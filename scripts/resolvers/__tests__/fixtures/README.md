# Resolver fixtures

Captured 2026-10-13 from fileditchfiles.me and sanitized before commit.

- `fileditch-filepage.html`: a real FileDitch file page, rendered DOM as saved by Chrome. The file id, filename and signature are replaced with test values, the token is re-encoded to match, and all ad, analytics and tracking scripts are removed.
- `cloudflare-challenge.html`: a real Cloudflare "Just a moment..." challenge page served for the same host. Ray id, tokens and cookie-like values are replaced with `TESTVALUE`.

The token in the page fixture carries the timestamp 1791924206 (unix seconds), about 3 hours after the capture. Tests do not depend on whether that moment is still in the future.
