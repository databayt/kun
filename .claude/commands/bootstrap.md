# Bootstrap — Single-paste Cold Start

The canonical first-run flow. One paste, one UAC, three OAuth sign-ins. ~90 minutes wall-clock, ~10 minutes attention.

## Usage
- `/bootstrap` — direct command; on a fresh machine the user should instead paste the install line into their shell (this command exists for re-runs and reference)
- `/bootstrap dry-run` — print all 16 steps without side effects
- `/bootstrap track` — create a GitHub progress issue with live checkbox updates
- `/bootstrap skip-oauth` — for testing only
- `/bootstrap skip-webstorm` — CLI-only setup

## Canonical paste (for a fresh machine — NOT this command)

**Windows (PowerShell):**
```powershell
irm https://kun.databayt.org/install | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://kun.databayt.org/install.sh | bash
```

## Argument: $ARGUMENTS

## Instructions

If the user invokes `/bootstrap` from inside an existing Kun session, they likely want a re-run or a dry-run — they're not on a fresh machine. Confirm intent.

1. Detect OS:
   - Windows: `~/.claude/scripts/bootstrap.ps1`
   - macOS/Linux: no bootstrap.sh ships yet (use `onboarding-mac.sh` or the manual fallback in [Onboarding](https://kun.databayt.org/docs/onboarding))
2. Translate `$ARGUMENTS` to flags:
   - PowerShell: `-DryRun`, `-Track`, `-SkipOAuth`, `-SkipWebStorm`, `-SkipCowork`
3. Invoke the script and tail output. Re-runs on a healthy machine complete in <60s with all skips.
4. On exit, summarize the final state table from the script's output.

## The 16-step flow

| # | Step |
|---|---|
| 0 | ExecutionPolicy → RemoteSigned |
| 1 | Self-elevation (one UAC) |
| 2 | OS + PowerShell version check |
| 3 | Logs directory + per-run log |
| 4 | winget bundle (Git, Node-LTS, gh, pwsh, Claude Code CLI, Claude Desktop) |
| 5 | PATH refresh |
| 6 | `npm install -g pnpm` |
| 7 | WebStorm install |
| 8 | Claude Code [Beta] plugin pre-drop |
| 9 | install.ps1 (kun config) |
| 10 | settings.json |
| 11 | `$PROFILE` c/cc block |
| 12 | OAuth batch (gh + claude + JetBrains) |
| 13 | secrets.ps1 (.env from Gist) |
| 14 | sync-repos.ps1 |
| 15 | `maintain -Install` |
| 16 | `doctor` verify |

## Reference

- Spec: https://github.com/databayt/kun/issues/28
- Source: `.claude/scripts/bootstrap.ps1`
- Onboarding doc: https://kun.databayt.org/docs/onboarding
