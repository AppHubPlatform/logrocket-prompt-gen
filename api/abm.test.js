// The ABM router end to end over HTTP, with the skill stubbed out so it runs in
// milliseconds and never calls Rog.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";

import { createAbmRouter } from "./abm.js";
import { createMemoryStore } from "./_abmStore.js";

const CONTENT = {
  heroOptions: ["One", "Two", "Three"],
  issueExamples: ["Issue one", "Issue two"],
  whyNow: { headline: "H", thesis: "T", initiatives: [
    { title: "A", description: "D", helps: ["H"] }, { title: "B", description: "D", helps: ["H"] }] },
  productFit: { headline: "F", features: [
    { label: "Galileo AI", headline: "H", description: "D", examples: [], mockup: null },
    { label: "Dashboards", headline: "H", description: "D", examples: [], mockup: null }] },
};

let server, base, store, user = "ae@logrocket.com";

before(async () => {
  store = createMemoryStore();
  const app = express();
  // The test sets who is calling, the way IAP would in production.
  app.use((req, _res, next) => { req.headers["x-goog-authenticated-user-email"] = `accounts.google.com:${user}`; next(); });
  app.use("/api/abm", createAbmRouter({
    store, rogToken: "t", anthropicKey: "k",
    generate: async () => ({ draft: "draft", content: structuredClone(CONTENT) }),
  }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/abm`;
});
after(() => server.close());

const call = (method, path = "", body, type = "application/json") => fetch(base + path, {
  method, headers: body ? { "Content-Type": type } : {},
  body: body == null ? undefined : (type === "application/json" ? JSON.stringify(body) : body),
});
const create = async (account = "Acme") => (await call("POST", "", { account })).json();

describe("deleting a page over HTTP", () => {
  test("the rep who made it can delete it, images and all", async () => {
    user = "ae@logrocket.com";
    const p = await create();
    await call("POST", `/${p.id}/assets/logo`, fs.readFileSync("public/brand-logos/arhaus.png"), "image/png");
    assert.ok(await store.getAsset(p.id, "logo"));
    const r = await call("DELETE", `/${p.id}`);
    assert.equal(r.status, 204);
    assert.equal(await store.get(p.id), null);
    assert.equal(await store.getAsset(p.id, "logo"), null, "uploaded images go with it");
  });

  test("another rep cannot", async () => {
    user = "ae@logrocket.com";
    const p = await create();
    user = "someone.else@logrocket.com";
    assert.equal((await call("DELETE", `/${p.id}`)).status, 403);
    assert.ok(await store.get(p.id));
  });

  test("an approver can", async () => {
    user = "ae@logrocket.com";
    const p = await create();
    user = "gregallen@logrocket.com";
    assert.equal((await call("DELETE", `/${p.id}`)).status, 204);
  });

  test("a live page is refused until it is unpublished", async () => {
    user = "ae@logrocket.com";
    const p = await create();
    await call("POST", `/${p.id}/assets/logo`, fs.readFileSync("public/brand-logos/arhaus.png"), "image/png");
    // A wide plain PNG stands in for the screenshot.
    await call("POST", `/${p.id}/assets/screenshot?sourceUrl=https://acme.test/checkout`,
      fs.readFileSync("public/brand-logos/arhaus.png"), "image/png");
    await call("POST", `/${p.id}/submit`);
    user = "brooke@logrocket.com";
    await call("POST", `/${p.id}/approve`);
    await call("POST", `/${p.id}/publish`);

    const refused = await call("DELETE", `/${p.id}`);
    assert.equal(refused.status, 409);
    assert.match((await refused.json()).error, /Unpublish it before deleting/);

    await call("POST", `/${p.id}/unpublish`);
    assert.equal((await call("DELETE", `/${p.id}`)).status, 204);
  });

  test("deleting something already gone says so", async () => {
    assert.equal((await call("DELETE", "/nope")).status, 404);
  });
});
