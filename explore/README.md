# explore.logrocket.com

Public, unauthenticated static hosting for external-facing collateral. Served by
a second Cloud Run service (`logrocket-explore`) that is deliberately separate
from the IAP-gated `logrocket-prompt-gen` service — see
[../infra/README.md](../infra/README.md).

Anything under `public/` is on the open internet. Do not put internal notes,
unreleased positioning, or anything with a credential in it there. This README
lives outside `public/` for that reason.

## Layout

```
explore/
  server.js                              express static server (no API routes)
  public/
    index.html                           landing page
    monitoring-maturity-quest/index.html -> /monitoring-maturity-quest
```

## Local development

```bash
cd explore
npm install
npm start          # http://localhost:8080
```

The pages are plain self-contained HTML with no build step, so you can also just
open a file under `public/` directly in a browser.

## Adding a page

Drop a self-contained `<name>/index.html` under `public/` and link it from
`public/index.html`. It ships on the next deploy of the `logrocket-explore`
service (`.github/workflows/deploy-explore.yml`).

## Adding an unlisted page

For collateral meant for one customer, put it at
`public/r/<id>/index.html` with `<id>` from `openssl rand -hex 16`, and don't
link it from anywhere. The server sends `X-Robots-Tag: noindex` and
`Referrer-Policy: no-referrer` for everything under `/r/`, and static serving
has no directory listing, so the URL is only discoverable by whoever has it.
Also add `<meta name="robots" content="noindex">` to the page itself. Don't
list unlisted pages below.

## Contents

- **monitoring-maturity-quest** — an 8-bit retro-game-styled interactive quiz
  used as outbound-email collateral.
