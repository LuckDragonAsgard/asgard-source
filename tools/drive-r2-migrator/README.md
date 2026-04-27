# drive-r2-migrator

Cloudflare Worker that pulls files from Google Drive (via service account) and writes them to R2.

Built to evacuate Paddy's Drive (paddy@luckdragon.io + pgallivan@outlook.com + hello@knowbrainertrivia.com.au) into `r2://asgard-archive`.

## Architecture

- Worker reads Drive via service account JWT (no OAuth flow, no laptop in the loop).
- Service account: `kbt-slides@asgard-493906.iam.gserviceaccount.com`. Each folder you want migrated must be shared with this email (Viewer is enough).
- R2 bucket `asgard-archive` is the destination. Keys are `<owner>/<drive-folder-path>/<filename>`.
- Manifests written to `asgard-archive-manifest` for resume / verification / dedupe.

## One-time setup

```bash
# Create the buckets
npx wrangler r2 bucket create asgard-archive
npx wrangler r2 bucket create asgard-archive-manifest

# Set the SA JSON secret (paste the file contents)
cat asgard-sa.json | npx wrangler secret put GOOGLE_SA_JSON

# Set the migration auth token (any random string — protects the endpoints)
echo 'pick-something-random' | npx wrangler secret put MIGRATION_TOKEN

# Deploy
npx wrangler deploy
```

## Use

```bash
WORKER='https://drive-r2-migrator.pgallivan.workers.dev'
T='your-migration-token'

# 1. Inventory a Drive folder (recursively walks subfolders)
curl "$WORKER/list?folder=1wni1vJjBiLe7cpF7LS5a_4FLETktQw2p&account=paddy@luckdragon.io&token=$T" \
  > asgard-manifest.json

# Manifest also stored at r2://asgard-archive-manifest/_manifest/list_*.json

# 2. Migrate in batches of 50
jq -c '.files | _nwise(50) | {account: "paddy@luckdragon.io", files: .}' asgard-manifest.json \
  | while read batch; do
      curl -sX POST "$WORKER/migrate?token=$T" \
        -H 'content-type: application/json' \
        -d "$batch" \
        | jq '{succeeded, failed}'
    done

# 3. Live status
curl "$WORKER/status?token=$T"

# 4. Verify a specific R2 object
curl "$WORKER/verify?key=paddy@luckdragon.io/ASGARD/handover.md&token=$T"
```

## What gets migrated

- Regular files: downloaded with `alt=media` and written byte-for-byte.
- Google Docs/Sheets/Slides: exported to docx/xlsx/pptx and given the right extension.
- Folders: traversed recursively. R2 has no folder concept — folder structure is encoded in keys.

## What you need to do before running

1. Add **R2 Storage:Edit** to your CF token (currently missing).
2. Share each top-level Drive folder with `kbt-slides@asgard-493906.iam.gserviceaccount.com` (Viewer).
3. Set the secrets above.
4. Deploy.

## What I haven't done yet

- Dedupe pass: a follow-up Worker reads the manifest, groups by md5, emits trash candidates.
- Drive trash: a script/snippet that takes a list of file IDs and trashes them via Drive API. (Service account can't trash files it doesn't own — Paddy will need to do this from his account, either via a browser-side script or by giving the SA Editor access on the folders.)
