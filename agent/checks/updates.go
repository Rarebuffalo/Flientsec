package checks

import (
	"bytes"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

type updatesCheck struct{}

func init() {
	Register(&updatesCheck{})
}

func (u *updatesCheck) Name() string {
	return "updates"
}

func (u *updatesCheck) Run() (CheckResult, error) {
	result := CheckResult{
		Name:    u.Name(),
		Success: true,
		Data:    make(map[string]interface{}),
	}

	pendingCount, securityCount, manager := checkSystemUpdates()
	result.Data["pending_count"] = pendingCount
	result.Data["security_count"] = securityCount
	result.Data["manager"] = manager

	return result, nil
}

func checkSystemUpdates() (int, int, string) {
	// 1. Pacman (Arch Linux)
	if _, err := exec.LookPath("checkupdates"); err == nil {
		cmd := exec.Command("checkupdates")
		var out bytes.Buffer
		cmd.Stdout = &out
		if err := cmd.Run(); err == nil {
			lines := strings.Split(strings.TrimSpace(out.String()), "\n")
			count := 0
			for _, line := range lines {
				if line != "" {
					count++
				}
			}
			return count, 0, "pacman"
		}
	} else if _, err := exec.LookPath("pacman"); err == nil {
		// Fallback to local check
		cmd := exec.Command("pacman", "-Qu")
		var out bytes.Buffer
		cmd.Stdout = &out
		_ = cmd.Run() // pacman -Qu returns non-zero when there are no updates or on network issues
		lines := strings.Split(strings.TrimSpace(out.String()), "\n")
		count := 0
		for _, l := range lines {
			if l != "" {
				count++
			}
		}
		return count, 0, "pacman"
	}

	// 2. Apt (Debian / Ubuntu)
	if _, err := exec.LookPath("apt-get"); err == nil {
		cmd := exec.Command("apt-get", "-s", "upgrade")
		var out bytes.Buffer
		cmd.Stdout = &out
		if cmd.Run() == nil {
			// Find string like "5 upgraded, 0 newly installed"
			re := regexp.MustCompile(`(\d+)\s+upgraded,\s+(\d+)\s+newly\s+installed`)
			matches := re.FindStringSubmatch(out.String())
			if len(matches) >= 2 {
				upgraded, _ := strconv.Atoi(matches[1])
				return upgraded, 0, "apt"
			}
		}
	}

	// 3. Dnf (Fedora / RedHat)
	if _, err := exec.LookPath("dnf"); err == nil {
		cmd := exec.Command("dnf", "check-update", "-q")
		var out bytes.Buffer
		cmd.Stdout = &out
		_ = cmd.Run() // dnf check-update returns 100 if updates are available
		lines := strings.Split(strings.TrimSpace(out.String()), "\n")
		count := 0
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "Last metadata expiration") {
				count++
			}
		}
		return count, 0, "dnf"
	}

	return 0, 0, "unknown"
}
