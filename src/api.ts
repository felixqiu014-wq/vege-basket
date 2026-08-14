import type {
  InboxItem,
  AiConversationContextKind,
  AiConversationPage,
  AiTurnPage,
  AiTurnRunResponse,
  ChangelogEntry,
  ImageSyncArchitecture,
  ImageSyncArtifactKind,
  ImageSyncDownloadLink,
  ImageSyncRun,
  JournalVisibility,
  PackageMarketChannel,
  PackageMarketCiBranch,
  PackageMarketDetail,
  PackageMarketRule,
  PackageMarketVersion,
  NotificationCenterData,
  Priority,
  Project,
  ProjectPackageEventStatus,
  ProjectPackageEventSavePayload,
  ProjectPackageOperationKind,
  ProjectPackageOperationStatus,
  ProjectPackageTimeline,
  ProjectPackageEventType,
  ProjectMembership,
  ProjectStatus,
  Summary,
  SummaryPeriodType,
  Todo,
  TodoActivityEvent,
  TodoNote,
  TodoProposal,
  NotificationSubscription,
} from './types'
import { ApiError } from './api-error'
import {
  decodeAiTurnStreamEvent,
  ServerSentEventDecoder,
  type AiTurnStreamPhase,
} from '../shared/server-sent-events'
import {
  parseAiIntentClassification,
  type AiIntentClassification,
} from '../shared/ai-input-intent'
import { parseAiTurnRunResponse } from '../shared/ai-conversation-wire'
import type {
  OrganizationAccessRole,
  OrganizationDetail,
  OrganizationListItem,
  OrganizationProjectHealthStatus,
  OrganizationProjectMilestoneStatus,
  OrganizationProjectStatus,
  PersonalWeeklyReport,
  PersonalWeeklyReportList,
  WeeklyReportCollection,
  WeeklyReportRules,
  WeeklyReportSourceCandidate,
  WeeklyReportSourceRef,
} from './organization-types'
import type { MyWorkData, MyWorkFilters } from './my-work-types'
export { ApiError, formatApiErrorDiagnostic } from './api-error'
export type { AiTurnStreamPhase } from '../shared/server-sent-events'

export type WorkspaceData = {
  inbox: InboxItem[]
  memberships: ProjectMembership[]
  projects: Project[]
  summaries: Summary[]
  todos: Todo[]
}

export type AiTurnDocumentResponse = {
  created: boolean
  summaryId: number
  workspace: WorkspaceData
}

export type NotificationResponse = {
  notifications: NotificationCenterData
}

export type PackageMarketRulesResponse = {
  expireMinutes: number
  rules: PackageMarketRule[]
}

export type ChangelogResponse = {
  canManage: boolean
  entries: ChangelogEntry[]
}

export type AuthUser = {
  activeRole: UserRole
  displayName: string
  feishuEmail: string
  feishuLinked: boolean
  id: number
  isSystemAdmin: boolean
  roles: UserRole[]
  username: string
}

export type UserRole = 'developer' | 'tester' | 'organization_admin'

export type ManagedUser = {
  displayName: string
  id: number
  roles: UserRole[]
  username: string
}

export type AuthResponse = {
  isNewUser?: boolean
  token: string
  user: AuthUser
  workspace: WorkspaceData
}

export type ProjectInviteLinkResponse = {
  expiresAt: string
  expiresInMinutes: number
  passwordRequired: boolean
  token: string
}

export type OrganizationInviteLinkResponse = {
  expiresAt: string
  expiresInMinutes: number
  token: string
}

export type AiStatus = {
  configured: boolean
  maxMessageLength: number
  model: string
}

export type AiTurnStreamHandlers = {
  onDelta?: (append: string) => void
  onHeartbeat?: () => void
  onProgress?: (phase: AiTurnStreamPhase) => void
  onStarted?: (event: {
    conversation?: AiTurnRunResponse['conversation']
    mode: 'progress' | 'text'
    turn?: AiTurnRunResponse['turn']
  }) => void
}

export type AiIntentClassificationResponse = {
  intent: AiIntentClassification
  turnId: string
}

export class AiTurnStreamTerminalError extends Error {
  readonly code: string
  readonly event: 'cancelled' | 'failed'

  constructor(event: 'cancelled' | 'failed', code: string, message: string) {
    super(message)
    this.name = 'AiTurnStreamTerminalError'
    this.code = code
    this.event = event
  }
}

export type TodoImageUploadResponse = {
  attachmentUrl?: string
  contentType?: string
  imageUrl: string
  objectKey: string
}

