---
title: "Add Passengers — Paid + Due Breakdown (Member Portal)"
---

# Add Passengers — Paid + Due Breakdown (Member Portal)

> **App:** Member Portal
> **Who uses it:** Customers asking to add a companion to an existing booking. Support staff answering "why does the modal say I owe more / less than I expected?"
> **What it does:** When a customer opens the **Add Passengers** modal on a confirmed booking, the pricing breakdown now shows their balance in context — what they've already paid and what's still due — alongside the per-pax cost and new estimated total. Previously the modal showed only the cost-per-pax and new total, leaving customers to do the "but I already paid" subtraction in their head.

## What customers see

On a confirmed booking's detail page, the Passengers section ends with a dashed "Add Passenger" ghost card. Clicking it opens a modal that walks through how many adults / children to add, then shows a five-row pricing breakdown:

| Row | What it means |
|---|---|
| **Cost per passenger** | The seat price for *one* additional pax on this flight, after the joiner / shared-discount / promotion rules apply. |
| **Additional cost** | Cost per passenger × number added. |
| **Paid** | What the customer has already paid against this booking, summed across all successful payment intents. |
| **Due** | The current outstanding balance on the booking *before* this amendment — i.e. `max(0, existingTotal − paid)`. |
| **New estimated total** | `existingTotal + additionalCost`. After concierge accepts the amendment a fresh invoice covering the difference is generated; this row is the customer's preview of where they'll end up. |

The Paid + Due rows are the new bit. Cost-per-pax, Additional, and New estimated total have always been there.

## Why Paid + Due matter

A customer who paid in full for one seat and is now adding a companion sees this:

- **Paid** ฿17,000
- **Due** ฿0
- **New estimated total** ฿26,500

They immediately know: "I've already settled the first seat; the ฿9,500 in `Additional cost` is what I'll need to pay when the amendment is approved." Without the Paid + Due rows, the modal looked like it was asking them to settle ฿26,500 again.

The Due row also surfaces partial-pay scenarios. If a customer paid a deposit (say ฿10,000 on a ฿17,000 booking) and tries to add a companion, the modal shows **Paid ฿10,000**, **Due ฿7,000**, **New estimated total ฿26,500** — communicating that the existing balance is still open and the amendment compounds it.

## Where the numbers come from

The breakdown is computed server-side by `GET /api/bookings/<id>/add-passenger-pricing`. Two data sources:

- **Per-pax pricing** comes from the `availability` schema RPCs (`_get_base_seat_price`, `_find_existing_flight`, `_is_joiner_booking`, `_find_best_promotion`) — same RPCs the public booking flow uses.
- **Paid + Due + currentTotal** come from a single `computeBookingBalance(bookingId)` helper that sums `booking_price_components.amount` (already in major-unit THB) for the total and `payment_intents.amount` (satang → THB) for the paid figure, filtering payment intents to `status='successful'`. Due is `max(0, total − paid)`.

The helper lives at `silkskyair-member/lib/modules/bookings/balance.ts` and is the single source of truth for balance math in the member surfaces. New routes that need the same numbers should import it rather than re-summing inline.

## Edge cases worth knowing

- **Private charter (`shared = false`):** The "Cost per passenger" row reads `฿0` with the explanatory text "Private charter — no additional cost". Additional cost stays ฿0 regardless of how many adults / children the customer picks. Paid + Due still reflect the existing booking's balance.
- **Zero-paid bookings:** If no successful `payment_intents` are attached, Paid renders as `฿0` and Due equals the existing total. Customer sees the full outstanding amount before the amendment.
- **Mixed-currency booking:** Today every member booking is single-currency. If a booking ever ends up with `booking_price_components` rows in two different currencies the balance helper throws — the modal will fall through to its "pricing unavailable" branch rather than render misleading sums. (Not a path any production booking should hit; the throw is a guardrail.)
- **No flight assigned / tour missing:** Same fall-through — the helper succeeds but the upstream RPC fails, the route returns 500, and the modal shows the amber "Pricing is not available for this tour. You can still submit your request and our concierge team will provide a quote." banner. Customer can still submit the amendment.

## Support staff playbook

> **"I already paid in full. Why is the modal asking me for more money?"**
> The "New estimated total" row is the booking's total *after* the amendment is approved — not what the customer owes today. The Paid row shows what they've already settled (the original booking); the difference between the two is what concierge will invoice them for the new seat(s). Walk them through the five rows top to bottom: Cost per passenger → Additional cost → Paid → Due → New estimated total.

> **"The Paid number is wrong — I only paid X but the modal says Y."**
> The Paid row sums *every* successful payment intent on the booking. If a customer paid in two installments and only remembers one, Y will look high. Check the booking's payment history in Manager (Bookings → \<reference\> → Payments) — every row with status `successful` contributes to Paid here.

> **"Due says ฿0 but I haven't paid anything."**
> Usually means a manager / partner already settled the booking on the customer's behalf (back-office cash payment, a comp, or an off-platform transfer recorded as a payment intent). Same Manager screen as above will show who paid and when.

## Reference

- **Source:** `silkskyair-member/lib/modules/bookings/balance.ts` (helper), `silkskyair-member/app/api/bookings/[bookingId]/add-passenger-pricing/route.ts` (route), `silkskyair-member/app/(workspace)/bookings/_components/add-passenger-modal.tsx` (modal rows + `formatCurrency`).
- **i18n:** `bookings.addPassengers.paid` / `.due` in `lib/i18n/locales/{en,th,ru}.json`.
- **E2E:**
  - `silkskyair-member/e2e/member-add-passenger-simple.spec.ts` — asserts the five rows render with numeric currency values.
  - `silkskyair-member/e2e/member-add-passenger-full.spec.ts` — asserts exact THB amounts at default (1 adult) and adults=2, with Paid + Due invariant under pax-count changes.
