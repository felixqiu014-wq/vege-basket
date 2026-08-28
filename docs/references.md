# Reference

## Source Map

| Concern | Source of truth |
| --- | --- |
| Scripts and dependency roles | `package.json`, `package-lock.json` |
| Browser API and AI stream contracts | `src/api.ts`, `src/types.ts`, `src/my-work-types.ts`, `src/test-workbench-api.ts`, `src/test-workbench-types.ts`, `src/organization-types.ts`, `shared/organization-package-market.ts`, `shared/ai-conversation-wire.ts`, `shared/server-sent-events.ts` |
| WYSIWYG Markdown editor contract | `src/components/markdown-wysiwyg-editor.tsx`, `src/App.css` |
| HTTP routes and authorization | `server/index.ts`, `server/roles.ts`, `server/test-workbench.ts`, `server/organizations.ts`, `server/organization-package-market.ts` |
| Database schema and incremental migrations | `server/schema.ts`, `server/migrations/` |
| Encryption format | `server/crypto.ts` |
| Shared AI provider and limits | `server/ai-provider.ts`, `server/ai-rate-limit.ts` |
| AI summary/proposal contracts | `server/ai-period-summary.ts`, `server/ai-todo-proposals.ts` |
| AI workspace-review facts and source lineage | `server/ai-workspace-review.ts`, `server/ai-workspace-review-store.ts`, `server/ai-conversation-store.ts` |
| Todo proposal review defaults and confirmation insert | `src/todo-proposal-defaults.ts`, `server/ai-todo-confirmation.ts` |
| AI semantic routing | `server/ai-intent-classifier.ts`, `server/ai-intent-routing-store.ts`, `shared/ai-input-intent.ts` |
| AI conversations and turn lifecycle | `server/ai-conversations.ts`, `server/ai-conversation-store.ts`, `server/ai-turn-stream.ts` |
| AI reply document conversion | `server/ai-turn-document.ts` |
| Daily digest schedule and worker | `server/todo-digest.ts`, `server/todo-digest-worker.ts` |
| Personal weekly reports and reminders | `server/weekly-reports.ts`, `shared/weekly-report-deep-link.ts`, `src/components/weekly-report-workbench.tsx` |
| Veges update log | `server/changelog.ts`, `src/components/changelog-workbench.tsx`, `src/api.ts`, `src/types.ts` |
| Package timeline transactions | `server/project-package-timeline.ts` |
| OSS rules and URL signing | `server/package-market.ts`, `server/trial-combo-package-rules.yaml` |
| GitHub image sync workflow | `server/image-sync-workflows.ts`, external `sealos-pro/.github/workflows/sync-images-tar-oss.yml` |
| Container runtime | `Dockerfile` |
| Docker CI 工作流 | `.github/workflows/docker-pr.yml`, `.github/workflows/docker-push.yml` |
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
| `APP_PUBLIC_URL` | Public application origin used for Feishu todo links. Production requires HTTPS; local development permits HTTP only for loopback hosts. Query strings, fragments, credentials, and non-root paths are rejected. |
| `AI_API_BASE` | Shared OpenAI-compatible HTTPS public base URL; `198.18.0.0/15` proxy Fake-IP answers require successful public DNS-over-HTTPS verification. |
| `AI_API_KEY` | Shared provider key; required to enable AI and never returned to the browser. |
| `AI_MODEL` | Shared provider model name; required to enable AI. |
| `AI_RATE_LIMIT` | `5` requests per user per in-memory window. |
| `AI_GLOBAL_RATE_LIMIT` | `30` total requests per application replica per window. |
| `VEGES_ADMIN_USERNAMES` | Comma-separated normalized usernames allowed to manage account roles; empty disables role administration. |
| `GITHUB_ACTIONS_TOKEN` | Instance-level fine-grained token scoped to `labring/sealos-pro` with Actions write permission. It is never returned to the browser. |
| `AI_RATE_WINDOW_MS` | `60000`. |
| `AI_MAX_MESSAGE_LENGTH` | `2000` characters. |
| `AI_MAX_CONTEXT_CHARS` | `12000` characters. |

AI provider URL, key, and model are deployment-level environment variables shared by all
authenticated users. There is no user-level AI settings table or API. With all three
provider variables configured, password registration requires an active project or
organization invite. Feishu OAuth remains the
internal identity path. The rate limiter is replica-local, so a
future multi-replica deployment needs a shared quota or upstream budget policy.

Feishu integration:

