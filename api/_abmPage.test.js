import { describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  APPROVERS,
  AbmPage,
  TransitionError,
  applyEdit,
  approve,
  assertCanDelete,
  isApprover,
  isLive,
  newSlug,
  publish,
  requestChanges,
  submitForApproval,
  toPublicPage,
  unpublish,
} from "./_abmPage.js";

const CONTENT = {
  heroOptions: ["Hero one", "Hero two", "Hero three"],
  issueExamples: ["Issue one", "Issue two"],
  whyNow: {
    headline: "Headline",
    thesis: "Thesis",
    initiatives: [
      { title: "A", description: "D", helps: ["H"] },
      { title: "B", description: "D", helps: ["H"] },
    ],
  },
  productFit: {
    headline: "Fit",
    features: [
      { label: "Galileo AI", headline: "H", description: "D", examples: [], mockup: null },
      { label: "Dashboards", headline: "H", description: "D", examples: [], mockup: null },
    ],
  },
};

const asset = (extra = {}) => ({ object: "pages/x/logo.png", width: 400, height: 120, bytes: 1000, ...extra });

const page = (over = {}) => AbmPage.parse({
  slug: "a1b2c3d4e5f60718",
  account: "IPSY",
  status: "draft",
  content: CONTENT,
  assets: { logo: asset(), screenshot: asset({ sourceUrl: "https://ipsy.com/checkout" }) },
  createdBy: "ae@logrocket.com",
  createdAt: 1,
  updatedBy: "ae@logrocket.com",
  updatedAt: 1,
  ...over,
});

const AE = { user: "ae@logrocket.com", now: 2 };
const BOSS = { user: "gregallen@logrocket.com", now: 3 };

describe("who can approve", () => {
  test("recognises the two approvers, whatever the casing", () => {
    assert.ok(isApprover("brooke@logrocket.com"));
    assert.ok(isApprover("GregAllen@LogRocket.com"));
  });

  test("rejects everyone else, including other LogRocket staff", () => {
    assert.equal(isApprover("ae@logrocket.com"), false);
    assert.equal(isApprover(""), false);
    assert.equal(isApprover(null), false);
  });

  test("one approver is enough, including on their own page", () => {
    // Deliberate: with two approvers, requiring the other one would mean every page
    // Brooke writes waits on Greg and vice versa.
    const mine = page({ createdBy: "brooke@logrocket.com" });
    const submitted = submitForApproval(mine, { user: "brooke@logrocket.com", now: 2 });
    const approved = approve(submitted, { user: "brooke@logrocket.com", now: 3 });
    assert.equal(approved.status, "approved");
    assert.equal(approved.approvedBy, "brooke@logrocket.com");
  });

  test("an AE cannot approve, and is told who can", () => {
    const p = submitForApproval(page(), AE);
    try {
      approve(p, AE);
      assert.fail("should not approve");
    } catch (e) {
      assert.ok(e instanceof TransitionError);
      assert.equal(e.status, 403);
      for (const who of APPROVERS) assert.match(e.message, new RegExp(who));
    }
  });
});

describe("a page part-way through", () => {
  // Both bugs reported from real use came from here: the schema described a finished
  // page but was applied to pages at every stage, so an edit before the second upload
  // was rejected and the hero radio quietly did nothing.
  test("validates with no attachments yet", () => {
    const p = page({ assets: null });
    assert.equal(p.assets, null);
  });

  test("validates with only the logo uploaded", () => {
    const p = page({ assets: { logo: asset() } });
    assert.ok(p.assets.logo);
  });

  test("the hero line can be changed before either file is uploaded", () => {
    const p = applyEdit(page({ assets: null }), { heroChoice: 2 }, AE);
    assert.equal(p.heroChoice, 2);
    assert.equal(AbmPage.parse(p).heroChoice, 2);
  });

  test("the hero line can be changed with only the logo uploaded", () => {
    const p = applyEdit(page({ assets: { logo: asset() } }), { heroChoice: 1 }, AE);
    assert.equal(AbmPage.parse(p).heroChoice, 1);
  });

  test("but nothing reaches a prospect without both images", () => {
    // The live snapshot stays strict, so the guarantee moves there rather than
    // disappearing.
    const half = page({ status: "approved", assets: { logo: asset() } });
    assert.throws(() => AbmPage.parse({
      ...half,
      live: {
        content: CONTENT, heroChoice: 0, assets: { logo: asset() },
        approvedBy: "x", approvedAt: 1, publishedBy: "x", publishedAt: 1,
      },
    }), (e) => e.name === "ZodError");
  });
});

