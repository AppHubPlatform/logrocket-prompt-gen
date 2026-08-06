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

Taken from each vendor's own site header and visually checked before installing:

- `posthog.svg` — full wordmark
- `glassbox.svg` — full wordmark
- `contentsquare.svg` — stacked wordmark, brand maroon
- `fullstory.svg` — full wordmark with the burst mark
- `quantummetric.svg` — Q mark plus wordmark
- `hotjar.svg` — flame mark only, no wordmark. Worth replacing with a real wordmark.

## Still needed

- **Microsoft Clarity** — the header logo is not a self-contained inline SVG; the
  candidate extracted from the page would not render standalone. Falls back to a
  generic mark plus the name.
- **Arhaus** (customer) — no published LogRocket case study, and their site blocks
  scraping.

Datadog, Sentry, Pendo, Amplitude and Heap need nothing here: they are LogRocket
integrations, so their logo already comes from the integration catalogue.
