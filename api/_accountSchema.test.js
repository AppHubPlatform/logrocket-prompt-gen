import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LIMITS,
  SCHEMA_VERSION,
  accountIdFor,
  isValidAccountId,
  migrate,
  parseAccount,
} from "./_accountSchema.js";

const base = {
  name: "Acme",
  rep: "Greg Allen",
  arr: 1000,
  contacts: [
    { id: "c1", name: "Ada", title: "CTO", phone: "+1 415 555 0101", bucketId: "b1", x: 10, y: 20 },
    { id: "c2", name: "Bo", bucketId: "gone" },
  ],
  buckets: [{ id: "b1", label: "Execs", x: 0, y: 0, w: 100, h: 100, color: "#14161a" }],
  connections: [{ from: "c1", to: "c2" }, { from: "c1", to: "ghost" }],
};

test("strips unknown fields and fills defaults", () => {
  const a = parseAccount({ ...base, evil: "<script>", contacts: [{ id: "c", name: "X", hack: 1 }] }, { storePhone: true });
  assert.equal(a.evil, undefined);
  assert.equal(a.contacts[0].hack, undefined);
  assert.deepEqual(
    { title: a.contacts[0].title, target: a.contacts[0].target, bucketId: a.contacts[0].bucketId },
    { title: "", target: false, bucketId: null },
  );
});

test("drops dangling bucket refs and connections", () => {
  const a = parseAccount(base, { storePhone: true });
  assert.equal(a.contacts[1].bucketId, null);
  assert.deepEqual(a.connections, [{ from: "c1", to: "c2" }]);
});

test("strips phone unless storePhone", () => {
  assert.equal(parseAccount(base, { storePhone: false }).contacts[0].phone, undefined);
  assert.equal(parseAccount(base, { storePhone: true }).contacts[0].phone, "+1 415 555 0101");
});

test("rejects bad values", () => {
  const bad = [
    { ...base, name: "  " },
    { ...base, arr: -1 },
    { ...base, buckets: [{ ...base.buckets[0], color: "red;background:url(x)" }] },
    { ...base, contacts: Array.from({ length: LIMITS.contacts + 1 }, (_, i) => ({ id: "c" + i, name: "N" })) },
    { ...base, contacts: [{ id: '"><img src=x onerror=alert(1)>', name: "X" }] },
    { ...base, sfAccountId: "not-an-id" },
    { ...base, domain: "no dots" },
  ];
  for (const body of bad) {
    assert.throws(() => parseAccount(body, { storePhone: true }));
  }
});

test("normalizes domains", () => {
  const a = parseAccount({ ...base, domain: "https://www.Acme.com/pricing?x=1" }, { storePhone: true });
  assert.equal(a.domain, "acme.com");
});

test("derives stable account ids", () => {
  assert.equal(accountIdFor({ sfAccountId: "001A000001abcDEF", domain: "acme.com", name: "Acme" }), "001A000001abcDEF");
  assert.equal(accountIdFor({ domain: "acme.com", name: "Acme" }), "acme.com");
  assert.equal(accountIdFor({ name: "Acme, Inc." }), "name-acme-inc");
  assert.equal(accountIdFor({ name: "!!!" }), "name-account");
});

test("validates document ids", () => {
  for (const id of ["acme.com", "name-acme", "001A000001abcDEF"]) assert.ok(isValidAccountId(id), id);
  for (const id of ["", ".", "..", "__x__", "a/b", "x".repeat(201)]) assert.ok(!isValidAccountId(id), id);
});

test("migrate leaves current-version docs alone and rejects unknown gaps", () => {
  const doc = { name: "Acme", schemaVersion: SCHEMA_VERSION };
  assert.deepEqual(migrate(doc), doc);
  if (SCHEMA_VERSION > 0) {
    assert.throws(() => migrate({ schemaVersion: -1 }), /No migration/);
  }
});
