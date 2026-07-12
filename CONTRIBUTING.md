# Contributing to FlientSec

Thank you for your interest in contributing to FlientSec! This document provides guidelines to help you set up your local development environment and submit high-quality code changes.

---

## 1. Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to `info.krishnasingh.codes@gmail.com`.

---

## 2. Development Setup

### Prerequisite Dependencies:
- **Go 1.21+** (for `/agent`)
- **Python 3.11+** (for `/backend`)
- **Node.js 18+** & **npm** (for `/frontend`)
- **Docker & Docker Compose** (for localized database testing)

### Step-by-Step Setup:
1. Clone the repository and initialize local database services:
   ```bash
   git clone https://github.com/Rarebuffalo/Flientsec.git
   cd flientsec
   cp .env.example .env
   docker compose up -d
   ```
2. Build the local Go agent binary:
   ```bash
   cd agent
   go build -o flientsec-agent cmd/agent/main.go
   ```

---

## 3. Branching & Commit Message Guidelines

- **Branch Name Formats:**
  - Feature branch: `feat/short-description`
  - Bug fixes: `fix/issue-description`
  - Documentation: `docs/documentation-topic`
  - Style/Refactoring: `refactor/changes-description`
- **Commit Messages:**
  Commit messages should follow standard Semantic Versioning guidelines:
  - `feat: implement support for firewall rules checks`
  - `fix: resolve crash in agent queue retry logic`
  - `docs: update deployment guidelines for postgres`

---

## 4. Submitting a Pull Request (PR)

1. Ensure your code passes all lint and build check suites locally.
2. Open a Pull Request linking to the relevant issue.
3. Reviewers will verify your changes against our [PR Template](.github/PULL_REQUEST_TEMPLATE.md).
