// Renders a published ABM page to standalone HTML.
//
// Everything is inline: one document, no build step, no external stylesheet, so the file
// written to the bucket is the whole page. Images arrive as data URIs for the same
// reason, and because a page served from a private bucket cannot link to its own assets
// without a second signed URL per image.
//
// The two files the rep uploads are load-bearing rather than decorative. The logo sits in
// the nav and again in the hero lockup, which is what makes the page read as written for
// that company instead of adapted. The screenshot goes inside a replay mockup, framed
// with browser chrome and the URL it came from, because the point of asking for a real
// workflow is to show the reader their own product.
//
// Deliberately noindex. These are written for one named account out of their own sales
// conversations, and the URL is the only access control, so the page must never turn up
// in a search for the account's name.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const dataUri = (a) => a && a.bytes ? `data:${a.contentType};base64,${a.bytes.toString("base64")}` : "";

// LogRocket customers for the strip. Wordmarks as text so the page carries no third-party
// image assets and nothing has to be fetched at render time.
const TRUSTED = ["NVIDIA", "Airbnb", "Reddit", "Rappi", "ThredUp", "Dutchie", "Tecovas",
  "ShipStation", "Cushman & Wakefield", "7-Eleven", "Speedway", "Appfire"];

const ICONS = [
  `<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>`,
  `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  `<path d="M4 7h16M4 12h10M4 17h7"/>`,
  `<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m12 12 8-4.5M12 12v9M12 12 4 7.5"/>`,
];

