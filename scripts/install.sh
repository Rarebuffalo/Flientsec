#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# FlientSec Linux Workstation Security Agent Installer
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== FlientSec Agent Installer ===${NC}"

# 1. Verify root execution
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (or via sudo).${NC}"
   exit 1
fi

# 2. Parse command-line flags
SERVER_URL="http://localhost:8000"
ENROLLMENT_TOKEN=""
CONFIG_PATH="/etc/flientsec/agent.yaml"
BINARY_PATH="/usr/local/bin/flientsec-agent"
SERVICE_PATH="/etc/systemd/system/flientsec-agent.service"

while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    --token)
      ENROLLMENT_TOKEN="$2"
      shift 2
      ;;
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: sudo ./scripts/install.sh --token <ENROLLMENT_TOKEN> [--url <SERVER_URL>]"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

if [[ -z "$ENROLLMENT_TOKEN" && ! -f "$CONFIG_PATH" ]]; then
    echo -e "${RED}Error: --token <ENROLLMENT_TOKEN> is required for initial installation.${NC}"
    exit 1
fi

# 3. Create required directories with strict permissions
echo -e "${BLUE}[1/5] Creating runtime directories...${NC}"
mkdir -p /etc/flientsec
chmod 0700 /etc/flientsec

mkdir -p /var/lib/flientsec
chmod 0700 /var/lib/flientsec

# 4. Generate or update configuration
echo -e "${BLUE}[2/5] Configuring agent...${NC}"
if [[ ! -f "$CONFIG_PATH" || -n "$ENROLLMENT_TOKEN" ]]; then
    cat > "$CONFIG_PATH" <<EOF
server:
  url: "${SERVER_URL}"
  token: "${ENROLLMENT_TOKEN}"

interval: 60
heartbeat_interval: 30

uuid_file_path: "/var/lib/flientsec/device.uuid"
token_file_path: "/var/lib/flientsec/device.token"
policy_file_path: "/var/lib/flientsec/policy.json"

checks:
  firewall: true
  encryption: true
  ssh: true
  updates: true
  runtime: true
EOF
    chmod 0600 "$CONFIG_PATH"
    echo -e "${GREEN}Created ${CONFIG_PATH} with mode 0600${NC}"
fi

# 5. Build/Install Agent Binary
echo -e "${BLUE}[3/5] Installing agent binary...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

if command -v go &> /dev/null && [[ -d "${REPO_DIR}/agent" ]]; then
    echo "Building agent binary from source..."
    (cd "${REPO_DIR}/agent" && go build -o "${BINARY_PATH}" ./cmd/agent/main.go)
    chmod 0755 "${BINARY_PATH}"
elif [[ -f "${REPO_DIR}/bin/flientsec-agent" ]]; then
    cp "${REPO_DIR}/bin/flientsec-agent" "${BINARY_PATH}"
    chmod 0755 "${BINARY_PATH}"
else
    if [[ ! -f "${BINARY_PATH}" ]]; then
        echo -e "${RED}Error: Could not locate or build flientsec-agent binary.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}Installed binary to ${BINARY_PATH}${NC}"

# 6. Install systemd service unit
echo -e "${BLUE}[4/5] Installing systemd service...${NC}"
if [[ -f "${REPO_DIR}/packaging/systemd/flientsec-agent.service" ]]; then
    cp "${REPO_DIR}/packaging/systemd/flientsec-agent.service" "${SERVICE_PATH}"
else
    cat > "${SERVICE_PATH}" <<EOF
[Unit]
Description=FlientSec Workstation Security Daemon
Documentation=https://github.com/Rarebuffalo/Flientsec
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${BINARY_PATH} -config ${CONFIG_PATH}
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536
ProtectHome=read-only
PrivateTmp=yes
ProtectKernelModules=yes
ProtectKernelTunables=yes

[Install]
WantedBy=multi-user.target
EOF
fi
chmod 0644 "${SERVICE_PATH}"

# 7. Reload and start service
echo -e "${BLUE}[5/5] Starting FlientSec service...${NC}"
if command -v systemctl &> /dev/null; then
    systemctl daemon-reload
    systemctl enable flientsec-agent.service
    systemctl restart flientsec-agent.service
    echo -e "${GREEN}FlientSec agent service installed and started!${NC}"
    echo -e "Check status with: ${YELLOW}systemctl status flientsec-agent.service${NC}"
    echo -e "View logs with:   ${YELLOW}journalctl -u flientsec-agent.service -f${NC}"
else
    echo -e "${YELLOW}Warning: systemctl not detected. Service unit installed but not started automatically.${NC}"
fi

echo -e "${GREEN}=== Installation Complete ===${NC}"
