---
title: "Net Payment Amount & PromptPay Parity (Partner Portal)"
---

# Net Payment Amount & PromptPay Parity (Partner Portal)

> **App:** Partner Portal
> **Who uses it:** Partner staff collecting payment on a booking via the **Net Payment** option, and customers scanning the PromptPay QR.
> **What it does:** The **TOTAL AMOUNT** card and the **PromptPay amount** line are now shown in *both* payment modes. Previously they rendered only for **Full Payment** (Direct); the **Net Payment** (Indirect) dialog was missing the figure entirely, and the PromptPay amount didn't appear when a partner collected the net amount. Both surfaces now have full parity across Full and Net.

## Before you start

- **Local URL:** `http://localhost:3050` (staging / production: the same paths on `staging.partner.silkskyair.com` / `partner.silkskyair.com`).
- **Account:** Sign in with a Partner Portal account whose organization has a non-zero **Commission %** (so the Net Payment option is offered) — e.g. `peter@andaman.co.th` for Advance Aviation on local.
- **Prerequisites:** an unpaid booking assigned to your partner org with at least one priced item.
- **Related:** the underlying card-payment flow and the Omise bounce are documented in [Pay with Card](pay-with-card.md). This page is specifically about the figures being visible on the **Net Payment** side.

## Step-by-step

### Step 1 — Choose Net Payment

On an unpaid booking, click **Net Payment (after deducting commission)**. The payment drawer opens.

![Step 1 — Net Payment selected](/screenshots/partners/indirect-payment-parity/01-net-payment-button.png)

**What you should see:** the drawer header reads **Net Payment** and the two method pills (**Credit Card** / **PromptPay QR**) are shown — the same controls Full Payment offers.

### Step 2 — TOTAL AMOUNT is shown on Net Payment

Look at the top of the Net Payment drawer.

![Step 2 — TOTAL AMOUNT card on Net Payment](/screenshots/partners/indirect-payment-parity/02-total-amount-card.png)

**What you should see:** the **TOTAL AMOUNT** card displaying the figure in THB — present here just as it is on Full Payment. Before W23 this card was hidden whenever Net Payment was selected.

### Step 3 — PromptPay amount is shown on Net Payment

Switch the method pill to **PromptPay QR**.

![Step 3 — PromptPay amount on Net Payment](/screenshots/partners/indirect-payment-parity/03-promptpay-net.png)

**What you should see:** the PromptPay QR with the amount line beneath it, so a customer scanning the code sees exactly what they're paying — regardless of whether the partner or the operator is collecting.

## Tips & common questions

- **Wasn't the amount hidden on purpose?** The original code hid net amounts "for customer privacy." That rationale was dropped in W23 (F1.14 / R19): the **Full Payment** / **Net Payment** headings already make the mode explicit, so showing the figure underneath discloses nothing the partner shouldn't already see — and a customer scanning a PromptPay QR genuinely needs the amount.
- **Does the figure differ between Full and Net?** The **TOTAL AMOUNT** is the booking total in both modes — it's the amount being charged through Omise / PromptPay. How that total splits into commission vs. net-to-operator is shown separately in the [Commission & Payment Breakdown](commission-breakdown.md).
- **Net Payment isn't offered on this booking.** It only appears when commission applies (Commission % > 0).
- **The Pay button is greyed out for several seconds.** That's the Omise script still loading. If it stays disabled past ~5 seconds, an amber banner explains the script failed to load — refresh and retry. (See [Pay with Card](pay-with-card.md).)

## Reference

- **Code:** [silkskyair-partner/components/bookings/payment-checkout.tsx](https://github.com/) — the **TOTAL AMOUNT** card (`data-payment-total`) and the PromptPay amount line (`data-promptpay-amount`) are no longer wrapped in `paymentCollectedBy === "direct"`; both render in Full and Net modes.
- **Shipped:** W23 — partner commit `2c1c812` (F1.14 / R19).
