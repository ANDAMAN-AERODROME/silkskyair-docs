#!/usr/bin/env tsx
import { Client } from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";
import matter from "gray-matter";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Config

const REPO_ROOT = path.resolve(__dirname, "..");
const MANUAL_DIR = path.join(REPO_ROOT, "manual");
const MANUAL_PARENT_TITLE = "Staff Training Manual — W22 Release";

const RAW_URL_PREFIX =
  "https://raw.githubusercontent.com/ANDAMAN-AERODROME/silkskyair-docs/main/screenshots";

// ────────────────────────────────────────────────────────────────────────────
// CLI

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--only="));
const onlySlug = onlyArg ? onlyArg.slice("--only=".length) : null;
const updateParent = args.includes("--update-parent");

// ────────────────────────────────────────────────────────────────────────────
// Env

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN && !dryRun) {
  throw new Error(
    "NOTION_TOKEN is not set. Create an internal integration at https://www.notion.so/profile/integrations, share the parent page with it, and export NOTION_TOKEN before running."
  );
}

const explicitParentId = process.env.MANUAL_PARENT_PAGE_ID || null;

// ────────────────────────────────────────────────────────────────────────────
// Helpers

type NotionPage = { id: string; title: string };

async function searchPageByTitle(
  client: Client,
  title: string
): Promise<NotionPage | null> {
  const res = await client.search({
    query: title,
    filter: { value: "page", property: "object" },
    page_size: 20,
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
    if (plain.trim() === title.trim()) return { id: r.id, title: plain };
  }
  return null;
}

async function findChildPageByTitle(
  client: Client,
  parentId: string,
  title: string
): Promise<NotionPage | null> {
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({
      block_id: parentId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const child of res.results) {
      if (!("type" in child) || child.type !== "child_page") continue;
      const childTitle = (child as { child_page: { title: string } }).child_page
        .title;
      if (childTitle.trim() === title.trim()) {
        return { id: child.id, title: childTitle };
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
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

function rewriteImagePaths(md: string): string {
  // ./screenshots/foo/bar.png  →  RAW_URL_PREFIX/foo/bar.png
  return md.replace(/\.\/screenshots\//g, `${RAW_URL_PREFIX}/`);
}

function listManualFiles(): string[] {
  return readdirSync(MANUAL_DIR)
    .filter((f) => f.endsWith(".md") && f !== "_parent.md")
    .sort();
}

// ────────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  console.log(`Publish-to-Notion${dryRun ? " (dry run)" : ""}`);

  const client = new Client({ auth: NOTION_TOKEN ?? "dry-run-no-token" });

  // 1. Resolve manual parent page
  let manualParentId = explicitParentId;
  if (!manualParentId && !dryRun) {
    const found = await searchPageByTitle(client, MANUAL_PARENT_TITLE);
    if (!found) {
      throw new Error(
        `Manual parent page "${MANUAL_PARENT_TITLE}" not found.\n` +
          `Either:\n` +
          `  - Create it in Notion (under "Documentation"), share with the integration, and re-run.\n` +
          `  - Or set MANUAL_PARENT_PAGE_ID=<page-id> to an existing page.`
      );
    }
    manualParentId = found.id;
  }
  console.log(
    dryRun
      ? `Parent: <skipped in dry-run>`
      : `Parent: ${MANUAL_PARENT_TITLE} (${manualParentId})`
  );

  // 2. Optionally update parent page content from _parent.md
  if (updateParent && manualParentId && !dryRun) {
    const parentPath = path.join(MANUAL_DIR, "_parent.md");
    const { content: parentBody } = matter(readFileSync(parentPath, "utf-8"));
    const rewritten = rewriteImagePaths(parentBody);
    const blocks = markdownToBlocks(rewritten) as Array<
      Parameters<Client["blocks"]["children"]["append"]>[0]["children"][number]
    >;
    console.log(`Updating parent page content (${blocks.length} blocks)…`);
    await deleteAllChildren(client, manualParentId);
    // Append in chunks of 100 (Notion limit)
    for (let i = 0; i < blocks.length; i += 100) {
      await client.blocks.children.append({
        block_id: manualParentId,
        children: blocks.slice(i, i + 100),
      });
    }
  }

  // 3. For each feature .md, upsert under the parent
  const files = listManualFiles();
  for (const file of files) {
    if (onlySlug && !file.includes(onlySlug)) continue;
    const full = path.join(MANUAL_DIR, file);
    const { data: front, content: body } = matter(readFileSync(full, "utf-8"));
    const title = String(front.title ?? file.replace(/\.md$/, ""));

    const rewritten = rewriteImagePaths(body);
    const blocks = markdownToBlocks(rewritten);

    if (dryRun) {
      console.log(`\n→ ${title}`);
      console.log(`  source: ${file}`);
      console.log(`  blocks: ${blocks.length}`);
      const preview = rewritten.slice(0, 200).replace(/\n/g, " ");
      console.log(`  preview: ${preview}…`);
      continue;
    }

    if (!manualParentId) throw new Error("parent id missing");

    const existing = await findChildPageByTitle(client, manualParentId, title);
    if (existing) {
      console.log(`Updating: ${title} (${existing.id})`);
      await deleteAllChildren(client, existing.id);
      for (let i = 0; i < blocks.length; i += 100) {
        await client.blocks.children.append({
          block_id: existing.id,
          children: blocks.slice(i, i + 100) as never,
        });
      }
    } else {
      console.log(`Creating: ${title}`);
      // Create with an initial slice (max 100 children) then append the rest.
      const first = blocks.slice(0, 100);
      const created = await client.pages.create({
        parent: { page_id: manualParentId },
        properties: {
          title: { title: [{ text: { content: title } }] },
        } as never,
        children: first as never,
      });
      for (let i = 100; i < blocks.length; i += 100) {
        await client.blocks.children.append({
          block_id: created.id,
          children: blocks.slice(i, i + 100) as never,
        });
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
