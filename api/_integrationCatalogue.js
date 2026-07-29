// Fetches LogRocket's published integration catalogue at runtime so the guide
// always reflects the live list rather than a snapshot.
// Source: https://logrocket.com/products/integrations
//
// Each integration renders as a card containing its name, category badge and an
// official one-line description:
//   <h3 class="text-h8">Qualtrics</h3><span …>Voice of Customer</span>
//   … <p class="text-15 …">Link session URLs to survey responses.</p>

export const CATALOGUE_URL = "https://logrocket.com/products/integrations";

const CARD_RE = new RegExp(
  '<h3 class="text-h8">([^<]+)</h3>\\s*<span[^>]*>([^<]*)</span>[\\s\\S]*?<p class="text-15[^"]*">([^<]*)',
  "g"
);

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

export function parseCatalogue(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(CARD_RE)) {
    const name = decode(m[1]);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, category: decode(m[2]), description: decode(m[3]) });
  }
  return out;
}

export async function fetchIntegrationCatalogue() {
  const res = await fetch(CATALOGUE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LogRocketPromptGen/1.0)" },
  });
  if (!res.ok) throw new Error(`Catalogue fetch failed: HTTP ${res.status}`);
  const integrations = parseCatalogue(await res.text());
  // Guard against a markup change silently yielding a near-empty list.
  if (integrations.length < 20) {
    throw new Error(`Catalogue parse returned only ${integrations.length} entries — markup may have changed`);
  }
  return integrations;
}
