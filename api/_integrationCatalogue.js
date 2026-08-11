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
// One retry, since up to thirty of these are fetched at once and a dropped connection
// should not be the difference between a logo and a name.
async function inlineLogo(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "image/svg+xml";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 60_000) return null; // too big to inline; retrying will not help
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch { /* fall through to the next attempt */ }
  }
  return null;
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

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Reps and the model name tools loosely — "Google Play" for the catalogue's
// "Google Play Store", "App Store" for "Apple App Store" — so match on the
// normalised name, then on containment either way, longest match winning.
function findEntry(catalogue, query) {
  const q = norm(query);
  if (!q) return null;
  const exact = catalogue.find(i => norm(i.name) === q);
  if (exact) return exact;
  const partial = catalogue
    .filter(i => { const n = norm(i.name); return n.includes(q) || q.includes(n); })
    .sort((a, b) => norm(b.name).length - norm(a.name).length);
  return partial[0] || null;
}

export async function fetchLogosFor(names) {
  const catalogue = await fetchIntegrationCatalogue();
  const wanted = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))].slice(0, 30);
  const out = {};
  await Promise.all(wanted.map(async (name) => {
    const entry = findEntry(catalogue, name);
    if (!entry?.logoUrl) return;
    // Successes only. Caching the failure meant one dropped fetch dropped that logo for
    // the life of the process, so a card showed a name instead of a mark until the
    // instance recycled. A miss now retries on the next guide.
    let uri = logoCache.get(entry.logoUrl);
    if (!uri) {
      uri = await inlineLogo(entry.logoUrl);
      if (uri) logoCache.set(entry.logoUrl, uri);
    }
    if (uri) out[name] = uri;
  }));
  return out;
}
