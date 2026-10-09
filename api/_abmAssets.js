// The two files the rep uploads with an ABM page: the account's logo and a screenshot of
// their site.
//
// Both are checked here rather than trusted, because the page goes to the prospect. The
// logo sits on the dark nav, so a PNG that was flattened onto white renders as a white
// box around the customer's own mark, and nobody notices until it is sent. "Looks like a
// PNG" is not enough to catch that: the file has to actually carry transparent pixels,
// so the image is decoded far enough to count them.

import zlib from "node:zlib";

export const LIMITS = {
  logoBytes: 1_000_000,
  screenshotBytes: 5_000_000,
  logoMinWidth: 120,
  screenshotMinWidth: 800,
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Bytes per pixel for the colour types that carry alpha, plus the ones that do not, so a
// scanline can be unfiltered without a decoding library.
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function isPng(buf) {
  return Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).equals(PNG_MAGIC);
}

function* chunks(buf) {
  let off = 8;
  while (off + 8 <= buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const start = off + 8;
    const end = start + length;
    if (end > buf.length) return;
    yield { type, data: buf.subarray(start, end) };
    off = end + 4; // skip the CRC
  }
}

export function readPngHeader(buf) {
  if (!isPng(buf)) throw new Error("Not a PNG file");
  for (const { type, data } of chunks(buf)) {
    if (type !== "IHDR") continue;
    return {
      width: data.readUInt32BE(0),
      height: data.readUInt32BE(4),
      bitDepth: data[8],
      colorType: data[9],
      interlaced: data[12] === 1,
    };
  }
  throw new Error("PNG has no header chunk");
}

// Paeth and friends. PNG filters each scanline against the one above it, so the rows have
// to be undone in order even though only the alpha bytes are wanted.
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return out;
}

// Decodes an 8-bit, non-interlaced PNG to raw pixels. Returns null for anything else,
// so callers can treat "cannot tell" as its own answer rather than guessing.
export function decodePng(buf) {
  const { width, height, bitDepth, colorType, interlaced } = readPngHeader(buf);
  if (interlaced || bitDepth !== 8 || !(colorType in CHANNELS) || colorType === 3) return null;
  const idat = [];
  for (const { type, data } of chunks(buf)) if (type === "IDAT") idat.push(data);
  if (!idat.length) return null;
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }
  const bpp = CHANNELS[colorType];
  if (raw.length < (width * bpp + 1) * height) return null;
  return { width, height, bpp, pixels: unfilter(raw, width, height, bpp) };
}

// How many pixels at the top of a screenshot are the browser rather than the website.
//
// Reps capture the whole window, so screenshots arrive with the tab strip, the address
// bar and the bookmarks bar on top. That is worse than untidy: the bookmarks bar shows
// the rep's own bookmarks, internal tools by name, to a prospect.
//
// Browser toolbars are a band of flat neutral grey. The first row that stops matching
// that grey, and keeps not matching it, is where the page begins. A site whose own
// header is flat white or black does not qualify, because toolbars are never pure
// white or pure black; that is what keeps this from cropping off a site's own
// navigation. Anything that is not a confident match returns 0, and the rep can undo a
// crop either way.
export function detectBrowserChrome(buf) {
  if (!isPng(buf)) return 0;
  const img = decodePng(buf);
  if (!img) return 0;
  const { width, height, bpp, pixels } = img;
  const at = (x, y) => { const i = (y * width + x) * bpp; return [pixels[i], pixels[i + 1], pixels[i + 2]]; };

  // Toolbar colour: the most common colour along a row near the very top.
  const counts = new Map();
  const y0 = Math.min(4, height - 1);
  for (let x = 0; x < width; x += 2) {
    const c = at(x, y0).map(v => v >> 3 << 3).join(",");
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const ref = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
  const [r, g, b] = ref;
  const neutral = Math.abs(r - g) < 14 && Math.abs(g - b) < 14;
  const lum = (r + g + b) / 3;
  if (!neutral || lum < 20 || lum > 248) return 0;

  // A toolbar is a family of greys rather than one colour: the address-bar pill and the
  // separators are a shade or two off the bar itself. Matching one exact grey stopped the
  // walk inside the address bar. So any neutral grey near the toolbar's brightness counts,
  // and pure black or pure white never does, which is where most pages start.
  const near = (c) => {
    const l = (c[0] + c[1] + c[2]) / 3;
    return Math.abs(c[0] - c[1]) < 12 && Math.abs(c[1] - c[2]) < 12
      && l >= 20 && l <= 248 && Math.abs(l - lum) <= 40;
  };
  const rowMatch = (y) => {
    let n = 0, total = 0;
    for (let x = 0; x < width; x += 4) { total++; if (near(at(x, y))) n++; }
    return n / total;
  };

  // Walk down while rows are mostly toolbar. Separator lines and the address-bar pill
  // break the band for a row or two, so only a sustained run of non-toolbar rows counts
  // as the page starting.
  const limit = Math.min(Math.floor(height * 0.3), 420);
  let miss = 0, cut = 0;
  for (let y = 0; y < limit; y++) {
    if (rowMatch(y) >= 0.45) { miss = 0; continue; }
    if (miss === 0) cut = y;
    if (++miss >= 6) break;
  }
  if (miss < 6) return 0;               // never left the toolbar colour: not confident
  return cut >= 40 ? cut : 0;           // too thin to be browser chrome
}

// What share of pixels are not fully opaque. Returns null when the question cannot be
// answered from the file alone, so the caller can say "unknown" rather than guess.
export function transparentPixelRatio(buf) {
  const { width, height, bitDepth, colorType, interlaced } = readPngHeader(buf);
  if (colorType !== 4 && colorType !== 6) return 0;      // no alpha channel at all
  if (interlaced) return null;                            // Adam7, not worth decoding here
  if (bitDepth !== 8 && bitDepth !== 16) return null;

  const idat = [];
  for (const { type, data } of chunks(buf)) if (type === "IDAT") idat.push(data);
  if (!idat.length) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const sampleBytes = bitDepth === 16 ? 2 : 1;
  const bpp = CHANNELS[colorType] * sampleBytes;
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) return null;

  const pixels = unfilter(raw, width, height, bpp);
  const alphaOffset = bpp - sampleBytes;          // alpha is the last sample in the pixel
  const max = bitDepth === 16 ? 65535 : 255;
  let clear = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const at = i * bpp + alphaOffset;
    const alpha = sampleBytes === 2 ? pixels.readUInt16BE(at) : pixels[at];
    if (alpha < max) clear++;
  }
  return clear / total;
}

