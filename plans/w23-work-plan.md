# W23 Work Plan v2 — Tangible Execution Recipes

> **Generated:** 2026-05-27 (revised from v1).
> **Inputs:** [`partnership-portal-client-review.md`](partnership-portal-client-review.md), [`member-portal-1st-review-2026-05-19.md`](member-portal-1st-review-2026-05-19.md), [`meta-capi-purchase-integration.md`](meta-capi-purchase-integration.md), and the factual code audit in [`w23-already-done-audit.md`](w23-already-done-audit.md).
> **Scope:** Three independent Scopes of Work, 34 shippable features, each with implementation steps (or verification steps if already done), an e2e test pair (simple + complex Happy Path), and a user-manual page.
> **Convention:** Every feature has the same shape — see §1.3.

---

## 0. Executive snapshot (post-audit)

| | Features | Already done | Partial | To start |
|---|---|---|---|---|
| **SoW 1 — Partnership Portal** | 17 | 1 (R21-T7 by accident) | 1 (R17 Omise skeleton) | 15 |
| **SoW 2 — Member Portal** | 11 | 0 | 2 (MP1-W10 infra, MP1-W11 repo) | 9 |
| **SoW 3 — Meta CAPI** | 6 | 2 (workflow + credential) | 3 (forward, IF gate, deploy) | 1 (www capture) |
| **Total** | **34** | **3** | **6** | **25** |

**Order-of-leverage to ship the most value this week:**
1. **Finish SoW 3** (1–2 days): 4 small fixes + 6 e2e specs + 6 manual pages. The workflow side is already deployed; only the www-side capture + the IF gate are missing.
2. **Start SoW 1 Batch A1** (1 day): one consolidated SQL migration unlocks 11+ partner-side rename tasks.
3. **Start SoW 2 MP1-W06** in parallel (longest critical path, 2–4 days).
4. Fan out everything else.

---

## 1. Cross-cutting conventions

### 1.1 Branches

| SoW | Per-repo branch name | Status |
|---|---|---|
| SoW 1 | `claude/plan-client-review-YNHfY` | **NOT CUT in any repo.** First action of SoW 1 is to cut this branch in `silkskyair-api`, `silkskyair-manager`, `silkskyair-partner`, `silkskyair-workflows`, `silkskyair-account` (and rebase off `develop`). |
| SoW 2 | `claude/mp1-review-w23` | **NOT CUT.** Cut on each repo when W06 work begins. |
| SoW 3 | `claude/meta-capi-w23` | **NOT CUT** in `silkskyair-www`; in `silkskyair-workflows`, work has been committed straight to default branches (`bac3351` etc.) — pull remaining changes onto a fresh branch. |

### 1.2 User-manual numbering scheme

The W22 manual at `silkskyair-docs/manuals/` ships pages `01..06`. W23 continues sequentially `07..`. The `_parent.md` index will need a new section header **"Features in this W23 release"** appended with rows for each new page. Each page follows the W22 shape — `title / app / who / what / slug / ssa` frontmatter; **Before you start / Step-by-step (numbered, each step has a screenshot + "what you should see" line) / Tips & common questions** body.

Screenshots live under `manual/screenshots/<slug>/NN-name.png`. Use 1440×900 viewport, English locale.

### 1.3 Per-feature recipe shape

Every feature section below uses this template:

```
### F<N.M> — <feature name> [<ID code>]
- Audit state: ✅ done / ⚠️ partial / ❌ not started — with one-line evidence
- Code changes (or Verification only):
   <file:line> — <change>
- Simple Happy Path E2E:
   <repo>/<e2e folder>/<spec file> — scenario in one paragraph
- Complex Happy Path E2E:
   <repo>/<e2e folder>/<spec file> — scenario in one paragraph
- User manual: manual/<NN>-<slug>.md — one paragraph of what it covers
- Acceptance gate: typecheck + lint + simple e2e green + complex e2e green + manual page committed (+ screenshots present)
```

**Rule:** No feature is "done" until **all five** of {code change, simple e2e green, complex e2e green, manual page committed, screenshots present} are true. Move to the next feature only after the current one closes.

### 1.4 E2E infrastructure to reuse (per [memory note `reuse_existing_test_infra`])

| Repo | Test folder | Conventions to follow |
|---|---|---|
| `silkskyair-www` | `tests/e2e/` | `booking-fixtures.ts`, `booking-flow-helpers.ts` (`openBookingWidget`, `selectConfiguredTour`, `setPassengers`, `selectDateAndSlot`, `fillContactInfo`, `submitBooking`, `verifyEmailWithOtp`, `payWithCardViaUI`, `TEST_CARD_4242`, `TEST_CARD_4111`). New specs follow `ssa-NNN-<feature>.spec.ts` naming. |
| `silkskyair-member` | `e2e/` | Only `payment.spec.ts` + `global-setup.ts` exist — fixtures need extending. **Before writing new specs, extend `e2e/global-setup.ts` with magic-link helper, processing-state helper, amendment-payment helper.** |
| `silkskyair-partner` | `e2e/` | `fixtures/`, `partner-auth-*.spec.ts`. New specs: `partner-<feature>.spec.ts`. |
| `silkskyair-manager` | `e2e/` | `fixtures/`, many `manager-*.spec.ts`. New specs: `manager-<feature>.spec.ts`. |
| `silkskyair-account` | `e2e/` | New specs: `account-<feature>.spec.ts`. |
| `silkskyair-workflows` | (no Playwright; n8n integration tests live in `silkskyair-www/tests/e2e/` as cross-repo specs, e.g. `email-delivery-control.spec.ts`, `payment-success-emits-confirmed-once.spec.ts`) | When testing a workflow change, write the spec in `silkskyair-www/tests/e2e/` and drive via real booking flow + assertion against side-effects (email delivery, DB events). |

### 1.5 Acceptance gates run command

```
# Per-repo before pushing a feature:
pnpm -C <repo> typecheck && pnpm -C <repo> lint && pnpm -C <repo> test e2e -- <spec-file>
```

If multiple repos are touched by a feature, run the gate in each.

---

## 2. SoW 1 — Partnership Portal Review (17 features)

> All R-T work lands on branch `claude/plan-client-review-YNHfY` per repo. **First action of SoW 1:** cut this branch in all 5 repos.

### F1.1 — Back-office partner-create form fix [R1]
- **Audit state:** ⚠️ Likely **pre-fixed** in commit `6f1231b3` (2026-04-11) — `setDrawer({ mode: "edit", partner })` pattern exists. Predates plan; needs UI verification.
- **Verification first (no code change unless verify fails):**
  - Manual: open staging back-office → Partners → +Create → fill all fields → Save → confirm drawer stays open in edit mode with all values populated; URL gains `?partner=<id>`; refresh persists.
- **Code change (only if verify fails):** `silkskyair-manager/app/(workspace)/partners/_components/partners-manager.tsx:469-484, :616-626` — replace `setTimeout(closeDrawer, 700)` with `setDrawer({ mode: "edit", partner: saved })`; `router.push(\`?partner=\${saved.id}\`)`.
- **Simple Happy Path E2E:** `silkskyair-manager/e2e/manager-partner-create.spec.ts` — fill required fields only (name, slug, status), save, assert drawer remains in edit mode with values populated, assert URL = `?partner=<id>`.
- **Complex Happy Path E2E:** `silkskyair-manager/e2e/manager-partner-create-full.spec.ts` — fill every field including location coordinates, commission %, logo upload; save; refresh page; assert all fields re-populated from server; re-edit one field and re-save; assert the edit persists.
- **User manual:** `manual/07-manager-partner-create.md` (slug `partner-create`) — walks ops through creating a new partner end-to-end, with screenshots of empty form → filled → after-save edit state → re-opened partner record.
- **Acceptance gate:** verify pass OR fix-in-place + both e2e specs green + manual page + screenshots.

### F1.2 — Invitation email From identity [R2]
- **Audit state:** ❌ Not started. `workflows/notifications/invitation-email.json` uses config-driven `zoho_mail_from_address` only.
- **Code changes:**
  1. `silkskyair-api/supabase/migrations/<TS>_email_templates_from_name.sql` (NEW) — add nullable `from_name text` column to `i18n.email_templates` (or wherever the template table lives — confirm via R2-T0 investigation first); UPSERT `from_name = 'Silk Sky Partner Portal'` on the invitation template row.
  2. `silkskyair-workflows/workflows/notifications/invitation-email.json` — extend the email send node so `fromName` reads the template's `from_name` field with fallback to `Silk Sky Air`. Add `from_name` to the upstream Supabase query.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/r2-invitation-from-name.spec.ts` (cross-repo) — trigger a partner-user invitation via Manager UI on staging; poll Mailpit/Mailcatch for the message; assert `From` header = `Silk Sky Partner Portal <system@silkskyair.com>`.
