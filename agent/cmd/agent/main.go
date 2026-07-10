package main

import (
	"bytes"
	"crypto/rand"
	"flag"
	"fmt"
	"io/ioutil"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"flientsec-agent/checks"
	"flientsec-agent/client"
	"flientsec-agent/policy"
	"flientsec-agent/queue"

	"gopkg.in/yaml.v3"
)

// AgentConfig matches agent.yaml properties
type AgentConfig struct {
	Server struct {
		URL   string `yaml:"url"`
		Token string `yaml:"token"`
	} `yaml:"server"`
	Interval          int             `yaml:"interval"`
	HeartbeatInterval int             `yaml:"heartbeat_interval"`
	UUIDFilePath      string          `yaml:"uuid_file_path"`
	Checks            map[string]bool `yaml:"checks"`
}

var retryQueue = queue.NewRetryQueue()

func main() {
	// Parse CLI arguments
	configPath := flag.String("config", "agent.yaml", "Path to agent.yaml config file")
	flag.Parse()

	// Initialize structured logger (slog)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Starting FlientSec Agent...")

	// Load configuration
	cfg, err := loadConfig(*configPath)
	if err != nil {
		slog.Error("Failed to load config file", "path", *configPath, "err", err)
		os.Exit(1)
	}

	// Read or Generate Device UUID
	deviceUUID, err := getOrGenerateUUID(cfg.UUIDFilePath)
	if err != nil {
		slog.Error("Failed to resolve device UUID", "err", err)
		os.Exit(1)
	}
	slog.Info("Device identity resolved", "uuid", deviceUUID)

	// Gather baseline system details
	hostname, _ := os.Hostname()
	osName, osVer := getOSRelease()
	kernelVer := getKernelVersion()
	osArch := runtime.GOARCH
	agentVersion := "1.0.0"

	slog.Info("System specifications gathered", 
		"hostname", hostname, 
		"os", osName, 
		"os_version", osVer, 
		"os_arch", osArch, 
		"kernel", kernelVer,
	)

	// Initialize API Client
	apiClient := client.NewClient(cfg.Server.URL, cfg.Server.Token)

	// Register device
	slog.Info("Registering device with backend...", "url", cfg.Server.URL)
	err = apiClient.Register(client.DeviceRegister{
		ID:            deviceUUID,
		Hostname:      hostname,
		OSName:        osName,
		OSVersion:     osVer,
		OSArch:        osArch,
		KernelVersion: kernelVer,
		AgentVersion:  agentVersion,
	})
	if err != nil {
		slog.Error("Device registration failed. Daemon will run but check-ins may fail until registered", "err", err)
	} else {
		slog.Info("Device registration completed successfully")
	}

	// Start background heartbeat loop
	slog.Info("Starting background heartbeat dispatcher...", "interval_sec", cfg.HeartbeatInterval)
	startHeartbeatLoop(apiClient, deviceUUID, cfg.HeartbeatInterval)

	// Execute initial compliance check run
	slog.Info("Executing startup posture evaluation...")
	runChecksAndPost(apiClient, deviceUUID, cfg)

	// Run main check-in ticker loop
	slog.Info("Entering posture evaluation daemon loop...", "interval_sec", cfg.Interval)
	checkTicker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	
	for range checkTicker.C {
		slog.Info("Triggering periodic check-in run...")
		runChecksAndPost(apiClient, deviceUUID, cfg)
	}
}

func loadConfig(path string) (*AgentConfig, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg AgentConfig
	err = yaml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func getOrGenerateUUID(filePath string) (string, error) {
	if data, err := ioutil.ReadFile(filePath); err == nil {
		uuidStr := strings.TrimSpace(string(data))
		if uuidStr != "" {
			return uuidStr, nil
		}
	}

	// Generate UUID v4
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	uuidStr := fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if dir != "." {
		os.MkdirAll(dir, 0755)
	}

	err = ioutil.WriteFile(filePath, []byte(uuidStr), 0600)
	if err != nil {
		return "", err
	}
	return uuidStr, nil
}

func getOSRelease() (string, string) {
	name := runtime.GOOS
	version := "unknown"

	data, err := ioutil.ReadFile("/etc/os-release")
	if err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "NAME=") {
				name = strings.Trim(strings.TrimPrefix(line, "NAME="), "\"")
			}
			if strings.HasPrefix(line, "VERSION_ID=") {
				version = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), "\"")
			}
			if version == "unknown" && strings.HasPrefix(line, "PRETTY_NAME=") {
				version = strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
			}
		}
	}
	return name, version
}

