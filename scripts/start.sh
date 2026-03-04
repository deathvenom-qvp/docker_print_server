#!/bin/bash

echo "=============================================="
echo "Docker Print Server Starting..."
echo "=============================================="
# =============================================
# Configure credentials from environment variables
# =============================================
CUPS_ADMIN_PASSWORD=${CUPS_ADMIN_PASSWORD:-adminpassword}
SAMBA_PASSWORD=${SAMBA_PASSWORD:-printers}
SAMBA_USER=${SAMBA_USER:-printuser}
CUPS_SERVER_NAME=${CUPS_SERVER_NAME:-Print Server}

# =============================================
# Restore missing CUPS config files from defaults
# =============================================
# The named volume cups-config:/etc/cups may be empty on first run or
# after a failed startup. Restore any missing files from the pristine
# copies baked into /etc/cups-defaults/ during the image build.
if [ -d /etc/cups-defaults ]; then
    for f in cupsd.conf printers.conf subscriptions.conf; do
        if [ ! -f "/etc/cups/$f" ]; then
            echo "  [init] Restoring missing /etc/cups/$f from defaults"
            cp "/etc/cups-defaults/$f" "/etc/cups/$f"
        fi
    done
    # Ensure the PPD directory exists
    mkdir -p /etc/cups/ppd
fi

echo "[0/6] Configuring credentials and settings..."

# Set root password for CUPS web administration
echo "root:${CUPS_ADMIN_PASSWORD}" | chpasswd

# Create Samba print user if it doesn't already exist
if ! id "${SAMBA_USER}" &>/dev/null; then
    useradd -r -s /sbin/nologin "${SAMBA_USER}"
fi

# Set Samba passwords
printf "%s\n%s\n" "${SAMBA_PASSWORD}" "${SAMBA_PASSWORD}" | smbpasswd -s -a "${SAMBA_USER}"
printf "%s\n%s\n" "${SAMBA_PASSWORD}" "${SAMBA_PASSWORD}" | smbpasswd -s -a root

echo "  - CUPS admin user: root"
echo "  - Samba user: ${SAMBA_USER}"

# Update smb.conf valid users if SAMBA_USER is not the default
if [ "${SAMBA_USER}" != "printuser" ]; then
    sed -i "s/valid users = printuser, root/valid users = ${SAMBA_USER}, root/" /etc/samba/smb.conf
fi

# Apply CUPS_SERVER_NAME to cupsd.conf
if grep -q '^ServerName ' /etc/cups/cupsd.conf; then
    sed -i "s/^ServerName .*/ServerName ${CUPS_SERVER_NAME}/" /etc/cups/cupsd.conf
else
    sed -i "/^Listen /i ServerName ${CUPS_SERVER_NAME}" /etc/cups/cupsd.conf
fi
echo "  - CUPS server name: ${CUPS_SERVER_NAME}"

echo "[1/6] Starting D-Bus (required for Avahi)..."
mkdir -p /var/run/dbus
dbus-daemon --system --fork 2>/dev/null || true

echo "[2/6] Starting Avahi mDNS daemon..."
# Avahi enables hostname.local resolution (e.g., \\print-server.local)
avahi-daemon -D 2>/dev/null || true

echo "[3/6] Starting CUPS print server..."
mkdir -p /var/run/cups /var/log/cups /var/cache/cups /var/spool/cups/tmp
chmod 0710 /var/spool/cups/tmp 2>/dev/null || true

# Start CUPS and check it actually launched
cupsd
sleep 1
if ! pgrep -x cupsd > /dev/null; then
    echo "ERROR: CUPS failed to start. Check config:"
    cupsd -t 2>&1 || true
    echo "--- Last 20 lines of CUPS error log ---"
    tail -20 /var/log/cups/error_log 2>/dev/null || true
    echo "Retrying CUPS in foreground for diagnostics..."
    cupsd -f &
    sleep 2
fi

echo "[4/6] Starting Samba NetBIOS daemon (nmbd)..."
# nmbd handles NetBIOS name resolution (e.g., \\print-server)
nmbd -D

echo "[5/6] Starting Samba SMB daemon (smbd)..."
smbd -D

echo "[6/6] Starting wsdd (Windows Service Discovery)..."
# wsdd enables Windows to discover this server via Network in File Explorer
# -4 = IPv4 only, run in background
python3 /usr/local/bin/wsdd -4 &

echo "[+] Starting DirectPrintClient..."
# Detect container IP for status display
CONTAINER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
CONTAINER_IP=${CONTAINER_IP:-localhost}
echo "=============================================="
echo "Services running:"
echo "  - CUPS Web Interface: http://${CONTAINER_IP}:631"
echo "  - DirectPrintClient:  http://${CONTAINER_IP}:8888"
echo "  - Windows Printers:   \\\\${CONTAINER_IP}\\printers"
echo "  - Samba User:         ${SAMBA_USER}"
echo "=============================================="

# Try to start DirectPrintClient, but don't crash if it fails
# (it may fail on some systems due to library version mismatches)
# Wait briefly for CUPS to be fully ready
sleep 2
/opt/directprint/DirectPrintClient --headless --shutdown-on-sigint --web-interface --remove-scales-support &
DIRECTPRINT_PID=$!

# Keep container running and monitor services
echo "Container started successfully. Monitoring services..."
while true; do
    # Check if CUPS is still running
    if ! pgrep -x cupsd > /dev/null; then
        echo "WARNING: CUPS crashed, restarting..."
        cupsd
    fi

    # Check if Samba is still running
    if ! pgrep -x smbd > /dev/null; then
        echo "WARNING: Samba (smbd) crashed, restarting..."
        smbd -D
    fi

    # Check if nmbd is still running
    if ! pgrep -x nmbd > /dev/null; then
        echo "WARNING: Samba (nmbd) crashed, restarting..."
        nmbd -D
    fi

    # Check if wsdd is still running
    if ! pgrep -f wsdd > /dev/null; then
        echo "WARNING: wsdd crashed, restarting..."
        python3 /usr/local/bin/wsdd -4 &
    fi

    sleep 30
done

