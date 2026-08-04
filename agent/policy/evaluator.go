package policy

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"flientsec-agent/checks"

	"gopkg.in/yaml.v3"
)

type Rule struct {
	ID          string      `yaml:"id" json:"id"`
	Check       string      `yaml:"check" json:"check"`
	Description string      `yaml:"description" json:"description"`
	Severity    string      `yaml:"severity" json:"severity"`
	Operator    string      `yaml:"operator" json:"operator"`
	Expected    interface{} `yaml:"expected" json:"expected"`
}

type SchemaV1Policy struct {
	SchemaVersion int `yaml:"schema_version" json:"schema_version"`
	Metadata      struct {
		Name        string `yaml:"name" json:"name"`
		Description string `yaml:"description" json:"description"`
	} `yaml:"metadata" json:"metadata"`
	Rules []Rule `yaml:"rules" json:"rules"`
}

// Retain Policy alias for API consumers
type Policy SchemaV1Policy

type Finding struct {
	RuleName string `json:"rule_name"` // rule.id (stable rule identity)
	Status   string `json:"status"`    // FAIL / WARN
	Message  string `json:"message"`   // rule.description
	Severity string `json:"severity"`
}

type CheckRunPayload struct {
	ID              string    `json:"id"`
	Status          string    `json:"status"` // PASS / FAIL / WARN
	Score           int       `json:"score"`
	Timestamp       string    `json:"timestamp"`
	Findings        []Finding `json:"findings"`
	PolicyVersionID string    `json:"policy_version_id,omitempty"`
	ContentHash     string    `json:"content_hash,omitempty"`
}

