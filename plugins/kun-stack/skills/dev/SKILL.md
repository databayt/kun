---
name: Dev
description: Start dev server on port 3000
allowed-tools: Bash(lsof *), Bash(kill *), Bash(open *), Bash(pnpm *)
---

# Dev Server

Kill any process on port 3000, open Chrome, and start the dev server.

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev
```

$ARGUMENTS
