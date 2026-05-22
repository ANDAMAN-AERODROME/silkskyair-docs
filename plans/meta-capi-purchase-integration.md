# Meta Conversions API (CAPI) Integration for Booking Purchases

## Context

SilkSkyAir runs Facebook/Meta ad campaigns that drive paid traffic to the public site (`silkskyair-www`). When a visitor books and pays for a flight tour, that conversion currently has **no signal back to Meta** — neither browser-side Pixel nor server-side CAPI is wired up. Pixel ID `892779126509174` exists but is dormant. As a result, Meta's ad optimizer has no Purchase signal to optimize against, lookalike audiences can't be built from converters, and ad spend attribution is blind.

The goal is a dual-track Meta integration:

- **Browser Pixel** firing `Purchase` on the confirmation page (consent-gated via the existing `CookieConsent.tsx` banner).
- **Server-side Conversions API** firing the matching `Purchase` event whenever the DB transitions a booking to `BookingConfirmed`, sourced from authoritative data (`payment_intents.amount`, `api.bookings` contact + tour). Both sides share `event_id = booking.reference_code` so Meta dedupes them.

The dual-track approach is critical because Thai customers often initiate booking on desktop and pay via PromptPay on mobile — the desktop browser never sees the Purchase, so Pixel-only would lose the conversion. CAPI fixes that.

Two earlier-session artifacts exist on disk and will be **revised in place** rather than redone:
- `silkskyair-workflows/workflows/marketing/meta-capi-purchase.json` (10 nodes, placeholder IDs)
- The `call-meta-capi-purchase` fan-out node on the BC branch in `silkskyair-workflows/workflows/bookings/bookings-event.json`

A Plan-agent review surfaced three material design changes from that earlier version:
1. Store `fbclid`/`fbp`/`fbc` in **`analytics.client_interactions.metadata`**, not `bookings.metadata` — the table is already populated by `submit.ts` and already lateral-joined by `api.bookings`.
2. Add **retry + `analytics.events_sent`** for retry-on-Meta-outage + observability + >48h idempotency.
3. Fix `fbc` timestamp to use **booking `created_at`**, not event-send time; prefer **`landing_url`** over `referrer_url` for `event_source_url`.

User has confirmed: site has the consent banner, revise existing files in-place.

---

## TODO snapshot

15 tasks tracked in the session's TODO list with explicit blockedBy dependencies. Pending order roughly corresponds to the dependency chain rather than authoring order.

| # | Task | Blocked by | Project |
|---|---|---|---|
| 1 | Capture fbclid/_fbp/_fbc on silkskyair-www landing (consent-gated) | — | www |
| 2 | Install browser Meta Pixel + fire Purchase clientside (consent-gated) | — | www |
| 3 | Extend BookingStore + SubmitBookingPayload types | #1 | www |
| 4 | Thread fbclid/fbp/fbc + landing_url + marketing_consent into client_interactions | #3 | www |
| 5 | Create n8n credential `AAC \| SAA \| Auth \| Meta CAPI` | — | n8n (manual) |
| 6 | Revise `meta-capi-purchase.json` workflow per new design | — | workflows |
| 7 | Import workflow into n8n, capture real ID, update files | #5, #6, #14 | workflows |
| 8 | Confirm/revise `call-meta-capi-purchase` node on BC branch | #6 | workflows |
| 9 | Register workflow + cred IDs across CLAUDE.md, .env, sync scripts | #7, #8 | workflows |
| 10 | Verify end-to-end with Meta Events Manager Test Events | #7, #8, #13, #14 | verify |
| 11 | Deploy to staging via `pnpm sync:staging` | #4, #9, #10, #13, #14 | ship |
| 12 | Deploy to production + monitor first events | #11 | ship |
| 13 | Extend `api.bookings` view to surface fbclid/fbp/fbc/landing_url/marketing_consent | — | api (migration) |
| 14 | Add `analytics.events_sent` table + insert from workflow | — | api (migration) |
| 15 | Document Meta token rotation in `silkskyair-workflows/CLAUDE.md` | — | docs |

**Unblocked at start (6)**: #1, #2, #5, #6, #13, #14, #15. Of those, #5 is manual (n8n UI, requires Meta access token); the rest are codeable in parallel.

