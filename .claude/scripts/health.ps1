# Kun Config Health Check — verify and report Claude Code config health
# Usage: .\.claude\scripts\health.ps1 [-Report]
# -Report: post results to GitHub issue databayt/kun#health

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
$cmdCount = (Get-ChildItem "$CLAUDE_DIR\commands\*.md" -EA SilentlyContinue).Count
$ruleCount = (Get-ChildItem "$CLAUDE_DIR\rules\*.md" -EA SilentlyContinue).Count

if ($agentCount -gt 0) { Check pass "agents/" "$agentCount files" } else { Check fail "agents/" "empty" }
if ($cmdCount -gt 0) { Check pass "commands/" "$cmdCount files" } else { Check fail "commands/" "empty" }
if ($ruleCount -gt 0) { Check pass "rules/" "$ruleCount files" } else { Check warn "rules/" "empty" }
if (Test-Path "$CLAUDE_DIR\memory") { Check pass "memory/" "exists" } else { Check warn "memory/" "missing" }

# ── MCP count ────────────────────────────────────────────────────
if (Test-Path "$CLAUDE_DIR\mcp.json") {
    $mcpCount = (Select-String -Path "$CLAUDE_DIR\mcp.json" -Pattern '"description"' -EA SilentlyContinue).Count
    $expected = switch ($ROLE) { "engineer" { 20 } "business" { 6 } "content" { 6 } "ops" { 7 } default { 1 } }
    if ($mcpCount -ge $expected) { Check pass "MCP servers" "$mcpCount (expected >=$expected)" }
    else { Check warn "MCP servers" "$mcpCount (expected >=$expected)" }
}

# ── Commands scope ───────────────────────────────────────────────
$expectedCmds = switch ($ROLE) { "engineer" { 20 } "business" { 6 } "content" { 6 } "ops" { 7 } default { 1 } }
if ($cmdCount -ge $expectedCmds) { Check pass "commands scope" "$cmdCount (expected >=$expectedCmds)" }
else { Check warn "commands scope" "$cmdCount (expected >=$expectedCmds)" }

# ── CLI ──────────────────────────────────────────────────────────
$claude = Get-Command claude -EA SilentlyContinue
if ($claude) {
    $ver = (claude --version 2>$null | Select-Object -First 1) -replace "`n",""
    Check pass "claude CLI" "$ver"
} else { Check fail "claude CLI" "not installed" }

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
        $issueBody = @"
# Config Health Dashboard

Automated health reports from all team members' Claude Code configurations.

Each comment below is a health check from a team member's machine. Latest comment = latest status.

**Setup**: each member runs ``health.ps1 -Report``
**Schedule**: runs automatically via Claude Code or manually
"@
        gh issue create --repo databayt/kun --title "Config Health Dashboard" --label "config-health" --body $issueBody
        $issueNum = (gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>$null)
    }

    if ($issueNum) {
        gh issue comment $issueNum --repo databayt/kun --body $body
        Write-Host "Reported to databayt/kun#$issueNum"
    }
}