export function readJpegSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("Not a JPEG file");
  }
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    // The SOF markers carry the dimensions. SOF4/8/12 are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  throw new Error("JPEG has no frame header");
}

export function validateLogo(buf) {
  const errors = [];
  if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, errors: ["No logo file was uploaded"] };
  if (!isPng(buf)) {
    // Name what they actually uploaded. An SVG is the common one and is a reasonable
    // thing to have reached for, so it earns its own sentence rather than a flat refusal.
    const head = buf.subarray(0, 512).toString("latin1");
    const looksSvg = /<svg[\s>]/i.test(head) || head.trimStart().startsWith("<?xml");
    const looksJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const detail = looksSvg
      ? "That looks like an SVG. Export it to PNG at roughly 600px wide, keeping the transparent background."
      : looksJpeg
        ? "That looks like a JPEG, which cannot hold transparency."
        : "Export it as a PNG with a transparent background.";
    return { ok: false, errors: [`The logo must be a PNG. ${detail}`] };
  }
  if (buf.length > LIMITS.logoBytes) {
    errors.push(`The logo is ${Math.round(buf.length / 1000)}KB; keep it under ${LIMITS.logoBytes / 1000}KB.`);
  }
  const head = readPngHeader(buf);
  if (head.width < LIMITS.logoMinWidth) {
    errors.push(`The logo is ${head.width}px wide; it needs at least ${LIMITS.logoMinWidth}px to stay sharp.`);
  }
  const ratio = transparentPixelRatio(buf);
  if (ratio === 0) {
    errors.push("The logo has no transparency, so it will show as a solid block on the page. Export it as a PNG with a transparent background.");
  } else if (ratio !== null && ratio < 0.02) {
    errors.push("Almost none of the logo is transparent, which usually means it was flattened onto a background. Export it with a transparent background.");
  }
  return {
    ok: errors.length === 0,
    errors,
    meta: { width: head.width, height: head.height, transparentRatio: ratio, bytes: buf.length },
  };
}

export function validateScreenshot(buf, { sourceUrl } = {}) {
  const errors = [];
  if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, errors: ["No screenshot was uploaded"] };

  let size, format;
  if (isPng(buf)) { format = "png"; size = readPngHeader(buf); }
  else if (buf[0] === 0xff && buf[1] === 0xd8) { format = "jpeg"; size = readJpegSize(buf); }
  else return { ok: false, errors: ["The screenshot must be a PNG or JPEG."] };

  if (buf.length > LIMITS.screenshotBytes) {
    errors.push(`The screenshot is ${Math.round(buf.length / 1000)}KB; keep it under ${LIMITS.screenshotBytes / 1000}KB.`);
  }
  if (size.width < LIMITS.screenshotMinWidth) {
    errors.push(`The screenshot is ${size.width}px wide; it needs at least ${LIMITS.screenshotMinWidth}px or it will look soft on the page.`);
  }
  // The point of the screenshot is to show one of the account's real workflows, so the
  // page can say which page it is. Without the URL it is just an unlabelled picture.
  const url = String(sourceUrl || "").trim();
  if (!url) errors.push("Give the URL the screenshot was taken from.");
  else if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) errors.push(`"${url}" is not a URL.`);

  return { ok: errors.length === 0, errors, meta: { format, ...size, bytes: buf.length, sourceUrl: url } };
}

// The rep's own photo, shown beside their name in the hero and on the closing card. Any
// ordinary photo will do; it only has to be an image and big enough not to blur at the
// size it is drawn.
export function validateAePhoto(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, errors: ["No photo was uploaded"] };
  let size, format;
  if (isPng(buf)) { format = "png"; size = readPngHeader(buf); }
  else if (buf[0] === 0xff && buf[1] === 0xd8) { format = "jpeg"; size = readJpegSize(buf); }
  else return { ok: false, errors: ["The photo must be a PNG or JPEG."] };
  const errors = [];
  if (buf.length > 2_000_000) errors.push("Keep the photo under 2MB.");
  if (size.width < 96 || size.height < 96) errors.push("The photo needs to be at least 96px square.");
  return { ok: errors.length === 0, errors, meta: { format, ...size, bytes: buf.length } };
}
