---
title: "Available Tours Dashboard Widget (Partner Portal)"
---

# Available Tours Dashboard Widget (Partner Portal)

> **App:** Partner Portal
> **Who uses it:** Partner agents who land on the dashboard and want to start a new booking, share a tour link with a customer, or open the marketing page to read the tour details themselves.
> **What it does:** Surfaces every active SilkSky Air tour as a scrollable list on the dashboard, with three hover-revealed CTAs per row: **Book Tour**, **Copy Link**, **Open Tour**.

## What partners see

On `/home`, the right-hand column of the dashboard grid now hosts the **Available Tours** widget (it replaced the AgreementWidget slot pre-launch — see "Why this slot" below). The list scrolls vertically inside a fixed-height card. Each row contains:

- A **hero image** (or a gradient placeholder when the tour has no `tour_media` row yet).
- The tour's **localized title** (falls back to the `tours.label` column, then the slug).
- A **duration** chip — e.g. `30 minutes` — when `tours.duration` is set.
- A **price line** — `from {price} {currency} / per person` — when the tour has a `tour_pricing` row.

Hover (desktop) or tap (mobile) reveals the action overlay with three CTAs:

| CTA | What it does |
|---|---|
| **Book Tour** | Opens the Create Booking wizard with this tour pre-selected on step 1. URL becomes `/bookings?create=true&tour=<slug>&step=0`; the wizard's `useQueryState("tour")` picks the slug up and the new tour-hydration effect resolves the full TourSummary from `/api/tours` so step 4 (review) gets the data it needs. |
| **Copy Link** | Writes `${NEXT_PUBLIC_WWW_URL}/tour/<slug>` to the clipboard. A 1.5-second "Link copied" chip swaps in for the CTA label as confirmation. Partners use this to paste tour pages into customer chats / emails. |
| **Open Tour** | Opens the same `${NEXT_PUBLIC_WWW_URL}/tour/<slug>` URL in a new browser tab so the partner can read the marketing copy without losing their dashboard context. |

## Why this slot

R5 (Round 3 of the partnership-portal review) gated `ReportingWidget` pre-launch — the commission rate copy was setting expectations before policy was finalised. `AgreementWidget` is the same kind of commission-rate surface, so rather than render an empty 3-column grid, R6 swaps the Agreement column for tour-discovery surface partners actively asked for. The `AgreementWidget` import is left in `app/home/page.tsx` (commented with `R6-AGREEMENT-MOVED-2026-05:`) so the swap can be reverted without rediscovering the file path.

## Where the data comes from

- **List:** `GET /api/tours` (existing endpoint, since the wizard's `TourSelector` consumes it). Returns every row in `tours` with `status='active'`, ordered by `slug`, with the partner's current locale applied through `tours_i18n`.
- **Hero image:** F1.6 extended the same route to join `tour_media` filtered to `role='hero'` and, for each tour with a hit, generate a 1-hour Supabase signed URL. Tours without a row in `tour_media` get `heroUrl: null` and the widget falls back to the gradient placeholder. Signed URLs are 1 h long; the dashboard refetches whenever the partner navigates back to `/home`, so expiry is never visible to users.
- **WWW URL:** `process.env.NEXT_PUBLIC_WWW_URL`, with a fallback to `https://silkskyair.com`. Each environment points at its own marketing site (local dev: `http://localhost:4321`; staging: `https://staging.silkskyair.com` if used; prod: `https://silkskyair.com`).

There is no tour-to-organization junction in the schema. "The partner's purchasable tours" today means "every active tour" — if SilkSky ever wants per-partner curation, the data model + this widget's query both need to change.

## Empty + degraded states

- **No active tours:** the widget renders `i18n("availableTours.empty")` ("No tours available right now."). Doesn't break the dashboard layout.
- **`/api/tours` 401 or network error:** the widget treats the response as `[]` and shows the empty state. The partner can refresh; the dashboard does not auto-retry.
- **Tour with no hero in `tour_media`:** the gradient placeholder + `BookOpen` lucide icon render in the 80×80 slot. Same visual treatment for every tour without art so the widget doesn't look broken.
- **Tour with no `tour_pricing` row:** the price line is omitted; the row still renders with just title + duration. Booking is still possible because the wizard fetches pricing independently from the availability RPC.
- **`navigator.clipboard.writeText` unavailable (insecure origin, old browser):** Copy Link silently no-ops. The Open Tour CTA continues to work as an escape hatch.

## Support staff playbook

> **"The hero images don't show up — is something broken?"**
> Tours without a `tour_media` row of `role='hero'` will always show the gradient placeholder. Ops can upload one through the Strapi tour admin (or directly into the Supabase `tour_media` bucket). After upload the signed URL is generated on the next dashboard reload; no app deploy needed.

> **"Copy Link copied a URL to silkskyair.com but staging/local is different — bug?"**
> No — the widget reads `NEXT_PUBLIC_WWW_URL`. If it's not set in the current environment, the widget falls back to the production URL `https://silkskyair.com`. Set the env var in the deployment's environment variables (and add `NEXT_PUBLIC_WWW_URL=http://localhost:4321` to `silkskyair-partner/.env.local` for local dev) and restart the app.

> **"Book Tour didn't pre-select the tour for me."**
> Confirm the URL after the click — it should be `/bookings?create=true&tour=<slug>&step=0`. If the slug parameter is missing, the click hit the wrong target (the overlay sometimes loses focus mid-hover under some trackpads — re-hover and try again). If the URL is correct but step 0 still shows no selection, the `/api/tours` fetch inside the wizard's hydration effect probably 401'd; check the network tab and partner session.

## Reference

- **Source:**
  - Widget: `silkskyair-partner/components/home/widgets/available-tours-widget.tsx` (component + `useAvailableTours` hook).
  - Dashboard: `silkskyair-partner/app/home/page.tsx` (swap with `AgreementWidget` slot).
  - Wizard pre-fill: `silkskyair-partner/components/bookings/create/create-booking-drawer.tsx` (the F1.6 hydration `useEffect`).
- **API:** `silkskyair-partner/app/api/tours/route.ts` (now joins `tour_media role='hero'` + signs the URL).
- **Type:** `silkskyair-partner/lib/bookings/types.ts:TourSummary` (new optional `heroUrl` field).
- **i18n:** `silkskyair-api/supabase/migrations/20260528140000_partner_available_tours_i18n.sql` (6 keys × en/th/ru).
- **Env:** `NEXT_PUBLIC_WWW_URL` (see `silkskyair-partner/.env.example`).
- **E2E:**
  - `silkskyair-partner/e2e/partner-available-tours-simple.spec.ts` — widget mounts on `/home` with at least one tour row.
  - `silkskyair-partner/e2e/partner-available-tours-full.spec.ts` — hover exposes 3 CTAs; Copy Link writes the expected URL to clipboard + shows the "Link copied" chip; Open Tour spawns a new tab on the same URL; Book Tour navigates to `/bookings?create=true&tour=<slug>`.