function inferTodoAttachmentContentType(file: File) {
  const declaredType = file.type.split(';')[0].trim().toLowerCase()
  if (
    declaredType === 'image/jpeg' ||
    declaredType === 'image/jpg' ||
    declaredType === 'image/png' ||
    declaredType === 'image/webp' ||
    declaredType === 'image/gif' ||
    declaredType === 'video/mp4' ||
    declaredType === 'video/webm' ||
    declaredType === 'video/quicktime'
  ) {
    return declaredType === 'image/jpg' ? 'image/jpeg' : declaredType
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'mp4' || extension === 'm4v') return 'video/mp4'
  if (extension === 'webm') return 'video/webm'
  if (extension === 'mov') return 'video/quicktime'

  return declaredType || 'application/octet-stream'
}

function apiErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object' || !('error' in body)) return fallback
  const error = (body as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error.trim() : fallback
}

const tokenStorageKey = 'veges.authToken'
const browserStorage = (globalThis as {
  localStorage?: {
    getItem: (key: string) => string | null
    removeItem: (key: string) => void
    setItem: (key: string, value: string) => void
  }
}).localStorage
let authToken = browserStorage?.getItem(tokenStorageKey) ?? ''

export function getAuthToken() {
  return authToken
}

export function setAuthToken(token: string) {
  authToken = token
  browserStorage?.setItem(tokenStorageKey, token)
}

export function clearAuthToken() {
  authToken = ''
  browserStorage?.removeItem(tokenStorageKey)
}

export async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const fallbackMessage = `Request failed: ${response.status}`
    const responseText = await response.text()
    let responseBody: unknown = responseText
    try {
      responseBody = responseText ? JSON.parse(responseText) : ''
    } catch {
      // Keep non-JSON response text for diagnostics.
    }
    throw new ApiError(apiErrorMessage(responseBody, fallbackMessage), {
      method: String(options.method ?? 'GET').toUpperCase(),
      path,
      responseBody,
      status: response.status,
      statusText: response.statusText,
    })
  }

  return response.json() as Promise<T>
}

async function throwApiResponseError(response: Response, path: string, method: string): Promise<never> {
  const fallbackMessage = `Request failed: ${response.status}`
  const responseText = await response.text()
  let responseBody: unknown = responseText
  try {
    responseBody = responseText ? JSON.parse(responseText) : ''
  } catch {
    // Keep non-JSON response text for diagnostics.
  }
  throw new ApiError(apiErrorMessage(responseBody, fallbackMessage), {
    method,
    path,
    responseBody,
    status: response.status,
    statusText: response.statusText,
  })
}

async function requestAiTurnStream(
  path: string,
  options: RequestInit,
  handlers: AiTurnStreamHandlers,
) {
  const method = String(options.method ?? 'POST').toUpperCase()
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) await throwApiResponseError(response, path, method)
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    return parseAiTurnRunResponse(await response.json())
  }
  if (!response.body) throw new Error('AI response stream is unavailable')

  const decoder = new ServerSentEventDecoder()
  const reader = response.body.getReader()
  let lastSequence = 0
  let result: AiTurnRunResponse | null = null
  let terminalError: AiTurnStreamTerminalError | null = null

  const consume = (events: ReturnType<ServerSentEventDecoder['push']>) => {
    for (const frame of events) {
      const event = decodeAiTurnStreamEvent(frame)
      if (event.sequence <= lastSequence) {
        throw new Error('AI response stream events arrived out of order')
      }
      lastSequence = event.sequence

      if (event.type === 'started') {
        handlers.onStarted?.({
          conversation: event.conversation,
          mode: event.mode,
          turn: event.turn,
        })
      } else if (event.type === 'delta') {
        handlers.onDelta?.(event.append)
      } else if (event.type === 'progress') {
        handlers.onProgress?.(event.phase)
      } else if (event.type === 'heartbeat') {
        handlers.onHeartbeat?.()
      } else if (event.type === 'completed') {
        result = event.result
      } else if (event.type === 'failed' || event.type === 'cancelled') {
        if (event.result) {
          result = event.result
        } else {
          terminalError = new AiTurnStreamTerminalError(
            event.type,
            event.error.code,
            event.error.message,
          )
        }
      }
    }
  }

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    consume(decoder.push(chunk.value))
  }
  consume(decoder.finish())
  if (result) return result
  if (terminalError) throw terminalError
  throw new Error('AI response stream ended before the turn was confirmed')
}

export function fetchWorkspace() {
  return request<WorkspaceData>('/api/workspace')
}

export function fetchChangelog() {
  return request<ChangelogResponse>('/api/changelog')
}

export function createChangelogEntry(payload: Pick<ChangelogEntry, 'content' | 'title' | 'version'>) {
  return request<{ entry: ChangelogEntry }>('/api/admin/changelog', {
    body: JSON.stringify(payload),
    method: 'POST',
  })
}

