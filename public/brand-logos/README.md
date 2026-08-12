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
- **Customers** — the brand line on the section 06 cards, taking precedence over every
  other source.

## Where a customer logo comes from

Four sources, best first. The first one that answers wins.

1. **This directory.** A wordmark, sized and coloured for the card. Always the best
   result, and the only source you control.
2. **LogRocket's published case studies.** SVG wordmarks from `logrocket.com/customers`,
   matched by name. Covers published customers only.
3. **The customer's own website.** The site's app icon, found from a domain guessed from
   the company name. This is what covers Rog examples, which are usually not published
   customers. It returns a square icon rather than a wordmark, so the guide renders it
   as a mark beside the name, in its own colours.
4. **The initial badge.** A letter in a purple tile.

Source 3 only guesses the whole name as a domain, so it finds Wayfair and Tecovas and
misses anything whose name is not its domain, Blue Cross Blue Shield of Massachusetts
being bluecrossma.com. It deliberately does not shorten to the first word, since
"Blue Cross Blue Shield of Massachusetts" would reach blue.com and print a stranger's
logo as a LogRocket customer.

No company-data or logo service is involved, so no customer name is sent anywhere that
would learn who LogRocket sells to. Only the customer's own site is contacted.

If a card shows a square icon or a letter and you want a wordmark, drop the file here.

Anything over 400KB is ignored, to keep the rasterised PDF a sane size.

## Currently present

Taken from each vendor's own site header and visually checked before installing:

- `posthog.svg` — full wordmark
- `glassbox.svg` — full wordmark
- `contentsquare.svg` — stacked wordmark, brand maroon
- `fullstory.svg` — full wordmark with the burst mark
- `quantummetric.svg` — Q mark plus wordmark
- `arhaus.png` — wordmark, from ir.arhaus.com. 1079x253 transparent PNG; arhaus.com
  itself hard-blocks automated requests, so the investor-relations host was used.
- `hotjar.svg` — flame mark only, no wordmark. Worth replacing with a real wordmark.

## Still needed

- **Microsoft Clarity** — the header logo is not a self-contained inline SVG; the
  candidate extracted from the page would not render standalone. Falls back to a
  generic mark plus the name.

Datadog, Sentry, Pendo, Amplitude and Heap need nothing here: they are LogRocket
integrations, so their logo already comes from the integration catalogue.
