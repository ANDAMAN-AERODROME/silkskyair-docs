---
title: "4. Customer Notes — End-to-End (WebSite ↔ BackOffice)"
app: "WebSite + BackOffice"
who: "Support agents, operations staff handling guest requests"
what: "Customers can leave a note at checkout (allergies, special occasion, pickup instructions). The note rides through to BackOffice, where staff see it in the booking's Notes timeline. SSA-619 D5 gates the edit affordance so a customer's note cannot be silently overwritten by staff — it is read-only."
slug: customer-notes
ssa: SSA-619
---

# 4. Customer Notes — End-to-End (WebSite ↔ BackOffice)

> **Apps:** WebSite (capture) → BackOffice / Manager (read — and protect)
> **Who uses it:** Customers (capture); support and operations staff (read).
> **What it does:** Customers can leave a note at checkout. The note rides through to BackOffice, where staff see it in the booking's Notes timeline. Per SSA-619 D5, the customer's note is **read-only** in Manager — staff cannot edit it. To add context, staff create a new note instead.

## Before you start

- **WebSite staging:** `https://staging.www.silkskyair.com`
- **BackOffice staging:** `https://staging.manager.silkskyair.com`
- **Account:** `peter@andaman.co.th` for the BackOffice half. No account needed for the WebSite half (guest checkout).
- **Prerequisites:** none — this walkthrough creates the booking.

---

## Part A — Customer adds a note (WebSite)

### Step 1 — Reach the Contact Info step

Run through the booking flow on staging until the widget reaches the **Contact Info** step (after picking date + pax, before payment).

![Part A, Step 1 — Contact step with notes field](./screenshots/customer-notes/www-01-contact-step.png)

**What you should see:** Email field, plus a **Note** textarea (`[data-contact-note]`) with a 500-character limit.

### Step 2 — Type a note

Enter a short note. For training purposes, use something recognisable like *"Birthday — please bring a small cake"*.

![Part A, Step 2 — Note typed](./screenshots/customer-notes/www-02-note-typed.png)

**What you should see:** The textarea echoes the text. The note is included in the data submitted on the next step.

### Step 3 — Complete payment

Continue through the standard payment flow with the test card (see [page 2 — payment flow](02-www-bookings-payment-flow.md)).

![Part A, Step 3 — Confirmed step](./screenshots/customer-notes/www-03-confirmed.png)

**What you should see:** The confirmed step with a booking reference code. The note has been saved against the booking record (visible from BackOffice in Part B).

---

## Part B — Staff sees the read-only customer note (BackOffice)

### Step 4 — Sign in and open the booking

Sign in to BackOffice and navigate to **Bookings**. Open the booking you just created (top of the list, sorted by created time, or paste the reference from Part A into the URL: `/bookings/<id>`).

![Part B, Step 4 — Booking detail with customer note](./screenshots/customer-notes/manager-04-booking-with-customer-note.png)

**What you should see:** The booking detail page. The **Notes** timeline shows the customer's note as a row with the cursor-default style and the hover title *"Customer-submitted notes are read-only"*.

### Step 5 — Hover the customer note row

Hover the customer-submitted note row.

![Part B, Step 5 — Hover shows read-only tooltip](./screenshots/customer-notes/manager-05-hover-read-only.png)

**What you should see:** The cursor remains a regular pointer (not a clickable hand). The hover tooltip says *"Customer-submitted notes are read-only"*. Clicking the row does **nothing** — it does not open an editor. This is the SSA-619 D5 gate: a safety net that prevents staff from accidentally overwriting the customer's words.

### Step 6 — Add a manager-authored follow-up note

If you need to record context related to the customer's note (e.g. *"Confirmed cake delivery with vendor"*), create a new note. Manager-authored notes show a pointer cursor on hover and open an editor on click.

![Part B, Step 6 — New manager note](./screenshots/customer-notes/manager-06-new-manager-note.png)

**What you should see:** A new row in the timeline marked with your name as the author. This note **is** editable later by clicking it.

## Tips & common questions

- **Why can't I edit the customer's note?** By design (SSA-619 D5). The customer typed those words; staff should not silently overwrite them. If the customer asks you to update their note, type a follow-up note that quotes their original — the audit trail remains intact.
- **How do I tell a customer note apart from a staff note in the timeline?** Customer notes have a fixed cursor and the read-only tooltip; staff notes have a pointer cursor and open an editor on click. In the underlying DOM they carry `data-customer-note="true"` and `aria-disabled="true"`.
- **Where do customers see their note?** It's saved on the booking and included in the confirmation email. They do not (yet) see it on the public booking-details page.
- **Is the note PII?** Treat it as PII. Don't paste customer notes into Slack or screenshots outside this manual.
