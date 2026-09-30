import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { createAccountsRouter, createFirestore } from "./accounts.js";

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "demo-mission-control";
const DATABASE = process.env.FIRESTORE_DATABASE_ID || "mission-control";

const acme = {
  name: "Acme",
  rep: "Greg Allen",
  arr: 250000,
  domain: "acme.com",
  contacts: [{ id: "c1", name: "Ada Lovelace", title: "CTO", phone: "+1 415 555 0101", bucketId: "b1" }],
  buckets: [{ id: "b1", label: "Execs", x: 0, y: 0, w: 400, h: 300, color: "#14161a" }],
  connections: [],
};

describe("accounts API (Firestore emulator)", { skip: !EMULATOR && "FIRESTORE_EMULATOR_HOST not set" }, () => {
  let db, servers = [], urls = {};

  function listen(options) {
    const app = express();
    app.use(express.json());
    app.use("/api/accounts", createAccountsRouter({ db, ...options }));
    return new Promise((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        servers.push(server);
        resolve(`http://127.0.0.1:${server.address().port}/api/accounts`);
      });
    });
  }

  function call(base, method, path = "", { body, user = "greg@logrocket.com" } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (user) headers["x-goog-authenticated-user-email"] = `accounts.google.com:${user}`;
    return fetch(base + path, { method, headers, body: body && JSON.stringify(body) }).then(async (res) => ({
      status: res.status,
      body: res.status === 204 ? null : await res.json(),
    }));
  }

  before(async () => {
    process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
    db = createFirestore();
    urls.prod = await listen({});
    urls.phones = await listen({ storePhone: true });
  });

  beforeEach(async () => {
    const res = await fetch(`http://${EMULATOR}/emulator/v1/projects/${PROJECT}/databases/${DATABASE}/documents`, { method: "DELETE" });
    assert.equal(res.status, 200);
  });

  after(async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    await db.terminate();
  });

  test("create sets identity, version and server timestamps", async () => {
    const res = await call(urls.prod, "POST", "", { body: acme });
    assert.equal(res.status, 201);
    assert.equal(res.body.id, "acme.com");
    assert.equal(res.body.version, 1);
    assert.equal(res.body.schemaVersion, 1);
    assert.equal(res.body.createdBy, "greg@logrocket.com");
    assert.equal(typeof res.body.createdAt, "number");
    assert.equal(res.body.contacts[0].phone, undefined, "phone stripped by default");
  });

  test("storePhone keeps phone numbers", async () => {
    const res = await call(urls.phones, "POST", "", { body: acme });
    assert.equal(res.body.contacts[0].phone, "+1 415 555 0101");
  });

  test("duplicate create returns 409 with the existing id", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    const res = await call(urls.prod, "POST", "", { body: { ...acme, name: "Acme Corp" } });
    assert.equal(res.status, 409);
    assert.equal(res.body.id, "acme.com");
  });

  test("name-only create finds an account created with a domain", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    const res = await call(urls.prod, "POST", "", { body: { ...acme, domain: undefined, name: " ACME " } });
    assert.equal(res.status, 409);
    assert.equal(res.body.id, "acme.com");
  });

  test("concurrent creates of the same name: exactly one wins", async () => {
    const results = await Promise.all(
      ["acme.com", "acme.io", "acme.dev", "acme.net"].map((domain) =>
        call(urls.prod, "POST", "", { body: { ...acme, domain } }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409]);
    assert.equal((await call(urls.prod, "GET")).body.accounts.length, 1);
  });

  test("writes without IAP identity are rejected", async () => {
    const res = await call(urls.prod, "POST", "", { body: acme, user: null });
    assert.equal(res.status, 401);
  });

  test("invalid body returns 400 and writes nothing", async () => {
    const res = await call(urls.prod, "POST", "", { body: { ...acme, arr: "lots" } });
    assert.equal(res.status, 400);
    assert.equal((await call(urls.prod, "GET")).body.accounts.length, 0);
  });

  test("update with current version bumps it; stale version gets 409", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    const ok = await call(urls.prod, "PUT", "/acme.com", { body: { ...acme, arr: 300000, version: 1 }, user: "jordan@logrocket.com" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.version, 2);
    assert.equal(ok.body.arr, 300000);
    assert.equal(ok.body.updatedBy, "jordan@logrocket.com");
    assert.equal(ok.body.createdBy, "greg@logrocket.com");

    const stale = await call(urls.prod, "PUT", "/acme.com", { body: { ...acme, arr: 1, version: 1 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.current.updatedBy, "jordan@logrocket.com");
    assert.equal(stale.body.current.arr, 300000);
  });

  test("concurrent saves from the same version: exactly one wins", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    const results = await Promise.all(
      ["a", "b", "c", "d"].map((u) =>
        call(urls.prod, "PUT", "/acme.com", { body: { ...acme, rep: u, version: 1 }, user: `${u}@logrocket.com` }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409]);
    const stored = await call(urls.prod, "GET", "/acme.com");
    assert.equal(stored.body.version, 2);
    assert.equal(stored.body.rep, results.find((r) => r.status === 200).body.rep);
  });

  test("update requires a version", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    const res = await call(urls.prod, "PUT", "/acme.com", { body: acme });
    assert.equal(res.status, 400);
  });

  test("update of a missing account is 404", async () => {
    const res = await call(urls.prod, "PUT", "/nope.com", { body: { ...acme, version: 1 } });
    assert.equal(res.status, 404);
  });

  test("refuses to overwrite docs from a newer schema version", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    await db.collection("accounts").doc("acme.com").update({ schemaVersion: 99 });
    const res = await call(urls.prod, "PUT", "/acme.com", { body: { ...acme, version: 1 } });
    assert.equal(res.status, 409);
  });

  test("list returns summaries without arrows, plus config", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    await call(urls.prod, "POST", "", { body: { ...acme, domain: undefined, name: "Globex" } });
    const res = await call(urls.prod, "GET");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.config, { storePhone: false });
    assert.deepEqual(res.body.accounts.map((a) => a.id).sort(), ["acme.com", "name-globex"]);
    const a = res.body.accounts.find((x) => x.id === "acme.com");
    assert.equal(a.buckets[0].label, "Execs", "the list's action item reads zones");
    assert.equal(a.connections, undefined);
    assert.equal(a.contacts[0].title, "CTO");
  });

  test("delete removes the account", async () => {
    await call(urls.prod, "POST", "", { body: acme });
    assert.equal((await call(urls.prod, "DELETE", "/acme.com")).status, 204);
    assert.equal((await call(urls.prod, "GET", "/acme.com")).status, 404);
  });

  test("reserved ids are rejected", async () => {
    assert.equal((await call(urls.prod, "GET", "/__x__")).status, 400);
  });
});