- **Complex Happy Path E2E:** same file, second test — trigger invitation for a different template (e.g. amendment-approved-member), assert that template's `from_name` is used; trigger one with `from_name IS NULL`, assert fallback applies.
- **User manual:** `manual/08-manager-invitation-from-name.md` — explains the new behaviour to ops ("invited users now see 'Silk Sky Partner Portal' as sender"); shows before/after screenshots of received email; explains how to override `from_name` per template via DB.
- **Acceptance gate:** migration applied to staging + e2e green + manual page.

### F1.3 — Role-label humanization [R3]
- **Audit state:** ❌ Not started. `silkskyair-partner/lib/auth/roles.ts` does not exist.
- **Code changes:**
  1. NEW `silkskyair-partner/lib/auth/roles.ts` — export `formatRoleLabel(role: string, i18n: I18n): string`; tries `i18n(\`team.role.\${role}\`)`, falls back to title-cased role with underscores split.
  2. `silkskyair-partner/components/team/team-table.tsx:74-75` — replace local helper with import.
  3. `silkskyair-partner/components/team/pending-invitations.tsx:49-50` — same.
  4. `silkskyair-partner/components/team/team-member-drawer.tsx:235` — replace inline call with `formatRoleLabel(member.role, i18n)`.
  5. `silkskyair-account/<TBD via X0-T1 investigation>` — apply the same helper to the Create-Account page chip (R3-T5).
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-team-role-labels.spec.ts` — sign in → /team → assert no row renders raw `organization_manager` / `member` / `support` strings; assert chips read "Manager" / "Member" / "Support".
- **Complex Happy Path E2E:** `silkskyair-account/e2e/account-create-from-invitation.spec.ts` — fetch an invitation URL via API helper → open the Create-Account page → assert chip reads "Manager" (not `organization_manager`); also test for Member / Support invitations.
- **User manual:** `manual/09-partner-team-role-labels.md` — explains that role labels now consistently read in plain English everywhere ops surfaces them; shows screenshots of /team, drawer, Create-Account page.
- **Acceptance gate:** helper + 4 call-site swaps + Account-side fix + both e2e green.

### F1.4 — Members → Clients terminology [R4]
- **Audit state:** ❌ Not started. No migration in `silkskyair-api`.
- **Code changes (consolidated as Batch A1 — see also F1.7/F1.8/F1.9/F1.11):**
  1. `silkskyair-api/supabase/migrations/20260513120000_review_rename_keys.sql` — UPSERT `i18n.entries`:
     - `sidebar.members`: EN "Clients" / TH "ลูกค้า" / RU "Клиенты"
     - `members:page.title`: same
     - `members:page.subtitle`: "Manage your registered clients" + translations
     - `members:actions.create`: "Add Client"
  2. `silkskyair-manager/lib/modules/registry.ts:116` — `label: "Members"` → `"Clients"`.
  3. `silkskyair-manager/app/(workspace)/members/_components/members-manager.tsx:70` — `label: "All Members"` → `"All Clients"`.
  4. `silkskyair-manager/app/(workspace)/members/_components/members-manager.tsx:338` — `<p>Members</p>` → `<p>Clients</p>`.
- **Note:** R4-T6 (Manager-side) was missing from Notion per audit; **create a new Notion task before starting** so the W23 view reflects it.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-clients-rename.spec.ts` — sign in → assert sidebar reads "Clients" not "Members"; visit `/members`; assert page heading + Add Client button.
- **Complex Happy Path E2E:** `silkskyair-manager/e2e/manager-clients-rename.spec.ts` — sign in → sidebar + Members page heading both read "Clients"; switch locale (en → th → ru) and assert the localized strings are correct.
- **User manual:** `manual/10-partner-clients-terminology.md` — explains the terminology change ("we now say Clients everywhere — same data, new word"); screenshots of partner sidebar, manager sidebar, member-detail page.
- **Acceptance gate:** A1 migration applied + manager JSX edits + both e2e green + manual.

### F1.5 — Dashboard cleanup (hide Reporting/Commission cards) [R5]
- **Audit state:** ❌ Not started. `silkskyair-partner/app/home/page.tsx:7` still imports `ReportingWidget`, `:77` still mounts it, `:75` still `lg:grid-cols-3`.
- **Code changes:** `silkskyair-partner/app/home/page.tsx`
  - Comment out `import { ReportingWidget } from "@/components/home/widgets/reporting-widget"` at line 7.
  - Comment out the `<ReportingWidget … />` JSX at line 77.
  - Change `lg:grid-cols-3` → `lg:grid-cols-2` at line 75.
  - Comment out `fetchPerformance` callback + `useEffect` at lines 36-47 so no dead fetch fires.
  - Leave `reporting-widget.tsx` itself untouched for future re-enablement.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-dashboard-no-reporting.spec.ts` — sign in → /home → assert `[data-testid="reporting-widget"]` (or whatever selector exists) is not in the DOM; assert two visible widgets, not three.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-dashboard-layout.spec.ts` — sign in at 1440×900 → assert grid `data-cols="2"`; resize to 768 → assert single column reflow; reload → assert no network call to performance endpoint fires (network-spy assertion).
- **User manual:** `manual/11-partner-dashboard-cleanup.md` — explains why Commission Rate + Performance Overview were temporarily removed (pre-launch confusion about commission expectations); states the commission rate is still applied server-side and communicated by email per month.
- **Acceptance gate:** code + both e2e + manual.

### F1.6 — Available Tours widget [R6] ✅ DONE
- **Audit state:** ✅ Done. Spec answered in the W23 close-out session (layout: take AgreementWidget slot; list: all active tours, vertical scroll in fixed-height card; card: hero image + gradient fallback; CTAs on hover: Book Tour / Copy Link / Open Tour with Book Tour pre-selecting the tour in the wizard).
- **Code changes:**
  1. `silkskyair-partner/app/api/tours/route.ts` — joined `tour_media role='hero'`, generated a 1 h signed URL per tour, surfaced `heroUrl` in the response.
  2. NEW `silkskyair-partner/components/home/widgets/available-tours-widget.tsx` — widget + `useAvailableTours` hook.
  3. `silkskyair-partner/app/home/page.tsx` — replaced `AgreementWidget` with `AvailableToursWidget` (Agreement import commented + reason noted).
  4. `silkskyair-partner/components/bookings/create/create-booking-drawer.tsx` — `useEffect` hydrates `resolvedTour` from `/api/tours` when the wizard opens cold with `?tour=<slug>`, so step 4 (review) gets the data it needs.
  5. `silkskyair-partner/lib/bookings/types.ts:TourSummary` — added optional `heroUrl`.
  6. `silkskyair-partner/.env.example` — added `NEXT_PUBLIC_WWW_URL` documentation block.
  7. Migration `20260528140000_partner_available_tours_i18n.sql` — 6 keys × EN/TH/RU under `partner.dashboard.availableTours.*`.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-available-tours-simple.spec.ts` — widget mounts on `/home` with heading + at least one tour row. Green.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-available-tours-full.spec.ts` — hover reveals all 3 CTAs; Copy Link writes the expected `/tour/<slug>` URL to the clipboard + shows the "Link copied" chip; Open Tour spawns a new tab on the same URL; Book Tour navigates to `/bookings?create=true&tour=<slug>`. Green.
- **User manual:** `silkskyair-docs/manuals/domains/partners/available-tours.md`.
- **Acceptance gate:** code + migration + both E2E + manual — ALL GREEN.

### F1.7 — "Invite Member" → "Invite Team" [R7]
- **Audit state:** ❌ Not started. `silkskyair-partner/app/team/page.tsx:170` still has `i18n("team.invite") || "Invite Member"`.
- **Code changes:**
  1. Folded into Batch A1 migration — UPSERT `i18n.entries` `settings:team.invite` = "Invite Team" (+ TH/RU).
  2. `silkskyair-partner/app/team/page.tsx:170` — change fallback string `"Invite Member"` → `"Invite Team"`.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-team-invite-rename.spec.ts` — sign in → /team → assert button reads "+ Invite Team".
- **Complex Happy Path E2E:** same file second test — open Invite dialog → fill email → send → assert success toast + new pending invite row appears with role chip "Manager"/"Member"/"Support".
- **User manual:** Folded into `manual/12-partner-team-management.md` (covering F1.3 + F1.7 + F1.8 together since they're all team-page surface fixes).
- **Acceptance gate:** A1 migration row + JSX fallback string + both e2e + (shared) manual.

### F1.8 — i18n leak fixes (archived/save/finalPriceNote) [R8 + R11]
- **Audit state:** ❌ Not started. `extras-step.tsx` still has the `<p>` referencing `create.finalPriceNote`.
- **Code changes:**
  1. Batch A1 migration row — `settings:team.status.archived` = "Archived" (+ TH/RU).
  2. `actions.save` — verify the existing row at migration `20260217100000_member_module.sql:247` covers the leak case (audit confirms it does); R8-T2 collapses to verification only.
  3. `silkskyair-partner/components/bookings/create/extras-step.tsx:213-216` — **delete** the `<p className="text-center text-xs text-foreground/40">{i18n("create.finalPriceNote")}</p>` block per plan decision.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-i18n-no-leaks.spec.ts` — crawl the happy path (sign-in → /home → /bookings → /team → /members → /bookings/new through all 5 steps) and assert no DOM text matches the regex `/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/` (raw i18n key pattern).
