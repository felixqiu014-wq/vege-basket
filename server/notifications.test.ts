import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canUserReviewTodo,
  hasTodoAssigneeChanged,
  hasTodoWatcherChanged,
  resolveTodoReviewerUserId,
  resolveTodoNoteRecipientUserIds,
  shouldDeliverNotificationToProjectChat,
} from './notification-policy.ts'
import {
  notificationRefreshIntervalMs,
  workspaceRefreshIntervalMs,
  removePackageEventNotification,
  removeTodoNotifications,
  startNotificationRefreshSchedule,
} from '../src/notifications.ts'
import type { NotificationCenterData, TodoNotification } from '../src/types.ts'

const serverSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const schemaSource = readFileSync(new URL('./schema.ts', import.meta.url), 'utf8')
const packageTimelineSource = readFileSync(
  new URL('./project-package-timeline.ts', import.meta.url),
  'utf8',
)
const testWorkbenchSource = readFileSync(new URL('./test-workbench.ts', import.meta.url), 'utf8')
const testWorkbenchClientSource = readFileSync(new URL('../src/components/test-workbench.tsx', import.meta.url), 'utf8')
const packageWorkbenchSource = readFileSync(
  new URL('../src/components/project-package-workbench.tsx', import.meta.url),
  'utf8',
)
const bugShareSource = readFileSync(new URL('./bug-share.ts', import.meta.url), 'utf8')

test('notification center exposes a read-all endpoint without dismissing notifications', () => {
  const routeStart = serverSource.indexOf("app.patch('/api/notifications/read-all'")
  const nextRoute = serverSource.indexOf("app.get('/api/my-work'", routeStart)
  assert.ok(routeStart >= 0)
  assert.ok(nextRoute > routeStart)
  const route = serverSource.slice(routeStart, nextRoute)
  assert.match(route, /getNotifications\(userId\)/u)
  assert.match(route, /read_at = coalesce\(notification_states\.read_at, now\(\)\)/u)
  assert.doesNotMatch(route, /dismissed_at\s*=\s*now\(\)/u)
})

test('suppresses notifications caused by the recipient own actions', () => {
  assert.match(
    serverSource,
    /where e\.assignee_user_id = \$1\s+and e\.assigned_by_user_id is distinct from \$1/u,
  )
  assert.match(
    serverSource,
    /where tw\.watched_by_user_id is distinct from \$1\s+and \(p\.user_id = \$1 or pm\.id is not null\)/u,
  )
  assert.match(
    serverSource,
    /where t\.assignee_user_id = \$1\s+and t\.assigned_by_user_id is distinct from \$1/u,
  )
  assert.match(
    serverSource,
    /and t\.assigned_by_user_id is distinct from t\.assignee_user_id/u,
  )
  assert.match(
    serverSource,
    /and tw\.watched_by_user_id is distinct from tw\.user_id/u,
  )
  assert.match(
    serverSource,
    /and e\.assigned_by_user_id is distinct from e\.assignee_user_id/u,
  )
  assert.match(
    serverSource,
    /and coalesce\(t\.reviewer_user_id, t\.created_by_user_id, p\.user_id\) <> \$2/u,
  )
  assert.match(
    serverSource,
    /and coalesce\(t\.created_by_user_id, p\.user_id\) <> \$2/u,
  )
  assert.match(serverSource, /and b\.assignee_user_id <> \$3/u)
  assert.match(serverSource, /and p\.owner_user_id <> \$3/u)
})

test('in-app project invitations keep accept and ignore actions in the notification feed', () => {
  assert.match(appSource, /const result = await acceptProjectInvitation\(membershipId\)/u)
  assert.match(appSource, /const result = await declineProjectInvitation\(membershipId\)/u)
  assert.match(appSource, /onAcceptInvitation=\{acceptInvitation\}/u)
  assert.match(appSource, /onIgnoreInvitation=\{ignoreInvitation\}/u)
  assert.match(appSource, /inviteId: invite\.id/u)
  assert.match(appSource, />\s*忽略\s*<\/Button>/u)
  assert.match(appSource, />\s*同意\s*<\/Button>/u)
  assert.doesNotMatch(appSource, /请前往项目篮子查看邀请/u)
})

function todoNotification(id: number): TodoNotification {
  return {
    dueDate: '2026-07-16',
    id,
    priority: 'medium',
    projectId: 1,
    projectName: 'Project',
    title: `Todo ${id}`,
  }
}

