# Production Release — Staging → Production

**Date:** 2026-05-26
**Release scope:** All apps with commits ahead of `main` (full coordinated release)

---

## 0. Release Inventory

| Repo | Branch | Commits ahead of `main` | Deploy target | Notes |
|---|---|---:|---|---|
| `silkskyair-api` (API/DB) | `develop` | 45 | Supabase prod (`sinxjnvesyrrkydhtqts`) | 27 new migrations since 2026-05-01 |
| `silkskyair-cms` | `develop` | 3 | Strapi Cloud | Schema change: `sky-story` ↔ `tours` manyToMany, slug doc-level |
| `silkskyair-workflows` | `develop` | 23 | n8n (production instance) | SkyStories events router, sync retirement |
| `silkskyair-www` | `develop` | 39 | Vercel | SSA-621 payment-before-confirmation, deeplinks, SkyStories Related Tours |
| `silkskyair-manager` | `develop` | 30 | Vercel | SkyStories editorial UI, Tours+keywords sync, perf |
| `silkskyair-account` | `develop` | 1 | Vercel | E2E config only |
| `silkskyair-member` | `develop` | 3 | Vercel | UI alias rename + Globals + E2E |
| `silkskyair-partner` | `develop` | 2 | Vercel | Cancellation logging + offline handling |
| `silkskyair-skystories` (lib) | `develop` | 1 | Workspace dependency | `updateMediaMetadata` export — consumed by Manager |

### Headline features in this release

1. **SSA-621 — Payment-before-confirmation** (API + WWW + Workflows + Manager emails)
2. **Pricing W19** — multi-tour scope, pax bounds, `pricing.promotion_tours` junction, booking attribution (API + WWW)
3. **SkyStories editorial sync overhaul** — retired `sync_queue`, per-entity locks, system actor, Strapi tours manyToMany (API + CMS + Workflows + Manager)
4. **Bookings perf** — read indexes, `expire_pending_bookings` cron, `get_booking_metadata`
5. **i18n** — TH/RU labels for CustomerSubmitted note type, customer payment confirmation email template

---

## 1. Pre-flight (T-24h)

> Run from your workstation. All steps **must** be done before declaring the release window.

### 1.1 Confirm staging is healthy

- [ ] Smoke-test staging WWW: book a tour end-to-end with a Thai 3DS card (touches SSA-621 payment flow + W19 promotions)
- [ ] Smoke-test staging Manager: publish a SkyStory in EN + TH + RU; verify it appears on staging WWW
- [ ] Open staging Strapi admin — verify sky-story content type has `tours` (manyToMany) relation
- [ ] Check n8n staging instance — SkyStories Events Router last 24h has no failures
- [ ] Run E2E suites on staging:
  ```bash
  cd silkskyair-www && pnpm test:e2e
  cd silkskyair-manager && pnpm test:e2e
  ```
- [ ] Inspect Sentry / logs for unhandled errors on staging in the last 7 days

### 1.2 Freeze + announce

- [ ] Post in #engineering: **"Production release window: <start>–<end>. No staging deploys, no prod hotfixes during this window."**
- [ ] Confirm no in-flight bookings on prod that would be disrupted by 5–10 min API downtime during the payment-flow cutover

### 1.3 Verify credentials are in place

- [ ] `silkskyair-api/.env.production` has `SUPABASE_PASSWORD`
- [ ] `silkskyair-cms/.env.transfer` has `PRODUCTION_URL`, `PRODUCTION_PUSH_TOKEN`, `STRAPI_UPLOAD_SCRIPT_TOKEN`
- [ ] `silkskyair-workflows/.env.production` has n8n production API key
- [ ] Vercel CLI logged in (`vercel whoami`) with access to all 5 Vercel projects

### 1.4 Take pre-release backups

```bash
# API + Storage
cd silkskyair-api
pnpm backup:full:production

# CMS (use Strapi transfer pull or Strapi Cloud snapshot)
# Trigger via Strapi Cloud dashboard → Backups → Create snapshot

# Workflows (snapshot current production state)
cd silkskyair-workflows
pnpm versions:snapshot:production
```

- [ ] Backups landed in `.tmp/backups/` (API) and Strapi Cloud snapshot completed
- [ ] Note backup filenames in the release log

---

## 2. Deploy order (rationale)

Order matters because of forward dependencies. The flow is:

```
silkskyair-skystories (lib)              ← no runtime impact, built first
        ↓
silkskyair-api (DB migrations + RPCs)    ← schema must land before consumers
        ↓
silkskyair-cms (Strapi schema)           ← sky-story↔tours relation required by WWW + Workflows
        ↓
silkskyair-workflows (n8n)               ← consumes new RPCs + new Strapi schema
        ↓
silkskyair-www + silkskyair-manager      ← consume new API contract + new CMS schema
        ↓
silkskyair-member / -account / -partner  ← UI-only, fan out last
        ↓
Post-deploy verification
```

**Hard rule:** never deploy WWW or Manager before API migrations + CMS schema are live in prod — they will hit "column does not exist" and "relation not found" errors.

---

## 3. Step-by-step

### Step 3.1 — Tag & merge `develop` → `main` (all repos)

For each repo with commits ahead, fast-forward `main` to `develop` and tag. Do **not** push yet — we push per-repo at deploy time.

```bash
# Run for each of: silkskyair-skystories, silkskyair-api, silkskyair-cms,
# silkskyair-workflows, silkskyair-www, silkskyair-manager,
# silkskyair-account, silkskyair-member, silkskyair-partner

cd silkskyair-<name>
git fetch origin
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/develop          # or merge --no-ff if you want a merge commit
git tag -a v<x.y.z> -m "Production release 2026-05-26"
# DO NOT git push yet — staged per step below
```

If fast-forward fails on any repo, stop and investigate: `main` has diverged. Per `silkskyair-manager/CLAUDE.md`, **never push without explicit user approval**.

---

### Step 3.2 — Build & publish `silkskyair-skystories` lib

The lib is a workspace dependency consumed by Manager. The `updateMediaMetadata` export change must be present before Manager builds in CI.

```bash
cd silkskyair-skystories
pnpm install
pnpm build
git push origin main
git push origin v<x.y.z>
```

Verify: `dist/` artifact contains the new export and the version bump landed.

---

### Step 3.3 — Deploy API migrations to production Supabase

**This is the riskiest step. There are 27 new migrations including the W19 pricing junction rewrite and SkyStories sync retirement.**

#### 3.3.1 Dry-run locally one more time

```bash
cd silkskyair-api
# Verify ALL migrations apply cleanly locally — required by CLAUDE.md
# (does NOT reset prod; resets local 127.0.0.1:54322 only)
npx supabase db reset --local
```

If any migration fails locally, **stop and fix the root cause** — do not rename `.bak`, do not skip (per `silkskyair-api/CLAUDE.md`).

#### 3.3.2 Confirm production backup completed (from §1.4)

```bash
ls -lh .tmp/backups/production_*.sql.gz | tail -3
```

#### 3.3.3 Push migrations to production

```bash
# Source the production password
source .env.production

npx supabase db push \
  --db-url "postgresql://postgres:${SUPABASE_PASSWORD}@db.sinxjnvesyrrkydhtqts.supabase.co:6543/postgres"
```

Watch for:
- "ERROR" output → abort, restore from backup
- Long-running statements on `pricing.promotion_tours` junction creation (W19) — expected, do not interrupt
- `expire_pending_bookings` cron — confirm it registered in `cron.job`

#### 3.3.4 Spot-check schema

```bash
PGPASSWORD="$SUPABASE_PASSWORD" psql \
  -h db.sinxjnvesyrrkydhtqts.supabase.co -U postgres -d postgres \
  -c "SELECT count(*) FROM pricing.promotion_tours;" \
  -c "SELECT * FROM cron.job WHERE jobname LIKE '%expire_pending%';" \
  -c "SELECT count(*) FROM api.bookings LIMIT 1;"
```

- [ ] All three queries return without error
- [ ] No tables marked `error` in the migration history (`supabase_migrations.schema_migrations`)

#### 3.3.5 Push `main` for `silkskyair-api`

```bash
git push origin main
git push origin v<x.y.z>
```

---

### Step 3.4 — Deploy Strapi CMS

The sky-story content type gained a `tours` manyToMany relation and the slug field moved to doc-level (not localized). This is a **schema change** in Strapi Cloud.

#### 3.4.1 Push code to Strapi Cloud

Strapi Cloud auto-deploys from the configured branch. Push `main`:

```bash
cd silkskyair-cms
git push origin main
git push origin v<x.y.z>
```

