---
title: "28. Meta CAPI — FB Attribution Capture, Dispatch & Recording"
app: "WebSite + BackOffice + Workflows"
who: "Marketing ops verifying FB ad conversions; support agents diagnosing why a booking didn't fire Purchase to Meta; engineers rotating the Meta CAPI bearer."
what: "When a customer lands from a Facebook ad (URL has ?fbclid=…) and completes a booking, the system records the attribution alongside the booking's request context (IP / user agent / referrer) and sends a Purchase event to Meta's Conversions API. Every dispatch outcome — sent, skipped (no FB attribution), or failed (Meta rejected) — is recorded as a booking_event so ops can see exactly what happened per booking."
slug: meta-capi
ssa: F3.1+F3.2+F3.3
---

# 28. Meta CAPI — FB Attribution Capture, Dispatch & Recording

> **Apps:** WebSite (capture), BackOffice / Manager (read the attribution), Workflows / n8n (dispatch + record).
> **Who uses it:** Marketing ops (verify FB conversions), support agents (diagnose unsent/failed dispatches), engineers (rotate the bearer token).
> **What it does:** Captures `fbclid` from the landing URL plus `_fbp` / `_fbc` cookies set by Meta Pixel, persists them on the booking's client_interactions row, and when the booking is confirmed fires a server-side Purchase event to Meta CAPI. Every dispatch outcome is recorded as a `MetaCapi*` booking_event.

## Before you start

