# FlientSec

FlientSec is a lightweight developer workstation security posture platform that continuously verifies engineering laptops against organizational security policies, producing compliance records and dashboard insights without requiring administrative enterprise MDM (Mobile Device Management) overhead.

The system is architected as a monorepo consisting of:
1. A Go-based agent running as a local background daemon.
2. A FastAPI backend telemetry store backed by PostgreSQL.
3. A Next.js fleet dashboard for real-time compliance oversight.

---

## Architecture Design

```
             +----------------------------+
             |         Go Agent           |
             |  (Runs checks locally)     |
             +-------------+--------------+
                           |
                           |  CheckRun Payload (Findings & Score)
                           v
             +----------------------------+
             |      FastAPI Backend       | <--- Runs in Docker
             |   (Validates and Stores)   |
             +-------------+--------------+
                           |
                           |  SQL Schema
                           v
             +----------------------------+
             |      PostgreSQL Database   | <--- Runs in Docker
             |   (Hosts historical runs)  |
             +----------------------------+
```

### Separation of Concerns
FlientSec employs a client-first design philosophy. Instead of processing telemetry and evaluating business logic on the backend, the Go Agent performs all policy checks and evaluation locally on the developer workstation. The backend acts primarily as a telemetry repository. This reduces computational load on central servers and keeps sensitive configuration audits client-side.

---

## Directory Structure

```
flientsec/
├── docker-compose.yml       # Local database, API, and UI orchestration
├── agent/                   # Go Agent Source
│   ├── cmd/
│   │   └── agent/           # Agent daemon main entrypoint
│   ├── checks/              # Subprocess & file-level system monitors
│   ├── policy/              # Local YAML policy engine and score evaluator
│   ├── client/              # Go REST client wrapping check-in APIs
│   └── queue/               # Thread-safe local cache for server outages
├── backend/                 # FastAPI Backend Source
│   ├── app/
│   │   ├── api/             # Endpoint routing
│   │   ├── core/            # Configuration and SQLAlchemy setups
│   │   └── models/          # PostgreSQL database mappings
│   └── requirements.txt     # Python dependency definition
├── frontend/                # Next.js Marketing & Dashboard Source
│   ├── app/                 # Next.js App Router Structure
│   │   ├── (admin)/         # Route group for admin dashboard views
│   │   │   ├── dashboard/   # Fleet table overview (/dashboard)
│   │   │   ├── devices/     # Device details panel (/devices/[id])
│   │   │   ├── policies/    # Policy YAML editor (/policies)
│   │   │   └── layout.tsx   # Dashboard-specific navigation header and footer
│   │   ├── page.tsx         # Premium marketing landing page homepage (/)
│   │   └── layout.tsx       # Blank base layout shell
│   └── tailwind.config.js   # Tailwind configurations
├── shared/                  # Common specifications and policies
└── scripts/                 # Compilation and install helpers
```

---

## Telemetry Checks Specification

The agent includes several independent check routines under `agent/checks/`, executing them concurrently:
1. **Firewall Check (`firewall.go`):** Queries active rules. Leverages an abstract driver configuration that checks UFW (`ufw status`), firewalld (`firewall-cmd --state`), nftables (`nft list ruleset`), and iptables (`iptables -S`) in order of system availability.
2. **Encryption Check (`encryption.go`):** Distro-agnostic check validating whether the root partition (`/`) is mounted on a cryptographically mapped block device (using `lsblk` queries or checking `/proc/mounts`).
3. **OS Updates Check (`updates.go`):** Identifies pending software upgrades using package manager simulation flags (e.g., `checkupdates` for pacman, `apt-get -s upgrade` for apt, or `dnf check-update` for dnf).
4. **SSH Check (`ssh.go`):** Verifies the daemon status of the OpenSSH unit (`sshd` or `ssh`) and checks for active local bindings on TCP port 22.
5. **Runtime Check (`runtime.go`):** Loops over an extensible registry of programming toolchains (Node.js, Python, Go, Java, Docker, Git), executing version flags and extracting semantic version strings.

---

## Policy Evaluation & Score System

Workstation checks are compared locally against a YAML policy template (`policy.yaml`):

