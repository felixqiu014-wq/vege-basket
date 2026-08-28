import crypto from 'node:crypto'
import type express from 'express'
import { Router } from 'express'
import type { PoolClient } from 'pg'
import { blindIndex, decryptText, encryptText } from './crypto.ts'
import { pool, query } from './db.ts'
import {
  canManageOrganization,
  canManageOrganizationProjects,
  canManageOrganizationWeeklyReports,
  hashOrganizationInviteToken,
  hashProjectTransferToken,
  isFreshFeishuTimestamp,
  isOrganizationAccessRole,
  matchesOrganizationDeleteConfirmation,
  normalizeOrganizationName,
  normalizeOrganizationProjectHealthStatus,
  normalizeOrganizationProjectStatus,
  normalizeOrganizationWeekStart,
  normalizeOrganizationWeekStartsOn,
  normalizeProjectMilestoneDate,
  normalizeProjectMilestoneStatus,
  normalizeWeeklyReportRules,
  type OrganizationAccessRole,
  verifyFeishuCardSignature,
} from './organization-policy.ts'
import { getAuthenticatedRoleSession, isSystemAdmin } from './roles.ts'
import { getDepartedUserIds } from './user-lifecycle.ts'
import {
  buildOrganizationInvitationCard,
  buildOrganizationInvitationStatusCard,
  buildProjectTransferStatusCard,
  type ProjectTransferStatus,
} from './organization-cards.ts'
import { formatShanghaiCalendarDate } from '../shared/calendar-date.ts'
import {
  canonicalPackageMarketRuleId,
  isSelectablePackageMarketRule,
  isPackageMarketRuleVisible,
  packageMarketRuleSupportsChannel,
  type OrganizationPackageMarketChannel,
} from '../shared/organization-package-market.ts'
import {
  getOrganizationPackageMarketPolicy,
  OrganizationPackageMarketPolicyError,
  normalizePackageMarketPolicyInput,
  saveOrganizationPackageMarketPolicy,
  validatePackageMarketPolicyInput,
} from './organization-package-market.ts'
import { listPackageMarketRules } from './package-market.ts'

type OrganizationRouterDependencies = {
  generateWeeklySummary: (userId: number, source: string) => Promise<{
    error?: string
    message?: string
    status: number
  }>
  resolveFeishuOpenIdByEmail: (email: string) => Promise<string>
  sendFeishuMessage: (params: {
    content: Record<string, unknown> | string
    msgType: 'interactive' | 'text'
    receiveId: string
    receiveIdType: 'open_id'
  }) => Promise<{ messageId?: string } | void>
}

type OrganizationMembership = {
  access_role: OrganizationAccessRole
  organization_id: string
}

function asyncRoute(
  handler: (request: express.Request, response: express.Response) => Promise<void>,
) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    handler(request, response).catch(next)
  }
}

function positiveId(value: unknown) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function normalizedEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase().slice(0, 160)
}

const defaultOrganizationInviteExpiresInMinutes = 10
const organizationInviteExpiresInMinuteOptions = new Set([10, 30, 60, 240, 1440])

function normalizeOrganizationInviteExpiresInMinutes(value: unknown) {
  const minutes = Number(value)
  return Number.isInteger(minutes) && organizationInviteExpiresInMinuteOptions.has(minutes)
    ? minutes
    : defaultOrganizationInviteExpiresInMinutes
}

function createOrganizationInviteToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function displayName(row: { display_name?: string | null; email?: string | null }) {
  return String(row.display_name || row.email || '未知用户')
}

function dateOnly(value: Date | string) {
  return formatShanghaiCalendarDate(value)
}

async function requireSession(request: express.Request, response: express.Response) {
  const session = await getAuthenticatedRoleSession(request)
  if (!session) response.status(401).json({ error: 'Unauthorized' })
  return session
}

async function getOrganizationMembership(organizationId: number, userId: number) {
  const result = await query<OrganizationMembership>(
    `
    select organization_id, access_role
    from organization_memberships
    where organization_id = $1 and user_id = $2 and status = 'active'
    `,
    [organizationId, userId],
  )
  return result.rows[0] ?? null
}

async function requireOrganizationMember(
  response: express.Response,
  organizationId: number | null,
  userId: number,
) {
  if (!organizationId) {
    response.status(400).json({ error: 'Valid organization is required' })
    return null
  }
  const membership = await getOrganizationMembership(organizationId, userId)
  if (!membership) response.status(404).json({ error: 'Organization not found' })
  return membership
}

async function requireOrganizationAdmin(
  response: express.Response,
  organizationId: number | null,
  userId: number,
) {
  const membership = await requireOrganizationMember(response, organizationId, userId)
  if (!membership) return null
  const assignedRoles = await getAssignedRoles(userId)
  if (!canManageOrganization(membership.access_role, assignedRoles)) {
    response.status(403).json({ error: 'Organization administrator access is required' })
    return null
  }
  return membership
}

async function getAssignedRoles(userId: number) {
  const result = await query<{ role: string }>(
    'select role from user_roles where user_id = $1 order by role',
    [userId],
  )
  return result.rows.map((row) => row.role)
}

async function requireOrganizationProjectManager(
  response: express.Response,
  organizationId: number | null,
  userId: number,
) {
  const membership = await requireOrganizationMember(response, organizationId, userId)
  if (!membership) return null
  const assignedRoles = await getAssignedRoles(userId)
  if (!canManageOrganizationProjects(membership.access_role, assignedRoles)) {
    response.status(403).json({ error: 'Organization project manager access is required' })
    return null
  }
  return membership
}

async function requireOrganizationWeeklyReportManager(
  response: express.Response,
  organizationId: number | null,
  userId: number,
) {
  const membership = await requireOrganizationMember(response, organizationId, userId)
  if (!membership) return null
  const assignedRoles = await getAssignedRoles(userId)
  if (!canManageOrganizationWeeklyReports(membership.access_role, assignedRoles)) {
    response.status(403).json({ error: 'Organization weekly report manager access is required' })
    return null
  }
  return membership
}

async function lockGovernedProject(
  client: PoolClient,
  organizationId: number,
  projectId: number,
  userId: number,
) {
  const result = await client.query<{
    health_note_encrypted: string | null
    owner_user_id: string
    health_status: string
    status: string
  }>(
    `
    select p.status, p.health_status, p.health_note_encrypted, p.user_id as owner_user_id
    from projects p
    join organization_memberships membership
      on membership.organization_id = p.organization_id
     and membership.user_id = $3
     and membership.status = 'active'
    join user_roles role
      on role.user_id = $3 and role.role = 'organization_admin'
    where p.organization_id = $1 and p.id = $2
    for update of p, membership, role
    `,
    [organizationId, projectId, userId],
  )
  return result.rows[0] ?? null
}

async function lockManagedOrganization(
  client: { query: typeof query },
  organizationId: number,
  userId: number,
) {
  const result = await client.query<{ name: string }>(
    `
    select o.name
    from organizations o
    join organization_memberships m on m.organization_id = o.id
    join user_roles role
      on role.user_id = $2 and role.role = 'organization_admin'
    where o.id = $1 and m.user_id = $2 and m.status = 'active'
    for update of o, m, role
    `,
    [organizationId, userId],
  )
  return result.rows[0] ?? null
}

function databaseErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
}

function maskedEmail(value: string) {
  const [localPart, domain] = value.split('@')
  if (!localPart || !domain) return value
  if (localPart.length <= 2) return `*@${domain}`
  return `${localPart.slice(0, 2)}***@${domain}`
}

function feishuInvitationLookupError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('当前飞书应用没有匹配到这个邮箱对应的用户')) {
    return {
      message: '没有找到对应的飞书用户，请确认邮箱已加入当前飞书组织，并检查应用通讯录权限。',
      status: 400,
    }
  }
  return {
    message: '飞书服务暂时不可用，请稍后重试。',
    status: 502,
  }
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length <= maxLength ? text : null
}

function linkedTodoIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) return null
  const ids = Array.from(new Set(value.map(positiveId)))
  return ids.every((id): id is number => id !== null) ? ids : null
}

async function lockProjectMutation(client: PoolClient, projectId: number) {
  await client.query(
    'select pg_advisory_xact_lock(hashtextextended($1::text, 0))',
    [`ai-project:${projectId}`],
  )
}

async function writeMilestoneEvent(
  client: PoolClient,
  milestoneId: number,
  projectId: number,
  actorUserId: number,
  eventType: 'created' | 'updated' | 'submitted' | 'achieved' | 'reopened' | 'cancelled',
  detail: Record<string, unknown>,
) {
  await client.query(
    `insert into project_milestone_events
      (milestone_id, project_id, actor_user_id, event_type, detail)
     values ($1, $2, $3, $4, $5)`,
    [milestoneId, projectId, actorUserId, eventType, encryptText(JSON.stringify(detail))],
  )
}

async function writeAudit(
  client: { query: typeof query },
  organizationId: number,
  actorUserId: number | null,
  action: string,
  subjectType: string,
  subjectId = '',
  detail = '',
) {
  await client.query(
    `
    insert into organization_audit_events
      (organization_id, actor_user_id, action, subject_type, subject_id, detail)
    values ($1, $2, $3, $4, $5, $6)
    `,
    [organizationId, actorUserId, action, subjectType, subjectId, encryptText(detail)],
  )
}

export async function acceptOrganizationInviteTokenWithClient(
  client: PoolClient,
  userId: number,
  rawToken: unknown,
) {
  const token = String(rawToken ?? '').trim().slice(0, 128)
  if (!token) return null
  const invite = await client.query<{
    created_by_user_id: string | null
    organization_id: string
  }>(
    `select link.organization_id, link.created_by_user_id
     from organization_invite_links link
     join organizations organization on organization.id = link.organization_id
     where link.token_hash = $1
       and link.revoked_at is null
       and link.expires_at > now()
     limit 1
     for update of link, organization`,
    [hashOrganizationInviteToken(token)],
  )
  const row = invite.rows[0]
  if (!row) return null
  const organizationId = Number(row.organization_id)
  const existing = await client.query<{ status: string }>(
    `select status from organization_memberships
     where organization_id = $1 and user_id = $2
     for update`,
    [organizationId, userId],
  )
  if (existing.rows[0]?.status === 'active') return organizationId

  await client.query(
    `insert into organization_memberships
      (organization_id, user_id, access_role, status, invited_by_user_id, joined_at, removed_at)
     values ($1, $2, 'member', 'active', $3, now(), null)
     on conflict (organization_id, user_id) do update
       set access_role = case
             when organization_memberships.access_role = 'owner' then 'owner'
             else 'member'
           end,
           status = 'active',
           invited_by_user_id = excluded.invited_by_user_id,
           joined_at = now(),
           removed_at = null`,
    [organizationId, userId, row.created_by_user_id ? Number(row.created_by_user_id) : null],
  )
  await writeAudit(
    client,
    organizationId,
    userId,
    'member.joined_by_link',
    'user',
    String(userId),
  )
  return organizationId
}

async function getOrganizationWeekStartsOn(organizationId: number) {
  const result = await query<{ week_starts_on: number }>(
    'select week_starts_on from organizations where id = $1',
    [organizationId],
  )
  return normalizeOrganizationWeekStartsOn(result.rows[0]?.week_starts_on) ?? 1
}

