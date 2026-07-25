# Product Specification: Organizations & Multi-Tenancy

This specification defines workspaces isolation boundary rules, organization creation steps, user memberships mapping, and roles authorizations.

---

## 1. Objectives

- **Multi-Tenant Isolation:** Ensure that resources (devices, policies, logs) of Organization A are completely inaccessible to users in Organization B.
- **Unified Workspaces:** Users can belong to multiple organizations and switch active workspaces via the dashboard profile dropdown.
- **Access Control:** Enforce Role-Based Access Control (RBAC) to delegate admin responsibilities.

---

## 2. Membership Access Journey

1.  **Workspace Creation:** A logged-in user creates an organization (e.g. "Acme Corp") from the dashboard workspace launcher.
2.  **Invitation:** The creator (Owner) invites another user via email, specifying their access role (`Admin` or `Viewer`).
3.  **Acceptance:** The invited user receives an email containing an acceptance token, registers/signs in, and accepts the invitation.
4.  **Resource Query:** Every backend SQL database query includes the active `organization_id` index constraint to guarantee isolation.

---

## 3. Relational Table Schema Reference

### Table: `organizations`
- `id` (INTEGER, Primary Key)
- `name` (VARCHAR, Workspace name)
- `created_at` (TIMESTAMP)

### Table: `members`
- `id` (INTEGER, Primary Key)
- `user_id` (INTEGER, Foreign Key referencing `users.id`)
- `organization_id` (INTEGER, Foreign Key referencing `organizations.id`)
- `role` (VARCHAR, must be one of `Owner`, `Admin`, `Viewer`)
- `created_at` (TIMESTAMP)

---

## 4. User Roles & Permission Grid

| Action | Owner | Admin | Viewer |
| ------ | :---: | :---: | :---: |
| Edit Org Name / Delete Org | ✅ | ❌ | ❌ |
| Invite Members / Revoke Access | ✅ | ❌ | ❌ |
| Create / Edit / Delete Policies | ✅ | ✅ | ❌ |
| Enroll / Decommission Workstations | ✅ | ✅ | ❌ |
| Read Compliance Dashboard / Device Lists | ✅ | ✅ | ✅ |

---

## 5. Security & Edge Cases
- **Revoked Invite:** If a user acceptance token is expired or revoked, clicking the join link returns `HTTP 410 Gone`.
- **Org Switching:** Switching organizations dynamically updates the Bearer context in frontend requests.
