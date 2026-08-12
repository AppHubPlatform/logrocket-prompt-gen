// Last-resort customer logos, taken from the customer's own website.
//
// This exists for Rog examples. Rog is internal customer intelligence, so a company it
// surfaces usually has no published LogRocket case study and no approved asset on disk,
// and the card would otherwise show a bare initial. Only the company's own site is
// fetched: no logo API and no company-data service, so a customer name is never sent to
// a third party that would learn who LogRocket sells to.
//
// What this yields is an app icon, square and typically 180px, not a wordmark. It is a
// backstop, and the fix for any customer worth presenting well is still a file in
// public/brand-logos/. Logos from here are tagged `site` so the guide can render them as
// a mark rather than pretending they are wordmarks.
//
// og:image is deliberately not used. Measured across real sites it returns whatever the
// page is promoting: Wayfair's is a photograph of a sofa.

const MAX_BYTES = 120_000;
const TIMEOUT_MS = 6000;

// A company name is all we have, so the domain is guessed. This works for brands that
// are their own domain (Tecovas, Wayfair, Dutchie, Cushman & Wakefield) and fails for
// those that are not: Blue Cross Blue Shield of Massachusetts is bluecrossma.com. Those
// need a file on disk, which is why this is the last source tried rather than the only
// one.
//
// Only the whole name is tried, never the first word. Shortening to the first word
// reaches a real site owned by someone else: "Blue Cross Blue Shield of Massachusetts"
// becomes blue.com. Printing an unrelated company's logo in a customer-proof section is
// far worse than printing no logo, so the guess must be wrong-or-nothing, not
// approximate.
export function candidateDomains(company) {
  const raw = String(company || "").trim();
  if (!raw) return [];
  // Drop the corporate suffixes that are never part of a domain.
  const cleaned = raw
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|holdings|plc|gmbh|sa|ag)\b\.?/gi, " ")
    .replace(/[&]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const joined = words.join("").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const out = [];
  const add = (host) => {
    if (host && host.length >= 3 && !out.includes(host)) out.push(host);
  };
  add(`${joined}.com`);
  add(`${joined}.io`);
  return out;
}

// Never let a guessed name reach something that is not a public website.
const PRIVATE_HOST = /^(localhost$|.*\.local$|.*\.internal$|\d+\.\d+\.\d+\.\d+$|\[)/i;

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LogRocketPromptGen/1.0)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

const ICON_LINK = /<link\b[^>]*>/gi;

// Prefer the biggest declared square icon. apple-touch-icon is the one most sites ship
// at a usable size, so it wins ties.
export function pickIconHref(html) {
  const found = [];
  for (const tag of String(html).matchAll(ICON_LINK)) {
    const t = tag[0];
    const rel = (t.match(/\brel=["']([^"']+)["']/i) || [])[1];
    const href = (t.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!rel || !href) continue;
    if (!/\b(apple-touch-icon(-precomposed)?|icon|shortcut icon)\b/i.test(rel)) continue;
    if (/\.svg(\?|$)/i.test(href) === false && /\.(png|jpg|jpeg|webp|ico)(\?|$)/i.test(href) === false) continue;
    const sizes = (t.match(/\bsizes=["'](\d+)x\d+["']/i) || [])[1];
    const apple = /apple-touch-icon/i.test(rel);
    found.push({ href, px: sizes ? Number(sizes) : (apple ? 180 : 0), apple });
  }
  found.sort((a, b) => b.px - a.px || (b.apple ? 1 : 0) - (a.apple ? 1 : 0));
  return found.length ? found[0].href : null;
}

async function inlineIcon(url) {
  try {
    const res = await get(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!/^image\//i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function logoForDomain(host) {
  if (PRIVATE_HOST.test(host)) return null;
  let res;
  try {
    res = await get(`https://${host}/`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const base = new URL(res.url || `https://${host}/`);
  const html = (await res.text()).slice(0, 400_000);
  const href = pickIconHref(html);
  const tries = [];
  if (href) tries.push(new URL(href, base).href);
  tries.push(new URL("/apple-touch-icon.png", base).href);
  for (const url of tries) {
    const uri = await inlineIcon(url);
    if (uri) return uri;
  }
  return null;
}

// Successes only, for the same reason as the other logo sources: caching a miss meant a
// dropped fetch removed a logo for the life of the process.
const cache = new Map();

export async function fetchSiteLogos(names) {
  const wanted = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))].slice(0, 12);
  const out = {};
  await Promise.all(wanted.map(async (name) => {
    const key = name.toLowerCase();
    let uri = cache.get(key);
    if (!uri) {
      for (const host of candidateDomains(name)) {
        uri = await logoForDomain(host);
        if (uri) break;
      }
      if (uri) cache.set(key, uri);
    }
    if (uri) out[name] = uri;
  }));
  return out;
}
