# Asgard Portfolio Memory — 2026-05-05

> This file is loaded by new Claude accounts at session start via HANDOVER.md.
> It captures the institutional knowledge that lives in Mona's local Cowork memory files.
> Keep this updated at each session wrap.

---

## Accounts & IDs

- **Cloudflare account:** `Luck Dragon (Main)` — ID `a6f47c17811ee2f8b6caeb8f38768c20`
- **GitHub org:** `LuckDragonAsgard` (product repos) | `PaddyGallivan` (platform/asgard-source)
- **Vercel team:** `team_qXLAiOqq0EztMXKK8CXX6JhT` (pgallivan@outlook.com — migration pending to luckdragon.io)
- **Drive account:** `paddy@luckdragon.io` (legacy content only — see storage routing)
- **Supabase:** `huvfgenbcaiicatvtxak` (shared DB for Save My Seat + KBT test)
- **Vault PIN:** `535554`
- **Asgard dashboard:** https://asgard.pgallivan.workers.dev (fan PIN: `luckdragon`)

---

## Storage Routing (hardened rule — never break this)

| What | Where |
|---|---|
| Code, configs, docs, handovers, markdown | **GitHub** (`LuckDragonAsgard` org) |
| Workers / API routes | Cloudflare Workers |
| Static sites | Cloudflare Pages (Git-connected, NOT direct upload) |
| Secrets / tokens | `asgard-vault.pgallivan.workers.dev` (X-Pin: 535554) |
| Office files for live editing | Google Drive (paddy@luckdragon.io) — residual only |

**Nothing new ever goes to Drive or local scratch folders.**

---

## Key Credentials (all in vault — fetch with X-Pin: 535554)

- `CF_API_TOKEN` — full-ops Cloudflare token (asgard-fullops)
- `GITHUB_TOKEN` — raw string, NOT JSON. Use `curl | cat`, never `| python3 -c json.load`
- `CF_PAGES_TOKEN` — for Clubhouse Pages deploys
- `SMS_ADMIN_KEY` — Save My Seat admin key (rotated 2026-05-05)

**CF token note:** Cloudflare MCP OAuth may show 403 (code 9109) — use direct API token from vault instead.

---

## Portfolio Products — RESUME-HERE locations

| Product | Live URL | Repo | RESUME-HERE |
|---|---|---|---|
| **Save My Seat** | https://savemyseat.au | LuckDragonAsgard/savemyseat | [docs/RESUME-HERE.md](https://raw.githubusercontent.com/LuckDragonAsgard/savemyseat/main/docs/RESUME-HERE.md) |
| **Clubhouse** | https://clubhouse-e5e.pages.dev | LuckDragonAsgard/clubhouse | (in HANDOVER.md) |
| **Superleague Yeah v4** | — | LuckDragonAsgard/superleague-yeah-v4 | (in HANDOVER.md) |
| **Carnival Timing** | https://carnivaltiming.com | — | (in HANDOVER.md) |
| **KBT Trivia** | — | LuckDragonAsgard/kbt-trivia-tools | docs/handovers/ |
| **School Sport Portal** | https://schoolsportportal.com.au | — | landing only, not built |
| **Asgard** | https://asgard.luckdragon.io | PaddyGallivan/asgard-source | docs/HANDOVER.md |

---

## Feedback / Behaviour Rules

- **Centralise on luckdragon.io** — everything moves to paddy@luckdragon.io. pgallivan@outlook.com is legacy.
- **Brief, action-oriented responses** — no essays. Auto-deploy reversible things. Sort popups without asking.
- **Never commit secrets to GitHub** — vault only.
- **HANDOVER.md bootstrap** — fetch it at start of every new chat before anything else.
- **GitHub token is raw string** — never parse as JSON.
- **Edit tool on large files (>100KB) truncates** — always use Python read/replace/write for large CF Workers.

---

## Save My Seat — Quick Reference (v12.29, 2026-05-05)

- **Live:** https://savemyseat.au | `/health` → `{"ok":true,"version":"12.29"}`
- **CF Worker:** `savemyseat` (account a6f47c17811ee2f8b6caeb8f38768c20)
- **Repo:** LuckDragonAsgard/savemyseat | working file: `outputs/worker_v1210.js`
- **Company:** Luck Dragon Pty Ltd, ABN 64 697 434 898 (VIC 3016)
- **Supabase:** huvfgenbcaiicatvtxak | table: `save_my_seat_holds`
- **Admin key:** in vault as `SMS_ADMIN_KEY`
- **Next:** Live device test (onboarding → GPS → hold → crew → share)
- **Blocked:** Supabase org at 2-project limit; savemyseat.au domain at Vercel until 7 Jun 2026

---

## Superleague Yeah — Quick Reference (v4.31)

- **Repo:** LuckDragonAsgard/superleague-yeah-v4 (source of truth)
- v4.31 deployed 2026-04-28, fixed v4.30 giant-face regression

---

## Domain / Registrar Map (2026-04-27 snapshot)

- **Cloudflare Registrar:** 2 domains (.com transferred)
- **Squarespace:** 17 domains (paddy@luckdragon.io account)
- **VentraIP:** 3 x .au domains
- **Crazy Domains:** 1
- **Domain Directors:** 1
- **Vercel:** savemyseat.au (eligible for transfer 7 Jun 2026)
- Squarespace OAuth friction: REQUEST TRANSFER CODE triggers Google OAuth modal — needs Paddy's hand each time

---

## 75 Cecil St (resolved — settlement week 4-8 May 2026)

- Post-auction, broker Matt Wynd, Section 32 s32E non-disclosure letter required
- Recommended cap $1.22M (not $1.30M), sold at auction Sat 2 May 2026
