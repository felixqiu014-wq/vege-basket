# Runbook

## Prerequisites

- Node.js 24 and npm.
- PostgreSQL for any API runtime. Use a disposable development database locally.
- Alibaba OSS credentials only when testing package-market or todo-image workflows.
- Encryption keys generated and stored outside Git.
- A company-owned Feishu custom application whose availability scope is restricted to
  intended internal users before using OAuth as the shared-AI account bootstrap path.
- A fine-grained GitHub Token scoped only to `labring/sealos-pro` with Actions write
  permission when testing the image-sync workbench.

Use `.env.example` as a shape reference. Never commit `.env`, access keys, session
tokens, database URLs with credentials, or encryption material.

## Read-Only Verification

These commands do not connect to or mutate PostgreSQL:

```bash
npm ci
npm run build
npm run lint
npm test
git diff --check
```

For a scoped backend change, also run:

```bash
npx eslint server/index.ts server/package-market.ts server/project-package-timeline.ts server/schema.ts
```

Do not use `npm run dev:api`, `npm run db:init`, or `npm run db:encrypt-existing` as a
read-only check. Importing the running API validates encryption config and applies
`server/schema.ts` to `DATABASE_URL`.

`npm run worker:todo-digest` is also not a read-only check. It creates and updates digest
runs and may send personal Feishu messages. Run it only with an authorized database,
configured Feishu application, and explicit permission to deliver messages.

`FEISHU_AI_CHAT_ENABLED=true` makes the API callback path persist inbound Feishu messages,
apply schema additions at startup, invoke the shared AI provider, and send personal Feishu
replies. Enable it only in an authorized environment with a current database backup and a
verified bot availability scope. Keep it `false` for read-only or production-adjacent checks.

Do not submit an image-sync task during read-only verification. A real submission invokes
GitHub Actions, pulls an external image, and writes a tar plus checksum to OSS.

## Local Runtime

Only after selecting a disposable database and authorizing database writes:

```bash
npm run dev:api
npm run dev
```

The API listens on `PORT` (default `8787`); Vite serves the client and proxies `/api` to
`http://127.0.0.1:8787` during local development. A minimal runtime probe is:

```bash
curl --fail --silent http://127.0.0.1:8787/api/health
```

Expected response: `{"ok":true}`. This health endpoint proves the process is serving;
it does not prove database, OSS, Feishu, or AI workflows.

## Database Operations

Versioned incremental DDL is maintained in `server/migrations/`. Apply pending SQL
files in filename order before deploying code that references a new table, column,
constraint, or index. Each file is forward-only and transaction-wrapped; do not edit
an already-applied file. The current package-market migration sequence can be applied with:

```bash
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy.sql
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy_excluded_mode.sql
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy_shared_selection.sql
```

Select the target `DATABASE_URL`, take the required backup, and obtain explicit
authorization before running it. The command above is a database write. Keep
`server/schema.ts` in sync as the idempotent bootstrap/compatibility definition.
Do not roll an application image back to a version that predates the excluded-mode
migration while any enabled channel uses `excluded`: older code treats that unknown mode as
the permissive default. First use the current UI or API to change those policies to `all` or
`selected`, or close the affected channel. The shared-selection migration is also forward-only:
the current server mirrors a new shared range into legacy channel rows on every save, but the
migration itself preserves legacy rows unchanged. Before rolling back to a per-channel-policy
image, either resave the affected organization settings with the current version or restore the
pre-release database snapshot.

`npm run db:init` applies the current idempotent schema. `npm run db:encrypt-existing`
applies the schema and encrypts supported legacy plaintext fields. Both are mutating
operations and require explicit approval, a current backup or snapshot, the intended
`DATABASE_URL`, and the complete encryption key ring.

