# =============================================================================
# Docker Print Server - Test Script (PowerShell)
# =============================================================================
# 
# This script tests that all services are running correctly after deployment.
# Run this from the host machine after starting the container.
#
# Usage:
#   .\scripts\test.ps1 [-ServerIP "192.168.1.100"]
#
# If ServerIP is not provided, defaults to localhost
#
# =============================================================================

param(
    [string]$ServerIP = "localhost"
)

$Passed = 0
$Failed = 0

Write-Host "=============================================="
Write-Host "Docker Print Server - Service Tests"
Write-Host "=============================================="
Write-Host "Server: $ServerIP"
Write-Host ""

function Test-HttpService {
    param(
        [string]$Name,
        [string]$Url
    )
    
    Write-Host -NoNewline "Testing $Name... "
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "PASS" -ForegroundColor Green
        $script:Passed++
        return $true
    }
    catch {
        Write-Host "FAIL" -ForegroundColor Red
        $script:Failed++
        return $false
    }
}

function Test-TcpPort {
    param(
        [string]$Name,
        [int]$Port
    )
    
    Write-Host -NoNewline "Testing $Name (port $Port)... "
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $result = $tcpClient.BeginConnect($ServerIP, $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(5000, $false)
        $tcpClient.Close()
        
        if ($success) {
            Write-Host "PASS" -ForegroundColor Green
            $script:Passed++
            return $true
        }
        else {
            Write-Host "FAIL" -ForegroundColor Red
            $script:Failed++
            return $false
        }
    }
    catch {
        Write-Host "FAIL" -ForegroundColor Red
        $script:Failed++
        return $false
    }
}

Write-Host "--- HTTP Services ---"
Test-HttpService -Name "CUPS Web Interface" -Url "http://${ServerIP}:631/"
Test-HttpService -Name "DirectPrintClient" -Url "http://${ServerIP}:8888/"

Write-Host ""
Write-Host "--- Network Ports ---"
Test-TcpPort -Name "CUPS (IPP)" -Port 631
Test-TcpPort -Name "DirectPrintClient" -Port 8888
Test-TcpPort -Name "Samba NetBIOS" -Port 139
Test-TcpPort -Name "Samba SMB" -Port 445

Write-Host ""
Write-Host "--- Container Services ---"
Write-Host -NoNewline "Testing container is running... "
$containerRunning = docker ps --format '{{.Names}}' | Select-String -Pattern "print-server"
if ($containerRunning) {
    Write-Host "PASS" -ForegroundColor Green
    $Passed++
}
else {
    Write-Host "FAIL" -ForegroundColor Red
    $Failed++
}

Write-Host -NoNewline "Testing CUPS daemon (cupsd)... "
$cupsRunning = docker exec print-server pgrep cupsd 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $Passed++
}
else {
    Write-Host "FAIL" -ForegroundColor Red
    $Failed++
}

Write-Host -NoNewline "Testing Samba daemon (smbd)... "
$smbdRunning = docker exec print-server pgrep smbd 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $Passed++
}
else {
    Write-Host "FAIL" -ForegroundColor Red
    $Failed++
}

Write-Host -NoNewline "Testing DirectPrintClient process... "
$dpcRunning = docker exec print-server pgrep -f DirectPrintClient 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $Passed++
}
else {
    Write-Host "FAIL" -ForegroundColor Red
    $Failed++
}

Write-Host ""
Write-Host "=============================================="
Write-Host "Results: $Passed passed, $Failed failed"
Write-Host "=============================================="

if ($Failed -gt 0) {
    Write-Host "Some tests failed. Check container logs:" -ForegroundColor Red
    Write-Host "  docker compose logs -f"
    exit 1
}
else {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}