- **Complex Happy Path E2E:** same file second test — switch locale to TH then RU and re-run the crawler; assert zero raw-key leaks in either locale.
- **User manual:** Folded into `manual/12-partner-team-management.md` (covers the team drawer fix); finalPriceNote is silent — no manual mention needed.
- **Acceptance gate:** A1 rows + JSX deletion + both e2e + manual.

### F1.9 — Booking stepper + Submit Booking [R9 + R10]
- **Audit state:** ❌ Not started.
- **Code changes:** Batch A1 migration rows:
  - `bookings:create.step4` = "Shared/Private Flight" / TH "เที่ยวบินแบบใช้ร่วม/ส่วนตัว" / RU "Совместный/Частный рейс"
  - `bookings:create.confirm` = "Submit Booking" / TH "ส่งการจอง" / RU "Отправить заявку"
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-create-booking-stepper-labels.spec.ts` — open Create Booking drawer → assert stepper reads `1) Select Tour · 2) Select Date & Time · 3) Contact & Passengers · 4) Shared/Private Flight · 5) Review & Confirm`; on step 5 assert CTA reads "Submit Booking".
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-create-booking-full.spec.ts` — drive the entire create-booking flow end-to-end (tour → date+slot → contact → sharing → review → submit) including a shared-flight toggle test; assert final success state + assert no raw i18n keys at any step.
- **User manual:** `manual/13-partner-create-booking.md` — walks partner staff through creating a booking on behalf of a client; covers all 5 steps incl. the new stepper labels and submit CTA.
- **Acceptance gate:** A1 rows + both e2e + manual.

### F1.10 — Passenger nationality + weight save fix [R12]
- **Audit state:** ❌ Not started. Nationality is still `<input type="text">` in `passenger-card.tsx`.
- **Code changes:**
  1. R12-T0 (investigation): determine if a fuzzy-selector component exists in `silkskyair-partner/components/ui/` (search for `combobox`, `autocomplete`). If yes → reuse; if no → plain `<select>` sorted by country name.
  2. NEW `silkskyair-partner/app/api/countries/route.ts` — GET returns `{ code, name }[]` from `public.countries` (RLS permits public SELECT per `20260211120000:15-17`).
  3. NEW `silkskyair-partner/lib/hooks/use-countries.ts` — fetches once, caches in module scope.
  4. `silkskyair-partner/components/bookings/passenger-card.tsx:262-269` — replace `<input>` for nationality with `<select>` (or fuzzy selector). Bind value = ISO-2 code.
  5. Verify weight field validation accepts positive numbers (already numeric per audit; R12-T3 is verification-only).
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-passenger-edit-nationality.spec.ts` — open existing booking → Edit Passenger → change nationality from blank to "Thailand" → save → assert success toast; reload page → assert nationality persists as "Thai" / "Thailand".
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-passenger-edit-full.spec.ts` — edit all editable fields of a passenger (name, DOB, nationality via select, weight as number, gender); save; reload; assert every field persists; also edit weight to `0` and assert validation rejects.
- **User manual:** `manual/14-partner-edit-passenger.md` — covers the nationality-picker change and how partner staff resolve the previous FK error.
- **Acceptance gate:** investigation done + endpoint + selector swap + both e2e + manual.

### F1.11 — Payment terminology (Full / Net) [R13 + R14]
- **Audit state:** ❌ Not started.
- **Code changes:** Batch A1 migration rows:
  - `bookings:payment.directPayment` = "Full Payment" / TH "ชำระเต็มจำนวน" / RU "Полная оплата"
  - `bookings:payment.indirectPayment` = "Net Payment (after deducting commission)" / TH "ชำระสุทธิ (หักค่าคอมมิชชั่นแล้ว)" / RU "Чистая оплата (после вычета комиссии)"
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-payment-terminology.spec.ts` — open a booking with `payment_collected_by='direct'` → assert all payment-area labels read "Full Payment"; open one with `payment_collected_by='indirect'` → assert "Net Payment …".
- **Complex Happy Path E2E:** same file second test — toggle locale en→th→ru on both booking types; assert localized strings in all 6 cases.
- **User manual:** Folded into `manual/15-partner-payment-flow.md` (covers F1.11 + F1.12 + F1.13 + F1.14 — the full payment surface).
- **Acceptance gate:** A1 rows + both e2e + (shared) manual.

### F1.12 — Commission breakdown — WHT row + math [R15 + R16]
- **Audit state:** ❌ Not started. `commission.ts:142` still adds `+ withholdingTax`; `booking-payment-section.tsx:131-133` renders WHT unconditionally.
- **Code changes:**
  1. `silkskyair-partner/lib/bookings/commission.ts:142` — for the indirect branch, replace `netToOperator = round2(totalInclVat - commission - vatOnCommission + withholdingTax)` with `netToOperator = round2(totalInclVat - commission - vatOnCommission)`. (For 28000 / 10% indirect: `netToPartner = 2616.82`, `netToOperator = 25383.18`.)
  2. `silkskyair-partner/lib/bookings/__tests__/commission.test.ts` — add/update vitest cases covering both arms.
  3. `silkskyair-partner/components/bookings/booking-payment-section.tsx:131-133` — wrap WHT `<BreakdownRow>` in `{data.paymentCollectedBy === "direct" && (…)}`.
  4. `silkskyair-partner/app/api/bookings/[id]/payments/intent/route.ts:218-239` — mirror the fix on server settlement so `booking_commission_settlements` rows for indirect have `withholding_tax = 0` and `net_to_partner = commission + vat_on_commission`. (Pure side-effect of #1 if the route calls into `commission.ts`; verify and adjust.)
  5. (Optional) `silkskyair-api/supabase/migrations/<TS>_commission_indirect_check.sql` — DB CHECK constraint: `payment_collected_by = 'indirect' ⇒ withholding_tax = 0`.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-commission-breakdown-direct.spec.ts` — open a direct-payment booking → expand breakdown → assert rows: Total / VAT / Service excl. VAT / Commission / WHT (3%) / Net to Partner / Net to Operator; assert numbers match `lib/bookings/commission.ts` output for a known input.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-commission-breakdown-indirect-no-wht.spec.ts` — open an indirect-payment booking with 28,000 THB at 10% → expand breakdown → assert NO WHT row in DOM; assert `Net to Partner = 2,616.82 THB`, `Net to Operator = 25,383.18 THB`; verify same numbers in `booking_commission_settlements` row via API.
- **User manual:** Folded into `manual/15-partner-payment-flow.md` (commission section).
- **Acceptance gate:** code + vitest + server mirror + both e2e + manual.

### F1.13 — Pay-with-Card enablement [R17 + R18]
- **Audit state:** ⚠️ Partial. Omise SDK loader has `onLoad`/`onError`; missing 5s timeout + visible inline error. Env vars not provisioned (X0-T4 gated).
- **Code changes:**
  1. `silkskyair-partner/components/bookings/payment-checkout.tsx:337-342` — add 5-second timeout that flips `omiseLoaded=true` to `omiseError="Omise SDK failed to load"`; render inline error banner above Pay-with-Card button when `omiseError` set.
  2. `silkskyair-partner/.env.example` — add `OMISE_PUBLIC_KEY=` and `OMISE_SECRET_KEY=` placeholders with a comment pointing at the Omise dashboard.
  3. **Manual prereq (X0-T4):** provision `OMISE_PUBLIC_KEY` + `OMISE_SECRET_KEY` in `silkskyair-partner` Vercel project for both staging and production.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-pay-with-card-direct.spec.ts` — sign in → open unpaid direct-payment booking → Pay → Credit Card → enter test card `4242 4242 4242 4242` → complete 3DS → assert booking flips to Paid.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-pay-with-card-indirect.spec.ts` — same flow for indirect; also test the SDK-failure path by mocking `window.OmiseCard` to throw and asserting the inline error banner appears within 5s.
- **User manual:** Folded into `manual/15-partner-payment-flow.md` (card-payment section). Mention the `OMISE_PUBLIC_KEY` env provisioning note in the ops appendix.
- **Acceptance gate:** code + env provisioned in Vercel + both e2e + manual section.

### F1.14 — TOTAL AMOUNT + PromptPay parity on Indirect [R19]
- **Audit state:** ❌ Not started. Both `payment-checkout.tsx:345` (TOTAL AMOUNT) and `:460` (PromptPay amount) are still gated by `paymentCollectedBy === "direct"`.
- **Code changes:**
  1. `silkskyair-partner/components/bookings/payment-checkout.tsx:345-353` — remove the `paymentCollectedBy === "direct" &&` wrapper around TOTAL AMOUNT card so both flows show it.
  2. `silkskyair-partner/components/bookings/payment-checkout.tsx:460-464` — same removal around PromptPay amount display.
  3. Add PR note: existing comment at `:344` ("hide net amounts for customer privacy") is overridden by R19 decision.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-indirect-total-amount.spec.ts` — open Indirect Payment dialog → assert TOTAL AMOUNT card visible with correct value.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-indirect-promptpay.spec.ts` — open Indirect Payment → switch to PromptPay → assert amount value visible alongside QR; complete payment with PromptPay simulator (or mocked webhook) → assert booking flips to Paid.
- **User manual:** Folded into `manual/15-partner-payment-flow.md` (indirect-payment section, with screenshots of both dialogs side-by-side).
- **Acceptance gate:** code + both e2e + manual section.

### F1.15 — Back-office cancellation notification [R20]
- **Audit state:** ❌ Not started across all repos. Plan needs an 8-task fan-out.
- **Code changes:**
  1. R20-T0 (investigation): confirm current cancellation event lifecycle — what triggers fire when `booking_events.event_type = 'BookingCancellationRequested'`.
  2. `silkskyair-api/supabase/migrations/<TS>_notification_on_cancellation.sql` (NEW) — trigger on `booking_events` AFTER INSERT WHERE `event_type='BookingCancellationRequested'` inserts one row per recipient into `account.notifications` (recipients: all `organization_users` with `module:bookings:access` privilege). Register `booking.cancellation_requested` in `account.event_types`.
  3. NEW `silkskyair-manager/components/home/notification-bell.tsx` — bell icon + unread count + dropdown; subscribes via Supabase Realtime to `account.notifications` (REPLICA IDENTITY FULL already set per `20260308100000:91`).
  4. NEW `silkskyair-manager/app/api/notifications/route.ts` — GET (list unread), PATCH (mark-read).
  5. Mount `<NotificationBell />` in `silkskyair-manager/components/home/header.tsx`; surface inbound notifications as toasts via existing `lib/toast-emitter.ts`.
  6. NEW `silkskyair-workflows/workflows/notifications/cancellation-manager-email.json` — webhook trigger → DB query for manager-role recipients → email template with booking ref + reason.
  7. NEW `silkskyair-workflows/workflows/notifications/cancellation-customer-email.json` — webhook trigger → email customer (lead pax) confirming the cancellation request was received.
  8. `silkskyair-partner/app/api/bookings/[id]/cancel/route.ts` — after RPC succeeds, call both n8n webhooks (`POST` to `cancellation-manager-email` + `cancellation-customer-email` URLs from env).
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-cancel-booking-simple.spec.ts` — partner cancels a confirmed booking with reason "test cancellation" → assert success toast + booking event timeline shows `CancellationRequested`.
- **Complex Happy Path E2E:** `silkskyair-www/tests/e2e/r20-cancellation-fanout.spec.ts` (cross-repo) — partner cancels a booking → assert (a) `account.notifications` row exists for at least one manager user, (b) NotificationBell on `silkskyair-manager` shows unread count incremented within 5s of cancel, (c) manager email arrived in Mailpit, (d) customer confirmation email arrived in Mailpit.
- **User manual:** `manual/16-manager-notification-bell.md` (slug `notification-bell`) — explains the new notification bell, what events fire it, how to mark as read; screenshots of unread state, opened dropdown, after-mark-read.
- **Acceptance gate:** migration + 7 code changes + both workflows synced to local n8n + both e2e + manual + screenshots.

