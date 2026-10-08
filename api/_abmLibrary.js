// Shared imagery for ABM pages, from the asset folder Greg keeps in Drive and checked in
// under api/abm-assets/ so it ships with the service.
//
// Three lookups: the rep's headshot, matched to whoever created the page, so nobody has to
// upload one; the screenshot for the account's industry; and a product screenshot for each
// Product Fit row, matched on the capability the row is about. Each returns null rather
// than guessing, and the page falls back cleanly, to initials or to the row's own text.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "abm-assets");
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

const cache = new Map();
function load(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const file = path.join(ROOT, rel);
  let asset = null;
  if (fs.existsSync(file)) {
    asset = { bytes: fs.readFileSync(file), contentType: TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" };
  }
  cache.set(rel, asset);
  return asset;
}

const flat = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Headshots are named first-last. LogRocket addresses are firstlast@, so the two meet once
// both are flattened: gregallen@logrocket.com finds greg-allen.jpeg. A dotted address,
// greg.allen@, flattens the same way. Anyone without a photo gets their initials.
export function aePhotoFor(email) {
  const local = flat(String(email || "").split("@")[0]);
  if (!local) return null;
  const dir = path.join(ROOT, "people");
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find(f => flat(path.parse(f).name) === local);
  return hit ? load(`people/${hit}`) : null;
}

// The rep's display name, taken from their headshot's filename. firstlast@ addresses have
// no word boundary in them, so deriving the name from the email printed "Gregallen".
// Without a headshot, a dotted address still splits cleanly; otherwise null, and the caller
// falls back to what it has.
export function aeNameFor(email) {
  const raw = String(email || "").split("@")[0];
  const local = flat(raw);
  const dir = path.join(ROOT, "people");
  if (local && fs.existsSync(dir)) {
    const hit = fs.readdirSync(dir).find(f => flat(path.parse(f).name) === local);
    if (hit) return path.parse(hit).name.split(/[-_ ]+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  if (/[._-]/.test(raw)) return raw.split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  return null;
}

// Keyed the same way INDUSTRIES is in _abmChrome.js.
export function industryShot(key) {
  return key ? load(`industry/${key}.png`) : null;
}

// First match wins, so the specific capabilities sit above the general ones. "Analytics"
// alone would pull the dashboard shot onto "Surveys & Feedback Analytics", and "Galileo"
// would pull the chat shot onto "Galileo AI: Heatmaps", so dashboards and Galileo are last.
const PRODUCT = [
  [/alert/i, "alerts.png"],
  [/feedback|survey|voice of|voc/i, "feedback.png"],
  [/heatmap|click map|scroll/i, "heatmaps.png"],
  [/release|deploy|recap/i, "release-recaps.png"],
  [/issue|error|root cause|triage|bug/i, "issues.png"],
  [/backend|frontend|network|console|context/i, "issues.png"],
  [/dashboard|analytics|metric|kpi/i, "dashboards.png"],
  [/galileo|\bai\b|ask|insight|stream/i, "ask-galileo.png"],
];

// The row's label decides first, and its headline only when the label matches nothing.
// Headlines are written for the reader and mention other capabilities in passing: "Go from
// a backend alert to what the customer saw" is about context, not alerting, and matching
// on it put the alerts screenshot on two rows in a row.
//
// `used` keeps a page from showing the same screenshot twice; a row whose candidates are
// all taken goes without rather than repeating one.
export function productShotFor(label, headline = "", used = null) {
  const pick = (text) => {
    for (const [re, file] of PRODUCT) {
      if (re.test(text) && !(used && used.has(file))) return file;
    }
    return null;
  };
  const file = pick(label) || pick(headline);
  if (!file) return null;
  if (used) used.add(file);
  return load(`product/${file}`);
}

// Quote logos the template carried as text, now that the real mark exists.
export function quoteLogoFor(name) {
  return flat(name) === "speedwaymotors" ? load("quotes/speedway-motors.jpg") : null;
}
