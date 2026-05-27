# Weekly Report — Week of 2026-05-15 → 2026-05-22

**Scope:** All commits across the `andaman-aerodrome` monorepo (16 sub-repos) since Friday 2026-05-15. Author: Peter A. Moelgaard (with Claude pair-programming). Source: git logs across all repos.

**Headline totals:** 65 commits across 11 active repositories. 4 new repositories initialized (`silkskyair-common`, `silkskyair-config`, `silkskyair-docs`, `silkskyair-utils`). All work landed on `develop` branches; staging deploy partially completed mid-week.

---

## 1. SkyStories v2 — End-to-End Publish Pipeline

The week's largest workstream. SkyStories is the editorial content surface that flows Manager UI → Supabase → n8n → Strapi → public WWW. Multiple architectural and correctness fixes hardened the full pipeline.

### Architecture: retire `sync_queue`
- **API** (`silkskyair-api` `401a82c`): dropped the `sync_queue` table, 5-min drain-tick cron, and queue-processor pattern. Removed orphan `claim_next_sync` function.
- **Workflows** (`silkskyair-workflows` `6f0216e`): Events Router now invokes the sync workflow directly via `executeWorkflow`. On failure, emits a `SyncFailed` event that triggers an admin-email — fail-loud replaces silent retry.
- **Rationale:** the queue burned n8n quota, hid real sync failures behind opaque retries, and shadow-loaded Supabase.

### Tour ↔ Story relation (new feature)
- **CMS** (`silkskyair-cms` `1bbee26`): added `tours` many-to-many relation to the `sky-story` schema in Strapi.
- **API** (`9fa25da`): extended `skystories.build_sync_payload` to LEFT JOIN `strapi_sync_map` and emit `tours[]` with each story.
- **Workflows** (`2f08829`): passes `tour_document_ids` through sync → Strapi `PUT` body via `_strapi-write-story-locale`.
- **Manager** (`silkskyair-manager` `8448a8c`): `KeywordsPanel` + `ToursPanel` now pass `userId` explicitly to RPC calls (A+C defense in depth).

### Correctness fixes
- **Per-locale re-sync** (`62faede`): entity setters now bump `entities_i18n.updated_at` so `build_sync_payload`'s `needs_sync` gate fires correctly after first publish.
- **Browser-authenticated RPCs** (`83ab34b`): `set_keywords` / `set_tours` fall back to `auth.uid()` when actor is null (the Manager calls these directly from the browser).
- **Media uploads** (`3f7d755`): `add_media` RPC auto-computes `sort_order = MAX+1`; restored lost `SECURITY DEFINER`. Fixes asset-id correlation in sync.
- **Keyword sync** (Manager `7913657`, `a5d811b`, `8d0ecbc`): keyword sync now correctly `PUT`s the locale variant under the existing Strapi document (Strapi v5 model: one `documentId`, locale variants underneath), includes `slug` on every write, and publishes to ALL translated locales on auto-save (was only syncing the active locale tab).
- **Tour-keyword sync** (Manager `1619f98`): tours-sync now delegates keyword sync to the locale-aware `syncKeywordToStrapi` helper instead of a locale-blind local copy.
- **Media-panel race** (Manager `98384dc`): closed an optimistic-update race where `dataManager.patch` silently no-op'd if the store fetch was still in flight at upload start.
- **Workflow media correlation** (Workflows `0e792fb`): `_strapi-upload-media` now preserves `media_id` through input/output so `aggregate-media` can build its `byMediaId` map.

### Notifications
- **Story published / approved / unpublished** (API `74e6d9b`, Workflows `15fbb1a`): added `StoryUnpublished` → editor+creator email notification (symmetry with `StoryPublished`). New `skystory-unpublished` email template seeded in EN/TH/RU.
- **Test-role grants** (API `b26c78f`): granted `skystory_editor` + `skystory_creator` roles to `peter@andaman.co.th` (idempotent migration) so end-to-end tests see realistic fan-out instead of routing to other editors.

### Caption editing
- **Manager** (`d9bfb4b`): added `MediaCaptionInput` to the media panel (mirrors existing alt-text debounce + optimistic patch). Added `safeFlushAll` helper that surfaces queued-op rejections instead of silently swallowing them.

---

## 2. SSA-621 — Pay-Before-Confirm / Payment Confirmation

- **Customer email** (API `4d42ac2`): new `booking-paid-customer` email template (EN/TH/RU) for the pay-before-confirm flow. Previously only an internal manager email fired on `BookingConfirmed`.
- **Bookings dispatcher** (Workflows `bac3351`):
  - Added `BookingConfirmed → booking-paid-customer` and `BookingPaidInFull → booking-paid-customer` to member slugMap.
  - Set `alwaysOutputData: true` on `fetch-booking-customer-notes` — fixed a pre-existing bug where bookings without customer notes never sent the manager email.
- **Pending-bookings expiry** (API `19d870a`): new `api.expire_pending_bookings` cron job — Phase 1.5 cleanup (decision D1).

---

## 3. SSA-619 — Booking Notes Consolidation

