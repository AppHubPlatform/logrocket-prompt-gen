import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  AbmContent,
  askRog,
  buildSkillRequest,
  fillPlaceholders,
  generateAbmContent,
  structureAbmContent,
} from "./_abmSkill.js";

// A real answer from the skill, trimmed. Kept verbatim so the tests fail if the
// structuring contract drifts away from what Rog actually returns.
const DRAFT = `**HERO STATEMENT**

1. Every member journey on the new ipsy platform, fully visible.
2. Find what breaks subscriptions before members post about it.
3. From days of hunting to the root cause in minutes.

---

**ISSUE EXAMPLES**

- New visitors leave between the landing page and subscription checkout, and nobody can see why.
- Conversion drops on the new site, and the team learns about it from Reddit and help center tickets.

---

**WHY NOW**

**Headline:** The new ipsy platform is where every growth bet succeeds or fails.

**Thesis:** ipsy is moving members to a rebuilt platform while it grows subscriptions.

**Platform Relaunch**
ipsy is moving traffic from the legacy platform to a rebuilt site.
- How LogRocket helps: Instruments the new site from the first day of traffic.

**Subscription Growth**
The subscription journey is the path that matters most to the business.
- How LogRocket helps: Builds the funnel from data already captured.

---

**PRODUCT FIT**

**Headline:** Built around the questions your teams already ask

**Galileo AI**
Ask in plain language across every captured session.
- Illustrative prompt: "Where are mobile 'nevers' dropping out?"

**Dashboards**
Shared views of the subscription funnel.

| Step | Mobile | Desktop |
|---|---|---|
| Landing page | [sessions] | [sessions] |`;

const VALID = {
  heroOptions: ["One", "Two", "Three"],
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
    headline: "Headline",
    features: [
      { label: "Galileo AI", headline: "H", description: "D", examples: [], mockup: null },
      { label: "Dashboards", headline: "H", description: "D", examples: [], mockup: null },
    ],
  },
};

const anthropicReply = (obj) => ({
  ok: true,
  json: async () => ({
    content: [{ type: "tool_use", name: "emit_page_content", input: obj }],
    stop_reason: "tool_use",
  }),
});

describe("buildSkillRequest", () => {
  test("keeps a multi-word account name intact on one line", () => {
    const q = buildSkillRequest({ account: "Blue Cross Blue Shield of Massachusetts" });
    assert.match(q, /^account_name: Blue Cross Blue Shield of Massachusetts$/m);
  });

  test("includes only the optional values that were given", () => {
    const q = buildSkillRequest({ account: "IPSY", persona: "VP of Product" });
    assert.match(q, /^target_persona: VP of Product$/m);
    assert.doesNotMatch(q, /opportunity_id/);
    assert.doesNotMatch(q, /initiative_focus/);
  });

  test("refuses an empty account", () => {
    assert.throws(() => buildSkillRequest({ account: "   " }), /account name is required/);
  });
});

describe("askRog", () => {
  test("returns an inline answer", async () => {
    const answer = await askRog("q", {
      token: "t",
      fetchImpl: async () => ({ ok: true, json: async () => ({ answer: "hello" }) }),
    });
    assert.equal(answer, "hello");
  });

  test("polls a job until the answer arrives", async () => {
    let call = 0;
    const answer = await askRog("q", {
      token: "t",
      pollMs: 1,
      fetchImpl: async () => {
        call += 1;
        if (call === 1) return { ok: true, json: async () => ({ job_id: "j1" }) };
        if (call === 2) return { ok: true, json: async () => ({ job_id: "j1" }) };
        return { ok: true, json: async () => ({ answer: "done" }) };
      },
    });
    assert.equal(answer, "done");
    assert.equal(call, 3);
  });

  test("gives a usable message when the token is rejected", async () => {
    await assert.rejects(
      askRog("q", { token: "t", fetchImpl: async () => ({ ok: false, status: 401 }) }),
      /rejected the token/,
    );
  });

  test("stops waiting rather than polling forever", async () => {
    await assert.rejects(
      askRog("q", {
        token: "t", pollMs: 1, maxWaitMs: 5,
        fetchImpl: async () => ({ ok: true, json: async () => ({ job_id: "j1" }) }),
      }),
      /did not finish in time/,
    );
  });

  test("refuses to run without a token", async () => {
    await assert.rejects(askRog("q", {}), /Missing Rog token/);
  });
});