Strapi Cloud will:
1. Detect the schema change
2. Run its migration
3. Restart the admin

#### 3.4.2 Verify in Strapi Cloud admin

- [ ] Log into prod Strapi admin
- [ ] Open Content-Type Builder → `sky-story` → confirm `tours` (manyToMany) relation exists
- [ ] Confirm `slug` field is no longer per-locale
- [ ] Existing sky-story entries still load (spot-check 3)
- [ ] Build status: green

If Strapi Cloud build fails, do **not** retry blindly — inspect the migration log; the prior bump-to-1.3.0 commit was specifically to re-trigger a Strapi Cloud build, so re-triggering may be safe but verify the failure first.

---

### Step 3.5 — Deploy n8n workflows to production

23 workflow changes including SkyStories events router refactor (sync_queue retirement) and notification additions.

```bash
cd silkskyair-workflows

# Dry-run the diff
pnpm check:production

# Review the diff — confirm only expected workflows are changing
# Then deploy
pnpm sync:production
```

Per-workflow individual deploy (if you prefer surgical control):

```bash
node scripts/deploy-to-production.js workflows/skystories/sky-stories-events.json
node scripts/deploy-to-production.js workflows/skystories/sky-stories-notifications.json
# ... repeat for each changed workflow
```

Verify in n8n production UI:
- [ ] SkyStories Events Router is active and pointing at the new RPC names
- [ ] SkyStories Notifications workflow is active
- [ ] No workflows are deactivated unintentionally
- [ ] Run a manual test execution of `sky-stories-events` against a fixture payload

Push code:

```bash
git push origin main
git push origin v<x.y.z>
```

---

### Step 3.6 — Deploy WWW (Vercel)

SSA-621 payment islands, deeplinks, Related Tours under SkyStory detail.

```bash
cd silkskyair-www
git push origin main
git push origin v<x.y.z>
```

Vercel will build automatically off the production branch. While it builds:

- [ ] Confirm Vercel env vars for prod include `WWW_BASE_URL` (added in commit 38531b0)
- [ ] Confirm `OMISE_*` keys are set on prod (these moved to env-vars in commit 4a9b4db)
- [ ] Watch build log for Astro errors

When build is green:
- [ ] Hit `https://silkskyair.com` — homepage renders
- [ ] Hit a sky-story detail page — Related Tours section renders
- [ ] Hit `/promotions` — filler promotions are filtered out, urgency badges render
- [ ] Open booking widget on a tour — opens via hash trigger
- [ ] **Do a real 3DS test booking** (small-amount tour) — payment-before-confirmation flow completes, return_uri routes correctly

---

### Step 3.7 — Deploy Manager (Vercel)

SkyStories editorial UI, Tours+keyword sync, optimistic-update fixes, perf.

```bash
cd silkskyair-manager
git push origin main
git push origin v<x.y.z>
```

When Vercel build is green:
- [ ] Log into prod Manager
- [ ] Open SkyStories → publish a draft story in EN + TH + RU → verify it lands in Strapi prod and on WWW prod
- [ ] Open Tours → save + publish a tour → verify `strapi_sync_map` updated and tour appears on WWW
- [ ] Taxonomy → create a keyword → confirm it publishes across all locales
- [ ] OngoingFlights screen loads without 429 / rate-limit errors (new throttling)

---

### Step 3.8 — Deploy remaining portals (Vercel)

These are small changes but verify each one independently:

```bash
cd silkskyair-account && git push origin main && git push origin v<x.y.z>
cd silkskyair-member  && git push origin main && git push origin v<x.y.z>
cd silkskyair-partner && git push origin main && git push origin v<x.y.z>
```

- [ ] account.silkskyair.com — sign-in works
- [ ] member.silkskyair.com — globals load, sign-in works
- [ ] partner.silkskyair.com — booking cancellation works, offline state renders if API blip

---

## 4. Post-deploy verification (T+30 min)

### 4.1 Cross-system smoke test

The goal: prove the **new** end-to-end paths added in this release work in production.