- **i18n labels** (API `888435c`): added TH + RU labels for the `CustomerSubmitted` booking-note-type. Idempotent.
- **Manager** (`7dc3c97`): gated edit affordance on customer-submitted notes (D5).

---

## 4. Performance & Indexing

- **API bookings read indexes** (`08601f5`): three targeted indexes prioritizing read performance:
  1. `analytics.client_interactions(entity_type, entity_id, created_at) WHERE entity_id IS NOT NULL` — eliminates the sort step on the booking-interaction LATERAL subquery.
  2. `public.bookings(member_profile_id, created_at DESC)` composite — skips sort on member-detail view.
  3. `public.organization_bookings(booking_id) WHERE status = 'active'` partial — pre-filters at index level.
- **Manager OngoingFlights** (`ba26f30`): rate-limited fetches (15s min interval) + in-flight coalesce + debounced realtime callback. Mounted on every Manager page, was hitting an expensive `/api/flights/ongoing` endpoint in bursts.
- **Manager FlightPlanPicker** (`d8f4239`): lifted state to parent, reducing 3 redundant `GET /api/flight-plans` to 1 per drawer-open.

---

## 5. Workflow Tooling & CI/CD

- **Content-level audit** (Workflows `ec1b6ea`): `pnpm audit:content:local` and `audit:content:staging` fetch every workflow via REST, canonicalize (unwrap activeVersion, strip volatile metadata, replace credential IDs with names, normalize resource-locator values), and hash-compare against committed JSON. Stronger than the prior registry-only `activeVersionId` check — caught 3 real content drifts.
- **Surgical staging sync** (`9237cd9`): new `--workflow <relpath>` flag on `sync:staging` for force-syncing specific files. Also fixed cross-folder ID-mapping bug — mapping is now built from ALL local workflows (36 entries) instead of just the filtered target list (was missing 33).
- **Dry-run + smart activate/deactivate** (`2af4060`): `--dry-run` flag on `deploy:local` + `deploy:staging`. New `hasEnabledTrigger()` helper drives smart activate vs. deactivate. Pre-deactivate before `PUT` when workflow has no enabled trigger. `deploy:local` now records to `.versions/local.json` (closes asymmetry with `deploy:staging`).
- **Audit normalization** (`e9a7921`): audit now normalizes text-embedded workflow IDs before hashing, symmetric with the sync's swap — eliminated false-positive drift.
- **Shared lib consolidation** (`ee0c6f5`): five duplicated field-list copies across 9 scripts replaced with `scripts/lib/workflow-fields.js` + `scripts/lib/canonical.js`.

### Reporting workflow stabilization
- **Reporting Scheduler disabled** (`86a2929`): the Reporting | Scheduler was firing every 5 minutes against an n8n.cloud plan execution limit, burning quota that other workflows (including SSA-621 verification) needed. Trigger disabled in source; workflow retained for future re-enable.

### Production-pipeline fix
- **Bookings event ID translation** (`38f9227`): re-synced `bookings-event.json` after the Member Email workflow was recreated on staging with a new ID. Live-verified the corrected fan-out.

---

## 6. End-to-End Test Coverage Expansion

A substantial investment in `silkskyair-manager` E2E tests, primarily covering the SkyStories publish pipeline. Built incrementally as a "staircase" — each spec layers one more feature on the prior — so failures pinpoint the smallest broken step.

### New test staircase (`2f1c260`)
| Spec | Locales | Media | Alt | Caption | Keyword | Tour |
|---|---|---|---|---|---|---|
| `publish-with-media` | 1 | 1 | Y | – | – | – |
| `publish-with-two-media` | 1 | 2 | Y | – | – | – |
| `publish-two-locale` | 2 | 0 | – | – | – | – |
| `publish-two-locale-with-media` | 2 | 1 | Y | – | – | – |
| `publish-comprehensive` | 2 | 2 | Y | Y | Y | Y |
| `manager-skystory-link-tour` | UPDATE flow against existing published story | | | | | |

### Tour Save+Publish E2E (`02d9ef3`)
First E2E coverage of the tour Save→Publish path with `strapi_sync_map` verification.

### Comprehensive spec — fixture and helper work
- `createKeywordViaTaxonomyUI` shared fixture (`10a7b05`) drives the Manager Taxonomy create-keyword flow, used by both keyword-creation and comprehensive specs.
- `ensureTourSyncedToStrapi` shared helper (`b3b8eb0`) self-provisions a tour for the comprehensive spec via the publish API.
- `verifyKeywordPrecondition` (`5405981`, `d4574bc`) checks Supabase (source of truth) rather than Strapi.
- Search-by-slug (not title) for deterministic tour selection on staging (`b629f20`) — staging has three tours all titled "TEST".
- Per-locale find-by-id polling (`0a3bcda`) — Strapi v5 list endpoint refuses locale variants for content types mixing localized + non-localized fields.
- FlightRibbon popover dismissal via heading-click (`5c41b40`).
- N8n Notifications workflow assertion (`352fa53`) — polls n8n executions to assert the notification workflow succeeded, catching silent Zoho SMTP failures that the test was previously blind to.
- Opt-in screenshot capture (`3722557`) — 10 numbered PNGs of the full pipeline when `SSA_SCREENSHOT_DIR` is set.
- Single-test staging runs + env-var topology alignment (`b13cf28`) — renamed `E2E_MANAGER_ORIGIN`/`_ORIGIN` → `_BASE_URL` workspace-wide; removed hardcoded Strapi token; throws loudly when env vars missing.