describe("structureAbmContent", () => {
  test("sends the draft and returns validated content", async () => {
    let body;
    const out = await structureAbmContent(DRAFT, {
      apiKey: "k",
      fetchImpl: async (_u, opts) => { body = JSON.parse(opts.body); return anthropicReply(VALID); },
    });
    assert.equal(body.messages[0].content, DRAFT);
    assert.equal(out.whyNow.initiatives.length, 2);
  });

  test("keeps nested quotes intact, which broke the hand-written JSON path", async () => {
    const quoted = structuredClone(VALID);
    quoted.productFit.features[0].examples = [
      { label: "Illustrative prompt", text: "Where are mobile 'nevers' dropping out of \"checkout\"?" },
    ];
    const out = await structureAbmContent(DRAFT, {
      apiKey: "k", fetchImpl: async () => anthropicReply(quoted),
    });
    assert.equal(out.productFit.features[0].examples[0].text,
      "Where are mobile 'nevers' dropping out of \"checkout\"?");
  });

  test("says so when no tool call comes back", async () => {
    await assert.rejects(
      structureAbmContent(DRAFT, {
        apiKey: "k",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ content: [{ type: "text", text: "sorry" }], stop_reason: "end_turn" }),
        }),
      }),
      /did not return page content/,
    );
  });

  test("rejects content that is short a hero option, rather than publishing a gap", async () => {
    const short = { ...VALID, heroOptions: ["only", "two"] };
    await assert.rejects(
      structureAbmContent(DRAFT, { apiKey: "k", fetchImpl: async () => anthropicReply(short) }),
      (e) => e.name === "ZodError",
    );
  });

  test("rejects a single initiative, since the page needs at least two", async () => {
    const thin = { ...VALID, whyNow: { ...VALID.whyNow, initiatives: [VALID.whyNow.initiatives[0]] } };
    await assert.rejects(
      structureAbmContent(DRAFT, { apiKey: "k", fetchImpl: async () => anthropicReply(thin) }),
      (e) => e.name === "ZodError",
    );
  });

  test("says so when the structuring pass is cut off", async () => {
    await assert.rejects(
      structureAbmContent(DRAFT, {
        apiKey: "k",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ content: [], stop_reason: "max_tokens" }),
        }),
      }),
      /too long to structure/,
    );
  });


  test("defaults examples and mockup when a block omits them", () => {
    const parsed = AbmContent.parse({
      ...VALID,
      productFit: {
        headline: "H",
        features: [
          { label: "A", headline: "H", description: "D" },
          { label: "B", headline: "H", description: "D" },
        ],
      },
    });
    assert.deepEqual(parsed.productFit.features[0].examples, []);
    assert.equal(parsed.productFit.features[0].mockup, null);
  });
});

describe("generateAbmContent", () => {
  test("runs the skill then structures it, keeping the draft", async () => {
    const seen = [];
    const out = await generateAbmContent(
      { account: "Quantum Metric", persona: "VP of Product" },
      {
        rogToken: "t",
        anthropicKey: "k",
        fetchImpl: async (url, opts) => {
          seen.push(url);
          if (String(url).includes("rog.logrocket.com")) {
            const body = JSON.parse(opts.body);
            // The account name must survive as one value, spaces and all.
            assert.match(body.question, /^account_name: Quantum Metric$/m);
            return { ok: true, json: async () => ({ answer: DRAFT }) };
          }
          return anthropicReply(VALID);
        },
      },
    );
    assert.equal(out.draft, DRAFT);
    assert.equal(out.content.heroOptions.length, 3);
    assert.ok(seen[0].includes("rog.logrocket.com"));
    assert.ok(seen[1].includes("api.anthropic.com"));
  });
});

