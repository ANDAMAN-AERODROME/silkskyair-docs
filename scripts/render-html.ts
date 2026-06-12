#!/usr/bin/env tsx
/**
 * render-html.ts
 *
 * Generates a static HTML sibling next to every Markdown file in the docs
 * content tree, so the repo can be served as-is by GitHub Pages.
 *
 *   manuals/domains/partners/create.md  →  manuals/domains/partners/create.html
 *   weekly-reports/2026-05-29-weekly-report.md  →  …-weekly-report.html
 *
 * Transformations (keep the HTML faithful to how GitHub renders the .md):
 *   - Frontmatter is stripped (GitHub hides it too); `title:` becomes <title>.
 *   - Cross-links to other `.md` files are rewritten to `.html` (anchors kept),
 *     so navigation works between the generated pages.
 *   - Root-absolute image paths (`/screenshots/...`) are rewritten to a path
 *     RELATIVE to each page, so they resolve under a project Pages base path
 *     (https://<org>.github.io/<repo>/…) without hardcoding it.
 *   - `<!-- children -->` markers on manuals index pages expand to a linked
 *     list of child pages (mirrors publish-to-notion.ts).
 *
 * A `.nojekyll` file is written at the repo root so Pages serves the prebuilt
 * HTML verbatim instead of running Jekyll over it.
 *
 * CLI:
 *   pnpm build:html
 */

import { marked } from "marked";
import matter from "gray-matter";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const MANUALS_DIR = path.join(REPO_ROOT, "manuals");

// Content roots to render (relative to repo root). README is added explicitly.
const ROOT_DIRS = ["manuals", "plans", "weekly-reports", "weekly-statements", "briefings"];
const SKIP_DIRS = new Set(["node_modules", ".cache", ".git"]);

marked.setOptions({ gfm: true });

interface Doc {
  abs: string;
  relFromRoot: string; // e.g. "manuals/domains/partners/create.md"
  body: string;
  title: string;
  brand: boolean; // frontmatter `brand: executive` → on-brand presentation theme
}

function findMarkdown(absDir: string, out: string[]): void {
  for (const entry of readdirSync(absDir).sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = path.join(absDir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) findMarkdown(abs, out);
    else if (entry.endsWith(".md")) out.push(abs);
  }
}

function firstHeading(md: string): string | null {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/[#*`]/g, "").trim() : null;
}

function loadDocs(): Doc[] {
  const files: string[] = [];
  for (const dir of ROOT_DIRS) {
    const abs = path.join(REPO_ROOT, dir);
    if (existsSync(abs)) findMarkdown(abs, files);
  }
  const readme = path.join(REPO_ROOT, "README.md");
  if (existsSync(readme)) files.push(readme);

  return files.map((abs) => {
    const parsed = matter(readFileSync(abs, "utf-8"));
    const relFromRoot = path.relative(REPO_ROOT, abs);
    const title =
      (parsed.data.title as string | undefined) ??
      firstHeading(parsed.content) ??
      path.basename(abs, ".md");
    const brand = (parsed.data.brand as string | undefined) === "executive";
    return { abs, relFromRoot, body: parsed.content, title, brand };
  });
}

/** `../` × (depth of the file's directory below the repo root). */
function relPrefixToRoot(relFromRoot: string): string {
  const depth = path.dirname(relFromRoot).split(path.sep).filter((s) => s && s !== ".").length;
  return depth === 0 ? "" : "../".repeat(depth);
}

function rewriteImages(md: string, relPrefix: string): string {
  // Root-absolute repo paths → relative to this page (base-path independent).
  return md.replace(/(!\[[^\]]*\]\()\/([^)\s]+)\)/g, `$1${relPrefix}$2)`);
}

function rewriteMdLinks(md: string): string {
  // [text](rel/path.md) and [text](rel/path.md#anchor) → .html. Skip http(s).
  return md.replace(
    /\]\((?!https?:)([^)\s]+?)\.md(#[^)\s]*)?\)/g,
    (_full, target, anchor) => `](${target}.html${anchor ?? ""})`,
  );
}