AI conversation changes require an authorized disposable PostgreSQL database before any runtime
claim. Apply `schemaSql` twice, then verify the conversation/turn/attachment checks and indexes,
encrypted `veges:enc:` values, two-user isolation, project-access loss and rejoin, project
deletion cascade, idempotent turn replay, one-processing-turn enforcement, expired-lease
recovery, cancel-before-create claims, cancel/retry races, and conversation deletion with
saved-summary and created-todo preservation. Also verify that a deleted conversation UUID cannot
be recreated by a delayed request and that a cancellation claim cannot move to another
conversation. For semantic routing, verify first-claim idempotency, exact-input keyed digest
matching across retained-key rotation, 250 ms replay polling, two-minute completed receipt expiry,
consumed receipt rejection after conversation deletion, and bounded lock-skipping cleanup.

For workspace reviews, create an owner project and an active-member project with distinct
journals, todo events, open todos, and risks. Confirm the owner sees project-wide facts, while a
member receives only their own journals and actor/assignee-related todo facts. Complete a review
and verify `ai_turn_project_sources` contains every source project. Then remove one membership and
confirm turn pages, direct reads, reconcile, idempotent replay, and later model history all hide
the derived turn. Restore all source access and confirm it is readable again. Delete one source
project and confirm the lineage row remains while the turn stays hidden; deleting the conversation
must remove its lineage rows without deleting saved summaries or created todos. Exercise a
membership revocation during generation and confirm the assistant content and lineage are not
committed. Do not use production for this validation. No such database test is implied by
`npm test` or `npm run build`.

For image-sync integration testing, use an authorized non-production database and a dedicated
fine-grained Token. Apply the schema, sign in as two ordinary users, and verify each can create
a task but can list and refresh only their own task IDs. Confirm the first user cannot infer the
second user's task through direct ID lookup. Use a harmless public image, verify Run/Job/Step
progress and the terminal conclusion, then confirm the GitHub link matches
`labring/sealos-pro/actions/runs/*`. Also inject a dispatch response timeout, confirm the local
task remains `dispatching`, then restore GitHub access and refresh until the matching
`request_id` run is attached without a second workflow run. Confirm the workflow run name does
not expose the image reference and that both the tar and md5 objects exist under the UTC date.
This test consumes runner, registry, and OSS resources.

Before an encryption-key change:

1. Back up the database and the current key ring separately.
2. Add the new key to `APP_ENCRYPTION_KEYS` and make its ID active.
3. Keep every old key needed by existing envelopes. Changing the active key does not
   re-encrypt old ciphertext.
4. Verify representative old and new records before removing any key. Do not remove an
   old key while its key ID exists in stored envelopes.

## Deployment

`main` 分支推送后，GitHub Actions 会先运行只读校验，再分别在 `ubuntu-latest`
（amd64）与 `ubuntu-24.04-arm`（arm64）原生 runner 上用普通 `docker build` 构建镜像，
推送 `ghcr.io/<仓库>/vege-basket:main-<12位sha>-amd64` 与
`ghcr.io/<仓库>/vege-basket:main-<12位sha>-arm64`，最后用 `docker manifest` 合并为同一个镜像
`ghcr.io/<仓库>/vege-basket:main-<12位sha>`。部署负责人应：

1. 查看 `main` 推送触发的构建与推送结果，确认合并镜像已生成。
2. 将同一个不可变合并标签 `main-<12位sha>` 填入 Sealos 模板的必填输入 `VEGES_IMAGE`。
   模板会把它复用于 `originImageName`、应用容器和待办日报 CronJob。
3. Pass database, encryption, shared AI, Feishu, and OSS configuration through the
   deployment environment; confirm real credential values are absent from the image and Git.
   The Sealos template derives `APP_PUBLIC_URL` from its TLS ingress host; custom deployments
   must set it to the application's exact HTTPS root origin.
