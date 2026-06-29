// Returns the authenticated user's email, sourced from the GCP IAP header that
// the load balancer injects on prompts.logrocket.com. The header value looks
// like "accounts.google.com:brooke@logrocket.com"; we return just the email.
// In local dev (no IAP) the header is absent and we return { email: null }.
export default function handler(req, res) {
  const raw =
    req.headers["x-goog-authenticated-user-email"] ||
    req.headers["X-Goog-Authenticated-User-Email"] ||
    "";
  const email = raw.includes(":") ? raw.split(":").pop() : raw;
  res.status(200).json({ email: email || null });
}
