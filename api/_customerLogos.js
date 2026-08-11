// Real customer logos, taken from LogRocket's own case-study assets rather than a
// third-party favicon service. Favicon endpoints only return 32-128px icons, which
// is what the guide is trying to get away from; these are SVG wordmarks and are
// already ours to use, since every one belongs to a published LogRocket customer.
//
// Source: https://logrocket.com/customers, assets at
//   /images/case-studies/<slug>-logo.svg

export const CUSTOMERS_URL = "https://logrocket.com/customers";
const ORIGIN = "https://logrocket.com";

const LOGO_RE = /\/images\/case-studies\/([A-Za-z0-9._-]+)-logo\.svg/g;

export function parseCustomerLogos(html) {
  const out = new Map();
  for (const m of String(html).matchAll(LOGO_RE)) {
    // Slugs repeat across thumbnail and featured markup; first win is fine.
    if (!out.has(m[1])) out.set(m[1], ORIGIN + m[0]);
  }
  return out;
}

let cache = { at: 0, logos: null };
const CACHE_MS = 60 * 60 * 1000;

export async function fetchCustomerLogoIndex() {
  if (cache.logos && Date.now() - cache.at < CACHE_MS) return cache.logos;
  const res = await fetch(CUSTOMERS_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LogRocketPromptGen/1.0)" },
  });
  if (!res.ok) throw new Error(`Customers fetch failed: HTTP ${res.status}`);
  const logos = parseCustomerLogos(await res.text());
  // Guard against a markup change quietly yielding nothing.
  if (logos.size < 5) {
    throw new Error(`Customer logo parse returned only ${logos.size} entries`);
  }
  cache = { at: Date.now(), logos };
  return logos;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Slugs that no amount of string matching reaches from the name a guide actually
// writes. LogRocket's own case-study slug is an abbreviation, and the guide spells the
// customer out in full, so there is no shared substring to find: "bcbsma" against
// "bluecrossblueshieldofmassachusetts". An acronym cannot be derived safely either,
// since initialising words would have "htech" collide with anything starting H and T.
//
// Only genuine gaps belong here. Cox Automotive, Speedway Motors, Tower Loan and
// 7-Eleven all contain their slug once normalised and are matched without help.
const SLUG_ALIASES = {
  bcbsma: [
    "Blue Cross Blue Shield of Massachusetts",
    "Blue Cross Blue Shield of MA",
    "Blue Cross Blue Shield",
    "BCBS Massachusetts",
    "BCBSMA",
  ],
};

// Company names are written loosely ("ThredUp", "Cushman & Wakefield"), so match on
// the normalised slug, then on a known alias, then on containment either way, longest
// match winning. Aliases outrank containment: they are curated, so when one applies it
// is a better answer than a coincidental substring.
// Containment needs a query with enough letters to mean something. A one or two
// character name is a substring of half the index: "H" sits inside both "htech" and
// "blue cross blue shield of massachusetts", and whichever it landed on would be a
// coincidence presented as a customer's logo. Shorter names must match exactly. The
// shortest real customer here is Dojo, at four.
const MIN_PARTIAL = 4;

export function findLogoSlug(index, company) {
  const q = norm(company);
  if (!q) return null;
  const slugs = [...index.keys()];
  const exact = slugs.find(s => norm(s) === q);
  if (exact) return exact;
  const contains = (n) => n === q || (q.length >= MIN_PARTIAL && n.length >= MIN_PARTIAL
    && (n.includes(q) || q.includes(n)));
  const aliased = slugs.find(s => (SLUG_ALIASES[s] || []).some(a => contains(norm(a))));
  if (aliased) return aliased;
  const partial = slugs
    .filter(s => contains(norm(s)))
    .sort((a, b) => norm(b).length - norm(a).length);
  return partial[0] || null;
}

// Inline as a data URI: the guide is rasterised for the PDF, so a remote image
// would either be blocked or race the capture.
async function inline(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 400_000) return null; // some of these SVGs are large
    const type = res.headers.get("content-type") || "image/svg+xml";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const logoCache = new Map();

export async function fetchCustomerLogos(names) {
  const index = await fetchCustomerLogoIndex();
  const wanted = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))].slice(0, 12);
  const out = {};
  await Promise.all(wanted.map(async (name) => {
    const slug = findLogoSlug(index, name);
    if (!slug) return;
    const url = index.get(slug);
    if (!logoCache.has(url)) logoCache.set(url, await inline(url));
    const uri = logoCache.get(url);
    if (uri) out[name] = uri;
  }));
  return out;
}
