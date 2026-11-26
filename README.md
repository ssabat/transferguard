# Transfer Guard

**Explainable wire-transfer policy checks, without moving real money.**

[![CI](https://github.com/ssabat/transferguard/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ssabat/transferguard/actions/workflows/ci.yml)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black)](https://bun.sh)
[![Language: TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6)](https://www.typescriptlang.org)

Transfer Guard is a full-stack wire-transfer **simulator**. It does not connect to a bank or move money. Use fictional details in both modes. The sample rules aren’t a live sanctions list.

> **Scope:** An educational prototype, not banking software, legal advice, or a production compliance service. The web app is supported; mobile and desktop workspaces are scaffolds.

## Highlights

- **No-account demo:** Try fictional transfers without AWS credentials or an API key.
- **Deterministic decisions:** Server-side checks enforce the inclusive $10,000 sample limit, validate amounts and recipients, and normalize destination countries.
- **Explainable audit trail:** Inspect each decision, its reason, and whether it came from Demo or AWS Bedrock mode.
- **Optional agent integration:** AWS Bedrock Return Control uses the same policy engine; model prose cannot override a server-side decision.
- **Persistent sessions:** Chat and audit records are stored through Drizzle with local SQLite or Turso.

## Contents

[Quick start](#quick-start) · [AWS Bedrock](#aws-bedrock-optional) · [Development](#development) · [Troubleshooting](#troubleshooting) · [Architecture](#architecture) · [Contributing](#contributing) · [Security](#security) · [License](#license)

## Quick start

**Prerequisites:** Git and [Bun](https://bun.sh/docs/installation) 1.3.14 or newer. CI uses the pinned package-manager version in `package.json`.

**macOS / Linux**

```sh
git clone https://github.com/ssabat/transferguard.git
cd transferguard
bun install --frozen-lockfile
cp .env.template .env
bun run db:migrate
bun run dev
```

**Windows PowerShell**

```powershell
git clone https://github.com/ssabat/transferguard.git
Set-Location transferguard
bun install --frozen-lockfile
Copy-Item .env.template .env
bun run db:migrate
bun run dev
```

If you already have a clone, start from its project root and skip the clone and directory-change commands. Skip the environment-file copy if you already have a configured `.env`. The included database URL is relative to `packages/web`, where both the migration and dev commands run; it creates `transfer-guard.db` at the project root. For an existing Turso database, set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `.env` before migrating.

Open **http://localhost:4200**. The app starts in **Demo mode** with no cloud account or API key. Select a suggested request (it fills the input), then click Send or press Enter. The **Audit log** shows the reason for each decision; click an entry to expand it.

| Try this in chat | Expected result |
| --- | --- |
| `Send $5,000 to Alice in Canada` | Approved in the simulator; a `SIM-` reference appears |
| `Send $10,000 to Alice in CAN` | Approved at the exact inclusive limit |
| `Send $10,000.01 to Bob in Germany` | Blocked: amount over limit |
| `Send $750 to Alex in Somalia` | Blocked: restricted destination |
| `Send $500 to Jo in Atlantis` | Blocked: unverified destination |

Chat and audit records survive page reloads in the current tab. **New session** starts a separate audit trail, not a deletion of stored rows.

## AWS Bedrock (optional)

You need an AWS account, a Bedrock agent in a supported region, access to the model selected for that agent, and permission to invoke the agent alias. AWS may charge for live calls.

1. In the AWS console, create or open an **Amazon Bedrock Agent**. Add an action group named `TransferCompliance`. Choose **Define with function details** and **Return control** for execution. Do not attach a Lambda or bank/payment integration.
2. Create the following function with **required string** parameters. Names are case-sensitive:

   | Function | Parameter | Purpose |
   | --- | --- | --- |
   | `evaluate_transfer` | `amount` | USD amount as text (e.g. `5000.00`) |
   | | `destination_country` | Country name or ISO alpha-2/alpha-3 code |
   | | `recipient` | Fictional recipient name |

   Suggested agent instruction: “You assist with simulated wire-transfer policy checks. Ask for any missing amount, recipient, or destination. When all three are present, call `evaluate_transfer` in `TransferCompliance`. Report the server's result without changing it. Never claim that real funds moved.”
3. **Prepare** the agent and create or update a **deployed alias** that points to the version with this action group. Copy the agent ID and alias ID (not their names). The Python `setup_agent` file supplied with the original samples duplicates the sample backend; it does not deploy an agent.
4. Give the app's server an AWS identity via the SDK's default credential chain. Use a runtime IAM role on AWS or an authorized AWS CLI profile locally. Grant `bedrock:InvokeAgent` on `arn:aws:bedrock:<region>:<account-id>:agent-alias/<agent-id>/<alias-id>` (adjust the ARN partition if applicable). This caller permission is separate from the agent service role used by Bedrock. With IAM Identity Center, for example:

   ```sh
   aws sso login --profile transfer-guard
   export AWS_PROFILE=transfer-guard
   ```

   PowerShell: `$env:AWS_PROFILE = 'transfer-guard'`. Start Bun from that same terminal. Never paste AWS credentials into the app UI.
5. In the root `.env`, keep the database settings and set the four Bedrock values:

   ```dotenv
   AWS_REGION=us-east-1
   BEDROCK_AGENT_ID=<your-agent-id>
   BEDROCK_AGENT_ALIAS_ID=<your-agent-alias-id>
   BEDROCK_SANDBOX_KEY=<your-private-key-at-least-24-characters-long>
   ```

   Use the agent's actual region, replace each angle-bracket placeholder, and generate the private sandbox key in your terminal with `bun -e 'console.log(crypto.randomUUID() + crypto.randomUUID())'`. This key is for entering Bedrock mode in the app; it is **not** an AWS access key. Never prefix these settings with `VITE_` or share the `.env` file.
6. Restart `bun run dev`. Open the **Demo mode** menu, enter your private **Bedrock access key**, and select **Use Bedrock**. Send `Send $750 to Alex in Somalia`. A successful integration records a **Blocked** audit entry with **AWS Bedrock** as its source. Both modes enforce the same server-side rules. To switch back, open the mode menu and choose **Demo mode**. Reloading resets mode to Demo; the Bedrock key is not stored in the browser.

### If Bedrock isn’t working

- **Not configured on this server:** Check the root `.env`, agent ID, alias ID and key length; restart Bun. This availability label checks configuration, not AWS connectivity.
- **Access key is incorrect:** Re-enter the app's `BEDROCK_SANDBOX_KEY`, not an IAM credential.
- **Bedrock could not complete this request:** Check the AWS region, caller's AWS login and alias permissions, agent/model configuration, and that the alias points to an enabled action group using Return Control.
- **No server-side policy decision recorded:** Provide all three details and check that the agent actually calls `TransferCompliance.evaluate_transfer`. The app does not treat a model's free-text reply as a policy decision.

The Return of Control flow is covered by mocked tests. Live AWS connectivity must be verified with your own agent and credentials. See the AWS references for [Return Control](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-returncontrol.html) and [InvokeAgent](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_InvokeAgent.html).

## Development

From the project root, run the supported web app's checks:

```sh
bun test packages/web/tests
bun run --filter @template/web build
```

The web build runs the workspace's existing TypeScript check and Vite production build. CI runs these same commands on pull requests and pushes to `main`, without AWS credentials. Bedrock tests use a mocked runtime; they do not verify a live AWS deployment.

`bun run lint` runs the repository's managed Runable checks in a POSIX shell. `bun run build` builds all workspaces, including the desktop and mobile scaffolds.

### Serve a production build

To serve the built web app after building and migrating, run these from the root:

```sh
cd packages/web
bun --env-file=../../.env src/server.ts
```

PowerShell: use `Set-Location packages\web` for the directory change. Open http://localhost:3000 and check http://localhost:3000/api/health for `{"status":"ok"}`. Set the server's `PORT` environment variable if you need a different production port. For a hosted Runable app, use **Publish** in the Runable UI.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `bun` is not recognized | Install a supported Bun binary for your OS, restart the terminal, and confirm `bun --version`. CI runs on Ubuntu; unsupported local systems may need a compatible Linux environment. |
| Missing database configuration | Create `.env` at the project root from `.env.template`, preserve any existing credentials, and restart the dev server. |
| Missing tables or first-request database errors | Run `bun run db:migrate` from the root using the same `.env` as the app. |
| Port 4200 is already in use | Stop the specific process you started on that port, or use a separate environment. The managed development port is fixed; do not edit `__ports.cjs`. |
| Production server says build output was not found | Run `bun run --filter @template/web build` from the root before starting the production server. |
| AWS Bedrock requests fail | Follow [the Bedrock troubleshooting guide](#if-bedrock-isnt-working); Demo mode does not require AWS. |

If the problem persists, open a [bug report](https://github.com/ssabat/transferguard/issues/new/choose) with your OS, Bun version, reproduction steps, and redacted logs.

## Architecture

| Layer | Technology | Location |
| --- | --- | --- |
| Web UI | React, TypeScript, Tailwind CSS, Vite | `packages/web/src/web` |
| API | Hono, oRPC, Zod | `packages/web/src/api` |
| Policy and agent integration | Deterministic rules, AWS Bedrock SDK | `packages/web/src/api/services` |
| Persistence | Drizzle, SQLite / Turso | `packages/web/src/api/database`, `packages/web/drizzle` |
| Behavior checks | Bun tests, mocked Bedrock runtime | `packages/web/tests` |
| Optional scaffolds | Expo, Electron | `packages/mobile`, `packages/desktop` |

The UI submits a proposal to the API. Demo mode parses a complete fictional request; Bedrock mode returns a structured action to the server. The policy engine evaluates the proposal, and the API persists the resulting chat and audit records. Neither path executes a payment.

`reference-samples/` contains the original Python examples for context only; the web app does not require them. `.env.template` documents server configuration. Git excludes credentials, local databases, dependency folders, caches, and generated build output.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, validation, and pull request guidelines. Use the [issue templates](https://github.com/ssabat/transferguard/issues/new/choose) for reproducible bugs and focused feature requests.

## Security

Never submit real banking details, personal data, or AWS credentials in the simulator or GitHub issues. See [SECURITY.md](SECURITY.md) for private vulnerability reporting and the project's security boundaries.

## License

No project license has been selected. Public source visibility does not grant a general license to use, modify, or redistribute this code. Third-party dependencies retain their respective licenses.
