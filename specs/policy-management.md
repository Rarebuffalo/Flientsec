# Product Specification: Policy Management Control Plane

This specification details policy configurations stored in the database, policy versions tracking, dynamic JSON evaluations, and device groups allocations.

---

## 1. Objectives

- **Centralized Control:** Define compliance parameters on the dashboard portal. Administrators do not edit YAML configuration files directly on workstations.
- **Audit Trails:** Record every policy modification, mapping the author and timestamp to allow rule rollbacks.
- **Dynamic Allocations:** Allocate policies to specific workstation groups (e.g. Interns vs. Core Devs).

---

## 2. Policy Lifecycle Journey

1.  **Creation:** Admin navigates to `/policies/new` and fills out the rule parameters.
2.  **Versioning:** Saving the policy creates a new index inside `policy_versions` containing the raw JSON configuration.
3.  **Assignment:** The policy is assigned to a device group (e.g. "Backend Engineering Group").
4.  **Telemetry Sync:** The agent queries `/api/v1/agent/policy` on startup. The API matches the workstation UUID to its group, parses the active policy JSON definition, converts it to YAML, and returns it to the agent.

---

## 3. Relational Table Schema Reference

### Table: `policies`
- `id` (INTEGER, Primary Key)
- `organization_id` (INTEGER, Foreign Key referencing `organizations.id`)
- `name` (VARCHAR)
- `description` (TEXT)
- `created_at` (TIMESTAMP)

### Table: `policy_versions`
- `id` (INTEGER, Primary Key)
- `policy_id` (INTEGER, Foreign Key referencing `policies.id`)
- `version_number` (INTEGER, Auto-Increment index counter)
- `definition_json` (TEXT, Serialized checker rules definitions)
- `created_by` (INTEGER, Foreign Key referencing `users.id`)
- `created_at` (TIMESTAMP)

---

## 4. Policy Rules Verification Abstraction

The administrator configures rules in a structured GUI editor. Under the hood, these rules map to a clean JSON schema format:

```json
{
  "checks": {
    "firewall": { "enabled": true, "severity": "high" },
    "disk_encryption": { "enabled": true, "severity": "high" },
    "updates": { "enabled": true, "max_delay_days": 7, "severity": "medium" }
  }
}
```

---

## 5. Security & Edge Cases
- **Policy Precedence:** If a device is members of multiple groups with conflicting policies, the policy with the highest version number or oldest creation timestamp takes precedence (to be defined in Settings).
- **Rollback Events:** Selecting version `v1` from the history updates the active policy reference index and triggers an immediate compliance sweep notification on connected workstations.
