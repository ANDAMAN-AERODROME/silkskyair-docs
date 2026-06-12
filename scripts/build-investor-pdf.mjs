/**
 * Build the investor documentation PDFs using the AAC document template.
 *
 *   node scripts/build-investor-pdf.mjs
 *
 * Outputs to investors/pdf/:
 *   - AAC-Investor-Documentation.pdf            (cover + TOC + all chapters + back cover)
 *   - AAC-01-executive-summary.pdf … AAC-08-…   (standalone chapters)
 *
 * Pipeline: markdown → HTML (marked) → headless Chrome → print to PDF → cover
 * (printed without header/footer) merged in front of the body with pdf-lib.
 *
 * Visual directives — fenced code blocks rendered as template components:
 *   ```stats          "VALUE | label"                  → big-number stat cards
 *   ```steps          "NN | Title | desc"              → horizontal step flow
 *   ```layers         "LABEL | desc"                   → layer-cake stack
 *   ```timeline       "Marker | Title | desc"          → stage timeline
 *   ```pull           free text                        → pull quote
 *   ```viz-network    "Title | desc" chips             → stylized route-map panorama
 *   ```viz-lifecycle  "NN | Title | desc [| major]"    → customer-journey track
 *                     last line "note: …"              → underline note
 *   ```viz-tenancy    "op|ghost: Name | desc | badge | ch1, ch2"
 *                     "foundation: Name | desc"        → operators-on-foundation stack
 *   ```viz-ecosystem  "cell|core: KICKER | Title | desc" → hub-and-ring grid
 *
 * Chapter frontmatter: `summary:` (divider + TOC), `keypoints:` (list of
 * "Title | desc") for the divider key-point cards.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import matter from "gray-matter";
import { Marked } from "marked";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "investors");
const OUT = path.join(SRC, "pdf");
const TPL_CSS = readFileSync(path.join(ROOT, "templates/aac/aac-template.css"), "utf8");
const MERMAID_JS = readFileSync(path.join(ROOT, "node_modules/mermaid/dist/mermaid.min.js"), "utf8");

const DOC_META = JSON.parse(readFileSync(path.join(SRC, "version.json"), "utf8"));
const DOC_ID = DOC_META.id;
const DOC_DATE = new Date(DOC_META.issued + "T00:00:00Z")
  .toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const VERSION = DOC_META.version;
const CLASSIFICATION = DOC_META.classification;
const SECTIONS = ["01", "02", "03", "04", "05", "06", "07", "08"];

/* document-control sanity: the issued version must be the last history entry */
const last = DOC_META.history[DOC_META.history.length - 1];
if (!last || last.version !== VERSION) {
  throw new Error(`version.json: current version ${VERSION} has no matching final history entry (found ${last?.version}). Add a history entry when bumping the version.`);
}

/* ── fonts (embedded from @fontsource via file:// URLs) ── */
const font = (pkg, file) =>
  pathToFileURL(path.join(ROOT, "node_modules/@fontsource", pkg, "files", file)).href;
const FONTS_CSS = `
@font-face { font-family:"Hanken Grotesk"; font-weight:400; src:url("${font("hanken-grotesk", "hanken-grotesk-latin-400-normal.woff2")}") format("woff2"); }
@font-face { font-family:"Hanken Grotesk"; font-weight:600; src:url("${font("hanken-grotesk", "hanken-grotesk-latin-600-normal.woff2")}") format("woff2"); }
@font-face { font-family:"Hanken Grotesk"; font-weight:700; src:url("${font("hanken-grotesk", "hanken-grotesk-latin-700-normal.woff2")}") format("woff2"); }
@font-face { font-family:"Inter"; font-weight:400; src:url("${font("inter", "inter-latin-400-normal.woff2")}") format("woff2"); }
@font-face { font-family:"IBM Plex Mono"; font-weight:400; src:url("${font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2")}") format("woff2"); }
@font-face { font-family:"IBM Plex Mono"; font-weight:600; src:url("${font("ibm-plex-mono", "ibm-plex-mono-latin-600-normal.woff2")}") format("woff2"); }
`;

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rows = (text) =>
  text.trim().split("\n").filter(Boolean).map((l) => l.split("|").map((c) => esc(c.trim())));

