# Asgard — Handover (rebuilt 2026-04-27, end of Session 5)

> **Read this first if you're resuming Asgard work.** Self-contained. Live runtime is on Cloudflare. Source canonical is **GitHub**: https://github.com/PaddyGallivan/asgard-source. **Drive is no longer used for source/configs/handovers.** This file lives only on GitHub.

> **Session 5 tagline:** Asgard worker stack patched (drive purged from runtime). Drive evacuation: paddy@luckdragon.io migrated to R2 (2532 objects, ~3.3 GB, 99.8% of inventoried files). Two Drive accounts still pending share-with-SA. Thread A's GHA workflow file is the only remaining 30-sec user-side task for Asgard CI/CD.

## Quick orientation

- Live dashboard: https://asgard.pgallivan.workers.dev (PIN `2967`)
- Source: https://github.com/PaddyGallivan/asgard-source
- Owner account: paddy@luckdragon.io (Cloudflare + GitHub via PaddyGallivan user)
- Deploy mechanism: `POST https://asgard-tools.pgallivan.workers.dev/admin/deploy` with header `X-Pin: 2967`, body `{worker_name, code_b64, main_module}`. Auto-commits source to GitHub on success.
- Push-without-token relay: `POST https://gh-push.pgallivan.workers.dev/` body `{owner, repo, path, content (RAW TEXT not base64), message}`.

## Live versions (verified 2026-04-27 13:21 UTC)

| Worker | Version | Last deploy (UTC) | Source |
|---|---|---|---|
| asgard | **7.9.2** (Drive purged) | 2026-04-27 11:57 | `workers/asgard.js` |
| asgard-ai | **5.8.5-drive-share** | 2026-04-27 12:07 | `workers/asgard-ai.js` |
| asgard-tools | 1.4.1-rollback-only | 2026-04-27 11:11 | `workers/asgard-tools.js` |
| asgard-browser | 1.1.0 | 2026-04-27 07:01 | `workers/asgard-browser.js` |
| asgard-vault | 1.1.0 | 2026-04-25 13:20 | (existing) |
| asgard-brain | 1.2 | 2026-04-24 15:48 | (existing, holds D1) |
| **drive-r2-migrator** | session-5 stream+shallow+dedupe | 2026-04-27 13:20 | `tools/drive-r2-migrator/src/*.js` |

## What Asgard does today

Dashboard, agent loop with 36 tools across 9 models (Anthropic / OpenAI / Gemini), Chrome bridge, Desktop bridge, Power Automate, D1 product hub, smoke-gate with rollback. See previous-session detail in commit history.

## Session 5 wins

1. **Drive references purged from `asgard.js`** (v7.9.2). Dashboard install instructions now point to `codeload.github.com/.../main.zip` and `raw.githubusercontent.com/.../bridges/asgard-desktop.py`. Source-pointer context strings reference GitHub paths instead of `G:\My Drive\...`.
2. **HANDOVER-EOD.md rebuilt** (was truncated mid-section in Session 4 commit).
3. **GHA setup half-done** — `CF_API_TOKEN` and `ASGARD_PIN` are now repo secrets at `PaddyGallivan/asgard-source`. The vault `GITHUB_TOKEN` only has `public_repo` scope so it can't write `.github/workflows/`. Verified via direct git-data API attempt; the scope check is hard. Workflow file commit is the only remaining gate.
4. **`/drive/ld-share` and `/drive/ld-list-roots` added to asgard-ai 5.8.5** — used to share paddy@luckdragon.io's 13 top-level Drive folders with the migrator's SA (`kbt-slides@asgard-493906.iam.gserviceaccount.com`).
5. **Drive evacuation pushed end-to-end for paddy@luckdragon.io.** Migrator deployed at `https://drive-r2-migrator.pgallivan.workers.dev`. Walked all 2202 files in 🏰 ASGARD client-side via `/list-shallow` (recursive `/list` hits CF Workers free-tier 1101 CPU exception on big folders). Migrated in ~241 batches across multiple parallel waves. **Final: 2198/2202 in R2 under `paddy@luckdragon.io/asgard-castle/` (99.8%, 3.27 GB).** Plus the other 12 simpler folders fully migrated earlier in session: ASGARD, Asgard, _backup, bb-deploy-stage, bulldogs-boat, schoolsportportal, sportcarnival-full, SportPortal-build, sportportal, sportportal-fixes, ssp-full, williamstownps. **Total paddy@luckdragon.io footprint in R2: ~2532 objects, ~3.3 GB.**
6. **Migrator patches landed:** `dedupeR2Key()` (id-suffix on R2 key collisions — 9 `upload.bin` files at the castle root collided; re-migrated with unique names), `/list-shallow` endpoint (depth=1, used for deep folders), streaming put via `FixedLengthStream` (large files no longer blow memory).

