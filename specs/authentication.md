# Product Specification: Authentication & Sessions

This specification defines the user authentication flow, session management, and auth tokens validation rules.

---

## 1. Objectives

- **Secure Access:** Only authenticated users can access dashboard pages or trigger API policy modifications.
- **Session Security:** Standard JWT tokens map user sessions with an expiration window of 24 hours.
- **Password Protection:** Encrypt user passwords securely via bcrypt hashing with a workload factor of 12.

---

## 2. User Authentication Journey

1.  **Signup:** User fills out Email and Password on the portal onboarding screen.
2.  **Login:** Validates login credentials and returns a signed JWT session token.
3.  **Protected Routes:** Frontend client includes the JWT Bearer token in the `Authorization` header for all private dashboard requests.
4.  **Logout:** Client deletes local token storage cookies, invalidating the session.

---

## 3. Relational Table Schema Reference

### Table: `users`
- `id` (INTEGER, Primary Key, Auto-Increment)
- `email` (VARCHAR, Unique, Indexed)
- `password_hash` (VARCHAR, Secure bcrypt hash)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Table: `sessions`
- `id` (INTEGER, Primary Key)
- `user_id` (INTEGER, Foreign Key referencing `users.id`)
- `token` (VARCHAR, Unique index token hash)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

---

## 4. API Endpoint Definitions

### Login Request (`POST /api/v1/auth/login`)
**Payload:**
```json
{
  "email": "user@example.com",
  "password": "secure_password_string"
}
```
**Response (HTTP 200):**
```json
{
  "access_token": "jwt_signed_payload_hash",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

## 5. Security & Edge Cases
- **Duplicate Registration:** Registration endpoint returns `HTTP 409 Conflict` if the email address is already registered.
- **Invalid Tokens:** Expired or tampered JWT signatures immediately trigger `HTTP 401 Unauthorized`.
