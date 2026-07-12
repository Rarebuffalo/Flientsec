# CLI Command Documentation

The FlientSec agent daemon provides command execution flags for testing and system checks validation directly from the shell terminal.

---

## 1. System Doctor Check (`flientsec doctor`)

Runs all diagnostic tests locally on the workstation and checks database config status and network backend links.

```bash
flientsec-agent -doctor
```

**Output:**
```
[✔] Core configurations parsed (/etc/flientsec/agent.yaml)
[✔] Local checks scheduler initialized
[✔] Secure API backend check-in link verified (HTTP 200)
[!] Package manager upgrades check (21 updates pending)
[✔] System firewall status PASS (UFW is active)
[✔] Workstation compliance calculation (Score: 85 - WARN)
```

---

## 2. Config Verification (`flientsec verify`)

Validates the syntax correctness of your `/etc/flientsec/agent.yaml` parameters without running the system service or scheduler.

```bash
flientsec-agent -verify
```

---

## 3. Telemetry Heartbeat Status (`flientsec status`)

Checks whether the systemd service is active and logs the last transmission time.

```bash
systemctl status flientsec-agent.service
```
