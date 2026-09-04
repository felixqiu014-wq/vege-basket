import { request } from './api'
import type {
  BugSeverity,
  BugStatus,
  TestCaseStatus,
  TestCaseKind,
  TestCaseType,
  TestCaseImportPreview,
  TestPlanStatus,
  TestResult,
  TestSpaceInviteLink,
  TestSpaceDataImportResult,
  TestSpaceImportSource,
  TestSpaceSettings,
  TestWorkbenchData,
} from './test-workbench-types'
import type { Priority } from './types'
import {
  serializeOrganizationContext,
  type OrganizationContext,
} from '../shared/organization-context'

function withOrganizationContext(path: string, organizationId: OrganizationContext) {
  const params = new URLSearchParams({ organizationId: serializeOrganizationContext(organizationId) })
  return `${path}?${params}`
}

export function fetchTestWorkbench() {
  return request<TestWorkbenchData>('/api/test-workbench')
}

export function createTestSpace(name: string, versionLabel: string, organizationId: number) {
  return request<TestWorkbenchData>('/api/test-spaces', {
    method: 'POST',
    body: JSON.stringify({ name, organizationId, versionLabel }),
  })
}

export function fetchTestSpaceSettings() {
  return request<TestSpaceSettings>('/api/test-spaces/settings')
}

export function updateTestSpace(spaceId: number, payload: { name: string; organizationId?: number; versionLabel?: string }) {
  return request<TestSpaceSettings>(`/api/test-spaces/${spaceId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      organizationId: payload.organizationId ?? null,
      versionLabel: payload.versionLabel ?? '',
    }),
  })
}

export function updateTestSpaceVersion(spaceId: number, versionLabel: string) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/version`, {
    method: 'PATCH',
    body: JSON.stringify({ versionLabel }),
  })
}

export function importTestSpaceData(
  targetSpaceId: number,
  sources: TestSpaceImportSource[],
) {
  return request<{ result: TestSpaceDataImportResult; settings: TestSpaceSettings }>(
    `/api/test-spaces/${targetSpaceId}/data-import`,
    { method: 'POST', body: JSON.stringify({ sources }) },
  )
}

export function deleteTestSpace(spaceId: number, confirmationName: string) {
  return request<TestSpaceSettings>(`/api/test-spaces/${spaceId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmationName }),
  })
}

export function transferTestBugToSpace(spaceId: number, bugId: number, targetSpaceId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}/transfer-space`, {
    method: 'POST',
    body: JSON.stringify({ targetSpaceId }),
  })
}

export function inviteTestSpaceMember(
  spaceId: number,
  username: string,
  accessLevel: 'editor' | 'viewer',
) {
  return request<TestSpaceSettings>(`/api/test-spaces/${spaceId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ accessLevel, username }),
  })
}

export function updateTestSpaceMember(
  spaceId: number,
  userId: number,
  accessLevel: 'editor' | 'viewer',
) {
  return request<TestSpaceSettings>(`/api/test-spaces/${spaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ accessLevel }),
  })
}

