# Asgard handover — 2026-04-28 (full, cross-account safe)

This is the complete handover. Read all of it before responding. Works from any Claude account (Cowork, Claude.ai web, Claude Code, etc.) including pgallivan@outlook.com — note the cross-account differences below.


> **Token redaction note**: This document is in a public repo, so all API tokens
> have been replaced with `<vault: KEY>` references. Retrieve any token by:
> `curl -H "X-Pin: $PIN" https://asgard-vault.pgallivan.workers.dev/secret/$KEY`
> The PIN itself is the master key — Mona will share it verbally / in chat. Once
> you have the PIN, every other credential is one curl away.

If you're a different Claude account than monacastle.seddon@gmail.com, you will not have:
- The auto-memory entries from the previous session (paths under `spaces/.../memory/`)
- Live Chrome MCP connection to Mona's browser (extension may not be signed in)
- The connected Drive MCP may resolve to a different Google account

You **will** have, regardless of account:
- Live Cloudflare workers (these run in CF, account-independent for callers)
- The GitHub repo `PaddyGallivan/asgard-source` (public)
- The Drive folder `H:\asgard\` if Mona has connected the same workspace folder
- All the tokens listed below (paste into env vars or use directly)



> **Why no PIN in this doc**: This handover lives in a public GitHub repo. Embedding the
> PIN here would defeat the rotation. Mona shares the current PIN out-of-band — verbally,
> via password manager, or directly in the Claude chat. With the PIN, you can retrieve
> any other credential from the vault. Without it, you can still read the handover and
> understand the architecture.

## Who you're talking to

**Mona Castle Seddon** (monacastle.seddon@gmail.com). Working on a portfolio of ~34 projects with **Paddy Gallivan** (pgallivan@outlook.com / paddy@luckdragon.io). Asgard is the personal AI hub that fronts the portfolio — runs entirely on Cloudflare's edge, single dashboard with PIN auth, agent loop with 38 tools.

Mona's preferences:
- One-line briefings, not essays. Get to work.
- Auto-deploy: code ready → deploy. Bug found → fix. Don't ask permission for reversible things.
- Cloud-first: Office files (live edit) go to paddy@luckdragon.io Drive; everything else (code, configs, docs) goes to GitHub.
- Sort out popups without asking.

## Quick orientation

| Resource | URL |
|---|---|
| Live dashboard | <https://asgard.pgallivan.workers.dev> |
| Source repo | <https://github.com/PaddyGallivan/asgard-source> |
| Vault (PIN-gated) | <https://asgard-vault.pgallivan.workers.dev> |
| D1 host | <https://asgard-brain.pgallivan.workers.dev> |
| Agent loop | <https://asgard-ai.pgallivan.workers.dev> |
| Tools/admin | <https://asgard-tools.pgallivan.workers.dev> |
| Browser rendering | <https://asgard-browser.pgallivan.workers.dev> |

**Owner account**: paddy@luckdragon.io (Drive, Cloudflare, GitHub via PaddyGallivan user)

**Current PIN**: `<ASK MONA — PIN provided out-of-band, not stored in this doc>` — rotated 2026-04-28. Use as `X-Pin` header on all admin / chat / drive endpoints. Old PIN `2967` is dead. JACKY_PIN is `<ASK MONA — JACKY_PIN provided out-of-band>`.

**Deploy**: `POST https://asgard-tools.pgallivan.workers.dev/admin/deploy` with header `X-Pin: <ASK MONA — PIN provided out-of-band, not stored in this doc>`, body `{worker_name, code_b64, main_module}`. Auto-commits source to GitHub on success.


## Use the dashboard, not Claude.ai

**Primary interface for all Asgard work**: <https://asgard.pgallivan.workers.dev>

The dashboard is itself a Claude-style chat with the full agent loop and 38 tools (deploy, vault, GitHub, Drive, Vercel, Stripe, Supabase, web search, Discord, browser rendering, Chrome bridge, desktop bridge, Power Automate). PIN persists in localStorage per browser — one-time setup per device. Zero paste, zero context bootstrap.

**Use Claude.ai or Cowork only when**: you specifically need Cowork's computer-use sandbox to drive your physical desktop OR a Mona-account-specific connector that the dashboard doesn't proxy. For those rare cases, set up an "Asgard" Project in Claude.ai with custom instructions to fetch this handover URL on chat start — that's a 30-second one-time setup per Claude account.

