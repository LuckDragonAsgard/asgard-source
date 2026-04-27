# Drive evacuation — pickup brief
**Date:** 2026-04-27
**Read this in any new Claude session that's continuing the Drive→R2 migration.**

## Where things stand

- ✅ **paddy@luckdragon.io: essentially complete (~99.8%)** — 13 top-level folders migrated to `r2://asgard-archive/paddy@luckdragon.io/...`, ~2532 R2 objects. Stragglers: 2 redundant giant zips (extracted content already in R2), a few Google Forms that don't export, 1 file with `C:\` backslashes in name.
- 🚫 **pgallivan@outlook.com: 0%** — folders not yet shared with the SA.
- 🚫 **hello@knowbrainertrivia.com.au: 0%** — folders not yet shared with the SA.

## Infrastructure (already live, working)

- **Worker:** `https://drive-r2-migrator.pgallivan.workers.dev` with `/list /list-shallow /migrate /verify /status /reset`. Source: `PaddyGallivan/asgard-source/tools/drive-r2-migrator/`.
- **R2 buckets:** `asgard-archive` (data), `asgard-archive-manifest` (per-batch JSON manifests at `_manifest/list_*` and `_manifest/migrate_*`).
- **Service account:** `kbt-slides@asgard-493906.iam.gserviceaccount.com`. SA can ONLY read folders explicitly shared with it (Viewer role is enough).
- **CF account:** `a6f47c17811ee2f8b6caeb8f38768c20` (Luck Dragon Main).

## Credentials (X-Pin 2967, fetch from vault)

```
curl -H "X-Pin: 2967" https://asgard-vault.pgallivan.workers.dev/secret/MIGRATION_TOKEN
curl -H "X-Pin: 2967" https://asgard-vault.pgallivan.workers.dev/secret/CF_API_TOKEN
curl -H "X-Pin: 2967" https://asgard-vault.pgallivan.workers.dev/secret/CF_ACCOUNT_ID
```

`CF_API_TOKEN` has R2:Edit and Workers Scripts:Edit. Use it for any deploy/redeploy.

## Pickup steps

1. **Verify Worker is healthy:**
   ```
   curl -A Mozilla/5.0 "https://drive-r2-migrator.pgallivan.workers.dev/status?token=<MIG>"
   ```
   If `bindings` array is missing R2 (check via CF API at `/accounts/<ACC>/workers/scripts/drive-r2-migrator/settings`), redeploy from `tools/drive-r2-migrator/` with `wrangler deploy --keep-vars`.

2. **For pgallivan@outlook.com and hello@knowbrainertrivia.com.au:** they need top-level folders shared with `kbt-slides@asgard-493906.iam.gserviceaccount.com`. Two paths:
   - **Drive UI clicks:** Paddy right-clicks each top-level folder → Share → paste SA email → Viewer. ~5 min per account.
   - **OAuth+API:** Add `MONA_GOOGLE_REFRESH_TOKEN` (for pgallivan@outlook.com) and `KBT_GOOGLE_REFRESH_TOKEN` (for hello@knowbrainertrivia.com.au) to asgard-ai. Scope must be `drive` (full read), not `drive.file`. Use `/google/oauth-start?account=<name>` flow. Then extend `/drive/ld-list-roots` and `/drive/ld-share` (already on asgard-ai 5.8.5) to take an `account` param.

3. **Walk + migrate:** for each shared folder ID, walk shallow recursively (BFS, depth-1 per call to avoid Worker CPU 1101 errors), batch into `/migrate` with parallel=5 batchsize=8. Sample script pattern:
   ```python
   # POST /migrate?token=<MIG>
   # body: {"account": "<owner-email>", "files": [{id, path, mimeType, size, isGoogleNative, ...}]}
   ```

4. **Tail risk — 2 giant zips** (2.1 GB and 1.2 GB) inside paddy@luckdragon.io ASGARD: they exceed the Worker's ~128 MB memory limit. Either skip (their content is also stored extracted in the sibling `(Unzipped Files)` folder, already migrated) OR implement multipart streaming via `env.ARCHIVE.createMultipartUpload(key)` + chunked Drive Range requests.

5. **Dedupe + trash from Drive:** defer to a second pass after all 3 accounts confirmed clean in R2. Existing guardrail: Claude can't delete from Drive directly — produce one-click trash links per the `drive_delete_guardrail` memory.

## Worker behavioural notes (gotchas)

- `R2.put` requires known-length body. Use `await resp.arrayBuffer()` (NOT streaming `resp.body`) in `migrateOne`. Streaming triggers `"Provided readable stream must have a known length"`.
- **Always `wrangler deploy --keep-vars`** so secrets and R2 bindings stay attached. Otherwise `env.ARCHIVE` goes undefined and migrate returns "Cannot read properties of undefined (reading 'put')".
- Two parallel sessions deploying conflicting versions caused issues today. After any deploy by another session, re-check `bindings` via CF API. Redeploy if needed.
- workers.dev free tier returns CF error 1010 on default `python-urllib` UA. Always send `User-Agent: Mozilla/5.0`.

## Security TODOs (rotate before further work)

- SA JSON `1fY_Ux7iv0xhtKCiDYuozivMDAZ9kRUbo` and second SA JSON in Drive root — rotate the still-active key, delete files from Drive after migration.
- Leaked CF token in `fix-streamline-domain.mjs` (in Drive root) — rotate.

## Source of truth

- Worker code: `https://github.com/PaddyGallivan/asgard-source/tree/main/tools/drive-r2-migrator`
- This handover: `https://raw.githubusercontent.com/PaddyGallivan/asgard-source/main/docs/DRIVE-EVACUATION-HANDOVER.md`
- Asgard handover (general): `https://raw.githubusercontent.com/PaddyGallivan/asgard-source/main/docs/HANDOVER-EOD.md`

## First message for next Claude (any account)

> Continue Drive evacuation. paddy@luckdragon.io is 99.8% done. Read https://raw.githubusercontent.com/PaddyGallivan/asgard-source/main/docs/DRIVE-EVACUATION-HANDOVER.md for full state. Then either share pgallivan@outlook.com + hello@knowbrainertrivia.com.au top-level folders with `kbt-slides@asgard-493906.iam.gserviceaccount.com`, OR set up multi-account OAuth on asgard-ai. Pull MIGRATION_TOKEN from vault and resume `/list` + `/migrate` against `https://drive-r2-migrator.pgallivan.workers.dev`.
