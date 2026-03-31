#!/bin/bash
# Databayt Credentials Manager
# Stores/retrieves API keys via macOS Keychain + opens browser for web logins
# Safari and Chrome autofill handle passwords automatically

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

KEYCHAIN_SERVICE="databayt"

# ============================================================
# MCP API Keys — stored in macOS Keychain
# ============================================================
MCP_KEYS=(
  "NEON_API_KEY|Neon database management"
  "POSTHOG_API_KEY|PostHog analytics"
  "POSTHOG_PROJECT_ID|PostHog project ID"
  "NOTION_API_KEY|Notion workspace"
  "SLACK_BOT_TOKEN|Slack bot integration"
  "SLACK_WORKSPACE_ID|Slack workspace ID"
  "AIRTABLE_API_KEY|Airtable data"
  "REF_API_KEY|Ref documentation search"
  "GITHUB_PERSONAL_ACCESS_TOKEN|GitHub API access"
)

# ============================================================
# Web Services — use browser with Safari/Chrome autofill
# ============================================================
WEB_SERVICES=(
  "https://github.com|GitHub"
  "https://vercel.com|Vercel"
  "https://discord.com|Discord"
  "https://outlook.live.com/mail/|Outlook (osmanabdout@hotmail.com)"
  "https://mail.zoho.com/|Company Email (hi@databayt.org)"
  "https://namecheap.com|Namecheap"
  "https://medium.com|Medium"
  "https://x.com|Twitter/X"
  "https://linear.app|Linear"
  "https://app.posthog.com|PostHog"
  "https://neon.tech|Neon"
  "https://app.sentry.io|Sentry"
  "https://notion.so|Notion"
  "https://app.slack.com|Slack"
  "https://dashboard.stripe.com|Stripe"
)

store_key() {
  local key_name="$1"
  local value="$2"
  security add-generic-password -s "$KEYCHAIN_SERVICE" -a "$key_name" -w "$value" -U 2>/dev/null
  echo -e "${GREEN}✓ Stored $key_name in Keychain${NC}"
}

get_key() {
  local key_name="$1"
  security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$key_name" -w 2>/dev/null || echo ""
}

check_safari_password() {
  # Check if a password exists in Safari's internet passwords
  local server="$1"
  local result
  result=$(security find-internet-password -s "$server" 2>/dev/null && echo "found" || echo "")
  echo "$result"
}

