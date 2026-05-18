#!/bin/bash
# Kun doctor (macOS/Linux) — health, updates, self-repair in one command.
# Mirrors .claude/scripts/doctor.ps1. Spec: github.com/databayt/kun/issues/26
# Usage: doctor [--fix] [--update] [--report] [--json] [--quiet] [--deep]

set +e  # never exit on a single check failure — we aggregate

CLAUDE_DIR="$HOME/.claude"
REPORT=false; FIX=false; UPDATE=false; JSON=false; QUIET=false; DEEP=false
for arg in "$@"; do
    case "$arg" in
        --report|-Report)   REPORT=true ;;
        --fix|-Fix)         FIX=true ;;
        --update|-Update)   UPDATE=true ;;
        --json|-Json)       JSON=true ;;
        --quiet|-Quiet)     QUIET=true ;;
        --deep|-Deep)       DEEP=true ;;
    esac
done

# Status counters
PASS=0; WARN=0; FAIL=0; UPD=0; PAUSED=0
ROWS=""  # accumulates: "category|name|status|detail|fix"

record() {
    local cat="$1" name="$2" status="$3" detail="$4" fix="${5:-}"
    case "$status" in
        pass)   PASS=$((PASS+1)) ;;
        warn)   WARN=$((WARN+1)) ;;
        fail)   FAIL=$((FAIL+1)) ;;
        update) UPD=$((UPD+1)) ;;
        paused) PAUSED=$((PAUSED+1)) ;;
    esac
    ROWS="${ROWS}${cat}|${name}|${status}|${detail}|${fix}"$'\n'
}

icon() {
    case "$1" in
        pass)   printf '✅' ;;
        warn)   printf '⚠️ ' ;;
        fail)   printf '❌' ;;
        update) printf '🔄' ;;
        paused) printf '⏸ ' ;;
    esac
}

# ── Detect role ──────────────────────────────────────────────────
ROLE="unknown"
if [ -f "$CLAUDE_DIR/mcp.json" ]; then
    if   grep -q '"shadcn"'  "$CLAUDE_DIR/mcp.json" 2>/dev/null; then ROLE="engineer"
    elif grep -q '"linear"'  "$CLAUDE_DIR/mcp.json" 2>/dev/null; then ROLE="business"
    elif grep -q '"figma"'   "$CLAUDE_DIR/mcp.json" 2>/dev/null; then ROLE="content"
    elif grep -q '"posthog"' "$CLAUDE_DIR/mcp.json" 2>/dev/null; then ROLE="ops"
    fi
fi

file_age_days() {
    # Cross-platform stat — GNU vs BSD
    local f="$1"
    [ -f "$f" ] || { echo 99999; return; }
    if stat --version >/dev/null 2>&1; then
        # GNU
        local mtime=$(stat -c %Y "$f")
    else
        # BSD/macOS
        local mtime=$(stat -f %m "$f")
    fi
    local now=$(date +%s)
    echo $(( (now - mtime) / 86400 ))
}

# ── CORE FILES ──────────────────────────────────────────────────
for f in CLAUDE.md settings.json mcp.json; do
    if [ ! -f "$CLAUDE_DIR/$f" ]; then
        record "CORE FILES" "$f" fail "missing — run install.sh"
        continue
    fi
    age=$(file_age_days "$CLAUDE_DIR/$f")
    case "$f" in
        *.json)
            if command -v python3 >/dev/null 2>&1 && python3 -c "import json,sys;json.load(open('$CLAUDE_DIR/$f'))" >/dev/null 2>&1; then
                detail="valid JSON · ${age}d old"
                status=$([ "$age" -gt 30 ] && echo warn || echo pass)
            else
                record "CORE FILES" "$f" fail "invalid JSON"
                continue
            fi
            ;;
        *)
            detail="exists · ${age}d old"
            status=$([ "$age" -gt 30 ] && echo warn || echo pass)
            ;;
    esac
    record "CORE FILES" "$f" "$status" "$detail"
