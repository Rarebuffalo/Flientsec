# Transport Security & Cryptography Specification

FlientSec enforces transport encryption and certificate signature validations to safeguard telemetry communication channels.

---

## 1. Network Telemetry Transport

All API payloads transmitted between Go agents and the FastAPI backend must run over HTTPS.
- **TLS Baseline:** Enforces a minimum TLS v1.3 configuration, restricting weak cipher suites.
- **Header Auths:** Telemetry check-in posts require authenticating device ID UUID headers matching registration keys.

---

## 2. Certificate Handshake (Planned)

Workstations generate an asymmetric ECDSA client identity key pair locally on first run. Telemetry runs are signed using the private key, and the server validates the signature using the registered public key during check-ins.

For rule engine formats, see the [Policy Language Guide](policy-language.md).
