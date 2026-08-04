package policy

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
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


func TestSyncSuccessPromotesLKG(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "flientsec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	policyPath := filepath.Join(tmpDir, "policy.json")

	content := `{"schema_version": 1, "metadata": {"name": "LKG Policy"}, "rules": []}`
	h := sha256.New()
	h.Write([]byte(content))
	cHash := hex.EncodeToString(h.Sum(nil))

	payload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 1,
		"schema_version": 1,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T12:00:00Z"
	}`, content, cHash)

	_, valErr := ValidatePolicy([]byte(payload))
	if valErr != nil {
		t.Fatalf("expected payload validation to succeed, got: %v", valErr)
	}

	err = SaveLKG(policyPath, []byte(payload))
	if err != nil {
		t.Fatalf("expected SaveLKG to succeed, got: %v", err)
	}

	data, loadErr := LoadLKG(policyPath)
	if loadErr != nil {
		t.Fatalf("expected LoadLKG to succeed, got: %v", loadErr)
	}

	if data.Content != content {
		t.Errorf("expected loaded content to be %s, got: %s", content, data.Content)
	}
}

func TestSyncHashMismatchPreservesLKG(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "flientsec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	policyPath := filepath.Join(tmpDir, "policy.json")

	initialContent := `{"schema_version": 1, "metadata": {"name": "Initial"}, "rules": []}`
	initPayload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 1,
		"schema_version": 1,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T12:00:00Z"
	}`, initialContent, computeHash(initialContent))

	if err := SaveLKG(policyPath, []byte(initPayload)); err != nil {
		t.Fatalf("SaveLKG failed: %v", err)
	}

	badPayload := `{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 2,
		"schema_version": 1,
		"content": "modified rules",
		"content_hash": "badhash",
		"issued_at": "2026-08-04T13:00:00Z"
	}`

	_, valErr := ValidatePolicy([]byte(badPayload))
	if valErr == nil {
		t.Fatal("expected validation to fail due to hash mismatch")
	}

	data, err := LoadLKG(policyPath)
	if err != nil {
		t.Fatalf("LoadLKG failed: %v", err)
	}
	if data.Content != initialContent {
		t.Errorf("LKG was modified! Got %s", data.Content)
	}
}

func TestSyncMalformedSchemaV1PreservesLKG(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "flientsec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	policyPath := filepath.Join(tmpDir, "policy.json")

	initialContent := `{"schema_version": 1, "metadata": {"name": "Initial"}, "rules": []}`
	initPayload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 1,
		"schema_version": 1,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T12:00:00Z"
	}`, initialContent, computeHash(initialContent))

	_ = SaveLKG(policyPath, []byte(initPayload))

	malformedContent := `{"schema_version": 1, "rules": [{"id": ""}]}`
	malformedPayload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 2,
		"schema_version": 1,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T13:00:00Z"
	}`, malformedContent, computeHash(malformedContent))

	_, valErr := ValidatePolicy([]byte(malformedPayload))
	if valErr == nil {
		t.Fatal("expected validation to fail for malformed rules content")
	}

	data, _ := LoadLKG(policyPath)
	if data.Content != initialContent {
		t.Errorf("LKG was overwritten by invalid policy!")
	}
}

func TestSyncUnsupportedSchemaVersion(t *testing.T) {
	unsupportedContent := `{"schema_version": 2, "rules": []}`
	payload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test",
		"version_id": "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39",
		"version_number": 2,
		"schema_version": 2,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T13:00:00Z"
	}`, unsupportedContent, computeHash(unsupportedContent))

	_, valErr := ValidatePolicy([]byte(payload))
	if valErr == nil {
		t.Fatal("expected validation to fail for unsupported schema version 2")
	}
}

func TestAtomicRenameSuccess(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "flientsec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	policyPath := filepath.Join(tmpDir, "policy.json")

	payload := `{"policy_id": "1", "content": "{}", "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}`
	err = SaveLKG(policyPath, []byte(payload))
	if err != nil {
		t.Fatalf("expected save to succeed: %v", err)
	}

	fi, err := os.Stat(policyPath)
	if err != nil {
		t.Fatalf("failed to stat: %v", err)
	}

	mode := fi.Mode().Perm()
	if mode != 0600 {
		t.Errorf("expected permissions 0600, got: %v", mode)
	}
}

func TestLoadLKGReturnsProvenance(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "flientsec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	policyPath := filepath.Join(tmpDir, "policy.json")

	content := `{"schema_version": 1, "metadata": {"name": "Test"}, "rules": []}`
	versionID := "76dfd221-a3f1-4db5-9e32-23c2a1ad4f39"
	cHash := computeHash(content)

	payload := fmt.Sprintf(`{
		"policy_id": "8483bb78-75c1-4b14-8f74-cc797d39a3f9",
		"policy_name": "Test Policy",
		"version_id": %q,
		"version_number": 3,
		"schema_version": 1,
		"content": %q,
		"content_hash": %q,
		"issued_at": "2026-08-04T12:00:00Z"
	}`, versionID, content, cHash)

	if err := SaveLKG(policyPath, []byte(payload)); err != nil {
		t.Fatalf("expected SaveLKG to succeed, got: %v", err)
	}

	ap, err := LoadLKG(policyPath)
	if err != nil {
		t.Fatalf("expected LoadLKG to succeed, got: %v", err)
	}

	if ap.VersionID != versionID {
		t.Errorf("expected VersionID %q, got: %q", versionID, ap.VersionID)
	}

	if ap.ContentHash != cHash {
		t.Errorf("expected ContentHash %q, got: %q", cHash, ap.ContentHash)
	}

	if ap.Content != content {
		t.Errorf("expected Content %q, got: %q", content, ap.Content)
	}
}

func computeHash(data string) string {
	h := sha256.New()
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}