| Variable | Purpose |
| --- | --- |
| `FEISHU_APP_ID`, `FEISHU_APP_SECRET` | OAuth, identity lookup, message fetch, and delivery. |
| `FEISHU_OAUTH_REDIRECT_URI` | Explicit OAuth callback URL; otherwise derived from the request origin. |
| `FEISHU_OAUTH_STATE_SECRET` | OAuth state signing secret; falls back to app secret or encryption key ring. |
| `FEISHU_VERIFICATION_TOKEN` | Required token for `/api/integrations/feishu/events` and `/api/integrations/feishu/card-actions`. |
| `FEISHU_WEBHOOK_USER_EMAIL` | Veges account receiving conversation-analysis output. |
| `FEISHU_WEBHOOK_BASIC_USER`, `FEISHU_WEBHOOK_BASIC_PASSWORD` | Basic credentials for the conversation-analysis webhook. |
| `FEISHU_DELIVERY_ENABLED` | Set to `false` to disable outbound notification delivery. |
| `FEISHU_AI_CHAT_ENABLED` | Defaults to disabled. Set to `true` to accept bound users' private bot messages as canonical Veges AI turns and reply in Feishu. |

`FEISHU_ENCRYPT_KEY` is declared in deployment metadata but is not consumed by the
current server.

Successful Feishu OAuth is treated as internal identity and may create a user without a
project invite. The Feishu custom application's availability scope must therefore be
restricted to the intended company users; Veges has no separate tenant/domain allowlist.

When Feishu AI chat is enabled, `im.message.receive_v1` accepts only `p2p` text and
`merge_forward` messages from a `users.feishu_user_id` binding. Each Feishu message is
persisted and claimed idempotently before semantic classification. The same canonical AI
conversation, intent receipt, turn lifecycle, rate limits, encryption, and project
authorization used by the browser also apply to Feishu. Forwarded content opens a new
conversation-analysis context; later private messages reuse that conversation and its
encrypted source content. Todo extraction replies with a proposal card. `创建全部` uses the
same transactional confirmation path as the browser. Candidates with a recognized due date but
no recognized project become structured todo drafts; the remaining candidates become todos in
the same transaction. `进入 Veges 编辑` uses
`APP_PUBLIC_URL/?aiTodoBatch=<id>` and survives authentication before opening the review.
Weekly-report reminders use the same validated root origin with
`?weeklyReportOrg=<organization-id>&weekStart=<YYYY-MM-DD>`. The browser preserves the link
through authentication, opens the shared weekly-report workbench only after membership checks,
and removes only those two query parameters.

OSS and package market:

| Variable | Default / behavior |
| --- | --- |
| `OSS_ENDPOINT` | Required HTTPS origin when OSS features are used. |
| `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OSS_BUCKET` | OSS credentials and bucket. |
| `PACKAGE_MARKET_RULES_FILE` | Defaults to `server/trial-combo-package-rules.yaml`. |
| `PACKAGE_MARKET_MIDDLEWARE_ROOT` | Allowed middleware prefix. |
| `PACKAGE_MARKET_BASE_OBJECT_TEMPLATE` | Compatibility template for legacy base-package objects. Apps rules take precedence. |
| `PACKAGE_MARKET_BASE_LIST_PREFIX_TEMPLATE` | Compatibility listing prefix for legacy base-package objects. |
| `PACKAGE_MARKET_DOWNLOAD_EXPIRE_SECONDS` | Default signed URL lifetime; fallback is 30 minutes. |
| `TODO_IMAGE_UPLOAD_MAX_BYTES` | Default `10485760` bytes. Applies to todo images and test-workbench evidence attachments. |
| `TODO_IMAGE_OBJECT_PREFIX` | Default `todo-images`. Used for todo images and test-workbench evidence attachments. |
| `TODO_IMAGE_URL_SECRET` | HMAC secret for todo image and test-workbench evidence URLs; falls back to OAuth state secret or encryption key ring. |

Compatibility aliases remain accepted for `OSS_UI_MIDDLEWARE_ROOT`,
`OSS_UI_BASE_OBJECT_TEMPLATE`, `OSS_UI_BASE_LIST_PREFIX_TEMPLATE`,
`OSS_UI_DOWNLOAD_EXPIRE_SECONDS`, and `TRIAL_COMBO_PACKAGE_RULES_FILE`. New deployments
should use the `PACKAGE_MARKET_*` names.

## Deployment Inputs

`main` 分支推送后，`.github/workflows/docker-push.yml` 会自动构建并推送
`ghcr.io/<仓库>/vege-basket:main-<12位sha>-amd64` 与
`ghcr.io/<仓库>/vege-basket:main-<12位sha>-arm64`，再用 `docker manifest` 合并为
`ghcr.io/<仓库>/vege-basket:main-<12位sha>`。Sealos 模板要求 `VEGES_IMAGE` 使用
由当前源码构建的不可变合并镜像标签或分架构标签/摘要；Deployment 注解、应用容器和
待办日报 CronJob 共用这一个值，避免 API 与 worker 静默运行不同源码版本。

## HTTP API Families

