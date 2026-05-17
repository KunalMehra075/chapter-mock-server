# Chapter Admin — RBAC + Authentication Plan

## Context

This server is the backend for the **Chapter** admin dashboard. It started as a mock server (`chapter-admin-mock-server`) but is now becoming the **real production backend**.

Current state:
- Express.js + MongoDB/Mongoose (TypeScript)
- **No authentication exists yet** — this plan builds it from scratch
- Only existing model: `WaitlistUsers` (landing-page waitlist)

Goal: scalable, production-grade RBAC system for the admin dashboard.

---

## User Types

Three admin roles, all stored in a single `ChapterAdmins` model:

1. **Operator** — full system access; manages admins, RBAC, everything
2. **SuperUser** — access to all dashboard modules; manages application users and admins; cannot manage operators or other superusers; cannot manage RBAC
3. **Admin** — limited module access; only assigned modules; cannot manage users/admins/operators or RBAC

Application end-users (the "Users" of the Chapter app) are **out of scope** for this plan — no separate `Users` model will be created yet.

---

## ChapterAdmins Schema

Single model for all three admin roles.

```
{
  email:               string  (unique, lowercased, trimmed)
  password:            string  (bcrypt hash; auto-generated at creation, replaced on first login)
  role:                "operator" | "superuser" | "admin"
  access:              string[] (permissions)

  // Invite tracking — set at creation, cleared once the user completes first-login password change
  inviteExpiresAt:     Date    | null
  mustChangePassword:  boolean (true until first password change after invite)

  // Forgot-password reset tracking
  resetTokenHash:      string  | null  (sha256 hash of active reset token)
  resetTokenExpiresAt: Date    | null

  createdAt, updatedAt
}
```

**`access` semantics:** seeded from role defaults at creation, but editable per-user afterward. The role provides the *starting point*; the array is the source of truth at runtime.

**Two separate flows touch credentials:**
- **Invite flow** (new admin creation) — uses `inviteExpiresAt` + `mustChangePassword` + an auto-generated temp password
- **Reset flow** (forgot/change password later) — uses `resetTokenHash` + `resetTokenExpiresAt`

These are kept distinct because the mechanisms differ (temp credentials vs tokenized link).

---

## Authentication

### Login
Client sends **only** email + password. Backend looks up the user, verifies the password, and derives the role from the document. The client does **not** assert role.

```
POST /api/auth/login
body: { email, password }
```

**Branching response based on invite state:**

1. **Normal user** (`mustChangePassword: false`)
   ```
   → 200 { accessToken, refreshToken, user: { email, role, access } }
   ```

2. **First-time login on a still-valid invite** (`mustChangePassword: true` AND `inviteExpiresAt > now`)
   ```
   → 200 {
       mustChangePassword: true,
       firstLoginToken,                // short-lived JWT, purpose: "complete-invite", TTL 10 min
       user: { email, role }
     }
   ```
   FE must redirect to the "set new password" screen. No `accessToken`/`refreshToken` issued yet — the user is not fully authenticated until they complete the invite.

3. **Expired invite** (`mustChangePassword: true` AND `inviteExpiresAt <= now`)
   ```
   → 410 Gone { error: "Invitation expired. Please contact an administrator to resend." }
   ```

### Complete Invite (first-login password change)

```
POST /api/auth/complete-invite
body: { firstLoginToken, newPassword }
→ 200 { accessToken, refreshToken, user: { email, role, access } }
```

- Verifies `firstLoginToken` (must be `purpose: "complete-invite"`, unexpired)
- Looks up the user; rejects if `mustChangePassword` is already false
- Validates `newPassword` against password policy (min length, etc.)
- Hashes + saves new password
- Clears `inviteExpiresAt` (set to `null`) and `mustChangePassword` (set to `false`)
- Issues normal access + refresh tokens — user is now fully logged in

### JWT Strategy
- Two main tokens: short-lived **access token**, longer-lived **refresh token**
- Third special-purpose token: **firstLoginToken** (purpose: `complete-invite`, TTL ~10 min)
- Secrets in env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (firstLoginToken uses `JWT_ACCESS_SECRET` with a `purpose` claim)
- Access token sent in `Authorization: Bearer <token>` header
- Refresh endpoint: `POST /api/auth/refresh` (body: `{ refreshToken }`)
- Logout invalidates the refresh token (see Token Revocation)

