#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# FlientSec Linux Workstation Security Agent Uninstaller
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== FlientSec Agent Uninstaller ===${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (or via sudo).${NC}"
   exit 1
fi

echo -e "${BLUE}Stopping and disabling service...${NC}"
if command -v systemctl &> /dev/null; then
    systemctl stop flientsec-agent.service || true
    systemctl disable flientsec-agent.service || true
fi

echo -e "${BLUE}Removing systemd service unit...${NC}"
rm -f /etc/systemd/system/flientsec-agent.service
if command -v systemctl &> /dev/null; then
    systemctl daemon-reload
fi

echo -e "${BLUE}Removing agent binary...${NC}"
rm -f /usr/local/bin/flientsec-agent

echo -e "${BLUE}Preserving local state directory (/var/lib/flientsec) and config (/etc/flientsec)${NC}"
echo -e "To completely purge state, run: rm -rf /etc/flientsec /var/lib/flientsec"

echo -e "${GREEN}=== Uninstallation Complete ===${NC}"
