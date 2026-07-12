# Workstation Installation Guide

This guide details how to compile, install, and execute the FlientSec Go agent daemon on developer workstations.

---

## 1. Automated Installation (Shell Script)

A helper script is provided at `scripts/install.sh` that automates compilation, creates baseline configurations, registers a systemd unit, and launches the daemon.

Execute the script as root:
```bash
sudo ./scripts/install.sh
```

---

## 2. Manual Step-by-Step Installation

If you prefer to configure the agent path variables manually, follow these steps:

### Step A: Compile the Binary
Build the Go agent executable targeting Linux:
```bash
cd agent
GOOS=linux GOARCH=amd64 go build -o flientsec-agent cmd/agent/main.go
```

### Step B: Create Local Directory Layout
Create directories for policy configurations and logs:
```bash
sudo mkdir -p /etc/flientsec
sudo mkdir -p /var/log/flientsec
```

### Step C: Copy Configuration Baseline
Place the default agent configurations baseline file (see the [Configuration Guide](configuration.md) for custom parameter options):
```bash
sudo cp agent.yaml /etc/flientsec/agent.yaml
```

### Step D: Register the Daemon Systemd Unit
Create `/etc/systemd/system/flientsec-agent.service` with the following contents:
```ini
[Unit]
Description=FlientSec Workstation Security Telemetry Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/flientsec-agent -config /etc/flientsec/agent.yaml
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Reload and start the system daemon:
```bash
sudo systemctl daemon-reload
sudo systemctl enable flientsec-agent.service
sudo systemctl start flientsec-agent.service
```

### Step E: Inspect Local Telemetry Logs
Confirm the agent executes checks and schedules heartbeats:
```bash
journalctl -u flientsec-agent.service -f
```
For next steps, see [Deployment Guides](deployment.md) to launch the database portal.