export function updateChangelogEntry(
  entryId: number,
  payload: Pick<ChangelogEntry, 'content' | 'title' | 'version'>,
) {
  return request<{ entry: ChangelogEntry }>(`/api/admin/changelog/${entryId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  })
}

export function createImageSyncRun(payload: {
  arch: ImageSyncArchitecture
  image: string
}) {
  return request<{ run: ImageSyncRun }>('/api/image-sync-runs', {
    body: JSON.stringify(payload),
    method: 'POST',
  })
}

export function fetchImageSyncRuns() {
  return request<{ runs: ImageSyncRun[] }>('/api/image-sync-runs')
}

export function fetchImageSyncRun(runId: number, refresh = false) {
  const params = refresh ? '?refresh=true' : ''
  return request<{ run: ImageSyncRun }>(`/api/image-sync-runs/${runId}${params}`)
}

export function fetchImageSyncRunDownloadUrl(runId: number, artifact: ImageSyncArtifactKind = 'tar') {
  const suffix = artifact === 'tar' ? '' : `?artifact=${encodeURIComponent(artifact)}`
  return request<ImageSyncDownloadLink>(`/api/image-sync-runs/${runId}/download-url${suffix}`)
}

export function deleteImageSyncRun(runId: number) {
  return request<{ deleted: true }>(`/api/image-sync-runs/${runId}`, {
    method: 'DELETE',
  })
}

export function fetchNotifications() {
  return request<NotificationResponse>('/api/notifications')
}

export function markAllNotificationsRead() {
  return request<NotificationResponse>('/api/notifications/read-all', {
    method: 'PATCH',
  })
}

export function fetchMyWork(filters: MyWorkFilters = {}) {
  const params = new URLSearchParams()
  if (filters.cursor) params.set('cursor', filters.cursor)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.projectId) params.set('projectId', String(filters.projectId))
  if (filters.creator) params.set('creator', filters.creator)
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.limit) params.set('limit', String(filters.limit))
  const query = params.toString()
  return request<MyWorkData>(`/api/my-work${query ? `?${query}` : ''}`)
}

export function fetchCurrentUser() {
  return request<{ user: AuthUser; workspace: WorkspaceData }>('/api/auth/me')
}

export function registerAccount(payload: {
  invitePassword?: string
  inviteToken?: string
  organizationInviteToken?: string
  password: string
  username: string
}) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginAccount(payload: {
  invitePassword?: string
  inviteToken?: string
  organizationInviteToken?: string
  password: string
  username: string
}) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCurrentUser(payload: {
  displayName: string
}) {
  return request<{ user: AuthUser }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function switchActiveRole(role: UserRole) {
  return request<{ activeRole: UserRole }>('/api/auth/active-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
}

export function fetchManagedUsers() {
  return request<{ users: ManagedUser[] }>('/api/admin/users')
}

export function updateManagedUserRoles(userId: number, roles: UserRole[]) {
  return request<{ roles: UserRole[] }>(`/api/admin/users/${userId}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  })
}

export function fetchOrganizations() {
  return request<{ canCreate: boolean; organizations: OrganizationListItem[] }>('/api/organizations')
}

export function createOrganization(payload: { name: string; ownerUsername?: string }) {
  return request<OrganizationDetail>('/api/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchOrganization(organizationId: number) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}`)
}

export function updateOrganization(organizationId: number, name: string) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function updateOrganizationWeekStart(organizationId: number, weekStartsOn: number) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/week-start`, {
    method: 'PATCH',
    body: JSON.stringify({ weekStartsOn }),
  })
}

export function updateOrganizationWeeklyReportRules(
  organizationId: number,
  payload: { weekStartsOn: number; weeklyReportRules: WeeklyReportRules },
) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/weekly-report-rules`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteOrganization(organizationId: number, confirmationName: string) {
  return request<{
    deleted: true
    detachedProjectCount: number
    detachedTestSpaceCount: number
  }>(`/api/organizations/${organizationId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmationName }),
  })
}

export function inviteOrganizationMemberByUsername(organizationId: number, username: string) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/username-invitations`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export function createOrganizationInviteLink(
  organizationId: number,
  expiresInMinutes: number,
) {
  return request<OrganizationInviteLinkResponse>(
    `/api/organizations/${organizationId}/invite-link`,
    {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes }),
    },
  )
}

export function fetchOrganizationInviteLinkInfo(token: string) {
  return request<{ expiresAt: string; organizationName: string; valid: true }>(
    `/api/organization-invite-links/${encodeURIComponent(token)}`,
  )
}

export function acceptOrganizationInviteLink(token: string) {
  return request<{ ok: true; organizationId: number }>(
    `/api/organization-invite-links/${encodeURIComponent(token)}/accept`,
    { method: 'POST' },
  )
}

export function updateOrganizationMemberRole(
  organizationId: number,
  userId: number,
  accessRole: Exclude<OrganizationAccessRole, 'owner'>,
) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ accessRole }),
  })
}

