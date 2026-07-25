# Product Specification: Findings & Compliance Operations

This specification defines the findings statuses, active warning states transitions, and copy-paste CLI remediation hooks.

---

## 1. Objectives

- **Operational Workflows:** Transition alerts through structured workflow statuses rather than displaying raw FAIL lists.
- **Audit Logging:** Record event timestamps mapping when a check failed and when it was resolved.
- **Frictionless Remediation:** Offer copy-paste terminal codes so developers can self-remediate compliance issues immediately.

---

## 2. Findings Status Transitions

```
               Check Detects Failure
             ┌───────────────────────┐
             │                       ▼
┌────────────┴────────────┐     Acknowledged     ┌─────────────────────────┐
│     New Compliance      │─────────────────────>│      Acknowledged       │
│     Finding (Open)      │                      │ (Suppresses Alerts 7d)  │
└────────────┬────────────┘                      └────────────┬────────────┘
             │                                                │
             │           Remediation Detected / Fix Verified  │
             └───────────────────────┬────────────────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │        Resolved         │
                        │      (Closed Log)       │
                        └─────────────────────────┘
```

---

## 3. Relational Table Schema Reference

### Table: `findings`
- `id` (INTEGER, Primary Key)
- `device_id` (INTEGER, Foreign Key referencing `devices.id`)
- `check_name` (VARCHAR, e.g. "firewall")
- `severity` (VARCHAR, must be one of `high`, `medium`, `low`)
- `status` (VARCHAR, must be one of `Open`, `Acknowledged`, `Resolved`)
- `reason` (TEXT, compliance failure details)
- `created_at` (TIMESTAMP)
- `resolved_at` (TIMESTAMP, nullable)

---

## 4. Operational Remediation Actions
When a check fails, the inspector panel displays:
1.  **Reason:** Clear explanation of the violation (e.g. "Firewall ruleset is disabled on Ubuntu laptop").
2.  **Why It Matters:** Security compliance details (e.g. "Unprotected ports expose internal services to local network scans").
3.  **Terminal Remediator:** Copyable CLI command:
    - For `firewall`: `sudo ufw enable` or `systemctl start firewalld`
    - For `disk_encryption`: Link to mounting guide
    - For `updates`: `sudo pacman -Syu` or `sudo apt update && sudo apt upgrade`
4.  **Verification Button:** Triggers an immediate client agent policy re-evaluation check-in.
