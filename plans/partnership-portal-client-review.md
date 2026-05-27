# Partnership Portal — Client Review (Round 3) Remediation Plan

> **Source review:** `Partnership Portal Review (Third Review)` PDF, prepared 29/04/2026 by Micheline, Panpaporn, Nuchada; reviewed 08/05/2026 by Asaf.
> **Plan authored:** 2026-05-12 / 2026-05-13.
> **Working branch (all repos):** `claude/plan-client-review-YNHfY`.
>
> **How to use this document:**
> - Treat the **Access Prerequisites** section as a hard gate. The non-blocked work (R1, R4, R5, R7-R16, R19, R20-in-app, R21 partner-side, R22) can proceed against the four already-reachable repos. The access-gated work (R3, R2, R17/R18 env, R20-email, R21-T5) requires repo / config grants before it can be planned to file:line precision.
> - The **Final Plan** section gives the concrete file:line edits and the batch ordering. Use the **Critical files** consolidation as a checklist when implementing.
> - The **Discoveries** and **Decisions log** sections are kept for traceability — every claim in the Final Plan ties back to a discovery or a decision recorded there.
> - Repo names use the `andaman-aerodrome/` prefix; the four already-reachable repos are `silkskyair-orchestrator`, `silkskyair-api`, `silkskyair-manager`, `silkskyair-partner`. Three further repos (`silkskyair-account`, `silkskyair-member`, `silkskyair-workflows`) and the `silkskyair-partner` Vercel project are required to complete this plan — see Access Prerequisites.

---

## Context

The client (Silk Sky Air) ran a third pre-launch review against the Partnership Portal (`https://partner.silkskyair.com`) and the Back Office that creates/manages partners. The review yields a mix of:

- **Bugs** (data loss on partner create, FK violation on passenger nationality edit, broken commission math for indirect payment, payment-by-card disabled, missing back-office notification on cancellation, missing email-verification popup, missing untranslated i18n strings)
- **Terminology/UX changes** (Members → Clients globally; Direct → Full / Indirect → Net; “Confirm Booking” → “Submit Booking”; “Invite Member” → “Invite Team”; “organization_manager” → “Manager”; stage label fix)
- **Layout / scope reductions** (temporarily remove Commission Rate & Performance Overview cards; reshape dashboard to Latest Bookings + Available Tours)
- **Small features** (archive clients)

All of this must be remediated on a single shared branch per repo (`claude/plan-client-review-YNHfY`) across four repositories:

- `andaman-aerodrome/silkskyair-orchestrator`
- `andaman-aerodrome/silkskyair-api`
- `andaman-aerodrome/silkskyair-manager` (Back Office)
- `andaman-aerodrome/silkskyair-partner` (Partner Portal)

**Access check (corrected 2026-05-13):** four of the repos involved in this remediation are reachable via the GitHub MCP server. **Several review items target code that lives in repos / configs we do NOT have access to.** Tasks owned by those code paths cannot be planned with file:line confidence and are blocked until access is granted. See **Access Prerequisites** below.

---

## Access Prerequisites (BLOCKER — must be resolved before this plan can be finalized)

A plan without access to the code it changes is speculation, not a plan. The following access grants are prerequisites for promoting the affected tasks from 🔴 to 🟢:

| Resource | Type | Tasks blocked | Why we need it |
|---|---|---|---|
| `andaman-aerodrome/silkskyair-account` | GitHub repo | **R3** | The "organization_manager" role chip the reviewer photographed is rendered on the Create-Account page hosted at `NEXT_PUBLIC_ACCOUNT_URL`. The four reachable repos contain only secondary copies of `getRoleLabel`; the reviewer-visible chip is in this repo. Without access we cannot identify the JSX or write a file:line fix. |
| `andaman-aerodrome/silkskyair-workflows` | GitHub repo | **R2**, **R20 email** | Supabase Auth email is disabled (`silkskyair-api/supabase/config.toml`). R2's invitation "From" identity lives in the n8n `/invitations/send-email` workflow. R20's email fan-out requires a new `/notifications/cancellation-email` workflow. Without access to the workflow JSON we cannot specify which node to edit, what the current From string is, or how recipient queries are constructed. |
| `andaman-aerodrome/silkskyair-member` | GitHub repo | **R21 (verification page)**, possibly **R12** | Referenced in `silkskyair-orchestrator/CLAUDE.md`. The customer-facing `/verify?token=...&bookingId=...` page (per `N8N_WORKFLOW_DEPENDENCY_MATRIX.md:102`) lives in this repo. We may need to extend or read it to design R21's partner-side popup correctly (token format, response shape). |
| Vercel project for `silkskyair-partner` (and `silkskyair-manager`) | Deployment config | **R17**, **R18** | `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` must be provisioned at runtime in Vercel. Code path is verified (`silkskyair-partner/lib/integrations/omise.ts:7-10`, `app/api/bookings/[id]/payments/intent/route.ts:228-233`) but we cannot set or verify the env values themselves without dashboard access. |
| n8n cloud workspace | Runtime config | **R2**, **R20 email** | Even after workflow-repo access, the running instance must be re-imported / re-deployed. |

**Pre-flight tasks (must complete before code work begins):**

- **X0-T1** — Request and confirm read access to `silkskyair-account`. Acceptance: `mcp__github__get_file_contents` returns at least one file from `silkskyair-account` (e.g. `package.json`).
- **X0-T2** — Request and confirm read access to `andaman-aerodrome/silkskyair-workflows` (confirmed name 2026-05-13). Acceptance: at least one workflow JSON file is readable via GitHub MCP.
- **X0-T3** — Request and confirm read access to `silkskyair-member`. Acceptance: `app/verify/page.tsx` (or equivalent) is readable.
- **X0-T4** — Confirm whether `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` are already set in the partner-portal Vercel project (staging + production). Acceptance: client confirms presence, or grants access so we can verify directly.
- **X0-T5** — After X0-T1/T2/T3 land, re-run Phase 2 Explore agents scoped to the newly-reachable repos. Acceptance: file:line evidence for R3 chip, R2 From-identity workflow node, R20 cancellation-email workflow target, R21 verification page contract.

Until X0 completes, the affected tasks below are marked 🔴 **blocked-on-access** and only carry intent-level descriptions, not implementation steps. The implementable surface of this plan is **R1, R4, R5, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R19, R20 (in-app half), R21 (partner-side popup only — pending X0-T3 for the verify page contract), R22.**

---

## How this plan is structured

Each item in the review is decomposed into **atomic tasks**. Every task obeys these rules so it maps 1:1 to a Notion ticket:

1. **One touchpoint** — exactly one user-visible behavior or one code surface (a single page, a single button, a single calculation, a single migration, etc.). Bundled review items are split.
2. **Independently verifiable** — has a single, concrete acceptance test the reviewer can run.
3. **Single impact statement** — the user-visible change is describable in one sentence.
4. **Repository-scoped** — each task is owned by exactly one repo. Cross-repo work is split into separate paired tasks (e.g. `…-api` + `…-partner`).
5. **Confidence-gated** — tasks marked `🟡 needs investigation` cannot leave planning. We resolve uncertainty in Phase 2 before promoting them to `🟢 ready`.

For each task we record:
- **ID** (Rxx-T# = review item Rxx, sub-task #)
- **Title**
- **Repo / touchpoint** (one place)
- **What changes** (one sentence)
- **Why** (the review quote)
- **Acceptance test** (one verifiable check)
- **Confidence** (🟢 ready / 🟡 needs investigation / 🔴 blocked-on-decision)
- **Open questions** (if any)

---

## Review items as extracted from PDF (verbatim mapping)

| # | Page | Section | Review quote / observation |
|---|---|---|---|
| R1 | 2 | Creating a Partner (Back Office > Partners) | “After entering partner details and clicking save, the fields show up empty and data must be re-entered.” |
| R2 | 3 | Adding a User (Partner Portal) | “Is it possible to change the sender name from ‘system’ to ‘Silk Sky Partner Portal’ or just show the full email address (system@silkskyair.com)?” |
| R3 | 3 | Adding a User (Partner Portal) | “‘organization_manager’ to be replaced with ‘Manager’.” (on CREATE YOUR ACCOUNT page) |
| R4 | 4 | Dashboard (terminology) | “TERMINOLOGY CHANGE THROUGHOUT ALL SYSTEMS: Change ‘Members’ to ‘Clients’.” |
| R5 | 4 | Dashboard | “IMPORTANT: Temporarily remove ‘Performance Overview + Commission Rate’ to avoid confusion about commission expectation.” |
| R6 | 5 | Dashboard | Preferred layout: Latest Bookings + Available Tours. (Implies an `Available Tours` widget.) |
| R7 | 6 | Team Management | “Request to change to ‘+ Invite Team’.” (currently `+ Invite Member`) |
| R8 | 6 | Team member edit drawer | Untranslated i18n keys visible on screen: `team.status.archived` and `actions.save`. |
| R9 | 7 | Bookings: Creating a Booking | “Duplicate stage title — 4) Shared/Private Flight, 5) Review & Confirm.” (stage 4 currently mislabeled as ‘Review & Confirm’.) |
| R10 | 7 | Bookings: Creating a Booking | “Request to change to ‘Submit Booking’.” (currently `Confirm Booking`) |
| R11 | 7 | Bookings: Creating a Booking | Untranslated i18n key visible on Sharing Settings step: `create.finalPriceNote`. |
| R12 | 8 | Bookings: Editing Passenger Data | “The passenger’s nationality and weight cannot be edit/save.” — FK violation: `member_profile_nationality_fkey`. |
| R13 | 9 | Bookings: Commission | Rename: Direct → **Full Payment**. |
| R14 | 9 | Bookings: Commission | Rename: Indirect → **Net Payment (after deducting commission)**. |
| R15 | 9 | Bookings: Commission | “REMOVE row” — Withholding Tax (3%) row in *Indirect/Net Payment* breakdown. |
| R16 | 9 | Bookings: Commission | “Error in calculation for Indirect Payment. Net to partner does not need to have 3% WHT deducted.” Expected: Net to Partner = 2,616.82 (commission, no WHT); Net to Operator = 28,000 − 2,616.82 = 25,383.18. |
| R17 | 10-11 | Bookings: Payment | “DIRECT PAYMENT — Cannot pay with card.” (Pay with Card button disabled.) |
| R18 | 10-11 | Bookings: Payment | “INDIRECT PAYMENT — Cannot pay with card.” (Pay with Card button disabled.) |
| R19 | 10 | Bookings: Payment | (Implicit, **needs clarification**) Indirect Payment dialog appears to lack the TOTAL AMOUNT box shown on Direct Payment. |
| R20 | 12 | Bookings: Cancellation | “When Partner requests cancellation, no notification/email is given in the back office. Event is registered in the booking though.” |
| R21 | 13 | Minor Issues | “No verified email symbol — encountered an issue at that moment because there was no pop-up page appearing to allow me to enter and add the verify code.” |
| R22 | 13 | Minor Issues | “Add possibility to archive clients.” (currently no remove/archive control on Members list) |

