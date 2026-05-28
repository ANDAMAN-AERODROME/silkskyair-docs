---
title: "Passenger Weight — Exact Numeric Entry (Member Portal)"
---

# Passenger Weight — Exact Numeric Entry (Member Portal)

> **App:** Member Portal
> **Who uses it:** Customers entering or correcting passenger weight on a confirmed booking. Support staff fielding "why is the weight field a number now?"
> **What it does:** The Edit Passenger drawer now asks for an exact weight in kilograms — a number with up to one decimal — instead of the old five-bucket selector. Advance Aviation's safety load planning needs the actual figure to balance the aircraft; a bucket like "70–90 kg" hides too much.

## What customers see

In the passenger drawer, the **Weight (kg)** field is a numeric input with a placeholder of `72.5`. The mobile keyboard opens with the decimal pad, and the field accepts numbers between `0` (exclusive) and `250` (inclusive) with steps of `0.1`. Saving an out-of-range or otherwise invalid value surfaces an inline error and prevents the row from persisting.

| Entered value | Inline message |
|---|---|
| `0` | "Weight must be positive" |
| (empty) | "Weight is required" |
| `300` | "Weight must be 250 kg or less" |
| `72.5` | (no error; saves) |

## Why exact

Pre-F2.3, the field was a bucket selector:

```
< 50 kg  /  50–70  /  70–90  /  90–110  /  > 110  /  Prefer not to say
```

That shape was fine for analytics but couldn't drive Advance Aviation's load-balancing math — pilots need to position passengers in the cabin based on actual weight, not a 20 kg band. Advance Aviation rejected the bucket abstraction; F2.3 swapped the selector for a numeric input that matches what the partner portal already used. The schema column was migrated from a text FK on `weight_ranges` to a `numeric(5,2)` with `CHECK weight_kg > 0 AND weight_kg <= 250` (migration `20260528120000_passenger_weight_numeric.sql`), so the rule is enforced at the database too.

## Where it's validated

1. **Inline (client):** `validateWeight()` in `silkskyair-member/lib/modules/bookings/passenger-validation.ts` runs on every change and writes the matching error into the field's `errors.weightKg` slot.
2. **PATCH route:** `app/api/bookings/[bookingId]/passengers/[passengerId]/route.ts` re-checks the same rules and returns a 400 with the offending message if anything got through the form (e.g. someone bypassed the UI). Mirrors `silkskyair-partner`'s PATCH validation.
3. **Database:** The CHECK constraints on `booking_passengers.weight_kg` are the final guard — a bug in either layer above still can't write a 0, negative, or >250 kg value.

The form deliberately does **not** block the Save button on an inline error — partial saves are allowed for customers who don't have all passenger details handy. The PATCH route is the authoritative gate: if the weight is invalid the row simply doesn't update and the inline error stays visible.

## Support staff playbook

> **"I used to be able to pick a weight range — where is it?"**
> Advance Aviation needs the exact weight in kilograms for pre-flight load planning. The bucket selector hid too much variation inside each band (a 70–90 kg bucket covers a 20 kg spread, which is enough to shift the centre of gravity on a six-seater helicopter). The new field accepts any number with up to one decimal between 0 and 250.

> **"I don't know my exact weight — can I leave it blank?"**
> Yes. The form will mark the row as incomplete, but the booking can still be saved. The pilots will confirm with passengers at the heliport on the day of the flight if anything's missing.

> **"It rejected my number of 300 kg — is something broken?"**
> No — 250 kg is the upper limit. If you genuinely need to enter a higher value, contact concierge so the operator can plan a single-passenger flight rather than a shared one. (For context, the heaviest production helicopter passenger on record is well below the cap; the limit is there to catch typos like an extra zero.)

## Reference

- **Source:** `silkskyair-member/app/(workspace)/bookings/_components/passenger-edit-drawer.tsx` (input + onChange validation), `silkskyair-member/lib/modules/bookings/passenger-validation.ts:validateWeight` (rules).
- **API:** `silkskyair-member/app/api/bookings/[bookingId]/passengers/[passengerId]/route.ts` (PATCH).
- **Schema:** `silkskyair-api/supabase/migrations/20260528120000_passenger_weight_numeric.sql` (column + CHECKs).
- **E2E:**
  - `silkskyair-member/e2e/member-weight-edit-simple.spec.ts` — happy path: UI form → PATCH → DB round-trip with 72.5.
  - `silkskyair-member/e2e/member-weight-edit-validation.spec.ts` — rejection rules (0, 300, negative) at form + API; valid decimal persists.
- **Partner counterpart:** `silkskyair-docs/manuals/domains/partner/edit-passenger.md` (the F1.10 page) — the partner portal carries the identical contract.
