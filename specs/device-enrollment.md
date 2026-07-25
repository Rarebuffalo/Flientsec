# Product Specification: Device Enrollment & Handshake

This specification details how new developer workstations securely register with an organization and exchange temporary tokens for unique hardware keys.

---

## 1. Objectives

- **Controlled Registration:** Workstations must provide a valid organization `enrollment_token` to successfully connect.
- **Identity Security:** Replace the shared enrollment token with a distinct `device_token` during handshake. Agents will authenticate future telemetry runs with this device-specific key.
- **Frictionless Scripting:** Automate the installer setup via curl-to-bash scripts passing environment tokens.

---

## 2. Enrollment Exchange Flow

```
Developer Laptop                 FastAPI Registration Endpoint
 ┌─────────────┐                        ┌─────────────┐
 │             │   enrollment_token     │             │
 │  Install.sh ├───────────────────────>│  Verify Org │
 │             │   + Hardware UUID      │             │
 └─────────────┘                        └──────┬──────┘
        ▲                                      │
        │           device_token               │
        └──────────────────────────────────────┘
                   (Stores locally)
```

1.  **Token Generation:** An administrator generates a secure organizational `enrollment_token` (valid for 7 days) via the settings dashboard.
2.  **Client Installation:** Run the setup installer passing the token:
    `curl -fsSL install.sh | bash -s -- --token <enroll_token>`
3.  **Registration Handshake:** The installer calls `POST /api/v1/agent/register` transmitting:
    - Enrollment Token
    - Hardware UUID
    - Workstation metadata (hostname, OS, kernel, arch)
4.  **Token Exchange:** The backend validates the enrollment token, links the machine to the organization, creates a record, and returns a cryptographically signed `device_token`.
5.  **Persistence:** The agent registers `/etc/flientsec/token` and deletes the temporary configuration file. All future pings utilize the unique token.

---

## 3. Relational Table Schema Reference

### Table: `enrollment_tokens`
- `id` (INTEGER, Primary Key)
- `organization_id` (INTEGER, Foreign Key referencing `organizations.id`)
- `token_hash` (VARCHAR, Secure hashed token)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

---

## 4. API Registration Endpoint (`POST /api/v1/agent/register`)

**Payload:**
```json
{
  "enrollment_token": "token_string_abc",
  "uuid": "device_uuid_string",
  "hostname": "workstation-01",
  "os_distribution": "ubuntu"
}
```
**Response (HTTP 200):**
```json
{
  "status": "enrolled",
  "device_token": "unique_device_auth_token_hash"
}
```