done

# .env
if [ ! -f "$CLAUDE_DIR/.env" ]; then
    record "CORE FILES" ".env" warn "missing — run secrets.sh" "rerun-secrets"
else
    age=$(file_age_days "$CLAUDE_DIR/.env")
    if [ "$age" -gt 7 ]; then
        record "CORE FILES" ".env" warn "${age}d old — re-run secrets.sh" "rerun-secrets"
    else
        record "CORE FILES" ".env" pass "${age}d old"
    fi
fi

# Directory counts
case "$ROLE" in
    engineer) MIN_AGENTS=20; MIN_CMDS=15 ;;
    business) MIN_AGENTS=10; MIN_CMDS=5  ;;
    content)  MIN_AGENTS=10; MIN_CMDS=5  ;;
    ops)      MIN_AGENTS=10; MIN_CMDS=7  ;;
    *)        MIN_AGENTS=1;  MIN_CMDS=1  ;;
esac
for d in agents commands; do
    [ "$d" = "agents" ] && min=$MIN_AGENTS || min=$MIN_CMDS
    count=$(find "$CLAUDE_DIR/$d" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -ge "$min" ]; then
        record "CORE FILES" "${d}/" pass "${count} files"
    elif [ "$count" -gt 0 ]; then
        record "CORE FILES" "${d}/" warn "${count} files (expected >=${min})"
    else
        record "CORE FILES" "${d}/" fail "empty"
    fi
done

# ── SHELL ───────────────────────────────────────────────────────
# Detect shell rc file
SHELL_RC=""
[ "${SHELL##*/}" = "zsh" ] && SHELL_RC="$HOME/.zshrc"
[ "${SHELL##*/}" = "bash" ] && SHELL_RC="$HOME/.bashrc"
[ -z "$SHELL_RC" ] && SHELL_RC="$HOME/.zshrc"  # default for macOS

if [ ! -f "$SHELL_RC" ]; then
    record "SHELL" "shell rc" fail "missing $SHELL_RC — run doctor --fix" "create-rc"
else
    if grep -Eq '^[[:space:]]*alias[[:space:]]+c=|^[[:space:]]*c\(\)' "$SHELL_RC" 2>/dev/null; then
        record "SHELL" "c function/alias" pass "defined in $SHELL_RC"
    else
        record "SHELL" "c function/alias" fail "missing — run doctor --fix" "append-c-function"
    fi
    if grep -Fq "$CLAUDE_DIR/bin" "$SHELL_RC" 2>/dev/null; then
        record "SHELL" "~/.claude/bin" pass "in $SHELL_RC"
    else
        record "SHELL" "~/.claude/bin" warn "not on PATH" "prepend-bin-path"
    fi
fi

# ── IDENTITY ────────────────────────────────────────────────────
if ! command -v gh >/dev/null 2>&1; then
    record "IDENTITY" "gh" fail "CLI not installed"
else
    if gh auth status 2>&1 | grep -qE 'Logged in to github\.com.*account[[:space:]]+'; then
        user=$(gh auth status 2>&1 | grep -oE 'account[[:space:]]+\S+' | awk '{print $2}' | head -1)
        record "IDENTITY" "gh" pass "logged in as @${user}"
    else
        record "IDENTITY" "gh" fail "not authenticated — run gh auth login"
    fi
fi

if ! command -v claude >/dev/null 2>&1; then
    record "IDENTITY" "claude" fail "CLI not installed"
else
    ver=$(claude --version 2>/dev/null | head -1 | tr -d '\n')
    if [ -f "$CLAUDE_DIR/.credentials.json" ] || [ -f "$CLAUDE_DIR/session.json" ]; then
        record "IDENTITY" "claude" pass "signed in · ${ver}"
    else
        record "IDENTITY" "claude" warn "${ver} · sign-in state unverified — run 'claude' to confirm"
    fi
fi

