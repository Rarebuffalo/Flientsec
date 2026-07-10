package checks

// Check represents an individual detector run on the host.
type Check interface {
	Name() string
	Run() (CheckResult, error)
}

// CheckResult represents the raw data collected by a check.
type CheckResult struct {
	Name    string                 `json:"name"`
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Error   string                 `json:"error,omitempty"`
}

// Registry stores all registered check creators.
var Registry = make(map[string]Check)

// Register registers a check with the registry.
func Register(check Check) {
	Registry[check.Name()] = check
}
