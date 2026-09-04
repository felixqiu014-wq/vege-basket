export const testCaseStatuses = ['draft', 'active', 'archived'] as const
export const testPlanStatuses = ['draft', 'in_progress', 'completed', 'aborted'] as const
export const testResults = ['untested', 'passed', 'failed', 'blocked', 'skipped'] as const
export const testSpaceAccessLevels = ['owner', 'editor', 'viewer'] as const
export const testSpaceMembershipStatuses = ['pending', 'active', 'declined'] as const
export const testSpaceInviteExpiryOptions = [10, 30, 60, 240, 1440] as const
export const bugStatuses = [
  'new',
  'pending_confirmation',
  'assigned',
  'in_progress',
  'pending_verification',
  'closed',
  'rejected',
] as const

export type TestCaseStatus = (typeof testCaseStatuses)[number]
export type TestPlanStatus = (typeof testPlanStatuses)[number]
export type TestResult = (typeof testResults)[number]
export type TestSpaceAccess = (typeof testSpaceAccessLevels)[number]
export type TestSpaceMembershipStatus = (typeof testSpaceMembershipStatuses)[number]
export type BugStatus = (typeof bugStatuses)[number]

export const bugSeverities = ['blocker', 'critical', 'major', 'minor', 'trivial'] as const
export type BugSeverity = (typeof bugSeverities)[number]

export function isTestCaseStatus(value: unknown): value is TestCaseStatus {
  return testCaseStatuses.includes(value as TestCaseStatus)
}

export function isTestPlanStatus(value: unknown): value is TestPlanStatus {
  return testPlanStatuses.includes(value as TestPlanStatus)
}

export function isTestResult(value: unknown): value is TestResult {
  return testResults.includes(value as TestResult)
}

export function isBugStatus(value: unknown): value is BugStatus {
  return bugStatuses.includes(value as BugStatus)
}

export function isBugSeverity(value: unknown): value is BugSeverity {
  return bugSeverities.includes(value as BugSeverity)
}

export function canEditTestBug(reporterUserId: number | null, userId: number) {
  return reporterUserId === userId
}

/** Bug detail ownership is intentionally separate from assignee/editor access. */
export function canDeleteTestBug(reporterUserId: number | null, userId: number) {
  return canEditTestBug(reporterUserId, userId)
}

export function canEditTestSpaceVersion(
  ownerUserId: number | null,
  bugReporterUserId: number | null,
  userId: number,
) {
  return ownerUserId === userId || bugReporterUserId === userId
}

export function isTestSpaceMembershipStatus(value: unknown): value is TestSpaceMembershipStatus {
  return testSpaceMembershipStatuses.includes(value as TestSpaceMembershipStatus)
}

export function normalizeTestSpaceInviteExpiresInMinutes(value: unknown) {
  const minutes = Number(value)
  return Number.isInteger(minutes) && testSpaceInviteExpiryOptions.includes(
    minutes as (typeof testSpaceInviteExpiryOptions)[number],
  ) ? minutes : 10
}

export function parseOptionalTestSpaceOrganizationId(value: unknown):
  | { valid: true; value: number | null }
  | { valid: false } {
  if (value == null || value === '') return { valid: true, value: null }
  if (typeof value !== 'number' && typeof value !== 'string') return { valid: false }
  if (typeof value === 'string' && !/^[1-9]\d*$/u.test(value)) return { valid: false }
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0
    ? { valid: true, value: id }
    : { valid: false }
}

export function canEditTestSubject(createdByUserId: number | null, userId: number) {
  return createdByUserId === userId
}

export function canDeleteTestSubject(createdByUserId: number | null, userId: number) {
  return canEditTestSubject(createdByUserId, userId)
}

export function canDeleteTestCase(createdByUserId: number | null, userId: number) {
  return createdByUserId === userId
}

export function canManageTestPlan(createdByUserId: number | null, userId: number) {
  return createdByUserId === userId
}

export function canRemoveTestPlanCase(
  createdByUserId: number | null,
  userId: number,
  result: TestResult,
) {
  return canManageTestPlan(createdByUserId, userId) && result === 'untested'
}

export function canDeveloperSetBugStatus(current: BugStatus, next: BugStatus) {
  if (current === next) return true
  if (next === 'in_progress') {
    return current === 'pending_confirmation' || current === 'assigned'
  }
  if (next === 'pending_verification') return current === 'in_progress'
  return false
}

export function canDeveloperRejectBug(current: BugStatus) {
  return current === 'pending_confirmation' || current === 'assigned'
}