// Evaluate matches raw check results against the active YAML policy configuration conforming to Schema v1
func Evaluate(policyData []byte, checkResults map[string]checks.CheckResult, runID string) (CheckRunPayload, error) {
	var pol SchemaV1Policy
	// Load defaults if policyData is empty
	if len(policyData) == 0 {
		pol = getDefaultSchemaV1Policy()
	} else {
		err := yaml.Unmarshal(policyData, &pol)
		if err != nil {
			return CheckRunPayload{}, err
		}
		// Strict validations:
		// 1. Verify schema_version is exactly 1
		if pol.SchemaVersion != 1 {
			return CheckRunPayload{}, fmt.Errorf("unsupported schema version: %d", pol.SchemaVersion)
		}
		// 2. Validate malformed rules explicitly
		for _, rule := range pol.Rules {
			if rule.ID == "" {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: missing 'id'")
			}
			if rule.Check == "" {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: missing 'check' in rule %s", rule.ID)
			}
			if rule.Operator == "" {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: missing 'operator' in rule %s", rule.ID)
			}
			if rule.Description == "" {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: missing 'description' in rule %s", rule.ID)
			}
			if rule.Expected == nil {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: missing 'expected' in rule %s", rule.ID)
			}
			if rule.Operator != "equals" && rule.Operator != "semver_gte" {
				return CheckRunPayload{}, fmt.Errorf("malformed rule: unsupported operator '%s' in rule %s", rule.Operator, rule.ID)
			}
		}
	}

	findings := []Finding{}
	score := 100

	for _, rule := range pol.Rules {
		switch rule.Check {
		case "firewall.enabled":
			if res, ok := checkResults["firewall"]; ok && res.Success {
				active, _ := res.Data["active"].(bool)
				if rule.Operator == "equals" {
					expectedBool, okExp := rule.Expected.(bool)
					if !okExp {
						return CheckRunPayload{}, fmt.Errorf("rule %s expected value must be a boolean", rule.ID)
					}
					if active != expectedBool {
						findings = append(findings, Finding{
							RuleName: rule.ID,
							Status:   "FAIL",
							Message:  rule.Description,
							Severity: normalizeSeverity(rule.Severity),
						})
						score -= getPenalty(rule.Severity)
					}
				}
			}
		case "disk.root_encrypted":
			if res, ok := checkResults["encryption"]; ok && res.Success {
				status, _ := res.Data["status"].(string)
				isEncrypted := status == "Encrypted"
				if rule.Operator == "equals" {
					expectedBool, okExp := rule.Expected.(bool)
					if !okExp {
						return CheckRunPayload{}, fmt.Errorf("rule %s expected value must be a boolean", rule.ID)
					}
					if isEncrypted != expectedBool {
						findings = append(findings, Finding{
							RuleName: rule.ID,
							Status:   "FAIL",
							Message:  rule.Description,
							Severity: normalizeSeverity(rule.Severity),
						})
						score -= getPenalty(rule.Severity)
					}
				}
			}
		case "ssh.enabled", "ssh.active":
			if res, ok := checkResults["ssh"]; ok && res.Success {
				active, _ := res.Data["active"].(bool)
				if rule.Operator == "equals" {
					expectedBool, okExp := rule.Expected.(bool)
					if !okExp {
						return CheckRunPayload{}, fmt.Errorf("rule %s expected value must be a boolean", rule.ID)
					}
					if active != expectedBool {
						findings = append(findings, Finding{
							RuleName: rule.ID,
							Status:   "FAIL",
							Message:  rule.Description,
							Severity: normalizeSeverity(rule.Severity),
						})
						score -= getPenalty(rule.Severity)
					}
				}
			}
		case "updates.pending", "runtime.updates":
			if res, ok := checkResults["updates"]; ok && res.Success {
				pending, _ := res.Data["pending_count"].(int)
				if rule.Operator == "equals" {
					expectedInt, okInt := rule.Expected.(int)
					if !okInt {
						if expFloat, okFloat := rule.Expected.(float64); okFloat {
							expectedInt = int(expFloat)
							okInt = true
						}
					}
					if okInt {
						if pending > expectedInt {
							findings = append(findings, Finding{
								RuleName: rule.ID,
								Status:   "WARN",
								Message:  rule.Description,
								Severity: normalizeSeverity(rule.Severity),
							})
							score -= getPenalty(rule.Severity)
						}
					} else {
						expectedBool, okBool := rule.Expected.(bool)
						if okBool && !expectedBool && pending > 0 {
							findings = append(findings, Finding{
								RuleName: rule.ID,
								Status:   "WARN",
								Message:  rule.Description,
								Severity: normalizeSeverity(rule.Severity),
							})
							score -= getPenalty(rule.Severity)
						}
					}
				}
			}
		case "runtime.node.version":
			if res, ok := checkResults["runtime"]; ok && res.Success {
				versions, _ := res.Data["versions"].(map[string]interface{})
				if versions != nil {
					nodeVer, _ := versions["node"].(string)
					expectedStr, okExp := rule.Expected.(string)
					if !okExp {
						return CheckRunPayload{}, fmt.Errorf("rule %s expected value must be a string version", rule.ID)
					}
					if nodeVer == "not_installed" {
						findings = append(findings, Finding{
							RuleName: rule.ID,
							Status:   "FAIL",
							Message:  fmt.Sprintf("%s (Node.js is not installed)", rule.Description),
							Severity: normalizeSeverity(rule.Severity),
						})
						score -= getPenalty(rule.Severity)
					} else if nodeVer != "error" && nodeVer != "unknown" {
						if rule.Operator == "semver_gte" {
							if isVersionLess(nodeVer, expectedStr) {
								findings = append(findings, Finding{
									RuleName: rule.ID,
									Status:   "FAIL",
									Message:  fmt.Sprintf("%s (Current version %s is below required %s)", rule.Description, nodeVer, expectedStr),
									Severity: normalizeSeverity(rule.Severity),
								})
								score -= getPenalty(rule.Severity)
							}
						}
					}
				}
			}
		case "runtime.docker.version":
			if res, ok := checkResults["runtime"]; ok && res.Success {
				versions, _ := res.Data["versions"].(map[string]interface{})
				if versions != nil {
					dockerVer, _ := versions["docker"].(string)
					expectedStr, okExp := rule.Expected.(string)
					if !okExp {
						return CheckRunPayload{}, fmt.Errorf("rule %s expected value must be a string version", rule.ID)
					}
					if dockerVer == "not_installed" {
						findings = append(findings, Finding{
							RuleName: rule.ID,
							Status:   "FAIL",
							Message:  fmt.Sprintf("%s (Docker is not installed)", rule.Description),
							Severity: normalizeSeverity(rule.Severity),
						})
						score -= getPenalty(rule.Severity)
					} else if dockerVer != "error" && dockerVer != "unknown" {
						if rule.Operator == "semver_gte" {
							if isVersionLess(dockerVer, expectedStr) {
								findings = append(findings, Finding{
									RuleName: rule.ID,
									Status:   "FAIL",
									Message:  fmt.Sprintf("%s (Current version %s is below required %s)", rule.Description, dockerVer, expectedStr),
									Severity: normalizeSeverity(rule.Severity),
								})
								score -= getPenalty(rule.Severity)
							}
						}
					}
				}
			}
		}
	}

	if score < 0 {
		score = 0
	}

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
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	for i := 0; i < len(parts2); i++ {
		if i >= len(parts1) {
			return true
		}
		p1, err1 := strconv.Atoi(parts1[i])
		p2, err2 := strconv.Atoi(parts2[i])
		if err1 != nil || err2 != nil {
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

func getDefaultSchemaV1Policy() SchemaV1Policy {
	var pol SchemaV1Policy
	pol.SchemaVersion = 1
	pol.Metadata.Name = "Default Workstation Baseline"
	pol.Metadata.Description = "Default organization security rules for workstations"
	pol.Rules = []Rule{
		{
			ID:          "workstation.firewall.enabled",
			Check:       "firewall.enabled",
			Description: "System firewall is disabled. Turn on your firewall using 'sudo ufw enable', 'sudo systemctl start firewalld', or system preferences.",
			Severity:    "HIGH",
			Operator:    "equals",
			Expected:    true,
		},
		{
			ID:          "workstation.disk.encrypted",
			Check:       "disk.root_encrypted",
			Description: "Root filesystem is not encrypted. Secure boot and drive encryption (LUKS/dm-crypt) are required.",
			Severity:    "HIGH",
			Operator:    "equals",
			Expected:    true,
		},
		{
			ID:          "workstation.ssh.enabled",
			Check:       "ssh.enabled",
			Description: "SSH daemon is active. Disable it via 'sudo systemctl disable --now sshd' to minimize network attack surface.",
			Severity:    "MEDIUM",
			Operator:    "equals",
			Expected:    false,
		},
		{
			ID:          "workstation.updates.pending",
			Check:       "updates.pending",
			Description: "Your system has pending package updates. Run your package manager upgrade command.",
			Severity:    "MEDIUM",
			Operator:    "equals",
			Expected:    0,
		},
		{
			ID:          "runtime.node.minimum",
			Check:       "runtime.node.version",
			Description: "Node.js version is below organization minimum.",
			Severity:    "MEDIUM",
			Operator:    "semver_gte",
			Expected:    "22.0.0",
		},
		{
			ID:          "runtime.docker.minimum",
			Check:       "runtime.docker.version",
			Description: "Docker version is below organization minimum.",
			Severity:    "LOW",
			Operator:    "semver_gte",
			Expected:    "20.0.0",
		},
	}
	return pol
}
