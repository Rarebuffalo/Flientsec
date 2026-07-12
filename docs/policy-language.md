# Policy Language Specification

FlientSec uses Git-controlled YAML baseline rulesets to verify workstation state. The configuration baseline is parsed and computed locally by the agent daemon.

---

## 1. Syntax Specification

Here is a complete schema configuration showcasing all available check directives:

```yaml
checks:
  # Verify local system firewall rulesets are active (UFW, firewalld, nftables)
  firewall:
    enabled: true
    severity: high

  # Verify the root volume mount points crypt mapper paths
  disk_encryption:
    enabled: true
    severity: high

  # Verify pending upgrades count does not exceed max age delay
  updates:
    enabled: true
    max_delay_days: 7
    severity: medium

  # Verify SSH port configurations restrict socket exposures
  ssh:
    enabled: true
    max_port: 22
    severity: low

  # Validate development toolchain compilers SemVer registers
  runtime:
    enabled: true
    severity: medium
    compilers:
      - name: "go"
        min_version: "1.21.0"
      - name: "node"
        min_version: "18.0.0"
```

---

## 2. Severity Scoring Rules

When a check fails, the local evaluator deducts points from a base score of **100** depending on the severity weight:

| Severity Level | Point Deduction | Compliance Flag |
| -------------- | --------------- | --------------- |
| `high`         | -40             | FAIL            |
| `medium`       | -20             | WARN            |
| `low`          | -10             | WARN            |

### Scoring Output Status:
- **PASS:** Score equals `100`.
- **WARN:** Score is between `60` and `99`.
- **FAIL:** Score is below `60`.