export function removeOrganizationMember(organizationId: number, userId: number) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function attachProjectToOrganization(organizationId: number, projectId: number) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/projects/${projectId}`, {
    method: 'POST',
  })
}

export function addOrganizationProjectMember(
  organizationId: number,
  projectId: number,
  userId: number,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/members`,
    { method: 'POST', body: JSON.stringify({ userId }) },
  )
}

export function removeOrganizationProjectMember(
  organizationId: number,
  projectId: number,
  membershipId: number,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/members/${membershipId}`,
    { method: 'DELETE' },
  )
}

export function updateOrganizationProjectGovernance(
  organizationId: number,
  projectId: number,
  payload: Partial<{
    healthNote: string
    healthStatus: OrganizationProjectHealthStatus
    status: OrganizationProjectStatus
  }>,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/governance`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
}

export type OrganizationProjectMilestonePayload = {
  acceptanceCriteria: string
  executionNote: string
  linkedTodoIds: number[]
  responsibleUserId: number | null
  status?: OrganizationProjectMilestoneStatus
  targetDate: string
  title: string
}

export function createOrganizationProjectMilestone(
  organizationId: number,
  projectId: number,
  payload: OrganizationProjectMilestonePayload,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/milestones`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function updateOrganizationProjectMilestone(
  organizationId: number,
  projectId: number,
  milestoneId: number,
  payload: OrganizationProjectMilestonePayload,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/milestones/${milestoneId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
}

export function updateOrganizationProjectMilestoneStatus(
  organizationId: number,
  projectId: number,
  milestoneId: number,
  status: OrganizationProjectMilestoneStatus,
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/projects/${projectId}/milestones/${milestoneId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  )
}

export function attachTestSpaceToOrganization(organizationId: number, spaceId: number) {
  return request<OrganizationDetail>(`/api/organizations/${organizationId}/test-spaces/${spaceId}`, {
    method: 'POST',
  })
}

export function saveOrganizationWeeklyReport(
  organizationId: number,
  weekStart: string,
  payload: { content: string; status: 'draft' | 'submitted' },
) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/weekly-reports/${weekStart}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
}

export function generateOrganizationWeeklySummary(organizationId: number, weekStart: string) {
  return request<OrganizationDetail>(
    `/api/organizations/${organizationId}/weekly-summaries/${weekStart}`,
    { method: 'POST' },
  )
}

export function fetchPersonalWeeklyReport(organizationId: number, weekStart: string) {
  return request<PersonalWeeklyReport>(`/api/weekly-reports/${organizationId}/${weekStart}`)
}

export function fetchPersonalWeeklyReports(
  organizationId: number,
  options: { limit?: number; offset?: number } = {},
) {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 10),
    offset: String(options.offset ?? 0),
  })
  return request<PersonalWeeklyReportList>(`/api/weekly-reports/${organizationId}?${query}`)
}

export function fetchWeeklyReportSources(organizationId: number, weekStart: string) {
  return request<{ sources: WeeklyReportSourceCandidate[] }>(
    `/api/weekly-reports/${organizationId}/${weekStart}/sources`,
  )
}

export function savePersonalWeeklyReportDraft(
  organizationId: number,
  weekStart: string,
  payload: {
    content: string
    expectedVersion: number
    sourceMode: 'ai' | 'manual'
    sources: WeeklyReportSourceRef[]
  },
) {
  return request<PersonalWeeklyReport>(
    `/api/weekly-reports/${organizationId}/${weekStart}/draft`,
    { body: JSON.stringify(payload), method: 'PUT' },
  )
}

export function generatePersonalWeeklyReport(
  organizationId: number,
  weekStart: string,
  payload: { expectedVersion: number; sources: WeeklyReportSourceRef[] },
) {
  return request<PersonalWeeklyReport>(
    `/api/weekly-reports/${organizationId}/${weekStart}/generate`,
    { body: JSON.stringify(payload), method: 'POST' },
  )
}

export function submitPersonalWeeklyReport(
  organizationId: number,
  weekStart: string,
  expectedVersion: number,
) {
  return request<PersonalWeeklyReport>(
    `/api/weekly-reports/${organizationId}/${weekStart}/submit`,
    { body: JSON.stringify({ expectedVersion }), method: 'POST' },
  )
}

export function fetchWeeklyReportCollection(organizationId: number, weekStart: string) {
  return request<WeeklyReportCollection>(
    `/api/organizations/${organizationId}/weekly-report-collection/${weekStart}`,
  )
}

export function remindWeeklyReportMembers(
  organizationId: number,
  weekStart: string,
  userIds: number[],
) {
  return request<{ failed: number; sent: number; skipped: number }>(
    `/api/organizations/${organizationId}/weekly-report-reminders/${weekStart}`,
    { body: JSON.stringify({ userIds }), method: 'POST' },
  )
}

export function createFeishuOAuthUrl(payload: {
  invitePassword?: string
  inviteToken?: string
  organizationInviteToken?: string
  returnTo: string
}) {
  return request<{ url: string }>('/api/auth/feishu/oauth/url', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function disconnectFeishuAccount() {
  return request<{ user: AuthUser }>('/api/auth/feishu/oauth', {
    method: 'DELETE',
  })
}

export function updateCurrentPassword(payload: {
  currentPassword: string
  nextPassword: string
}) {
  return request<{ ok: true }>('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchAiStatus() {
  return request<AiStatus>('/api/ai/status')
}

export function createProject(payload: { name: string; organizationId?: number; tags: string[] }) {
  return request<WorkspaceData>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createProjectModule(projectId: number, payload: { name: string }) {
  return request<WorkspaceData>(`/api/projects/${projectId}/modules`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function removeProjectModule(projectId: number, moduleId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}/modules/${moduleId}`, {
    method: 'DELETE',
  })
}

