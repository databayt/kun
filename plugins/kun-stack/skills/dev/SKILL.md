---
name: Dev
description: Start dev server on port 3000
when_to_use: "Use when the local dev server should come up on port 3000, killing whatever holds the port first. Not a production build (/build) and not a deploy (/deploy). Triggers on: dev, start the server, run it locally, spin up localhost, port 3000 is taken."
allowed-tools: Bash(lsof *), Bash(kill *), Bash(open *), Bash(pnpm *)
---

# Dev Server

Kill any process on port 3000, open Chrome, and start the dev server.

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev
```

$ARGUMENTS
