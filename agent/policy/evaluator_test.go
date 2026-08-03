package policy

import (
	"testing"

	"flientsec-agent/checks"
)

func TestParseValidSchemaV1(t *testing.T) {
	yamlData := []byte(`
schema_version: 1
metadata:
  name: "Engineering Baseline"
  description: "Test baseline"
rules:
  - id: "workstation.firewall.enabled"
    check: "firewall.enabled"
    description: "Host firewall must be enabled"
    severity: "high"
    operator: "equals"
    expected: true
`)

	checkResults := map[string]checks.CheckResult{
		"firewall": {
			Success: true,
			Data: map[string]interface{}{
				"active": true,
			},
		},
	}

	payload, err := Evaluate(yamlData, checkResults, "test-run-123")
	if err != nil {
		t.Fatalf("Expected no error parsing valid Schema v1, got: %v", err)
	}

	if payload.Status != "PASS" {
		t.Errorf("Expected status PASS, got: %s", payload.Status)
	}

	if len(payload.Findings) != 0 {
		t.Errorf("Expected 0 findings, got: %d", len(payload.Findings))
	}
}

func TestParseUnsupportedSchemaVersion(t *testing.T) {
	yamlData := []byte(`
schema_version: 2
metadata:
  name: "Future Baseline"
rules: []
`)

	checkResults := map[string]checks.CheckResult{}

	_, err := Evaluate(yamlData, checkResults, "test-run-123")
	if err == nil {
		t.Fatal("Expected error for unsupported schema_version 2, got nil")
	}

	expectedErr := "unsupported schema version: 2"
	if err.Error() != expectedErr {
		t.Errorf("Expected error message '%s', got: '%v'", expectedErr, err)
	}
}

func TestParseMalformedRules(t *testing.T) {
	// Missing "expected" field
	yamlData := []byte(`
schema_version: 1
metadata:
  name: "Malformed Baseline"
rules:
  - id: "workstation.firewall.enabled"
    check: "firewall.enabled"
    description: "Missing expected value"
    severity: "high"
    operator: "equals"
`)

	checkResults := map[string]checks.CheckResult{}

	_, err := Evaluate(yamlData, checkResults, "test-run-123")
	if err == nil {
		t.Fatal("Expected error for malformed rule missing expected field, got nil")
	}

	if !tContains(err.Error(), "missing 'expected'") {
		t.Errorf("Expected error to mention 'missing expected', got: '%v'", err)
	}
}

func tContains(str, substr string) bool {
	return len(str) >= len(substr) && (str == substr || stringsContains(str, substr))
}

func stringsContains(str, substr string) bool {
	for i := 0; i+len(substr) <= len(str); i++ {
		if str[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
