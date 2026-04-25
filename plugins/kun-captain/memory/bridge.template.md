# Cowork ↔ Code Bridge

> **Template** — to be installed at `~/.claude/bridge.md` by `scripts/setup-apple-notes.sh` (Story 19.2).
> This file in `.claude/memory/` is the canonical schema; the live bridge file is at `~/.claude/bridge.md` (user-scope, gitignored).

Both Cowork (Claude Desktop) and Claude Code read and write this file via filesystem MCP.

---

## Cowork → Code

Things Cowork (Samia, Ali, business operations) wants Code to know or do.

_(empty)_

---

## Code → Cowork

Things Code (Abdout's engineering session) wants Cowork to know or pick up.

_(empty)_

---

## Decisions Pending

Items captain has dispatched to Abdout for human decision. Format:

```
- [ ] [<priority>] <title> — dispatched <date>, deadline <date+24h>
  Context: <one paragraph>
  Recommendation: <captain's recommendation>
  Channel: <apple-notes-inbox | slack-dm | github-issue>
```

_(empty)_

---

## Notes

- Captain rewrites the "Decisions Pending" section every weekly cycle
- SessionStart hook reads this file and includes a summary in the session's `additionalContext`
- SessionEnd hook (optional) appends "what was done this session" to the appropriate direction
- Auto-archived after 30 days into `~/.claude/bridge-<YYYY-MM>.md`
