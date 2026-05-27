# silkskyair-docs

Documentation source, training manuals, and governance notes for the SilkSkyAir / Andaman Aerodrome platform.

## Contents

```
manual/             # Staff training manual (markdown source of truth → Notion)
screenshots/        # PNGs captured by the doc-shots Playwright suites
scripts/            # Automation: publish to Notion, seed staging demo data
plans/              # Project planning notes
reviews/            # Code review artifacts
weekly-reports/     # Weekly engineering reports
weekly-statements/  # Weekly statements
```

## NPM scripts

All scripts require this package's deps. Install once:

```bash
pnpm install --ignore-workspace
```

(The `--ignore-workspace` flag is needed because `silkskyair-docs` is not a
member of the top-level pnpm workspace.)

### `pnpm publish:dry` / `pnpm publish`

Rebuild the Notion pages under **Documentation → Staff Training Manual —
W22 Release** from the markdown files in `manual/`.

```bash
# Validate without writing to Notion
pnpm publish:dry

# Publish for real (requires NOTION_TOKEN; optional MANUAL_PARENT_PAGE_ID)
NOTION_TOKEN=secret_xxx pnpm publish
```

Image references in the markdown (`./screenshots/...`) are rewritten to
`https://raw.githubusercontent.com/ANDAMAN-AERODROME/silkskyair-docs/main/screenshots/...`,
so the silkskyair-docs repo must be public on GitHub for Notion to render
the images.

The script supports `--only=<slug>` to publish a single page (faster
iteration while authoring).

### `pnpm seed:staging`

Idempotent staging-data seeder for the W22 staff training manual. Creates
the demo records the doc-shots Playwright specs depend on, and writes
their identifiers to `.cache/staging-fixtures.json` — the single source of
truth that every doc-shot spec reads via `loadDocFixtures()`.

```bash
# One-time setup
cp .env.staging.example .env.staging
# fill in SUPABASE_SERVICE_KEY (from 1Password)

# Run all commands
pnpm seed:staging

# Or one at a time
pnpm seed:staging --only=booking-note
pnpm seed:staging --only=story-tour
pnpm seed:staging --only=keyword          # prints a note (no DB seed needed)

# Validate without writing
pnpm seed:staging --dry-run
```

The seed script auto-loads `.env.<DOCS_TARGET>` (default `staging`). The
env vars it expects are the standard Supabase names — no custom prefix:

| Env var | Source |
|---|---|
| `SUPABASE_URL` | `.env.staging` (committed in example form) |
| `SUPABASE_SERVICE_KEY` | 1Password → fill into `.env.staging` |
| `SEED_ACTOR_USER_ID` (optional) | Defaults to `peter@andaman.co.th`'s staging UUID |

What gets seeded:

| Command | What it does | Fixture key written | Idempotent? |
|---|---|---|---|
| `booking-note` | Creates a booking + customer-submitted note (via the public RPC). Reuses any existing seed-tagged booking on rerun. | `bookingWithCustomerNote.id` | Yes |
| `story-tour` | Creates or reuses the `training-related-tours-demo` Sky Story and links one active Tour (that has a hero or feature image) via the `skystories.set_tours` RPC. | `skyStoryRelatedTours.slug` | Yes |
| `keyword` | No DB seed needed — the keyword-sync doc-shot spec creates its own keyword per run. | (none) | n/a |

The `multiTourPromo.deeplink` fixture is hand-maintained — the seed script
doesn't yet provision promotions. After creating an active multi-tour
promo in Manager, add the key by hand:

```bash
echo '{"multiTourPromo":{"deeplink":"/book?promo=W22LAUNCH"}}' >> .cache/staging-fixtures.json
# (or merge it in manually if other keys are already present)
```

## Capturing screenshots

The Playwright doc-shots suites live in the app repos, not here:

```bash
cd silkskyair-www
pnpm doc-shots           # captures specs 1–4 to silkskyair-docs/screenshots/

cd silkskyair-manager
pnpm doc-shots           # captures specs 5, 6 + the Manager half of 4
```

Both suites write to `silkskyair-docs/screenshots/` (resolved via
`DOCS_SCREENSHOTS_DIR` if you need to override) and read demo-record
identifiers from `silkskyair-docs/.cache/staging-fixtures.json` (resolved
via `DOCS_FIXTURES_FILE`). After capture, commit the PNGs and push —
Notion auto-renders them on the next page view.

### Configuration vs fixtures

The doc-shots system distinguishes two kinds of input:

- **Configuration** (env vars, change rarely, scoped to runtime):
  `DOCS_TARGET`, `DOCS_BASE_URL`, `DOCS_SCREENSHOTS_DIR`,
  `DOCS_FIXTURES_FILE`, `DOCS_PUBLIC_BASE_URL`, `DOCS_CAPTIONS_STORY_ID`,
  `DOCS_KEYWORD_VERIFY_STORY_SLUG`.

- **Fixtures** (data-shape identifiers, populated by `pnpm seed:staging`,
  shared across specs via the JSON file): `skyStoryRelatedTours.slug`,
  `bookingWithCustomerNote.id`, `multiTourPromo.deeplink`.

Per-spec env vars (the old `DOC_RELATED_TOURS_STORY_SLUG`,
`DOC_BOOKING_WITH_CUSTOMER_NOTE_ID`, etc.) were removed — they didn't
scale and forced operators to copy IDs around between shells.