const CSS = `
:root{
  --deep:#150B33; --deep-2:#2A1566; --deep-3:#3D1E82;
  --violet-600:#6D3FD1; --violet-500:#8B5CF6; --violet-400:#A78BFA; --lav-300:#C9B8FA;
  --paper:#FBF9FF; --paper-2:#F2EDFB; --paper-3:#E9E1FA; --line:#E1DBF2;
  --ink:#1A1330; --ink-soft:#544D6B; --ink-faint:#8A82A0; --on-dark:#F4F1FC;
  --mint:#128A67; --mint-bg:#D9F5EA; --coral:#C23E72; --coral-bg:#FBE1EC;
  --shadow:0 24px 60px -20px rgba(21,11,51,.35);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);overflow-x:hidden;
  font:16px/1.6 "Public Sans",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Sora,system-ui,sans-serif;letter-spacing:-.01em;margin:0;text-wrap:balance}
a{color:inherit}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;letter-spacing:.12em;
  text-transform:uppercase;font-weight:600}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:12px 22px;
  font-weight:600;font-size:14.5px;text-decoration:none;border:1.5px solid transparent;transition:transform .15s,box-shadow .15s}
.btn:active{transform:translateY(1px)}
.btn-solid{background:var(--on-dark);color:var(--deep)}
.btn-outline{border-color:rgba(244,241,252,.4);color:var(--on-dark)}
.btn-outline:hover{background:rgba(244,241,252,.12)}
.btn-ink{background:var(--ink);color:var(--on-dark)}

nav{position:sticky;top:0;z-index:40;background:rgba(21,11,51,.86);backdrop-filter:blur(10px);
  border-bottom:1px solid rgba(255,255,255,.08)}
.nav-inner{display:flex;align-items:center;gap:16px;padding:12px 0;color:var(--on-dark)}
.nav-lr{font-family:Sora,sans-serif;font-weight:700;font-size:15.5px}
.nav-for{color:var(--ink-faint);font-size:13px}
.nav-chip{background:#fff;border-radius:7px;padding:4px 10px;display:inline-flex;align-items:center}
.nav-chip img{height:15px;width:auto;display:block}
.nav-acct{color:var(--lav-300);font-weight:600;font-size:13.5px}
.nav-links{display:flex;gap:20px;margin-left:10px;flex:1}
.nav-links a{font-size:13.5px;color:rgba(244,241,252,.72);text-decoration:none;padding:6px 0;border-bottom:2px solid transparent}
.nav-links a:hover{color:var(--on-dark);border-color:var(--violet-400)}
nav .btn{padding:9px 18px;font-size:13px}

.hero{position:relative;overflow:hidden;color:var(--on-dark);padding:64px 0 76px;
  background:radial-gradient(120% 140% at 15% 0%,var(--deep-3) 0%,var(--deep-2) 42%,var(--deep) 78%)}
.hero canvas{position:absolute;inset:0;width:100%;height:100%}
.hero-inner{position:relative;z-index:2;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.hero-eyebrow{color:var(--lav-300);display:flex;align-items:center;gap:10px;margin-bottom:18px}
.hero-dot{width:7px;height:7px;border-radius:50%;background:#38E1A6;box-shadow:0 0 0 3px rgba(56,225,166,.18)}
.hero h1{font-size:clamp(30px,4.3vw,50px);line-height:1.07;margin-bottom:18px}
.hero h1 em{font-style:normal;color:var(--lav-300)}
.hero .lede{font-size:17px;line-height:1.6;color:rgba(244,241,252,.82);max-width:52ch;margin:0 0 28px}
.hero-ctas{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:26px}
.hero-meta{display:flex;gap:22px;flex-wrap:wrap;font-size:12.5px;color:rgba(244,241,252,.55)}
.hero-meta strong{color:rgba(244,241,252,.85);font-weight:600}
.hero-col2{display:flex;flex-direction:column;gap:14px}

.lockup{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px 16px;backdrop-filter:blur(6px)}
.lockup .mark{background:#fff;border-radius:10px;padding:8px 14px;display:grid;place-items:center;flex-shrink:0}
.lockup .mark img{height:30px;width:auto;max-width:150px;object-fit:contain;display:block}
.lockup .mark .txt{font-family:Sora,sans-serif;font-weight:800;font-size:15px;color:var(--deep)}
.lockup .name{font-family:Sora,sans-serif;font-weight:700;font-size:15px}
.lockup .sub{font-size:11.5px;color:rgba(244,241,252,.55);margin-top:2px}

.console{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;
  box-shadow:var(--shadow);color:var(--ink);animation:float 7s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@media(prefers-reduced-motion:reduce){.console{animation:none}}
.console-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.console-title{font-family:Sora,sans-serif;font-weight:700;font-size:14.5px}
.console-filter{font-size:10.5px;font-weight:600;color:var(--ink-soft);background:var(--paper-2);
  border:1px solid var(--paper-3);border-radius:999px;padding:4px 10px;white-space:nowrap}
.issue-row{display:flex;align-items:flex-start;gap:10px;background:var(--paper-2);border:1px solid var(--paper-3);
  border-radius:10px;padding:9px 11px;margin-bottom:7px}
.issue-flag{width:20px;height:20px;border-radius:6px;background:var(--coral-bg);display:grid;place-items:center;
  flex-shrink:0;color:var(--coral);font-size:12px;font-weight:700;margin-top:1px}
.issue-row .t{font-size:12.5px;font-weight:500;line-height:1.4}
.console-section{font-size:10px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;
  letter-spacing:.06em;margin:14px 0 8px;font-family:"IBM Plex Mono",monospace}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mini{background:var(--paper-2);border:1px solid var(--paper-3);border-radius:12px;padding:11px}
.mini .label{font-size:10px;font-weight:600;color:var(--ink-faint);text-transform:uppercase;margin-bottom:9px}
.mini svg{width:100%;height:44px;display:block;overflow:visible}
.lc-line{stroke-dasharray:240;stroke-dashoffset:240;transition:stroke-dashoffset 1.2s ease}
.mini.in .lc-line{stroke-dashoffset:0}
.bc-bar{transform-origin:bottom;transform:scaleY(0);transition:transform .6s cubic-bezier(.2,.8,.3,1)}
.mini.in .bc-bar{transform:scaleY(1)}

.logostrip{background:var(--deep);padding:30px 0;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.08)}
.logostrip .cap{text-align:center;font-size:12px;color:rgba(244,241,252,.5);margin-bottom:18px;font-weight:600;letter-spacing:.04em}
.marquee{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.marquee-track{display:flex;align-items:center;gap:0;width:max-content;animation:marquee 34s linear infinite}
.marquee:hover .marquee-track{animation-play-state:paused}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.marquee-track{animation:none}}
.logo-tile{padding:0 30px;flex-shrink:0;font-family:Sora,sans-serif;font-weight:700;font-size:16px;
  color:rgba(244,241,252,.72);white-space:nowrap}

.section{padding:84px 0}
.section-head{margin-bottom:40px}
.section-head h2{font-size:clamp(25px,3.3vw,37px);margin:10px 0 12px;font-weight:700}
.section-head p{font-size:16.5px;color:var(--ink-soft);margin:0}
.reveal{opacity:1}
@media(prefers-reduced-motion:no-preference){
  .reveal{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease}
  .reveal.in{opacity:1;transform:none}
}
.thesis{background:var(--paper-2);border:1px solid var(--paper-3);border-left:4px solid var(--violet-500);
  border-radius:14px;padding:20px 26px;max-width:860px;margin-bottom:32px}
.thesis .tag{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;color:var(--violet-600);font-weight:700}
.thesis p{font-size:19px;line-height:1.45;font-weight:600;margin:8px 0 0}
.init-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:16px}
.init-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 20px;display:flex;flex-direction:column;gap:12px}
.init-icon{width:34px;height:34px;border-radius:10px;background:var(--paper-3);display:grid;place-items:center;color:var(--violet-600)}
.init-card h3{font-size:15.5px;font-weight:700}
.init-card .statement{font-size:14px;color:var(--ink-soft);line-height:1.55;margin:0}
.ic-helps{border-top:1px solid var(--line);padding-top:11px;margin:auto 0 0;list-style:none;padding-left:0}
.ic-helps .ic-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-family:"IBM Plex Mono",monospace;
  color:var(--violet-600);font-weight:600;margin-bottom:6px}
.ic-helps li{display:flex;gap:7px;align-items:flex-start;font-size:13.5px;font-weight:500;line-height:1.5;margin-top:7px}
.ic-helps li::before{content:"";flex-shrink:0;margin-top:6px;width:7px;height:7px;border-radius:50%;background:var(--violet-500)}

.fit{background:var(--paper-2)}
.feature-row{display:grid;grid-template-columns:1fr 1fr;gap:52px;align-items:start;padding:30px 0}
.feature-row.rev .art{order:1}.feature-row.rev .cop{order:2}
.feature-row .eyebrow{color:var(--violet-600);margin-bottom:10px}
.feature-row h3{font-size:25px;margin-bottom:12px}
.feature-row p{color:var(--ink-soft);font-size:15.5px;line-height:1.65;margin:0 0 16px}
.art-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--shadow)}
.bubble{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:10px}
.bubble .q{font-size:11px;font-family:"IBM Plex Mono",monospace;font-weight:600;color:var(--violet-600);
  letter-spacing:.06em;text-transform:uppercase}
.bubble .a{font-size:13.5px;color:var(--ink);margin-top:6px;line-height:1.5}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;color:var(--ink-faint);font-weight:600;padding:0 8px 9px}
td{padding:9px 8px;border-top:1px solid var(--line)}

/* Replay mockup: the rep's screenshot framed as a session being watched. */
.rp{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
.rp-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--paper)}
.rp-dots{display:flex;gap:4px}
.rp-dots i{width:8px;height:8px;border-radius:50%;background:var(--paper-3);display:block}
.rp-url{flex:1;min-width:0;font-size:10.5px;color:var(--ink-soft);background:#fff;border:1px solid var(--line);
  border-radius:6px;padding:4px 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-tab{font-size:10px;font-weight:600;color:var(--violet-600);background:var(--paper-3);border-radius:6px;
  padding:3px 8px;white-space:nowrap}
.rp-site{position:relative;max-height:320px;overflow:hidden}
.rp-site img{display:block;width:100%;height:auto}
.rp-cursor{position:absolute;left:44%;top:46%;width:18px;height:18px;border-radius:50%;
  background:rgba(250,204,21,.55);box-shadow:0 0 0 6px rgba(250,204,21,.18);animation:tap 3.4s ease-in-out infinite}
@keyframes tap{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-26px,16px) scale(1)}
  45%{transform:translate(-26px,16px) scale(.72)}55%{transform:translate(-26px,16px) scale(1)}}
@media(prefers-reduced-motion:reduce){.rp-cursor{animation:none}}
.rp-foot{display:flex;gap:8px;align-items:center;padding:9px 11px;border-top:1px solid var(--line);
  font-size:10.5px;color:var(--ink-faint);font-family:"IBM Plex Mono",monospace}
.rp-foot .pill{background:var(--coral-bg);color:var(--coral);border-radius:999px;padding:2px 8px;font-weight:700}

.closing{background:radial-gradient(120% 160% at 85% 0%,var(--deep-3),var(--deep) 70%);color:var(--on-dark);
  border-radius:28px;padding:52px;display:grid;grid-template-columns:1.2fr .8fr;gap:40px;align-items:center}
.closing h2{font-size:30px;margin-bottom:14px}
.closing p{color:rgba(244,241,252,.75);font-size:15.5px;margin:0 0 24px;max-width:46ch}
.contact-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:18px}
.contact{display:flex;align-items:center;gap:12px}
.avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--violet-400),var(--violet-600));
  display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;font-family:Sora,sans-serif;flex-shrink:0}
.contact .name{font-size:13.5px;font-weight:600}
.contact .role{font-size:11.5px;color:rgba(244,241,252,.55)}
footer.site{padding:34px 0;text-align:center;font-size:12px;color:var(--ink-faint)}
@media(max-width:920px){.hero-inner,.feature-row,.feature-row.rev,.closing{grid-template-columns:1fr}
  .feature-row .art,.feature-row.rev .art{order:2}.feature-row .cop,.feature-row.rev .cop{order:1}
  .nav-links{display:none}}
`;