# ── ORG REPOS ───────────────────────────────────────────────────
# Read repositories.json $.repos if present, else fall back to known list.
REPOS_FILE="$CLAUDE_DIR/memory/repositories.json"
declare -a REPO_NAMES REPO_PATHS
if [ -f "$REPOS_FILE" ] && command -v python3 >/dev/null 2>&1; then
    while IFS=$'\t' read -r name path; do
        # Expand $HOME and macOS paths
        path="${path//\$HOME/$HOME}"
        path="${path//\$env:USERPROFILE/$HOME}"
        REPO_NAMES+=("$name")
        REPO_PATHS+=("$path")
    done < <(python3 -c '
import json, sys, os
try:
    d = json.load(open(os.environ["REPOS_FILE"]))
    repos = d.get("repos") or {}
    for k, v in repos.items():
        # Convert Windows-style $env:USERPROFILE to a placeholder we substitute above
        v = v.replace("\\\\", "/")
        print(f"{k}\t{v}")
except Exception:
    pass
' 2>/dev/null)
fi

# Fallback hardcoded list if JSON didn't parse anything
if [ ${#REPO_NAMES[@]} -eq 0 ]; then
    REPO_NAMES=(codebase kun shadcn radix hogwarts souq mkan shifa swift-app distributed-computer marketing)
    REPO_PATHS=("$HOME/codebase" "$HOME/kun" "$HOME/shadcn" "$HOME/radix" "$HOME/hogwarts" "$HOME/souq" "$HOME/mkan" "$HOME/shifa" "$HOME/swift-app" "$HOME/distributed-computer" "$HOME/marketing")
fi

for i in "${!REPO_NAMES[@]}"; do
    name="${REPO_NAMES[$i]}"
    path="${REPO_PATHS[$i]}"
    if [ ! -d "$path/.git" ]; then
        record "ORG REPOS" "$name" fail "not cloned" "clone-$name"
        continue
    fi
    branch=$(cd "$path" && git branch --show-current 2>/dev/null)
    commit=$(cd "$path" && git rev-parse --short HEAD 2>/dev/null)
    changes=$(cd "$path" && git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$changes" -gt 0 ]; then
        record "ORG REPOS" "$name" warn "${changes} uncommitted · ${branch} · ${commit}"
    else
        record "ORG REPOS" "$name" pass "clean · ${branch} · ${commit}"
    fi
done

# ── UPDATES ─────────────────────────────────────────────────────
semver_lt() {
    # returns 0 (true) if $1 < $2 in semver
    local a="${1#v}" b="${2#v}"
    local IFS=.
    local aa=($a) bb=($b)
    for i in 0 1 2; do
        local av="${aa[$i]:-0}" bv="${bb[$i]:-0}"
        # strip non-digits
        av="${av%%[!0-9]*}"; bv="${bv%%[!0-9]*}"
        [ -z "$av" ] && av=0; [ -z "$bv" ] && bv=0
        if [ "$av" -lt "$bv" ]; then return 0; fi
        if [ "$av" -gt "$bv" ]; then return 1; fi
    done
    return 1
}

if command -v claude >/dev/null 2>&1; then
    current=$(claude --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    latest=""
    if command -v curl >/dev/null 2>&1; then
        latest=$(curl -fsSL --max-time 5 https://api.github.com/repos/anthropics/claude-code/releases/latest 2>/dev/null | \
                 grep -oE '"tag_name":[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
    fi
    if [ -z "$latest" ]; then
        record "UPDATES" "claude CLI" warn "${current} · can't reach GitHub releases"
    elif [ -n "$current" ] && semver_lt "$current" "$latest"; then
        record "UPDATES" "claude CLI" update "${latest} available (current ${current}) — brew upgrade anthropic/claude-code or npm i -g @anthropic-ai/claude-code"
    else
        record "UPDATES" "claude CLI" pass "up to date · ${current}"
    fi
fi

for repo in "$HOME/kun" "$HOME/codebase"; do
    [ -d "$repo/.git" ] || continue
    name="~/${repo##*/}"
    (cd "$repo" && git fetch --quiet 2>/dev/null) || true
    local_sha=$(cd "$repo" && git rev-parse '@' 2>/dev/null)
    remote_sha=$(cd "$repo" && git rev-parse '@{u}' 2>/dev/null)
    if [ -z "$remote_sha" ]; then
        record "UPDATES" "$name" warn "no upstream"
    elif [ "$local_sha" = "$remote_sha" ]; then
        record "UPDATES" "$name" pass "up to date"
    else
        behind=$(cd "$repo" && git rev-list --count "${local_sha}..${remote_sha}" 2>/dev/null)
        if [ "${behind:-0}" -gt 0 ]; then
            record "UPDATES" "$name" update "${behind} commits behind — git pull"
        else
            ahead=$(cd "$repo" && git rev-list --count "${remote_sha}..${local_sha}" 2>/dev/null)
            record "UPDATES" "$name" pass "ahead ${ahead}"
        fi
    fi
done

# ── SCHEDULED ───────────────────────────────────────────────────
if launchctl list 2>/dev/null | grep -q 'com.databayt.kun-maintain'; then
    record "SCHEDULED" "kun-maintain" pass "launchd agent loaded"
else
    record "SCHEDULED" "kun-maintain" paused "not armed — run: maintain.sh --install"
fi

# ── IDE ────────────────────────────────────────────────────────
WS_CONFIG=$(ls -dt "$HOME/Library/Application Support/JetBrains/WebStorm"* 2>/dev/null | head -1)
if [ -n "$WS_CONFIG" ] && [ -d "$WS_CONFIG" ]; then
    version=$(basename "$WS_CONFIG" | sed 's/WebStorm//')
    record "IDE" "WebStorm" pass "$version detected"
    PLUGIN=$(find "$WS_CONFIG/plugins" -maxdepth 1 -type d -iname '*claude*' 2>/dev/null | head -1)
    if [ -n "$PLUGIN" ]; then
        record "IDE" "Claude Code [Beta]" pass "$(basename "$PLUGIN")"
    else
        record "IDE" "Claude Code [Beta]" warn "not loaded — install from Marketplace"
    fi
else
    record "IDE" "WebStorm" paused "not installed (optional)"
fi

# ── Output ──────────────────────────────────────────────────────
if [ "$JSON" = true ]; then
    # Emit JSON array
    echo '['
    first=true
    while IFS='|' read -r cat name status detail fix; do
        [ -z "$cat" ] && continue
        if [ "$first" = false ]; then echo ','; fi
        first=false
        printf '  {"category":"%s","name":"%s","status":"%s","detail":"%s","fix":"%s"}' \
            "$cat" "$name" "$status" "$detail" "$fix"
    done <<< "$ROWS"
    echo ''
    echo ']'
    if   [ "$FAIL" -gt 0 ]; then exit 1
    elif [ "$WARN" -gt 0 ]; then exit 2
    elif [ "$UPD"  -gt 0 ]; then exit 3
    else exit 0; fi
fi

HOST=$(hostname -s 2>/dev/null)
TS=$(date '+%Y-%m-%d %H:%M')
if   [ "$FAIL" -gt 0 ]; then header="❌ ${FAIL} errors"
elif [ "$WARN" -gt 0 ]; then header="⚠️  ${WARN} warnings"
elif [ "$UPD"  -gt 0 ]; then header="🔄 ${UPD} updates available"
else                         header="✅ healthy"
fi

if [ "$QUIET" != true ]; then
    echo ""
    echo "${header} · ${ROLE} @ ${HOST} · ${TS}"
    echo ""
fi

# Render grouped by category
prev_cat=""
while IFS='|' read -r cat name status detail fix; do
    [ -z "$cat" ] && continue
    if [ "$QUIET" = true ] && [ "$status" = "pass" ]; then continue; fi
    if [ "$cat" != "$prev_cat" ]; then
        [ -n "$prev_cat" ] && echo ""
        echo "$cat"
        prev_cat="$cat"
    fi
    printf "  %s %-22s %s\n" "$(icon "$status")" "$name" "$detail"
done <<< "$ROWS"
echo ""

# Footer hints
FIXABLE=$(echo "$ROWS" | awk -F'|' '$5 != "" && ($3 == "fail" || $3 == "warn") {n++} END {print n+0}')
if [ "$FIXABLE" -gt 0 ] && [ "$FIX" != true ]; then
    echo "Run 'doctor --fix' to repair ${FIXABLE} fixable issue(s)."
fi
if [ "$UPD" -gt 0 ] && [ "$UPDATE" != true ]; then
    echo "Run 'doctor --update' to apply ${UPD} update(s)."
fi

# Apply fixes
if [ "$FIX" = true ] && [ "$FIXABLE" -gt 0 ]; then
    echo ""
    echo "── Applying fixes ───────────────────────"
    while IFS='|' read -r cat name status detail fix; do
        [ -z "$fix" ] && continue
        [ "$status" = "pass" ] && continue
        echo "Fix: $name — $fix"
        case "$fix" in
            append-c-function|create-rc|prepend-bin-path)
                cat >> "$SHELL_RC" << 'PROFILE_EOF'

# Claude Code (Kun Engine) — added by doctor --fix
alias c='claude --dangerously-skip-permissions'
alias cc='claude'
if [ -f "$HOME/.claude/.env" ]; then
    set -a; . "$HOME/.claude/.env"; set +a
fi
export PATH="$HOME/.claude/bin:$PATH"
PROFILE_EOF
                echo "  Appended to $SHELL_RC — restart shell or: source $SHELL_RC"
                break  # apply once
                ;;
            rerun-secrets)
                echo "  Hint: bash \$HOME/.claude/scripts/secrets.sh <gist-id>"
                ;;
        esac
    done <<< "$ROWS"
fi

# Apply updates
if [ "$UPDATE" = true ] && [ "$UPD" -gt 0 ]; then
    echo ""
    echo "── Applying updates ─────────────────────"
    for repo in "$HOME/kun" "$HOME/codebase"; do
        [ -d "$repo/.git" ] || continue
        echo "git pull on $repo"
        (cd "$repo" && git pull --rebase)
    done
    echo "claude CLI: run manually — 'brew upgrade anthropic/claude-code' or 'npm i -g @anthropic-ai/claude-code'"
fi

# Report to GitHub
if [ "$REPORT" = true ]; then
    if ! command -v gh >/dev/null 2>&1; then
        echo "gh CLI not installed — cannot post report"
    else
        body="### ${HOST} — ${ROLE}
**Status:** ${header}
**Time:** ${TS}
"
        prev_cat=""
        while IFS='|' read -r cat name status detail fix; do
            [ -z "$cat" ] && continue
            if [ "$cat" != "$prev_cat" ]; then
                body="${body}
**${cat}**"
                prev_cat="$cat"
            fi
            body="${body}
- $(icon "$status") ${name} — ${detail}"
        done <<< "$ROWS"
        body="${body}
---"
        issue_num=$(gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>/dev/null)
        if [ -z "$issue_num" ]; then
            gh issue create --repo databayt/kun --title 'Config Health Dashboard' \
                --label 'config-health' \
                --body 'Automated health reports. Latest comment = latest status.' >/dev/null
            issue_num=$(gh issue list --repo databayt/kun --label config-health --state open --json number -q '.[0].number' 2>/dev/null)
        fi
        if [ -n "$issue_num" ]; then
            gh issue comment "$issue_num" --repo databayt/kun --body "$body" >/dev/null
            echo "Reported to databayt/kun#${issue_num}"
        fi
    fi
fi

# Exit code (precedence: errors > warnings > updates)
if   [ "$FAIL" -gt 0 ]; then exit 1
elif [ "$WARN" -gt 0 ]; then exit 2
elif [ "$UPD"  -gt 0 ]; then exit 3
else exit 0; fi