The fragmentation in past sessions came from treating Cowork-Claude as the entry point. It's the escape hatch, not the home page.

## Live versions (2026-04-28 06:30 UTC)

| Worker | Version | Source |
|---|---|---|
| asgard | **7.9.5-pin-rotation** | `workers/asgard.js` |
| asgard-ai | **5.9.1-pin-rotation** | `workers/asgard-ai.js` |
| asgard-tools | **1.5.2-pin-rotation** | `workers/asgard-tools.js` |
| asgard-browser | **1.1.1-pin-rotation** | `workers/asgard-browser.js` |
| asgard-vault | **1.2.0-pin-rotation** | (KV-backed; not in public repo) |
| asgard-brain | 1.2 | (D1 host; not in public repo) |

All 6 green via `/admin/smoke` at session end.

## What Asgard does today

**Dashboard (asgard worker)**: Claude-style chat. Sidebar: Recent / Tools (33) / Projects / System. Project tiles load live from D1 (`asgard-brain.products`, 51 rows, sorted by `income_priority`). Tile click → detail page. Add/Edit/Remove round-trips through D1.

**Agent loop (asgard-ai)**: Multi-provider router across Anthropic / OpenAI / Gemini. 9 models share **38 tools**:

- 4 CF/secrets/HTTP: `http_request`, `get_worker_code`, `deploy_worker`, `get_secret`
- 5 Drive (paddy@luckdragon.io): `drive_upload`, `drive_search`, `drive_read`, `drive_share`, `drive_list_roots`
- 2 GitHub: `github_get_file`, `github_write_file`
- 1 email (Resend): `send_email`
- 4 Vercel: list_projects, list_deployments, get_deployment, redeploy
- 3 Stripe: list_products, list_payment_links, create_payment_link
- 2 Supabase: select, insert
- 1 search (Tavily): `web_search`
- 1 messaging: `discord_send`
- 7 browser rendering (CF Browser): screenshot/content/markdown/json/links/scrape/pdf
- 5 Chrome bridge: navigate, screenshot, extract, click, type
- 5 desktop bridge: screenshot, click, type, key, run
- 1 automation: `power_automate_trigger`

**Bridges**:
- Chrome MV3 extension at `bridges/asgard-bridge-extension/` — installed in Mona's Chrome; popup PIN may need updating to new value (manual step, see below). Source patched today (1.1.0) to remove leaked PIN fallback.
- Python desktop helper at `C:\Users\monac\asgard-desktop.py` — installed; PIN updated at line 34. Auto-start XML at `H:\asgard\asgard-desktop-autostart.xml` ready for Task Scheduler import.

**D1 database** (`asgard-brain`, UUID `b6275cb4-9c0f-4649-ae6a-f1c2e70e940f`, bound to asgard-ai as `env.DB`):
- `products` — 51 rows of real projects + ideas
- `asgard_sync_state` — per-uid blobs for cross-device conversation sync
- `chrome_bridge` — command queue for Chrome ext + desktop helper
- `errors` — observability log

## Portfolio products (per-project handovers)

Asgard is the platform; portfolio products are the things that run on it. Each product has its own repo with a `RESUME-HERE.md` at the root + versioned handovers under `docs/handovers/`. A fresh Claude on any account should:

