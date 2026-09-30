// The IAP header looks like "accounts.google.com:brooke@logrocket.com".
// Absent in local dev, where there is no IAP in front of the server.
export function iapUserEmail(req) {
  const raw = req.headers["x-goog-authenticated-user-email"] || "";
  const email = raw.includes(":") ? raw.split(":").pop() : raw;
  return email || null;
}
