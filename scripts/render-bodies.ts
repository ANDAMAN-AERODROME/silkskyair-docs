#!/usr/bin/env tsx
/**
 * One-off helper: render each manuals/*.md page body to stdout with all
 * transformations applied (image URLs + cross-links + children lists).
 * Reads the page-id manifest from MANIFEST env var as JSON. Outputs a JSON
 * map of { rel → { pageId, body } }.
 *
 * Used to produce content for Notion MCP update-page calls during the
 * initial publish, since the publisher's HTTP client path needs a token
 * the operator hasn't provisioned yet.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const REPO_ROOT = path.resolve(__dirname, "..");
const MANUALS_DIR = path.join(REPO_ROOT, "manuals");
const RAW_URL_PREFIX =
  "https://raw.githubusercontent.com/ANDAMAN-AERODROME/silkskyair-docs/main";

interface Node {
  abs: string;
  rel: string;
  dir: string;
  isIndex: boolean;
  body: string;
  title: string;
}

function discover(): Node[] {
  const out: Node[] = [];
  function walk(d: string) {
    for (const e of readdirSync(d).sort()) {
      const abs = path.join(d, e);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (e.endsWith(".md")) {
        const rel = path.relative(MANUALS_DIR, abs);
        const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
        const parsed = matter(readFileSync(abs, "utf-8"));
        out.push({
          abs,
          rel,
          dir,
          isIndex: path.basename(rel) === "index.md",
          body: parsed.content,
          title: (parsed.data.title as string) ?? path.basename(rel, ".md"),
        });
      }
    }
  }
  walk(MANUALS_DIR);
  return out;
}

function childrenOf(node: Node, nodes: Node[]): Node[] {
  if (!node.isIndex) return [];
  const dir = node.dir;
  const out: Node[] = [];
  for (const n of nodes) {
    if (n === node) continue;
    if (n.dir === dir && !n.isIndex) out.push(n);
    else if (n.isIndex && path.dirname(n.dir) === (dir === "" ? "." : dir))
      out.push(n);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

function rewriteImages(md: string): string {
  return md.replace(
    /(!\[[^\]]*\]\()\/screenshots\//g,
    `$1${RAW_URL_PREFIX}/screenshots/`
  );
}

function resolveLinks(
  md: string,
  fromAbs: string,
  urlByRel: Map<string, string>
): string {
  return md.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (full, text, link) => {
    const resolvedAbs = path.resolve(path.dirname(fromAbs), link);
    const resolvedRel = path.relative(MANUALS_DIR, resolvedAbs);
    const url = urlByRel.get(resolvedRel);
    if (!url) {
      console.warn(`[render] unresolved cross-link in ${fromAbs}: ${link}`);
      return full;
    }
    return `[${text}](${url})`;
  });
}

function renderChildrenList(
  children: Node[],
  urlByRel: Map<string, string>
): string {
  if (!children.length) return "";
  const lines = ["## Pages in this section", ""];
  for (const c of children) {
    const url = urlByRel.get(c.rel);
    lines.push(url ? `- [${c.title}](${url})` : `- ${c.title}`);
  }
  return lines.join("\n");
}

function render(
  node: Node,
  children: Node[],
  urlByRel: Map<string, string>
): string {
  let md = node.body;
  md = resolveLinks(md, node.abs, urlByRel);
  md = rewriteImages(md);
  md = md.replace(/<!--\s*children\s*-->/g, renderChildrenList(children, urlByRel));
  return md;
}

// ────────────────────────────────────────────────────────────────────────────

const manifestJson = process.env.MANIFEST;
if (!manifestJson) {
  console.error(
    "MANIFEST env var required — JSON map of { rel: { id, url } }"
  );
  process.exit(1);
}
const manifest = JSON.parse(manifestJson) as Record<
  string,
  { id: string; url: string }
>;
const urlByRel = new Map<string, string>(
  Object.entries(manifest).map(([rel, v]) => [rel, v.url])
);

const nodes = discover();
const out: Record<string, { pageId: string; body: string }> = {};
for (const n of nodes) {
  const entry = manifest[n.rel];
  if (!entry) {
    console.warn(`[render] no manifest entry for ${n.rel}, skipping`);
    continue;
  }
  out[n.rel] = {
    pageId: entry.id,
    body: render(n, childrenOf(n, nodes), urlByRel),
  };
}

const outPath = path.join(REPO_ROOT, ".cache", "rendered-bodies.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Rendered ${Object.keys(out).length} pages → ${outPath}`);
