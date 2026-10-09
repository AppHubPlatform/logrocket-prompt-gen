// Runs Greg's `abm-landing-page` skill in Rog and turns its answer into typed content
// the landing-page template can render.
//
// Two steps, because the skill writes prose. It returns four markdown blocks whose exact
// shape moves between runs: the same account came back once under `## Hero Statement`
// and once under `**HERO STATEMENT**`, with initiative cards bolded in one and set as
// headings in the other. Parsing that with regexes would break quietly and produce a
// half-empty page, so a model pass converts the prose into the schema below and the
// schema is validated before anything is stored.

import { z } from "zod";

const ROG_URL = "https://rog.logrocket.com/api/v1/ask";
const STRUCTURE_MODEL = "claude-sonnet-4-6";

// Shaped from real runs of the skill. Every field is something the skill is specified to
// produce, and the counts are its own: three hero options, two to three issues, two to
// four initiative cards, two to four feature blocks.
export const AbmContent = z.object({
  heroOptions: z.array(z.string().min(1)).length(3),
  issueExamples: z.array(z.string().min(1)).min(2).max(3),
  whyNow: z.object({
    headline: z.string().min(1),
    thesis: z.string().min(1),
    initiatives: z.array(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      helps: z.array(z.string().min(1)).min(1).max(2),
    })).min(2).max(4),
  }),
  productFit: z.object({
    headline: z.string().min(1),
    features: z.array(z.object({
      label: z.string().min(1),
      headline: z.string().min(1),
      description: z.string().min(1),
      // The skill offers a choice per block: illustrative prompt/answer pairs, or a
      // small data mockup. Blocks use one or the other, so both are optional here.
      examples: z.array(z.object({
        label: z.string().min(1),
        text: z.string().min(1),
      })).default([]),
      mockup: z.object({
        columns: z.array(z.string().min(1)).min(2),
        rows: z.array(z.array(z.string())).min(1),
      }).nullable().default(null),
    })).min(2).max(4),
  }),
});

// The skill's arguments are split on whitespace by Rog's own invocation path, which
// breaks every multi-word value: "Quantum Metric" arrives as two arguments, and ABM is
// entirely about named accounts. So the values are stated as labelled prose instead,
// which the agent reads directly and which cannot be split apart.
export function buildSkillRequest({ account, opportunityId, persona, initiativeFocus }) {
  const name = String(account || "").trim();
  if (!name) throw new Error("An account name is required");
  const lines = [
    `Run the abm-landing-page skill.`,
    ``,
    `account_name: ${name}`,
  ];
  if (opportunityId) lines.push(`opportunity_id: ${String(opportunityId).trim()}`);
  if (persona) lines.push(`target_persona: ${String(persona).trim()}`);
  if (initiativeFocus) lines.push(`initiative_focus: ${String(initiativeFocus).trim()}`);
  lines.push(
    ``,
    `Treat each label above as one value, including any spaces in it.`,
    `Return only the four blocks the skill specifies, with no preamble or commentary.`,
  );
  return lines.join("\n");
}

// Rog answers most skill runs inline, taking a minute or so. Longer ones hand back a
// job id to poll instead, so both shapes are handled.
export async function askRog(question, { token, fetchImpl = fetch, pollMs = 5000, maxWaitMs = 300000 } = {}) {
  if (!token) throw new Error("Missing Rog token");
  const post = async (body) => {
    const res = await fetchImpl(ROG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = res.status === 401 ? "Rog rejected the token" : `Rog returned HTTP ${res.status}`;
      throw new Error(detail);
    }
    return res.json();
  };

  let data = await post({ question });
  const started = Date.now();
  while (!data.answer && data.job_id) {
    if (Date.now() - started > maxWaitMs) throw new Error("Rog did not finish in time");
    await new Promise(r => setTimeout(r, pollMs));
    data = await post({ job_id: data.job_id });
  }
  const answer = String(data.answer || "").trim();
  if (!answer) throw new Error("Rog returned an empty answer");
  return answer;
}

