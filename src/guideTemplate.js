// Branded competitor-guide one-pager, adapted from the Claude Design project
// "LogRocket vs FullStory". Produces a full HTML document (design tokens +
// component CSS + markup) populated from the generated guide, plus a one-click
// PDF download that renders that document and packages it into a paginated PDF.
// Sources are intentionally omitted from this output.

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Escape first, then turn **…** markers into <strong>. Escaping before the
// substitution keeps model/rep-authored text safe — only our own tags survive.
const escBold = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 131 28" aria-label="LogRocket"><path fill="currentColor" fill-rule="evenodd" d="M6.066 3.156A10.53 10.53 0 0 1 9.122 0a10.294 10.294 0 0 1 3.016 3.094 15.59 15.59 0 0 1 2.93 9.777c.637.513 1.293 1.006 1.918 1.53a3.46 3.46 0 0 1 1.104 3.189c-.302 1.457-.592 2.918-.911 4.372a1.214 1.214 0 0 1-1.848.61c-1.027-.825-2.027-1.678-3.05-2.504a4.684 4.684 0 0 1-2.891 1.255 4.678 4.678 0 0 1-3.385-1.22c-.735.541-1.419 1.191-2.138 1.772-.315.31-.666.58-1.046.806a1.215 1.215 0 0 1-1.603-.785c-.329-1.422-.672-2.839-.99-4.263a3.453 3.453 0 0 1 1.163-3.321c.559-.45 1.125-.893 1.694-1.331.159-.08.08-.261.087-.401a15.615 15.615 0 0 1 2.9-9.42m1.007 4.402a2.395 2.395 0 0 0 .21 3.173 2.636 2.636 0 0 0 3.603.075 2.398 2.398 0 0 0 .636-2.634 2.55 2.55 0 0 0-2.14-1.59 2.6 2.6 0 0 0-2.31.974" clip-rule="evenodd"/><path fill="currentColor" d="M5.712 23.082a.605.605 0 0 1 .896-.485 5.778 5.778 0 0 0 5.03 0 .61.61 0 0 1 .896.45c.005.89.005 1.78 0 2.67a.602.602 0 0 1-.94.436c-.267-.226-.508-.48-.764-.719-.407.762-.789 1.534-1.199 2.294a.61.61 0 0 1-1.012.006c-.41-.761-.79-1.538-1.206-2.299-.253.24-.494.494-.761.72a.603.603 0 0 1-.94-.442c-.007-.878 0-1.756 0-2.634M9.102 10.259a1.22 1.22 0 0 0 1.248-1.192v-.008a1.221 1.221 0 0 0-1.24-1.2h-.008A1.22 1.22 0 0 0 7.855 9.05v.008a1.22 1.22 0 0 0 1.24 1.2h.007Z"/><path fill="currentColor" fill-rule="evenodd" d="M22.79 6.163h1.953v13.186h8.156v1.776H22.787l.004-14.962Zm11.824 9.773a5.224 5.224 0 0 1 .476-2.229 5.588 5.588 0 0 1 1.29-1.776 5.9 5.9 0 0 1 4.14-1.584 5.746 5.746 0 0 1 4.068 1.51 5.135 5.135 0 0 1 1.649 3.941 5.142 5.142 0 0 1-1.765 3.961 5.899 5.899 0 0 1-4.141 1.576 5.74 5.74 0 0 1-4.082-1.5 5.086 5.086 0 0 1-1.638-3.898m2.005-.116a3.935 3.935 0 0 0 .296 1.531c.191.456.47.87.82 1.218a3.82 3.82 0 0 0 2.789 1.077 3.576 3.576 0 0 0 2.641-1.077 3.58 3.58 0 0 0 1.067-2.652 3.772 3.772 0 0 0-3.899-3.878 3.552 3.552 0 0 0-2.641 1.09 3.673 3.673 0 0 0-1.067 2.694m14.537.94a1.812 1.812 0 0 0-.507 1.133.8.8 0 0 0 .36.74c.3.168.623.29.959.36.402.09.857.168 1.363.232.507.063 1.028.126 1.564.19.528.07 1.046.161 1.553.274.474.093.935.242 1.373.444a2.043 2.043 0 0 1 1.322 1.88 3.753 3.753 0 0 1-1.656 3.107 5.943 5.943 0 0 1-3.624 1.151 6.751 6.751 0 0 1-3.318-.76 2.741 2.741 0 0 1-1.596-2.495 3.278 3.278 0 0 1 .785-2.017c.148-.19.31-.366.486-.529a2.005 2.005 0 0 1-1.532-1.892 3.761 3.761 0 0 1 1.394-2.894 2.957 2.957 0 0 1-.485-1.638 3.228 3.228 0 0 1 .37-1.574c.248-.451.59-.844 1.004-1.152a4.902 4.902 0 0 1 3.05-.972 4.742 4.742 0 0 1 3.022.972 4.064 4.064 0 0 1 2.18-.909 5.73 5.73 0 0 1 .824-.063l-.088 1.638a5.5 5.5 0 0 0-1.933.496c.238.464.362.979.359 1.5a2.961 2.961 0 0 1-.38 1.483 3.504 3.504 0 0 1-.994 1.142 4.839 4.839 0 0 1-2.968.95 5.13 5.13 0 0 1-2.885-.793m.507-3.707a1.87 1.87 0 0 0-.201.887c-.006.31.063.62.201.899.141.254.336.473.57.643a3.043 3.043 0 0 0 1.819.508c.907.099 1.79-.338 2.26-1.12.14-.27.21-.573.202-.877a1.856 1.856 0 0 0-.212-.898 1.857 1.857 0 0 0-.56-.655 3.006 3.006 0 0 0-1.817-.518 2.34 2.34 0 0 0-2.262 1.134m.021 7.796a2.75 2.75 0 0 0-.73 1.913 1.556 1.556 0 0 0 1.047 1.404 4.033 4.033 0 0 0 1.722.413 6.94 6.94 0 0 0 1.394-.117c.348-.064.683-.182.993-.349a1.693 1.693 0 0 0 1.025-1.542c0-.627-.606-1.047-1.817-1.258a24.982 24.982 0 0 0-1.913-.243 19.22 19.22 0 0 1-1.721-.221M75.27 10.78a4.594 4.594 0 0 1-3.064 4.597l2.843 5.758h-2.274l-2.567-5.21c-.725.108-1.456.161-2.188.16h-3.888v5.049h-1.954V6.173h6.14c1.7-.103 3.4.209 4.954.908a3.88 3.88 0 0 1 1.996 3.698m-6.984 3.529a7.267 7.267 0 0 0 3.508-.656 2.917 2.917 0 0 0 1.406-2.747c0-1.676-1.085-2.628-3.254-2.853a17.263 17.263 0 0 0-1.934-.105h-3.878v6.363l4.152-.002Zm9.328 1.638c-.007-.77.155-1.53.476-2.23a5.576 5.576 0 0 1 1.289-1.775 5.905 5.905 0 0 1 4.142-1.585 5.744 5.744 0 0 1 4.075 1.502 5.137 5.137 0 0 1 1.649 3.941 5.144 5.144 0 0 1-1.765 3.961 5.899 5.899 0 0 1-4.142 1.575 5.734 5.734 0 0 1-4.078-1.5 5.081 5.081 0 0 1-1.638-3.898m2.006-.116a3.815 3.815 0 0 0 1.11 2.747 3.82 3.82 0 0 0 2.789 1.076 3.572 3.572 0 0 0 2.641-1.076 3.582 3.582 0 0 0 1.067-2.653 3.769 3.769 0 0 0-1.11-2.779 3.782 3.782 0 0 0-2.789-1.098 3.552 3.552 0 0 0-2.642 1.088 3.673 3.673 0 0 0-1.066 2.695Zm20.35 3.043.369 1.49a6.46 6.46 0 0 1-3.888.983 4.995 4.995 0 0 1-3.846-1.5 5.592 5.592 0 0 1-1.363-3.974 5.43 5.43 0 0 1 1.532-3.93 5.207 5.207 0 0 1 3.878-1.585 5.61 5.61 0 0 1 3.4.96l-.698 1.572a4.719 4.719 0 0 0-2.896-.886 2.877 2.877 0 0 0-2.353 1.12 4.032 4.032 0 0 0-.856 2.62 4.2 4.2 0 0 0 .898 2.767 3.171 3.171 0 0 0 2.588 1.141 7.235 7.235 0 0 0 3.233-.784m2.673-14.232h2.005v10.577l4.744-4.65h2.344l-4.968 4.86 2.958 3.192a3.334 3.334 0 0 0 2.24 1.088l-.307 1.426a3.248 3.248 0 0 1-2.599-.591 5.742 5.742 0 0 1-.602-.581l-3.814-4.121v5.293h-2.005l.004-16.493Zm19.271 6.857c.392.403.691.886.878 1.416.219.57.33 1.175.327 1.786-.01.74-.081 1.479-.212 2.208h-7.354a3.507 3.507 0 0 0 1.036 2.018c.638.521 1.45.782 2.272.73a8.86 8.86 0 0 0 3.602-.72l.339 1.511a7.822 7.822 0 0 1-3.107.836c-.485.047-.971.068-1.457.063a5.49 5.49 0 0 1-1.881-.359 4.086 4.086 0 0 1-1.627-1.056 5.779 5.779 0 0 1-1.278-4.058 5.428 5.428 0 0 1 1.532-3.93 5.205 5.205 0 0 1 3.877-1.585 4.124 4.124 0 0 1 3.051 1.141m-.708 3.857.042-.57a2.513 2.513 0 0 0-1.447-2.568 2.895 2.895 0 0 0-1.162-.21 2.948 2.948 0 0 0-1.247.26 3.068 3.068 0 0 0-.971.72 3.816 3.816 0 0 0-.951 2.367l5.736.002Zm4.671-3.159h-1.134v-1.307l2.6-1.954h.539v1.638h3.021v1.626h-3.021v4.271a4.622 4.622 0 0 0 .454 2.451 2.393 2.393 0 0 0 1.774.794l-.305 1.426c-2.114.267-3.363-.567-3.749-2.504a9.235 9.235 0 0 1-.179-1.87v-4.57Z" clip-rule="evenodd"/></svg>`;