---

## 7. New Repositories & Documentation

### Initialized this week
- **`silkskyair-common`** — shared common code.
- **`silkskyair-config`** — shared config.
- **`silkskyair-utils`** — shared utilities.
- **`silkskyair-docs`** — central planning + reviews repo.

### Documentation produced
- **Member Portal — 1st Review Implementation Plan** (`silkskyair-docs/plans/member-portal-1st-review-2026-05-19.md`): 33 actionable items from the 12-page review delivered by Micheline / Panpaporn / Nuchada on 2026-05-19, organized into 11 workstreams (`MP1-W01..W11`) with user decisions per item.
- **Meta Conversions API (CAPI) Integration Plan** (`silkskyair-docs/plans/meta-capi-purchase-integration.md`): dual-track Pixel + server-side CAPI for the booking Purchase event, with `fbclid`/`fbp`/`fbc` capture in `analytics.client_interactions.metadata`, retry + `analytics.events_sent` for observability, and shared `event_id = booking.reference_code` for dedup.
- **Partnership Portal Round-3 Remediation Plan** (`silkskyair-docs/plans/partnership-portal-client-review.md`, added via orchestrator `16cb434`).
- **Staging deploy state snapshot** (`silkskyair-orchestrator/plans/2026-05-17-staging-deploy-state.md`, `2997057`) — self-contained resume document tracking 5-pillar deploy status (DB / CMS / Workflows / Manager / WWW).
- **W21 planning documents** (orchestrator `bad78df`).
- **Project Management Tools** integrated into orchestrator (`d160ba7`).

### UI library
- **`silkskyair-ui` `e9e401a`**: improved Component Base.

### Member portal
- **`silkskyair-member` `05001b9`**: Globals added (foundation for the MP1 workstream).

---

## 8. Deploy Status (as of pause on 2026-05-17)

From the staging deploy state snapshot:

| Pillar | Local | Staging | Status |
|---|---|---|---|
| Git develop branches | 21 commits across 5 repos | Pre-session HEAD | ⏳ awaiting push develop→staging |
| Supabase DB | max migration `20260517170000` | max `20260516100000` | ⏳ 10 migrations pending |
| Strapi CMS | `tours` field on `sky-story` | 400 on `?populate[0]=tours` | ⏳ awaiting rebuild |
| n8n staging | 35 workflows + admin-email + canonical sync infra | 36 workflows, 5 drift + 1 missing | 🛠 sync script fixes in progress |
| Vercel Manager | 6 new commits | 200 OK | ⏳ awaiting push |
| Vercel WWW | 3 new commits | 200 OK | ⏳ awaiting push |

Subsequent days (2026-05-18 onward) completed the staging sync — workflow audits report 36/36 match, 0 drift on both environments after `9237cd9` + `86a2929` + `2af4060`.

---

## 9. Repo-by-Repo Commit Counts

| Repo | Commits | Theme |
|---|---|---|
| `silkskyair-manager` | 22 | E2E coverage, keyword/tour sync fixes, perf |
| `silkskyair-workflows` | 16 | Sync architecture, tooling, SSA-621 dispatcher |
| `silkskyair-api` | 13 | SkyStories migrations, SSA-621 + SSA-619 templates, indexes |
| `silkskyair-orchestrator` | 4 | Planning docs, PM tools |
| `silkskyair-docs` | 3 | Member Portal + Meta CAPI + Partnership plans |
| `silkskyair-cms` | 2 | `tours` relation on sky-story |
| `silkskyair-common` | 1 | Initial commit |
| `silkskyair-config` | 1 | Initial commit |
| `silkskyair-utils` | 1 | Initial commit |
| `silkskyair-member` | 1 | Globals |
| `silkskyair-ui` | 1 | Improved Component Base |

Quiet repos (no commits in window): `silkskyair-account`, `silkskyair-partner`, `silkskyair-reporting`, `silkskyair-skystories`, `silkskyair-www`.

---

## Suggested Report Highlights

If you're presenting this to stakeholders:

1. **SkyStories v2 pipeline is fully hardened end-to-end** — story → keyword → tour relations all sync correctly across EN/TH/RU locales, with comprehensive E2E coverage that catches both code and infrastructure failures (Zoho rate-limits, Strapi v5 quirks).
2. **`sync_queue` retired** — moved to direct execution + fail-loud admin emails. Less infrastructure, faster failure detection.
3. **SSA-621 customer payment-confirmation email shipped** in EN/TH/RU.
4. **Workflow CI/CD upgraded** — content-level audit (not just versionId), surgical sync, dry-run on all mutating scripts.
5. **Planning groundwork laid** for the next two major workstreams: Member Portal MP1 (33 review items) and Meta CAPI Purchase integration.
6. **3 new shared repos initialized** (common, config, utils, docs) plus the docs repo.
