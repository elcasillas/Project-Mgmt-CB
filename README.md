# Northstar PM

Project management web app built with Next.js 15 App Router, strict TypeScript, Tailwind CSS v3, Cloudflare D1, Cloudflare R2, and OpenNext for Cloudflare Workers. The app deploys to the existing Cloudflare Worker service `project-mgmt-cb`.

## Stack

- Next.js 15 App Router
- React 18
- TypeScript strict mode
- Tailwind CSS v3
- Cloudflare D1 SQLite through the `env.DB` binding
- Cloudflare R2 for project attachments
- OpenNext for Cloudflare Workers
- React Hook Form
- Zod

## Local Setup

Install dependencies:

```bash
npm install
```

Create the local D1 database, apply migrations, and seed demo data:

```bash
npm run d1:migrations:apply:local
npm run d1:seed:local
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Demo Users

All seeded accounts use `Password123!`.

- `admin@northstarpm.com`
- `manager@northstarpm.com`
- `member@northstarpm.com`
- `viewer@northstarpm.com`

## Cloudflare Commands

```bash
npm run d1:create
npm run d1:migrations:apply:local
npm run d1:migrations:apply:production
npm run d1:seed:local
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

After `npm run d1:create`, copy the generated database id into [wrangler.toml](/mnt/f/AI/project-mgmt-cb/wrangler.toml).

## Project Structure

- [app](/mnt/f/AI/project-mgmt-cb/app): App Router pages, layouts, API routes
- [components](/mnt/f/AI/project-mgmt-cb/components): reusable UI, layouts, and feature components
- [lib/db.ts](/mnt/f/AI/project-mgmt-cb/lib/db.ts): thin D1 helper layer
- [lib/auth/session.ts](/mnt/f/AI/project-mgmt-cb/lib/auth/session.ts): D1-backed session/auth helpers
- [lib/actions](/mnt/f/AI/project-mgmt-cb/lib/actions): server actions for auth, users, and workspace CRUD
- [lib/data](/mnt/f/AI/project-mgmt-cb/lib/data): D1-backed query functions
- [migrations](/mnt/f/AI/project-mgmt-cb/migrations): D1 schema migrations
- [seed](/mnt/f/AI/project-mgmt-cb/seed): local D1 seed data

## Deployment

See [DEPLOYMENT.md](/mnt/f/AI/project-mgmt-cb/DEPLOYMENT.md).

## Verification

Run before review:

```bash
npm run lint
npm run type-check
npm run build
npm run cf:build
```
