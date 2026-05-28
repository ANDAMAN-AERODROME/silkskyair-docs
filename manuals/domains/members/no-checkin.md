---
title: "Check-in is not part of Phase 1 (Member Portal)"
---

# Check-in is not part of Phase 1 (Member Portal)

> **App:** Member Portal
> **Who needs to know:** Support staff fielding "where's my boarding pass?" / "how do I check in online?" questions from customers. Engineers reading the booking detail page who notice the absence of any check-in surface and want context.
> **What it does:** Documents that **W23 Phase 1 explicitly disables online check-in in the Member Portal**. The customer-facing check-in flow (collect passenger info, accept dangerous goods declaration, watch the safety video, generate boarding pass) is not available; the operator runs check-in on the day of the flight via operator-side tooling.

## Why check-in was disabled

Advance Aviation's Phase 1 launch focuses on the booking + payment lifecycle. The online check-in tree the platform shipped earlier (boarding pass generation, dangerous goods declaration, safety video, multi-step indicator) was a Phase 2 ambition that wasn't validated with operators in time for the W23 release window. The decision in §F2.1 / MP1-W01: ship Phase 1 without it, restore in Phase 2 when the operator workflow is settled.

## What customers see (and don't)

On the Member Portal `/bookings/<id>` booking detail page, the check-in widget that used to render below the booking summary for confirmed bookings is gone:

- No green **"Check In Now"** banner.
- No amber **"Complete Info"** banner.
- No **"Download Boarding Pass"** CTA when the booking departure is imminent.
- No **"Confirm Check-In"** button anywhere on the page.

The Cancellation + Refund actions in the rail are now always shown when the booking is eligible (previously these hid once the customer had checked in — without check-in, that gate is gone).

## What support staff should say

> "Online check-in isn't part of the current release. The team at the aerodrome will check you in when you arrive — please bring your passport / national ID and a copy of your booking confirmation. If you'd like to update your weight, passport details, or passenger info before the flight, you can still do that from the Member Portal booking page."

If a customer references a check-in link they received in an older booking confirmation email, that link will now 404. Forward them to the booking detail page on the Member Portal where they can edit passenger details.

## What's been removed

For audit / re-enable context — these are the surfaces that no longer exist in the Member Portal:

| Surface | Was | Now |
|---|---|---|
| `/bookings/<id>/checkin` page | Multi-step check-in flow | `notFound()` → 404 |
| `/checkin/<id>` magic-link entry | Token-verified public check-in | 404 |
| `/api/bookings/<id>/checkin` | GET / POST check-in state | 404 across all methods |
| `/api/bookings/<id>/checkin/complete` | Mark check-in complete | 404 |
| Check-in widget on `/bookings/<id>` | Green "Check In Now" / amber "Complete Info" / "Download Boarding Pass" | Removed entirely |
| Middleware `/checkin/` bypass | Public token-verified path | Removed (no more bypass) |

Every file that was touched carries a `CHECKIN-DISABLED-2026-05` marker comment so a `grep -rln CHECKIN-DISABLED-2026-05 silkskyair-member` lists every surface that needs to be restored if Phase 2 reactivates check-in.

## Re-enable path

The original code lives in git history immediately before each marker. To restore:

1. Identify all 17 marker files with `grep -rl CHECKIN-DISABLED-2026-05 silkskyair-member`.
2. For each, revert the marker'd portion to the previous commit's content.
3. Drop the routes/page stubs in favour of the originals.
4. Re-enable the `/checkin/` and `/bookings/<id>/checkin?token=…` middleware bypass.
5. Restore `isCheckedIn` prop on `BookingDetailContent`, `PassengersSection`, `BookingActionsRail`, and the page.tsx `booking_checkin_state` fetch.
6. Remove the marker comments.
7. Delete `silkskyair-member/e2e/member-no-checkin-routes.spec.ts` and the parked simple spec.

## Reference

- **Source markers:** `grep -rln CHECKIN-DISABLED-2026-05 silkskyair-member` — should list 17 files.
- **E2E:**
  - `silkskyair-member/e2e/member-no-checkin-routes.spec.ts` — asserts 4 routes return 404 + the marker file count.
  - `silkskyair-member/e2e/member-no-checkin-simple.spec.ts` — `test.fixme()` placeholder pending the F2.2 magic-link auth fixture; will assert the UI surface is absent on the authenticated booking detail page.
- **Plan:** `silkskyair-docs/plans/w23-work-plan.md` §F2.1 (MP1-W01).
