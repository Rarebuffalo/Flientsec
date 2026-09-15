# Platform Architecture Overview

FlientSec implements a distributed symmetric workstation posture evaluation model. Unlike heavyweight MDMs that execute configurations centrally, FlientSec schedules and evaluates security baseline constraints locally on the developer machine.

---

## 1. Flow of Compliance Telemetry

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

1.  **Go Agent Daemon:** Schedules background tickers (30s heartbeat, 60s compliance run) and executes local script monitoring queries (disk encryption, firewall parameters, packages).
2.  **Local Evaluator:** Passes execution metrics to the local policy sync engine, calculates compliant status codes, and stores records inside a thread-safe memory queue if the backend link drops.
3.  **FastAPI REST Telemetry API:** Securely authenticates agent headers and stores state checks inside the relational schema (connected hosts, check runs, violation events history).
4.  **Next.js Dashboard:** Queries findings logs and displays real-time compliance rings, host specs, and copy-paste remediation commands.

---

## 2. Deterministic 3-Tier Policy Precedence Architecture

Workstations in an organization resolve their active security policy through a deterministic, 3-tier precedence hierarchy:

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Direct Device Override                        │
│  (PolicyAssignment with explicit device_id)            │
└──────────────────────────┬─────────────────────────────┘
                           │ Fallback if None
                           ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Device Group Policy                           │
│  (DeviceGroup.policy_id via device.group_id)           │
└──────────────────────────┬─────────────────────────────┘
                           │ Fallback if None
                           ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Organization Default Policy                   │
│  (PolicyAssignment with organization_id, device_id=NULL)
└────────────────────────────────────────────────────────┘
```

1. **Direct Device Policy Override:** Highest priority. Explicitly targets a specific critical workstation for bespoke compliance rules.
2. **Device Group Policy:** Targets functional cohorts (e.g. Engineering, Finance, PCI DSS workstations). When assigned, all group members receive this policy unless an individual override is active.
3. **Organization Default Policy:** Safe baseline fallback for all enrolled workstations in the tenant.

---

## 3. Component Layout Mapping
- **Local Ticker Checker:** Evaluates disk mappings (LSBLK), system updates, and firewall logs.
- **Client Cache Queue:** Telemetry check-ins buffer in a thread-safe queue during network failures, flushing to the server once the connection is restored. See the [Configuration Guide](configuration.md) for retry setups.
- **Secure Transport Boundary:** Authentication tokens signature certificate validation. See the [Security Specs](security.md) for transport security details.
- **Device Groups & Governance:** Multi-user team administration and group-based policy assignment.
- **Asymmetric Baseline Policy:** Rules mapped as git-controlled configurations. See [Policy Language](policy-language.md) for details.
