# CLAUDE.md — Paddy Gallivan / Luck Dragon Asgard
# Read this file at the start of EVERY session before doing anything else.

## Session startup (mandatory)
1. Read this file fully
2. Fetch https://raw.githubusercontent.com/LuckDragonAsgard/asgard-source/main/docs/HANDOVER.md
3. If project named in first message: find it in HANDOVER.md portfolio table, fetch its RESUME-HERE.md, brief Paddy
4. Otherwise: show active products list, ask "Which project today?" — one line only
5. Never ask questions you can answer from HANDOVER.md or D1

## Identity
- User: Paddy Gallivan
- Accounts: paddy@luckdragon.io (primary), pgallivan@outlook.com (Microsoft/backup)
- Vault PIN: 535554
- Vault: https://asgard-vault.pgallivan.workers.dev
- D1 (asgard-brain): b6275cb4-9c0f-4649-ae6a-f1c2e70e940f
- CF Account: a6f47c17811ee2f8b6caeb8f38768c20
- GitHub org: LuckDragonAsgard

## File rules
- NEVER save to temp, AppData, session folders, or any path you invented
- Always save to the current working directory (where `claude` was launched from)
- Never use present_files
- All final files go to Google Drive (paddy@luckdragon.io)
- Always re-read a file before editing it — never edit from memory
- Check file length before reading — files over 2000 lines need paginated reads

## Response style
- Brief and action-oriented only
- No preamble, no "I'll now...", no "Great question"
- No verbose explanations unless asked
- Never over-engineer — simplest thing that works

## Deployment rules
- Auto-deploy reversible things without asking
- Sort out popups without asking
- After every deploy: check runtime logs, not just deploy status
- Always include full wrangler.toml bindings on every CF deploy — they disappear if omitted
- CF Pages and CF Workers use different deploy mechanisms — know which is which
- Check CF Zone ID vs Account ID — they are different, never mix them
- After DNS changes: actually resolve the domain, don't assume propagation
- Check bundle size before CF Worker deploy — 1MB limit, fails silently if exceeded
- Never add DNS records without listing existing ones first — avoid duplicates

## Definition of DONE — never say complete until ALL of these pass:
1. Live URL opened and change visually confirmed
2. All related endpoints/pages tested — not just the one changed
3. Logs checked — no errors, no warnings
4. Old version is gone, not just new version present
5. File changes: read the file back and confirm content is correct
6. Database changes: query back and confirm data is there
7. Emails: confirm actually arrived
8. DNS: actually resolve it
9. Screenshot before AND after — compare them
10. Only after all 9 pass: say "confirmed working"

If any check fails: diagnose from scratch, fix, run ALL checks from step 1 again.
Never say "should be working", "ought to be", "looks good" — only "confirmed working" with evidence.
Never declare a task complete without running the full checklist.

## Root cause rules
- Never patch a symptom without finding root cause
- If something fails, go back to the beginning — don't keep layering fixes
- Never repeat the same fix twice — if it failed once, understand why before retrying
- Always quote the exact error message before diagnosing — never skim it
- Verify from source, never from your own prior output

## Auto-heal
- If something breaks after deploy: diagnose and fix automatically, don't wait to be asked
- If a fix fails twice: roll back to last known good state, then report what happened
- Never keep patching the same thing more than twice without a full restart of diagnosis

## Git rules
- Commit after every meaningful change — don't batch everything at the end
- Always fetch current file SHA immediately before any GitHub push (stale SHA = 409 error)
- Always `git status` before committing
- Confirm correct remote before push
- Always `npm install --save` — never install without saving to package.json
- Check .gitignore before first commit in any new project

## Code quality rules
- Always use straight quotes in code — never curly/smart quotes " " ' '
- CF API returns multipart — strip boundary headers before treating response as JS (look for first line starting with `//` or `export`)
- Always use `base64 -w 0` (no line wrapping) for large file encoding
- Always specify file encoding explicitly (UTF-8) — never assume
- Never add comments inside JSON files
- Always add CORS headers to every new API endpoint
- Pin library versions — never assume latest
- Use LF line endings in all scripts (not CRLF)
- Check for invisible unicode characters if code behaves unexpectedly

## Cloudflare specifics
- Zone ID ≠ Account ID — document both, never mix
- D1 binding disappears on CF deploy if not explicitly included every time
- CF Pages deploy: POST to pages deployments API
- CF Workers deploy: PUT to workers scripts API (or via asgard-tools)
- Always pull runtime logs after every Worker deploy
- KV = ephemeral cache, D1 = persistent data, R2 = files — use correctly
- Vault tokens may lack Zone.DNS:Edit — if DNS add fails, use CF dashboard browser session JS

