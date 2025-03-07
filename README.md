# DirectPrintServer

This setup packages DirectPrintClient with CUPS, Nginx (reverse proxy for secure CUPS access), and Samba (for Windows network printer discovery).

## Setup

1. Place your DirectPrintClient binary into `DirectPrintClient/`.
2. Run:
    ```
    docker-compose up -d
    ```

## Services

- **DirectPrintClient**: Available at `http://localhost:8080`
- **CUPS Admin (proxied)**: `http://localhost:8631`
- **Samba Printers**: Accessible on Windows at `\\<host-ip>\printers`

## Security Notes

- Change `adminpassword` in `docker-compose.yml`
- Change Samba `printuser`/`printpassword` as desired

## Logs

Volumes store persistent data and logs.