---

## Atomic task breakdown

Confidence legend: 🟢 ready · 🟡 needs investigation · 🔴 blocked on decision

### R1 — Back Office partner-create form clears fields after save

- **R1-T1** — Fix partner create form so fields persist after successful save
  - Repo / touchpoint: `silkskyair-manager` → Back Office > Partners > Create form (single page)
  - What changes: After clicking Save, the saved partner data must remain in the form (or the form is replaced by the partner detail view), instead of resetting to empty fields with the new partner gone.
  - Acceptance test: Create a partner with Name, Slug, Website, Email, Phone, Address, Latitude, Longitude, Commission %, Status; click Save; the form/detail view shows the same values without re-entry, and a re-fetch of the partner via the API returns those values.
  - Confidence: 🟡 — need to locate the create form and confirm whether the bug is (a) form reset on success, (b) success handler ignoring server response, or (c) server returning empty payload.
  - Open questions: Is the “empty fields after save” a UI reset or a failed save that looks successful?

### R2 — Invitation email sender identity

- **R2-T1** — Change invitation email sender display name to “Silk Sky Partner Portal”
  - Repo / touchpoint: `silkskyair-orchestrator` (or `silkskyair-api`, TBD) → invitation email send call (single send site)
  - What changes: The “From” header on the partner-user invitation email displays as `Silk Sky Partner Portal <system@silkskyair.com>` instead of just `system`.
  - Acceptance test: Trigger a new invitation; the received email in Gmail shows the sender as “Silk Sky Partner Portal”, not “system”.
  - Confidence: 🟡 — must locate the email-sending site (orchestrator vs api vs an edge function) and the transport (SMTP/Postmark/Resend/etc.) to know whether this is a `from` field change or DNS/identity config.
  - Open questions: Which transport and which env var/config owns the From identity?

### R3 — Replace “organization_manager” with “Manager” on Create Account page

- **R3-T1** — Map raw role string to a human-readable label on the signup page
  - Repo / touchpoint: `silkskyair-partner` → Create Your Account page (single component, single label)
  - What changes: The role chip on the Create Account screen renders “Manager” instead of `organization_manager`.
  - Acceptance test: Open an invitation link for a manager role; the role chip on `/auth/...` (create-account) reads “Manager”.
  - Confidence: 🟡 — confirm the page lives in `silkskyair-partner` (vs `silkskyair-api` if that page is auth-server-rendered) and whether other role values (`member`, `support`) also need a mapping for consistency.
  - Open questions: Should we map all roles (Member / Support / Manager) via one helper, or only this one?

### R4 — Global terminology change: Members → Clients

This is split into one task **per touchpoint** so each is independently testable.

- **R4-T1** — Rename “Members” to “Clients” in Partner Portal sidebar nav
  - Repo / touchpoint: `silkskyair-partner` → sidebar navigation item
  - Acceptance test: Sidebar shows “Clients” where it used to show “Members”.
  - Confidence: 🟢 (string change, low risk)

- **R4-T2** — Rename “Members” page heading & subheading in Partner Portal
  - Repo / touchpoint: `silkskyair-partner` → `/members` page header (single page)
  - Acceptance test: Page heading reads “Clients”; subtitle reads “Manage your registered passengers/users” → revise as “Manage your registered clients”. (See open question on subtitle.)
  - Confidence: 🟡 — subtitle wording needs client sign-off.
  - Open questions: Exact wording for the subtitle.

- **R4-T3** — Rename “Add Member” button to “Add Client”
  - Repo / touchpoint: `silkskyair-partner` → top-right button on `/members`
  - Confidence: 🟢

- **R4-T4** — Update i18n strings + route segment for Members → Clients (Partner Portal)
  - Repo / touchpoint: `silkskyair-partner` → i18n dictionaries (single file or set of locale files)
  - What changes: Replace user-visible strings. (Code-level identifiers like `members` table/route remain unchanged unless explicitly approved — see R4-T5.)
  - Acceptance test: All EN/TH (and other) locale files use “Clients/ลูกค้า”.
  - Confidence: 🟡 — need to confirm locale list and whether translations are needed in non-EN locales.

- **R4-T5** — (Optional / decision) Rename `/members` route to `/clients` with redirect
  - Repo / touchpoint: `silkskyair-partner` → app router segment
  - Confidence: 🔴 — blocked: client must confirm whether the URL itself should change. Default: do **not** rename URL/route in Phase 1.

- **R4-T6** — Rename “Members” section in Back Office, if any
  - Repo / touchpoint: `silkskyair-manager` → wherever “Members” appears
  - Confidence: 🟡 — need to confirm whether the Back Office surfaces a “Members” concept at all.

### R5 — Temporarily remove Commission Rate + Performance Overview cards

- **R5-T1** — Hide Commission Rate card on Partner Portal dashboard
  - Repo / touchpoint: `silkskyair-partner` → `/dashboard` page (single component)
  - What changes: Card is no longer rendered. Implementation should be a guard (e.g. behind a feature flag or simply removed JSX) so it can be brought back later.
  - Acceptance test: Dashboard does not render the Commission Rate card.
  - Confidence: 🟡 — confirm whether to feature-flag or hard-remove. Default: hard-remove with code comment referencing the review.

- **R5-T2** — Hide Performance Overview card on Partner Portal dashboard
  - Repo / touchpoint: `silkskyair-partner` → `/dashboard` page
  - Acceptance test: Dashboard does not render the Performance Overview card.
  - Confidence: 🟡 — same as R5-T1.

### R6 — Add Available Tours widget to dashboard (preferred layout)

- **R6-T1** — Add “Available Tours” widget on Partner Portal dashboard
  - Repo / touchpoint: `silkskyair-partner` → `/dashboard` page (one new widget)
  - What changes: Renders a new “Available Tours” section next to Latest Bookings, listing the partner’s purchasable tours.
  - Acceptance test: Dashboard shows Latest Bookings on the left and Available Tours on the right; clicking a tour starts a new booking.
  - Confidence: 🔴 — blocked on spec: data source (which tours? all active / partner-allowed / featured?), card content (image, price, CTA), pagination/limit, empty state.
  - Open questions: see above; also is `/tours` already an endpoint in `silkskyair-api`?

### R7 — “+ Invite Member” → “+ Invite Team” on Team Management

- **R7-T1** — Rename Team Management invite button
  - Repo / touchpoint: `silkskyair-partner` → Team page (single button label)
  - Acceptance test: On the Team page, the top-right button reads “+ Invite Team”.
  - Confidence: 🟢

### R8 — Visible untranslated i18n keys

- **R8-T1** — Add missing translation for `team.status.archived`
  - Repo / touchpoint: `silkskyair-partner` → i18n locale file (single key)
  - Acceptance test: The status badge in the Team member edit drawer renders “Archived” instead of `team.status.archived`.
  - Confidence: 🟢 (after exact key path is confirmed)

- **R8-T2** — Add missing translation for `actions.save`
  - Repo / touchpoint: `silkskyair-partner` → i18n locale file (single key)
  - Acceptance test: The Save button in the Team member edit drawer reads “Save”.
  - Confidence: 🟢

- **R8-T3** — Add missing translation for `create.finalPriceNote`
  - Repo / touchpoint: `silkskyair-partner` → i18n locale file (single key)
  - Acceptance test: Sharing Settings step in Create Booking shows the actual sentence rather than the raw key.
  - Confidence: 🟡 — need to know the *intended copy* for this note.
  - Open questions: What should the final-price note say?

> **Audit task (cross-cutting):**
> - **R8-T4** — Sweep i18n dictionaries for any other missing keys referenced from JSX
>   - Repo / touchpoint: `silkskyair-partner` → i18n keys vs source code (single audit pass)
>   - Acceptance test: No raw `*.*.*` style string ever renders in the UI for the full happy-path walkthrough (sign-in → dashboard → bookings → create booking → team).
>   - Confidence: 🟡 — scope of audit needs framing.

### R9 — Fix duplicate stage title in Create Booking stepper

- **R9-T1** — Stage 4 label should read “Shared/Private Flight”
  - Repo / touchpoint: `silkskyair-partner` → Create Booking stepper component (single label)
  - Acceptance test: Stepper reads `1) Select Tour · 2) Select Date & Time · 3) Contact & Passengers · 4) Shared/Private Flight · 5) Review & Confirm`.
  - Confidence: 🟢

