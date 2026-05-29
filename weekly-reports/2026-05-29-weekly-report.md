# Weekly Report — Week of 2026-05-22 → 2026-05-29

**Scope:** All commits across the `andaman-aerodrome` monorepo (16 sub-repos) for the week 2026-05-22 → 2026-05-29. Author: Peter A. Moelgaard (with Claude pair-programming). Source: git logs across all repos.

**Headline totals:** 116 commits across 11 active repositories. Two large product workstreams ran in parallel — the **Partner Portal Round-3 client-review remediation** (F1.x) and the **Member Portal MP1 (1st-review) kickoff** (F2.x) — alongside booking email verification, end-to-end cancellation notifications, Meta CAPI go-live, a full RU localization pass, and the complete W23 training-manual + screenshot set. All work landed on `develop` (mirrored to `staging`); the staging→production cutover runbook is prepared but not yet executed.

---

## 1. Partner Portal — Round-3 Client-Review Remediation

The week's largest product workstream. The Round-3 partner review produced a slate of line items (R1–R22), mapped to features F1.1–F1.17 and tracked in `plans/w23-work-plan.md`.

- **Create a Partner stays open after Save (F1.1 R1)** — Manager `70b067f`: the partners-create drawer now stays open in edit mode after Save, sets the URL `?partner=<id>`, and rehydrates the same record on refresh; adds an `isDirty` exit gate.
- **Home dashboard cleanup (F1.5 R5)** — Partner `1e30ee9`: ReportingWidget hidden pre-launch; the home page is trimmed to the two day-to-day widgets (Available Tours + Latest Bookings) and no longer fetches performance metrics on load (`R5-DISABLED-2026-05`).
- **Available Tours widget (F1.6 R6)** — Partner `1f56d3b` (Book / Copy Link / Open Tour CTAs, replacing the Agreement widget) + API `df47dd7` (widget i18n).
- **Edit Passenger — nationality + numeric weight (F1.10 R12 / F2.3 MP1-W03)** — Partner `9d281f5` (nationality picker, fixes an FK save bug) + `b3b857f` (`<NationalitySelector>` + numeric weight with validation); API `60720de` (`weight_kg numeric(5,2)` with positive + ≤ 250 kg CHECKs; FK to `weight_ranges` dropped). The Member Portal swapped to the same numeric input.
- **Commission & payment breakdown (F1.12 R15+R16)** — Partner `fca8681`: fixed the per-booking commission math and hides the withholding-tax row on indirect/Net payments.
- **Pay-with-Card (F1.13 R17+R18)** — Partner `499770c`: Omise card payment end-to-end on the booking detail page, surviving the 3-D Secure / `acs=false` bounce by auto-reopening into the same Direct/Net view and resuming polling; `76534c3` added an Omise SDK load watchdog + `.env.example` placeholders. Shared Omise card-form driver in `silkskyair-common` `534b2cd`; `seedUnpaidBooking` test helper `2d283d5`.
- **Net Payment / PromptPay parity (F1.14 R19)** — Partner `2c1c812`: the **TOTAL AMOUNT** card and **PromptPay amount** now render in *both* payment modes (previously Direct-only).
- **Archive a Client (F1.17 R22)** — Partner `db62864` (one-way, idempotent archive UI + a shared Toggle primitive) + API `e3813e5` (`archived_at` + `api.archive_member` RPC, org-ownership gated).
- **Label & terminology relabels (F1.3 / F1.4 / F1.7 / F1.9 / F1.11; R3/R7/R8/R10/R11)** — Partner `1ea63f6` (`formatRoleLabel` helper + 3 call-site swaps, R3), `e3c00ee` ("Invite Team" fallback + drop a `finalPriceNote` leak, R7+R11); BackOffice `042c7b2` (Members → **Clients** in sidebar + page chrome, R4-T6); API `202b619` (batch-rename of partner-portal strings).

---

## 2. Booking Email Verification (F1.16 R21)

Per-booking lead-passenger email verification, spanning Manager UI, the API, and n8n.

