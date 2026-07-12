# Local Infrastructure Deployment Guide

This guide details how to launch and coordinate the FlientSec platform database, API backend service, and Next.js portal locally using Docker Compose.

---

## 1. Local Compose Development Execution

To start PostgreSQL, the FastAPI API daemon, and the Next.js frontend, execute:
```bash
docker compose up --build -d
```

### Verification Checks:
- **FastAPI API Health:** Query `http://localhost:8000/api/v1/health` (should respond `{"status": "ok", ...}`).
- **Next.js Web Interface:** Navigate to `http://localhost:3000`. Sign in using:
  - **Email:** `admin@flientsec.local`
  - **Password:** `flientsec_admin_pass`

---

## 2. PostgreSQL Storage Persistence

In local development, database tables reset on container rebuilds. To mount persistent volumes, merge the compose override file:
```bash
docker compose -f docker-compose.yml -f examples/docker-compose.override.yml up -d
```
See the [Configuration Guide](configuration.md) for custom environment parameters.
