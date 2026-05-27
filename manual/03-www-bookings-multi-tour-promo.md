---
title: "3. WebSite — Bookings: Multi-Tour Promos & Deep-Links"
app: WebSite
who: "Marketing, campaigns, support agents helping customers redeem promo codes"
what: "Promotions can span multiple tours. A customer arriving via a deep-link or entering a promo code sees the matching tours surfaced progressively, with the passenger stepper automatically respecting the promotion's minimum pax."
slug: bookings-multi-tour-promo
ssa: SSA-633
---

# 3. WebSite — Bookings: Multi-Tour Promos & Deep-Links

> **App:** WebSite
> **Who uses it:** Marketing/campaigns building promo links; support agents helping customers redeem codes.
> **What it does:** Promotions can span multiple tours. A customer arriving via a deep-link or entering a promo code sees the matching tours surfaced progressively, with the passenger stepper automatically respecting the promotion's minimum pax.

## Before you start

- **Staging URL:** `https://staging.www.silkskyair.com`
- **Account:** Not required.
- **Prerequisites:** an active multi-tour promotion exists on staging with `min_pax` set. (If not, the BackOffice promotions module is where it's created — out of scope for this manual.)

## Step-by-step

### Step 1 — Open the deep-link

Open the promotion's action-verb deep-link in the browser (e.g. `https://staging.www.silkskyair.com/book?promo=W22LAUNCH`).

![Step 1 — Deep-link landed](./screenshots/bookings-multi-tour-promo/01-deep-link-landed.png)

**What you should see:** The site opens with the promotion already applied. A banner or pill near the top of the booking widget confirms which promo is active.

### Step 2 — See the multi-tour list

The widget reveals only the tours covered by the promotion.

![Step 2 — Multi-tour list](./screenshots/bookings-multi-tour-promo/02-multi-tour-list.png)

**What you should see:** A list of eligible tours (cards or rows), each with the promo-adjusted price. Tours not part of the promotion are not shown here.

### Step 3 — Progressive disclosure

Click on one tour to expand its details.

![Step 3 — Progressive disclosure](./screenshots/bookings-multi-tour-promo/03-progressive-disclosure.png)

**What you should see:** The selected tour expands to show date selection and passenger pickers. Other tours remain collapsed so the screen stays focused.

### Step 4 — Pax stepper clamps to `min_pax`

Try to decrease the passenger count below the promotion's minimum.

![Step 4 — Pax stepper clamp](./screenshots/bookings-multi-tour-promo/04-pax-stepper-clamp.png)

**What you should see:** The stepper refuses to go below the promotion's `min_pax`. A small inline message explains why.

### Step 5 — Continue to checkout

The rest of the flow is identical to the standard payment-before-confirmation flow.

![Step 5 — Continue to checkout](./screenshots/bookings-multi-tour-promo/05-continue-to-checkout.png)

**What you should see:** The standard payment widget, with the promo-adjusted total reflected in the summary.

## Tips & common questions

- **What if the customer enters the promo code manually instead of arriving via the deep-link?** Same effect — the widget applies it via the `promo_applied` event, not just the initial URL read.
- **Can a customer use the promo without minimum pax?** No — the stepper enforces it.
- **What if the promo's tours sell out?** Sold-out tours still appear in the list but disable the date picker for unavailable dates.
- **Does this work for single-tour promos?** Yes — the list will just show one tour.
