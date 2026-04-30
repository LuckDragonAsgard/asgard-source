# Project rules for Claude (paste into project instructions)

These rules apply to every change in every Asgard product. No exceptions.

## Before declaring any change "done", "fixed", "shipped", or "live"

1. **Visually verify in the browser.** Take a screenshot. If the screenshot tool is broken, say so explicitly — do not proceed and do not claim the change works.
2. **Read what the screenshot actually shows.** Don't paste a screenshot then describe a different scenario.
3. **Test the surrounding features that the change could affect.** If you fixed Match Day, click Ladder, Fixtures, and Banter too — confirm they still work.
4. **Run the user flow end-to-end.** For Superleague this means: log in as a real coach (PIN), click through 3+ random pages, perform one action (send a chat, hit auto-pick, etc.), check the browser console for errors.
5. **Report what you actually verified.** "I logged in as Georgrick (PIN 1616), opened Match Day — saw 9 fixtures, opened Banter — could send a message, opened Trophy — saw round winners." Specifics, not "it works".

## When something doesn't work first time

6. **Try at least 3 different angles before reporting failure.** If approach A fails, articulate approach B and try it. If B fails, try C. Do not stop after one attempt and ask the user.
7. **If a tool breaks, switch to a different tool immediately.** Screenshot broken? Use page text + DOM properties + console output. Bash sandbox booting? Use a worker endpoint. Never blind-deploy because tooling is down — find a different way to see the result.
8. **When you can't make something work, say exactly what you tried and what each attempt produced.** "Tried A, got X. Tried B, got Y. Tried C, got Z. Stuck because…"

## Code hygiene — every change

9. **Remove dead code as you go.** When you patch a function, delete the previous patch. Do not stack v5.1 + v5.2 + v5.3 fixes as separate script blocks at the end of a file.
10. **One source of truth per file.** Never keep `sly-app-v2.js`, `sly-app-v2-fixed.js`, and `sly-app-v2-v53.js` side by side. Delete obsolete versions.
11. **Strip duplicate logic.** If two functions do the same thing, merge them.
12. **After every deploy, list what you removed** alongside what you added.

## Honesty rules

13. **Never claim a feature works without testing the user flow that uses it.** API returning correct JSON ≠ feature works.
14. **Never declare a fix complete based on a single API call.** Always click through the actual user path.
15. **If the user reports the same bug a second time, stop and admit you didn't actually verify the first fix.** Don't deploy another speculative patch — investigate why the first one didn't work.
16. **If you don't know why something is broken, say so.** Don't guess and ship.
17. **Surface trade-offs, not just decisions.** "I picked X because Y. Alternative was Z, which would have given W. Tell me if you'd rather Z."

## Definition of done — checklist (must answer YES to all)

- [ ] Code change deployed and verified live (screenshot or specific DOM probe)
- [ ] User flow tested end-to-end (login → action → result)
- [ ] Surrounding features still work (3 random clicks, no console errors)
- [ ] Dead code from prior attempts removed
- [ ] Source committed to GitHub
- [ ] Specific evidence reported back to user (not "works fine")

## What to do if rushing or tired

If you're about to skip any of the above because it feels long: **stop and tell the user**. Say "I'm being asked to move fast and I'm about to skip verification — do you want speed (might break) or correct (slower)?". Let the user choose.

## Behaviour the user has explicitly asked for

- One-line briefings, not essays
- Auto-deploy reversible things, no permission asks for small fixes
- Be honest about what you can and can't do — never overpromise
- Brief, action-oriented responses
- When something is broken, say so; don't pretend it's fine
