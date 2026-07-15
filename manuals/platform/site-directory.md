---
title: "Site & Portal URL Directory"
---

# Site & Portal URL Directory

> **Scope:** One directory of every SilkSkyAir / Andaman Aerodrome site and portal, with its live (production), staging, develop, and local URLs.
> **Snapshot:** July 2026, compiled from each app's committed env files, READMEs, and the Account Portal's SSO origin allow-list. URLs are copied verbatim from configuration — see [Status & known gaps](#status--known-gaps) for the inconsistencies this surfaced.

---

## Portals

The five customer- and staff-facing portals.

| Portal | Repo | Production | Staging | Develop | Local |
|--------|------|-----------|---------|---------|-------|
| **Website** | `silkskyair-www` | [www.silkskyair.com](https://www.silkskyair.com) | [staging.silkskyair.com](https://staging.silkskyair.com) | [develop.silkskyair.com](https://develop.silkskyair.com) | `localhost:4321` |
| **Manager** | `silkskyair-manager` | [manager.silkskyair.com](https://manager.silkskyair.com) | [staging-manager.silkskyair.com](https://staging-manager.silkskyair.com) | — | `localhost:3000` |
| **Partner** | `silkskyair-partner` | [partner.silkskyair.com](https://partner.silkskyair.com) ⚠️ | [staging.partner.silkskyair.com](https://staging.partner.silkskyair.com) | — | `localhost:3050` |
| **Member** | `silkskyair-member` | [member.silkskyair.com](https://member.silkskyair.com) | — *(none configured)* | — | `localhost:3000` ⚠️ |
| **Operator** | `silkskyair-operator` | — *(not deployed)* | — | — | — |

⚠️ = see [Status & known gaps](#status--known-gaps).

---

## Supporting surfaces

Shared infrastructure the portals depend on — not customer portals themselves, but part of the URL map.

| Surface | Repo | Production | Staging | Develop | Local |
|---------|------|-----------|---------|---------|-------|
| **Account (SSO)** | `silkskyair-account` | [account.silkskyair.com](https://account.silkskyair.com) | [staging-account.silkskyair.com](https://staging-account.silkskyair.com) ⚠️ | — | `localhost:3020` |
| **CMS (Strapi)** | `silkskyair-cms` | [cms.silkskyair.com](https://cms.silkskyair.com) | `hopeful-nature-255f0bdea0.strapiapp.com` | `bold-poem-7acdec93b3.strapiapp.com` | `localhost:1337` |
| **Short links** | `silkskyair-workflows` | [go.silkskyair.com](https://go.silkskyair.com) | — | — | — |
| **Legacy marketing site** | `andaman-www` | [andaman.co.th](https://andaman.co.th) | [staging.andaman.co.th](https://staging.andaman.co.th) | — | — |

---

## Local dev ports

The port each app binds when run locally, per the Account Portal's SSO origin map (the authoritative source that ties `?app=` identifiers to origins).

| App | Port | Origin identifier |
|-----|------|-------------------|
| Manager | `3000` | `manager` |
| Account (SSO) | `3020` | — |
| Partner | `3050` | `partner` |
| Website | `4321` | `www` |
| CMS (Strapi) | `1337` | — |
| Member | `3000` ⚠️ | *(not in SSO map)* |

---

## Status & known gaps

The compile surfaced real inconsistencies across the repositories. These are worth reconciling so the directory stays trustworthy.

- **Operator portal has no URL.** `silkskyair-operator` is an empty repository (no code committed) and no `operator.silkskyair.com` host appears anywhere in the platform. It is listed here for completeness but is not yet deployed.

- **Member portal has no staging URL and is not wired into SSO.** Production is `member.silkskyair.com` (per its README's deploy instructions), but there is no staging host, no committed env files, and the Account Portal's `ALLOWED_ORIGINS` does **not** list a member origin — so SSO sign-in redirects to the member app would not currently validate.

- **Member local port collides with Manager.** The member README says `localhost:3000`, which is also Manager's port. Member is absent from the Account Portal's port map, so its intended dev port is unconfirmed. Running both locally at once would conflict.

- **Partner domain: singular vs plural.** The Account Portal (the SSO gatekeeper) allows `partner.silkskyair.com` (singular), and that is the origin that actually validates for auth. However `silkskyair-api` migrations and `silkskyair-orchestrator` reference `partners.silkskyair.com` (plural). One of the two is wrong; the SSO-validated `partner.silkskyair.com` is treated as canonical here.

- **Account staging: dash vs dot.** `silkskyair-account` and `silkskyair-partner` use `staging-account.silkskyair.com` (dash), while `silkskyair-www` points `PUBLIC_ACCOUNT_URL` at `staging.account.silkskyair.com` (dot). The website's staging SSO redirects will break unless these agree. The account app's own convention (`staging-account.`) is treated as canonical.

- **Staging subdomain convention is mixed.** Manager uses `staging-manager.` (dash) while Partner and Website use `staging.partner.` / `staging.silkskyair.com` (dot). No single rule is applied across the platform.
