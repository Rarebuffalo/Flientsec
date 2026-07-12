# Backend API Documentation

The FastAPI service exposes endpoints for workstation telemetry registration and heartbeats, as well as portal configuration checkups.

---

## 1. Authentication Headers

All API calls from Go agents must include the device ID headers:
- `X-Device-UUID`: The unique hardware-generated workstation identification hash.
- `Authorization`: Bearer signature token.

---

## 2. Telemetry Endpoints

### A. Device Registration (`POST /api/v1/agent/register`)
Initial handshake query sent during client install.

**Request Payload:**
```json
{
  "uuid": "430af3a0-7b56-4c92-bd88-0248a901ffba",
  "hostname": "ubuntu-laptop-02",
  "os_distribution": "ubuntu",
  "kernel_version": "5.15.0-generic",
  "architecture": "x86_64"
}
```

**Response Payload:**
```json
{
  "status": "registered",
  "device_id": 12,
  "config_sync": "/api/v1/policies/latest"
}
```

### B. Device Compliance Checkin (`POST /api/v1/agent/checkin`)
Scheduled telemetry log check-in run.

**Request Payload:**
```json
{
  "score": 85,
  "status": "WARN",
  "findings": [
    {
      "check_name": "updates",
      "severity": "medium",
      "status": "failed",
      "description": "21 pending package upgrades detect on package manager registers."
    }
  ]
}
```

**Response Payload:**
```json
{
  "status": "accepted",
  "events_recorded": 1
}
```

### C. Heartbeat ping (`POST /api/v1/agent/heartbeat`)
Checks active link state of the workstation. Emits empty payloads returning `{"status": "alive"}`.
