// Where ABM pages and their uploaded images live.
//
// One interface, two implementations. Local development uses the in-memory one so the
// flow can be driven without installing the Cloud SDK; production uses Firestore for the
// documents and the bucket from infra/abm.tf for the images. Keeping the interface narrow
// is what makes that swap uneventful: five methods, no queries, no transactions.

import crypto from "node:crypto";
import fs from "node:fs";

// `file` makes the store survive a restart. Dev uses it, because the Vite server restarts
// whenever its config changes and losing a page mid-test is its own kind of bug. Images
// are held as base64 so the whole store is one JSON file; that is only reasonable at the
// handful of pages a laptop will ever hold, and production uses Firestore and the bucket.
export function createMemoryStore({ file = null } = {}) {
  const pages = new Map();
  const assets = new Map();   // `${pageId}/${kind}` -> { bytes, contentType }

  if (file && fs.existsSync(file)) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [id, page] of Object.entries(saved.pages || {})) pages.set(id, page);
      for (const [key, a] of Object.entries(saved.assets || {})) {
        assets.set(key, { bytes: Buffer.from(a.bytes, "base64"), contentType: a.contentType });
      }
    } catch { /* a corrupt file starts empty rather than refusing to boot */ }
  }

  const flush = () => {
    if (!file) return;
    try {
      fs.writeFileSync(file, JSON.stringify({
        pages: Object.fromEntries(pages),
        assets: Object.fromEntries([...assets].map(([k, a]) =>
          [k, { bytes: a.bytes.toString("base64"), contentType: a.contentType }])),
      }));
    } catch { /* losing the cache is survivable; failing the request is not */ }
  };

  return {
    kind: file ? "file" : "memory",

    async list() {
      return [...pages.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async get(id) {
      return pages.get(id) || null;
    },

    async getBySlug(slug) {
      return [...pages.values()].find(p => p.slug === slug) || null;
    },

    async put(id, page) {
      pages.set(id, { ...page, id });
      flush();
      return pages.get(id);
    },

    async remove(id) {
      pages.delete(id);
      for (const key of [...assets.keys()]) {
        if (key.startsWith(`${id}/`)) assets.delete(key);
      }
      flush();
    },

    async putAsset(pageId, kind, bytes, contentType) {
      const object = `pages/${pageId}/${kind}`;
      // Null bytes clears it, which is how an image is removed rather than replaced.
      if (bytes == null) assets.delete(`${pageId}/${kind}`);
      else assets.set(`${pageId}/${kind}`, { bytes, contentType });
      flush();
      return object;
    },

    async getAsset(pageId, kind) {
      return assets.get(`${pageId}/${kind}`) || null;
    },
  };
}

export const newId = () => crypto.randomBytes(12).toString("hex");
