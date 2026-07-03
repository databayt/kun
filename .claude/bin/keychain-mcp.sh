#!/bin/bash
# macOS Keychain MCP wrapper
# Usage: keychain-mcp.sh <command> [args...]

set -e

case "$1" in
  "find-password")
    # Find internet password by server
    security find-internet-password -s "$2" -w 2>/dev/null || echo ""
    ;;
  "find-generic")
    # Find generic password by service
    security find-generic-password -s "$2" -w 2>/dev/null || echo ""
    ;;
  "list-internet")
    # List all internet passwords (servers only, not passwords)
    security dump-keychain 2>/dev/null | grep "svce\|srvr" | head -50
    ;;
  "add-password")
    # Add a generic password
    # Usage: add-password <service> <account> <password>
    security add-generic-password -s "$2" -a "$3" -w "$4" -U
    ;;
  *)
    echo "Keychain MCP Commands:"
    echo "  find-password <server>     - Find internet password"
    echo "  find-generic <service>     - Find generic password"
    echo "  list-internet              - List internet password servers"
    echo "  add-password <svc> <acct> <pwd> - Add generic password"
    ;;
esac
