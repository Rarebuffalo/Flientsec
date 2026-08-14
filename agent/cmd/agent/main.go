package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
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
	Interval           int             `yaml:"interval"`
	HeartbeatInterval  int             `yaml:"heartbeat_interval"`
	UUIDFilePath       string          `yaml:"uuid_file_path"`
	TokenFilePath      string          `yaml:"token_file_path"`
	PolicyFilePath     string          `yaml:"policy_file_path"`
	Checks             map[string]bool `yaml:"checks"`
}

var retryQueue = queue.NewRetryQueue()

func main() {
	// Parse CLI arguments
	defaultConfig := "agent.yaml"
	if envCfg := os.Getenv("FLIENTSEC_CONFIG"); envCfg != "" {
		defaultConfig = envCfg
	} else if _, err := os.Stat("/etc/flientsec/agent.yaml"); err == nil {
		defaultConfig = "/etc/flientsec/agent.yaml"
	}

	configPath := flag.String("config", defaultConfig, "Path to agent.yaml config file")
	flag.Parse()

	// Initialize structured logger (slog)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Starting FlientSec Agent...")

	// Load configuration
	cfg, err := loadConfig(*configPath)
	if err != nil {
		slog.Warn("Could not load config file, attempting environment variable fallback", "path", *configPath, "err", err)
		cfg = &AgentConfig{}
	}

	// Environment variable overrides
	if envURL := os.Getenv("FLIENTSEC_SERVER_URL"); envURL != "" {
		cfg.Server.URL = envURL
	}
	if envToken := os.Getenv("FLIENTSEC_ENROLLMENT_TOKEN"); envToken != "" {
		cfg.Server.Token = envToken
	}
	if cfg.Server.URL == "" {
		cfg.Server.URL = "http://localhost:8000"
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 60
	}
	if cfg.HeartbeatInterval <= 0 {
		cfg.HeartbeatInterval = 30
	}
	if cfg.UUIDFilePath == "" {
		if err := os.MkdirAll("/var/lib/flientsec", 0700); err == nil {
			cfg.UUIDFilePath = "/var/lib/flientsec/device.uuid"
		} else {
			cfg.UUIDFilePath = "device.uuid"
		}
	}
	if cfg.TokenFilePath == "" {
		if err := os.MkdirAll("/var/lib/flientsec", 0700); err == nil {
			cfg.TokenFilePath = "/var/lib/flientsec/device.token"
		} else {
			cfg.TokenFilePath = "device.token"
		}
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

	// Load existing device token if available
	savedDeviceToken, _ := loadDeviceToken(cfg.TokenFilePath)
	if savedDeviceToken != "" {
		apiClient.DeviceToken = savedDeviceToken
		slog.Info("Loaded persistent device credentials from storage")
	}

	// If no device token or on bootstrap, attempt registration
	if apiClient.DeviceToken == "" {
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
			if saveErr := saveDeviceToken(cfg.TokenFilePath, apiClient.DeviceToken); saveErr != nil {
				slog.Warn("Failed to persist device token to storage", "err", saveErr)
			}
		}
	}

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle OS termination signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start background heartbeat loop
	slog.Info("Starting background heartbeat dispatcher...", "interval_sec", cfg.HeartbeatInterval)
	startHeartbeatLoop(ctx, apiClient, deviceUUID, cfg.HeartbeatInterval)

	// Determine policy path
	policyPath := cfg.PolicyFilePath
	if policyPath == "" {
		policyPath = "/var/lib/flientsec/policy.json"
		if err := os.MkdirAll("/var/lib/flientsec", 0700); err != nil {
			policyPath = "policy.json"
		}
	}

	// Execute initial compliance check run
	slog.Info("Executing startup posture evaluation...")
	runChecksAndPost(apiClient, deviceUUID, cfg, policyPath)

	// Run main check-in ticker loop
	slog.Info("Entering posture evaluation daemon loop...", "interval_sec", cfg.Interval)
	checkTicker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer checkTicker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-checkTicker.C:
				slog.Info("Triggering periodic check-in run...")
				runChecksAndPost(apiClient, deviceUUID, cfg, policyPath)
			}
		}
	}()

	// Wait for termination signal
	sig := <-sigChan
	slog.Info("Termination signal received. Shutting down gracefully...", "signal", sig.String())
	cancel()

	// Attempt final queue flush on exit
	flushRetryQueue(apiClient, deviceUUID)
	slog.Info("FlientSec Agent stopped successfully.")
}

