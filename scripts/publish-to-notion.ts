#!/usr/bin/env tsx
/**
 * publish-to-notion.ts
 *
 * Publishes the silkskyair-docs/manuals/ tree to Notion. Mirrors the
 * filesystem hierarchy as Notion page hierarchy. Two axes are supported:
 *
 *   manuals/
 *     index.md                              ← root ("Documentation")
 *     domains/
 *       index.md                            ← landing page
 *       <domain>/
 *         index.md                          ← domain landing
 *         <feature>.md                      ← leaf feature manual
 *     releases/
 *       index.md
 *       <release>.md                        ← release compilation
 *
 * Conventions:
 *   - `index.md` in a directory = the Notion parent page for that directory.
 *   - Non-index `.md` files = leaf pages, parented to the directory's index.md.
 *   - Frontmatter `title` = the Notion page title.
 *   - `<!-- children -->` marker is replaced with a bulleted list linking to
 *     all child pages (sorted by title).
 *   - Cross-links use relative paths to other .md files; the publisher
 *     rewrites them to the corresponding Notion page URLs.
 *   - Image paths starting with `/screenshots/...` are rewritten to the
 *     public GitHub raw URL.
 *
 * Two-pass publish:
 *   Pass 1: walk the tree, upsert every page with just its title (creates
 *           Notion pages so we have URLs).
 *   Pass 2: walk the tree again, this time rendering full body with
 *           children lists + cross-links resolved + screenshots rewritten,
 *           and update each page's content.
 *
 * Environment:
 *   NOTION_TOKEN              Required. Internal integration token.
 *   DOCS_PARENT_PAGE_ID       Required for the very first publish — the
 *                             Notion page under which the root
 *                             "Documentation" page is created. Once the
 *                             root exists and is discoverable by title,
 *                             this can be omitted on subsequent runs.
 *
 * CLI:
 *   pnpm publish:dry          Walk + print plan, no Notion writes.
 *   pnpm publish              Real run.
 */

import { Client } from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";
import matter from "gray-matter";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Config

const REPO_ROOT = path.resolve(__dirname, "..");
const MANUALS_DIR = path.join(REPO_ROOT, "manuals");
const RAW_URL_PREFIX =
  "https://raw.githubusercontent.com/ANDAMAN-AERODROME/silkskyair-docs/main";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DOCS_PARENT_PAGE_ID = process.env.DOCS_PARENT_PAGE_ID;
