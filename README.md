# FlientSec

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](agent/go.mod)
[![Python Version](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](backend/requirements.txt)
[![Next.js Version](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](frontend/package.json)
[![Platform](https://img.shields.io/badge/Platform-Linux-FCC624?logo=linux)](docs/faq.md)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)](docker-compose.yml)

Continuous developer workstation security posture verification designed for modern engineering organizations. Verify configurations locally, enforce policy as code, and remain audit-ready without deploying intrusive MDM profiles.

---

## Table of Contents
- [Product Philosophy](#product-philosophy)
- [Directory Layout](#directory-layout)
- [Platform Architecture](#platform-architecture)
- [Key Features](#key-features)
- [Quick Start Guide](#quick-start-guide)
- [Configuration Baseline](#configuration-baseline)
- [Telemetry REST API](#telemetry-rest-api)
- [Contributing & Community](#contributing--community)
- [Vulnerability Disclosures](#vulnerability-disclosures)
- [Support Channels](#support-channels)
- [Project License](#project-license)

---

## Product Philosophy

Traditional Mobile Device Management (MDM) platforms were built for corporate lockouts, not modern developer workflows. They install intrusive root configuration profiles that block developer tools, slow down environments, and invade privacy by tracking browser histories and files.

FlientSec changes this workflow:
- **Linux Native:** Built from the ground up to support Linux distributions (Arch Linux, Ubuntu, Fedora, Debian) that are left unserved by standard enterprise IT.
- **Policy as Code:** Compliance requirements are defined as simple, git-controlled YAML templates synced to developer machines.
- **Privacy by Design:** Security baseline checks are parsed and calculated strictly local to the workstation. Telemetry reports only communicate compliance scores (PASS/WARN/FAIL)—your source code, keystrokes, and screen captures never leave your machine.

For more details, see the [Philosophy Guide](docs/philosophy.md).

---

## Directory Layout

```
flientsec/
├── .github/                     # GitHub templates and workflows
│   ├── workflows/               # CI/CD pipeline automation
│   └── ISSUE_TEMPLATE/          # Issue reporting descriptors
├── agent/                       # Go agent daemon source
│   ├── cmd/
│   │   └── agent/               # Agent main entrypoint
│   ├── checks/                  # Local system compliance monitors
│   ├── policy/                  # YAML baseline evaluation engine
│   ├── client/                  # Backend REST connection client
│   └── queue/                   # Thread-safe telemetry buffering queue
├── assets/                      # Visual branding assets
│   ├── logo/                    # Scalable vector SVG logos
│   └── screenshots/             # Mockup and console screenshots
├── backend/                     # FastAPI backend database service source
│   ├── app/
│   │   ├── api/                 # Telemetry API endpoints
│   │   ├── core/                # SQL connection pool configurations
│   │   ├── models/              # SQLAlchemy model definitions
│   │   └── schemas/             # Pydantic schema validation structures
│   └── requirements.txt         # Python service requirements
├── docs/                        # Complete product guides
│   ├── images/                  # Document graphics and diagrams
│   ├── architecture.md          # Visual check pipelines
│   ├── installation.md          # Multi-platform install steps
│   ├── configuration.md         # agent.yaml variable references
│   ├── policy-language.md       # YAML baseline checks schema
│   ├── api.md                   # REST telemetry protocols
│   ├── cli.md                   # Agent doctor and verification commands
│   ├── philosophy.md            # Why FlientSec is built for developers
│   ├── design-system.md         # Typography, color, and spacing guidelines
│   ├── deployment.md            # Docker compose portals setup
│   ├── security.md              # TLS, auth headers, and certificates specs
│   ├── privacy.md               # Data minimization guidelines
│   └── faq.md                   # Common questions & answers
├── examples/                    # Sample configurations
│   ├── basic-policy.yaml        # Basic firewall + encryption rules
│   ├── strict-policy.yaml       # Strict compiler, update, and port rules
│   ├── ubuntu-example.yaml      # Baseline configuration for Ubuntu
│   └── docker-compose.override.yml # Postgres persistence volumes mount
├── scripts/                     # Automated setup scripts
│   ├── build.sh                 # Go compile helper script
│   └── install.sh               # Systemd installer script
├── AGENTS.md                    # Coding rules for AI developer assistants
├── CONTRIBUTING.md              # Guidelines for code contributors
├── CODE_OF_CONDUCT.md           # Community behavior guidelines
├── SECURITY.md                  # Security vulnerability disclosures rules
├── LICENSE                      # Project license text (Apache 2.0)
├── CHANGELOG.md                 # Project release changes log
├── ROADMAP.md                   # Product roadmap timeline
├── docker-compose.yml           # Local dev compose setup
├── .env.example                 # Baseline environment configuration
└── .gitignore                   # Exclude list rules
```

---

## Platform Architecture

FlientSec uses a symmetric evaluation model. Telemetry checks are computed on the client workstation rather than central servers:

```
Developer Workstation             Secure REST API (HTTPS)          Cloud Dashboard
 ┌─────────────────┐             ┌─────────────────────┐          ┌──────────────┐
 │                 │             │                     │          │              │
 │  ┌───────────┐  │             │   Post telemetry    │          │  Postgres    │
 │  │  Go Agent │──┼────────────>│   ➔ /checkin        │─────────>│  Telemetry   │
 │  └─────┬─────┘  │             │                     │          │  Database    │
 │        │        │             └─────────────────────┘          └──────┬───────┘
 │  Evaluates local│                                                     │
 │  YAML Policy    │                                                     ▼
 └─────────────────┘                                              Next.js Portal
```

1. Go Agent Daemon: Schedules background tickers (30s heartbeat, 60s compliance run) and executes local script monitoring queries (disk encryption, firewall parameters, packages).
2. Local Evaluator: Passes execution metrics to the local policy sync engine, calculates compliant status codes, and stores records inside a thread-safe memory queue if the backend link drops.
3. FastAPI REST Telemetry API: Securely authenticates agent headers and stores state checks inside the relational schema (connected hosts, check runs, violation events history).
4. Next.js Dashboard: Queries findings logs and displays real-time compliance rings, host specs, and copy-paste remediation commands.

Refer to the [Architecture Specification](docs/architecture.md) for more details.

---

## Key Features

- **Continuous Assessment:** Background daemon scheduled to run firewall rules, encryption mounts, and update packages checks.
- **Policy as Code:** Git-controlled YAML baseline rulesets mapping server constraints to developer machines.
- **Audit-Ready Evidence Logs:** Telemetry check-ins recorded as timestamped events database entries. Exporters download current status to a CSV.
- **Workstation Cache Queue:** In-memory queue buffering check-in reports during network outages, flushing to the server once the connection is restored.
- **Privacy Assurance:** Zero user surveillance, keyboard logging, or source code indexing. Only configuration metadata is monitored.

---

## Quick Start Guide

This guide details how to compile, launch, and test FlientSec locally.

### Step 1: Launch the Local Infrastructure
From the repository root, start PostgreSQL, the FastAPI API daemon, and the Next.js frontend using Docker Compose:
```bash
cp .env.example .env
docker compose up --build -d
```
Verify the services are online:
- API Server: `http://localhost:8000/api/v1/health` (returns `{"status": "ok"}`)
- Dashboard Console: `http://localhost:3000` (sign in with `admin@flientsec.local` / `flientsec_admin_pass`)

### Step 2: Install the Go Agent
Execute the setup script as root to compile the agent, copy default rules to `/etc/flientsec/agent.yaml`, and register a systemd unit:
```bash
sudo ./scripts/install.sh
```
Check that the agent service starts successfully and starts logging handshake events:
```bash
journalctl -u flientsec-agent.service -f
```

### Step 3: Trigger Policy Violation (Drift Detection)
1. Go to `http://localhost:3000` to verify your local computer is registered as **Online** and **Compliant** (Score: 100).
2. Intentionally disable your local firewall setting to trigger a violation:
   ```bash
   sudo ufw disable
   ```
3. Observe the systemd service logs. Within 60 seconds, the agent executes local checks, detects that the firewall is inactive, recalculates the compliance score to **60**, sets status to **FAIL**, and posts telemetry to the backend.
4. Refresh the dashboard console: your device status flips to **FAIL** with a score of **60**. Click "View Details" to see the active finding and the copy-paste remediation snippet.

### Step 4: Remediate the Violation
1. Copy and execute the remediation command on your system:
   ```bash
   sudo ufw enable
   ```
2. On the next check-in tick, the agent detects the active firewall, resolves findings, updates score to **100**, and sets status back to **PASS**.
3. Verify the browser dashboard flips back to **Green (PASS)**.
4. Check the "Historical Audit Trails" list at the bottom of the device page: it will display the transitions logged automatically:
   - `Violation triggered: Firewall policy failed.`
   - `Violation resolved: Firewall policy is now compliant.`

For extended step-by-step guidance, refer to the [Installation Documentation](docs/installation.md).

---

## Configuration Baseline

The Go agent is configured via a YAML file located at `/etc/flientsec/agent.yaml`. Refer to the [Configuration Guide](docs/configuration.md) for custom parameters:

```yaml
# Server endpoint configuration
server_url: "http://localhost:8000/api/v1"

# Registration credentials token (provided during onboarding)
enrollment_token: "flientsec_enroll_token_hash"

# Ticker interval timing (in seconds)
heartbeat_interval: 30
check_interval: 60

# Telemetry logging limits
log_file: "/var/log/flientsec/agent.log"
log_level: "info"
```

---

## Telemetry REST API

FlientSec agents post telemetry payloads encrypted over HTTPS.

### Device Registration (`POST /api/v1/agent/register`)
**Request:**
```json
{
  "uuid": "430af3a0-7b56-4c92-bd88-0248a901ffba",
  "hostname": "ubuntu-laptop-02",
  "os_distribution": "ubuntu",
  "kernel_version": "5.15.0-generic",
  "architecture": "x86_64"
}
```

### Device Compliance Checkin (`POST /api/v1/agent/checkin`)
**Request:**
```json
{
  "score": 85,
  "status": "WARN",
  "findings": [
    {
      "check_name": "updates",
      "severity": "medium",
      "status": "failed",
      "description": "21 pending package upgrades detect on package manager registers."
    }
  ]
}
```

Refer to the [API Specification](docs/api.md) for endpoints, request/response headers, and error codes.

---

## Contributing & Community

We welcome contributions to FlientSec! Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

To propose enhancement check definitions:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feat/add-nftables-checks`).
3. Commit your changes (`git commit -am 'feat: add nftables checking module'`).
4. Push to the branch (`git push origin feat/add-nftables-checks`).
5. Create a new Pull Request.

---

## Vulnerability Disclosures

If you discover a security vulnerability, please do not report it publicly via GitHub issues. Instead, report it privately to our security team. Refer to [SECURITY.md](SECURITY.md) for disclosure details.

- **Contact Email:** `info.krishnasingh.codes@gmail.com`

---

## Support Channels

- **Bug Reports & Issues:** Submit detailed bugs using our [Issue Templates](.github/ISSUE_TEMPLATE/bug_report.md).
- **Discussions:** Share custom policies, ask setup questions, and discuss features on [GitHub Discussions](https://github.com/Rarebuffalo/Flientsec/discussions).

---

## Project License

FlientSec is licensed under the Apache License, Version 2.0. Refer to [LICENSE](LICENSE) for details.