- **Manager** `c5f75d5`: verification UI + API — an amber/green badge on booking cards and the detail page, a 6-digit OTP drawer (auto-advance, paste-fill, "Send new code"), and a Manager API proxy to the `verify` edge function.
- **API** `3b0a3e8`: new `booking-verification-otp` email template.
- **Workflows** `81e51d4`: `booking-verification-email` workflow sends the OTP to the lead pax; `e2e2295` fixed the serial chain where `fetch-otp` was being skipped.
- **Status-read fix (M1)** — Manager `de22ec2`: switched the verification status `GET` route from the user-scoped client to the service client — RLS was blocking the badge's status read, so the badge couldn't reflect a completed verification. `0e8a8ee` adds a regression guard for the service-client read. (Both pushed to `origin/develop`.)

---

## 3. Cancellation Flow & In-App Notifications (F1.15 R20)

Partner-initiated cancellations now fan out end-to-end.

- **Manager** `4f9917d`: NotificationBell + global toast host; `f3ac79c`: E2E for the bell + toast (R20-T4); `a3659b3`: bell + dropdown screenshots for the manual.
- **API** `c43beb2`: in-app cancellation notifications for back-office `booking_manager`s; `4aa025e`: customer-side cancellation email template; `36d09b9`: added `account.notifications` to the `supabase_realtime` publication so the bell badge updates live.
- **Workflows** `2ba5c42`: fan out the cancellation to the customer email; `1d9202b`: Switch node routes the canonical `BookingCancellationRequested` event.

---

## 4. Member Portal — MP1 (1st-Review) Kickoff

The first workstreams of the Member Portal 1st-review plan landed.

- **No check-in in Phase 1 (F2.1 MP1-W01)** — Member `1e26abb`: the check-in page, public magic-link entry, and check-in API all return 404; the booking detail page drops the Check In / Complete Info banners. Every touched file carries a `CHECKIN-DISABLED-2026-05` marker for clean Phase-2 reactivation.
- **Magic-link-only sign-in (F2.2 MP1-W02)** — Member `9188695`: `/sign-in` renders an email + Send Magic Link only; password input, Forgot Password, and the password toggle are hidden. Policy centralized in `lib/auth/url-context.ts`. `f48535b`: pass recipient locale to the n8n webhook.
- **Passenger weight numeric (F2.3 MP1-W03)** — Member `96912f3` (swap `WeightRangeSelector` → numeric input + validation) + `c6d9634` (weight-edit + validation E2E).
- **Add-passenger pricing modal (F2.4 MP1-W04)** — Member `044226e`: surface **Paid** + **Due** rows in the pricing modal.
- **Amendment metadata (F2.5 MP1-W05)** — Member `ec20177`: stash `amendment_subtype` in `BookingAmendmentRequested` metadata, feeding the new customer amendment-received email (API `4ff367c`, Workflows `edf13e3`).

---

## 5. Meta Conversions API — Go-Live (F3.1 / F3.2 / F3.3)

Server-side Purchase events for every confirmed booking, with full outcome recording.

- **WWW** `ef3549a`: capture Facebook attribution (`fbclid`/`fbp`/`fbc`) and forward it through booking submission into `client_interactions` (F3.1/F3.2) + UI E2E (F3.3); `e178a80`: flip the comprehensive spec to assert `MetaCapiSent` with a real token.
- **API** `ebc54e2`: add `MetaCapiSent` / `MetaCapiSkipped` / `MetaCapiFailed` booking event types.
- **Workflows** `3c70c68`: gate the Meta CAPI dispatcher on FB attribution + record outcomes; `71f6b76`: meta-capi workflow + credential rotation; `cc70a51`: `record-*` nodes accept empty Supabase responses; `8753614`: register `N8N_WF_MARKETING_META_CAPI_PURCHASE` in the env-mapping registry.
- **Manager** `a77f6dd`: show FB attribution in the booking-detail Client Interaction panel.

---

## 6. i18n & Localization