func getKernelVersion() string {
	cmd := exec.Command("uname", "-r")
	var out bytes.Buffer
	cmd.Stdout = &out
	if cmd.Run() == nil {
		return strings.TrimSpace(out.String())
	}
	return "unknown"
}

func startHeartbeatLoop(c *client.Client, deviceID string, intervalSecs int) {
	ticker := time.NewTicker(time.Duration(intervalSecs) * time.Second)
	go func() {
		for range ticker.C {
			slog.Debug("Sending heartbeat check...")
			err := c.SendHeartbeat(deviceID)
			if err != nil {
				slog.Error("Heartbeat ping failed", "err", err)
			}
		}
	}()
}

func runChecksAndPost(c *client.Client, deviceID string, cfg *AgentConfig) {
	// 1. Fetch policy from backend
	slog.Info("Fetching active security policy from backend...")
	policyData, err := c.GetPolicy()
	if err != nil {
		slog.Warn("Failed to fetch active policy from backend. Falling back to default policy rules", "err", err)
	}

	// 2. Execute raw checks run
	collectedData := make(map[string]checks.CheckResult)
	for name, check := range checks.Registry {
		// Verify if check is enabled in local agent config
		if enabled, exists := cfg.Checks[name]; exists && !enabled {
			slog.Info("Skipping check as disabled in agent config", "check", name)
			continue
		}

		slog.Info("Running health check...", "check", name)
		res, err := check.Run()
		if err != nil {
			slog.Error("Check execution error", "check", name, "err", err)
			continue
		}
		collectedData[name] = res
	}

	// 3. Perform local evaluation
	runID := ""
	b := make([]byte, 16)
	_, uuidErr := rand.Read(b)
	if uuidErr == nil {
		b[6] = (b[6] & 0x0f) | 0x40
		b[8] = (b[8] & 0x3f) | 0x80
		runID = fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
	} else {
		runID = fmt.Sprintf("00000000-0000-0000-0000-%012d", time.Now().Unix())
	}
	
	payload, err := policy.Evaluate(policyData, collectedData, runID)
	if err != nil {
		slog.Error("Failed to evaluate local security policy", "err", err)
		return
	}

	// 4. Try to flush queue first if online
	flushRetryQueue(c, deviceID)

	// 5. Send telemetry findings to server
	slog.Info("Posting check-in findings to server...", "status", payload.Status, "score", payload.Score)
	err = c.SendCheckin(deviceID, payload)
	if err != nil {
		slog.Error("Check-in reporting failed, caching run in retry queue", "err", err)
		retryQueue.Push(payload)
		return
	}
	slog.Info("Telemetry findings reported successfully")
}

func flushRetryQueue(c *client.Client, deviceID string) {
	size := retryQueue.Size()
	if size == 0 {
		return
	}
	slog.Info("Attempting to flush cached runs from retry queue...", "size", size)
	cached := retryQueue.PopAll()
	failed := []policy.CheckRunPayload{}

	for _, payload := range cached {
		err := c.SendCheckin(deviceID, payload)
		if err != nil {
			slog.Warn("Failed to send cached check-in run, returning to queue", "runID", payload.ID, "err", err)
			failed = append(failed, payload)
		} else {
			slog.Info("Successfully reported cached check-in run", "runID", payload.ID)
		}
	}

	// Re-queue any that failed again
	for _, payload := range failed {
		retryQueue.Push(payload)
	}
}
