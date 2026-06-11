---
title: "Investor Documentation — Acceptance Criteria (working checklist)"
---

# Investor Documentation — Acceptance Criteria

Working checklist driving the authoring loop for `investors/` (plain markdown deliverables
in this repo). The loop exits when every box is checked and verification is green.

## Narrative criteria

- [ ] N1 — Network-first framing: the platform is presented primarily as a turn-key
      network platform for aviation activities built on a network of helipads/heliports;
      commercial features are presented as value-added services on that base.
- [ ] N2 — White-label separation exemplified concretely, citing actual mechanisms
      (organizations, organization types, RLS privileges, per-org commission/settlement,
      module registry) — showing the platform can host an unlimited number of commercial
      operators, with SilkSkyAir as operator #1.
- [ ] N3 — Platform portrayed as a high-value company asset (verifiable build metrics,
      audit/compliance readiness, replacement-cost reasoning).
- [ ] N4 — Creator portrayed as a high-value key person, role-based (no personal name).
- [ ] N5 — Modern approach and modular architecture highlighted throughout.
- [ ] N6 — Audience fit: written for investors focused on network expansion, ownership and
      management (heliports + aircraft), with SilkSkyAir as the example business.

## Accuracy criteria

- [ ] A1 — Every metric cited is verified against the repos (503 migrations, 16 schemas,
      140+ active tables, 30 seed files, 3 edge functions, 20 n8n workflows, 26 manager
      modules, 19 repositories, 3 published libraries, EN/TH live + RU/ZH provisioned).
- [ ] A2 — Every named table/function/policy exists in silkskyair-api migrations.
- [ ] A3 — No invented financials, revenue figures, or valuations anywhere.
- [ ] A4 — Naming consistent: "Andaman Aerodrome Network Platform (AANP)" = network layer
      (working title), "SilkSkyAir" = first commercial operator built on it.

## Quality criteria

- [ ] Q1 — All chapters present: index, 01-executive-summary, 02-network-platform,
      03-commercial-services, 04-white-label-separation, 05-architecture,
      06-platform-asset-value, 07-case-study-silkskyair, 08-expansion-roadmap.
- [ ] Q2 — Every file has valid frontmatter with `title`; index uses `<!-- children -->`.
- [ ] Q3 — All relative `.md` cross-links resolve to existing files.
- [ ] Q4 — Mermaid diagrams present where they carry weight (topology, domain model,
      booking lifecycle, tenancy/separation) and are syntactically valid.
- [ ] Q5 — Markdown renders cleanly (headings, tables, mermaid fences balanced).
- [ ] Q6 — Executive summary readable standalone (2–3 pages), written last.
- [ ] Q7 — Cross-document consistency pass done (terminology, tone, no contradictions).