if (!NOTION_TOKEN && !dryRun) {
  throw new Error(
    "NOTION_TOKEN is not set. Create an internal integration at https://www.notion.so/profile/integrations, share the target parent page with it, and export NOTION_TOKEN."
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Types

interface ManualNode {
  abs: string;
  rel: string; // path relative to MANUALS_DIR (e.g. "domains/sky-stories/related-tours.md")
  dir: string; // dirname(rel), "" for the manuals/ root
  isIndex: boolean;
  front: Record<string, unknown>;
  body: string;
  title: string;
}

interface PublishedManifest {
  urlByRel: Map<string, string>;
  idByRel: Map<string, string>;
}

// ────────────────────────────────────────────────────────────────────────────
// Filesystem walk

function discoverNodes(): ManualNode[] {
  const out: ManualNode[] = [];
  function walk(absDir: string) {
    for (const entry of readdirSync(absDir).sort()) {
      const abs = path.join(absDir, entry);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
      } else if (entry.endsWith(".md")) {
        const rel = path.relative(MANUALS_DIR, abs);
        const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
        const raw = readFileSync(abs, "utf-8");
        const parsed = matter(raw);
        const isIndex = path.basename(rel) === "index.md";
        const title =
          (parsed.data.title as string | undefined) ??
          path.basename(rel, ".md");
        out.push({
          abs,
          rel,
          dir,
          isIndex,
          front: parsed.data,
          body: parsed.content,
          title,
        });
      }
    }
  }
  walk(MANUALS_DIR);
  return out;
}

function parentOf(
  node: ManualNode,
  byRel: Map<string, ManualNode>
): ManualNode | null {
  if (node.rel === "index.md") return null;
  if (node.isIndex) {
    const parentDir = path.dirname(node.dir);
    const parentRel =
      parentDir === "." || parentDir === ""
        ? "index.md"
        : path.join(parentDir, "index.md");
    return byRel.get(parentRel) ?? null;
  }
  const sameDirIndex = node.dir
    ? path.join(node.dir, "index.md")
    : "index.md";
  return byRel.get(sameDirIndex) ?? null;
}

function childrenOf(node: ManualNode, nodes: ManualNode[]): ManualNode[] {
  if (!node.isIndex) return [];
  const dir = node.dir;
  const out: ManualNode[] = [];
  for (const n of nodes) {
    if (n === node) continue;
    if (n.dir === dir && !n.isIndex) out.push(n);
    else if (n.isIndex && path.dirname(n.dir) === (dir === "" ? "." : dir))
      out.push(n);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

// ────────────────────────────────────────────────────────────────────────────
// Content rendering

function rewriteImagePaths(md: string): string {
  return md.replace(
    /(!\[[^\]]*\]\()\/screenshots\//g,
    `$1${RAW_URL_PREFIX}/screenshots/`
  );
}

function resolveCrossLinks(
  md: string,
  fromAbs: string,
  manifest: PublishedManifest
): string {
  return md.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (full, text, link) => {
    const resolvedAbs = path.resolve(path.dirname(fromAbs), link);
    const resolvedRel = path.relative(MANUALS_DIR, resolvedAbs);
    const notionUrl = manifest.urlByRel.get(resolvedRel);
    if (!notionUrl) {
      console.warn(
        `[publish] cross-link unresolved: ${fromAbs} → ${link} (resolved: ${resolvedRel})`
      );
      return full;
    }
    return `[${text}](${notionUrl})`;
  });
}

function renderChildrenList(
  children: ManualNode[],
  manifest: PublishedManifest
): string {
  if (children.length === 0) return "";
  const lines = ["## Pages in this section", ""];
  for (const c of children) {
    const url = manifest.urlByRel.get(c.rel);
    if (url) lines.push(`- [${c.title}](${url})`);
    else lines.push(`- ${c.title}`);
  }
  return lines.join("\n");
}

function renderBody(
  node: ManualNode,
  children: ManualNode[],
  manifest: PublishedManifest
): string {
  let md = node.body;
  md = resolveCrossLinks(md, node.abs, manifest);
  md = rewriteImagePaths(md);
  const childList = renderChildrenList(children, manifest);
  md = md.replace(/<!--\s*children\s*-->/g, childList);
  return md;
}

// ────────────────────────────────────────────────────────────────────────────
// Notion helpers

type NotionPageInfo = { id: string; url: string };

async function findChildPageByTitle(
  client: Client,
  parentId: string,
  title: string
): Promise<NotionPageInfo | null> {
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({
      block_id: parentId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const child of res.results) {
      if (!("type" in child) || child.type !== "child_page") continue;
      const childTitle = (child as { child_page: { title: string } })
        .child_page.title;
      if (childTitle.trim() === title.trim()) {
        return {
          id: child.id,
          url: `https://www.notion.so/${child.id.replace(/-/g, "")}`,
        };
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return null;
}

async function searchWorkspacePageByTitle(
  client: Client,
  title: string
): Promise<NotionPageInfo | null> {
  const res = await client.search({
    query: title,
    filter: { value: "page", property: "object" },
    page_size: 25,
  });
  for (const r of res.results) {
    if (r.object !== "page" || !("properties" in r)) continue;
    const props = r.properties as Record<string, unknown>;
    const titleProp = Object.values(props).find(
      (p): p is { type: "title"; title: Array<{ plain_text: string }> } =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: string }).type === "title"
    );
    const plain = titleProp?.title.map((t) => t.plain_text).join("") ?? "";
    if (plain.trim() === title.trim()) {
      return {
        id: r.id,
        url: `https://www.notion.so/${r.id.replace(/-/g, "")}`,
      };
    }
  }
  return null;
}

async function deleteAllChildren(client: Client, pageId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const child of res.results) {
      await client.blocks.delete({ block_id: child.id });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

async function upsertChildPage(
  client: Client,
  parentId: string,
  title: string
): Promise<NotionPageInfo> {
  const existing = await findChildPageByTitle(client, parentId, title);
  if (existing) return existing;
  const created = await client.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: { title: [{ text: { content: title } }] },
    } as never,
  });
  return {
    id: created.id,
    url: `https://www.notion.so/${created.id.replace(/-/g, "")}`,
  };
}

async function writePageBody(
  client: Client,
  pageId: string,
  md: string
): Promise<void> {
  const blocks = markdownToBlocks(md);
  await deleteAllChildren(client, pageId);
  for (let i = 0; i < blocks.length; i += 100) {
    await client.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100) as never,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  console.log(`publish-to-notion${dryRun ? " (dry run)" : ""}`);

  const nodes = discoverNodes();
  const byRel = new Map(nodes.map((n) => [n.rel, n]));
  const root = byRel.get("index.md");
  if (!root) {
    throw new Error(`No manuals/index.md — cannot determine root page.`);
  }

  console.log(`Discovered ${nodes.length} nodes:`);
  for (const n of nodes) {
    const parent = parentOf(n, byRel);
    console.log(
      `  ${n.rel.padEnd(60)} title="${n.title}"  parent=${parent ? parent.rel : "<workspace>"}`
    );
  }

  if (dryRun) {
    console.log(`\nDry-run complete (${nodes.length} nodes would be published).`);
    return;
  }

  const client = new Client({ auth: NOTION_TOKEN! });
  const manifest: PublishedManifest = {
    urlByRel: new Map(),
    idByRel: new Map(),
  };

  // Pass 1: upsert all pages with titles only.
  console.log(`\nPass 1: upsert pages (titles only) …`);
  let rootPage: NotionPageInfo | null = await searchWorkspacePageByTitle(
    client,
    root.title
  );
  if (!rootPage) {
    if (!DOCS_PARENT_PAGE_ID) {
      throw new Error(
        `No Notion page titled "${root.title}" is reachable by the integration. ` +
          `Set DOCS_PARENT_PAGE_ID to an existing page (the integration must have access) so "${root.title}" can be created as a child.`
      );
    }
    rootPage = await upsertChildPage(client, DOCS_PARENT_PAGE_ID, root.title);
    console.log(`  ✓ created root "${root.title}"`);
  } else {
    console.log(`  ✓ found root "${root.title}"`);
  }
  manifest.urlByRel.set(root.rel, rootPage.url);
  manifest.idByRel.set(root.rel, rootPage.id);

  function topoSort(): ManualNode[] {
    const ordered: ManualNode[] = [];
    const seen = new Set<string>();
    function visit(n: ManualNode) {
      if (seen.has(n.rel)) return;
      const parent = parentOf(n, byRel);
      if (parent) visit(parent);
      seen.add(n.rel);
      ordered.push(n);
    }
    for (const n of nodes) visit(n);
    return ordered;
  }
  const ordered = topoSort();

  for (const n of ordered) {
    if (n === root) continue;
    const parent = parentOf(n, byRel)!;
    const parentId = manifest.idByRel.get(parent.rel)!;
    const page = await upsertChildPage(client, parentId, n.title);
    manifest.urlByRel.set(n.rel, page.url);
    manifest.idByRel.set(n.rel, page.id);
    console.log(`  ✓ upsert ${n.rel} under ${parent.rel}`);
  }

  // Pass 2: render full body + write to each page.
  console.log(`\nPass 2: render + write bodies …`);
  for (const n of ordered) {
    const children = childrenOf(n, nodes);
    const md = renderBody(n, children, manifest);
    const pageId = manifest.idByRel.get(n.rel)!;
    await writePageBody(client, pageId, md);
    console.log(`  ✓ wrote ${n.rel} (${children.length} children resolved)`);
  }

  console.log(`\nDone. ${ordered.length} pages published.`);
  console.log(`Root: ${manifest.urlByRel.get(root.rel)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
