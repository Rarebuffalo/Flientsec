package policy

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"flientsec-agent/checks"

	"gopkg.in/yaml.v3"
)

type Policy struct {
	Checks struct {
		Firewall struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Severity string `yaml:"severity"`
		} `yaml:"firewall"`
		Encryption struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Severity string `yaml:"severity"`
		} `yaml:"encryption"`
		SSH struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Severity string `yaml:"severity"`
		} `yaml:"ssh"`
		Updates struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Severity string `yaml:"severity"`
		} `yaml:"updates"`
		Node struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Minimum  string `yaml:"minimum"`
			Severity string `yaml:"severity"`
		} `yaml:"node"`
		Docker struct {
			Enabled  bool   `yaml:"enabled"`
			Required bool   `yaml:"required"`
			Minimum  string `yaml:"minimum"`
			Severity string `yaml:"severity"`
		} `yaml:"docker"`
	} `yaml:"checks"`
}

type Finding struct {
	RuleName string `json:"rule_name"`
	Status   string `json:"status"` // FAIL / WARN
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

type CheckRunPayload struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"` // PASS / FAIL / WARN
	Score     int       `json:"score"`
	Timestamp string    `json:"timestamp"`
	Findings  []Finding `json:"findings"`
}

// Evaluate matches raw check results against the active YAML policy configuration
func Evaluate(policyData []byte, checkResults map[string]checks.CheckResult, runID string) (CheckRunPayload, error) {
	var pol Policy
	// Load defaults if policyData is empty
	if len(policyData) == 0 {
		pol = getDefaultPolicy()
	} else {
		err := yaml.Unmarshal(policyData, &pol)
		if err != nil {
			return CheckRunPayload{}, err
		}
	}

	findings := []Finding{}
	score := 100

	// 1. Evaluate Firewall
	if pol.Checks.Firewall.Enabled {
		if res, ok := checkResults["firewall"]; ok && res.Success {
			active, _ := res.Data["active"].(bool)
			if pol.Checks.Firewall.Required && !active {
				findings = append(findings, Finding{
					RuleName: "firewall",
					Status:   "FAIL",
					Message:  "System firewall is disabled. Turn on your firewall using 'sudo ufw enable', 'sudo systemctl start firewalld', or system preferences.",
					Severity: normalizeSeverity(pol.Checks.Firewall.Severity),
				})
				score -= getPenalty(pol.Checks.Firewall.Severity)
			}
		}
	}

	// 2. Evaluate Encryption
	if pol.Checks.Encryption.Enabled {
		if res, ok := checkResults["encryption"]; ok && res.Success {
			status, _ := res.Data["status"].(string)
			if pol.Checks.Encryption.Required && status != "Encrypted" {
				findings = append(findings, Finding{
					RuleName: "encryption",
					Status:   "FAIL",
					Message:  "Root filesystem is not encrypted. Secure boot and drive encryption (LUKS/dm-crypt) are required.",
					Severity: normalizeSeverity(pol.Checks.Encryption.Severity),
				})
				score -= getPenalty(pol.Checks.Encryption.Severity)
			}
		}
	}

	// 3. Evaluate SSH
	if pol.Checks.SSH.Enabled {
		if res, ok := checkResults["ssh"]; ok && res.Success {
			active, _ := res.Data["active"].(bool)
			// Required = true means SSH daemon must be active.
			// Required = false means SSH daemon must be inactive/disabled (hardening).
			if pol.Checks.SSH.Required && !active {
				findings = append(findings, Finding{
					RuleName: "ssh",
					Status:   "FAIL",
					Message:  "SSH daemon is disabled but organization rules require it to be active.",
					Severity: normalizeSeverity(pol.Checks.SSH.Severity),
				})
				score -= getPenalty(pol.Checks.SSH.Severity)
			} else if !pol.Checks.SSH.Required && active {
				findings = append(findings, Finding{
					RuleName: "ssh",
					Status:   "FAIL",
					Message:  "SSH daemon is active. Disable it via 'sudo systemctl disable --now sshd' to minimize network attack surface.",
					Severity: normalizeSeverity(pol.Checks.SSH.Severity),
				})
				score -= getPenalty(pol.Checks.SSH.Severity)
			}
		}
	}

	// 4. Evaluate Updates
	if pol.Checks.Updates.Enabled {
		if res, ok := checkResults["updates"]; ok && res.Success {
			pending, _ := res.Data["pending_count"].(int)
			// If there are pending updates, trigger a finding
			if pol.Checks.Updates.Required && pending > 0 {
				findings = append(findings, Finding{
					RuleName: "updates",
					Status:   "WARN",
					Message:  fmt.Sprintf("Your system has %d pending package updates. Run your package manager upgrade command.", pending),
					Severity: normalizeSeverity(pol.Checks.Updates.Severity),
				})
				score -= getPenalty(pol.Checks.Updates.Severity)
			}
		}
	}

	// 5. Evaluate Runtimes (Node & Docker)
	if res, ok := checkResults["runtime"]; ok && res.Success {
		versions, _ := res.Data["versions"].(map[string]interface{})
		if versions != nil {
			// Evaluate Node
			if pol.Checks.Node.Enabled {
				nodeVer, _ := versions["node"].(string)
				if nodeVer == "not_installed" {
					if pol.Checks.Node.Required {
						findings = append(findings, Finding{
							RuleName: "node",
							Status:   "FAIL",
							Message:  fmt.Sprintf("Node.js is not installed. Node.js >= %s is required.", pol.Checks.Node.Minimum),
							Severity: normalizeSeverity(pol.Checks.Node.Severity),
						})
						score -= getPenalty(pol.Checks.Node.Severity)
					}
				} else if nodeVer == "error" || nodeVer == "unknown" {
					// skip or warn
				} else {
					if isVersionLess(nodeVer, pol.Checks.Node.Minimum) {
						findings = append(findings, Finding{
							RuleName: "node",
							Status:   "FAIL",
							Message:  fmt.Sprintf("Node.js version %s is below organization minimum of %s. Run 'nvm use %s' or upgrade.", nodeVer, pol.Checks.Node.Minimum, strings.Split(pol.Checks.Node.Minimum, ".")[0]),
							Severity: normalizeSeverity(pol.Checks.Node.Severity),
						})
						score -= getPenalty(pol.Checks.Node.Severity)
					}
				}
			}

			// Evaluate Docker
			if pol.Checks.Docker.Enabled {
				dockerVer, _ := versions["docker"].(string)
				if dockerVer == "not_installed" {
					if pol.Checks.Docker.Required {
						findings = append(findings, Finding{
							RuleName: "docker",
							Status:   "FAIL",
							Message:  fmt.Sprintf("Docker is not installed. Docker >= %s is required.", pol.Checks.Docker.Minimum),
							Severity: normalizeSeverity(pol.Checks.Docker.Severity),
						})
						score -= getPenalty(pol.Checks.Docker.Severity)
					}
				} else if dockerVer == "error" || dockerVer == "unknown" {
					// skip
				} else {
					if isVersionLess(dockerVer, pol.Checks.Docker.Minimum) {
						findings = append(findings, Finding{
							RuleName: "docker",
							Status:   "FAIL",
							Message:  fmt.Sprintf("Docker version %s is below organization minimum of %s.", dockerVer, pol.Checks.Docker.Minimum),
							Severity: normalizeSeverity(pol.Checks.Docker.Severity),
						})
						score -= getPenalty(pol.Checks.Docker.Severity)
					}
				}
			}
		}
	}

	// Clamp score between 0 and 100
	if score < 0 {
		score = 0
	}

	// Calculate overall state status
	status := "PASS"
	hasFail := false
	hasWarn := false
	for _, f := range findings {
		if f.Status == "FAIL" {
			hasFail = true
		} else if f.Status == "WARN" {
			hasWarn = true
		}
	}

	if hasFail || score < 70 {
		status = "FAIL"
	} else if hasWarn {
		status = "WARN"
	}

	return CheckRunPayload{
		ID:        runID,
		Status:    status,
		Score:     score,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Findings:  findings,
	}, nil
}

