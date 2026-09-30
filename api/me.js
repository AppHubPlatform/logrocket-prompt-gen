import { iapUserEmail } from "./_iapUser.js";

// Returns the authenticated user's email, sourced from the GCP IAP header that
// the load balancer injects on prompts.logrocket.com. In local dev (no IAP) the
// header is absent and we return { email: null }.
export default function handler(req, res) {
  res.status(200).json({ email: iapUserEmail(req) });
}
