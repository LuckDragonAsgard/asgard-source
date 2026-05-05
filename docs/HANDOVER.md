# Session Handover — 2026-05-05 (Session 6)

> **Engineering rules apply across all products** —
> read [`docs/ENGINEERING-RULES.md`](ENGINEERING-RULES.md) at session start.
> Every product has a `checks.py` that runs post-deploy. Template:
> [`docs/checks.py.template`](checks.py.template).

**Vault PIN:** `535554`
**Get any credential:** `curl -H "X-Pin: 535554" https://asgard-vault.pgallivan.workers.dev/secret/GITHUB_TOKEN`

---

## What we did this session (Session 6)

### Streamline Webapps — Legal & Admin Blockers

Resolved 3 of 4 remaining blockers for Streamline Webapps:

**1. ABN in footer (done)**
- ABN confirmed: **64 697 434 898** (LUCK DRAGON PTY LTD) via ABR lookup
- Streamline proxy v31 deployed: ABN added to main footer + 3 legal page footers
- Footer now reads: `© 2026 Luck Dragon Pty Ltd (ABN 64 697 434 898) · Melbourne, Australia · hello@streamlinewebapps.com`
- Committed: `bc47f722416f` — "streamlinewebapps-proxy v31: ABN in footer, hello@ email, Resend domain verified"

**2. hello@streamlinewebapps.com email (done)**
- Resend: streamlinewebapps.com domain added and verified (DKIM + SPF)
- Cloudflare Email Routing: enabled on streamlinewebapps.com zone, inbound routed to pgallivan@outlook.com
- Streamline proxy v31: outbound email from changed to `hello@streamlinewebapps.com`
- DNS records added via CF dashboard browser session (vault tokens lack Zone.DNS:Edit for this zone)

**3. Equity IP Deed (done)**
- Full co-ownership deed drafted for Streamline equity tier ($1,499)
- 10 clauses + execution page + schedule
- 50/50 IP split, 20% customer / 80% Luck Dragon revenue share
- Governing law: Victoria, Australia
- Saved: `H:\My Drive\Luck Dragon 2.0\streamline-equity-deed.docx` (pgallivan@outlook.com Drive)

**4. PI Insurance (manual — Paddy to action)**
- Not automated — Paddy must get quote from BizCover or Aon for Professional Indemnity

**Legal Brief for Nick Zavattieri:**
- 7-page brief covering full ~50-product portfolio
- 8 risk categories: Revenue Share/IP, Charter/Maritime, Schools/Children, Gambling, Healthcare, IP, Employment, Consumer Law
- Traffic-light priority ratings (Red/Orange/Green/Blue)
- Saved: `H:\My Drive\Luck Dragon 2.0\luck-dragon-legal-brief.docx` (pgallivan@outlook.com Drive)
- Nick Zavattieri — Melbourne Litigation Trial Lawyers (mltl.com.au)
- Paddy to email Nick directly with both docs attached

**D1 asgard-brain:** Streamline progress updated to 85%

**Remaining Streamline blockers:**
- PI insurance quote (Paddy manual)
- Nick Zavattieri legal review

---

## What we did last session (Session 5)

### Clubhouse — Sports Club Platform (tasks #34–45)

All 45 tasks complete. Full feature set live at https://clubhouse-e5e.pages.dev

**Tasks completed:**
- #34 Club membership check on all sensitive API endpoints
- #35 Restrict fees admin to committee/admin role
- #36 Team assignment UI in Admin panel (create teams, assign/remove players)
- #37 Welcome email to new members on first login (via Resend)
- #38 Profile edit: jumper number + positions fields
- #39 Per-club feature toggles (admin can turn nav features on/off)
- #40 Player photo upload via Cloudflare R2
- #41 CSV bulk import (fixtures + roster)
- #42 PlayHQ fixture sync (GraphQL API)
- #43 PlayHQ full scraper via browser bookmarklet (DOM scrape → POST to API)
- #44 Player stats entry system (AFL + Cricket, grid UI per fixture)
- #45 Stats display on player profiles + Leaderboard page

**Key additions:**
- `ch_stats` table: per-player, per-fixture, per-stat-key (UNIQUE constraint)
- `clubs` table: added `playhq_org_id`, `playhq_season_id`, `playhq_last_sync`, `sport`
- `ch_fixtures` table: added `sport`, `playhq_id`, `competition`, `round_name`, `venue_address`
- R2 bucket `clubhouse-media` bound via wrangler.toml (binding: `MEDIA`)

---

## Infrastructure state (2026-05-05)

| Service | URL | Status |
|---|---|---|
| **Streamline Webapps** | https://streamlinewebapps.com | v31 live — ABN + hello@ |
| **Clubhouse** | https://clubhouse-e5e.pages.dev | 45 tasks live |
| Carnival Timing | https://carnivaltiming.com | v8.5.2 |
| Sport Carnival | https://sportcarnival.com.au | draw/results live |
| School Sport Portal | https://schoolsportportal.com.au | landing only |
| Asgard | https://asgard.luckdragon.io | live |
| Vault | https://asgard-vault.pgallivan.workers.dev | live |

