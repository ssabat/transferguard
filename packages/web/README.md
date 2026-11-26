# Transfer Guard web application

The supported Transfer Guard simulator: a React frontend, Hono/oRPC API, deterministic policy engine, optional AWS Bedrock integration, and Drizzle persistence.

This is a simulator only. Use fictional data; it does not move money or provide production compliance guarantees.

## Run locally

Run these commands from the **repository root**, not this workspace:

```sh
bun install --frozen-lockfile
cp .env.template .env
bun run db:migrate
bun run dev
```

In PowerShell, use `Copy-Item .env.template .env` instead of `cp`. Skip the copy if `.env` is already configured. Open http://localhost:4200.

Development uses Vite with an API middleware plugin. Demo mode requires no AWS credentials. See the [root README](../../README.md) for examples, database configuration, and Bedrock setup.

## Tests and production build

From the repository root:

```sh
bun test packages/web/tests
bun run --filter @template/web build
```

The build writes the frontend to `packages/web/dist`. To serve the built app and API together:

```sh
cd packages/web
bun --env-file=../../.env src/server.ts
```

PowerShell: use `Set-Location packages\web` for the directory change. The production server uses `Bun.serve`, defaults to http://localhost:3000, and accepts a `PORT` environment variable. Its health endpoint is `/api/health`.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/web` | React pages, UI components, client queries, and styles |
| `src/api/routes` | API handlers |
| `src/api/services` | Policy checks and Bedrock Return Control |
| `src/api/database` | Database client and schema |
| `drizzle` | Committed migrations |
| `tests` | Policy and mocked Bedrock behavior tests |

Keep environment configuration at the repository root. Files prefixed with `__` are platform-managed; see [the managed-template guide](../../.runable/README.md) before changing them.