- **WebSite staging:** `https://staging.www.silkskyair.com`
- **BackOffice staging:** `https://staging.manager.silkskyair.com`
- **Account:** `peter@andaman.co.th` for the BackOffice half. No account needed for the WebSite half (guest checkout).
- **Test card:** `4242 4242 4242 4242` (Omise's published Visa test card). Any future expiry, any 3-digit CVV.
- **Prerequisites:** none — this walkthrough creates the booking. **Heads-up:** unless a valid Meta CAPI bearer is provisioned on the target n8n, the dispatcher's HTTP call to Meta will fail and the dispatcher records `MetaCapiFailed` instead of `MetaCapiSent`. Both outcomes prove the integration is wired correctly — the difference is whether Meta accepted the event.

---

## Part A — Customer lands from a Facebook ad (WebSite)

### Step 1 — Open the homepage with `?fbclid=...`

Append `?fbclid=test-w23-walkthrough` to the homepage URL (or click an actual ad). The query parameter triggers `session.ts` `initSession()` which writes the attribution to `sessionStorage` under key `ssa:analytics:session`.

![Step 1 — Homepage with fbclid](./screenshots/meta-capi/01-homepage-with-fbclid.png)

**What you should see:** Normal homepage. Open DevTools → Application → Session Storage → `ssa:analytics:session` should contain a JSON object with `fbclid: "test-w23-walkthrough"`, `landing_url` (full URL incl. query), and any `_fbp` / `_fbc` cookies Meta Pixel set.

### Step 2 — Open the booking widget

Click any **Book Now** CTA on the homepage.

![Step 2 — Booking widget open](./screenshots/meta-capi/02-widget-open.png)

**What you should see:** The booking widget opens. The captured FB attribution survives subsequent navigations within the same tab (sessionStorage scope) — it doesn't matter how many pages the customer browses before booking.

### Step 3 — Complete the booking flow

Run through the booking steps as normal (tour → date+slot → contact → submit → OTP → card). Use test card `4242 4242 4242 4242`.

![Step 3 — Payment](./screenshots/meta-capi/03-payment.png)

**What you should see:** Standard booking-payment flow (see manual page 2 for the full walkthrough). At the submit step the widget reads from `sessionStorage` via `getFbAttribution()` and forwards `fbclid` / `fbp` / `fbc` / `landing_url` in the POST body to `/api/bookings/submit`.

### Step 4 — Confirmation

After 3DS (if any) the customer lands on the confirmed step.

![Step 4 — Confirmed](./screenshots/meta-capi/04-confirmed.png)

**What you should see:** Booking reference code displayed. Behind the scenes, `/api/bookings/submit` has written the FB attribution into `analytics.client_interactions.metadata` on the same row that carries `client_ip` / `user_agent` / `referrer`. Note the booking reference for Part B.

---

## Part B — Operations see the attribution (BackOffice)

### Step 5 — Open the booking detail

Sign in to BackOffice → Bookings → open the booking made in Part A.

![Step 5 — Booking detail](./screenshots/meta-capi/05-booking-detail.png)

**What you should see:** The standard booking detail page with all existing sections (booking summary, flight, contact, etc.).

### Step 6 — Find the "Client Interaction" section

Scroll to the Client Interaction section (Globe icon).

![Step 6 — Client Interaction section](./screenshots/meta-capi/06-client-interaction.png)

**What you should see:** The section now renders additional rows below the existing IP / Submitted / User Agent / Referrer:

| Row | Value | When present |
|---|---|---|
| Landing URL | Full URL incl. `?fbclid=…` | Whenever any FB signal was captured |
| Facebook Click ID | The raw `fbclid` value | When `?fbclid` was in the landing URL |
| `_fbc` | Cookie value or synthesized `fb.1.<ts>.<fbclid>` | Always when fbclid present |
| `_fbp` | Cookie value | When Meta Pixel was loaded with consent at landing |

A booking made without any FB signal renders only the original four rows — no FB rows are shown, so the section stays clean for non-attributed bookings.

---

## Part C — Workflow dispatch outcome (Event History)

### Step 7 — Find the Event History section

On the same booking detail page, scroll to **Event History**.

![Step 7 — Event history with MetaCapi event](./screenshots/meta-capi/07-event-history.png)

**What you should see:** After the booking is confirmed, the bookings-event workflow's IF gate (`if-has-analytics-metadata`) sees the FB attribution, invokes the Meta CAPI dispatcher, and records the outcome:

| Event type | Meaning | When emitted |
|---|---|---|
| `MetaCapiSent` | Meta accepted the Purchase event | HTTP 2xx from `graph.facebook.com/.../events` |
| `MetaCapiSkipped` | Dispatcher invoked but bailed internally | Booking has no successful payment, or no identity signals (`em`, `ph`, `external_id`, `fbc`, `fbp`) |
| `MetaCapiFailed` | Meta returned a non-2xx | Bad/expired bearer, malformed payload, Meta API outage |

A booking with **no** FB attribution at all has **none** of these events — the IF gate skips invocation entirely (no FB attribution is a normal case, not a "skipped" event worth recording).

### Step 8 — Inspect a `MetaCapiFailed` row (when present)

If the dispatcher fired but Meta rejected, the event's metadata carries the error message — useful for diagnosing token rotation issues.

![Step 8 — MetaCapiFailed metadata](./screenshots/meta-capi/08-meta-capi-failed-detail.png)

**What you should see:** Expanded event row showing `metadata.error` with the rejection reason returned by Meta.

---

## Tips & common questions

- **Why doesn't the booking I just made show `MetaCapiSent`?** Three common reasons:
  - The booking has no FB attribution (no `?fbclid`, no `_fbp` / `_fbc` cookies set by Meta Pixel) → IF gate dead-ends, no event recorded.
  - The Meta CAPI bearer is missing or expired on the target n8n → expect `MetaCapiFailed` with `error` containing "OAuthException" or 401.
  - The booking has no successful payment yet (e.g., payment is still pending) → dispatcher's internal `if-should-send` bails with `MetaCapiSkipped(skip_reason='no_successful_payment')`.

- **The customer clicked an FB ad days ago and then came back to book — does it count?** No. Attribution lives in **`sessionStorage`** which clears when the customer closes their browser tab. If you want cross-tab persistence, escalate to engineering — the storage tier was a deliberate choice during F3.1 (matches the existing `session.ts` UTM-capture pattern).

- **Where do I rotate the Meta CAPI bearer token?**
  - n8n local: credential `AAC | SAA | Auth | Meta CAPI` (id `gBlJLpOaFbGNrhFu`), referenced in `.env` as `N8N_CRED_META_CAPI`.
  - n8n staging / production: same credential name, ids per `.env.staging` / `.env.production`.
  - Regenerate the Meta System User token in Meta Business Settings → Users → System Users → SilkSky CAPI User.

- **The `MetaCapiSent` event shows `meta_status_code: 200` but I don't see the conversion in Meta Events Manager.** Check Events Manager → Test Events. If the dispatch carried a `test_event_code` (passed via workflow input), Meta routes the event to Test Events only and excludes it from production attribution.

- **A booking has both a `MetaCapiSkipped` AND a `MetaCapiFailed` for the same booking.** That means the dispatcher fired twice (e.g., the BC webhook was redelivered). Meta's own `event_id` dedup (using the booking reference code) prevents double-counting in Meta's stream, but our record-back faithfully logs both attempts.

- **Where in the code does this live?**
  - Capture: `silkskyair-www/src/lib/analytics/session.ts` (extended; reused for UTM)
  - Forwarding: `silkskyair-www/src/components/bookings/booking-floating-widget.ts` (`buildSubmissionPayload`) + `silkskyair-www/src/pages/api/bookings/submit.ts`
  - IF gate: `silkskyair-workflows/workflows/bookings/bookings-event.json` (`if-has-analytics-metadata`)
  - Dispatcher + recording: `silkskyair-workflows/workflows/marketing/meta-capi-purchase.json` (`record-sent` / `record-failed` / `record-skipped`)
  - Manager UI extension: `silkskyair-manager/app/(workspace)/bookings/_components/booking-detail-view.tsx` (Client Interaction section)
  - Event types migration: `silkskyair-api/supabase/migrations/20260527120000_meta_capi_event_types.sql`