### R10 — “Confirm Booking” → “Submit Booking”

- **R10-T1** — Rename the final-step CTA on Create Booking
  - Repo / touchpoint: `silkskyair-partner` → final step button (single CTA)
  - Acceptance test: Step 5 CTA reads “Submit Booking”.
  - Confidence: 🟢

### R12 — Passenger nationality & weight save fails with FK violation

- **R12-T1** — Investigate FK constraint `member_profile_nationality_fkey` and confirm the nationality lookup table contents
  - Repo / touchpoint: `silkskyair-api` → DB schema (single migration)
  - Goal: confirm whether the UI sends an FK key that does not exist in the lookup table, or whether the FK should be relaxed/`null`-able.
  - Confidence: 🟡 — strictly investigation; not yet a code change.

- **R12-T2** — Make passenger nationality field send a valid FK value (or null) from the Partner Portal passenger edit form
  - Repo / touchpoint: `silkskyair-partner` → passenger edit drawer (single field control)
  - Acceptance test: Editing Pondering Winkk’s nationality to Thai (THA) saves successfully and persists after refresh; saving with no nationality also succeeds.
  - Confidence: 🟡 — depends on R12-T1.

- **R12-T3** — Validate that passenger weight saves correctly
  - Repo / touchpoint: `silkskyair-partner` → passenger edit drawer weight field
  - Acceptance test: Editing weight to 50 kg saves successfully.
  - Confidence: 🟡 — confirm whether weight error is the same FK issue or a separate validation problem.
  - Open questions: Is weight in kg, lb, or a numeric type with a server-side check?

### R13 — Rename “Direct Payment” → “Full Payment”

- **R13-T1** — Rename Direct payment label across the Bookings payment surfaces
  - Repo / touchpoint: `silkskyair-partner` → payment headings, payment button, breakdown header (single string surface — bundle as one label change because they all reference one i18n key)
  - Acceptance test: Bookings detail page shows “Full Payment” everywhere it previously said “Direct Payment”.
  - Confidence: 🟡 — confirm there is a single i18n key (so this stays one touchpoint). If multiple ad-hoc strings exist, split into separate tasks.

### R14 — Rename “Indirect Payment” → “Net Payment”

- **R14-T1** — Rename Indirect payment label across the Bookings payment surfaces
  - Repo / touchpoint: `silkskyair-partner` → same component family as R13
  - Acceptance test: Bookings detail shows “Net Payment” everywhere it previously said “Indirect Payment”.
  - Confidence: 🟡 — same shape as R13.

### R15 — Remove WHT (3%) row from Indirect/Net Payment breakdown

- **R15-T1** — Hide the Withholding Tax (3%) row when payment type = Indirect/Net
  - Repo / touchpoint: `silkskyair-partner` → commission breakdown panel (single conditional row)
  - Acceptance test: Indirect/Net payment breakdown lists: Total Amount, VAT on Service (7%), Service excl. VAT, Commission (10%), Net to Partner, Net to Operator. No Withholding Tax row.
  - Confidence: 🟡 — confirm where the breakdown is computed (UI vs API) and that WHT must still appear for the Direct/Full case.

### R16 — Fix Indirect/Net Payment math

- **R16-T1** — Fix `Net to Partner` for Indirect/Net to equal the commission with no WHT deduction
  - Repo / touchpoint: ⚠️ **one of**: `silkskyair-api` (commission calculator) **or** `silkskyair-partner` (UI-side computation). To be confirmed in Phase 2.
  - Acceptance test: For a 28,000 THB booking at 10% commission, indirect breakdown shows Net to Partner = 2,616.82 THB; Net to Operator = 25,383.18 THB.
  - Confidence: 🟡 — where the math lives is the open question.

### R17 — Direct/Full payment: enable “Pay with Card”

- **R17-T1** — Make the Pay with Card button functional for Direct/Full payment
  - Repo / touchpoint: `silkskyair-partner` → Direct payment dialog (single CTA) and its handler
  - Acceptance test: With a valid Stripe (or active PSP) test card, the user can complete a card payment for Direct/Full type and the booking moves to Paid.
  - Confidence: 🔴 — blocked: need to confirm which PSP is integrated, whether keys are present in env, and whether the button is disabled because of missing handler vs missing keys vs intentional.
  - Open questions: Which PSP? Are keys configured?

### R18 — Indirect/Net payment: enable “Pay with Card”

- **R18-T1** — Make the Pay with Card button functional for Indirect/Net payment
  - Repo / touchpoint: `silkskyair-partner` → Indirect payment dialog
  - Acceptance test: Card payment for Indirect/Net type completes successfully.
  - Confidence: 🔴 — same PSP question as R17. Also raises a business question: is card payment **supposed** to be allowed in indirect mode (partner pays operator commission only)? May be intentionally disabled.
  - Open questions: Is card payment in indirect mode a real product requirement, or should the button be removed instead?

### R19 — Indirect Payment dialog missing TOTAL AMOUNT box (assumed)

- **R19-T1** — Confirm with client whether the Indirect Payment dialog should show the TOTAL AMOUNT box
  - Repo / touchpoint: n/a (decision)
  - Confidence: 🔴 — blocked on client clarification; if confirmed, this becomes a single UI change in `silkskyair-partner`.

### R20 — Notify back office when partner requests cancellation

- **R20-T1** — Send an in-app/email notification to back office on partner-initiated cancellation request
  - Repo / touchpoint: ⚠️ likely `silkskyair-orchestrator` (event listener / cron / webhook) or `silkskyair-api` (DB trigger / edge function). To be confirmed.
  - Acceptance test: Partner clicks “Request cancellation” on a booking; within ~1 min, back-office users receive an email and/or in-app notification with the booking reference and cancellation reason. The existing event-history record continues to be written.
  - Confidence: 🔴 — blocked on: notification channel (email / in-app / both?), recipients (which back-office role? all managers?), template content.
  - Open questions: channel, recipients, template.

### R21 — Email verification popup missing during booking flow

- **R21-T1** — Show the email-verification code entry popup after the partner requests booking-time verification
  - Repo / touchpoint: `silkskyair-partner` → booking flow (Contact & Passengers step or Submit) — single dialog component
  - What changes: When the system sends the verification code, a modal/inline input must appear so the user can paste the code.
  - Acceptance test: Booking a tour using a personal email triggers a code email; a popup appears on the booking page where the code can be entered and verified; flow continues only after correct code.
  - Confidence: 🔴 — blocked on understanding the existing verification flow (where the code is sent, who validates it, whether the popup component was scoped but not wired, or never built at all).
  - Open questions: Is the verification code logic already on the API side? Is there a half-wired component?

### R22 — Archive clients (members) feature

- **R22-T1** — Add a server-side “archive client” mutation
  - Repo / touchpoint: `silkskyair-api` → members endpoint (single new mutation / column flip)
  - Acceptance test: Calling the archive mutation on a member sets a soft-delete/archived state and the member is excluded from default lists but recoverable.
  - Confidence: 🟡 — need to confirm whether a column exists (`archived_at` / `status` enum) or a new migration is required.

- **R22-T2** — Add an “Archive” action on the Partner Portal Clients (Members) list / detail
  - Repo / touchpoint: `silkskyair-partner` → Clients list row action (single new menu item / button)
  - Acceptance test: From the Clients list, the user can archive a client; the client disappears from the default list; a filter toggle reveals archived clients.
  - Confidence: 🟡 — depends on R22-T1 and on UX for showing/unarchiving.

---

## Open questions to resolve before leaving planning

These are the items that MUST be answered (by code investigation in Phase 2 or by asking the client) before any task is promoted to 🟢:

1. **R1** — Is partner-create form clearing because of (a) a UI reset, (b) a silent server-side failure, (c) the create succeeds but the redirect/refresh loses state? → Phase 2 code dive.
2. **R2** — Which email transport is used and where is the From identity configured? → Phase 2 code dive in orchestrator + api.
3. **R3** — Should we map all role labels (Member/Support/Manager) at once or only `organization_manager`? → Client.
4. **R4** — Does “throughout all systems” include the Back Office? → Client.
5. **R4-T5** — Should the URL/route also rename to `/clients`? → Client (default: no).
6. **R5** — Hard-remove or hide-behind-flag? → Client (default: hard-remove with comment).
7. **R6** — Available Tours widget data source and content. → Client + Phase 2 dive on tours endpoint.
8. **R8-T3** — Copy for `create.finalPriceNote`. → Client.
9. **R12** — Cause of FK violation: missing rows in the nationality table vs wrong shape of value sent. → Phase 2 DB inspection via Supabase MCP.
10. **R13/R14/R15/R16** — Is commission math computed in `silkskyair-api` or `silkskyair-partner`? Is there a single canonical “payment kind” enum? → Phase 2 code dive.
11. **R17/R18** — Which PSP is integrated, what keys are needed, and is indirect-card-payment actually a product requirement? → Client + Phase 2 dive.
12. **R19** — Should the indirect dialog also show the TOTAL AMOUNT box? → Client.
13. **R20** — Notification channel, recipients, and template for back-office cancellation alert. → Client + Phase 2 dive on existing notification infra.
14. **R21** — Existing state of the booking-time email-verification flow. → Phase 2 code dive.
15. **R22** — Schema for soft-archive (existing column vs new migration) and unarchive UX. → Phase 2 DB dive + Client.

---

## Discoveries (running log)

> Every concrete observation goes here, even small ones, with the file or evidence that supports it.

