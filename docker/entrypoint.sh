#!/bin/bash
#
# Kun Container Entrypoint
#

set -e

# ============================================================
# Environment Setup
# ============================================================

# Set API key if provided
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'" >> /home/developer/.bashrc
fi

if [ -n "$GITHUB_TOKEN" ]; then
    echo "export GITHUB_TOKEN='$GITHUB_TOKEN'" >> /home/developer/.bashrc
fi

# ============================================================
# SSH Key Setup
# ============================================================

# If SSH public key is provided, add it
if [ -n "$SSH_PUBLIC_KEY" ]; then
    mkdir -p /home/developer/.ssh
    echo "$SSH_PUBLIC_KEY" > /home/developer/.ssh/authorized_keys
    chmod 700 /home/developer/.ssh
    chmod 600 /home/developer/.ssh/authorized_keys
    chown -R developer:developer /home/developer/.ssh
fi

# ============================================================
# Start Services
# ============================================================

# Start SSH daemon
/usr/sbin/sshd

# ============================================================
# Usage Tracking (Phase 3)
# ============================================================

# Log session start
echo "[$(date -Iseconds)] Session started for user: developer" >> /var/log/kun-usage.log

# ============================================================
# Execute Command
# ============================================================

# Switch to developer user and run command
exec su - developer -c "$*"
