// HTTP for ABM landing pages: generate, edit, submit, review, publish, take down.
//
// The lifecycle rules live in _abmPage.js and the storage behind a narrow interface in
// _abmStore.js, so this file is only plumbing: identify the user, find the page, call a
// transition, save what comes back.

import crypto from "node:crypto";
import express from "express";
import { z } from "zod";

import { generateAbmContent } from "./_abmSkill.js";
import { validateAePhoto, validateLogo, validateScreenshot } from "./_abmAssets.js";
import { renderAbmPage } from "./_abmRender.js";
import { createMemoryStore, newId } from "./_abmStore.js";
import { iapUserEmail } from "./_iapUser.js";
import {
  AbmPage, APPROVERS, applyEdit, approve, isApprover, newSlug,
  publish, requestChanges, submitForApproval, toPublicPage, unpublish,
} from "./_abmPage.js";

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const CreateInput = z.object({
  account: z.string().min(1, "An account name is required"),
  opportunityId: z.string().optional(),
  persona: z.string().optional(),
  initiativeFocus: z.string().optional(),
  industry: z.string().optional(),
});

const ASSET_KINDS = ["logo", "screenshot", "aePhoto"];

export function createAbmRouter({
  store = createMemoryStore(),
  fallbackUser = null,
  rogToken = process.env.ROG_TOKEN || process.env.VITE_ROG_TOKEN,
  anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY,
  generate = generateAbmContent,
} = {}) {
  const router = express.Router();
  router.use(express.json({ limit: "1mb" }));

  function requireUser(req) {
    const email = iapUserEmail(req) || fallbackUser;
    if (!email) throw new HttpError(401, "Missing IAP identity");
    return email;
  }

  async function load(id) {
    const page = await store.get(id);
    if (!page) throw new HttpError(404, "No such page");
    return page;
  }

  const save = async (id, page) => store.put(id, AbmPage.parse(page));

  // Everything a rep needs to see, minus the raw Rog draft, which is long and only
  // interesting when checking the page against what the skill actually said.
  const summary = (page) => {
    const copy = { ...page };
    delete copy.draftMarkdown;
    return copy;
  };

  router.get("/", async (_req, res) => {
    res.json({ pages: (await store.list()).map(summary), approvers: APPROVERS });
  });

  router.get("/:id", async (req, res) => {
    res.json(await load(req.params.id));
  });

  // Runs the skill. Slow by nature: Rog takes about a minute and the structuring pass
  // another fifteen seconds, so the client is expected to wait rather than poll.
  router.post("/", async (req, res) => {
    const user = requireUser(req);
    const input = CreateInput.parse(req.body);
    if (!rogToken) throw new HttpError(503, "No Rog token is configured");
    if (!anthropicKey) throw new HttpError(503, "No Anthropic key is configured");

    const { draft, content } = await generate(input, { rogToken, anthropicKey });
    const id = newId();
    const now = Date.now();
    const page = {
      slug: newSlug(crypto.randomBytes),
      account: input.account,
      opportunityId: input.opportunityId,
      persona: input.persona,
      initiativeFocus: input.initiativeFocus,
      industry: input.industry,
      status: "draft",
      content,
      heroChoice: 0,
      draftMarkdown: draft,
      // Filled by the upload endpoints; a page cannot be submitted without them.
      assets: null,
      createdBy: user, createdAt: now, updatedBy: user, updatedAt: now,
    };
    await store.put(id, page);
    res.status(201).json({ ...page, id });
  });

  // Raw bytes rather than multipart, so there is no new dependency and no base64 round
  // trip for an image that can run to several megabytes.
  router.post("/:id/assets/:kind",
    express.raw({ type: ["image/*", "application/octet-stream"], limit: "6mb" }),
    async (req, res) => {
      const user = requireUser(req);
      const page = await load(req.params.id);
      const kind = req.params.kind;
      if (!ASSET_KINDS.includes(kind)) throw new HttpError(400, "Unknown asset");

      const buf = req.body;
      const result = kind === "logo" ? validateLogo(buf)
        : kind === "aePhoto" ? validateAePhoto(buf)
        : validateScreenshot(buf, { sourceUrl: req.query.sourceUrl });
      if (!result.ok) return res.status(400).json({ errors: result.errors });

      const object = await store.putAsset(req.params.id, kind, buf, req.get("content-type") || "image/png");
      const ref = {
        object, width: result.meta.width, height: result.meta.height, bytes: result.meta.bytes,
        ...(result.meta.sourceUrl ? { sourceUrl: result.meta.sourceUrl } : {}),
      };
      const assets = { ...(page.assets || {}), [kind]: ref };
      // Replacing an image is a change the reader sees, so it goes through applyEdit and
      // costs the approval like any other edit.
      const next = page.assets
        ? applyEdit(page, { assets }, { user, now: Date.now() })
        : { ...page, assets, updatedBy: user, updatedAt: Date.now() };
      await store.put(req.params.id, next);
      res.json({ asset: ref, status: next.status });
    });

  // Lets a rep clear an image rather than only overwrite it, so a wrong file can be taken
  // off a page instead of lingering until something else replaces it.
  router.delete("/:id/assets/:kind", async (req, res) => {
    const user = requireUser(req);
    const page = await load(req.params.id);
    const kind = req.params.kind;
    if (!ASSET_KINDS.includes(kind)) throw new HttpError(400, "Unknown asset");
    await store.putAsset(req.params.id, kind, null, null);
    const assets = { ...(page.assets || {}), [kind]: null };
    const next = applyEdit(page, { assets }, { user, now: Date.now() });
    res.json(await save(req.params.id, next));
  });

  router.get("/:id/assets/:kind", async (req, res) => {
    const asset = await store.getAsset(req.params.id, req.params.kind);
    if (!asset) throw new HttpError(404, "No such image");
    res.type(asset.contentType).send(asset.bytes);
  });

  const EditInput = z.object({
    content: z.any().optional(),
    heroChoice: z.number().int().min(0).max(2).optional(),
    account: z.string().min(1).optional(),
    opportunityId: z.string().optional(),
    persona: z.string().optional(),
    initiativeFocus: z.string().optional(),
    industry: z.string().optional(),
  });

  router.patch("/:id", async (req, res) => {
    const user = requireUser(req);
    const page = await load(req.params.id);
    const patch = EditInput.parse(req.body);
    res.json(await save(req.params.id, applyEdit(page, patch, { user, now: Date.now() })));
  });

  const transition = (fn, extra = () => ({})) => async (req, res) => {
    const user = requireUser(req);
    const page = await load(req.params.id);
    if (fn === submitForApproval && !page.assets?.logo) {
      throw new HttpError(400, "Upload the account's logo before submitting");
    }
    if (fn === submitForApproval && !page.assets?.screenshot) {
      throw new HttpError(400, "Upload a screenshot before submitting");
    }
    const next = fn(page, { user, now: Date.now(), ...extra(req) });
    res.json(await save(req.params.id, next));
  };

  router.post("/:id/submit", transition(submitForApproval));
  router.post("/:id/approve", transition(approve));
  router.post("/:id/request-changes", transition(requestChanges, req => ({ note: req.body?.note })));
  router.post("/:id/publish", transition(publish));
  router.post("/:id/unpublish", transition(unpublish));

  router.get("/:id/can-approve", async (req, res) => {
    res.json({ canApprove: isApprover(requireUser(req)) });
  });

  // The rendered page, exactly as it will be written to the bucket. Serving it from here
  // too is what lets the whole flow be driven locally without the public service.
  router.get("/:id/preview", async (req, res) => {
    const page = await load(req.params.id);
    const pub = toPublicPage(page) || toPublicPage({ ...page, status: "published", live: {
      content: page.content, heroChoice: page.heroChoice, assets: page.assets, industry: page.industry,
      approvedBy: "", approvedAt: 0, publishedBy: "", publishedAt: 0,
    } });
    if (!pub) throw new HttpError(409, "Nothing to preview yet");
    // Only pass an image that exists. Spreading a missing one produced an object with no
    // bytes, which is truthy, so the renderer tried to encode undefined.
    const shot = await store.getAsset(req.params.id, "screenshot");
    res.type("html").send(renderAbmPage(pub, {
      logo: await store.getAsset(req.params.id, "logo"),
      screenshot: shot ? { ...shot, sourceUrl: page.assets?.screenshot?.sourceUrl } : null,
      preparedBy: page.createdBy,
      aePhoto: await store.getAsset(req.params.id, "aePhoto"),
      industry: pub.industry ?? page.industry,
    }));
  });

  router.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || "Invalid input", issues: err.issues });
    }
    console.error("abm api error", err);
    res.status(500).json({ error: err?.message || "Internal error" });
  });

  return router;
}
