# Weekly Statement — 2026-05-23

**Week covered:** 2026-05-15 → 2026-05-22
**Next week:** 2026-05-25 → 2026-05-29
**From:** Peter

---

Hey team — quick recap on what landed this past week and what I'm lining up for next week. I've tried to keep this short and pointed at outcomes you can actually track, rather than a wall of commit messages. The full technical breakdown is in [2026-05-22-weekly-report.md](../weekly-reports/2026-05-22-weekly-report.md) if you want to dig in.

---

## What shipped this week (the value)

Three things actually moved the business forward this week, plus a bunch of plumbing that makes the next few weeks much faster.

### 1. SkyStories editorial pipeline is now production-ready end-to-end

This was the big one. Editorial team can now create a story in the Manager, attach keywords + tours + media in any of EN/TH/RU, hit Publish, and the story shows up on the public site with the right relationships — all three locales, all the media, both keywords and tours linked correctly. That whole chain (Manager → Supabase → n8n → Strapi → public site) used to have at least four places where it could silently drop data. Those are all closed now, with end-to-end tests proving it.

**Why this matters:** the editorial team can start producing real content without me babysitting the pipeline. The test coverage means we'll catch regressions before they hit staging instead of after a content person tells us a story is broken.

### 2. Customers now get a payment confirmation email (SSA-621)

Before this week, customers who paid for a booking got nothing — only the internal manager email fired. They'd then email support asking "did my payment go through?". That's done — they now get a confirmation in EN/TH/RU the moment payment lands. Plus I fixed a separate bug where bookings without customer notes were never sending the manager email either.

**Why this matters:** less inbound "did it work?" support traffic, less anxiety from customers in the gap between payment and the manager actually reaching out.

### 3. Translation completeness for booking notes (SSA-619)

Added TH + RU labels for customer-submitted note types. Small but visible — TH and RU users no longer see English labels mixed into otherwise translated screens.

### Behind-the-scenes (the plumbing)

These don't show up on screens but they save a lot of time:

- **Workflow deploys are now safer.** Added a content-level audit that catches drift between source files and the actual n8n instance (the old version-ID check missed three real drifts this week — Omise had an AND→OR bug, Booking Manager Email was missing the SSA-619 payload, and the Reporting Scheduler had a broken cron interval). Also added `--dry-run` so I can preview every workflow deploy before it runs.
- **Killed the `sync_queue`** — the SkyStories pipeline used to retry failures silently via a queue + cron. It's now direct execution with a fail-loud admin email when something breaks. Less infrastructure, faster signal when things go wrong.
- **Reporting Scheduler disabled** — it was burning n8n quota on every 5-min fire (hitting plan limits) and starving other workflows. Killed the trigger; we'll re-enable when there's headroom.
- **Bookings read-path performance** — three targeted indexes on the bookings + client_interactions tables. The expensive bits of the Manager (member detail, ongoing flights) are noticeably snappier.
- **Set up `silkskyair-docs`** (this repo) as the single home for all cross-cutting planning and reviews. The three planning docs below all live here now.

### By the numbers

- 65 commits across 11 repos
- 4 new shared repos initialized (`common`, `config`, `utils`, `docs`)
- 0 production incidents

---

## What's planned next week (the value, by initiative)

I've got three big workstreams lined up. Listed in priority order:

### Initiative 1 — Partnership Portal: client review remediation (Round 3)

**Goal:** close out the 22-item review from Micheline / Panpaporn / Nuchada so we can ship the Partner Portal to launch.

**What management can track this week:**

| ID | What | Status |
|---|---|---|
| R1 | Back Office partner-create form clearing on save | Ready to land |
| R4 | "Members" → "Clients" everywhere (Partner Portal + Back Office) | Ready to land — DB migration + 3 file edits |
| R5 | Hide Commission Rate + Performance Overview cards on Partner dashboard | Ready to land |
| R7 | "+ Invite Member" → "+ Invite Team" | Ready to land |
| R8, R9, R10, R11 | Untranslated i18n keys + stepper labels + "Submit Booking" CTA | Ready to land |
| R12 | Passenger nationality / weight save (FK violation bug) | Ready — replacing free-text input with a country dropdown |
| R13–R16 | Direct → Full / Indirect → Net + WHT removal + commission math fix | Ready to land — both UI + server math |
| R19 | TOTAL AMOUNT box parity on indirect payment dialog | Ready to land |
| R22 | Archive clients feature | Ready — new DB column + UI action |
| R20 in-app | Back-office notification bell on partner-initiated cancellation | Ready — bell + DB trigger |

**What's blocked and what I need:**
- **R3 chip** (`organization_manager` → `Manager` on Create Account page) — needs access to the `silkskyair-account` repo.
- **R2 invitation sender identity** + **R20 email half** — needs access to the n8n workflows repo (or n8n cloud workspace).
- **R17 / R18 card payment** — needs `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` provisioned in the partner-portal Vercel project (staging + prod). The code fix is small (~5 lines); the keys are the actual blocker.
- **R21 verification popup** — the server-side OTP infrastructure is fully built and live. I can build the partner-side popup this week; just need a quick contract check against the existing `silkskyair-member/verify` page.
- **R6 Available Tours widget** — blocked on a spec (what tours appear? card content? empty state?). Needs a 15-min decision from product.

