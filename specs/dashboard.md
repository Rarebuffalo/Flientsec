# Product Specification: Dashboard & Admin Panel Layouts

This specification defines the frontend admin portal navigation, workspace dashboard view, active panels, settings, and navigation boundaries.

---

## 1. Objectives

- **Consistent Navigation:** Establish clear sidebars mapping Organization settings, Device lists, Policies, and Findings.
- **Actionable Home Workspace:** The core workspace page displays active compliance status rings, recent compliance failures, and registered device counts.
- **Enterprise Settings Hierarchy:** Dedicated configuration blocks for API keys, user memberships invitations, and Danger Zones.

---

## 2. Navigation Architecture

```
┌────────────────────────────────────────────────────────┐
│  Acme Corp (Switch Org Dropdown)          User profile │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Sidebar Navigation]        [Main Administrative Canvas]│
│                                                        │
│   - Workspace Overview         Total Workstations: 142 │
│   - Device Inventory           Overall Score: 94%      │
│   - Compliance Policies                                │
│   - Operations & Findings      ┌─────────────────────┐ │
│   - Workspace Settings         │ Active Violations   │ │
│     • Members                  │ - 3 Firewall Open   │ │
│     • API Keys & Tokens        │ - 1 Encryption FAIL │ │
│     • Integrations             └─────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Key Administrative Views Specification

### A. Workspace Overview (Organization Homepage)
- **Top Row:** Metrics summary (Total Workstations, Overall Compliance %, Active Alerts count, Online count).
- **Middle Section:** Multi-series line chart tracking organization-wide compliance trends over the last 30 days.
- **Bottom Section:** Latest compliance audit timeline logs (e.g. "Hostname laptop-01 registered with token", "Firewall ruleset updated").

### B. Device Detail Inspector
- **Device Meta:** Hostname, OS description, active UUID, IP details, and registration timestamps.
- **Compliance Status Panel:** Displays active check outcomes (PASS/FAIL) with severity tags.
- **Interactive Remediator Card:** Displays CLI snippets for open findings. Includes a "Request Recalculation" ping trigger.

### C. Workspace Settings Panel
- **General Settings:** Organization name and workspaces configurations.
- **Member Directory:** Teammates email registry list, active roles (`Owner`, `Admin`, `Viewer`), and "Invite Teammate" forms.
- **API Keys & Enrollment Tokens:** Interface to generate/revoke enrollment keys and register background services tokens.
- **Danger Zone:** Organization deletion and system decommissioning triggers.
