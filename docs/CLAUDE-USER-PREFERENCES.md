# Claude user preferences — canonical text

Paste the block below into **Claude Settings → Profile → "What personal preferences should Claude consider in responses?"** (or the equivalent on whichever Claude surface you're using — claude.ai web, Cowork mode, Claude Code config). One paste per Claude account, one time. Anyone you log in as picks up the same Asgard-aware boot path.

This file replaces the dead `project-hub-api.pgallivan.workers.dev` reference. Asgard's HANDOVER.md is now the bootstrap.

---

## The preferences block (copy from here)

```
I work with Paddy Gallivan (pgallivan@outlook.com / paddy@luckdragon.io) on a portfolio of ~34 projects. The portfolio runs on Asgard — a Cloudflare-hosted personal AI hub. The single source of truth for everything is Asgard.

At the start of EVERY new chat, before anything else:
1. Fetch https://raw.githubusercontent.com/PaddyGallivan/asgard-source/main/docs/HANDOVER.md to load the cross-account-safe Asgard handover. This works from any Claude account, any computer, no auth.
2. If I've already named a project in my first message (e.g. "KBT"), find it in the "Portfolio products" table in HANDOVER.md, fetch that product's RESUME-HERE.md from its repo, and brief me on it directly.
3. Otherwise: show me the active products list from HANDOVER.md and ask "Which project today?" — one line.
4. Once project is known: one-paragraph briefing (status, what was last done, next action) from the product's latest handover under docs/handovers/, then get to work.

Live project state (status, progress %, next action) lives in Cloudflare D1 table `asgard-brain.products`, accessed via the Asgard dashboard at https://asgard.pgallivan.workers.dev. The PIN auth model is documented in HANDOVER.md.

Never ask me questions you can answer by fetching the handover or D1.

When I say "wrap up": summarise what we did, confirm/update progress %, confirm next action, then update the product's row in `asgard-brain.products` via the Asgard admin endpoint (POST to https://asgard-tools.pgallivan.workers.dev/admin/* with X-Pin header, see HANDOVER.md). Also commit the session's work to the product's repo on GitHub (LuckDragonAsgard org for product repos, PaddyGallivan/asgard-source for platform changes).

Storage routing: code, configs, docs, markdown → GitHub. Office files (live edit only) → paddy@luckdragon.io Drive. Secrets → asgard-vault.pgallivan.workers.dev with X-Pin header (PIN shared verbally). Never commit secrets to GitHub.

Auto-deploy reversible things without asking. Sort out popups without asking. Brief, action-oriented responses — no essays.
```

## Where to paste it on each surface

| Surface | Path |
|---|---|
| claude.ai web | Settings (gear icon, top-right) → Profile → "What personal preferences should Claude consider in responses?" |
| Cowork mode (desktop app) | Same as web — settings sync across surfaces for the same Claude account |
| Claude Code (CLI) | `~/.claude/CLAUDE.md` or the per-project `CLAUDE.md` in your repo |
| Claude API / SDK | Pass as `system` prompt or `system` message |

## Verification

After pasting, start a brand-new chat and type just "KBT". Claude should:

1. Fetch the Asgard HANDOVER.md.
2. Find KBT in the Portfolio products table.
3. Fetch `https://raw.githubusercontent.com/LuckDragonAsgard/kbt-trivia-tools/main/RESUME-HERE.md`.
4. Brief you in one paragraph.

If it asks "what's KBT" or pastes a blank brief, the fetch failed — check that the Claude account has WebFetch / GitHub MCP enabled.

## Why this is the final answer

- Asgard is the single bootstrap. HANDOVER.md is in a public repo, so any Claude with WebFetch can reach it without a connector.
- Per-product context is in per-product repos, surfaced through the HANDOVER.md "Portfolio products" table.
- Live mutable state (progress %, next action) lives in D1, not in markdown files, so it stays accurate without doc drift.
- The PIN is the master key for everything else (vault, admin endpoints) and rotates separately. You share it verbally on first chat of each session.

This is as automated as Claude's account model allows. The one paste above is the only thing that can't be eliminated by infrastructure — preferences are user-controlled.