func loadConfig(path string) (*AgentConfig, error) {
	data, err := os.ReadFile(path)
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

func loadDeviceToken(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func saveDeviceToken(filePath, token string) error {
	dir := filepath.Dir(filePath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return err
		}
	}
	return os.WriteFile(filePath, []byte(token), 0600)
}

func getOrGenerateUUID(filePath string) (string, error) {
	if data, err := os.ReadFile(filePath); err == nil {
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
		if err := os.MkdirAll(dir, 0700); err != nil {
			return "", err
		}
	}

	err = os.WriteFile(filePath, []byte(uuidStr), 0600)
	if err != nil {
		return "", err
	}
	return uuidStr, nil
}

func getOSRelease() (string, string) {
	name := runtime.GOOS
	version := "unknown"

	data, err := os.ReadFile("/etc/os-release")
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

func startHeartbeatLoop(ctx context.Context, c *client.Client, deviceID string, intervalSecs int) {
	ticker := time.NewTicker(time.Duration(intervalSecs) * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				slog.Debug("Sending heartbeat check...")
				err := c.SendHeartbeat(deviceID)
				if err != nil {
					slog.Error("Heartbeat ping failed", "err", err)
				}
			}
		}
	}()
}

func runChecksAndPost(
	c *client.Client,
	deviceID string,
	cfg *AgentConfig,
	policyPath string,
) {
	var activePolicy *policy.AgentPolicyResponse
	var syncErr error

	// 1. Attempt to fetch policy online
	respBytes, err := c.GetAgentPolicy(deviceID)
	if err == nil {
		// Valid response. Proceed to validation.
		ap, valErr := policy.ValidatePolicy(respBytes)
		if valErr == nil {
			// Valid! Atomic Cache Promotion.
			if saveErr := policy.SaveLKG(policyPath, respBytes); saveErr != nil {
				slog.Error(
					"Failed to save policy to LKG cache",
					"path", policyPath,
					"err", saveErr,
				)
			} else {
				slog.Info("Successfully synchronized and cached active policy")
			}
			activePolicy = ap
		} else {
			slog.Error("Online policy validation failed; preserving LKG", "err", valErr)
			syncErr = valErr
		}
	} else {
		slog.Warn("Online policy synchronization failed", "err", err)
		syncErr = err
	}

	// 2. If sync failed or validation failed, fallback to LKG on recoverable errors
	if activePolicy == nil {
		isTerminal := syncErr != nil && (
			strings.Contains(syncErr.Error(), "auth_failed") ||
			strings.Contains(syncErr.Error(), "policy_not_assigned"))

		if isTerminal {
			slog.Error(
				"Terminal policy sync error. Evaluation skipped.",
				"err", syncErr,
			)
			return
		}

		// Try loading LKG for recoverable network errors
		ap, loadErr := policy.LoadLKG(policyPath)
		if loadErr == nil {
			slog.Info("Using cached last-known-good policy", "path", policyPath)
			activePolicy = ap
		} else {
			slog.Error(
				"No valid last-known-good policy cache available",
				"err", loadErr,
			)
			return
		}
	}

	// 3. Execute raw checks run
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

	// 4. Perform local evaluation
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

	payload, err := policy.Evaluate(
		[]byte(activePolicy.Content),
		collectedData,
		runID,
	)
	if err != nil {
		slog.Error("Failed to evaluate local security policy", "err", err)
		return
	}

	// Attach evaluated policy provenance metadata
	payload.PolicyVersionID = activePolicy.VersionID
	payload.ContentHash = activePolicy.ContentHash

	// 5. Try to flush queue first if online
	flushRetryQueue(c, deviceID)

	// 6. Send telemetry findings to server
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
