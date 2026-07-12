# Agent Daemon Configuration Spec

The FlientSec agent daemon is configured via a YAML file located at `/etc/flientsec/agent.yaml`.

---

## Default Parameter Template

```yaml
# Server endpoint configuration
server_url: "http://localhost:8000/api/v1"

# Registration credentials token (provided during onboarding)
enrollment_token: "flientsec_enroll_token_hash"

# Ticker interval timing (in seconds)
heartbeat_interval: 30
check_interval: 60

# Telemetry logging limits
log_file: "/var/log/flientsec/agent.log"
log_level: "info"

# Client Cache limits
queue_max_size: 100
```

---

## Parameter Descriptions

- `server_url`: The base HTTP/HTTPS URL of the FastAPI backend service router. (e.g. `http://localhost:8000/api/v1`).
- `enrollment_token`: Used to authenticate initial device registration handshake calls. Refer to [API Specs](api.md) for endpoint details.
- `heartbeat_interval`: Speed at which workstation ping packets are sent to indicate link state (Online/Offline status).
- `check_interval`: The delay interval between local policy configuration evaluations and check-in telemetry exports.
- `queue_max_size`: The maximum limit of compliance check reports that can buffer in local cache queue database if the backend becomes unreachable.