const TOKENS = `
:root{
  --font-display:"Vinila","Inter Tight","Inter",-apple-system,BlinkMacSystemFont,sans-serif;
  --font-body:"Proxima Nova","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --font-mono:"Source Code Pro",ui-monospace,"SF Mono",Menlo,monospace;
  --lr-ink:#17141B; --lr-moon:#F9F6F5; --lr-comet:#F1ECF6;
  --lr-galaxy:#633FA0; --lr-indigo-0:#430A6D; --lr-indigo-1:#C689F5; --lr-indigo-2:#F4E7FD;
  --lr-illusion-0:#AA82FF; --lr-illusion-1:#E3D6FF;
  --lr-matter-0:#8548FF; --lr-matter-1:#BFB2FF;
  --lr-gray-0:#272C33; --lr-gray-2:#7F8999; --lr-gray-4:#DADEE5; --lr-gray-5:#F2F5FA;
  --lr-danger-1:#CE4554; --lr-danger-3:#FCD3D8; --lr-danger-4:#FEEEEF;
  --lr-info-2:#FFE1AB; --lr-caution-1:#D97856;
  --text-regular:#4F5766; --text-muted:#7F8999; --fg-2:rgba(23,20,27,.75);
  --shadow-default:0 2px 4px -2px rgba(39,44,51,.06);
  --shadow-modal:0 0 32px 0 rgba(0,0,0,.08);
  --shadow-marketing:0 20px 25px rgba(227,230,236,.15),0 -4px 15px rgba(227,230,236,.25);
  --ease-out-expo:cubic-bezier(0.19,1,0.22,1);
}
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;700&display=swap");
`;

