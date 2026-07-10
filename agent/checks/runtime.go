package checks

import (
	"os/exec"
	"regexp"
)

type runtimeCheck struct{}

type RuntimeDefinition struct {
	Name         string
	Binary       string
	VersionArgs  []string
	RegexPattern string
}

func init() {
	Register(&runtimeCheck{})
}

func (r *runtimeCheck) Name() string {
	return "runtime"
}

func (r *runtimeCheck) Run() (CheckResult, error) {
	result := CheckResult{
		Name:    r.Name(),
		Success: true,
		Data:    make(map[string]interface{}),
	}

	definitions := []RuntimeDefinition{
		{
			Name:         "node",
			Binary:       "node",
			VersionArgs:  []string{"--version"},
			RegexPattern: `v?(\d+\.\d+\.\d+)`,
		},
		{
			Name:         "python",
			Binary:       "python3",
			VersionArgs:  []string{"--version"},
			RegexPattern: `Python\s+(\d+\.\d+\.\d+)`,
		},
		{
			Name:         "go",
			Binary:       "go",
			VersionArgs:  []string{"version"},
			RegexPattern: `go(\d+\.\d+\.\d+)`,
		},
		{
			Name:         "java",
			Binary:       "java",
			VersionArgs:  []string{"-version"},
			RegexPattern: `version\s+"?(\d+\.\d+\.\d+)[^"]*"?`,
		},
		{
			Name:         "docker",
			Binary:       "docker",
			VersionArgs:  []string{"--version"},
			RegexPattern: `version\s+(\d+\.\d+\.\d+)`,
		},
		{
			Name:         "git",
			Binary:       "git",
			VersionArgs:  []string{"--version"},
			RegexPattern: `git\s+version\s+(\d+\.\d+\.\d+)`,
		},
	}

	versions := make(map[string]string)

	for _, def := range definitions {
		if _, err := exec.LookPath(def.Binary); err == nil {
			cmd := exec.Command(def.Binary, def.VersionArgs...)
			output, err := cmd.CombinedOutput()
			if err == nil {
				re := regexp.MustCompile(def.RegexPattern)
				match := re.FindStringSubmatch(string(output))
				if len(match) >= 2 {
					versions[def.Name] = match[1]
				} else {
					versions[def.Name] = "unknown"
				}
			} else {
				versions[def.Name] = "error"
			}
		} else {
			versions[def.Name] = "not_installed"
		}
	}

	result.Data["versions"] = versions
	return result, nil
}
