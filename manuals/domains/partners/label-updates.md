---
title: "Partner Portal Label & Terminology Updates (W23)"
---

# Partner Portal Label & Terminology Updates (W23)

> **App:** Partner Portal (+ a mirrored rename in BackOffice)
> **Who uses it:** Everyone — these are user-visible wording changes only.
> **What it does:** Bundles the string-only relabels shipped in W23 from the Partnership Portal review (Round 3). No behavior changed — only the words on screen. This page is the single reference for "what got renamed and where," so it doesn't need a full step-by-step manual.

## Before you start

- **Local URL:** `http://localhost:3050` (Partner Portal). The one BackOffice rename is at `http://localhost:3000`.
- **Account:** any Partner Portal account works for verification (e.g. `peter@andaman.co.th` on local).
- **How to verify:** these are i18n / JSX string changes. Open each surface listed below and confirm the new wording renders — no functional testing needed.

## What changed

| Where | Before | After | Why |
|---|---|---|---|
| Sidebar nav item (Partner) | Members | **Clients** | "Clients" is the customer-facing term partners use (R4). |
| Clients page title | Members | **Clients** | Matches the sidebar rename (R4). |
| Clients page subtitle | — | **Manage your registered clients** | Fills an empty subtitle (R4). |
| Clients "create" action | Add Member | **Add Client** | Consistent client terminology (R4). |
| BackOffice sidebar + Members page chrome | Members / All Members | **Clients / All Clients** | Mirrors the partner-side rename so both apps agree (R4-T6). URL stays `/members`. |
| Team → invite button | Invite Member | **Invite Team** | The button invites staff to your org, not clients (R7). |
| Team → archived status | *(raw key leaked)* | **Archived** | New i18n key — the status label was rendering its raw key before (R8). |
| Booking create → step 4 | *(duplicate of step 5)* | **Shared/Private Flight** | Step 4's label was a copy of step 5's; gives the step its own name (R9). |
| Booking create → confirm CTA | Confirm Booking | **Submit Booking** | Clearer that this submits the booking for processing (R10). |
| Payment → direct option | Direct Payment | **Full Payment** | Plain-language label for "partner collects the full amount" (R13). |
| Payment → indirect option | Indirect Payment | **Net Payment (after deducting commission)** | Spells out what "net" means for the partner (R14). |
| Any role chip (Team, drawers, Create-Account) | Organization_manager | **Organization Manager** | Role slugs are now humanised via a shared formatter (R3 — F1.3). |

## Step-by-step (spot checks)

### Spot check 1 — "Clients" in the sidebar

Open the Partner Portal. The sidebar item that used to read **Members** now reads **Clients**, and the page it opens is titled **Clients** with an **+ Add Client** button.

![Spot check 1 — Clients in the sidebar](/screenshots/partners/label-updates/01-sidebar-clients.png)

**What you should see:** sidebar **Clients**, page title **Clients**, subtitle "Manage your registered clients," and an **+ Add Client** button.

### Spot check 2 — Full Payment / Net Payment

Open an unpaid booking with commission and look at the Payment section.

![Spot check 2 — Full Payment / Net Payment labels](/screenshots/partners/label-updates/02-payment-full-net.png)

**What you should see:** the two payment options now read **Full Payment** and **Net Payment (after deducting commission)** (formerly "Direct Payment" / "Indirect Payment").

### Spot check 3 — Humanised role chip

Open the Team page (or a team-member drawer) and look at a role chip.

![Spot check 3 — Humanised role chip](/screenshots/partners/label-updates/03-role-chip.png)

**What you should see:** a role like `organization_manager` rendered as **Organization Manager** — title-cased with spaces — instead of the old `Organization_manager`.

## Tips & common questions

- **Did any behavior change?** No. Every item here is a wording change. URLs, routes, and logic are unchanged — in particular the Clients page is still served from `/members`.
- **Why is the role formatter its own thing?** Each surface used to have its own tiny role-label helper that fell back to a naive first-letter-uppercase, leaking `Organization_manager`. A single shared `formatRoleLabel` now prefers the i18n translation and otherwise title-cases the slug, so the chip never reads `organization_manager` again. The Account Portal's Create-Account page ships its own copy of the same helper.
- **Where are the strings stored?** The Partner Portal strings are DB-backed i18n, landed in one migration (`silkskyair-api` `20260527130000_review_rename_keys.sql`, all of en/th/ru). The BackOffice Members→Clients rename is hard-coded JSX (the Manager UI isn't i18n-driven).
- **RU translations.** The migration used `ON CONFLICT DO UPDATE`, renaming existing rows in place and inserting the Russian locale where it was previously empty for these keys.

## Reference

- **i18n batch:** silkskyair-api commit `202b619` — `20260527130000_review_rename_keys.sql` (R4/R7/R8/R9/R10/R13/R14, 27 rows × en/th/ru).
- **BackOffice rename:** silkskyair-manager commit `042c7b2` — `lib/modules/registry.ts` + `members-manager.tsx` (R4-T6).
- **Role formatter:** [silkskyair-partner/lib/auth/roles.ts](https://github.com/) — `formatRoleLabel(role, i18n)` (partner commit `1ea63f6`, R3 / F1.3).
- **Shipped:** W23 — covers F1.3, F1.4, F1.7, F1.9, F1.11 plus review items R8 and R10.