**Recommended execution batches**:
1. DB foundations (#13, #14) — small, isolated, give #6 concrete columns to read.
2. Workflow revision (#6) + n8n credential (#5, you) → import & ID-swap (#7) → BC wiring confirm (#8) → registration (#9).
3. Frontend chain (#1 → #3 → #4) + Pixel snippet (#2).
4. Verify (#10) → staging (#11) → prod (#12). Docs (#15) lands any time before #12.

---

## Booking lifecycle (existing, not changing)

```
www visitor lands ──► booking-floating-widget reads URL/cookies ──► submit.ts POST
                                                                         │
                                                            ┌────────────┴────────────┐
                                                            │ api.booking_register    │
                                                            │ (Supabase RPC) inserts: │
                                                            │  • bookings row         │
                                                            │  • client_interactions  │
                                                            │    (IP/UA/referrer)     │
                                                            └────────────┬────────────┘
                                                                         │
                                              ──── customer pays via Omise ────
                                                                         │
                                       n8n omise.json receives charge.complete
                                                                         │
                                  RPC update_payment_intent_by_charge_id(..., 'successful')
                                                                         │
                              DB trigger inserts BookingConfirmed into booking_events
                                                                         │
                              DB trigger calls n8n webhook /booking-events/create
                                                                         │
                              bookings-event.json Switch → BC branch (index 2)
                                  ├─► fetch-booking-customer-notes → manager email
                                  ├─► prepare-member-email-data → member email
                                  └─► [NEW] call-meta-capi-purchase ◄──── this plan
```

The new branch is fire-and-forget (`waitForSubWorkflow: false`) — Meta latency must never block the webhook-200 the DB trigger depends on, or the customer/manager emails.

---

## Implementation steps (in dependency order)

### A. Frontend capture — `silkskyair-www`

**Step 1 — Capture fbclid/_fbp/_fbc on landing, gated on consent**
- File: `src/components/bookings/booking-floating-widget.ts` (~line 556 where `URLSearchParams` is already read for `partner`/`tour`)
- Logic: when consent is granted (`hasConsent()` from `src/lib/analytics/consent.ts`), read `fbclid` from URL, `_fbp`/`_fbc` from `document.cookie`. Synthesize `fbc = fb.1.<landing_unix_ms>.<fbclid>` using the *landing* timestamp (record once, on first capture).
- Also capture `landing_url` = `window.location.href` on first widget init.
- If user has not yet consented, register `onConsentGranted(captureFn)` so values persist as soon as they accept.
- Persist via existing `BookingStore` (localStorage `aac.booking.db.v1`).

**Step 2 — Install Meta Pixel, consent-gated, dedup-aware**
- New: `src/components/analytics/MetaPixel.astro` — fbq snippet for pixel `892779126509174`. Defer `fbq('init', ...)` and `fbq('track', 'PageView')` until `onConsentGranted()` fires. Mirror the pattern in `GoogleConsentMode.astro` / `StatCounter.astro`.
- Include in `src/layouts/BaseLayout.astro`.
- Confirmation page: `fbq('track', 'Purchase', {value, currency, content_ids:[tour_slug], content_type:'product', num_items, content_name}, {eventID: reference_code})`. Note the `eventID` (camelCase, **not** `event_id`) — typo-fragile, easy to lose dedup.

**Step 3 — Extend types**
- `src/lib/data/Bookings.ts` — add optional `fbclid?`, `fbp?`, `fbc?`, `landing_url?` to `BookingStore` schema.
- `src/components/bookings/api/bookings.ts` — add same fields to `SubmitBookingPayload`.

**Step 4 — Thread through `submit.ts`**
- `src/pages/api/bookings/submit.ts` (~lines 137–158) already inserts into `analytics.client_interactions` with IP/UA/referrer on every BookingSubmitted. Extend that insert's `metadata` jsonb with `{fbclid, fbp, fbc, landing_url, marketing_consent: hasConsent()}`.
- **Do not** put fbclid/fbp/fbc into `bookings.metadata` — `client_interactions` is the right home (per-interaction data) and already gets lateral-joined by `api.bookings`.

### B. Database — `silkskyair-api`

**Step 13 — Extend `api.bookings` view**
- New migration: `silkskyair-api/supabase/migrations/<ts>_api_bookings_view_meta_capi_fields.sql`
- Follow the `CREATE OR REPLACE VIEW api.bookings WITH (security_invoker = true) AS ...` pattern from `20260330110000_enrich_api_bookings_view.sql`. Extend the existing lateral join `ci_data` (it already returns `referrer/client_ip/created_at/user_agent`) to also extract `metadata->>'fbclid' AS fbclid`, `metadata->>'fbp' AS fbp`, `metadata->>'fbc' AS fbc`, `metadata->>'landing_url' AS landing_url`, `(metadata->>'marketing_consent')::boolean AS marketing_consent`.
- View-only change; zero data migration.

**Step 14 — `analytics.events_sent` table**
- New migration: `silkskyair-api/supabase/migrations/<ts>_analytics_events_sent.sql`
- Schema: `id uuid PK`, `booking_id uuid FK`, `event_name text` (e.g. `'Purchase'`), `event_id text`, `provider text` (`'meta'`), `attempts int DEFAULT 0`, `last_attempt_at timestamptz`, `sent_at timestamptz` (NULL = not yet sent), `provider_response jsonb`, `last_error text`.
- Unique constraint on `(booking_id, event_name, provider)` — enforces idempotency at the DB layer.
- Grant SELECT/INSERT/UPDATE to `service_role` (n8n's Supabase credential).

### C. n8n callable workflow — `silkskyair-workflows`

**Step 5 — Create credential `AAC | SAA | Auth | Meta CAPI`**
- httpHeaderAuth type, header `Authorization`, value `Bearer <Meta CAPI System User token>`.
- Create in local, staging, production n8n instances. Note each credential ID.

**Step 6 — Revise `meta-capi-purchase.json` in-place**
- File: `silkskyair-workflows/workflows/marketing/meta-capi-purchase.json` (already exists with 10 nodes — revise, don't rewrite).
- Changes from current version:
  - `build-capi-payload` reads `booking.fbclid` / `booking.fbc` / `booking.fbp` / `booking.landing_url` / `booking.marketing_consent` directly (now exposed by extended view, Step 13).
  - `fbc` synthesis: when only `fbclid` is present, use `fb.1.${new Date(booking.created_at).getTime()}.${fbclid}` (booking-creation time, not event-send time).
  - `event_source_url`: prefer `booking.landing_url` over `booking.referrer_url`; fall back to `https://silkskyair.com/`.
  - `should_send` adds requirement `booking.marketing_consent === true`. Skip with reason `'no_marketing_consent'` otherwise.
  - Add `assert(value >= 1, 'suspicious amount')` warn-log to catch unit-mismatch (Omise normally returns satang/cents, but a future API change could break this).
- New nodes:
  - `check-already-sent` (HTTP GET `analytics.events_sent?booking_id=eq.X&event_name=eq.Purchase&provider=eq.meta&select=id,sent_at`) right after `fetch-booking`/`fetch-payment`. If `sent_at IS NOT NULL`, set `should_send = false`, `skip_reason = 'already_sent'`.
  - `record-sent` (HTTP POST/PATCH on `analytics.events_sent`, upsert) — inserts the row on first attempt with `sent_at = null` + `attempts = 1`; after a 200 from Meta, updates `sent_at = now()`, `provider_response = response body`. Connect after `post-to-meta` (200 branch). Also wire the error branch to upsert with `last_error` set so failed attempts are observable.
- Modify `post-to-meta` HTTP node: add `retryOnFail: true` with 3 attempts and 2s backoff. (n8n handles 5xx + network errors natively.)

**Step 7 — Import to n8n, capture real workflow ID, update files**
- Import `meta-capi-purchase.json` into local n8n via API or UI; capture the assigned ID.
- Replace placeholder `MtaCapiPurch01ab` in:
  - The JSON's own `id` field
  - The `call-meta-capi-purchase` node's `workflowId.value` in `bookings/bookings-event.json`
- Replace `META_CAPI_CRED_ID` placeholder with the real credential ID from Step 5.

### D. Wire into `bookings-event.json`

**Step 8 — Revise existing `call-meta-capi-purchase` node**
- File: `silkskyair-workflows/workflows/bookings/bookings-event.json` (node already exists from earlier session — verify it matches the spec; revise if needed).
- Confirm: `executeWorkflow` type, `waitForSubWorkflow: false`, inputs `booking_id` + `event_id` from `event-data` node, wired as third fan-out off Switch BC output (index 2) alongside `fetch-booking-customer-notes` and `prepare-member-email-data`.

### E. Deployment plumbing

**Step 9 — Register IDs across CLAUDE.md / .env / sync scripts**
- Add a new **Marketing** section in the Workflow IDs table in `silkskyair-workflows/CLAUDE.md` with one row: `Meta CAPI Purchase | <local id> | workflows/marketing/meta-capi-purchase.json`.
- Add to `.env`, `.env.staging`, `.env.production`:
  - `N8N_WF_META_CAPI_PURCHASE=<env-specific id>`
  - `N8N_CRED_META_CAPI=<env-specific id>`
- Add `'metaCapiPurchase'` (key) to `workflowKeys` array in `scripts/sync-to-staging.js` and `scripts/sync-to-production.js`, and `'metaCapi'` to `CREDENTIAL_KEYS` — so the deployer swaps both IDs per env.

**Step 15 — Document token rotation in CLAUDE.md**
- Add a "Meta CAPI Token Rotation" section to `silkskyair-workflows/CLAUDE.md` describing where the System User token is generated in Meta Business Manager, the recommended ~50-day rotation cadence (Meta may invalidate at 60d), and the manual update steps for each environment's credential.

### F. Verify + ship

**Step 10 — Verify via Meta Events Manager Test Events**
- Generate a `test_event_code` in Meta Events Manager → Data Sources → Pixel 892779126509174 → Test events tab.
- In local n8n: "Execute Workflow" on `meta-capi-purchase` with inputs `{booking_id: <recent confirmed booking>, test_event_code: <code>}`. Confirm the event appears in Events Manager test stream with Purchase + correct value/currency + Event Match Quality > 5.
- End-to-end: book on local www with `?fbclid=test123`, accept consent, complete with Omise test card, confirm fbclid landed in `client_interactions.metadata`, BookingConfirmed fired, CAPI workflow executed (n8n executions), Meta received the event.

**Step 11 — Deploy to staging**
- `cd silkskyair-workflows && pnpm sync:staging` (deploys both workflows with ID-swap).
- Verify in staging n8n: `meta-capi-purchase` present, credential bound, `call-meta-capi-purchase` node references staging workflow ID.
- Deploy `silkskyair-www` to staging Vercel.
- Run staging migrations (Steps 13, 14) via `psql` against the staging pooler per `silkskyair-api/CLAUDE.md`.
- Test booking end-to-end on `staging.silkskyair.com` with `?fbclid=stagingtest`.

**Step 12 — Deploy to production**
- Run prod migrations (13, 14) — apply on prod via direct `psql` per existing protocol.
- `pnpm sync:production` for workflows.
- Deploy www to prod Vercel.
- Watch Meta Events Manager for the first real Purchase events. Target Event Match Quality > 5 (without live fbp/fbc) trending to > 7 as cookies flow. Confirm browser+server dedup (no double-counting in Events Manager → Diagnostics).

---

## Critical files reference

| File | Change |
|---|---|
| `silkskyair-www/src/components/bookings/booking-floating-widget.ts` | Add consent-gated fbclid/fbp/fbc/landing_url capture |
| `silkskyair-www/src/components/analytics/MetaPixel.astro` | **NEW** — Pixel snippet with consent gate |
| `silkskyair-www/src/layouts/BaseLayout.astro` | Include `<MetaPixel />` |
| `silkskyair-www/src/lib/data/Bookings.ts` | Extend BookingStore schema |
| `silkskyair-www/src/components/bookings/api/bookings.ts` | Extend SubmitBookingPayload |
| `silkskyair-www/src/pages/api/bookings/submit.ts` | Extend existing client_interactions insert metadata |
| `silkskyair-www/src/pages/bookings/[ref]/confirmed.astro` (or equivalent) | Browser fbq Purchase with `eventID: reference_code` |
| `silkskyair-api/supabase/migrations/<ts>_api_bookings_view_meta_capi_fields.sql` | **NEW** — surface fbclid/fbp/fbc/landing_url/marketing_consent on view |
| `silkskyair-api/supabase/migrations/<ts>_analytics_events_sent.sql` | **NEW** — events_sent table |
| `silkskyair-workflows/workflows/marketing/meta-capi-purchase.json` | Revise per Plan-agent feedback |
| `silkskyair-workflows/workflows/bookings/bookings-event.json` | Confirm/revise call-meta-capi-purchase wiring |
| `silkskyair-workflows/CLAUDE.md` | Add Marketing workflow ID row + token rotation section |
| `silkskyair-workflows/.env` + `.env.staging` + `.env.production` | Add `N8N_WF_META_CAPI_PURCHASE` and `N8N_CRED_META_CAPI` |
| `silkskyair-workflows/scripts/sync-to-staging.js` + `sync-to-production.js` | Add to `workflowKeys` + `CREDENTIAL_KEYS` |

## Reused infrastructure (do not re-invent)

| Existing utility | Path | Used for |
|---|---|---|
| `hasConsent()`, `onConsentGranted()` | `silkskyair-www/src/lib/analytics/consent.ts` | Gating Pixel init + fbclid capture |
| Cookie consent banner | `silkskyair-www/src/components/common/CookieConsent.tsx` | Marketing consent UI (already shipped) |
| `BookingStore` | `silkskyair-www/src/lib/data/Bookings.ts` | localStorage persistence across the booking funnel |
| Consent-gated analytics pattern | `silkskyair-www/src/components/analytics/GoogleConsentMode.astro`, `StatCounter.astro` | Template for MetaPixel.astro |
| `analytics.client_interactions` table + insert in submit.ts | `silkskyair-www/src/pages/api/bookings/submit.ts` ~L137–158 | Add fb fields to existing metadata jsonb |
| `api.bookings` view + lateral join `ci_data` | `silkskyair-api/supabase/migrations/20260330110000_enrich_api_bookings_view.sql` | Surface new fields without changing fetch logic |
| `_shared/config-fetch.json` | `silkskyair-workflows/workflows/_shared/config-fetch.json` | Workflow reads `supabase_url` |
| `httpHeaderAuth` pattern | `silkskyair-workflows/workflows/skystories/_strapi-write-story-locale.json` | Template for Meta CAPI HTTP node auth |
| `Accept-Profile: api` HTTP header pattern | `bookings-event.json` `fetch-booking-customer-notes` node | Calling api-schema views via PostgREST |
| Sync script ID swapping | `silkskyair-workflows/scripts/sync-to-{staging,production}.js` | Multi-env workflow/credential ID replacement |

---

## Verification

End-to-end on each environment:

1. **Workflow unit test (n8n UI)**: With the Meta `test_event_code` set in inputs, "Execute Workflow" on `meta-capi-purchase` against a recent confirmed booking ID. Expected: workflow finishes green; `respond-sent` node returns `meta_status_code: 200`; event appears in Meta Events Manager → Test Events within seconds; Event Match Quality ≥ 5.

2. **End-to-end booking** (local → staging → prod):
   - Open `localhost:4321` (or env equivalent) with `?fbclid=e2e-<env>-<timestamp>`.
   - Accept consent banner.
   - Complete a booking using Omise test card `4242424242424242`.
   - Pay through to confirmation.
   - DB check: `SELECT metadata FROM analytics.client_interactions WHERE entity_id = '<booking_id>'` → should show `{fbclid, fbp, fbc, landing_url, marketing_consent: true}`.
   - n8n executions list: `bookings-event` should show the BC run with three parallel fan-outs; `meta-capi-purchase` should appear as a separate triggered execution with green status.
   - DB check: `SELECT * FROM analytics.events_sent WHERE booking_id = '<booking_id>'` → one row with `provider='meta'`, `event_name='Purchase'`, `sent_at` populated.
   - Meta Events Manager (Test Events or real, depending on env): Purchase event for that `event_id = reference_code` with value/currency matching `payment_intents.amount/100` and `payment_intents.currency`.

3. **Idempotency check**: Re-run the same booking-events webhook (manually `curl` the n8n webhook with the same payload). Expected: `meta-capi-purchase` skips with `skip_reason: 'already_sent'`; no new row in `events_sent`; no duplicate event in Meta.

4. **Browser/server dedup**: In Meta Events Manager → Diagnostics, the booking's `event_id` should show "Deduplicated" status (server + browser merged into one event).

5. **Consent gating**: In incognito, decline consent (close the banner without accepting), complete a booking. Expected: `client_interactions.metadata.marketing_consent: false`; `meta-capi-purchase` skips with `skip_reason: 'no_marketing_consent'`; no Pixel event in browser network tab.

6. **Meta outage simulation** (staging only): point the `AAC | SAA | Auth | Meta CAPI` credential token to an invalid value temporarily; fire a confirmed booking. Expected: `post-to-meta` retries 3× per `retryOnFail`, all fail; `events_sent` row has `last_error` populated and `sent_at` NULL; main BC branch still completes emails and `respond-webhook` returns 200 (because of `waitForSubWorkflow: false`).
