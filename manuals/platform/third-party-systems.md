---
title: "Third-Party Systems & Dependencies"
---

# Third-Party Systems & Dependencies

> **Scope:** Every external (third-party) system, SaaS platform, and hosted service the SilkSkyAir / Andaman Aerodrome platform depends on — what it does for us, which repositories integrate with it, how it is configured, and how it varies across environments.
> **Not covered:** npm/library dependencies that are pure code (React, Tailwind, zod, …) — only *systems* we depend on at runtime, build time, or in operations.
> **Snapshot:** July 2026, compiled from committed code, config, migrations, and workflow definitions across all 19 platform repositories. Configuration is referenced by **variable name only — never by value**.

---

## 1. Quick-reference matrix

| System | Category | Criticality | Used by |
|---|---|---|---|
| [Supabase](#supabase) | Backend: DB / Auth / Storage / Edge Functions | Core — platform down without it | api, www, manager, member, account, partner, reporting, skystories, orchestrator, workflows |
| [n8n Cloud](#n8n) | Workflow automation / integration hub | Core — email, CRM, payments webhooks | workflows, api, manager, member, partner |
| [Strapi Cloud](#strapi) | Headless CMS + managed PostgreSQL | Core — all www content | cms, www, manager, workflows |
| [Vercel](#vercel) | Hosting (all Next.js/Astro apps) | Core | www, manager, member, account, partner |
| [Omise](#omise) | Payment gateway (cards + PromptPay) | Core — all revenue | manager, member, partner, workflows, api |
| [Zoho CRM](#zoho-crm) | CRM (leads, deals, products) | High | workflows, manager, api |
| [Zoho Mail (SMTP)](#zoho-mail) | Transactional email | High | workflows |
| [GitHub](#github) | Source control, CI/CD, package registry, Pages | Core (build/deploy chain) | all repos |
| [Azure Static Web Apps](#azure-swa) | Hosting (legacy andaman.co.th) | Medium | andaman-www |
| [Google Maps Platform](#google-maps) | Maps (JS API, static maps, embeds) | Medium | www, member, ui, andaman-www |
| [Mux](#mux) | Video streaming (HLS) | Medium | api (config), member (playback) |
| [Google Tag Manager / gtag](#gtm) | Tag management & analytics | Medium | www, andaman-www |
| [Meta Pixel + Conversions API](#meta-capi) | Ad attribution (server-side purchase events) | Medium | www, workflows |
| [StatCounter](#statcounter) | Web analytics | Low | www, member, andaman-www |
| [Zoho PageSense](#zoho-pagesense) | Heatmaps / session analytics | Low | www |
| [Zoho SalesIQ](#zoho-salesiq) | Live-chat widget | Low | www |
| [Short.io](#shortio) | URL shortener + QR codes (`go.silkskyair.com`) | Low | manager, workflows |
| [DB-IP](#db-ip) | Geo-IP dataset (IP → country) | Low | api, manager |
| [SCB Open Banking](#scb) | Bank/PromptPay API (sandbox, dormant) | Dormant | member |
| [Notion](#notion) | Docs publishing target | Internal tooling | docs |
| [WhatsApp / Chaty](#whatsapp) | Customer chat entry points | Low | www, andaman-www |
| [CKEditor Cloud](#ckeditor) | Rich-text editor CDN | Low | cms |
| [GoDaddy Managed WordPress](#godaddy) | Origin of legacy andaman.co.th export | Legacy | andaman-www |
| [Google Fonts / jsDelivr CDNs](#cdns) | Font & script CDNs | Low | andaman-www, docs (+ CSP allowances) |
| [OpenAI](#openai) | Supabase Studio AI assistant (local dev only) | Dev-only | api |

---

## 2. Core platform services

<a id="supabase"></a>
### 2.1 Supabase (Supabase Cloud)

The primary backend for the entire platform: managed PostgreSQL, authentication/SSO sessions, object storage (avatars, passports, QR codes, report output, media), Deno Edge Functions, Realtime, and PostgREST/RPC APIs.

- **Integration:** `@supabase/supabase-js` + `@supabase/ssr` SDKs in every app; Supabase CLI + `psql` for migrations; edge functions import the SDK from `esm.sh`. The `skystories` and `reporting` packages bind caller-provided Supabase clients to their own Postgres schemas.
- **Projects / environments** (region `ap-southeast-1`):

  | Environment | Project ref | Notes |
  |---|---|---|
  | Production | `sinxjnvesyrrkydhtqts` | Direct DB host `db.sinxjnvesyrrkydhtqts.supabase.co` |
  | Staging | `blwsmtiesyzityzkxqve` | **Must** connect via IPv4 session pooler `aws-1-ap-southeast-1.pooler.supabase.com:5432` (`pool_mode=session`) — direct host is IPv6-only |
  | Develop | `urmnfmvvhtwlodgwsukb` | |
  | Local | Docker via Supabase CLI | `127.0.0.1:54321` (API) / `:54322` (DB) |

- **Config var names:** `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL`, `SUPABASE_PASSWORD`, `PROJECT_REF`.
- **Key locations:** `silkskyair-api/supabase/` (config, ~450 migrations, seeds, edge functions), `lib/supabase/*` client factories in each Next.js app, `silkskyair-www/src/lib/supabase/client.ts`, `silkskyair-orchestrator/.env*` (per-environment endpoints).

<a id="n8n"></a>
### 2.2 n8n (n8n Cloud + local Docker)

The integration hub. All outbound automation runs through n8n workflows: booking lifecycle events, Omise payment webhooks, Zoho CRM sync, all transactional email, campaign publishing (Strapi + Short.io), Meta CAPI dispatch, magic-link auth emails, and reporting dispatch. The apps deliberately have **no direct email/CRM SDKs** — they fire n8n webhooks instead.

- **Integration:** inbound webhooks (`/webhook/...`) authenticated with an `X-API-Key` header (Header Auth credential "AAC | SAA | Auth | Internal Services"); the n8n public REST API (`/api/v1/workflows`, header `X-N8N-API-KEY`) is used by the deployer scripts in `silkskyair-workflows`. Supabase edge functions and DB triggers POST to n8n; webhook base URLs live in the `system_config` table with env vars as fallback.
- **Environments:**

  | Environment | Host |
  |---|---|
  | Production / develop | `https://andamanaerodrome.app.n8n.cloud` |
  | Staging | `https://staging-andamanaerodrome.app.n8n.cloud` |
  | Local | `http://localhost:5678` (docker-compose: `n8nio/n8n` + `postgres:15-alpine`) |

  Each environment has its own workflow IDs, credential IDs, and data-table IDs — mapped by `silkskyair-workflows/scripts/lib/deployer.js` from the `.env.*` files (`N8N_WF_*`, `N8N_CRED_*`).
- **Config var names:** `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_API_KEY` / `WEBHOOK_API_KEY`, `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_PROJECT_ID`, `N8N_PAYMENT_REQUEST_WEBHOOK`, `N8N_ZOHO_DEAL_STAGES_WEBHOOK`, `NEXT_PUBLIC_N8N_URL`; DB config keys `n8n_webhook_base_url`, `n8n_api_key`, `booking_webhook`.
- **Key locations:** `silkskyair-workflows/workflows/**` (all definitions), `silkskyair-api/supabase/functions/_shared/n8n.ts`, `silkskyair-manager/lib/n8n/`, `silkskyair-partner/lib/n8n/`, `silkskyair-orchestrator/N8N_WORKFLOW_DEPENDENCY_MATRIX.md` (full workflow inventory).

<a id="strapi"></a>
### 2.3 Strapi (Strapi Cloud)

Headless CMS for all public website content: tours, sky stories, static pages, promotions, campaign landing pages, booking-widget config, and analytics component config. Runs on Strapi Cloud with managed PostgreSQL (SQLite locally).

- **Integration:** REST API with bearer tokens (`fetch`, no SDK) from www and manager; the n8n "Campaigns Publisher" workflow POSTs landing pages to `/api/landings`; a Strapi publish event triggers a Vercel production rebuild via n8n. Content moves between environments with `strapi transfer` (remote transfer enabled) and a custom media-upload script.
- **Environments:**

  | Environment | Host |
  |---|---|
  | Production | `https://cms.silkskyair.com` (Strapi Cloud) |
  | Staging | `https://hopeful-nature-255f0bdea0.strapiapp.com` |
  | Develop | `https://bold-poem-7acdec93b3.strapiapp.com` |
  | Local | `http://localhost:1337` (SQLite) |

- **Config var names:** `STRAPI_URL` / `STRAPI_BASE_URL`, `STRAPI_TOKEN` / `STRAPI_API_TOKEN`, `STRAPI_WORKFLOWS_URL`, `STRAPI_UPLOAD_SCRIPT_TOKEN`; transfer: `STAGING_URL`, `STAGING_PULL_TOKEN`, `DEVELOP_URL`, `DEVELOP_PUSH_TOKEN`, `PRODUCTION_URL`, `PRODUCTION_PUSH_TOKEN`; CMS internals: `DATABASE_*`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PUBLIC_URL`.
- **Key locations:** `silkskyair-cms/` (the Strapi app), `silkskyair-www/src/lib/strapi.ts`, `silkskyair-manager/lib/strapi/`, `silkskyair-workflows/workflows/campaigns/publisher.json`, `silkskyair-api` `strapi_sync_map` table + skystories sync functions.

---

## 3. Payments

<a id="omise"></a>
### 3.1 Omise

Thailand-focused payment gateway handling **all card and PromptPay QR payments** (currency THB, amounts in satang), including 3-D Secure redirects.

- **Integration:**
  - Server-side: `omise` npm SDK (charges, sources) in manager, member, and partner.
  - Client-side: hosted **Omise.js** (`https://cdn.omise.co/omise.js`, `window.OmiseCard`) for card tokenization; `vault.omise.co` and `api.omise.co` allow-listed in CSP. QR images are served from Omise's own S3 bucket (`omise-gateway-production.s3.ap-southeast-1.amazonaws.com`) — this is Omise infrastructure, not a separate AWS dependency.
  - Webhooks: Omise `charge.complete` / `charge.create` / `charge.failure` events POST to the n8n `/webhook/omise` workflow, which updates `payment_intents` via RPC. Failures escalate by email to `ops@silkskyair.com`.
- **Test vs live:** selected purely by which keys are supplied per environment (`pkey_test_*` / `skey_test_*` vs `pkey_live_*` / `skey_live_*`). Manager and member **must run in the same mode**. Keys are provisioned in each app's Vercel project (staging + production); none are committed to the repos.
- **Config var names:** `OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`.
- **Key locations:** `lib/integrations/omise.ts` (manager, member, partner), payment API routes in each app, `silkskyair-workflows/workflows/payments/omise.json`, `silkskyair-api` `payments` schema migrations.

<a id="scb"></a>
### 3.2 SCB Open Banking (dormant)

SCB (Siam Commercial Bank) PromptPay QR generation + inbound payment webhooks. **Sandbox credentials only; the live payment flow runs through Omise.** Webhook shared-secret validation code remains in `silkskyair-member/lib/utils/webhook.ts`; the `app/api/scb/*` routes referenced in the README no longer exist.

- **Config var names:** `SCB_API_KEY`, `SCB_API_SECRET`, `SCB_MERCHANT_ID`, `SCB_BILLER_ID`, `SCB_CALLBACK_SHARED_SECRET`.

---

## 4. CRM, email & customer communication

<a id="zoho-crm"></a>
### 4.1 Zoho CRM

CRM of record. n8n workflows create Leads from new members, create/update/delete Deals from bookings and booking events, sync Tours → Products, and fetch deal stages/fields/pipelines. The manager app maps Zoho deal stages to booking statuses.

- **Integration:** n8n `zohoCrm` node + direct REST to `https://www.zohoapis.com/crm/v2/...` using the OAuth2 credential "AAC | SSA | Zoho | Accounts". Apps never call Zoho directly — manager proxies through n8n webhooks. Integration registry rows live in the Supabase `integrations` table (slugs `zoho-deal-stages`, `zoho-products`, `zoho-deal-fields`, `member-zoho-lead`, `booking-zoho-deal`).
- **Key locations:** `silkskyair-workflows/workflows/zoho/*.json`, `silkskyair-manager/app/api/crm/zoho/*`, `silkskyair-api` Zoho integration migrations.

<a id="zoho-mail"></a>
### 4.2 Zoho Mail (SMTP)

All transactional email: booking manager notifications, booking member emails, team/member invitations, magic-link sign-in emails, payment-request emails. Sent from n8n `emailSend` nodes via the SMTP credential "AAC | SSA | Zoho | SMTP"; authorized sender `system@silkskyair.com` (workflow config key `zoho_mail_from_address`).

- **Config var names (n8n stack):** `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`, `N8N_CRED_ZOHO_SMTP`.
- **Key locations:** `silkskyair-workflows/workflows/notifications/*.json`, `workflows/auth/member-magic-link-email.json`.

<a id="zoho-pagesense"></a>
### 4.3 Zoho PageSense

Heatmaps / session analytics on the public website. Loaded from `cdn.pagesense.io`; configuration comes from Strapi with env fallback.

- **Config var names:** `PUBLIC_PAGESENSE_SPACE`, `PUBLIC_PAGESENSE_PROJECT`.
- **Key location:** `silkskyair-www/src/components/analytics/PageSense.astro`.

<a id="zoho-salesiq"></a>
### 4.4 Zoho SalesIQ

Live-chat widget on the public website (`salesiq.zohopublic.com`), consent-gated.

- **Config var name:** `PUBLIC_SALESIQ_WIDGET_CODE`.
- **Key location:** `silkskyair-www/src/components/analytics/SalesIQ.astro`.

<a id="whatsapp"></a>
### 4.5 WhatsApp (wa.me) & Chaty

Customer chat entry points: `wa.me` click-to-chat links on the SilkSkyAir contact page; the legacy andaman.co.th export bundles the **Chaty** (Premio) multi-channel chat widget WordPress plugin.

---

## 5. Marketing, analytics & attribution

<a id="gtm"></a>
### 5.1 Google Tag Manager / Google tag

- **silkskyair-www:** GTM container `GTM-M7C3BGJG` with **Google Consent Mode v2** (EU-region consent defaults). Vars: `PUBLIC_GTM_ID`, `PUBLIC_GTM_CONSENT_GATED`. Also Google Search Console verification via `PUBLIC_GOOGLE_SITE_VERIFICATION`.
- **andaman-www (legacy):** `gtag.js` with tag `GT-TQS9STJZ` plus the Google Site Kit WordPress plugin, baked into the static export.

<a id="meta-capi"></a>
### 5.2 Meta Pixel + Conversions API (CAPI)

Server-side ad attribution: the website captures `fbclid` / `_fbp` / `_fbc`, and on booking confirmation an n8n workflow fires a server-side **Purchase** event to `graph.facebook.com` CAPI. Outcomes are recorded as `MetaCapiSent` / `MetaCapiSkipped` / `MetaCapiFailed` booking events. Authenticated with a Meta System User token held as the n8n credential "AAC | SAA | Auth | Meta CAPI" (`N8N_CRED_META_CAPI`).

- **Full manual:** see [Meta CAPI domain manuals](../domains/meta-capi/index.md).

<a id="statcounter"></a>
### 5.3 StatCounter

Page-view/visitor analytics via `statcounter.com/counter/counter.js` + noscript pixel. Used on the public website (production only, consent-gated, plus a custom event sink), on member public payment pages, and in the legacy andaman.co.th export.

- **Config var names:** `PUBLIC_STATCOUNTER_PROJECT` / `NEXT_PUBLIC_STATCOUNTER_PROJECT`, `PUBLIC_STATCOUNTER_SECURITY` / `NEXT_PUBLIC_STATCOUNTER_SECURITY`.

<a id="shortio"></a>
### 5.4 Short.io

URL shortener behind `go.silkskyair.com` — short links + PNG QR codes for published campaigns (QR images are re-uploaded to Supabase storage). Called from the manager publish route and the n8n Campaigns Publisher via `https://api.short.io`.

- **Config var names:** `SHORTIO_API_KEY`, `SHORTIO_DOMAIN`; workflow config keys `shortio_api_key`, `shortio_domain`.

<a id="db-ip"></a>
### 5.5 DB-IP (Geo-IP dataset)

IP → country resolution for reporting/geo attribution. The free **DB-IP Country Lite** CSV (CC-BY-4.0, no API key) is downloaded monthly from `download.db-ip.com` into the `geo.ip_ranges` table — triggered from the manager settings UI or `silkskyair-api/scripts/refresh-geo-ip.sh`.

---

## 6. Maps & media

<a id="google-maps"></a>
### 6.1 Google Maps Platform

- **www:** Maps JavaScript API (libraries `marker,places`) for helipad/tour maps + an iframe embed on promotions. Vars: `PUBLIC_GOOGLE_MAPS_API_KEY`, `PUBLIC_GOOGLE_MAP_ID`.
- **member:** departure-airfield maps via the shared `LocationMap` component. Var: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- **ui (shared library):** `LocationMap` renders the Static Maps API and Google Maps directions links; the API key is passed as a component prop by the consuming app.
- **andaman-www (legacy):** embedded `maps.google.com` iframe on the contact page.

<a id="mux"></a>
### 6.2 Mux

Video hosting/streaming (HLS) for check-in safety-briefing videos and Sky Stories media. Playback fetches `https://stream.mux.com/{playbackId}.m3u8` (member app uses `hls.js`; `*.mux.com` allow-listed in CSP). Server-side asset management uses `@mux/mux-node`; credentials are stored in the `system_config` table (keys `mux_token_id`, `mux_token_secret`, `safety_video_urls`).

---

## 7. Hosting, delivery & developer platforms

<a id="vercel"></a>
### 7.1 Vercel

Hosts every Next.js/Astro app via the native GitHub↔Vercel integration (no GitHub Actions deploy workflows):

| App | Production domain | Notes |
|---|---|---|
| silkskyair-www | `www.silkskyair.com` | Astro + `@astrojs/vercel` adapter — static build in production, SSR in previews (`VERCEL_ENV`) |
| silkskyair-manager | `manager.silkskyair.com` | custom install script pins `@andaman-aerodrome/*` package tags to the git branch (`VERCEL_GIT_COMMIT_REF`) |
| silkskyair-member | `my.silkskyair.com` | |
| silkskyair-account | `account.silkskyair.com` | SSO hub for all apps |
| silkskyair-partner | `partners.silkskyair.com` | |

Staging uses `staging-*` / `staging.*` subdomain variants. Environment variables (Supabase, Omise, n8n, Strapi, …) are provisioned per Vercel project. Non-production deployments load the Vercel Live toolbar (`vercel.live`). An n8n workflow triggers a production rebuild when Strapi content is published (`N8N_WF_STRAPI_VERCEL_BUILD`).

<a id="azure-swa"></a>
### 7.2 Azure Static Web Apps

Hosts the legacy static export of `andaman.co.th` (`andaman-www`). Deployed by GitHub Actions (`Azure/static-web-apps-deploy@v1`) with branch mapping `main` → Production, `staging` → Staging, `develop` → Development. Secret name: `AZURE_STATIC_WEB_APPS_API_TOKEN`.

<a id="github"></a>
### 7.3 GitHub (org `ANDAMAN-AERODROME`)

- **Source control** for all 19 repos.
- **GitHub Packages** (`npm.pkg.github.com`): private npm registry for the `@andaman-aerodrome/*` scope — `silkskyair-ui`, `silkskyair-skystories`, `silkskyair-reporting`. Consumers authenticate via `.npmrc` (`NPM_TOKEN` / `NODE_AUTH_TOKEN`).
- **GitHub Actions:** package publish pipelines in `silkskyair-ui`, `silkskyair-skystories`, `silkskyair-reporting` (per-branch dist-tags: `main` → `latest`, otherwise the branch name; version suffixed with the short SHA), plus the Azure SWA deploy in `andaman-www`. The app repos have no Actions — they deploy through Vercel.
- **GitHub Pages + raw.githubusercontent.com:** serves the rendered HTML of this docs repo and the screenshot images referenced from Notion.

<a id="godaddy"></a>
### 7.4 GoDaddy Managed WordPress (legacy origin)

The original `andaman.co.th` WordPress site was hosted on GoDaddy Managed WordPress; its static export still carries GoDaddy `wsimg.com` traffic-instrumentation scripts and the WordPress plugin stack (Yoast SEO, Elementor + Pro, Unlimited Elements, Blocksy theme, Chaty). These are baked assets in `andaman-www`, not live server dependencies.

<a id="cdns"></a>
### 7.5 Public CDNs

- **Google Fonts** (`fonts.googleapis.com` / `fonts.gstatic.com`): loaded at runtime by the legacy andaman.co.th export and the docs briefing export. The current apps self-host fonts (Hanken Grotesk, Inter as local assets); several CSPs merely allow-list the Google Fonts hosts.
- **jsDelivr** (`cdn.jsdelivr.net`): Mermaid diagram rendering in generated docs HTML.
- **CKEditor Cloud** (`cdn.ckeditor.com`, `proxy-event.ckeditor.com`): <a id="ckeditor"></a>rich-text editor assets for the Strapi admin (via `@ckeditor/strapi-plugin-ckeditor`).
- **Omise CDN** (`cdn.omise.co`, `vault.omise.co`): see [Omise](#omise).

---

## 8. Internal tooling dependencies

<a id="notion"></a>
### 8.1 Notion

Publishing target for this documentation library: `silkskyair-docs/scripts/publish-to-notion.ts` mirrors the `manuals/` tree into Notion via `@notionhq/client` (+ `@tryfabric/martian`). Vars: `NOTION_TOKEN`, `DOCS_PARENT_PAGE_ID`.

<a id="openai"></a>
### 8.2 OpenAI (local dev only)

Wired only into Supabase Studio's built-in AI assistant for local development (`silkskyair-api/supabase/config.toml`: `openai_api_key = "env(OPENAI_API_KEY)"`). No application code calls OpenAI.

### 8.3 Browser automation (local, not SaaS)

Playwright (E2E tests + documentation screenshots, driven from `silkskyair-orchestrator`) and Puppeteer (investor PDF rendering in `silkskyair-docs`) run headless Chromium locally. Listed for completeness — no hosted service involved.

---

## 9. Configured-but-disabled scaffolding

Present in `silkskyair-api/supabase/config.toml` as standard Supabase scaffolding, all currently **disabled** — potential future integrations, not active dependencies:

- **Twilio** (SMS OTP) — `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`
- **SendGrid** (SMTP example, commented) — `SENDGRID_API_KEY`
- **AWS S3** (experimental storage backend) — `S3_HOST`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- **External OAuth providers** (Apple, Google, GitHub, Auth0, Firebase, AWS Cognito, Clerk, …) — all `enabled = false`
- **hCaptcha / Cloudflare Turnstile** — commented out

The SCB integration ([§3.2](#scb)) is similarly dormant.

---

## 10. First-party hosts that look external

These are **our own** systems, listed so nobody mistakes them for third-party vendors:

| Host | What it is |
|---|---|
| `account.silkskyair.com` | SilkSkyAir SSO/identity hub (silkskyair-account app) — all apps delegate sign-in to it |
| `go.silkskyair.com` | Our branded short-link domain (backed by Short.io) |
| `cms.silkskyair.com` | Our production Strapi Cloud instance behind a custom domain |
| `manager.` / `my.` / `partners.` / `www.silkskyair.com`, `andaman.co.th` | First-party apps (see hosting matrix) |

---

## 11. Repository coverage notes

- `silkskyair-common`, `silkskyair-config`, `silkskyair-utils`, `silkskyair-supabase`, and `silkskyair-operator` currently contain **no code** (empty/unborn repositories) — no dependencies to document. The Supabase project actually lives in `silkskyair-api`.
- `silkskyair-orchestrator` is the local coordination workspace (E2E harness, env distribution, workflow dependency matrix) — it consumes the services above but hosts nothing itself.
