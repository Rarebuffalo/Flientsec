package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL     string
	Token       string
	DeviceToken string
	HTTPClient  *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type DeviceRegister struct {
	ID            string `json:"id"`
	Hostname      string `json:"hostname"`
	OSName        string `json:"os_name"`
	OSVersion     string `json:"os_version"`
	OSArch        string `json:"os_arch"`
	KernelVersion string `json:"kernel_version"`
	AgentVersion  string `json:"agent_version"`
}

type RegisterResponse struct {
	Status      string `json:"status"`
	DeviceToken string `json:"device_token"`
}

func (c *Client) Register(device DeviceRegister) error {
	endpoint := fmt.Sprintf("%s/api/v1/agent/register", c.BaseURL)

	jsonData, err := json.Marshal(device)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Enrollment-Token", c.Token)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("registration failed with status code: %d", resp.StatusCode)
	}

	var regResp RegisterResponse
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bodyBytes, &regResp); err != nil {
		return err
	}
	c.DeviceToken = regResp.DeviceToken

	return nil
}

func (c *Client) SendHeartbeat(deviceID string) error {
	endpoint := fmt.Sprintf("%s/api/v1/agent/heartbeat", c.BaseURL)

	req, err := http.NewRequest("POST", endpoint, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Device-Uuid", deviceID)
	req.Header.Set("X-Device-Token", c.DeviceToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed with status code: %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) SendCheckin(deviceID string, payload interface{}) error {
	endpoint := fmt.Sprintf("%s/api/v1/agent/checkin", c.BaseURL)

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Device-Uuid", deviceID)
	req.Header.Set("X-Device-Token", c.DeviceToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("check-in failed with status code: %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) GetPolicy(deviceID string) ([]byte, error) {
	endpoint := fmt.Sprintf("%s/api/v1/policies", c.BaseURL)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Device-Uuid", deviceID)
	req.Header.Set("X-Device-Token", c.DeviceToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch policy, status: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}


func (c *Client) GetAgentPolicy(deviceID string) ([]byte, error) {
	endpoint := fmt.Sprintf("%s/api/v1/agent/policy", c.BaseURL)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Device-Uuid", deviceID)
	req.Header.Set("X-Device-Token", c.DeviceToken)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("auth_failed: status %d", resp.StatusCode)
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("policy_not_assigned: status %d", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server_error: status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

