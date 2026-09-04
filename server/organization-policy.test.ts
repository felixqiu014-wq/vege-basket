import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canManageOrganization,
  canManageOrganizationProjects,
  canManageOrganizationWeeklyReports,
  canManageTestEnvironments,
  hashOrganizationInviteToken,
  isFreshFeishuTimestamp,
  isOrganizationTodoFieldUpdate,
  matchesOrganizationDeleteConfirmation,
  normalizeOrganizationName,
  normalizeTestEnvironmentAccessUrl,
  normalizeTestEnvironmentName,
  normalizeOrganizationProjectHealthStatus,
  normalizeOrganizationProjectStatus,
  normalizeOrganizationWeekStart,
  normalizeOrganizationWeekStartsOn,
  normalizeProjectMilestoneDate,
  normalizeProjectMilestoneStatus,
  verifyFeishuCardSignature,
} from './organization-policy.ts'
import { isSystemAdmin } from './roles.ts'

const organizationsSource = readFileSync(new URL('./organizations.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const schemaSource = readFileSync(new URL('./schema.ts', import.meta.url), 'utf8')
const organizationWorkbenchSource = readFileSync(
  new URL('../src/components/organization-workbench.tsx', import.meta.url),
  'utf8',
)
const apiSource = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8')

test('system administrator access requires an explicit username configuration', () => {
  const previous = process.env.VEGES_ADMIN_USERNAMES
  try {
    delete process.env.VEGES_ADMIN_USERNAMES
    assert.equal(isSystemAdmin('admin'), false)

    process.env.VEGES_ADMIN_USERNAMES = ' owner@example.com, ops@example.com '
    assert.equal(isSystemAdmin('OWNER@example.com'), true)
    assert.equal(isSystemAdmin('admin'), false)
  } finally {
    if (previous === undefined) delete process.env.VEGES_ADMIN_USERNAMES
    else process.env.VEGES_ADMIN_USERNAMES = previous
  }
})

test('system administrator todo updates are limited to assignment metadata', () => {
  assert.equal(isOrganizationTodoFieldUpdate({ dueDate: '2026-08-27' }), true)
  assert.equal(isOrganizationTodoFieldUpdate({ watcherUserIds: [2, 3], reviewerUserId: 4 }), true)
  assert.equal(isOrganizationTodoFieldUpdate({ title: '改变标题' }), false)
  assert.equal(isOrganizationTodoFieldUpdate({ dueDate: '2026-08-27', detail: '改变详情' }), false)
  assert.equal(isOrganizationTodoFieldUpdate({}), false)
})

test('todo update route keeps system administrator access organization-scoped', () => {
  const routeStart = appSource.indexOf("app.patch('/api/todos/:todoId'")
  const routeEnd = appSource.indexOf("app.delete('/api/todos/:todoId'", routeStart)
  const routeSource = appSource.slice(routeStart, routeEnd)

  assert.match(routeSource, /isSystemAdmin\(session\.username\)/u)
  assert.match(routeSource, /systemAdmin && existingTodo\.rows\[0\]\.organization_id != null/u)
  assert.match(routeSource, /isOrganizationTodoFieldUpdate\(request\.body\)/u)
  assert.match(routeSource, /nextTitle =/u)
  assert.match(routeSource, /canManageTodo && typeof request\.body\.title/u)
})

test('organization administrators are account roles independent of membership access role', () => {
  assert.equal(canManageOrganization('owner', ['organization_admin']), true)
  assert.equal(canManageOrganization('admin', ['organization_admin']), true)
  assert.equal(canManageOrganization('member', ['organization_admin']), true)
  assert.equal(canManageOrganization('admin', ['developer']), false)
  assert.equal(canManageOrganization(null, ['organization_admin']), false)
})

test('organization project governance requires both account and organization authority', () => {
  assert.equal(canManageOrganizationProjects('owner', ['organization_admin']), true)
  assert.equal(canManageOrganizationProjects('admin', ['organization_admin', 'developer']), true)
  assert.equal(canManageOrganizationProjects('member', ['organization_admin']), true)
  assert.equal(canManageOrganizationProjects('admin', ['developer']), false)
})

test('test-environment maintenance requires organization-admin role and owner/admin membership', () => {
  assert.equal(canManageTestEnvironments('owner', ['organization_admin']), true)
  assert.equal(canManageTestEnvironments('admin', ['organization_admin', 'tester']), true)
  assert.equal(canManageTestEnvironments('member', ['organization_admin']), false)
  assert.equal(canManageTestEnvironments('owner', ['tester']), false)
  assert.equal(canManageTestEnvironments(null, ['organization_admin']), false)
})

test('test-environment fields are bounded and URLs cannot carry credentials or unsafe protocols', () => {
  assert.equal(normalizeTestEnvironmentName('  预发布  '), '预发布')
  assert.equal(normalizeTestEnvironmentName('a'.repeat(121)), null)
  assert.equal(normalizeTestEnvironmentAccessUrl(' https://staging.example.com/app '), 'https://staging.example.com/app')
  assert.equal(normalizeTestEnvironmentAccessUrl('http://user:pass@example.com'), null)
  assert.equal(normalizeTestEnvironmentAccessUrl('javascript:alert(1)'), null)
  assert.equal(normalizeTestEnvironmentAccessUrl('https://example.com/line\nfeed'), null)
})

test('new organization owners are provisioned as organization administrators', () => {
  const routeStart = organizationsSource.indexOf("router.post('/admin/organizations'")
  const routeEnd = organizationsSource.indexOf("router.get('/organizations/:organizationId'", routeStart)
  const routeSource = organizationsSource.slice(routeStart, routeEnd)

  assert.match(routeSource, /insert into user_roles \(user_id, role\)[\s\S]+organization_admin/u)
  assert.match(routeSource, /on conflict \(user_id, role\) do nothing/u)
  assert.match(schemaSource, /select owner_user_id, 'organization_admin'[\s\S]+from organizations/u)
})

test('weekly report collection management only requires organization administrator role', () => {
  assert.equal(canManageOrganizationWeeklyReports('member', ['organization_admin']), true)
  assert.equal(canManageOrganizationWeeklyReports('owner', ['organization_admin']), true)
  assert.equal(canManageOrganizationWeeklyReports('admin', ['developer']), false)
  assert.equal(canManageOrganizationWeeklyReports(null, ['organization_admin']), false)
})

test('organization project governance values are strict and bounded', () => {
  assert.equal(normalizeOrganizationProjectStatus('active'), 'active')
  assert.equal(normalizeOrganizationProjectStatus('planning'), null)
  assert.equal(normalizeOrganizationProjectHealthStatus('at_risk'), 'at_risk')
  assert.equal(normalizeOrganizationProjectHealthStatus('warning'), null)
  assert.equal(normalizeProjectMilestoneStatus('in_review'), 'in_review')
  assert.equal(normalizeProjectMilestoneStatus('overdue'), null)
  assert.equal(normalizeProjectMilestoneDate('2026-08-15'), '2026-08-15')
  assert.equal(normalizeProjectMilestoneDate('2026-02-30'), null)
})

test('project governance mutations retain organization-admin checks', () => {
  const governedLockStart = organizationsSource.indexOf('async function lockGovernedProject')
  const governedLockEnd = organizationsSource.indexOf('async function lockManagedOrganization', governedLockStart)
  const governedLockSource = organizationsSource.slice(governedLockStart, governedLockEnd)
  assert.match(governedLockSource, /membership\.status = 'active'/u)
  assert.match(governedLockSource, /role\.role = 'organization_admin'/u)
  assert.doesNotMatch(governedLockSource, /membership\.access_role in \('owner', 'admin'\)/u)
  assert.match(
    organizationsSource,
    /where p\.organization_id = \$1 and p\.id = \$2[\s\S]+for update of p, membership, role/u,
  )
  assert.match(organizationsSource, /project\.milestone_created/u)
  assert.match(organizationsSource, /project\.milestone_updated/u)
  assert.match(
    organizationsSource,
    /milestones\/:milestoneId\/status[\s\S]+project\.milestone_status_updated/u,
  )
  assert.match(organizationsSource, /requestedStatus \?\? normalizeProjectMilestoneStatus\(milestone\.status\)/u)
})

test('organization administrators add active organization members directly to projects', () => {
  const routeStart = organizationsSource.indexOf(
    "router.post('/organizations/:organizationId/projects/:projectId/members'",
  )
  const routeEnd = organizationsSource.indexOf(
    "router.delete('/organizations/:organizationId/projects/:projectId/members/:membershipId'",
    routeStart,
  )
  const routeSource = organizationsSource.slice(routeStart, routeEnd)

  assert.ok(routeStart >= 0)
  assert.ok(routeEnd > routeStart)
  assert.match(routeSource, /positiveId\(request\.body\?\.userId\)/u)
  assert.match(routeSource, /membership\.status = 'active'[\s\S]+for update of membership, member/u)
  assert.match(routeSource, /status = 'active'[\s\S]+accepted_at = now\(\)/u)
  assert.match(routeSource, /'member', 'active', now\(\)/u)
  assert.match(routeSource, /'project\.member_added'/u)
  assert.doesNotMatch(routeSource, /status = 'pending'/u)
  assert.doesNotMatch(routeSource, /project\.member_invited/u)
})

test('organization project member management selects from the organization roster', () => {
  assert.match(apiSource, /addOrganizationProjectMember\([\s\S]+JSON\.stringify\(\{ userId \}\)/u)
  assert.match(organizationWorkbenchSource, /detail\.members\.filter/u)
  assert.match(organizationWorkbenchSource, /选择组织成员/u)
  assert.match(organizationWorkbenchSource, /无需对方确认/u)
  assert.doesNotMatch(organizationWorkbenchSource, /输入组织成员用户名邀请/u)
  assert.doesNotMatch(organizationWorkbenchSource, /项目邀请链接/u)
  assert.doesNotMatch(organizationWorkbenchSource, /getProjectInviteLink/u)
})

test('organization names are trimmed and limited to 80 characters', () => {
  assert.equal(normalizeOrganizationName('  测试组织  '), '测试组织')
  assert.equal(normalizeOrganizationName(''), null)
  assert.equal(normalizeOrganizationName('a'.repeat(80)), 'a'.repeat(80))
  assert.equal(normalizeOrganizationName('a'.repeat(81)), null)
})

test('organization deletion requires the exact full organization name', () => {
  assert.equal(matchesOrganizationDeleteConfirmation('Sealos 项目组', 'Sealos 项目组'), true)
  assert.equal(matchesOrganizationDeleteConfirmation('Sealos 项目组', 'sealos 项目组'), false)
  assert.equal(matchesOrganizationDeleteConfirmation('Sealos 项目组', ' Sealos 项目组 '), false)
  assert.equal(matchesOrganizationDeleteConfirmation('Sealos 项目组', null), false)
})

test('organization deletion detaches owned resources inside the transaction', () => {
  assert.match(organizationsSource, /update projects set organization_id = null, updated_at = now\(\)/u)
  assert.match(organizationsSource, /update test_spaces set organization_id = null, updated_at = now\(\)/u)
  assert.match(organizationsSource, /delete from organizations where id = \$1/u)
})

test('organization test-space attachment locks the space before validating members', () => {
  const routeStart = organizationsSource.indexOf("router.post('/organizations/:organizationId/test-spaces/:spaceId'")
  const routeEnd = organizationsSource.indexOf("router.put('/organizations/:organizationId/weekly-reports", routeStart)
  const routeSource = organizationsSource.slice(routeStart, routeEnd)
  const spaceLock = routeSource.indexOf('for update')
  const memberLock = routeSource.indexOf("status in ('pending', 'active')")
  const update = routeSource.indexOf('update test_spaces set organization_id = $1')

  assert.notEqual(routeStart, -1)
  assert.notEqual(routeEnd, -1)
  assert.ok(spaceLock >= 0 && spaceLock < memberLock)
  assert.ok(memberLock < update)
  assert.match(routeSource, /organization_id = \$1 and user_id = any\(\$2::bigint\[\]\) and status = 'active'/u)
})

test('organization package market policy replaces the legacy association model', () => {
  assert.doesNotMatch(schemaSource, /organization_package_markets/u)
  assert.doesNotMatch(organizationsSource, /\/package-markets/u)
  assert.doesNotMatch(apiSource, /\/package-markets/u)
  assert.match(organizationsSource, /package-market\/policy/u)
  assert.match(apiSource, /package-market\/policy/u)
  assert.match(organizationWorkbenchSource, /OrganizationPackageMarketPanel/u)
})

test('organization test-environment routes validate manager access, organization spaces, and transactions', () => {
  const routeStart = organizationsSource.indexOf("router.post('/organizations/:organizationId/test-environments'")
  const routeEnd = organizationsSource.indexOf("router.post('/organizations/:organizationId/projects/:projectId'", routeStart)
  const routeSource = organizationsSource.slice(routeStart, routeEnd)
  assert.ok(routeStart >= 0)
  assert.ok(routeEnd > routeStart)
  assert.match(routeSource, /requireTestEnvironmentManager/u)
  assert.match(routeSource, /normalizeTestEnvironmentName/u)
  assert.match(routeSource, /normalizeTestEnvironmentAccessUrl/u)
  assert.match(routeSource, /organization_id = \$1 and id = any\(\$2::bigint\[\]\)/u)
  assert.match(routeSource, /await transaction\(async \(client\)/u)
  assert.match(routeSource, /encryptText\(name\)/u)
  assert.match(routeSource, /encryptText\(accessUrl\)/u)
  assert.match(routeSource, /test_environment_spaces/u)
  assert.match(routeSource, /on conflict \(test_environment_id, test_space_id\) do nothing/u)
  assert.match(organizationsSource, /m\.access_role in \('owner', 'admin'\)/u)
})

test('organization detail omits invitations after the recipient joins', () => {
  assert.match(
    organizationsSource,
    /from organization_invitations where organization_id = \$1\s+and status <> 'accepted'/u,
  )
})

test('organization reporting dates normalize to the configured start weekday', () => {
  assert.equal(normalizeOrganizationWeekStart('2026-07-21'), '2026-07-20')
  assert.equal(normalizeOrganizationWeekStart('2026-07-26'), '2026-07-20')
  assert.equal(normalizeOrganizationWeekStart('2026-07-24', 3), '2026-07-22')
  assert.equal(normalizeOrganizationWeekStart('2026-07-24', 7), '2026-07-19')
  assert.equal(normalizeOrganizationWeekStart('invalid'), null)
  assert.equal(normalizeOrganizationWeekStartsOn(1), 1)
  assert.equal(normalizeOrganizationWeekStartsOn(7), 7)
  assert.equal(normalizeOrganizationWeekStartsOn(0), null)
})

test('organization invite tokens are stored as one-way hashes', () => {
  const token = 'invite-token'
  assert.notEqual(hashOrganizationInviteToken(token), token)
  assert.equal(hashOrganizationInviteToken(token), hashOrganizationInviteToken(token))
})

test('organization invite links are revocable, expiring, and stored as hashes', () => {
  assert.match(schemaSource, /create table if not exists organization_invite_links/u)
  assert.match(schemaSource, /token_hash text not null unique/u)
  assert.match(schemaSource, /expires_at timestamptz not null/u)
  assert.match(
    schemaSource,
    /create unique index if not exists idx_organization_invite_links_active_organization[\s\S]+where revoked_at is null/u,
  )

  const routeStart = organizationsSource.indexOf(
    "router.post('/organizations/:organizationId/invite-link'",
  )
  const routeEnd = organizationsSource.indexOf(
    "router.get('/organization-invite-links/:token'",
    routeStart,
  )
  const routeSource = organizationsSource.slice(routeStart, routeEnd)
  assert.ok(routeStart >= 0)
  assert.ok(routeEnd > routeStart)
  assert.match(routeSource, /requireOrganizationAdmin/u)
  assert.match(routeSource, /lockManagedOrganization/u)
  assert.match(routeSource, /hashOrganizationInviteToken\(token\)/u)
  assert.match(routeSource, /set revoked_at = now\(\)/u)
})

test('organization invite acceptance locks the link and activates membership', () => {
  const helperStart = organizationsSource.indexOf(
    'export async function acceptOrganizationInviteTokenWithClient',
  )
  const helperEnd = organizationsSource.indexOf(
    'async function getOrganizationWeekStartsOn',
    helperStart,
  )
  const helperSource = organizationsSource.slice(helperStart, helperEnd)
  assert.ok(helperStart >= 0)
  assert.ok(helperEnd > helperStart)
  assert.match(helperSource, /link\.token_hash = \$1/u)
  assert.match(helperSource, /link\.expires_at > now\(\)/u)
  assert.match(helperSource, /for update of link, organization/u)
  assert.match(helperSource, /on conflict \(organization_id, user_id\) do update/u)
  assert.match(helperSource, /status = 'active'/u)
  assert.match(helperSource, /member\.joined_by_link/u)
})

test('organization invitation UI uses direct add and browser invite links', () => {
  assert.match(organizationWorkbenchSource, /邀请成员/u)
  assert.match(organizationWorkbenchSource, /inviteOrganizationMemberByUsername/u)
  assert.match(organizationWorkbenchSource, /createOrganizationInviteLink/u)
  assert.match(organizationWorkbenchSource, /organizationInvite/u)
  assert.doesNotMatch(organizationWorkbenchSource, /发送飞书邀请/u)
  assert.doesNotMatch(organizationWorkbenchSource, /飞书邮箱/u)
  assert.doesNotMatch(organizationWorkbenchSource, /inviteOrganizationMember\(/u)
})

test('organization invite tokens flow through password and Feishu sign-in', () => {
  assert.match(appSource, /organizationInviteToken: request\.body\.organizationInviteToken/u)
  assert.match(
    appSource,
    /await acceptOrganizationInviteToken\(userId, request\.body\.organizationInviteToken\)/u,
  )
  assert.match(appSource, /state\.organizationInviteToken/u)
  assert.match(
    appSource,
    /Password registration requires an active project or organization invite/u,
  )
})

test('Feishu organization invitations map lookup and duplicate errors explicitly', () => {
  const routeStart = organizationsSource.indexOf("router.post('/organizations/:organizationId/invitations'")
  const routeEnd = organizationsSource.indexOf("router.post('/organizations/:organizationId/username-invitations'", routeStart)
  const routeSource = organizationsSource.slice(routeStart, routeEnd)

  assert.notEqual(routeStart, -1)
  assert.notEqual(routeEnd, -1)
  assert.match(routeSource, /normalizedEmail\(request\.body\?\.email\)/u)
  assert.match(routeSource, /try \{\s*openId = await dependencies\.resolveFeishuOpenIdByEmail\(email\)/u)
  assert.match(routeSource, /response\.status\(mappedError\.status\)\.json\(\{ error: mappedError\.message \}\)/u)
  assert.match(routeSource, /email: maskedEmail\(email\)/u)
  assert.match(routeSource, /databaseErrorCode\(error\) === '23505'/u)
  assert.match(routeSource, /已有待处理的组织邀请/u)
})

test('Feishu card signatures validate the raw request body', () => {
  const body = JSON.stringify({ event: { action: 'accept' } })
  const nonce = 'nonce'
  const timestamp = '1784621717'
  const verificationToken = 'verification-token'
  const signature = crypto
    .createHash('sha1')
    .update(`${timestamp}${nonce}${verificationToken}${body}`)
    .digest('hex')
  assert.equal(verifyFeishuCardSignature({ body, nonce, signature, timestamp, verificationToken }), true)
  assert.equal(verifyFeishuCardSignature({ body: `${body} `, nonce, signature, timestamp, verificationToken }), false)
  assert.equal(verifyFeishuCardSignature({ body, nonce, signature: '', timestamp, verificationToken }), false)
})

test('Feishu card action routes require signatures after challenge handling', () => {
  assert.match(
    organizationsSource,
    /if \(!signature \|\| !isFreshFeishuTimestamp\(timestamp\) \|\| !verifyFeishuCardSignature\(/u,
  )
})

test('Feishu callbacks outside the five-minute replay window are rejected', () => {
  assert.equal(isFreshFeishuTimestamp('1000', 1_000_000), true)
  assert.equal(isFreshFeishuTimestamp('1000', 1_301_000), false)
})