export function updateProject(
  projectId: number,
  payload: Partial<{ name: string; description: string; status: ProjectStatus; tags: string[] }>,
) {
  return request<WorkspaceData>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateProjectFeishuSettings(
  projectId: number,
  payload: { feishuChatEnabled: boolean; feishuChatId: string },
) {
  return request<WorkspaceData>(`/api/projects/${projectId}/feishu`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function requestProjectTransfer(
  projectId: number,
  payload: { organizationId: number; targetUserId: number },
) {
  return request<{ ok: true; transferId: number }>(`/api/projects/${projectId}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function respondToProjectTransfer(
  transferId: number,
  action: 'accept' | 'decline',
) {
  return request<NotificationResponse & { workspace: WorkspaceData }>(
    `/api/project-transfers/${transferId}/respond`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    },
  )
}

export function removeProject(projectId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  })
}

export function createJournalEntry(projectId: number, content: string, createdAt?: string) {
  return request<WorkspaceData>(`/api/projects/${projectId}/journals`, {
    method: 'POST',
    body: JSON.stringify({ content, createdAt }),
  })
}

export function updateJournalEntry(
  projectId: number,
  entryId: number,
  payload: { content?: string; visibility?: JournalVisibility },
) {
  return request<WorkspaceData>(`/api/projects/${projectId}/journals/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function removeJournalEntry(projectId: number, entryId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}/journals/${entryId}`, {
    method: 'DELETE',
  })
}

export function createRiskFromJournal(projectId: number, journalEntryId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}/risks`, {
    method: 'POST',
    body: JSON.stringify({ journalEntryId }),
  })
}

export function resolveRisk(projectId: number, content: string) {
  return request<WorkspaceData>(`/api/projects/${projectId}/risks`, {
    method: 'DELETE',
    body: JSON.stringify({ content }),
  })
}

export function resolveRiskFromJournal(projectId: number, journalEntryId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}/risks`, {
    method: 'DELETE',
    body: JSON.stringify({ journalEntryId }),
  })
}

export function createDraft(payload: {
  content: string
  suggestedProjectId?: number
}) {
  return request<WorkspaceData>('/api/drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function archiveDraft(draftId: number, projectId: number) {
  return request<WorkspaceData>(`/api/drafts/${draftId}/archive`, {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  })
}

export function removeDraft(draftId: number) {
  return request<WorkspaceData>(`/api/drafts/${draftId}`, {
    method: 'DELETE',
  })
}

export async function uploadTodoImage(file: File) {
  const contentType = inferTodoAttachmentContentType(file)
  const response = await fetch('/api/todo-images', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: file,
  })

  if (!response.ok) {
    const fallbackMessage = `Request failed: ${response.status}`
    let data: { error?: string }
    try {
      data = await response.json() as { error?: string }
    } catch (error) {
      throw new Error(fallbackMessage, { cause: error })
    }
    throw new Error(data.error || fallbackMessage)
  }

  return response.json() as Promise<TodoImageUploadResponse>
}

export const uploadWorkbenchAttachment = uploadTodoImage

export function createTodo(payload: {
  assigneeUserId?: number
  watcherUserId?: number
  watcherUserIds?: number[]
  reviewerUserId?: number
  createdAt?: string
  detail?: string
  dueDate: string
  moduleId?: number | null
  priority: Priority
  projectId: number
  title: string
}) {
  return request<WorkspaceData>('/api/todos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function inviteProjectMember(projectId: number, payload: { username: string }) {
  return request<WorkspaceData>(`/api/projects/${projectId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getProjectInviteLink(
  projectId: number,
  payload: { expiresInMinutes?: number; password?: string; rotate?: boolean } = {},
) {
  return request<ProjectInviteLinkResponse>(`/api/projects/${projectId}/invite-link`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchProjectInviteLinkInfo(token: string) {
  return request<{ passwordRequired: boolean; valid: true }>(
    `/api/project-invite-links/${encodeURIComponent(token)}`,
  )
}

export function verifyProjectInviteLink(token: string, payload: { password?: string } = {}) {
  return request<{ passwordRequired: boolean; valid: true }>(
    `/api/project-invite-links/${encodeURIComponent(token)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function acceptProjectInviteLink(token: string, payload: { password?: string } = {}) {
  return request<{ workspace: WorkspaceData }>(
    `/api/project-invite-links/${encodeURIComponent(token)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function removeProjectMember(projectId: number, membershipId: number) {
  return request<WorkspaceData>(`/api/projects/${projectId}/invitations/${membershipId}`, {
    method: 'DELETE',
  })
}

export function acceptProjectInvitation(membershipId: number) {
  return request<NotificationResponse & { workspace: WorkspaceData }>(
    `/api/invitations/${membershipId}/accept`,
    {
      method: 'POST',
    },
  )
}

export function declineProjectInvitation(membershipId: number) {
  return request<NotificationResponse & { workspace: WorkspaceData }>(
    `/api/invitations/${membershipId}/decline`,
    {
      method: 'POST',
    },
  )
}

export function markNotificationRead(
  kind: 'project_invite' | 'assigned_todo' | 'watched_todo' | 'package_event_assigned' | 'package_event_comment_added' | 'todo_due_tomorrow' | 'todo_note_mention',
  sourceId: number,
  dismiss = false,
) {
  return request<NotificationResponse>(`/api/notifications/${kind}/${sourceId}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ dismiss }),
  })
}

export function updateTodo(
  todoId: number,
  payload: Omit<Partial<Todo>, 'assigneeUserId' | 'moduleId' | 'reviewerUserId' | 'watcherUserId' | 'watcherUserIds'> & {
    assigneeUserId?: number | null
    createdAt?: string
    acceptanceNote?: string
    moduleId?: number | null
    rejectionReason?: string
    reviewerUserId?: number | null
    watcherUserId?: number | null
    watcherUserIds?: number[]
  },
) {
  return request<WorkspaceData>(`/api/todos/${todoId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function createTodoNote(todoId: number, payload: { content: string }) {
  return request<WorkspaceData>(`/api/todos/${todoId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTodoNote(todoId: number, noteId: number, payload: Pick<TodoNote, 'content'>) {
  return request<WorkspaceData>(`/api/todos/${todoId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function removeTodo(todoId: number) {
  return request<WorkspaceData>(`/api/todos/${todoId}`, {
    method: 'DELETE',
  })
}

export function createSummary(projectId: number, type: SummaryPeriodType) {
  return request<WorkspaceData>(`/api/projects/${projectId}/summaries`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  })
}

export function createAiTurnDocument(conversationId: string, turnId: string) {
  return request<AiTurnDocumentResponse>(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/document`,
    {
      method: 'POST',
    },
  )
}

export function fetchTodoActivity(projectId: number) {
  return request<{ events: TodoActivityEvent[] }>(`/api/projects/${projectId}/todo-activity`)
}

export function fetchNotificationSubscription() {
  return request<{ subscription: NotificationSubscription }>('/api/notification-subscription')
}

export function updateNotificationSubscription(payload: {
  enabled: boolean
  localSendTime: string
}) {
  return request<{ subscription: NotificationSubscription }>('/api/notification-subscription', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function fetchTodoProposalBatch(batchId: number) {
  return request<{ batchId: number; proposals: TodoProposal[]; status: string }>(
    `/api/ai/todo-proposals/${encodeURIComponent(batchId)}`,
  )
}

export function confirmTodoProposals(batchId: number, proposals: TodoProposal[]) {
  return request<WorkspaceData>(`/api/ai/todo-proposals/${encodeURIComponent(batchId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ proposals }),
  })
}

export function fetchAiConversations(cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return request<AiConversationPage>(`/api/ai/conversations${query}`)
}

export function fetchAiConversationTurns(
  conversationId: string,
  beforeTurn?: number,
  limit?: number,
) {
  const search = new URLSearchParams()
  if (beforeTurn) search.set('beforeTurn', String(beforeTurn))
  if (limit) search.set('limit', String(limit))
  const query = search.size > 0 ? `?${search.toString()}` : ''
  return request<AiTurnPage>(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}/turns${query}`,
  )
}

export async function classifyAiConversationTurnIntent(payload: {
  attachments: Array<{
    content: string
    mediaType?: string
    name: string
    size: number
  }>
  content: string
  contextKind: AiConversationContextKind
  projectId: number | null
  turnId: string
}, signal?: AbortSignal) {
  const response = await request<unknown>('/api/ai/intent-classifications', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  })
  if (
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response) ||
    !('turnId' in response) ||
    typeof response.turnId !== 'string' ||
    response.turnId !== payload.turnId ||
    !('intent' in response)
  ) {
    throw new Error('AI intent classification response is invalid')
  }
  return {
    intent: parseAiIntentClassification(response.intent),
    turnId: response.turnId,
  } satisfies AiIntentClassificationResponse
}

export function sendAiConversationTurn(payload: {
  attachments: Array<{
    content: string
    mediaType?: string
    name: string
    size: number
  }>
  content: string
  contextKind: AiConversationContextKind
  conversationId: string
  projectId: number | null
  turnId: string
}, handlers: AiTurnStreamHandlers = {}) {
  return requestAiTurnStream(
    `/api/ai/conversations/${encodeURIComponent(payload.conversationId)}/turns`,
    {
      method: 'POST',
      body: JSON.stringify({
        attachments: payload.attachments,
        content: payload.content,
        contextKind: payload.contextKind,
        projectId: payload.projectId,
        turnId: payload.turnId,
      }),
    },
    handlers,
  )
}

export function retryAiConversationTurn(
  conversationId: string,
  turnId: string,
  handlers: AiTurnStreamHandlers = {},
) {
  return requestAiTurnStream(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/retry`,
    { method: 'POST' },
    handlers,
  )
}

export function cancelAiConversationTurn(conversationId: string, turnId: string) {
  return request<
    | { cancelled: true; pending: true }
    | {
      cancelled: boolean
      conversation: AiConversationPage['conversations'][number]
      pending: false
      turn: AiTurnRunResponse['turn']
    }
  >(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/cancel`,
    { method: 'POST' },
  )
}

export function reconcileAiConversationTurn(conversationId: string, turnId: string) {
  return request<{
    conversation: AiConversationPage['conversations'][number]
    turn: AiTurnRunResponse['turn']
  }>(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/reconcile`,
    { method: 'POST' },
  )
}

export function renameAiConversation(conversationId: string, title: string) {
  return request<{ conversation: AiConversationPage['conversations'][number] }>(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'PATCH', body: JSON.stringify({ title }) },
  )
}

export function deleteAiConversation(conversationId: string) {
  return request<{ ok: true }>(
    `/api/ai/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' },
  )
}

export function fetchProjectPackageTimeline(projectId: number) {
  return request<ProjectPackageTimeline>(`/api/projects/${projectId}/package-timeline`)
}

export function createProjectPackageEvent(
  projectId: number,
  payload: ProjectPackageEventSavePayload,
) {
  return request<ProjectPackageTimeline>(`/api/projects/${projectId}/package-timeline/events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function saveProjectPackageEventDraft(
  projectId: number,
  eventId: number,
  payload: ProjectPackageEventSavePayload,
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

export function completeProjectPackageEvent(projectId: number, eventId: number) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}/complete`,
    { method: 'POST' },
  )
}

export function addPackageEventComment(projectId: number, eventId: number, content: string) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  )
}

export function updatePackageEventComment(
  projectId: number,
  eventId: number,
  commentId: number,
  content: string,
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}/comments/${commentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    },
  )
}

export function deletePackageEventComment(
  projectId: number,
  eventId: number,
  commentId: number,
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}/comments/${commentId}`,
    { method: 'DELETE' },
  )
}

export function updateProjectPackageEvent(
  projectId: number,
  eventId: number,
  payload: Partial<{
    assigneeUserId: number
    deliveryDate: string
    deliveryEndAt: string
    deliveryStartAt: string
    status: ProjectPackageEventStatus
    title: string
    type: ProjectPackageEventType
  }>,
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export function removeProjectPackageEvent(projectId: number, eventId: number) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}`,
    {
      method: 'DELETE',
    },
  )
}

export function addProjectPackageItems(
  projectId: number,
  eventId: number,
  payload: {
    items: Array<{
      sourcePackageId: string
      sourcePackageName: string
      packageName: string
      channel: string
      channelLabel: string
      arch: string
      version: string
      objectKey: string
      objectLastModified?: string
      sizeBytes?: number
    }>
  },
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/events/${eventId}/packages`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function removeProjectPackageGroup(projectId: number, groupId: number) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/package-groups/${groupId}`,
    {
      method: 'DELETE',
    },
  )
}

export function createProjectPackageOperation(
  projectId: number,
  payload: {
    eventId: number
    groupId?: number | null
    kind: ProjectPackageOperationKind
    status?: ProjectPackageOperationStatus
    title?: string
    label?: string
    content?: string
    completed?: boolean
    relatedTodoIds?: number[]
    relatedTodoNotes?: Record<number, string>
  },
) {
  return request<ProjectPackageTimeline>(`/api/projects/${projectId}/package-timeline/operations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProjectPackageOperation(
  projectId: number,
  operationId: number,
  payload: Partial<{
    title: string
    label: string
    content: string
    completed: boolean
    status: ProjectPackageOperationStatus
    relatedTodoIds: number[]
    relatedTodoNotes: Record<number, string>
  }>,
) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/operations/${operationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export function removeProjectPackageOperation(projectId: number, operationId: number) {
  return request<ProjectPackageTimeline>(
    `/api/projects/${projectId}/package-timeline/operations/${operationId}`,
    {
      method: 'DELETE',
    },
  )
}

export function exportProjectPackageTimeline(projectId: number, eventId?: number) {
  const query = eventId == null ? '' : `?eventId=${encodeURIComponent(String(eventId))}`
  return request<{ fileName: string; markdown: string }>(
    `/api/projects/${projectId}/package-timeline/export${query}`,
  )
}

export function fetchProjectPackageItemDownloadUrl(
  projectId: number,
  itemId: number,
  expireMinutes?: number,
) {
  const params = new URLSearchParams()
  if (expireMinutes) params.set('expireMinutes', String(expireMinutes))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<{ downloadUrl: string; expiresAt: string; expiresInSeconds: number }>(
    `/api/projects/${projectId}/package-items/${itemId}/download-url${suffix}`,
  )
}

export function fetchPackageMarketRules() {
  return request<PackageMarketRulesResponse>('/api/package-market/rules')
}

export function fetchPackageMarketBaseDetail(payload: {
  arch: string
  channel: PackageMarketChannel
  ciBranch?: string
  ciVersion?: string
  deployType: 'pro' | 'oss'
  expireMinutes?: number
  includeAll?: boolean
  releaseVersion?: string
}) {
  const params = new URLSearchParams({
    arch: payload.arch,
    channel: payload.channel,
    deployType: payload.deployType,
  })
  if (payload.ciBranch) params.set('ciBranch', payload.ciBranch)
  if (payload.ciVersion) params.set('ciVersion', payload.ciVersion)
  if (payload.expireMinutes) params.set('expireMinutes', String(payload.expireMinutes))
  if (payload.includeAll) params.set('includeAll', 'true')
  if (payload.releaseVersion) params.set('releaseVersion', payload.releaseVersion)
  return request<PackageMarketDetail>(`/api/package-market/packages/base?${params.toString()}`)
}

export function fetchPackageMarketBaseReleaseVersions(payload: {
  arch: string
  deployType: 'pro' | 'oss'
  includeAll?: boolean
}) {
  const params = new URLSearchParams({
    arch: payload.arch,
    deployType: payload.deployType,
  })
  if (payload.includeAll) params.set('includeAll', 'true')
  return request<{ versions: PackageMarketVersion[] }>(
    `/api/package-market/packages/base/release-versions?${params.toString()}`,
  )
}

export function fetchPackageMarketDetail(payload: {
  arch: string
  channel: PackageMarketChannel
  ciBranch?: string
  ciVersion?: string
  deployType?: string
  expireMinutes?: number
  includeAll?: boolean
  packageId: string
  releaseVersion?: string
}) {
  const params = new URLSearchParams({
    arch: payload.arch,
    channel: payload.channel,
  })
  if (payload.ciBranch) params.set('ciBranch', payload.ciBranch)
  if (payload.ciVersion) params.set('ciVersion', payload.ciVersion)
  if (payload.deployType) params.set('deployType', payload.deployType)
  if (payload.expireMinutes) params.set('expireMinutes', String(payload.expireMinutes))
  if (payload.includeAll) params.set('includeAll', 'true')
  if (payload.releaseVersion) params.set('releaseVersion', payload.releaseVersion)
  return request<PackageMarketDetail>(
    `/api/package-market/packages/${encodeURIComponent(payload.packageId)}?${params.toString()}`,
  )
}

export function fetchPackageMarketReleaseVersions(payload: {
  arch: string
  deployType?: string
  includeAll?: boolean
  packageId: string
}) {
  const params = new URLSearchParams({ arch: payload.arch })
  if (payload.deployType) params.set('deployType', payload.deployType)
  if (payload.includeAll) params.set('includeAll', 'true')
  return request<{ versions: PackageMarketVersion[] }>(
    `/api/package-market/packages/${encodeURIComponent(payload.packageId)}/release-versions?${params.toString()}`,
  )
}

export function fetchPackageMarketCiBranches(payload: { packageId: string }) {
  return request<{ branches: PackageMarketCiBranch[] }>(
    `/api/package-market/packages/${encodeURIComponent(payload.packageId)}/ci-branches`,
  )
}

export function fetchPackageMarketCiVersions(payload: {
  arch: string
  ciBranch?: string
  includeAll?: boolean
  packageId: string
}) {
  const params = new URLSearchParams({ arch: payload.arch })
  if (payload.ciBranch) params.set('ciBranch', payload.ciBranch)
  if (payload.includeAll) params.set('includeAll', 'true')
  return request<{ versions: PackageMarketVersion[] }>(
    `/api/package-market/packages/${encodeURIComponent(payload.packageId)}/ci-versions?${params.toString()}`,
  )
}
