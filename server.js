import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import anthropic from "./api/anthropic.js";
import rog from "./api/rog.js";
import me from "./api/me.js";
import integrations from "./api/integrations.js";
import { Storage } from "@google-cloud/storage";

import { createAccountsRouter, createFirestore } from "./api/accounts.js";
import { createAbmRouter } from "./api/abm.js";
import { createBucketPublisher, createCloudStore } from "./api/_abmStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/api/me", me);
app.get("/api/integrations", integrations);
app.post("/api/anthropic", anthropic);
app.post("/api/rog", rog);
app.use("/api/accounts", createAccountsRouter());

// ABM landing pages. Drafts live in Firestore and the bucket; publishing writes the
// finished page to the bucket, where explore serves it. Without ABM_BUCKET the routes are
// simply not mounted, so a deploy that runs ahead of the infrastructure still boots.
if (process.env.ABM_BUCKET) {
  const bucket = new Storage().bucket(process.env.ABM_BUCKET);
  app.use("/api/abm", createAbmRouter({
    store: createCloudStore({ firestore: createFirestore(), bucket }),
    publisher: createBucketPublisher(bucket),
    appUrl: process.env.ABM_APP_URL || "https://prompts.logrocket.com",
  }));
} else {
  console.warn("ABM_BUCKET is not set; ABM landing pages are disabled");
}

app.use(express.static(distDir));

// SPA fallback: serve index.html for any non-API GET request.
// Written as a final middleware so it works on both Express 4 and 5.
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }
  res.sendFile(path.join(distDir, "index.html"));
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