describe("fillPlaceholders", () => {
  const withBrackets = () => {
    const c = structuredClone(VALID);
    c.productFit.features[0].examples = [
      { label: "Illustrative alert", text: "[Journey name] — [number] customers hit an error on [step]" },
    ];
    return c;
  };
  const reply = (values) => async () => ({
    ok: true,
    json: async () => ({ content: [{ type: "tool_use", name: "emit_filled",
      input: { items: values.map((text, index) => ({ index, text })) } }] }),
  });

  test("fills placeholders and keeps the wording around them", async () => {
    const out = await fillPlaceholders(withBrackets(), DRAFT, {
      apiKey: "k",
      fetchImpl: reply(["Account opening — 412 customers hit an error on ID verification"]),
    });
    assert.equal(out.productFit.features[0].examples[0].text,
      "Account opening — 412 customers hit an error on ID verification");
  });

  test("throws away a fill that rewords the text outside the brackets", async () => {
    const out = await fillPlaceholders(withBrackets(), DRAFT, {
      apiKey: "k",
      fetchImpl: reply(["412 users had problems while opening an account"]),
    });
    assert.match(out.productFit.features[0].examples[0].text, /\[Journey name\]/);
  });

  test("throws away a fill that still has a bracket in it", async () => {
    const out = await fillPlaceholders(withBrackets(), DRAFT, {
      apiKey: "k",
      fetchImpl: reply(["Account opening — [number] customers hit an error on ID verification"]),
    });
    assert.match(out.productFit.features[0].examples[0].text, /\[Journey name\]/);
  });

  test("makes no call when there is nothing to fill", async () => {
    let called = false;
    await fillPlaceholders(structuredClone(VALID), DRAFT, { apiKey: "k", fetchImpl: async () => { called = true; } });
    assert.equal(called, false);
  });

  test("leaves the input untouched", async () => {
    const original = withBrackets();
    const before = JSON.stringify(original);
    await fillPlaceholders(original, DRAFT, { apiKey: "k", fetchImpl: reply(["Account opening — 412 customers hit an error on ID verification"]) });
    assert.equal(JSON.stringify(original), before);
  });
});

describe("fillPlaceholders with tables", () => {
  const withTable = () => {
    const c = structuredClone(VALID);
    c.productFit.features[1].mockup = {
      columns: ["Journey", "Sessions", "Drop-off"],
      rows: [["[Freemium enrollment]", "[volume]", "[rate]"]],
    };
    return c;
  };
  const tableReply = (table) => async () => ({ ok: true, json: async () => ({
    content: [{ type: "tool_use", name: "emit_filled", input: { items: [{ index: 0, table }] } }] }) });

  test("fills a whole table and keeps its headers", async () => {
    const out = await fillPlaceholders(withTable(), DRAFT, { apiKey: "k",
      fetchImpl: tableReply({ columns: ["Journey", "Sessions", "Drop-off"], rows: [["Freemium enrollment", "3,412", "38.7%"]] }) });
    assert.deepEqual(out.productFit.features[1].mockup.rows[0], ["Freemium enrollment", "3,412", "38.7%"]);
  });

  test("refuses a table that changes a header or its shape", async () => {
    const out = await fillPlaceholders(withTable(), DRAFT, { apiKey: "k", attempts: 1,
      fetchImpl: tableReply({ columns: ["Flow", "Sessions", "Drop-off"], rows: [["Freemium enrollment", "3,412", "38.7%"]] }) });
    assert.equal(out.productFit.features[1].mockup.rows[0][1], "[volume]");
  });

  test("retries what is still bracketed after the first pass", async () => {
    let calls = 0;
    const out = await fillPlaceholders(withTable(), DRAFT, { apiKey: "k", fetchImpl: async () => {
      calls += 1;
      const table = calls === 1
        ? { columns: ["Journey", "Sessions", "Drop-off"], rows: [["[Freemium enrollment]", "[volume]", "[rate]"]] }
        : { columns: ["Journey", "Sessions", "Drop-off"], rows: [["Freemium enrollment", "3,412", "38.7%"]] };
      return { ok: true, json: async () => ({ content: [{ type: "tool_use", name: "emit_filled", input: { items: [{ index: 0, table }] } }] }) };
    } });
    assert.equal(calls, 2);
    assert.equal(out.productFit.features[1].mockup.rows[0][2], "38.7%");
  });

  test("a failed call never fails the page", async () => {
    const out = await fillPlaceholders(withTable(), DRAFT, { apiKey: "k", fetchImpl: async () => ({ ok: false, status: 500 }) });
    assert.equal(out.productFit.features[1].mockup.rows[0][1], "[volume]");
  });
});