### Token Revocation
- Maintain a **refresh-token blacklist** (Mongo collection) or store active refresh tokens per user
- On `POST /api/auth/logout`, invalidate the presented refresh token
- Access tokens remain stateless (short TTL is the mitigation)
- On admin deletion, invalidate all of that admin's refresh tokens

### Password Hashing & Policy
- `bcrypt` with recommended cost factor (10–12)
- Minimum length 8, recommend mixing character classes (enforce server-side on set/change)
- Never return the password field from any query

---

## Invite Flow (new admin creation by Operator / SuperUser)

When an Operator creates a SuperUser/Admin (or a SuperUser creates an Admin), the system auto-generates credentials and emails them to the new user. The user logs in once with those credentials, is forced to change their password, and only then becomes a fully active admin.

### Creation step

```
POST /api/admins            permit("admins:create")
POST /api/superusers        permit("superusers:create")
POST /api/operators         permit("operators:create")
body: { email, access?: string[] }
→ 201 { id, email, role, access, inviteExpiresAt }
```

Behavior:
- Role is **implicit** from the endpoint
- Backend **auto-generates a strong temp password** (16-char crypto-random mix of upper/lower/digit/symbol)
- Saves user with: hashed temp password, `mustChangePassword: true`, `inviteExpiresAt: now + 24h`
- Sends **Chapter Admin Invitation** email containing:
  - The new admin's email
  - The plaintext temp password (this is the only time it's transmitted; user changes it on first login)
  - A note that the invitation is valid for 24 hours
  - A link to the dashboard login page
- The temp password is **never** returned in the API response — only via email

### First login & forced password change

1. User opens email, sees credentials
2. User goes to `{FRONTEND_URL}/login`, enters email + temp password
3. Backend returns `firstLoginToken` + `mustChangePassword: true`
4. FE shows "Set your new password" screen
5. User submits new password to `POST /api/auth/complete-invite`
6. Backend swaps the password, clears invite flags, issues full session tokens
7. User is now active

### Invite expiry

- If the user does not complete the invite within 24h, the next login attempt returns `410 Gone`
- The admin record **stays in the database** (not auto-deleted) so the inviter can resend the invite without losing the configured role + access
- Cleanup of permanently-expired records is left to a manual or scheduled job (out of scope)

### Resend invite

If the invite expired, or the user lost the email, the original inviter (or any admin with `:update` permission on that role) can re-issue:

```
POST /api/admins/:id/resend-invite        permit("admins:update")
POST /api/superusers/:id/resend-invite    permit("superusers:update")
POST /api/operators/:id/resend-invite     permit("operators:update")
→ 200 { id, email, role, inviteExpiresAt }
```

- Only allowed if `mustChangePassword === true` (invite not yet accepted)
- Generates a **new** temp password, overwrites stored hash, resets `inviteExpiresAt = now + 24h`
- Re-sends the invitation email with the fresh credentials
- Returns `409 Conflict` if the user has already activated (`mustChangePassword: false`)

---

## Password Reset Flow (forgot / routine change for active admins)

Used **after** an admin has completed their invite — i.e. for users with `mustChangePassword: false`. The mechanism is different from the invite flow: a tokenized email link, not temp credentials.

### Mechanism
- Backend generates a cryptographically random raw token (32-byte hex)
- Stores `sha256(rawToken)` in `resetTokenHash` and `resetTokenExpiresAt = now + 10 min`
- Emails the user a link containing the raw token:
  ```
  {FRONTEND_URL}/reset-password?token=<rawToken>
  ```
- On submit, backend hashes the incoming token, looks up the user by hash, verifies not expired, updates `password`, clears `resetTokenHash` + `resetTokenExpiresAt` (single-use)

### Endpoints

```
POST /api/auth/request-password-reset
body: { email }
→ 200 { message } (always 200 — do not leak whether the email exists)
- Available without authentication (forgot-password path)
- Re-sending invalidates any previous reset token for the same user
- No-op silently if the target user still has mustChangePassword: true (invite flow handles that case instead)
```

```
POST /api/auth/reset-password
body: { token, newPassword }
→ 200 { message }
- Verifies token + expiry, sets new password (bcrypt), clears token fields
```

### Authenticated "change password" UX
When a logged-in admin clicks "Change password" in the dashboard, the FE calls `POST /api/auth/request-password-reset` with their own email. The email confirmation step ensures the request is genuine even if a session is hijacked. No separate authenticated change-password endpoint is needed.

---

## Admin Management APIs (Operator / SuperUser / Admin CRUD)

All three roles live in the same `ChapterAdmins` collection but are exposed via **three separate route groups**, each gated by its own permission module. This keeps RBAC declarative and avoids per-controller role logic.

### Permission rules

| Module       | Operator | SuperUser | Admin |
|--------------|----------|-----------|-------|
| `operators:*`  | ✓ (via `*`) | ✗ | ✗ |
| `superusers:*` | ✓ (via `*`) | ✗ | ✗ |
| `admins:*`     | ✓ (via `*`) | ✓ | ✗ |

So:
- **Operator** can CRUD operators, superusers, admins (via `*`)
- **SuperUser** can CRUD admins only
- **Admin** cannot manage any admin records

### Routes

Identical CRUD shape for all three groups; only the role created/managed differs.

```
POST   /api/operators                    permit("operators:create")
GET    /api/operators                    permit("operators:read")
GET    /api/operators/:id                permit("operators:read")
PUT    /api/operators/:id                permit("operators:update")
DELETE /api/operators/:id                permit("operators:delete")
POST   /api/operators/:id/resend-invite  permit("operators:update")

POST   /api/superusers                   permit("superusers:create")
GET    /api/superusers                   permit("superusers:read")
GET    /api/superusers/:id               permit("superusers:read")
PUT    /api/superusers/:id               permit("superusers:update")
DELETE /api/superusers/:id               permit("superusers:delete")
POST   /api/superusers/:id/resend-invite permit("superusers:update")

POST   /api/admins                       permit("admins:create")
GET    /api/admins                       permit("admins:read")
GET    /api/admins/:id                   permit("admins:read")
PUT    /api/admins/:id                   permit("admins:update")
DELETE /api/admins/:id                   permit("admins:delete")
POST   /api/admins/:id/resend-invite     permit("admins:update")
```

All require `authenticate` middleware first.

### Update endpoint

```
PUT /api/admins/:id
body: { email?, access?: string[] }
→ 200 { id, email, role, access }
```

- `role` is **not editable** (preserves the route-group/role invariant — promoting requires delete + recreate)
- `password` is **not editable** here (users change their own password via reset flow; admins cannot set another user's password directly)
- `inviteExpiresAt`, `mustChangePassword`, `resetTokenHash` are **not directly editable** — they are managed by the invite + reset flows

### Delete endpoint

Hard delete. The deleted user's refresh tokens must be invalidated as part of the operation.

### Cross-role safety

Because each endpoint is bound to one role and one permission module, a SuperUser holding `admins:*` literally cannot hit `/api/superusers` or `/api/operators` — the `permit()` middleware blocks them. **No hardcoded role checks needed in controllers.**

A controller-level guard still applies: the `findById`/`update`/`delete` queries should be scoped by `role` (e.g. `{ _id, role: "admin" }`) so the admins endpoint cannot accidentally operate on a superuser document via a guessed ID.

---

## Operator Bootstrap

On server startup, check if an operator exists. If none, auto-create:

```
email:              operator@chapter.com
password:           operator123   (bcrypt-hashed)
role:               operator
access:             ["*"]
mustChangePassword: true            (bootstrap operator should rotate immediately)
inviteExpiresAt:    now + 24h
```

This solves the chicken-and-egg of the first admin. Bootstrap must be **idempotent** — runs on every start but only creates if missing. Because `mustChangePassword: true`, the bootstrap operator will be forced through the same change-password flow as any invited user on their first real login.

---

## Permission System

Format: `module:action` (e.g. `waitlist:read`, `stats:read`).

Supported patterns:
- `*` — global wildcard, full access
- `module:*` — wildcard for all actions in a module
- `module:action` — exact match

### Utility

```
hasPermission(userPermissions: string[], required: string): boolean
```

Must support all three patterns above.

### Default `access` per role

```
Operator:  ["*"]

SuperUser: [
  "dashboard:*",
  "users:*",
  "orders:*",
  "analytics:*",
  "waitlist:*",
  "stats:*",
  "admins:*"
]

Admin:     ["orders:read", "orders:update", "analytics:read"]
```

(Module list will grow as features are added — defaults are the starting seed only.)

### Permission modules (initial set)

```
operators, superusers, admins     — admin management
waitlist, stats                   — existing data routes
dashboard, users, orders, analytics — placeholder modules for future features
```

---

## Middleware

Two distinct middlewares:

1. **Authentication** — verifies the JWT from the `Authorization` header, loads the user, attaches to `req.user`. Rejects with 401 if invalid/missing.

2. **Authorization (`permit`)** — takes a required permission string, checks `req.user.access` via `hasPermission()`. Rejects with 403 if not allowed.

```
router.get("/api/stats", authenticate, permit("stats:read"), getStats);
```

**No hardcoded role checks anywhere.** Never `if (role === "admin")`. Always `hasPermission()` via `permit()`.

The `authenticate` middleware additionally enforces that `mustChangePassword === false` — i.e. invite-pending users cannot access protected routes with a stale token. (Pending users only get a `firstLoginToken`, which is purpose-restricted to `complete-invite` anyway, so this is belt-and-suspenders.)

---

## Existing Routes — Protection Plan

### `/api/waitlist`
- `POST /api/waitlist` — **public** (lives in waitlistRoutes, called from the landing page form)
- `GET  /api/waitlist`        → `authenticate` + `permit("waitlist:read")`
- `GET  /api/waitlist/:id`    → `authenticate` + `permit("waitlist:read")`
- `PUT  /api/waitlist/:id`    → `authenticate` + `permit("waitlist:update")`
- `DELETE /api/waitlist/:id`  → `authenticate` + `permit("waitlist:delete")`

### `/api/stats`
- `GET /api/stats` → `authenticate` + `permit("stats:read")`

### `/api/email` — **removed**
The `emailController` + `emailRoutes` are removed. The new public waitlist-create route (`POST /api/waitlist`) handles the signup, then calls the email service internally to send the welcome email.

---

## Email Module

New top-level `email/` directory — generic mailer reusable across all flows (waitlist welcome, admin invite, password reset, future).

```
email/
  templates/
    waitlist.ts                  (existing welcome template moves here, no behavior change)
    chapterAdminInvitation.ts    (new — contains email + temp password + login link + 24h expiry note)
    passwordReset.ts             (new — contains reset link + 10 min expiry note)
  mailer.ts                      (nodemailer transport + sendEmail function)
  index.ts                       (public exports)
```

`mailer.ts` exposes a generic `sendEmail({ to, subject, html })`. Any controller/service imports it and pairs it with whatever template is needed.

### Template contents (basic HTML, brand-light for now — can be styled later)

**`chapterAdminInvitation.ts`** — sent on admin/superuser/operator creation and resend
- Greeting + role context ("You've been invited as a SuperUser to the Chapter admin dashboard")
- Credentials block: email + temp password (monospace, clearly delimited)
- Login link → `{FRONTEND_URL}/login`
- Warning: "This invitation expires in 24 hours. You will be required to change your password on first login."
- Sign-off

**`passwordReset.ts`** — sent on forgot-password / change-password request
- Greeting
- "We received a request to reset your Chapter admin password."
- CTA button + plaintext fallback link → `{FRONTEND_URL}/reset-password?token=<rawToken>`
- "This link expires in 10 minutes."
- "If you didn't request this, you can safely ignore this email."
- Sign-off

Both templates take a typed params object (e.g. `{ name?: string, email: string, tempPassword: string, loginUrl: string, expiresInHours: number }` for the invite). Styling is minimal inline CSS, matching the existing `waitlist.ts` template style.

---

## Folder Structure

```
chapter-admin-mock-server/
  index.ts
  db/
    connection.ts
  models/
    WaitlistUsers.ts
    ChapterAdmins.ts          (new)
  controllers/
    waitlistController.ts
    statsController.ts
    authController.ts         (new — login, refresh, logout, complete-invite, request-reset, reset-password)
    operatorsController.ts    (new — CRUD + resend-invite for operator role)
    superusersController.ts   (new — CRUD + resend-invite for superuser role)
    adminsController.ts       (new — CRUD + resend-invite for admin role)
  routes/
    waitlistRoutes.ts
    statsRoutes.ts
    authRoutes.ts             (new)
    operatorsRoutes.ts        (new)
    superusersRoutes.ts       (new)
    adminsRoutes.ts           (new)
  middleware/
    authenticate.ts
    permit.ts
  utils/
    hasPermission.ts
    jwt.ts                    (sign/verify helpers for access, refresh, firstLogin tokens)
    resetToken.ts             (generate/hash/verify reset tokens)
    generatePassword.ts       (crypto-random temp password generator for invites)
  constants/
    permissions.ts            (module/action constants)
    roles.ts                  (role + default-access constants)
  seeders/
    operatorSeeder.ts         (idempotent bootstrap, called from index.ts)
  email/
    templates/
      waitlist.ts
      chapterAdminInvitation.ts
      passwordReset.ts
    mailer.ts
    index.ts
```

Note: the three admin-management controllers can share a single factory (e.g. `makeAdminCrudController(role)`) to avoid copy-paste — final structure is an implementation detail.

---

## Rules

1. **No hardcoded role checks.** Always use `hasPermission()` / `permit()`.
2. Authorization logic lives in middleware, not controllers.
3. Use `bcrypt` for password hashing.
4. Use JWT (access + refresh + firstLogin).
5. **Match the existing codebase style** — terse, comments only where the *why* is non-obvious. No verbose docstrings.
6. TypeScript strict mode; no `any` unless unavoidable.
7. Permission strings come from constants, not magic strings scattered in routes.
8. Admin-management controllers scope queries by `role` to prevent cross-role leakage via guessed IDs.
9. Temp passwords are **never** returned in API responses, only sent via email.
10. The plaintext temp password is logged nowhere (no `console.log`, no audit record stores it).

---

## Out of Scope (for now)

- Rate limiting on login + reset-request + invite-create (deferred)
- Account lockout / failed-attempt tracking (deferred)
- Email verification for the admin's email address itself (deferred — the invite flow implicitly verifies it on first login)
- Separate `Users` model for application end-users (deferred)
- Multi-factor authentication (deferred)
- Audit log of admin actions (deferred)
- Scheduled cleanup of permanently-expired invited admins (deferred — left as manual op)

---

## Required Env Vars

```
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m              (suggested)
JWT_REFRESH_TTL=7d              (suggested)
JWT_FIRST_LOGIN_TTL=10m         (suggested)
BCRYPT_ROUNDS=12                (suggested)
RESET_TOKEN_TTL_MIN=10          (10 minutes per spec)
INVITE_EXPIRY_HOURS=24          (24 hours per spec)
FRONTEND_URL=https://admin.chapter.dev   (used to build login + reset links)
SMTP_USERNAME=...               (already declared; activate now)
SMTP_PASSWORD=...
DB_URL=...                      (already used)
CORS_ORIGINS=...                (already used)
```

---

## Implementation Output

When implementing, deliver:
- Full `ChapterAdmins` model (with invite + reset token fields)
- `authenticate` + `permit` middlewares
- `hasPermission` utility with all three matching patterns
- `permissions.ts` + `roles.ts` constants
- `generatePassword.ts` utility (crypto-random temp password)
- Operator seeder wired into startup
- Auth controller: `login`, `refresh`, `logout`, `complete-invite`, `request-password-reset`, `reset-password`
- Operator/SuperUser/Admin CRUD controllers + routes (auto-generated-password invite flow + resend-invite)
- Updated waitlist + stats routes with middleware applied
- Refactored `email/` module + new `chapterAdminInvitation` and `passwordReset` HTML templates
- No pseudo-code — working TypeScript only
