# Cloudflare Deployment Guide

## Runtime Model

OpenNext builds the Next.js app into a Cloudflare Worker. The Worker handles server rendering, route handlers, middleware, server actions, and D1 access. Static assets are emitted to `.open-next/assets`.

Production deploys target:

```text
project-mgmt-cb
```

## Required Cloudflare Resources

- Worker service: `project-mgmt-cb`
- D1 database: `project-mgmt-cb`, bound as `DB`
- R2 bucket for project attachments: `project-mgmt-cb-files`, bound as `PROJECT_FILES`
- R2 bucket for OpenNext incremental cache: `project-mgmt-cb-opennext-cache`
- Service binding: `WORKER_SELF_REFERENCE` pointing to `project-mgmt-cb`
- Asset binding: `NEXT_ASSETS`

## D1 Setup

Create the database:

```bash
npm run d1:create
```

Copy the returned database id into `wrangler.toml`.

Apply migrations locally:

```bash
npm run d1:migrations:apply:local
```

Seed local data:

```bash
npm run d1:seed:local
```

Apply migrations to production:

```bash
npm run d1:migrations:apply:production
```

D1 import/export can be used for existing SQLite data with Wrangler commands such as `wrangler d1 execute <database> --file <dump.sql>` and `wrangler d1 export <database>`.

## Development

```bash
npm install
npm run d1:migrations:apply:local
npm run d1:seed:local
npm run dev
```

Use Worker preview for runtime validation:

```bash
npm run cf:build
npm run cf:preview
```

## Preview

```bash
npm run cf:build
npm run cf:preview
```

For a Pages static asset preview:

```bash
npm run cf:build
npm run cf:pages:deploy
```

Dynamic behavior still depends on the Worker bundle.

## Production

```bash
npm run lint
npm run type-check
npm run build
npm run cf:build
npm run d1:migrations:apply:production
npm run cf:deploy
```

Validate the deploy package without publishing:

```bash
XDG_CONFIG_HOME=/tmp/wrangler-config npx wrangler deploy --dry-run --outdir /tmp/project-mgmt-cb-worker-dry-run
```

## Smoke Checks

- Login and logout with seeded or managed users.
- Dashboard loads project/task metrics.
- Projects create, update, archive, and show owner/member data.
- Tasks create, update, delete, and preserve calendar month/day selection after edits.
- Inline task status and priority updates persist.
- Comments persist.
- Attachment upload writes to R2 and metadata writes to D1.
- Notification preferences persist in `workspace_settings`.
