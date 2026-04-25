---
name: dispatch
description: Captain↔Cowork↔Code communication channel — Apple Notes + Slack + bridge.md atomic write
argument-hint: "[--priority] [--channel] [--deadline] [--read|<message>]"
allowed-tools: Read, Edit, Write, Bash(osascript:*), Bash(jq:*), Bash(gh issue:*), Bash(curl:*), Bash(date:*), Bash(echo:*)
context: fork
agent: general-purpose
---

# /dispatch

Captain ↔ Cowork ↔ Code messaging. Atomic write to Apple Notes folder + (optional) Slack DM + `~/.claude/bridge.md`.

Stories 16.4 (escalation gate) and 19.4 (dispatch upgrade) in EPICS-V4.md.

## Usage

```
/dispatch [--priority <fyi|normal|decision|urgent>] [--channel <captain|cowork|inbox|slack|issue>] [--deadline <24h|48h|72h>] <message>

/dispatch --read [<channel>]
```

If `--priority` is omitted, defaults to `normal`. If `--channel` omitted, defaults to `captain`. If `--deadline` set + priority is `decision` or `urgent`, captain enforces re-dispatch policy after the deadline.

### Examples

```
/dispatch "all green for King Fahad demo Friday"
/dispatch --priority decision --deadline 24h "approve $80/mo Algolia upgrade?"
/dispatch --channel cowork "Samia: please review pricing tier names in Arabic"
/dispatch --priority urgent "MRR forecast > $200/mo — need model routing decision"
/dispatch --read inbox
```

## Channels

| Channel | Note / Target | Direction | Purpose |
|---------|---------------|-----------|---------|
| `captain` | Apple Notes "Dispatch/Captain" | Captain → Abdout | Updates, summaries, weekly digests |
| `cowork` | Apple Notes "Dispatch/Cowork" + bridge.md | Cowork ↔ Code | Handoff between thinking and doing |
| `inbox` | Apple Notes "Dispatch/Inbox" | Abdout → Captain | Abdout leaves instructions |
| `slack` | Slack DM via slack MCP | Captain → human | Real-time notification (optional fallback) |
| `issue` | `gh issue create --label captain` | Captain → repo | Public/durable record (Windows fallback) |

## Priority semantics

| Priority | Format | Re-dispatch | Channel default |
|----------|--------|-------------|-----------------|
| `fyi` | Plain text, no badge | Never | `captain` |
| `normal` | Plain text | Never | `captain` |
| `decision` | `[DECISION NEEDED]` prefix + deadline | After 24h, bump to urgent | `inbox` (toward Abdout) |
| `urgent` | `[URGENT]` prefix + red marker | After 72h, captain pauses non-essential routines | `inbox` + `slack` |

`decision` and `urgent` always follow `decision-matrix.yaml.re_dispatch` policy.

## Atomic write protocol

For `decision` and `urgent`, captain writes to **all** of:

1. Apple Notes channel (Mac) or GitHub issue (Windows fallback)
2. Slack DM (if `slack` MCP configured + user has DM open)
3. `~/.claude/bridge.md` "Decisions Pending" section (so SessionStart sees it next session)

If any leg fails, captain logs the failure to `~/.claude/memory/dispatch-failures.jsonl` and continues — no transactional rollback (best-effort delivery).

## Read

```
/dispatch --read inbox     # last 5 unread Abdout instructions
/dispatch --read cowork    # last 3 Cowork bridge entries
/dispatch --read captain   # captain's own outbound log
```

`--read inbox` is invoked automatically by SessionStart hook (`scripts/session-start.sh`).

## Implementation

Underlying script: `~/.claude/scripts/dispatch.sh` (existing) — extended for `--priority`/`--deadline`/`--channel` args by Story 19.4.

```bash
~/.claude/scripts/dispatch.sh write captain "msg" [priority] [deadline]
~/.claude/scripts/dispatch.sh read inbox [n]
```

The script:
- Validates priority + channel + deadline args
- Creates the note via `osascript` (Mac) or falls back to `gh issue create` (Windows / no Notes)
- Appends to `~/.claude/bridge.md` Decisions Pending section if priority ∈ {decision, urgent}
- Logs the dispatch to `~/.claude/memory/dispatch-log.jsonl` for re-dispatch tracking

## Re-dispatch tracking

Captain checks `dispatch-log.jsonl` on every session start. For each pending dispatch:

- If `priority: decision` and `now - sent_at > 24h` and no `responded_at` → resend with `priority: urgent`
- If `priority: urgent` and `now - sent_at > 72h` → captain pauses E17.5 hourly pilot health and E22.2 prompt logging until response

Mark `responded_at` when:
- The Apple Notes Inbox shows new content from Abdout (read protocol detects this)
- Abdout commits to a related GitHub issue
- A `/dispatch --read` cycle observes the response

## Setup

Channels are created by `scripts/setup-apple-notes.sh` (Mac) or `scripts/setup-windows.ps1` (Windows fallback uses GitHub issues). Run once per machine.

## Always

1. SessionStart hook auto-invokes `/dispatch --read inbox` (see `scripts/session-start.sh`)
2. Dispatch summary at end of any significant work session
3. Use `cowork` channel when handing off between thinking (Samia in Cowork) and doing (Abdout in Code)
4. Use `decision` priority when captain's matrix says "escalate" — never silently make a decision that requires human approval

## Never

- Send `urgent` for non-urgent matters (priority erosion)
- Skip the bridge.md write — SessionStart depends on it
- Send the same dispatch twice without re-dispatch policy verification

## Reference

- Captain: `.claude/agents/captain.md`
- Matrix: `.claude/captain/decision-matrix.yaml`
- Bridge: `~/.claude/bridge.md` (created by `setup-apple-notes.sh`)
- Setup script: `scripts/setup-apple-notes.sh` (Story 19.2)
- Underlying CLI: `~/.claude/scripts/dispatch.sh`
