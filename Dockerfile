# =============================================================================
# Docker Print Server
# CUPS + Samba + wsdd + DirectPrintClient
# =============================================================================
#
# This container provides:
# - CUPS print server for managing printers
# - Samba for Windows SMB printer sharing
# - wsdd for Windows network discovery (WSD protocol)
# - DirectPrintClient for Odoo Direct Print integration
#
# Host OS can be any Docker-compatible system (Linux, Windows, macOS)
# The container runs Debian 11 internally.
#
# =============================================================================
FROM debian:11-slim

# =============================================================================
# Build Arguments (can be overridden at build time or via .env)
# =============================================================================
ARG CUPS_ADMIN_PASSWORD=adminpassword
ARG SAMBA_PASSWORD=printers
ARG SAMBA_USER=printuser

# =============================================================================
# Install Dependencies
# =============================================================================
RUN echo "deb http://deb.debian.org/debian bullseye-backports main" \
    > /etc/apt/sources.list.d/bullseye-backports.list

RUN apt-get update && \
    apt-get install -y -t bullseye-backports libcurl4 && \
    apt-get install -y \
    # CUPS and printing
    cups \
    cups-client \
    cups-bsd \
    cups-filters \
    cups-ipp-utils \
    cups-pdf \
    printer-driver-all \
    # Samba for Windows SMB sharing
    samba \
    samba-common-bin \
    smbclient \
    cifs-utils \
    # wsdd for Windows network discovery (WSD protocol)
    wsdd \
    # Python for utilities
    python3 \
    python3-cups \
    # System utilities
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# Set Root Password for CUPS Administration
# =============================================================================
RUN echo "root:${CUPS_ADMIN_PASSWORD}" | chpasswd

# =============================================================================
# Create Samba Print User
# =============================================================================
# Create a dedicated user for Samba print access (more secure than using root)
RUN useradd -r -s /sbin/nologin ${SAMBA_USER}

# =============================================================================
# Copy DirectPrintClient
# =============================================================================
# The DirectPrintClient binary connects to Odoo via Direct Print module
# To update: replace the contents of directprint/DirectPrintClient-X.XX.XX-debian_11-x86_64/
COPY directprint/DirectPrintClient-4.27.17-debian_11-x86_64/ /opt/directprint/

RUN ldconfig && \
    chmod +x /opt/directprint/DirectPrintClient && \
    chmod +x /opt/directprint/init.sh

# =============================================================================
# Configure Samba
# =============================================================================
# Create Samba spool directory
RUN mkdir -p /var/spool/samba && \
    chmod 1777 /var/spool/samba

# Create Samba log directory
RUN mkdir -p /var/log/samba

# Set up Samba user with configured password
# This is the user Windows clients will authenticate with
RUN printf "${SAMBA_PASSWORD}\n${SAMBA_PASSWORD}\n" | smbpasswd -s -a ${SAMBA_USER}

# Also set up root as fallback
RUN printf "${SAMBA_PASSWORD}\n${SAMBA_PASSWORD}\n" | smbpasswd -s -a root

# =============================================================================
# Create Startup Script
# =============================================================================
COPY <<'EOF' /start.sh
#!/bin/bash
set -e

echo "=============================================="
echo "Docker Print Server Starting..."
echo "=============================================="

echo "[1/5] Starting CUPS print server..."
cupsd

echo "[2/5] Starting Samba NetBIOS daemon (nmbd)..."
nmbd -D

echo "[3/5] Starting Samba SMB daemon (smbd)..."
smbd -D

echo "[4/5] Starting wsdd (Windows Service Discovery)..."
# wsdd enables Windows to discover this server via Network in File Explorer
# -4 = IPv4 only, -p = run in foreground but we background it
wsdd -4 &

echo "[5/5] Starting DirectPrintClient..."
echo "=============================================="
echo "Services running:"
echo "  - CUPS Web Interface: http://localhost:631"
echo "  - DirectPrintClient:  http://localhost:8888"
echo "  - Windows Printers:   \\\\<server-ip>\\printers"
echo "  - Samba User:         printuser"
echo "=============================================="

exec /opt/directprint/DirectPrintClient --headless --shutdown-on-sigint --web-interface --remove-scales-support
EOF
RUN chmod +x /start.sh

# =============================================================================
# Environment Variables
# =============================================================================
ENV PYTHONUNBUFFERED=1

# =============================================================================
# Expose Ports
# =============================================================================
# 631   - CUPS web interface and IPP printing
# 139   - Samba NetBIOS Session Service
# 445   - Samba SMB Direct (main Windows file/print sharing)
# 3702  - wsdd WS-Discovery (UDP, for Windows network discovery)
# 5357  - wsdd WS-Discovery HTTP
# 8888  - DirectPrintClient web interface
# 9100  - Raw printing (JetDirect/AppSocket)
EXPOSE 631 139 445 3702/udp 5357 8888 9100

# =============================================================================
# Health Check
# =============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:631/ > /dev/null && \
        curl -sf http://localhost:8888/ > /dev/null || exit 1

# =============================================================================
# Start Services
# =============================================================================
ENTRYPOINT ["/start.sh"]