---

## Streamline Webapps — technical reference

**Worker:** `streamlinewebapps-proxy` (CF Workers)
**Repo:** `LuckDragonAsgard/streamlinewebapps` (or stored in asgard-source)
**Domain:** streamlinewebapps.com
**Email:** hello@streamlinewebapps.com (Resend + CF Email Routing → pgallivan@outlook.com)
**ABN:** 64 697 434 898 (Luck Dragon Pty Ltd)
**Current version:** v31

**Equity tier docs in Drive (pgallivan@outlook.com):**
- `streamline-equity-deed.docx` — co-ownership IP deed
- `luck-dragon-legal-brief.docx` — full portfolio legal brief for Nick Zavattieri

**DNS note:** vault tokens lack `Zone.DNS:Edit` for streamlinewebapps.com zone.
To add DNS records, use CF dashboard browser session JS:
```js
fetch('/api/v4/zones/ZONE_ID/dns_records', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({type:'TXT', name:'@', content:'v=spf1...', ttl:1})
})
```

---

## Clubhouse — full technical reference

**Repo:** `LuckDragonAsgard/clubhouse`
**Stack:** React 18 + Vite + Tailwind + CF Pages Functions + D1 + R2

**Active clubs:**
| Slug | Club | Sport |
|---|---|---|
| `wcyms` | Williamstown CYMS FC | AFL |
| `youlden` | Youlden Park Cricket Club | Cricket |
| `cyms-cricket` | Williamstown CYMS Cricket Club | Cricket |

**D1:** `b6275cb4-9c0f-4649-ae6a-f1c2e70e940f` (shared with Asgard brain)
**CF Account:** `a6f47c17811ee2f8b6caeb8f38768c20`

**Key DB tables:**
- `clubs` — slug, name, sport, colours, features (JSON), playhq_org_id, playhq_season_id
- `ch_users`, `ch_sessions`, `ch_memberships` (roles: admin/committee/coach/player/supporter)
- `ch_fixtures` — **column is `opponent_name` NOT `opponent`** ← common bug
- `ch_ladder`, `ch_stats`, `ch_teams`, `ch_team_members`
- `ch_fees`, `ch_bf_votes`, `ch_availability`, `ch_training`, `ch_attendance`
- `ch_announcements`, `ch_events`, `ch_push_subscriptions`, `ch_links`

**Auth pattern (all sensitive endpoints):**
```js
export async function onRequestGet({ params, request, env }) { // MUST include `request`
  const user = await AUTH(request, env)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug } = params
  const { results: clubs } = await env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(slug).all()
  const clubId = clubs[0].id
  const { results: mem } = await env.DB.prepare(
    "SELECT role FROM ch_memberships WHERE user_id = ? AND club_id = ? AND status = 'active'"
  ).bind(user.id, clubId).all()
}
```

**wrangler.toml must include:**
```toml
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "clubhouse-media"
```

**Common bugs:**
1. Missing `request` in handler → AUTH throws ReferenceError → 500
2. `clubId` used before DB fetch → wrong order
3. `opponent` instead of `opponent_name` in fixture queries
4. R2 binding missing from wrangler.toml → disappears on deploy
5. CF Pages build: JSX syntax errors only surface at build time. Error 1101 = runtime exception.

---

## Falkor fleet

17 workers live on luckdragon.io. AGENT_PIN: `<vault: AGENT_PIN>` (rotated Phase 16 2026-05-01).
falkor-dashboard user-facing PIN: `luckdragon`
VAULT_PIN (asgard-vault X-Pin): `535554`

---

## District Cross Country (WD26 — May 7)

Carnival code: **WD26** | Venue: McIvor Reserve, Yarraville
WPS qualifiers: 24 runners across 6 age groups (bibs 29-32, 61-64, 93-96, 125-128, 157-160, 189-192)
Sacred Heart: 16 bibs still TBC (13-16, 45-48, 77-80, 109-112, 141-144, 173-176)
Spreadsheet: `1AsOip8iU7Veh8RkAoMbjwGNwBKXZwcpBI2ggjgnwu0c`

---

## Context for new chat

I'm Paddy, PE teacher at WPS. Main projects right now:
- **Streamline Webapps** (v31 live — ABN in footer, hello@ email. Blockers: PI insurance + Nick legal review)
- **Clubhouse** (sports club platform, 45 tasks done, wcyms/youlden/cyms-cricket live)
- **Carnival Timing / WD26** (district XC was May 7)
- **School Sport Portal** (landing only, app not built yet)
- **KBT Trivia** (asset pipeline + Google Slides)
- **Superleague Yeah v4** (AFL fantasy draft, v4.28 live)

Vault PIN: `535554`. All credentials in vault at https://asgard-vault.pgallivan.workers.dev

**Drive docs (pgallivan@outlook.com):**
- `streamline-equity-deed.docx` — Streamline equity IP deed
- `luck-dragon-legal-brief.docx` — full portfolio legal brief for Nick Zavattieri (mltl.com.au)
