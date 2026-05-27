---
title: "2. WebSite — Bookings: Payment-Before-Confirmation"
app: WebSite
who: "Support agents handling booking issues, anyone explaining the customer flow"
what: "The booking flow now takes payment up-front, before the booking is confirmed. The customer pays with a card, completes 3-D Secure if their bank requires it, and lands on a confirmed step that shows the booking reference."
slug: bookings-payment-flow
ssa: SSA-621
---

# 2. WebSite — Bookings: Payment-Before-Confirmation

> **App:** WebSite
> **Who uses it:** Support agents handling booking issues; anyone who needs to understand or demo the customer booking flow.
> **What it does:** The booking flow now takes payment up-front, before the booking is confirmed. The customer pays with a card, completes 3-D Secure if their bank requires it, and lands on a confirmed step that shows the booking reference.

## Before you start

- **Staging URL:** `https://staging.www.silkskyair.com`
- **Account:** Not required — guest checkout works.
- **Test card:** `4242 4242 4242 4242` (Omise's published Visa test card — successful charge). Any future expiry, any 3-digit CVV. Documented in `silkskyair-www/tests/e2e/booking-flow-helpers.ts` as `TEST_CARD_4242`. **Never enter a real card on staging.**
- **Prerequisites:** at least one bookable tour with available dates on staging.

## Step-by-step

### Step 1 — Open a tour detail page

Pick any bookable tour from the Tours menu and click into it.

![Step 1 — Tour detail](./screenshots/bookings-payment-flow/01-tour-detail.png)

**What you should see:** Tour hero image, description, price summary, and a prominent **Book Now** button.

### Step 2 — Start booking, pick a date

Click **Book Now**. The booking widget opens with the date grid.

![Step 2 — Date picker](./screenshots/bookings-payment-flow/02-date-picker.png)

**What you should see:** A date grid (`[data-date-grid]`) with available dates clickable. Pick any available date.

### Step 3 — Choose passengers

Adjust the passenger stepper.

![Step 3 — Passenger stepper](./screenshots/bookings-payment-flow/03-pax-stepper.png)

**What you should see:** Plus/minus controls for each passenger type (adult, child, infant where applicable). Numbers update live.

### Step 4 — Review summary

The widget advances to the summary step showing tour + date + pax + total.

![Step 4 — Review summary](./screenshots/bookings-payment-flow/04-review-summary.png)

**What you should see:** A summary card with everything the customer is about to book.

### Step 5 — Enter card details (Omise hosted form)

After **Confirm and create booking**, the Omise hosted card form opens.

![Step 5 — Card entry](./screenshots/bookings-payment-flow/05-card-entry.png)

**What you should see:** Omise's hosted card form in an iframe (`#omise-checkout-iframe-app`). Enter the test card.

### Step 6 — 3-D Secure challenge

Omise presents a 3-D Secure challenge.

![Step 6 — 3DS challenge](./screenshots/bookings-payment-flow/06-3ds-challenge.png)

**What you should see:** Omise's test 3-D Secure page. For the test card, simply click **Authorize**.

### Step 7 — Confirmed step

After 3DS, the widget switches to the confirmed step.

![Step 7 — Confirmed](./screenshots/bookings-payment-flow/07-confirmed.png)

**What you should see:** A success card with the booking **reference code** prominently displayed and a confirmation message: "Payment received. You're booked." The widget includes a **Book another** button.

### Step 8 — Public booking-details page

Open the public booking-details page by visiting `/bookings/<reference>` on the same host.

![Step 8 — Public booking-details](./screenshots/bookings-payment-flow/08-public-booking-details.png)

**What you should see:** A standalone page showing the booking summary. This is the same page reachable via the confirmation email link.

## Tips & common questions

- **What happens if the card is declined?** The widget surfaces the Omise rejection reason inline. Booking is not created. The customer can try a different card without losing the rest of their selections.
- **Can the customer refresh mid-flow?** Yes — the widget persists progress to localStorage and restores it on refresh, up to (but not including) the payment step.
- **What if 3-D Secure times out?** Same as a decline: inline error, no booking created.
- **Is the booking-details page private?** No — the URL is unguessable but treated as link-shareable. Don't post it publicly.