// ── mermaid extraction ─────────────────────────────────────────────────────
// Pull ```mermaid fenced blocks out *before* Markdown parsing so their raw
// contents (arrows like `-->`, `<br/>` labels, `#hex` colors) survive untouched,
// then re-insert them as <div class="mermaid"> *after* parsing for the browser
// to render. Markdown never sees the diagram source, so it can't mangle it.

function extractMermaid(md: string): { md: string; blocks: string[] } {
  const blocks: string[] = [];
  const out = md.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_m, code) => {
    const i = blocks.length;
    blocks.push(String(code).replace(/\s+$/, ""));
    return `\n\nMERMAIDBLOCK${i}ENDMERMAIDBLOCK\n\n`;
  });
  return { md: out, blocks };
}

function reinsertMermaid(html: string, blocks: string[]): string {
  // The placeholder is a bare text line, so marked wraps it in <p>…</p>; match
  // both the wrapped and unwrapped forms.
  return html.replace(
    /<p>\s*MERMAIDBLOCK(\d+)ENDMERMAIDBLOCK\s*<\/p>|MERMAIDBLOCK(\d+)ENDMERMAIDBLOCK/g,
    (_m, a, b) => `<div class="mermaid">\n${blocks[Number(a ?? b)]}\n</div>`,
  );
}

// ── manuals index `<!-- children -->` expansion ───────────────────────────

function isManualsIndex(abs: string): boolean {
  return abs.startsWith(MANUALS_DIR + path.sep) && path.basename(abs) === "index.md";
}

function childrenList(indexAbs: string, all: Doc[]): string {
  const indexDir = path.dirname(indexAbs);
  const kids: Doc[] = [];
  for (const d of all) {
    if (d.abs === indexAbs || !d.abs.startsWith(MANUALS_DIR + path.sep)) continue;
    const dDir = path.dirname(d.abs);
    const isIndex = path.basename(d.abs) === "index.md";
    if (!isIndex && dDir === indexDir) kids.push(d); // leaf in same dir
    else if (isIndex && path.dirname(dDir) === indexDir) kids.push(d); // sub-dir index
  }
  kids.sort((a, b) => a.title.localeCompare(b.title));
  if (!kids.length) return "";
  const lines = ["## Pages in this section", ""];
  for (const k of kids) {
    const href = path.relative(indexDir, k.abs).replace(/\.md$/, ".html");
    lines.push(`- [${k.title}](${href})`);
  }
  return lines.join("\n");
}

