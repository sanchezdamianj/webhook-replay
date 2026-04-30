# Webhook Monitor + Replay (monorepo)

Monorepo for a webhook ingest gateway, a Node.js/TypeScript core API (business logic, replays, worker), and a Next.js app (dashboard). PostgreSQL and Redis are shared.

## Layout

| Path | Stack | Role |
|------|--------|------|
| `apps/gateway` | Node (Express) | Public ingest (`POST /webhook/:id`), low-latency edge |
| `apps/core-api-ts` | Node (Fastify + Drizzle + BullMQ + Socket.IO) | REST API + replay queue + realtime attempt updates |
| `apps/web` | Next.js (App Router) | Dashboard |
| `docker-compose.yml` | — | Local Postgres, Redis, `core-api`, `worker`, `gateway`, `web` |

## Port map (local Docker Compose)

| Service | Port | Notes |
|---------|------|--------|
| **core-api** (Node/TS) | 3000 | Health: `GET /v1/status` — JSON `{"ok":true,"service":"core-api"}` |
| **gateway** (Express) | 3001 | `GET /health`, `POST /webhook/:id` |
| **web** (Next.js) | 3002 | Dev server, mapped from container 3000 |
| **Postgres** | 5432 | User/db/password: `webhook_replay` / `webhook_replay` / `webhook_replay_development` |
| **Redis** | 6379 | BullMQ + realtime pub/sub |

## Quick start (Docker Compose)

From the repository root:

```bash
docker compose build
docker compose up
```

- **Core API:** <http://localhost:3000/v1/status>
- **Gateway:** <http://localhost:3001/health>
- **Next.js:** <http://localhost:3002>
- **Receiver (replay target):** <http://localhost:4000/health>

`gateway`, `core-api` and `web` use named volumes for `node_modules` and run `pnpm install` on start so the bind mounts to your working tree work without polluting the host (you can also run them outside Docker; see below).

## Demo smoke test (5 minutes)

With `docker compose up` running, in another terminal:

```bash
./scripts/smoke.sh
```

This will:
- create a Destination pointing at the in-compose receiver (`http://receiver:4000/echo`)
- ingest one webhook event via the gateway
- trigger a replay via the core API (worker)
- print the receiver's last request (`GET /last`)

## Quick start (host, without Docker)

### Prerequisites

- Node 22+ (Corepack) + pnpm
- Postgres + Redis running locally (or via Docker)

### Node.js (gateway + web)

From the repository root:

```bash
corepack enable
pnpm install
```

Run dev servers:

- **web:** `pnpm dev:web` from the repo root, or `pnpm -C apps/web dev`
- **gateway:** `pnpm dev:gateway` from the repo root, or `pnpm -C apps/gateway dev`
- **core-api:** `pnpm dev:core-api` from the repo root, or `pnpm -C apps/core-api-ts dev`
- **worker:** `pnpm dev:worker` from the repo root, or `pnpm -C apps/core-api-ts dev:worker`

## Conventions (from the plan)

- **Schema ownership:** database migrations are owned by the project (historically Rails); the gateway must only write to agreed tables and does not run migrations.
- **Payload size:** the gateway enforces a configurable max body size (default 1MB via `MAX_BODY_BYTES`).

## License

Private / unlicensed until you add one.
