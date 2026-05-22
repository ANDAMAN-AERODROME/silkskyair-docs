# Member Portal — 1st Review Implementation Plan

## Context

On 2026-05-19, Micheline / Panpaporn / Nuchada delivered a 12-page review of the SilkSky Member Portal ("Member Portal 1st Review"). The page-by-page extraction surfaced **33 actionable items** across login, weight capture, payment, check-in, add-passenger flow, amendment change-request emails, approval emails, and a "Payment Successful" bug on amended-but-unpaid bookings.

The user (Peter) gave per-item responses confirming, refining, or rejecting each. This plan implements only those decisions.

**Code scheme:**
- **Per-item codes — `MP1-Pxx-NN`** — `MP1` = Member Portal 1st Review; `Pxx` = page in the review PDF; `NN` = item index on that page. These map 1:1 back to the review document for traceability.
- **Per-workstream codes — `MP1-W01..W11`** — implementation groupings. Each workstream lists which `MP1-Pxx-NN` items it satisfies.

The repo is the monorepo at `/Users/pmoelgaard/Workspaces/andaman-aerodrome`. Packages involved: `silkskyair-member`, `silkskyair-manager`, `silkskyair-api`, `silkskyair-workflows`, plus a new `silkskyair-docs` repo to create.

---

## Review item code map (33 items)

| Code | Page | Item | User decision | Workstream |
|---|---|---|---|---|
| MP1-P02-01 | 2 | Remove password input + Sign In button | Confirmed (URL-differentiator) | W02 |
| MP1-P02-02 | 2 | Remove "Forgot password / Reset here" link | Confirmed | W02 |
| MP1-P02-03 | 2 | Magic link is the only login path | Confirmed | W02 |
| MP1-P03-01 | 3 | Replace bucketed weight dropdown with exact numeric (kg) | Confirmed (positive number) | W03 |
| MP1-P03-02 | 3 | Keep weight required | Confirmed | W03 |
| MP1-P03-03 | 3 | Capture Advance Aviation team rationale in docs | Confirmed | W03 + W11 |
| MP1-P04-01 | 4 | Auto-notify back office on payment success | Confirmed | W10 |
| MP1-P04-02 | 4 | Channel = email only; recipient = `booking_manager` role | Confirmed (email only) | W10 |
| MP1-P05-01 | 5 | Add "Skip" on Safety Briefing | **Phase 2** (check-in disabled in Phase 1) | — (deferred) |
| MP1-P05-02 | 5 | Multi-language safety video assets | **Phase 2** | — (deferred) |
| MP1-P05-03 | 5 | Marked as Phase 2 candidate | Acknowledged | — |
| MP1-P06-01 | 6 | Remove entire check-in flow for Phase 1 | Confirmed | W01 |
| MP1-P08-01 | 8 | Show **Paid amount** in pricing breakdown | Confirmed | W04 |
| MP1-P08-02 | 8 | Also show balance **Due / Amount Payable** | Confirmed (user extension) | W04 |
| MP1-P08-03 | 8 | THB-only Phase 1 | Confirmed | W04 |
| MP1-P08-04 | 8 | New `processing` booking state when amendment → payment-request | **New requirement (user)** | W06 |
| MP1-P08-05 | 8 | `PaymentRequestSent` transient event; `PaymentSuccessful` → `BookingPaidInFull` → restore status | **New requirement (user)** | W06 |
| MP1-P09-01 | 9 | Customer confirmation email — date/time change | Confirmed | W05 |
| MP1-P09-02 | 9 | Customer confirmation email — additional passenger | Confirmed | W05 |
| MP1-P09-03 | 9 | "Booking under review" portal state is intentional context | Confirmed | — (no code) |
| MP1-P10-01 | 10 | Include payment info in approval email | Confirmed | W08 |
| MP1-P10-02 | 10 | Provide payment option in member portal for approved amendments | Confirmed | W07 + W08 |
| MP1-P10-03 | 10 | Pricing values in review are illustrative (test data) | Confirmed | — (no code) |
| MP1-P10-04 | 10 | No invoices sent (clarification) | Confirmed | — (no code) |
| MP1-P10-05 | 10 | Per-payment rows in Manager — paid flagged, unpaid show **Open + Copy** CTAs | **New requirement (user)** | W09 |
| MP1-P11-01 | 11 | Bug — member portal must not show "Payment Successful" with unpaid amendment | Confirmed | W07 |
| MP1-P11-02 | 11 | Surface payment option for unpaid amendment on member side | Confirmed | W07 |
| MP1-P11-03 | 11 | Use **authenticated** member-side amendment payment flow (Option B) | Confirmed | W08 |
| MP1-P11-04 | 11 | Document Booking Status mechanism exhaustively | Confirmed | W11 |
| MP1-P12-01 | 12 | Remove green "Check In Now" banner (top + bottom row) | Confirmed | W01 |
| MP1-P12-02 | 12 | Remove yellow "Complete Info / Check In Now" warning banner | Confirmed | W01 |
| MP1-P12-03 | 12 | Remove Confirm Check-In step + Complete Check-In button | Confirmed | W01 |
| MP1-P12-04 | 12 | Reinforces MP1-P06-01 — check-in removal must cover every surface | Confirmed | W01 |

