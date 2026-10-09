// The lifecycle of an ABM landing page, kept separate from storage and HTTP so the rules
// can be read and tested on their own.
//
// A rep drafts a page, submits it, Brooke or Greg approves it, and only then can it go
// live at a URL a prospect opens. Any edit after approval sends it back for approval,
// because a page that can change after sign-off makes the sign-off meaningless.
//
// What is live is a snapshot, not the working copy. Editing a published page does not
// alter what the prospect sees: the bucket keeps serving the last approved version until
// someone republishes or takes it down. Without that split, fixing a typo would either
// silently change a customer-facing page or force it offline, and neither is what anyone
// means by "let me fix a typo".

import { z } from "zod";
import { AbmContent } from "./_abmSkill.js";

export const SCHEMA_VERSION = 1;

// Approval is deliberately a short, named list rather than a role, because there are two
// people and getting it wrong means an unreviewed page reaches a customer.
export const APPROVERS = ["brooke@logrocket.com", "gregallen@logrocket.com"];

export const STATUSES = ["draft", "pending", "approved", "published"];

export const AssetRef = z.object({
  object: z.string().min(1),          // path in the bucket
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  sourceUrl: z.string().optional(),   // screenshots carry the page they came from
  // Pixels at the top that are the browser rather than the site. The original is kept
  // and cropped at render time, so the crop can be undone.
  cropTop: z.number().int().min(0).optional(),
});

export const AbmPage = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  slug: z.string().regex(/^[a-z0-9]{16,}$/, "Slug must be long and unguessable"),
  account: z.string().min(1),
  opportunityId: z.string().optional(),
  persona: z.string().optional(),
  initiativeFocus: z.string().optional(),
  // Chooses the industry section and its two case studies.
  industry: z.string().optional(),
  status: z.enum(STATUSES),
  content: AbmContent,
  heroChoice: z.number().int().min(0).max(2).default(0),
  // Both are required before a page can be submitted, which `submit` enforces, but a
  // page in progress legitimately has one or neither. Demanding both here meant every
  // edit before the second upload failed validation, so changing the hero line silently
  // did nothing until both files were in.
  assets: z.object({
    logo: AssetRef.nullish(),
    screenshot: AssetRef.nullish(),
    aePhoto: AssetRef.nullish(),
  }).nullish(),
  draftMarkdown: z.string().optional(),
  // Which run of the skill made this page. version is null until the app's Rog token is
  // allowed to read skills; generatedAt still pins it to the skill's save history.
  skill: z.object({
    name: z.string(),
    generatedAt: z.number(),
    version: z.number().int().nullable(),
    savedAt: z.string().nullable(),
    savedBy: z.string().nullable(),
  }).optional(),
  // The snapshot currently served from the bucket. Null whenever nothing is live.
  live: z.object({
    content: AbmContent,
    heroChoice: z.number().int().min(0).max(2),
    // Strict, unlike the working copy: nothing is served without both images.
    assets: z.object({ logo: AssetRef, screenshot: AssetRef, aePhoto: AssetRef.nullish() }),
    industry: z.string().optional(),
    approvedBy: z.string(),
    approvedAt: z.number(),
    publishedBy: z.string(),
    publishedAt: z.number(),
  }).nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.number().nullable().default(null),
  createdBy: z.string().min(1),
  createdAt: z.number(),
  updatedBy: z.string().min(1),
  updatedAt: z.number(),
});

export class TransitionError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export function isApprover(email) {
  return APPROVERS.includes(String(email || "").trim().toLowerCase());
}

// 16 hex characters. Long enough that the URL is the access control, since these pages
// are served to anyone holding the link.
export function newSlug(randomBytes) {
  return Buffer.from(randomBytes(8)).toString("hex");
}

const touch = (page, user, now) => ({ ...page, updatedBy: user, updatedAt: now });

export function submitForApproval(page, { user, now }) {
  if (page.status === "pending") throw new TransitionError("This page is already waiting for approval");
  return touch({ ...page, status: "pending" }, user, now);
}

