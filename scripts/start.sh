#!/bin/bash

echo "=============================================="
echo "Docker Print Server Starting..."
echo "=============================================="

echo "[1/6] Starting D-Bus (required for Avahi)..."
mkdir -p /var/run/dbus
dbus-daemon --system --fork 2>/dev/null || true

echo "[2/6] Starting Avahi mDNS daemon..."
# Avahi enables hostname.local resolution (e.g., \\print-server.local)
avahi-daemon -D 2>/dev/null || true

echo "[3/6] Starting CUPS print server..."
cupsd

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
echo "=============================================="
echo "Services running:"
echo "  - CUPS Web Interface: http://localhost:631"
echo "  - DirectPrintClient:  http://localhost:8888"
echo "  - Windows Printers:   \\\\<server-ip>\\printers"
echo "  - Samba User:         printuser"
echo "=============================================="

# Try to start DirectPrintClient, but don't crash if it fails
# (it may fail on some systems due to library version mismatches)
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
        echo "WARNING: Samba crashed, restarting..."
        smbd -D
    fi

    sleep 30
done

