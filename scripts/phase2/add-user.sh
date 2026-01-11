#!/bin/bash
#
# Kun Add User Script
# Creates a new developer account with proper configuration
#
# Usage: sudo bash scripts/phase2/add-user.sh <username> [email]
#

set -e

if [ "$EUID" -ne 0 ]; then
    echo "This script must be run as root (use sudo)"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <username> [email]"
    echo "Example: $0 dev1 dev1@databayt.com"
    exit 1
fi

USERNAME="$1"
EMAIL="${2:-$USERNAME@databayt.com}"

echo ""
echo "Creating developer account: $USERNAME"
echo ""

# Check if user exists
if id "$USERNAME" &>/dev/null; then
    echo "User $USERNAME already exists"
    exit 1
fi

# Create user with developers group
useradd -m -G developers -s /bin/bash "$USERNAME"
echo "User $USERNAME created"

# Set up home directory
USER_HOME="/home/$USERNAME"

# Create .bashrc with shared env
cat > "$USER_HOME/.bashrc" << 'EOF'
# ~/.bashrc: executed by bash for non-login shells

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# History settings
HISTCONTROL=ignoreboth
HISTSIZE=10000
HISTFILESIZE=20000
shopt -s histappend

# Check window size
shopt -s checkwinsize

# Prompt
PS1='\[\033[01;32m\]\u@kun\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# Source Kun shared environment
if [ -f /etc/claude-code/env.sh ]; then
    source /etc/claude-code/env.sh
fi

# Aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias claude-session='tmux attach -t kun || tmux new-session -s kun'
alias reload='source ~/.bashrc'
EOF

# Copy tmux config
if [ -f /etc/claude-code/tmux.conf ]; then
    cp /etc/claude-code/tmux.conf "$USER_HOME/.tmux.conf"
else
    # Default tmux config
    cat > "$USER_HOME/.tmux.conf" << 'EOF'
set -g mouse on
set -g history-limit 50000
set -g status-left '[#S] '
set -g status-right '%H:%M'
bind | split-window -h
bind - split-window -v
bind r source-file ~/.tmux.conf \; display "Reloaded!"
EOF
fi

# Create Claude config directory
mkdir -p "$USER_HOME/.claude"

# Link to global CLAUDE.md
cat > "$USER_HOME/.claude/CLAUDE.md" << EOF
# $USERNAME Development Context

## Include Global Context
See: /etc/claude-code/CLAUDE.md

## Personal Preferences
# Add your personal preferences here
EOF

# Set ownership
chown -R "$USERNAME:$USERNAME" "$USER_HOME"

# Enable tmux service for user
systemctl enable "kun-tmux@$USERNAME"

echo ""
echo "User $USERNAME created successfully!"
echo ""
echo "Configuration:"
echo "  - Home: $USER_HOME"
echo "  - Group: developers"
echo "  - Shell: /bin/bash"
echo "  - tmux service: kun-tmux@$USERNAME"
echo ""
echo "The user can now:"
echo "  1. Connect via Tailscale SSH"
echo "  2. Run 'claude-session' to start tmux"
echo "  3. Use Claude Code with shared patterns"
echo ""