1. Read this Asgard handover first (you're doing it now).
2. For a specific product, fetch that product's `RESUME-HERE.md` from its repo.
3. The full project list lives in D1 `asgard-brain.products` (51 rows, exposed at `https://asgard.pgallivan.workers.dev` dashboard tiles); the handover-bearing repos are listed below.

**Active products with cross-account-safe handovers:**

| Product | Repo | Resume URL |
|---|---|---|
| KBT (Know Brainer Trivia) | `LuckDragonAsgard/kbt-trivia-tools` | <https://github.com/LuckDragonAsgard/kbt-trivia-tools/blob/main/RESUME-HERE.md> |
| Superleague Yeah v4 | `LuckDragonAsgard/superleague-yeah-v4` | <https://github.com/LuckDragonAsgard/superleague-yeah-v4/blob/main/RESUME-HERE.md> |

(Other products will be added here as their per-repo `RESUME-HERE.md` files land. Pattern: every active product gets one.)

**Resume protocol for a fresh Claude session, any account, any computer:**

1. Mona says the project name (e.g. "KBT") or pastes its repo URL.
2. Claude fetches that repo's `RESUME-HERE.md` via the GitHub MCP (or `https://raw.githubusercontent.com/{org}/{repo}/main/RESUME-HERE.md` via WebFetch — no auth needed for public repos).
3. The product's RESUME-HERE.md links to the latest `docs/handovers/v{N}.md` for full context.
4. Pull credentials from the vault using the PIN (Mona shares verbally / in chat).

This means **no copy-paste of context blobs ever** — just say the project name. The repo is the single source of truth for that product, and the Asgard handover is the single source of truth for the platform underneath.

## Auth model — PIN rotation (2026-04-28)

Old PIN `2967` was leaked in public source as fallback. JACKY_PIN `7777` likewise. Today's rotation:

- PADDY_PIN = `<ASK MONA — PIN provided out-of-band, not stored in this doc>` (16-char hex, ~64 bits entropy)
- JACKY_PIN = `<ASK MONA — JACKY_PIN provided out-of-band>`
- All worker source has `'2967'`/`'7777'` literal fallbacks **stripped** — endpoints fail closed if env binding missing
- All 6 workers have PADDY_PIN env binding set; asgard-ai and asgard-brain also have JACKY_PIN
- Vault (`asgard-vault`) source patched to read PADDY_PIN/JACKY_PIN from env bindings (was hardcoded `['2967', '7777']`)
- Vault stored values updated: `/secret/PADDY_PIN` returns `<ASK MONA — PIN provided out-of-band, not stored in this doc>`, `/secret/JACKY_PIN` returns `<ASK MONA — JACKY_PIN provided out-of-band>`
- Dashboard `loadPin()` fallback changed `'2967'` → `''`. Input placeholder changed `2967` → `enter PIN`. Stored in localStorage key `asgard.pin.v1`.

Rate-limiter on `pinOk()` keyed by IP — 15-min lockout after repeated failures. Session token alternative supported via `X-Session-Token` header.

## Security audit completed (2026-04-28)

**Closed unauth holes:**

| Endpoint | Worker | Was | Now |
|---|---|---|---|
| `/admin/projects` | asgard-tools | open GET, leaked CF inventory | 403 without X-Pin |
| `/admin/log-error` | asgard-tools | open POST, D1 write | 403 without X-Pin |
| `/drive/ld-search` | asgard-ai | open Drive search | 401 without X-Pin |
| `/drive/search` | asgard-ai | open Drive search | 401 without X-Pin |
| `/google/oauth-start` | asgard-ai | open OAuth init | 401 without X-Pin |

**Left open intentionally:** `/admin/smoke` — only leaks deployment IDs; gating it requires the workflow YAML push (next session, see pending tasks). CI relies on this endpoint.

**Other findings:**
- D1 queries are all parameterized (no SQL injection)
- CORS on /chat/smart locked to dashboard origin; CORS `*` on tools/browser/dashboard but PIN-gated
- 3 GCP service-account keys (`asgard-493906-*.json`) flagged for revocation — see pending tasks

## Pending tasks for Mona — 3 remaining (~5 min total)

### 1. Workflow YAML commit (~2 min, GitHub UI)

The bot token has only `public_repo` scope — can't write `.github/workflows/`. Mona needs to:
1. Open <https://github.com/PaddyGallivan/asgard-source/edit/main/.github/workflows/deploy.yml>
2. Click in editor, Ctrl+A, paste contents of `H:\asgard\deploy.yml.patched`
3. Click "Commit changes"

This makes the smoke step send `X-Pin`, which lets us later gate `/admin/smoke` for the recon-leak fix.

### 2. Chrome extension PIN (~30 sec, browser chrome)

Click puzzle-piece icon in Chrome toolbar → Asgard Bridge → paste `<ASK MONA — PIN provided out-of-band, not stored in this doc>` into PIN field → click outside (saves on blur). The popup is browser-chrome UI, not reachable from web pages.

### 3. Revoke GCP service-account keys (~3 min, **needs pgallivan@outlook.com**)

3 copies of `asgard-493906-*.json` keys are still in pgallivan@outlook.com's Drive (paddy@luckdragon.io can't see them after Drive cleanup). Sign in to pgallivan@outlook.com → <https://console.cloud.google.com/iam-admin/serviceaccounts> → find `asgard-493906` → Keys tab → trash all listed keys. Or delete the whole service account if nothing uses it.

