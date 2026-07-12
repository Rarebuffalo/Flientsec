# FlientSec Workspace Guidelines for AI Coding Agents

This document defines the conventions, architecture, and coding patterns of the FlientSec project to maintain codebase consistency.

---

## 1. Directory Overview & Folder Responsibilities

All changes must conform to the following directory layout conventions:
- `/agent`: Go-based security daemon. Contains local check implementations under `checks/`, local yaml validation under `policy/`, local offline buffers under `queue/`, and registration/heartbeat clients under `client/`.
- `/backend`: FastAPI Python service. Coordinates PostgreSQL schemas, migrations, security check-in routers, and dashboard API queries.
- `/frontend`: Next.js App Router UI. Separates admin views under `app/(admin)/` and marketing elements. Styling relies strictly on custom vanilla CSS themes in `globals.css` and Tailwind config customizations rather than default libraries.
- `/docs`: Complete product guides and specifications. Link files relatively (e.g. `docs/architecture.md`) rather than using absolute paths.
- `/assets`: Visual marketing assets, screenshots, and vector SVG branding.
- `/examples`: Boilerplate configurations and policy files for reference.

---

## 2. Coding Conventions

### A. Go Agent Coding Standards
- Implement checks using standard library subprocess commands where possible (e.g., executing `ufw status` or `lsblk`).
- Avoid external package dependencies unless absolutely necessary.
- Return structured error types and log using the native `log/slog` library.
- Keep the agent lightweight. Run checks asynchronously using Go routines and tickers.

### B. Python FastAPI Coding Standards
- Declare clear Request/Response schemas using Pydantic in `/backend/app/schemas/`.
- Map database models using SQLAlchemy in `/backend/app/models/`.
- Use async router endpoints (`async def`) for I/O bound queries (e.g. check-ins and database saves).
- Gracefully handle transactions using context managers or database session dependency injection.

### C. TypeScript Next.js Coding Standards
- Enable strict type checks. Explicitly type all variables, callback arguments, and map outputs.
- Keep components focused and reusable. Use left-aligned designs for technical content blocks.
- Maintain consistent visual density.
- Do not import heavy, unneeded graphic libraries. Keep animations limited to fades and packets pings under 500ms.

---

## 3. Design System Rules

- **Palette:** Rely strictly on `#12372A` (primary green), `#2D8C74` (accent teal), `#F7F9F8` (soft gray background), and `#111827` (charcoal text). Status indicators use red (`#EF4444`) and amber (`#F59E0B`).
- **Borders & Shadows:** Cards use `rounded-xl` (12px), buttons `rounded-lg` (10px). Borders must be subtle (`slate-200/slate-300`). Shadows must be extremely soft.
- **Rhythm:** Alternate content presentations. Combine tables, checklists, mockups, and timelines rather than stacking centered grids.