| # | Scenario | Touches |
|---|---|---|
| 1 | Anonymous user books a Phang Nga tour with a 3DS card, completes 3DS, sees confirmation page | WWW + API (SSA-621) |
| 2 | Anonymous user applies a multi-tour promotion deeplink, sees pax-clamp + progressive disclosure | WWW + API (W19) |
| 3 | Manager user publishes a new SkyStory in EN/TH/RU, verifies it appears on WWW in all 3 locales | Manager + API + Workflows + CMS + WWW |
| 4 | Manager user creates a keyword via Taxonomy UI, verifies it syncs to Strapi in all locales | Manager + Workflows + CMS |
| 5 | Cron: confirm `api.expire_pending_bookings` runs on schedule and expires a stale test booking | API |
| 6 | Customer receives the new payment-confirmation email | API (templates) + Workflows |

Track results in the release log.

### 4.2 Monitoring

- [ ] Sentry: no spike in errors across WWW, Manager, Account, Member, Partner
- [ ] Supabase logs: no spike in 5xx, no migration locks lingering
- [ ] n8n: SkyStories Events Router execution history is green
- [ ] Strapi Cloud: no build/runtime errors

### 4.3 Update memory + release notes

- [ ] Tag the release in `silkskyair-docs/weekly-statements/` if applicable
- [ ] Note any discrepancies vs. this plan in `silkskyair-docs/plans/production-release-2026-05-26.md` (this file)

---

## 5. Rollback plan

Rollback is **per-app**, not global. The order matters: WWW + Manager rolling back without API rolling back is safer than the inverse.

### 5.1 If WWW/Manager/Account/Member/Partner is broken
- Use Vercel dashboard → Deployments → previous deployment → **Promote to production**
- Or `vercel rollback` via CLI
- Resume forward fix on a hotfix branch

### 5.2 If Strapi schema is broken
- Restore from the Strapi Cloud snapshot taken in §1.4
- Revert the `silkskyair-cms` `main` commit and re-push to trigger a clean build
- Notify Manager users that publishing is paused

### 5.3 If n8n workflows are broken
- Each workflow has a previous activeVersionId in `silkskyair-workflows/.versions/production.json`
- Re-activate the prior version from the n8n UI or by re-deploying the prior workflow JSON

### 5.4 If API/DB is broken (worst case)
- **Stop all Vercel projects first** (set production deployment paused) to prevent new traffic hitting broken schema
- Restore the database backup from §1.4:
  ```bash
  cd silkskyair-api
  gunzip .tmp/backups/production_backup_TIMESTAMP.sql.gz
  PGPASSWORD="$SUPABASE_PASSWORD" psql \
    -h db.sinxjnvesyrrkydhtqts.supabase.co -U postgres -d postgres \
    -f .tmp/backups/production_backup_TIMESTAMP.sql
  ```
- **DO NOT** run `supabase db reset` — explicitly forbidden by `silkskyair-api/CLAUDE.md`
- Once DB is back to pre-release state, roll back each Vercel project to its pre-release deployment

### 5.5 If only ONE migration is broken
Don't restore the whole DB. Author a forward-fix migration (`20260526_HHMMSS_revert_<thing>.sql`) and push via `supabase db push`. Restore is only for catastrophic / unrecoverable state.

---

## 6. Out of scope for this release

Documented here so they don't get bundled in by accident:

- Customer-generated tables (bookings, member_*, payment_intents, etc.) are **never** copied from staging to production (see [DEPLOYMENT.md](../../silkskyair-api/DEPLOYMENT.md))
- The 47-table data export pipeline (`pnpm deploy:production` in `silkskyair-api`) is **not** part of this release — it was used for initial seeding only. This release is schema-only via `supabase db push`.
- `silkskyair-orchestrator` and `silkskyair-reporting` — no commits ahead, nothing to ship

---

## 7. Release checklist (compressed)

Copy this into the release tracking issue / Slack thread:

- [ ] §1 Pre-flight done (smoke tests, freeze announced, backups taken)
- [ ] §3.1 All 9 repos: develop merged to main + tagged locally
- [ ] §3.2 skystories lib pushed
- [ ] §3.3 API migrations pushed to prod Supabase (27 migrations applied)
- [ ] §3.4 CMS pushed; Strapi Cloud build green; schema verified
- [ ] §3.5 Workflows synced to prod n8n; manual test execution green
- [ ] §3.6 WWW deployed; real 3DS booking succeeded
- [ ] §3.7 Manager deployed; cross-locale story publish verified end-to-end
- [ ] §3.8 Account / Member / Partner deployed
- [ ] §4 Post-deploy smoke tests all green
- [ ] Release window closed; freeze lifted in #engineering
