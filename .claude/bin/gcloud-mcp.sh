#!/bin/bash
# Google Cloud MCP wrapper for OAuth credential management
# Usage: gcloud-mcp.sh <command> [args...]

set -e

case "$1" in
  "auth-login")
    # Interactive login
    gcloud auth login --no-launch-browser
    ;;
  "auth-status")
    gcloud auth list
    ;;
  "projects")
    gcloud projects list --format="json"
    ;;
  "oauth-clients")
    # List OAuth clients for a project
    PROJECT="${2:-$(gcloud config get-value project)}"
    gcloud alpha iap oauth-brands list --project="$PROJECT" --format="json" 2>/dev/null || \
    echo '{"error": "Use console.cloud.google.com for OAuth client management"}'
    ;;
  "set-project")
    gcloud config set project "$2"
    ;;
  *)
    echo "Google Cloud MCP Commands:"
    echo "  auth-login    - Authenticate with Google Cloud"
    echo "  auth-status   - Show current authentication"
    echo "  projects      - List available projects"
    echo "  set-project   - Set current project"
    echo "  oauth-clients - List OAuth clients (limited API access)"
    ;;
esac