```yaml
checks:
  firewall:
    enabled: true
    required: true
    severity: high
  encryption:
    enabled: true
    required: true
    severity: high
  ssh:
    enabled: true
    required: false
    severity: medium
  updates:
    enabled: true
    required: true
    severity: medium
  node:
    enabled: true
    required: true
    minimum: "22.0.0"
    severity: medium
```

### Score Formulation
Each check starts with a base score of 100. Failed required rules subtract score points depending on their designated severity setting:
- **HIGH Severity:** Deducts 40 points
- **MEDIUM Severity:** Deducts 20 points
- **LOW Severity:** Deducts 10 points

The computed score is clamped between 0 and 100.
The workstation is categorized as:
- **FAIL:** If any HIGH severity check fails or the overall score falls below 70.
- **WARN:** If any MEDIUM/LOW checks fail but the overall score remains at or above 70.
- **PASS:** If all evaluated rules conform to organization standards.

---

## API Documentation

### Public Routes
- `GET /api/v1/health`: Checks API status.
- `GET /api/v1/version`: Returns active schema version targets.
- `POST /api/v1/auth/login`: Handles login verification, returning a JWT token.

### Go Agent Tunnels
- `POST /api/v1/agent/register`: Registers workstation baseline attributes on initial boot.
  - Body:
    ```json
    {
      "id": "UUID",
      "hostname": "string",
      "os_name": "string",
      "os_version": "string",
      "os_arch": "string",
      "kernel_version": "string",
      "agent_version": "string"
    }
    ```
- `POST /api/v1/agent/checkin?device_id=UUID`: Transmits local findings runs.
  - Body:
    ```json
    {
      "id": "UUID (run_id)",
      "status": "PASS / FAIL / WARN",
      "score": 100,
      "timestamp": "ISO-8601 DateTime",
      "findings": [
        {
          "rule_name": "firewall",
          "status": "FAIL",
          "message": "Detailed error string",
          "severity": "HIGH"
        }
      ]
    }
    ```
- `POST /api/v1/agent/heartbeat?device_id=UUID`: Ping endpoint validating device network link states.

### Dashboard Console
- `GET /api/v1/devices`: Lists active devices (Requires JWT header).
- `GET /api/v1/devices/{id}`: Detailed specifications of a device (Requires JWT header).
- `GET /api/v1/devices/{id}/latest-run`: Fetches active findings from the most recent run (Requires JWT header).
- `GET /api/v1/devices/{id}/history`: Returns check-in status log (Requires JWT header).
- `GET /api/v1/policies`: Fetches active policy rules.
- `POST /api/v1/policies`: Sets active policy rules (Requires JWT header).
- `GET /api/v1/reports/export`: Downloads fleet compliance state in CSV format.

---

## Execution Guide

### 1. Re-organize & Spin Up Local Telemetry Stack
To support the route transitions and install the required Framer Motion library, clean up redundant folders and rebuild the Docker orchestration:

```bash
# Clean up redundant old root files (devices/ and policies/)
python .gemini/antigravity-ide/brain/980c0d41-5331-4ffb-ac6b-4db0e4e5ef50/scratch/cleanup.py

# Rebuild and start the frontend and backend containers
docker compose up --build -d
```

### 2. Accessing the Platforms
- **Marketing Landing Page:** Accessible at `http://localhost:3000`. Demonstrates the interactive hero dashboard card, marketing positioning, and architecture maps.
- **Admin Fleet Dashboard:** Accessible at `http://localhost:3000/dashboard` (or by clicking "Sign In" / "See Live Demo" on the landing page).
  - **Email:** `admin@flientsec.local`
  - **Password:** `flientsec_admin_pass`

### 3. Go Agent Daemon Installation
To compile and register the Go agent client daemon locally on your developer workstation:
```bash
sudo ./scripts/install.sh
```
This builds the binary, registers `/etc/flientsec/agent.yaml` configs, mounts a systemd system service unit (`flientsec-agent.service`), and runs the check-in background daemon.

To inspect active check-in logging loops:
```bash
journalctl -u flientsec-agent.service -f
```

To run the agent in the foreground for local diagnostics:
```bash
./agent/bin/flientsec-agent -config ./agent/agent.yaml
```