A full pass on partner-portal strings and localized email delivery.

- **API** `15f0e01`: partner **RU locale backfill — 404 rows across 8 sections**; `63dccde`: finish Members → Clients + fill remaining RU gaps; `24d83bd`: localized `sender_name` column on `email_templates_i18n`; `8bd0de3`: inject recipient locale into the invitation webhook payload.
- **Workflows** `cd16315`: localized SMTP sender display name across 6 email workflows; `e90c4d9`: drop in-workflow recipient-locale lookups (architecture revert — locale is now injected upstream by the API rather than re-resolved inside n8n).
- **Recipient locale plumbing** — Partner `c2a7664` / Manager `a8334a6` / Member `f48535b`: pass the invitee/recipient locale to n8n on invitation-resend and magic-link.

---

## 7. Documentation & Training Manuals

The release precondition: every W23 feature got a manual plus **real captured screenshots**, reorganized into the canonical W22 docs layout. 25 commits in `silkskyair-docs`.

- **New `members` domain + manuals:** no-checkin (`3eeba4a`), magic-link auth (`b811b27`), passenger-weight (`b3d952c`), add-passenger pricing (`ab3e865`), amendment-received emails (`cbfbff9`), payment notifications (`259c2b9`, MP1-W10).
- **Bookings / Partners manuals:** cancellation-flow (`57694f3`), Pay-with-Card (`114a9a0`), edit-passenger (`efa8109`), Available Tours widget (`3ae0e75`), Manager Partner Create (`5cb3549`), Meta CAPI attribution + dispatcher (`7e332a0`).
- **Structure & indexes:** reorganize W23 manuals into the canonical W22 layout (`8783612`), W23 release index (`bf0933d`), feature close-outs (`160e644`, `eab729a`), `render-bodies` script (`e476c51`).

---

## 8. E2E Coverage & Doc-Shot Infrastructure

- **Partner** `56baedd`: doc-shot infrastructure + 5 partner specs; `296f737`: F1.3/F1.4/F1.5/F1.7/F1.11/F1.14 partner-side regression nets; `c12bb64`: F2.5 amendment-received email E2E; `b58b815`: F2.10 BookingConfirmed → manager payment-received email; `5ad4ede`: cancellation email fan-out E2E; `bbb1df4`: `bookings_snapshot` debug-snapshot helper.
- **Common** `5c594d5`: `check-services` health helper; `534b2cd`: shared Omise card-form driver for E2E.
- **Manager** `b279943`: e2e fixtures + Playwright docs config; verification regression guard (`0e8a8ee`).
- **UI** `d62831f`: pax-counter `data-action` + aria-label for E2E testability.
- **WWW** `79868ad`: e2e helper updates + docs e2e harness.

---

## 9. Platform, Release Engineering & Build

- **Bookings-create root-cause fix** — API `87b808d` (RPC envelope replaces a raw PostgREST query) + Workflows `4a5343f` (call `api.get_booking_for_create_workflow` RPC). Paired fix removing a fragile direct-query path from the create flow.
- **Staging build unblock** — Manager `5c2cb3d`: type cast + 6 missing deps so the staging build compiles.
- **Dependency hygiene** — Partner `a6c0d34` / Member `19a5e61`: `silkskyair-ui` range → `"*"` to pick up suffixed prereleases.
- **Account** `d5ae96f`: auth `Image` `sizes` prop + Turbopack workspace root + lockfile regen.
- **Version bumps:** api `1.18.0`, manager `2.6.0`, partner `2.3.0`, workflows `1.3.0`, member `1.3.0`, www `1.3.0`, ui `0.4.0`, docs `0.2.0`.
- `.nvmrc` added across api / www / manager / orchestrator.

---

## 10. Deploy Status (as of 2026-05-29)

Sourced from git branch state across all repos (staging live-health was not probed this week; staging state is inferred from branch sync + the recorded workflow sync).