Protected JSON endpoints use `Authorization: Bearer <session-token>`. The primary route
families are:

| Family | Routes |
| --- | --- |
| Health | `GET /api/health` (public) |
| Authentication | `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/password`, `/api/auth/feishu/oauth/*` |
| Workspace | `GET /api/workspace`, `GET /api/my-work`, `GET /api/notifications`, notification read/dismiss routes, `GET/PUT /api/notification-subscription` |
| Changelog | `GET /api/changelog` for authenticated readers; `POST /api/admin/changelog` and `PATCH /api/admin/changelog/:id` require `VEGES_ADMIN_USERNAMES` system-admin access |
| Projects | `/api/projects`, journals, risks, modules, invitations, expiring invite links, Feishu project settings, `GET /api/projects/:projectId/todo-activity` |
| Todos | `/api/todos`, todo notes, `POST /api/todo-images`, signed `GET /api/todo-images` |
| Drafts and summaries | `/api/drafts`, journal/todo draft archive and delete, `/api/summaries` |
| Package market | Organization-context `GET /api/package-market/rules?organizationId=:id` (or `projectId=:id` for a project selector), package details, release versions, CI branches/versions; every market read is filtered by the resolved organization policy |
| Package timeline | `GET /api/projects/:projectId/package-timeline`; aggregate draft create with `POST .../events`, draft replace or publish with `PUT .../events/:eventId`, completion with `POST .../events/:eventId/complete`, per-event feedback comments with `POST/PATCH/DELETE .../events/:eventId/comments(/:commentId)` (author-owned edits, organization-member `@` mentions delivered as personal Feishu messages), package-item download URLs, and timeline export |
| Image sync | `POST /api/image-sync-runs`, `GET /api/image-sync-runs`, `GET /api/image-sync-runs/:runId?refresh=true`, `DELETE /api/image-sync-runs/:runId`; every route is session-protected and owner-scoped, and deletion accepts failed local records only |
| AI | `GET /api/ai/status`, `POST /api/ai/intent-classifications`, `GET/POST /api/ai/conversations/:conversationId/turns`, `POST .../turns/:turnId/document`, `POST .../turns/:turnId/retry`, `POST .../turns/:turnId/cancel`, `POST .../turns/:turnId/reconcile`, `GET /api/ai/conversations`, `PATCH/DELETE /api/ai/conversations/:conversationId`, `POST /api/projects/:projectId/summaries`, todo-proposal read/confirm routes |
| Feishu webhooks | `/api/integrations/feishu/conversation-analysis`, `/api/integrations/feishu/events` |
| Roles | `POST /api/auth/active-role`, `GET /api/admin/users`, `PATCH /api/admin/users/:userId/roles` |
| Organizations | `/api/organizations/*`, system-admin organization creation, owner/admin organization rename, week-start setting and confirmed deletion, direct member admission, expiring `/api/organization-invite-links/*` browser links, legacy Feishu invitations, resource attachment, organization-admin project governance, direct organization-member admission to organization projects without invite notifications, milestones including inline `PATCH .../milestones/:milestoneId/status`, task overview, weekly reports, weekly summaries, and the dedicated package-market catalog/policy settings Tab |
| Personal weekly reports | paginated `GET /api/weekly-reports/:organizationId`, `GET /api/weekly-reports/:organizationId/:weekStart`, the shared four-section editor/AI template, cursor-position source insertion, draft save, AI generation, and submit routes under `/api/weekly-reports/*` |
| Test workbench | `GET /api/test-workbench`, owner-managed `/api/test-spaces/*` including optional organization assignment on create/update, creator-owned test-subject deletion, editor-managed case folders, tester-managed cases including creator-only `DELETE /api/test-spaces/:spaceId/cases/:caseId`, CSV case preview/import, creator-managed plan details/cases/deletion, executions, bugs, comments, and author-owned comment edits/deletions |
| Test-space collaboration | `GET /api/test-spaces/settings`, username invitations, member access updates, pending invitation acceptance, and expiring `/api/test-space-invite-links/*` share links |
| Assigned bugs | `GET/PATCH /api/test-bugs/*/assigned`, `POST /api/test-bugs/:bugId/assigned/transfer`, `POST /api/test-bugs/:bugId/assigned/reject` (mandatory reason, records an immutable `reject` comment and notifies the reporting tester by personal Feishu message), organization-admin assignment of unassigned Bugs with a direct Feishu notification to the new assignee, assigned-bug comments, and author-owned assigned-comment edits/deletions for the active developer role |

Authentication and authorization rules are defined in `server/index.ts`; route presence
does not imply every project member can perform every action. Nested resource lookups
must remain bound to the authorized project ID.

## Data And Status Contracts

