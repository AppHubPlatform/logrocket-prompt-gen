// The production store's logic against small stand-ins for Firestore and the bucket.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createBucketPublisher, createCloudStore, pageObject } from "./_abmStore.js";

// Enforces the Firestore rule the first production test hit: no array directly inside
// an array, at any depth.
function assertFirestoreShape(v, inArray = false) {
  if (Array.isArray(v)) {
    if (inArray) throw new Error("3 INVALID_ARGUMENT: invalid nested entity");
    v.forEach(x => assertFirestoreShape(x, true));
  } else if (v && typeof v === "object" && !Buffer.isBuffer(v)) {
    Object.values(v).forEach(x => assertFirestoreShape(x, false));
  }
}

function fakeFirestore() {
  const docs = new Map();
  const snap = (id) => ({ id, exists: docs.has(id), data: () => structuredClone(docs.get(id)) });
  const query = (filter = () => true) => ({
    orderBy: () => query(filter), limit: () => query(filter),
    where: (k, _op, v) => query(d => filter(d) && d[k] === v),
    get: async () => {
      const hits = [...docs.keys()].filter(id => filter(docs.get(id))).map(snap);
      return { docs: hits, empty: hits.length === 0 };
    },
  });
  return { collection: () => ({
    ...query(),
    doc: (id) => ({ get: async () => snap(id), set: async (d) => { assertFirestoreShape(d); docs.set(id, structuredClone(d)); }, delete: async () => docs.delete(id) }),
  }) };
}

function fakeBucket() {
  const files = new Map();
  const nf = () => Object.assign(new Error("nf"), { code: 404 });
  return {
    files,
    file: (name) => ({
      name,
      save: async (bytes, opts) => files.set(name, { bytes: Buffer.from(bytes), contentType: opts.contentType }),
      delete: async ({ ignoreNotFound } = {}) => { if (!files.delete(name) && !ignoreNotFound) throw nf(); },
      download: async () => { if (!files.has(name)) throw nf(); return [files.get(name).bytes]; },
      getMetadata: async () => { if (!files.has(name)) throw nf(); return [{ contentType: files.get(name).contentType }]; },
    }),
    deleteFiles: async ({ prefix }) => { for (const k of [...files.keys()]) if (k.startsWith(prefix)) files.delete(k); },
  };
}

describe("the cloud store", () => {
  test("pages round-trip and are found by slug", async () => {
    const store = createCloudStore({ firestore: fakeFirestore(), bucket: fakeBucket() });
    await store.put("p1", { id: "p1", slug: "abc", account: "Acme", updatedAt: 1 });
    assert.equal((await store.get("p1")).account, "Acme");
    assert.equal((await store.getBySlug("abc")).id, "p1");
    assert.equal(await store.getBySlug("nope"), null);
    assert.equal(await store.get("missing"), null);
  });

  test("images live under drafts/, can be cleared, and go with the page", async () => {
    const bucket = fakeBucket();
    const store = createCloudStore({ firestore: fakeFirestore(), bucket });
    assert.equal(await store.putAsset("p1", "logo", Buffer.from("png"), "image/png"), "drafts/p1/logo");
    assert.equal((await store.getAsset("p1", "logo")).contentType, "image/png");
    await store.putAsset("p1", "logo", null, null);
    assert.equal(await store.getAsset("p1", "logo"), null);
    await store.putAsset("p1", "screenshot", Buffer.from("x"), "image/png");
    await store.put("p1", { slug: "abc", updatedAt: 1 });
    await store.remove("p1");
    assert.equal(bucket.files.size, 0);
    assert.equal(await store.get("p1"), null);
  });

  test("the publisher writes and removes pages/<slug>.html", async () => {
    const bucket = fakeBucket();
    const pub = createBucketPublisher(bucket);
    await pub.put("abc", "<html>");
    assert.equal(bucket.files.get(pageObject("abc")).contentType, "text/html; charset=utf-8");
    await pub.remove("abc");
    await pub.remove("abc");   // already gone is fine
    assert.equal(bucket.files.size, 0);
  });
});

describe("pages with data tables", () => {
  test("survive the round trip despite Firestore's nested-array rule", async () => {
    const store = createCloudStore({ firestore: fakeFirestore(), bucket: fakeBucket() });
    const content = { productFit: { features: [{ label: "Feedback", mockup: {
      columns: ["Theme", "Mentions"], rows: [["Can't transfer", "312"], ["Timeouts", "147"]] } }] } };
    const page = { slug: "abc", updatedAt: 1, content, live: { content, heroChoice: 0 } };
    await store.put("p1", page);
    const got = await store.get("p1");
    assert.deepEqual(got.content, content);
    assert.deepEqual(got.live.content, content);
    assert.equal((await store.getBySlug("abc")).content.productFit.features[0].mockup.rows[1][0], "Timeouts");
    assert.deepEqual((await store.list())[0].live.content, content);
  });

  test("a page with nothing live keeps live as null", async () => {
    const store = createCloudStore({ firestore: fakeFirestore(), bucket: fakeBucket() });
    await store.put("p1", { slug: "abc", updatedAt: 1, content: {}, live: null });
    assert.equal((await store.get("p1")).live, null);
  });
});
