# Session Handover — 2026-05-04 (Session 5)

> **Engineering rules apply across all products** —
> read [`docs/ENGINEERING-RULES.md`](ENGINEERING-RULES.md) at session start.
> Every product has a `checks.py` that runs post-deploy. Template:
> [`docs/checks.py.template`](checks.py.template).

**Vault PIN:** `535554`
**Get any credential:** `curl -H "X-Pin: 535554" https://asgard-vault.pgallivan.workers.dev/secret/GITHUB_TOKEN`

---

## What we did this session (Session 5)

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
- New pages: `StatsEntry.jsx`, `Leaderboard.jsx`
- New components: `PlayerStats.jsx`, `Avatar.jsx`
- New API endpoints: `fixtures/[id]/stats.js`, `stats/[userId].js`, `stats/leaderboard.js`, `sync/scrape.js`, `sync/playhq.js`, `upload/avatar.js`, `settings.js`, `import.js`

---

## What we did last session (Session 4)

### sportcarnival.com.au — Draw & Results Page
- Built full draw/results page for Williamstown District XC 2026
- CF Worker `sportcarnival-hub`, auto-connects to WD26
- 192 bib slots, 6 races, colour-coded by school

### Carnival Timing — Code WD26
- Carnival code: **WD26**, 6 races pre-loaded
- District XC was Thursday May 7, McIvor Reserve Yarraville

---

## Infrastructure state (2026-05-04)

| Service | URL | Status |
|---|---|---|
| **Clubhouse** | https://clubhouse-e5e.pages.dev | 45 tasks live |
| Carnival Timing | https://carnivaltiming.com | v8.5.2 |
| Sport Carnival | https://sportcarnival.com.au | draw/results live |
| School Sport Portal | https://schoolsportportal.com.au | landing only — app not built |
| Asgard | https://asgard.luckdragon.io | live |
| Vault | https://asgard-vault.pgallivan.workers.dev | live |

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

**Deploy:**
```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/a6f47c17811ee2f8b6caeb8f38768c20/pages/projects/clubhouse/deployments" \
  -H "Authorization: Bearer $(curl -s -H 'X-Pin: 535554' https://asgard-vault.pgallivan.workers.dev/secret/CF_PAGES_TOKEN)" \
  -H "Content-Type: application/json"
```

**GitHub push (URL-encode `[`→`%5B`, `]`→`%5D`):**
```python
import json, base64, urllib.request
def push(path, content, message, sha=None):
    url = f"https://api.github.com/repos/LuckDragonAsgard/clubhouse/contents/{path}"
    body = {"message": message, "content": base64.b64encode(content.encode()).decode()}
    if sha: body["sha"] = sha
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json",
                 "Accept": "application/vnd.github.v3+json", "User-Agent": "LuckDragon/1.0"}, method="PUT")
    with urllib.request.urlopen(req) as r: return json.loads(r.read())
```

**Stats system (live):**
- AFL: goals, behinds, kicks, handballs, disposals, marks, tackles, hitouts, frees_for, frees_against, votes
- Cricket batting: runs, balls, fours, sixes, not_out
- Cricket bowling: overs, maidens, wickets, runs_conceded
- Entry: played fixture → 📊 Stats link → StatsEntry grid
- Display: player profile → Season Stats. Nav → Stats Leaderboard.

**PlayHQ (live):**
- PlayHQ is a SPA — Cloudfront blocks server-side scraping
- Bookmarklet: drag 🏉 button from Admin→Settings→PlayHQ to bookmarks, click on any PlayHQ page, scrapes DOM, posts to `/sync/scrape`
- GraphQL API sync also available if club has PlayHQ API key

**Feature toggles:** ladder, teams, training, events, bf_voting, matchday, chat, push, fees, news, sponsors, stats

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

**Possible next features:** scheduled PlayHQ auto-sync, public club page, iOS push, match report PDFs, club website embed widget.

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
- **Clubhouse** (sports club platform, 45 tasks done, wcyms/youlden/cyms-cricket live)
- **Carnival Timing / WD26** (district XC was May 7)
- **School Sport Portal** (landing only, app not built yet)
- **KBT Trivia** (asset pipeline + Google Slides)
- **Superleague Yeah v4** (AFL fantasy draft, v4.28 live)

Vault PIN: `535554`. All credentials in vault at https://asgard-vault.pgallivan.workers.dev