export function removeTestSpaceMember(spaceId: number, userId: number) {
  return request<TestSpaceSettings>(`/api/test-spaces/${spaceId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function acceptTestSpaceInvitation(spaceId: number) {
  return request<{ settings: TestSpaceSettings; workbench: TestWorkbenchData }>(
    `/api/test-space-invitations/${spaceId}/accept`,
    { method: 'POST' },
  )
}

export function declineTestSpaceInvitation(spaceId: number) {
  return request<TestSpaceSettings>(`/api/test-space-invitations/${spaceId}/decline`, {
    method: 'POST',
  })
}

export function createTestSpaceInviteLink(spaceId: number, payload: {
  accessLevel: 'editor' | 'viewer'
  expiresInMinutes: number
  password?: string
}) {
  return request<TestSpaceInviteLink>(`/api/test-spaces/${spaceId}/invite-link`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function revokeTestSpaceInviteLink(spaceId: number) {
  return request<{ ok: true }>(`/api/test-spaces/${spaceId}/invite-link`, { method: 'DELETE' })
}

export function fetchTestSpaceInviteLinkInfo(token: string) {
  return request<{ passwordRequired: boolean; valid: true }>(
    `/api/test-space-invite-links/${encodeURIComponent(token)}`,
  )
}

export function verifyTestSpaceInviteLink(token: string, password?: string) {
  return request<{ passwordRequired: boolean; valid: true }>(
    `/api/test-space-invite-links/${encodeURIComponent(token)}/verify`,
    { method: 'POST', body: JSON.stringify({ password }) },
  )
}

export function acceptTestSpaceInviteLink(token: string, password?: string) {
  return request<{ settings: TestSpaceSettings; workbench: TestWorkbenchData }>(
    `/api/test-space-invite-links/${encodeURIComponent(token)}/accept`,
    { method: 'POST', body: JSON.stringify({ password }) },
  )
}

export function createTestSubject(spaceId: number, payload: {
  description?: string
  environment?: string
  name: string
  versionLabel?: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/subjects`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTestSubject(spaceId: number, subjectId: number, payload: {
  description?: string
  environment?: string
  name: string
  versionLabel?: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/subjects/${subjectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTestSubject(spaceId: number, subjectId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/subjects/${subjectId}`, {
    method: 'DELETE',
  })
}

export function createTestCaseFolder(spaceId: number, payload: { name: string; testSubjectId: number }) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/folders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTestCaseFolder(spaceId: number, folderId: number, payload: { name: string }) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTestCaseFolder(spaceId: number, folderId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/folders/${folderId}`, {
    method: 'DELETE',
  })
}

export function createTestCase(spaceId: number, payload: {
  caseKind?: TestCaseKind
  caseType: TestCaseType
  customTags?: string[]
  expectedResult: string
  modulePath?: string
  preconditions: string
  priority: Priority
  remarks: string
  steps: string
  testSubjectId: number
  title: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/cases`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTestCase(spaceId: number, caseId: number, payload: Partial<{
  caseKind: TestCaseKind
  caseType: TestCaseType
  customTags: string[]
  expectedResult: string
  modulePath?: string
  preconditions: string
  priority: Priority
  remarks: string
  status: TestCaseStatus
  steps: string
  title: string
}>) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/cases/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTestCase(spaceId: number, caseId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/cases/${caseId}`, {
    method: 'DELETE',
  })
}

export function previewTestCaseImport(spaceId: number, testSubjectId: number, csvText: string) {
  return request<{ preview: TestCaseImportPreview }>(
    `/api/test-spaces/${spaceId}/cases/import?testSubjectId=${testSubjectId}&preview=true`,
    {
      method: 'POST',
      body: csvText,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    },
  )
}

export async function importTestCases(spaceId: number, testSubjectId: number, csvText: string) {
  const result = await request<{ importedCount: number; workbench: TestWorkbenchData }>(
    `/api/test-spaces/${spaceId}/cases/import?testSubjectId=${testSubjectId}`,
    {
      method: 'POST',
      body: csvText,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    },
  )
  return result.workbench
}

export function createTestPlan(spaceId: number, payload: {
  caseIds: number[]
  endsOn?: string
  environment: string
  name: string
  ownerUserId?: number
  projectId?: number
  startsOn?: string
  testSubjectIds: number[]
  versionLabel: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plans`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTestPlanStatus(spaceId: number, planId: number, status: TestPlanStatus) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function updateTestPlan(spaceId: number, planId: number, payload: {
  caseIds: number[]
  endsOn?: string
  environment: string
  name: string
  ownerUserId?: number
  projectId?: number
  startsOn?: string
  testSubjectIds: number[]
  versionLabel: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plans/${planId}/details`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function removeTestPlanCase(spaceId: number, planId: number, planCaseId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plans/${planId}/cases/${planCaseId}`, {
    method: 'DELETE',
  })
}

export function deleteTestPlan(spaceId: number, planId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plans/${planId}`, {
    method: 'DELETE',
  })
}

export function updateTestPlanCase(spaceId: number, planCaseId: number, payload: {
  result: TestResult
  resultNote?: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/plan-cases/${planCaseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function createTestBug(spaceId: number, payload: {
  actualResult: string
  assigneeUserId?: number
  environment: string
  expectedResult: string
  priority: Priority
  reproductionSteps: string
  severity: BugSeverity
  testEnvironmentId?: number | null
  testPlanCaseId?: number
  testPlanId?: number
  testSubjectId: number
  title: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTestBug(spaceId: number, bugId: number, payload: {
  actualResult?: string
  assigneeUserId?: number
  environment?: string
  expectedResult?: string
  priority?: Priority
  reproductionSteps?: string
  severity?: BugSeverity
  status?: BugStatus
  testEnvironmentId?: number | null
  testSubjectId?: number
  title?: string
}) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTestBug(spaceId: number, bugId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}`, {
    method: 'DELETE',
  })
}

export function addTestBugComment(spaceId: number, bugId: number, content: string) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function updateTestBugComment(spaceId: number, bugId: number, commentId: number, content: string) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export function deleteTestBugComment(spaceId: number, bugId: number, commentId: number) {
  return request<TestWorkbenchData>(`/api/test-spaces/${spaceId}/bugs/${bugId}/comments/${commentId}`, {
    method: 'DELETE',
  })
}

export function fetchAssignedTestBugs(organizationId: OrganizationContext) {
  return request<{
    bugs: TestWorkbenchData['bugs']
    departedUserIds: number[]
    members: Array<{ id: number; name: string }>
    organizationId: OrganizationContext
  }>(withOrganizationContext('/api/test-bugs/assigned', organizationId))
}

export function updateAssignedTestBug(organizationId: OrganizationContext, bugId: number, status: BugStatus) {
  return request<{ bugs: TestWorkbenchData['bugs'] }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned`, organizationId), {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function transferAssignedTestBug(
  organizationId: OrganizationContext,
  bugId: number,
  payload: { assigneeUserId: number; reason: string },
) {
  return request<{
    bugs: TestWorkbenchData['bugs']
    members: Array<{ id: number; name: string }>
  }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned/transfer`, organizationId), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function rejectAssignedTestBug(organizationId: OrganizationContext, bugId: number, reason: string) {
  return request<{
    bugs: TestWorkbenchData['bugs']
    members: Array<{ id: number; name: string }>
  }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned/reject`, organizationId), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function addAssignedTestBugComment(organizationId: OrganizationContext, bugId: number, content: string) {
  return request<{ bugs: TestWorkbenchData['bugs']; members: Array<{ id: number; name: string }> }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned/comments`, organizationId), {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function updateAssignedTestBugComment(
  organizationId: OrganizationContext,
  bugId: number,
  commentId: number,
  content: string,
) {
  return request<{ bugs: TestWorkbenchData['bugs']; members: Array<{ id: number; name: string }> }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned/comments/${commentId}`, organizationId), {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export function deleteAssignedTestBugComment(organizationId: OrganizationContext, bugId: number, commentId: number) {
  return request<{ bugs: TestWorkbenchData['bugs']; members: Array<{ id: number; name: string }> }>(withOrganizationContext(`/api/test-bugs/${bugId}/assigned/comments/${commentId}`, organizationId), {
    method: 'DELETE',
  })
}
