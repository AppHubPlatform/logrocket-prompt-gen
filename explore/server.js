import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Serves explore.logrocket.com. Deliberately static-only: this service is
// reachable by anyone on the internet (allUsers invoker, no IAP), so it must
// never mount the /api/anthropic or /api/rog proxies from ../server.js, which
// attach server-side API keys and are safe only behind IAP.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const app = express();

// Not /healthz: Google's frontend intercepts that path on Cloud Run and the
// request never reaches the container.
app.get("/_health", (_req, res) => res.status(200).send("ok"));

// Unlisted pages under /r/<random id>/ are shared by direct link only. Keep
// them out of search indexes, and don't leak their URL to other sites via
// Referer. Don't add /r/ to a robots.txt Disallow: crawlers that can't fetch
// the page never see the noindex.
app.use("/r", (_req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.set("Referrer-Policy", "no-referrer");
  next();
});

// extensions: ["html"] lets /monitoring-maturity-quest resolve without the
// trailing /index.html.
app.use(express.static(publicDir, { extensions: ["html"] }));

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Explore server listening on port ${port}`);
});
