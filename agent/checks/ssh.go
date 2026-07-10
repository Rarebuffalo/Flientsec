package checks

import (
	"bytes"
	"net"
	"os/exec"
	"strings"
)

type sshCheck struct{}

func init() {
	Register(&sshCheck{})
}

func (s *sshCheck) Name() string {
	return "ssh"
}

func (s *sshCheck) Run() (CheckResult, error) {
	result := CheckResult{
		Name:    s.Name(),
		Success: true,
		Data:    make(map[string]interface{}),
	}

	active := false
	details := "inactive"

	// Method 1: systemctl is-active check (Distro standard for systemd)
	systemctlPath, err := exec.LookPath("systemctl")
	if err == nil {
		// Try sshd (Arch/Fedora)
		cmd := exec.Command(systemctlPath, "is-active", "sshd")
		var out bytes.Buffer
		cmd.Stdout = &out
		_ = cmd.Run()
		status := strings.TrimSpace(out.String())

		if status == "active" {
			active = true
			details = "sshd service is running"
		} else {
			// Try ssh (Ubuntu/Debian)
			cmd = exec.Command(systemctlPath, "is-active", "ssh")
			out.Reset()
			cmd.Stdout = &out
			_ = cmd.Run()
			status = strings.TrimSpace(out.String())
			if status == "active" {
				active = true
				details = "ssh service is running"
			}
		}
	}

	// Method 2: Network port listener check fallback (Check if port 22 is open locally)
	if !active {
		listener, err := net.Listen("tcp", "127.0.0.1:22")
		if err != nil {
			// If we cannot bind to local port 22 because it's already in use, sshd/ssh is likely active
			active = true
			details = "port 22 is bound (listening)"
		} else {
			// Successfully bound to 22, meaning no local service was listening on it
			listener.Close()
			details = "port 22 is free (no service listening)"
		}
	}

	result.Data["active"] = active
	result.Data["details"] = details
	return result, nil
}
