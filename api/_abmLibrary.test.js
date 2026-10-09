import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { aeNameFor, aePhotoFor, industryShot, productShotFor, quoteLogoFor } from "./_abmLibrary.js";

const PRODUCT = "api/abm-assets/product";
const which = (a) => a
  ? fs.readdirSync(PRODUCT).find(f => fs.readFileSync(`${PRODUCT}/${f}`).equals(a.bytes))?.replace(".webp", ".png")
  : null;

describe("rep headshots", () => {
  test("a firstlast@ address finds the first-last photo", () => {
    assert.ok(aePhotoFor("gregallen@logrocket.com"));
    assert.ok(aePhotoFor("jacksonbartlett@logrocket.com"));
  });
  test("a dotted address finds it too", () => {
    assert.ok(aePhotoFor("nick.acevedo@logrocket.com"));
  });
  test("someone without a photo gets none, so the page shows initials", () => {
    assert.equal(aePhotoFor("brooke@logrocket.com"), null);
    assert.equal(aePhotoFor(""), null);
  });
});

describe("rep names", () => {
  // The address has no word boundary, so the name has to come from the photo's filename.
  test("taken from the headshot, which is where the space is", () => {
    assert.equal(aeNameFor("gregallen@logrocket.com"), "Greg Allen");
  });
  test("split from a dotted address when there is no photo", () => {
    assert.equal(aeNameFor("jane.doe@logrocket.com"), "Jane Doe");
  });
  test("left to the caller when neither helps", () => {
    assert.equal(aeNameFor("brooke@logrocket.com"), null);
  });
});

describe("industry and quote images", () => {
  test("every industry with copy has a screenshot", () => {
    for (const k of ["healthcare", "financial", "retail", "saas"]) assert.ok(industryShot(k), k);
  });
  test("no industry, no image", () => {
    assert.equal(industryShot(null), null);
  });
  test("Speedway Motors has a real logo now", () => {
    assert.ok(quoteLogoFor("Speedway Motors"));
  });
});

describe("product screenshots", () => {
  test("specific capabilities beat the general words around them", () => {
    assert.equal(which(productShotFor("Surveys & Feedback Analytics")), "feedback.png");
    assert.equal(which(productShotFor("Galileo AI: Heatmaps")), "heatmaps.png");
    assert.equal(which(productShotFor("Root Cause for Engineering")), "issues.png");
  });

  test("the label decides before the headline does", () => {
    // Its headline mentions an alert in passing; it is about context.
    const shot = productShotFor("Frontend to backend context", "Go from a backend alert to what the customer saw");
    assert.equal(which(shot), "issues.png");
  });

  test("a page never shows the same screenshot twice", () => {
    const used = new Set();
    const a = which(productShotFor("Issue detection and alerts", "", used));
    const b = which(productShotFor("More alerts", "", used));
    assert.equal(a, "alerts.png");
    assert.notEqual(b, "alerts.png");
  });

  test("a row that matches nothing gets nothing", () => {
    assert.equal(productShotFor("Session Replay"), null);
  });
});

describe("industry sections for education, hospitality and enterprise", async () => {
  const { INDUSTRIES, industryKey } = await import("./_abmChrome.js");
  const { industryShot } = await import("./_abmLibrary.js");

  test("the app's picker options reach the right section", () => {
    assert.equal(industryKey("Education"), "edtech");
    assert.equal(industryKey("Travel & Hospitality"), "hospitality");
    assert.equal(industryKey("Enterprise"), "digital-enterprises");
    assert.equal(industryKey("Fintech"), "financial");
    assert.equal(industryKey("E-commerce"), "retail");
    assert.equal(industryKey("SaaS / Software"), "saas");
  });

  test("ordinary words in the skill's copy do not misfile a page", () => {
    assert.equal(industryKey("Of course, machine learning helps the bank's enrollment flow"), "financial");
    assert.equal(industryKey("We deliver a better booking-free checkout"), "retail");
  });

  test("each has copy, its image, and two real case studies", () => {
    for (const k of ["edtech", "hospitality", "digital-enterprises"]) {
      assert.equal(INDUSTRIES[k].bullets.length, 3);
      assert.equal(INDUSTRIES[k].studies.length, 2);
      for (const c of INDUSTRIES[k].studies) assert.match(c.url, /^https:\/\/logrocket\.com\/customers\//);
      assert.ok(industryShot(k), k);
    }
  });
});
