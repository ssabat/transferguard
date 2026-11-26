# Security policy

## Project boundaries

Transfer Guard is an educational prototype, not a production banking or compliance system. There are no production support or security-response guarantees, and no versioned security-support policy yet.

- Use fictional names and transfers only. The app does not move real money.
- Sample destination rules are not a live sanctions list or legal guidance.
- Demo mode does not need AWS access. Bedrock mode uses a server-side AWS identity and a separate sandbox access key.
- Chat and audit records are persisted. Starting a new session does not delete existing database rows.
- Do not expose the app publicly with real credentials or sensitive data without an independent deployment review.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/ssabat/transferguard/security/advisories/new) to send a report to the maintainers. Do not post exploit details, credentials, or sensitive records in public issues or pull requests.

Include the affected commit, reproduction steps using fictional data, expected impact, and a suggested mitigation if known. Remove secrets and identifying information from logs and screenshots.

If private reporting is unavailable, do not open a public vulnerability issue. Use a private contact channel made available by the maintainer before sharing sensitive details.

## Credentials

Keep server configuration in a local `.env` or your deployment's secret store. Never prefix AWS credentials or `BEDROCK_SANDBOX_KEY` with `VITE_`, put them in browser code, or commit them.

If a credential is exposed, revoke or rotate it with the issuing provider immediately. Deleting a file or closing an issue does not revoke a credential.