test('removes a completed todo from actionable todo notification categories', () => {
  const notifications: NotificationCenterData = {
    accountOffboardingReceived: [],
    assignedPackageEvents: [{
      eventStatus: 'draft',
      eventType: 'upgrade',
      id: 30,
      projectId: 1,
      projectName: 'Project',
      title: 'Event',
    }],
    assignedTodos: [todoNotification(10), todoNotification(20)],
    watchedTodos: [todoNotification(10), todoNotification(30)],
    dueTomorrowTodos: [todoNotification(10)],
    noteMentions: [todoNotification(10), todoNotification(20)],
    invites: [{
      createdAt: '2026-07-15 12:00',
      id: 40,
      invitedByName: 'Owner',
      projectId: 1,
      projectName: 'Project',
    }],
    packageEventCommentMentions: [],
    projectTransfers: [],
  }

  const result = removeTodoNotifications(notifications, 10)

  assert.deepEqual(result.assignedTodos.map((item) => item.id), [20])
  assert.equal(result.watchedTodos, notifications.watchedTodos)
  assert.deepEqual(result.dueTomorrowTodos, [])
  assert.deepEqual(result.noteMentions.map((item) => item.id), [20])
  assert.equal(result.assignedPackageEvents, notifications.assignedPackageEvents)
  assert.equal(result.invites, notifications.invites)
})

test('removes only the delivery event whose status advanced', () => {
  const notifications: NotificationCenterData = {
    accountOffboardingReceived: [],
    assignedPackageEvents: [
      {
        eventStatus: 'draft',
        eventType: 'upgrade',
        id: 30,
        projectId: 1,
        projectName: 'Project',
        title: 'Event 30',
      },
      {
        eventStatus: 'draft',
        eventType: 'init',
        id: 31,
        projectId: 1,
        projectName: 'Project',
        title: 'Event 31',
      },
    ],
    assignedTodos: [todoNotification(10)],
    watchedTodos: [],
    dueTomorrowTodos: [],
    noteMentions: [],
    invites: [],
    packageEventCommentMentions: [],
    projectTransfers: [],
  }

  const result = removePackageEventNotification(notifications, 30)

  assert.deepEqual(result.assignedPackageEvents.map((item) => item.id), [31])
  assert.equal(result.assignedTodos, notifications.assignedTodos)
})

test('publishes delivery events before exposing assignment notifications', () => {
  assert.match(serverSource, /and e\.published_at is not null\s+and e\.status = 'delivering'/u)
  assert.match(serverSource, /where e\.id = \$1\s+and e\.published_at is not null/u)
  assert.match(serverSource, /if \(result\.published\) enqueueLatestAssignedPackageEventDelivery\(result\.eventId\)/u)
  assert.match(schemaSource, /column_name = 'published_at'[\s\S]*set published_at = created_at/u)
  assert.match(schemaSource, /project_package_events_lifecycle_check/u)
  assert.match(
    packageTimelineSource,
    /status: ensureProjectPackageEventStatus\(row\.status, row\.published_at\)/u,
  )
  assert.match(
    packageTimelineSource,
    /and published_at is not null\s+and status = 'delivering'/u,
  )
  assert.doesNotMatch(packageWorkbenchSource, /已发布/u)
  assert.match(packageWorkbenchSource, /onClick=\{\(\) => void saveEvent\('publish'\)\}/u)
  assert.doesNotMatch(packageWorkbenchSource, /eventDialogOpen/u)
})

test('detects only explicit todo watcher changes', () => {
  assert.equal(hasTodoWatcherChanged(10, undefined), false)
  assert.equal(hasTodoWatcherChanged(10, 10), false)
  assert.equal(hasTodoWatcherChanged(10, 20), true)
  assert.equal(hasTodoWatcherChanged(10, null), true)
  assert.equal(hasTodoWatcherChanged(null, 20), true)
})

test('detects only actual todo assignee changes', () => {
  assert.equal(hasTodoAssigneeChanged(10, undefined), false)
  assert.equal(hasTodoAssigneeChanged(10, 10), false)
  assert.equal(hasTodoAssigneeChanged(10, 20), true)
  assert.equal(hasTodoAssigneeChanged(10, null), true)
  assert.equal(hasTodoAssigneeChanged(null, 20), true)
})

test('todo detail edits compare the locked assignee before confirming assignment', () => {
  assert.match(
    serverSource,
    /assigneeChanged = canManageTodoFields && hasTodoAssigneeChanged\(\s*lockedAssigneeUserId,\s*nextAssigneeUserId,\s*\)/,
  )
  assert.match(serverSource, /confirmation_status = case\s+when \$8::boolean then 'confirmed'/)
  assert.match(serverSource, /assigneeChanged,\s+nextAssigneeUserId,/)
})

