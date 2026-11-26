# Contributing to Transfer Guard

Transfer Guard is an educational wire-transfer simulator. Contributions should keep its sample policy explainable and preserve the boundary between simulation and real payments.

## Local setup

1. Fork the repository and clone your fork.
2. Install Bun 1.3.14 or newer and run `bun install --frozen-lockfile`.
3. Copy `.env.template` to `.env` (`Copy-Item .env.template .env` in PowerShell).
4. Run `bun run db:migrate`, then `bun run dev`.

Demo mode does not need AWS credentials. See the [README](README.md) for sample requests and optional Bedrock configuration. Use fictional data only.

## Before opening a pull request

Run these commands from the project root:

```sh
bun test packages/web/tests
bun run --filter @template/web build
```

Run `bun run lint` in a POSIX shell for the managed Runable checks. If a check cannot run or fails for an existing reason, include the command and the limitation in the PR rather than claiming it passed.

- Keep changes focused and follow the surrounding TypeScript and UI conventions.
- Add focused tests for changed policy or Bedrock behavior. Mock AWS calls; do not introduce credential-dependent tests.
- Update setup documentation and `.env.template` when configuration changes.
- Include migrations for database schema changes. Do not commit database files.
- Keep `.env`, access keys, personal data, generated output, and dependencies out of commits.
- Leave platform-managed `__` files and release metadata alone unless the change specifically requires them; see [.runable/README.md](.runable/README.md).

Use a descriptive PR title, explain the user-visible change, and record the commands you actually ran. Include before/after screenshots for UI changes when useful, with fictional data and no credentials.

## Issues and discussion

For bugs, include reproduction steps, expected and actual behavior, and your OS and Bun version. For features, describe the problem first and explain how the proposal fits a simulator.

Discuss changes that introduce real payment integrations, change policy semantics, or expand the supported platforms before implementing them. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## Licensing

The repository does not currently declare a project license. Do not add or change licensing terms without the repository owner's approval. Keep third-party attribution intact.
