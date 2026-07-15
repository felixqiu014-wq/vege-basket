# Reference

## Source Map

| Concern | Source of truth |
| --- | --- |
| Scripts and dependency roles | `package.json`, `package-lock.json` |
| Browser API contracts | `src/api.ts`, `src/types.ts` |
| WYSIWYG Markdown editor contract | `src/components/markdown-wysiwyg-editor.tsx`, `src/App.css` |
| HTTP routes and authorization | `server/index.ts` |
| Database schema | `server/schema.ts` |
| Encryption format | `server/crypto.ts` |
| Package timeline transactions | `server/project-package-timeline.ts` |
| OSS rules and URL signing | `server/package-market.ts`, `server/trial-combo-package-rules.yaml` |
| Container runtime | `Dockerfile` |
| Sealos install surface | `.sealos/template/index.yaml` |

## Environment Variables

Required for server startup:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `APP_ENCRYPTION_ACTIVE_KEY_ID` | Key ID used for new AES-256-GCM writes. |
| `APP_ENCRYPTION_KEYS` | Comma-separated `key-id:base64-key` ring; each key is 32 bytes. |

Core and AI controls:

| Variable | Default / behavior |
| --- | --- |
| `PORT` | `8787`. |
| `AI_RATE_LIMIT` | `5` requests per in-memory window. |
| `AI_RATE_WINDOW_MS` | `60000`. |
| `AI_MAX_MESSAGE_LENGTH` | `2000` characters. |
| `AI_MAX_CONTEXT_CHARS` | `12000` characters. |

AI provider URL, key, and model are stored per user in encrypted `ai_settings` through
`/api/ai/settings`. `AI_API_BASE`, `AI_API_KEY`, and `AI_MODEL` appear in deployment
metadata but are not consumed by the current server.

Feishu integration:

| Variable | Purpose |
| --- | --- |
| `FEISHU_APP_ID`, `FEISHU_APP_SECRET` | OAuth, identity lookup, message fetch, and delivery. |
| `FEISHU_OAUTH_REDIRECT_URI` | Explicit OAuth callback URL; otherwise derived from the request origin. |
| `FEISHU_OAUTH_STATE_SECRET` | OAuth state signing secret; falls back to app secret or encryption key ring. |
| `FEISHU_VERIFICATION_TOKEN` | Required token for `/api/integrations/feishu/events`. |
| `FEISHU_WEBHOOK_USER_EMAIL` | Veges account receiving conversation-analysis output. |
| `FEISHU_WEBHOOK_BASIC_USER`, `FEISHU_WEBHOOK_BASIC_PASSWORD` | Basic credentials for the conversation-analysis webhook. |
| `FEISHU_DELIVERY_ENABLED` | Set to `false` to disable outbound notification delivery. |

`FEISHU_ENCRYPT_KEY` is declared in deployment metadata but is not consumed by the
current server.

OSS and package market:

| Variable | Default / behavior |
| --- | --- |
| `OSS_ENDPOINT` | Required HTTPS origin when OSS features are used. |
| `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OSS_BUCKET` | OSS credentials and bucket. |
| `PACKAGE_MARKET_RULES_FILE` | Defaults to `server/trial-combo-package-rules.yaml`. |
| `PACKAGE_MARKET_MIDDLEWARE_ROOT` | Allowed middleware prefix. |
| `PACKAGE_MARKET_BASE_OBJECT_TEMPLATE` | Exact base-package object template. |
| `PACKAGE_MARKET_BASE_LIST_PREFIX_TEMPLATE` | Versioned base-package listing prefix. |
| `PACKAGE_MARKET_DOWNLOAD_EXPIRE_SECONDS` | Default signed URL lifetime; fallback is 30 minutes. |
| `TODO_IMAGE_UPLOAD_MAX_BYTES` | Default `10485760` bytes. |
| `TODO_IMAGE_OBJECT_PREFIX` | Default `todo-images`. |
| `TODO_IMAGE_URL_SECRET` | HMAC secret; falls back to OAuth state secret or encryption key ring. |

Compatibility aliases remain accepted for `OSS_UI_MIDDLEWARE_ROOT`,
`OSS_UI_BASE_OBJECT_TEMPLATE`, `OSS_UI_BASE_LIST_PREFIX_TEMPLATE`,
`OSS_UI_DOWNLOAD_EXPIRE_SECONDS`, and `TRIAL_COMBO_PACKAGE_RULES_FILE`. New deployments
should use the `PACKAGE_MARKET_*` names.

## HTTP API Families

Protected JSON endpoints use `Authorization: Bearer <session-token>`. The primary route
families are:

| Family | Routes |
| --- | --- |
| Health | `GET /api/health` (public) |
| Authentication | `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/password`, `/api/auth/feishu/oauth/*` |
| Workspace | `GET /api/workspace`, `GET /api/notifications`, notification read/dismiss routes |
| Projects | `/api/projects`, journals, risks, modules, invitations, invite links, Feishu project settings |
| Todos | `/api/todos`, todo notes, `POST /api/todo-images`, signed `GET /api/todo-images` |
| Drafts and summaries | `/api/drafts`, draft archive/delete, `/api/summaries` |
| Package market | `/api/package-market/rules`, package details, release versions, CI versions |
| Package timeline | `/api/projects/:projectId/package-timeline/*`, package-item download URLs and timeline export |
| AI | `/api/ai/settings`, `/api/ai/chat` |
| Feishu webhooks | `/api/integrations/feishu/conversation-analysis`, `/api/integrations/feishu/events` |

Authentication and authorization rules are defined in `server/index.ts`; route presence
does not imply every project member can perform every action. Nested resource lookups
must remain bound to the authorized project ID.

## Data And Status Contracts

- Project status: `active`, `paused`, `completed`, `archived`.
- Todo priority: `high`, `medium`, `low`.
- Todo confirmation: `confirmed`, `rejected`.
- Package event type: `init`, `upgrade`.
- Package event status: `draft`, `delivering`, `delivered`.
- Package operation kind: `document`, `event`.
- Package operation status: `pending`, `success`, `failed`.
- Package market channel: `release`, `ci`.
- Supported todo images: PNG, JPEG, WebP, GIF.
- Package download expiry choices: 30, 60, 90, 120, 300, or 600 minutes.

Errors use JSON `{ "error": "..." }`. Common status codes are 400 for invalid input,
401 for missing or invalid authentication, 403 for insufficient role, 404 for absent or
inaccessible resources, 409 for state conflicts, 415 for unsupported image media, 429
for AI throttling, and 503 for an unconfigured dependency.