| Pillar | Local (`develop`) | Staging | Status |
|---|---|---|---|
| Git develop branches | all 11 repos pushed | `develop` == `origin/develop` (0 ahead / 0 behind); local `staging` tracks `develop` (0/0) | ✅ in sync |
| Supabase DB | 8 new W23 migrations (`20260527210000` → `20260529100000`) | applied via branch-monitoring on `staging` | ✅ on develop/staging |
| n8n workflows | W23 changes synced; activeVersionIds recorded (`4a8585b`) | `pnpm sync:staging` run; versions recorded | ✅ |
| Vercel (Manager/Partner/Member/WWW/Account) | develop pushed | auto-deploy from develop/staging | ✅ |
| Production (`main`) | `develop` ahead of `main` — api 62, www 46, manager 44, workflows 40, partner 23, member 12, ui 3, account 2 | not yet released | ⏳ staging→prod runbook prepared (`plans/production-release-2026-05-26.md`), not yet executed |

The production cutover is the next gate: `develop` is in sync with `staging` across every repo, but `main` has not yet received this release. The full step-by-step runbook (deploy order, backups, rollback) lives in `plans/production-release-2026-05-26.md`.

---

## 11. Repo-by-Repo Commit Counts

| Repo | Commits | Theme |
|---|---|---|
| `silkskyair-docs` | 25 | W23 manuals + screenshots + canonical layout + release index |
| `silkskyair-partner` | 21 | Round-3 remediation (pay-with-card, commission, parity, archive, dashboard, Available Tours), doc-shots + regression specs |
| `silkskyair-api` | 17 | OTP / cancellation / amendment email templates, member-archive + weight migrations, RU backfill + label renames, Meta CAPI event types |
| `silkskyair-workflows` | 16 | Verification + cancellation + amendment fan-out, Meta CAPI dispatcher, localized senders, staging sync |
| `silkskyair-manager` | 14 | Email verification, NotificationBell + toast, partner-create UX, Members→Clients, FB attribution, staging build fix |
| `silkskyair-member` | 10 | MP1 kickoff — no-checkin, magic-link, numeric weight, add-passenger pricing, amendment metadata |
| `silkskyair-www` | 7 | Meta CAPI attribution capture + E2E, Toggle consolidation, e2e harness |
| `silkskyair-common` | 2 | Omise card-form driver + check-services helper |
| `silkskyair-ui` | 2 | pax-counter / Toggle testability + release bump |
| `silkskyair-account` | 1 | auth Image / Turbopack config |
| `silkskyair-orchestrator` | 1 | `.nvmrc` |

Quiet repos (no commits in window): `silkskyair-cms`, `silkskyair-config`, `silkskyair-reporting`, `silkskyair-skystories`, `silkskyair-utils`.

---

## Suggested Report Highlights

If you're presenting this to stakeholders:

1. **Partner Portal Round-3 review fully remediated** — Pay-with-Card (Omise 3-D Secure), corrected commission/withholding math, Net Payment + PromptPay parity, one-way client archive, and the Available Tours dashboard, plus the complete Members → **Clients** / Full–Net / Invite Team relabel.
2. **Member Portal MP1 kicked off** — Phase-1 scope locked (no online check-in), magic-link-only sign-in, numeric passenger weight, and add-passenger pricing transparency.
3. **Booking email verification shipped** — per-booking lead-pax OTP with a live status badge (including the RLS service-client read fix that made the badge accurate).
4. **Cancellation flow is now end-to-end** — partner banner → realtime back-office bell + manager email → customer acknowledgement email.
5. **Meta CAPI is live on staging** — server-side Purchase events for every confirmed booking, with per-dispatch outcome recording (`MetaCapiSent/Skipped/Failed`).
6. **Full RU localization pass** — 404 backfilled rows across 8 sections plus localized email sender names.
7. **Complete W23 training-manual set with real screenshots**, in the canonical docs layout — the documentation precondition for the production release is done.
8. **The production release is staged and runbook-ready** — `develop` is in sync with `staging` across all repos; executing `plans/production-release-2026-05-26.md` is the next step.
