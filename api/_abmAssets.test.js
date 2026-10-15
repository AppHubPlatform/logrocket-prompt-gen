import { describe, test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";

import {
  LIMITS,
  isPng,
  readJpegSize,
  readPngHeader,
  transparentPixelRatio,
  validateLogo,
  validateScreenshot,
} from "./_abmAssets.js";

// Build real PNGs rather than fixtures, so the decoder is exercised against bytes it
// would actually receive. `alpha` is applied to every pixel; colorType 6 is RGBA and 2 is
// RGB, which is how a flattened export arrives.
function png({ width = 200, height = 60, colorType = 6, alpha = 0, filter = 0 } = {}) {
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = filter;
    for (let x = 0; x < width; x++) {
      const at = row + 1 + x * channels;
      raw[at] = 255; raw[at + 1] = 255; raw[at + 2] = 255;
      if (channels === 4) raw[at + 3] = alpha;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let TABLE;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function jpeg({ width = 1200, height = 800 } = {}) {
  const sof = Buffer.alloc(11);
  sof[0] = 0xff; sof[1] = 0xc0;
  sof.writeUInt16BE(9, 2);  // segment length
  sof[4] = 8;               // precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

describe("format detection", () => {
  test("recognises a PNG and reads its header", () => {
    const buf = png({ width: 300, height: 90 });
    assert.ok(isPng(buf));
    const h = readPngHeader(buf);
    assert.equal(h.width, 300);
    assert.equal(h.height, 90);
    assert.equal(h.colorType, 6);
  });

  test("rejects a JPEG pretending to be a logo", () => {
    assert.equal(isPng(jpeg()), false);
  });

  test("reads JPEG dimensions from the frame header", () => {
    assert.deepEqual(readJpegSize(jpeg({ width: 1440, height: 900 })), { width: 1440, height: 900 });
  });
});

describe("transparency", () => {
  test("a fully transparent logo reads as transparent", () => {
    assert.equal(transparentPixelRatio(png({ alpha: 0 })), 1);
  });

  test("an RGBA logo that is fully opaque reads as not transparent", () => {
    // This is the real failure: exported as PNG, alpha channel present, flattened onto
    // white. Checking only for an alpha channel would pass it.
    assert.equal(transparentPixelRatio(png({ alpha: 255 })), 0);
  });

  test("a PNG with no alpha channel reads as not transparent", () => {
    assert.equal(transparentPixelRatio(png({ colorType: 2 })), 0);
  });

  test("decodes correctly through each PNG row filter", () => {
    for (const filter of [0, 1, 2, 3, 4]) {
      assert.equal(transparentPixelRatio(png({ alpha: 0, filter })), 1, `filter ${filter}`);
    }
  });
});

describe("validateLogo", () => {
  test("accepts a transparent PNG of a sensible size", () => {
    const r = validateLogo(png({ width: 400, height: 120, alpha: 0 }));
    assert.deepEqual(r.errors, []);
    assert.ok(r.ok);
    assert.equal(r.meta.transparentRatio, 1);
  });

  test("rejects a flattened logo and says why", () => {
    const r = validateLogo(png({ alpha: 255 }));
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), /no transparency|solid block/i);
  });

  test("rejects a JPEG and names it as a JPEG", () => {
    const r = validateLogo(jpeg());
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /must be a PNG/);
    assert.match(r.errors[0], /JPEG, which cannot hold transparency/);
  });

  test("rejects an SVG and tells the rep how to convert it", () => {
    // The likeliest wrong upload: a brand kit hands out SVGs, so the message has to
    // name the format rather than talk about JPEGs.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200"></svg>');
    const r = validateLogo(svg);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /looks like an SVG/);
    assert.doesNotMatch(r.errors[0], /JPEG/);
  });

  test("rejects a logo too small to stay sharp", () => {
    const r = validateLogo(png({ width: 64, height: 24, alpha: 0 }));
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), /64px wide/);
  });

  test("rejects a missing file", () => {
    assert.equal(validateLogo(null).ok, false);
  });
});

describe("validateScreenshot", () => {
  const ok = { sourceUrl: "https://www.ipsy.com/checkout" };

  test("accepts a wide PNG with the URL it came from", () => {
    const r = validateScreenshot(png({ width: 1440, height: 900, alpha: 255 }), ok);
    assert.deepEqual(r.errors, []);
    assert.equal(r.meta.sourceUrl, "https://www.ipsy.com/checkout");
  });

  test("accepts a JPEG screenshot", () => {
    const r = validateScreenshot(jpeg({ width: 1600, height: 1000 }), ok);
    assert.ok(r.ok);
    assert.equal(r.meta.format, "jpeg");
  });

  test("requires the source URL, since the page names the workflow", () => {
    const r = validateScreenshot(png({ width: 1440, height: 900 }), {});
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), /URL the screenshot was taken from/);
  });

  test("rejects something that is not a URL", () => {
    const r = validateScreenshot(png({ width: 1440, height: 900 }), { sourceUrl: "checkout page" });
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), /is not a URL/);
  });

  test("rejects a screenshot too narrow to look sharp", () => {
    const r = validateScreenshot(png({ width: 400, height: 300 }), ok);
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), new RegExp(`${LIMITS.screenshotMinWidth}px`));
  });

  test("rejects a PDF or anything else", () => {
    const r = validateScreenshot(Buffer.from("%PDF-1.7"), ok);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /PNG or JPEG/);
  });
});
