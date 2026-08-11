// Approved brand assets kept in the repo at public/brand-logos/, so adding a logo
// is dropping a file in rather than editing code. Read from disk and inlined as a
// data URI, because the guide is rasterised for the PDF and an inlined image can
// neither be blocked nor race the capture.
//
// Naming: the competitor or customer name, lowercased, non-alphanumerics stripped.
//   PostHog           -> posthog.svg
//   Quantum Metric    -> quantummetric.svg
//   Microsoft Clarity -> microsoftclarity.svg
// SVG is preferred; png and webp also work.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "brand-logos");
const EXT_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Cached briefly so a guide with several lookups does not restat the directory
// each time, while a newly dropped file still shows up without a restart.
let cache = { at: 0, files: null };
const CACHE_MS = 10 * 1000;

async function listFiles() {
  if (cache.files && Date.now() - cache.at < CACHE_MS) return cache.files;
  let names = [];
  try {
    names = await readdir(DIR);
  } catch {
    names = []; // folder absent is fine: every lookup just misses
  }
  const files = new Map();
  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    if (!EXT_TYPES[ext]) continue;
    files.set(norm(path.basename(name, ext)), { name, ext });
  }
  cache = { at: Date.now(), files };
  return files;
}

export async function fetchBrandLogos(names) {
  const files = await listFiles();
  const wanted = [...new Set((names || []).map(n => String(n).trim()).filter(Boolean))].slice(0, 20);
  const out = {};
  await Promise.all(wanted.map(async (name) => {
    const hit = files.get(norm(name));
    if (!hit) return;
    try {
      const buf = await readFile(path.join(DIR, hit.name));
      if (buf.length > 400_000) return;
      out[name] = `data:${EXT_TYPES[hit.ext]};base64,${buf.toString("base64")}`;
    } catch { /* unreadable file behaves as absent */ }
  }));
  return out;
}