4. Deploy to a test environment first, then verify health, sign-in, one authorized
   project read, and any changed integration. For an AI change, verify ordinary text arrives
   incrementally, structured turns expose progress without partial JSON, and a deliberately
   interrupted connection reconciles the canonical turn without leaving the composer locked.
   Send the empty-chat prompt `帮我梳理本周进展，并给出下一步行动建议。` without `@项目` and
   verify the result cites only backend-visible facts; repeat with `@项目` and verify it does not
   broaden beyond that project. Revoke one source-project membership and confirm the earlier
   workspace-review turn disappears from history.
   For Feishu OAuth, re-check the custom application's availability scope is limited to
   the intended company users; the server treats successful OAuth as internal identity.
5. Re-read the live application image digest and the CronJob template image. Do not infer
   deployment success from `.sealos/build/build-result.json` or `.sealos/state.json` alone.
6. For the digest workflow, verify the CronJob schedule, one completed Job, and the run
   record in an authorized test database before enabling a real user's subscription.
   Confirm the recipient receives a passive Feishu JSON 2.0 card titled with the
   scheduled delivery date, previous-day activity is separate from the current backlog,
   long sections stop after five items, each new todo title opens the exact authorized
   todo through the configured `APP_PUBLIC_URL`, and no card button or callback is present.
   Repeat while signed out to verify the link survives login. An inaccessible ID must show
   `待办不存在或你无权访问` without revealing todo data. Temporarily omit `APP_PUBLIC_URL`
   and confirm delivery still builds a valid card with plain titles.

AI conversation protocol releases replace the stateless `/api/ai/chat`, the old
`/api/ai/todo-proposals` extraction route, and direct turn creation without a semantic
classification receipt. Keep one release of compatibility handling: an already-open old SPA
receives `AI_CLIENT_UPGRADE_REQUIRED` and a visible refresh instruction instead of an unexplained
404, while an existing canonical turn can still be replayed idempotently.
Do not serve old and new application images concurrently: use a controlled single-replica
replacement or a short maintenance window. The application Deployment template uses
`strategy.type: Recreate` for this protocol boundary. Confirm every ready Pod uses the same
immutable image before accepting AI traffic. Database additions are forward compatible with the
old image, but old browser code cannot continue a conversation until it refreshes.

Useful preflight checks:

```bash
docker build -t vege-basket:verify .
rg -n 'originImageName:|^[[:space:]]+image:' .sealos/template/index.yaml
```

Publishing an image or mutating a cluster requires explicit authorization.

## Rollback

Application rollback retains the current database and complete encryption key ring. Suspend
the todo-digest CronJob before changing images. When the target version contains the digest
worker, restore the same immutable amd64 image to both the application Deployment and the
CronJob. When rolling back to a version from before the digest worker existed, keep the
CronJob suspended or remove it and restore only the application Deployment; an older image
without `server/todo-digest-worker.ts` cannot run that job. Because startup DDL has no down
migration, an image rollback is safe only when the previous server can read the current schema.

If a release performed an incompatible data change, stop writes and restore the
pre-release database snapshot together with the previous image. Never run ad hoc reverse
SQL against production. After rollback, verify `/api/health`, authentication, an old
encrypted record, and the workflow that triggered rollback.

## Troubleshooting

- Startup fails with `DATABASE_URL is required`: inject a PostgreSQL URL; do not use a
  production URL for local verification.
- Startup reports an encryption-key mismatch: ensure the active ID names a 32-byte
  base64 key in `APP_ENCRYPTION_KEYS` and retain keys for older envelopes.
- Package market fails: verify the HTTPS OSS origin, bucket credentials, bundled or
  configured rules file, and allowed object-key roots.
- Image sync is unavailable: verify `GITHUB_ACTIONS_TOKEN` is present and scoped to
  `labring/sealos-pro` with Actions write permission, then verify the API host is reachable from
  the Veges runtime. A transient dispatch timeout should leave the task in `dispatching`; use
  refresh to reconcile the `request_id` run name before submitting anything else. A 409 means
  the current user already has an active run; a 429 means the ten-runs-per-hour user quota or
  submission cooldown was reached.
