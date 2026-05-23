# Meta Conversions API (CAPI) Purchase Integration

## Context

SilkSkyAir runs Facebook/Meta ad campaigns. When a booking is paid, Meta's ad optimizer needs a server-side Purchase signal so it can optimize ad spend toward converters and build lookalike audiences. Pixel ID `892779126509174` exists but receives nothing today.

The earlier draft of this plan accumulated too much scope (consent re-engineering, browser Pixel install, separate `analytics.client_interactions` storage path, `analytics.events_sent` retry table, view extensions, token-rotation docs). **This rewrite strips it back to the minimum viable shape: 6 logical steps.**

What's deliberately out of scope this round:
- Browser-side Pixel snippet (server-only CAPI for now).
- Consent-banner re-engineering — the banner already exists. If a user has refused cookies, `_fbp`/`_fbc` aren't set by Facebook, so the system degrades naturally to "no attribution → no CAPI".
- `analytics.events_sent` idempotency table — Meta's own `event_id` dedup (48h window) is enough.
- `api.bookings` view extension — the workflow can read `bookings.metadata` directly.

## The 6 steps (verbatim from spec)

1. Capture FB attribution at landing → save in current session's `localStorage`.
2. When booking flow activates, apply FB attribution as metadata.
3. When booking is registered, ensure metadata is passed.
4. Persist metadata on the server.
5. Add a node to the BookingConfirmed n8n workflow that examines whether analytics booking metadata exists; if so, invoke a shared workflow.
6. The shared workflow checks if Meta / FB / Pixel metadata exists and executes the CAPI call. Done.

## Booking lifecycle

```
www visitor lands  ──►  capture {fbclid, fbp, fbc, landing_url} → localStorage 'ssa:analytics:fb'
                                          │
                booking widget activates  →  merge into BookingStore.metadata.analytics
                                          │
                                    submit.ts POST
                                          │
                  api.booking_register(p_metadata) → bookings.metadata.analytics (jsonb)
                                          │
                              customer pays via Omise
                                          │
            DB trigger inserts BookingConfirmed → n8n bookings-event.json BC branch
                                          │
            [NEW] IF booking.metadata.analytics exists → invoke shared workflow
                                          │
                  workflows/marketing/meta-capi-purchase.json
                      ├ fetch booking + latest successful payment
                      ├ check metadata.analytics for Meta keys (fbclid/fbp/fbc)
                      ├ build CAPI Purchase event (hashed em/ph; raw fbc/fbp)
                      └ POST graph.facebook.com/.../events
```

The BC branch already fans out to `fetch-booking-customer-notes` and `prepare-member-email-data`. The new IF + dispatch is a third sibling fan-out. `waitForSubWorkflow: false` — Meta latency must never block the existing email path or the webhook 200.

---

## Implementation

### Step 1 + 2 — Capture at landing and apply to booking flow (silkskyair-www)

**New utility:** `src/lib/analytics/fb-attribution.ts`

```ts
// Pseudo
captureFbAttribution(): void        // reads URL+cookies, writes localStorage 'ssa:analytics:fb' if not already set
readFbAttribution(): FbAttribution? // returns parsed object or null
```

Reads:
- `fbclid` from `URLSearchParams(window.location.search).get('fbclid')`
- `_fbp` from `document.cookie`
- `_fbc` from `document.cookie`
- `landing_url` from `window.location.href`

Synthesizes `fbc` as `fb.1.<unix_ms_at_capture>.<fbclid>` only if `_fbc` cookie is absent but `fbclid` is present. Writes once per session; subsequent calls no-op if entry already exists.

**Caller:** `src/components/bookings/booking-floating-widget.ts` — call `captureFbAttribution()` on first widget mount (mirror the existing `partner`/`tour` URL-param capture around line 556).

When the booking flow activates (modal open / "book now" click), call `readFbAttribution()` and merge the object into `BookingStore.metadata.analytics`.