case "${1:-help}" in
  # --------------------------------------------------------
  # Store all MCP API keys interactively
  # --------------------------------------------------------
  "setup")
    echo -e "${GREEN}=== Databayt Credentials Setup ===${NC}"
    echo ""
    echo "This stores MCP API keys in macOS Keychain (encrypted, secure)."
    echo "Safari and Chrome passwords are used automatically via browser autofill."
    echo ""

    for entry in "${MCP_KEYS[@]}"; do
      IFS='|' read -r key_name description <<< "$entry"
      existing=$(get_key "$key_name")
      if [ -n "$existing" ]; then
        echo -e "${BLUE}$key_name${NC} ($description): ${GREEN}already stored${NC}"
        read -p "  Update? (y/N): " update
        [ "$update" != "y" ] && continue
      fi
      read -p "  Enter $key_name ($description): " value
      if [ -n "$value" ]; then
        store_key "$key_name" "$value"
      else
        echo -e "  ${YELLOW}Skipped${NC}"
      fi
    done

    echo ""
    echo -e "${GREEN}Done! Keys stored in macOS Keychain.${NC}"
    echo "Run '$0 export' to set them as environment variables."
    ;;

  # --------------------------------------------------------
  # Export all stored keys as env vars (for current shell)
  # --------------------------------------------------------
  "export")
    echo "# Databayt MCP environment variables"
    echo "# Source this: eval \$($0 export)"
    for entry in "${MCP_KEYS[@]}"; do
      IFS='|' read -r key_name _ <<< "$entry"
      value=$(get_key "$key_name")
      if [ -n "$value" ]; then
        echo "export $key_name=\"$value\""
      fi
    done
    ;;

  # --------------------------------------------------------
  # Check which keys are stored vs missing
  # --------------------------------------------------------
  "status")
    echo -e "${GREEN}=== Credential Status ===${NC}"
    echo ""
    echo -e "${YELLOW}MCP API Keys (Keychain):${NC}"
    for entry in "${MCP_KEYS[@]}"; do
      IFS='|' read -r key_name description <<< "$entry"
      value=$(get_key "$key_name")
      if [ -n "$value" ]; then
        # Show first 8 chars only
        preview="${value:0:8}..."
        echo -e "  ${GREEN}✓${NC} $key_name ($description) = $preview"
      else
        echo -e "  ${RED}✗${NC} $key_name ($description) — NOT SET"
      fi
    done

    echo ""
    echo -e "${YELLOW}Web Service Passwords (Safari/Chrome):${NC}"
    for entry in "${WEB_SERVICES[@]}"; do
      IFS='|' read -r url name <<< "$entry"
      domain=$(echo "$url" | awk -F/ '{print $3}')
      has_pw=$(check_safari_password "$domain")
      if [ -n "$has_pw" ]; then
        echo -e "  ${GREEN}✓${NC} $name ($domain) — password in Keychain"
      else
        echo -e "  ${YELLOW}?${NC} $name ($domain) — open Safari Passwords to verify"
      fi
    done
    ;;

  # --------------------------------------------------------
  # Open browser for web service logins (Safari autofill)
  # --------------------------------------------------------
  "login")
    echo -e "${GREEN}=== Browser Login Session ===${NC}"
    echo "Opening each service in Safari. Passwords autofill from Safari/iCloud Keychain."
    echo ""

    if [ -n "$2" ]; then
      # Open specific service
      for entry in "${WEB_SERVICES[@]}"; do
        IFS='|' read -r url name <<< "$entry"
        if echo "$name" | grep -qi "$2"; then
          echo -e "Opening $name..."
          open -a Safari "$url"
          exit 0
        fi
      done
      echo "Service '$2' not found"
      exit 1
    fi

    # Open all
    for entry in "${WEB_SERVICES[@]}"; do
      IFS='|' read -r url name <<< "$entry"
      echo -e "  ${GREEN}→${NC} $name"
      open -a Safari "$url"
      sleep 1
    done

    echo ""
    echo "All services opened in Safari. Log in (passwords should autofill)."
    echo "After logging in, run: $0 browser-persist"
    ;;

  # --------------------------------------------------------
  # Persist Safari sessions to Playwright profile
  # --------------------------------------------------------
  "browser-persist")
    echo -e "${GREEN}=== Persisting Browser Sessions ===${NC}"
    echo "Opening services in Playwright headed browser (persistent profile)."
    echo "Log into each service — sessions save to ~/.playwright-profile"
    echo ""

    for entry in "${WEB_SERVICES[@]}"; do
      IFS='|' read -r url name <<< "$entry"
      echo -e "  Opening $name in Playwright browser..."
      echo "  Log in, then press Enter here."
      # The browser-headed MCP handles persistence
      echo "  Use Claude Code: browser-headed MCP → navigate to $url → log in"
      read -p "  Press Enter when done with $name..."
    done

    echo -e "${GREEN}Sessions persisted!${NC}"
    ;;

  # --------------------------------------------------------
  # Store a single key
  # --------------------------------------------------------
  "set")
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "Usage: $0 set <KEY_NAME> <value>"
      exit 1
    fi
    store_key "$2" "$3"
    ;;

  # --------------------------------------------------------
  # Get a single key
  # --------------------------------------------------------
  "get")
    if [ -z "$2" ]; then
      echo "Usage: $0 get <KEY_NAME>"
      exit 1
    fi
    get_key "$2"
    ;;

  # --------------------------------------------------------
  # Help
  # --------------------------------------------------------
  *)
    echo "Databayt Credentials Manager"
    echo ""
    echo "Commands:"
    echo "  setup          — Interactive setup of all MCP API keys"
    echo "  status         — Show which credentials are stored vs missing"
    echo "  export         — Print env vars for shell (eval \$($0 export))"
    echo "  login [name]   — Open services in Safari for login (autofill)"
    echo "  browser-persist — Persist sessions to Playwright profile"
    echo "  set <key> <val> — Store a single key"
    echo "  get <key>       — Retrieve a single key"
    echo ""
    echo "API keys are stored in macOS Keychain (encrypted)."
    echo "Web passwords come from Safari/Chrome autofill."
    ;;
esac
