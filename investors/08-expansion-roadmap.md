---
title: "Expansion Roadmap"
---

# Expansion Roadmap

This chapter translates the platform's design into the expansion program the investment is
meant to fund: growing the **physical network** (heliports, helipads, aircraft), and
multiplying the **businesses operating on it**. Mechanics only — commercial terms and
financial projections belong to management's financial materials.

## The expansion thesis in one line

> Every new node and every new aircraft added to the network is immediately productive
> across all operators and all activity types, because the platform turns physical
> expansion into a data operation.

## Axis 1 — Network expansion (the primary focus)

**Adding a heliport/helipad** is, on the platform side: an `airfields` row, its route
edges, and translated content. From that moment the node participates in route planning,
scheduling, availability and every operator's catalog. The expensive part of expansion is
land, regulation and construction — the platform guarantees the *digital* marginal cost
of a node is near zero, and that utilization can begin on day one.

**Adding an aircraft** is an `aircraft` row with capacity, default crew and components;
maintenance logging and nightly scheduling apply automatically. Fleet growth requires no
software work.

**Network density compounds.** Each new node creates routes to every reachable existing
node; transfers and multi-stop products that were impossible become sellable inventory.
The graph model means the platform measures and exposes this directly (route edges,
utilization, availability) — giving network management the data to sequence expansion by
yield rather than intuition.

## Axis 2 — Activity expansion

The mission-type taxonomy makes new aviation business lines additive:

| Activity | Status on the platform |
|---|---|
| Tours | Live (SilkSkyAir) |
| Charters | Mission type live; charter back-office module exists |
| Transfers | Mission type live; becomes compelling as network density grows |
| Medevac | Mission type live; an operator/contract away from activation |
| Ferry / repositioning | Automated by the scheduler today |
| Future (cargo, survey, training, …) | Additive taxonomy rows on the same engine |

## Axis 3 — Operator expansion (the white-label program)

The [separation model](04-white-label-separation.md) defines the product; the rollout is
deliberately staged:

**Stage 1 — Second internal brand.** Launch one additional commercial brand (e.g. a
transfers brand) as a separate `organization` on the shared deployment. Purpose: exercise
the tenant boundary end-to-end and produce the operator-onboarding playbook from a live
run, at zero external risk.

**Stage 2 — First external operator.** Onboard an independent operator under the
playbook: own branding, catalog, payment accounts, staff and reseller network — on
network capacity under commercial agreements. Purpose: validate the licensing motion and
the support model.

**Stage 3 — Operator program at scale.** Productize onboarding (tenant provisioning,
theming, CMS spaces, payment connection) into a repeatable package; the marginal operator
approaches pure configuration cost. At this stage the company operates a genuine
two-sided platform: network capacity on one side, commercial operators on the other.

**Stage 4 — Structural options.** With the program proven, the already-existing
boundaries (schemas, privilege namespaces, repositories) support whichever structure the
company chooses: licensing, joint ventures per market, or formal division into a network
company and commercial entities.

## Revenue surfaces this roadmap opens

Stated qualitatively — each is a mechanism the platform already supports:

- **Capacity & network fees** — operators consume scheduled capacity on network
  infrastructure (the missions/flights engine is the metering point).
- **White-label licensing** — the commercial suite as a product, per operator.
- **Transaction-level participation** — the commission/settlement engine generalizes from
  partner commissions to platform-level participation in operator bookings.
- **Value-added services** — payments, reporting, marketing tooling and CRM integration
  as operator-facing services on the shared core.
- **Direct commercial operations** — SilkSkyAir and future internal brands continue as
  operating businesses and as the program's living showcase.

## Platform work that supports the roadmap

The honest engineering view: the foundations exist, and the roadmap concentrates
remaining work where it belongs —

- **Operator provisioning productization** — turning the Stage-1 playbook into tooling
  (tenant setup, theming, CMS space creation) as the operator program scales.
- **Partner portal build-out** — the reseller portal is live at foundation level and
  deepens with each release cycle (its review-driven evolution is documented in this
  repository).
- **Locale completion** — Russian and Chinese content completion for market expansion
  (the schema and tooling already support them).
- **Continued network instrumentation** — utilization and yield analytics on the
  existing `analytics`/`reporting` schemas as the node count grows.

None of these are architectural risks; they are the scheduled deepening of systems whose
hard parts — the network core, the tenancy model, the money flows — are already in
production.

---

*Back to: [Executive Summary](01-executive-summary.md) · [Index](index.md)*