// The schema handed to the model as a tool. Asking for raw JSON in prose did not hold:
// the drafts quote the account's own words, so a feature block reads
// `"Where are mobile 'nevers' dropping out?"`, and the model's own escaping of those
// nested quotes broke the JSON intermittently. The same draft structured cleanly once
// and then failed on the next run. Going through a tool means the API builds the JSON
// and the quoting is no longer something a model has to get right in text.
const STRUCTURE_TOOL = {
  name: "emit_page_content",
  description: "Return the ABM landing page content extracted from the draft.",
  input_schema: {
    type: "object",
    required: ["heroOptions", "issueExamples", "whyNow", "productFit"],
    properties: {
      heroOptions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
      issueExamples: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
      whyNow: {
        type: "object",
        required: ["headline", "thesis", "initiatives"],
        properties: {
          headline: { type: "string" },
          thesis: { type: "string" },
          initiatives: {
            type: "array", minItems: 2, maxItems: 4,
            items: {
              type: "object",
              required: ["title", "description", "helps"],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                helps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
              },
            },
          },
        },
      },
      productFit: {
        type: "object",
        required: ["headline", "features"],
        properties: {
          headline: { type: "string" },
          features: {
            type: "array", minItems: 2, maxItems: 4,
            items: {
              type: "object",
              required: ["label", "headline", "description"],
              properties: {
                label: { type: "string" },
                headline: { type: "string" },
                description: { type: "string" },
                examples: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["label", "text"],
                    properties: { label: { type: "string" }, text: { type: "string" } },
                  },
                },
                mockup: {
                  type: "object",
                  required: ["columns", "rows"],
                  properties: {
                    columns: { type: "array", items: { type: "string" } },
                    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const STRUCTURE_PROMPT = `You convert an ABM landing page draft into JSON.

The draft has four blocks: a hero statement with three numbered options, two to three
issue examples, a "Why Now" block, and a "Product Fit" block. Headings and emphasis vary
between drafts, so read for meaning rather than matching a fixed layout.

Call the emit_page_content tool with what you extract. Do not reply with prose.

Rules:
- Copy the draft's wording exactly. Do not rewrite, shorten, summarise or improve it.
  This text is customer-facing and was written against an evidence standard; paraphrasing
  it would break that.
- Drop the eyebrow labels ("WHY NOW", "PRODUCT FIT") and any leading numbering or
  bullet characters. The template supplies those.
- A feature block carries either examples or a mockup. Use "examples" for illustrative
  prompts, answers, streams, alerts and themes, keeping the draft's own label for each.
  Use "mockup" when the draft gives a table. Set "mockup" to null and "examples" to []
  when a block has neither.
- Keep every item self-contained, as written.`;

export async function structureAbmContent(markdown, {
  apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY,
  fetchImpl = fetch,
  model = STRUCTURE_MODEL,
} = {}) {
  if (!apiKey) throw new Error("Missing Anthropic API key");
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: STRUCTURE_PROMPT,
      tools: [STRUCTURE_TOOL],
      tool_choice: { type: "tool", name: STRUCTURE_TOOL.name },
      messages: [{ role: "user", content: markdown }],
    }),
  });
  if (!res.ok) throw new Error(`Structuring call failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.stop_reason === "max_tokens") {
    throw new Error("The draft was too long to structure in one pass");
  }
  const call = (data.content || []).find(c => c.type === "tool_use" && c.name === STRUCTURE_TOOL.name);
  if (!call) throw new Error("Structuring did not return page content");
  // Validated rather than trusted: the tool schema constrains the shape, but a missing
  // initiative or a fourth hero option would still reach the page as a gap, and the page
  // is customer-facing.
  return AbmContent.parse(call.input);
}

// Where the reader would still see "[metric]" after the skill has run.
const BRACKET = /\[[^\]\n]{1,60}\]/;
const BRACKETS = /\[[^\]\n]{1,60}\]/g;

// Everything outside the brackets has to survive word for word, in order. It was written
// to the skill's evidence standard; only the placeholders are ours to fill.
function keepsWording(before, after) {
  if (typeof after !== "string" || BRACKET.test(after)) return false;
  let at = 0;
  for (const part of before.split(BRACKETS)) {
    const piece = part.trim();
    if (!piece) continue;
    const i = after.indexOf(piece, at);
    if (i < 0) return false;
    at = i + piece.length;
  }
  return true;
}

// Work items, each with enough around it to be filled sensibly. Tables go whole, with
// their headers: a lone "[volume]" cell has no row or column to say what it measures, and
// sent that way the model simply handed them back unchanged.
function collect(content) {
  const items = [];
  content.productFit.features.forEach((f, fi) => {
    (f.examples || []).forEach((e, ei) => {
      if (BRACKET.test(e.text)) items.push({ kind: "text", fi, ei, where: `${f.label}: ${e.label}`, value: e.text });
    });
    if (f.mockup && [...f.mockup.columns, ...f.mockup.rows.flat()].some(c => BRACKET.test(c))) {
      items.push({ kind: "table", fi, where: `${f.label}: ${f.headline}`, value: f.mockup });
    }
  });
  return items;
}

function apply(content, item, filled) {
  if (item.kind === "text") {
    if (keepsWording(item.value, filled)) {
      content.productFit.features[item.fi].examples[item.ei].text = filled;
      return true;
    }
    return false;
  }
  // A table must come back the same shape, with every cell that had no placeholder
  // unchanged, and with no placeholder left anywhere.
  const t = item.value;
  if (!filled || !Array.isArray(filled.columns) || !Array.isArray(filled.rows)) return false;
  if (filled.columns.length !== t.columns.length || filled.rows.length !== t.rows.length) return false;
  if (filled.rows.some((r, i) => !Array.isArray(r) || r.length !== t.rows[i].length)) return false;
  const pairs = [
    ...t.columns.map((c, i) => [c, filled.columns[i]]),
    ...t.rows.flatMap((r, i) => r.map((c, j) => [c, filled.rows[i][j]])),
  ];
  if (!pairs.every(([a, b]) => BRACKET.test(a) ? keepsWording(a, b) : a === b)) return false;
  content.productFit.features[item.fi].mockup = { columns: filled.columns.map(String), rows: filled.rows.map(r => r.map(String)) };
  return true;
}

const FILL_TOOL = {
  name: "emit_filled",
  description: "Return every item with its placeholders replaced by concrete values.",
  input_schema: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["index"],
          properties: {
            index: { type: "integer" },
            text: { type: "string" },
            table: {
              type: "object",
              properties: {
                columns: { type: "array", items: { type: "string" } },
                rows: { type: "array", items: { type: "array", items: { type: "string" } } },
              },
            },
          },
        },
      },
    },
  },
};

async function fillOnce(items, draft, { apiKey, fetchImpl, model }) {
  const payload = items.map((it, index) => ({ index, where: it.where, [it.kind]: it.value }));
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: `You fill placeholders in illustrative product examples on a landing page written for one company.

Each item is a sentence ("text") or a small table ("table"). Square brackets mark placeholders: [metric], [number], [step], [Journey name], [link to sessions] and so on. Replace EVERY bracketed placeholder with a specific value in this company's own terms, drawn from the draft below: their real products, pages, funnel steps, customer segments, apps and teams. Use realistic, specific illustrative numbers (412, 38.7%, iOS 4.2.1), never round guesses. Write a link placeholder as plain link text, such as "View sessions".

Your output must contain no square brackets at all. Keep every word outside the brackets exactly as written and in the same order. Tables keep the same columns and rows; only cells with placeholders change. Return one entry per item, with its index.

Draft:
${draft}`,
      tools: [FILL_TOOL],
      tool_choice: { type: "tool", name: FILL_TOOL.name },
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) throw new Error(`Fill pass failed: HTTP ${res.status}`);
  const data = await res.json();
  const call = (data.content || []).find(c => c.type === "tool_use" && c.name === FILL_TOOL.name);
  const byIndex = new Map((call?.input?.items || []).map(r => [r.index, r]));
  return items.map((it, i) => {
    const r = byIndex.get(i);
    return r ? (it.kind === "text" ? r.text : r.table) : undefined;
  });
}

// Fills any placeholders the skill left, using its own draft as the account context. A
// value that rewords the text outside its brackets, or still has a bracket in it, is
// discarded and the original kept: an unfilled example is better than a reworded one.
// Whatever is still bracketed after the first pass gets one retry.
export async function fillPlaceholders(content, draft, {
  apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY,
  fetchImpl = fetch,
  model = STRUCTURE_MODEL,
  attempts = 2,
} = {}) {
  const next = structuredClone(content);
  if (!apiKey) return next;
  for (let a = 0; a < attempts; a++) {
    const items = collect(next);
    if (!items.length) break;
    let filled;
    try {
      filled = await fillOnce(items, draft, { apiKey, fetchImpl, model });
    } catch {
      break;   // a failed fill leaves the placeholders; it must never fail the page
    }
    items.forEach((it, i) => apply(next, it, filled[i]));
  }
  return next;
}

export const hasPlaceholders = (content) => collect(content).length > 0;

export const SKILL_NAME = "abm-landing-page";

// Which version of the skill produced a page, so a page that comes out wrong can be traced
// to a skill edit. Rog serves skills at /api/skills/<name>, but the service token the app
// holds is refused there (401), and Rog's own agent cannot see versions either: asked
// three times, it reported that loading a skill returns only its name and instructions.
// So this tries, records the version when it is allowed to, and records null otherwise;
// a token granted that scope later starts filling it in with no code change. Never fails
// the generation either way.
export async function fetchSkillVersion({ token, fetchImpl = fetch } = {}) {
  if (!token) return null;
  try {
    const res = await fetchImpl(`https://rog.logrocket.com/api/skills/${SKILL_NAME}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const v = Number(d?.version);
    if (!Number.isInteger(v)) return null;
    return { version: v, savedAt: d.savedAt || null, savedBy: d.savedBy || null };
  } catch {
    return null;
  }
}

// The whole job: run the skill, structure the answer, hand back both. The draft is kept
// alongside the structured form so a page can be checked against what the skill actually
// said, and re-structured later without paying for another Rog run.
export async function generateAbmContent(input, deps = {}) {
  const question = buildSkillRequest(input);
  const generatedAt = Date.now();
  // In parallel with the run itself, so recording it costs nothing in time.
  const [draft, version] = await Promise.all([
    askRog(question, { token: deps.rogToken, fetchImpl: deps.fetchImpl }),
    fetchSkillVersion({ token: deps.rogToken, fetchImpl: deps.fetchImpl }),
  ]);
  // The page no longer shows the skill's illustrative examples, so their placeholders are
  // left as the skill wrote them rather than filled. fillPlaceholders stays available if
  // the examples come back.
  const content = await structureAbmContent(draft, {
    apiKey: deps.anthropicKey,
    fetchImpl: deps.fetchImpl,
  });
  return {
    draft,
    content,
    skill: { name: SKILL_NAME, generatedAt, version: version?.version ?? null,
      savedAt: version?.savedAt ?? null, savedBy: version?.savedBy ?? null },
  };
}