## Critical gotcha: multipart worker deploy must include `bindings`

When deploying via `PUT /accounts/{acct}/workers/scripts/{name}` with multipart, the metadata MUST list bindings explicitly. Omitting them strips them and `env.ARCHIVE` etc. become undefined at runtime, even though `/bindings` GET still shows them. Use `inherit` for secrets:

```json
{
  "main_module": "index.js",
  "compatibility_date": "2025-01-01",
  "bindings": [
    {"type": "r2_bucket",   "name": "ARCHIVE",  "bucket_name": "asgard-archive"},
    {"type": "r2_bucket",   "name": "MANIFEST", "bucket_name": "asgard-archive-manifest"},
    {"type": "inherit",     "name": "GOOGLE_SA_JSON"},
    {"type": "inherit",     "name": "MIGRATION_TOKEN"}
  ]
}
```

## What still needs the user

### A. Activate GitHub Actions CI/CD (~30 sec — web UI, no PAT needed)

Repo secrets are already in place. The only remaining step is committing `.github/workflows/deploy.yml` from `docs/gha-deploy.yml.template`. Genuinely scope-locked at the API (vault `GITHUB_TOKEN` only has `public_repo`); web UI uses the user's session.

Prefilled URL — click and "Commit new file":
https://github.com/PaddyGallivan/asgard-source/new/main?filename=.github/workflows/deploy.yml

Then paste the YAML from `docs/gha-deploy.yml.template`.

### B. Migrate other 2 Drive accounts

`pgallivan@outlook.com` and `hello@knowbrainertrivia.com.au` need their top-level folders shared with `kbt-slides@asgard-493906.iam.gserviceaccount.com` (Viewer). Two paths:

- **Option B1 (~5 min, manual):** Log into Drive UI as each account, share top-level folders with the SA email. Then any next session can run the same `/list-shallow` walk + `/migrate` flow.
- **Option B2 (~10 min, programmatic):** Run `/google/oauth-start?account=mona` and `/google/oauth-start?account=kbt` on `https://asgard-ai.pgallivan.workers.dev`, complete OAuth with full `drive` scope. Then extend `/drive/ld-list-roots` and `/drive/ld-share` to take an `account` param (use `LD_GOOGLE_REFRESH_TOKEN` as the template; add `MONA_GOOGLE_REFRESH_TOKEN` and `KBT_GOOGLE_REFRESH_TOKEN` env vars). Then run the same walk+migrate script.

### C. Install desktop helper (~3 min — unchanged from Session 4)

```
pip install pyautogui pillow requests
python ~/asgard-desktop.py
```

Until this is running, the 5 `desktop_*` tools fail.

## Drive evacuation: stragglers from paddy@luckdragon.io

4 files in 🏰 ASGARD didn't migrate cleanly. Either skip or special-case in a future session:

1. **`drive-download-20260424T150457Z-3-001.zip`** (2.05 GB) and **`drive-download-20260424T150457Z-3-002.zip`** (1.15 GB) — DUPLICATE CONTENT. The same files live extracted in their sibling `(Unzipped Files)` folders and have already been migrated as individual files. Safe to skip permanently.
2. **6–7 native Google "files" in Family Footy Tipping** — Drive `400 badRequest "The requested conversion is not supported"`. Likely Google Forms or other native types without a `.docx/.xlsx/.pptx` export. Need a `mimeType === "application/vnd.google-apps.form"` (or similar) special-case OR skip.
3. **1 file whose Drive filename literally contains `C:\Users\pgall\AppData\...`** — the migrator's `key.replace(/\\/g, '/')` mangles the path. Sanitize Drive filenames before building the R2 key.

## Architecture notes

### Storage routing — Drive is fully off
- GitHub = canonical source (auto-commit on `/admin/deploy`).
- Cloudflare = runtime + state. Workers + D1 (`asgard-brain`) + R2 (`asgard-archive`, `asgard-archive-manifest`, `asgard-backups`).
- Drive = legacy. Don't write to Drive paths. The `H:\My Drive\ASGARD\` directory on this machine is empty (paddy@luckdragon.io's Drive is on a different account; this Cowork session is `pgallivan@outlook.com`).