### F1.16 — Email verification popup [R21]
- **Audit state:** ❌ Not started (except R21-T7 — Member-side `/verify` page already ships per `silkskyair-member/app/(public)/verify/page.tsx` from 2026-02-12).
- **Code changes (all in `silkskyair-manager` per Notion):**
  1. R21-T1: NEW or extend `components/bookings/booking-card.tsx` — show verified-email icon when `booking_verifications.verified_at IS NOT NULL`; clickable when null → opens drawer.
  2. R21-T2: NEW `components/bookings/verification-drawer.tsx` — side drawer with 6-digit OTP input (auto-advance / paste-fill), Verify CTA, error state, "Send new code" link.
  3. R21-T3: `app/(workspace)/bookings/[bookingId]/page.tsx` — read `?verify=open` query string and auto-open the drawer.
  4. R21-T4: NEW `app/api/bookings/[id]/verification/route.ts` — POST receives `{ otp }`, calls existing `silkskyair-api/supabase/functions/verify` edge function with `entity_type='booking', entity_id, method='otp', otp`; returns `{ verified, error? }`.
  5. R21-T8: role gate the POST route — only `booking_manager`/`organization_manager` may call it.
  6. R21-T6: NEW `silkskyair-workflows/workflows/notifications/booking-verification-email.json` — sends OTP email to the lead-pax address (re-uses existing `booking_verifications.otp` plaintext window from the DB trigger).
- **Verification (R21-T7 pre-existing):** confirm `silkskyair-member/app/(public)/verify/page.tsx` handles `?token=<HMAC>&bookingId=<id>` arrivals from magic-link properly — assert HMAC verifies, booking marked verified, member redirected to booking detail.
- **Simple Happy Path E2E:** `silkskyair-manager/e2e/manager-booking-verify-simple.spec.ts` — open unverified booking → click verify icon → drawer opens → enter correct OTP (read from `bookings.metadata.verification.otp` via test helper) → assert success + icon flips to verified.
- **Complex Happy Path E2E:** `silkskyair-manager/e2e/manager-booking-verify-full.spec.ts` — three sub-scenarios: (a) wrong OTP → error state shown, drawer remains open; (b) deep-link `?verify=open` auto-opens drawer; (c) Send-new-code triggers new OTP email + booking marked verified via re-entry; also assert that a non-manager role gets 403 on the POST route.
- **User manual:** `manual/17-manager-booking-verification.md` (slug `booking-verification`) — explains the verified-email icon, when to verify, how to enter the OTP, what to do if customer didn't receive the code.
- **Acceptance gate:** 6 code changes + workflow synced + both e2e + verification of pre-existing /verify page + manual.

### F1.17 — Archive clients [R22]
- **Audit state:** ❌ Not started. Zero "archive" hits anywhere in `silkskyair-partner/{components/members,app/members}`.
- **Code changes:**
  1. `silkskyair-api/supabase/migrations/<TS>_member_profiles_archived_at.sql` (NEW) — `ALTER TABLE public.member_profiles ADD COLUMN archived_at timestamptz`; index on `(archived_at) WHERE archived_at IS NULL`; RPC `api.archive_member(p_member_id uuid)` gated by `rls_has_privilege('module:partner-members:access')` — **one-way**, no `unarchive_member`.
  2. NEW `silkskyair-partner/app/api/members/[id]/archive/route.ts` — POST calls the RPC.
  3. `silkskyair-partner/app/members/page.tsx` — add "Show archived" toggle (default off); filter `WHERE archived_at IS NULL` when off.
  4. `silkskyair-partner/components/members/member-card.tsx` — add Archive action; confirm dialog; on success refetch list; archived rows hidden by default.
- **Simple Happy Path E2E:** `silkskyair-partner/e2e/partner-archive-client-simple.spec.ts` — sign in → /members → find a member → click Archive → confirm → assert row removed from default list.
- **Complex Happy Path E2E:** `silkskyair-partner/e2e/partner-archive-client-full.spec.ts` — archive one client → toggle "Show archived" on → assert archived client visible with archived badge → toggle off → assert hidden again; reload page → assertion holds across reloads (DB-driven); attempt second-time-archive via API → assert idempotent (RPC silently noops or returns 409 — confirm in T1).
- **User manual:** `manual/18-partner-archive-clients.md` (slug `archive-clients`) — explains archive is one-way, what archive means (hidden from default list, still queryable), screenshots of menu → confirm → after-archive empty state.
- **Acceptance gate:** migration + 3 code changes + both e2e + manual.

---

## 3. SoW 2 — Member Portal 1st Review (11 features)

> Branch `claude/mp1-review-w23` per repo. **Lynchpin = F2.6 (MP1-W06).** Phase 1 features can start in parallel; Phase 2 chain serial.

### F2.1 — Check-in disable [MP1-W01]
- **Audit state:** ❌ Not started. `grep -rln CHECKIN-DISABLED-2026-05 silkskyair-member` → 0 hits.
- **Code changes:** Per plan §"MP1-W01" — comment out (block-marker `CHECKIN-DISABLED-2026-05`) the entire check-in tree (15 files) + surgical edits to 3 entry points (booking-detail-content.tsx, [bookingId]/page.tsx, middleware.ts).
- **Simple Happy Path E2E:** `silkskyair-member/e2e/member-no-checkin-simple.spec.ts` — sign in → /bookings/<id> → assert no "Check In Now" green banner, no "Complete Info" yellow banner, no Confirm Check-In button anywhere on the page.
- **Complex Happy Path E2E:** `silkskyair-member/e2e/member-no-checkin-routes.spec.ts` — assert `/bookings/<id>/checkin` returns 404; assert middleware does not redirect to a check-in route; `grep -rln CHECKIN-DISABLED-2026-05 silkskyair-member` returns exactly 15 hits (asserted in test); production build passes.
- **User manual:** `manual/19-member-checkin-removed.md` (slug `member-checkin-removed`) — short page explaining check-in is not part of Phase 1; what staff tell customers who ask about boarding pass / check-in.
- **Acceptance gate:** all markers in place + both e2e + manual.