- Project status: `active`, `paused`, `completed`, `archived`.
- Project health: `on_track`, `at_risk`, `off_track`.
- Project milestone: `pending`, `in_review`, `achieved`, `cancelled`; overdue and due-soon
  are derived from `targetDate` rather than persisted states.
- Todo priority: `high`, `medium`, `low`.
- Todo confirmation: `confirmed`, `pending_review`, `rejected`.
- Todo activity event: `created`, `assigned`, `confirmed`, `rejected`, `completed`, `reopened`.
- Todo proposal batch: `pending`, `confirmed`, `discarded`; proposal item: `pending`, `accepted`, `rejected`.
- AI conversation context: `general`, `project`, `conversation-analysis`; AI turn intent:
  `chat`, `project-summary`, `workspace-review`, `todo-extraction`,
  `conversation-analysis`; AI turn status: `processing`, `completed`, `failed`,
  `cancelled`.
- Daily digest run: `pending`, `processing`, `retry`, `sent`, `failed`, `skipped`.
- Image sync run: `dispatching`, `queued`, `in_progress`, `completed`, `failed`; GitHub's terminal result remains in the separate `conclusion` field. A server-generated `dispatch_key` is sent as workflow `request_id` and appears only in the GitHub run name for reconciliation; an uncertain dispatch stays `dispatching` until its run is found or the five-minute window expires.
- Image sync filtering maps `completed/success` to success, active statuses to running, and every other terminal state to failure. Successful DTOs expose tar and MD5 `oss://` URIs derived from the server-side bucket, GitHub Run UTC date, image safe base, and architecture; these are object identifiers rather than signed public download URLs.
- Personal weekly-report state: `draft`, `submitted`, `modified`; the detail endpoint may
  additionally return `empty` before a draft exists. The personal index returns metadata only,
  newest week first, with `limit` and `offset` pagination. One organization member has at most
  one report record for each normalized organization week.
- Organization weekly-report collection omits the reserved `admin` username from member rows,
  submission counts, and reminder targets.
- Todo responses expose an optional single watcher through `watcherUserId` and
  `watcherName`. `POST /api/todos` and `PATCH /api/todos/:todoId` accept
  `watcherUserId`; a non-null watcher must be the project owner or an active project
  member. Adding a watcher creates a `watched_todo` notification for that user in the
  notification center and schedules personal-only Feishu delivery; watcher notifications
  are not sent to the project chat. Changing the watcher resets notification state for
  the new watcher, while an unchanged watcher does not redeliver.
- Todo responses expose an optional designated reviewer through `reviewerUserId` and
  `reviewerName`. `POST /api/todos` and `PATCH /api/todos/:todoId` accept
  `reviewerUserId`; a non-null reviewer must be the project owner or an active project
  member. A null reviewer means the todo creator remains the effective reviewer. When a
  todo is submitted for review, personal Feishu delivery targets the effective reviewer
  and the project-chat card mentions that same reviewer.
- Creating a todo note sends a personal-only Feishu notification to the effective todo
  creator, the current watcher, and every project member explicitly mentioned in the note.
  The note author is excluded and duplicate roles collapse to one delivery per note and
  recipient. Editing a note can notify newly mentioned recipients, while the idempotent
  delivery key prevents repeat messages to recipients already notified for that note.
- Package event type: `init`, `upgrade`.
- Package event status: `draft`, `delivering`, `delivered`. `publishedAt` is absent for an
  editable draft. Publishing atomically records `publishedAt`, changes the status to
  `delivering`, makes the event read-only, and schedules the Feishu assignment notification.
  A published event supports only the `delivering` to `delivered` completion action.
- Creating a package-event feedback comment records one in-app notification for every
  explicitly mentioned member except the author, independently of Feishu configuration.
  The developer project basket and tester workbench notification centers expose the same
  recipient-scoped notification; deleting the feedback removes its notification records.
- Package event aggregate save accepts `action` (`save_draft` or `publish`), basic event
  fields, zero or more selected package `items`, and `documents`. Publishing always requires
  one event-scoped Markdown document; each selected package may additionally have one
  package-scoped Markdown document. Each document may independently include optional project
  todo associations through `relatedTodoIds`. A saved draft may retain incomplete document content.
- Package operation kind: `document`, `event`.
- Package operation status: `pending`, `success`, `failed`.
- Package market channel: `release`, `ci`.
- Organization package-market policy: one feature switch plus independent `release` and `ci`
  channel switches. A single organization-wide `all`, `selected`, or `excluded` visibility
  range controls the stable rule IDs for every enabled channel: selected IDs form an allow-list,
  excluded IDs form a deny-list, and either list may contain one package. A save may not leave
  any enabled channel without a usable package; close that channel to prohibit every package.
  Dependency rules inherit their parent's channel visibility. The OSS base package has no CI
  surface. Global market requests must provide one organization context; project selectors
  resolve the project's organization and personal projects use the default enabled/all policy.
  The `includeAll` control only broadens object matching inside an allowed rule and never
  bypasses organization visibility.