func getPenalty(severity string) int {
	switch strings.ToUpper(severity) {
	case "HIGH":
		return 40
	case "MEDIUM":
		return 20
	case "LOW":
		return 10
	default:
		return 10
	}
}

func normalizeSeverity(severity string) string {
	s := strings.ToUpper(severity)
	if s == "HIGH" || s == "MEDIUM" || s == "LOW" {
		return s
	}
	return "MEDIUM"
}

func isVersionLess(v1, v2 string) bool {
	// Simple semver comparison helper: splits by . and compares parts as integers
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	for i := 0; i < len(parts2); i++ {
		if i >= len(parts1) {
			return true // parts1 has fewer levels, like "22" vs "22.0.0"
		}
		p1, err1 := strconv.Atoi(parts1[i])
		p2, err2 := strconv.Atoi(parts2[i])
		if err1 != nil || err2 != nil {
			// String comparison fallback
			if parts1[i] != parts2[i] {
				return parts1[i] < parts2[i]
			}
			continue
		}
		if p1 < p2 {
			return true
		} else if p1 > p2 {
			return false
		}
	}
	return false
}

func getDefaultPolicy() Policy {
	p := Policy{}
	p.Checks.Firewall.Enabled = true
	p.Checks.Firewall.Required = true
	p.Checks.Firewall.Severity = "HIGH"

	p.Checks.Encryption.Enabled = true
	p.Checks.Encryption.Required = true
	p.Checks.Encryption.Severity = "HIGH"

	p.Checks.SSH.Enabled = true
	p.Checks.SSH.Required = false
	p.Checks.SSH.Severity = "MEDIUM"

	p.Checks.Updates.Enabled = true
	p.Checks.Updates.Required = true
	p.Checks.Updates.Severity = "MEDIUM"

	p.Checks.Node.Enabled = true
	p.Checks.Node.Required = true
	p.Checks.Node.Minimum = "22.0.0"
	p.Checks.Node.Severity = "MEDIUM"

	p.Checks.Docker.Enabled = true
	p.Checks.Docker.Required = false
	p.Checks.Docker.Minimum = "20.0.0"
	p.Checks.Docker.Severity = "LOW"
	return p
}
