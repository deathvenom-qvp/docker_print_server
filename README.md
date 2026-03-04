# Docker Print Server

A containerized print server combining CUPS, Samba, wsdd, and [Ventor Tech DirectPrintClient](https://ventor.tech/) in a single Docker image. Designed for environments that need to share printers with Windows clients and optionally bridge them to Odoo ERP.

**Image:** `ghcr.io/vertec-io/docker_print_server:latest`

| Service | Port | Purpose |
|---------|------|---------|
| CUPS | 631 | Print server admin UI and IPP |
| DirectPrintClient | 8888 | Odoo Direct Print web interface |
| Samba | 1139 / 1445 | Windows SMB printer sharing (host-mapped) |
| wsdd | 3702/udp, 5357 | Windows network discovery |
| Raw printing | 9100 | JetDirect / AppSocket (optional) |

> Internally the container maps 139/445 for Samba. The default host ports are 1139/1445 to avoid conflicts on Windows hosts. On Linux production VMs you can change these to 139/445 in `docker-compose.yml`.

---

## Quick Start

### Pull and Run (recommended)

```bash
docker pull ghcr.io/vertec-io/docker_print_server:latest
```

Clone the repo (or just grab the compose file and configs):

```bash
git clone https://github.com/vertec-io/docker_print_server.git
cd docker_print_server
```

Edit credentials in `docker-compose.yml`, then:

```bash
docker compose up -d
```

### Build Locally

```bash
docker compose up -d --build
```

### Verify

```bash
docker compose ps
curl -s http://localhost:631  # CUPS
curl -s http://localhost:8888 # DirectPrintClient
```

---

## Deploy the Pre-Built Image (No Clone Required)

You can run the print server on any Docker host without cloning this repo. Just create a `docker-compose.yml` and the required config files.

### 1. Create a project directory

```bash
mkdir -p docker_print_server && cd docker_print_server
```

### 2. Create `docker-compose.yml`

```yaml
networks:
  printnet:
    name: printnet
    driver: bridge

services:
  print-server:
    image: ghcr.io/vertec-io/docker_print_server:latest
    container_name: print-server
    hostname: print-server
    restart: unless-stopped

    environment:
      - CUPS_ADMIN_PASSWORD=changeme        # CUPS web admin password (user: root)
      - SAMBA_PASSWORD=changeme             # Windows printer sharing password
      - SAMBA_USER=printuser                # Windows printer sharing username
      - CUPS_SERVER_NAME=Print Server
      - TZ=UTC

    volumes:
      - ./config/cups/cupsd.conf:/etc/cups/cupsd.conf:ro
      - ./config/samba/smb.conf:/etc/samba/smb.conf:ro
      - ./data/cups:/etc/cups/ppd
      - ./data/cups/printers.conf:/etc/cups/printers.conf
      - ./data/cups/subscriptions.conf:/etc/cups/subscriptions.conf
      - ./data/spool:/var/spool/cups

    ports:
      - "631:631"         # CUPS web UI / IPP
      - "8888:8888"       # DirectPrintClient (Odoo)
      - "1139:139"        # Samba NetBIOS  (use 139:139 on Linux production hosts)
      - "1445:445"        # Samba SMB      (use 445:445 on Linux production hosts)
      - "3702:3702/udp"   # wsdd discovery
      - "5357:5357"       # wsdd HTTP
      - "9100:9100"       # Raw printing (optional)

    networks:
      - printnet

    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 3. Download the config files

```bash
# Create directories
mkdir -p config/cups config/samba data/cups data/spool

# CUPS config
curl -fsSL https://raw.githubusercontent.com/vertec-io/docker_print_server/main/config/cups/cupsd.conf \
  -o config/cups/cupsd.conf

# Samba config
curl -fsSL https://raw.githubusercontent.com/vertec-io/docker_print_server/main/config/samba/smb.conf \
  -o config/samba/smb.conf

# CUPS data files (empty templates)
curl -fsSL https://raw.githubusercontent.com/vertec-io/docker_print_server/main/data/cups/printers.conf \
  -o data/cups/printers.conf
curl -fsSL https://raw.githubusercontent.com/vertec-io/docker_print_server/main/data/cups/subscriptions.conf \
  -o data/cups/subscriptions.conf
```

### 4. Start

```bash
docker compose up -d
```

The container will pull from `ghcr.io/vertec-io/docker_print_server:latest`, configure credentials at startup, and begin running all services.

### 5. Access

| Interface | URL |
|-----------|-----|
| CUPS Admin | `http://<server-ip>:631` (login: `root` / your `CUPS_ADMIN_PASSWORD`) |
| DirectPrintClient | `http://<server-ip>:8888` |
| Windows Printers | `\\<server-ip>\printers` (login: your `SAMBA_USER` / `SAMBA_PASSWORD`) |

### Update to the latest image

```bash
docker compose pull
docker compose up -d
```

---

## Configuration

All settings are environment variables in the `environment` section of `docker-compose.yml`. Change them there, or override via CLI:

```bash
docker compose run -e CUPS_ADMIN_PASSWORD=mysecret -e SAMBA_PASSWORD=s3cret print-server
```

| Variable | Default | Description |
|----------|---------|-------------|
| `CUPS_ADMIN_PASSWORD` | `adminpassword` | Root password for CUPS web admin |
| `SAMBA_PASSWORD` | `printers` | Samba authentication password |
| `SAMBA_USER` | `printuser` | Samba username for Windows clients |
| `CUPS_SERVER_NAME` | `Print Server` | Display name |
| `TZ` | `UTC` | Container timezone |

> **Change the default passwords before deploying to production.**

Credentials are applied at container startup (not baked into the image), so you can change them and just restart — no rebuild needed.

### Config Files (mounted as volumes)

| File | Purpose |
|------|---------|
| `config/cups/cupsd.conf` | CUPS server configuration (read-only mount) |
| `config/samba/smb.conf` | Samba configuration (read-only mount) |
| `data/cups/printers.conf` | Printer definitions (read-write, persisted) |
| `data/cups/subscriptions.conf` | CUPS subscriptions (read-write, persisted) |
| `data/spool/` | Print queue spool (read-write, persisted) |

---

## Adding Printers

### CUPS Web Interface

1. Browse to `http://<server-ip>:631` → **Administration** → **Add Printer**
2. Log in as `root` / your `CUPS_ADMIN_PASSWORD`
3. Select connection type (e.g. `socket://PRINTER_IP:9100`)
4. Choose a driver and configure options

### Command Line

```bash
docker compose exec print-server bash

lpadmin -p MyPrinter -E -v socket://192.168.1.100:9100 -m everywhere
lpoptions -d MyPrinter
lpstat -p -d
```

### Odoo Integration

1. Open `http://<server-ip>:8888`
2. Enter your Odoo connection details
3. Link printers to Direct Print workstations

---

## Windows Printer Access

Samba is configured with user-level authentication — Windows 10/11 works out of the box.

| Setting | Value |
|---------|-------|
| Address | `\\<server-ip>\printers` |
| Username | `printuser` (or your `SAMBA_USER`) |
| Password | your `SAMBA_PASSWORD` (default: `printers`) |

1. Open File Explorer → type `\\<server-ip>\printers`
2. Enter credentials when prompted (check "Remember")
3. Right-click a printer → **Connect**

The **wsdd** daemon advertises the server via WS-Discovery so it appears automatically under **Network** in File Explorer.

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/docker-build.yml`) automatically builds and pushes the image to `ghcr.io` on every push to `main` and on version tags (`v*`). Pull requests trigger a build without pushing.

Tags produced:
- `latest` — current `main`
- `<version>` — from `v*` git tags (e.g. `v1.0.0` → `1.0.0`)
- `<short-sha>` — for traceability

---

## Repository Structure

```
docker_print_server/
├── .github/workflows/
│   └── docker-build.yml              # CI: build & push to ghcr.io
├── config/
│   ├── cups/cupsd.conf                # CUPS configuration
│   └── samba/smb.conf                 # Samba configuration
├── data/
│   ├── cups/
│   │   ├── printers.conf             # Printer definitions (runtime)
│   │   └── subscriptions.conf        # CUPS subscriptions (runtime)
│   └── spool/                         # Print queue
├── directprint/
│   └── DirectPrintClient-*.tar.gz     # Ventor Tech binary
├── docs/                              # Admin instructions
├── scripts/
│   ├── start.sh                       # Container entrypoint
│   ├── test.sh                        # Linux test script
│   └── test.ps1                       # PowerShell test script
├── .env.example                       # Optional env overrides
├── docker-compose.yml                 # Service definition
├── Dockerfile                         # Image build
└── README.md
```

---

## Updating DirectPrintClient

1. Download the new **Ubuntu 22.04 x86_64** `.tar.gz` from [Ventor Tech](https://ventor.tech/)
2. Replace the file in `directprint/`
3. Update the version in `Dockerfile` (`ADD` and `RUN mv` lines)
4. Rebuild: `docker compose up -d --build`

---

## Testing

```bash
# Linux / macOS
./scripts/test.sh [server-ip]

# Windows PowerShell
.\scripts\test.ps1 [-ServerIP "server-ip"]
```

Tests verify CUPS, DirectPrintClient, Samba ports (1139/1445), container status, and internal daemons.

---

## Troubleshooting

```bash
docker compose logs -f print-server    # Container logs
docker compose exec print-server bash  # Shell access
```

| Problem | Fix |
|---------|-----|
| CUPS not accessible | Verify port 631, check `cupsd.conf` has `Listen 0.0.0.0:631` |
| Printer paused | `docker compose exec print-server cupsenable PrinterName` |
| Windows can't connect | Check firewall for 1139/1445, verify credentials |
| "Access Denied" | Confirm `SAMBA_USER` / `SAMBA_PASSWORD` match what you entered |
| Server not in Network | Ensure 3702/udp and 5357 are open for wsdd |
| DirectPrintClient won't start | Check logs — may need library updates on newer OS releases |

---

## Security

- **Change default passwords** (`CUPS_ADMIN_PASSWORD`, `SAMBA_PASSWORD`) before production use
- Restrict access to ports 631 and 8888 (admin interfaces) via firewall
- Consider a dedicated VLAN or VPN for remote admin
- Rebuild periodically for base image security updates: `docker compose build --pull --no-cache`

---

## Backup & Maintenance

```bash
# Backup printer config and data
tar -czvf print-server-backup-$(date +%Y%m%d).tar.gz data/ config/ docker-compose.yml

# Restore
tar -xzvf print-server-backup-YYYYMMDD.tar.gz
```

Docker log rotation is configured (10 MB × 3 files).

To update the base image:

```bash
docker compose build --pull --no-cache && docker compose up -d
```

---

## Links

- [Ventor Tech Direct Print](https://ventor.tech/)
- [CUPS Documentation](https://www.cups.org/documentation.html)
- [Samba Documentation](https://www.samba.org/samba/docs/)
- [wsdd](https://github.com/christgau/wsdd)

---

## License

This Docker configuration is provided as-is. DirectPrintClient is licensed by Ventor Tech.
