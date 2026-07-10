package checks

import (
	"bytes"
	"os/exec"
	"strings"
)

type firewallCheck struct{}

func init() {
	Register(&firewallCheck{})
}

func (f *firewallCheck) Name() string {
	return "firewall"
}

func (f *firewallCheck) Run() (CheckResult, error) {
	result := CheckResult{
		Name:    f.Name(),
		Success: true,
		Data:    make(map[string]interface{}),
	}

	driver, active, err := detectFirewall()
	result.Data["driver"] = driver
	result.Data["active"] = active
	if err != nil {
		result.Success = false
		result.Error = err.Error()
	}

	return result, nil
}

// FirewallDriver defines methods for individual firewall utilities.
type FirewallDriver interface {
	Name() string
	IsInstalled() bool
	IsActive() (bool, error)
}

// UFW Driver
type ufwDriver struct{}

func (u *ufwDriver) Name() string { return "ufw" }
func (u *ufwDriver) IsInstalled() bool {
	_, err := exec.LookPath("ufw")
	return err == nil
}
func (u *ufwDriver) IsActive() (bool, error) {
	cmd := exec.Command("ufw", "status")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return false, err
	}
	// "Status: active"
	return strings.Contains(strings.ToLower(out.String()), "status: active"), nil
}

// Firewalld Driver
type firewalldDriver struct{}

func (fd *firewalldDriver) Name() string { return "firewalld" }
func (fd *firewalldDriver) IsInstalled() bool {
	_, err := exec.LookPath("firewall-cmd")
	return err == nil
}
func (fd *firewalldDriver) IsActive() (bool, error) {
	cmd := exec.Command("firewall-cmd", "--state")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		// firewall-cmd returns non-zero when inactive
		return false, nil
	}
	return strings.TrimSpace(out.String()) == "running", nil
}

// nftables Driver
type nftablesDriver struct{}

func (n *nftablesDriver) Name() string { return "nftables" }
func (n *nftablesDriver) IsInstalled() bool {
	_, err := exec.LookPath("nft")
	return err == nil
}
func (n *nftablesDriver) IsActive() (bool, error) {
	cmd := exec.Command("nft", "list", "ruleset")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return false, err
	}
	// If ruleset is empty, it's considered inactive or unconfigured
	return len(strings.TrimSpace(out.String())) > 0, nil
}

// iptables Driver (basic check for active rules)
type iptablesDriver struct{}

func (i *iptablesDriver) Name() string { return "iptables" }
func (i *iptablesDriver) IsInstalled() bool {
	_, err := exec.LookPath("iptables")
	return err == nil
}
func (i *iptablesDriver) IsActive() (bool, error) {
	cmd := exec.Command("iptables", "-S")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return false, err
	}
	// If output contains rules other than just default policy accept statements
	lines := strings.Split(out.String(), "\n")
	activeRules := 0
	for _, line := range lines {
		if line == "" {
			continue
		}
		// Skip standard policy setup lines like "-P INPUT ACCEPT"
		if !strings.HasPrefix(line, "-P") {
			activeRules++
		}
	}
	return activeRules > 0, nil
}

func detectFirewall() (string, bool, error) {
	drivers := []FirewallDriver{
		&ufwDriver{},
		&firewalldDriver{},
		&nftablesDriver{},
		&iptablesDriver{},
	}

	for _, d := range drivers {
		if d.IsInstalled() {
			active, err := d.IsActive()
			return d.Name(), active, err
		}
	}

	return "none", false, nil
}
