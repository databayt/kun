# Kun Config Health Check — verify and report Claude Code config health
# Usage: .\.claude\scripts\health.ps1 [-Report]
# -Report: post results to the Config Health Dashboard issue in databayt/kun
#          (discovered by label `config-health`; created if absent).
# The daily maintain heartbeat (maintain.ps1) runs this and posts weekly/on-RED.

param([switch]$Report)

$ErrorActionPreference = "SilentlyContinue"
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$TIMESTAMP = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$HOSTNAME = $env:COMPUTERNAME
$WHO = $env:USERNAME
$ERRORS = 0
$WARNINGS = 0
$CHECKS = @()

function Check($status, $name, $detail) {
    $icon = switch ($status) { "pass" { "✅" } "warn" { "⚠️"; $script:WARNINGS++ } default { "❌"; $script:ERRORS++ } }
    $script:CHECKS += "| $icon | $name | $detail |"
}

# ── Detect role ──────────────────────────────────────────────────
$ROLE = "unknown"
if (Test-Path "$CLAUDE_DIR\mcp.json") {
    $mcp = Get-Content "$CLAUDE_DIR\mcp.json" -Raw
    if ($mcp -match '"shadcn"') { $ROLE = "engineer" }
    elseif ($mcp -match '"linear"') { $ROLE = "business" }
    elseif ($mcp -match '"figma"') { $ROLE = "content" }
    elseif ($mcp -match '"posthog"') { $ROLE = "ops" }
}

# ── Core files ───────────────────────────────────────────────────
if (Test-Path "$CLAUDE_DIR\CLAUDE.md") { Check pass "CLAUDE.md" "exists" } else { Check fail "CLAUDE.md" "missing" }
if (Test-Path "$CLAUDE_DIR\settings.json") { Check pass "settings.json" "exists" } else { Check fail "settings.json" "missing" }
if (Test-Path "$CLAUDE_DIR\mcp.json") { Check pass "mcp.json" "exists" } else { Check fail "mcp.json" "missing" }

# ── JSON validity ────────────────────────────────────────────────
try { Get-Content "$CLAUDE_DIR\settings.json" | ConvertFrom-Json | Out-Null; Check pass "settings.json" "valid JSON" }
catch { Check fail "settings.json" "invalid JSON" }
try { Get-Content "$CLAUDE_DIR\mcp.json" | ConvertFrom-Json | Out-Null; Check pass "mcp.json" "valid JSON" }
catch { Check fail "mcp.json" "invalid JSON" }

# ── Directories ──────────────────────────────────────────────────
$agentCount = (Get-ChildItem "$CLAUDE_DIR\agents\*.md" -EA SilentlyContinue).Count
$skillCount = (Get-ChildItem "$CLAUDE_DIR\skills" -Directory -EA SilentlyContinue).Count
$cmdCount = (Get-ChildItem "$CLAUDE_DIR\commands\*.md" -EA SilentlyContinue).Count
$ruleCount = (Get-ChildItem "$CLAUDE_DIR\rules\*.md" -EA SilentlyContinue).Count

if ($agentCount -gt 0) { Check pass "agents/" "$agentCount files" } else { Check fail "agents/" "empty" }
if ($skillCount -gt 0) { Check pass "skills/" "$skillCount dirs" } else { Check fail "skills/" "empty" }
if ($ruleCount -gt 0) { Check pass "rules/" "$ruleCount files" } else { Check warn "rules/" "empty" }
if (Test-Path "$CLAUDE_DIR\memory") { Check pass "memory/" "exists" } else { Check warn "memory/" "missing" }

# ── MCP + skills counts ──────────────────────────────────────────
# Universal — every machine gets the full fleet; scoped secrets, not config.
# Expectations come from engine.json (declared truth) with fallbacks.
$expected = 18
$expectedSkills = 30
$engineJson = "$env:USERPROFILE\kun\.claude\engine.json"
if (Test-Path $engineJson) {
    try {
        $engine = Get-Content $engineJson -Raw | ConvertFrom-Json
        if ($engine.counts.project_mcp) { $expected = $engine.counts.project_mcp }
        if ($engine.counts.project_skills) { $expectedSkills = $engine.counts.project_skills }
    } catch { }
}
if (Test-Path "$CLAUDE_DIR\mcp.json") {
    $mcpCount = (Select-String -Path "$CLAUDE_DIR\mcp.json" -Pattern '"description"' -EA SilentlyContinue).Count
    if ($mcpCount -ge $expected) { Check pass "MCP servers" "$mcpCount (expected >=$expected)" }
    else { Check warn "MCP servers" "$mcpCount (expected >=$expected)" }
}