test('keeps requirement rejection separate from failed acceptance', () => {
  assert.match(serverSource, /requestedConfirmationStatus === 'rejected'/u)
  assert.match(serverSource, /requestedConfirmationStatus === 'acceptance_failed'/u)
  assert.match(serverSource, /requestedAcceptanceNote/u)
  assert.match(schemaSource, /event_type in \([^)]*'rejected', 'acceptance_failed'/u)
  assert.match(appSource, /rejected: '已驳回'/u)
  assert.match(appSource, /acceptance_failed: '验收未通过'/u)
  assert.match(appSource, /<SelectItem value="acceptance_failed">验收未通过<\/SelectItem>/u)
})

test('stores failed acceptance notes with a label and notifies the todo assignee', () => {
  assert.match(schemaSource, /add column if not exists kind text not null default 'normal'/u)
  assert.match(schemaSource, /todo_notes_kind_check/u)
  assert.match(serverSource, /insert into todo_notes \(todo_id, author_user_id, content, kind\)/u)
  assert.match(serverSource, /values \(\$1, \$2, \$3, 'acceptance'\)/u)
  assert.match(serverSource, /kind: row\.kind === 'acceptance' \? 'acceptance' : 'normal'/u)
  assert.match(appSource, /note\.kind === 'acceptance'/u)
  assert.match(appSource, /验收备注/u)
  assert.match(serverSource, /enqueueAcceptanceFailedTodoAssigneeDelivery/u)
  assert.match(serverSource, /验收备注/u)
})

test('renders failed acceptance notifications as interactive Feishu cards', () => {
  const cardBuilderStart = serverSource.indexOf('function buildFeishuInteractiveCard(')
  const acceptanceCardStart = serverSource.indexOf("if (candidate.kind === 'todo_acceptance_failed_assignee')", cardBuilderStart)
  const acceptanceCardEnd = serverSource.indexOf("if (candidate.kind === 'todo_completed_creator')", acceptanceCardStart)
  assert.ok(acceptanceCardStart >= 0)
  assert.ok(acceptanceCardEnd > acceptanceCardStart)
  const cardSource = serverSource.slice(acceptanceCardStart, acceptanceCardEnd)
  assert.match(cardSource, /tag: 'lark_md'/u)
  assert.match(cardSource, /\*\*验收备注\*\*/u)
  assert.match(cardSource, /template: 'red'/u)
  assert.match(serverSource, /msgType: interactiveCard \? 'interactive' : 'text'/u)
})

test('renders account offboarding notifications as interactive Feishu cards', () => {
  const cardBuilderStart = serverSource.indexOf('function buildFeishuInteractiveCard(')
  const offboardingCardStart = serverSource.indexOf("if (candidate.kind === 'account_offboarding_received')", cardBuilderStart)
  const todoCardStart = serverSource.indexOf("if (candidate.kind === 'assigned_todo'", offboardingCardStart)
  assert.ok(offboardingCardStart >= 0)
  assert.ok(todoCardStart > offboardingCardStart)
  const cardSource = serverSource.slice(offboardingCardStart, todoCardStart)
  assert.match(cardSource, /content: candidate\.body/u)
  assert.match(cardSource, /tag: 'lark_md'/u)
  assert.match(cardSource, /template: 'green'/u)
  assert.match(cardSource, /📦 有新的离职资产接受，请前往 Veges 查看/u)
})

test('prioritizes the todo creator while keeping project-owner access separate', () => {
  assert.equal(resolveTodoReviewerUserId(30, 20, 10), 30)
  assert.equal(resolveTodoReviewerUserId(null, 20, 10), 20)
  assert.equal(resolveTodoReviewerUserId(null, null, 10), 10)
  assert.equal(canUserReviewTodo({
    creatorUserId: 20,
    projectOwnerUserId: 10,
    reviewerUserId: 30,
    userId: 30,
  }), true)
  assert.equal(canUserReviewTodo({
    creatorUserId: 20,
    projectOwnerUserId: 10,
    reviewerUserId: 30,
    userId: 20,
  }), true)
  assert.equal(canUserReviewTodo({
    creatorUserId: 20,
    projectOwnerUserId: 10,
    reviewerUserId: 30,
    userId: 10,
  }), false)
  assert.equal(canUserReviewTodo({
    creatorUserId: 20,
    projectOwnerUserId: 10,
    reviewerUserId: null,
    userId: 10,
  }), false)
})

test('routes pending-review Feishu delivery and group mentions to the effective reviewer', () => {
  assert.match(
    serverSource,
    /coalesce\(t\.reviewer_user_id, t\.created_by_user_id, p\.user_id\) as reviewer_user_id/,
  )
  assert.match(serverSource, /`验收人：\$\{reviewerText\}`/)
})