## Known traps (hit before, will bite again)
- Smart quotes in JS strings → SyntaxError — always strip before running
- CF multipart response → boundary headers look like JS — strip to first `//` or `export`
- D1 binding silently disappears if not in every deploy payload
- GitHub 409 = stale SHA — always re-fetch SHA immediately before push
- 200 OK ≠ working — always verify on live URL
- CF Zone ID used where Account ID needed (or vice versa) — always double-check
- DNS propagation is not instant — wait and actually resolve before declaring done
- Pagination ignored — always check for next_page/cursor in API responses
- Node version mismatch — pin in .nvmrc or package.json engines field
- Duplicate DNS records — always list existing before adding new

## Credential map
- GITHUB_TOKEN → GitHub API pushes (LuckDragonAsgard org)
- CF_API_TOKEN / CF_FULLOPS_TOKEN / CF_TOKEN_LD → Cloudflare (may lack Zone.DNS:Edit)
- CF_PAGES_TOKEN → CF Pages deployments
- RESEND_API_KEY → transactional email
- Get any: `curl -s -H "X-Pin: 535554" https://asgard-vault.pgallivan.workers.dev/secret/NAME`

## Storage routing
- Code, configs, docs, markdown → GitHub (LuckDragonAsgard org)
- Office files (live edit) → Google Drive (paddy@luckdragon.io)
- Secrets → asgard-vault.pgallivan.workers.dev (never commit to GitHub)
- Product state (progress %, next action) → D1 asgard-brain

## Wrap up (when Paddy says "wrap up")
1. Summarise what was done this session
2. Confirm/update progress % in D1 asgard-brain
3. Confirm next action
4. Update HANDOVER.md on GitHub (LuckDragonAsgard/asgard-source)
5. Update this CLAUDE.md with any new traps or decisions discovered
6. Commit all session work to product repo on GitHub
7. Update product row in asgard-brain via POST to https://asgard-tools.pgallivan.workers.dev/admin/* with X-Pin: 535554

## Missing checks (commonly skipped — don't skip these)
- Stripe webhooks: always validate signature before processing — never trust raw payload
- CF Worker CPU time: 10ms free / 50ms paid — check if heavy operations will timeout
- Resend: check sending limits before bulk email operations
- Security headers: every new endpoint needs CSP, X-Frame-Options, X-Content-Type-Options
- Environment variables vs secrets: secrets go in vault, never in env vars in wrangler.toml
- Mobile/responsive: always check on mobile viewport, not just desktop
- Error boundaries: React apps need error boundaries or one crash kills the whole page
- Rate limiting: every public endpoint needs rate limiting before going live
- .env files: never commit, always in .gitignore, always in vault

## Falkor — teaching these rules
Falkor (luckdragon.io AI agent) must follow the same rules. Its system prompt lives at:
https://github.com/LuckDragonAsgard/falkor-family/blob/main/AGENT.md

When updating Claude rules here, also update AGENT.md in falkor-family repo.
Key Falkor-specific additions:
- Always verify tool calls actually executed — don't assume success from response text
- Log every action taken to D1 for audit trail
- Never take irreversible actions without explicit user confirmation
- If uncertain about scope, do less and ask rather than more and apologise

## Falkor auto-update: how to log new traps automatically
When Falkor encounters a new error pattern or workaround, it calls:

POST https://asgard-tools.pgallivan.workers.dev/admin/log-trap
Headers: X-Pin: 535554
Body: { "trap": "description of what went wrong and how to fix it", "product": "product name" }

This endpoint (to be built) should:
1. Fetch current CLAUDE.md SHA from GitHub
2. Append the new trap to the "Known traps" section
3. Push back to GitHub with message "auto: Falkor logged new trap — [product]"
4. Also append to HANDOVER.md known traps if relevant

Until that endpoint exists: Falkor should include discovered traps in its wrap-up summary
so Claude can manually add them to this file.

## Self-improvement rule
At the end of every session where a new bug or trap was encountered:
1. Add it to the "Known traps" section of this file
2. Commit the updated CLAUDE.md to GitHub
3. If it's a Falkor trap, also update AGENT.md in falkor-family repo

This file should grow smarter over time, not stay static.
