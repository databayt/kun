Communicate via Apple Notes → Dispatch folder.

Arguments: $ARGUMENTS (channel + message, or "read" to check inbox)

## Channels

| Channel | Note | Direction | Purpose |
|---------|------|-----------|---------|
| `captain` | Dispatch/Captain | Captain → Abdout | Updates, decisions, summaries |
| `cowork` | Dispatch/Cowork | Cowork ↔ Code | Bridge between thinking and doing |
| `inbox` | Dispatch/Inbox | Abdout → Captain | Abdout leaves instructions for Captain |

## Write

```bash
dispatch.sh captain "message" [fyi|normal|decision|urgent]
dispatch.sh cowork "message"
dispatch.sh inbox "message"
```

## Read

```bash
dispatch.sh read inbox     # Check what Abdout wrote
dispatch.sh read cowork    # Check Cowork bridge state
dispatch.sh read captain   # Review own dispatch log
```

## Protocol

- **Captain dispatches**: status updates, decisions needed, weekly summaries
- **Cowork writes**: plans, architecture decisions, research findings → Code picks up and executes
- **Abdout writes inbox**: instructions, priorities, approvals → Captain reads and acts

## Always

1. Check inbox at start of every session: `dispatch.sh read inbox`
2. Dispatch summary at end of significant work
3. Use Cowork note when handing off between thinking (Cowork) and doing (Code)
