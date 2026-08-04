package policy

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type AgentPolicyResponse struct {
	PolicyID      string    `json:"policy_id"`
	PolicyName    string    `json:"policy_name"`
	VersionID     string    `json:"version_id"`
	VersionNumber int       `json:"version_number"`
	SchemaVersion int       `json:"schema_version"`
	Content       string    `json:"content"`
	ContentHash   string    `json:"content_hash"`
	IssuedAt      time.Time `json:"issued_at"`
}

// ValidatePolicy checks:
// 1. That the payload unmarshals correctly to AgentPolicyResponse
// 2. That the SHA-256 of response.Content matches the authoritative content_hash
// 3. That the schema_version is supported (must be 1)
// 4. That the Schema v1 rules themselves parse/validate successfully
func ValidatePolicy(payload []byte) (*AgentPolicyResponse, error) {
	var resp AgentPolicyResponse
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, fmt.Errorf("response contract validation failed: %w", err)
	}

	// Clean hash prefixes (e.g. "sha256:")
	cleanHash := strings.TrimPrefix(resp.ContentHash, "sha256:")


	// Compute SHA-256 of resp.Content exact bytes
	h := sha256.New()
	h.Write([]byte(resp.Content))
	computedHash := hex.EncodeToString(h.Sum(nil))

	if computedHash != cleanHash {
		return nil, fmt.Errorf("SHA-256 verification failed: computed %s, expected %s", computedHash, cleanHash)
	}

	if resp.SchemaVersion != 1 {
		return nil, fmt.Errorf("unsupported schema version: %d", resp.SchemaVersion)
	}

	// Verify Schema v1 syntax rules
	var pol SchemaV1Policy
	if err := yaml.Unmarshal([]byte(resp.Content), &pol); err != nil {
		return nil, fmt.Errorf("Schema v1 parsing failed: %w", err)
	}

	if pol.SchemaVersion != 1 {
		return nil, fmt.Errorf("rules schema version mismatch: %d", pol.SchemaVersion)
	}

	for _, rule := range pol.Rules {
		if rule.ID == "" {
			return nil, fmt.Errorf("malformed rule: missing 'id'")
		}
		if rule.Check == "" {
			return nil, fmt.Errorf("malformed rule: missing 'check' in rule %s", rule.ID)
		}
		if rule.Operator == "" {
			return nil, fmt.Errorf("malformed rule: missing 'operator' in rule %s", rule.ID)
		}
		if rule.Description == "" {
			return nil, fmt.Errorf("malformed rule: missing 'description' in rule %s", rule.ID)
		}
		if rule.Expected == nil {
			return nil, fmt.Errorf("malformed rule: missing 'expected' in rule %s", rule.ID)
		}
		if rule.Operator != "equals" && rule.Operator != "semver_gte" {
			return nil, fmt.Errorf("malformed rule: unsupported operator '%s' in rule %s", rule.Operator, rule.ID)
		}
	}

	return &resp, nil
}

// SaveLKG writes validated JSON payload to the LKG cache atomically
func SaveLKG(filePath string, payload []byte) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	tmpFile, err := os.CreateTemp(dir, "policy.tmp.*")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpName := tmpFile.Name()
	defer func() {
		// Clean up the temp file if rename was not executed
		if _, err := os.Stat(tmpName); err == nil {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmpFile.Write(payload); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to write to temp file: %w", err)
	}

	if err := tmpFile.Chmod(0600); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to chmod temp file: %w", err)
	}

	if err := tmpFile.Sync(); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to fsync temp file: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	if err := os.Rename(tmpName, filePath); err != nil {
		return fmt.Errorf("failed to rename temp file to %s: %w", filePath, err)
	}

	return nil
}

// LoadLKG reads the stored JSON from LKG cache and returns the complete AgentPolicyResponse object
func LoadLKG(filePath string) (*AgentPolicyResponse, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var resp AgentPolicyResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse cached LKG policy: %w", err)
	}

	return &resp, nil
}