- Supported todo images and test-workbench evidence attachments: PNG, JPEG, WebP, GIF images; MP4, WebM, and QuickTime videos.
- Account roles: `developer`, `tester`, `organization_admin`. `developer` and `tester`
  are switchable session personas. `organization_admin` is additive, is not shown in the
  role switcher, and allows the account to assume either business persona.
  System administrators assign it through user role management.
- Organization access: `owner`, `admin`, `member`. System administrators create
  organizations; organization owners and administrators rename or delete organizations
  and manage organization membership. They may add an existing account directly or create
  an expiring browser invite link; link acceptance activates ordinary member access without
  a Feishu callback. Deletion requires the exact organization name,
  detaches projects and test spaces, and removes organization-only records.
  Accounts assigned `organization_admin` always see the organization management entry.
  If they also have active `owner` or `admin` membership in an organization, they receive
  access to all attached projects and project records, test spaces and test records, and
  Bugs and comments. That dual authorization may update attached project lifecycle status,
  health notes, and milestones. Project deletion, membership, integrations, ordinary project
  content, test-space, plan, case, and Bug mutation still require the corresponding original
  resource permission.
- Projects and test spaces remain personal while `organization_id` is null. Test-space
  creation and owner updates accept a nullable `organizationId` selected from the owner's
  active organization memberships. Moving a test space into or between organizations is
  allowed only when every pending or active space member already has active membership in
  the target organization; moving it to no organization retains its members and data.
- Test-space access: `owner`, `editor`, `viewer`.
- Any account with the active tester role may create a test space and becomes its owner.
  Owners may rename it, change its organization assignment, delete it, invite tester accounts, change editor/viewer
  access, remove members, and create expiring invite links with an optional bcrypt-hashed
  password. Pending invitations have no data access until accepted. Deletion requires the
  decrypted space name as confirmation and cascades to every subject, case, plan, bug,
  comment, membership, and invite link in the space.
- Test-case status: `draft`, `active`, `archived` remains accepted for compatibility,
  but the workbench no longer exposes case versions or archived status as the primary
  workflow.
- Test-case kind: `functional`, `baseline`. Archiving a case promotes it from
  `functional` to `baseline`; baseline cases remain active and serve as the reusable
  bottom layer for each test subject. Test cases also support encrypted custom tags.
- Test-case folders/modules are scoped to one test subject. Test-space owners and editors
  can create, rename, and delete folders; deleting a folder clears `folder_id` on its
  current cases and does not delete cases or immutable plan snapshots.
- Test-case deletion requires test-space write access and is limited to the account that
  created the case. It permanently removes the source case, while existing test-plan
  execution snapshots remain and their nullable `test_case_id` is cleared.
- Test-case CSV import accepts UTF-8 `text/csv` at
  `POST /api/test-spaces/:spaceId/cases/import?testSubjectId=:id`; add `preview=true` for
  validation-only preview. Required headers are `用例名称`, `所属模块`, `前置条件`,
  `步骤描述`, `预期结果`, `备注`, and `用例等级`. Levels map as P0/high,
  P1/medium, and P2/low. Files are limited to 2 MB and 1000 non-empty rows.
- Test-plan status: `draft`, `in_progress`, `completed`, `aborted`.
- Test plans are scoped to a test space and then associated with one or more test
  subjects. A plan may optionally link to an accessible project through `projectId`;
  project access is checked when creating or updating the plan. A plan response includes
  `projectId`, `testSubjectIds`, and `canManage`. Only its creator receives `true` and
  may use `PATCH /api/test-spaces/:spaceId/plans/:planId/details` to change metadata,
  change selected subjects, or append active cases from those subjects,
  `DELETE .../plans/:planId/cases/:planCaseId` to remove an `untested` snapshot, or
  `DELETE .../plans/:planId` to delete the plan. Existing snapshots are not rewritten.
  Plan deletion keeps bugs and clears their plan and plan-case references.
- Test result: `untested`, `passed`, `failed`, `blocked`, `skipped`.
- Bug status: `new`, `pending_confirmation`, `assigned`, `in_progress`, `pending_verification`, `closed`, `rejected`.
  Returning a Bug to `pending_confirmation` replaces the former `reopened` status, and marking a
  duplicate Bug closes it instead of using a separate `duplicate` status.
- Bug lifecycle events (`test_bug_events`): creation, assignment, transfer, and every status
  change are appended with the acting user, previous/next status, and the involved assignee
  (encrypted fields are not involved; comments are intentionally not recorded). The Bug detail
  view exposes a timeline dialog built from these events; Bugs created before the table existed
  fall back to a synthetic creation entry from the Bug row itself.