# ── Skills (universal — full skill set on every machine; commands retired) ──
if ($skillCount -ge $expectedSkills) { Check pass "skills" "$skillCount (expected >=$expectedSkills)" }
else { Check warn "skills" "$skillCount (expected >=$expectedSkills)" }
if ($cmdCount -eq 0) { Check pass "commands retired" "none left" }
else { Check warn "commands retired" "$cmdCount stale file(s) in ~/.claude/commands — re-run setup.ps1 to prune" }

# ── CLI ──────────────────────────────────────────────────────────
$claude = Get-Command claude -EA SilentlyContinue
if ($claude) {
    $ver = (claude --version 2>$null | Select-Object -First 1) -replace "`n",""
    Check pass "claude CLI" "$ver"
} else { Check fail "claude CLI" "not installed" }

# ── Maintain heartbeat (the machine supervises itself) ──────────
$maintainState = "$CLAUDE_DIR\.kun-maintain.json"
if (Test-Path $maintainState) {
    try {
        $mState = Get-Content $maintainState -Raw | ConvertFrom-Json
        $mTs = [datetime]::ParseExact($mState.ts, "yyyy-MM-ddTHH:mm:ssZ",
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
        $mAgeH = [int]((Get-Date).ToUniversalTime() - $mTs).TotalHours
        if ($mAgeH -le 48) { Check pass "maintain heartbeat" "last run ${mAgeH}h ago ($($mState.verdict))" }
        else { Check warn "maintain heartbeat" "stale — ${mAgeH}h since last run; check the scheduler (maintain.ps1 -Status)" }
    } catch {
        Check warn "maintain heartbeat" "state unreadable — run: maintain.ps1 -Run"
    }
} else {
    Check warn "maintain heartbeat" "never ran — arm it: maintain.ps1 -Install"
}

# ── Config age ───────────────────────────────────────────────────
if (Test-Path "$CLAUDE_DIR\CLAUDE.md") {
    $age = ((Get-Date) - (Get-Item "$CLAUDE_DIR\CLAUDE.md").LastWriteTime).Days
    if ($age -le 7) { Check pass "config age" "${age}d old" }
    elseif ($age -le 30) { Check warn "config age" "${age}d old — consider re-running setup" }
    else { Check fail "config age" "${age}d old — stale, re-run setup" }
}

# ── Output ───────────────────────────────────────────────────────
$STATUS = if ($ERRORS -gt 0) { "❌ $ERRORS errors" } elseif ($WARNINGS -gt 0) { "⚠️ $WARNINGS warnings" } else { "✅ healthy" }

Write-Host "$STATUS — $ROLE @ $HOSTNAME"
Write-Host ""
Write-Host "| | Check | Detail |"
Write-Host "|---|-------|--------|"
$CHECKS | ForEach-Object { Write-Host $_ }

# ── Report to GitHub ─────────────────────────────────────────────
if ($Report) {
    $ghPath = Get-Command gh -EA SilentlyContinue
    if (-not $ghPath) { Write-Host "gh CLI not installed — cannot report"; exit 1 }

    $body = @"
### $HOSTNAME — $ROLE
**Status**: $STATUS
**Time**: $TIMESTAMP
**OS**: Windows
**CLI**: $ver

| | Check | Detail |
|---|-------|--------|
$($CHECKS -join "`n")
---
"@

    $issueNum = (gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>$null)

    if (-not $issueNum) {
        gh label create config-health --repo databayt/kun --force 2>$null | Out-Null
        $issueBody = @"
# Config Health Dashboard

Automated health reports from all team members' Claude Code configurations.

Each comment below is a health check from a team member's machine. Latest comment = latest status.

**Setup**: armed automatically by ``setup.sh`` / ``setup.ps1`` — the daily maintain heartbeat (``maintain.sh`` / ``maintain.ps1``) posts here weekly and immediately on RED
**Manual**: ``bash ~/.claude/scripts/health.sh --report`` (Windows: ``health.ps1 -Report``)
"@
        # Parse the number from the create output — re-listing immediately
        # after create races GitHub's eventually-consistent index.
        $issueUrl = gh issue create --repo databayt/kun --title "Config Health Dashboard" --label "config-health" --body $issueBody 2>$null
        if ("$issueUrl" -match '/issues/(\d+)') { $issueNum = $Matches[1] }
    }

    if ($issueNum) {
        gh issue comment $issueNum --repo databayt/kun --body $body
        Write-Host "Reported to databayt/kun#$issueNum"
    }
}