### F2.2 — Magic-link only auth [MP1-W02]
- **Audit state:** ❌ Not started. `lib/auth/url-context.ts` doesn't exist; sign-in form has no `magicLinkOnly` prop.
- **Code changes:** Per plan §"MP1-W02" — NEW `lib/auth/url-context.ts`; extend `components/auth/sign-in-form.tsx` with `magicLinkOnly` prop; update `app/(auth)/sign-in/page.tsx` to read `redirect_to` and pass prop. Default `magicLinkOnly=true` for member portal.
- **Simple Happy Path E2E:** `silkskyair-member/e2e/member-magic-link-simple.spec.ts` — visit `/sign-in` → assert no password field, no Forgot Password link, no Sign In button; assert only Email field + "Send magic link" button visible.
- **Complex Happy Path E2E:** `silkskyair-member/e2e/member-magic-link-full.spec.ts` — visit `/sign-in?redirect_to=/bookings/xyz` → submit email → assert magic-link email arrived in Mailpit → extract HMAC token → visit `/api/auth/verify?token=<token>` → assert redirect to `/bookings/xyz` with session cookie set.
- **User manual:** `manual/20-member-magic-link-auth.md` (slug `member-magic-link`) — explains members log in by email link only; covers how to handle "didn't get the email" support requests.
- **Acceptance gate:** code + both e2e + manual.

### F2.3 — Positive-number weight [MP1-W03] — **CROSS-APP** ✅ DONE

**Scope update (W23 in-flight):** F2.3 was cross-app, not member-only. The Partner Portal already shipped `<input type="number">` for weight a few releases ago but the schema kept the FK to `weight_ranges`; partners typing a number got a 500. F2.3 landed the schema + both apps' validation together. **Now fully closed**: partner side (migration `20260528120000_passenger_weight_numeric.sql` + PATCH validation in `silkskyair-partner/app/api/bookings/[id]/passengers/[passengerId]/route.ts`) + member side (UI swap in `passenger-edit-drawer.tsx` + `validateWeight()` + PATCH validation) + member E2E specs (simple + complex, both green) + manual `silkskyair-docs/manuals/domains/members/passenger-weight.md`.

#### Original plan below:

- **Audit state:** ❌ Not started.
- **Code changes:** Per plan §"MP1-W03" — replace `WeightRangeSelector` in `app/(workspace)/bookings/_components/passenger-edit-drawer.tsx` with `<input type="number" min="0" max="250" step="0.1">`; update `lib/modules/bookings/passenger-validation.ts:validateWeight()` from bucket-id to positive-numeric; capture Advance Aviation rationale (deferred to F2.11).
- **Simple Happy Path E2E:** `silkskyair-member/e2e/member-weight-edit-simple.spec.ts` — sign in → /bookings/<id> → edit passenger → enter `72.5` → save → reload → assert weight = "72.5 kg".
- **Complex Happy Path E2E:** `silkskyair-member/e2e/member-weight-edit-validation.spec.ts` — assert rejection for `0`, negative numbers, non-numeric input, > 250; assert valid numbers including decimals save and persist.
- **User manual:** `manual/21-member-passenger-weight.md` (slug `member-passenger-weight`) — short page for ops; explains why exact weight (Advance Aviation safety req); shows the new numeric field.
- **Acceptance gate:** code + both e2e + manual.

### F2.4 — Add-passenger Paid/Due/Total [MP1-W04] ✅ DONE
- **Audit state:** ✅ Done. Balance helper landed, API extended, modal rows live, both E2E green, manual published, shared PaxCounter gained data-action attrs for tests.
- **Code changes:** Per plan §"MP1-W04":
  1. ✅ NEW `lib/modules/bookings/balance.ts` — `computeBookingBalance(bookingId): { total, paid, due, currency }`. Sums `booking_price_components.amount` (THB major units) for total, `payment_intents.amount / 100` filtered to `status='successful'` for paid, due = max(0, total − paid). Throws on mixed-currency components.
  2. ✅ `/api/bookings/[bookingId]/add-passenger-pricing/route.ts` now calls the helper and returns `paidAmount` + `dueAmount` alongside the existing `currentTotal`.
  3. ✅ `app/(workspace)/bookings/_components/add-passenger-modal.tsx` — Paid + Due rows added between Additional cost and the New estimated total. Container tagged `data-section='add-passenger-pricing'`; rows tagged `data-row='cost-per-pax' / 'additional' / 'paid' / 'due' / 'new-total'`. Hidden when fields are undefined (back-compat).
  4. ✅ i18n: `bookings.addPassengers.paid` + `.due` in `en.json` / `th.json` / `ru.json`.
  5. ✅ AddPassengerGhostCard gained `data-action="open-add-passenger-modal"` for stable E2E selection.
  6. ✅ `silkskyair-ui/src/components/pax-counter.tsx` — PaxCounter wrapper gets `data-pax-counter="<label>"`, buttons get `data-action="pax-counter-increment|decrement"` + accessible `aria-label`. Generic instrumentation; usable by any spec that drives a stepper. UI package rebuilt (`pnpm build`).
- **Simple Happy Path E2E:** ✅ `silkskyair-member/e2e/member-add-passenger-simple.spec.ts` — sign in via real magic-link flow → /bookings/<seeded id> → click ghost card → wait for dialog → assert all 5 data-row attrs visible with numeric currency values. Green.
- **Complex Happy Path E2E:** ✅ `silkskyair-member/e2e/member-add-passenger-full.spec.ts` — seeds a confirmed shared-flight booking (total ฿17,000, paid ฿17,000) → reads the pricing API to capture canonical per-pax cost → opens modal → asserts every row's exact THB formatting at default (adults=1) → clicks Adults `+` → asserts additional + new-total scale; Paid + Due rows stay invariant. Green.
- **Test infra:** NEW `silkskyair-member/e2e/fixtures/auth.fixture.ts` (`signInViaMagicLink` extracted from F2.2 complex spec, `uniqueE2eEmail`) and NEW `silkskyair-member/e2e/fixtures/supabase.fixture.ts` (`seedConfirmedBooking` — provisions member_profile + member_account + bookings + price_components + events walked to BookingConfirmed + successful payment_intent; clears trigger-inserted artefacts so the math is deterministic). `playwright.config.ts` now also loads `.env.local` so the fixture sees `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- **User manual:** ✅ `silkskyair-docs/manuals/domains/members/add-passenger-pricing.md` — explains the 5 rows, why Paid + Due matter, edge cases (private charter, zero-paid, missing tour), and a support-staff playbook for the most common "why is the modal asking for more money" questions.
- **Acceptance gate:** balance helper + API extension + UI rows + both e2e + manual — ALL GREEN.

### F2.5 — Customer change-request confirmation emails [MP1-W05]
- **Audit state:** ❌ Not started. Templates not in `bookings-event.json`.
- **Code changes:** Per plan §"MP1-W05":
  1. `silkskyair-api/supabase/migrations/<TS>_member_amendment_received_templates.sql` (NEW) — UPSERT two new template rows: `booking-change-request-received-member-date-time`, `booking-change-request-received-member-add-passenger` (follow layout of existing `booking-change-request-approved-member`).
  2. `silkskyair-workflows/workflows/bookings/bookings-event.json` — extend `prepare-member-email-data` Switch with new branches on `AmendmentRequested` event sub-typed by amendment kind.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/mp1-w05-amendment-received-emails.spec.ts` (cross-repo) — member submits date-time change request → assert email arrives in Mailpit within 10s with the correct template subject.
- **Complex Happy Path E2E:** same file second test — member submits add-passenger change request → assert different template arrives; also verify subject + body include correct booking ref + requested change details.
- **User manual:** Folded into `manual/23-member-amendments-end-to-end.md` (covers F2.5 + F2.6 + F2.7 + F2.8 together as the amendment lifecycle).
- **Acceptance gate:** migration + workflow + both e2e + (shared) manual section.

