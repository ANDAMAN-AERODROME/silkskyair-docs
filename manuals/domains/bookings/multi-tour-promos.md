---
title: "Multi-Tour Promotions"
---

# Multi-Tour Promotions

> **App:** WebSite
> **Who uses it:** Marketing/campaigns building promotions; support agents helping customers redeem them.
> **What it does:** Promotions can apply to a specific tour, several tours, or all tours. When a promotion is active and the customer's chosen slot is in scope, the booking widget shows promo-adjusted pricing on the slot. When a promotion carries a `min_pax`, the widget clamps the passenger stepper so the customer can't reduce below the minimum.

## Before you start

- **Staging URL:** `https://staging.www.silkskyair.com`
- **Account:** Not required.
- **Prerequisites:** an active promotion exists in BackOffice with `min_pax` set, scoped to the tour the customer is booking.

## Step-by-step

### Step 1 — Pax stepper clamped at `min_pax`

Open the booking widget, pick a tour + date + slot, and set passengers to the promotion's `min_pax`. The decrement button becomes disabled and an inline note explains the floor.

![Step 1 — Pax stepper clamp](/screenshots/bookings/multi-tour-promos/01-pax-stepper-clamp.png)

**What you should see:** The − button on the adult stepper is disabled (greyed out) once you reach `min_pax`. A note below the stepper reads something like *"Current promotion requires at least N passengers."*

### Step 2 — Above `min_pax` — clamp releases, note stays

Increment past `min_pax`. The decrement button re-enables; the note stays visible because the promotion is still applicable.

![Step 2 — Above min_pax](/screenshots/bookings/multi-tour-promos/02-above-min-pax.png)

**What you should see:** The − button is no longer disabled. The note remains.

### Step 3 — Promo-discounted slot pricing

Slots that fall within the promotion's scope show a promo indicator (`[data-slot-promo="1"]`).

![Step 3 — Slot promo indicator](/screenshots/bookings/multi-tour-promos/03-slot-promo-badge.png)

**What you should see:** A visual marker on slots covered by the promotion (often a price badge or pill). Slots outside the promo scope render without it.

## Tips & common questions

- **The decrement won't go below my chosen number.** That's the `min_pax` clamp. Read the inline note to see the minimum the active promotion requires.
- **Why don't I see a promo discount on some dates?** The promotion's publish window may not cover that date, or the tour isn't in scope.
- **Can a customer use a deep-link to apply a promo?** Yes — `/book?promo=<slug>` (the action-verb deep-link) writes the promo to BookingStore and the widget picks it up.
