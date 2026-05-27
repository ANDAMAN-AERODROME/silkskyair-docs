---
title: "Staff Training Manual — W22 Release"
kind: parent
---

# Staff Training Manual — W22 Release

This manual walks operations and support staff through the headline features that ship in the W22 release. It's a *how to use* document — the matching *what to verify* checklist lives in the [W22 QA task](https://www.notion.so/36cbd1aae1c981cca636faa8a89b5227).

## How to read this manual

Every feature follows the same shape:

1. **What it does** — one or two plain-language sentences.
2. **Before you start** — staging URL, the account to use, any data prerequisites.
3. **Step-by-step** — numbered steps, each with a screenshot and a "what you should see" line.
4. **Tips & common questions** — short Q/A for things readers tend to ask.

Read pages in any order — they don't depend on each other unless explicitly noted.

## Features in this release

| # | App | Feature |
|---|---|---|
| 1 | WebSite | Sky Stories — Related Tours on detail page |
| 2 | WebSite | Bookings — Payment-before-confirmation flow |
| 3 | WebSite | Bookings — Multi-tour promotions & deep-links |
| 4 | WebSite ↔ BackOffice | Customer Notes — end-to-end |
| 5 | BackOffice | SkyStories — Caption & media metadata editing |
| 6 | BackOffice | SkyStories — Keyword multi-locale sync |

## Before you start (applies to every page)

- **Staging URLs**
  - WebSite: `https://staging.www.silkskyair.com`
  - BackOffice (Manager): `https://staging.manager.silkskyair.com`
- **Shared demo account:** `peter@andaman.co.th` (credentials in 1Password under "SilkSkyAir staging").
- **Browser:** any modern Chrome / Edge / Firefox. Screenshots in this manual are captured at 1440×900 in English locale.
- **Heads-up:** staging data is shared. If a step says "find a booking with notes" and you don't see one, create one first (the customer-notes page walks through this).
