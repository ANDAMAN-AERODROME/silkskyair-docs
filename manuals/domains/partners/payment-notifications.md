---
title: "Back-Office Payment Notifications (Manager Email)"
---

# Back-Office Payment Notifications (Manager Email)

> **App:** All booking surfaces (member portal, partner portal, manager portal) — this is a back-office side effect, not a user surface
> **Who uses it:** Booking-manager staff who need to know when a payment lands so they can prep the flight, brief the operator, and update the deal in Zoho.
> **What it does:** When a booking's payment is confirmed, every user with the `booking_manager` role receives an email titled `Booking <REF> — Payment Received` (localized per booking) summarizing the customer, tour, departure, and a deep-link to the booking in Manager.

## Trigger

The notification fires when a `booking_events` row of type **`BookingConfirmed`** is inserted. A Postgres trigger (`trg_booking_events_webhook`, in `silkskyair-api`) calls the n8n **Bookings Event** workflow (`UWRU5xWgrLz3Zuic` local / mapped per environment), which Switch-routes the event to the manager branch.

> **Future-proofing for F2.6:** the workflow's slug map (`prepare-manager-email-data` Code node) already accepts `BookingPaidInFull` as an alternate trigger and routes it to the same `booking-paid-manager` template. The F2.6 LYNCHPIN migration will add `BookingPaidInFull` to `booking_event_types` so payment-success can be distinguished from booking-confirmed in the lifecycle. Until then, `BookingConfirmed` is the only event that satisfies the FK on `booking_events.event_type` and the contract is identical for the manager side.

## Recipients

Every user returned by the `public.get_users_with_role('booking_manager')` RPC. The recipient list is computed at send time, not cached.

Adding or removing a booking manager:
- **Add:** `INSERT INTO account.organization_users (user_id, role_id, ...) VALUES (..., 'booking_manager', ...);` for the relevant organization. Next payment will include them.
- **Remove:** `DELETE` or set the role to a non-manager value. Next payment will skip them.

Local seed has exactly one: `peter@andaman.co.th`. The E2E spec asserts `emails_sent_count > 0` rather than pinning the seed count, so the spec stays valid as the team grows.

## Template + locale

The email is rendered from the `booking-paid-manager` row in `email_templates` × the locale-matching row in `email_templates_i18n`. Subject lines (EN/TH/RU):

| Locale | Subject |
|---|---|
| EN | `Booking {{reference_code}} — Payment Received` |
| TH | `การจอง {{reference_code}} — ได้รับการชำระเงิน` |
| RU | `Бронирование {{reference_code}} — Оплата получена` |

The locale is the booking's locale (`bookings.locale`), not per-recipient — every manager receives the same locale for a given booking. The `From:` header uses the locale's `sender_name` column (e.g. EN: "Silk Sky Guest Services Information") composed with the workflow-config `zoho_mail_from_address`.

The body template is rendered with these variables, all populated by `prepare-manager-email-data` from the `bookings_snapshot` view:
- `reference_code`, `tour_title`, `departure_date`, `departure_time`, `passenger_count`, `contact_name`, `contact_email`
- `manager_booking_url` = `${manager_base_url}/bookings/${booking_id}` — clickable in the email
- `customer_notes_rows` = pre-rendered HTML rows from customer-submitted booking notes (escaped server-side)

## Delivery + observability

Local + staging + production all send via the **Zoho SMTP** credential `AAC | SSA | Zoho | SMTP`. Local MailPit (`http://localhost:8025`) does **not** catch these — n8n is configured against real Zoho, not the local SMTP container. To observe the email locally:

- **n8n executions UI** (`http://localhost:5678/executions`) — filter by workflow "Bookings | Event", click into the latest execution, expand `prepare-manager-email-data` (slug + recipient computed payload) and `call-booking-manager-email` (`success`, `emails_sent_count`).
- **Recipient inbox** — for real recipients, check the actual mailbox. Local test recipient `peter@andaman.co.th` receives every payment-received notification triggered during dev work.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| No execution appears in n8n | `trg_booking_events_webhook` is disabled, OR `system_config` `booking_events_webhook` URL is wrong | Check the trigger exists; re-run `pnpm sync:<env>` after a workflow ID swap |
| Execution runs but `call-booking-manager-email` reports `emails_sent_count: 0` | Zero users with `booking_manager` role for that environment | Add at least one user via `account.organization_users` |
| `call-booking-manager-email` errors | Zoho SMTP credential expired or wrong creds for the env | Rotate via n8n credential editor; verify `ZOHO_SMTP_USER` / `ZOHO_SMTP_PASSWORD` in the target `.env` |
| Manager receives blank `customer_notes_rows` | No `booking_notes` of `content_format='plain_text'` for the booking | Expected — the row block renders empty when there are no notes |

## Support staff playbook

> **"A customer just paid but no one on the team got an email."**
> Check the latest **Bookings | Event** execution in n8n (`http://localhost:5678/executions`) for the booking's `reference_code` in the `event-data` node. If the execution exists and `call-booking-manager-email` shows `emails_sent_count > 0`, the issue is at the recipient's mailbox (spam filter, mailing-list rule, etc.) — not the workflow. If the execution is missing, the Postgres trigger didn't fire; check the booking actually has a `booking_events` row of type `BookingConfirmed`.

> **"I want to add someone to the booking-manager list."**
> Send them the `booking_manager` role assignment via the Account Portal team-admin UI (or directly via `account.organization_users`). The recipient list is recomputed per event, so they'll get the next payment-received email without any redeploy.

> **"Can we turn this off for a specific booking?"**
> Not currently — the rule is "every confirmed payment notifies every booking manager". If you need per-booking opt-out, this is the table to add a column to.

## Reference

- **Trigger migration:** `silkskyair-api/supabase/migrations/*_trg_booking_events_webhook.sql`
- **Workflow:** `silkskyair-workflows/workflows/bookings/bookings-event.json` (Switch + `prepare-manager-email-data` Code node)
- **Sub-workflow:** `silkskyair-workflows/workflows/notifications/booking-manager-email.json` (recipient lookup, template fetch, SMTP send)
- **Template:** `email_templates` row `slug = 'booking-paid-manager'`, with EN/TH/RU rows in `email_templates_i18n`
- **Role lookup:** `public.get_users_with_role(p_role_id text)` RPC
- **E2E:** `silkskyair-partner/e2e/partner-payment-staff-email.spec.ts` — inserts a `BookingConfirmed` event, polls the n8n executions API, asserts the slug routes to `booking-paid-manager` and `call-booking-manager-email` reports success with at least one recipient
