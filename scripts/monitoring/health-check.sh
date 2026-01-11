#!/bin/bash
#
# Kun Health Check Script
# Monitors critical services and sends alerts
#
# Usage: bash scripts/monitoring/health-check.sh
#

# Configuration
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="/var/log/kun/health.log"
HOSTNAME=$(hostname)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create log directory if needed
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Colors (for terminal output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track overall status
OVERALL_STATUS=0
MESSAGES=()

# ============================================================
# Helper Functions
# ============================================================

log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE" 2>/dev/null || echo "[$TIMESTAMP] $1"
}

check_service() {
    local service="$1"
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${GREEN}[OK]${NC} $service is running"
        log "[OK] $service is running"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $service is not running"
        log "[FAIL] $service is not running"
        MESSAGES+=("Service $service is DOWN on $HOSTNAME")
        OVERALL_STATUS=1
        return 1
    fi
}

check_disk() {
    local threshold="${1:-90}"
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$usage" -gt "$threshold" ]; then
        echo -e "${RED}[WARN]${NC} Disk usage at ${usage}%"
        log "[WARN] Disk usage at ${usage}%"
        MESSAGES+=("Disk usage at ${usage}% on $HOSTNAME")
        OVERALL_STATUS=1
        return 1
    else
        echo -e "${GREEN}[OK]${NC} Disk usage at ${usage}%"
        log "[OK] Disk usage at ${usage}%"
        return 0
    fi
}

check_memory() {
    local threshold="${1:-90}"
    local usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')

    if [ "$usage" -gt "$threshold" ]; then
        echo -e "${YELLOW}[WARN]${NC} Memory usage at ${usage}%"
        log "[WARN] Memory usage at ${usage}%"
        MESSAGES+=("Memory usage at ${usage}% on $HOSTNAME")
        return 1
    else
        echo -e "${GREEN}[OK]${NC} Memory usage at ${usage}%"
        log "[OK] Memory usage at ${usage}%"
        return 0
    fi
}

check_tailscale() {
    if command -v tailscale &> /dev/null; then
        local status=$(tailscale status --json 2>/dev/null | jq -r '.Self.Online' 2>/dev/null)
        if [ "$status" == "true" ]; then
            local ip=$(tailscale ip -4 2>/dev/null)
            echo -e "${GREEN}[OK]${NC} Tailscale connected ($ip)"
            log "[OK] Tailscale connected ($ip)"
            return 0
        else
            echo -e "${RED}[FAIL]${NC} Tailscale not connected"
            log "[FAIL] Tailscale not connected"
            MESSAGES+=("Tailscale disconnected on $HOSTNAME")
            OVERALL_STATUS=1
            return 1
        fi
    else
        echo -e "${YELLOW}[SKIP]${NC} Tailscale not installed"
        log "[SKIP] Tailscale not installed"
        return 0
    fi
}

check_tmux_sessions() {
    local count=$(tmux list-sessions 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
        echo -e "${GREEN}[OK]${NC} $count tmux session(s) active"
        log "[OK] $count tmux session(s) active"
        return 0
    else
        echo -e "${YELLOW}[INFO]${NC} No tmux sessions active"
        log "[INFO] No tmux sessions active"
        return 0
    fi
}

send_slack_alert() {
    if [ -n "$SLACK_WEBHOOK" ] && [ ${#MESSAGES[@]} -gt 0 ]; then
        local text="*Kun Health Alert* ($HOSTNAME)\n"
        for msg in "${MESSAGES[@]}"; do
            text+="• $msg\n"
        done

        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$text\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1
    fi
}

# ============================================================
# Main Health Check
# ============================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Kun Health Check - $TIMESTAMP"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

log "=== Health check started ==="

# Check critical services
echo "Services:"
check_service "ssh"
check_service "tailscaled"

# Check optional services
if systemctl list-unit-files | grep -q "claude-tmux"; then
    check_service "claude-tmux"
fi

if systemctl list-unit-files | grep -q "netdata"; then
    check_service "netdata"
fi

echo ""
echo "Resources:"
check_disk 90
check_memory 90

echo ""
echo "Network:"
check_tailscale

echo ""
echo "Sessions:"
check_tmux_sessions

# Send alerts if needed
send_slack_alert

# Final status
echo ""
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}All checks passed${NC}"
    log "=== Health check completed: ALL OK ==="
else
    echo -e "${RED}Some checks failed${NC}"
    log "=== Health check completed: ISSUES DETECTED ==="
fi

exit $OVERALL_STATUS