describe("the route to being live", () => {
  test("draft, submit, approve, publish", () => {
    let p = page();
    p = submitForApproval(p, AE);
    assert.equal(p.status, "pending");
    p = approve(p, BOSS);
    assert.equal(p.status, "approved");
    assert.equal(p.approvedBy, "gregallen@logrocket.com");
    p = publish(p, BOSS);
    assert.equal(p.status, "published");
    assert.equal(p.live.publishedBy, "gregallen@logrocket.com");
  });

  test("a draft cannot skip approval and go straight live", () => {
    assert.throws(() => publish(page(), BOSS), /Only an approved page can be published/);
  });

  test("a submitted page cannot publish itself", () => {
    const p = submitForApproval(page(), AE);
    assert.throws(() => publish(p, BOSS), /this one is pending/);
  });

  test("approving something nobody submitted is refused", () => {
    assert.throws(() => approve(page(), BOSS), /must be submitted before it can be approved/);
  });
});

describe("sending a page back", () => {
  test("returns it to draft with the reason attached", () => {
    const p = requestChanges(submitForApproval(page(), AE), { ...BOSS, note: "Hero three overclaims" });
    assert.equal(p.status, "draft");
    assert.equal(p.reviewNote, "Hero three overclaims");
  });

  test("requires a reason, so the rep is not left guessing", () => {
    const p = submitForApproval(page(), AE);
    assert.throws(() => requestChanges(p, { ...BOSS, note: "  " }), /Say what needs changing/);
  });

  test("an AE cannot send back their own page", () => {
    const p = submitForApproval(page(), AE);
    assert.throws(() => requestChanges(p, { ...AE, note: "x" }), /can review a page/);
  });
});

describe("editing costs the approval", () => {
  test("changing the content of an approved page sends it back for approval", () => {
    let p = approve(submitForApproval(page(), AE), BOSS);
    const edited = { ...CONTENT, heroOptions: ["Changed", "Hero two", "Hero three"] };
    p = applyEdit(p, { content: edited }, AE);
    assert.equal(p.status, "pending");
    assert.equal(p.approvedBy, null);
  });

  test("switching which hero line is used also costs it", () => {
    let p = approve(submitForApproval(page(), AE), BOSS);
    p = applyEdit(p, { heroChoice: 2 }, AE);
    assert.equal(p.status, "pending");
  });

  test("swapping the logo costs it too", () => {
    let p = approve(submitForApproval(page(), AE), BOSS);
    p = applyEdit(p, { assets: { ...p.assets, logo: asset({ object: "pages/x/logo2.png" }) } }, AE);
    assert.equal(p.status, "pending");
  });

  test("filing it against a different opportunity does not, since the reader never sees it", () => {
    let p = approve(submitForApproval(page(), AE), BOSS);
    p = applyEdit(p, { opportunityId: "006VN0001" }, AE);
    assert.equal(p.status, "approved");
    assert.equal(p.approvedBy, "gregallen@logrocket.com");
  });

  test("editing a published page leaves the live version exactly as it was", () => {
    let p = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    const liveBefore = structuredClone(p.live);
    p = applyEdit(p, { content: { ...CONTENT, issueExamples: ["Rewritten", "Second"] } }, AE);
    // Back in the queue, but the prospect still sees the approved page.
    assert.equal(p.status, "pending");
    assert.deepEqual(p.live, liveBefore);
    assert.equal(toPublicPage({ ...p, status: "published" }).issueExamples[0], "Issue one");
  });

  test("an edit that changes nothing leaves the status alone", () => {
    let p = approve(submitForApproval(page(), AE), BOSS);
    p = applyEdit(p, { content: structuredClone(CONTENT) }, AE);
    assert.equal(p.status, "approved");
  });
});