### Setup
- 2026-05-12 — PDF rendered locally to `/tmp/review_pages/p-01.png … p-13.png` (13 pages). Text extracted to `/tmp/review.txt`.
- 2026-05-12 — Verified read access on all four repos via GitHub MCP (`andaman-aerodrome/silkskyair-{orchestrator,api,manager,partner}`).
- 2026-05-12 — Repo shape:
  - `silkskyair-orchestrator`: top-level `tests`, `scripts`, `prototypes`, `docs`, `plans`, `package.json`, `tsconfig.json`, `vitest.config.ts` — no app/components, looks like an n8n-style workflow / integration hub (presence of `N8N_WORKFLOW_DEPENDENCY_MATRIX.md`).
  - `silkskyair-api`: `supabase/`, `scripts/`, `profiles.toml`, `docs/`, `backups/` — Supabase-backed API. The FK violation in R12 lives here.
  - `silkskyair-manager`: Next.js 15 app (`app/`, `components/`, `lib/`, `services/`, `src/`, `middleware.ts`, `next.config.ts`). Hosts the Back Office (R1 lives here).
  - `silkskyair-partner`: Next.js 15 app (same shape as manager). Hosts the Partner Portal (most tasks live here).

### Partner Portal (`silkskyair-partner`) — Explore agent A findings (2026-05-12)
- The Partner Portal dashboard route is **`/home`** (not `/dashboard`). Composed of three widgets in `app/home/page.tsx`:
  - `components/home/widgets/agreement-widget.tsx` (kept)
  - `components/home/widgets/reporting-widget.tsx` — this is the **PerformanceOverview** card called out in R5.
  - `components/home/widgets/latest-bookings-widget.tsx` (kept)
- **There is no separate `CommissionRate` card** as a discrete component. The "10% Calculated on net price including 7% VAT" panel in the screenshot is either part of `reporting-widget.tsx` or `agreement-widget.tsx` (needs one more byte-level confirmation). **→ R5 may collapse to a single task that removes whichever sub-card holds Commission Rate + Performance Overview.**
- **No `AvailableTours` component and no `/api/tours` hook exist** in the partner repo today. R6 is a brand-new widget and must include its data source.
- Sidebar is `components/home/sidebar.tsx`. Labels come from i18n keys like `sidebar.${mod.id}` (modules in `lib/modules/registry`). The "Members" label is therefore `sidebar.members` — renaming is a **dictionary-level edit**, not a JSX edit.
- Members page: `app/members/page.tsx` uses `members:page.title`, `members:page.subtitle`, `members:actions.create`. No archive affordance currently exists on a member card.
- Team page: `app/team/page.tsx:185` — `i18n("team.invite") || "Invite Member"`. The fallback "Invite Member" is hardcoded in JSX; key is `settings:team.invite`.
- Team-member drawer: `components/team/team-member-drawer.tsx` references `i18n("team.status.archived")` and `i18n("actions.save")` — both **leak as raw keys** because the i18n dictionary is missing these entries.
- Create Booking stepper: `components/bookings/create/create-booking-drawer.tsx:40-44`:
  ```ts
  const STEPS = ["create.step1", "create.step2", "create.step3", "create.step4", "create.step5"] as const;
  ```
  Final CTA at line 341 uses `i18n("create.confirm")`. The duplicate "Review & Confirm" label seen in R9 is because the dictionary's `create.step4` is **missing or wrong** (falls back to render the key or to `create.step5` text — to be confirmed).
- The `create.finalPriceNote` (R11) is referenced at `components/bookings/create/extras-step.tsx:213`.
- Passenger edit: `components/bookings/passenger-card.tsx:64-75` — PATCH to `/api/bookings/{id}/passengers/{id}`. Sends `nationality: form.nationality || null` and `weight_kg: form.weight_kg ? Number(form.weight_kg) : null`. So R12 is **either**: the nationality input is a free-text string that doesn't match any FK value, OR the API layer maps it to a column that has a strict FK to a country/nationality table.
- Bookings payment surfaces: `components/bookings/booking-payment-section.tsx`
  - Direct/Indirect heading labels at lines 189 / 207 use keys `payment.directPayment`, `payment.indirectPayment` — **single touchpoint per rename**, so R13 and R14 collapse to one i18n-key edit each.
  - Breakdown rows (lines 121-149): Total / VAT (`payment.vatOnService`) / Service excl. VAT / Commission / **WHT (`payment.withholdingTax`)** / NetToPartner / NetToOperator. WHT is rendered **unconditionally** when `data.commission > 0`. The conditional logic for R15 needs to be added.
  - Commission math is **client-side** — `lib/bookings/commission.ts:calculateCommission()` (lines 62-70 of booking-payment-section.tsx). **→ R15/R16 fix is local to the partner repo, no API change needed** (unless we want server-side consistency — flag for discussion).
- Payment dialog: `components/bookings/payment-checkout.tsx:258-286`. The "Pay with Card" button is disabled when `paymentMethod === "card" && !omiseLoaded`. **→ The PSP is Omise**, and the button being grey suggests the Omise SDK isn't initialising (env var? script load? region?).
- No OTP / email-verification popup component exists. R21 is greenfield.
- **i18n is API/DB-backed**, not file-based — `lib/i18n/api.ts`. There are **no `locales/en.json` files** to edit; missing keys must be added via the DB / Supabase. **→ This is a critical discovery that reshapes every i18n task (R3, R4, R7, R8, R9, R10, R11, R13, R14).**

### Back Office (`silkskyair-manager`) — Explore agent C findings (2026-05-12)
- **No i18n for back-office UI** — all user-visible strings are hardcoded JSX (`lib/i18n/types.ts` is only used for product content like Tours / Coupons / Promotions). So R4 in the Back Office is a JSX-level rename.
- R1 (Create Partner form clearing): Located. Path: `app/(workspace)/partners/_components/partners-manager.tsx`. Sections at lines 1093 (Details), 1204 (Location), 1240 (Commission & Status). Submit handler at line 555. The bug: `setTimeout(closeDrawer, 700)` runs `closeDrawer()` which calls `setForm({})` (line 475). When the user re-opens the drawer it shows empty fields. **In *edit* mode the form populates from row data (lines 433-437); in *create* mode the form is wiped without persisting the new partner into the drawer's edit state.**
- Back-office "Members" module:
  - Sidebar entry: `components/home/sidebar.tsx:61` — `members: Contact`.
  - Pages: `app/(workspace)/members/page.tsx`, `components/members/MemberPicker.tsx`, `services/member-search.ts`. **So R4 does touch the Back Office** if the client wants the rename throughout all systems.
- Cancellation handling in back office: `app/(workspace)/bookings/_components/change-request-review-drawer.tsx:27` recognises cancellation type. `booking-detail-view.tsx:43` holds `cancelApprovalState`. **No notification bell, inbox, or toast exists today** — cancellation requests only surface inside a specific booking's detail view. R20 in back office means **adding a notification surface from scratch** (or wiring the existing event into an email).

### Orchestrator (`silkskyair-orchestrator`) — Explore agent C findings (2026-05-12)
- `N8N_WORKFLOW_DEPENDENCY_MATRIX.md` documents the n8n workflows. **No invitation-email-send workflow is documented here** — partner-user invitations appear to be handled inside `silkskyair-manager` via `/api/invitations`, and the actual send probably goes through Supabase Auth (to be confirmed by Agent B).
- A `Bookings Event` workflow is active (line 236 of the matrix) which forwards booking status changes to Zoho — but **no cancellation-to-back-office notification workflow** exists. R20 likely needs either (a) a new n8n workflow or (b) a Supabase trigger / edge function.
- `CLAUDE.md` references siblings `silkskyair-api`, `silkskyair-manager`, `silkskyair-member`, `silkskyair-www`. Note: **`silkskyair-member` is a fifth repo** not in our access list. Member-facing flows (R12 nationality FK, R21 email verification popup) may live partly in `silkskyair-member` — **flag for explicit confirmation**.

### Open caveat — possible fifth repo
- `silkskyair-orchestrator/CLAUDE.md` mentions `silkskyair-member` and `silkskyair-www`. Neither is in our session's access list. If any review item turns out to live in `silkskyair-member` (the consumer-side flow) the task cannot land. Most review items target the **partner** portal so this should be rare, but R21 (email verification popup during a booking made via the partner portal) and R12 (member_profiles FK) deserve a second check.

---

## Decisions log