/* ════════════════════ SVG motif library (steel-blue line art) ════════════════════ */
/* Shared vocabulary: nodes = circles w/ halo, links = thin lines, dashes = optional/future */

const S = { stroke: "#2f8bff", dim: "rgba(47,139,255,0.45)", fill: "#0f1d33", text: "#9fb4cf" };
const node = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="${S.dim}" stroke-width="0.7"/>
   <circle cx="${x}" cy="${y}" r="${r}" fill="${S.fill}" stroke="${S.stroke}" stroke-width="1.4"/>
   <circle cx="${x}" cy="${y}" r="${Math.max(r * 0.32, 1.6)}" fill="${S.stroke}"/>`;
const link = (x1, y1, x2, y2, dashed = false) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${S.stroke}" stroke-width="0.8" opacity="0.55"${dashed ? ' stroke-dasharray="4 4"' : ""}/>`;
const tag = (x, y, t, anchor = "middle") =>
  `<text x="${x}" y="${y}" font-family="IBM Plex Mono" font-size="7.5" letter-spacing="2" fill="${S.text}" text-anchor="${anchor}">${t}</text>`;

const MOTIFS = {
  // 01 — the constellation (thesis: the network)
  "01": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    ${link(60, 150, 190, 70)}${link(190, 70, 330, 120)}${link(330, 120, 470, 45)}${link(190, 70, 360, 30)}
    ${link(360, 30, 470, 45)}${link(330, 120, 520, 160)}${link(60, 150, 330, 120)}${link(470, 45, 520, 160, true)}
    ${node(60, 150, 7)}${node(190, 70, 9)}${node(330, 120, 11)}${node(470, 45, 8)}${node(360, 30, 6)}${node(520, 160, 7)}
  </svg>`,
  // 02 — network graph with labeled site types
  "02": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    ${link(80, 140, 230, 60)}${link(230, 60, 400, 110)}${link(400, 110, 540, 50)}${link(80, 140, 400, 110)}
    ${link(230, 60, 540, 50, true)}${link(400, 110, 500, 175, true)}
    ${node(80, 140, 9)}${node(230, 60, 11)}${node(400, 110, 12)}${node(540, 50, 8)}${node(500, 175, 6)}
    ${tag(80, 168, "HELIPAD")}${tag(230, 36, "HELIPORT")}${tag(400, 142, "AERODROME")}${tag(540, 26, "HELIPAD")}${tag(500, 194, "PLANNED")}
  </svg>`,
  // 03 — value flowing up through layers
  "03": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <rect x="120" y="150" width="360" height="26" rx="3" fill="none" stroke="${S.stroke}" stroke-width="1.2"/>
    <rect x="160" y="105" width="280" height="26" rx="3" fill="rgba(47,139,255,0.12)" stroke="${S.stroke}" stroke-width="1.2"/>
    <rect x="200" y="60" width="200" height="26" rx="3" fill="rgba(47,139,255,0.24)" stroke="${S.stroke}" stroke-width="1.2"/>
    ${link(300, 60, 300, 28)}<path d="M295 32 L300 22 L305 32 Z" fill="${S.stroke}"/>
    ${tag(300, 168, "NETWORK CAPACITY")}${tag(300, 123, "COMMERCIAL SERVICES")}${tag(300, 78, "REVENUE")}
  </svg>`,
  // 04 — one foundation, many towers
  "04": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <rect x="90" y="140" width="420" height="30" rx="3" fill="rgba(47,139,255,0.1)" stroke="${S.stroke}" stroke-width="1.4"/>
    <rect x="120" y="70" width="100" height="56" rx="3" fill="${S.fill}" stroke="${S.stroke}" stroke-width="1.2"/>
    <rect x="250" y="86" width="100" height="40" rx="3" fill="${S.fill}" stroke="${S.stroke}" stroke-width="1.2"/>
    <rect x="380" y="86" width="100" height="40" rx="3" fill="none" stroke="${S.stroke}" stroke-width="1" stroke-dasharray="4 4"/>
    ${link(170, 126, 170, 140)}${link(300, 126, 300, 140)}${link(430, 126, 430, 140, true)}
    ${tag(170, 60, "OPERATOR 1")}${tag(300, 76, "OPERATOR 2")}${tag(430, 76, "OPERATOR N")}${tag(300, 160, "ONE NETWORK PLATFORM")}
  </svg>`,
  // 05 — modular grid, one highlighted core
  "05": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    ${[0, 1, 2, 3, 4].map((c) => [0, 1].map((r) => {
      const x = 130 + c * 72, y = 50 + r * 64;
      const core = c === 2 && r === 0;
      return `<rect x="${x}" y="${y}" width="56" height="48" rx="3" fill="${core ? "rgba(47,139,255,0.28)" : S.fill}" stroke="${S.stroke}" stroke-width="${core ? 1.6 : 0.9}" ${core ? "" : 'opacity="0.75"'}/>`;
    }).join("")).join("")}
    ${link(186, 74, 274, 74)}${link(330, 74, 418, 74)}${link(302, 98, 302, 114)}
    ${tag(300, 36, "MODULES OVER ONE CORE")}
  </svg>`,
  // 06 — value bars rising
  "06": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    ${[36, 62, 88, 120].map((h, i) =>
      `<rect x="${170 + i * 72}" y="${158 - h}" width="44" height="${h}" rx="3" fill="rgba(47,139,255,${0.1 + i * 0.07})" stroke="${S.stroke}" stroke-width="1.1"/>`
    ).join("")}
    ${link(140, 158, 470, 158)}
    ${tag(305, 178, "COMPOUNDING PLATFORM VALUE")}
  </svg>`,
  // 07 — the operating loop
  "07": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="300" cy="100" rx="190" ry="62" fill="none" stroke="${S.stroke}" stroke-width="1" opacity="0.55"/>
    <path d="M487 92 L492 104 L478 102 Z" fill="${S.stroke}"/>
    ${node(110, 100, 8)}${node(232, 38, 8)}${node(368, 38, 8)}${node(490, 100, 8)}${node(300, 162, 9)}
    ${tag(110, 128, "ACQUIRE")}${tag(232, 22, "BOOK")}${tag(368, 22, "PAY")}${tag(490, 128, "FLY")}${tag(300, 190, "RETURN")}
  </svg>`,
  // 08 — expanding rings from one node
  "08": `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="300" cy="100" r="30" fill="none" stroke="${S.stroke}" stroke-width="1.3"/>
    <circle cx="300" cy="100" r="58" fill="none" stroke="${S.stroke}" stroke-width="0.9" opacity="0.7"/>
    <circle cx="300" cy="100" r="86" fill="none" stroke="${S.stroke}" stroke-width="0.7" opacity="0.45" stroke-dasharray="5 5"/>
    ${node(300, 100, 7)}${node(358, 100, 4)}${node(300, 42, 4)}${node(214, 100, 4)}${node(300, 186, 4)}
    ${tag(300, 16, "NETWORK · ACTIVITIES · OPERATORS")}
  </svg>`,
};

/* ════════════════════ Directive components ════════════════════ */

function vizCaption(items) {
  if (!items.length) return "";
  return `<div class="viz-caption">${items
    .map(([t, d]) => `<div class="chip"><b>${t}</b>${d ?? ""}</div>`)
    .join("")}</div>`;
}

const COMPONENTS = {
  stats(text) {
    const items = rows(text);
    return `<div class="stat-grid" style="--cols:${Math.min(items.length, 4)}">${items
      .map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`)
      .join("")}</div>`;
  },
  steps(text) {
    return `<div class="aac-steps">${rows(text)
      .map(([n, t, d]) => `<div class="step"><div class="n">${n}</div><div class="t">${t}</div><div class="d">${d ?? ""}</div></div>`)
      .join("")}</div>`;
  },
  layers(text) {
    return `<div class="aac-layers">${rows(text)
      .map(([t, d]) => `<div class="layer"><span class="t">${t}</span><span class="d">${d ?? ""}</span></div>`)
      .join("")}</div>`;
  },
  timeline(text) {
    return `<div class="aac-timeline">${rows(text)
      .map(([m, t, d]) => `<div class="stage"><div class="marker">${m}</div><div class="body"><div class="t">${t}</div><div class="d">${d ?? ""}</div></div></div>`)
      .join("")}</div>`;
  },
  pull(text) {
    return `<div class="aac-pull">${esc(text.trim())}</div>`;
  },

  /* stylized route-map panorama; fence rows become caption chips */
  "viz-network"(text) {
    return `<div class="aac-viz viz-network">
      <div class="panorama">${MOTIFS["02"]}</div>
      ${vizCaption(rows(text))}
    </div>`;
  },

  /* customer-journey track; "note: …" last line becomes underline note */
  "viz-lifecycle"(text) {
    const lines = text.trim().split("\n").filter(Boolean);
    let note = "";
    if (lines[lines.length - 1].startsWith("note:")) note = esc(lines.pop().slice(5).trim());
    const states = lines.map((l) => l.split("|").map((c) => esc(c.trim())));
    return `<div class="aac-viz viz-lifecycle">
      <div class="track">${states
        .map(([n, t, d, major]) =>
          `<div class="state${major === "major" ? " major" : ""}"><div class="dot">${n}</div><div class="t">${t}</div><div class="d">${d ?? ""}</div></div>`)
        .join("")}</div>
      ${note ? `<div class="underline-note">${note}</div>` : ""}
    </div>`;
  },

  /* operators standing on the network foundation */
  "viz-tenancy"(text) {
    const ops = [];
    let foundation = ["", ""];
    for (const line of text.trim().split("\n").filter(Boolean)) {
      const [kind, rest] = [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1)];
      const cells = rest.split("|").map((c) => esc(c.trim()));
      if (kind === "foundation") foundation = cells;
      else ops.push({ ghost: kind === "ghost", nm: cells[0], ds: cells[1], badge: cells[2], channels: (cells[3] ?? "").split(",").map((c) => c.trim()).filter(Boolean) });
    }
    return `<div class="aac-viz viz-tenancy">
      <div class="operators">${ops
        .map((o) => `<div class="op${o.ghost ? " ghost" : ""}">
          ${o.badge ? `<div class="badge">${o.badge}</div>` : ""}
          <div class="nm">${o.nm}</div><div class="ds">${o.ds ?? ""}</div>
          ${o.channels.length ? `<div class="channels">${o.channels.map((c) => `<i>${c}</i>`).join("")}</div>` : ""}
        </div>`).join("")}</div>
      <div class="links"><i></i><i></i><i></i></div>
      <div class="foundation">
        <div class="nm"><small>NETWORK PLATFORM</small>${foundation[0]}</div>
        <div class="ds">${foundation[1] ?? ""}</div>
      </div>
    </div>`;
  },

  /* hub-and-ring application ecosystem */
  "viz-ecosystem"(text) {
    const cells = text.trim().split("\n").filter(Boolean).map((line) => {
      const core = line.startsWith("core:");
      const cols = (core ? line.slice(5) : line.replace(/^cell:/, "")).split("|").map((c) => esc(c.trim()));
      return { core, k: cols[0], t: cols[1], d: cols[2] };
    });
    return `<div class="aac-viz viz-ecosystem"><div class="ring">${cells
      .map((c) => `<div class="cell${c.core ? " core" : ""}"><div class="k">${c.k}</div><div class="t">${c.t}</div>${c.d ? `<div class="d">${c.d}</div>` : ""}</div>`)
      .join("")}</div></div>`;
  },
};

