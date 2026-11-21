---
name: provision
description: Take a teammate's computer to 100% readiness and keep it there
when_to_use: "Use when a machine must be made ready or kept ready — check every readiness step, auto-fix what is safe, apply due updates, and hand human steps to a person. Runs from the one-liner's terminal or the Machine app's Heal with agent. Unlike /health (engine drift and counts) it acts on one computer. Triggers on: provision, readiness, heal my machine, complete setup, is my machine ready, update everything, جهّز الجهاز, صحة الجهاز."
argument-hint: "[check|complete|maintain] [--only id,id] [--departments a,b] [--role engineer|member]"
lane: build
effort: medium
---

# Provision — one machine to 100%, and it stays there

The catalog is `.claude/machine/readiness.json` (stages: identity, accounts, foundation, repos, agents, engine, tools). Probes run through `bash .claude/scripts/kun-ready <probe>` (exit 0 pass, 1 fail, 2 skip).

## 1. The script runs first (deterministic)

```
node .claude/skills/provision/scripts/provision.mjs --check --json      # read only
node .claude/skills/provision/scripts/provision.mjs --complete --json   # check, fix auto steps, re-check (max 3 passes)
node .claude/skills/provision/scripts/provision.mjs --maintain --json   # complete + due updates
```

Flags: `--only id1,id2` (plus their `after` deps), `--departments a,b`, `--role engineer|member` (default: `~/.claude/state/machine-profile.json`, else all), `--dry-run` (print the fixes it would run), `--catalog <path>`, no `--json` for a table.

It emits NDJSON events (`start`, `progress`, `step`, `pass`, `done`), writes `~/.claude/state/readiness.json`, and appends a `provision` line to the runs ledger. Guardrails are in code: no sudo, no root-level rm, no force-push, no database reset or drop; `terminal`/`link`/`request` fixes are reported, never run; env values are never echoed; one lock, one run at a time.

### Uninstall mode and the opt-out

```
node .claude/skills/provision/scripts/provision.mjs --uninstall --only tool.vscode,tool.obs --json [--dry-run]
```

`--only` is required (exit 2 without it). Each target's catalog `uninstall` (`{kind: auto|terminal, cmd, keystone?}`, catalog v2) runs dependents first. Events: `removing` then `removed`; `fail` (`no uninstaller`, or `refused: uninstall matches guardrail`); `blocked` (`needed by: a, b` — another installed step lists it in `after`); `human` (a `terminal` or keystone uninstall: the command is the detail, handed to a person, never run here). Keystones are `brew`, `node`, `repo.kun`, `claude.cli`. Repo and env removals go through `kun-trash` (to the Trash, refuses unsaved work).

A removed or handed-off step is recorded in `~/.claude/state/readiness-optout.json` (`{"removed": {id: ISO time}}`). From then on `--check` reports it `skip` ("removed by you", out of the percent), `--complete`/`--maintain` do not reinstall it, and the onboarding delta is skipped while any opt-out exists. If the thing is found installed again after 30 minutes the opt-out is dropped; `--complete --only <id>` is an explicit reinstall and clears it. The state file lists current opt-outs under `removed`.

## 2. The agent's job after the script

For each step still failing after `--complete` (and not `human`):

1. Read its probe (`kun-ready`) and its `fix`/`update` command in the catalog; read the detail line, logs, tool versions.
2. Diagnose why the auto fix did not take (PATH, a half-install, an expired login, a stale clone, a missing dependency step).
3. Repair within the hard rules below, then re-run `provision.mjs --only <id> --json` to prove it.
4. Stop at `human` steps: name them and say what the person must do (the step's `fix.message` / `cmd` / `url`).

## Hard rules

- Never print a secret or an env value; never read credential files into the output.
- No deletes outside caches. No `sudo`. No production deploys. No Fable model.
- No force-push, no destructive database command. Main-only git.
- A step that needs a login, a code or a payment is a person's — report it, do not work around it.

## Receipt (always end with one)

- **Fixed**: ids and what changed.
- **Remains**: ids still failing, with the reason in one line.
- **Who must act**: per human step, who and what (login, request to Abdout, link).
- Final percent from the last `done` event.

Used by the Machine app's "Heal with agent": `claude -p "Use the provision skill to heal: <ids>"`.
