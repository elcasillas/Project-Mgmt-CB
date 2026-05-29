# Technology Stack

Northstar PM is a Cloudflare-first project management application built with Next.js 15 App Router, strict TypeScript, Tailwind CSS v3, Cloudflare D1 SQLite, Cloudflare R2, and OpenNext for Cloudflare Workers.

## Core Stack

| Technology | Version / Target | Usage |
|---|---:|---|
| Next.js | 15.5.18 | App Router, layouts, route handlers, middleware, typed routes |
| React | 18.3.1 | Server and client component rendering |
| TypeScript | 5.9.3 strict mode | Static typing across app code, server actions, routes, and utilities |
| Tailwind CSS | 3.4.19 | Primary styling system |
| Cloudflare D1 | SQLite | Primary relational datastore through `env.DB` |
| Cloudflare R2 | Worker binding | Project attachment storage and OpenNext incremental cache |
| OpenNext for Cloudflare | 1.19.11 | Builds and adapts the Next.js app for Cloudflare Workers |
| Wrangler | 4.95.0 | D1 migrations, local preview, deploys, and binding workflow |
| React Hook Form | 7.76.1 | Form state and validation lifecycle |
| Zod | 4.4.3 | Runtime validation schemas |

## Data Layer

- `lib/db.ts` exposes a thin D1 helper around `env.DB.prepare(...).bind(...).run/all/first`.
- All server-side SQL uses parameter binding for values.
- D1 migrations live in `migrations/`.
- Local seed data lives in `seed/d1-local.sql`.
- Attachments store metadata in D1 and file bytes in the `PROJECT_FILES` R2 binding.

## Auth

Authentication is D1-backed and Cloudflare-compatible:

- `profiles.password_hash` stores a SHA-256 password hash for managed users.
- `sessions` stores HTTP-only session ids and expiration timestamps.
- `lib/auth/session.ts` resolves the current user from the `pm_session` cookie.
- Middleware checks for the session cookie before protected routes; app layout validates the session against D1.

## Deployment

- Production Worker service: `project-mgmt-cb`
- Worker config: `wrangler.toml`
- OpenNext config: `open-next.config.ts`
- D1 binding: `DB`
- Attachment R2 binding: `PROJECT_FILES`

Primary scripts:

- `npm run d1:create`
- `npm run d1:migrations:apply:local`
- `npm run d1:migrations:apply:production`
- `npm run d1:seed:local`
- `npm run cf:build`
- `npm run cf:preview`
- `npm run cf:deploy`

## Not In Use

- External backend client libraries
- Prisma or another ORM
- Dedicated global state library
- Container-based local development