### Migrator usage
```
WORKER='https://drive-r2-migrator.pgallivan.workers.dev'
T=$(curl -s -H "X-Pin: 2967" https://asgard-vault.pgallivan.workers.dev/secret/MIGRATION_TOKEN)

# Shallow listing (depth=1) — fits in CPU budget for any folder
curl "$WORKER/list-shallow?folder=<id>&account=<email>&token=$T"

# Recursive listing — works for small/shallow folders only
curl "$WORKER/list?folder=<id>&account=<email>&token=$T"

# Migrate batch
curl -X POST "$WORKER/migrate?token=$T" \
  -H 'content-type: application/json' \
  -d '{"account":"<email>","files":[...]}'

# Status (per-isolate counters; resets on cold start)
curl "$WORKER/status?token=$T"
```

For deeply-nested folders, walk client-side: call `/list-shallow` per folder, accumulate files, then batched `/migrate`. See `walk_step.py` pattern from Session 5: persist a state file with frontier + visited + files lists across bash calls.

### CF Worker free-tier CPU limits
Recursive walks of folders with many files trigger CF error 1101 (uncaught exception masked). Use shallow walking client-side. Streaming via `FixedLengthStream` keeps memory-bound large file uploads working.

### Multi-provider routing
asgard-ai accepts `?provider=anthropic|openai|gemini`. All 36 tools normalised across providers. Errors land in D1 `errors` table.

## Key facts (cheat sheet)

- **PIN:** `2967` (X-Pin header for asgard-tools admin endpoints)
- **D1 database:** `asgard-brain`, UUID `b6275cb4-9c0f-4649-ae6a-f1c2e70e940f`, bound to asgard-ai as `env.DB`
- **D1 tables:** `products`, `asgard_sync_state`, `chrome_bridge`, `errors`
- **CF account:** paddy@luckdragon.io
- **CF account ID:** `a6f47c17811ee2f8b6caeb8f38768c20`
- **GitHub user:** PaddyGallivan
- **Repo:** `PaddyGallivan/asgard-source` (public)
- **gh-push relay:** `https://gh-push.pgallivan.workers.dev/` — `content` is RAW TEXT, not base64. Relay base64-encodes itself.
- **Vault:** `asgard-vault.pgallivan.workers.dev` — `GET /secret/<KEY>` returns raw value as plain text. `POST /secret/<KEY>` with body=value writes (Session 6 pattern; older `/inject` POST is a no-op).
- **R2 buckets:** `asgard-archive` (mirror), `asgard-archive-manifest` (per-call manifests at `_manifest/...`), `asgard-backups`.
- **Service account for Drive→R2:** `kbt-slides@asgard-493906.iam.gserviceaccount.com` (project `asgard-493906`, JSON in Drive at file id `1fY_Ux7iv0xhtKCiDYuozivMDAZ9kRUbo`).
- **Migrator URL:** `https://drive-r2-migrator.pgallivan.workers.dev`
- **MIGRATION_TOKEN** — pull fresh from vault, current value matches worker secret as of Session 5 EOD.

## Pending work (priority order)

**High — items needing the user**
1. Commit `.github/workflows/deploy.yml` (Section A above)
2. Share other 2 Drive accounts' folders with the SA (Section B)

**Medium — code work for next Claude**
3. Sanitize Drive filenames before building R2 key (handles backslash + slash in name) — fixes 1+6 stragglers.
4. Add Google Forms / non-exportable native handling — either skip cleanly or download the underlying response data.
5. Extend `/drive/ld-list-roots` and `/drive/ld-share` to take `?account=` param so other accounts can be processed once OAuth refresh tokens land.
6. Dedupe pass on R2: detect duplicate driveMd5 customMetadata, surface a report.

**Low — nice-to-have**
7. Per-device tokens replacing the shared PIN.
8. Worker consolidation (`asgard-tools` + `asgard-ai` → one).
9. Durable Objects WebSocket replacing polling for the Chrome bridge.

## Health check (4-line curl recipe)

```bash
# 1. Smoke (all 6 workers + deployment metadata)
curl -s -H "X-Pin: 2967" https://asgard-tools.pgallivan.workers.dev/admin/smoke

# 2. AI errors log
curl -s -H "X-Pin: 2967" https://asgard-ai.pgallivan.workers.dev/admin/errors

# 3. Dashboard reachable
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://asgard.pgallivan.workers.dev/

# 4. Migrator alive
T=$(curl -s -H "X-Pin: 2967" https://asgard-vault.pgallivan.workers.dev/secret/MIGRATION_TOKEN)
curl -s "https://drive-r2-migrator.pgallivan.workers.dev/status?token=$T"
```

## Pickup brief for the next Claude session

Paste this into the new session:

> Resuming Asgard work. Read the canonical handover at https://raw.githubusercontent.com/PaddyGallivan/asgard-source/main/docs/HANDOVER-EOD.md — it's self-contained. Run the 4-line health check at the bottom. Then check what the user wants to push on next: (A) G