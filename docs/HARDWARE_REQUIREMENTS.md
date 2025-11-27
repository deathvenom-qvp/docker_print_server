# Hardware Requirements & Deployment Options

This guide covers VM sizing and hardware recommendations for deploying the Docker Print Server.

## Resource Overview

The print server runs the following services:
- **CUPS** - Print server
- **Samba** - SMB file/printer sharing
- **Avahi** - mDNS discovery (`.local` hostname)
- **wsdd** - Windows Service Discovery
- **nmbd** - NetBIOS name resolution
- **DirectPrintClient** - Odoo integration

These services are lightweight and mostly I/O bound, not CPU intensive.

---

## Virtual Machine Sizing

### Minimum (Small Office, < 10 users)
| Resource | Spec |
|----------|------|
| **vCPUs** | 1 |
| **RAM** | 1 GB |
| **Storage** | 10 GB SSD |

### Recommended (Medium Office, 10-50 users)
| Resource | Spec |
|----------|------|
| **vCPUs** | 2 |
| **RAM** | 2 GB |
| **Storage** | 20 GB SSD |

### Production (Large Deployment, 50+ users or high-volume printing)
| Resource | Spec |
|----------|------|
| **vCPUs** | 2-4 |
| **RAM** | 4 GB |
| **Storage** | 40 GB SSD |

### Cloud Provider Equivalents

| Provider | Minimum | Recommended | Est. Cost/Month |
|----------|---------|-------------|-----------------|
| **AWS** | t3.micro | t3.small | $8-15 |
| **Azure** | B1s | B2s | $8-17 |
| **GCP** | e2-micro | e2-small | $6-13 |
| **DigitalOcean** | Basic 1GB | Basic 2GB | $6-12 |
| **Linode** | Nanode 1GB | Linode 2GB | $5-12 |
| **Vultr** | Cloud 1GB | Cloud 2GB | $5-10 |

---

## Physical Hardware Options

### Raspberry Pi (Recommended for Small Deployments)

| Model | RAM | CPU | Suitability | Est. Cost |
|-------|-----|-----|-------------|-----------|
| **Raspberry Pi 5** | 4-8 GB | Quad-core 2.4GHz | ⭐ Excellent | $60-80 |
| **Raspberry Pi 4** | 2-8 GB | Quad-core 1.8GHz | ⭐ Excellent | $45-75 |
| **Raspberry Pi 3B+** | 1 GB | Quad-core 1.4GHz | ✅ Good | $35 |

**Notes:**
- Use a quality microSD card (32GB+ Class 10/A1) or USB SSD for better reliability
- Raspberry Pi OS (64-bit) or Ubuntu Server recommended
- Power supply: Use official 5V/3A adapter to avoid instability
- Consider a case with passive cooling for 24/7 operation

### Mini PCs / NUCs

| Type | Specs | Suitability | Est. Cost |
|------|-------|-------------|-----------|
| **Intel NUC** | i3/i5, 8GB RAM | ⭐ Excellent | $200-400 |
| **Beelink Mini PC** | N95/N100, 8GB RAM | ⭐ Excellent | $150-200 |
| **ASUS Mini PC** | Celeron, 4GB RAM | ✅ Good | $150-250 |
| **Minisforum** | Ryzen, 8-16GB RAM | ⭐ Overkill | $250-400 |

**Notes:**
- More powerful than Raspberry Pi, better for high-volume printing
- Built-in storage (SSD/eMMC) is more reliable than SD cards
- Usually includes multiple USB ports for direct printer connections
- Fanless models available for quiet operation

### Repurposed Hardware

Any x86_64 machine with:
- **Minimum**: 1GB RAM, dual-core CPU, 10GB storage
- **Recommended**: 2GB+ RAM, any modern CPU, SSD storage

Old laptops, desktops, or thin clients work great for this purpose.

---

## Architecture Considerations

### x86_64 (amd64) - Recommended
- Full compatibility with DirectPrintClient Ubuntu 22.04 binary
- Widest hardware support
- Best performance

### ARM64 (aarch64) - Raspberry Pi / ARM servers
- **Note**: DirectPrintClient may require a different binary
- Check Ventor Tech for ARM-compatible versions (Raspberry Pi build available)
- Update Dockerfile to use ARM-specific DirectPrintClient if deploying on ARM

---

## Storage Considerations

| Use Case | Recommended Storage |
|----------|---------------------|
| Light use (< 100 jobs/day) | 10 GB |
| Medium use (100-500 jobs/day) | 20 GB |
| Heavy use (500+ jobs/day) | 40+ GB |

**Tips:**
- Print spool files are temporary but can be large for graphics-heavy documents
- Enable log rotation to prevent disk fill-up
- Consider external storage for PDF output if using cups-pdf heavily

---

## Network Requirements

| Port | Service | Required |
|------|---------|----------|
| 631 | CUPS Web Interface | Yes |
| 139 | SMB (NetBIOS) | Yes |
| 445 | SMB | Yes |
| 5353/udp | mDNS (Avahi) | Optional |
| 3702/udp | WS-Discovery | Optional |
| 8888 | DirectPrintClient API | For Odoo |

**Bandwidth**: Minimal - print jobs are typically small. A 100Mbps connection is more than sufficient.

---

## Recommendation Summary

| Deployment Size | Best Option | Est. Cost |
|-----------------|-------------|-----------|
| Home / Small Office (1-5 users) | Raspberry Pi 4 (2GB) | $50 |
| Small Business (5-20 users) | Raspberry Pi 5 or Mini PC | $80-150 |
| Medium Business (20-50 users) | Mini PC or Cloud VM | $150-200 or $10/mo |
| Enterprise (50+ users) | Dedicated VM or Server | $15-30/mo |

**My Top Pick**: **Raspberry Pi 5 (4GB)** - Best balance of cost, power efficiency, and capability for most small-to-medium deployments. Runs 24/7 on ~5W of power.