### Step 3 + 4 — Forward in submit and persist server-side

**`src/lib/data/Bookings.ts`** — extend `BookingStore` so its `metadata` field has an optional `analytics?: { fbclid?, fbp?, fbc?, landing_url?, captured_at? }` shape.

**`src/components/bookings/api/bookings.ts`** — same shape on `SubmitBookingPayload`.

**`src/pages/api/bookings/submit.ts`** — extend the existing `bookingMetadata` object (already carries `partner_slug` / `attribution_source`) with an `analytics` key when the payload supplies it. The Supabase RPC `api.booking_register(..., p_metadata)` already accepts arbitrary jsonb and writes it to `bookings.metadata` — **no migration needed.**

Verification: after a booking submit with `?fbclid=test`, `SELECT metadata FROM bookings WHERE id = '<id>'` should show `{partner_slug?, attribution_source?, analytics: {fbclid: 'test', ...}}`.

### Step 5 — BC branch IF + dispatch (silkskyair-workflows)

**File:** `workflows/bookings/bookings-event.json`

On the Switch node's BC (BookingConfirmed) output (index 2), add a new IF node `if-has-analytics-metadata`:

- Condition: `{{ Object.keys($('fetch-booking').first().json.metadata?.analytics ?? {}).length > 0 }}` (or simpler: `metadata.analytics.fbclid` exists OR `metadata.analytics.fbp` exists).
- TRUE → executeWorkflow node `call-meta-capi-purchase` (existing node in the file from earlier work — keep or revise).
- FALSE → dead-end (no dispatch).

`waitForSubWorkflow: false`. Existing sibling fan-outs (`fetch-booking-customer-notes`, `prepare-member-email-data`) untouched.

### Step 6 — Shared workflow (Meta CAPI)

**File:** `workflows/marketing/meta-capi-purchase.json` — already exists with 10 nodes from earlier. **Significantly simplify** to match the new design.

Final shape (~8 nodes):

1. `workflow-trigger` — inputs: `booking_id`, optional `event_id`, optional `test_event_code`.
2. `get-config` — calls shared config-fetch for `supabase_url`.
3. `fetch-booking` — HTTP GET `bookings_snapshot?id=eq.X&select=*` with `Accept-Profile: api` (booking row has contact, tour, reference_code, metadata).
4. `fetch-payment` — HTTP GET latest `payment_intents` with `status=successful` for value/currency.
5. `check-meta-keys` — IF: `booking.metadata.analytics.fbclid` OR `booking.metadata.analytics.fbp` exists. False → respond-skipped.
6. `build-capi-payload` — SHA-256 lower-cased + trimmed `em`/`ph` (digits only)/`fn`/`ln`/`external_id` (= member_profile_id). Raw `fbc` (synthesized from fbclid if not present), `fbp`. `value` = `payment.amount/100`, `currency` = `payment.currency`. `event_id` = `booking.reference_code`. `event_source_url` = `metadata.analytics.landing_url` || `https://silkskyair.com/`.
7. `post-to-meta` — HTTP POST `https://graph.facebook.com/v20.0/892779126509174/events`, httpHeaderAuth credential `AAC | SAA | Auth | Meta CAPI`. `onError: continueErrorOutput`.
8. `respond-sent` / `respond-skipped` / `respond-error` — terminal Set nodes.

No retry, no events_sent table, no consent gate, no view-extension reads. Meta's `event_id` dedup handles double-fires; absence of analytics metadata short-circuits at the IF nodes.

---

## Critical files