test('deduplicates todo note recipients and excludes the note author', () => {
  assert.deepEqual(resolveTodoNoteRecipientUserIds({
    authorUserId: 10,
    creatorUserId: 20,
    mentionedUserIds: [10, 20, 30, 40, 40],
    watcherUserId: 30,
  }), [20, 30, 40])
  assert.deepEqual(resolveTodoNoteRecipientUserIds({
    authorUserId: 20,
    creatorUserId: 20,
    mentionedUserIds: [20],
    watcherUserId: 20,
  }), [])
})

test('enqueues personal Feishu delivery after todo note creation and editing', () => {
  assert.equal((serverSource.match(/enqueueTodoNoteDeliveries\(noteId\)/g) ?? []).length, 2)
  assert.match(serverSource, /kind: 'todo_note_added'/)
  assert.match(serverSource, /noteRecipientReason/)
})

test('persists todo detail mentions and sends the same private card as assignment notices', () => {
  assert.match(schemaSource, /create table if not exists todo_mentions/)
  assert.match(serverSource, /writeTodoMentions\(client, createdTodoId, detailMentionedUserIds\)/)
  assert.match(serverSource, /writeTodoMentions\(client, todoId, nextDetailMentionedUserIds\)/)
  assert.match(serverSource, /enqueueTodoMentionDeliveries\(/)
  assert.match(serverSource, /kind: 'todo_mention'/)
  assert.match(serverSource, /在待办中提到了你/u)
  assert.match(serverSource, /todoAssigneeName/)
  assert.match(serverSource, /isTodoMention \|\| isWatchedTodo \? '\*\*负责人\*\*'/)
  assert.match(
    serverSource,
    /candidate\.kind === 'assigned_todo' \|\| candidate\.kind === 'watched_todo' \|\| candidate\.kind === 'todo_mention'/,
  )
  assert.equal(shouldDeliverNotificationToProjectChat('todo_mention'), false)
})

test('delivers watched todo notifications only to the individual Feishu target', () => {
  assert.equal(shouldDeliverNotificationToProjectChat('watched_todo'), false)
  assert.equal(shouldDeliverNotificationToProjectChat('todo_note_added'), false)
  assert.equal(shouldDeliverNotificationToProjectChat('assigned_todo'), true)
  assert.equal(shouldDeliverNotificationToProjectChat('package_event_assigned'), true)
})

test('routes Bug assignments to the developer and only project-linked Bugs to project chat', () => {
  assert.equal(shouldDeliverNotificationToProjectChat('test_bug_assigned'), true)
  assert.equal((testWorkbenchSource.match(/onTestBugAssigned\(\{/g) ?? []).length, 3)
  assert.match(serverSource, /left join projects project on project\.id = plan\.project_id/)
  assert.match(serverSource, /candidate\.projectId <= 0/)
  assert.match(serverSource, /kind: 'test_bug_assigned'/)
  assert.match(serverSource, /bugAssignmentKind: event\.assignmentKind/u)
  assert.match(serverSource, /给你分配了 Bug/u)
  assert.match(serverSource, /bug_share\.token_encrypted as bug_share_token_encrypted/u)
  assert.match(serverSource, /bugShareUrl: bug\.bug_share_token_encrypted/u)

  const targetResolverStart = serverSource.indexOf('async function resolveFeishuDeliveryTargets(')
  const targetResolverEnd = serverSource.indexOf('async function upsertFeishuDelivery(', targetResolverStart)
  assert.ok(targetResolverStart >= 0)
  assert.ok(targetResolverEnd > targetResolverStart)
  const targetResolverSource = serverSource.slice(targetResolverStart, targetResolverEnd)
  assert.match(
    targetResolverSource,
    /if \(feishuOpenId\.startsWith\('ou_'\)\) \{[\s\S]*targetType: 'user'[\s\S]*candidate\.projectId <= 0\) return targets/u,
  )

  const cardBuilderStart = serverSource.indexOf('function buildFeishuInteractiveCard(')
  const bugCardStart = serverSource.indexOf("if (candidate.kind === 'test_bug_assigned')", cardBuilderStart)
  const bugCardEnd = serverSource.indexOf("if (candidate.kind === 'package_event_assigned')", bugCardStart)
  assert.ok(bugCardStart >= 0)
  assert.ok(bugCardEnd > bugCardStart)
  const bugCardSource = serverSource.slice(bugCardStart, bugCardEnd)
  assert.equal((bugCardSource.match(/tag: 'column_set'/g) ?? []).length, 2)
  assert.match(bugCardSource, /\*\*优先级\*\*[\s\S]*\*\*负责人\*\*/)
  assert.match(bugCardSource, /bugTransferReason/u)
  assert.match(bugCardSource, /\*\*转移理由\*\*/u)
  assert.match(bugCardSource, /bugShareLinkMarkdown\(candidate\)/u)
  assert.match(serverSource, /function bugShareLinkMarkdown\(candidate: FeishuNotificationCandidate\)[\s\S]*\*\*Bug 分享链接\*\*/u)
})

test('transfers an assigned organization Bug atomically with an immutable collaboration record', () => {
  const routeStart = testWorkbenchSource.indexOf("router.post('/test-bugs/:bugId/assigned/transfer'")
  const routeEnd = testWorkbenchSource.indexOf("router.patch('/test-bugs/:bugId/assigned'", routeStart)
  assert.ok(routeStart >= 0)
  assert.ok(routeEnd > routeStart)
  const route = testWorkbenchSource.slice(routeStart, routeEnd)

  assert.match(route, /requireActiveRole\(request, response, 'developer'\)/u)
  assert.match(route, /reason\.length > 1000/u)
  assert.match(route, /assigneeUserId === session\.userId/u)
  assert.match(route, /transaction\(async \(client\) =>/u)
  assert.match(route, /for update of b/u)
  assert.match(route, /Number\(bug\.assignee_user_id\) !== session\.userId/u)
  assert.match(route, /membership\.status = 'active'/u)
  assert.match(route, /eligible_role\.role in \('developer', 'organization_admin'\)/u)
  assert.match(route, /for share of membership, eligible_role/u)
  assert.match(route, /set assignee_user_id = \$1, status = 'pending_confirmation'/u)
  assert.match(route, /insert into test_bug_comments \(test_bug_id, author_user_id, content, kind\)/u)
  assert.match(route, /values \(\$1, \$2, \$3, 'transfer'\)/u)
  assert.match(route, /transferReason: transfer\.assigningUnassignedBug \? undefined : reason/u)

  assert.match(schemaSource, /test_bug_comments_kind_check/u)
  assert.match(schemaSource, /kind in \('comment', 'transfer', 'reject'\)/u)
  assert.ok((testWorkbenchSource.match(/and c\.kind = 'comment'/g) ?? []).length >= 4)
  assert.match(testWorkbenchClientSource, /comment\.kind !== 'transfer'/u)
})

test('exposes only active organization developers as Bug transfer candidates', () => {
  assert.match(testWorkbenchSource, /const transferCandidates = organizationIds\.length > 0/u)
  assert.match(testWorkbenchSource, /eligible_role\.role in \('developer', 'organization_admin'\)/u)
  assert.match(
    testWorkbenchSource,
    /\.filter\(\(member\) => !row\.assignee_user_id \|\| member\.id !== Number\(row\.assignee_user_id\)\)/u,
  )
})

test('lets managed organization administrators assign unassigned Bugs', () => {
  assert.match(
    testWorkbenchSource,
    /!row\.assignee_user_id && row\.organization_admin_access/u,
  )
  assert.match(testWorkbenchSource, /const assigningUnassignedBug = !bug\.assignee_user_id/u)
  assert.match(
    testWorkbenchSource,
    /assigningUnassignedBug && !bug\.organization_admin_access/u,
  )
  assert.match(
    testWorkbenchSource,
    /assignmentKind: transfer\.assigningUnassignedBug \? 'assigned' : 'transferred'/u,
  )
  assert.match(testWorkbenchSource, /transferReason: transfer\.assigningUnassignedBug \? undefined : reason/u)
  assert.match(testWorkbenchClientSource, /const assigning = !bug\?\.assigneeUserId/u)
  assert.match(testWorkbenchClientSource, /assigning \? '分配 Bug' : '转移 Bug'/u)
})

test('keeps Bug transfer content mounted through the close animation', () => {
  assert.match(testWorkbenchClientSource, /<Dialog open=\{open\} onOpenChange=\{onOpenChange\}>/u)
  assert.doesNotMatch(testWorkbenchClientSource, /<Dialog open=\{Boolean\(bug\)\} onOpenChange=\{onOpenChange\}>/u)
  assert.match(
    testWorkbenchClientSource,
    /if \(transferDialogOpen \|\| !transferBug\) return[\s\S]*setTimeout[\s\S]*setTransferBug\(undefined\)/u,
  )
})

test('covers test-workbench Feishu private notification events', () => {
  for (const kind of [
    'test_plan_assigned',
    'test_bug_status_changed',
    'test_bug_rejected',
    'test_bug_comment_added',
    'test_case_activity',
  ]) {
    assert.equal(shouldDeliverNotificationToProjectChat(kind), false)
    assert.match(serverSource, new RegExp(`'${kind}'`))
  }
  assert.match(testWorkbenchSource, /onTestPlanAssigned\(\{/)
  assert.match(testWorkbenchSource, /onTestBugStatusChanged\(\{/)
  assert.match(testWorkbenchSource, /onTestBugCommentAdded\(\{/)
  assert.match(testWorkbenchSource, /onTestCaseChanged\(\{/)
  assert.match(testWorkbenchSource, /onTestExecutionResultChanged\(\{/)
  assert.match(serverSource, /delete from notification_deliveries where kind = 'test_plan_assigned'/)
  assert.match(serverSource, /delete from notification_deliveries where kind = 'test_bug_status_changed'/)
  assert.match(serverSource, /recipient\.id = b\.reporter_user_id or recipient\.id = b\.assignee_user_id/)
  assert.equal((serverSource.match(/left join bug_share_links bug_share/g) ?? []).length, 4)

  const textBuilderStart = serverSource.indexOf('function buildFeishuNotificationText(')
  const cardBuilderStart = serverSource.indexOf('function buildFeishuInteractiveCard(')
  const textBranchEnd = serverSource.indexOf("if (candidate.kind === 'package_event_assigned')", textBuilderStart)
  const cardBranchEnd = serverSource.indexOf('async function sendFeishuMessage(', cardBuilderStart)
  assert.ok(textBuilderStart >= 0)
  assert.ok(cardBuilderStart >= 0)
  assert.ok(textBranchEnd > textBuilderStart)
  assert.ok(cardBranchEnd > cardBuilderStart)

  const textBranch = serverSource.slice(textBuilderStart, textBranchEnd)
  const cardBranch = serverSource.slice(cardBuilderStart, cardBranchEnd)

  assert.match(
    textBranch,
    /const showSubject = candidate\.kind === 'test_plan_assigned' \|\| candidate\.kind === 'test_case_activity'/,
  )
  assert.match(textBranch, /showSubject && candidate\.title \? `事项：\$\{candidate\.title\}` : ''/)
  assert.match(textBranch, /const detail = candidate\.testCommentContent\s*\?\s*`\$\{candidate\.kind === 'test_bug_rejected' \? '驳回理由' : '评论内容'\}：\$\{formatFeishuTodoDetailText\(candidate\.testCommentContent, '未填写'\)\}/)
  assert.doesNotMatch(textBranch, /\\n评论内容：/)

  assert.ok(cardBranch.includes("const activityTitle = candidate.kind === 'test_bug_status_changed'"))
  assert.match(
    cardBranch,
    /const showSubject = candidate\.kind === 'test_plan_assigned' \|\| candidate\.kind === 'test_case_activity'/,
  )
  assert.match(cardBranch, /showSubject && candidate\.title \? `\*\*事项\*\*\\n\$\{sanitizeFeishuMarkdownText\(candidate\.title\)\}` : ''/)
  assert.match(cardBranch, /const detail = candidate\.testCommentContent\s*\?\s*`\*\*\$\{isRejection \? '驳回理由' : '评论内容'\}\*\*\\n/)
  assert.doesNotMatch(cardBranch, /\\n\\n\*\*评论内容\*\*/)
  assert.match(cardBranch, /title: \{ content: `\$\{isRejection \? '⛔' : '🔔'\} \$\{activityTitle\}`,/)
  assert.match(cardBranch, /bugShareLinkMarkdown\(candidate\)/u)
  assert.match(serverSource, /event\.nextStatus === 'pending_confirmation' \? '将 Bug 打回待确认' : '修复了你创建的 Bug，请验证'/)
  assert.doesNotMatch(serverSource, /退回了你创建的 Bug/)
})

test('notifies the Bug reporter privately when a developer rejects it', () => {
  assert.match(serverSource, /onTestBugRejected: enqueueTestBugRejectedDelivery/u)
  assert.match(serverSource, /async function buildTestBugRejectedFeishuCandidate/u)
  assert.match(serverSource, /b\.reporter_user_id as recipient_user_id/u)
  assert.match(serverSource, /join users recipient on recipient\.id = b\.reporter_user_id and recipient\.id <> \$2/u)
  assert.match(serverSource, /where b\.id = \$1 and b\.status = 'rejected'/u)
  assert.match(serverSource, /驳回了你创建的 Bug/u)
  assert.match(serverSource, /delete from notification_deliveries where kind = 'test_bug_rejected' and source_id = \$1 and channel = 'feishu'/u)
  assert.match(serverSource, /function enqueueTestBugRejectedDelivery/u)
  assert.match(testWorkbenchSource, /onTestBugRejected\(\{/u)
  assert.match(testWorkbenchSource, /'test_bug_rejected'/u)
  assert.match(testWorkbenchClientSource, /rejectedBugNotifications/u)
  assert.equal(shouldDeliverNotificationToProjectChat('test_bug_rejected'), false)
})

test('reuses Feishu recipients for the test-workbench in-app notification feed', () => {
  const recorderStart = serverSource.indexOf('async function recordTestWorkbenchInAppNotification(')
  const recorderEnd = serverSource.indexOf('async function markFeishuDeliverySkipped(', recorderStart)
  assert.ok(recorderStart >= 0)
  assert.ok(recorderEnd > recorderStart)
  const recorder = serverSource.slice(recorderStart, recorderEnd)

  assert.match(recorder, /channel,[\s\S]*target_type,[\s\S]*target_id,[\s\S]*status/u)
  assert.match(recorder, /'in_app', 'user'/u)
  assert.match(recorder, /delete from notification_states/u)
  assert.match(recorder, /user_id = \$1::bigint/u)
  assert.match(recorder, /kind = \$2::text/u)
  assert.match(recorder, /source_id = \$3::bigint/u)

  for (const functionName of [
    'deliverTestPlanAssignedNotification',
    'deliverTestBugStatusChangedNotification',
    'deliverTestBugRejectedNotification',
    'deliverTestBugCommentAddedNotification',
  ]) {
    const start = serverSource.indexOf(`async function ${functionName}(`)
    const end = serverSource.indexOf('\nasync function ', start + 1)
    assert.ok(start >= 0)
    assert.ok(end > start)
    const source = serverSource.slice(start, end)
    assert.match(source, /recordTestWorkbenchInAppNotification/u)
  }

  assert.match(
    serverSource,
    /kind = 'test_plan_assigned' and source_id = \$1 and channel = 'feishu'/u,
  )
  assert.match(
    serverSource,
    /kind = 'test_bug_status_changed' and source_id = \$1 and channel = 'feishu'/u,
  )
  assert.match(testWorkbenchSource, /where delivery\.user_id = \$1/u)
  assert.match(testWorkbenchSource, /delivery\.channel = 'in_app'/u)
  assert.match(testWorkbenchSource, /or delivery\.channel = 'feishu'/u)
  assert.match(testWorkbenchSource, /max\(delivery\.created_at\) filter \(where delivery\.channel = 'in_app'\)/u)
  assert.doesNotMatch(testWorkbenchSource, /max\(delivery\.updated_at\) as updated_at/u)
  assert.match(testWorkbenchSource, /notifications: notifications\.rows\.map/u)

  assert.match(testWorkbenchClientSource, /data\.notifications\.flatMap/u)
  assert.doesNotMatch(
    testWorkbenchClientSource,
    /const returnedBugs = data\.bugs\.filter/u,
  )
  assert.doesNotMatch(
    testWorkbenchClientSource,
    /const latestComment = getLatestBugComment\(bug\)/u,
  )
})

test('refreshes notifications while visible and cleans up the live schedule', () => {
  let visible = true
  let refreshCount = 0
  let intervalDelay = 0
  let intervalListener = () => {}
  let focusListener = () => {}
  let visibilityListener = () => {}
  let clearedInterval = 0
  let removedFocus = false
  let removedVisibility = false

  const stop = startNotificationRefreshSchedule({
    clearInterval: (handle) => {
      clearedInterval = handle
    },
    isVisible: () => visible,
    onFocus: (listener) => {
      focusListener = listener
      return () => {
        removedFocus = true
      }
    },
    onVisibilityChange: (listener) => {
      visibilityListener = listener
      return () => {
        removedVisibility = true
      }
    },
    refresh: () => {
      refreshCount += 1
    },
    setInterval: (listener, delay) => {
      intervalListener = listener
      intervalDelay = delay
      return 17
    },
  })

  assert.equal(intervalDelay, notificationRefreshIntervalMs)
  intervalListener()
  focusListener()
  assert.equal(refreshCount, 2)

  visible = false
  intervalListener()
  visibilityListener()
  assert.equal(refreshCount, 2)

  visible = true
  visibilityListener()
  assert.equal(refreshCount, 3)

  stop()
  assert.equal(clearedInterval, 17)
  assert.equal(removedFocus, true)
  assert.equal(removedVisibility, true)
})

test('coalesces an in-flight refresh and backs off after a failed refresh', async () => {
  let refreshCount = 0
  let intervalListener = () => {}
  let resolveRefresh: (successful: boolean) => void = () => undefined
  const pendingRefresh = new Promise<boolean>((resolve) => {
    resolveRefresh = resolve
  })

  const stop = startNotificationRefreshSchedule({
    clearInterval: () => undefined,
    isVisible: () => true,
    onFocus: () => () => undefined,
    onVisibilityChange: () => () => undefined,
    refresh: () => {
      refreshCount += 1
      return pendingRefresh
    },
    setInterval: (listener) => {
      intervalListener = listener
      return 1
    },
  })

  intervalListener()
  intervalListener()
  assert.equal(refreshCount, 1)

  resolveRefresh(false)
  await new Promise((resolve) => setTimeout(resolve, 0))
  intervalListener()
  assert.equal(refreshCount, 1)

  stop()
})

test('supports a slower interval for heavier workspace refreshes', () => {
  let intervalDelay = 0
  startNotificationRefreshSchedule({
    clearInterval: () => undefined,
    isVisible: () => true,
    onFocus: () => () => undefined,
    onVisibilityChange: () => () => undefined,
    refresh: () => undefined,
    setInterval: (_listener, delay) => {
      intervalDelay = delay
      return 1
    },
    intervalMs: workspaceRefreshIntervalMs,
  })()
  assert.equal(intervalDelay, workspaceRefreshIntervalMs)
})

test('refreshes the workspace snapshot independently from notification polling', () => {
  assert.match(appSource, /const refreshWorkspace = useCallback\(async \(\) =>/u)
  assert.match(appSource, /fetchWorkspace\(\)/u)
  assert.match(appSource, /intervalMs: workspaceRefreshIntervalMs/u)
  assert.match(appSource, /if \(!workspaceHydratedRef\.current\) \{\s*workspaceHydratedRef\.current = true\s*return/u)
  assert.match(appSource, /\[loggedIn, view, workspaceLoaded, refreshWorkspace\]/u)
  assert.match(appSource, /refreshToken=\{workspaceRefreshVersion\}/u)
})

test('notifies only mentioned users privately when a delivery event comment is added', () => {
  assert.equal(shouldDeliverNotificationToProjectChat('package_event_comment_added'), false)
  assert.match(serverSource, /'package_event_comment_added'/u)
  const candidateSource = serverSource.slice(
    serverSource.indexOf('async function buildPackageEventCommentAddedFeishuCandidates'),
    serverSource.indexOf('async function deliverPackageEventCommentAddedNotification'),
  )
  assert.match(candidateSource, /from project_package_event_comments c/u)
  assert.match(candidateSource, /join users recipient on recipient\.id = any\(\$2::bigint\[\]\) and recipient\.id <> \$3/u)
  assert.match(candidateSource, /kind: 'package_event_comment_added' as const/u)
  assert.match(candidateSource, /noteContent: commentContent/u)
  assert.match(candidateSource, /sourceId: params\.commentId/u)
  assert.match(candidateSource, /在交付事件评论中提到了你/u)
  assert.match(serverSource, /async function deliverPackageEventCommentAddedNotification/u)
  assert.match(serverSource, /function enqueuePackageEventCommentAddedDelivery/u)
  assert.match(serverSource, /💬 交付反馈/u)
  assert.match(
    packageTimelineSource,
    /insert into notification_deliveries[\s\S]*?'package_event_comment_added'[\s\S]*?'in_app'[\s\S]*?from unnest\(\$2::bigint\[\]\)/u,
  )
  assert.match(serverSource, /packageEventCommentMentions: packageEventCommentMentionsResult\.rows\.map/u)
  assert.match(appSource, /notifications\.packageEventCommentMentions/u)
  assert.match(testWorkbenchSource, /delivery\.kind = 'package_event_comment_added'/u)
  assert.match(testWorkbenchClientSource, />交付反馈<\/span>/u)
  assert.match(testWorkbenchClientSource, /在交付反馈中提到了你/u)
})

test('bug share comments reuse organization mentions and the test-bug notification hook', () => {
  assert.match(bugShareSource, /organization_memberships membership/u)
  assert.match(bugShareSource, /resolveBugShareMentionUserIds/u)
  assert.match(testWorkbenchSource, /resolveBugShareMentionUserIds\(token, content\)/u)
  assert.match(
    testWorkbenchSource,
    /onTestBugCommentAdded\(\{\s*actorUserId: session\.userId,\s*bugId: result\.bugId,\s*commentId: result\.commentId,\s*mentionedUserIds,\s*\}\)/u,
  )
})