**Realistic deliverable next Friday:** 15 of the 22 items shipped to staging (everything not blocked above). The blocked items move the same day access is granted.

### Initiative 2 — Member Portal: 1st Review remediation (Phase 1)

**Goal:** start the 33-item Member Portal review (MP1) that came in on 2026-05-19. Phase 1 is the low-risk trim; Phase 2 is the amendment-payment lifecycle which is much bigger.

**Phase 1 (target next week — ~1-2 days):**

| Workstream | What it does | Why it matters |
|---|---|---|
| **MP1-W01** | Disable the entire check-in flow (commented out, not deleted) | Per client direction, check-in is deferred to Phase 2. Removes 5 confusing UI elements customers were seeing |
| **MP1-W02** | Magic-link-only auth on the member portal | No more password / "Forgot password" — single auth path |
| **MP1-W03** | Passenger weight: replace bucketed dropdown with numeric kg input | Advance Aviation team needs the actual weight, not a range |
| **MP1-W11** | Booking Status reference doc in `silkskyair-docs` | Captures the state machine for ops/support reference |

**Phase 2 (the bigger workstream — starts after Phase 1):** amendment-payment lifecycle. This is the lynchpin (MP1-W06) — a booking that's been amended with a surcharge needs a new `processing` state, the customer needs to receive an email with a deep-linked pay screen, the Manager needs per-payment rows showing what's paid vs. unpaid. This is roughly 5-10 days of focused work and will likely span the following week. I'll flag the exact phase boundary in next week's report.

**Realistic deliverable next Friday:** MP1-W01, W02, W03, W11 shipped. Phase 2 (W06) started.

### Initiative 3 — Meta CAPI / Pixel Purchase integration

**Goal:** Meta finally gets a Purchase signal from us so the ad spend on the SilkSkyAir campaigns is actually optimizing against conversions instead of flying blind.

**Why it matters for the business:** right now, every Thai customer who initiates a booking on desktop and pays via PromptPay on mobile is invisible to Meta — desktop browser never sees the Purchase, so Pixel alone loses the conversion. The dual-track plan (browser Pixel + server-side CAPI sharing the same `event_id`) fixes that. Without this, lookalike audiences can't be built from real converters and attribution is broken.

**What lands next week (target):**

| # | Task | Notes |
|---|---|---|
| 1 | Capture `fbclid`/`_fbp`/`_fbc` on the WWW landing (consent-gated) | Reads from URL + cookies on first widget init |
| 2 | Install Meta Pixel, fire `Purchase` on confirmation page | Consent-gated via existing cookie banner |
| 13 | Extend `api.bookings` view to surface the new fields | DB foundation — small view migration |
| 14 | Add `analytics.events_sent` table | Idempotency + observability for retries |
| 6 | Revise the existing `meta-capi-purchase.json` n8n workflow | Per the new design (stored in `client_interactions`, retries, `events_sent` insert) |

**What's blocked:**
- **Task 5** — n8n credential `AAC | SAA | Auth | Meta CAPI` — needs the Meta access token from whoever owns the Meta Business Manager. Manual setup in the n8n UI.

**Realistic deliverable next Friday:** frontend capture + Pixel firing on www, DB foundations landed, workflow revised but not yet deployed (waiting on credential). Full end-to-end verification with Meta Events Manager Test Events likely lands week after.

---

## Things I need from you (asks, in priority order)

| Ask | Initiative | Blocker for |
|---|---|---|
| Access to `silkskyair-account` repo | Partner Portal | R3 chip fix |
| Access to the n8n workflows repo (or n8n cloud admin) | Partner Portal + Meta CAPI | R2, R20-email, Meta workflow deploy |
| Omise keys provisioned in Partner Portal Vercel project (staging + prod) | Partner Portal | R17/R18 — card payment |
| Spec for the Partner Portal "Available Tours" widget | Partner Portal | R6 |
| Meta access token for the CAPI credential | Meta CAPI | Task 5 |
| Confirm: should `BookingPaidInFull` return to `Confirmed` or `Completed`? | Member Portal | MP1-W06 state machine |

Any of these you can unblock by Monday morning is real value — they're not waiting on me, they're waiting on access or a decision.

---

## Status snapshot

**This week:** ✅ on track. Three workstreams shipped end-to-end. Staging is fully aligned after mid-week sync work.

**Next week confidence:**
- Partner Portal — **high** for unblocked items (15/22). Blocked items contingent on the access asks above.
- Member Portal Phase 1 — **high**. Low-risk, well-scoped.
- Meta CAPI — **medium**. Code chain is plannable; depends on the Meta credential landing in time for staging verification.

**Risks I'm watching:**
- Member Portal Phase 2 (amendment-payment lifecycle) is the largest unknown of the next 2-3 weeks. It touches the booking state machine, payment flow, manager UI, and customer emails. Worth a 30-min walkthrough with ops once Phase 1 lands.
- Meta CAPI verification depends on staging traffic — if we have a quiet period it may take an extra day to confirm events are landing in Meta Events Manager.

That's it. Ping me if anything needs a deeper dive.

— Peter
