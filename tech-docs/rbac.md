# RBAC — Backend Design

## Overview
- Single `ChapterAdmins` collection holds all back-office users (3 roles).
- Permissions are strings (`module:action`); a user's effective access is **resolved at request time** from their assigned **AdminGroup** (except Tenet → implicit full access).
- All write paths enforce a **subset rule**: nobody can grant a permission they don't possess.

---

## Roles
| Role     | Hierarchy | Default access                       | Has admin group? |
|----------|-----------|--------------------------------------|------------------|
| Tenet    | top       | `["*"]` (full)                       | no               |
| Operator | mid       | `DEFAULT_ACCESS[OPERATOR]` template  | yes (required)   |
| Partner  | bottom    | none until group assigned            | yes (required)   |

- `constants/roles.ts` → `ROLES`, `DEFAULT_ACCESS`.
- Hierarchy is **not** enforced by string comparison — it's enforced via `validateGroupRoleAuthority` + permission gates.

---

## Permission strings
- Format: `<module>:<action>` (e.g. `partners:read`, `orders:update`).
- Wildcards:
  - `"*"` → grants everything (Tenet only).
  - `"<module>:*"` → all actions on a module.
- Modules + actions live in `constants/permissions.ts` (`MODULES`, `ACTIONS`, `PERMISSIONS`).
- Match logic: `utils/hasPermission.ts`
  - exact match → true
  - `"*"` in user access → true
  - `"<module>:*"` in user access → true for any action on that module

---

## Models

### `ChapterAdmins` (`models/ChapterAdmins.ts`)
- `name, email (unique), password (hashed, select:false), phone, address`
- `role: tenet | operator | partner`
- `adminGroupId: ObjectId | null` (Tenet: always null; Operator/Partner: required)
- `mustChangePassword: boolean`, `inviteExpiresAt`
- `resetTokenHash`, `resetTokenExpiresAt` (both `select:false`)
- **No `access` field** — resolved live.

### `AdminGroups` (`models/AdminGroups.ts`)
- `name, role (operator|partner only), tags[], access[]`
- `createdBy: ObjectId → ChapterAdmins`
- Unique compound index `(name, role)`.

### `RevokedTokens` (`models/RevokedTokens.ts`)
- JTI-based refresh-token blacklist, TTL-indexed.

---

## Access resolution
`middleware/authenticate.ts` → `resolveAccess(user)`:
1. `role === TENET` → return `DEFAULT_ACCESS[TENET]` (`["*"]`).
2. `!adminGroupId` → return `[]` (effectively locked out).
3. Else load `AdminGroups.findById(adminGroupId).select("access")`; return `group.access`.

- Run once per authenticated request, attached as `req.user.access`.
- Editing a group **immediately** affects all members — no resync needed.

---

## Guards

### `validateAccessSubset(granted, creatorAccess)` (`utils/`)
- Used on: group create/update (`access[]`).
- Rejects if any granted perm isn't covered by `hasPermission(creatorAccess, perm)`.
- Returns string error or `null`.

### `validateGroupRoleAuthority(actorRole, groupRole)` (`utils/`)
| Actor    | Can manage groups for      |
|----------|-----------------------------|
| Tenet    | operator, partner           |
| Operator | partner only                |
| Partner  | nothing                     |

### `permit(permission)` middleware (`middleware/permit.ts`)
- Gate per route with the required permission string.
- Reads `req.user.access` (already resolved by `authenticate`).

### Defense-in-depth on user create/update
When assigning `adminGroupId`:
1. Group must exist.
2. `group.role === user.role` being created.
3. `validateGroupRoleAuthority(actorRole, group.role)`.
4. `validateAccessSubset(group.access, actorAccess)` — even though groups are vetted at create time, the actor's authority is rechecked here.

---

## AdminGroup lifecycle (`controllers/adminGroupsController.ts`)

### Create
- Body: `{ name, role, tags?, access }`.
- `role` ∈ `{operator, partner}`.
- Run `validateGroupRoleAuthority` + `validateAccessSubset`.
- 409 on duplicate `(name, role)`.

### Update
- `role` is **immutable** (would invalidate assigned members).
- `name, tags, access` editable; access goes through subset check.

### Delete (**blocks if in use**)
- Counts `ChapterAdmins` with `adminGroupId === group._id`.
- If `> 0` → `409` with `{ memberCount, members: [{id, email, role}] }` (first 10).
- Else delete.

### List
- Paginated; supports `search` (regex on `name`+`tags`) and `role` filter.
- Operators see only `role=partner` groups; Tenets see both.

---

## User lifecycle (`controllers/adminCrudFactory.ts`)
Factory produces `list/getById/create/update/remove/resendInvite` per role.