describe("taking a page down", () => {
  test("unpublishing keeps the approval, so it can go back up without a second review", () => {
    let p = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    p = unpublish(p, BOSS);
    assert.equal(p.status, "approved");
    assert.equal(p.live, null);
    assert.equal(p.approvedBy, "gregallen@logrocket.com");
    assert.equal(publish(p, BOSS).status, "published");
  });

  test("a page edited while live can still be taken down", () => {
    // The one most likely to need the kill switch: someone spotted a problem and edited
    // it, which sends it back to pending while the approved version keeps serving. Keying
    // the switch off the status would make it unreachable exactly here.
    let p = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    p = applyEdit(p, { heroChoice: 2 }, AE);
    assert.equal(p.status, "pending");
    assert.ok(isLive(p), "still being served");
    p = unpublish(p, BOSS);
    assert.equal(isLive(p), false);
    assert.equal(p.status, "pending", "stays in review, since the edit still needs approval");
  });

  test("the public side goes by what is being served, not the review status", () => {
    let p = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    p = applyEdit(p, { heroChoice: 2 }, AE);
    const pub = toPublicPage(p);
    assert.ok(pub, "a page still in the bucket must not read as absent");
    assert.equal(pub.hero, "Hero one", "serves the approved snapshot, not the edit");
    assert.equal(toPublicPage(unpublish(p, BOSS)), null);
  });

  test("a page that was never live cannot be taken down", () => {
    assert.throws(() => unpublish(page(), BOSS), /not live/);
  });
});

describe("what the public service is given", () => {
  test("nothing at all until the page is live", () => {
    assert.equal(toPublicPage(page()), null);
    assert.equal(toPublicPage(approve(submitForApproval(page(), AE), BOSS)), null);
  });

  test("the chosen hero line, not all three", () => {
    const p = publish(approve(submitForApproval(page({ heroChoice: 2 }), AE), BOSS), BOSS);
    const pub = toPublicPage(p);
    assert.equal(pub.hero, "Hero three");
    assert.equal(pub.heroOptions, undefined);
  });

  test("no internal fields cross over", () => {
    const p = publish(approve(submitForApproval(
      page({ opportunityId: "006VN0001", draftMarkdown: "raw rog output" }), AE), BOSS), BOSS);
    const pub = toPublicPage(p);
    const serialised = JSON.stringify(pub);
    for (const leak of ["opportunityId", "006VN0001", "draftMarkdown", "raw rog output",
      "createdBy", "ae@logrocket.com", "gregallen@logrocket.com", "reviewNote"]) {
      assert.ok(!serialised.includes(leak), `${leak} must not reach the public page`);
    }
  });
});

describe("slugs", () => {
  test("are long enough that the URL is the access control", () => {
    const slug = newSlug(crypto.randomBytes);
    assert.match(slug, /^[a-f0-9]{16}$/);
  });

  test("do not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newSlug(crypto.randomBytes)));
    assert.equal(seen.size, 200);
  });

  test("a guessable slug is refused by the schema", () => {
    assert.throws(() => page({ slug: "ipsy" }), /unguessable/);
  });
});

describe("deleting a page", () => {
  test("the rep who made a draft can delete it", () => {
    assert.doesNotThrow(() => assertCanDelete(page(), AE));
  });

  test("an approver can delete someone else's draft", () => {
    assert.doesNotThrow(() => assertCanDelete(page(), BOSS));
  });

  test("another rep cannot", () => {
    assert.throws(() => assertCanDelete(page(), { user: "other@logrocket.com" }), /Only the person who created/);
  });

  test("a live page has to be unpublished first, even by an approver", () => {
    const live = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    assert.throws(() => assertCanDelete(live, BOSS), /Unpublish it before deleting/);
    assert.doesNotThrow(() => assertCanDelete(unpublish(live, BOSS), BOSS));
  });

  test("so does a live page that has since been edited back to pending", () => {
    const live = publish(approve(submitForApproval(page(), AE), BOSS), BOSS);
    const edited = applyEdit(live, { heroChoice: 2 }, AE);
    assert.equal(edited.status, "pending");
    assert.throws(() => assertCanDelete(edited, AE), /Unpublish it before deleting/);
  });
});
