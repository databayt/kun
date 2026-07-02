---
name: credentials
description: Manage databayt credentials — API keys via Keychain, web logins via Safari
when_to_use: "Use when managing databayt credentials — storing or reading API keys via the macOS Keychain, driving Safari autofill for web logins, exporting keys for env wiring; never prints secrets into files. Triggers on: credentials, api key, log into <service>, store the key, which keys do we have."
argument-hint: "[status|setup|login|export] [service]"
---

Manage databayt credentials — API keys via Keychain, web logins via Safari autofill.

Arguments: $ARGUMENTS (subcommand: "status", "setup", "login", "export")

Available subcommands:

- **status** — Show which API keys and web passwords are configured
- **setup** — Interactive setup of missing MCP API keys (stored in macOS Keychain)
- **login [service]** — Open services in Safari for login (passwords autofill from Safari/iCloud)
- **export** — Print environment variables for shell sourcing

Run the credentials script:

```bash
/Users/abdout/kun/.claude/scripts/credentials.sh $ARGUMENTS
```

If no argument given, show status.

After storing new API keys, remind user to:

1. Run `eval $(/Users/abdout/kun/.claude/scripts/credentials.sh export)` to load into shell
2. Restart Claude Code to pick up new MCP connections
