---
title: "Case Study — SilkSkyAir, the First Operator"
summary: "The reference implementation: a real helicopter-tour business running end-to-end on the platform — acquisition, booking, payment, fulfilment, resellers and settlement. The demo is a real company."
keypoints:
  - "A real business, end to end | From acquisition to repeat revenue with no manual glue between steps."
  - "Resellers settle automatically | Partner commissions with Thai VAT and withholding mechanics built in."
  - "Operated, not just launched | Releases, training manuals and review cycles document live operations."
  - "The strongest sales asset | The next operator buys a system a working company already runs on."
---

# Case Study — SilkSkyAir, the First Operator

SilkSkyAir is the platform's **reference implementation of a commercial operator**: a
helicopter-tour business in the Andaman region, running end-to-end on the network platform
described in the preceding chapters. Its role in this documentation is evidentiary — every
white-label capability an operator licensee would buy is exercised here in production.

## The business, as run on the platform

```steps
01 | Acquisition | multilingual storefront, campaigns, CRM
02 | Booking | real-time availability & component pricing
03 | Payment | cards & PromptPay, auto-reconciled
04 | Fulfilment | missions, crews, schedules on the core
05 | Relationship | member portal & canonical profiles
```

No manual glue between the steps:

1. **Acquisition.** A multilingual storefront (`silkskyair-www`, Astro) serves the tour
   catalog, editorial SkyStories content, promotions and campaign landing pages with QR
   codes — all managed by the marketing team in the CMS, no engineering involved.
   Meta CAPI purchase attribution and CRM lead capture (Zoho) close the marketing loop.
2. **Booking.** The storefront's booking engine quotes real-time availability and a
   component-priced quote (base, shared-flight discount, promotion, coupon) computed by
   the platform's availability engine — operational constraints first, pricing second.
   Passenger manifests capture per-passenger weight, an aviation-safety requirement
   enforced at the data model.
3. **Payment.** Customers pay by card (Omise) or Thai PromptPay QR (SCB); webhooks
   reconcile charges and confirm bookings automatically. Refunds and additional payment
   requests are workflow objects with full audit trails.
4. **Fulfilment.** Confirmed bookings become missions on the network core: aircraft
   assigned, crews scheduled, catering and ground transport attached, schedules rebuilt
   nightly and on every relevant change. Operational disruptions (weather, maintenance)
   block availability across all channels instantly.
5. **Relationship.** Customers get a member portal (`silkskyair-member`) for itineraries,
   amendments and payments; their identity, history and consent accumulate in canonical
   member profiles.

## The reseller network

SilkSkyAir distributes through hotels, agencies and other partners — managed on the
platform's organization model:

- Partners are `organizations` with their own staff, roles and portal
  (`silkskyair-partner`).
- Every partner-attributed booking settles automatically through the commission engine:
  per-organization commission percentages, both settlement directions (operator-collected
  and partner-collected), Thai VAT and withholding-tax mechanics, and a full settlement
  audit trail.
- Scheduled reports are generated and dispatched to partners by the platform's reporting
  engine.

This is the same machinery that, generalized, becomes the **white-label operator
program** described in [White-Label Separation](04-white-label-separation.md) — partners
are to SilkSkyAir what commercial operators are to the network platform, one level up.

## Operated, not just launched

The depth of operational reality is visible in this documentation repository itself:

- Staff training manuals for partner, member, booking and content workflows
  (`manuals/domains/`), organized into weekly release compilations.
- Client review cycles with itemized remediation plans (`plans/`), weekly engineering
  reports, and production release inventories.
- Amendment workflows, cancellation flows, check-in handling, customer notes and payment
  edge cases — all shipped in response to real operational demand.

## What this proves to an investor

| Claim in this documentation | SilkSkyAir evidence |
|---|---|
| The network core can fulfil commercial demand | Tours scheduled, crewed and flown through the missions/flights engine |
| The commercial suite is complete | Catalog → dynamic pricing → booking → payment → fulfilment → repeat, live |
| The white-label surfaces work | Branded storefront, member portal, partner portal, CMS space, own payment accounts |
| Multi-party money flows settle correctly | Commission engine running with real partners, VAT/WHT mechanics included |
| The platform sustains operations | Release cadence, training manuals, review cycles documented in this repo |

SilkSkyAir is therefore the strongest possible sales asset for the operator program:
**the demo is a real company.** The next operator does not buy promises; it buys the
system a working business already runs on — and the network company retains the
infrastructure both stand on.

---

*Next: [Expansion Roadmap](08-expansion-roadmap.md)*