| File | Change |
|---|---|
| `silkskyair-www/src/lib/analytics/fb-attribution.ts` | **NEW** — capture/read helpers |
| `silkskyair-www/src/components/bookings/booking-floating-widget.ts` | Call capture on init; merge into BookingStore.metadata on flow activation |
| `silkskyair-www/src/lib/data/Bookings.ts` | Extend BookingStore.metadata.analytics shape |
| `silkskyair-www/src/components/bookings/api/bookings.ts` | Extend SubmitBookingPayload.metadata.analytics shape |
| `silkskyair-www/src/pages/api/bookings/submit.ts` | Fold analytics into bookingMetadata |
| `silkskyair-workflows/workflows/bookings/bookings-event.json` | Add `if-has-analytics-metadata` IF node + dispatch on BC branch |
| `silkskyair-workflows/workflows/marketing/meta-capi-purchase.json` | Simplify to ~8 nodes per the design above |

**No database migrations.** `bookings.metadata` is already a jsonb column that accepts arbitrary keys.

## Reused infrastructure

| Existing thing | Path | Used for |
|---|---|---|
| URL-param + cookie capture pattern | `booking-floating-widget.ts` ~L556 (existing `partner`/`tour` reads) | Template for fbclid/fbp/fbc reads |
| `BookingStore` localStorage | `src/lib/data/Bookings.ts` (`aac.booking.db.v1`) | Carry metadata.analytics across funnel |
| `bookingMetadata` accumulator | `submit.ts` (already carries partner_slug, attribution_source) | Fold analytics in as another key |
| `api.booking_register(p_metadata)` RPC | Existing | Persists `bookings.metadata` jsonb — no change |
| Switch node BC fan-out pattern | `bookings-event.json` | Add IF + executeWorkflow as third sibling |
| `_shared/config-fetch.json` | `workflows/_shared/config-fetch.json` | `supabase_url` for HTTP calls |
| `Accept-Profile: api` pattern | `bookings-event.json` `fetch-booking-customer-notes` node | Call api-schema views/tables |
| `httpHeaderAuth` pattern | `workflows/skystories/_strapi-write-story-locale.json` | Bearer token for Meta CAPI |

## Manual prerequisite

Create n8n credential `AAC | SAA | Auth | Meta CAPI` (httpHeaderAuth, header `Authorization`, value `Bearer <Meta System User token>`) in local, staging, and production n8n instances.

---

## Verification

1. **Manual workflow test:** in Meta Events Manager → generate `test_event_code`. In local n8n, "Execute Workflow" on `meta-capi-purchase` with `{booking_id: <recent confirmed>, test_event_code: <code>}`. Expect 200, Purchase event in Meta Test Events stream, Event Match Quality ≥ 5.
2. **End-to-end (with attribution):** open localhost www with `?fbclid=test-w22`, book + pay via Omise test card. Verify `bookings.metadata.analytics.fbclid = 'test-w22'`; verify n8n `bookings-event` BC run shows IF branch TRUE and `meta-capi-purchase` executed green; verify event in Meta Events Manager with `event_id` = reference_code.
3. **End-to-end (no attribution):** book directly without `?fbclid`. Verify IF branch FALSE, no CAPI call, no n8n execution of the dispatcher.
4. **Idempotency:** re-fire the booking-events webhook with the same payload. Meta dedupes on `(event_name, event_id)` within 48h — no double conversion in Events Manager.
5. **Ship:** `pnpm sync:staging` for workflows + deploy www to staging Vercel; verify on `staging.silkskyair.com`; then `pnpm sync:production` + prod Vercel.

## Notion tasks

The 6 tasks carry all implementation detail in their bodies; no separate sub-task pages. Each tagged `Week: W22`.

1. **WWW | Analytics | Capture FB attribution at landing + apply when booking flow activates** (covers steps 1-2)
2. **WWW | Bookings | Forward analytics metadata through booking submit → bookings.metadata** (covers steps 3-4)
3. **Workflows | Bookings | Add IF + dispatch node on BookingConfirmed branch** (covers step 5)
4. **Workflows | Analytics | Simplify shared Meta CAPI workflow** (covers step 6)
5. **Workflows | Analytics | Create Meta CAPI credential + verify via Test Events** (manual prereq + verify)
6. **Workflows | Analytics | Deploy to staging + production** (ship)
