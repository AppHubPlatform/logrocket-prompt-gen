import express from "express";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { z } from "zod";

import {
  SCHEMA_VERSION,
  accountIdFor,
  isValidAccountId,
  migrate,
  nameKey,
  parseAccount,
} from "./_accountSchema.js";
import { iapUserEmail } from "./_iapUser.js";

const COLLECTION = "accounts";
const ALREADY_EXISTS = 6;

const SUMMARY_FIELDS = [
  "name",
  "rep",
  "arr",
  "sfAccountId",
  "domain",
  "contacts",
  "buckets",
  "schemaVersion",
  "version",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
];

export function createFirestore() {
  return new Firestore({
    databaseId: process.env.FIRESTORE_DATABASE_ID || "mission-control",
    ignoreUndefinedProperties: true,
  });
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function millis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

function toClient(snap) {
  const data = migrate(snap.data());
  return {
    ...data,
    id: snap.id,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

// `db` is injectable so tests can point at the emulator. `fallbackUser` is only
// for local dev, where there is no IAP header; production must not set it.
export function createAccountsRouter({
  db = createFirestore(),
  storePhone = process.env.MISSION_CONTROL_STORE_PHONE === "true",
  fallbackUser = null,
} = {}) {
  const router = express.Router();
  const accounts = db.collection(COLLECTION);

  function requireUser(req) {
    const email = iapUserEmail(req) || fallbackUser;
    if (!email) throw new HttpError(401, "Missing IAP identity");
    return email;
  }

  function refFor(id) {
    if (!isValidAccountId(id)) throw new HttpError(400, "Invalid account id");
    return accounts.doc(id);
  }

  router.get("/", async (_req, res) => {
    const snap = await accounts.select(...SUMMARY_FIELDS).get();
    res.json({
      accounts: snap.docs.map(toClient),
      config: { storePhone },
    });
  });

  router.get("/:id", async (req, res) => {
    const snap = await refFor(req.params.id).get();
    if (!snap.exists) throw new HttpError(404, "Account not found");
    res.json(toClient(snap));
  });

  router.post("/", async (req, res) => {
    const user = requireUser(req);
    const account = parseAccount(req.body, { storePhone });
    const ref = refFor(accountIdFor(account));
    const key = nameKey(account.name);
    const exists = (id) =>
      new HttpError(409, "This account is already on the board", { id });
    try {
      await db.runTransaction(async (tx) => {
        const [snap, sameName] = await Promise.all([
          tx.get(ref),
          tx.get(accounts.where("nameKey", "==", key).limit(1)),
        ]);
        if (snap.exists) throw exists(ref.id);
        if (!sameName.empty) throw exists(sameName.docs[0].id);
        tx.create(ref, {
          ...account,
          nameKey: key,
          schemaVersion: SCHEMA_VERSION,
          version: 1,
          createdBy: user,
          createdAt: FieldValue.serverTimestamp(),
          updatedBy: user,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      if (err.code === ALREADY_EXISTS) throw exists(ref.id);
      throw err;
    }
    res.status(201).json(toClient(await ref.get()));
  });

  router.put("/:id", async (req, res) => {
    const user = requireUser(req);
    const ref = refFor(req.params.id);
    const version = z
      .number()
      .int()
      .positive()
      .safeParse(req.body && req.body.version);
    if (!version.success) throw new HttpError(400, "version is required");
    const account = parseAccount(req.body, { storePhone });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Account not found");
      const stored = snap.data();
      if ((stored.schemaVersion ?? 0) > SCHEMA_VERSION) {
        throw new HttpError(
          409,
          "This account was saved by a newer version of Mission Control. Reload the page.",
        );
      }
      if (stored.version !== version.data) {
        throw new HttpError(409, "Account was changed by someone else", {
          current: toClient(snap),
        });
      }
      tx.update(ref, {
        ...account,
        nameKey: nameKey(account.name),
        schemaVersion: SCHEMA_VERSION,
        version: stored.version + 1,
        updatedBy: user,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    res.json(toClient(await ref.get()));
  });

  router.delete("/:id", async (req, res) => {
    requireUser(req);
    await refFor(req.params.id).delete();
    res.status(204).end();
  });

  router.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid account", issues: err.issues });
    }
    console.error("accounts api error", err);
    res.status(500).json({ error: "Internal error" });
  });

  return router;
}
