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

## Contents

- **monitoring-maturity-quest** — an 8-bit retro-game-styled interactive quiz
  used as outbound-email collateral.
