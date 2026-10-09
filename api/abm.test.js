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

describe("editing on the page", () => {
  const withImages = async () => {
    user = "ae@logrocket.com";
    const p = await create();
    const png = fs.readFileSync("public/brand-logos/arhaus.png");
    await call("POST", `/${p.id}/assets/logo`, png, "image/png");
    await call("POST", `/${p.id}/assets/screenshot?sourceUrl=https://acme.test/checkout`, png, "image/png");
    return p;
  };

  test("the edit preview tags the copy with where it is stored", async () => {
    const p = await withImages();
    const html = await (await call("GET", `/${p.id}/preview?edit=1`)).text();
    for (const path of ["heroOptions.0", "whyNow.thesis", "issueExamples.1", "whyNow.initiatives.1.helps.0",
      "productFit.headline", "productFit.features.0.headline"]) {
      assert.ok(html.includes(`data-edit="${path}"`), path);
    }
    assert.ok(html.includes('id="abm-ed"'));
  });

  test("the ordinary preview carries no editor", async () => {
    const p = await withImages();
    const html = await (await call("GET", `/${p.id}/preview`)).text();
    assert.ok(!html.includes("data-edit"));
    assert.ok(!html.includes("abm-ed"));
  });

  test("a saved reposition is stored and rendered", async () => {
    const p = await withImages();
    const r = await call("PATCH", `/${p.id}`, { screenshotFocusY: 40 });
    assert.equal((await r.json()).assets.screenshot.focusY, 40);
    const html = await (await call("GET", `/${p.id}/preview`)).text();
    assert.ok(html.includes("object-position:50% 40%"));
  });

  test("editing an approved page costs the approval", async () => {
    const p = await withImages();
    await call("POST", `/${p.id}/submit`);
    user = "brooke@logrocket.com";
    await call("POST", `/${p.id}/approve`);
    user = "ae@logrocket.com";
    const content = structuredClone(CONTENT);
    content.whyNow.thesis = "A better thesis";
    const page = await (await call("PATCH", `/${p.id}`, { content, screenshotFocusY: 10 })).json();
    assert.equal(page.status, "pending");
    assert.equal(page.approvedBy, null);
    assert.equal(page.content.whyNow.thesis, "A better thesis");
  });
});

describe("the public address", () => {
  test("serves the live snapshot by slug, and nothing before publish or after unpublish", async () => {
    user = "ae@logrocket.com";
    const p = await create();
    const png = fs.readFileSync("public/brand-logos/arhaus.png");
    await call("POST", `/${p.id}/assets/logo`, png, "image/png");
    await call("POST", `/${p.id}/assets/screenshot?sourceUrl=https://acme.test/checkout`, png, "image/png");
    await call("POST", `/${p.id}/submit`);
    user = "brooke@logrocket.com";
    await call("POST", `/${p.id}/approve`);
    assert.equal((await call("GET", `/live/${p.slug}`)).status, 404, "approved is not yet live");
    await call("POST", `/${p.id}/publish`);
    const r = await call("GET", `/live/${p.slug}`);
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes("One"));
    await call("POST", `/${p.id}/unpublish`);
    assert.equal((await call("GET", `/live/${p.slug}`)).status, 404);
  });
});

describe("the Slack alert to approvers", async () => {
  const { approvalMessage, notifyApprovers } = await import("./_abmNotify.js");

  test("mentions Brooke and Greg and links to the page", () => {
    const m = approvalMessage({ id: "p1", account: "Acme <Bank>", createdBy: "ae@logrocket.com" }, { appUrl: "https://app" });
    assert.ok(m.text.includes("<@UKG6CR7JT>") && m.text.includes("<@USASPR86A>"));
    assert.ok(m.text.includes("Acme &lt;Bank&gt;"), "account names cannot inject Slack markup");
    assert.ok(JSON.stringify(m).includes("https://app/api/abm/p1/preview"));
    assert.ok(JSON.stringify(m).includes("https://app/?page=abm&id=p1"));
  });

  test("does nothing without a webhook, and never throws", async () => {
    assert.equal(await notifyApprovers({ id: "x" }, { webhookUrl: "" }), false);
    const boom = async () => { throw new Error("down"); };
    assert.equal(await notifyApprovers({ id: "x" }, { webhookUrl: "https://hook", fetchImpl: boom }), false);
  });

  test("fires once on submit, and again when an approved page is edited", async () => {
    const sent = [];
    const s = createMemoryStore();
    const app = express();
    app.use((req, _res, next) => { req.headers["x-goog-authenticated-user-email"] = `accounts.google.com:${user}`; next(); });
    app.use("/a", createAbmRouter({ store: s, rogToken: "t", anthropicKey: "k", slackWebhookUrl: "https://hook",
      notify: (page, opts) => sent.push({ id: page.id, resubmitted: opts.resubmitted }),
      generate: async () => ({ draft: "d", content: structuredClone(CONTENT) }) }));
    const srv = await new Promise(r => { const x = app.listen(0, () => r(x)); });
    const b = `http://127.0.0.1:${srv.address().port}/a`;
    const j = (m, p, body) => fetch(b + p, { method: m, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    try {
      user = "ae@logrocket.com";
      const p = await (await j("POST", "", { account: "Acme" })).json();
      const png = fs.readFileSync("public/brand-logos/arhaus.png");
      for (const k of ["logo", "screenshot"]) {
        await fetch(`${b}/${p.id}/assets/${k}?sourceUrl=https://acme.test`, { method: "POST", headers: { "Content-Type": "image/png" }, body: png });
      }
      assert.equal(sent.length, 0, "drafting and uploading are quiet");
      await j("POST", `/${p.id}/submit`);
      assert.deepEqual(sent, [{ id: p.id, resubmitted: false }]);
      await j("PATCH", `/${p.id}`, { heroChoice: 1 });
      assert.equal(sent.length, 1, "editing while already pending does not alert again");
      user = "brooke@logrocket.com";
      await j("POST", `/${p.id}/approve`);
      user = "ae@logrocket.com";
      await j("PATCH", `/${p.id}`, { heroChoice: 2 });
      assert.deepEqual(sent[1], { id: p.id, resubmitted: true });
    } finally { srv.close(); }
  });
});