- 2026-05-12 — Each review item is broken into one task per touchpoint (rule above). A single review bullet can produce multiple tasks; that is intentional and required by the Notion-import constraint.
- 2026-05-12 — All tasks land on the shared branch `claude/plan-client-review-YNHfY` per the session instructions.
- 2026-05-12 — **R4 scope:** Partner Portal user-visible strings only. URL stays `/members`. No DB/table renames. No Back Office changes for this task. → R4-T5 and R4-T6 **dropped** from this remediation pass.
- 2026-05-12 — **R5 scope:** Hard-remove the entire `components/home/widgets/reporting-widget.tsx` from `app/home/page.tsx`. → R5 collapses to a single task. Code stays in the repo (commented unmount) so it can be brought back in Phase 2 of the product.
- 2026-05-12 — **R17/R18 intent:** Both Direct/Full and Indirect/Net should accept card. Root cause hypothesis: Omise SDK isn't loading (env keys, script tag, region). Both tasks become **bug-fix** tasks on `components/bookings/payment-checkout.tsx` and its Omise loader, not feature removals.
- 2026-05-12 — **R20 implementation:** Both an email to back-office managers and an in-app notification (toast / bell / inbox) are required. This means at least three sub-tasks: server event source (api/orchestrator), email send, in-app notification surface (silkskyair-manager). See updated breakdown below.
- 2026-05-13 — **R3 scope:** Introduce ONE helper (`formatRoleLabel(role)`) in `silkskyair-partner` that maps every role string (`organization_manager`, `member`, `support`, …) to a human-readable label, and use it everywhere a raw role appears. This prevents the same class of bug from re-surfacing on other roles.
- 2026-05-13 — **R8-T3 / R11 (final-price note):** Drop the note entirely — delete the `i18n("create.finalPriceNote")` reference at `components/bookings/create/extras-step.tsx:213`. No DB translation row needs to be added.
- 2026-05-13 — **R19 (Indirect Payment dialog):** Add the same TOTAL AMOUNT card to the Indirect Payment dialog that exists on Direct, so both flows are visually consistent.
- 2026-05-13 — **R15 / R16 (commission math):** Fix client-side first (`lib/bookings/commission.ts` in `silkskyair-partner`); also mirror the change on the server side iff Agent B's investigation surfaces a server-side commission calculator. If no server calc exists, this collapses to the client-side change only — no API work is invented for parity's sake.
- 2026-05-13 — **Phase 2 Explore agents resolved 4 unknowns:**
  - R3 broken chip lives in the **Account Portal repo** (`NEXT_PUBLIC_ACCOUNT_URL`) — NOT in our access list. In-scope work shrinks to consolidating the two duplicated `getRoleLabel` helpers in `silkskyair-partner` (`components/team/team-table.tsx:74-75`, `components/team/pending-invitations.tsx:49-50`, and the inline copy at `components/team/team-member-drawer.tsx:235`).
  - R16 server calc **does** exist (`silkskyair-api/supabase/migrations/20260216110000_commission_calculation_fields.sql` — `booking_commission_settlements`, `trg_booking_partner_attribution`, `partner_performance`). Per the earlier decision, server-side mirror is required.
  - R17/R18 root cause is missing `OMISE_PUBLIC_KEY` + a `Script onLoad` that silently fails. Code fix is small; env-var provisioning needs the client.
  - R12 FK target is `countries(code)` (ISO-3166 alpha-2). Partner needs a `<select>`; no FK relaxation.
  - R22 archive column **does not exist** — new migration required.
  - R2 invitation From identity lives inside the n8n cloud workflow `/invitations/send-email` — Supabase Auth email is disabled. So R2 belongs to `silkskyair-orchestrator` (or n8n cloud, depending on whether workflow JSON is committed in-repo).
- 2026-05-13 — **R20 channel split:** In-app notification fans out to all `module:bookings:access` users; email goes only to manager-level roles. Lets ops staff see everything without flooding everyone's inbox.
- 2026-05-13 — **R22 archive UX:** Archived clients hidden from the default list; a "Show archived" toggle reveals them for reference. **Archive is one-way** — no unarchive UI in this phase. Server still allows reactivation via DB if needed.
- 2026-05-13 — **R4-T2 subtitle:** "Manage your registered clients".
- 2026-05-13 — **Phase 2 verification pass** confirmed file:line for every previously-hedged item:
  - `silkskyair-manager/app/(workspace)/partners/_components/partners-manager.tsx` — `setTimeout(closeDrawer, 700)` at **line 626**; `closeDrawer` declared at **line 469**; `setForm({})` at **line 475**; create-success branch at **lines 598-625**; edit-mode populate pattern at **lines 503-507** (`setForm({ ...match, location_lat: coords?.[1], location_lng: coords?.[0] })`).
  - `silkskyair-partner/components/team/team-table.tsx` — `getRoleLabel` at **lines 74-75**; call site at **line 170**.
  - `silkskyair-partner/components/team/pending-invitations.tsx` — `getRoleLabel` at **lines 49-50**; call site at **line 119**.
  - `silkskyair-partner/components/team/team-member-drawer.tsx:235` — `{i18n(\`team.role.${member.role}\`) || member.role}` (inline; replace with helper).
  - `silkskyair-partner/components/bookings/passenger-card.tsx:263-268` — nationality is a `<input type="text">` bound to `form.nationality`.
  - `silkskyair-partner/lib/bookings/commission.ts:142` — `netToOperator = round2(totalInclVat - commission - vatOnCommission + withholdingTax)` (the broken formula). `paymentCollectedBy` type already at line 60.
  - `silkskyair-partner/components/bookings/booking-payment-section.tsx:130-135` — WHT `BreakdownRow` currently gated only by `data.commission > 0` (line 122). Add direct-only gate.
  - `silkskyair-partner/components/bookings/payment-checkout.tsx:338-342` — `<Script>` tag has both `onLoad` and `onError`. **Button disabled at line 426** (`disabled={loading || (paymentMethod === "card" && !omiseLoaded)}`). **TOTAL AMOUNT gated by `paymentCollectedBy === "direct"` at lines 345-354.**
  - `silkskyair-partner/components/bookings/create/extras-step.tsx:214-216` — exact `<p>` block to delete.
  - `silkskyair-partner/components/members/member-card.tsx` — **exists** (so R22 UI extends an existing component).
  - `silkskyair-manager/components/home/header.tsx` — **exists** (imported in `layout.tsx:2`); notification bell mounts here.
  - `silkskyair-manager/lib/toast-emitter.ts` — **exists**; reuse for inbound notifications.
  - `silkskyair-partner/components/ui/combobox.tsx` — **does not exist**. R12 will use a plain `<select>` ordered by country name.
  - **Settlement INSERT** for R15/R16 server mirror lives at **`silkskyair-partner/app/api/bookings/[id]/payments/intent/route.ts:218-239`** (note: this is partner-repo server code, not silkskyair-api). The breakdown values are computed *client-side* in the partner repo and INSERTed via `serviceSupabase.from("booking_commission_settlements").insert({...})`. So the "server mirror" is actually a partner-repo route fix — it picks up the fixed `commission.ts` formulas automatically. **No silkskyair-api migration needed for R16 math.** A migration is still useful to add a DB-level check constraint as defense-in-depth (optional).
- 2026-05-13 — **R3 disposition:** access to `andaman-aerodrome/silkskyair-account` is being granted. Plan adds an explicit "request + use access to silkskyair-account" task; R3 stays in scope.
- 2026-05-13 — **R6 disposition:** spec creation is a plan-finalization step, not a code task. Plan tracks "produce R6 spec" as a blocker step before any code; no code changes for R6 in this branch until spec is signed off.
- 2026-05-13 — **R21 disposition:** post-submit verification. **Server OTP infrastructure is fully built and live** (verified by code dive):
  - DB trigger generates a 6-digit OTP on booking INSERT, SHA-256 hashes it, stores hash in `booking_verifications` and `booking.metadata.verification.otp` (evidence: `silkskyair-api/supabase/migrations/20260213100000_fix_otp_no_leading_zero.sql:15-17`, `20260210120000_booking_verifications_table.sql:1-68`).
  - Unified `api.verify_email(entity_type='booking', entity_id, method='otp', otp)` RPC validates the hash and emits a `BookingEmailVerified` event (evidence: `20260210100000_unified_verify_email.sql:9-178`, hash check at line 125, event at lines 143-145).
  - Edge function `silkskyair-api/supabase/functions/verify/index.ts:1-12, :89-110` is the unified verification endpoint (OTP + HMAC token).
  - n8n "Bookings Create" workflow emails the OTP to the client, then calls `rpc/booking_strip_otp` to remove plaintext (evidence: `silkskyair-orchestrator/N8N_WORKFLOW_DEPENDENCY_MATRIX.md:147-150, :215`).
  - Verification page already exists at `/verify?token={HMAC}&bookingId={id}` in the member portal (evidence: `N8N_WORKFLOW_DEPENDENCY_MATRIX.md:102`).
  - **What's missing:** the partner portal has zero OTP / verification code. `POST /api/bookings` at `silkskyair-partner/app/api/bookings/route.ts:202-225` returns the booking with no verification-required signal; `create-booking-drawer.tsx:195-259` has no post-success modal; no `useEmailVerification` hook is half-wired. → **R21 is fully in scope** as a greenfield popup in `silkskyair-partner` that calls a new `/api/bookings/[id]/verify` proxy hitting the existing edge function.
- 2026-05-13 — **R17/R18 env var verification:** Directly inspected `silkskyair-partner/lib/integrations/omise.ts:7-10` — uses `process.env.OMISE_PUBLIC_KEY` and `process.env.OMISE_SECRET_KEY` (server-side only). Directly inspected `silkskyair-partner/app/api/bookings/[id]/payments/intent/route.ts:228-233` — returns `publicKey: process.env.OMISE_PUBLIC_KEY` to the client in the JSON response. **There is no `NEXT_PUBLIC_OMISE_*` variant** — the client receives the public key via the intent API response, not via a build-time `NEXT_PUBLIC_*` env. Earlier plan note was wrong; corrected below.
- 2026-05-13 — **Out-of-repo work — access requests required:**
  - `silkskyair-account` (Account Portal) — owns the role-chip rendered on the Create-Account page (R3 reviewer-visible bug). Requested.
  - `*-workflows` (or equivalent n8n cloud workspace) — owns the `/invitations/send-email` workflow (R2 From identity) and will own a new `/notifications/cancellation-email` workflow (R20 email). Requested.
  - Vercel project for `silkskyair-partner` — owns runtime env vars (R17/R18 Omise keys). Requested.
  - Plan adds explicit access-request tasks (Batch X0) to the execution order.

---

## Verification (when we eventually implement)

> Filled in at end of Phase 4. Every task must specify its end-to-end test before leaving planning.

