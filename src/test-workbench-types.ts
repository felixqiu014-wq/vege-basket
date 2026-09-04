import type { Priority, Project } from './types'
import type { UserRole } from './api'

export type TestCaseStatus = 'draft' | 'active' | 'archived'
export type TestCaseKind = 'functional' | 'baseline'
export type TestCaseType = 'functional' | 'regression' | 'smoke' | 'security' | 'performance'
export type TestPlanStatus = 'draft' | 'in_progress' | 'completed' | 'aborted'
export type TestResult = 'untested' | 'passed' | 'failed' | 'blocked' | 'skipped'
export type BugSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'trivial'
export type BugStatus =
  | 'new'
  | 'pending_confirmation'
  | 'assigned'
  | 'in_progress'
  | 'pending_verification'
  | 'closed'
  | 'rejected'

export type TestSpace = {
  accessLevel: 'owner' | 'editor' | 'viewer'
  createdAt: string
  id: number
  name: string
  organizationId?: number
  ownerUserId: number
  versionLabel?: string
}

export type TestSpaceMembershipStatus = 'pending' | 'active' | 'declined'

export type TestSpaceMember = {
  accessLevel: 'owner' | 'editor' | 'viewer'
  createdAt: string
  displayName: string
  status: TestSpaceMembershipStatus
  userId: number
  username: string
}

export type ManagedTestSpace = {
  accessLevel: 'owner' | 'editor' | 'viewer'
  createdAt: string
  id: number
  members: TestSpaceMember[]
  name: string
  organizationId?: number
  organizationName?: string
  ownerUserId: number
  versionLabel?: string
}

export type TestSpaceOrganizationOption = {
  id: number
  name: string
}

export type TestSpaceInvitation = {
  accessLevel: 'editor' | 'viewer'
  createdAt: string
  invitedByName: string
  spaceId: number
  spaceName: string
}

export type TestSpaceSettings = {
  invitations: TestSpaceInvitation[]
  organizations: TestSpaceOrganizationOption[]
  spaces: ManagedTestSpace[]
}

export type TestEnvironment = {
  accessUrl: string
  id: number
  name: string
  testSpaceIds: number[]
}

export type TestSpaceImportCategory = 'cases' | 'plans'

export type TestSpaceImportSource = {
  categories: TestSpaceImportCategory[]
  spaceId: number
}

export type TestSpaceDataImportResult = {
  copiedCases: number
  copiedFolders: number
  copiedPlans: number
  copiedSubjects: number
}

export type TestSpaceInviteLink = {
  accessLevel: 'editor' | 'viewer'
  expiresAt: string
  expiresInMinutes: number
  passwordRequired: boolean
  token: string
}

export type TestSubject = {
  canDelete: boolean
  canEdit: boolean
  createdAt: string
  description: string
  id: number
  name: string
  testSpaceId: number
}

export type TestCaseFolder = {
  createdAt: string
  id: number
  name: string
  testSpaceId: number
  testSubjectId: number
}

export type TestCase = {
  canDelete: boolean
  caseKind: TestCaseKind
  caseType: TestCaseType
  createdAt: string
  customTags: string[]
  expectedResult: string
  folderId?: number
  id: number
  preconditions: string
  priority: Priority
  remarks: string
  status: TestCaseStatus
  steps: string
  testSpaceId: number
  testSubjectId: number
  title: string
  updatedAt: string
}

export type TestPlan = {
  canManage: boolean
  createdAt: string
  createdByUserId?: number
  endsOn?: string
  environment: string
  id: number
  name: string
  ownerUserId?: number
  projectId?: number
  startsOn?: string
  status: TestPlanStatus
  testSpaceId: number
  testSubjectId: number
  testSubjectIds: number[]
  updatedAt: string
  versionLabel: string
}

export type TestPlanCase = {
  executedAt?: string
  executedByUserId?: number
  id: number
  result: TestResult
  resultNote: string
  snapshotCaseVersion: number
  snapshotExpectedResult: string
  snapshotPreconditions: string
  snapshotSteps: string
  snapshotTitle: string
  testCaseId?: number
  testPlanId: number
  testSubjectId?: number
}

export type TestBugComment = {
  authorName: string
  authorUserId?: number
  canEdit?: boolean
  content: string
  createdAt: string
  id: number
  kind: 'comment' | 'transfer' | 'reject'
  updatedAt: string
}

export type TestBugEvent = {
  actorName?: string
  actorUserId?: number
  assigneeName?: string
  assigneeUserId?: number
  createdAt: string
  eventType: 'created' | 'assigned' | 'transferred' | 'status_changed' | 'space_transferred'
  id: number
  nextSpaceName?: string
  nextStatus?: BugStatus
  previousSpaceName?: string
  previousStatus?: BugStatus
  transferSource?: 'manual' | 'offboarding'
}

export type TestBug = {
  actualResult: string
  assigneeName?: string
  assigneeUserId?: number
  assigneeTransferSource?: 'manual' | 'offboarding'
  canComment?: boolean
  canDelete?: boolean
  canEdit?: boolean
  canEditSpaceVersion?: boolean
  canManage?: boolean
  canShare?: boolean
  canTransferSpace?: boolean
  canTransfer?: boolean
  comments: TestBugComment[]
  createdAt: string
  environment: string
  expectedResult: string
  events: TestBugEvent[]
  id: number
  organizationMembers?: Array<{ id: number; name: string }>
  priority: Priority
  reporterName?: string
  reporterUserId?: number
  reproductionSteps: string
  severity: BugSeverity
  status: BugStatus
  testPlanCaseId?: number
  testPlanId?: number
  testPlanName?: string
  testEnvironmentAccessUrl?: string
  testEnvironmentId?: number
  testEnvironmentName?: string
  testSpaceId: number
  testSpaceName?: string
  testSpaceVersionLabel?: string
  testSubjectId?: number
  testSubjectName?: string
  title: string
  transferSpaceCandidates?: Array<{ id: number; name: string; versionLabel?: string }>
  transferCandidates?: Array<{ id: number; name: string }>
  updatedAt: string
}

export type TestWorkspaceUser = {
  displayName: string
  id: number
  roles: UserRole[]
  username: string
}

export type TestWorkbenchNotification = {
  createdAt: string
  kind: 'test_plan_assigned' | 'test_bug_status_changed' | 'test_bug_rejected' | 'test_bug_comment_added'
  sourceId: number
} | {
  authorName: string
  commentPreview: string
  createdAt: string
  eventId: number
  eventTitle: string
  kind: 'package_event_comment_added'
  projectId: number
  projectName: string
  sourceId: number
}

export type TestWorkbenchData = {
  bugs: TestBug[]
  cases: TestCase[]
  departedUserIds: number[]
  folders: TestCaseFolder[]
  notifications: TestWorkbenchNotification[]
  planCases: TestPlanCase[]
  plans: TestPlan[]
  spaces: TestSpace[]
  subjects: TestSubject[]
  testEnvironments: TestEnvironment[]
  users: TestWorkspaceUser[]
}

export type TestWorkbenchProjectOption = Pick<Project, 'id' | 'name'>

export type TestCaseImportPreview = {
  levelCounts: Record<'P0' | 'P1' | 'P2', number>
  moduleCount: number
  rowCount: number
  sampleTitles: string[]
}
