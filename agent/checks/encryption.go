package checks

import (
	"bytes"
	"io/ioutil"
	"os/exec"
	"strings"
)

type encryptionCheck struct{}

func init() {
	Register(&encryptionCheck{})
}

func (e *encryptionCheck) Name() string {
	return "encryption"
}

func (e *encryptionCheck) Run() (CheckResult, error) {
	result := CheckResult{
		Name:    e.Name(),
		Success: true,
		Data:    make(map[string]interface{}),
	}

	status := "Not Encrypted"
	details := ""

	// Method 1: Check using lsblk
	lsblkPath, err := exec.LookPath("lsblk")
	if err == nil {
		cmd := exec.Command(lsblkPath, "-r", "-o", "TYPE,MOUNTPOINT")
		var out bytes.Buffer
		cmd.Stdout = &out
		if cmd.Run() == nil {
			lines := strings.Split(out.String(), "\n")
			for _, line := range lines {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					devType := parts[0]
					mountPoint := parts[1]
					if mountPoint == "/" {
						details = "root mounted on " + devType
						if devType == "crypt" || strings.Contains(devType, "crypt") {
							status = "Encrypted"
							break
						}
					}
				}
			}
		}
	}

	// Method 2: Fallback to /proc/mounts analysis if still Not Encrypted or details empty
	if status == "Not Encrypted" {
		mountsData, err := ioutil.ReadFile("/proc/mounts")
		if err == nil {
			lines := strings.Split(string(mountsData), "\n")
			for _, line := range lines {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					device := fields[0]
					mountPoint := fields[1]
					if mountPoint == "/" {
						details = "root device node: " + device
						// device mapper paths /dev/mapper/ or /dev/dm- indicate encrypted mapper setups
						if strings.Contains(device, "/dev/mapper/") || strings.HasPrefix(device, "/dev/dm-") || strings.Contains(device, "crypt") {
							status = "Encrypted"
							break
						}
					}
				}
			}
		}
	}

	result.Data["status"] = status
	result.Data["details"] = details
	return result, nil
}