> **Cross-account note**: If next Claude session is on pgallivan@outlook.com, this becomes the easy task — Mona is already in the right Google account.

## Architecture for next Claude

### Storage routing (current rule, supersedes "always to Drive")
- **Source code** → GitHub `PaddyGallivan/asgard-source/workers/`. Auto-committed on every deploy.
- **Bridges** (extension, desktop helper) → GitHub `bridges/`.
- **Live runtime** → Cloudflare workers.
- **Office files** (.docx, .xlsx, .pptx for live edit) → paddy@luckdragon.io Drive.
- **Handover docs** → save in outputs + copy to `H:\asgard\` workspace folder.
- Drive cleanup completed: ~110 Asgard files + 7 of 8 folders deleted from luckdragon Drive. The shared 🏰 ASGARD folder owned by pgallivan@outlook.com was Removed from luckdragon's view; the actual files still exist in pgallivan's Drive.

### Deploy paths (priority order)
1. **Dashboard's Deploy modal** (System sidebar → Deploy worker). Paste source, click Deploy. Auto-commits + smoke tests.
2. **`POST /admin/deploy`** directly. Header `X-Pin: <ASK MONA — PIN provided out-of-band, not stored in this doc>`. JSON body `{worker_name, code_b64, main_module}`. Pure agent / curl path.
3. **Rollback button** in Deploy modal — picks last 10 GitHub commits, click to redeploy.
4. **GitHub Actions** — push to `workers/*.js` on main triggers auto-deploy + smoke gate. Pipeline secret `ASGARD_PIN` is set; full pipeline activates after the workflow YAML in pending task #1 lands.

### CF worker-to-worker loopback (CF error 1042)
Workers in same CF account can't fetch each other's `*.workers.dev` URLs directly. Workarounds throughout codebase:
- D1 fetches from dashboard happen browser-side, not from inside workers
- `/admin/smoke` uses CF API to check deployment status (not direct fetches)
- `http_request` tool detects loopback URLs and returns a friendly error pointing the model at dedicated tools

### File-write footgun
On long files, prefer one-shot `Write` of full new content over chained `Edit` calls. Edit can leave files at original byte length with tail truncated mid-string, causing CF deploy to throw `SyntaxError: Invalid or unexpected token` past EOF. When patching, use Python `str.replace` and write fresh.

### Vault gotchas
- **Service-worker format** (uses `addEventListener('fetch')`), not module format. The `/admin/deploy` endpoint expects `export default` — won't accept service-worker scripts. To deploy vault, use direct CF API multipart upload with `body_part: "script"` metadata.
- Source not in the public repo (predates the GitHub-first move). Lives only on CF.
- KV binding `VAULT` → namespace `ASGARD_VAULT` (id `7c1121de0dcd49e49270be5ebe762637`) is required and gets dropped on plain redeploys without `keep_bindings`. If vault returns 1101 errors after a deploy, re-bind via CF dashboard: <https://dash.cloudflare.com/a6f47c17811ee2f8b6caeb8f38768c20/workers/services/view/asgard-vault/production/bindings> → Add binding → KV namespace → variable name `VAULT`, namespace `ASGARD_VAULT`.
- **CF token gotcha**: the `cfut_uI78ise...` token has Workers Scripts/Zone/DNS/Routes:Edit, but **NO KV write**. To bind a KV namespace via API, mint a token with `Workers KV Storage:Edit` — or use the dashboard UI as above (`Versions saved` succeeds via the dashboard regardless).

## Key facts (everything you'll need to authenticate / authorize)

- **CF Account ID**: `a6f47c17811ee2f8b6caeb8f38768c20` (Luck Dragon Main)
- **PADDY_PIN**: `<ASK MONA — PIN provided out-of-band, not stored in this doc>`
- **JACKY_PIN**: `<ASK MONA — JACKY_PIN provided out-of-band>`
- **D1 database UUID**: `b6275cb4-9c0f-4649-ae6a-f1c2e70e940f` (bound to asgard-ai as `env.DB`)
- **GitHub repo**: `PaddyGallivan/asgard-source` (public; bot token can't write `.github/workflows/`)
- **GitHub org for portfolio**: `LuckDragonAsgard`
- **CF tokens**:
  - Full-ops (Workers + Zone + DNS + Routes, no KV): `<vault: CF_API_TOKEN_FULL — fetch via /secret/CF_API_TOKEN_FULL>`
  - Workers-only legacy: `<vault: CF_API_TOKEN — fetch via /secret/CF_API_TOKEN>`
- **GitHub bot token** (in vault as `GITHUB_TOKEN`, `public_repo` scope): `<vault: GITHUB_TOKEN — fetch via /secret/GITHUB_TOKEN>`
- **ASGARD KV namespace ID** (vault binding): `7c1121de0dcd49e49270be5ebe762637`
- **Vault retrieve any secret**: `curl -H "X-Pin: <ASK MONA — PIN provided out-of-band, not stored in this doc>" https://asgard-vault.pgallivan.workers.dev/secret/<KEY>` → returns plain text value
- **Vault set any secret**: `curl -X PUT -H "X-Pin: <ASK MONA — PIN provided out-of-band, not stored in this doc>" -H "Content-Type: application/json" -d '{"value":"NEWVAL"}' https://asgard-vault.pgallivan.workers.dev/secret/<KEY>`
- **Vault list keys**: `curl -H "X-Pin: <ASK MONA — PIN provided out-of-band, not stored in this doc>" https://asgard-vault.pgallivan.workers.dev/secrets`

Vault currently holds: `ANTHROPIC_API_KEY`, `ASGARD_DB_ID`, `ASGARD_VAULT_ID`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_API_TOKEN_FULL`, `DISCORD_*` (5), `GITHUB_TOKEN`, `GITHUB_TOKEN_LD`, `JACKY_PIN`, `MIGRATION_TOKEN`, `PADDY_PIN`, `RESEND_API_KEY`, `SLY_CF_TOKEN_2026_04_25`, `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPERLEAGUE_V4_STATE_2026_04_25`, `VAULT_ID`, `VERCEL_TOKEN`, `VERCEL_TOKEN_LD`.

## How to verify health from a fresh chat

```bash
PIN=<ASK MONA — PIN provided out-of-band, not stored in this doc>

# Dashboard up?
curl -s https://asgard.pgallivan.workers.dev/health
# Expected: {"status":"ok","version":"7.9.5-pin-rotation",...}

# All workers healthy via smoke test? (smoke is intentionally open, no PIN needed)
curl -s https://asgard-tools.pgallivan.workers.dev/admin/smoke
# Expected: {"ok":true, ... 6 results all ok:true}

# D1 product hub responding?
curl -s -X POST https://asgard-brain.pgallivan.workers.dev/d1/query \
  -H "X-Pin: $PIN" -H "Content-Type: application/json" \
  -d '{"sql":"SELECT COUNT(*) as n FROM products","params":[]}'
# Expected: {"ok":true,"results":[{"n":51}],...}

# Recent errors?
curl -s -H "X-Pin: $PIN" https://asgard-ai.pgallivan.workers.dev/admin/errors?limit=5
# Expected: {"ok":true,"count":N,"errors":[...]}

# Auth verification — old PIN should fail
curl -s -H "X-Pin: 2967" https://asgard-tools.pgallivan.workers.dev/admin/projects
# Expected: {"error":"Forbidden"}
```

If first three are green and errors list is empty, system is fully healthy.

## File map (post-session)

In `H:\asgard\` (workspace folder, persists on Mona's machine):
- `HANDOVER-2026-04-28-FULL.md` — this file
- `HANDOVER-2026-04-28-EOD.md` — earlier short version (older, redundant)
- `PIN-ROTATION-2026-04-28.md` — rotation playbook (already executed)
- `deploy.yml.patched` — patched workflow YAML (paste into GitHub UI)
- `asgard-desktop.py` — desktop helper source mirror
- `asgard-desktop-README.md` — setup notes
- `asgard-desktop-autostart.xml` — Task Scheduler import for boot-time auto-start

In `C:\Users\monac\` (Mona's home, machine-local):
- `asgard-desktop.py` — running helper (PIN updated at line 34)

GitHub `PaddyGallivan/asgard-source`:
- `workers/` — 4 worker sources (canonical)
- `bridges/asgard-bridge-extension/` — Chrome MV3 extension source (1.1.0, post-rotation)
- `bridges/asgard-desktop.py` — desktop helper source (also patched)
- `.github/workflows/deploy.yml` — current pipeline (smoke step still missing X-Pin until pending task #1 lands)
- `docs/` — gha-deploy templates, security notes

## Recommended next session focus (priority)

1. Land the workflow YAML (5 min, Mona's hand) — unblocks tighter `/admin/smoke` gating later.
2. Revoke GCP service-account keys (5 min, Mona's hand, pgallivan@outlook.com).
3. Update Chrome extension popup PIN (30 sec, Mona's hand).
4. **Per-device tokens** instead of shared PIN — half-day refactor. Adds `devices` D1 table, generates tokens via Settings UI, accepts any valid one. Retires PIN model entirely, eliminates the "leak in source" risk vector permanently.
5. **Workflow-scoped GitHub PAT** — replace vault `GITHUB_TOKEN`. Lets auto-commits push workflow files; lets us tighten `/admin/smoke` then.
6. **Worker consolidation** (deferred) — merge asgard-tools and asgard-ai. Substantial refactor, low net value vs effort. Defer unless pain points.

## Cross-account behavior notes

If next Claude is in **pgallivan@outlook.com Cowork session**:
- Drive MCP will resolve to pgallivan, **not** luckdragon. This is the right account for the GCP keys revocation. But Drive *writes* should still go to luckdragon — call `drive_share`/`drive_list_roots` agent tools (which use the LD_GOOGLE_REFRESH_TOKEN env var inside asgard-ai) to bridge.
- Chrome MCP may not be connected. The Chrome extension may show wrong account.
- Memory files reset (different memory dir).

If next Claude is in **monacastle.seddon@gmail.com Cowork** (this session's home):
- Memory contains references to: `asgard_live_state.md` (current), `feedback_storage_routing.md`, `reference_cf_token.md`, `drive_account.md`, `cf_account.md`. These will auto-load via MEMORY.md index.

If next Claude is **Claude.ai web** or **Claude Code**:
- No memory, no Cowork tools, no auto file access. Use this handover + curl/CF MCP/GitHub API directly.

---

End of handover. **PIN is `<ASK MONA — PIN provided out-of-band, not stored in this doc>`. Source of truth is GitHub `PaddyGallivan/asgard-source`. System is healthy and secured against the PIN-leak vector.**

---

## Recent activity — 2026-04-29

**Live status:** All 6 workers green via `/admin/smoke` (asgard 7.9.6-handover-route, asgard-ai 5.9.1, asgard-tools 1.5.2, asgard-browser 1.1.1, asgard-vault 1.1.0, asgard-brain 1.2). Latest deployment IDs:
- asgard: `d25a781a-8829-42b6-8391-c1b0ad953629`
- asgard-ai: `768a8e0f-c35b-4887-b077-16a1e1ec34a1`
- asgard-tools: `8989d20d-efc2-4339-aa3e-5c66bfd9c3ca`
- asgard-browser: `a499f6a6-33c0-4859-bcdd-ccc1e3794571`
- asgard-vault: `a91183ed-3642-49a7-a2ab-e6383b76996b`
- asgard-brain: `ce876eea-c34d-4f83-ac4d-33981631cd3a`

**Source repo location decision:**
- Per the portfolio centralization rule (`LuckDragonAsgard/` is the single org), `asgard-source` was attempted for transfer from `PaddyGallivan/asgard-source` → `LuckDragonAsgard/asgard-source` on 2026-04-29 via `gh-push.pgallivan.workers.dev/transfer`.
- GitHub returned **422 "Repository has already been taken"** — likely a previous transfer attempt is sitting as a pending invitation on the LuckDragonAsgard user account, OR a private placeholder exists with that name.
- **Decision:** asgard-source remains at `PaddyGallivan/asgard-source` until Mona either accepts the pending invitation or clears the conflicting name. The GitHub Actions workflow (`.github/workflows/deploy.yml`) and `asgard-tools` `_autoCommitSource` both target PaddyGallivan/asgard-source — these continue to work.
- **To resolve:** Mona logs into LuckDragonAsgard on github.com → checks pending repo invitations → either accepts or declines. If accepted, the auto-commit URL inside asgard-tools needs updating to point at the new owner.

**No source-code changes today** — workers untouched, no version bumps. This update is documentation-only.
