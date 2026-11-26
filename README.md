# Transfer Guard

**Explainable wire-transfer policy checks, without moving real money.**

Transfer Guard is an educational web simulator for fictional wire transfers. Enter a request in chat, review the server's policy decision, and inspect the explanation in an audit trail.

> **Simulation only:** This project does not connect to a bank, execute payments, provide legal advice, or use a live sanctions list. Never enter real banking details, personal data, or AWS credentials in the UI.

## Project status

The application and its detailed documentation are currently on [`feat/transfer-guard`](https://github.com/ssabat/transferguard/tree/feat/transfer-guard), pending [PR #1](https://github.com/ssabat/transferguard/pull/1).

The default branch, `main`, contains this project overview. Until the application PR is merged, use the branch-specific quick start below rather than cloning the default branch to run the app.

## What you can try

- **Demo mode:** Simulate fictional transfers without an AWS account or API key.
- **Server-side policy checks:** Validate amounts, recipients, and destinations against deterministic sample rules, including an inclusive $10,000 limit.
- **Explainable decisions:** Inspect approval or blocking reasons and the source of each decision in the audit log.
- **Persistent sessions:** Keep chat and audit records in local SQLite or Turso. A new session does not delete existing records.
- **Optional AWS Bedrock mode:** Use a Bedrock agent with Return Control while retaining the same server-side policy checks.

The supported application is the web app. Desktop and mobile workspaces are scaffolds, not supported simulator releases.

## Quick start

Install Git and [Bun](https://bun.sh/docs/installation) 1.3.14 or newer, then run:

```sh
git clone --branch feat/transfer-guard https://github.com/ssabat/transferguard.git
cd transferguard
bun install --frozen-lockfile
cp .env.template .env
bun run db:migrate
bun run dev
```

In Windows PowerShell, replace `cp .env.template .env` with:

```powershell
Copy-Item .env.template .env
```

Skip the copy if you already have a configured `.env`. Open **http://localhost:4200**. Demo mode starts without AWS credentials and does not move real money.

| Fictional request | Expected result |
| --- | --- |
| `Send $5,000 to Alice in Canada` | Approved in the simulator |
| `Send $10,000 to Alice in CAN` | Approved at the inclusive limit |
| `Send $10,000.01 to Bob in Germany` | Blocked: amount over the sample limit |
| `Send $750 to Alex in Somalia` | Blocked: restricted sample destination |
| `Send $500 to Jo in Atlantis` | Blocked: unverified destination |

## Documentation and development

The application branch includes a React and TypeScript UI, Hono/oRPC API, deterministic policy engine, AWS Bedrock adapter, Drizzle migrations, and Bun tests.

- [Full user guide and architecture](https://github.com/ssabat/transferguard/blob/feat/transfer-guard/README.md)
- [Optional AWS Bedrock setup](https://github.com/ssabat/transferguard/blob/feat/transfer-guard/README.md#aws-bedrock-optional)
- [Contribution guidelines](https://github.com/ssabat/transferguard/blob/feat/transfer-guard/CONTRIBUTING.md)
- [Security policy](https://github.com/ssabat/transferguard/blob/feat/transfer-guard/SECURITY.md)
- [Application pull request](https://github.com/ssabat/transferguard/pull/1)

From the cloned application branch, run:

```sh
bun test packages/web/tests
bun run --filter @template/web build
```

Bedrock tests use a mocked runtime; a live AWS integration requires your own authorized agent and credentials. Keep server secrets in `.env` or a deployment secret store, never in browser code or commits.

## Feedback and security

Report reproducible bugs and focused suggestions through [GitHub issues](https://github.com/ssabat/transferguard/issues). Use fictional examples and remove secrets from logs or screenshots.

Report vulnerabilities through [private vulnerability reporting](https://github.com/ssabat/transferguard/security/advisories/new), not public issues.

## License

No project license has been selected. Public source visibility does not grant a general license to use, modify, or redistribute this code. Third-party dependencies retain their respective licenses.
