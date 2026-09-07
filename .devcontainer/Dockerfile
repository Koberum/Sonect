# Dev Container Dockerfile based on backend Dockerfile
# Uses same OS as Raspberry Pi (Debian Bookworm)

FROM node:22-bookworm

# System dependencies (dev + audio + MPD)
RUN apt-get update && apt-get install -y \
    mpd \
    alsa-utils \
    alsa-tools \
    curl \
    git \
    dumb-init \
    bash \
    sudo \
    vim \
    cifs-utils \
    nfs-common \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN curl -fsSL https://get.pnpm.io/install.sh | bash -
ENV PATH="/root/.local/share/pnpm:$PATH"

# Also make pnpm available for node user
RUN mkdir -p /home/node/.local/share && \
    cp -r /root/.local/share/pnpm /home/node/.local/share/ && \
    chown -R node:node /home/node/.local

# Install Opencode
RUN curl -fsSL https://opencode.ai/install | bash

# Add node user pnpm to PATH
ENV PATH="/home/node/.local/share/pnpm:$PATH"

# Give node user sudo access (useful for dev)
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set working directory
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
