# Workstation Privacy Specification

FlientSec is designed to verify security configurations without collecting private employee data. We follow a strict telemetry data minimization policy.

---

## 1. Zero Surveillance Guarantee

The agent contains no capability to track or monitor:
- Browser history, active tabs, or network traffic.
- Keylogs or input sequences.
- Screen captures, camera, or audio hardware.
- Content, files, or repositories inside local developer code directories.

---

## 2. Telemetry Scope Limits

The Go agent strictly collects and reports the status of system security parameters:
- **Firewall:** Checks if UFW, firewalld, nftables, or iptables are active.
- **Encryption:** Verifies if `/` runs on a crypt mapper volume mount.
- **Updates:** Counts pending pacman, apt, or dnf upgrades.
- **SSH:** Checks for active sshd configurations.
- **Compiler runtimes:** Detects toolchain versions (Go, Node.js, Docker, Git).

For details on local evaluation, see the [Architecture Overview](architecture.md).
