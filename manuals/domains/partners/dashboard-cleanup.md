---
title: "Partner Home Dashboard (Partner Portal)"
---

# Partner Home Dashboard (Partner Portal)

> **App:** Partner Portal
> **Who uses it:** Partner staff who land on the portal home page after signing in.
> **What it does:** The home dashboard now leads with the two things partner staff act on every day — the tours they can sell and their latest bookings. The old Commission Rate card and Performance Overview chart have been removed, and the Agreement widget has been replaced by an Available Tours widget.

## Before you start

- **Local URL:** `http://localhost:3050/home` (staging / production: the same path on `staging.partner.silkskyair.com` / `partner.silkskyair.com`).
- **Account:** Sign in with a Partner Portal account associated with a partner organization (e.g. `peter@andaman.co.th` for Advance Aviation on local).
- **Optional:** at least one published tour assigned to your partner org and one recent booking, so both widgets render with data instead of their empty states.

## Step-by-step

### Step 1 — Open the home dashboard

Sign in. The portal lands on `/home` by default.

![Step 1 — Partner home dashboard](/screenshots/partners/dashboard-cleanup/01-dashboard.png)

**What you should see:** the page title and subtitle at the top, then a two-column layout: **Available Tours** on the left and **Latest Bookings** on the right. There is **no** Commission Rate card and **no** Performance Overview chart anywhere on the page.

### Step 2 — Available Tours (left column)

The left widget lists the tours your organization can sell right now.

![Step 2 — Available Tours widget](/screenshots/partners/dashboard-cleanup/02-available-tours-widget.png)

**What you should see:** a card titled with the tours heading, listing each available tour with its key details. This replaces the old Agreement widget that used to sit here. If your org has no published tours assigned, the widget shows its empty state instead of rows.

### Step 3 — Latest Bookings (right column)

The right widget surfaces your most recent bookings so staff can jump straight into one.

![Step 3 — Latest Bookings widget](/screenshots/partners/dashboard-cleanup/03-latest-bookings-widget.png)

**What you should see:** a card listing the most recent bookings for your organization, each row linking through to its booking detail page. With no bookings yet, the widget shows its empty state.

## Tips & common questions

- **Where did the Commission Rate card go?** It was removed in W23 (F1.5, marked `R5-DISABLED-2026-05` in the code). Commission is now shown where it's actionable — inside each booking's payment breakdown. See [Commission & Payment Breakdown](commission-breakdown.md).
- **Where did the Performance Overview chart go?** Also removed in F1.5. The dashboard no longer fetches performance metrics on load, which makes the home page faster and focuses it on day-to-day actions.
- **The Available Tours widget is empty.** Your organization has no published tours assigned. Tours are assigned to partners in the BackOffice; once a tour is live and linked to your org it appears here.
- **Can I still see my commission rate?** Yes — open any booking with commission and expand the payment breakdown. The rate is applied there per booking.

## Reference

- **Code:** [silkskyair-partner/app/home/page.tsx](https://github.com/) — two-column grid (`data-home-grid`), `<AvailableToursWidget>` (left) + `<LatestBookingsWidget>` (right). The `ReportingWidget` (Commission Rate + Performance Overview) and its `fetchPerformance` loader were removed; disabled blocks are tagged `R5-DISABLED-2026-05`.
- **Shipped:** W23 — partner commit `1e30ee9` (F1.5).