- A Bug in an organization-owned test space may be assigned to any active organization
  member with the developer role. The developer does not receive test-space access and
  continues to read and update only Bugs assigned to that account. An organization
  administrator may read every Bug in an organization they manage, including terminal
  Bugs, but may use the assigned-Bug mutation routes only for Bugs assigned to them.
- The current assignee may transfer a non-terminal organization Bug to another active
  organization member with the developer or organization-administrator role. Transfer
  requires a non-empty reason of at most 1000 characters, resets the Bug to `assigned`,
  and writes the old assignee, new assignee, and encrypted reason as an immutable
  `transfer` entry in the Bug collaboration record in the same transaction.
- An organization administrator who manages the owning organization may assign an
  unassigned non-terminal Bug from the Bug workbench to any active organization developer,
  including themselves. Initial assignment does not require a transfer reason or create a
  transfer collaboration entry.
- Creating or reassigning a Bug to a developer schedules a personal Feishu card for the
  new assignee. Transfer cards include the transfer reason. When that Bug belongs to a
  test plan whose `projectId` still resolves to a
  project, the same assignment is also sent to the configured project chat and mentions
  the assignee. Bugs without a project-linked plan never target a group chat. Status-only
  edits and unchanged assignees do not redeliver the assignment notification.
- Package download expiry choices: 30, 60, 90, 120, 300, or 600 minutes.

`GET /api/ai/status` returns `configured`, `model`, and the effective positive
`maxMessageLength`; the browser uses that limit to reject an oversized composed message
before the provider can silently trim it. Veges AI text attachments are read locally and
sent with one turn rather than uploaded to a separate object route. The server encrypts the
original name and content; turn responses contain attachment metadata but never content.
The composer accepts at most four supported text files, 64 KiB each and 20,000 combined
attachment characters; the effective message limit may be lower.

Conversation list pagination uses an opaque `(lastTurnAt, id)` cursor and returns newest
activity first. Turn pagination uses `beforeTurn` and returns each page oldest-to-newest for
rendering. A new conversation is created
lazily by the first `POST .../turns`, using browser-generated UUIDs for the conversation and
turn. Repeating the same turn UUID with identical content is idempotent; reusing it with a
different payload is `409`. Project conversations are visible only while the user owns or is
an active member of that project. Rename accepts 1-80 characters. Deleting a conversation is
permanent for its chat history and linked pending proposal batches, but does not delete saved
summaries, processed proposal audit batches, or already-created todos. The deleted UUID remains
reserved by a server tombstone, so delayed requests receive `404` instead of recreating it.

`POST /api/ai/intent-classifications` runs before the canonical turn request. It accepts the
browser-generated turn UUID, exact message/attachments, and current explicit conversation context.
The server claims a PostgreSQL receipt before calling the shared model, supplies no project or
workspace facts, and accepts only strict `chat`, `conversation-analysis`, `project-summary`,
`workspace-review`, or `todo-extraction` JSON with a daily/weekly period where required. The
public response contains only `{ turnId, intent }`; todo source content remains server-canonical.
The receipt binds the user, source context, and keyed full-input HMAC, so concurrent/replayed classify
requests do not call the provider twice. The subsequent turn transaction consumes the receipt and
rejects changed content, attachments, or context. Classifier failures are explicit and do not use
regex routing or silently become ordinary chat. `AI_RATE_LIMIT` admission is consumed by the first
classification claim for a new turn; canonical turn creation does not consume the same logical
request a second time. The encrypted receipt stores only kind/period metadata; todo content is
rehydrated from the validated turn input. Bounded lock-skipping cleanup removes terminal or
abandoned receipts after seven days and runs at most once per minute per application replica.
Classification HTTP traffic is additionally limited to 10 requests per
user and 60 per application replica per minute, with at most two concurrent requests per user and
10 per replica. Processing replays poll every 250 ms for at most nine seconds and use PostgreSQL's
lease state using `clock_timestamp()` rather than the application wall clock or a frozen transaction
timestamp. Cancelling or dropping the classification
request aborts the provider call. An unconsumed completed classification must create its canonical
turn within two minutes. Canonical turn and retry provider execution are separately limited to two
concurrent requests per user and 10 per application replica. A new turn submitted without a
classification receipt returns `409 AI_CLIENT_UPGRADE_REQUIRED`; an already-canonical duplicate
turn remains idempotent. A consumed receipt is rejected when no canonical turn exists, preventing a
deleted conversation turn from being recreated under another conversation.

