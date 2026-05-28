---
title: "Amendment-Received Customer Emails (Member Portal)"
---

# Amendment-Received Customer Emails (Member Portal)

> **App:** Member Portal (trigger), n8n bookings-event workflow (delivery)
> **Who uses it:** Customers who just submitted a date/time change or an add-passenger request from the booking detail page. Support staff fielding "did my request go through?"
> **What it does:** As soon as a member submits an amendment request, the customer receives a localized acknowledgement email — "We've received your request, our concierge team is reviewing it." This closes the silence between request submission and the existing approved / declined email.

## Trigger flow

1. Customer opens a confirmed booking and clicks the relevant CTA (e.g. **Change date & time**, **Add passenger**).
2. Member portal POSTs `/api/bookings/<id>/change-requests` with `{ type: "amendment", payload: { amendment_subtype: "change_datetime" | "add_passengers", ... } }`.
3. The route inserts a `booking_change_requests` row, then a `booking_events` row of type `BookingAmendmentRequested`. The event's `metadata` carries `amendment_subtype` verbatim from the request body (F2.5 added this field — the workflow needs it to pick the right template).
4. Postgres trigger `trg_booking_events_webhook` fires the n8n **Bookings Event** workflow.
5. The workflow's Switch routes `BookingAmendmentRequested` (output index 5, the "BAR" branch). F2.5 wired this output to fan out to **both** branches: `fetch-booking-customer-notes` → `prepare-manager-email-data` (the existing operator notification — `booking-amendment-requested-manager`) AND the new `prepare-member-email-data` (the customer-side acknowledgement).
6. `prepare-member-email-data` reads `event_payload.metadata.amendment_subtype` and picks one of the two new templates; if the subtype is anything else, `template_slug` is left empty and the member sub-workflow short-circuits (no email).
7. `call-booking-member-email` sends via Zoho SMTP, addressed to `bookings_snapshot.contact_email`.

## The two new templates

| `amendment_subtype` | Template slug | EN subject |
|---|---|---|
| `change_datetime` | `booking-change-request-received-member-date-time` | `Date & Time Change Request Received: {{reference_code}}` |
| `add_passengers` | `booking-change-request-received-member-add-passenger` | `Add Passenger Request Received: {{reference_code}}` |

Each template has EN / TH / RU rows in `email_templates_i18n` with localized subject, body, and `sender_name`. The body references `{{contact_name}}`, `{{reference_code}}`, `{{tour_title}}`, `{{departure_date}}`, `{{departure_time}}` — all populated by `prepare-member-email-data` from `bookings_snapshot`.

## What's intentionally NOT covered

- **`remove_passengers`** and **`change_tour`** subtypes — the member portal supports submitting these (see `remove-passenger-modal.tsx` and `tour-change-modal.tsx`), but F2.5's plan only specified the two templates above. The slugMap falls through to `''` for them and no customer email is sent today. When ops wants to cover those subtypes, the pattern is: add the two template rows in a follow-up migration, then extend `amendmentSubtypeSlugs` in `prepare-member-email-data`'s Code node.
- **Approved / declined / applied** emails — those already existed pre-F2.5 (`booking-change-request-approved-member`, `booking-change-request-declined-member`) and fire from Switch outputs 7 / 8 / 9. F2.5 is specifically about the *initial* "we got your request" stage.

## Observability

Same pattern as every other booking notification — local MailPit does **not** catch these (the workflow uses real Zoho SMTP). To verify a customer received the email:

1. Open the n8n executions UI: `http://localhost:5678/executions?workflowId=UWRU5xWgrLz3Zuic`.
2. Filter to the run whose `event-data` shows the booking's `reference_code`.
3. Expand `prepare-member-email-data` — check `template_slug` is the expected one for the subtype.
4. Expand `call-booking-member-email` — check `success: true` and `recipient_email` matches the customer's address.

For real recipients, check the customer's actual inbox.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| No member-side run at all in n8n | Older revision of `bookings-event.json` is deployed (Switch output 5 not wired to the member branch) | Re-run `pnpm sync:<env>` from `silkskyair-workflows` |
| Member run fires but `template_slug` is empty | `amendment_subtype` not in event metadata, OR subtype is `remove_passengers` / `change_tour` (no template yet) | Confirm the change-requests route is shipping the F2.5 change; for unsupported subtypes, add a follow-up migration |
| `template_slug` correct but `call-booking-member-email` reports an error | Template row missing for the customer's locale | Migration `20260529100000` seeds en/th/ru; for new locales add an i18n row with the same shape |
| Customer email body shows `{{reference_code}}` literally | `bookings_snapshot` returned no row for this `booking_id` | Booking insert is missing — check `fetch-booking` upstream |

## Support staff playbook

> **"I submitted a request five minutes ago and haven't heard anything."**
> Two emails should fire when a customer submits an amendment: one to back-office (`booking-amendment-requested-manager`) and one to the customer (`booking-change-request-received-member-*`). If the customer didn't get theirs, check spam folder first; then look at the n8n execution for the booking — if `template_slug` is empty in `prepare-member-email-data`, the subtype is one we haven't templated yet (today: `remove_passengers`, `change_tour`).

> **"Can we customize the email per amendment type more deeply (e.g. show a date diff for change_datetime)?"**
> Possible but not in F2.5's scope. The body templates use the standard variable set populated by `prepare-member-email-data`. Adding `requested_date`, `requested_time`, etc. would require both (a) the change-requests route to surface those fields in the event metadata, and (b) the workflow to pass them through. Out-of-scope here; talk to the ops team about prioritization.

## Reference

- **Migration:** `silkskyair-api/supabase/migrations/20260529100000_member_amendment_received_templates.sql`
- **Member route:** `silkskyair-member/app/api/bookings/[bookingId]/change-requests/route.ts` (lines ~270–290 — stash of `amendment_subtype` in event metadata)
- **Workflow:** `silkskyair-workflows/workflows/bookings/bookings-event.json` — Switch output 5 fan-out + the slugMap in `prepare-member-email-data`
- **Sub-workflow:** `silkskyair-workflows/workflows/notifications/booking-member-email.json` (unchanged — same delivery path the F1.15 customer cancellation email uses)
- **E2E:** `silkskyair-partner/e2e/partner-amendment-received-emails.spec.ts` — two tests: `change_datetime` → date-time template; `add_passengers` → add-passenger template + payload assertions
