#!/bin/bash
# =============================================================================
# Docker Print Server - Test Script
# =============================================================================
# 
# This script tests that all services are running correctly after deployment.
# Run this from the host machine after starting the container.
#
# Usage:
#   ./scripts/test.sh [server_ip]
#
# If server_ip is not provided, defaults to localhost
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER_IP="${1:-localhost}"
PASSED=0
FAILED=0

echo "=============================================="
echo "Docker Print Server - Service Tests"
echo "=============================================="
echo "Server: $SERVER_IP"
echo ""

# Function to test a service
test_service() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    echo -n "Testing $name... "
    
    if curl -sf --connect-timeout 5 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to test a port
test_port() {
    local name="$1"
    local port="$2"
    
    echo -n "Testing $name (port $port)... "
    
    if nc -z -w 5 "$SERVER_IP" "$port" 2>/dev/null || \
       timeout 5 bash -c "echo > /dev/tcp/$SERVER_IP/$port" 2>/dev/null; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "--- HTTP Services ---"
test_service "CUPS Web Interface" "http://$SERVER_IP:631/"
test_service "DirectPrintClient" "http://$SERVER_IP:8888/"

echo ""
echo "--- Network Ports ---"
test_port "CUPS (IPP)" 631
test_port "DirectPrintClient" 8888
test_port "Samba NetBIOS" 139
test_port "Samba SMB" 445

echo ""
echo "--- Container Services ---"
echo -n "Testing container is running... "
if docker ps --format '{{.Names}}' | grep -q "print-server"; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test services inside container
echo -n "Testing CUPS daemon (cupsd)... "
if docker exec print-server pgrep cupsd > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

echo -n "Testing Samba daemon (smbd)... "
if docker exec print-server pgrep smbd > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

echo -n "Testing wsdd daemon... "
if docker exec print-server pgrep wsdd > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}WARN${NC} (wsdd may not be critical)"
fi

echo -n "Testing DirectPrintClient process... "
if docker exec print-server pgrep -f DirectPrintClient > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed. Check container logs:${NC}"
    echo "  docker compose logs -f"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi

