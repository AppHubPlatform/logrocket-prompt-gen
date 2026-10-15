import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";

import { optimizeLogo, optimizeScreenshot } from "./_abmImages.js";

const png = (b) => ({ bytes: b, contentType: "image/png" });

// A wide test "screenshot": a 120px grey toolbar over a white page.
async function screenshot() {
  const toolbar = await sharp({ create: { width: 2400, height: 120, channels: 3, background: "#383838" } }).png().toBuffer();
  return png(await sharp({ create: { width: 2400, height: 1000, channels: 3, background: "#ffffff" } })
    .composite([{ input: toolbar, top: 0, left: 0 }]).png().toBuffer());
}

describe("optimizeScreenshot", () => {
  test("shrinks to the size the page draws it at", async () => {
    const out = await optimizeScreenshot(await screenshot());
    assert.equal(out.width, 1400);
    assert.equal(out.contentType, "image/webp");
  });

  test("cuts the browser bar out of the image itself, not just out of view", async () => {
    // Hiding it with CSS left the rep's bookmarks in the page's bytes.
    const out = await optimizeScreenshot(await screenshot(), { cropTop: 120 });
    const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    const topRow = data.subarray(0, info.width * info.channels);
    const greyPixels = [...Array(info.width).keys()].filter(x => topRow[x * info.channels] < 100).length;
    assert.equal(greyPixels, 0, "no toolbar grey left at the top");
    assert.equal(out.height, Math.round((1000 - 120) * (1400 / 2400)));
  });

  test("never enlarges a small image", async () => {
    const small = png(await sharp({ create: { width: 900, height: 500, channels: 3, background: "#fff" } }).png().toBuffer());
    assert.equal((await optimizeScreenshot(small)).width, 900);
  });
});

describe("optimizeLogo", () => {
  test("keeps the original when re-encoding would make it bigger", async () => {
    const original = png(fs.readFileSync("public/brand-logos/arhaus.png"));
    const out = await optimizeLogo(original);
    assert.ok(out.bytes.length <= original.bytes.length);
  });

  test("keeps transparency when it does re-encode", async () => {
    const big = png(await sharp({ create: { width: 2000, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="2000" height="600"><circle cx="1000" cy="300" r="250" fill="#6D3FD1"/></svg>') }])
      .png({ compressionLevel: 0 }).toBuffer());
    const out = await optimizeLogo(big);
    const meta = await sharp(out.bytes).metadata();
    assert.ok(meta.hasAlpha, "transparency survives");
    assert.ok(meta.width <= 600);
  });
});
