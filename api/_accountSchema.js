import { z } from "zod";

// Bump when the stored shape changes, and add a MIGRATIONS step from the
// previous version. Documents are upgraded on read and rewritten on next save.
export const SCHEMA_VERSION = 1;

export const LIMITS = {
  contacts: 500,
  buckets: 100,
  connections: 2000,
};

const SF_ACCOUNT_ID = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const DOC_ID = /^(?!\.\.?$)(?!__.*__$)[A-Za-z0-9._-]{1,200}$/;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const text = (max) => z.string().trim().max(max).default("");
const coord = z.number().finite().min(-100000).max(100000);
const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

const contact = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  title: text(200),
  email: text(200),
  phone: text(40),
  target: z.boolean().default(false),
  placed: z.boolean().default(false),
  x: coord.default(0),
  y: coord.default(0),
  bucketId: id.nullable().default(null),
  sfContactId: z.string().regex(SF_ACCOUNT_ID).optional(),
  rog: z.boolean().optional(),
  rogEngaged: z.boolean().optional(),
  rogNote: z.string().trim().max(120).optional(),
});

const bucket = z.object({
  id,
  label: text(120),
  x: coord,
  y: coord,
  w: z.number().positive().max(20000),
  h: z.number().positive().max(20000),
  color,
});

const connection = z.object({
  from: id,
  to: id,
});

function normalizeDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

export const accountInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    rep: text(120),
    arr: z.number().int().nonnegative().max(1e12).default(0),
    sfAccountId: z.string().trim().regex(SF_ACCOUNT_ID).optional(),
    domain: z
      .string()
      .transform(normalizeDomain)
      .pipe(z.string().max(200).regex(DOMAIN))
      .optional(),
    contacts: z.array(contact).max(LIMITS.contacts).default([]),
    buckets: z.array(bucket).max(LIMITS.buckets).default([]),
    connections: z.array(connection).max(LIMITS.connections).default([]),
  })
  .transform((a) => {
    const bucketIds = new Set(a.buckets.map((b) => b.id));
    const contactIds = new Set(a.contacts.map((c) => c.id));
    return {
      ...a,
      contacts: a.contacts.map((c) =>
        c.bucketId && !bucketIds.has(c.bucketId) ? { ...c, bucketId: null } : c,
      ),
      connections: a.connections.filter(
        (c) => contactIds.has(c.from) && contactIds.has(c.to),
      ),
    };
  });

export function parseAccount(body, { storePhone }) {
  const account = accountInput.parse(body);
  if (!storePhone) {
    for (const c of account.contacts) delete c.phone;
  }
  return account;
}

export function isValidAccountId(value) {
  return typeof value === "string" && DOC_ID.test(value);
}

// Stored on every account so a name-only create can't duplicate an account
// that was created with a Salesforce ID or domain.
export function nameKey(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return slug || "account";
}

export function accountIdFor({ sfAccountId, domain, name }) {
  if (sfAccountId) return sfAccountId;
  if (domain) return domain;
  return "name-" + nameKey(name);
}

// Keyed by the version being upgraded from. Steps must tolerate partial
// documents, because the list endpoint reads a field projection.
const MIGRATIONS = {};

export function migrate(doc) {
  let out = { ...doc };
  let version = out.schemaVersion ?? SCHEMA_VERSION;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schemaVersion ${version}`);
    out = step(out);
    version += 1;
    out.schemaVersion = version;
  }
  return out;
}