### Create
- Required: `name, email, password` (≥8 chars).
- Tenet: `adminGroupId` may be null.
- Operator/Partner: `adminGroupId` is required; full assignment validation runs.
- Forces `mustChangePassword: true`; sends invitation email with temp credentials.

### Update
- Profile fields editable; `adminGroupId` swappable (re-validates).
- Tenet → null only.

### Resend invite
- Only when `mustChangePassword === true`.
- Re-hashes new temp password, resets `inviteExpiresAt`.

### `serializeAdmin`
- Returns role, `adminGroupId`, and a populated `adminGroup: {id, name, role}` snippet.
- **Never** returns `access` (clients use `/api/auth/me` for that).

---

## Auth tokens (`utils/jwt.ts`)

| Token         | Purpose                                  | Stored?               |
|---------------|------------------------------------------|------------------------|
| `accessToken` | Bearer for protected routes              | client memory/storage |
| `refreshToken`| Issue new access tokens; has `jti`       | client + revocable    |
| `firstLoginToken` | One-shot, lets unactivated user POST `/api/auth/complete-invite` | not persisted |

- Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (`.env`).
- Logout revokes the refresh token by upserting its `jti` into `RevokedTokens`.

---

## Endpoint map

### Auth (`routes/authRoutes.ts`) — all public except `/me`
- `POST /api/auth/login`
- `POST /api/auth/complete-invite`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET  /api/auth/me` (authenticated)
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`

### Users (role-parameterized; one router per role)
- `tenets`, `operators`, `partners` each expose:
  - `GET    /api/<role>s`               `permit(<role>s:read)`
  - `GET    /api/<role>s/:id`           `permit(<role>s:read)`
  - `POST   /api/<role>s`               `permit(<role>s:create)`
  - `PUT    /api/<role>s/:id`           `permit(<role>s:update)`
  - `DELETE /api/<role>s/:id`           `permit(<role>s:delete)`
  - `POST   /api/<role>s/:id/resend-invite` `permit(<role>s:update)`

### Admin groups (`routes/adminGroupsRoutes.ts`)
- `GET    /api/admin-groups`           `permit(adminGroups:read)`
- `GET    /api/admin-groups/:id`       `permit(adminGroups:read)`
- `POST   /api/admin-groups`           `permit(adminGroups:create)`
- `PUT    /api/admin-groups/:id`       `permit(adminGroups:update)`
- `DELETE /api/admin-groups/:id`       `permit(adminGroups:delete)`

### Catalog (`routes/permissionsRoutes.ts`)
- `GET /api/permissions/catalog` — drives the FE access matrix; returns `{wildcard, actions, modules:[{key,label,actions,wildcard}], defaultAccess}`.

### Other gated routes
- `waitlist:*`, `stats:read`, etc. — same `authenticate` + `permit(...)` pattern.

---

## Bootstrap & migration (`seeders/tenetSeeder.ts`)
Run on every boot from `index.ts` after `connectDB()`. All steps are **idempotent**:

1. `backfillMissingNames()` — sets a fallback `name` on legacy docs missing it.
2. `dropLegacyAccessField()` — `$unset access` on any old `ChapterAdmins` doc.
3. `warnOrphanedAdmins()` — logs non-tenet docs with `adminGroupId: null`.
4. `seedTenet()` — creates `tenet@chapter.com` / `tenet123` (mustChangePassword) if no Tenet exists.

---

## Request flow (typical authed call)
1. Client sends `Authorization: Bearer <accessToken>`.
2. `authenticate`:
   - verifies JWT
   - loads user
   - rejects if `mustChangePassword` (403)
   - calls `resolveAccess(user)` → `req.user.access`
3. `permit("partners:read")` — passes/rejects on `hasPermission(req.user.access, "partners:read")`.
4. Controller runs.

---

## Files reference
- Constants: `constants/permissions.ts`, `constants/roles.ts`
- Models: `models/ChapterAdmins.ts`, `models/AdminGroups.ts`, `models/RevokedTokens.ts`
- Middleware: `middleware/authenticate.ts`, `middleware/permit.ts`
- Utils: `utils/hasPermission.ts`, `utils/validateAccessSubset.ts`, `utils/validateGroupRoleAuthority.ts`, `utils/jwt.ts`, `utils/resetToken.ts`, `utils/generatePassword.ts`
- Controllers: `controllers/authController.ts`, `controllers/adminCrudFactory.ts`, `controllers/adminGroupsController.ts`, `controllers/permissionsController.ts`, per-role thin wrappers (`tenetsController.ts`, `operatorsController.ts`, `partnersController.ts`)
- Routes: matching files under `routes/`
- Seeder: `seeders/tenetSeeder.ts`
