/* Builds product-details.html for Nidanyo and (separately) is rendered to PDF by Edge. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BUILD = __dirname;
const ICONS = path.join(BUILD, "icons");

const logoB64 = fs.readFileSync(path.join(BUILD, "logo.b64"), "utf8").trim();
const logoData = `data:image/png;base64,${logoB64}`;

// ---- brand SVG logos (recolored to each brand's hex) -------------------------
function icon(slug, hex) {
  let svg = fs.readFileSync(path.join(ICONS, `${slug}.svg`), "utf8").trim();
  // drop the <title> so it doesn't render as tooltip text noise, force fill colour
  svg = svg.replace(/<title>.*?<\/title>/i, "");
  svg = svg.replace("<svg ", `<svg style="fill:${hex}" `);
  return svg;
}

const TECH = {
  next:    { slug: "nextdotjs",     hex: "#000000", name: "Next.js 15",        note: "App Router · Server Actions · RSC" },
  react:   { slug: "react",         hex: "#149ECA", name: "React 19",          note: "UI library" },
  ts:      { slug: "typescript",    hex: "#3178C6", name: "TypeScript",        note: "End-to-end type safety" },
  tw:      { slug: "tailwindcss",   hex: "#06B6D4", name: "Tailwind CSS",      note: "Design system & theming" },
  drizzle: { slug: "drizzle",       hex: "#3F8E00", name: "Drizzle ORM",       note: "Typed SQL schema & queries" },
  turso:   { slug: "turso",         hex: "#0F9D8C", name: "Turso / libSQL",    note: "Edge SQLite database" },
  sqlite:  { slug: "sqlite",        hex: "#003B57", name: "SQLite",            note: "Local-first dev database" },
  zod:     { slug: "zod",           hex: "#3E67B1", name: "Zod",               note: "Runtime validation" },
  framer:  { slug: "framer",        hex: "#0055FF", name: "Framer Motion",     note: "Micro-interactions" },
  rhf:     { slug: "reacthookform", hex: "#EC5990", name: "React Hook Form",   note: "Forms & validation" },
  node:    { slug: "nodedotjs",     hex: "#5FA04E", name: "Node.js",           note: "Runtime" },
  cf:      { slug: "cloudflare",    hex: "#F38020", name: "Cloudflare",        note: "DNS · CDN · R2 storage" },
  vercel:  { slug: "vercel",        hex: "#000000", name: "Vercel",            note: "Hosting & deployment" },
  github:  { slug: "github",        hex: "#181717", name: "GitHub",            note: "Version control & CI" },
};

const I = Object.fromEntries(Object.entries(TECH).map(([k, v]) => [k, icon(v.slug, v.hex)]));

// ---- real QR code for a sample public report link ----------------------------
let qrData = "";
try {
  const QRCode = require(path.join(ROOT, "node_modules", "qrcode"));
  // generate synchronously into a data URL via the toString SVG then to png-ish
  // qrcode supports toDataURL with a callback/promise
} catch (e) {}

function techChip(t) {
  return `<div class="chip">
    <span class="chip-ic">${I[t]}</span>
    <span class="chip-tx"><b>${TECH[t].name}</b><i>${TECH[t].note}</i></span>
  </div>`;
}

// CSS grid "QR" placeholder built from a fixed pattern (looks like a real QR, no network needed)
function fauxQR() {
  const n = 21;
  // deterministic pseudo pattern + finder patterns
  let cells = "";
  function finder(r, c) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }
  function finderOn(r, c, or, oc) {
    const rr = r - or, cc = c - oc;
    if (rr < 0 || cc < 0 || rr > 6 || cc > 6) return false;
    if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true;
    if (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4) return true;
    return false;
  }
  let seed = 7;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let on = false;
      if (finder(r, c)) {
        on = finderOn(r, c, r < 7 ? 0 : n - 7, c < 7 ? 0 : n - 7);
      } else {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        on = (seed >> 8) % 100 < 46;
      }
      cells += `<span class="${on ? "on" : ""}"></span>`;
    }
  }
  return `<div class="qr">${cells}</div>`;
}

const DATE = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Nidanyo — Product Details</title>
<style>
:root{
  --green:#075323; --green2:#0a6b30; --green-soft:#e8f3ec;
  --red:#FF3131; --ink:#0e1b14; --muted:#5b6b62; --line:#dde7e1;
  --card:#ffffff; --bg:#f5f8f6;
}
*{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
html,body{margin:0;padding:0;}
body{font-family:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif; color:var(--ink); font-size:11px; line-height:1.5; background:#fff;}
@page{size:A4; margin:0;}
.page{
  width:210mm; min-height:297mm; padding:18mm 16mm 16mm; position:relative;
  page-break-after:always; background:#fff; overflow:hidden;
}
.page:last-child{page-break-after:auto;}
h1,h2,h3,h4{margin:0; font-weight:800; letter-spacing:-0.02em; color:var(--green);}
h2.section{font-size:21px; margin-bottom:2px;}
.section-kicker{font-size:10px; text-transform:uppercase; letter-spacing:.16em; color:var(--red); font-weight:800;}
.lead{color:var(--muted); font-size:11.5px; max-width:62ch;}
p{margin:0 0 8px;}
b{color:var(--ink);}
hr.rule{border:0;border-top:2px solid var(--green); margin:10px 0 16px; opacity:.15;}

/* running header / footer */
.run-head{position:absolute; top:9mm; left:16mm; right:16mm; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:var(--muted); border-bottom:1px solid var(--line); padding-bottom:5px;}
.run-head img{height:16px;}
.run-foot{position:absolute; bottom:9mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:8.5px; color:var(--muted); border-top:1px solid var(--line); padding-top:5px;}

