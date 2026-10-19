// Shrinks the rep's uploads before they go into a page.
//
// A full-window screenshot arrives at two or three thousand pixels wide and a megabyte
// or more, and the page shows it in a column about 540px wide. Embedded as-is, the Axos
// screenshot alone was a third of a 3.4MB page. So images are resized to twice the size
// they are drawn at, for retina screens, and re-encoded as WebP.
//
// The screenshot's browser bar is also cut off here, for real, rather than hidden with
// CSS. Hiding it left the rep's bookmarks in the page's bytes, where anyone saving the
// image could still see them. The original upload is kept untouched, so the crop can
// still be undone from the editor.

import crypto from "node:crypto";
import sharp from "sharp";

const LOGO_WIDTH = 600;        // drawn at most ~150px wide in the hero lockup
const SCREENSHOT_WIDTH = 1400; // drawn in a column of roughly 540-700px

const cache = new Map();
const key = (bytes, ...parts) => crypto.createHash("sha1").update(bytes).update(parts.join("|")).digest("hex");

async function memo(k, work) {
  if (!cache.has(k)) {
    if (cache.size > 200) cache.clear();   // a few dozen pages at most; never unbounded
    cache.set(k, work());
  }
  return cache.get(k);
}

// Re-encoding only earns its place when it saves bytes. A logo that is already a small,
// well-compressed PNG came out larger as WebP (11KB to 14KB), so the smaller one wins.
const smaller = (original, optimized) =>
  optimized.bytes.length < original.bytes.length ? optimized : original;

export async function optimizeLogo(asset) {
  if (!asset?.bytes) return asset;
  return memo(key(asset.bytes, "logo"), async () => {
    const bytes = await sharp(asset.bytes)
      .resize({ width: LOGO_WIDTH, withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })     // keep the transparency sharp
      .toBuffer();
    return smaller(asset, { bytes, contentType: "image/webp" });
  });
}

export async function optimizeScreenshot(asset, { cropTop = 0 } = {}) {
  if (!asset?.bytes) return asset;
  return memo(key(asset.bytes, "shot", cropTop), async () => {
    const img = sharp(asset.bytes);
    const { width, height } = await img.metadata();
    const top = Math.max(0, Math.min(cropTop || 0, height - 1));
    const out = await img
      .extract({ left: 0, top, width, height: height - top })
      .resize({ width: SCREENSHOT_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: out.data, contentType: "image/webp", width: out.info.width, height: out.info.height };
  });
}
