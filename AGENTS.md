# AGENTS.md

## Repository Shape

Veges is a React/Vite client and Express/PostgreSQL server shipped as one Node 24
container. Read `docs/architecture.md` before changing cross-module behavior,
`docs/references.md` for current interfaces and environment variables, and
`docs/runbook.md` before runtime or deployment work. The early PRD under `docs/` is
historical product context; current code and these operational docs take precedence.

## Ownership Boundaries

- Keep browser behavior in `src/`; database access, secrets, authorization, and external
  credentials belong in `server/`.
- `server/index.ts` owns HTTP trust boundaries. Every protected route must authenticate,
  and every nested project resource must be joined or checked against the authorized
  project ID.
- `server/schema.ts` owns database constraints. Application validation improves errors;
  database uniqueness and foreign keys preserve integrity under concurrency.
- Multi-table mutations must use one `PoolClient` transaction. Validate the complete
  request before the first write and roll back every partial failure.
- Keep client contracts in `src/api.ts` and `src/types.ts` synchronized with server
  response shapes.
- Keep document editors on the existing Markdown string contract. When registering
  `CodeBlockLowlight`, disable StarterKit's plain code block, preserve fenced-language
  metadata, highlight only an explicit supported language, and normalize link marks to
  HTTP or HTTPS before parsing or saving them.

## Security And Data Invariants

- Never commit or log database URLs, session tokens, encryption keys, AI keys, Feishu
  secrets, OSS credentials, or signed URLs.
- Sensitive project text must use `encryptText` on write and `decryptText` on read. New
  encrypted columns require an idempotent `db:encrypt-existing` path for legacy rows.
  Retain old keys while any stored envelope references them.
- Do not weaken AI URL validation: HTTPS only, no embedded credentials, public DNS/IPs
  only, and no redirect following.
- Do not sign or fetch arbitrary OSS object keys. Package keys must match configured
  rules/templates; todo images use their dedicated prefix and HMAC signature.
- Feishu event challenges and events require the verification token. Conversation
  analysis requires configured Basic authentication.
- Concurrency invariants belong in PostgreSQL unique indexes plus conflict-safe SQL, not
  select-before-insert checks alone.

## Database Safety

Never execute database writes unless the user explicitly authorizes them. Starting
`server/index.ts`, `npm run dev:api`, `npm run db:init`, and
`npm run db:encrypt-existing` all mutate the configured database because startup applies
`schemaSql`. Do not point local verification at production.

## Verification

Use current, non-database checks first:

```bash
npm run build
npm run lint
git diff --check
```

For scoped work, run ESLint against the touched TypeScript files. There is currently no
automated test suite; do not claim database, OSS, Feishu, browser, or deployment behavior
is verified unless that surface was exercised in an authorized environment.

## Deployment

- Production container images default to `linux/amd64`; publish ARM only when explicitly
  requested.
- Use immutable image tags or digests. Keep both image references in the Sealos template
  aligned and verify the live workload image after deployment.
- `.sealos/build/build-result.json` and `.sealos/state.json` are receipts, not proof of
  current source or runtime state.
- App rollback does not roll back PostgreSQL. Keep a pre-release database snapshot and
  the complete encryption key ring for any deploy-affecting schema or encryption change.
- Do not deploy, publish, run migrations, or mutate production without explicit approval.
