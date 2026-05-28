---
title: "Pay with Card (Partner Portal)"
---

# Pay with Card (Partner Portal)

> **App:** Partner Portal
> **Who uses it:** Partner staff collecting payment on a booking — either the full amount (Direct) or only the commission portion (Net / Indirect).
> **What it does:** Walks through paying for an unpaid booking via the Omise hosted card form. After payment, the same drawer the staff member opened flips to a "Payment Successful" state. The flow handles the unavoidable Omise authorize-page bounce transparently: the customer journey lands back inside the same drawer with payment status confirmed.

## Before you start

- **Local URL:** `http://localhost:3050` (staging / production: the same paths on `staging.partner.silkskyair.com` / `partner.silkskyair.com`).
- **Account:** Sign in with a Partner Portal account associated with the relevant partner organization (e.g. `peter@andaman.co.th` for Advance Aviation on local).
- **Test card (local + staging only):** `4242 4242 4242 4242`, any future expiry (e.g. `12/30`), any 3-digit CVV. Documented in `silkskyair-common/playwright/omise-card-form.ts` as `TEST_CARD_4242`. **Never enter a real card on staging.**
- **3DS card:** `4111 1111 1111 1140` — exercises the 3-D Secure challenge instead of `acs=false` auto-confirm. The post-bounce reopen behavior is identical; the only difference is the customer sees an Omise authorize page mid-flow.
- **Prerequisites:** an unpaid booking in `Pending` or `PendingPayment` status, assigned to your partner organization. The booking needs at least one priced item so the Payment section's amount is non-zero.
- **Environment variable:** `PARTNER_BASE_URL` must be set per deployment (see `.env.example`). The charge route uses it to construct Omise's `return_uri` — wrong value will send the customer back to the wrong deployment after 3-D Secure.

## Step-by-step

### Step 1 — Open an unpaid booking

From the Bookings list, click into a booking with the **Unpaid** badge. The booking detail page renders with the Payment section expanded by default.

![Step 1 — Booking detail, Unpaid](/screenshots/partners/pay-with-card/01-booking-unpaid.png)

**What you should see:** The booking header (reference + Pending status), and a **Payment** section showing both **Full Payment** (always) and **Net Payment (after deducting commission)** (only when commission applies). An **Unpaid** pill is shown on the Payment row.

### Step 2 — Open the Payment drawer

Click **Full Payment** (or **Net Payment**, depending on which side is collecting). A drawer slides in from the right with **Credit Card** pre-selected and the **Pay with Card** button enabled once the Omise script has loaded.

![Step 2 — Payment drawer, Credit Card method](/screenshots/partners/pay-with-card/02-drawer-card-method.png)

**What you should see:** Drawer header **Full Payment** (or **Net Payment**), the **TOTAL AMOUNT** prominently displayed in THB, two method pills (**Credit Card** / **PromptPay QR**) with Credit Card selected, and a primary **Pay with Card** button. If the button is greyed out for more than ~5 seconds, an inline error banner appears explaining that the Omise script failed to load — refresh and retry.

### Step 3 — Enter card details in the Omise form

Click **Pay with Card**. Omise's hosted card form opens in a modal over the page (it's an iframe served from `https://cdn.omise.co/` — card numbers never touch SilkSky Air's servers).

![Step 3 — Omise hosted card form](/screenshots/partners/pay-with-card/03-omise-iframe.png)

**What you should see:** A modal showing "SilkSky Air — Secured by Omise" with inputs for Card number, Name on card, Expiry date, Security code, and Country / region. Enter the test card details and click **Pay with Card 28,800.00 THB** (label reflects the booking amount).

### Step 4 — Payment processing after the Omise bounce

Omise always issues an `authorize_uri` for test charges (with `acs=false` for non-3DS cards, meaning it auto-confirms with no UI challenge). The browser navigates to Omise, Omise settles the charge, and the customer is bounced back to the booking detail page. The drawer **auto-reopens** in the same Direct / Indirect mode and begins polling.

![Step 4 — Processing after Omise round-trip](/screenshots/partners/pay-with-card/04-processing-after-bounce.png)

**What you should see:** Same drawer, same TOTAL AMOUNT, with a spinner and **Processing your payment...**. The URL has gained `?paymentIntent=<uuid>&paymentMode=direct` (or `indirect`) — that's the signal the booking detail page used to auto-reopen the drawer in the right view.

### Step 5 — Payment successful

Within a few poll ticks (typically under 5 seconds in test mode), the intent finalises and the drawer flips to the success state.

![Step 5 — Payment successful](/screenshots/partners/pay-with-card/05-payment-successful.png)

**What you should see:** A green check icon, **Payment Successful**, the message "Your payment has been processed successfully.", and a **Close** button. Clicking **Close** dismisses the drawer and clears the `paymentIntent` / `paymentMode` URL params so refreshing the booking does not reopen the drawer.

## Tips & common questions

- **What if the card is declined?** The drawer flips to a failed state with the Omise rejection reason inline. The booking stays Unpaid; staff can retry with the same or a different card.
- **What if the Omise webhook is delayed?** The polling route has a fallback that asks Omise directly for the charge state (`finaliseFromOmiseIfTerminal`). The flow completes even if the n8n webhook hasn't fired yet. This is what makes the local-dev flow work despite Omise being unable to reach `localhost:3050`.
- **What if the customer closes the browser mid-bounce?** The intent stays in `processing`. The next time anyone loads `/bookings/<id>?paymentIntent=<uuid>&paymentMode=<mode>` the drawer reopens and polling resumes. The Omise webhook (when it does fire) updates the DB independently.
- **What if the partner clicks Pay-direct on a booking that already has a successful intent?** A fresh intent is minted — `start_booking_payment` is idempotent against past terminal intents.
- **Direct vs Net Payment — what does "indirect" mean for the charge?** Indirect = the partner pays only their commission share back to SilkSky Air (the customer paid them the full amount externally). The charge route validates `paymentCollectedBy` and round-trips it through Omise's `return_uri` so the post-bounce reopen restores the correct view.
- **Why is the test card OK on staging?** Staging uses Omise's `pkey_test_*` / `skey_test_*` credentials — these only work with documented test cards and never charge a real account. Production keys (`pkey_*` / `skey_*`) reject the test card numbers.

## Reference

- **Code:** [silkskyair-partner/components/bookings/payment-checkout.tsx](https://github.com/) (PaymentCheckout) · [silkskyair-partner/components/bookings/payment-drawer.tsx](https://github.com/) (PaymentDrawer) · [silkskyair-partner/components/bookings/booking-detail-partner.tsx](https://github.com/) (post-bounce auto-reopen)
- **API routes:** `silkskyair-partner/app/api/bookings/[id]/payments/charge/route.ts` · `silkskyair-partner/app/api/bookings/[id]/payments/[intentId]/status/route.ts`
- **Callback:** `silkskyair-partner/app/bookings/[id]/payment/callback/page.tsx` — receives Omise's bounce and forwards `intentId` + `mode` to the booking detail page.
- **E2E specs:**
  - `silkskyair-partner/e2e/partner-pay-with-card-sdk-failure.spec.ts` (R17/R18 — Omise CDN failure shows inline error banner)
  - `silkskyair-partner/e2e/partner-pay-with-card-direct.spec.ts` (R17/R18 — direct happy path, real Omise bounce)
  - `silkskyair-partner/e2e/partner-pay-with-card-indirect.spec.ts` (R17/R18 — net/commission happy path, real Omise bounce)