- Todo image upload fails: verify OSS config, upload size/type, and the URL-signing secret
  or its documented fallback.
- AI returns 503: verify `AI_API_BASE`, `AI_API_KEY`, and `AI_MODEL` are all present in the
  application environment. The URL must be HTTPS and resolve only to public addresses.
- Veges AI rejects a text attachment message as too long: split the input or reduce the
  attachments. The composer enforces both its attachment limits and the effective
  `AI_MAX_MESSAGE_LENGTH` returned by `GET /api/ai/status`; raising the provider limit
  requires a deliberate deployment configuration change.
- AI history is empty after sign-in: verify the conversation belongs to the current user.
  Project conversations are intentionally hidden while project access is inactive; restoring
  active membership makes retained history visible again.
- AI stays on one preparation label with no incremental text or heartbeat: inspect the response
  for `Content-Type: text/event-stream`, `Cache-Control: no-transform`, and
  `X-Accel-Buffering: no`, then disable buffering in every ingress or reverse-proxy hop. The
  application sends heartbeats every 10 seconds; their absence usually means the stream is being
  buffered or terminated before reaching the browser. Project summaries, workspace reviews, and
  todo extraction intentionally emit named progress instead of partial JSON.
- The UI says `正在确认回复结果`: the transport ended before a terminal frame, so the browser is
  reading the canonical turn from PostgreSQL. Do not cancel or modify the row manually. A known
  `failed` or `cancelled` terminal event releases the composer immediately; only an unknown
  transport outcome remains in reconciliation.
- An AI turn remains `processing`: the normal lease is 120 seconds. Ordinary chat or analysis
  requests time out after 45 seconds; project summaries, workspace reviews, and todo extraction
  use 90 seconds.
  Replaying the same turn
  while its lease is active returns the canonical processing state. The browser polls the
  authenticated reconcile route; after expiry it marks the turn failed so the latest turn can
  be retried. Check replica restarts and database clock drift before modifying rows manually.
- AI shows `模型连接提前结束`: the provider ended without a valid terminal marker or returned
  `finish_reason: length`. The server records `AI_RESPONSE_INCOMPLETE` and does not commit the
  partial text. Retry after checking provider token limits and upstream stream stability.
- AI retry returns `409`: only the latest failed or cancelled turn is retryable, and a
  conversation cannot run two processing turns. Refresh canonical history before retrying.
- AI shows `AI 服务地址暂时无法解析` or records `AI_BASE_URL_UNRESOLVED`: inspect the
  system DNS result. Hostnames mapped by a local proxy to `198.18.0.0/15` are rechecked
  through public DNS-over-HTTPS; if that verification fails, restore access to
  `https://cloudflare-dns.com` or exclude the provider hostname from Fake-IP mode. A
  transient public-DNS failure is retryable after name resolution recovers. Literal and
  ordinary private addresses are intentionally rejected.
- Password registration returns 403 while AI is enabled: use a current project invite or
  sign in through Feishu OAuth; existing password accounts can still log in normally.
- Daily digest is not sent: verify the user subscription is enabled, the user has a bound
  Feishu `open_id`, `FEISHU_DELIVERY_ENABLED` is not `false`, the CronJob uses the current
  image, and the latest digest run is not `failed` or `skipped`.
- Daily digest titles are not clickable: verify `APP_PUBLIC_URL` is an HTTPS root origin in
  production and is injected into the digest CronJob. HTTP is accepted only for localhost
  or loopback local development; invalid values intentionally fall back to plain titles.
- Feishu callback returns 401: verify the callback token matches
  `FEISHU_VERIFICATION_TOKEN`; challenge payloads are authenticated too.
- Unexpected users can complete Feishu OAuth: narrow the company custom application's
  availability scope before re-enabling sign-in; Veges does not maintain a second tenant
  or email-domain allowlist.
