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

// Each card's logo <img> precedes its <h3>, so look back over the card for the
// nearest src rather than trying to match the whole card in one expression.
function logoBefore(html, index) {
  const window = html.slice(Math.max(0, index - 900), index);
  const srcs = [...window.matchAll(/<img[^>]*?src="([^"]+)"/g)].map(m => m[1]);
  const src = srcs.length ? srcs[srcs.length - 1] : null;
  if (!src) return null;
  return src.startsWith("http") ? src : new URL(src, CATALOGUE_URL).toString();
}

export function parseCatalogue(html) {
  const src = String(html);
  const out = [];
  const seen = new Set();
  for (const m of src.matchAll(CARD_RE)) {
    const name = decode(m[1]);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      name,
      category: decode(m[2]),
      description: decode(m[3]),
      logoUrl: logoBefore(src, m.index),
    });
  }
  return out;
}

// Inline a logo as a data URI. The guide is captured to canvas for the PDF, so a
// remote image would be blocked or race the capture; embedding avoids both.
async function inlineLogo(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/svg+xml";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 60_000) return null; // keep the payload sane
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Cached for an hour so the follow-up logo lookup doesn't refetch the page.
let cache = { at: 0, integrations: null };
const CACHE_MS = 60 * 60 * 1000;

export async function fetchIntegrationCatalogue() {
  if (cache.integrations && Date.now() - cache.at < CACHE_MS) return cache.integrations;
  const res = await fetch(CATALOGUE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LogRocketPromptGen/1.0)" },
  });
  if (!res.ok) throw new Error(`Catalogue fetch failed: HTTP ${res.status}`);
  const integrations = parseCatalogue(await res.text());
  // Guard against a markup change silently yielding a near-empty list.
  if (integrations.length < 20) {
    throw new Error(`Catalogue parse returned only ${integrations.length} entries — markup may have changed`);
  }
  cache = { at: Date.now(), integrations };
  return integrations;
}

// Data URIs for just the integrations the guide actually shows, keyed by name.
const logoCache = new Map();
export async function fetchLogosFor(names) {
  const catalogue = await fetchIntegrationCatalogue();
  const byName = new Map(catalogue.map(i => [i.name.toLowerCase(), i]));
  const wanted = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))].slice(0, 30);
  const out = {};
  await Promise.all(wanted.map(async (name) => {
    const entry = byName.get(name.toLowerCase());
    if (!entry?.logoUrl) return;
    if (!logoCache.has(entry.logoUrl)) {
      logoCache.set(entry.logoUrl, await inlineLogo(entry.logoUrl));
    }
    const uri = logoCache.get(entry.logoUrl);
    if (uri) out[name] = uri;
  }));
  return out;
}
