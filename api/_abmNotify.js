// Tells the approvers in Slack when a page is waiting for them, so a submitted page does
// not sit unseen until someone thinks to open the app.
//
// Posts through an incoming webhook, which is tied to one channel when it is created
// (#enablement-updates for now). The URL is a secret: it lives in the server's
// environment as ABM_SLACK_WEBHOOK_URL and is never given a VITE_ prefix, which would
// ship it to every browser.

// Slack member IDs, so the message @mentions the two people who can approve.
export const APPROVER_SLACK_IDS = {
  "brooke@logrocket.com": "UKG6CR7JT",
  "gregallen@logrocket.com": "USASPR86A",
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function approvalMessage(page, { appUrl, resubmitted = false }) {
  const mentions = Object.values(APPROVER_SLACK_IDS).map(id => `<@${id}>`).join(" ");
  const who = page.updatedBy || page.createdBy;
  const what = resubmitted ? "was edited after approval and needs approving again" : "is ready for approval";
  const preview = `${appUrl}/api/abm/${page.id}/preview`;
  const text = `${mentions} The ABM landing page for *${esc(page.account)}* ${what}. Submitted by ${esc(who)}.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Account*\n${esc(page.account)}` },
        { type: "mrkdwn", text: `*Persona*\n${esc(page.persona || "—")}` },
      ] },
      { type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: "Preview the page" }, url: preview },
        { type: "button", text: { type: "plain_text", text: "Review in the app" }, url: `${appUrl}/?page=abm&id=${encodeURIComponent(page.id)}`, style: "primary" },
      ] },
    ],
  };
}

// Never throws: a Slack outage must not stop a rep submitting a page.
export async function notifyApprovers(page, { webhookUrl, appUrl, resubmitted, fetchImpl = fetch }) {
  if (!webhookUrl) return false;
  try {
    const r = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(approvalMessage(page, { appUrl, resubmitted })),
    });
    if (!r.ok) console.error("abm slack alert failed", r.status);
    return r.ok;
  } catch (e) {
    console.error("abm slack alert failed", e?.message);
    return false;
  }
}
