# FlientSec Workstation Policy Schema v1

This document specifies the schema contract for FlientSec developer workstation policies. Both the FastAPI Python backend and the Go security agent must validate and conform to this contract.

## 1. Structure Specifications

A policy definition must be represented in valid YAML or JSON conforming to the following fields:

| Field Path | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `schema_version` | integer | Yes | Must be exactly `1` for this version of the contract. |
| `metadata` | object | Yes | Metadata containing policy identification details. |
| `metadata.name` | string | Yes | Human-readable name of the policy (e.g. `Engineering Baseline`). |
| `metadata.description` | string | No | High-level description of what the policy covers. |
| `rules` | array | Yes | A list of rules that the workstation must satisfy. |

### Rule Fields

Each element in the `rules` array must satisfy the following fields:

| Field Path | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Stable, unique identifier of the rule (e.g. `workstation.firewall.enabled`). Used as finding identity. |
| `check` | string | Yes | The name of the underlying evaluator check (e.g. `firewall.enabled`). |
| `description` | string | Yes | A clear explanation of what is required (used directly as finding detail). |
| `severity` | string | Yes | Allowed values: `low`, `medium`, `high`. |
| `operator` | string | Yes | Verification check operator. Allowed values: `equals`, `semver_gte`. |
| `expected` | any | Yes | The expected compliant value to check against. |

---

## 2. Example Configuration

Below is a valid example baseline configuration:

```yaml
schema_version: 1

metadata:
  name: Engineering Baseline
  description: Baseline security configuration for engineering workstations

rules:
  - id: workstation.firewall.enabled
    check: firewall.enabled
    description: Host firewall must be enabled
    severity: high
    operator: equals
    expected: true

  - id: workstation.disk.encrypted
    check: disk.root_encrypted
    description: Device root volume must be encrypted using LUKS
    severity: high
    operator: equals
    expected: true

  - id: runtime.node.minimum
    check: runtime.node.version
    description: Node.js version must satisfy security minimum of v22.0.0
    severity: medium
    operator: semver_gte
    expected: "22.0.0"
```

---

## 3. Strict Validation Rules
* **Version Check:** Any configuration where `schema_version` is not equal to `1` must be strictly rejected.
* **Fields Presence:** Rules missing required fields (such as `id`, `check`, `description`, `severity`, `operator`, `expected`) must throw validation errors.
* **Immutability:** Once a policy version has been saved as `PUBLISHED`, the rules cannot be altered or modified in any way.
