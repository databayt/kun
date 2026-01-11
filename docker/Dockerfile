# ╔═══════════════════════════════════════════════════════════════╗
# ║   Kun Development Container                                   ║
# ║   Phase 3: Isolated User Environments                         ║
# ╚═══════════════════════════════════════════════════════════════╝

FROM ubuntu:22.04

LABEL maintainer="Databayt <dev@databayt.com>"
LABEL description="Kun - Remote AI Development Environment"
LABEL version="1.0"

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# ============================================================
# System Dependencies
# ============================================================
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    tmux \
    htop \
    jq \
    vim \
    nano \
    openssh-server \
    sudo \
    locales \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# ============================================================
# Node.js 20.x
# ============================================================
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# Global npm packages
# ============================================================
RUN npm install -g \
    pnpm \
    @anthropic-ai/claude-code

# ============================================================
# Create developer user
# ============================================================
RUN useradd -m -s /bin/bash -G sudo developer \
    && echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# ============================================================
# tmux configuration
# ============================================================
COPY config/tmux/tmux.conf /home/developer/.tmux.conf
RUN chown developer:developer /home/developer/.tmux.conf

# ============================================================
# Claude configuration directory
# ============================================================
RUN mkdir -p /home/developer/.claude \
    && chown -R developer:developer /home/developer/.claude

# ============================================================
# Pattern library (read-only mount point)
# ============================================================
RUN mkdir -p /opt/databayt/codebase

# ============================================================
# SSH configuration
# ============================================================
RUN mkdir /var/run/sshd \
    && echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config \
    && echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# ============================================================
# Working directory
# ============================================================
USER developer
WORKDIR /home/developer

# Create default directories
RUN mkdir -p projects .ssh

# Default CLAUDE.md
COPY --chown=developer:developer config/claude/CLAUDE.md /home/developer/.claude/CLAUDE.md

# ============================================================
# Entrypoint
# ============================================================
COPY docker/entrypoint.sh /entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh

EXPOSE 22

ENTRYPOINT ["/entrypoint.sh"]
CMD ["tmux", "new-session", "-s", "kun"]