`POST /api/ai/conversations/:conversationId/turns/:turnId/document` converts one completed
ordinary reply in a project conversation into a durable document. The request has no content or
project body: the server resolves the user-owned conversation, rechecks owner or active-member
project access in the write transaction, and reads the canonical completed `chat` turn. The
response is `201` with `{ created: true, summaryId, workspace }` for the first insert and `200`
with the same `summaryId` plus `{ created: false, workspace }` for a retry. The existing partial
unique index on `summaries.source_turn_id` enforces one document per source turn under concurrent
requests. General conversations, incomplete/failed turns, structured intents, and blank replies
are rejected. Reply documents are returned only through their creator's workspace view; unlike a
generated project summary, their canonical history turn keeps `outcome: null` and the browser
resolves `打开文档` through `sourceTurnId`. The legacy `POST /api/summaries` route rejects a
client-provided `content` field with `AI_DOCUMENT_SOURCE_REQUIRED`; it remains available for
server-generated summary periods.

The server semantic classifier routes ordinary replies and explicit project summary,
workspace review, Markdown todo extraction, and conversation-analysis intent through the same
timeline. Turn creation and retry accept `text/event-stream` and emit ordered `started`, `delta`,
`progress`, `heartbeat`, `completed`, `failed`, or `cancelled` events with a positive `sequence`.
The `started` event declares `text` or `progress` mode. Text mode is used for chat and
conversation analysis; project summaries, workspace reviews, and todo extraction emit only
`preparing`, `generating`, `validating`, or `saving` progress until a canonical terminal result.
Heartbeats are sent every 10 seconds. A non-SSE JSON response remains accepted by the browser
only after the same runtime turn-result validation.

An explicit current-day or current-week progress-review request in a general conversation is
classified as `workspace-review`. It accepts no attachment and no project binding. The backend
loads all projects the caller owns or actively belongs to, the caller's own period journals,
authorized todo activity, visible open todos, and current risks. Project owners receive the
project-wide todo and risk scope; members receive only their own journals plus todo facts where
they are actor or assignee. Fact lists are bounded to 200 displayed projects, 300 journals, 500
todo events, 500 open todos, and 300 risks; the true authorized project count is retained and
bounded lists are labeled as samples. The generated response is completed as assistant text and
does not create a summary artifact. Ordinary `chat` never receives this implicit workspace
context. With a selected project, the same natural wording stays in that project conversation
instead of broadening to workspace scope; historical or capability questions remain ordinary
chat.

Ordinary model requests time out after 45 seconds, structured project summary, workspace review,
or todo extraction after 90 seconds, and a processing lease lasts 120 seconds.
`finish_reason: length`, a stream that ends without a valid terminal marker, or an otherwise
truncated provider response fails with `AI_RESPONSE_INCOMPLETE`; partial content is never
committed as a completed turn.
First responses and idempotent replays use the same stable summary or proposal-batch reference;
the browser refreshes the workspace or fetches the batch to open the artifact. Confirmed and
discarded proposal batches reopen read-only, and confirmed reads expose accepted candidates
instead of their rejected source copies. Project-context confirmation cannot move a candidate
to another project and rechecks project, module, assignee, and caller access in the write
transaction. The server supplies at most three prior completed turns (six messages) plus the
current user input to the provider.

Project-bound AI writes and project deletion share `ai-project:<projectId>` advisory lock
keys; multi-project proposal confirmation acquires IDs in ascending order.

Each completed workspace review records every source project in `ai_turn_project_sources` in the
same transaction as its assistant content. Completion locks source projects in numeric order and
rechecks ownership or active membership before committing. Source rows deliberately retain the
numeric project ID without a project foreign key, so deleting a project preserves the lineage
needed to deny future reads. Turn pagination, direct turn reads, reconcile, idempotent replay, and
later model history all hide a workspace-review turn while any source project is deleted or no
longer accessible. Restoring active access to every retained source makes the turn readable
again. Deleting the conversation cascades its source rows; deleting the conversation does not
remove independent summaries or already-created todos.

`POST .../reconcile` returns the canonical conversation and requested turn, and atomically marks
an expired processing lease as `failed` with `AI_REQUEST_STALE`; an active or terminal turn is
unchanged. Cancel and start share the conversation advisory lock plus a per-user cancellation
lock. A cancel that arrives before the turn
creates a short-lived, per-user claim (at most 20 current claims); the delayed start observes
that stable rejection and returns `AI_REQUEST_CANCELLED` before persistence or provider
execution. Replays remain cancelled for the claim's 10-minute lifetime.
`POST /api/ai/chat` and the old `POST /api/ai/todo-proposals` remain temporarily as
compatibility responses for an already-open old SPA. Both return
`AI_CLIENT_UPGRADE_REQUIRED` with a refresh instruction and do not call the provider or
create data.

Project-bound daily and weekly AI summaries are generated from authorized period facts and saved
immediately as summary documents. Workspace reviews remain conversation text and are not saved
as summary documents. Markdown ingestion accepts `.md` content only; AI may
infer project, module, assignee, due date, priority, title, and detail, but project and due
date must be resolved before selected proposals can be confirmed in one transaction. When
an editable pending candidate has no inferred due date, the browser initializes its review
field to the current `Asia/Shanghai` calendar date. An inferred date is preserved, and
confirmed or discarded history never receives a synthetic date.