// ── HTML shell ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2.5rem 1.25rem 6rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px; line-height: 1.6; color: #1f2328; background: #ffffff;
}
.markdown-body { max-width: 900px; margin: 0 auto; }
.markdown-body h1, .markdown-body h2 { border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; }
.markdown-body h1 { font-size: 2em; margin: .67em 0; }
.markdown-body h2 { font-size: 1.5em; margin-top: 1.8em; }
.markdown-body h3 { font-size: 1.25em; margin-top: 1.5em; }
.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: .875em; background: #eff1f3; padding: .2em .4em; border-radius: 6px;
}
.markdown-body pre {
  background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow: auto;
}
.markdown-body pre code { background: none; padding: 0; font-size: .85em; }
.markdown-body table { border-collapse: collapse; width: 100%; margin: 1rem 0; display: block; overflow: auto; }
.markdown-body th, .markdown-body td { border: 1px solid #d1d9e0; padding: 6px 13px; }
.markdown-body th { background: #f6f8fa; font-weight: 600; }
.markdown-body tr:nth-child(2n) td { background: #f6f8fa; }
.markdown-body img { max-width: 100%; height: auto; border: 1px solid #d1d9e0; border-radius: 6px; }
.markdown-body blockquote {
  margin: 0; padding: 0 1em; color: #59636e; border-left: .25em solid #d1d9e0;
}
.markdown-body hr { height: 1px; background: #d1d9e0; border: 0; margin: 2rem 0; }
.markdown-body ul, .markdown-body ol { padding-left: 2em; }
`;

// Opt-in, on-brand presentation layer (frontmatter `brand: executive`). Scoped
// to `.theme-executive` so non-branded docs (manuals, plans, reports) are
// unaffected. Brand navy #032b5b; print rules give clean Print → PDF output.
const BRAND_STYLE = `
.theme-executive h1 {
  color: #032b5b; border-bottom: 3px solid #032b5b; font-size: 2.25em;
  padding-bottom: .35em; letter-spacing: -0.01em;
}
.theme-executive h2 { color: #032b5b; border-bottom: 1px solid #d1d9e0; margin-top: 2.2em; }
.theme-executive h3 { color: #0a3d73; }
.theme-executive a { color: #0a5ad6; }
.theme-executive blockquote {
  border-left: .25em solid #032b5b; background: #f3f6fb; color: #2b3a4a;
  padding: .75em 1em; border-radius: 0 8px 8px 0;
}
.theme-executive table {
  display: table; box-shadow: 0 1px 2px rgba(3,43,91,.06);
  border-radius: 8px; overflow: hidden;
}
.theme-executive thead th { background: #032b5b; color: #ffffff; border-color: #032b5b; }
.theme-executive tbody tr:nth-child(2n) td { background: #f3f6fb; }
.theme-executive .mermaid {
  margin: 1.75rem 0; text-align: center; background: #ffffff;
  border: 1px solid #e3e9f1; border-radius: 12px; padding: 1.25rem;
}
@media print {
  body { padding: 0 !important; }
  .theme-executive { max-width: none; }
  .theme-executive h1, .theme-executive h2, .theme-executive thead th {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .theme-executive h2 { break-before: page; page-break-before: always; }
  .theme-executive .mermaid, .theme-executive table, .theme-executive blockquote {
    break-inside: avoid; page-break-inside: avoid;
  }
}
`;

// Client-side diagram rendering. UMD build (classic script) for broad
// compatibility, including pages opened directly from disk (file://).
const MERMAID_SCRIPT = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: "base",
    themeVariables: {
      primaryColor: "#eaf1f9",
      primaryBorderColor: "#032b5b",
      primaryTextColor: "#032b5b",
      lineColor: "#5b6b7f",
      secondaryColor: "#f3f6fb",
      tertiaryColor: "#ffffff",
      fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    }
  });
</script>`;

function htmlShell(
  title: string,
  bodyHtml: string,
  opts: { brand?: boolean; mermaid?: boolean } = {},
): string {
  const articleClass = opts.brand ? "markdown-body theme-executive" : "markdown-body";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}${opts.brand ? BRAND_STYLE : ""}</style>
</head>
<body>
<article class="${articleClass}">
${bodyHtml}
</article>
${opts.mermaid ? MERMAID_SCRIPT : ""}
</body>
</html>
`;
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const docs = loadDocs();
  let count = 0;
  for (const doc of docs) {
    let md = doc.body;
    if (isManualsIndex(doc.abs)) {
      md = md.replace(/<!--\s*children\s*-->/g, childrenList(doc.abs, docs));
    }
    md = rewriteMdLinks(md);
    md = rewriteImages(md, relPrefixToRoot(doc.relFromRoot));
    const { md: mdNoMermaid, blocks } = extractMermaid(md);
    let bodyHtml = await marked.parse(mdNoMermaid);
    if (blocks.length) bodyHtml = reinsertMermaid(bodyHtml, blocks);
    const outPath = doc.abs.replace(/\.md$/, ".html");
    writeFileSync(
      outPath,
      htmlShell(doc.title, bodyHtml, { brand: doc.brand, mermaid: blocks.length > 0 }),
    );
    count++;
    console.log(`  ✓ ${doc.relFromRoot.replace(/\.md$/, ".html")}`);
  }
  writeFileSync(path.join(REPO_ROOT, ".nojekyll"), "");
  console.log(`\nRendered ${count} HTML pages + .nojekyll`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
