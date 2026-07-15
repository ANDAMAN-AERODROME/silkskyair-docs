# silkskyair-docs

Documentation source, training manuals, and governance notes for the SilkSkyAir / Andaman Aerodrome platform.

## Contents

```
manuals/             # Markdown source of truth → Notion (see Layout below)
screenshots/        # PNGs captured by the doc-shots Playwright suites
scripts/            # Automation: publish to Notion
plans/              # Project planning notes
reviews/            # Code review artifacts
weekly-reports/     # Weekly engineering reports
weekly-statements/  # Weekly statements
```

## `manuals/` layout — two axes

The manuals library is organized along two axes:

```
manuals/
├── index.md                                ← "Documentation" (root)
├── domains/                                ← AXIS 1: feature manuals by domain
│   ├── index.md                            ← "Manuals by Domain"
│   ├── sky-stories/
│   │   ├── index.md                        ← "SkyStories" landing
│   │   ├── related-tours.md
│   │   ├── captions-and-media-editing.md
│   │   └── keyword-multi-locale-sync.md
│   └── bookings/
│       ├── index.md                        ← "Bookings" landing
│       ├── payment-before-confirmation.md
│       ├── multi-tour-promos.md
│       └── customer-notes.md
├── releases/                               ← AXIS 2: release compilations
│   ├── index.md                            ← "Releases" landing
│   └── w22.md                              ← W22 Release Manual (links to feature pages)
└── platform/                               ← AXIS 3: cross-cutting engineering reference
    ├── index.md                            ← "Platform" landing
    └── third-party-systems.md              ← Third-party systems & dependencies inventory
```

**Conventions:**

- `index.md` in each directory becomes a Notion parent page for that directory.
- Non-index `.md` files are leaf pages parented to their directory's `index.md`.
- Frontmatter `title` is the Notion page title (only field required today).
- `<!-- children -->` marker in a markdown body is replaced by the publisher with an auto-generated bulleted list of all child page links. Use it in landing pages.
- Cross-links between pages use **relative `.md` paths**, e.g. `[Related Tours](../domains/sky-stories/related-tours.md)`. The publisher rewrites these to the corresponding Notion page URLs.
- Images use **absolute repo-rooted paths**, e.g. `![Alt](/screenshots/sky-stories/related-tours/01-stories-index.png)`. The publisher rewrites the `/screenshots/` prefix to the GitHub raw URL.

**Adding a new feature manual:** create `domains/<domain>/<feature>.md` with a `title` frontmatter and the standard step-by-step body. Add it to whichever release compilation(s) it ships in (e.g. append a link in `releases/w22.md`).

**Adding a new release manual:** create `releases/<release>.md` with a `title` frontmatter and a curated list of links to the feature manuals it includes.

**Adding a new domain:** create `domains/<domain>/index.md` (with `title` + a short intro + `<!-- children -->`).

## `screenshots/` layout

Mirrors the `manuals/` domain hierarchy:

```
screenshots/
├── sky-stories/
│   ├── related-tours/                01-…png, 02-…png, …
│   ├── captions-and-media-editing/
│   └── keyword-multi-locale-sync/
└── bookings/
    ├── payment-before-confirmation/
    ├── multi-tour-promos/
    └── customer-notes/
```

PNGs are produced by the Playwright doc-shots specs in the app repos (`silkskyair-www/tests/docs/` and `silkskyair-manager/tests/docs/`) via the shared `takeDocShot(page, "<domain>/<feature>/<NN>-<name>")` helper.

## NPM scripts

```bash
pnpm install --ignore-workspace   # one-time (silkskyair-docs is not in the pnpm workspace)
pnpm publish:dry                  # dry-run — walk the tree + print the plan
pnpm publish                      # real publish (requires NOTION_TOKEN)
```

### Publish to Notion

The publisher walks `manuals/` recursively, mirrors the tree as Notion page hierarchy, and writes each page's body with:
- Cross-links resolved to Notion page URLs
- `<!-- children -->` markers replaced with auto-generated child lists
- `/screenshots/...` image paths rewritten to the public GitHub raw URL

```bash
NOTION_TOKEN=secret_xxx pnpm publish

# First-time only, when the root "Documentation" page doesn't yet exist
# anywhere reachable by the integration:
NOTION_TOKEN=secret_xxx DOCS_PARENT_PAGE_ID=<parent-page-id> pnpm publish
```

Two-pass design: the first pass upserts all pages with just titles (so Notion URLs exist for cross-link resolution); the second pass writes the full body of each page with everything resolved.

For images to render in Notion, the `silkskyair-docs` repo must be public on GitHub (Notion fetches via `raw.githubusercontent.com/.../silkskyair-docs/main/screenshots/...`).

## Capturing screenshots

The Playwright doc-shots suites live in the app repos. Each spec is a thin wrapper around an existing E2E fixture — it imports the canonical setup helpers, drives the same flow, and inserts `takeDocShot()` at customer-visible moments.

```bash
cd silkskyair-www      && pnpm doc-shots     # specs 1–4
cd silkskyair-manager  && pnpm doc-shots     # specs 5–7
```

Both write PNGs to `silkskyair-docs/screenshots/<domain>/<feature>/`. After capture, commit and push — Notion picks up the new images on the next page view.

## Investor documentation (`investors/`)

Investor-facing platform documentation (plain markdown, not published to Notion).
PDF renditions use the **AAC document template** (`templates/aac/aac-template.css`) —
the SilkSkyAir visual language (Hanken Grotesk/Inter, navy + slate) recast in a
corporate/architectural register with a steel-blue accent and no gold.

```bash
pnpm install --ignore-workspace
pnpm build:investor-pdf   # → investors/pdf/ (combined memorandum + per-chapter PDFs)
```

**Versioning.** `investors/version.json` is the single source of truth (document id,
version, issue date, classification, revision history). The build stamps the version on
the cover, page headers, back cover and a Document Control page (with the full revision
history) after the TOC, and archives each issue as
`investors/pdf/archive/AAC-Investor-Documentation-v<version>.pdf`. To issue a new
version: bump `version` and `issued`, append a `history` entry describing the changes,
rebuild, commit. The build fails if the current version has no matching history entry.

Visual directives (fenced code blocks rendered as template components in the PDFs;
shown as readable code blocks on GitHub): `stats` (big-number cards, `VALUE | label`),
`steps` (horizontal flow, `NN | Title | desc`), `layers` (layer-cake stack),
`timeline` (stage timeline, `Marker | Title | desc`), `pull` (pull quote), and the
stylized infographics `viz-network` (route-map panorama + caption chips),
`viz-lifecycle` (customer-journey track, `NN | Title | desc [| major]`, optional
trailing `note:` line), `viz-tenancy` (`op:`/`ghost:` operator cards over a
`foundation:` bar), `viz-ecosystem` (`cell:`/`core:` hub-and-ring grid).
Chapter frontmatter: `summary:` feeds the divider pages and the TOC; `keypoints:`
(list of `Title | desc`) fills the divider's "In this section" cards. Each divider
also carries a per-section SVG motif and a 01–08 progress strip (see
`scripts/build-investor-pdf.mjs`).