### F2.6 — Booking status state machine [MP1-W06] ← **LYNCHPIN**
- **Audit state:** ❌ Not started. No `processing` status, no `is_state_changing`, no `PaymentSuccessful` emission in omise.json.
- **Code changes:** Per plan §"MP1-W06" — six new migrations + omise.json edit:
  1. `<TS>_add_processing_status.sql` — INSERT `processing` row into `booking_statuses`.
  2. `<TS>_event_state_changing_flag.sql` — `ALTER booking_event_types ADD COLUMN is_state_changing boolean DEFAULT true`.
  3. `<TS>_payment_lifecycle_event_types.sql` — INSERT `PaymentRequestSent` (transient), `PaymentSuccessful` (transient), `BookingAmended` (audit).
  4. `<TS>_processing_state_transitions.sql` — update `booking_status_from_event_type()` to walk only `is_state_changing=true`; map `BookingAmended` w/ surcharge → `processing`; `BookingPaidInFull` → restore-prior-status.
  5. `<TS>_amendment_approve_payment_request.sql` — update `booking_amendment_approve()` RPC: when surcharge > 0, insert `payment_requests` row, insert `PaymentRequestSent`, transition booking → `processing`.
  6. `silkskyair-workflows/workflows/payments/omise.json` — after `supabase-rpc-success` node (line 260), insert `PaymentSuccessful` event; call a new balance-check RPC that emits `BookingPaidInFull` when `paid == due`.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/mp1-w06-payment-emits-confirmed.spec.ts` (cross-repo) — book + pay one passenger → assert booking events timeline shows `Registered → PaymentSuccessful → BookingPaidInFull → BookingConfirmed`; assert final status = `confirmed`.
- **Complex Happy Path E2E:** `silkskyair-www/tests/e2e/mp1-w06-amendment-lifecycle.spec.ts` — book + pay → request add-passenger amendment → manager approves with surcharge → assert booking flips to `processing`; member pays the surcharge via Omise → assert events `PaymentSuccessful → BookingPaidInFull` → assert status restored to `confirmed`.
- **User manual:** Folded into `manual/23-member-amendments-end-to-end.md`.
- **Acceptance gate:** 6 migrations + omise.json edit + both e2e + manual.

### F2.7 — Payment Successful bug + amendment CTA [MP1-W07]
- **Audit state:** ❌ Not started. Depends on F2.6.
- **Code changes:** Per plan §"MP1-W07" — add `processing` entry to `statusConfig` map in `silkskyair-member/app/(workspace)/bookings/_components/booking-detail-content.tsx:102-134`; add amendment-payment widget (mirror existing `approved` Payment widget at 139-157); fix `lib/modules/bookings/normalizers.ts:205` so `isPaidInFull` returns false when an outstanding `payment_requests` exists; localise `processing` label in i18n.
- **Simple Happy Path E2E:** `silkskyair-member/e2e/member-processing-state-simple.spec.ts` — force a test booking to `processing` via SQL helper → reload member portal → assert badge reads "Payment Required" (or localized) + Pay-now CTA visible.
- **Complex Happy Path E2E:** `silkskyair-member/e2e/member-amendment-pay-flow.spec.ts` — full chain from F2.6 complex flow: amendment approved → assert badge change to "Payment Required" → click Pay-now → land on amendment payment screen (F2.8) → complete payment → assert booking returns to "Confirmed and paid" state.
- **User manual:** Folded into `manual/23-member-amendments-end-to-end.md`.
- **Acceptance gate:** statusConfig + widget + normalizer fix + i18n + both e2e + manual.

### F2.8 — Amendment payment screen + approval email [MP1-W08]
- **Audit state:** ❌ Not started. Depends on F2.6.
- **Code changes:** Per plan §"MP1-W08":
  1. `silkskyair-api/supabase/migrations/<TS>_payment_requests_booking_link.sql` — add FK columns `booking_id` + `amendment_event_id` to `payments.payment_requests`.
  2. NEW `silkskyair-member/app/(workspace)/bookings/[bookingId]/amendments/[paymentRequestId]/pay/page.tsx` — authenticated screen rendering existing `PaymentCheckout` component with the amendment amount + `paymentRequestId`.
  3. `silkskyair-api/supabase/migrations/<TS>_approval_email_payment_link.sql` — UPSERT `booking-change-request-approved-member` template body with `{{amendment_payment_url}}` placeholder.
  4. `silkskyair-workflows/workflows/bookings/bookings-event.json` — construct the URL when firing approval email (using `MEMBER_PORTAL_URL/bookings/<id>/amendments/<paymentRequestId>/pay`).
- **Simple Happy Path E2E:** `silkskyair-member/e2e/member-amendment-pay-page.spec.ts` — navigate directly to `/bookings/<id>/amendments/<pr>/pay` while authenticated → assert page renders with correct amount + booking ref + Pay button.
- **Complex Happy Path E2E:** chained with F2.7 complex; also test that unauthenticated GET to the amendment-pay URL redirects to `/sign-in?redirect_to=...`.
- **User manual:** Folded into `manual/23-member-amendments-end-to-end.md`.
- **Acceptance gate:** 2 migrations + new page + workflow edit + both e2e + manual.

### F2.9 — Manager per-payment rows [MP1-W09]
- **Audit state:** ❌ Not started. Depends on F2.8 (FK columns on payment_requests).
- **Code changes:** Per plan §"MP1-W09":
  1. NEW `silkskyair-manager/app/api/bookings/[bookingId]/payments/route.ts` — returns aggregated list of original payment + amendment payment-requests.
  2. Extend `silkskyair-manager/lib/modules/bookings/payment-links.ts` with `buildPaymentRequestLink(paymentRequestId)`.
  3. `silkskyair-manager/app/(workspace)/bookings/_components/booking-payment-section.tsx` — replace single payment row with list iteration (pattern from `payments-manager.tsx:61-105`).
- **Simple Happy Path E2E:** `silkskyair-manager/e2e/manager-booking-payments-simple.spec.ts` — open a booking with one original payment → assert single payment row with "Paid" badge.
- **Complex Happy Path E2E:** `silkskyair-manager/e2e/manager-booking-payments-amendment.spec.ts` — booking with paid original + unpaid amendment → assert two rows; assert Copy button copies the amendment pay-link to clipboard; assert Open button opens the amendment pay page in new tab.
- **User manual:** `manual/24-manager-per-payment-rows.md` (slug `manager-per-payment-rows`) — explains the new per-payment view for ops; how to identify unpaid amendments; how to share the pay link with the customer.
- **Acceptance gate:** API + helper + UI + both e2e + manual.

### F2.10 — Back-office payment notification [MP1-W10]
- **Audit state:** ⚠️ Partial. Infrastructure exists (`booking-manager-email.json` 414 lines, `bookings-event.json` routes `BookingPaidInFull`/`BookingConfirmed`). Verification only.
- **Verification steps:**
  1. Confirm `silkskyair-workflows/workflows/notifications/booking-manager-email.json` template content is suitable for payment-success notifications (subject, body — review with ops).
  2. Confirm `booking_manager` role membership in production (query `account.organization_users` for users with the role).
  3. Trigger a staging payment end-to-end; capture screenshots of the back-office email received.
- **Code change (only if verification finds template gap):** add or revise the `booking-paid-customer` (or equivalent staff-side template) row.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/mp1-w10-payment-staff-email.spec.ts` — book + pay → assert staff email arrives in Mailpit addressed to a `booking_manager`-role test user.
- **Complex Happy Path E2E:** same file second test — book + pay + amendment + amendment-pay → assert TWO staff emails arrive (original payment + amendment payment), each with correct booking ref + amount.
- **User manual:** `manual/25-manager-payment-notifications.md` (slug `manager-payment-notifications`) — describes when staff get payment-success emails, who's on the recipient list, how to add a user to the `booking_manager` role.
- **Acceptance gate:** verification report + both e2e + manual.

### F2.11 — Booking Status doc + passenger data doc [MP1-W11]
- **Audit state:** ⚠️ Partial. `silkskyair-docs/` repo exists; `docs/booking-status.md` + `docs/passenger-data.md` do NOT exist.
- **Code changes (docs only):**
  1. NEW `silkskyair-docs/docs/booking-status.md` — exhaustive doc per plan §"MP1-W11": status enum, event-type registry, transition rules, transient vs deterministic events, amendment lifecycle, per-payment model, gaps closed by W06/W08, citations into the monorepo files/lines.
  2. NEW `silkskyair-docs/docs/passenger-data.md` (optional) — capture Advance Aviation weight rationale for MP1-P03-03.
- **No e2e tests** (docs).
- **User manual:** `manual/_index.md` should link to `docs/booking-status.md`; manual page `manual/26-ops-booking-status-doc.md` (slug `booking-status-doc`) is a short pointer page for ops: "here's where to find the canonical booking-status doc".
- **Acceptance gate:** both docs written + pointer manual + committed in `silkskyair-docs`.

---

## 4. SoW 3 — Meta Pixel CAPI Integration (6 features)

> Branch `claude/meta-capi-w23` (cut in `silkskyair-www`; for workflows pull existing commits onto a feature branch). **Fastest SoW to close — ship first.**

