# How to Connect to Network Printers (Windows)

This guide will help you connect your Windows computer to the shared network printers.

---

## What You'll Need

- **Server Address:** `\\<SERVER-IP>` (your IT admin will provide this)
- **Username:** `printuser`
- **Password:** `printers` (or as provided by your IT admin)

---

## Method 1: Connect via File Explorer (Recommended)

This is the easiest method for most users.

### Step 1: Open File Explorer

Press **Windows + E** on your keyboard to open File Explorer.

### Step 2: Navigate to the Print Server

In the address bar at the top, type the server address and press **Enter**:

```
\\<SERVER-IP>
```

For example: `\\10.11.0.100`

![File Explorer Address Bar](https://i.imgur.com/placeholder.png)

### Step 3: Enter Credentials

When prompted for credentials:

1. Enter the username: `printuser`
2. Enter the password: `printers`
3. ✅ Check **"Remember my credentials"** (recommended)
4. Click **OK**

### Step 4: View Available Printers

You should now see a **printers** folder. Double-click to open it and view all available printers.

### Step 5: Connect to a Printer

1. **Right-click** on the printer you want to use
2. Select **"Connect"**
3. Wait for Windows to install the printer driver
4. The printer is now ready to use!

---

## Method 2: Connect via Windows Settings

### Step 1: Open Printer Settings

1. Press **Windows + I** to open Settings
2. Go to **Bluetooth & devices** → **Printers & scanners**
3. Click **"Add device"**

### Step 2: Add Printer Manually

1. Wait a few seconds for the scan to complete
2. Click **"Add manually"** (or "The printer that I want isn't listed")

### Step 3: Enter Printer Path

1. Select **"Select a shared printer by name"**
2. Enter the printer path:
   ```
   \\<SERVER-IP>\<PRINTER-NAME>
   ```
   For example: `\\10.11.0.100\Brother_TN229`
3. Click **Next**

### Step 4: Complete Setup

1. Enter credentials if prompted (`printuser` / `printers`)
2. Follow any remaining prompts to complete installation
3. Click **Finish**

---

## Method 3: Connect via IPP (Alternative)

Use this method if the SMB method above doesn't work.

### Step 1: Open Printer Settings

1. Press **Windows + I** to open Settings
2. Go to **Bluetooth & devices** → **Printers & scanners**
3. Click **"Add device"** → **"Add manually"**

### Step 2: Add IPP Printer

1. Select **"Select a shared printer by name"**
2. Enter the IPP URL:
   ```
   http://<SERVER-IP>:631/printers/<PRINTER-NAME>
   ```
   For example: `http://10.11.0.100:631/printers/Brother_TN229`
3. Click **Next** and follow the prompts

---

## How to Print

Once connected, the printer will appear in any application's print dialog:

1. Open the document you want to print
2. Press **Ctrl + P** (or File → Print)
3. Select the network printer from the list
4. Click **Print**

---

## Troubleshooting

### "Windows cannot connect to the printer"

- Verify the server IP address is correct
- Make sure you're on the same network as the print server
- Try Method 2 or Method 3 instead

### "Access Denied" or credentials not accepted

- Double-check the username: `printuser`
- Double-check the password: `printers`
- Make sure Caps Lock is off

### Printer not showing in the list

- Refresh the folder (press F5)
- Try typing the full printer path directly:
  ```
  \\<SERVER-IP>\<PRINTER-NAME>
  ```

### Print jobs stuck or not printing

1. Open **Control Panel** → **Devices and Printers**
2. Right-click the printer → **See what's printing**
3. Cancel any stuck jobs
4. Try printing again

### Need more help?

Contact your IT administrator with:
- The error message you're seeing
- The server IP address you're trying to connect to
- The printer name you're trying to use

---

## Finding Available Printers

### Option A: Browse the Server

Navigate to `\\<SERVER-IP>` in File Explorer and open the **printers** folder to see all available printers.

### Option B: Use the Web Interface

1. Open a web browser
2. Go to: `http://<SERVER-IP>:631/printers`
3. This shows all printers with their names and status

---

## Quick Reference

| Item | Value |
|------|-------|
| Server Address | `\\<SERVER-IP>` |
| Web Interface | `http://<SERVER-IP>:631` |
| Username | `printuser` |
| Password | `printers` |
| IPP URL Format | `http://<SERVER-IP>:631/printers/<PRINTER-NAME>` |

---

*Replace `<SERVER-IP>` with the actual IP address provided by your IT administrator.*

*Document Version: 1.0 | Last Updated: November 2024*

