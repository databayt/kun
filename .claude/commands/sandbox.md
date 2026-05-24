---
name: sandbox
description: Configure Claude Code's Bash sandbox - filesystem/network allowlists and excludedCommands for autonomous loops
model: sonnet
argument-hint: "captain | dev | strict | off | show"
---

# Sandbox — Bash Sandbox Presets

Claude Code's built-in sandbox restricts Bash tool calls via macOS Seatbelt or Linux bubblewrap+socat. Kun ships four named presets for common autonomy scenarios.

> **Docs**: [Sandboxing](https://docs.claude.com/en/docs/claude-code/sandboxing)

## Usage

- `/sandbox captain` — preset for `/captain` autonomous loops (read-most, write to memory + repos only, network: github + anthropic + vercel only)
- `/sandbox dev` — preset for interactive coding (read all, write to project root only, network: full local + npm + github)
- `/sandbox strict` — preset for review/audit work (read-only filesystem, no network)
- `/sandbox off` — disable sandbox (default Claude Code behavior)
- `/sandbox show` — print current sandbox config

## Why Presets

Sandboxing trades autonomy for friction. The wrong settings either block useful work (too tight) or defeat the safety net (too loose). The four presets are the configurations kun's main autonomy modes need.

## Presets (written into `~/.claude/settings.json` `sandbox` block)

### `captain` — async autonomy

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "filesystem": {
      "allowWrite": [
        "~/.claude/memory/**",
        "/Users/abdout/kun/**",
        "/Users/abdout/codebase/**"
      ],
      "denyWrite": ["~/.ssh/**", "~/Library/**"]
    },
    "network": {
      "allowedDomains": [
        "api.anthropic.com",
        "*.github.com",
        "*.githubusercontent.com",
        "*.vercel.app",
        "vercel.com",
        "*.notion.com",
        "*.linear.app"
      ],
      "deniedDomains": ["telemetry.*"]
    },
    "excludedCommands": ["rm -rf /", "shutdown", "reboot", "diskutil"]
  }
}
```

### `dev` — interactive

Wider allowWrite (whole `/Users/abdout/`), allowedDomains includes `localhost`, `npmjs.org`, `*.databayt.org`, `*.cloudflare.com`. excludedCommands keeps catastrophic shutdowns out.

### `strict` — audit-only

`filesystem.allowWrite: []`, `network.allowedDomains: []`, `allowUnsandboxedCommands: false`. Everything blocked except read.

### `off`

Removes the `sandbox` block; falls back to Claude Code defaults (permission rules only).

## Protocol

### 1. RESOLVE preset name

Match arg against the four names; error if unknown.

### 2. BACKUP — Save current sandbox block

Copy current `~/.claude/settings.json` sandbox block to `~/.claude/memory/sandbox-backups/<date>.json` so user can revert.

### 3. WRITE — Apply preset

Edit `~/.claude/settings.json`. Validate the schema (sandbox block is well-defined in current Claude Code).

### 4. REPORT

```
## Sandbox: <preset>

**enabled**: true/false
**allowWrite**: <count> paths
**allowedDomains**: <count> domains
**excludedCommands**: <count> commands

Apply now? Sandbox config takes effect for new Bash tool calls in this session.

Revert with: /sandbox off
```

## Captain Mode Interaction

When `/captain` autonomous loops run, kun expects the `captain` preset to be active. If `/captain` detects `sandbox.enabled: false` or `off`, it prompts to switch before starting a long autonomous run.

## Exit Gate

- Preset name resolved or error reported
- Backup written under `~/.claude/memory/sandbox-backups/`
- New sandbox block valid against schema
- User informed about which Bash calls will now require explicit re-approval