For each task we will run (where applicable):
- `pnpm typecheck && pnpm lint && pnpm test` in the affected repo.
- Targeted Playwright e2e (both `silkskyair-manager` and `silkskyair-partner` have `playwright.config.ts` and an `e2e/` folder — these are the canonical surfaces for acceptance tests).
- Supabase MCP for DB-shape verifications (R12, R22).
- Manual walkthrough that mirrors the review screenshot for each item.

---

## Confidence snapshot after Phase 2 code dive (2026-05-12)

Status after Explore agents A (partner) + C (manager/orchestrator). Agent B (silkskyair-api) is still running and will refine R12, R13-R16 server math, R20, R22 once it returns.

🟢 **Ready (low uncertainty, only need final wording or one-line decision)**
- R7-T1 (rename Invite button — `app/team/page.tsx:185`)
- R8-T1 (add `team.status.archived` translation)
- R8-T2 (add `actions.save` translation)
- R9-T1 (fix stepper step 4 label via i18n key `create.step4` → "Shared/Private Flight")
- R10-T1 (rename `create.confirm` → "Submit Booking")
- R13-T1 (rename `payment.directPayment` → "Full Payment")
- R14-T1 (rename `payment.indirectPayment` → "Net Payment")
- R15-T1 (conditional hide of WHT row in `booking-payment-section.tsx:135` when `payment_kind === indirect`)
- R16-T1 (client-side fix in `lib/bookings/commission.ts` — see open Q on whether to mirror on server)
- R4-T1 (sidebar `sidebar.members` → "Clients" in DB translations)
- R4-T3 (Add Member button → Add Client, key `members:actions.create`)

🟡 **Needs one more confirmation (mostly client wording or API check from Agent B)**
- R1-T1 — Now firmly scoped to the create branch of `partners-manager.tsx:555` submit handler. Fix is: on create-success, either keep the drawer open with the saved values (re-fetch) or navigate to the partner detail page. **Question for client:** which UX is preferred?
- R2-T1 — Likely sits inside `silkskyair-api` Supabase Auth email templates (Agent B will confirm).
- R3-T1 — Role chip on signup page; still need to find the exact JSX (was not found by Agent A — likely in `app/(auth)/...`; one more targeted search will resolve).
- R4-T2 (Members page subtitle copy) — copy decision.
- R4-T4 (i18n update — DB-backed; one row per locale).
- R4-T6 (Back Office "Members": JSX rename in `sidebar.tsx:61`, `app/(workspace)/members/page.tsx`, `MemberPicker.tsx`, `member-search.ts`).
- R8-T3 — wait for client copy for `create.finalPriceNote`.
- R11 — same as R8-T3 (it IS R8-T3 effectively — duplicate; will be folded into one task).
- R12-T1 / R12-T2 / R12-T3 — waiting on Agent B's DB schema check, but Agent A confirmed the input is a free-text `<input>` for nationality and a numeric for weight. Likely fix: make nationality a `<select>` of ISO codes that matches the FK lookup table.