async function getOrganizationDetail(organizationId: number, userId: number) {
  const membership = await getOrganizationMembership(organizationId, userId)
  if (!membership) return null
  const assignedRoles = await getAssignedRoles(userId)
  const canManage = canManageOrganization(membership.access_role, assignedRoles)
  const canManageProjects = canManageOrganizationProjects(membership.access_role, assignedRoles)
  const canManageWeeklyReports = canManageOrganizationWeeklyReports(membership.access_role, assignedRoles)
  const [organization, members, projects, projectMemberships, milestones, testSpaces, todos, packageEvents, bugs, reports, summaries, invitations, attachableProjects, attachableTestSpaces, packageMarketPolicy] = await Promise.all([
    query<{
      created_at: Date
      id: string
      name: string
      owner_user_id: string
      weekly_report_close_day: number
      weekly_report_close_time: string
      weekly_report_open_day: number
      weekly_report_open_time: string
      week_starts_on: number
    }>(
      `select id, owner_user_id, name, week_starts_on,
         weekly_report_open_day, weekly_report_open_time,
         weekly_report_close_day, weekly_report_close_time,
         created_at
       from organizations where id = $1`,
      [organizationId],
    ),
    query<{
      access_role: OrganizationAccessRole
      display_name: string
      email: string
      feishu_bound: boolean
      joined_at: Date
      roles: string[]
      user_id: string
    }>(
      `
      select m.user_id, m.access_role, m.joined_at, u.email, u.display_name,
        coalesce(nullif(u.feishu_user_id, ''), nullif(u.feishu_email, '')) is not null as feishu_bound,
        coalesce(array_agg(distinct ur.role order by ur.role) filter (where ur.role is not null), '{}') as roles
      from organization_memberships m
      join users u on u.id = m.user_id
      left join user_roles ur on ur.user_id = u.id
      where m.organization_id = $1 and m.status = 'active'
      group by m.user_id, m.access_role, m.joined_at, u.id
      order by case m.access_role when 'owner' then 0 when 'admin' then 1 else 2 end,
        lower(coalesce(nullif(u.display_name, ''), u.email))
      `,
      [organizationId],
    ),
    query<{
      health_note_encrypted: string | null
      health_status: string
      id: string
      name: string
      open_todo_count: string
      owner_display_name: string
      owner_email: string
      owner_user_id: string
      status: string
      todo_count: string
      updated_at: Date
    }>(
      `
      select p.id, p.name, p.status, p.health_status, p.health_note_encrypted,
        p.updated_at, p.user_id as owner_user_id, owner.email as owner_email,
        owner.display_name as owner_display_name,
        count(distinct t.id) as todo_count,
        count(distinct t.id) filter (where t.done = false) as open_todo_count
      from projects p
      join users owner on owner.id = p.user_id
      left join todos t on t.project_id = p.id
      left join project_memberships mine
        on mine.project_id = p.id and mine.invited_user_id = $3 and mine.status = 'active'
      where p.organization_id = $1 and ($2::boolean or p.user_id = $3 or mine.id is not null)
      group by p.id, owner.id
      order by p.updated_at desc, p.id desc
      `,
      [organizationId, canManageProjects, userId],
    ),
    canManageProjects ? query<{
      created_at: Date
      id: string
      invited_email: string
      invited_user_id: string | null
      member_display_name: string | null
      member_email: string | null
      project_id: string
      role: string
      status: 'active' | 'declined' | 'pending'
    }>(
      `
      select pm.id, pm.project_id, pm.invited_user_id, pm.invited_email,
        pm.role, pm.status, pm.created_at,
        u.display_name as member_display_name,
        u.email as member_email
      from project_memberships pm
      join projects p on p.id = pm.project_id
      left join users u on u.id = pm.invited_user_id
      where p.organization_id = $1
      order by pm.created_at desc, pm.id desc
      `,
      [organizationId],
    ) : Promise.resolve({ rows: [] }),
    query<{
      acceptance_criteria: string
      baseline_date: Date | string
      completed_at: Date | null
      created_at: Date
      execution_note: string
      id: string
      linked_todos: Array<{ done: boolean; id: number | string; title: string }>
      project_id: string
      responsible_display_name: string | null
      responsible_email: string | null
      responsible_user_id: string | null
      status: string
      target_date: Date | string
      title: string
      updated_at: Date
    }>(
      `
      select milestone.id, milestone.project_id, milestone.title,
        milestone.acceptance_criteria, milestone.execution_note,
        milestone.baseline_date, milestone.target_date, milestone.status,
        milestone.responsible_user_id, milestone.completed_at,
        milestone.created_at, milestone.updated_at,
        responsible.email as responsible_email,
        responsible.display_name as responsible_display_name,
        coalesce(
          json_agg(json_build_object('id', todo.id, 'title', todo.title, 'done', todo.done)
            order by todo.due_date, todo.id) filter (where todo.id is not null),
          '[]'::json
        ) as linked_todos
      from project_milestones milestone
      join projects project on project.id = milestone.project_id
      left join users responsible on responsible.id = milestone.responsible_user_id
      left join project_milestone_todos link on link.milestone_id = milestone.id
      left join todos todo on todo.id = link.todo_id and todo.project_id = milestone.project_id
      left join project_memberships mine
        on mine.project_id = project.id and mine.invited_user_id = $3 and mine.status = 'active'
      where project.organization_id = $1
        and ($2::boolean or project.user_id = $3 or mine.id is not null)
      group by milestone.id, responsible.id
      order by milestone.target_date, milestone.sort_order, milestone.id
      `,
      [organizationId, canManageProjects, userId],
    ),
    query<{
      bug_count: string
      id: string
      name: string
      owner_display_name: string
      owner_email: string
      plan_count: string
      updated_at: Date
    }>(
      `
      select s.id, s.name, s.updated_at, owner.email as owner_email,
        owner.display_name as owner_display_name,
        count(distinct p.id) as plan_count,
        count(distinct b.id) as bug_count
      from test_spaces s
      join users owner on owner.id = s.owner_user_id
      left join test_space_memberships mine
        on mine.test_space_id = s.id and mine.user_id = $3 and mine.status = 'active'
      left join test_plans p on p.test_space_id = s.id
      left join test_bugs b on b.test_space_id = s.id
      where s.organization_id = $1 and ($2::boolean or mine.user_id is not null)
      group by s.id, owner.id
      order by s.updated_at desc, s.id desc
      `,
      [organizationId, canManageProjects, userId],
    ),
    query<{
      assignee_display_name: string | null
      assignee_email: string | null
      assignee_user_id: string | null
      done: boolean
      due_date: Date
      id: string
      priority: string
      project_id: string
      project_name: string
      title: string
      updated_at: Date
    }>(
      `
      select t.id, t.project_id, p.name as project_name, t.title, t.priority, t.done,
        t.due_date, t.updated_at, t.assignee_user_id, assignee.email as assignee_email,
        assignee.display_name as assignee_display_name
      from todos t
      join projects p on p.id = t.project_id
      left join users assignee on assignee.id = t.assignee_user_id
      left join project_memberships mine
        on mine.project_id = p.id and mine.invited_user_id = $3 and mine.status = 'active'
      where p.organization_id = $1 and ($2::boolean or p.user_id = $3 or mine.id is not null)
      order by t.done, t.updated_at desc, t.id desc
      limit 200
      `,
      [organizationId, canManageProjects, userId],
    ),
    query<{
      assignee_display_name: string | null
      assignee_email: string | null
      assignee_user_id: string | null
      delivery_date: Date
      id: string
      project_id: string
      project_name: string
      status: string
      title: string
      updated_at: Date
    }>(
      `
      select e.id, e.project_id, p.name as project_name, e.title, e.status,
        e.delivery_date, e.updated_at, e.assignee_user_id, assignee.email as assignee_email,
        assignee.display_name as assignee_display_name
      from project_package_events e
      join projects p on p.id = e.project_id
      left join users assignee on assignee.id = e.assignee_user_id
      left join project_memberships mine
        on mine.project_id = p.id and mine.invited_user_id = $3 and mine.status = 'active'
      where p.organization_id = $1 and ($2::boolean or p.user_id = $3 or mine.id is not null)
      order by e.updated_at desc, e.id desc
      limit 200
      `,
      [organizationId, canManageProjects, userId],
    ),
    query<{
      assignee_display_name: string | null
      assignee_email: string | null
      assignee_user_id: string | null
      id: string
      priority: string
      severity: string
      status: string
      test_space_id: string
      test_space_name: string
      title: string
      updated_at: Date
    }>(
      `
      select b.id, b.test_space_id, s.name as test_space_name, b.title, b.priority,
        b.severity, b.status, b.updated_at, b.assignee_user_id, assignee.email as assignee_email,
        assignee.display_name as assignee_display_name
      from test_bugs b
      join test_spaces s on s.id = b.test_space_id
      left join users assignee on assignee.id = b.assignee_user_id
      left join test_space_memberships mine
        on mine.test_space_id = s.id and mine.user_id = $3 and mine.status = 'active'
      where s.organization_id = $1 and ($2::boolean or mine.user_id is not null or b.assignee_user_id = $3)
      order by b.updated_at desc, b.id desc
      limit 200
      `,
      [organizationId, canManageProjects, userId],
    ),
    query<{
      content: string
      display_name: string
      email: string
      status: string
      submitted_at: Date | null
      updated_at: Date
      user_id: string
      week_start: Date | string
    }>(
      `
      select r.user_id, r.week_start, r.content, r.status, r.updated_at, r.submitted_at,
        u.email, u.display_name
      from organization_weekly_reports r
      join users u on u.id = r.user_id
      where r.organization_id = $1 and ($2::boolean and r.status = 'submitted' or r.user_id = $3)
      order by r.week_start desc, lower(coalesce(nullif(u.display_name, ''), u.email))
      limit 200
      `,
      [organizationId, canManageWeeklyReports, userId],
    ),
    canManageWeeklyReports ? query<{
      content: string
      created_at: Date
      source_report_count: number
      week_start: Date | string
    }>(
      `select week_start, content, source_report_count, created_at
       from organization_weekly_summaries where organization_id = $1
       order by week_start desc limit 12`,
      [organizationId],
    ) : Promise.resolve({ rows: [] }),
    canManage ? query<{
      created_at: Date
      id: string
      last_error: string
      status: string
      target_email: string
    }>(
      `select id, target_email, status, last_error, created_at
       from organization_invitations where organization_id = $1
         and status <> 'accepted'
       order by created_at desc limit 50`,
      [organizationId],
    ) : Promise.resolve({ rows: [] }),
    query<{ id: string; name: string; status: string }>(
      `select id, name, status from projects
       where user_id = $1 and organization_id is null order by updated_at desc`,
      [userId],
    ),
    query<{ id: string; name: string }>(
      `select id, name from test_spaces
       where owner_user_id = $1 and organization_id is null order by updated_at desc`,
      [userId],
    ),
    getOrganizationPackageMarketPolicy(organizationId),
  ])
  const row = organization.rows[0]
  if (!row) return null
  const departedUserIds = await getDepartedUserIds()
  const taskRows = [
    ...todos.rows.map((task) => ({
      assigneeName: task.assignee_email
        ? String(task.assignee_display_name || task.assignee_email)
        : '',
      assigneeUserId: task.assignee_user_id ? Number(task.assignee_user_id) : undefined,
      id: Number(task.id),
      kind: 'todo' as const,
      projectId: Number(task.project_id),
      projectName: decryptText(task.project_name),
      status: task.done ? 'completed' : 'open',
      title: decryptText(task.title),
      updatedAt: task.updated_at.toISOString(),
    })),
    ...packageEvents.rows.map((task) => ({
      assigneeName: task.assignee_email
        ? String(task.assignee_display_name || task.assignee_email)
        : '',
      assigneeUserId: task.assignee_user_id ? Number(task.assignee_user_id) : undefined,
      id: Number(task.id),
      kind: 'delivery' as const,
      projectId: Number(task.project_id),
      projectName: decryptText(task.project_name),
      status: task.status,
      title: decryptText(task.title),
      updatedAt: task.updated_at.toISOString(),
    })),
    ...bugs.rows.map((task) => ({
      assigneeName: task.assignee_email
        ? String(task.assignee_display_name || task.assignee_email)
        : '',
      assigneeUserId: task.assignee_user_id ? Number(task.assignee_user_id) : undefined,
      id: Number(task.id),
      kind: 'bug' as const,
      projectName: decryptText(task.test_space_name),
      status: task.status,
      title: decryptText(task.title),
      updatedAt: task.updated_at.toISOString(),
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const milestonesByProject = new Map<number, Array<{
    acceptanceCriteria: string
    baselineDate: string
    completedAt?: string
    createdAt: string
    executionNote: string
    id: number
    linkedTodos: Array<{ done: boolean; id: number; title: string }>
    responsibleName: string
    responsibleUserId?: number
    status: 'pending' | 'in_review' | 'achieved' | 'cancelled'
    targetDate: string
    title: string
    updatedAt: string
  }>>()
  for (const milestone of milestones.rows) {
    const projectId = Number(milestone.project_id)
    const projectMilestones = milestonesByProject.get(projectId) ?? []
    projectMilestones.push({
      acceptanceCriteria: decryptText(milestone.acceptance_criteria),
      baselineDate: dateOnly(milestone.baseline_date),
      completedAt: milestone.completed_at?.toISOString(),
      createdAt: milestone.created_at.toISOString(),
      executionNote: decryptText(milestone.execution_note),
      id: Number(milestone.id),
      linkedTodos: milestone.linked_todos.map((todo) => ({
        done: todo.done,
        id: Number(todo.id),
        title: decryptText(todo.title),
      })),
      responsibleName: milestone.responsible_user_id
        ? String(milestone.responsible_display_name || milestone.responsible_email)
        : '',
      responsibleUserId: milestone.responsible_user_id
        ? Number(milestone.responsible_user_id)
        : undefined,
      status: normalizeProjectMilestoneStatus(milestone.status) ?? 'pending',
      targetDate: dateOnly(milestone.target_date),
      title: decryptText(milestone.title),
      updatedAt: milestone.updated_at.toISOString(),
    })
    milestonesByProject.set(projectId, projectMilestones)
  }
  const membershipsByProject = new Map<number, Array<{
    createdAt: string
    id: number
    invitedUsername: string
    invitedUserId?: number
    memberName: string
    projectId: number
    role: 'member' | 'owner'
    status: 'active' | 'declined' | 'pending'
  }>>()
  for (const membershipRow of projectMemberships.rows) {
    const projectId = Number(membershipRow.project_id)
    const memberships = membershipsByProject.get(projectId) ?? []
    const invitedUsername = decryptText(membershipRow.invited_email)
    memberships.push({
      createdAt: membershipRow.created_at.toISOString(),
      id: Number(membershipRow.id),
      invitedUsername,
      invitedUserId: membershipRow.invited_user_id ? Number(membershipRow.invited_user_id) : undefined,
      memberName: membershipRow.member_email
        ? displayName({
          display_name: membershipRow.member_display_name,
          email: membershipRow.member_email,
        })
        : invitedUsername,
      projectId,
      role: membershipRow.role === 'owner' ? 'owner' : 'member',
      status: membershipRow.status,
    })
    membershipsByProject.set(projectId, memberships)
  }

  return {
    accessRole: membership.access_role,
    departedUserIds,
    attachableProjects: attachableProjects.rows.map((project) => ({
      id: Number(project.id),
      name: decryptText(project.name),
      status: project.status,
    })),
    attachableTestSpaces: attachableTestSpaces.rows.map((space) => ({
      id: Number(space.id),
      name: decryptText(space.name),
    })),
    canManage,
    canManageProjects,
    canManageWeeklyReports,
    createdAt: row.created_at.toISOString(),
    id: Number(row.id),
    invitations: invitations.rows.map((invite) => ({
      createdAt: invite.created_at.toISOString(),
      id: Number(invite.id),
      lastError: invite.last_error,
      status: invite.status,
      targetEmail: decryptText(invite.target_email),
    })),
    members: members.rows.map((member) => ({
      accessRole: member.access_role,
      displayName: displayName(member),
      feishuBound: member.feishu_bound,
      id: Number(member.user_id),
      joinedAt: member.joined_at.toISOString(),
      roles: member.roles,
      username: member.email,
    })),
    name: decryptText(row.name),
    ownerUserId: Number(row.owner_user_id),
    packageMarketPolicy,
    projects: projects.rows.map((project) => ({
      healthNote: project.health_note_encrypted ? decryptText(project.health_note_encrypted) : '',
      healthStatus: normalizeOrganizationProjectHealthStatus(project.health_status) ?? 'on_track',
      id: Number(project.id),
      memberships: membershipsByProject.get(Number(project.id)) ?? [],
      milestones: milestonesByProject.get(Number(project.id)) ?? [],
      name: decryptText(project.name),
      openTodoCount: Number(project.open_todo_count),
      ownerName: String(project.owner_display_name || project.owner_email),
      ownerUserId: Number(project.owner_user_id),
      status: normalizeOrganizationProjectStatus(project.status) ?? 'active',
      todoCount: Number(project.todo_count),
      updatedAt: project.updated_at.toISOString(),
    })),
    reports: reports.rows.map((report) => ({
      content: decryptText(report.content),
      memberName: displayName(report),
      status: report.status,
      submittedAt: report.submitted_at?.toISOString(),
      updatedAt: report.updated_at.toISOString(),
      userId: Number(report.user_id),
      weekStart: dateOnly(report.week_start),
    })),
    summaries: summaries.rows.map((summary) => ({
      content: decryptText(summary.content),
      createdAt: summary.created_at.toISOString(),
      sourceReportCount: summary.source_report_count,
      weekStart: dateOnly(summary.week_start),
    })),
    tasks: taskRows.slice(0, 200),
    testSpaces: testSpaces.rows.map((space) => ({
      bugCount: Number(space.bug_count),
      id: Number(space.id),
      name: decryptText(space.name),
      ownerName: String(space.owner_display_name || space.owner_email),
      planCount: Number(space.plan_count),
      updatedAt: space.updated_at.toISOString(),
    })),
    weeklyReportRules: normalizeWeeklyReportRules({
      closeDay: row.weekly_report_close_day,
      closeTime: String(row.weekly_report_close_time).slice(0, 5),
      openDay: row.weekly_report_open_day,
      openTime: String(row.weekly_report_open_time).slice(0, 5),
    }) ?? {
      closeDay: 1,
      closeTime: '23:59',
      openDay: 5,
      openTime: '00:00',
    },
    weekStartsOn: normalizeOrganizationWeekStartsOn(row.week_starts_on) ?? 1,
  }
}

export function createOrganizationRouter(dependencies: OrganizationRouterDependencies) {
  const router = Router()

  router.get('/organizations', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizations = await query<{
      access_role: OrganizationAccessRole
      id: string
      member_count: string
      name: string
      package_market_enabled: boolean | null
    }>(
      `
      select o.id, o.name, mine.access_role,
        count(m.user_id) filter (where m.status = 'active') as member_count,
        (
          coalesce(feature.enabled, true)
          and (
            (coalesce(release_channel.enabled, true) or coalesce(ci_channel.enabled, true))
          )
          and (
            (
              selection_policy.organization_id is not null
              and (
                selection_policy.mode in ('all', 'excluded')
                or exists (
                  select 1
                  from organization_package_market_selection_rules selection_rule
                  where selection_rule.organization_id = o.id
                )
              )
            )
            or (
              selection_policy.organization_id is null
              and (
                (
                  coalesce(release_channel.enabled, true)
                  and (
                    coalesce(release_channel.mode, 'all') in ('all', 'excluded')
                    or exists (
                      select 1
                      from organization_package_market_selections release_selection
                      where release_selection.organization_id = o.id
                        and release_selection.channel = 'release'
                    )
                  )
                )
                or (
                  coalesce(ci_channel.enabled, true)
                  and (
                    coalesce(ci_channel.mode, 'all') in ('all', 'excluded')
                    or exists (
                      select 1
                      from organization_package_market_selections ci_selection
                      where ci_selection.organization_id = o.id
                        and ci_selection.channel = 'ci'
                    )
                  )
                )
              )
            )
          )
        ) as package_market_enabled
      from organization_memberships mine
      join organizations o on o.id = mine.organization_id
      left join organization_memberships m on m.organization_id = o.id
      left join organization_feature_settings feature
        on feature.organization_id = o.id and feature.feature_key = 'package_market'
      left join organization_package_market_selection_policies selection_policy
        on selection_policy.organization_id = o.id
      left join organization_package_market_channel_policies release_channel
        on release_channel.organization_id = o.id and release_channel.channel = 'release'
      left join organization_package_market_channel_policies ci_channel
        on ci_channel.organization_id = o.id and ci_channel.channel = 'ci'
      where mine.user_id = $1 and mine.status = 'active'
      group by o.id, mine.access_role, feature.enabled,
        selection_policy.organization_id, selection_policy.mode,
        release_channel.enabled, release_channel.mode,
        ci_channel.enabled, ci_channel.mode
      order by lower(o.name), o.id
      `,
      [session.userId],
    )
    const items = organizations.rows.map((organization) => ({
      accessRole: organization.access_role,
      id: Number(organization.id),
      memberCount: Number(organization.member_count),
      name: decryptText(organization.name),
      packageMarketEnabled: organization.package_market_enabled !== false,
    })).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    response.json({
      canCreate: isSystemAdmin(session.username),
      organizations: items,
    })
  }))

  router.post('/admin/organizations', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    if (!isSystemAdmin(session.username)) {
      response.status(403).json({ error: 'System administrator access is required' })
      return
    }
    const name = normalizeOrganizationName(request.body?.name)
    const ownerUsername = normalizedEmail(request.body.ownerUsername || session.username)
    if (!name || !ownerUsername) {
      response.status(400).json({ error: 'Organization name and owner username are required' })
      return
    }
    const owner = await query<{ id: string }>('select id from users where email = $1', [ownerUsername])
    if (!owner.rows[0]) {
      response.status(404).json({ error: 'Organization owner account not found' })
      return
    }
    const client = await pool.connect()
    try {
      await client.query('begin')
      const created = await client.query<{ id: string }>(
        `insert into organizations (owner_user_id, name, name_lookup, created_by_user_id)
         values ($1, $2, $3, $4) returning id`,
        [Number(owner.rows[0].id), encryptText(name), blindIndex(name), session.userId],
      )
      const organizationId = Number(created.rows[0].id)
      await client.query(
        `insert into user_roles (user_id, role)
         values ($1, 'organization_admin')
         on conflict (user_id, role) do nothing`,
        [Number(owner.rows[0].id)],
      )
      await client.query(
        `insert into organization_memberships
          (organization_id, user_id, access_role, status, invited_by_user_id)
         values ($1, $2, 'owner', 'active', $3)`,
        [organizationId, Number(owner.rows[0].id), session.userId],
      )
      await writeAudit(client, organizationId, session.userId, 'organization.created', 'organization', String(organizationId), name)
      await client.query('commit')
      response.status(201).json(await getOrganizationDetail(organizationId, Number(owner.rows[0].id)))
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }))

  router.get('/organizations/:organizationId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!organizationId) {
      response.status(400).json({ error: 'Valid organization is required' })
      return
    }
    const detail = await getOrganizationDetail(organizationId, session.userId)
    if (!detail) {
      response.status(404).json({ error: 'Organization not found' })
      return
    }
    response.json(detail)
  }))

  router.get('/organizations/:organizationId/package-market/catalog', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const policy = await getOrganizationPackageMarketPolicy(organizationId!)
    const rules = await listPackageMarketRules()
    response.json({
      policy,
      rules: rules.map((rule) => ({
        ...rule,
        canonicalId: canonicalPackageMarketRuleId(rule.id),
        ciVisible: isPackageMarketRuleVisible(rule, policy, 'ci' as OrganizationPackageMarketChannel),
        ciSupported: packageMarketRuleSupportsChannel(canonicalPackageMarketRuleId(rule.id), 'ci'),
        releaseVisible: isPackageMarketRuleVisible(rule, policy, 'release' as OrganizationPackageMarketChannel),
        selectable: isSelectablePackageMarketRule(rule),
      })),
    })
  }))

  router.put('/organizations/:organizationId/package-market/policy', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const input = normalizePackageMarketPolicyInput(request.body)
    const rules = await listPackageMarketRules()
    try {
      validatePackageMarketPolicyInput(input, rules)
    } catch (error) {
      if (error instanceof OrganizationPackageMarketPolicyError) {
        response.status(error.status).json({ error: error.message, code: error.code })
        return
      }
      throw error
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await lockManagedOrganization(client, organizationId!, session.userId)
      if (!organization) {
        await client.query('rollback')
        response.status(409).json({ error: '组织权限已变化，请刷新后重试' })
        return
      }
      const currentPolicy = await getOrganizationPackageMarketPolicy(organizationId!, client)
      const savedPolicy = await saveOrganizationPackageMarketPolicy({
        client,
        input: input!,
        organizationId: organizationId!,
        updatedByUserId: session.userId,
      })
      await writeAudit(
        client,
        organizationId!,
        session.userId,
        'organization.package_market_policy_changed',
        'organization_feature',
        'package_market',
        JSON.stringify({ from: currentPolicy, to: savedPolicy }),
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      if (error instanceof OrganizationPackageMarketPolicyError) {
        response.status(error.status).json({ error: error.message, code: error.code })
        return
      }
      throw error
    } finally {
      client.release()
    }
    const detail = await getOrganizationDetail(organizationId!, session.userId)
    if (!detail) {
      response.status(404).json({ error: 'Organization not found' })
      return
    }
    response.json(detail)
  }))

  router.patch('/organizations/:organizationId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const name = normalizeOrganizationName(request.body?.name)
    if (!name) {
      response.status(400).json({ error: 'Organization name must contain 1 to 80 characters' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await lockManagedOrganization(client, organizationId!, session.userId)
      if (!organization) {
        await client.query('rollback')
        response.status(409).json({ error: 'Organization access changed, reload and try again' })
        return
      }
      const previousName = decryptText(organization.name)
      if (previousName !== name) {
        await client.query(
          `update organizations
           set name = $1, name_lookup = $2, updated_at = now()
           where id = $3`,
          [encryptText(name), blindIndex(name), organizationId],
        )
        await writeAudit(
          client,
          organizationId!,
          session.userId,
          'organization.renamed',
          'organization',
          String(organizationId),
          `${previousName} -> ${name}`,
        )
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      if (databaseErrorCode(error) === '23505') {
        response.status(409).json({ error: 'An organization with this name already exists' })
        return
      }
      throw error
    } finally {
      client.release()
    }

    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.patch('/organizations/:organizationId/week-start', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const weekStartsOn = normalizeOrganizationWeekStartsOn(request.body?.weekStartsOn)
    if (!weekStartsOn) {
      response.status(400).json({ error: 'Week start must be between Monday and Sunday' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await lockManagedOrganization(client, organizationId!, session.userId)
      if (!organization) {
        await client.query('rollback')
        response.status(409).json({ error: 'Organization access changed, reload and try again' })
        return
      }
      await client.query(
        'update organizations set week_starts_on = $1, updated_at = now() where id = $2',
        [weekStartsOn, organizationId],
      )
      await writeAudit(
        client,
        organizationId!,
        session.userId,
        'organization.week_start_changed',
        'organization',
        String(organizationId),
        String(weekStartsOn),
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.patch('/organizations/:organizationId/weekly-report-rules', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationWeeklyReportManager(response, organizationId, session.userId))) return
    const weekStartsOn = normalizeOrganizationWeekStartsOn(request.body?.weekStartsOn)
    const weeklyReportRules = normalizeWeeklyReportRules(request.body?.weeklyReportRules)
    if (!weekStartsOn || !weeklyReportRules) {
      response.status(400).json({
        error: '周报规则无效：截止时间必须早于下一轮开放时间，且日期与时间格式正确',
      })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await client.query(
        `select o.id
         from organizations o
         join organization_memberships membership
           on membership.organization_id = o.id
          and membership.user_id = $2
          and membership.status = 'active'
         join user_roles role
           on role.user_id = $2 and role.role = 'organization_admin'
         where o.id = $1
         for update of o, membership, role`,
        [organizationId, session.userId],
      )
      if (!organization.rows[0]) {
        await client.query('rollback')
        response.status(409).json({ error: '组织权限已变化，请刷新后重试' })
        return
      }
      await client.query(
        `update organizations
         set week_starts_on = $1,
             weekly_report_open_day = $2,
             weekly_report_open_time = $3,
             weekly_report_close_day = $4,
             weekly_report_close_time = $5,
             updated_at = now()
         where id = $6`,
        [
          weekStartsOn,
          weeklyReportRules.openDay,
          weeklyReportRules.openTime,
          weeklyReportRules.closeDay,
          weeklyReportRules.closeTime,
          organizationId,
        ],
      )
      await writeAudit(
        client,
        organizationId!,
        session.userId,
        'organization.weekly_report_rules_changed',
        'organization',
        String(organizationId),
        JSON.stringify({ weekStartsOn, weeklyReportRules }),
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.delete('/organizations/:organizationId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return

    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await lockManagedOrganization(client, organizationId!, session.userId)
      if (!organization) {
        await client.query('rollback')
        response.status(409).json({ error: 'Organization access changed, reload and try again' })
        return
      }
      const organizationName = decryptText(organization.name)
      if (!matchesOrganizationDeleteConfirmation(
        organizationName,
        request.body?.confirmationName,
      )) {
        await client.query('rollback')
        response.status(400).json({ error: 'Enter the full organization name to confirm deletion' })
        return
      }

      const projects = await client.query(
        `update projects set organization_id = null, updated_at = now()
         where organization_id = $1 returning id`,
        [organizationId],
      )
      const testSpaces = await client.query(
        `update test_spaces set organization_id = null, updated_at = now()
         where organization_id = $1 returning id`,
        [organizationId],
      )
      await client.query('delete from organizations where id = $1', [organizationId])
      await client.query('commit')
      response.json({
        deleted: true,
        detachedProjectCount: projects.rowCount ?? 0,
        detachedTestSpaceCount: testSpaces.rowCount ?? 0,
      })
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }))

  router.post('/organizations/:organizationId/invitations', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    if (String(process.env.FEISHU_DELIVERY_ENABLED ?? 'true').toLowerCase() === 'false') {
      response.status(503).json({ error: 'Feishu invitation delivery is disabled' })
      return
    }
    const email = normalizedEmail(request.body?.email)
    if (!email || !email.includes('@')) {
      response.status(400).json({ error: 'A valid Feishu email is required' })
      return
    }
    let openId: string
    try {
      openId = await dependencies.resolveFeishuOpenIdByEmail(email)
    } catch (error) {
      const mappedError = feishuInvitationLookupError(error)
      console.warn('Feishu organization invitation lookup failed', {
        email: maskedEmail(email),
        error: error instanceof Error ? error.message : error,
      })
      response.status(mappedError.status).json({ error: mappedError.message })
      return
    }
    const existingMember = await query<{ id: string }>(
      `select m.user_id as id from organization_memberships m
       join users u on u.id = m.user_id
       where m.organization_id = $1 and m.status = 'active'
         and (u.email = $2 or u.feishu_user_id = $3) limit 1`,
      [organizationId, email, openId],
    )
    if (existingMember.rows[0]) {
      response.status(409).json({ error: 'User is already an organization member' })
      return
    }
    const inviter = await query<{ display_name: string; email: string }>(
      'select display_name, email from users where id = $1',
      [session.userId],
    )
    const organization = await query<{ name: string }>('select name from organizations where id = $1', [organizationId])
    const token = crypto.randomBytes(32).toString('base64url')
    const client = await pool.connect()
    let invitationId: number
    try {
      await client.query('begin')
      await client.query(
        `update organization_invitations set status = 'revoked', responded_at = now()
         where organization_id = $1 and target_email_lookup = $2 and status = 'pending'`,
        [organizationId, blindIndex(email)],
      )
      const invitation = await client.query<{ id: string }>(
        `insert into organization_invitations
          (organization_id, invited_by_user_id, target_email, target_email_lookup,
           target_open_id, token_hash, expires_at)
         values ($1, $2, $3, $4, $5, $6, now() + interval '72 hours') returning id`,
        [organizationId, session.userId, encryptText(email), blindIndex(email), openId, hashOrganizationInviteToken(token)],
      )
      invitationId = Number(invitation.rows[0].id)
      await writeAudit(client, organizationId!, session.userId, 'invitation.created', 'organization_invitation', String(invitationId), email)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      if (databaseErrorCode(error) === '23505') {
        response.status(409).json({ error: '该成员已有待处理的组织邀请，请稍后刷新后重试。' })
        return
      }
      throw error
    } finally {
      client.release()
    }
    try {
      const sent = await dependencies.sendFeishuMessage({
        content: buildOrganizationInvitationCard({
          invitationId,
          inviterName: displayName(inviter.rows[0] ?? {}),
          organizationName: decryptText(organization.rows[0].name),
          token,
        }),
        msgType: 'interactive',
        receiveId: openId,
        receiveIdType: 'open_id',
      })
      await query(
        `update organization_invitations set feishu_message_id = $1, last_error = '' where id = $2`,
        [sent?.messageId ?? '', invitationId],
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feishu delivery failed'
      await query(
        `update organization_invitations set status = 'delivery_failed', last_error = $1 where id = $2`,
        [message.slice(0, 500), invitationId],
      )
      response.status(502).json({ error: message })
      return
    }
    response.status(201).json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/username-invitations', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const username = normalizedEmail(request.body.username)
    if (!username) {
      response.status(400).json({ error: 'Invite username is required' })
      return
    }
    const user = await query<{ id: string }>('select id from users where email = $1', [username])
    if (!user.rows[0]) {
      response.status(404).json({ error: 'Account not found' })
      return
    }
    const targetUserId = Number(user.rows[0].id)
    if (targetUserId === session.userId) {
      response.status(409).json({ error: 'You are already an organization member' })
      return
    }
    const activeMember = await query<{ user_id: string }>(
      `select user_id from organization_memberships
       where organization_id = $1 and user_id = $2 and status = 'active'`,
      [organizationId, targetUserId],
    )
    if (activeMember.rows[0]) {
      response.status(409).json({ error: 'User is already an organization member' })
      return
    }
    const client = await pool.connect()
    try {
      await client.query('begin')
      const membership = await client.query(
        `insert into organization_memberships
          (organization_id, user_id, access_role, status, invited_by_user_id, joined_at, removed_at)
         values ($1, $2, 'member', 'active', $3, now(), null)
         on conflict (organization_id, user_id) do update
           set access_role = case
                 when organization_memberships.access_role = 'owner' then 'owner'
                 else 'member'
               end,
               status = 'active',
               invited_by_user_id = excluded.invited_by_user_id,
               joined_at = now(),
               removed_at = null
         where organization_memberships.status <> 'active'
         returning user_id`,
        [organizationId, targetUserId, session.userId],
      )
      if (!membership.rows[0]) {
        await client.query('rollback')
        response.status(409).json({ error: 'User is already an organization member' })
        return
      }
      await writeAudit(client, organizationId!, session.userId, 'member.invited_by_username', 'user', String(targetUserId), username)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.status(201).json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/invite-link', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationAdmin(response, organizationId, session.userId))) return
    const expiresInMinutes = normalizeOrganizationInviteExpiresInMinutes(request.body?.expiresInMinutes)
    const token = createOrganizationInviteToken()
    const client = await pool.connect()
    try {
      await client.query('begin')
      const organization = await lockManagedOrganization(client, organizationId!, session.userId)
      if (!organization) {
        await client.query('rollback')
        response.status(409).json({ error: 'Organization access changed, reload and try again' })
        return
      }
      await client.query(
        `update organization_invite_links
         set revoked_at = now()
         where organization_id = $1 and revoked_at is null`,
        [organizationId],
      )
      const invite = await client.query<{ expires_at: Date }>(
        `insert into organization_invite_links
          (organization_id, created_by_user_id, token_hash, expires_at)
         values ($1, $2, $3, now() + ($4::integer * interval '1 minute'))
         returning expires_at`,
        [organizationId, session.userId, hashOrganizationInviteToken(token), expiresInMinutes],
      )
      await writeAudit(
        client,
        organizationId!,
        session.userId,
        'invitation.link_created',
        'organization_invite_link',
        '',
        JSON.stringify({ expiresInMinutes }),
      )
      await client.query('commit')
      response.status(201).json({
        expiresAt: invite.rows[0].expires_at.toISOString(),
        expiresInMinutes,
        token,
      })
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }))

  router.get('/organization-invite-links/:token', asyncRoute(async (request, response) => {
    const token = String(request.params.token ?? '').trim().slice(0, 128)
    if (!token) {
      response.status(404).json({ error: 'Organization invite link not found' })
      return
    }
    const invite = await query<{ expires_at: Date; name: string }>(
      `select link.expires_at, organization.name
       from organization_invite_links link
       join organizations organization on organization.id = link.organization_id
       where link.token_hash = $1
         and link.revoked_at is null
         and link.expires_at > now()
       limit 1`,
      [hashOrganizationInviteToken(token)],
    )
    if (!invite.rows[0]) {
      response.status(404).json({ error: 'Organization invite link not found' })
      return
    }
    response.json({
      expiresAt: invite.rows[0].expires_at.toISOString(),
      organizationName: decryptText(invite.rows[0].name),
      valid: true,
    })
  }))

  router.post('/organization-invite-links/:token/accept', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const client = await pool.connect()
    try {
      await client.query('begin')
      const organizationId = await acceptOrganizationInviteTokenWithClient(
        client,
        session.userId,
        request.params.token,
      )
      if (!organizationId) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization invite link not found' })
        return
      }
      await client.query('commit')
      response.json({ ok: true, organizationId })
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }))

  router.patch('/organizations/:organizationId/members/:userId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const userId = positiveId(request.params.userId)
    const admin = await requireOrganizationAdmin(response, organizationId, session.userId)
    if (!admin || !userId) return
    const accessRole = request.body.accessRole
    if (!isOrganizationAccessRole(accessRole) || accessRole === 'owner') {
      response.status(400).json({ error: 'Member or administrator role is required' })
      return
    }
    const target = await query<{ access_role: OrganizationAccessRole }>(
      `select access_role from organization_memberships
       where organization_id = $1 and user_id = $2 and status = 'active'`,
      [organizationId, userId],
    )
    if (!target.rows[0] || target.rows[0].access_role === 'owner') {
      response.status(404).json({ error: 'Organization member not found' })
      return
    }
    await query(
      `update organization_memberships set access_role = $1
       where organization_id = $2 and user_id = $3 and status = 'active'`,
      [accessRole, organizationId, userId],
    )
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.delete('/organizations/:organizationId/members/:userId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const userId = positiveId(request.params.userId)
    const admin = await requireOrganizationAdmin(response, organizationId, session.userId)
    if (!admin || !userId) return
    const target = await query<{ access_role: OrganizationAccessRole }>(
      `select access_role from organization_memberships
       where organization_id = $1 and user_id = $2 and status = 'active'`,
      [organizationId, userId],
    )
    if (!target.rows[0] || target.rows[0].access_role === 'owner') {
      response.status(409).json({ error: 'Organization owner cannot be removed' })
      return
    }
    const ownedResources = await query<{ count: string }>(
      `select (
        (select count(*) from projects where organization_id = $1 and user_id = $2) +
        (select count(*) from test_spaces where organization_id = $1 and owner_user_id = $2)
      )::text as count`,
      [organizationId, userId],
    )
    if (Number(ownedResources.rows[0]?.count ?? 0) > 0) {
      response.status(409).json({ error: 'Transfer projects and test spaces owned by this member before removal' })
      return
    }
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(
        `update todos set assignee_user_id = null, assigned_by_user_id = null, assigned_at = null
         where assignee_user_id = $1 and project_id in
           (select id from projects where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `update todos set watcher_user_id = null, watched_by_user_id = null, watched_at = null
         where watcher_user_id = $1 and project_id in
           (select id from projects where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `update todos set reviewer_user_id = null
         where reviewer_user_id = $1 and project_id in
           (select id from projects where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `update project_package_events set assignee_user_id = null, assigned_by_user_id = null, assigned_at = null
         where assignee_user_id = $1 and project_id in
           (select id from projects where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `insert into test_bug_comments (test_bug_id, author_user_id, content)
         select b.id, $3, $4 from test_bugs b
         join test_spaces s on s.id = b.test_space_id
         where s.organization_id = $2 and b.assignee_user_id = $1
           and b.status not in ('closed', 'rejected', 'duplicate')`,
        [userId, organizationId, session.userId, encryptText('负责人已移出组织，系统已清除指派。')],
      )
      await client.query(
        `update test_bugs b set assignee_user_id = null,
           status = case when b.status in ('assigned', 'in_progress', 'reopened', 'confirmed') then 'pending_confirmation' else b.status end,
           updated_at = now()
         from test_spaces s
         where s.id = b.test_space_id and s.organization_id = $2 and b.assignee_user_id = $1
           and b.status not in ('closed', 'rejected', 'duplicate')`,
        [userId, organizationId],
      )
      await client.query(
        `delete from project_memberships where invited_user_id = $1 and project_id in
           (select id from projects where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `delete from test_space_memberships where user_id = $1 and test_space_id in
           (select id from test_spaces where organization_id = $2)`,
        [userId, organizationId],
      )
      await client.query(
        `update organization_memberships set status = 'removed', removed_at = now()
         where organization_id = $1 and user_id = $2`,
        [organizationId, userId],
      )
      await writeAudit(client, organizationId!, session.userId, 'member.removed', 'user', String(userId))
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/projects/:projectId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    if (!(await requireOrganizationMember(response, organizationId, session.userId)) || !projectId) return
    const outsideMembers = await query<{ count: string }>(
      `select count(*)::text as count from project_memberships pm
       where pm.project_id = $1 and pm.status in ('pending', 'active')
         and (pm.invited_user_id is null or not exists (
           select 1 from organization_memberships om
           where om.organization_id = $2 and om.user_id = pm.invited_user_id and om.status = 'active'
         ))`,
      [projectId, organizationId],
    )
    if (Number(outsideMembers.rows[0]?.count ?? 0) > 0) {
      response.status(409).json({ error: 'All active project members must join the organization first' })
      return
    }
    const client = await pool.connect()
    try {
      await client.query('begin')
      const updated = await client.query(
        `update projects set organization_id = $1, updated_at = now()
         where id = $2 and user_id = $3 and organization_id is null returning id`,
        [organizationId, projectId, session.userId],
      )
      if (!updated.rows[0]) {
        await client.query('rollback')
        response.status(404).json({ error: 'Owned personal project not found' })
        return
      }
      await client.query(
        `update project_invite_links set revoked_at = now()
         where project_id = $1 and revoked_at is null`,
        [projectId],
      )
      await writeAudit(client, organizationId!, session.userId, 'project.attached', 'project', String(projectId))
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/projects/:projectId/members', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    if (!(await requireOrganizationProjectManager(response, organizationId, session.userId)) || !projectId) return

    const memberUserId = positiveId(request.body?.userId)
    if (!memberUserId) {
      response.status(400).json({ error: 'Valid organization member is required' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      const ownerUserId = Number(project.owner_user_id)
      if (memberUserId === ownerUserId) {
        await client.query('rollback')
        response.status(400).json({ error: 'Project owner already has access to this project' })
        return
      }
      const organizationMember = await client.query<{ email: string; user_id: string }>(
        `select membership.user_id, member.email
         from organization_memberships membership
         join users member on member.id = membership.user_id
         where membership.organization_id = $1
           and membership.user_id = $2
           and membership.status = 'active'
         for update of membership, member`,
        [organizationId, memberUserId],
      )
      if (!organizationMember.rows[0]) {
        await client.query('rollback')
        response.status(400).json({ error: 'Only active organization members can join this project' })
        return
      }
      const username = normalizedEmail(organizationMember.rows[0].email)
      const emailLookup = blindIndex(username)
      const existingMembership = await client.query<{ id: string }>(
        `select id from project_memberships
         where project_id = $1
           and (invited_user_id = $2 or invited_email_lookup = $3)
         for update`,
        [projectId, memberUserId, emailLookup],
      )
      if (existingMembership.rows[0]) {
        await client.query(
          `update project_memberships
           set owner_user_id = $1,
               invited_user_id = $2,
               invited_email = $3,
               invited_email_lookup = $4,
               status = 'active',
               role = 'member',
               accepted_at = now(),
               declined_at = null
           where id = $5`,
          [ownerUserId, memberUserId, encryptText(username), emailLookup, Number(existingMembership.rows[0].id)],
        )
      } else {
        await client.query(
          `insert into project_memberships (
             project_id,
             owner_user_id,
             invited_user_id,
             invited_email,
             invited_email_lookup,
             role,
             status,
             accepted_at
           )
           values ($1, $2, $3, $4, $5, 'member', 'active', now())`,
          [projectId, ownerUserId, memberUserId, encryptText(username), emailLookup],
        )
      }
      await writeAudit(
        client,
        organizationId!,
        session.userId,
        'project.member_added',
        'project',
        String(projectId),
        String(memberUserId),
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.status(201).json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.delete('/organizations/:organizationId/projects/:projectId/members/:membershipId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    const membershipId = positiveId(request.params.membershipId)
    if (
      !(await requireOrganizationProjectManager(response, organizationId, session.userId)) ||
      !projectId ||
      !membershipId
    ) return

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      const membership = await client.query<{ invited_user_id: string | null }>(
        `select invited_user_id from project_memberships
         where id = $1 and project_id = $2
         for update`,
        [membershipId, projectId],
      )
      if (!membership.rows[0]) {
        await client.query('rollback')
        response.status(404).json({ error: 'Project member not found' })
        return
      }
      const invitedUserId = membership.rows[0].invited_user_id
        ? Number(membership.rows[0].invited_user_id)
        : null
      await client.query(
        `update project_invite_links
         set revoked_at = now()
         where project_id = $1 and revoked_at is null`,
        [projectId],
      )
      if (invitedUserId) {
        await client.query(
          `delete from todo_watchers
           where todo_id in (select id from todos where project_id = $1)
             and user_id = $2`,
          [projectId, invitedUserId],
        )
        await client.query(
          `update todos
           set assignee_user_id = null,
               assigned_by_user_id = null,
               assigned_at = null
           where project_id = $1 and assignee_user_id = $2`,
          [projectId, invitedUserId],
        )
        await client.query(
          `update todos
           set watcher_user_id = null,
               watched_by_user_id = null,
               watched_at = null
           where project_id = $1 and watcher_user_id = $2`,
          [projectId, invitedUserId],
        )
        await client.query(
          `update todos
           set reviewer_user_id = null
           where project_id = $1 and reviewer_user_id = $2`,
          [projectId, invitedUserId],
        )
        await client.query(
          `update project_package_events
           set assignee_user_id = null,
               assigned_by_user_id = null,
               assigned_at = null
           where project_id = $1 and assignee_user_id = $2`,
          [projectId, invitedUserId],
        )
      }
      await client.query(
        'delete from project_memberships where id = $1 and project_id = $2',
        [membershipId, projectId],
      )
      await writeAudit(client, organizationId!, session.userId, 'project.member_removed', 'project', String(projectId), String(membershipId))
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.patch('/organizations/:organizationId/projects/:projectId/governance', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    if (!(await requireOrganizationProjectManager(response, organizationId, session.userId)) || !projectId) return

    const hasStatus = Object.hasOwn(request.body ?? {}, 'status')
    const hasHealthStatus = Object.hasOwn(request.body ?? {}, 'healthStatus')
    const hasHealthNote = Object.hasOwn(request.body ?? {}, 'healthNote')
    const status = hasStatus ? normalizeOrganizationProjectStatus(request.body.status) : null
    const healthStatus = hasHealthStatus
      ? normalizeOrganizationProjectHealthStatus(request.body.healthStatus)
      : null
    const healthNote = hasHealthNote ? boundedText(request.body.healthNote, 1_000) : null
    if (
      (!hasStatus && !hasHealthStatus && !hasHealthNote) ||
      (hasStatus && !status) ||
      (hasHealthStatus && !healthStatus) ||
      (hasHealthNote && healthNote === null)
    ) {
      response.status(400).json({ error: 'Valid project status and health fields are required' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      const nextHealthStatus = healthStatus ?? normalizeOrganizationProjectHealthStatus(project.health_status) ?? 'on_track'
      const currentHealthNote = project.health_note_encrypted ? decryptText(project.health_note_encrypted) : ''
      const nextHealthNote = hasHealthNote ? healthNote ?? '' : currentHealthNote
      if (nextHealthStatus !== 'on_track' && !nextHealthNote) {
        await client.query('rollback')
        response.status(400).json({ error: 'At-risk and off-track projects require a health note' })
        return
      }

      const updates: string[] = []
      const values: unknown[] = []
      if (hasStatus) {
        values.push(status)
        updates.push(`status = $${values.length}`)
      }
      if (hasHealthStatus) {
        values.push(healthStatus)
        updates.push(`health_status = $${values.length}`)
      }
      if (hasHealthNote) {
        values.push(nextHealthNote ? encryptText(nextHealthNote) : null)
        updates.push(`health_note_encrypted = $${values.length}`)
      }
      values.push(projectId, organizationId)
      await client.query(
        `update projects set ${updates.join(', ')}, updated_at = now()
         where id = $${values.length - 1} and organization_id = $${values.length}`,
        values,
      )
      const detail = JSON.stringify({
        healthNote: nextHealthNote,
        healthStatus: nextHealthStatus,
        previousHealthStatus: project.health_status,
        previousStatus: project.status,
        status: status ?? project.status,
      })
      await writeAudit(client, organizationId!, session.userId, 'project.governance_updated', 'project', String(projectId), detail)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/projects/:projectId/milestones', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    if (!(await requireOrganizationProjectManager(response, organizationId, session.userId)) || !projectId) return

    const title = boundedText(request.body?.title, 120)
    const acceptanceCriteria = boundedText(request.body?.acceptanceCriteria, 5_000)
    const executionNote = boundedText(request.body?.executionNote ?? '', 5_000)
    const targetDate = normalizeProjectMilestoneDate(request.body?.targetDate)
    const responsibleUserId = request.body?.responsibleUserId == null
      ? null
      : positiveId(request.body.responsibleUserId)
    const todoIds = linkedTodoIds(request.body?.linkedTodoIds)
    if (!title || !acceptanceCriteria || executionNote === null || !targetDate || todoIds === null || (
      request.body?.responsibleUserId != null && !responsibleUserId
    )) {
      response.status(400).json({ error: 'Milestone title, date, acceptance criteria, responsibility, and todo links are invalid' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      if (responsibleUserId) {
        const responsible = await client.query(
          `select user_id from organization_memberships
           where organization_id = $1 and user_id = $2 and status = 'active'
           for share`,
          [organizationId, responsibleUserId],
        )
        if (!responsible.rows[0]) {
          await client.query('rollback')
          response.status(400).json({ error: 'Milestone responsible person must be an active organization member' })
          return
        }
      }
      if (todoIds.length > 0) {
        const todos = await client.query(
          `select id from todos where project_id = $1 and id = any($2::bigint[]) for share`,
          [projectId, todoIds],
        )
        if (todos.rows.length !== todoIds.length) {
          await client.query('rollback')
          response.status(400).json({ error: 'Every linked todo must belong to the milestone project' })
          return
        }
      }
      const inserted = await client.query<{ id: string }>(
        `insert into project_milestones
          (project_id, title, acceptance_criteria, execution_note, baseline_date, target_date,
           responsible_user_id, sort_order, created_by_user_id, updated_by_user_id)
         values ($1, $2, $3, $4, $5, $5, $6,
           coalesce((select max(sort_order) + 1 from project_milestones where project_id = $1), 0),
           $7, $7)
         returning id`,
        [
          projectId,
          encryptText(title),
          encryptText(acceptanceCriteria),
          executionNote ? encryptText(executionNote) : '',
          targetDate,
          responsibleUserId,
          session.userId,
        ],
      )
      const milestoneId = Number(inserted.rows[0].id)
      if (todoIds.length > 0) {
        await client.query(
          `insert into project_milestone_todos (milestone_id, todo_id, project_id)
           select $1, todo_id, $2 from unnest($3::bigint[]) as todo_id`,
          [milestoneId, projectId, todoIds],
        )
      }
      await writeMilestoneEvent(client, milestoneId, projectId, session.userId, 'created', {
        responsibleUserId,
        targetDate,
        todoIds,
        title,
      })
      await writeAudit(client, organizationId!, session.userId, 'project.milestone_created', 'project_milestone', String(milestoneId), title)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.status(201).json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.patch('/organizations/:organizationId/projects/:projectId/milestones/:milestoneId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    const milestoneId = positiveId(request.params.milestoneId)
    if (
      !(await requireOrganizationProjectManager(response, organizationId, session.userId)) ||
      !projectId || !milestoneId
    ) return

    const title = boundedText(request.body?.title, 120)
    const acceptanceCriteria = boundedText(request.body?.acceptanceCriteria, 5_000)
    const executionNote = boundedText(request.body?.executionNote ?? '', 5_000)
    const targetDate = normalizeProjectMilestoneDate(request.body?.targetDate)
    const requestedStatus = request.body?.status == null
      ? null
      : normalizeProjectMilestoneStatus(request.body.status)
    const responsibleUserId = request.body?.responsibleUserId == null
      ? null
      : positiveId(request.body.responsibleUserId)
    const todoIds = linkedTodoIds(request.body?.linkedTodoIds)
    if (!title || !acceptanceCriteria || executionNote === null || !targetDate || todoIds === null || (
      request.body?.status != null && !requestedStatus
    ) || (
      request.body?.responsibleUserId != null && !responsibleUserId
    )) {
      response.status(400).json({ error: 'Complete and valid milestone fields are required' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      const milestone = (await client.query<{
        status: string
        target_date: Date | string
        title: string
      }>(
        `select title, target_date, status from project_milestones
         where id = $1 and project_id = $2 for update`,
        [milestoneId, projectId],
      )).rows[0]
      if (!milestone) {
        await client.query('rollback')
        response.status(404).json({ error: 'Project milestone not found' })
        return
      }
      const status = requestedStatus ?? normalizeProjectMilestoneStatus(milestone.status)
      if (!status) {
        await client.query('rollback')
        response.status(400).json({ error: 'Project milestone status is invalid' })
        return
      }
      if (responsibleUserId) {
        const responsible = await client.query(
          `select user_id from organization_memberships
           where organization_id = $1 and user_id = $2 and status = 'active'
           for share`,
          [organizationId, responsibleUserId],
        )
        if (!responsible.rows[0]) {
          await client.query('rollback')
          response.status(400).json({ error: 'Milestone responsible person must be an active organization member' })
          return
        }
      }
      if (todoIds.length > 0) {
        const todos = await client.query(
          `select id from todos where project_id = $1 and id = any($2::bigint[]) for share`,
          [projectId, todoIds],
        )
        if (todos.rows.length !== todoIds.length) {
          await client.query('rollback')
          response.status(400).json({ error: 'Every linked todo must belong to the milestone project' })
          return
        }
      }

      const statusUpdates = status === 'in_review' && milestone.status !== 'in_review'
        ? ', submitted_by_user_id = $9, submitted_at = now(), completed_by_user_id = null, completed_at = null'
        : status === 'achieved' && milestone.status !== 'achieved'
          ? ', completed_by_user_id = $9, completed_at = now()'
          : status !== 'achieved' && milestone.status === 'achieved'
            ? ', completed_by_user_id = null, completed_at = null'
            : ''
      await client.query(
        `update project_milestones set
           title = $1, acceptance_criteria = $2, execution_note = $3,
           target_date = $4, responsible_user_id = $5, status = $6,
           updated_by_user_id = $7, updated_at = now()
           ${statusUpdates}
         where id = $8 and project_id = $10`,
        [
          encryptText(title),
          encryptText(acceptanceCriteria),
          executionNote ? encryptText(executionNote) : '',
          targetDate,
          responsibleUserId,
          status,
          session.userId,
          milestoneId,
          session.userId,
          projectId,
        ],
      )
      await client.query('delete from project_milestone_todos where milestone_id = $1', [milestoneId])
      if (todoIds.length > 0) {
        await client.query(
          `insert into project_milestone_todos (milestone_id, todo_id, project_id)
           select $1, todo_id, $2 from unnest($3::bigint[]) as todo_id`,
          [milestoneId, projectId, todoIds],
        )
      }
      const eventType = status === 'achieved' && milestone.status !== 'achieved'
        ? 'achieved'
        : status === 'cancelled' && milestone.status !== 'cancelled'
          ? 'cancelled'
          : status === 'in_review' && milestone.status !== 'in_review'
            ? 'submitted'
            : milestone.status === 'achieved' || milestone.status === 'cancelled'
              ? 'reopened'
              : 'updated'
      await writeMilestoneEvent(client, milestoneId, projectId, session.userId, eventType, {
        previousStatus: milestone.status,
        previousTargetDate: dateOnly(milestone.target_date),
        responsibleUserId,
        status,
        targetDate,
        todoIds,
        title,
      })
      await writeAudit(client, organizationId!, session.userId, 'project.milestone_updated', 'project_milestone', String(milestoneId), title)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.patch('/organizations/:organizationId/projects/:projectId/milestones/:milestoneId/status', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const projectId = positiveId(request.params.projectId)
    const milestoneId = positiveId(request.params.milestoneId)
    const status = normalizeProjectMilestoneStatus(request.body?.status)
    if (
      !(await requireOrganizationProjectManager(response, organizationId, session.userId)) ||
      !projectId || !milestoneId
    ) return
    if (!status) {
      response.status(400).json({ error: 'A valid milestone status is required' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await lockProjectMutation(client, projectId)
      const project = await lockGovernedProject(client, organizationId!, projectId, session.userId)
      if (!project) {
        await client.query('rollback')
        response.status(404).json({ error: 'Organization project not found' })
        return
      }
      const milestone = (await client.query<{
        status: string
        title: string
      }>(
        `select title, status from project_milestones
         where id = $1 and project_id = $2 for update`,
        [milestoneId, projectId],
      )).rows[0]
      if (!milestone) {
        await client.query('rollback')
        response.status(404).json({ error: 'Project milestone not found' })
        return
      }
      if (status !== milestone.status) {
        const statusUpdates = status === 'in_review'
          ? ', submitted_by_user_id = $2, submitted_at = now(), completed_by_user_id = null, completed_at = null'
          : status === 'achieved'
            ? ', completed_by_user_id = $2, completed_at = now()'
            : milestone.status === 'achieved'
              ? ', completed_by_user_id = null, completed_at = null'
              : ''
        await client.query(
          `update project_milestones set
             status = $1, updated_by_user_id = $2, updated_at = now()
             ${statusUpdates}
           where id = $3 and project_id = $4`,
          [status, session.userId, milestoneId, projectId],
        )
        const eventType = status === 'achieved'
          ? 'achieved'
          : status === 'cancelled'
            ? 'cancelled'
            : status === 'in_review'
              ? 'submitted'
              : milestone.status === 'achieved' || milestone.status === 'cancelled'
                ? 'reopened'
                : 'updated'
        await writeMilestoneEvent(client, milestoneId, projectId, session.userId, eventType, {
          previousStatus: milestone.status,
          status,
        })
        await writeAudit(
          client,
          organizationId!,
          session.userId,
          'project.milestone_status_updated',
          'project_milestone',
          String(milestoneId),
          decryptText(milestone.title),
        )
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/test-spaces/:spaceId', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    const spaceId = positiveId(request.params.spaceId)
    if (!(await requireOrganizationMember(response, organizationId, session.userId)) || !spaceId) return
    const client = await pool.connect()
    try {
      await client.query('begin')
      const ownedSpace = await client.query<{ id: string }>(
        `select id from test_spaces
         where id = $1 and owner_user_id = $2 and organization_id is null
         for update`,
        [spaceId, session.userId],
      )
      if (!ownedSpace.rows[0]) {
        await client.query('rollback')
        response.status(404).json({ error: 'Owned personal test space not found' })
        return
      }
      const spaceMembers = await client.query<{ user_id: string }>(
        `select user_id from test_space_memberships
         where test_space_id = $1 and status in ('pending', 'active')
         order by user_id
         for share`,
        [spaceId],
      )
      const userIds = spaceMembers.rows.map((row) => Number(row.user_id))
      const organizationMembers = userIds.length > 0
        ? await client.query<{ user_id: string }>(
            `select user_id from organization_memberships
             where organization_id = $1 and user_id = any($2::bigint[]) and status = 'active'
             order by user_id
             for share`,
            [organizationId, userIds],
          )
        : { rows: [] }
      if (organizationMembers.rows.length !== userIds.length) {
        await client.query('rollback')
        response.status(409).json({ error: 'All active test-space members must join the organization first' })
        return
      }
      const updated = await client.query(
        `update test_spaces set organization_id = $1, updated_at = now()
         where id = $2 and owner_user_id = $3 and organization_id is null returning id`,
        [organizationId, spaceId, session.userId],
      )
      if (!updated.rows[0]) {
        await client.query('rollback')
        response.status(404).json({ error: 'Owned personal test space not found' })
        return
      }
      await client.query(
        `update test_space_invite_links set revoked_at = now()
         where test_space_id = $1 and revoked_at is null`,
        [spaceId],
      )
      await writeAudit(client, organizationId!, session.userId, 'test_space.attached', 'test_space', String(spaceId))
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.put('/organizations/:organizationId/weekly-reports/:weekStart', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationMember(response, organizationId, session.userId))) return
    const weekStart = normalizeOrganizationWeekStart(
      request.params.weekStart,
      await getOrganizationWeekStartsOn(organizationId!),
    )
    const content = String(request.body.content ?? '').trim().slice(0, 12_000)
    const status = request.body.status === 'submitted' ? 'submitted' : 'draft'
    if (!weekStart || (status === 'submitted' && !content)) {
      response.status(400).json({ error: 'Valid week and report content are required' })
      return
    }
    await query(
      `insert into organization_weekly_reports
        (organization_id, user_id, week_start, content, status, submitted_at)
       values ($1, $2, $3, $4, $5, case when $5 = 'submitted' then now() else null end)
       on conflict (organization_id, user_id, week_start) do update
         set content = excluded.content, status = excluded.status, updated_at = now(),
           submitted_at = case when excluded.status = 'submitted' then now() else null end`,
      [organizationId, session.userId, weekStart, encryptText(content), status],
    )
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/organizations/:organizationId/weekly-summaries/:weekStart', asyncRoute(async (request, response) => {
    const session = await requireSession(request, response)
    if (!session) return
    const organizationId = positiveId(request.params.organizationId)
    if (!(await requireOrganizationWeeklyReportManager(response, organizationId, session.userId))) return
    const weekStart = normalizeOrganizationWeekStart(
      request.params.weekStart,
      await getOrganizationWeekStartsOn(organizationId!),
    )
    if (!weekStart) {
      response.status(400).json({ error: 'Valid week is required' })
      return
    }
    const reports = await query<{
      content: string
      display_name: string
      email: string
    }>(
      `select r.content, u.email, u.display_name
       from organization_weekly_reports r join users u on u.id = r.user_id
       where r.organization_id = $1 and r.week_start = $2 and r.status = 'submitted'
       order by lower(coalesce(nullif(u.display_name, ''), u.email))`,
      [organizationId, weekStart],
    )
    if (reports.rows.length === 0) {
      response.status(409).json({ error: 'No submitted weekly reports are available for this week' })
      return
    }
    const source = reports.rows.map((report) => (
      `成员：${displayName(report)}\n周报：\n${decryptText(report.content)}`
    )).join('\n\n---\n\n')
    const generated = await dependencies.generateWeeklySummary(session.userId, source)
    if (!generated.message) {
      response.status(generated.status).json({ error: generated.error ?? 'AI summary failed' })
      return
    }
    await query(
      `insert into organization_weekly_summaries
        (organization_id, week_start, requested_by_user_id, content, source_report_count)
       values ($1, $2, $3, $4, $5)
       on conflict (organization_id, week_start) do update
         set requested_by_user_id = excluded.requested_by_user_id,
           content = excluded.content, source_report_count = excluded.source_report_count,
           updated_at = now()`,
      [organizationId, weekStart, session.userId, encryptText(generated.message), reports.rows.length],
    )
    response.json(await getOrganizationDetail(organizationId!, session.userId))
  }))

  router.post('/integrations/feishu/card-actions', asyncRoute(async (request, response) => {
    const body = request.body && typeof request.body === 'object'
      ? request.body as Record<string, unknown>
      : {}
    const challenge = String(body.challenge ?? '')
    const header = body.header && typeof body.header === 'object'
      ? body.header as Record<string, unknown>
      : {}
    const event = body.event && typeof body.event === 'object'
      ? body.event as Record<string, unknown>
      : body
    const expectedToken = String(process.env.FEISHU_VERIFICATION_TOKEN ?? '')
    const eventToken = String(header.token ?? body.token ?? '')
    if (!expectedToken || eventToken !== expectedToken) {
      response.status(401).json({ error: 'Invalid Feishu verification token' })
      return
    }
    if (challenge) {
      response.json({ challenge })
      return
    }
    const signature = String(request.headers['x-lark-signature'] ?? '')
    const timestamp = String(request.headers['x-lark-request-timestamp'] ?? '')
    const nonce = String(request.headers['x-lark-request-nonce'] ?? '')
    const rawBody = String((request as express.Request & { rawBody?: string }).rawBody ?? '')
    if (!signature || !isFreshFeishuTimestamp(timestamp) || !verifyFeishuCardSignature({
      body: rawBody,
      nonce,
      signature,
      timestamp,
      verificationToken: expectedToken,
    })) {
      response.status(401).json({ error: 'Invalid Feishu callback signature' })
      return
    }
    const eventType = String(header.event_type ?? body.event_type ?? '')
    if (eventType !== 'card.action.trigger') {
      response.json({ ok: true, ignored: true })
      return
    }
    const action = event.action && typeof event.action === 'object'
      ? event.action as Record<string, unknown>
      : {}
    const value = action.value && typeof action.value === 'object'
      ? action.value as Record<string, unknown>
      : {}
    const operator = event.operator && typeof event.operator === 'object'
      ? event.operator as Record<string, unknown>
      : {}
    const actionName = String(value.action ?? '')
    const operatorOpenId = String(operator.open_id ?? '')
    const tenantKey = String(operator.tenant_key ?? header.tenant_key ?? '')
    const eventId = String(header.event_id ?? body.event_id ?? '')

    if ([
      'project_transfer_accept',
      'project_transfer_decline',
    ].includes(actionName)) {
      const transferId = positiveId(value.transferId)
      const transferToken = String(value.token ?? '')
      if (!transferId || !transferToken || !operatorOpenId || !eventId) {
        response.status(400).json({ error: 'Invalid project transfer action' })
        return
      }
      const transferStatus: ProjectTransferStatus = actionName === 'project_transfer_accept'
        ? 'accepted'
        : 'declined'
      const client = await pool.connect()
      try {
        await client.query('begin')
        const duplicate = await client.query(
          'select event_id from project_transfer_callback_events where event_id = $1',
          [eventId],
        )
        if (duplicate.rows[0]) {
          await client.query('commit')
          response.json({ toast: { type: 'success', content: '项目转移申请已经处理' } })
          return
        }
        const transfer = await client.query<{
          expires_at: Date
          organization_id: string
          organization_name: string
          project_id: string
          project_name: string
          requested_by_display_name: string | null
          requested_by_email: string
          requested_by_user_id: string
          status: string
          target_open_id: string
          target_user_id: string
          token_hash: string
        }>(
          `
          select transfer.project_id, transfer.organization_id, transfer.requested_by_user_id,
                 transfer.target_user_id, transfer.target_open_id, transfer.token_hash,
                 transfer.status, transfer.expires_at,
                 project.name as project_name,
                 organization.name as organization_name,
                 requester.email as requested_by_email,
                 requester.display_name as requested_by_display_name
          from project_transfer_requests transfer
          join projects project on project.id = transfer.project_id
          join organizations organization on organization.id = transfer.organization_id
          join users requester on requester.id = transfer.requested_by_user_id
          where transfer.id = $1
          for update of transfer, project
          `,
          [transferId],
        )
        const row = transfer.rows[0]
        if (!row) {
          await client.query('rollback')
          response.json({ toast: { type: 'warning', content: '项目转移申请不存在或已失效' } })
          return
        }
        const projectName = decryptText(row.project_name)
        if (row.status !== 'pending') {
          await client.query('commit')
          response.json({
            card: ['accepted', 'declined', 'expired'].includes(row.status)
              ? buildProjectTransferStatusCard({
                projectName,
                status: row.status as ProjectTransferStatus,
              })
              : undefined,
            toast: { type: 'info', content: '项目转移申请已经处理' },
          })
          return
        }
        if (row.target_open_id !== operatorOpenId || row.token_hash !== hashProjectTransferToken(transferToken)) {
          await client.query('rollback')
          response.status(403).json({ error: 'Project transfer identity does not match' })
          return
        }
        if (row.expires_at.getTime() <= Date.now()) {
          await client.query(
            `update project_transfer_requests
             set status = 'expired', responded_at = now()
             where id = $1`,
            [transferId],
          )
          await client.query(
            `insert into project_transfer_callback_events (event_id, transfer_request_id)
             values ($1, $2)`,
            [eventId, transferId],
          )
          await client.query('commit')
          response.json({
            card: buildProjectTransferStatusCard({
              projectName,
              status: 'expired',
            }),
            toast: { type: 'warning', content: '项目转移申请已过期' },
          })
          return
        }
        const projectId = Number(row.project_id)
        const organizationId = Number(row.organization_id)
        const requestedByUserId = Number(row.requested_by_user_id)
        const targetUserId = Number(row.target_user_id)
        await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`ai-project:${projectId}`])
        const activeOwners = await client.query<{ user_id: string }>(
          `select user_id from organization_memberships
           where organization_id = $1
             and user_id in ($2::bigint, $3::bigint)
             and status = 'active'
           for share`,
          [organizationId, requestedByUserId, targetUserId],
        )
        if (activeOwners.rows.length !== 2) {
          await client.query(
            `update project_transfer_requests
             set status = 'revoked', last_error = $2, responded_at = now()
             where id = $1`,
            [transferId, 'Both owners must remain active members of the shared organization'],
          )
          await client.query('commit')
          response.json({ toast: { type: 'warning', content: '双方已不再同属该组织，转移申请已失效' } })
          return
        }
        if (transferStatus === 'accepted') {
          const updated = await client.query(
            `update projects
             set user_id = $1, updated_at = now()
             where id = $2 and user_id = $3`,
            [targetUserId, projectId, requestedByUserId],
          )
          if ((updated.rowCount ?? 0) === 0) {
            await client.query(
              `update project_transfer_requests
               set status = 'revoked', last_error = $2, responded_at = now()
               where id = $1`,
              [transferId, 'Project ownership changed before transfer acceptance'],
            )
            await client.query('commit')
            response.json({ toast: { type: 'warning', content: '项目归属已变化，转移申请已失效' } })
            return
          }
          await client.query(
            `update project_memberships
             set owner_user_id = $1
             where project_id = $2`,
            [targetUserId, projectId],
          )
          await client.query(
            `delete from project_memberships
             where project_id = $1 and invited_user_id = $2`,
            [projectId, targetUserId],
          )
          await client.query(
            `insert into project_memberships
              (project_id, owner_user_id, invited_user_id, invited_email, invited_email_lookup,
               role, status, accepted_at, declined_at)
             values ($1, $2, $3, $4, $5, 'member', 'active', now(), null)
             on conflict (project_id, invited_email_lookup) where invited_email_lookup is not null do update
               set owner_user_id = excluded.owner_user_id,
                   invited_user_id = excluded.invited_user_id,
                   invited_email = excluded.invited_email,
                   invited_email_lookup = excluded.invited_email_lookup,
                   role = 'member',
                   status = 'active',
                   accepted_at = now(),
                   declined_at = null`,
            [
              projectId,
              targetUserId,
              requestedByUserId,
              encryptText(normalizedEmail(row.requested_by_email)),
              blindIndex(normalizedEmail(row.requested_by_email)),
            ],
          )
        }
        await client.query(
          `update project_transfer_requests
           set status = $1, responded_by_user_id = $2, responded_at = now()
           where id = $3`,
          [transferStatus, targetUserId, transferId],
        )
        await client.query(
          `insert into project_transfer_callback_events (event_id, transfer_request_id)
           values ($1, $2)`,
          [eventId, transferId],
        )
        await writeAudit(
          client,
          organizationId,
          targetUserId,
          transferStatus === 'accepted' ? 'project.transfer.accepted' : 'project.transfer.declined',
          'project',
          String(projectId),
          JSON.stringify({
            from: requestedByUserId,
            to: targetUserId,
            tenantKey,
          }),
        )
        await client.query('commit')
        response.json({
          card: buildProjectTransferStatusCard({
            projectName,
            status: transferStatus,
          }),
          toast: {
            type: transferStatus === 'accepted' ? 'success' : 'info',
            content: transferStatus === 'accepted' ? '已接手项目' : '已拒绝项目转移',
          },
        })
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
      return
    }

    const invitationId = positiveId(value.invitationId)
    const inviteToken = String(value.token ?? '')
    const inviteAction = actionName
    if (!invitationId || !inviteToken || !operatorOpenId || !tenantKey || !eventId || ![
      'organization_invitation_accept',
      'organization_invitation_decline',
    ].includes(inviteAction)) {
      response.status(400).json({ error: 'Invalid organization invitation action' })
      return
    }
    const client = await pool.connect()
    try {
      await client.query('begin')
      const duplicate = await client.query('select event_id from organization_callback_events where event_id = $1', [eventId])
      if (duplicate.rows[0]) {
        await client.query('commit')
        response.json({ toast: { type: 'success', content: '邀请已经处理' } })
        return
      }
      const invitation = await client.query<{
        organization_id: string
        status: string
        target_email: string
        target_open_id: string
        token_hash: string
        expires_at: Date
      }>(
        `select organization_id, status, target_email, target_open_id, token_hash, expires_at
         from organization_invitations where id = $1 for update`,
        [invitationId],
      )
      const row = invitation.rows[0]
      if (!row || row.status !== 'pending') {
        await client.query('rollback')
        response.json({ toast: { type: 'info', content: '邀请已失效或已经处理' } })
        return
      }
      if (row.expires_at.getTime() <= Date.now()) {
        await client.query(`update organization_invitations set status = 'expired' where id = $1`, [invitationId])
        await client.query('commit')
        response.json({ toast: { type: 'warning', content: '邀请已过期' } })
        return
      }
      if (row.target_open_id !== operatorOpenId || row.token_hash !== hashOrganizationInviteToken(inviteToken)) {
        await client.query('rollback')
        response.status(403).json({ error: 'Invitation identity does not match' })
        return
      }
      const organizationId = Number(row.organization_id)
      const organization = await client.query<{ feishu_tenant_key: string; name: string }>(
        'select feishu_tenant_key, name from organizations where id = $1 for update',
        [organizationId],
      )
      const boundTenant = organization.rows[0]?.feishu_tenant_key ?? ''
      if (boundTenant && boundTenant !== tenantKey) {
        await client.query('rollback')
        response.status(403).json({ error: 'Feishu tenant does not match the organization' })
        return
      }
      if (!boundTenant && tenantKey) {
        await client.query('update organizations set feishu_tenant_key = $1 where id = $2', [tenantKey, organizationId])
      }
      let respondedByUserId: number | null = null
      if (inviteAction === 'organization_invitation_accept') {
        const email = normalizedEmail(decryptText(row.target_email))
        const matchedUsers = await client.query<{
          feishu_user_id: string
          id: string
        }>(
          `select id, feishu_user_id from users where feishu_user_id = $1 or email = $2 for update`,
          [operatorOpenId, email],
        )
        if (matchedUsers.rows.length > 1 || (matchedUsers.rows[0]?.feishu_user_id && matchedUsers.rows[0].feishu_user_id !== operatorOpenId)) {
          await client.query('rollback')
          response.status(409).json({ error: 'Feishu identity conflicts with an existing account' })
          return
        }
        if (matchedUsers.rows[0]) {
          respondedByUserId = Number(matchedUsers.rows[0].id)
          await client.query(
            `update users set feishu_user_id = $1, feishu_receive_id_type = 'open_id',
              feishu_email = case when feishu_email = '' then $2 else feishu_email end
             where id = $3`,
            [operatorOpenId, email, respondedByUserId],
          )
        } else {
          const created = await client.query<{ id: string }>(
            `insert into users
              (email, password_hash, display_name, feishu_email, feishu_user_id, feishu_receive_id_type)
             values ($1, '', $2, $1, $3, 'open_id') returning id`,
            [email, email.split('@')[0], operatorOpenId],
          )
          respondedByUserId = Number(created.rows[0].id)
        }
        await client.query(
          `insert into user_roles (user_id, role)
           select $1, 'developer' where not exists (select 1 from user_roles where user_id = $1)
           on conflict do nothing`,
          [respondedByUserId],
        )
        await client.query(
          `insert into organization_memberships
            (organization_id, user_id, access_role, status, invited_by_user_id, joined_at, removed_at)
           select $1, $2, 'member', 'active', invited_by_user_id, now(), null
           from organization_invitations where id = $3
           on conflict (organization_id, user_id) do update
             set access_role = case when organization_memberships.access_role = 'owner' then 'owner' else 'member' end,
               status = 'active', removed_at = null, joined_at = now()`,
          [organizationId, respondedByUserId, invitationId],
        )
      }
      await client.query(
        `update organization_invitations
         set status = $1, responded_by_user_id = $2, responded_at = now(), target_tenant_key = $3
         where id = $4`,
        [inviteAction === 'organization_invitation_accept' ? 'accepted' : 'declined', respondedByUserId, tenantKey, invitationId],
      )
      await client.query(
        `insert into organization_callback_events (event_id, invitation_id) values ($1, $2)`,
        [eventId, invitationId],
      )
      await writeAudit(
        client,
        organizationId,
        respondedByUserId,
        inviteAction === 'organization_invitation_accept' ? 'invitation.accepted' : 'invitation.declined',
        'organization_invitation',
        String(invitationId),
      )
      await client.query('commit')
      const invitationStatus = inviteAction === 'organization_invitation_accept'
        ? 'accepted'
        : 'declined'
      response.json({
        card: buildOrganizationInvitationStatusCard({
          organizationName: decryptText(organization.rows[0].name),
          status: invitationStatus,
        }),
        toast: {
          type: invitationStatus === 'accepted' ? 'success' : 'info',
          content: invitationStatus === 'accepted' ? '已加入组织' : '已拒绝邀请',
        },
      })
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }))

  return router
}
