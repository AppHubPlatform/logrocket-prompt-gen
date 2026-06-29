import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import anthropic from "./api/anthropic.js";
import rog from "./api/rog.js";
import me from "./api/me.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/api/me", me);
app.post("/api/anthropic", anthropic);
app.post("/api/rog", rog);

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
