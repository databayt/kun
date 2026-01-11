#!/bin/bash
#
# Kun Status Script
# Quick overview of the Kun infrastructure
#
# Usage: npm run status
#        bash scripts/status.sh
#

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   كن (Kun) - Status Overview                                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# System Info
# ============================================================
echo -e "${CYAN}System:${NC}"
echo "  Hostname: $(hostname)"
echo "  OS: $(uname -s) $(uname -r)"
echo "  Uptime: $(uptime -p 2>/dev/null || uptime | awk '{print $3,$4}' | sed 's/,//')"
echo ""

# ============================================================
# Network
# ============================================================
echo -e "${CYAN}Network:${NC}"

if command -v tailscale &> /dev/null; then
    TS_STATUS=$(tailscale status --json 2>/dev/null)
    if [ -n "$TS_STATUS" ]; then
        TS_IP=$(tailscale ip -4 2>/dev/null)
        TS_ONLINE=$(echo "$TS_STATUS" | jq -r '.Self.Online' 2>/dev/null)
        if [ "$TS_ONLINE" == "true" ]; then
            echo -e "  Tailscale: ${GREEN}Connected${NC} ($TS_IP)"
        else
            echo -e "  Tailscale: ${YELLOW}Disconnected${NC}"
        fi
    else
        echo -e "  Tailscale: ${YELLOW}Not running${NC}"
    fi
else
    echo -e "  Tailscale: ${RED}Not installed${NC}"
fi

# Local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "  Local IP: ${LOCAL_IP:-Unknown}"
echo ""

# ============================================================
# Services
# ============================================================
echo -e "${CYAN}Services:${NC}"

check_service() {
    if systemctl is-active --quiet "$1" 2>/dev/null; then
        echo -e "  $1: ${GREEN}Running${NC}"
    elif systemctl list-unit-files 2>/dev/null | grep -q "^$1"; then
        echo -e "  $1: ${RED}Stopped${NC}"
    else
        echo -e "  $1: ${YELLOW}Not installed${NC}"
    fi
}

check_service "ssh"
check_service "tailscaled"
check_service "claude-tmux"
check_service "netdata"
echo ""

# ============================================================
# tmux Sessions
# ============================================================
echo -e "${CYAN}tmux Sessions:${NC}"

if command -v tmux &> /dev/null; then
    SESSIONS=$(tmux list-sessions 2>/dev/null)
    if [ -n "$SESSIONS" ]; then
        echo "$SESSIONS" | while read -r session; do
            echo -e "  ${GREEN}●${NC} $session"
        done
    else
        echo "  No active sessions"
    fi
else
    echo -e "  tmux: ${RED}Not installed${NC}"
fi
echo ""

# ============================================================
# Resources
# ============================================================
echo -e "${CYAN}Resources:${NC}"

# CPU
CPU_USAGE=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "  CPU: ${CPU_USAGE:-?}%"

# Memory
if command -v free &> /dev/null; then
    MEM_INFO=$(free -m | grep Mem)
    MEM_USED=$(echo "$MEM_INFO" | awk '{print $3}')
    MEM_TOTAL=$(echo "$MEM_INFO" | awk '{print $2}')
    MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
    echo "  Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
fi

# Disk
DISK_INFO=$(df -h / 2>/dev/null | tail -1)
DISK_USED=$(echo "$DISK_INFO" | awk '{print $3}')
DISK_TOTAL=$(echo "$DISK_INFO" | awk '{print $2}')
DISK_PCT=$(echo "$DISK_INFO" | awk '{print $5}')
echo "  Disk: ${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT})"
echo ""

# ============================================================
# Docker (if installed)
# ============================================================
if command -v docker &> /dev/null; then
    echo -e "${CYAN}Docker:${NC}"
    CONTAINERS=$(docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | tail -n +2)
    if [ -n "$CONTAINERS" ]; then
        echo "$CONTAINERS" | while read -r container; do
            echo "  $container"
        done
    else
        echo "  No running containers"
    fi
    echo ""
fi

# ============================================================
# Quick Commands
# ============================================================
echo -e "${CYAN}Quick Commands:${NC}"
echo "  Connect to tmux:    tmux attach -t claude"
echo "  Health check:       npm run health"
echo "  View Netdata:       http://$(tailscale ip -4 2>/dev/null || echo localhost):19999"
echo ""