🔴 **Blocked — need client decision (cannot leave planning)**
- R5 — Agent A could NOT find a discrete `CommissionRate` card; both metrics are likely sub-sections of one widget. **Question for client:** remove the *whole* reporting widget, or only the Commission Rate & Performance Overview rows inside it?
- R6 — Brand-new "Available Tours" widget. **Need spec:** what tours appear (all active / partner-allowed / featured), what each card shows (image, name, price, CTA), pagination/limit, empty state, data endpoint.
- R17-T1 — Pay-with-Card disabled because Omise SDK doesn't load. **Need from client:** are Omise keys configured for staging? Was card payment intentionally gated? (May resolve to "Yes, just fix the SDK script load" which would re-classify to 🟡.)
- R18-T1 — Same as R17 + a product question: **should indirect/net payment even support card payment?** It may make more sense to just remove the card option for indirect mode.
- R19-T1 — Should the Indirect Payment dialog also show the TOTAL AMOUNT box?
- R20-T1 — Notification channel (email / in-app bell / both)? Recipients (which back-office role)? Template? Greenfield work in either orchestrator (n8n) or api (edge function).
- R21-T1 — Greenfield popup component. **Need from client:** is this a popup, an inline step, or a full screen? Should it block booking submission until verified, or just confirm post-booking? Or is the existing flow assuming Supabase Auth will handle the popup itself (in which case the bug is that the page doesn't surface the right state)?
- R22-T1 / R22-T2 — Soft-archive UX. **Need:** column name / migration vs existing column (Agent B will confirm the DB side); also: archived clients shown by default or behind a filter toggle? Can they be unarchived?

> **Possible scope leak — fifth repo.** `silkskyair-orchestrator/CLAUDE.md` references a `silkskyair-member` repo we do **not** have access to. If R12 (member_profiles) or R21 (booking-time email verification) require changes there, those tasks cannot be implemented in this session and must be raised as out-of-scope tickets.

---

## Final Plan (Phase 4 — revised after Phase 2 design pass)

### Context

The client's third pre-launch review of the Partnership Portal surfaces 22 items: real bugs (R1 partner-create form clearing; R12 passenger nationality FK violation; R16 broken indirect commission math; R17/R18 disabled Pay-with-Card; R20 missing back-office cancellation notification; R21 missing email-verification popup; R8/R11 untranslated i18n keys), terminology renames (R4 Members→Clients globally; R13/R14 Direct→Full / Indirect→Net; R10 "Confirm Booking"→"Submit Booking"; R7 "Invite Member"→"Invite Team"; R3 `organization_manager`→Manager; R9 stage label fix), a layout reduction (R5 hide reporting widget), the new R6 Available Tours widget, R19 TOTAL AMOUNT parity on indirect, and R22 archive clients. All work lands on shared branch `claude/plan-client-review-YNHfY` across the four reachable repos (`silkskyair-orchestrator`, `silkskyair-api`, `silkskyair-manager`, `silkskyair-partner`). A 5th repo (Account Portal at `NEXT_PUBLIC_ACCOUNT_URL`) hosts the Create Account page and is **not** in our access list — R3's actual broken chip is out of scope here.

The Partner Portal i18n is **DB-backed via `i18n.entries`** (not JSON files), so most rename tasks are Supabase migrations rather than code edits.

**What lands in this branch (no further access needed):** R1, R4, R5, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16 (client + server-side mirror inside partner-repo settlement route), R19, R20 in-app half, R22.
**Blocked on access (see Access Prerequisites — Batch X0):**
- R3 reviewer-visible chip — needs `silkskyair-account` access
- R2 invitation From identity — needs `silkskyair-workflows` access
- R17/R18 actual fix — code in partner repo is small (verified), but provisioning needs Vercel access
- R20 email half — needs `silkskyair-workflows` access
- R21 partner-side popup — partner-repo greenfield is plannable, but the cross-repo contract with `silkskyair-member`'s `/verify` page should be confirmed before implementation
**Blocked on spec (not access):** R6 Available Tours widget.

### Execution order (batches with dependencies)

```
Batch X0 — Access prerequisites (silkskyair-account, silkskyair-workflows,
            silkskyair-member, Vercel, n8n cloud) — see Access Prerequisites section
   ↓ (X0 unblocks R3 / R2 / R17 / R18 / R20-email / R21-contract; everything below is unblocked already)
Batch A1 — silkskyair-api migrations (no dependencies)
   ↓
Batch P1 — silkskyair-partner uses A1's i18n rows
   ↓
Batch P2 — silkskyair-partner JSX / behavior (depends on P1 keys)
Batch M1 — silkskyair-manager JSX (independent of P1/P2)
   ↓
Batch M2 — silkskyair-manager notification bell consumer (depends on A1 trigger)
   ↓ (the below batches all require X0 to have completed)
Batch ACC1 — silkskyair-account — R3 chip fix (post-X0-T1)
Batch WF1  — silkskyair-workflows — R2 From identity + R20 cancellation email workflow (post-X0-T2)
Batch ENV1 — Vercel — R17/R18 OMISE keys (post-X0-T4)
Batch P3   — silkskyair-partner — R21 popup + /api/bookings/[id]/verify proxy (post-X0-T3)
   ↓
Batch P4 — DEFERRED: R6 Available Tours (needs spec, not access)
```

### Batch A1 — `silkskyair-api` — new migrations

All new files under `silkskyair-api/supabase/migrations/`. Latest existing migration is `20260427130000_*`; new files use prefix `2026051312xxxx_*` (or later).

**`20260513120000_review_rename_keys.sql` (NEW) — covers R4 (partner), R7, R8-T1, R9, R10, R13, R14.**
Pattern: copy the UPSERT shape from `20260310120200_i18n_missing_partner_keys.sql`. All entries `context = 'partner'`. EN / TH / RU values:

| Section | Key | EN | TH | RU | Review |
|---|---|---|---|---|---|
| common | sidebar.members | Clients | ลูกค้า | Клиенты | R4-T1 |
| members | page.title | Clients | ลูกค้า | Клиенты | R4-T2 |
| members | page.subtitle | Manage your registered clients | จัดการลูกค้าที่ลงทะเบียนของคุณ | Управление зарегистрированными клиентами | R4-T2 |
| members | actions.create | Add Client | เพิ่มลูกค้า | Добавить клиента | R4-T3 |
| settings | team.invite | Invite Team | เชิญทีม | Пригласить команду | R7-T1 |
| settings | team.status.archived | Archived | เก็บถาวรแล้ว | В архиве | R8-T1 |
| bookings | create.step4 | Shared/Private Flight | เที่ยวบินแบบใช้ร่วม/ส่วนตัว | Совместный/Частный рейс | R9-T1 |
| bookings | create.confirm | Submit Booking | ส่งการจอง | Отправить заявку | R10-T1 |
| bookings | payment.directPayment | Full Payment | ชำระเต็มจำนวน | Полная оплата | R13-T1 |
| bookings | payment.indirectPayment | Net Payment (after deducting commission) | ชำระสุทธิ (หักค่าคอมมิชชั่นแล้ว) | Чистая оплата (после вычета комиссии) | R14-T1 |

`actions.save` (R8-T2) is **already present** at `20260217100000_member_module.sql:247` — no action needed.

**`20260513120100_member_profiles_archived_at.sql` (NEW) — R22-T1.**
```sql
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_member_profiles_archived_at
  ON public.member_profiles (archived_at) WHERE archived_at IS NULL;
```
Plus `RPC api.archive_member(p_member_id uuid)` that sets `archived_at = now()` (one-way, no `unarchive_member`), gated by `rls_has_privilege('module:partner-members:access')`. Update partner-portal members list query to filter `WHERE archived_at IS NULL` unless the "Show archived" toggle is on.

**`20260513120200_commission_indirect_no_wht.sql` (NEW) — R15/R16 server mirror.**
Server-side commission lives in `20260216110000_commission_calculation_fields.sql` plus the settlement INSERT path called from `silkskyair-partner/app/api/bookings/[id]/payments/intent/route.ts` (~line 240; verify in implementation). Mirror the client-side fix:
- For `payment_collected_by = 'indirect'`: write `net_to_partner = commission + vat_on_commission` (no WHT deduction); `net_to_operator = total - commission - vat_on_commission`. Keep direct path unchanged.
- **Recommended approach (additive, safer):** Add a new function `compute_settlement_v2(p_total, p_commission_pct, p_vat_pct, p_wht_pct, p_collected_by)` returning the breakdown, and switch the settlement INSERT to call it. Drop on revert.

**`20260513120300_notification_on_cancellation.sql` (NEW) — R20-T1 in-app fan-out.**
Trigger on `public.booking_events` AFTER INSERT WHERE `event_type = 'BookingCancellationRequested'`. Insert one row into `account.notifications` per recipient (`user_id`, `app_id` for manager, `type = 'booking.cancellation_requested'`, title/body, metadata JSON with `booking_id`).
**Recipients (per decision):** all active `organization_users` whose role has `module:bookings:access` privilege. Email path (manager-only) is handled in Batch O1.
Register a new event type in `account.event_types` mirroring `20260308100000_*` pattern.

### Batch P1 — Partner Portal i18n (via A1 migration)
No file-level changes in `silkskyair-partner` for renames — i18n is DB-backed.

### Batch P2 — `silkskyair-partner` — JSX / behavior

| Task | File:line | Change |
|---|---|---|
| **R3 partial** | NEW `lib/auth/roles.ts` | Export `formatRoleLabel(role, i18n)` returning `i18n(\`team.role.${role}\`) || role.split("_").map(s => s[0].toUpperCase() + s.slice(1)).join(" ")` |
| R3 partial | `components/team/team-table.tsx:74-75` | Replace inline `getRoleLabel` with import of `formatRoleLabel` |
| R3 partial | `components/team/pending-invitations.tsx:49-50` | Same — replace local helper with the shared import |
| R3 partial | `components/team/team-member-drawer.tsx:235` | Replace inline `i18n(\`team.role.${member.role}\`) || member.role` with `formatRoleLabel(member.role, i18n)` |
| **R5** | `app/home/page.tsx:6, :75, :76` | Comment out the `ReportingWidget` import (line 6) and the JSX (line 76); change `lg:grid-cols-3` → `lg:grid-cols-2` (line 75) so the remaining two widgets reflow. Comment out the matching `fetchPerformance` callback + `useEffect` (lines 36-47) to avoid a dead-state fetch. **Do not delete** `components/home/widgets/reporting-widget.tsx`. |
| **R7** | `app/team/page.tsx:170` | Change `{i18n("team.invite") \|\| "Invite Member"}` → `{i18n("team.invite") \|\| "Invite Team"}` so the fallback matches the new wording. |
| **R8-T3 / R11** | `components/bookings/create/extras-step.tsx:213-216` | Delete the entire `<p>` block referencing `create.finalPriceNote`. |
| **R12-T2** | `components/bookings/passenger-card.tsx:262-269` | Replace free-text `<input>` for `nationality` with `<select>` populated from a new `useCountries()` hook returning `{ code, name }[]` ordered by name. |
| R12-T2 | NEW `app/api/countries/route.ts` (~20 lines) | GET returns rows from `public.countries`. RLS already permits public SELECT per `20260211120000:15-17`. |
| **R12-T3** | n/a | No change — once R12-T2 lands, weight saves work. Verification-only. |
| **R15-T1** | `components/bookings/booking-payment-section.tsx:130-135` | Wrap the WHT `<BreakdownRow>` in `{data.paymentCollectedBy === "direct" && (...)}`. The `paymentCollectedBy` field is on `CommissionBreakdown` per `commission.ts:78`. |
| **R16-T1** | `lib/bookings/commission.ts:142` | Change `netToOperator = round2(totalInclVat - commission - vatOnCommission + withholdingTax)` → `netToOperator = round2(totalInclVat - commission - vatOnCommission)`. Yields 28000/10% indirect: `netToPartner = 2616.82`, `netToOperator = 25383.18`. Update the vitest spec in `lib/bookings/__tests__/commission.test.ts`. |
| **R17 / R18** | `components/bookings/payment-checkout.tsx:337-342, :426` | The `<Script>` already has `onError` (line 341). Add a 5s timeout + visible inline error when `!omiseLoaded` so the silent-fail case is debuggable. **Real fix: provision `OMISE_PUBLIC_KEY` (server) and `NEXT_PUBLIC_OMISE_PUBLIC_KEY` (client) in staging/prod env.** Add placeholders to `.env.example`. |
| **R19** | `components/bookings/payment-checkout.tsx:345-353, :460-464` | Remove the `paymentCollectedBy === "direct"` wrapper around the TOTAL AMOUNT card and the QR amount display so both render for indirect too. |
| **R22-T2** | `app/members/page.tsx` + `components/members/member-card.tsx` | Add an "Archive" action on each `<MemberCard>` calling new `POST /api/members/[id]/archive`. Add a "Show archived" toggle in the page state (default off). Hide archived rows from the default list. **One-way:** no unarchive UI. |
| R22-T2 | NEW `app/api/members/[id]/archive/route.ts` | POST calls the RPC from A1. |

### Batch M1 — `silkskyair-manager` (Back Office)

| Task | File:line | Change |
|---|---|---|
| **R1-T1** | `app/(workspace)/partners/_components/partners-manager.tsx:469-484, :616-626` | In the create-success branch (lines 616-623), replace `setTimeout(closeDrawer, 700)` with `setDrawer({ mode: "edit", partner: saved })` and populate the form from `saved` (mirroring the edit-mode populate at lines 433-437). Also `router.push(\`?partner=${saved.id}\`)`. Keep the existing edit-branch close behavior. |
| **R4-T6** | `lib/modules/registry.ts:116` | `label: "Members"` → `label: "Clients"` (sidebar reads `module.label` directly). |
| R4-T6 | `app/(workspace)/members/_components/members-manager.tsx:70` | `all: { label: "All Members", ... }` → `label: "All Clients"`. |
| R4-T6 | `app/(workspace)/members/_components/members-manager.tsx:338` | `<p>Members</p>` → `<p>Clients</p>`. |

URL `/members` is **not** renamed (per decision log).

### Batch M2 — `silkskyair-manager` — notification bell consumer (R20 in-app)

Greenfield in back office; no existing notification surface.

| Task | File:line | Change |
|---|---|---|
| R20-T2 | NEW `components/home/notification-bell.tsx` | Fetches `account.notifications WHERE user_id = current AND read_at IS NULL`. Realtime subscribe (REPLICA IDENTITY FULL is already set per `20260308100000:91`). Renders a bell + unread count + dropdown. |
| R20-T2 | `components/home/header.tsx` (verify exists; else `app/(workspace)/layout.tsx`) | Mount `<NotificationBell />` in the header. |
| R20-T2 | NEW `app/api/notifications/route.ts` | GET (list), PATCH (mark-read). |
| R20-T2 | reuse `lib/toast-emitter.ts` | Surface inbound notifications as toasts. |

### Batch WF1 — `silkskyair-workflows` — R20 email + R2 (BLOCKED on X0-T2)

Until access lands, only intent-level entries are listed; concrete file:line / node identifiers will be filled in after X0-T2 + a follow-up Explore pass.

| Task | Where | Intent |
|---|---|---|
| **R2** | n8n workflow `/invitations/send-email` (file path TBD post-access) | Change the email node's "From" identity to `Silk Sky Partner Portal <system@silkskyair.com>`. |
| **R20 email** | NEW n8n workflow `/notifications/cancellation-email` (file path TBD post-access) | Webhook POST → DB query for manager-role recipients → email template with booking reference + reason. |

### Batch P3 — `silkskyair-partner` — R21 verification popup (partial — partner-repo half plannable; cross-repo contract pending X0-T3)

Server infrastructure for OTP issuance + verification is live (see R21 disposition entry in Discoveries). The partner-side popup is greenfield. Files involved:

| Task | File:line | Change |
|---|---|---|
| **R21-T1** | NEW `app/api/bookings/[id]/verify/route.ts` (partner-repo proxy) | POST receives `{ otp }`, calls the existing `verify` edge function (`silkskyair-api/supabase/functions/verify/index.ts`) with `entity_type='booking', entity_id=[id], method='otp', otp`; returns `{ verified: true/false, error? }`. Service-role auth (booking belongs to partner). |
| **R21-T2** | NEW `components/bookings/create/verification-modal.tsx` | Modal with a 6-digit code input (auto-advance / paste-fill), "Verify" CTA, error state, "Resend code" link (deferred — see Open Q below). Calls R21-T1. |
| **R21-T3** | `components/bookings/create/create-booking-drawer.tsx:195-259` | After `POST /api/bookings` succeeds, replace immediate close with `setShowVerification(true)`. Pass the new booking ID to the modal. On `verified=true`, close drawer + emit toast; on close-without-verify, leave booking in unverified state (per user choice: post-submit verification). |
| **R21-T4** | `app/api/bookings/route.ts:202-225` | No change required for the happy path; the booking row will already have `booking_verifications` populated by the DB trigger. Verify this by Supabase MCP `execute_sql` post-create. |
| **R21-T5** (post-X0-T3) | Cross-repo contract review against `silkskyair-member/app/verify/page.tsx` (or wherever the customer-facing `/verify` page lives) | Confirm: token format, OTP-vs-HMAC dual-method behavior, response shape. Adjust R21-T1/T2 if assumptions are wrong. |

Open Q (does NOT block initial planning): does R21 need a "Resend code" affordance? The DB trigger generates the OTP once; resend would need a new RPC. Default in this plan: no resend in v1 — if the partner closes the modal, they can re-trigger via a "Verify email" action surfaced on the booking detail (added as R21-T6).

| Task | File:line | Change |
|---|---|---|
| **R21-T6** | `app/bookings/[id]/page.tsx` (verify location post-discovery) | Surface a "Verify email" action when `booking_verifications.verified_at IS NULL`. Opens the same modal. |

### Critical files (consolidated)

**`silkskyair-api/supabase/migrations/`** (all NEW)
- `20260513120000_review_rename_keys.sql`
- `20260513120100_member_profiles_archived_at.sql`
- `20260513120200_commission_indirect_no_wht.sql`
- `20260513120300_notification_on_cancellation.sql`

**`silkskyair-partner`**
- `app/home/page.tsx` — R5
- `app/team/page.tsx:170` — R7 fallback
- `app/members/page.tsx`, `components/members/member-card.tsx` — R22 UI
- NEW `app/api/countries/route.ts` — R12
- NEW `app/api/members/[id]/archive/route.ts` — R22
- NEW `lib/auth/roles.ts` — R3
- `components/team/team-table.tsx:74-75`, `pending-invitations.tsx:49-50`, `team-member-drawer.tsx:235` — R3 consolidation
- `components/bookings/create/extras-step.tsx:213-216` — R8-T3 delete
- `components/bookings/passenger-card.tsx:262-269` — R12 select
- `components/bookings/booking-payment-section.tsx:130-135` — R15
- `lib/bookings/commission.ts:142` + `lib/bookings/__tests__/commission.test.ts` — R16
- `components/bookings/payment-checkout.tsx:337-342, :345-353, :426, :460-464` — R17/R18/R19
- NEW `lib/n8n/trigger-cancellation-email.ts` + `app/api/bookings/[id]/cancel/route.ts` (call site) — R20 email
- `.env.example` — add `OMISE_PUBLIC_KEY=` / `NEXT_PUBLIC_OMISE_PUBLIC_KEY=` placeholders

**`silkskyair-manager`**
- `app/(workspace)/partners/_components/partners-manager.tsx:469-484, :616-626` — R1
- `lib/modules/registry.ts:116`, `app/(workspace)/members/_components/members-manager.tsx:70, :338` — R4-T6
- NEW `components/home/notification-bell.tsx`, `app/api/notifications/route.ts`; mount in header — R20-T2

**`silkskyair-orchestrator`**
- No source change.

**`silkskyair-account`** (BLOCKED on X0-T1)
- R3 chip rendering on Create-Account page. File:line TBD post-access.

**`silkskyair-workflows`** (BLOCKED on X0-T2)
- `invitations/send-email` workflow (R2 From identity)
- NEW `notifications/cancellation-email` workflow (R20 email half)

**Vercel projects** (BLOCKED on X0-T4)
- `silkskyair-partner` (staging + prod): `OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`

**`silkskyair-member`** (BLOCKED on X0-T3, contract review only)
- `app/verify/page.tsx` (or equivalent) — referenced by R21-T5 for cross-repo contract review.

### Verification matrix

| Review item | Verification |
|---|---|
| R1 | Playwright `silkskyair-manager/e2e/` partner-create flow: fill, save, re-open → fields populated; `?partner=ID` in URL |
| R2 | Manual: send a fresh invitation, inspect Gmail "From" header (n8n config change is separate) |
| R3 (partial) | Vitest for `formatRoleLabel`; Playwright on `/team` renders human labels not raw role strings |
| R3 (full) | OUT OF SCOPE — Account Portal repo |
| R4 partner | Supabase MCP `execute_sql` verifies `i18n.entries`; Playwright crawls sidebar / `/members` |
| R4 manager | Playwright `silkskyair-manager/e2e/` — sidebar + `/members` render "Clients" |
| R5 | Playwright `/home` — `<ReportingWidget>` absent from DOM; grid is 2-col |
| R6 | OUT OF SCOPE |
| R7 | Playwright `/team` button reads "Invite Team" |
| R8-T1 | Supabase MCP confirms rows; drawer renders "Archived" |
| R8-T2 | Already exists; verification: no raw `actions.save` in UI |
| R8-T3 / R11 | Playwright `/bookings/new` step 4 — no raw `create.finalPriceNote` text |
| R9 | Stepper shows `4) Shared/Private Flight` |
| R10 | Step-5 CTA reads "Submit Booking" |
| R12 | Supabase MCP confirms FK target; Playwright edits passenger nationality via `<select>`, saves, refresh persists; weight also persists |
| R13/R14 | Supabase MCP confirms new EN/TH/RU strings; Playwright booking detail shows them |
| R15 | Indirect breakdown has NO WHT row; Direct still shows it |
| R16 | Vitest: 28000 THB / 10% indirect → `netToPartner = 2616.82`, `netToOperator = 25383.18` |
| R17 | Manual with `OMISE_PUBLIC_KEY` set: test card `4242 4242 4242 4242` completes Full Payment |
| R18 | Manual: same for Net Payment |
| R19 | Indirect payment dialog shows TOTAL AMOUNT card |
| R20 | Partner cancels a booking → row inserted in `account.notifications` (Supabase MCP); bell shows unread count in manager; manager-role user receives email (after n8n workflow exists) |
| R21 | OUT OF SCOPE — deferred |
| R22 | Archive a client → hidden from default list; "Show archived" toggle reveals; Supabase MCP confirms `archived_at IS NOT NULL`; no unarchive UI present |

### Trade-offs and recommendations (recorded)

1. **R16 server mirror — additive vs overwrite.** Going with **additive**: new `compute_settlement_v2()` function called from the settlement INSERT. Safer rollback than overwriting the existing trigger.
2. **R5 — kept dead component file** per decision log; only `app/home/page.tsx` mounts/uses commented out.
3. **R12 — combobox vs `<select>`.** 249 ISO codes is a lot for a plain `<select>`. If a combobox component already exists in the partner app (search `components/` for `combobox` / `autocomplete`), prefer it; otherwise fall back to a plain `<select>` sorted by country name. Decide in implementation.
4. **R19 privacy comment.** The existing wrapper at `payment-checkout.tsx:344` carried a "hide net amounts for customer privacy" comment. Decision overrides that; flag in PR description for client visibility.
5. **R20 email path.** Lands the DB trigger + bell in this branch; email requires an n8n workflow we cannot commit. Tracked separately.
6. **R3 Account Portal scope.** Only the partner-repo cleanup ships here; the actual reviewer-visible chip needs Account Portal repo access. Track separately.

### Blocked items (was "out-of-scope" — corrected)

| Item | Blocker | Unblocks when |
|---|---|---|
| R3 reviewer-visible chip | No read access to `silkskyair-account` | X0-T1 grants access; then a quick Explore pass yields file:line |
| R2 From identity | No read access to `silkskyair-workflows` | X0-T2 grants access; we identify the workflow node and edit it |
| R20 email half | No read access to `silkskyair-workflows` | X0-T2 grants access; we add a new workflow |
| R17/R18 env provisioning | No access to Vercel project dashboards | X0-T4 — client confirms keys are present, or grants Vercel access |
| R21-T5 cross-repo contract | No read access to `silkskyair-member` | X0-T3 grants access; we verify token/response shape so R21-T1/T2 land safely |
| R6 Available Tours widget | No client spec (data source, card layout, empty state, pagination) | Client provides spec |

Note: R21 partner-side popup (T1–T4, T6) is **plannable today** because the OTP server-side flow is fully discovered. The cross-repo contract check (T5) is the only access-gated piece, and it's a verification, not a design step — so the bulk of R21 work can proceed in parallel with X0-T3.

### Verification (per batch)

For each batch:
1. `pnpm typecheck && pnpm lint && pnpm test` in the affected repo.
2. Playwright suites in `silkskyair-partner/e2e/` and `silkskyair-manager/e2e/` extended with new specs per the verification matrix.
3. Supabase MCP `list_tables`, `execute_sql`, `list_migrations` for DB-shape verifications.
4. Manual walkthrough mirroring each PDF screenshot.
5. i18n leak check: crawl the happy path; fail on any rendered raw key.

After each repo's batch lands, `git push -u origin claude/plan-client-review-YNHfY` per repo (retry up to 4× with 2/4/8/16s backoff on network failure). No PR is created unless explicitly requested.

---
