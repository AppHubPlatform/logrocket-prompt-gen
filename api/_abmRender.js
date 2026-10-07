// Renders a published ABM page to standalone HTML.
//
// Everything is inline: one document, no build step, no external stylesheet, so the file
// written to the bucket is the whole page. Images come in as data URIs for the same
// reason, and because a page served from a private bucket cannot link to its own assets
// without a second signed URL per image.
//
// Deliberately noindex. These are written for one named account from their own sales
// conversations, and the URL is the only access control, so the page must never turn up
// in a search result for the account's name.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const CSS = `
:root{
  --deep:#150B33; --deep-2:#2A1566; --violet:#6D3FD1; --violet-soft:#A78BFA;
  --paper:#FBF9FF; --paper-2:#F2EDFB; --line:#E1DBF2;
  --ink:#1A1330; --ink-soft:#544D6B; --on-dark:#F4F1FC;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.6 "Public Sans",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Sora,system-ui,sans-serif;letter-spacing:-.01em;text-wrap:balance;margin:0}
.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;letter-spacing:.12em;
  text-transform:uppercase;font-weight:600;color:var(--violet)}
nav{background:var(--deep);color:var(--on-dark);padding:14px 0}
nav .wrap{display:flex;align-items:center;gap:14px}
nav .lr{font-family:Sora,sans-serif;font-weight:700;font-size:16px}
nav .for{color:#8A82A0;font-size:13px}
nav .chip{background:#fff;border-radius:7px;padding:5px 10px;display:inline-flex;align-items:center}
nav .chip img{height:16px;width:auto;display:block}
.hero{background:radial-gradient(120% 140% at 15% 0%,#3D1E82 0%,var(--deep-2) 42%,var(--deep) 78%);
  color:var(--on-dark);padding:72px 0}
.hero h1{font-size:clamp(30px,4.4vw,50px);line-height:1.07;margin-bottom:22px;max-width:16ch}
.hero .lede{font-size:17px;color:rgba(244,241,252,.82);max-width:50ch;margin:0}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
.issues{background:#fff;border-radius:16px;padding:18px;box-shadow:0 24px 60px -20px rgba(21,11,51,.45)}
.issues .t{font-family:Sora,sans-serif;font-weight:700;font-size:14px;color:var(--ink);margin-bottom:12px}
.issue{display:flex;gap:10px;align-items:flex-start;background:var(--paper-2);border:1px solid var(--line);
  border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:13.5px;color:var(--ink);line-height:1.45}
.issue .dot{flex-shrink:0;margin-top:6px;width:7px;height:7px;border-radius:50%;background:#C23E72}
section.band{padding:76px 0}
section.band h2{font-size:clamp(24px,3.2vw,34px);margin:10px 0 14px;font-weight:700}
.thesis{background:var(--paper-2);border:1px solid var(--line);border-left:4px solid var(--violet);
  border-radius:14px;padding:20px 24px;font-size:18px;font-weight:600;line-height:1.5;max-width:840px;margin-bottom:34px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px}
.card h3{font-size:16.5px;margin-bottom:9px}
.card p{font-size:14px;color:var(--ink-soft);margin:0 0 14px}
.helps{border-top:1px solid var(--line);padding-top:12px;margin:0;list-style:none}
.helps li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;margin-top:8px}
.helps li::before{content:"";flex-shrink:0;margin-top:7px;width:6px;height:6px;border-radius:50%;background:var(--violet)}
.shot{margin-top:40px;background:var(--paper-2);border:1px solid var(--line);border-radius:18px;padding:18px}
.shot img{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line)}
.shot .cap{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--ink-soft);margin-top:10px}
.fit{background:#fff;border-top:1px solid var(--line)}
.feature{display:grid;grid-template-columns:200px 1fr;gap:28px;padding:26px 0;border-top:1px solid var(--line)}
.feature:first-of-type{border-top:none}
.feature .label{font-family:Sora,sans-serif;font-weight:700;font-size:15px;color:var(--violet)}
.feature h3{font-size:19px;margin-bottom:8px}
.feature p{color:var(--ink-soft);font-size:14.5px;margin:0 0 14px}
.ex{background:var(--paper-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:9px}
.ex .l{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--violet);font-weight:600}
.ex .x{font-size:13.5px;color:var(--ink);margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:4px}
th{text-align:left;font-size:11px;color:var(--ink-soft);font-weight:600;padding:0 8px 8px}
td{padding:9px 8px;border-top:1px solid var(--line)}
footer{background:var(--deep);color:var(--on-dark);padding:56px 0;text-align:center}
footer p{color:rgba(244,241,252,.7);max-width:48ch;margin:12px auto 0}
@media(max-width:900px){.hero-grid,.feature{grid-template-columns:1fr}}
`;

const dataUri = (asset) => asset ? `data:${asset.contentType};base64,${asset.bytes.toString("base64")}` : "";

export function renderAbmPage(pub, { logo, screenshot } = {}) {
  const { account, hero, issueExamples, whyNow, productFit } = pub;

  const issues = issueExamples
    .map(i => `<div class="issue"><span class="dot"></span><span>${esc(i)}</span></div>`).join("");

  const cards = whyNow.initiatives.map(i => `
      <div class="card">
        <h3>${esc(i.title)}</h3>
        <p>${esc(i.description)}</p>
        <ul class="helps">${i.helps.map(h => `<li>${esc(h)}</li>`).join("")}</ul>
      </div>`).join("");

  const features = productFit.features.map(f => {
    const examples = (f.examples || []).map(e => `
        <div class="ex"><div class="l">${esc(e.label)}</div><div class="x">${esc(e.text)}</div></div>`).join("");
    const mockup = f.mockup ? `
        <table>
          <thead><tr>${f.mockup.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${f.mockup.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>` : "";
    return `
      <div class="feature">
        <div class="label">${esc(f.label)}</div>
        <div>
          <h3>${esc(f.headline)}</h3>
          <p>${esc(f.description)}</p>
          ${examples}${mockup}
        </div>
      </div>`;
  }).join("");

  const shot = screenshot ? `
      <div class="shot">
        <img src="${dataUri(screenshot)}" alt="${esc(account)}"/>
        ${screenshot.sourceUrl ? `<div class="cap">${esc(screenshot.sourceUrl)}</div>` : ""}
      </div>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(account)} &times; LogRocket</title>
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>
<nav><div class="wrap">
  <span class="lr">LogRocket</span><span class="for">for</span>
  ${logo ? `<span class="chip"><img src="${dataUri(logo)}" alt="${esc(account)}"/></span>`
         : `<span class="lr">${esc(account)}</span>`}
</div></nav>

<header class="hero"><div class="wrap hero-grid">
  <div>
    <div class="eyebrow" style="color:#C9B8FA">For ${esc(account)}</div>
    <h1>${esc(hero)}</h1>
    <p class="lede">${esc(whyNow.thesis)}</p>
  </div>
  <div class="issues">
    <div class="t">Issues worth catching first</div>
    ${issues}
  </div>
</div></header>

<section class="band"><div class="wrap">
  <div class="eyebrow">Why now</div>
  <h2>${esc(whyNow.headline)}</h2>
  <div class="thesis">${esc(whyNow.thesis)}</div>
  <div class="cards">${cards}</div>
  ${shot}
</div></section>

<section class="band fit"><div class="wrap">
  <div class="eyebrow">Product fit</div>
  <h2>${esc(productFit.headline)}</h2>
  ${features}
</div></section>

<footer><div class="wrap">
  <h2>See it on your own data</h2>
  <p>Built for ${esc(account)} from what your team told us. Ask for a walkthrough on the flows above.</p>
</div></footer>
</body></html>`;
}
