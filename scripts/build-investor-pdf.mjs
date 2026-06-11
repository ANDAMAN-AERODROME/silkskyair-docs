/**
 * Build the investor documentation PDFs using the AAC document template.
 *
 *   node scripts/build-investor-pdf.mjs
 *
 * Outputs to investors/pdf/:
 *   - AAC-Investor-Documentation.pdf            (cover + TOC + all chapters)
 *   - AAC-01-executive-summary.pdf … AAC-08-…   (standalone chapters)
 *
 * Pipeline: markdown → HTML (marked, mermaid code fences kept as .mermaid divs)
 * → headless Chrome renders mermaid in-page → print to PDF → cover (printed
 * without header/footer) merged in front of the body with pdf-lib.
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

const DOC_ID = "AAC-INV-001";
const DOC_DATE = "June 2026";
const CLASSIFICATION = "Confidential — Investor Use Only";

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

/* ── markdown → HTML ── */
function makeMarked(linkMode /* "anchor" | "plain" */) {
  const m = new Marked();
  m.use({
    renderer: {
      code({ text, lang }) {
        if (lang === "mermaid") return `<div class="mermaid">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;
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
  return { file, id: path.basename(file, ".md"), num, title: data.title, body };
}

function chapterHtml(ch, marked) {
  return `<section class="aac-chapter" id="ch-${ch.id}">
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
  <div class="title-block">
    <div class="eyebrow">Platform Architecture Office</div>
    <h1>${title}</h1>
    <div class="subtitle">${subtitle}</div>
  </div>
  <div class="meta">
    <div><div class="k">Document</div><div class="v">${DOC_ID}</div></div>
    <div><div class="k">Issued</div><div class="v">${DOC_DATE}</div></div>
    <div><div class="k">Version</div><div class="v">1.0</div></div>
    <div><div class="k">Classification</div><div class="v">${CLASSIFICATION}</div></div>
  </div>
</section>`;

const TOC = (chapters) => `
<section class="aac-toc">
  <div class="chapter-head">
    <div class="eyebrow">${DOC_ID} · Contents</div>
    <h1>Table of Contents</h1>
  </div>
  <ol>
    ${chapters.map((c) => `<li><span class="no">${c.num}</span><span class="t">${c.title}</span></li>`).join("\n")}
  </ol>
</section>`;

function htmlDocument(bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${FONTS_CSS}\n${TPL_CSS}</style>
<script>${MERMAID_JS}</script>
<script>
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  fontFamily: "Hanken Grotesk, Inter, sans-serif",
  themeVariables: {
    primaryColor: "#eef7ff",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#032b5b",
    lineColor: "#1d6fec",
    secondaryColor: "#f8fafc",
    tertiaryColor: "#ffffff",
    clusterBkg: "#f8fafc",
    clusterBorder: "#cbd5e1",
    edgeLabelBackground: "#ffffff",
    fontSize: "14px"
  },
  flowchart: { curve: "linear" }
});
window.__renderMermaid = async () => {
  await mermaid.run({ querySelector: ".mermaid" });
  window.__mermaidDone = true;
};
</script>
</head><body>${bodyHtml}</body></html>`;
}

/* ── chrome rendering ── */
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
        <span>Andaman Aerodrome — Network Platform</span><span>${DOC_ID}</span></div>`,
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

/* ── main ── */
const chapters = readdirSync(SRC)
  .filter((f) => /^\d+-.*\.md$/.test(f))
  .sort()
  .map(loadChapter);

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ args: ["--no-sandbox", "--font-render-hinting=none"] });
const page = await browser.newPage();

// 1) Combined memorandum: cover (no header/footer) + TOC + chapters (header/footer)
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
  htmlDocument(TOC(chapters) + chapters.map((c) => chapterHtml(c, combinedMarked)).join("\n")),
  { headerFooter: true }
);
const combined = await mergePdfs([coverPdf, bodyPdf]);
writeFileSync(path.join(OUT, "AAC-Investor-Documentation.pdf"), combined);
console.log("✓ AAC-Investor-Documentation.pdf");

// 2) Standalone chapter documents
const soloMarked = makeMarked("plain");
for (const ch of chapters) {
  const pdf = await printPdf(page, htmlDocument(chapterHtml(ch, soloMarked)), { headerFooter: true });
  const name = `AAC-${ch.id}.pdf`;
  writeFileSync(path.join(OUT, name), pdf);
  console.log(`✓ ${name}`);
}

await browser.close();
console.log(`\nDone → ${path.relative(ROOT, OUT)}/`);
