import type { UserRole } from './api'
import type { ProjectMembership } from './types'
import type { PackageMarketRule } from './types'
import type { WeeklyReportRules } from '../shared/weekly-report-availability'
import type { OrganizationPackageMarketPolicy } from '../shared/organization-package-market'

export type { WeeklyReportRules } from '../shared/weekly-report-availability'

export type OrganizationAccessRole = 'owner' | 'admin' | 'member'
export type OrganizationProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type OrganizationProjectHealthStatus = 'on_track' | 'at_risk' | 'off_track'
export type OrganizationProjectMilestoneStatus = 'pending' | 'in_review' | 'achieved' | 'cancelled'

export type OrganizationListItem = {
  accessRole: OrganizationAccessRole
  id: number
  memberCount: number
  name: string
  packageMarketEnabled: boolean
}

export type OrganizationPackageMarketCatalogRule = PackageMarketRule & {
  canonicalId: string
  ciSupported: boolean
  ciVisible: boolean
  releaseVisible: boolean
  selectable: boolean
}

export type OrganizationMember = {
  accessRole: OrganizationAccessRole
  displayName: string
  feishuBound: boolean
  id: number
  joinedAt: string
  roles: UserRole[]
  username: string
}

export type OrganizationProject = {
  healthNote: string
  healthStatus: OrganizationProjectHealthStatus
  id: number
  memberships: ProjectMembership[]
  milestones: OrganizationProjectMilestone[]
  name: string
  openTodoCount: number
  ownerName: string
  ownerUserId: number
  status: OrganizationProjectStatus
  todoCount: number
  updatedAt: string
}

export type OrganizationProjectMilestone = {
  acceptanceCriteria: string
  baselineDate: string
  completedAt?: string
  createdAt: string
  executionNote: string
  id: number
  linkedTodos: Array<{
    done: boolean
    id: number
    title: string
  }>
  responsibleName: string
  responsibleUserId?: number
  status: OrganizationProjectMilestoneStatus
  targetDate: string
  title: string
  updatedAt: string
}

export type OrganizationTestSpace = {
  bugCount: number
  id: number
  name: string
  ownerName: string
  planCount: number
  versionLabel?: string
  updatedAt: string
}

export type OrganizationTestEnvironment = {
  accessUrl: string
  createdAt: string
  id: number
  name: string
  testSpaceIds: number[]
  updatedAt: string
}

export type OrganizationTask = {
  assigneeName: string
  assigneeUserId?: number
  id: number
  kind: 'bug' | 'delivery' | 'todo'
  projectId?: number
  projectName: string
  status: string
  title: string
  updatedAt: string
}

export type OrganizationWeeklyReport = {
  content: string
  memberName: string
  status: 'draft' | 'submitted'
  submittedAt?: string
  updatedAt: string
  userId: number
  weekStart: string
}

export type OrganizationWeeklySummary = {
  content: string
  createdAt: string
  sourceReportCount: number
  weekStart: string
}

export type WeeklyReportSourceKind = 'delivery' | 'milestone' | 'todo'

export type WeeklyReportSourceRef = {
  id: number
  kind: WeeklyReportSourceKind
  projectId: number
}

export type WeeklyReportSourceCandidate = WeeklyReportSourceRef & {
  date: string
  projectName: string
  relatedToMe: boolean
  status: string
  title: string
}

export type PersonalWeeklyReport = {
  content: string
  draftVersion: number
  publishedContent: string
  publishedRevision: number | null
  sourceMode: 'ai' | 'manual'
  sources: WeeklyReportSourceRef[]
  state: 'draft' | 'empty' | 'modified' | 'submitted'
  submittedAt: string | null
  weekStart: string
}

export type PersonalWeeklyReportListItem = {
  publishedRevision: number | null
  sourceCount: number
  state: Exclude<PersonalWeeklyReport['state'], 'empty'>
  submittedAt: string | null
  updatedAt: string
  weekStart: string
}

export type PersonalWeeklyReportList = {
  items: PersonalWeeklyReportListItem[]
  limit: number
  offset: number
  total: number
}

export type WeeklyReportCollectionMember = {
  content: string
  feishuBound: boolean
  memberName: string
  revision: number | null
  state: PersonalWeeklyReport['state']
  submittedAt: string | null
  userId: number
}

export type WeeklyReportCollection = {
  members: WeeklyReportCollectionMember[]
  weekStart: string
}

export type OrganizationDetail = {
  accessRole: OrganizationAccessRole
  attachableProjects: Array<{ id: number; name: string; status: string }>
  attachableTestSpaces: Array<{ id: number; name: string }>
  canManage: boolean
  canManageProjects: boolean
  canManageTestEnvironments: boolean
  canManageWeeklyReports: boolean
  createdAt: string
  departedUserIds: number[]
  id: number
  invitations: Array<{
    createdAt: string
    id: number
    lastError: string
    status: string
    targetEmail: string
  }>
  members: OrganizationMember[]
  name: string
  ownerUserId: number
  packageMarketPolicy: OrganizationPackageMarketPolicy
  projects: OrganizationProject[]
  reports: OrganizationWeeklyReport[]
  summaries: OrganizationWeeklySummary[]
  tasks: OrganizationTask[]
  testEnvironments: OrganizationTestEnvironment[]
  testSpaces: OrganizationTestSpace[]
  weeklyReportRules: WeeklyReportRules
  weekStartsOn: number
}
