#!/usr/bin/env bash

# Installation Script for FlientSec Workstation Compliance Agent
# Requires root privileges (sudo) to register systemd services.

set -e

# Target paths
BIN_DEST="/usr/local/bin/flientsec-agent"
CONF_DIR="/etc/flientsec"
CONF_DEST="${CONF_DIR}/agent.yaml"
SERVICE_DEST="/etc/systemd/system/flientsec-agent.service"

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script with sudo or as root."
  exit 1
fi

# Move to the workspace root directory
CDPATH="" cd -- "$(dirname -- "$0")/.."

echo "==========================================="
echo "Installing FlientSec Agent on Host Machine..."
echo "==========================================="

# 1. Build Go binary
echo "Step 1: Compiling Go Agent..."
if ! command -v go &> /dev/null; then
  echo "Error: Go compiler is not installed. Please install Go before running the installer."
  exit 1
fi

cd agent
go mod tidy
go build -o bin/flientsec-agent cmd/agent/main.go
cd ..

# 2. Copy binary to /usr/local/bin
echo "Step 2: Installing binary to ${BIN_DEST}..."
if systemctl is-active --quiet flientsec-agent; then
  echo "Stopping active flientsec-agent daemon..."
  systemctl stop flientsec-agent
fi
cp agent/bin/flientsec-agent "${BIN_DEST}"
chmod 755 "${BIN_DEST}"

# 3. Setup configuration folder and copy yaml
echo "Step 3: Creating configuration folder in ${CONF_DIR}..."
mkdir -p "${CONF_DIR}"

if [ ! -f "${CONF_DEST}" ]; then
  cp agent/agent.yaml "${CONF_DEST}"
  chmod 644 "${CONF_DEST}"
  # Update relative device_uuid path in /etc/flientsec/agent.yaml to be absolute
  sed -i 's|uuid_file_path: "device_uuid"|uuid_file_path: "/etc/flientsec/device_uuid"|g' "${CONF_DEST}"
else
  echo "Configuration file already exists, skipping copy to protect user changes."
fi

# 4. Create systemd unit service file
echo "Step 4: Writing systemd service descriptor to ${SERVICE_DEST}..."
cat <<EOF > "${SERVICE_DEST}"
[Unit]
Description=FlientSec Workstation Compliance Agent
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DEST} -config ${CONF_DEST}
Restart=on-failure
RestartSec=10
WorkingDirectory=${CONF_DIR}

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "${SERVICE_DEST}"

# 5. Reload and start systemd service
echo "Step 5: Starting FlientSec service via systemd..."
systemctl daemon-reload
systemctl enable --now flientsec-agent

echo "==========================================="
echo "FlientSec Agent installed and active!"
echo "Check daemon logs: journalctl -u flientsec-agent -f"
echo "==========================================="
