Check Claude Code config health for all team members.

Arguments: $ARGUMENTS (optional: "local" for local-only check, or "all" for team dashboard)

Steps:

1. Run local health check: `bash ~/.claude/scripts/health.sh`
2. If $ARGUMENTS is "all" or empty:
   - Check GitHub issue `databayt/kun` with label `config-health` for latest reports from all team members
   - `gh issue list --repo databayt/kun --label config-health --state open --json number,title -q '.[0].number'`
   - If issue exists, read comments: `gh api repos/databayt/kun/issues/{number}/comments --jq '.[-4:] | .[].body'`
   - Summarize: who reported, when, status (healthy/warnings/errors)
   - Flag anyone who hasn't reported in > 7 days
3. If $ARGUMENTS is "report":
   - Run `bash ~/.claude/scripts/health.sh --report` to post local health to GitHub
4. Present dashboard:

   | Member | Status | Last Check | Issues |
   |--------|--------|------------|--------|
   | Abdout | ✅/⚠️/❌ | timestamp | details |
   | Ali    | ✅/⚠️/❌ | timestamp | details |
   | Samia  | ✅/⚠️/❌ | timestamp | details |
   | Sedon  | ✅/⚠️/❌ | timestamp | details |

5. If any member has errors, suggest: `tell [member] to run: cd ~/kun && bash .claude/scripts/setup.sh [role]`

Each team member should set up recurring health reports:
- macOS: `bash ~/.claude/scripts/health.sh --report` (via /schedule or cron)
- Windows: `.\.claude\scripts\health.ps1 -Report` (via Task Scheduler)
