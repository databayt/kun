---
name: Long
description: Long mode — a goal run step by step overnight, every step evidenced on a GitHub issue
when_to_use: "Use when a long job should run unattended on this Mac until done, failed or past a deadline. Not a short task (/dispatch). Triggers on: long mode, long cycle, night shift, run overnight, go long, keep working while I sleep, طول الليل, شغل طويل."
argument-hint: "<goal> | status | stop <n> | resume <n>"
allowed-tools: Bash(kun-long *), Bash(long *), Bash(gh *)
lane: build
effort: medium
---

# Long mode

Turn the person's words into one `kun-long` command, run it, and answer with the issue URL. The loop starts detached on this Mac; the issue is the record.

## Argument: $ARGUMENTS

## Steps

1. Write the goal as one clear sentence: what is done when it is finished, which repo.
2. Pick flags from the words:
   - repo named or obvious → `--repo <name>` (a folder under `~`, `~/oss` or `~/Documents`)
   - "for N hours" → `--hours N` (default 8); "at most N steps" → `--steps-max N`
   - a slow step → `--step-timeout MIN` (default 30)
   - he names an agent → `--to fcc|opencode|claude|codex|agy` (default `fcc`, the free pool, class `long`)
   - "queue it" or "on the other machine" → `--queue` (files only; a runner picks it up) and `--machine <login>|any`
3. **Private work** — the goal touches leads, the CRM, email replies, WhatsApp, or schools' users or their data → add `--private`. It files in the private repo and runs only on `claude`. Never send such a goal to a free agent.
4. Run: `kun-long "<goal>" [flags]`. It prints the issue URL and the log path and returns at once.
5. Reply with the issue URL and one line: how to watch (`kun-long status`) and stop (`kun-long stop <n>`).

## Other verbs

- `kun-long status` — open long issues, step k/N, which run here, last step time
- `kun-long stop <n|all>` — the loop pauses after the current step
- `kun-long resume <n>` — continue a paused or failed issue
- `kun-long log <n>` — tail the local log

No power or Wi-Fi gate: it starts when he says. Docs: `content/docs/machine/long.mdx`.