The daily digest subscription is Feishu-only, defaults to disabled at `10:00`
`Asia/Shanghai`, and sends previous-day completion/reopen activity plus the current
outstanding backlog at delivery time. Delivery uses a passive Feishu JSON 2.0 card with
no callback actions or buttons. New canonical digest text retains each positive todo ID;
when `APP_PUBLIC_URL` is valid, the card converts the escaped title into a server-generated
same-site `?todo=<id>` link. Missing or invalid configuration leaves titles as plain text.
The browser preserves that query through password or Feishu sign-in, resolves the ID only
against the authenticated workspace, opens the exact todo when authorized, and then removes
only the `todo` query parameter. The card separates the date into a subtitle, uses a two-column
activity/backlog overview, renders category headings as distinct shaded bands, and keeps
each todo's title and project metadata separate from its right-aligned due status. The run
retains deterministic, readable text as its canonical content, then maps that text into
card elements so retries and older queued runs remain compatible. User-controlled item
text is Markdown-escaped;
legacy plain-text bodies are rendered as Markdown literals when retried. Older queued runs
without a todo ID remain readable but cannot gain a link. Users may change the send time.
Disconnecting Feishu disables the subscription.

Errors use JSON `{ "error": "..." }`. Common status codes are 400 for invalid input,
401 for missing or invalid authentication, 403 for insufficient role, 404 for absent or
inaccessible resources, 409 for state conflicts, 413 for an oversized Markdown/AI
context, 415 for unsupported image media, 429 for AI throttling, and 503 for an
unconfigured dependency.

Bug 分享接口：`POST /api/test-bugs/:bugId/share-link` 创建或复用当前有效链接，
`DELETE /api/test-bugs/:bugId/share-link` 撤销链接；两者要求报告人、负责人或组织管理员
读取范围。`GET /api/bug-shares/:token` 为公开读取接口，`POST /api/bug-shares/:token/comments`
要求登录后发表评论。公共读取响应不包含敏感身份字段或内部附件链接，分享地址基于已验证
的 `APP_PUBLIC_URL` 生成；未配置时 API 返回同站路径，由浏览器按当前页面的可信来源补全，
不使用服务端请求的 Host 头推导公开域名。

待办分享接口：`POST /api/todos/:todoId/share-link` 创建或复用当前有效链接，
`DELETE /api/todos/:todoId/share-link` 撤销链接；两者允许项目 Owner、任意有效项目成员，
以及同时拥有 `organization_admin` 账号角色和该项目所属组织有效 Owner/Admin 成员身份的
组织管理员。
`GET /api/todo-shares/:token` 为公开只读接口，`POST /api/todo-shares/:token/comments`
要求登录后添加留言备注。公开 DTO 包含待办展示字段及未绑定交付操作的普通/验收备注，
匿名或非项目成员的登录响应不包含 `@` 候选；项目成员响应仅以项目 Owner 和有效项目成员中
唯一、非空的展示名作为候选，不返回邮箱或内部用户 ID；服务端只为原本拥有项目访问权的
留言人解析 mentions。留言请求需携带 UUID `requestId`，写入现有加密待办
备注及 mention 表，并复用待办备注飞书投递策略；接口按用户和链接限制频率、并发和分钟/
每日留言数，公开响应最多返回最近 100 条备注。分享来源留言不接受图片 Markdown，并按纯
文本展示；链接本身不授予项目权限。分享地址使用与 Bug 分享相同的 `APP_PUBLIC_URL` 校验
和同站路径回退。

Project invite links default to a 10 minute lifetime. Owners can request one of the
supported durations when generating a link. Invite links may optionally require a share
password; the server stores only a bcrypt hash and requires the password during login,
registration, Feishu sign-in, or explicit invite acceptance. Expired, revoked, or
password-mismatched tokens are rejected during invite acceptance.

Organization invite links use the same supported durations and default to 10 minutes.
Organization owners and administrators generate them from organization member management.
The browser carries the token through password login, password registration, or Feishu
OAuth and activates ordinary organization membership after authentication. Each newly
generated link revokes the previous active link for that organization; raw tokens are
returned only at creation and stored as SHA-256 hashes.

Package-item batch failures additionally return `code`, `requestId`, and `details`.
`details.phase` is one of `validate_object_keys`, `persist_package_items`, or
`read_package_timeline`; database failures may include safe `databaseCode`, `constraint`,
`table`, `column`, and redacted `databaseDetail` fields. Responses never include a stack,
raw SQL, credentials, encryption material, or unknown exception messages.
