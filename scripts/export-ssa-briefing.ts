#!/usr/bin/env tsx
/**
 * export-ssa-briefing.ts
 *
 * Produces a single, self-contained, **SSA-branded** HTML export of a briefing
 * markdown file — styled with the SilkSkyAir template (navy letterhead with the
 * gold logo, brand typography, navy footer) so it can be shared or printed to PDF
 * as an on-brand company document.
 *
 * This is separate from `render-html.ts` (the GitHub-Pages doc renderer). It does
 * NOT touch other docs; it emits one `*.ssa.html` next to the source markdown.
 *
 * Brand sources (verified in-repo, not invented):
 *   - Header navy `#032b5b`, footer navy `#06254a`  (silkskyair-www Header/Footer)
 *   - Brand palette #112950 → #2f8bff → #b9dcff       (www global.css @theme)
 *   - Inter typeface                                  (www global.css / tailwind)
 *   - Gold logo lock-up                               (www public/images/logos)
 *
 * CLI:
 *   pnpm export:ssa                 # default: the platform executive briefing
 *   tsx scripts/export-ssa-briefing.ts <path/to/file.md>
 */

import { marked } from "marked";
import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SRC = path.join(
  REPO_ROOT,
  "briefings",
  "platform-executive-briefing.md",
);
const LOGO_PATH = path.join(REPO_ROOT, "briefings", "assets", "ssa-logo.png");

marked.setOptions({ gfm: true });