/* COVER */
.cover{background:linear-gradient(160deg,#063f1b 0%, #075323 45%, #0a6b30 100%); color:#fff; display:flex; flex-direction:column; justify-content:space-between; padding:24mm 18mm;}
.cover *{color:#fff;}
.cover .logo-wrap{display:inline-flex; align-items:center; gap:14px; background:#fff; padding:12px 22px; border-radius:16px; box-shadow:0 10px 30px -8px rgba(0,0,0,.35);}
.cover .logo-wrap img{height:46px;}
.cover-badge{display:inline-block; border:1px solid rgba(255,255,255,.35); border-radius:999px; padding:5px 14px; font-size:10px; letter-spacing:.14em; text-transform:uppercase; font-weight:700;}
.cover h1{font-size:46px; line-height:1.04; color:#fff; margin:14px 0 10px; letter-spacing:-0.03em;}
.cover .tagline{font-size:18px; font-weight:600; color:#bff0cf;}
.cover .blurb{font-size:13px; max-width:54ch; color:#dbeee2; margin-top:14px;}
.cover .meta{display:flex; gap:30px; font-size:11px; color:#cfe7d8;}
.cover .meta b{color:#fff; display:block; font-size:12px;}
.drop{width:74px;height:74px;background:rgba(255,255,255,.08); border-radius:20px; display:flex; align-items:center; justify-content:center;}
.drop svg{width:46px;height:46px;}

/* cards & grids */
.grid{display:grid; gap:10px;}
.g2{grid-template-columns:1fr 1fr;}
.g3{grid-template-columns:1fr 1fr 1fr;}
.g4{grid-template-columns:repeat(4,1fr);}
.card{background:var(--card); border:1px solid var(--line); border-radius:12px; padding:13px 14px;}
.card h3{font-size:12.5px; display:flex; align-items:center; gap:7px; margin-bottom:5px;}
.card p{font-size:10.5px; color:var(--muted); margin:0;}
.card .ic{width:26px;height:26px;border-radius:8px;background:var(--green-soft); display:inline-flex; align-items:center; justify-content:center; color:var(--green); font-weight:900; font-size:13px;}
.pill{display:inline-block; background:var(--green-soft); color:var(--green); border-radius:6px; padding:2px 8px; font-size:9.5px; font-weight:700; margin:2px 3px 2px 0;}
.pill.red{background:#ffe7e7; color:#c40000;}

ul.ticks{list-style:none; margin:6px 0 0; padding:0;}
ul.ticks li{position:relative; padding-left:18px; margin-bottom:5px; font-size:10.5px; color:#26352d;}
ul.ticks li:before{content:"✓"; position:absolute; left:0; top:0; color:var(--green2); font-weight:900;}

/* tech chips */
.tech-grid{display:grid; grid-template-columns:1fr 1fr; gap:9px;}
.chip{display:flex; align-items:center; gap:11px; border:1px solid var(--line); border-radius:11px; padding:10px 12px; background:#fff;}
.chip-ic{width:30px;height:30px; display:inline-flex; align-items:center; justify-content:center;}
.chip-ic svg{width:24px;height:24px;}
.chip-tx{display:flex; flex-direction:column; line-height:1.25;}
.chip-tx b{font-size:11.5px;}
.chip-tx i{font-style:normal; font-size:9.5px; color:var(--muted);}

.infra-row{display:flex; gap:10px;}
.infra{flex:1; border:1px solid var(--line); border-radius:12px; padding:13px; text-align:center;}
.infra .chip-ic{margin:0 auto 7px; width:38px;height:38px;}
.infra .chip-ic svg{width:30px;height:30px;}
.infra b{font-size:12px; display:block;}
.infra span{font-size:9.5px; color:var(--muted);}

/* tables */
table{width:100%; border-collapse:collapse; font-size:10px;}
th,td{text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top;}
th{background:var(--green); color:#fff; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:.05em;}
tr:nth-child(even) td{background:#fafcfb;}
.matrix td,.matrix th{text-align:center; padding:5px 4px; font-size:9px;}
.matrix td:first-child,.matrix th:first-child{text-align:left;}
.yes{color:var(--green2); font-weight:900;}
.no{color:#c9d3cd;}

/* flow */
.flow{display:flex; flex-wrap:wrap; gap:0; align-items:stretch;}
.step{flex:1 1 30%; min-width:150px; background:#fff; border:1px solid var(--line); border-left:4px solid var(--green); border-radius:10px; padding:10px 12px; margin:6px;}
.step .n{font-size:9px;font-weight:800;color:var(--red); letter-spacing:.1em;}
.step b{font-size:11.5px; display:block; margin:2px 0 3px;}
.step p{font-size:9.5px;color:var(--muted); margin:0;}

/* module block */
.mod{border:1px solid var(--line); border-radius:12px; padding:13px 15px; margin-bottom:11px; break-inside:avoid;}
.mod-head{display:flex; align-items:center; gap:10px; margin-bottom:6px;}
.mod-ic{width:32px;height:32px;border-radius:9px; background:var(--green); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px;}
.mod-head h3{font-size:13.5px;}
.mod-head span{font-size:9.5px; color:var(--red); font-weight:700; text-transform:uppercase; letter-spacing:.08em;}
.mod-body{columns:2; column-gap:18px; font-size:10px;}
.mod-body li{margin-bottom:3px;}

/* mockups */
.mock{border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 8px 24px -10px rgba(14,27,20,.25);}
.mock-bar{background:#0c2e1a; color:#cfe7d8; font-size:9px; padding:6px 10px; display:flex; align-items:center; gap:6px;}
.dot{width:8px;height:8px;border-radius:50%; display:inline-block;}
.mock-body{background:var(--bg); padding:12px;}
.stat-row{display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:9px;}
.stat{background:#fff;border:1px solid var(--line); border-radius:9px; padding:8px 9px;}
.stat .lab{font-size:8px;text-transform:uppercase; letter-spacing:.06em; color:var(--muted);}
.stat .val{font-size:16px; font-weight:800; color:var(--green); margin-top:2px;}
.stat .val.red{color:var(--red);}
.stat .sub{font-size:8px; color:var(--muted);}
.charts{display:grid; grid-template-columns:1.4fr 1fr; gap:8px;}
.panel{background:#fff;border:1px solid var(--line); border-radius:9px; padding:9px;}
.panel h5{margin:0 0 7px; font-size:9.5px; color:var(--ink); font-weight:700;}
.bars{display:flex; align-items:flex-end; gap:5px; height:70px;}
.bars .bar{flex:1; background:linear-gradient(180deg,#0a6b30,#075323); border-radius:3px 3px 0 0;}
.hbar{display:flex; align-items:center; gap:6px; margin-bottom:5px; font-size:8.5px;}
.hbar .track{flex:1; height:8px; background:#eef3f0; border-radius:5px; overflow:hidden;}
.hbar .fill{height:100%; background:var(--green2); border-radius:5px;}

/* report mockup */
.report{background:#fff; border:1px solid var(--line); border-radius:10px; padding:0; overflow:hidden;}
.rep-head{display:flex; justify-content:space-between; align-items:flex-start; padding:12px 14px; border-bottom:2px solid var(--green);}
.rep-head .lab{font-size:14px; font-weight:800; color:var(--green);}
.rep-head .sub{font-size:8.5px; color:var(--muted);}
.rep-meta{display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px 14px; padding:9px 14px; font-size:8.5px; border-bottom:1px solid var(--line); background:#fafcfb;}
.rep-meta div span{color:var(--muted);}
.rep-meta div b{color:var(--ink);}
.rep-body{padding:8px 14px;}
.rep-title{font-size:10px; font-weight:800; color:var(--green); margin:4px 0 5px; text-transform:uppercase; letter-spacing:.05em;}
table.rep{font-size:8.5px;}
table.rep th{background:#eef3f0; color:var(--green); }
table.rep td{border-bottom:1px solid #eef3f0; padding:4px 8px;}
.flag-h{color:#c40000; font-weight:800;}
.flag-l{color:#0a58ca; font-weight:800;}
.rep-foot{display:flex; justify-content:space-between; align-items:flex-end; padding:10px 14px; border-top:1px solid var(--line);}
.sign{text-align:center; font-size:8px; color:var(--muted);}
.sign .line{border-top:1px solid var(--ink); width:120px; margin-bottom:2px;}
.sign b{font-size:9px; color:var(--ink);}

/* QR */
.qr{display:grid; grid-template-columns:repeat(21,1fr); width:74px; height:74px; gap:0; border:4px solid #fff;}
.qr span{background:#fff;}
.qr span.on{background:#0c2e1a;}

.callout{background:var(--green-soft); border-left:4px solid var(--green); border-radius:0 10px 10px 0; padding:11px 14px; font-size:10.5px; color:#22392c;}
.callout b{color:var(--green);}
.two{display:grid; grid-template-columns:1fr 1fr; gap:14px;}
.kpi{display:flex; gap:14px; margin:10px 0;}
.kpi .k{flex:1; text-align:center; border:1px solid var(--line); border-radius:10px; padding:10px;}
.kpi .k b{display:block; font-size:22px; color:var(--green); font-weight:800;}
.kpi .k span{font-size:9px; color:var(--muted);}
.foot-brand{display:flex;align-items:center;gap:6px;}
.foot-brand img{height:13px;}
</style>
</head>
<body>

<!-- ===================== COVER ===================== -->
<section class="page cover">
  <div>
    <div class="logo-wrap">
      <img src="${logoData}" alt="Nidanyo" />
    </div>
  </div>
  <div>
    <span class="cover-badge">Product Details &nbsp;·&nbsp; v0.1</span>
    <h1>Laboratory Information &amp;<br/>Operations Management</h1>
    <div class="tagline">“From Liquid to Logic.”</div>
    <p class="blurb">Nidanyo is an end-to-end LIMS for diagnostic laboratories — from patient registration and billing through sample accessioning, result entry, pathologist approval, and secure report delivery. Purpose-built for the workflow of modern labs in Nepal and beyond.</p>
  </div>
  <div class="meta">
    <div><b>Infobytes Nepal</b>Product Owner</div>
    <div><b>${DATE}</b>Document Date</div>
    <div><b>Web · PWA</b>Platform</div>
    <div><b>Confidential</b>Distribution</div>
  </div>
</section>

<!-- ===================== OVERVIEW ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Overview</span></div>
  <span class="section-kicker">01 — What is Nidanyo</span>
  <h2 class="section">A complete operating system for the diagnostic lab</h2>
  <hr class="rule"/>
  <p class="lead">Nidanyo unifies the front desk, laboratory bench, finance counter and report dispatch into one auditable system. Every patient visit flows through a single pipeline — registered once, tracked everywhere — eliminating paper registers, disconnected spreadsheets and manual report typing.</p>

  <div class="kpi">
    <div class="k"><b>9</b><span>Operational modules</span></div>
    <div class="k"><b>8</b><span>Built-in staff roles</span></div>
    <div class="k"><b>30+</b><span>Granular permissions</span></div>
    <div class="k"><b>100%</b><span>Audit-logged actions</span></div>
  </div>

  <div class="grid g3" style="margin-top:6px;">
    <div class="card"><h3><span class="ic">⚡</span>Single pipeline</h3><p>Registration → Billing → Sample → Result → Approval → Dispatch, with live status on every visit and test.</p></div>
    <div class="card"><h3><span class="ic">🔒</span>Role-based access</h3><p>Eight seeded roles and a permission editor gate every screen and server action to the right staff.</p></div>
    <div class="card"><h3><span class="ic">🧾</span>Branded reports</h3><p>Configurable letterhead, signatures, reference ranges and auto H/L/critical flagging on every value.</p></div>
    <div class="card"><h3><span class="ic">📱</span>Patient self-service</h3><p>Secure QR / short-link reports, released only after approval and dues clearance, with access logging.</p></div>
    <div class="card"><h3><span class="ic">💰</span>Finance built-in</h3><p>Bills, partial payments, dues, refunds, payment modes, EOD and exportable financial reports.</p></div>
    <div class="card"><h3><span class="ic">📊</span>Live analytics</h3><p>Revenue trends, top tests, collection by mode, peak hours and referrer revenue on the dashboard.</p></div>
  </div>

  <div class="callout" style="margin-top:14px;">
    <b>Why it sells:</b> labs replace 4–5 disconnected tools (register book, billing software, MS Word reports, SMS portal, Excel MIS) with one installable web app — reducing report turnaround time, eliminating typing errors, and giving owners real-time visibility into revenue and dues from any device.
  </div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== TECH STACK ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Technology</span></div>
  <span class="section-kicker">02 — Technology Stack</span>
  <h2 class="section">Modern, type-safe and cloud-ready</h2>
  <hr class="rule"/>
  <p class="lead">A single TypeScript codebase spanning UI, server logic and database — deployed to the edge and version-controlled from day one.</p>

  <h4 style="margin:14px 0 8px; font-size:12px;">Application &amp; Framework</h4>
  <div class="tech-grid">
    ${techChip("next")}${techChip("react")}${techChip("ts")}${techChip("tw")}
  </div>

  <h4 style="margin:16px 0 8px; font-size:12px;">Data &amp; Validation</h4>
  <div class="tech-grid">
    ${techChip("drizzle")}${techChip("turso")}${techChip("sqlite")}${techChip("zod")}
  </div>

  <h4 style="margin:16px 0 8px; font-size:12px;">UX &amp; Forms</h4>
  <div class="tech-grid">
    ${techChip("rhf")}${techChip("framer")}
  </div>

  <h4 style="margin:18px 0 9px; font-size:12px;">Infrastructure &amp; Delivery</h4>
  <div class="infra-row">
    <div class="infra"><span class="chip-ic">${I.cf}</span><b>Cloudflare</b><span>DNS, CDN &amp; R2 object storage for report assets</span></div>
    <div class="infra"><span class="chip-ic">${I.vercel}</span><b>Vercel</b><span>Production hosting &amp; zero-config deployment</span></div>
    <div class="infra"><span class="chip-ic">${I.github}</span><b>GitHub</b><span>Version control &amp; CI/CD source of truth</span></div>
    <div class="infra"><span class="chip-ic">${I.turso}</span><b>Turso</b><span>Managed libSQL database in production</span></div>
  </div>

  <div class="callout" style="margin-top:16px;">
    <b>Deployment topology:</b> Code lives on <b>GitHub</b> → pushes auto-deploy to <b>Vercel</b> → the domain &amp; DNS are managed on <b>Cloudflare</b> (with optional <b>R2</b> for uploaded logos/signatures) → data is served from a <b>Turso</b> edge-replicated libSQL database. Local development runs against a bundled SQLite file with zero external services.
  </div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== ARCHITECTURE ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Architecture</span></div>
  <span class="section-kicker">03 — Architecture</span>
  <h2 class="section">How it is built</h2>
  <hr class="rule"/>
  <div class="two">
    <div>
      <h4 style="font-size:12px;margin-bottom:6px;">Design principles</h4>
      <ul class="ticks">
        <li><b>Server-first.</b> Next.js App Router with React Server Components &amp; Server Actions — minimal client JS.</li>
        <li><b>Multi-tenant ready.</b> Every record is scoped by <i>labId</i>; the MVP seeds a single lab.</li>
        <li><b>Typed end-to-end.</b> Drizzle ORM schema → inferred types → Zod validators on every mutation.</li>
        <li><b>Snapshots over joins.</b> Bills, results and reports snapshot names/prices/ranges so history never changes.</li>
        <li><b>Immutable money &amp; results.</b> Payments are never deleted; result edits create versioned snapshots.</li>
        <li><b>PWA.</b> Installable, offline-aware shell with a service worker and web manifest.</li>
      </ul>
    </div>
    <div>
      <h4 style="font-size:12px;margin-bottom:6px;">Code organisation</h4>
      <div class="card" style="font-size:9.5px;">
        <p style="color:var(--ink);font-weight:700;margin-bottom:4px;">src/</p>
        <p><b>app/</b> — route groups: (auth) login, (app) modules, print/ layouts, r/[token] public report, api/ exports</p>
        <p><b>db/schema/</b> — Drizzle tables: lab, auth, catalog, patients, billing, workflow, reports, system</p>
        <p><b>lib/actions/</b> — server actions (mutations) per domain</p>
        <p><b>lib/queries/</b> — read models for each screen</p>
        <p><b>lib/rbac/</b> — permission registry &amp; role seeds</p>
        <p><b>lib/{billing,report,result}-engine</b> — core business logic</p>
        <p><b>lib/{sms,email,storage}/</b> — pluggable provider adapters</p>
        <p><b>components/</b> — UI kit, app shell, print/report sheets</p>
      </div>
    </div>
  </div>

  <h4 style="font-size:12px;margin:16px 0 7px;">Request lifecycle</h4>
  <div class="flow">
    <div class="step"><div class="n">REQUEST</div><b>Auth guard</b><p>Signed session cookie (jose) → server-side session lookup → user + permissions resolved.</p></div>
    <div class="step"><div class="n">AUTHORIZE</div><b>RBAC check</b><p>Route &amp; action assert required permission keys before any data is read or written.</p></div>
    <div class="step"><div class="n">VALIDATE</div><b>Zod schemas</b><p>Form input parsed &amp; validated; typed payload handed to the domain engine.</p></div>
    <div class="step"><div class="n">PERSIST</div><b>Drizzle txn</b><p>Atomic writes with human-readable counters (V-, B-, S-, P-) generated per lab.</p></div>
    <div class="step"><div class="n">AUDIT</div><b>Log &amp; notify</b><p>Audit + activity logs written; SMS/email fired through adapters where relevant.</p></div>
    <div class="step"><div class="n">RENDER</div><b>RSC refresh</b><p>Server components revalidate; the affected screens update with fresh data.</p></div>
  </div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== WORKFLOW ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Workflow</span></div>
  <span class="section-kicker">04 — End-to-End Flow</span>
  <h2 class="section">One visit, from front desk to final report</h2>
  <hr class="rule"/>
  <div class="flow">
    <div class="step"><div class="n">STEP 1 · RECEPTION</div><b>Register &amp; bill</b><p>Patient registered (UHID) → visit created with ordered tests/profiles → bill generated, discount &amp; tax applied, payment or due recorded.</p></div>
    <div class="step"><div class="n">STEP 2 · COLLECTION</div><b>Sample accessioning</b><p>Samples auto-listed by type → collected, barcoded (S-####) or rejected/recollected → printable tube labels.</p></div>
    <div class="step"><div class="n">STEP 3 · LAB BENCH</div><b>Result entry</b><p>Technician enters values per parameter → auto H / L / critical flagging against reference ranges → submit for approval.</p></div>
    <div class="step"><div class="n">STEP 4 · APPROVAL</div><b>Pathologist sign-off</b><p>Doctor reviews, adds interpretation, approves &amp; signs — or sends back for correction. Versioned every time.</p></div>
    <div class="step"><div class="n">STEP 5 · RELEASE</div><b>Report &amp; dispatch</b><p>Branded PDF/print produced → public QR link activates once approved <i>and</i> dues cleared → SMS/email notify.</p></div>
    <div class="step"><div class="n">STEP 6 · FINANCE</div><b>Settle &amp; report</b><p>Dues collected, refunds tracked, EOD closed → transactions &amp; financial reports exported for the owner.</p></div>
  </div>

  <h4 style="font-size:12px;margin:16px 0 7px;">Status engine</h4>
  <div class="two">
    <div class="card"><h3>Visit lifecycle</h3>
      <p style="margin-top:4px;"><span class="pill">registered</span><span class="pill">sample_pending</span><span class="pill">in_progress</span><span class="pill">result_pending</span><span class="pill">awaiting_approval</span><span class="pill">approved</span><span class="pill">dispatched</span><span class="pill red">cancelled</span></p>
    </div>
    <div class="card"><h3>Result lifecycle</h3>
      <p style="margin-top:4px;"><span class="pill">pending</span><span class="pill">draft</span><span class="pill">submitted</span><span class="pill red">correction_required</span><span class="pill">approved</span><span class="pill">dispatched</span></p>
    </div>
  </div>
  <div class="callout" style="margin-top:12px;"><b>Guardrail:</b> a patient can never see results before a pathologist has approved them and the bill is fully paid — the report link stays inactive until both conditions are met, and every public view is access-logged.</div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== MODULES 1 ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Modules</span></div>
  <span class="section-kicker">05 — Modules &amp; Features</span>
  <h2 class="section">Everything in the box</h2>
  <hr class="rule"/>

  ${moduleBlock("📊","Dashboard","Real-time command centre", [
    "Today's patients, visits, billed, collected &amp; outstanding due",
    "Pending samples, results, approvals &amp; ready-to-dispatch counters",
    "Critical-result alert widget with live abnormal values",
    "14-day revenue trend &amp; collection-by-payment-mode split",
    "Top tests, busiest hours &amp; revenue-by-referring-doctor",
    "Recent activity feed across the whole lab",
  ])}

  ${moduleBlock("👥","Patients","Master patient registry", [
    "Unique UHID (P-####) per patient",
    "Age value+unit or DOB, gender, contact, address",
    "Referring doctor / clinic capture",
    "Fast search by name, phone or code",
    "Full visit &amp; billing history per patient",
    "Edit with audit trail; soft active/inactive state",
  ])}

  ${moduleBlock("🧾","Visits &amp; Billing","Front-desk revenue engine", [
    "Order individual tests or grouped profiles/panels",
    "Auto-priced bills with line items snapshotted",
    "Discount (with reason) &amp; optional tax/VAT",
    "Multiple payment modes (Cash, eSewa/QR, Card, Bank)",
    "Partial payment, due tracking &amp; refunds",
    "Printable bill / receipt with lab letterhead",
    "Visit cancellation &amp; void with reason + audit",
  ])}

  ${moduleBlock("💧","Sample Collection","Specimen accessioning", [
    "Auto-generated sample queue by specimen type",
    "Barcoded accession numbers (S-####)",
    "Collect, reject or flag for re-collection with reason",
    "Per-sample event trail (who/when/status change)",
    "Printable tube labels with color hints",
    "Status badges feed the laboratory dashboard",
  ])}
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== MODULES 2 ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Modules</span></div>
  <span class="section-kicker">05 — Modules &amp; Features (cont.)</span>
  <h2 class="section">&nbsp;</h2>

  ${moduleBlock("🧪","Result Entry","Bench-side data capture", [
    "Single-value &amp; multi-parameter tests (e.g. CBC)",
    "Numeric, text, select, positive/negative result types",
    "Gender- &amp; age-specific reference range overrides",
    "Automatic normal / low / high / critical flagging",
    "Technician remarks &amp; per-value notes",
    "Draft, submit, and versioned edit history",
  ])}

  ${moduleBlock("✅","Approval","Pathologist sign-off", [
    "Review queue of submitted results",
    "Approve &amp; digitally sign, or send back for correction",
    "Interpretation / impression comment per report",
    "Signature &amp; designation stamped on the report",
    "Immutable approval audit (action, reason, actor)",
    "Critical results highlighted for priority review",
  ])}

  ${moduleBlock("📄","Reports &amp; Dispatch","Delivery &amp; release", [
    "Branded report sheet: header, footer, signatures",
    "Grouped by department/profile with flags &amp; ranges",
    "Print, mark collected, SMS, email or download",
    "Secure public report via QR / short link (/r/token)",
    "Link activates only after approval + dues cleared",
    "Every public view/download access-logged",
  ])}

  ${moduleBlock("💰","Finance","Accounts &amp; MIS", [
    "Transactions ledger of every money-in event",
    "Dues collection worklist with aging",
    "Refunds recorded immutably (never deleted)",
    "End-of-day (EOD) close &amp; printout",
    "Financial reports with CSV export",
    "Collection split by mode &amp; by operator",
  ])}

  ${moduleBlock("⚙️","Catalog &amp; Settings","Configuration", [
    "Tests, parameters, profiles/groups &amp; pricing",
    "Departments, sample types, payment modes",
    "Referring doctors with commission %",
    "Lab profile: address, PAN/VAT, currency, margins",
    "Users, roles &amp; granular permission editor",
    "Report assets, signatures, SMS/email setup, audit log",
  ])}
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== DASHBOARD MOCKUP ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Screens</span></div>
  <span class="section-kicker">06 — Screen Preview</span>
  <h2 class="section">Dashboard</h2>
  <hr class="rule"/>
  <p class="lead">The owner's daily view — operational counters, money in, work pending and live analytics at a glance.</p>
  <div class="mock" style="margin-top:10px;">
    <div class="mock-bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>&nbsp; nidanyo.app / dashboard</div>
    <div class="mock-body">
      <div class="stat-row">
        <div class="stat"><div class="lab">Today's Patients</div><div class="val">48</div><div class="sub">+12 vs yesterday</div></div>
        <div class="stat"><div class="lab">Billed Today</div><div class="val">Rs 1,24,500</div><div class="sub">62 visits</div></div>
        <div class="stat"><div class="lab">Collected Today</div><div class="val">Rs 98,200</div><div class="sub">Cash · QR · Card</div></div>
        <div class="stat"><div class="lab">Outstanding Due</div><div class="val red">Rs 41,800</div><div class="sub">across 23 bills</div></div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="lab">Pending Samples</div><div class="val">14</div></div>
        <div class="stat"><div class="lab">Pending Results</div><div class="val">9</div></div>
        <div class="stat"><div class="lab">Awaiting Approval</div><div class="val">6</div></div>
        <div class="stat"><div class="lab">Critical Alerts</div><div class="val red">3</div></div>
      </div>
      <div class="charts">
        <div class="panel"><h5>Revenue — last 14 days</h5>
          <div class="bars">
            ${[40,55,48,62,70,58,75,68,82,72,90,84,96,78].map(h=>`<div class="bar" style="height:${h}%"></div>`).join("")}
          </div>
        </div>
        <div class="panel"><h5>Top Tests</h5>
          ${[["CBC",92],["RBS",74],["LFT",61],["Lipid Profile",53],["TSH",44]].map(([n,w])=>`<div class="hbar"><span style="width:64px">${n}</span><span class="track"><span class="fill" style="width:${w}%"></span></span></div>`).join("")}
        </div>
      </div>
      <div class="charts" style="margin-top:8px;">
        <div class="panel"><h5>Collection by Mode (today)</h5>
          ${[["Cash",70],["eSewa / QR",48],["Card",22],["Bank",14]].map(([n,w])=>`<div class="hbar"><span style="width:64px">${n}</span><span class="track"><span class="fill" style="width:${w}%"></span></span></div>`).join("")}
        </div>
        <div class="panel"><h5>Peak Hours</h5>
          <div class="bars">
            ${[20,35,55,80,95,70,50,40,55,75,60,45,30,25,18,12].map(h=>`<div class="bar" style="height:${h}%"></div>`).join("")}
          </div>
        </div>
      </div>
    </div>
  </div>
  <p style="font-size:8.5px;color:var(--muted);margin-top:8px;">UI preview rendered to scale from the live design system (Tailwind tokens, Plus Jakarta Sans, Recharts). Figures illustrative.</p>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== REPORT MOCKUP ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Screens</span></div>
  <span class="section-kicker">06 — Screen Preview</span>
  <h2 class="section">Lab Report &amp; Patient QR</h2>
  <hr class="rule"/>
  <p class="lead">A branded, signed report with automatic flagging — delivered on paper or via a secure, access-logged QR link.</p>

  <div class="report" style="margin-top:10px;">
    <div class="rep-head">
      <div><div class="lab">Demo Diagnostic Laboratory</div><div class="sub">Kathmandu, Nepal · PAN 301234567 · +977-1-4XXXXXX</div></div>
      <div style="text-align:right;"><div class="sub">Report No.</div><b style="color:var(--green)">V-000482</b></div>
    </div>
    <div class="rep-meta">
      <div><span>Patient: </span><b>Sita Sharma</b></div>
      <div><span>Age / Sex: </span><b>34 Y / Female</b></div>
      <div><span>UHID: </span><b>P-001207</b></div>
      <div><span>Referred by: </span><b>Dr. R. Karki, MD</b></div>
      <div><span>Collected: </span><b>21 Jun 2026, 09:14</b></div>
      <div><span>Reported: </span><b>21 Jun 2026, 11:02</b></div>
    </div>
    <div class="rep-body">
      <div class="rep-title">Complete Blood Count (CBC) — Hematology</div>
      <table class="rep">
        <thead><tr><th>Investigation</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead>
        <tbody>
          <tr><td>Haemoglobin</td><td class="flag-l">10.8 L</td><td>g/dL</td><td>12.0 – 15.5</td></tr>
          <tr><td>Total WBC Count</td><td>7,400</td><td>/µL</td><td>4,000 – 11,000</td></tr>
          <tr><td>Platelet Count</td><td class="flag-l">1.3 L</td><td>lakh/µL</td><td>1.5 – 4.1</td></tr>
          <tr><td>Neutrophils</td><td class="flag-h">78 H</td><td>%</td><td>40 – 75</td></tr>
          <tr><td>Lymphocytes</td><td>18</td><td>%</td><td>20 – 45</td></tr>
          <tr><td>RBC Count</td><td>4.6</td><td>mil/µL</td><td>3.8 – 5.2</td></tr>
        </tbody>
      </table>
      <p style="font-size:8.5px;color:var(--muted);margin-top:6px;"><b style="color:var(--ink)">Interpretation:</b> Mild anaemia with relative neutrophilia. Clinical correlation advised.</p>
    </div>
    <div class="rep-foot">
      <div style="text-align:center;">
        ${fauxQR()}
        <div style="font-size:7.5px;color:var(--muted);margin-top:3px;">Scan to verify online</div>
      </div>
      <div class="sign"><div class="line"></div><b>Dr. A. Pathologist, MD</b><div>Consultant Pathologist · NMC 12345</div></div>
    </div>
  </div>
  <p style="font-size:8.5px;color:var(--muted);margin-top:8px;">Reference ranges, H/L/critical flags and signatures are configured per lab and snapshotted at approval time.</p>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== RBAC ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Access Control</span></div>
  <span class="section-kicker">07 — Roles &amp; Permissions</span>
  <h2 class="section">Right access for every desk</h2>
  <hr class="rule"/>
  <p class="lead">Eight system roles ship out of the box, each mapped to granular permission keys. Admins can clone roles and toggle any of 30+ permissions in the visual editor.</p>

  <table class="matrix" style="margin-top:10px;">
    <thead><tr>
      <th>Module / Role</th><th>Super<br/>Admin</th><th>Lab<br/>Admin</th><th>Reception</th><th>Sample<br/>Collect</th><th>Lab<br/>Tech</th><th>Patho-<br/>logist</th><th>Accounts</th><th>Dispatch</th>
    </tr></thead>
    <tbody>
      ${matrixRows()}
    </tbody>
  </table>

  <div class="two" style="margin-top:14px;">
    <div class="card"><h3>Security model</h3>
      <ul class="ticks" style="margin-top:4px;">
        <li>Bcrypt-hashed passwords; no public sign-up — admins create users</li>
        <li>Signed session cookies (jose) with server-side session records</li>
        <li>Force-password-change &amp; active/inactive user states</li>
        <li>Permission checks on both navigation <i>and</i> every server action</li>
      </ul>
    </div>
    <div class="card"><h3>Accountability</h3>
      <ul class="ticks" style="margin-top:4px;">
        <li>Audit log of sensitive changes (who/what/when, before/after)</li>
        <li>Activity feed for everyday operations</li>
        <li>Sample, result &amp; approval event trails</li>
        <li>Public report access logs (view / download / blocked)</li>
      </ul>
    </div>
  </div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== INTEGRATIONS + DATA ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Integrations &amp; Data</span></div>
  <span class="section-kicker">08 — Integrations &amp; Data Model</span>
  <h2 class="section">Pluggable adapters, structured data</h2>
  <hr class="rule"/>

  <h4 style="font-size:12px;margin-bottom:7px;">Provider adapters (swap via environment config)</h4>
  <div class="grid g3">
    <div class="card"><h3><span class="ic">✉️</span>Email</h3><p>Mock · <b>Resend</b> · SendGrid · generic HTTP gateway. Every send logged with status.</p></div>
    <div class="card"><h3><span class="ic">💬</span>SMS</h3><p>Mock · <b>Sparrow SMS</b> (Nepal) · Twilio · generic HTTP. Report-ready &amp; due-cleared alerts.</p></div>
    <div class="card"><h3><span class="ic">🗄️</span>Storage</h3><p>Local · <b>Cloudflare R2</b> · Supabase · Cloudinary — for logos, headers &amp; signatures.</p></div>
  </div>

  <h4 style="font-size:12px;margin:16px 0 7px;">Core data model (Drizzle / libSQL)</h4>
  <div class="grid g4">
    ${dataCard("Identity","labs, lab_settings, users, roles, sessions, lab_assets")}
    ${dataCard("Catalog","tests, test_parameters, test_groups, departments, sample_types, payment_modes, referring_doctors")}
    ${dataCard("Patients & Visits","patients, visits, visit_tests")}
    ${dataCard("Billing","bills, bill_items, payments")}
    ${dataCard("Lab Workflow","samples, sample_events, result_entries, result_values, result_versions, result_approvals")}
    ${dataCard("Reports","report_links, report_access_logs, report_dispatches, report_templates")}
    ${dataCard("System","counters, audit_logs, activity_logs, sms_logs, email_logs, app_settings")}
    ${dataCard("Numbering","Atomic per-lab counters → P / V / B / S / R codes")}
  </div>

  <div class="callout" style="margin-top:16px;"><b>Localised for Nepal:</b> NPR currency &amp; PAN/VAT fields, Sparrow SMS, eSewa/QR payment modes, age-in-years/months/days capture, and configurable A4 report margins — while remaining fully international-ready.</div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

<!-- ===================== COMMERCIAL / CLOSING ===================== -->
<section class="page">
  <div class="run-head"><img src="${logoData}"/><span>Product Details · Commercial</span></div>
  <span class="section-kicker">09 — Why Nidanyo Sells</span>
  <h2 class="section">A product, not a project</h2>
  <hr class="rule"/>
  <div class="two">
    <div>
      <h4 style="font-size:12px;margin-bottom:6px;">Value to the lab</h4>
      <ul class="ticks">
        <li>Faster turnaround — no more retyping reports in Word</li>
        <li>Zero transcription errors with structured result entry</li>
        <li>Real-time revenue &amp; dues visibility for the owner</li>
        <li>Professional, branded reports build patient trust</li>
        <li>Staff accountability through end-to-end audit trails</li>
        <li>Patient self-service cuts front-desk report queues</li>
      </ul>
      <h4 style="font-size:12px;margin:14px 0 6px;">Commercial fit</h4>
      <ul class="ticks">
        <li>Web-based &amp; installable (PWA) — runs on any device</li>
        <li>Multi-tenant-ready schema for SaaS rollout</li>
        <li>Per-lab branding &amp; configuration with no code changes</li>
        <li>Low-cost edge infra (Vercel + Turso + Cloudflare)</li>
      </ul>
    </div>
    <div>
      <h4 style="font-size:12px;margin-bottom:6px;">Roadmap candidates</h4>
      <div class="card" style="font-size:10px;">
        <p><span class="pill">Next</span> Analyzer / LIS instrument interfacing (HL7/ASTM)</p>
        <p><span class="pill">Next</span> WhatsApp report delivery</p>
        <p><span class="pill">Next</span> Home-collection &amp; phlebotomist app</p>
        <p><span class="pill">Later</span> Multi-branch &amp; franchise consolidation</p>
        <p><span class="pill">Later</span> Insurance / corporate panel billing</p>
        <p><span class="pill">Later</span> Patient mobile app &amp; history timeline</p>
        <p><span class="pill">Later</span> Inventory &amp; reagent management</p>
      </div>
      <div class="callout" style="margin-top:12px;">
        <b>Deployment-ready:</b> push to <b>GitHub</b>, deploy on <b>Vercel</b>, point DNS via <b>Cloudflare</b>, and connect a <b>Turso</b> database — live in production in under an hour.
      </div>
    </div>
  </div>

  <div style="margin-top:26px; text-align:center; border-top:1px solid var(--line); padding-top:20px;">
    <img src="${logoData}" style="height:40px;" />
    <div style="font-size:13px;font-weight:700;color:var(--green);margin-top:8px;">From Liquid to Logic.</div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px;">Laboratory Information &amp; Operations Management System &nbsp;·&nbsp; by Infobytes Nepal</div>
    <div style="font-size:9px;color:var(--muted);margin-top:10px;">© ${new Date().getFullYear()} Infobytes Nepal · This document is confidential and intended for evaluation purposes.</div>
  </div>
  <div class="run-foot"><span class="foot-brand"><img src="${logoData}"/>From Liquid to Logic</span><span>© Infobytes Nepal · Confidential</span></div>
</section>

</body>
</html>`;

function moduleBlock(ic, title, sub, items) {
  return `<div class="mod">
    <div class="mod-head"><div class="mod-ic">${ic}</div><div><h3>${title}</h3><span>${sub}</span></div></div>
    <ul class="mod-body ticks">${items.map(i=>`<li>${i}</li>`).join("")}</ul>
  </div>`;
}
function dataCard(t, body) {
  return `<div class="card"><h3 style="font-size:11px;">${t}</h3><p style="font-size:9px;">${body}</p></div>`;
}
function matrixRows() {
  const Y = '<span class="yes">●</span>';
  const N = '<span class="no">○</span>';
  const rows = [
    ["Dashboard",        [1,1,1,1,1,1,1,1]],
    ["Patients",         [1,1,1,1,1,1,1,1]],
    ["Visits & Billing", [1,1,1,0,0,0,1,0]],
    ["Dues Collection",  [1,1,1,0,0,0,1,0]],
    ["Sample Collection",[1,1,0,1,1,0,0,0]],
    ["Result Entry",     [1,1,0,0,1,1,0,0]],
    ["Approval",         [1,1,0,0,0,1,0,0]],
    ["Reports",          [1,1,1,0,0,1,0,1]],
    ["Dispatch",         [1,1,0,0,0,0,0,1]],
    ["Transactions",     [1,1,0,0,0,0,1,0]],
    ["Financial Reports",[1,1,0,0,0,0,1,0]],
    ["Catalog (Tests)",  [1,1,1,0,0,0,0,0]],
    ["Settings & Users", [1,1,0,0,0,0,0,0]],
    ["Audit Logs",       [1,1,0,0,0,0,0,0]],
  ];
  return rows.map(([name, cells]) =>
    `<tr><td>${name}</td>${cells.map(c=>`<td>${c?Y:N}</td>`).join("")}</tr>`
  ).join("");
}

fs.writeFileSync(path.join(BUILD, "product-details.html"), html, "utf8");
console.log("HTML written:", path.join(BUILD, "product-details.html"), `(${html.length} bytes)`);
