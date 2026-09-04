import crypto from 'node:crypto'
import {
  normalizeWeeklyReportRules,
  type WeeklyReportRules,
} from '../shared/weekly-report-availability.ts'

export { normalizeWeeklyReportRules }
export type { WeeklyReportRules }

export const organizationAccessRoles = ['owner', 'admin', 'member'] as const
export type OrganizationAccessRole = (typeof organizationAccessRoles)[number]

export const organizationProjectStatuses = ['active', 'paused', 'completed', 'archived'] as const
export type OrganizationProjectStatus = (typeof organizationProjectStatuses)[number]

export const organizationTodoEditableFields = [
  'assigneeUserId',
  'dueDate',
  'moduleId',
  'priority',
  'reviewerUserId',
  'watcherUserId',
  'watcherUserIds',
] as const

export const organizationProjectHealthStatuses = ['on_track', 'at_risk', 'off_track'] as const
export type OrganizationProjectHealthStatus = (typeof organizationProjectHealthStatuses)[number]

export const projectMilestoneStatuses = ['pending', 'in_review', 'achieved', 'cancelled'] as const
export type ProjectMilestoneStatus = (typeof projectMilestoneStatuses)[number]

export function isOrganizationAccessRole(value: unknown): value is OrganizationAccessRole {
  return organizationAccessRoles.includes(value as OrganizationAccessRole)
}

export function canManageOrganization(
  role: OrganizationAccessRole | null,
  assignedRoles: readonly string[] = [],
) {
  return role !== null && assignedRoles.includes('organization_admin')
}

export function canManageOrganizationProjects(
  role: OrganizationAccessRole | null,
  assignedRoles: readonly string[],
) {
  return canManageOrganization(role, assignedRoles)
}

export function canManageOrganizationWeeklyReports(
  role: OrganizationAccessRole | null,
  assignedRoles: readonly string[],
) {
  return canManageOrganization(role, assignedRoles)
}

/** Environment maintenance changes organization-wide test resources. */
export function canManageTestEnvironments(
  role: OrganizationAccessRole | null,
  assignedRoles: readonly string[],
) {
  return (role === 'owner' || role === 'admin') && assignedRoles.includes('organization_admin')
}

export function normalizeTestEnvironmentName(value: unknown) {
  const name = String(value ?? '').trim()
  return name && name.length <= 120 ? name : null
}

export function normalizeTestEnvironmentAccessUrl(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.length > 2048 || Array.from(raw).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)
  })) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
  return parsed.toString()
}

export function isOrganizationTodoFieldUpdate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((key) => organizationTodoEditableFields.includes(key as typeof organizationTodoEditableFields[number]))
}

export function normalizeOrganizationProjectStatus(value: unknown) {
  return organizationProjectStatuses.includes(value as OrganizationProjectStatus)
    ? value as OrganizationProjectStatus
    : null
}

export function normalizeOrganizationProjectHealthStatus(value: unknown) {
  return organizationProjectHealthStatuses.includes(value as OrganizationProjectHealthStatus)
    ? value as OrganizationProjectHealthStatus
    : null
}

export function normalizeProjectMilestoneStatus(value: unknown) {
  return projectMilestoneStatuses.includes(value as ProjectMilestoneStatus)
    ? value as ProjectMilestoneStatus
    : null
}

export function normalizeProjectMilestoneDate(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw
    ? raw
    : null
}

export function normalizeOrganizationName(value: unknown) {
  const name = String(value ?? '').trim()
  return name && name.length <= 80 ? name : null
}

export function matchesOrganizationDeleteConfirmation(
  organizationName: string,
  confirmationName: unknown,
) {
  return typeof confirmationName === 'string' && confirmationName === organizationName
}

export function normalizeOrganizationWeekStartsOn(value: unknown) {
  const weekStartsOn = Number(value)
  return Number.isSafeInteger(weekStartsOn) && weekStartsOn >= 1 && weekStartsOn <= 7
    ? weekStartsOn
    : null
}

export function normalizeOrganizationWeekStart(value: unknown, weekStartsOn = 1) {
  const raw = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const normalizedWeekStartsOn = normalizeOrganizationWeekStartsOn(weekStartsOn)
  if (!normalizedWeekStartsOn) return null
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null
  const day = date.getUTCDay()
  const startDay = normalizedWeekStartsOn === 7 ? 0 : normalizedWeekStartsOn
  date.setUTCDate(date.getUTCDate() - ((day - startDay + 7) % 7))
  return date.toISOString().slice(0, 10)
}

export function hashOrganizationInviteToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export function hashProjectTransferToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export function hashBugShareToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export function hashTodoShareToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export function verifyFeishuCardSignature(params: {
  body: string
  nonce: string
  signature: string
  timestamp: string
  verificationToken: string
}) {
  if (!params.signature || !params.timestamp || !params.nonce || !params.verificationToken) return false
  const expected = crypto
    .createHash('sha1')
    .update(`${params.timestamp}${params.nonce}${params.verificationToken}${params.body}`)
    .digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(params.signature)
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

export function isFreshFeishuTimestamp(value: string, nowMs = Date.now()) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && Math.abs(nowMs - seconds * 1_000) <= 5 * 60 * 1_000
}