// ── Mermaid extraction (same approach as render-html.ts) ────────────────────
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
  return html.replace(
    /<p>\s*MERMAIDBLOCK(\d+)ENDMERMAIDBLOCK\s*<\/p>|MERMAIDBLOCK(\d+)ENDMERMAIDBLOCK/g,
    (_m, a, b) => `<div class="mermaid">\n${blocks[Number(a ?? b)]}\n</div>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SSA brand stylesheet ────────────────────────────────────────────────────
const SSA_STYLE = `
:root{
  --navy:#032b5b;          /* header chrome  */
  --navy-deep:#06254a;     /* footer chrome  */
  --ink:#112950;           /* headings/body (brand-900) */
  --ink-soft:#3a4a6b;
  --accent:#1d6fec;        /* brand-600 link */
  --accent-soft:#2f8bff;   /* brand-500 */
  --sky-50:#eef7ff;        /* tints */
  --sky-100:#d9ecff;
  --sky-200:#b9dcff;
  --line:#dbe4f0;
  --gold:#c2a25e;          /* echoes the gold logo */
  --paper:#ffffff;
  --canvas:#eef1f7;
  color-scheme:light;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  font-size:16px;line-height:1.65;color:var(--ink);background:var(--canvas);
  -webkit-font-smoothing:antialiased;
}

/* Letterhead band */
.ssa-letterhead{
  background:linear-gradient(180deg,var(--navy) 0%,#022247 100%);
  border-bottom:3px solid var(--gold);
}
.ssa-letterhead__row{
  max-width:960px;margin:0 auto;padding:18px 40px;
  display:flex;align-items:center;justify-content:space-between;gap:24px;
}
.ssa-letterhead img{height:34px;width:auto;display:block;}
.ssa-letterhead__meta{
  text-align:right;color:var(--sky-200);
  font-size:11px;letter-spacing:.22em;text-transform:uppercase;line-height:1.5;
}
.ssa-letterhead__meta strong{color:#ffffff;font-weight:600;display:block;letter-spacing:.22em;}

/* Paper */
.ssa-paper{
  max-width:960px;margin:32px auto;background:var(--paper);
  border:1px solid var(--line);border-radius:14px;
  box-shadow:0 12px 40px rgba(3,43,91,.10);
  padding:56px 64px 40px;
}

/* Cover block (title + meta + lede) */
.ssa-cover{border-bottom:2px solid var(--line);margin-bottom:8px;padding-bottom:8px;}
.ssa-cover h1{
  color:var(--ink);font-size:2.5rem;line-height:1.12;font-weight:800;
  letter-spacing:-.02em;margin:.1em 0 .35em;
}
.ssa-cover p{color:var(--ink-soft);font-size:.95rem;margin:.2em 0;}
.ssa-cover blockquote{
  margin:1.3em 0 .4em;padding:1em 1.25em;border:0;border-left:4px solid var(--gold);
  background:var(--sky-50);border-radius:0 10px 10px 0;
  color:var(--ink-soft);font-size:1.02rem;line-height:1.6;
}
.ssa-cover blockquote p{color:var(--ink-soft);font-size:1.02rem;}

/* Content */
.ssa-content{padding-top:8px;}
.ssa-content h2{
  color:var(--navy);font-size:1.5rem;font-weight:700;letter-spacing:-.01em;
  margin:2.4em 0 .8em;padding-top:.9em;border-top:1px solid var(--line);
}
.ssa-content h2:first-of-type{border-top:0;padding-top:0;margin-top:1.2em;}
.ssa-content h3{color:#143A7B;font-size:1.16rem;font-weight:700;margin:1.7em 0 .5em;}
.ssa-content h4{color:var(--ink);font-size:1rem;font-weight:700;margin:1.3em 0 .4em;}
.ssa-content p{margin:.7em 0;}
.ssa-content a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(29,111,236,.35);}
.ssa-content a:hover{border-bottom-color:var(--accent);}
.ssa-content strong{color:var(--ink);font-weight:700;}
.ssa-content ul,.ssa-content ol{padding-left:1.4em;margin:.6em 0;}
.ssa-content li{margin:.32em 0;}
.ssa-content code{
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;font-size:.85em;
  background:var(--sky-50);color:#0b3a73;padding:.12em .42em;border-radius:5px;
  border:1px solid var(--sky-100);
}
.ssa-content hr{height:1px;background:var(--line);border:0;margin:0;}

/* Callouts */
.ssa-content blockquote{
  margin:1.3em 0;padding:.9em 1.2em;border:0;border-left:4px solid var(--accent-soft);
  background:var(--sky-50);border-radius:0 10px 10px 0;color:var(--ink-soft);
}
.ssa-content blockquote strong{color:var(--navy);}

/* Tables */
.ssa-content table{
  border-collapse:separate;border-spacing:0;width:100%;margin:1.4em 0;
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
  box-shadow:0 1px 2px rgba(3,43,91,.05);font-size:.93rem;
}
.ssa-content thead th{
  background:var(--navy);color:#fff;font-weight:600;text-align:left;
  padding:11px 14px;border-bottom:1px solid var(--navy);letter-spacing:.01em;
}
.ssa-content tbody td{padding:10px 14px;border-top:1px solid var(--line);vertical-align:top;}
.ssa-content tbody tr:nth-child(2n) td{background:var(--sky-50);}
.ssa-content tbody tr:hover td{background:var(--sky-100);}

/* Diagrams */
.ssa-content .mermaid{
  margin:1.8rem 0;text-align:center;background:#fff;
  border:1px solid var(--line);border-radius:12px;padding:1.4rem;
}

/* Footer band */
.ssa-footer{background:var(--navy-deep);color:#cdd8f0;margin-top:36px;}
.ssa-footer__row{
  max-width:960px;margin:0 auto;padding:30px 40px;
  display:flex;gap:28px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;
}
.ssa-footer img{height:30px;width:auto;opacity:.96;}
.ssa-footer__text{font-size:12px;line-height:1.7;color:#b7c6e3;max-width:560px;text-align:right;margin-left:auto;}
.ssa-footer__text strong{color:#fff;font-weight:600;}
.ssa-footer__rule{height:2px;background:var(--gold);opacity:.85;}

@media print{
  @page{margin:14mm;}
  body{background:#fff;}
  .ssa-paper{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;padding:0 0 8mm;}
  .ssa-letterhead,.ssa-footer,.ssa-letterhead__row,.ssa-footer__row{
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .ssa-content h2,.ssa-content thead th,.ssa-cover blockquote,.ssa-content blockquote{
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .ssa-content h2{break-before:page;page-break-before:always;}
  .ssa-content h2:first-of-type{break-before:auto;page-break-before:auto;}
  .ssa-content .mermaid,.ssa-content table,.ssa-content blockquote{
    break-inside:avoid;page-break-inside:avoid;
  }
}
`;

const MERMAID_SCRIPT = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({
    startOnLoad:true,
    theme:"base",
    themeVariables:{
      primaryColor:"#eaf1f9",
      primaryBorderColor:"#032b5b",
      primaryTextColor:"#0b2b53",
      lineColor:"#5b6b7f",
      secondaryColor:"#eef7ff",
      tertiaryColor:"#ffffff",
      fontFamily:"Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    }
  });
</script>`;

function logoDataUri(): string {
  if (!existsSync(LOGO_PATH)) {
    throw new Error(`Logo not found at ${LOGO_PATH}`);
  }
  const b64 = readFileSync(LOGO_PATH).toString("base64");
  return `data:image/png;base64,${b64}`;
}

async function main() {
  const srcArg = process.argv[2];
  const src = srcArg ? path.resolve(srcArg) : DEFAULT_SRC;
  if (!existsSync(src)) throw new Error(`Source markdown not found: ${src}`);

  const parsed = matter(readFileSync(src, "utf-8"));
  const title = (parsed.data.title as string | undefined) ?? "SilkSkyAir Briefing";
  const eyebrow = (parsed.data.eyebrow as string | undefined) ?? "Executive Briefing";
  const logo = logoDataUri();

  // Pull diagrams out before parsing; split the front (title/meta/lede) from the
  // body on the first horizontal rule, so the front renders as a styled cover.
  const { md: noMermaid, blocks } = extractMermaid(parsed.content);
  const segments = noMermaid.split(/\n-{3,}\n/);
  const frontMd = segments[0] ?? "";
  const restMd = segments.slice(1).join("\n\n---\n\n");

  const coverHtml = await marked.parse(frontMd, { breaks: true });
  let contentHtml = await marked.parse(restMd);
  if (blocks.length) contentHtml = reinsertMermaid(contentHtml, blocks);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Silk Sky Air</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${SSA_STYLE}</style>
</head>
<body>
<header class="ssa-letterhead">
  <div class="ssa-letterhead__row">
    <img src="${logo}" alt="Silk Sky Air">
    <div class="ssa-letterhead__meta"><strong>${escapeHtml(eyebrow)}</strong>Confidential · Internal</div>
  </div>
</header>

<main class="ssa-paper">
  <section class="ssa-cover">
${coverHtml}
  </section>
  <article class="ssa-content">
${contentHtml}
  </article>
</main>

<div class="ssa-footer__rule"></div>
<footer class="ssa-footer">
  <div class="ssa-footer__row">
    <img src="${logo}" alt="Silk Sky Air">
    <div class="ssa-footer__text">
      <strong>Andaman Aerodrome Company (AAC) — Silk Sky Air</strong><br>
      Prepared by the Platform / Engineering team. This document describes the platform as built and
      running as of June 2026. Recurring-cost figures are to be completed by Finance.<br>
      <strong>Confidential</strong> — for internal leadership use only.
    </div>
  </div>
</footer>
${blocks.length ? MERMAID_SCRIPT : ""}
</body>
</html>
`;

  const outPath = src.replace(/\.md$/, ".ssa.html");
  writeFileSync(outPath, html);
  console.log(`  ✓ ${path.relative(REPO_ROOT, outPath)}  (${blocks.length} diagrams, logo embedded)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