Items with no work: P05-01..03 (deferred), P09-03 (acknowledgment), P10-03 (acknowledgment), P10-04 (acknowledgment). All others are covered by a workstream.

---

## Workstreams

Each workstream lists its review-item coverage in brackets.

---

### MP1-W01 — Check-in disable
**Covers:** MP1-P06-01, MP1-P12-01, MP1-P12-02, MP1-P12-03, MP1-P12-04

**Decision:** Comment out (don't delete) the entire check-in flow + preflight steps. Will be re-enabled later. Block-comment style marked `CHECKIN-DISABLED-2026-05`.

**Approach:** Files inside the check-in tree get a route/page/module stub at the top + line-commented (`// `) original body below a `BEGIN ORIGINAL` marker (block `/* */` wraps fail because the original code contains nested `*/`). Entry points outside the tree use surgical edits: `false &&` short-circuit on the JSX widget, comment out the `booking_checkin_state` query, comment out the two middleware bypasses.

**Critical files (silkskyair-member):**
- Surgical edits: `app/(workspace)/bookings/_components/booking-detail-content.tsx`, `app/(workspace)/bookings/[bookingId]/page.tsx`, `middleware.ts`.
- Stub + line-comment: `app/bookings/[bookingId]/checkin/page.tsx`, `checkin-flow.tsx`, all 6 `steps/step-*.tsx`, `app/api/bookings/[bookingId]/checkin/route.ts`, `app/api/bookings/[bookingId]/checkin/complete/route.ts`, `app/checkin/[bookingId]/route.ts`, `lib/modules/bookings/checkin-links.ts`. (15 files.)

**Verification:** Booking detail page shows no "Check In Now" banner. `/bookings/{id}/checkin` returns 404. `grep -rln CHECKIN-DISABLED-2026-05 silkskyair-member` returns 15 hits. Build passes.

---

### MP1-W02 — Magic-link-only auth for member portal
**Covers:** MP1-P02-01, MP1-P02-02, MP1-P02-03

**Decision:** Differentiator based on return URI containing token `member` or hostname `my.silkskyair` → magic-link only. Otherwise both modes.

**Approach:** Member portal has its own sign-in form at `silkskyair-member/components/auth/sign-in-form.tsx` (separate from `silkskyair-account`). Add a `magicLinkOnly` prop + URL-detection helper. Hide password divider (lines 205–224), password section, and "Forgot password" link when true.

**Critical files:**
- New: `silkskyair-member/lib/auth/url-context.ts` — `isMemberPortalContext(url: string | null): boolean`.
- `silkskyair-member/components/auth/sign-in-form.tsx` — accept `magicLinkOnly`; gate the gated sections.
- `silkskyair-member/app/(auth)/sign-in/page.tsx` — read `redirect_to`, run helper, pass prop. Default to `true` for this app; helper exists for forward-compatibility.

**Verification:** `/sign-in?redirect_to=/bookings/xyz` → magic-link-only form. Submit, receive email, complete sign-in via existing `/api/auth/verify` flow.

---

### MP1-W03 — Positive-number weight constraint
**Covers:** MP1-P03-01, MP1-P03-02, MP1-P03-03

**Decision:** Replace bucketed weight-range dropdown with a positive numeric input (kg). Field stays required. Capture Advance Aviation rationale in `silkskyair-docs`.

**Approach:** Current field uses `WeightRangeSelector` from `@ssa/ui`. Replace with `<input type="number">` plus validation: positive, ≤ sanity max (suggest 250 kg — **open question** below). DB column already `numeric`.

**Critical files:**
- `silkskyair-member/lib/modules/bookings/passenger-validation.ts` — change `validateWeight()` from bucket-id to positive-numeric.
- `silkskyair-member/app/(workspace)/bookings/_components/passenger-edit-drawer.tsx` — replace selector with number input.
- (Doc-side, see MP1-W11) — note Advance Aviation rationale in `silkskyair-docs/docs/passenger-data.md` or similar.

**Verification:** Edit drawer accepts `72.5`, rejects 0 / negative / non-numeric. Saved value stored in `booking_passengers.weight_kg` as numeric.

---

### MP1-W04 — Add-passenger pricing: Paid + Due + Total
**Covers:** MP1-P08-01, MP1-P08-02, MP1-P08-03

**Decision:** In the Add Passengers modal, display Cost-per-passenger · Additional cost · **Paid amount** · **Due amount / Amount Payable** · Total.

**Approach:** Extend `/api/bookings/[bookingId]/add-passenger-pricing` to return `paidAmount` and `dueAmount`. Add a reusable balance helper. Add two rows in the modal JSX (currently lines 217–260).

**Critical files:**
- `silkskyair-member/app/api/bookings/[bookingId]/add-passenger-pricing/route.ts` — extend response.
- New helper: `silkskyair-member/lib/modules/bookings/balance.ts` — `computeBookingBalance(bookingId): { total, paid, due }`. Reused by MP1-W07 and MP1-W09.
- `silkskyair-member/app/(workspace)/bookings/_components/add-passenger-modal.tsx` — add the two rows; format via existing THB formatter.

**Verification:** On a ฿17,000 paid booking, Add Passengers modal shows: Cost/pax ฿8,500 · Additional ฿8,500 · **Paid ฿17,000** · **Due ฿8,500** · New total ฿25,500.

---

### MP1-W05 — Customer confirmation emails for change requests
**Covers:** MP1-P09-01, MP1-P09-02

**Decision:** Customer receives a "We have received your request" email when submitting a date/time change OR an additional-passenger request.

**Approach:** Two new templates in the change-request migration pattern. Wire `bookings-event.json` to call the existing `booking-member-email` workflow on `AmendmentRequested` events (sub-typed by amendment kind from metadata).

**Critical files:**
- New migration `silkskyair-api/supabase/migrations/<TS>_member_amendment_received_templates.sql` — two templates: `booking-change-request-received-member-date-time`, `booking-change-request-received-member-add-passenger`. Follow layout of existing `booking-change-request-approved-member` (`20260317100000_booking_change_request_types.sql`).
- `silkskyair-workflows/workflows/bookings/bookings-event.json` — add Switch branches dispatching to `booking-member-email` with the new template slugs.

**Verification:** Submit date-change → email arrives within seconds. Submit add-passenger → email arrives.

---

### MP1-W06 — Booking status state machine update
**Covers:** MP1-P08-04, MP1-P08-05 (+ foundational for MP1-W07, MP1-W08, MP1-W09)

**Decision (user-specified):**
- Booking is Amended → Payment Request sent → booking enters **`processing`** state.
- `PaymentRequestSent` is a **transient** event — does NOT change deterministic state.
- On `PaymentSuccessful`, if the full balance is settled, emit `BookingPaidInFull` — advances booking back to its prior status (`confirmed` or `completed`).

**Approach:**
1. Add `processing` to `booking_statuses` table.
2. Add `is_state_changing boolean DEFAULT true` to `booking_event_types`; mark transient events `false`.
3. Add event types: `PaymentRequestSent` (transient), `PaymentSuccessful` (transient), `BookingAmended` (audit, used to derive transition into processing). `BookingPaidInFull` already exists — repurpose semantics so it always means "fully paid, settle to prior pre-processing state".
4. Update `booking_status_from_event_type()` to walk only `is_state_changing=true` events; map `BookingAmended` with surcharge → `processing`; `BookingPaidInFull` → restore-prior-status.
5. Update `booking_amendment_approve()` RPC: when surcharge > 0, insert a `payment_requests` row, insert `PaymentRequestSent`, transition booking to `processing`.
6. Update `silkskyair-workflows/workflows/payments/omise.json` to insert `PaymentSuccessful` after the existing `supabase-rpc-success` node (line 260), then call a balance-check RPC that emits `BookingPaidInFull` when paid = due.

**Critical files (all new migrations under `silkskyair-api/supabase/migrations/`):**
- `<TS>_add_processing_status.sql`
- `<TS>_event_state_changing_flag.sql`
- `<TS>_payment_lifecycle_event_types.sql`
- `<TS>_processing_state_transitions.sql`
- `<TS>_amendment_approve_payment_request.sql`
- `silkskyair-workflows/workflows/payments/omise.json` — emit + balance check.

**Verification:** SQL trace: pending → approved → confirmed (after pay) → processing (after amendment with surcharge) → confirmed (after surcharge pay). Documented in MP1-W11 doc.

---

### MP1-W07 — Member portal: "Payment Successful" bug + amendment-payment CTA
**Covers:** MP1-P11-01, MP1-P11-02, MP1-P10-02 (member-side portion)

**Decision:** Don't show "Payment Successful" / "Confirmed and paid" when an amendment is unpaid. Show a Pay-now CTA for that amendment.

**Approach:** Depends on MP1-W06. Once the booking is in `processing`, the existing `statusConfig` map in `booking-detail-content.tsx` (lines 102–134) needs a `processing` entry. Add an amendment-payment widget block (mirroring the existing `approved` Payment widget at lines 139–157) linking to the screen built in MP1-W08.

**Critical files:**
- `silkskyair-member/app/(workspace)/bookings/_components/booking-detail-content.tsx` — add `processing` entry; add amendment-payment widget.
- `silkskyair-member/lib/modules/bookings/normalizers.ts` (line 205) — fix `isPaidInFull` so it only returns true when no outstanding `payment_requests` exist.
- i18n string files (`silkskyair-member/lib/i18n/...`) — localized labels and description for `processing`.

**Verification:** Force a booking to `processing` via SQL → reload member portal → "Payment Required" badge + Pay-now CTA. Pay → status auto-reverts.

---

### MP1-W08 — Authenticated amendment-payment screen + approval email link
**Covers:** MP1-P10-01, MP1-P10-02 (email portion), MP1-P11-03

**Decision (Option B):** New authenticated member-side screen at `/bookings/[bookingId]/amendments/[paymentRequestId]/pay`. Approval email contains a deep link to it.

**Approach:**
1. Add FK columns `booking_id` + `amendment_event_id` to `payments.payment_requests`.
2. New page renders the existing `PaymentCheckout` component with the amendment amount + `paymentRequestId`. Auth-checked.
3. Update `booking-change-request-approved-member` template to include `{{amendment_payment_url}}`.
4. `bookings-event.json` constructs the URL when firing approval email.

**Critical files:**
- New: `silkskyair-member/app/(workspace)/bookings/[bookingId]/amendments/[paymentRequestId]/pay/page.tsx`.
- New migration `<TS>_payment_requests_booking_link.sql` — FK columns.
- New migration `<TS>_approval_email_payment_link.sql` — UPSERT template body with `{{amendment_payment_url}}` placeholder.
- `silkskyair-workflows/workflows/bookings/bookings-event.json` — pass URL to template context.

**Verification:** Approve amendment with surcharge → email arrives with Pay-now button → click → authenticated payment screen with correct amount → pay → booking returns to `confirmed`.

---

### MP1-W09 — Per-payment rows in Manager UI
**Covers:** MP1-P10-05

**Decision:** Each payment as a separate row. Paid ones flagged; unpaid ones show Open + Copy CTAs.

**Approach:** Reuse the list-iteration pattern from `silkskyair-manager/app/(workspace)/payments/_components/payments-manager.tsx` (lines 61–105). Query all `payment_requests` linked to the booking (FK from MP1-W08) plus the original booking `payment_intent`.

**Critical files:**
- `silkskyair-manager/app/(workspace)/bookings/_components/booking-payment-section.tsx` — replace single badge + single payment link with a list.
- Extend `silkskyair-manager/lib/modules/bookings/payment-links.ts` — `buildPaymentRequestLink(paymentRequestId)`; pattern `${MEMBER_PORTAL_URL}/pay/request/${id}` (already used by `payments-manager.tsx` line 105).
- New: `silkskyair-manager/app/api/bookings/[bookingId]/payments/route.ts` — returns aggregated list.

**Verification:** Manager opens a booking with paid original + unpaid amendment → two rows displayed. Copy → link on clipboard. Open → opens to amendment payment screen.

---

### MP1-W10 — Back-office email on payment success
**Covers:** MP1-P04-01, MP1-P04-02

**Decision:** Email only.

**Approach:** Mostly already wired. `bookings-event.json` (lines 295, 320) already routes `BookingPaidInFull` / `BookingConfirmed` to `booking-manager-email` (which sends to `booking_manager` role via `get_users_with_role` RPC). Verification + template confirmation only.

**Critical files:**
- Verify `silkskyair-workflows/workflows/notifications/booking-manager-email.json` (lines 96–185) is operational.
- Confirm an email template suitable for payment-success exists; create one if missing.
- Ops: confirm `booking_manager` role membership in production.

**Verification:** Staging payment → back-office user receives email.

---

### MP1-W11 — `silkskyair-docs` repo + Booking Status reference doc
**Covers:** MP1-P11-04, MP1-P03-03 (Advance Aviation rationale capture)

**Decision (user-specified):** New sibling project `silkskyair-docs`, local `git init`. Canonical home for the Booking Status doc and any future cross-cutting docs.

**Approach:** Create `~/Workspaces/andaman-aerodrome/silkskyair-docs/`. `git init`. Write `docs/booking-status.md` capturing current + post-MP1-W06 state machine with code citations.

**Critical files (new repo):**
- `silkskyair-docs/README.md` — top-level guide.
- `silkskyair-docs/docs/booking-status.md` — status enum, event-type registry, transition rules, transient vs deterministic events, amendment lifecycle, per-payment model, gaps closed by MP1-W06/W08, citations into the monorepo.
- `silkskyair-docs/docs/passenger-data.md` (optional) — captures Advance Aviation weight rationale (MP1-P03-03).
- `silkskyair-docs/.gitignore` — `.DS_Store`, `node_modules/`.
- Initial commit: `chore: initialise silkskyair-docs`.

**Verification:** `cd silkskyair-docs && git log --oneline` shows initial commit. Doc renders in any Markdown viewer.

---

## Recommended phasing

**Phase 1 — low-risk trim + setup (~1–2 days):**
MP1-W01 → MP1-W03 → MP1-W02 → MP1-W11.

**Phase 2 — amendment-payment lifecycle (~5–10 days, dependency-ordered):**
MP1-W06 (state machine) → MP1-W08 (amendment payment screen + email) → MP1-W04 (paid/due/total) → MP1-W07 (member UI fix) → MP1-W09 (manager per-payment rows) → MP1-W05 (customer emails) → MP1-W10 (verify back-office email).

MP1-W06 is the lynchpin — every later workstream assumes `processing` state exists and amendment payments are tracked as separate `payment_requests` rows.

---

## End-to-end verification scenario

A single scripted scenario exercising every workstream, with item-code annotations:

1. **Magic-link sign-in** at `/sign-in?redirect_to=/bookings/xyz` → no password field. [MP1-W02 → MP1-P02-01/02/03]
2. **No "Check In Now" banner** anywhere on the booking detail page. [MP1-W01 → MP1-P06-01, MP1-P12-01/02/03/04]
3. **Edit passenger** → weight field is numeric input; saves `72.5`. [MP1-W03 → MP1-P03-01/02]
4. **Open Add Passengers modal** → see Cost · Additional · Paid · Due · New total. [MP1-W04 → MP1-P08-01/02/03]
5. **Submit add-passenger request** → customer receives confirmation email. [MP1-W05 → MP1-P09-02]
6. **Manager approves** amendment with surcharge → booking status flips to `processing`. [MP1-W06 → MP1-P08-04]
7. **Customer receives approval email** with Pay-now link → click → authenticated payment screen at `/bookings/[id]/amendments/[paymentRequestId]/pay`. [MP1-W08 → MP1-P10-01, MP1-P11-03]
8. **Pay** via Omise → `PaymentSuccessful` → balance-check → `BookingPaidInFull` → status returns to `confirmed`. [MP1-W06 → MP1-P08-05]
9. **Manager booking-payment section** shows two rows: original (Paid) + amendment (Paid). [MP1-W09 → MP1-P10-05]
10. **Back-office user receives** payment-success email for surcharge. [MP1-W10 → MP1-P04-01/02]
11. **Booking Status doc** in `silkskyair-docs` reflects the observed behaviour. [MP1-W11 → MP1-P11-04]

---

## Open questions (small, won't block Phase 1 start)

1. **MP1-W03 weight upper bound** — "positive number" agreed; what max (250 kg suggested for sanity)?
2. **MP1-W06 `BookingPaidInFull` target** — user said "back to Completed" verbatim. Does that mean literally `completed`, or restore-to-prior-status (which would be `confirmed` for a future flight and `completed` for a past one)? Affects `booking_status_from_event_type()` mapping.
3. **MP1-W11 `silkskyair-docs` remote** — local `git init` only, or also create `ANDAMAN-AERODROME/silkskyair-docs` on GitHub and push?

These can be answered when the affected workstreams actually start; they don't block plan approval.
