# Docker Print Server

A containerized print server solution for industrial environments that integrates:
- **[Ventor Tech Direct Print Client](https://ventor.tech/)** - Connects printers to Odoo ERP
- **CUPS** - Cross-platform print server for managing printers
- **Samba** - Windows network printer sharing (SMB) with authentication
- **wsdd** - Windows Service Discovery for automatic network discovery

This solution allows you to deploy a print server on a local VM and connect various printers (label printers, regular printers, etc.) to Odoo via Ventor Tech's Direct Print module.

> **Note**: The host VM can be any OS that supports Docker (Linux, Windows, macOS). The container runs Ubuntu 22.04 internally, ensuring consistent behavior across different host platforms.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Prerequisites](#prerequisites)
4. [Deployment](#deployment)
5. [Configuration](#configuration)
6. [Adding Printers](#adding-printers)
7. [Windows Network Printer Access](#windows-network-printer-access)
8. [Updating DirectPrintClient](#updating-directprintclient)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Maintenance](#maintenance)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Docker Container (Ubuntu 22.04)                   │
│                                                                           │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ DirectPrint     │  │   CUPS   │  │   wsdd   │  │      Samba        │  │
│  │ Client          │──│  Print   │  │  (WSD)   │──│  (SMB Sharing)    │  │
│  │ (Odoo Bridge)   │  │  Server  │  │          │  │                   │  │
│  └────────┬────────┘  └────┬─────┘  └────┬─────┘  └─────────┬─────────┘  │
│           │                │             │                   │            │
└───────────┼────────────────┼─────────────┼───────────────────┼────────────┘
            │                │             │                   │
       Port 8888        Port 631      Port 3702/5357     Ports 139/445
     (Web Interface)   (CUPS Admin)   (WS-Discovery)     (SMB/NetBIOS)
            │                │             │                   │
            ▼                ▼             ▼                   ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │                        Physical Printers                           │
    │              (Label Printers, Regular Printers, etc.)             │
    └───────────────────────────────────────────────────────────────────┘
```

### Service Ports

| Port | Service | Description |
|------|---------|-------------|
| 8888 | DirectPrintClient | Web interface for Odoo Direct Print integration |
| 631  | CUPS | Print server administration interface |
| 139  | Samba (NetBIOS) | Legacy Windows network name resolution |
| 445  | Samba (SMB) | Windows printer sharing (main protocol) |
| 3702/udp | wsdd | Windows Service Discovery (WS-Discovery) |
| 5357 | wsdd | WS-Discovery HTTP endpoint |
| 9100 | Raw Printing | Direct TCP/IP printing (JetDirect/AppSocket) |

---

## Repository Structure

```
docker_print_server/
├── config/                          # Configuration templates
│   ├── cups/
│   │   └── cupsd.conf               # CUPS server configuration
│   └── samba/
│       └── smb.conf                 # Samba configuration (auth enabled)
├── data/                            # Runtime data (persistent)
│   ├── cups/
│   │   ├── printers.conf            # Printer definitions
│   │   └── subscriptions.conf       # CUPS subscriptions
│   └── spool/                       # Print queue (job files)
├── directprint/                     # DirectPrintClient binary
│   └── DirectPrintClient-X.XX.XX-ubuntu-22.04-x86_64.tar.gz
├── docs/                            # Documentation
│   └── *.docx                       # Admin instructions
├── scripts/                         # Utility scripts
│   ├── test.sh                      # Linux/macOS test script
│   └── test.ps1                     # Windows PowerShell test script
├── .env.example                     # Environment configuration template
├── .gitignore                       # Git ignore rules
├── docker-compose.yml               # Docker Compose configuration
├── Dockerfile                       # Container build instructions
└── README.md                        # This file
```

---

## Prerequisites

### Server Requirements

- **Host Operating System**: Any Docker-compatible OS:
  - Linux (Debian/Ubuntu recommended)
  - Windows with Docker Desktop
  - macOS with Docker Desktop
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later (included with Docker Desktop)
- **Memory**: Minimum 1GB RAM
- **Storage**: Minimum 2GB free disk space
- **Network**: Static IP address recommended for production

### Software Installation

**Linux (Debian/Ubuntu):**
```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (optional, avoids using sudo)
sudo usermod -aG docker $USER
```

**Windows / macOS:**
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Docker Compose is included with Docker Desktop

### Network Configuration

Ensure the following ports are open in your firewall:
- TCP 8888 (DirectPrintClient Web UI)
- TCP 631 (CUPS Administration)
- TCP/UDP 139, 445 (Samba printer sharing)
- UDP 3702, TCP 5357 (Windows network discovery)
- TCP 9100 (Raw printing - optional)

---

## Deployment

### Option 1: Docker Pull (Recommended for Production)

The image is automatically built and published to GitHub Container Registry.

```bash
# Create a project directory
mkdir -p /opt/docker_print_server && cd /opt/docker_print_server

# Download docker-compose.yml (or copy it from the repo)
curl -LO https://raw.githubusercontent.com/vertec-io/docker_print_server/main/docker-compose.yml

# Download config files
mkdir -p config/cups config/samba data/cups data/spool
curl -L https://raw.githubusercontent.com/vertec-io/docker_print_server/main/config/cups/cupsd.conf -o config/cups/cupsd.conf
curl -L https://raw.githubusercontent.com/vertec-io/docker_print_server/main/config/samba/smb.conf -o config/samba/smb.conf
curl -L https://raw.githubusercontent.com/vertec-io/docker_print_server/main/data/cups/printers.conf -o data/cups/printers.conf
curl -L https://raw.githubusercontent.com/vertec-io/docker_print_server/main/data/cups/subscriptions.conf -o data/cups/subscriptions.conf

# Edit credentials (IMPORTANT: change passwords!)
nano docker-compose.yml

# Pull and start the container
docker compose up -d
```

### Option 2: Git Clone (Development / Custom Builds)

```bash
# Clone the repository
git clone git@github.com:vertec-io/docker_print_server.git
cd docker_print_server

# Edit credentials in docker-compose.yml (IMPORTANT: change passwords!)
nano docker-compose.yml

# Build locally and start the container
docker compose up -d --build
```

### Option 3: SCP Transfer (Offline Deployment)

```bash
# On your local machine, transfer files to server
scp -r ./docker_print_server user@server-ip:/opt/

# SSH into the server
ssh user@server-ip

# Navigate to the directory
cd /opt/docker_print_server

# Configure credentials in docker-compose.yml environment section
nano docker-compose.yml  # Edit environment values (IMPORTANT: change passwords!)

# Build and start the container
docker compose up -d --build
```

### Verify Deployment

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Test CUPS is running
curl http://localhost:631

# Test DirectPrintClient is running
curl http://localhost:8888
```

---

## Configuration

### Environment Variables

Configuration is set directly in the `environment` section of `docker-compose.yml`.
You can also override values via a `.env` file or CLI:

```bash
# Override via CLI
docker compose run -e CUPS_ADMIN_PASSWORD=mysecret print-server
```

Available configuration options:

| Variable | Default | Description |
|----------|---------|-------------|
| `CUPS_ADMIN_PASSWORD` | `adminpassword` | Root password for CUPS administration |
| `SAMBA_PASSWORD` | `printers` | Password for Samba printer access (user: `printuser`) |
| `SAMBA_USER` | `printuser` | Samba username for Windows clients |
| `CUPS_SERVER_NAME` | `Print Server` | Display name for the print server |
| `TZ` | `UTC` | Timezone for the container |

⚠️ **IMPORTANT**: Always change default passwords for production deployments!

### CUPS Configuration

The CUPS configuration is stored in `config/cups/cupsd.conf`. Key settings:

```conf
# Allow remote administration (default: enabled)
Listen 0.0.0.0:631

# Enable web interface
WebInterface Yes

# Logging level (warn, info, debug)
LogLevel warn
```

### Samba Configuration

The Samba configuration is in `config/samba/smb.conf`. Authentication is **required** by default - this ensures Windows 10/11 compatibility without any client-side changes.

See [Windows Network Printer Access](#windows-network-printer-access) for details.

---

## Adding Printers

### Via CUPS Web Interface (Recommended)

1. Open your browser and navigate to `http://<server-ip>:631`
2. Click **Administration** → **Add Printer**
3. Login with:
   - Username: `root`
   - Password: Your configured `CUPS_ADMIN_PASSWORD` (default: `adminpassword`)
4. Select your printer connection type:
   - **Network Printers**: AppSocket/HP JetDirect (socket://IP:9100)
   - **USB Printers**: Will appear in the list if connected
5. Select the appropriate driver
6. Configure printer options (name, location, sharing)

### Via Command Line

```bash
# Enter the container
docker compose exec print-server bash

# Add a network printer
lpadmin -p MyPrinter -E -v socket://192.168.1.100:9100 -m everywhere

# Set as default printer
lpoptions -d MyPrinter

# List installed printers
lpstat -p -d
```

### Connecting to Odoo

1. Access DirectPrintClient at `http://<server-ip>:8888`
2. Configure your Odoo connection credentials
3. Link printers to Odoo Direct Print workstations

For detailed printer setup instructions, see the included document:
`docs/200006 ADMIN INSTRUCTION - HOW TO ADD A PRINTER ON CUPS SERVER.docx`

---

## Windows Network Printer Access

This server uses **authenticated Samba access** by default, which works out of the box with Windows 10/11 without requiring any client-side security policy changes.

### Default Credentials

| Setting | Value |
|---------|-------|
| Server Address | `\\<server-ip>\printers` |
| Username | `printuser` |
| Password | Value of `SAMBA_PASSWORD` (default: `printers`) |

### Connecting from Windows

1. Open File Explorer
2. Type `\\<server-ip>\printers` in the address bar (replace `<server-ip>` with your server's IP)
3. When prompted for credentials:
   - Username: `printuser`
   - Password: Your configured `SAMBA_PASSWORD` (default: `printers`)
   - Check "Remember my credentials" for convenience
4. Available printers will be shown

### Windows Network Discovery

The server includes **wsdd** (Web Services Discovery Daemon), which enables Windows to automatically discover the print server in the Network section of File Explorer. The server should appear as "PRINT-SERVER" in your network.

### Adding a Windows Printer

1. Go to **Settings** → **Devices** → **Printers & scanners**
2. Click **Add a printer or scanner**
3. If the printer appears via network discovery, click it to add
4. Or click **The printer that I want isn't listed**
5. Select **Select a shared printer by name**
6. Enter: `\\<server-ip>\PrinterName`
7. Enter credentials when prompted

### Testing Connection

**From Windows (Command Prompt):**
```cmd
# Test SMB connection
net view \\<server-ip>

# Open printers share in Explorer
explorer \\<server-ip>\printers
```

**From Windows (PowerShell):**
```powershell
# Test connection with credentials
net use \\<server-ip>\printers /user:printuser printers
```

**From Linux:**
```bash
# List shares (with authentication)
smbclient -L //<server-ip> -U printuser

# Connect to printers share
smbclient //<server-ip>/printers -U printuser
```

---

## Updating DirectPrintClient

When Ventor Tech releases a new version of DirectPrintClient, follow these steps to update:

### Step 1: Download the New Version

1. Go to [Ventor Tech's website](https://ventor.tech/) and download the latest DirectPrintClient
2. Choose the **Ubuntu 22.04 x86_64** version (filename: `DirectPrintClient-X.XX.XX-ubuntu-22.04-x86_64.tar.gz`)

### Step 2: Remove the Old Version

```bash
# Navigate to the directprint folder
cd directprint/

# Delete the OLD version tarball
rm -f DirectPrintClient-4.27.12-ubuntu-22.04-x86_64.tar.gz
```

### Step 3: Add the New Version

```bash
# Copy or move the new tarball into the directprint/ folder
# (replace X.XX.XX with the actual version number)
mv ~/Downloads/DirectPrintClient-X.XX.XX-ubuntu-22.04-x86_64.tar.gz directprint/
```

### Step 4: Update the Dockerfile

Edit `Dockerfile` and update the version number on these lines:

```dockerfile
# BEFORE (old version)
ADD directprint/DirectPrintClient-4.27.12-ubuntu-22.04-x86_64.tar.gz /opt/
RUN mv /opt/DirectPrintClient-4.27.12-ubuntu-22.04-x86_64 /opt/directprint && \

# AFTER (new version - replace X.XX.XX with actual version)
ADD directprint/DirectPrintClient-X.XX.XX-ubuntu-22.04-x86_64.tar.gz /opt/
RUN mv /opt/DirectPrintClient-X.XX.XX-ubuntu-22.04-x86_64 /opt/directprint && \
```

### Step 5: Rebuild and Restart

```bash
# Stop, rebuild, and restart the container
docker compose down
docker compose up -d --build
```

### Step 6: Verify the Update

```bash
# Check logs to ensure DirectPrintClient started correctly
docker compose logs -f print-server

# Or run the test script
./scripts/test.sh      # Linux/macOS
.\scripts\test.ps1     # Windows PowerShell
```

---

## Testing

Test scripts are provided to verify your deployment is working correctly.

### Running Tests

**Linux/macOS:**
```bash
chmod +x scripts/test.sh
./scripts/test.sh [server-ip]
```

**Windows PowerShell:**
```powershell
.\scripts\test.ps1 [-ServerIP "server-ip"]
```

If no IP is provided, tests run against `localhost`.

### What the Tests Check

- ✅ CUPS Web Interface (port 631)
- ✅ DirectPrintClient Web Interface (port 8888)
- ✅ Samba ports (139, 445)
- ✅ Container running status
- ✅ Internal services (cupsd, smbd, wsdd, DirectPrintClient)

---

## Troubleshooting

### Container Issues

```bash
# View container logs
docker compose logs -f print-server

# Restart the container
docker compose restart

# Rebuild and restart
docker compose up -d --build --force-recreate

# Enter container shell for debugging
docker compose exec print-server bash
```

### CUPS Issues

```bash
# Inside container - Check CUPS status
lpstat -t

# Check CUPS error log
cat /var/log/cups/error_log

# Restart CUPS
service cups restart

# Test printer
echo "Test" | lp -d PrinterName
```

### Samba Issues

```bash
# Inside container - Test Samba config
testparm

# Check Samba status
smbstatus

# List Samba users
pdbedit -L

# Check Samba logs
cat /var/log/samba/log.smbd
```

### DirectPrintClient Issues

```bash
# Check if DirectPrintClient is running
ps aux | grep DirectPrintClient

# View DirectPrintClient logs
cat /var/log/syslog | grep DirectPrint
```

### Common Problems

| Problem | Solution |
|---------|----------|
| CUPS web interface not accessible | Check port 631 is exposed, verify `Listen 0.0.0.0:631` in cupsd.conf |
| Printer shows "paused" | Run `cupsenable PrinterName` inside container |
| Windows can't see Samba share | Check firewall, verify SMB ports 139/445 open |
| "Access Denied" on Windows | Verify using correct credentials (`printuser` / your SAMBA_PASSWORD) |
| Windows can't find server in Network | Check ports 3702/udp and 5357 are open for wsdd |
| DirectPrintClient won't connect to Odoo | Verify network connectivity to Odoo server |

---

## Security Considerations

### Production Deployment Checklist

- [ ] Change default `CUPS_ADMIN_PASSWORD` in `docker-compose.yml`
- [ ] Change default `SAMBA_PASSWORD` in `docker-compose.yml`
- [ ] Restrict network access to management ports (631, 8888)
- [ ] Enable HTTPS for CUPS if accessible externally
- [ ] Regularly rebuild to get security updates: `docker compose up -d --build`
- [ ] Monitor container logs for suspicious activity

### Network Security

For production environments, consider:
- Placing the print server on a dedicated VLAN
- Using firewall rules to restrict access to trusted networks only
- Implementing VPN access for remote administration

---

## Maintenance

### Backup

Important data to backup:
- `data/cups/` - Printer definitions and subscriptions
- `config/` - Configuration files (if customized)
- `docker-compose.yml` - Service configuration and credentials

```bash
# Create backup
tar -czvf print-server-backup-$(date +%Y%m%d).tar.gz data/ config/ .env

# Restore backup
tar -xzvf print-server-backup-YYYYMMDD.tar.gz
```

### Log Rotation

Logs are automatically rotated by Docker (configured in `docker-compose.yml`):
- Max size: 10MB per file
- Max files: 3

### Container Updates

```bash
# Pull latest base image and rebuild
docker compose build --pull --no-cache
docker compose up -d
```

---

## Support

- **Ventor Tech Direct Print**: https://ventor.tech/
- **CUPS Documentation**: https://www.cups.org/documentation.html
- **Samba Documentation**: https://www.samba.org/samba/docs/
- **wsdd Documentation**: https://github.com/christgau/wsdd

---

## License

This Docker configuration is provided as-is. DirectPrintClient is licensed by Ventor Tech.