### F3.1 — FB attribution capture (steps 1+2) [WWW]
- **Audit state:** ❌ Not started. Zero grep hits for `captureFbAttribution`, `fb-attribution`, `fbclid`, `ssa:analytics:fb` in `silkskyair-www/src`.
- **Code changes:** Per plan §"Step 1 + 2":
  1. NEW `silkskyair-www/src/lib/analytics/fb-attribution.ts` — exports `captureFbAttribution()` + `readFbAttribution()`; reads `fbclid` from URLSearchParams, `_fbp`/`_fbc` from cookies, `landing_url` from `window.location.href`; synthesizes `fbc` as `fb.1.<unix_ms>.<fbclid>` if cookie absent but fbclid present; writes once per session to `localStorage['ssa:analytics:fb']`.
  2. `silkskyair-www/src/components/bookings/booking-floating-widget.ts` (around L556) — call `captureFbAttribution()` on first widget mount; call `readFbAttribution()` when booking flow activates and merge into `BookingStore.metadata.analytics`.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-attribution-capture-simple.spec.ts` — visit homepage with `?fbclid=test-w23-simple` → open booking widget → assert `localStorage['ssa:analytics:fb']` contains `fbclid: 'test-w23-simple'` + `landing_url` matches; visit second page → assert localStorage entry unchanged (once-per-session).
- **Complex Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-attribution-capture-full.spec.ts` — three scenarios: (a) `?fbclid` + no `_fbc` cookie → assert synthesized `fbc` format `fb.1.<ts>.<fbclid>`; (b) pre-existing `_fbp` cookie → assert it's captured verbatim; (c) no `?fbclid` + no cookies → assert `readFbAttribution()` returns null and localStorage remains empty.
- **User manual:** Folded into `manual/27-www-meta-capi-attribution.md` (covers F3.1 + F3.2 — the www-side capture pipeline).
- **Acceptance gate:** code + both e2e + (shared) manual section.

### F3.2 — Forward analytics metadata (steps 3+4) [WWW]
- **Audit state:** ⚠️ Partial. `submit.ts` does spread generic `payload.metadata`; the FB-specific `analytics` shape is missing.
- **Code changes:** Per plan §"Step 3 + 4":
  1. `silkskyair-www/src/lib/data/Bookings.ts` — extend `BookingStore.metadata` with optional `analytics?: { fbclid?: string; fbp?: string; fbc?: string; landing_url?: string; captured_at?: string }`.
  2. `silkskyair-www/src/components/bookings/api/bookings.ts` — same shape on `SubmitBookingPayload.metadata`.
  3. `silkskyair-www/src/pages/api/bookings/submit.ts` — fold `payload.metadata.analytics` into `bookingMetadata.analytics` (existing accumulator already carries `partner_slug` / `attribution_source`).
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-forward-simple.spec.ts` — visit `?fbclid=test-fwd-simple` → book → submit → assert `bookings.metadata.analytics.fbclid = 'test-fwd-simple'` via API helper.
- **Complex Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-forward-full.spec.ts` — submit a booking that also has `?partner=foo` + `?fbclid=test-fwd-full` → assert `bookings.metadata` contains BOTH `partner_slug: 'foo'` AND `analytics: { fbclid: 'test-fwd-full', ... }` (no clobbering).
- **User manual:** Folded into `manual/27-www-meta-capi-attribution.md`.
- **Acceptance gate:** 3 file edits + both e2e + manual section.

### F3.3 — BC branch IF + dispatch (step 5) [Workflows]
- **Audit state:** ⚠️ Partial. `call-meta-capi-purchase` dispatch wired with `waitForSubWorkflow: false`; **gating IF node missing** — dispatcher fires for every BC event today.
- **Code changes:** `silkskyair-workflows/workflows/bookings/bookings-event.json`:
  1. On the BC (BookingConfirmed) Switch output, insert a new IF node `if-has-analytics-metadata` between the Switch output and the existing `call-meta-capi-purchase` node.
  2. IF condition: `{{ Object.keys($('fetch-booking').first().json.metadata?.analytics ?? {}).length > 0 }}` (or simpler: `metadata.analytics.fbclid OR metadata.analytics.fbp` exists).
  3. TRUE → `call-meta-capi-purchase` (existing). FALSE → dead end (no dispatch).
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-dispatch-gate-simple.spec.ts` — book without `?fbclid` → assert BC event fires → assert n8n executions log shows `meta-capi-purchase` did NOT run (query n8n REST API).
- **Complex Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-dispatch-gate-full.spec.ts` — book WITH `?fbclid=test-dispatch` → BC event fires → assert `meta-capi-purchase` DID run AND the post-to-meta node returned 200; also re-fire the same BC event (idempotency test) and assert second `meta-capi-purchase` execution returns the Meta dedupe response within 48h.
- **User manual:** Folded into `manual/28-workflows-meta-capi-dispatcher.md` (covers F3.3 + F3.4 + F3.6 — the workflow side).
- **Acceptance gate:** IF node added + sync to local n8n + both e2e + manual section.

### F3.4 — Simplified shared workflow (step 6) [Workflows] — **DONE**
- **Audit state:** ✅ Done. `workflows/marketing/meta-capi-purchase.json` has 10 nodes matching plan; deployed 2026-05-26T08:12:23.871Z.
- **Verification steps (no code change):**
  1. Open `meta-capi-purchase.json` in local n8n → confirm 10 nodes present + names match (`workflow-trigger`, `get-config`, `fetch-booking`, `fetch-payment`, `build-capi-payload`, `if-should-send`, `post-to-meta`, `respond-sent`, `respond-error`, `respond-skipped`).
  2. Confirm credential binding `AAC | SAA | Auth | Meta CAPI` (id `gBlJLpOaFbGNrhFu`).
  3. Manually execute the workflow with `{booking_id: <recent confirmed booking with fbclid>, test_event_code: <Meta-generated>}` → assert response shape `{ status: 'sent', meta_response: {...} }`; assert Meta Events Manager Test Events stream shows the Purchase event with Event Match Quality ≥ 5.
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-workflow-direct-simple.spec.ts` — POST directly to n8n test webhook for `meta-capi-purchase` with a sample payload → assert 200 + `status: 'sent'`.
- **Complex Happy Path E2E:** same file — test the three terminal branches: (a) booking with full FB metadata → `respond-sent`; (b) booking without FB metadata → `respond-skipped`; (c) booking with FB metadata but Meta returns 400 → `respond-error`.
- **User manual:** Folded into `manual/28-workflows-meta-capi-dispatcher.md`.
- **Acceptance gate:** verification done + both e2e + manual section.

### F3.5 — Credential + Test Events verify [Workflows] — **DONE**
- **Audit state:** ✅ Done. Credential `AAC | SAA | Auth | Meta CAPI` (`gBlJLpOaFbGNrhFu`) configured; `N8N_CRED_META_CAPI` in `.env`.
- **Verification steps:**
  1. List credentials in n8n local + staging + production: confirm credential exists with the same name + matching id in each environment.
  2. Confirm the Bearer token value is a valid Meta System User token (test via curl: `curl -H "Authorization: Bearer <token>" https://graph.facebook.com/v20.0/me`).
  3. Document rotation procedure in `silkskyair-docs/docs/meta-capi-ops.md` (NEW) — when token expires, where to regenerate it.
- **No e2e** (manual credential management).
- **User manual:** Add an ops appendix to `manual/28-workflows-meta-capi-dispatcher.md` covering credential lifecycle.
- **Acceptance gate:** credential verified across 3 environments + ops doc written.

### F3.6 — Deploy staging + production [Workflows]
- **Audit state:** ⚠️ Partial. Local deployed (2026-05-26); staging + production deploy not confirmed.
- **Code changes:**
  1. `pnpm -C silkskyair-workflows sync:staging` — push current `meta-capi-purchase.json` + (after F3.3 lands) updated `bookings-event.json` to staging n8n.
  2. Deploy `silkskyair-www` staging via Vercel — pushes F3.1 + F3.2 code.
  3. Smoke test on staging: open `https://staging.www.silkskyair.com/?fbclid=staging-smoke` → book a tour with test card 4242 → confirm Meta Events Manager Test Events stream shows the Purchase event.
  4. `pnpm -C silkskyair-workflows sync:production` + Vercel production deploy.
  5. Production smoke test: same flow on production with test card; verify in real Meta Events Manager (production stream).