/* ════════════════════ markdown → HTML ════════════════════ */

function makeMarked(linkMode /* "anchor" | "plain" */) {
  const m = new Marked();
  m.use({
    renderer: {
      code({ text, lang }) {
        if (lang === "mermaid") return `<div class="mermaid">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;
        if (COMPONENTS[lang]) return COMPONENTS[lang](text);
        return false; // default renderer
      },
      link({ href, text, tokens }) {
        const inner = this.parser.parseInline(tokens) || text;
        if (href && href.endsWith(".md")) {
          const target = path.basename(href, ".md");
          return linkMode === "anchor" ? `<a href="#ch-${target}">${inner}</a>` : `<span class="xref">${inner}</span>`;
        }
        return `<a href="${href}">${inner}</a>`;
      },
    },
  });
  return m;
}

function loadChapter(file) {
  const raw = readFileSync(path.join(SRC, file), "utf8");
  const { data, content } = matter(raw);
  let body = content
    .replace(/^#\s+.+$/m, "") // chapter H1 — replaced by templated chapter head
    .replace(/\n---\s*\n\s*\*(Next|Back to):[\s\S]*$/m, "") // trailing nav line
    .trim();
  const num = file.match(/^(\d+)-/)?.[1] ?? "";
  const keypoints = (data.keypoints ?? []).map((kp) => kp.split("|").map((c) => c.trim()));
  return { file, id: path.basename(file, ".md"), num, title: data.title, summary: data.summary ?? "", keypoints, body };
}

const progressStrip = (active) =>
  `<div class="aac-progress">${SECTIONS.map((s) => `<span${s === active ? ' class="active"' : ""}>${s}</span>`).join("")}</div>`;

function dividerHtml(ch) {
  return `<section class="aac-divider">
    <div class="top-row">
      ${progressStrip(ch.num)}
      <div class="big-no">${ch.num}</div>
    </div>
    <div class="motif">${MOTIFS[ch.num] ?? ""}</div>
    <div class="title-area">
      <div class="doc-ref">${DOC_ID} · Section ${ch.num}</div>
      <h1>${ch.title}</h1>
      <div class="summary">${esc(ch.summary)}</div>
      ${ch.keypoints.length ? `<div class="kp-label">In this section</div>
      <div class="keypoints">${ch.keypoints
        .map(([t, d]) => `<div class="kp"><div class="t">${esc(t)}</div><div class="d">${esc(d ?? "")}</div></div>`)
        .join("")}</div>` : ""}
    </div>
  </section>`;
}

function chapterHtml(ch, marked, { divider }) {
  return `${divider ? dividerHtml(ch) : ""}<section class="aac-chapter" id="ch-${ch.id}">
    <div class="chapter-head">
      <div class="eyebrow">${DOC_ID} · Section ${ch.num}</div>
      <h1>${ch.title}</h1>
    </div>
    ${marked.parse(ch.body)}
  </section>`;
}

const COVER = (title, subtitle) => `
<section class="aac-cover">
  <div class="wordmark">
    <span class="monogram">AAC</span>
    <span class="name">Andaman Aerodrome</span>
  </div>
  <div style="margin-top:14mm; opacity:0.9;"><div class="constellation">${MOTIFS["01"]}</div></div>
  <div class="title-block">
    <div class="eyebrow">Platform Architecture Office</div>
    <h1>${title}</h1>
    <div class="subtitle">${subtitle}</div>
  </div>
  <div class="meta">
    <div><div class="k">Document</div><div class="v">${DOC_ID}</div></div>
    <div><div class="k">Issued</div><div class="v">${DOC_DATE}</div></div>
    <div><div class="k">Version</div><div class="v">v${VERSION}</div></div>
    <div><div class="k">Classification</div><div class="v">${CLASSIFICATION}</div></div>
  </div>
</section>`;

/* formal document-control page: meta block + revision history */
const DOC_CONTROL = `
<section class="aac-chapter" id="document-control">
  <div class="chapter-head">
    <div class="eyebrow">${DOC_ID} · Document Control</div>
    <h1>Document Control</h1>
  </div>
  <table>
    <tr><th style="width:34mm">Document</th><td>${DOC_ID} — ${esc(DOC_META.title)}</td></tr>
    <tr><th>Current version</th><td>v${VERSION}</td></tr>
    <tr><th>Issued</th><td>${esc(DOC_META.issued)}</td></tr>
    <tr><th>Prepared by</th><td>${esc(DOC_META.preparedBy)}</td></tr>
    <tr><th>Classification</th><td>${CLASSIFICATION}</td></tr>
  </table>
  <h2>Revision history</h2>
  <table>
    <thead><tr><th style="width:18mm">Version</th><th style="width:24mm">Date</th><th>Changes</th></tr></thead>
    <tbody>
      ${[...DOC_META.history].reverse()
        .map((h) => `<tr><td><code>v${esc(h.version)}</code></td><td>${esc(h.date)}</td><td>${esc(h.summary)}</td></tr>`)
        .join("\n")}
    </tbody>
  </table>
  <p style="margin-top:4mm; font-size:8.6pt; color:#64748b;">This document is issued under
  version control. The authoritative source is the <code>investors/</code> directory of the
  <code>silkskyair-docs</code> repository; each issued version is archived as
  <code>AAC-Investor-Documentation-v&lt;version&gt;.pdf</code>. Verify the version above
  against the page headers before relying on a printed copy.</p>
</section>`;

const BACK_COVER = `
<section class="aac-backcover">
  <div class="wordmark" style="display:flex;align-items:baseline;gap:4mm;border-bottom:0.6pt solid rgba(47,139,255,0.45);padding-bottom:5mm;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:15pt;font-weight:600;letter-spacing:0.18em;color:#fff;border:1pt solid #2f8bff;border-radius:3px;padding:1.2mm 2.6mm;">AAC</span>
    <span style="font-size:10.5pt;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:#cbd5e1;">Andaman Aerodrome</span>
  </div>
  <div class="closing">
    <div class="line">One network. <em>Unlimited businesses.</em><br/>
    Every helipad, heliport and aircraft the company adds is immediately
    schedulable, sellable and shareable — on infrastructure the company
    already owns.</div>
  </div>
  <div class="foot">
    <span>Platform Architecture Office</span>
    <span>${DOC_ID} · v${VERSION} · ${DOC_DATE} · ${CLASSIFICATION}</span>
  </div>
</section>`;

const TOC = (chapters) => `
<section class="aac-toc">
  <div class="chapter-head">
    <div class="eyebrow">${DOC_ID} · Contents</div>
    <h1>Table of Contents</h1>
  </div>
  <ol>
    ${chapters
      .map((c) => `<li><span class="no">${c.num}</span><span class="t">${c.title}</span><span class="d">${esc(c.summary)}</span></li>`)
      .join("\n")}
  </ol>
</section>`;

function htmlDocument(bodyHtml) {
  const needsMermaid = bodyHtml.includes('class="mermaid"');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${FONTS_CSS}\n${TPL_CSS}
.constellation svg { width: 96mm; height: auto; display: block; }
</style>
${needsMermaid ? `<script>${MERMAID_JS}</script>
<script>
mermaid.initialize({ startOnLoad: false, theme: "base", fontFamily: "Hanken Grotesk, Inter, sans-serif",
  themeVariables: { primaryColor: "#eef7ff", primaryTextColor: "#0f172a", primaryBorderColor: "#032b5b",
    lineColor: "#1d6fec", secondaryColor: "#f8fafc", tertiaryColor: "#ffffff", clusterBkg: "#f8fafc",
    clusterBorder: "#cbd5e1", edgeLabelBackground: "#ffffff", fontSize: "14px" },
  flowchart: { curve: "linear" } });
window.__renderMermaid = async () => { await mermaid.run({ querySelector: ".mermaid" }); window.__mermaidDone = true; };
</script>` : `<script>window.__renderMermaid = async () => { window.__mermaidDone = true; };</script>`}
</head><body>${bodyHtml}</body></html>`;
}

/* ════════════════════ chrome rendering ════════════════════ */

async function printPdf(page, html, { headerFooter }) {
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => window.__renderMermaid());
  await page.waitForFunction(() => window.__mermaidDone === true, { timeout: 60000 });
  const common = { format: "A4", printBackground: true, margin: { top: "18mm", bottom: "16mm", left: "16mm", right: "16mm" } };
  if (!headerFooter) return page.pdf({ ...common, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } });
  return page.pdf({
    ...common,
    displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:6.4pt;letter-spacing:0.18em;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;text-transform:uppercase;">
        <span>Andaman Aerodrome — Network Platform</span><span>${DOC_ID} · v${VERSION}</span></div>`,
    footerTemplate: `<div style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:6.4pt;letter-spacing:0.14em;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;text-transform:uppercase;">
        <span>${CLASSIFICATION}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
}

async function mergePdfs(buffers) {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

/* ════════════════════ main ════════════════════ */

const chapters = readdirSync(SRC)
  .filter((f) => /^\d+-.*\.md$/.test(f))
  .sort()
  .map(loadChapter);

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ args: ["--no-sandbox", "--font-render-hinting=none"] });
const page = await browser.newPage();

// 1) Combined memorandum: cover + TOC + chapters with dividers + back cover
const coverPdf = await printPdf(
  page,
  htmlDocument(COVER(
    "Investor Documentation",
    "The Andaman Aerodrome Network Platform — a turn-key platform for aviation activities built on a network of helipads and heliports, with white-label commercial services as its value-added layer."
  )),
  { headerFooter: false }
);
const combinedMarked = makeMarked("anchor");
const bodyPdf = await printPdf(
  page,
  htmlDocument(TOC(chapters) + DOC_CONTROL + chapters.map((c) => chapterHtml(c, combinedMarked, { divider: true })).join("\n")),
  { headerFooter: true }
);
const backPdf = await printPdf(page, htmlDocument(BACK_COVER), { headerFooter: false });
const combined = await mergePdfs([coverPdf, bodyPdf, backPdf]);
writeFileSync(path.join(OUT, "AAC-Investor-Documentation.pdf"), combined);
console.log("✓ AAC-Investor-Documentation.pdf");

// archive the issued version (immutable record per version)
const ARCHIVE = path.join(OUT, "archive");
mkdirSync(ARCHIVE, { recursive: true });
const archiveName = `AAC-Investor-Documentation-v${VERSION}.pdf`;
writeFileSync(path.join(ARCHIVE, archiveName), combined);
console.log(`✓ archive/${archiveName}`);

// 2) Standalone chapter documents (divider page acts as a mini-cover)
const soloMarked = makeMarked("plain");
for (const ch of chapters) {
  const pdf = await printPdf(page, htmlDocument(chapterHtml(ch, soloMarked, { divider: true })), { headerFooter: true });
  const name = `AAC-${ch.id}.pdf`;
  writeFileSync(path.join(OUT, name), pdf);
  console.log(`✓ ${name}`);
}

await browser.close();
console.log(`\nDone → ${path.relative(ROOT, OUT)}/`);