const SCRIPT = `
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reveal on scroll, and start the little charts when they come into view.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal,.mini').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal,.mini').forEach(function(el){ el.classList.add('in'); });
  }
  // Drifting points behind the hero. Cheap, and it stops the page feeling like a poster.
  var c = document.getElementById('sky');
  if (c && !reduced) {
    var x = c.getContext('2d'), dots = [], w, h;
    function size(){ w = c.width = c.offsetWidth; h = c.height = c.offsetHeight; }
    size(); window.addEventListener('resize', size);
    for (var i = 0; i < 48; i++) dots.push({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .4, s: Math.random() * .00006 + .00002
    });
    (function frame(){
      x.clearRect(0, 0, w, h);
      dots.forEach(function(d){
        d.y -= d.s; if (d.y < -0.02) d.y = 1.02;
        x.beginPath(); x.arc(d.x * w, d.y * h, d.r, 0, 6.3);
        x.fillStyle = 'rgba(201,184,250,' + (0.12 + d.r * 0.18) + ')'; x.fill();
      });
      requestAnimationFrame(frame);
    })();
  }
})();
`;

function miniCharts() {
  // Shapes only, with no numbers on them. The skill forbids inventing figures about the
  // account, so these read as the shape of a dashboard, never as a measurement.
  const line = [41, 43, 40, 46, 44, 49, 54];
  const pts = line.map((v, i) => `${(i / (line.length - 1)) * 100},${44 - ((v - 36) / 20) * 40}`).join(" ");
  const bars = [12, 8, 15, 31, 22, 18];
  const max = Math.max(...bars);
  return `
    <div class="charts">
      <div class="mini"><div class="label">Sessions</div>
        <svg viewBox="0 0 100 44" preserveAspectRatio="none">
          <polyline class="lc-line" points="${pts}" fill="none" stroke="#6D3FD1" stroke-width="2"
            vector-effect="non-scaling-stroke" stroke-linecap="round"/>
        </svg></div>
      <div class="mini"><div class="label">Issues by hour</div>
        <svg viewBox="0 0 100 44" preserveAspectRatio="none">
          ${bars.map((b, i) => `<rect class="bc-bar" x="${i * 17 + 2}" y="${44 - (b / max) * 40}" width="11"
            height="${(b / max) * 40}" rx="2" fill="#A78BFA" style="transition-delay:${i * 60}ms"/>`).join("")}
        </svg></div>
    </div>`;
}

