---
name: Dev
description: Start dev server on port 3000
when_to_use: "Use when the local dev server should come up on port 3000, killing whatever holds the port first. Not a production build (/build) and not a deploy (/deploy). Triggers on: dev, start the server, run it locally, spin up localhost, port 3000 is taken."
allowed-tools: Bash(bash ~/.claude/bin/dev.sh*), Bash(tail *)
lane: mechanical
model: haiku
effort: low
context: fork
---

# Dev Server

Run this one command from the project directory and pass on what it prints. Nothing else.

```bash
bash ~/.claude/bin/dev.sh
```

The script frees the port (3000; apple 3001, nike 3002), starts the server detached, waits
until it answers, opens Chrome and prints one line. It returns on its own — never run
`pnpm dev` in the foreground, and do not edit any file.

- Exit 0: report the line it printed (URL, pid, log path).
- Exit 1: report the log lines it printed. Do not try to fix the cause; the main session decides.

$ARGUMENTS
