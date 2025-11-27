# Quick Start Guide

Quick reference for deploying and testing the Docker Print Server.

---

## 1. Deploy

```bash
# Clone and enter directory
git clone <repo-url>
cd docker_print_server

# Configure environment (optional - defaults work for testing)
cp .env.example .env
nano .env

# Build and start
docker compose up -d --build
```

## 2. Verify Services

```bash
# Check container status
docker compose ps

# Check all services are running
docker exec print-server ps aux

# View logs
docker compose logs -f
```

**Expected processes:** `cupsd`, `smbd`, `nmbd`, `avahi-daemon`, `wsdd`, `DirectPrintClient`

## 3. Access Interfaces

| Service | URL/Address |
|---------|-------------|
| CUPS Admin | http://localhost:631 |
| DirectPrintClient | http://localhost:8888 |
| Windows SMB | `\\<server-ip>` or `\\print-server.local` |

## 4. Add a Printer (CUPS Web)

1. Go to http://localhost:631
2. **Administration** → **Add Printer**
3. Login: `root` / `adminpassword` (or your configured password)
4. Select printer → Configure → **Share This Printer** ✓

## 5. Test Printing

```bash
# List available printers
docker exec print-server lpstat -p -d

# Print test page
docker exec print-server lp -d <printer-name> /etc/hosts

# Check print queue
docker exec print-server lpstat -o
```

## 6. Windows Client Connection

1. Open File Explorer
2. Type in address bar: `\\<server-ip>` or `\\print-server.local`
3. Enter credentials: `printuser` / `printers`
4. Double-click printer to install

## 7. Configure Odoo (DirectPrintClient)

1. Go to http://localhost:8888
2. Sign in with Odoo account
3. Printers auto-discovered from CUPS

## 8. Common Commands

```bash
# Restart container
docker compose restart

# Stop container
docker compose down

# Rebuild after changes
docker compose up -d --build

# Shell access
docker exec -it print-server bash

# View CUPS error log
docker exec print-server tail -f /var/log/cups/error_log
```

## 9. Troubleshooting

```bash
# Test SMB share
docker exec print-server smbclient -L localhost -U printuser%printers

# Test mDNS hostname
docker exec print-server avahi-resolve -n print-server.local

# Check Samba config
docker exec print-server testparm -s
```

---

## Port Reference

| Port | Service |
|------|---------|
| 631 | CUPS (HTTP/IPP) |
| 8888 | DirectPrintClient Web UI |
| 137/udp | NetBIOS Name Service |
| 138/udp | NetBIOS Datagram |
| 139 | NetBIOS Session (SMB) |
| 445 | SMB Direct |
| 5353/udp | mDNS (Avahi) |
| 3702/udp | WS-Discovery |

---

See [README.md](../README.md) for full documentation.

