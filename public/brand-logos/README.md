# Brand logos

Approved logo assets for the competitor guide. Drop a file in here and the guide
picks it up on the next generation. No code change needed.

## Naming

The competitor or customer name, lowercased, with every non-alphanumeric character
stripped. SVG is preferred; `.png` and `.webp` also work.

| Name | Filename |
| --- | --- |
| PostHog | `posthog.svg` |
| Quantum Metric | `quantummetric.svg` |
| Microsoft Clarity | `microsoftclarity.svg` |
| Arhaus | `arhaus.svg` |

## What it is used for

- **Competitors** — the column header in section 03. Files here are treated as
  wordmarks, so they stand alone without the name printed beside them. If you add a
  square icon rather than a wordmark, the column will read as an unlabelled glyph.
- **Customers** — the brand line on the section 06 cards, taking precedence over the
  logo pulled from LogRocket's published case studies.

Anything over 400KB is ignored, to keep the rasterised PDF a sane size.

## Currently present

Scraped from each vendor's own site and visually checked:

- `posthog.svg` — full wordmark
- `glassbox.svg` — full wordmark
- `hotjar.svg` — flame mark only, no wordmark. Worth replacing with a real wordmark.

## Still needed

No asset found, so these fall back to a generic mark plus the name:

- FullStory, Contentsquare, Quantum Metric, Microsoft Clarity — their sites build
  the header logo as inline SVG or opaque CDN filenames, so there was nothing safe
  to pull without risking grabbing one of *their* customers' logos by mistake.
- Arhaus (customer) — no published LogRocket case study, and their site blocks
  scraping.

Datadog, Sentry, Pendo, Amplitude and Heap need nothing here: they are LogRocket
integrations, so their logo already comes from the integration catalogue.