- **Simple Happy Path E2E:** `silkskyair-www/tests/e2e/meta-capi-staging-smoke.spec.ts` — run against `STAGING_BASE_URL` env; book with `?fbclid=ci-staging-<run-id>` → assert Meta Events Manager API shows the event (poll up to 60s).
- **Complex Happy Path E2E:** production smoke is manual (don't run e2e against production by default).
- **User manual:** Folded into `manual/28-workflows-meta-capi-dispatcher.md`.
- **Acceptance gate:** staging sync + staging smoke + production sync + production smoke + manual section.

---

## 5. Sequenced execution timeline

```
Day 1 ─ MORNING ────────────────────────────────────────────────────────
   - Cut branches in all 5 SoW1 repos + 5 SoW2 repos + 2 SoW3 repos
   - Start SoW 3 F3.3 (1h): add if-has-analytics-metadata IF node, sync to local n8n
   - Start SoW 3 F3.1 (3h): fb-attribution.ts + widget hook + e2e pair + manual

Day 1 ─ AFTERNOON ──────────────────────────────────────────────────────
   - Finish SoW 3 F3.2 (2h): BookingStore + payload + submit.ts + e2e pair + manual section
   - SoW 3 F3.4 + F3.5 verification (1h): execute against Meta Test Events
   - SoW 3 F3.6 staging deploy + smoke (1h)
   - SoW 3 closes ─ 6 features done, 12 e2e specs green, 2 manual pages committed

Day 2 ─────────────────────────────────────────────────────────────────
   - SoW 2 F2.6 (LYNCHPIN) starts: 6 migrations + omise.json edits
   - SoW 1 Batch A1 starts (in parallel, different operator if possible):
       single migration covering F1.4 + F1.7 + F1.8 + F1.9 + F1.11 + R2-T1 + R20-T1 + R22-T1
   - SoW 2 Phase 1 trim work in parallel: F2.1 (check-in disable) + F2.2 (magic-link) + F2.3 (weight)
       each = code + simple e2e + complex e2e + manual page (1-2h per feature)

Day 3 ─────────────────────────────────────────────────────────────────
   - SoW 2 F2.6 finishes; e2e pair green
   - SoW 2 F2.8 (amendment payment screen) starts
   - SoW 2 F2.11 (docs/booking-status.md) — write in parallel
   - SoW 1 A1 migration applied to staging
   - SoW 1 P2 fan-out begins:
       F1.5 (dashboard cleanup) — 2h with e2e + manual
       F1.10 (passenger nationality) — 4h with investigation + endpoint + e2e + manual
       F1.12 (commission math) — 4h with vitest + server mirror + e2e + manual
       F1.14 (TOTAL AMOUNT parity) — 1h with e2e + manual

Day 4 ─────────────────────────────────────────────────────────────────
   - SoW 2 F2.8 finishes; F2.7 starts (depends on W06+W08)
   - SoW 2 F2.4 (Paid/Due/Total) — independent of W06 chain, can interleave
   - SoW 1 P2 continues:
       F1.3 (role labels) — 3h with helper + 4 swaps + e2e + manual
       F1.13 (Pay-with-Card) — 2h + Vercel env provisioning (blocked on X0-T4)
       F1.16 (R21 verification popup) — 6h with 6 code changes + workflow + e2e + manual + verification of /verify page

Day 5 ─────────────────────────────────────────────────────────────────
   - SoW 2 F2.9 (manager per-payment rows)
   - SoW 2 F2.5 (amendment-received emails)
   - SoW 1 R20 (cancellation notifications) — full fan-out: migration + 3 manager files + 2 workflows + partner trigger + 2 e2e + manual + screenshots
   - SoW 1 F1.17 (archive clients) — full fan-out: migration + RPC + route + UI + e2e + manual

Day 6-7 ───────────────────────────────────────────────────────────────
   - Production deploys
   - Manual screenshot capture pass across all new pages (run pages in staging at 1440×900, capture per step)
   - X0-blocked tasks land if access arrived: F1.2 R2-T3 (invitation From), F1.16 R21-T6 (verification email workflow), F1.13 R17/R18 (Vercel env)
   - W23 QA Notion task created (mirror of W22's "Test pending features — Staging → Production (W22)")
   - Final SoW 2 verification: F2.10 (back-office payment notification) — verify already-existing pipeline + 2 e2e + manual
```

**Critical-path note:** SoW 2 W06 is the longest single block; start it Day 2 morning to give it the full chain through Day 4. Everything else fans out cleanly around it.

---

## 6. Manual table-of-contents update

Append to `silkskyair-docs/manuals/_parent.md`:

```markdown
## Features in this W23 release

| # | App | Feature | SSA/Code |
|---|---|---|---|
| 7  | BackOffice          | Partners — Create form persists after save                       | R1 |
| 8  | BackOffice/Workflows| Invitation email — sender identity                               | R2 |
| 9  | Partner Portal      | Team — role labels in plain English                              | R3 |
| 10 | Partner Portal      | Members → Clients terminology (everywhere)                       | R4 |
| 11 | Partner Portal      | Dashboard — Commission Rate + Performance Overview hidden        | R5 |
| 12 | Partner Portal      | Team Management — Invite Team rename + i18n fixes               | R7+R8 |
| 13 | Partner Portal      | Create Booking — stepper labels + Submit Booking CTA            | R9+R10 |
| 14 | Partner Portal      | Bookings — Edit Passenger (nationality + weight)                | R12 |
| 15 | Partner Portal      | Bookings — Full / Net Payment + WHT + TOTAL AMOUNT + Pay-with-Card | R13-R19 |
| 16 | BackOffice          | Notification Bell — cancellation alerts                          | R20 |
| 17 | BackOffice          | Bookings — verified-email icon + OTP popup                       | R21 |
| 18 | Partner Portal      | Clients — Archive action                                         | R22 |
| 19 | Member Portal       | Check-in removed for Phase 1                                     | MP1-W01 |
| 20 | Member Portal       | Sign-in — magic-link only                                        | MP1-W02 |
| 21 | Member Portal       | Edit Passenger — weight as exact number                          | MP1-W03 |
| 22 | Member Portal       | Add Passengers — Paid/Due/Total pricing                          | MP1-W04 |
| 23 | Member Portal       | Amendments — end-to-end (request → approval → pay)               | MP1-W05/06/07/08 |
| 24 | BackOffice          | Bookings — Per-payment rows                                      | MP1-W09 |
| 25 | BackOffice          | Payment-success staff notifications                              | MP1-W10 |
| 26 | (Ops doc)           | Booking Status — canonical reference                             | MP1-W11 |
| 27 | WebSite             | Meta CAPI — FB attribution capture + forward                     | Meta CAPI |
| 28 | (Ops doc/Workflows) | Meta CAPI — dispatcher + workflow + credentials                  | Meta CAPI |
```

---

## 7. Risks + open questions (carried from v1, refined)

| # | Risk / Q | Affects | Owner | Notes |
|---|---|---|---|---|
| 1 | X0 access grants not in by Day 4 | F1.2 (R2-T3), F1.13 (Vercel), F1.16 (R21-T6 workflow), F1.3 (R3-T5 Account) | client | Mitigation: 80%+ of W23 is unblocked; access-gated tasks slip to W24 if needed without breaking critical path |
| 2 | MP1-W06 `BookingPaidInFull` target semantics | F2.6, F2.7 | Peter | "restore prior" vs literal "Completed"? Affects `booking_status_from_event_type()` |
| 3 | MP1-W03 weight upper bound | F2.3 | Advance Aviation / Peter | Suggest 250 kg sanity cap |
| 4 | R6 Available Tours spec | F1.6 (deferred) | client | Don't start until spec lands |
| 5 | R4-T6 Manager-side rename missing from Notion | F1.4 | self | **Create Notion task before A1 ships** |
| 6 | 11 `[SUPERSEDED]` Meta CAPI tasks pollute W23 view | SoW 3 | self | Archive or strip W23 tag |
| 7 | Meta CAPI System User token rotation cadence | F3.5 | ops | Plan dropped rotation-doc task; write `docs/meta-capi-ops.md` (under F3.5 verification) |
| 8 | Cross-SoW branch hygiene | all | operators | Don't commingle commits across SoWs in one repo |
| 9 | Screenshot capture is a manual end-of-week pass | all manual pages | operator | Block ~half a day on Day 7 for 1440×900 staging captures per page |
| 10 | `silkskyair-member/e2e/` is sparse (1 spec) | SoW 2 e2e | self | Extend `e2e/global-setup.ts` with magic-link, processing-state, amendment-payment helpers BEFORE writing the new specs (per memory rule `reuse_existing_test_infra`) |

---

## 8. Notion task index (W23)

See [`w23-already-done-audit.md`](w23-already-done-audit.md) §6 for the recommended Notion status changes:
- **Mark Done:** Meta CAPI step 6 (`369bd1aa-e1c9-8153-a196-ddee10cb5a7e`), Meta CAPI credential (`369bd1aa-e1c9-8128-a754-fb224187e590`), R21-T7 (`368bd1aa-e1c9-81a7-9156-cdbc4b3b6fdc`).
- **Mark In Progress:** Meta CAPI step 5 (`369bd1aa-e1c9-8134-90f1-c354978e4d66`), MP1-W10 (`368bd1aa-e1c9-813b-92a7-dfad9c6eea4c`), MP1-W11 (`368bd1aa-e1c9-81bb-b532-d758b4658a73`).
- **Create new:** R4-T6 (Manager-side Members→Clients rename).
- **Archive:** 11 `[SUPERSEDED]` Meta CAPI tasks (see Notion search "Meta CAPI" results).

Full task ID index in [`w23-work-plan.md` v1 §6](w23-work-plan.md) — superseded by this v2 but the ID list remains accurate.

---

*End of W23 work plan v2.*