export function approve(page, { user, now }) {
  if (!isApprover(user)) {
    throw new TransitionError(`Only ${APPROVERS.join(" or ")} can approve a page`, 403);
  }
  if (page.status !== "pending") {
    throw new TransitionError(`A page must be submitted before it can be approved; this one is ${page.status}`);
  }
  return touch({ ...page, status: "approved", approvedBy: user, approvedAt: now }, user, now);
}

// Sends an approved page back to the rep with a reason, rather than silently leaving it
// pending with no sign of why nothing happened.
export function requestChanges(page, { user, now, note }) {
  if (!isApprover(user)) {
    throw new TransitionError(`Only ${APPROVERS.join(" or ")} can review a page`, 403);
  }
  if (page.status !== "pending") throw new TransitionError("Only a submitted page can be sent back");
  if (!String(note || "").trim()) throw new TransitionError("Say what needs changing", 400);
  return touch({ ...page, status: "draft", reviewNote: String(note).trim() }, user, now);
}

export function publish(page, { user, now }) {
  if (page.status !== "approved") {
    throw new TransitionError(`Only an approved page can be published; this one is ${page.status}`);
  }
  const live = {
    content: page.content,
    heroChoice: page.heroChoice,
    assets: page.assets,
    industry: page.industry,
    approvedBy: page.approvedBy,
    approvedAt: page.approvedAt,
    publishedBy: user,
    publishedAt: now,
  };
  return touch({ ...page, status: "published", live }, user, now);
}

// Whether a prospect can still open this page. Not the same question as where it sits in
// review: editing a live page sends it back to pending while the approved version keeps
// serving, so a page can be live and pending at once.
export function isLive(page) {
  return page.live != null;
}

// Takes the page down. Keyed off the snapshot rather than the status, because the page
// that most needs taking down is the one someone has just edited, and that one is no
// longer "published" even though it is still being served. Keeping the approval means a
// page pulled and restored needs no second review; an edited one is already back at
// pending and will.
export function unpublish(page, { user, now }) {
  if (!isLive(page)) throw new TransitionError("This page is not live");
  const status = page.status === "published" ? "approved" : page.status;
  return touch({ ...page, status, live: null }, user, now);
}

// Any edit to what the reader would see costs the approval. Everything else, like which
// opportunity it is filed against, does not.
const APPROVAL_RELEVANT = ["content", "heroChoice", "assets", "account", "industry"];

export function applyEdit(page, patch, { user, now }) {
  const next = { ...page, ...patch };
  const changed = APPROVAL_RELEVANT.some(
    key => JSON.stringify(next[key]) !== JSON.stringify(page[key]),
  );
  if (!changed) return touch(next, user, now);

  // The live snapshot is left exactly as it is. The prospect keeps seeing the approved
  // page until someone approves and publishes the new one, or takes it down.
  const status = page.status === "draft" ? "draft" : "pending";
  return touch({ ...next, status, approvedBy: null, approvedAt: null }, user, now);
}

// A rep can throw away a page they started and do not want to finish. Deleting cannot be
// undone, so two limits. A page that is live has to be unpublished first: deleting it in
// one step would break a link a prospect may already have, with no warning. And only the
// person who made it, or an approver, can delete it.
export function assertCanDelete(page, { user }) {
  if (isLive(page)) {
    throw new TransitionError("This page is live. Unpublish it before deleting it.");
  }
  const mine = String(page.createdBy || "").toLowerCase() === String(user || "").toLowerCase();
  if (!mine && !isApprover(user)) {
    throw new TransitionError("Only the person who created this page, Brooke or Greg can delete it", 403);
  }
}

// What the public service needs, and nothing more. Internal fields never cross over:
// who drafted it, which opportunity it came from, and the review note are all absent.
export function toPublicPage(page) {
  // Driven by the snapshot alone. Asking for the status here would hide a page that is
  // genuinely still being served, which is the opposite of what the public side needs
  // to know.
  if (!page.live) return null;
  const { content, heroChoice, assets, industry } = page.live;
  return {
    slug: page.slug,
    account: page.account,
    industry,
    hero: content.heroOptions[heroChoice] ?? content.heroOptions[0],
    issueExamples: content.issueExamples,
    whyNow: content.whyNow,
    productFit: content.productFit,
    assets,
  };
}
