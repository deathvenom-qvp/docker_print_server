# How to Connect to Network Printers

Follow these simple steps to connect your Windows computer to the office printers.

---

## Step 1: Open File Explorer

Press **Windows + E** on your keyboard.

---

## Step 2: Go to the Print Server

In the address bar at the top, type:

```
\\print-server
```

Then press **Enter**.

> **💡 Tip:** If `\\print-server` doesn't find the server, try `\\print-server.local` instead.

---

## Step 3: Enter Your Credentials

When prompted:

| Field | Enter |
|-------|-------|
| Username | `printuser` |
| Password | `printers` |

✅ Check **"Remember my credentials"** so you don't have to enter this again.

Click **OK**.

---

## Step 4: Connect to a Printer

1. Double-click the **printers** folder
2. Find the printer you need
3. **Right-click** on it
4. Click **"Connect"**

Wait a few seconds for Windows to set up the printer. Done!

---

## Step 5: Print!

The printer is now ready. In any application:

1. Press **Ctrl + P**
2. Select the printer from the list
3. Click **Print**

---

## Having Problems?

| Problem | Solution |
|---------|----------|
| "Cannot find server" | Try `\\print-server.local` or use the IP address: `\\10.11.0.XXX` (ask IT) |
| "Access denied" | Double-check username (`printuser`) and password (`printers`) |
| Printer not working | Right-click printer → "See what's printing" → Cancel stuck jobs |

**Still stuck?** Contact IT support.

---

*Print Server: `\\print-server` • Username: `printuser` • Password: `printers`*