export function renderAbmPage(pub, { logo, screenshot, preparedBy } = {}) {
  const { account, hero, issueExamples, whyNow, productFit } = pub;
  const acct = esc(account);
  const logoImg = dataUri(logo);
  const shotImg = dataUri(screenshot);
  const shotUrl = screenshot?.sourceUrl || "";

  // The last few words of the hero line get the accent, so the headline has a focal point
  // without rewriting what the skill wrote.
  const words = String(hero).trim().split(" ");
  const headline = words.length > 4
    ? `${esc(words.slice(0, -3).join(" "))} <em>${esc(words.slice(-3).join(" "))}</em>`
    : esc(hero);

  const mark = logoImg
    ? `<span class="mark"><img src="${logoImg}" alt="${acct}"/></span>`
    : `<span class="mark"><span class="txt">${acct}</span></span>`;

  const issues = issueExamples.map(i => `
      <div class="issue-row"><div class="issue-flag">!</div><div class="t">${esc(i)}</div></div>`).join("");

  const cards = whyNow.initiatives.map((i, n) => `
      <div class="init-card reveal">
        <div class="init-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n % ICONS.length]}</svg></div>
        <h3>${esc(i.title)}</h3>
        <p class="statement">${esc(i.description)}</p>
        <ul class="ic-helps">
          <div class="ic-label">How LogRocket helps</div>
          ${i.helps.map(h => `<li>${esc(h)}</li>`).join("")}
        </ul>
      </div>`).join("");

  // The screenshot belongs to the first feature block, framed as a session being watched.
  const replay = shotImg ? `
        <div class="rp">
          <div class="rp-bar">
            <span class="rp-dots"><i></i><i></i><i></i></span>
            <span class="rp-url">${esc(shotUrl || account)}</span>
            <span class="rp-tab">Session replay</span>
          </div>
          <div class="rp-site"><img src="${shotImg}" alt="${acct}"/><span class="rp-cursor"></span></div>
          <div class="rp-foot"><span class="pill">Rage click</span><span>Illustrative &middot; ${acct}</span></div>
        </div>` : "";

  const features = productFit.features.map((f, n) => {
    const bubbles = (f.examples || []).map(e => `
          <div class="bubble"><div class="q">${esc(e.label)}</div><div class="a">${esc(e.text)}</div></div>`).join("");
    const table = f.mockup ? `
          <div class="art-card"><table>
            <thead><tr>${f.mockup.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>${f.mockup.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>` : "";
    // First block gets the replay if there is one; the rest show their own examples.
    const art = (n === 0 && replay) ? replay : (table || (bubbles ? `<div class="art-card">${bubbles}</div>` : ""));
    const inline = (n === 0 && replay && bubbles) ? bubbles : "";
    return `
      <div class="feature-row reveal${n % 2 ? " rev" : ""}">
        <div class="cop">
          <div class="eyebrow">${esc(f.label)}</div>
          <h3>${esc(f.headline)}</h3>
          <p>${esc(f.description)}</p>
          ${inline}
        </div>
        <div class="art">${art}</div>
      </div>`;
  }).join("");

  const ae = String(preparedBy || "").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const initials = (ae || "LR").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const tiles = [...TRUSTED, ...TRUSTED].map(t => `<div class="logo-tile">${esc(t)}</div>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${acct} &times; LogRocket</title>
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>

<nav><div class="wrap nav-inner">
  <span class="nav-lr">LogRocket</span><span class="nav-for">for</span>
  ${logoImg ? `<span class="nav-chip"><img src="${logoImg}" alt="${acct}"/></span>`
            : `<span class="nav-acct">${acct}</span>`}
  <span class="nav-links">
    <a href="#why-now">Why now</a><a href="#fit">Product fit</a><a href="#next">Next step</a>
  </span>
  <a class="btn btn-solid" href="#next">Book a working session</a>
</div></nav>

<header class="hero"><canvas id="sky" aria-hidden="true"></canvas>
  <div class="wrap hero-inner">
    <div>
      <div class="hero-eyebrow eyebrow"><span class="hero-dot"></span>Prepared for ${acct}</div>
      <h1>${headline}</h1>
      <p class="lede">${esc(whyNow.thesis)}</p>
      <div class="hero-ctas">
        <a class="btn btn-solid" href="#next">Book a working session</a>
        <a class="btn btn-outline" href="#why-now">See what&rsquo;s at stake</a>
      </div>
      ${ae ? `<div class="hero-meta"><span>Prepared by <strong>${esc(ae)}</strong></span></div>` : ""}
    </div>
    <div class="hero-col2">
      <div class="lockup">
        ${mark}
        <div><div class="name">${acct}</div><div class="sub">Prepared with LogRocket</div></div>
      </div>
      <div class="console">
        <div class="console-top">
          <div class="console-title">Issues</div>
          <div class="console-filter">Illustrative &middot; last 7 days</div>
        </div>
        ${issues}
        <div class="console-section">Analytics</div>
        ${miniCharts()}
      </div>
    </div>
  </div>
</header>

<div class="logostrip">
  <div class="cap">TRUSTED BY 3,000+ TEAMS, INCLUDING</div>
  <div class="marquee"><div class="marquee-track">${tiles}</div></div>
</div>

<section class="section" id="why-now"><div class="wrap">
  <div class="section-head reveal">
    <span class="eyebrow" style="color:var(--violet-600)">Why now</span>
    <h2>${esc(whyNow.headline)}</h2>
  </div>
  <div class="thesis reveal"><div class="tag">THE THREAD</div><p>${esc(whyNow.thesis)}</p></div>
  <div class="init-grid">${cards}</div>
</div></section>

<section class="section fit" id="fit"><div class="wrap">
  <div class="section-head reveal">
    <span class="eyebrow" style="color:var(--violet-600)">Product fit</span>
    <h2>${esc(productFit.headline)}</h2>
  </div>
  ${features}
</div></section>

<section class="section" id="next"><div class="wrap">
  <div class="closing reveal">
    <div>
      <h2>See this on ${acct}&rsquo;s own data</h2>
      <p>Everything above was written from what your team has already told us. The next step is a
         working session on the flows that matter most.</p>
      <a class="btn btn-solid" href="#">Book a working session</a>
    </div>
    <div class="contact-card">
      <div class="contact">
        <span class="avatar">${esc(initials)}</span>
        <span><span class="name">${esc(ae || "Your LogRocket team")}</span>
        <span class="role" style="display:block">LogRocket</span></span>
      </div>
    </div>
  </div>
</div></section>

<footer class="site">Prepared exclusively for ${acct} &middot; Confidential &middot; LogRocket</footer>
<script>${SCRIPT}</script>
</body></html>`;
}
