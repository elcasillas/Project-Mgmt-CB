# D1 Migration Summary

## Changes Made

- Removed previous backend client packages from `package.json`.
- Removed previous backend helper modules.
- Added D1 migrations under `migrations/`.
- Added a SQLite-compatible schema for profiles, sessions, workspace settings, projects, project members, tasks, task dependencies, comments, attachments, and activity logs.
- Added D1 indexes for task dates, project id, owner id, status, priority, and created/updated timestamps.
- Added local D1 seed data under `seed/d1-local.sql` for demo users, projects, tasks, dependencies, comments, and activity.
- Added `lib/db.ts` as a thin D1 helper using prepared statements.
- Added D1-backed auth/session helpers in `lib/auth/session.ts`.
- Refactored server-side queries, server actions, API routes, middleware, and layout auth checks to D1.
- Moved attachment file bytes to the `PROJECT_FILES` R2 binding and attachment metadata to D1.
- Updated Wrangler configuration with D1 and R2 bindings.
- Updated documentation for D1 migrations, local seeding, preview, and production deployment.

## Preserved Behavior

- Projects CRUD and archiving.
- Tasks CRUD.
- Calendar/task views continue to receive the same task model shape and revalidate `/calendar` after edits.
- Inline status and priority updates.
- Owners/users directory and admin user management.
- Comments.
- Workspace notification settings.
- Dashboard metrics and recent activity.

## Limitations

- Password hashing uses Web Crypto SHA-256 for a simple Cloudflare-compatible managed-auth abstraction. A production system should move to a stronger password hashing strategy at the edge.
- D1 does not provide row-level security or database triggers. Authorization and project progress recalculation now happen in application code.
- Realtime behavior from the previous backend is not present; pages rely on standard navigation/revalidation.
- Attachments require the `PROJECT_FILES` R2 bucket to exist before upload works.
- The current repo does not contain Accounts, Contacts, or AI feature modules/routes to migrate.

## Required Production Setup

- Run `npm run d1:create` and copy the generated database id into `wrangler.toml`.
- Create R2 bucket `project-mgmt-cb-files`.
- Create R2 bucket `project-mgmt-cb-opennext-cache`.
- Run `npm run d1:migrations:apply:production`.
- Deploy with `npm run cf:deploy`.

## Validation Completed

- `npm run type-check`
- `npm run lint` (passes with the existing calendar hook dependency warning)
- `npm run build`
- `npm run cf:build`
- `npm run d1:migrations:apply:local`
- `npm run d1:seed:local`
- `wrangler deploy --dry-run`
- Local D1 count query verified 4 profiles, 3 projects, and 5 tasks after seed.