const COMPONENT_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--font-body);color:var(--lr-ink);background:var(--lr-moon);line-height:1.45;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
h1,h2,h3,h4,h5,h6{margin:0;font-family:var(--font-display);font-weight:400;letter-spacing:-.02em}
p{margin:0}
.page{max-width:1240px;margin:0 auto;padding:32px 32px 56px;display:flex;flex-direction:column;gap:18px}
.meta{display:flex;align-items:center;justify-content:space-between;padding:6px 4px}
.meta .lockup{display:flex;align-items:center;gap:14px}
.meta .lockup svg{height:24px;width:auto;color:var(--lr-ink);display:block}
.meta .lockup .pipe{width:1px;height:18px;background:rgba(0,0,0,.14)}
.meta .lockup .label{font-family:var(--font-display);font-size:13px;color:var(--fg-2);text-transform:uppercase;letter-spacing:.12em}
.meta .stamp{font-family:var(--font-display);font-size:12px;color:var(--fg-2);letter-spacing:.04em}
.hero{position:relative;background:var(--lr-ink);color:#fff;border-radius:24px;padding:48px 48px 44px;overflow:hidden;isolation:isolate}
.hero::after{content:"";position:absolute;right:-180px;top:-180px;width:540px;height:540px;background:radial-gradient(circle,rgba(170,130,255,.40) 0%,rgba(170,130,255,0) 60%);z-index:-1}
.hero .eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-display);font-size:12px;color:var(--lr-illusion-1);background:rgba(170,130,255,.12);border:1px solid rgba(170,130,255,.28);padding:6px 12px;border-radius:9999px;text-transform:uppercase;letter-spacing:.14em}
.hero .eyebrow .dot{width:6px;height:6px;background:var(--lr-illusion-0);border-radius:9999px}
.versus{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:48px;margin-top:18px}
.versus .name{font-family:var(--font-display);line-height:.95;letter-spacing:-.04em;font-size:76px}
.versus .name.lr{color:#fff}
.versus .name.them{color:rgba(255,255,255,.45)}
.versus .vs{font-family:var(--font-display);font-size:18px;color:var(--lr-illusion-1);width:56px;height:56px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.20);border-radius:9999px;transform:translateY(-10px);background:rgba(255,255,255,.04)}
.hero .lede{margin-top:24px;display:grid;grid-template-columns:1fr 56px 1fr;column-gap:48px;padding-top:20px;border-top:1px solid rgba(255,255,255,.12)}
.lede-col.lr{grid-column:1}
.lede-col.them{grid-column:3}
.lede-col h3{font-family:var(--font-display);font-size:20px;color:#fff;line-height:1.15;margin-bottom:8px}
.lede-col h3 .tag{font-size:11px;font-family:var(--font-body);font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-right:10px;vertical-align:3px}
.lede-col.lr h3 .tag{background:var(--lr-matter-0);color:#fff}
.lede-col.them h3 .tag{background:rgba(255,255,255,.14);color:rgba(255,255,255,.85)}
.lede-col p{color:rgba(255,255,255,.72);font-size:14px;line-height:1.55}
.lede-col p strong{color:#fff;font-weight:600}
.section-eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-display);font-size:12px;color:var(--lr-indigo-0);text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px}
.section-eyebrow .num{width:22px;height:22px;border-radius:9999px;background:var(--lr-indigo-0);color:#fff;font-size:11px;display:grid;place-items:center;letter-spacing:0}
.section-title{font-family:var(--font-display);font-size:30px;line-height:1.08;letter-spacing:-.025em;color:var(--lr-ink);max-width:820px;margin-bottom:20px}
.section-title em{font-style:normal;color:var(--lr-matter-0)}
/* Shared row track so both cards' head / prompt / answer / bullets / foot line
   up horizontally: each card is a subgrid spanning the same 5 rows, so every row
   takes the height of the taller column. */
.ai{display:grid;grid-template-columns:1fr 1fr;gap:24px;grid-template-rows:auto auto auto 1fr auto;align-items:stretch}
.ai-card{background:#fff;border-radius:18px;padding:26px;border:1px solid rgba(0,0,0,.06);display:grid;grid-template-rows:subgrid;grid-row:span 5;gap:14px;position:relative;overflow:hidden}
.ai-card.lr{background:linear-gradient(180deg,#1A1126 0%,#0D0716 100%);color:#fff;border:1px solid rgba(170,130,255,.20)}
.ai-card.lr::before{content:"";position:absolute;right:-90px;bottom:-90px;width:280px;height:280px;background:radial-gradient(circle,rgba(170,88,160,.45) 0%,transparent 60%);pointer-events:none}
.ai-head{display:flex;align-items:center;gap:12px}
.ai-glyph{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.ai-card.lr .ai-glyph{background:linear-gradient(135deg,#AA58A0,#633FA0);color:#fff}
.ai-card.them .ai-glyph{background:#1A1A1A;color:#fff}
.ai-name{font-family:var(--font-display);font-size:20px;line-height:1.1}
.ai-name small{display:block;font-family:var(--font-body);font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px}
.ai-card.lr .ai-name,.ai-card.lr .ai-name small{color:#fff}
.ai-card.lr .ai-name small{color:rgba(255,255,255,.55)}
.ai-prompt{font-family:var(--font-mono);font-size:12px;background:rgba(0,0,0,.04);border-radius:10px;padding:10px 12px;color:var(--text-regular)}
.ai-card.lr .ai-prompt{background:rgba(255,255,255,.06);color:rgba(255,255,255,.78)}
.ai-prompt .you{color:var(--lr-matter-0);margin-right:8px}
.ai-card.lr .ai-prompt .you{color:var(--lr-illusion-0)}
.ai-answer{font-size:13.5px;line-height:1.55;color:var(--text-regular);border-left:2px solid var(--lr-matter-0);padding-left:14px}
.ai-card.lr .ai-answer{color:rgba(255,255,255,.80);border-left-color:var(--lr-illusion-0)}
.ai-answer strong{color:var(--lr-ink);font-weight:700}
.ai-card.lr .ai-answer strong{color:#fff;font-weight:700}
.ai-bullets li strong{color:var(--lr-ink);font-weight:700}
.ai-card.lr .ai-bullets li strong{color:#fff;font-weight:700}
.ai-bullets ul{margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.ai-bullets li{display:grid;grid-template-columns:14px 1fr;gap:10px;align-items:start;font-size:13px;line-height:1.45;color:var(--text-regular);list-style:none}
.ai-card.lr .ai-bullets li{color:rgba(255,255,255,.80)}
.ai-bullets .pt{width:14px;height:14px;border-radius:9999px;flex-shrink:0;margin-top:2px;display:grid;place-items:center;background:var(--lr-galaxy);color:#fff}
.ai-card.lr .pt{background:var(--lr-illusion-0)}
.ai-card.them .pt.no{background:var(--lr-danger-3);color:var(--lr-danger-1)}
.ai-foot{align-self:end;padding-top:14px;border-top:1px solid rgba(0,0,0,.06);font-family:var(--font-display);font-size:13px;color:var(--lr-matter-0)}
/* Keeps the competitor card's row count matching the LogRocket card so the
   subgrid rows stay in step; occupies row 5 without drawing anything. */
.ai-foot.is-spacer{border-top:0;padding-top:0;min-height:0}
.ai-card.lr .ai-foot{border-top-color:rgba(255,255,255,.10);color:var(--lr-illusion-1)}
.ai-foot a{color:inherit;text-decoration:underline}
/* ── AI evolution timeline ── */
.evo{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:20px;padding:26px 28px;box-shadow:var(--shadow-marketing)}
.evo-chart{width:100%;display:block}
.evo-foot{margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,0,0,.07);font-size:11px;color:var(--text-muted);line-height:1.45}
.sources-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.source-tile{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px}
.source-tile .glyph{width:40px;height:40px;border-radius:12px;background:var(--lr-indigo-2);color:var(--lr-galaxy);display:grid;place-items:center;font-size:20px}
.source-tile h4{font-family:var(--font-display);font-size:17px;color:var(--lr-ink)}
.source-tile p{font-size:12.5px;color:var(--text-regular);line-height:1.45;flex:1}
.source-tile .cover{display:flex;flex-wrap:wrap;column-gap:12px;row-gap:5px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06);font-size:11.5px;font-family:var(--font-display)}
.source-tile .cover span{display:inline-flex;align-items:center;gap:5px}
.source-tile .cover .yes{color:var(--lr-galaxy)}
.source-tile .cover .no{color:var(--text-muted)}
.source-tile .cover .pip{width:14px;height:14px;border-radius:9999px;display:grid;place-items:center;flex-shrink:0;font-size:9px}
.source-tile .cover .yes .pip{background:var(--lr-galaxy);color:#fff}
.integrations{margin-top:16px;padding-top:16px;border-top:1px solid rgba(0,0,0,.08)}
.integrations h5{font-family:var(--font-display);font-size:12px;font-weight:450;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin:0 0 10px}
.integ-chips{display:flex;flex-wrap:wrap;gap:8px}
.integ-chip{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-display);font-size:12.5px;padding:7px 13px;border-radius:9999px;border:1px solid}
.integ-chip .pip{width:15px;height:15px;border-radius:9999px;display:grid;place-items:center;font-size:9px;flex-shrink:0}
.integ-chip .note{font-family:var(--font-body);font-size:11px;opacity:.75}
.integ-chip.yes{background:var(--lr-indigo-2);color:var(--lr-galaxy);border-color:rgba(99,63,160,.22)}
.integ-chip.yes .pip{background:var(--lr-galaxy);color:#fff}
.integ-chip.no{background:var(--lr-gray-5);color:var(--text-muted);border-color:var(--lr-gray-4)}
.integ-chip.no .pip{background:#fff;color:var(--lr-gray-2);border:1px solid var(--lr-gray-4)}
.source-tile .cover .no .pip{background:var(--lr-gray-5);color:var(--lr-gray-2);border:1px solid var(--lr-gray-4)}
.matrix{background:#fff;border-radius:20px;overflow:hidden;border:1px solid rgba(0,0,0,.08)}
.matrix table{width:100%;border-collapse:collapse;font-size:13.5px}
.matrix thead th{text-align:left;font-family:var(--font-display);font-weight:450;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:13px 20px;background:var(--lr-moon);border-bottom:1px solid rgba(0,0,0,.08)}
.matrix thead th.lr-col{color:var(--lr-galaxy);background:var(--lr-indigo-2)}
.matrix tbody td{padding:13px 20px;border-bottom:1px solid rgba(0,0,0,.04);vertical-align:top;color:var(--text-regular)}
.matrix tbody tr:last-child td{border-bottom:none}
.matrix .cap{font-family:var(--font-display);font-size:14px;color:var(--lr-ink);font-weight:450}
.matrix .lr-col{background:rgba(244,231,253,.5)}
.matrix .mark{display:inline-flex;align-items:flex-start;gap:8px}
.matrix .mark .pip{width:18px;height:18px;border-radius:9999px;flex-shrink:0;display:grid;place-items:center;font-size:11px;margin-top:1px}
.mark.full .pip{background:var(--lr-galaxy);color:#fff}
.mark.partial .pip{background:var(--lr-info-2);color:var(--lr-caution-1)}
.mark.none .pip{background:var(--lr-gray-5);color:var(--lr-gray-2);border:1px solid var(--lr-gray-4)}
.teams-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.team-chip{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px}
.team-chip .glyph{width:30px;height:30px;border-radius:10px;background:var(--lr-indigo-2);color:var(--lr-galaxy);display:grid;place-items:center;margin-bottom:4px;font-size:15px}
.team-chip .role{font-family:var(--font-display);font-size:10px;color:var(--lr-galaxy);text-transform:uppercase;letter-spacing:.12em}
.team-chip h4{font-family:var(--font-display);font-size:15px;color:var(--lr-ink)}
.team-chip p{font-size:12px;color:var(--text-regular);line-height:1.4}
.wins{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.win-card{background:#fff;border-radius:20px;padding:26px;border:1px solid rgba(0,0,0,.06);display:flex;flex-direction:column;gap:16px;box-shadow:var(--shadow-marketing);position:relative;overflow:hidden}
.win-card::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,var(--lr-indigo-2) 0%,transparent 40%);pointer-events:none}
.win-card>*{position:relative}
.win-head{display:flex;align-items:center;justify-content:space-between;gap:14px}
.win-brand{font-family:var(--font-display);font-size:22px;line-height:1;color:var(--lr-ink);display:flex;align-items:center;gap:10px}
.win-brand .badge{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--lr-galaxy);color:#fff;font-family:var(--font-display);font-size:14px}
.win-tag{font-size:11px;font-family:var(--font-display);color:var(--text-muted);letter-spacing:.06em}
.win-quote{font-family:var(--font-display);font-size:17px;line-height:1.3;color:var(--lr-ink)}
.win-quote::before{content:"\\201C";color:var(--lr-matter-0)}
.win-quote::after{content:"\\201D";color:var(--lr-matter-0)}
.win-out{font-size:13.5px;line-height:1.5;color:var(--text-regular)}
.win-replaced{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-display);font-size:11px;background:var(--lr-danger-4);color:var(--lr-danger-1);padding:4px 10px;border-radius:9999px;text-transform:uppercase;letter-spacing:.08em;align-self:flex-start}
.win-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:14px;border-top:1px solid rgba(0,0,0,.08);margin-top:auto}
.win-stat .num{font-family:var(--font-display);font-size:28px;color:var(--lr-galaxy);letter-spacing:-.025em;line-height:1}
.win-stat .lbl{font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.3}
.tldr{background:linear-gradient(135deg,var(--lr-galaxy) 0%,var(--lr-indigo-0) 100%);color:#fff;border-radius:24px;padding:32px 36px;display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;position:relative;overflow:hidden}
.tldr-trophy{width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;font-size:28px}
.tldr h3{font-family:var(--font-display);font-size:26px;line-height:1.2;margin-bottom:8px}
.tldr h3 .winner{background:#fff;color:var(--lr-galaxy);padding:2px 10px;border-radius:6px}
.tldr p{color:rgba(255,255,255,.88);font-size:15px;line-height:1.55}
.footnote{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-muted);padding:4px}
@page{size:A4;margin:10mm}
@media print{
  body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:100%;padding:0;gap:14px}
  section,.hero,.tldr,.wins,.ai{break-inside:avoid}
}
`;

const PIP_CHECK = "✓";
const PIP_X = "✕";
const MARK_LABEL = { full: "✓", partial: "~", none: "✕" };

function markCell(mark, text, isLr) {
  const m = (mark || (text ? "full" : "none")).toLowerCase();
  const cls = ["full", "partial", "none"].includes(m) ? m : "full";
  return `<div class="mark ${cls}"><span class="pip">${MARK_LABEL[cls]}</span><span>${esc(text || "")}</span></div>`;
}

// Ask Galileo autonomy chart. Deterministic inline SVG (no chart library) so it
// renders identically in the preview and in the html2canvas capture.
// Autonomy chart: LogRocket's verified milestones plus the competitor's
// indicative line on a shared time axis. Deterministic inline SVG (no chart
// library) so it renders identically in the preview and the html2canvas capture.
function buildEvolutionChart(lrPoints, compPoints, competitorName) {
  if (!lrPoints.length) return "";

  const W = 1080, H = 340;
  const L = 52, R = 26, T = 58, B = 46;
  const pw = W - L - R, ph = H - T - B;

  // Shared time axis: parse "Mon 'YY" into a sortable month index so both
  // series sit at their true positions relative to each other.
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const toIndex = (label) => {
    const m = String(label || "").match(/([A-Za-z]{3})[a-z]*\s*'?(\d{2,4})/);
    if (!m) return null;
    const yr = Number(m[2].length === 2 ? `20${m[2]}` : m[2]);
    return yr * 12 + (MONTHS[m[1].toLowerCase()] ?? 0);
  };

  const lr = lrPoints.map(p => ({ ...p, t: toIndex(p.date) })).filter(p => p.t !== null);
  const comp = (compPoints || []).map(p => ({ ...p, t: toIndex(p.date) }))
    .filter(p => p.t !== null && Number.isFinite(Number(p.pct)))
    .sort((a, b) => a.t - b.t);
  if (!lr.length) return "";

  const all = [...lr, ...comp];
  const minT = Math.min(...all.map(p => p.t));
  const maxT = Math.max(...all.map(p => p.t));
  const span = Math.max(maxT - minT, 1);
  const x = (t) => L + (pw * (t - minT)) / span;
  const y = (pct) => T + ph - (ph * Math.max(0, Math.min(100, Number(pct)))) / 100;

  // Smooth a series with mid-point cubics.
  const linePath = (pts) => {
    if (!pts.length) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1], [cx, cy] = pts[i];
      const mx = (px + cx) / 2;
      d += ` C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`;
    }
    return d;
  };

  const lrPts = lr.map(p => [x(p.t), y(p.pct)]);
  const compPts = comp.map(p => [x(p.t), y(p.pct)]);
  const lrPath = linePath(lrPts);
  const lrArea = `${lrPath} L ${lrPts[lrPts.length - 1][0]} ${y(0)} L ${lrPts[0][0]} ${y(0)} Z`;
  const compPath = linePath(compPts);

  const gridlines = [0, 20, 40, 60, 80, 100].map(v => `
    <line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#E6DEF3" stroke-width="1" stroke-dasharray="${v === 0 ? "0" : "3 4"}"/>
    <text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="#AA82FF">${v}%</text>`).join("");

  // Legend, top-right inside the plot.
  const legend = `
    <g font-family="Inter, sans-serif" font-size="12" font-weight="600">
      <line x1="${W - R - 250}" y1="26" x2="${W - R - 226}" y2="26" stroke="#5B2BC4" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="${W - R - 238}" cy="26" r="4" fill="#fff" stroke="#633FA0" stroke-width="2.5"/>
      <text x="${W - R - 219}" y="30" fill="#3B0A63">LogRocket</text>
      <line x1="${W - R - 130}" y1="26" x2="${W - R - 106}" y2="26" stroke="#D97856" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round"/>
      <circle cx="${W - R - 118}" cy="26" r="4" fill="#fff" stroke="#D97856" stroke-width="2.5"/>
      <text x="${W - R - 99}" y="30" fill="#8a5a3f">${esc(competitorName)}${comp.length ? " (indicative)" : ""}</text>
    </g>`;

  // LogRocket callouts sit above its line; competitor labels below theirs.
  const lrDots = lrPts.map(([cx, cy], i) => {
    const last = i === lrPts.length - 1;
    return `<circle cx="${cx}" cy="${cy}" r="${last ? 8 : 5}" fill="${last ? "#430A6D" : "#fff"}" stroke="${last ? "#AA82FF" : "#633FA0"}" stroke-width="${last ? 3 : 2.5}"/>`;
  }).join("");

  // Milestones can land close together in time (a competitor shipping twice in
  // one quarter), so nudge each box away from any already placed to keep every
  // label readable.
  const placed = [];
  const clashes = (bx, y0, boxW, boxH) => placed.some(r =>
    bx < r.x + r.w + 4 && bx + boxW + 4 > r.x && y0 < r.y + r.h + 3 && y0 + boxH + 3 > r.y);

  // Walk in `dir` looking for a free slot; if that side runs out of room, try the
  // other side before giving up (two low milestones a month apart would otherwise
  // stack into the axis).
  const avoidOverlap = (bx, by, boxW, boxH, dir, minY, maxY) => {
    const scan = (start, step) => {
      let y0 = start;
      for (let guard = 0; guard < 14; guard++) {
        if (!clashes(bx, y0, boxW, boxH)) return y0;
        y0 += step * (boxH + 5);
        if (y0 < minY || y0 > maxY) return null;
      }
      return null;
    };
    const y = scan(by, dir) ?? scan(by, -dir) ?? Math.max(minY, Math.min(maxY, by));
    placed.push({ x: bx, y, w: boxW, h: boxH });
    return y;
  };

  const lrLabels = lr.map((p, i) => {
    const [cx, cy] = lrPts[i];
    const last = i === lr.length - 1;
    const lift = 32 + (i % 2 === 0 ? 17 : 0);
    const boxW = Math.max(94, p.label.length * 6.3 + 20);
    const boxH = p.sub ? 44 : 32;
    const bx = Math.min(Math.max(cx - boxW / 2, L - 4), W - boxW - 4);
    const ly = avoidOverlap(bx, Math.max(46, cy - lift), boxW, boxH, -1, 6, H - B - boxH - 2);
    return `
    <line x1="${cx}" y1="${cy - (last ? 9 : 6)}" x2="${cx}" y2="${ly + boxH}" stroke="#8E86A0" stroke-width="1"/>
    <rect x="${bx}" y="${ly}" width="${boxW}" height="${boxH}" rx="7" fill="${last ? "#3B0A63" : "#2A2733"}"/>
    <text x="${bx + boxW / 2}" y="${ly + 13}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="700" fill="${last ? "#7DE2D1" : "#fff"}">${esc(p.label)}</text>
    ${p.sub ? `<text x="${bx + boxW / 2}" y="${ly + 25}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="#C9BFE0">${esc(p.sub)}</text>` : ""}
    <text x="${bx + boxW / 2}" y="${ly + boxH - 7}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12.5" font-weight="700" fill="${last ? "#7DE2D1" : "#fff"}">${p.pct}%</text>`;
  }).join("");

  const compDots = compPts.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="5" fill="#fff" stroke="#D97856" stroke-width="2.5"/>`).join("");

  const compLabels = comp.map((p, i) => {
    const [cx, cy] = compPts[i];
    const boxW = Math.max(88, p.label.length * 6 + 18);
    const boxH = 30;
    const drop = 16 + (i % 2 === 0 ? 0 : 14);
    const bx = Math.min(Math.max(cx - boxW / 2, L - 4), W - boxW - 4);
    const by = avoidOverlap(bx, Math.min(cy + drop, H - B - boxH - 2), boxW, boxH, 1, 6, H - B - boxH - 2);
    return `
    <line x1="${cx}" y1="${cy + 6}" x2="${cx}" y2="${by}" stroke="#D9A88F" stroke-width="1"/>
    <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="6" fill="#FFF4F0" stroke="#EBC7B4" stroke-width="1"/>
    <text x="${bx + boxW / 2}" y="${by + 12}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#8a5a3f">${esc(p.label)}</text>
    <text x="${bx + boxW / 2}" y="${by + 23}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="700" fill="#D97856">${p.pct}%</text>`;
  }).join("");

  // Date ticks across both series, thinned so near-identical dates don't collide.
  const ticks = [...new Map(all.map(p => [p.t, p.date])).entries()].sort((a, b) => a[0] - b[0]);
  let lastTickX = -Infinity;
  const xlabels = ticks.filter(([t]) => {
    if (x(t) - lastTickX < 52) return false;
    lastTickX = x(t);
    return true;
  }).map(([t, label]) => `
    <text x="${x(t)}" y="${H - 12}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11.5" font-weight="700" fill="#633FA0">${esc(label)}</text>`).join("");

  return `<svg class="evo-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Autonomous accuracy over time: LogRocket versus ${esc(competitorName)}">
    <defs><linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8548FF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#8548FF" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${gridlines}${legend}
    <path d="${lrArea}" fill="url(#evoFill)"/>
    ${compPath ? `<path d="${compPath}" fill="none" stroke="#D97856" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round"/>` : ""}
    <path d="${lrPath}" fill="none" stroke="#5B2BC4" stroke-width="3.5" stroke-linecap="round"/>
    ${compDots}${compLabels}${lrDots}${lrLabels}${xlabels}
  </svg>`;
}

const TEAMS = [
  { role: "Engineering", glyph: "&lt;/&gt;", title: "Fix the actual bug", p: "Source-mapped errors, console, and network in the same replay." },
  { role: "Product", glyph: "◱", title: "See what converts", p: "Funnels, cohorts, and feature adoption tied to real sessions." },
  { role: "Design / UX", glyph: "✎", title: "Watch the struggle", p: "Rage clicks, dead clicks, and heatmaps across journeys." },
  { role: "Support", glyph: "☎", title: "Reproduce instantly", p: "Jump to the exact session behind any ticket." },
  { role: "Growth", glyph: "↗", title: "Move the metric", p: "A/B impact and drop-off, quantified without engineering." },
];

export function buildGuideHtml({ guide, competitor, customer, dateStamp }) {
  const g = guide || {};
  const comp = esc(competitor || "the competitor");

  const ledeLr = g.lede_logrocket || g.headline || g.overview || "";
  const ledeThem = g.lede_competitor || "";
  const exampleQ = g.ai_example_question || "";

  const aiBullets = (Array.isArray(g.ai_bullets) ? g.ai_bullets : []).map(b =>
    `<li><span class="pt">${PIP_CHECK}</span><span>${escBold(b)}</span></li>`).join("");
  const compAiBullets = (Array.isArray(g.competitor_ai_bullets) ? g.competitor_ai_bullets : []).map((b, i) =>
    `<li><span class="pt ${i < 2 ? "no" : ""}">${i < 2 ? PIP_X : PIP_CHECK}</span><span>${escBold(b)}</span></li>`).join("");

  const compTimeline = (Array.isArray(g.competitor_ai_timeline) ? g.competitor_ai_timeline : []).slice(0, 4);
  const evoChart = buildEvolutionChart(
    Array.isArray(g.ai_timeline) ? g.ai_timeline : [],
    compTimeline,
    comp
  );
  const evoPlotted = compTimeline.some(s => Number.isFinite(Number(s.pct)));

  const integrationList = Array.isArray(g.integrations) ? g.integrations : [];
  const integrationChips = integrationList.map(i => `
    <span class="integ-chip ${i.supported ? "yes" : "no"}">
      <span class="pip">${i.supported ? PIP_CHECK : PIP_X}</span>
      <span>${esc(i.name)}</span>
      ${i.note ? `<span class="note">${esc(i.note)}</span>` : ""}
    </span>`).join("");

  const dataSourceList = Array.isArray(g.data_sources) ? g.data_sources : [];
  const dataTiles = dataSourceList.map(d => `
    <div class="source-tile">
      <div class="glyph">◆</div>
      <h4>${esc(d.name)}</h4>
      <p>${esc(d.note || "")}</p>
      <div class="cover">
        <span class="${d.logrocket ? "yes" : "no"}"><span class="pip">${d.logrocket ? PIP_CHECK : PIP_X}</span>LogRocket</span>
        <span class="${d.competitor ? "yes" : "no"}"><span class="pip">${d.competitor ? PIP_CHECK : PIP_X}</span>${comp}</span>
      </div>
    </div>`).join("");

  const rows = (Array.isArray(g.feature_comparison) ? g.feature_comparison : []).map(r => `
    <tr>
      <td class="cap">${esc(r.feature)}</td>
      <td class="lr-col">${markCell(r.logrocket_mark, r.logrocket, true)}</td>
      <td>${markCell(r.competitor_mark, r.competitor, false)}</td>
    </tr>`).join("");

  const teams = TEAMS.map(t => `
    <div class="team-chip">
      <div class="glyph">${t.glyph}</div>
      <div class="role">${t.role}</div>
      <h4>${t.title}</h4>
      <p>${t.p}</p>
    </div>`).join("");

  const wins = (Array.isArray(g.customer_examples) ? g.customer_examples : []).slice(0, 2).map(ex => {
    const stats = (Array.isArray(ex.stats) ? ex.stats : []).slice(0, 3).map(s =>
      `<div class="win-stat"><div class="num">${esc(s.num)}</div><div class="lbl">${esc(s.label)}</div></div>`).join("");
    const badge = (ex.name || "?").trim().charAt(0).toUpperCase();
    return `
    <div class="win-card">
      <div class="win-head">
        <div class="win-brand"><span class="badge">${esc(badge)}</span>${esc(ex.name || "Customer")}</div>
        ${ex.profile ? `<span class="win-tag">${esc(ex.profile)}</span>` : ""}
      </div>
      ${ex.quote ? `<div class="win-quote">${esc(ex.quote)}</div>` : ""}
      ${ex.outcome ? `<div class="win-out">${esc(ex.outcome)}</div>` : ""}
      ${ex.replaced ? `<span class="win-replaced"><span>✕</span> Replaced ${esc(ex.replaced)}</span>` : ""}
      ${stats ? `<div class="win-stats">${stats}</div>` : ""}
    </div>`;
  }).join("");


  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>LogRocket vs ${comp} — Competitive Brief</title>
<style>${TOKENS}${COMPONENT_CSS}</style>
</head><body>
<div class="page">
  <div class="meta">
    <div class="lockup">${LOGO_SVG}<span class="pipe"></span><span class="label">Competitive Brief</span></div>
    <div class="stamp">${esc(customer ? `Prepared for ${customer}` : "")}${customer && dateStamp ? "  ·  " : ""}${esc(dateStamp || "")}</div>
  </div>

  <section class="hero">
    <span class="eyebrow"><span class="dot"></span>LogRocket vs ${comp}</span>
    <div class="versus">
      <div class="name lr">LogRocket</div>
      <div class="vs">vs</div>
      <div class="name them">${comp}</div>
    </div>
    <div class="lede">
      <div class="lede-col lr" style="grid-column:1">
        <h3><span class="tag">LogRocket</span>The full picture, on one platform.</h3>
        <p>${esc(ledeLr)}</p>
      </div>
      <div class="lede-col them" style="grid-column:3">
        <h3><span class="tag">${comp}</span>Where it stops short.</h3>
        <p>${esc(ledeThem)}</p>
      </div>
    </div>
  </section>

  <section>
    <div class="section-eyebrow"><span class="num">01</span>AI Assistants</div>
    <h2 class="section-title">Ask <em>Galileo</em> connects behavior to the code. ${comp} AI stops at the behavior.</h2>
    <div class="ai">
      <div class="ai-card lr">
        <div class="ai-head"><div class="ai-glyph">✦</div><div class="ai-name"><small>LogRocket</small>Ask Galileo</div></div>
        <div class="ai-prompt">${exampleQ ? `<span class="you">you ›</span>${esc(exampleQ)}` : ""}</div>
        <div class="ai-answer">${escBold(g.ai_example_lr_answer || "")}</div>
        <div class="ai-bullets"><ul>${aiBullets}</ul></div>
        <div class="ai-foot">→ <a href="${esc("https://www.linkedin.com/posts/matthew-arbesfeld-04b5429b_aakash-gupta-evaluated-logrocket-vs-posthog-share-7462578059741859840-yt4l/")}">See the independent AI-accuracy evaluation</a></div>
      </div>
      <div class="ai-card them">
        <div class="ai-head"><div class="ai-glyph">●</div><div class="ai-name"><small>${comp}</small>${comp} AI</div></div>
        <div class="ai-prompt">${exampleQ ? `<span class="you">you ›</span>${esc(exampleQ)}` : ""}</div>
        <div class="ai-answer">${escBold(g.ai_example_competitor_answer || "")}</div>
        <div class="ai-bullets"><ul>${compAiBullets}</ul></div>
        <div class="ai-foot is-spacer"></div>
      </div>
    </div>
  </section>

  <section>
    <div class="section-eyebrow"><span class="num">02</span>AI Agent Evolution</div>
    <h2 class="section-title">LogRocket shipped autonomy while ${comp} shipped summaries.</h2>
    <div class="evo">
      ${evoChart}
      <p class="evo-foot">GA agent releases only — betas and previews excluded. Autonomous accuracy — the share of questions the agent answers to a correct root cause unaided. LogRocket figures are measured internally.${evoPlotted ? ` ${comp} is indicative, inferred from what its agent could verifiably do at each release.` : ` ${comp} has no comparable GA AI agent release on record.`}</p>
    </div>
  </section>

  ${dataTiles ? `<section>
    <div class="section-eyebrow"><span class="num">03</span>One Reasoning Layer</div>
    <h2 class="section-title">Galileo reasons across <em>every</em> data source. ${comp} sees a slice.</h2>
    <div class="sources-grid" style="grid-template-columns:repeat(${Math.min(Math.max(dataSourceList.length, 1), 5)},1fr)">${dataTiles}</div>
    ${integrationChips ? `<div class="integrations">
      <h5>Integrated with your stack</h5>
      <div class="integ-chips">${integrationChips}</div>
    </div>` : ""}
  </section>` : ""}

  ${rows ? `<section>
    <div class="section-eyebrow"><span class="num">04</span>Capability Matrix</div>
    <h2 class="section-title">Side by side, where it counts.</h2>
    <div class="matrix"><table>
      <thead><tr><th>Capability</th><th class="lr-col">LogRocket</th><th>${comp}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>` : ""}

  <section>
    <div class="section-eyebrow"><span class="num">05</span>Built for every team</div>
    <h2 class="section-title">One tool the whole team actually uses.</h2>
    <div class="teams-row">${teams}</div>
  </section>

  ${wins ? `<section>
    <div class="section-eyebrow"><span class="num">06</span>Customer proof</div>
    <h2 class="section-title">Teams that chose LogRocket.</h2>
    <div class="wins">${wins}</div>
  </section>` : ""}

  ${g.tldr ? `<section class="tldr">
    <div class="tldr-trophy">🏆</div>
    <div>
      <h3>The verdict: <span class="winner">LogRocket</span></h3>
      <p>${esc(g.tldr)}</p>
    </div>
  </section>` : ""}

  <div class="footnote">
    <span>LogRocket · Confidential — internal &amp; customer use</span>
    <span>Verify claims against sources before sharing externally.</span>
  </div>
</div>
</body></html>`;
}

// ─── One-click PDF download ───────────────────────────────────────────────────

const RENDER_W = 1240;   // matches .page max-width so layout is identical to print
const CAPTURE_SCALE = 2; // 2x for crisp text on retina / when zoomed

// Pack the one-pager's top-level blocks into page-sized slices, breaking between
// blocks rather than through them so cards/sections never split across pages.
function computePageSlices(blocks, pageH, totalH) {
  const slices = [];
  let cursor = 0;
  let i = 0;
  while (cursor < totalH - 2) {
    let end = -1;
    while (i < blocks.length && blocks[i].bottom - cursor <= pageH) {
      end = blocks[i].bottom;
      i += 1;
    }
    if (end <= cursor) {
      // A single block is taller than one page — hard-cut it.
      end = Math.min(cursor + pageH, totalH);
      while (i < blocks.length && blocks[i].bottom <= end) i += 1;
    }
    if (i >= blocks.length) end = totalH; // let the last page run to the end
    slices.push([cursor, Math.min(end, totalH)]);
    cursor = end;
  }
  return slices.length ? slices : [[0, totalH]];
}

export async function downloadGuidePdf({ guide, competitor, customer, dateStamp, fileName }) {
  const html = buildGuideHtml({ guide, competitor, customer, dateStamp });

  // Render the exact print document offscreen at full width.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${RENDER_W}px;height:600px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(frame);

  try {
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.srcdoc = html;
    });

    const doc = frame.contentDocument;

    // Let web fonts and layout settle before measuring/capturing.
    try { await doc.fonts.ready; } catch { /* fonts API unavailable */ }
    await new Promise(r => setTimeout(r, 350));

    const totalH = Math.ceil(doc.documentElement.scrollHeight);
    frame.style.height = `${totalH}px`;
    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(doc.body, {
      scale: CAPTURE_SCALE,
      width: RENDER_W,
      height: totalH,
      windowWidth: RENDER_W,
      windowHeight: totalH,
      backgroundColor: "#F9F6F5",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const imgW = pw - margin * 2;
    const cssToPt = imgW / RENDER_W;                     // css px → pdf pt
    const pageHcss = Math.floor((ph - margin * 2) / cssToPt);

    // Block boundaries (css px) for clean page breaks.
    const blocks = [...doc.querySelectorAll(".page > *")].map(el => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.ceil(r.bottom) };
    });

    const slices = computePageSlices(blocks, pageHcss, totalH);
    const pxPerCss = canvas.height / totalH;             // ≈ CAPTURE_SCALE

    slices.forEach(([startCss, endCss], idx) => {
      const sy = Math.round(startCss * pxPerCss);
      const sh = Math.max(1, Math.round((endCss - startCss) * pxPerCss));
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext("2d");
      ctx.fillStyle = "#F9F6F5";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      if (idx > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.93), "JPEG", margin, margin, imgW, sh / pxPerCss * cssToPt);
    });

    pdf.save(fileName);
    return { pages: slices.length };
  } finally {
    frame.remove();
  }
}
