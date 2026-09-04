import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsLeftRight,
  Bell,
  Bug,
  Buildings,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Check,
  ClipboardText,
  Clock,
  CopySimple,
  DownloadSimple,
  FileCsv,
  FileText,
  Flask,
  FolderPlus,
  FunnelSimple,
  GearSix,
  ListChecks,
  LinkSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  DotsThreeVertical,
  Trash,
  UploadSimple,
  UserPlus,
  WarningCircle,
  X,
  XCircle,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { JournalDatePicker } from '@/components/journal-date-picker'
import { notificationRefreshIntervalMs } from '@/notifications'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MentionTextarea, type MentionMember } from './mention-textarea'
import {
  WeeklyReportWorkbench,
  type WeeklyReportWorkbenchHandle,
} from './weekly-report-workbench'
import { BugShareDialog } from './bug-share-dialog'
import { UserName } from './user-name'
import {
  BugFilterBuilderDialog,
  type BugFilterOption,
  type BugFilterOptions,
} from './bug-filter-builder-dialog'
import {
  createDefaultBugFilterConditions,
  matchesBugFilterConditions,
  type BugFilterCondition,
  type BugFilterJoin,
} from './bug-filter'
import { uploadWorkbenchAttachment } from '@/api'
import {
  clearBugCommentDraftIfMatches,
  loadBugCommentDraft,
  saveBugCommentDraft,
  subscribeBugCommentDraftChanges,
} from '@/bug-comment-drafts'
import {
  addAssignedTestBugComment,
  addTestBugComment,
  acceptTestSpaceInvitation,
  acceptTestSpaceInviteLink,
  createTestBug,
  createTestCase,
  createTestCaseFolder,
  createTestPlan,
  createTestSpace,
  createTestSpaceInviteLink,
  createTestSubject,
  declineTestSpaceInvitation,
  deleteAssignedTestBugComment,
  deleteTestCase,
  deleteTestCaseFolder,
  deleteTestPlan,
  deleteTestSpace,
  deleteTestSubject,
  deleteTestBug,
  deleteTestBugComment,
  fetchAssignedTestBugs,
  fetchTestSpaceInviteLinkInfo,
  fetchTestSpaceSettings,
  fetchTestWorkbench,
  importTestCases,
  importTestSpaceData,
  inviteTestSpaceMember,
  previewTestCaseImport,
  removeTestPlanCase,
  removeTestSpaceMember,
  rejectAssignedTestBug,
  transferAssignedTestBug,
  transferTestBugToSpace,
  updateTestSpace,
  updateTestSpaceVersion,
  updateAssignedTestBugComment,
  updateAssignedTestBug,
  updateTestBug,
  updateTestBugComment,
  updateTestCase,
  updateTestCaseFolder,
  updateTestPlan,
  updateTestPlanCase,
  updateTestPlanStatus,
  updateTestSpaceMember,
  updateTestSubject,
  verifyTestSpaceInviteLink,
} from '@/test-workbench-api'
import type {
  BugSeverity,
  BugStatus,
  TestBug,
  TestBugComment,
  TestBugEvent,
  TestCase,
  TestCaseFolder,
  TestCaseType,
  TestCaseImportPreview,
  TestPlan,
  TestResult,
  TestSpaceDataImportResult,
  TestSpaceImportCategory,
  TestSpaceImportSource,
  TestSpaceInvitation,
  TestSpaceSettings,
  TestSubject,
  TestEnvironment,
  TestWorkbenchData,
  TestWorkbenchNotification,
  TestWorkbenchProjectOption,
} from '@/test-workbench-types'
import type { OrganizationContext } from '../../shared/organization-context'
import type { Priority } from '@/types'
import './test-workbench.css'

type WorkbenchTab = 'cases' | 'plans' | 'bugs' | 'weekly_report' | 'notifications'

const emptyWorkbench: TestWorkbenchData = {
  bugs: [],
  cases: [],
  departedUserIds: [],
  folders: [],
  notifications: [],
  planCases: [],
  plans: [],
  spaces: [],
  subjects: [],
  testEnvironments: [],
  users: [],
}

const priorityLabel: Record<Priority, string> = { high: '高', low: '低', medium: '中' }
const caseLevelLabel: Record<Priority, 'P0' | 'P1' | 'P2'> = { high: 'P0', low: 'P2', medium: 'P1' }
const caseTypeLabel: Record<TestCaseType, string> = {
  functional: '功能',
  performance: '性能',
  regression: '回归',
  security: '安全',
  smoke: '冒烟',
}
const caseKindLabel: Record<TestCase['caseKind'], string> = {
  baseline: '基线用例',
  functional: '功能用例',
}
const testCaseCsvTemplateHeaders = [
  '用例名称',
  '所属模块',
  '前置条件',
  '步骤描述',
  '预期结果',
  '备注',
  '用例等级',
  '自定义标签',
]
const resultLabel: Record<TestResult, string> = {
  blocked: '阻塞',
  failed: '失败',
  passed: '通过',
  skipped: '跳过',
  untested: '未执行',
}
const planStatusLabel: Record<TestPlan['status'], string> = {
  aborted: '已终止',
  completed: '已完成',
  draft: '草稿',
  in_progress: '执行中',
}
const bugStatusLabel: Record<BugStatus, string> = {
  new: '待确认',
  pending_confirmation: '待确认',
  assigned: '待修复',
  in_progress: '修复中',
  pending_verification: '待验证',
  rejected: '已驳回',
  closed: '已关闭',
}
const bugStatusOptions: Array<[BugStatus, string]> = [
  ['new', '待确认'],
  ['assigned', '待修复'],
  ['in_progress', '修复中'],
  ['pending_verification', '待验证'],
  ['rejected', '已驳回'],
  ['closed', '已关闭'],
]

function visibleBugStatus(status: BugStatus) {
  return status === 'pending_confirmation' ? 'new' : status
}

function selectedBugStatus(bug: TestBug, status: BugStatus) {
  return status === 'new' && bug.assigneeUserId ? 'pending_confirmation' : status
}
const severityLabel: Record<BugSeverity, string> = {
  blocker: '阻断',
  critical: '严重',
  major: '主要',
  minor: '次要',
  trivial: '轻微',
}

function uniqueBugFilterOptions(
  bugs: TestBug[],
  getOption: (bug: TestBug) => BugFilterOption | undefined,
) {
  const options = new Map<string, BugFilterOption>()
  for (const bug of bugs) {
    const option = getOption(bug)
    if (option) options.set(option.value, option)
  }
  return Array.from(options.values()).sort((left, right) => (
    left.label.localeCompare(right.label, 'zh-CN')
  ))
}
const PLAN_EXECUTION_ROW_BLOCK_SIZE = 88
const emptyTestSpaceSettings: TestSpaceSettings = { invitations: [], organizations: [], spaces: [] }
const testSpaceInviteParam = 'testSpaceInvite'
const seenBugCommentStoragePrefix = 'veges.testWorkbench.seenBugComments.v1'
const readNotificationStoragePrefix = 'veges.testWorkbench.readNotifications.v1'
const assignedBugSpaceStoragePrefix = 'veges.assignedBugs.testSpace.v1'

type BugCommentNotification = {
  bug: TestBug
  comment: TestBugComment
  notification: TestWorkbenchNotification
}

type BugReturnNotification = {
  bug: TestBug
  notification: TestWorkbenchNotification
}

type PlanAssignmentNotification = {
  notification: TestWorkbenchNotification
  plan: TestPlan
}

function getTestSpaceInviteTokenFromUrl() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(testSpaceInviteParam)?.trim() ?? ''
}

function clearTestSpaceInviteTokenFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete(testSpaceInviteParam)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function buildTestSpaceInviteUrl(token: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(testSpaceInviteParam, token)
  return url.toString()
}

function getTimestampMs(value?: string) {
  const timestamp = Date.parse(value ?? '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getSeenBugCommentStorageKey(currentUserId?: number) {
  return currentUserId ? `${seenBugCommentStoragePrefix}.${currentUserId}` : ''
}

function readSeenBugCommentIds(currentUserId?: number) {
  const storageKey = getSeenBugCommentStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return new Set<number>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return new Set<number>()
    return new Set(parsed.map((value) => Number(value)).filter(Number.isFinite))
  } catch {
    return new Set<number>()
  }
}

function writeSeenBugCommentIds(currentUserId: number | undefined, ids: Set<number>) {
  const storageKey = getSeenBugCommentStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return
  window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)))
}

function getReadNotificationStorageKey(currentUserId?: number) {
  return currentUserId ? `${readNotificationStoragePrefix}.${currentUserId}` : ''
}

function loadReadNotificationKeys(currentUserId?: number) {
  const storageKey = getReadNotificationStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.map((value) => String(value)).filter(Boolean))
  } catch {
    return new Set<string>()
  }
}

function writeReadNotificationKeys(currentUserId: number | undefined, keys: Set<string>) {
  const storageKey = getReadNotificationStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return
  window.localStorage.setItem(storageKey, JSON.stringify(Array.from(keys)))
}

function getAssignedBugSpaceStorageKey(
  currentUserId: number | undefined,
  organizationId: OrganizationContext,
) {
  const scope = organizationId == null ? 'personal' : String(organizationId)
  return currentUserId
    ? `${assignedBugSpaceStoragePrefix}.${currentUserId}.${scope}`
    : `${assignedBugSpaceStoragePrefix}.${scope}`
}

function readAssignedBugSpaceId(currentUserId: number | undefined, organizationId: OrganizationContext) {
  if (typeof window === 'undefined') return undefined
  const value = Number(window.localStorage.getItem(getAssignedBugSpaceStorageKey(currentUserId, organizationId)))
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

const testWorkbenchViewStatePrefix = 'veges.testWorkbench.viewState.v1'

type TestWorkbenchViewState = {
  selectedBugId?: number
  selectedCaseId?: number
  selectedPlanId?: number
  spaceId?: number
  subjectId?: number
  tab: WorkbenchTab
}

function getTestWorkbenchViewStateStorageKey(currentUserId?: number) {
  return currentUserId ? `${testWorkbenchViewStatePrefix}.${currentUserId}` : ''
}

function readTestWorkbenchViewState(currentUserId?: number): TestWorkbenchViewState | undefined {
  const storageKey = getTestWorkbenchViewStateStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return undefined
    const state = parsed as Partial<TestWorkbenchViewState>
    if (
      !state.tab ||
      !(['cases', 'plans', 'bugs', 'weekly_report', 'notifications'] as WorkbenchTab[]).includes(state.tab)
    ) return undefined
    const positiveNumber = (value: unknown) => (
      typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
    )
    return {
      tab: state.tab,
      spaceId: positiveNumber(state.spaceId),
      subjectId: positiveNumber(state.subjectId),
      selectedCaseId: positiveNumber(state.selectedCaseId),
      selectedPlanId: positiveNumber(state.selectedPlanId),
      selectedBugId: positiveNumber(state.selectedBugId),
    }
  } catch {
    return undefined
  }
}

function writeTestWorkbenchViewState(currentUserId: number | undefined, state: TestWorkbenchViewState) {
  const storageKey = getTestWorkbenchViewStateStorageKey(currentUserId)
  if (typeof window === 'undefined' || !storageKey) return
  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

function getTestWorkbenchNotificationKey(notification: TestWorkbenchNotification) {
  return `${notification.kind}:${notification.sourceId}:${notification.createdAt}`
}

function generateTestSpaceInvitePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const values = globalThis.crypto.getRandomValues(new Uint8Array(10))
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

function formatInviteDuration(minutes: number) {
  if (minutes === 1440) return '24 小时'
  if (minutes === 240) return '4 小时'
  return `${minutes} 分钟`
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

function WorkspaceError({ message }: { message: string }) {
  return message ? <div className="test-workbench-error"><WarningCircle /> {message}</div> : null
}

function TestSpaceSelectLabel({
  name,
  organizationName,
  versionLabel,
}: {
  name: string
  organizationName?: string
  versionLabel?: string
}) {
  const metadata = [organizationName, versionLabel].filter(Boolean).join(' · ')

  return (
    <span className="test-space-select-label">
      <span>{name}</span>
      {metadata ? <small>{metadata}</small> : null}
    </span>
  )
}

type TestSpaceOrganizationGroup = {
  id: string
  name: string
  spaces: TestSpaceSettings['spaces']
}

export function TestWorkbench({
  accountMenu,
  currentUserId,
  projects,
  refreshToken = 0,
}: {
  accountMenu: ReactNode
  currentUserId?: number
  projects: TestWorkbenchProjectOption[]
  refreshToken?: number
}) {
  const [data, setData] = useState<TestWorkbenchData>(emptyWorkbench)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<WorkbenchTab>('cases')
  const [spaceId, setSpaceId] = useState<number>()
  const [subjectId, setSubjectId] = useState<number>()
  const [selectedCaseId, setSelectedCaseId] = useState<number>()
  const [selectedPlanId, setSelectedPlanId] = useState<number>()
  const [selectedBugId, setSelectedBugId] = useState<number>()
  const [bugFilterDialogOpen, setBugFilterDialogOpen] = useState(false)
  const [bugFilterJoin, setBugFilterJoin] = useState<BugFilterJoin>('and')
  const [bugFilterConditions, setBugFilterConditions] = useState<BugFilterCondition[]>([])
  const [bugSearchQuery, setBugSearchQuery] = useState('')
  const [spaceSwitcherOpen, setSpaceSwitcherOpen] = useState(false)
  const [spaceAdministrationOpen, setSpaceAdministrationOpen] = useState(false)
  const [spaceCreateOpen, setSpaceCreateOpen] = useState(false)
  const [spaceSettings, setSpaceSettings] = useState<TestSpaceSettings>(emptyTestSpaceSettings)
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<TestSubject>()
  const [subjectPendingDelete, setSubjectPendingDelete] = useState<TestSubject>()
  const [subjectDeleteDialogOpen, setSubjectDeleteDialogOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [caseDialogOpen, setCaseDialogOpen] = useState(false)
  const [caseImportDialogOpen, setCaseImportDialogOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase>()
  const [casePendingDelete, setCasePendingDelete] = useState<TestCase>()
  const [caseDeleteDialogOpen, setCaseDeleteDialogOpen] = useState(false)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TestPlan>()
  const [planPendingDelete, setPlanPendingDelete] = useState<TestPlan>()
  const [planDeleteDialogOpen, setPlanDeleteDialogOpen] = useState(false)
  const [bugDialogOpen, setBugDialogOpen] = useState(false)
  const [bugSeed, setBugSeed] = useState<Partial<TestBug>>({})
  const [editingBug, setEditingBug] = useState<TestBug>()
  const [bugPendingDelete, setBugPendingDelete] = useState<TestBug>()
  const [bugDeleteDialogOpen, setBugDeleteDialogOpen] = useState(false)
  const [inviteToken, setInviteToken] = useState(getTestSpaceInviteTokenFromUrl)
  const [invitePasswordChecking, setInvitePasswordChecking] = useState(false)
  const [invitePasswordDraft, setInvitePasswordDraft] = useState('')
  const [invitePasswordRequired, setInvitePasswordRequired] = useState(false)
  const [invitePasswordVerified, setInvitePasswordVerified] = useState(false)
  const [invitePasswordError, setInvitePasswordError] = useState('')
  const [seenBugCommentIds, setSeenBugCommentIds] = useState<Set<number>>(() => readSeenBugCommentIds(currentUserId))
  const [readNotificationKeySet, setReadNotificationKeySet] = useState<Set<string>>(() => loadReadNotificationKeys(currentUserId))
  const acceptingInviteTokenRef = useRef('')
  const refreshInFlightRef = useRef(false)
  const viewStateReadyRef = useRef(false)
  const weeklyReportWorkbenchRef = useRef<WeeklyReportWorkbenchHandle>(null)

  useEffect(() => {
    setSeenBugCommentIds(readSeenBugCommentIds(currentUserId))
    setReadNotificationKeySet(loadReadNotificationKeys(currentUserId))
  }, [currentUserId])

  useEffect(() => {
    let cancelled = false
    fetchTestWorkbench()
      .then((result) => {
        if (cancelled) return
        setData(result)
        const saved = readTestWorkbenchViewState(currentUserId)
        const savedSpaceId = saved?.spaceId && result.spaces.some((space) => space.id === saved.spaceId)
          ? saved.spaceId
          : undefined
        setSpaceId(savedSpaceId ?? result.spaces[0]?.id)
        if (saved && savedSpaceId) {
          if (saved.subjectId != null && result.subjects.some((subject) => (
            subject.id === saved.subjectId && subject.testSpaceId === savedSpaceId
          ))) {
            setSubjectId(saved.subjectId)
          }
          if (saved.selectedCaseId != null && result.cases.some((item) => (
            item.id === saved.selectedCaseId && item.testSpaceId === savedSpaceId
          ))) {
            setSelectedCaseId(saved.selectedCaseId)
          }
          if (saved.selectedPlanId != null && result.plans.some((plan) => (
            plan.id === saved.selectedPlanId && plan.testSpaceId === savedSpaceId
          ))) {
            setSelectedPlanId(saved.selectedPlanId)
          }
          if (saved.selectedBugId != null && result.bugs.some((bug) => (
            bug.id === saved.selectedBugId && bug.testSpaceId === savedSpaceId
          ))) {
            setSelectedBugId(saved.selectedBugId)
          }
        }
        setTab(saved?.tab ?? 'cases')
        viewStateReadyRef.current = true
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '测试工作台加载失败。')
        setLoading(false)
      })
    fetchTestSpaceSettings()
      .then((result) => {
        if (cancelled) return
        setSpaceSettings(result)
        if (result.spaces.length === 0 && result.invitations.length > 0) setTab('notifications')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  useEffect(() => {
    if (!viewStateReadyRef.current) return
    writeTestWorkbenchViewState(currentUserId, {
      tab,
      spaceId,
      subjectId,
      selectedCaseId,
      selectedPlanId,
      selectedBugId,
    })
  }, [tab, spaceId, subjectId, selectedCaseId, selectedPlanId, selectedBugId, currentUserId])

  useEffect(() => {
    if (loading) return
    let cancelled = false
    const refreshIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (busy) return
      if (refreshInFlightRef.current) return
      refreshInFlightRef.current = true
      Promise.all([
        fetchTestWorkbench()
          .then((result) => {
            if (!cancelled) setData(result)
          })
          .catch(() => undefined),
        fetchTestSpaceSettings()
          .then((result) => {
            if (!cancelled) setSpaceSettings(result)
          })
          .catch(() => undefined),
      ]).then(() => {
        refreshInFlightRef.current = false
      })
    }
    const interval = window.setInterval(refreshIfVisible, notificationRefreshIntervalMs)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [busy, loading])

  useEffect(() => {
    setInvitePasswordDraft('')
    setInvitePasswordError('')
    setInvitePasswordRequired(false)
    setInvitePasswordVerified(false)
    if (!inviteToken) {
      setInvitePasswordChecking(false)
      return
    }
    let cancelled = false
    setInvitePasswordChecking(true)
    fetchTestSpaceInviteLinkInfo(inviteToken)
      .then((result) => {
        if (cancelled) return
        setInvitePasswordRequired(result.passwordRequired)
        setInvitePasswordVerified(!result.passwordRequired)
      })
      .catch(() => {
        if (cancelled) return
        setError('测试空间邀请链接无效或已失效。')
        setInviteToken('')
        clearTestSpaceInviteTokenFromUrl()
      })
      .finally(() => {
        if (!cancelled) setInvitePasswordChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  useEffect(() => {
    if (!inviteToken || invitePasswordChecking) return
    if (invitePasswordRequired && !invitePasswordVerified) return
    if (acceptingInviteTokenRef.current === inviteToken) return
    acceptingInviteTokenRef.current = inviteToken
    acceptTestSpaceInviteLink(inviteToken, invitePasswordDraft.trim() || undefined)
      .then(({ workbench }) => {
        setData(workbench)
        setError('')
        setInviteToken('')
        clearTestSpaceInviteTokenFromUrl()
        void refreshSpaceSettings()
      })
      .catch(() => {
        setInvitePasswordError('测试空间邀请链接无效、已失效或密码不正确。')
        if (invitePasswordRequired) {
          setInvitePasswordVerified(false)
        } else {
          setInviteToken('')
          clearTestSpaceInviteTokenFromUrl()
        }
      })
      .finally(() => {
        acceptingInviteTokenRef.current = ''
      })
  }, [invitePasswordChecking, invitePasswordDraft, invitePasswordRequired, invitePasswordVerified, inviteToken])

  const activeSpace = data.spaces.find((space) => space.id === spaceId)
  const activeManagedSpace = spaceSettings.spaces.find((space) => space.id === spaceId)
  const activeWeeklyReportOrganizationId = activeManagedSpace?.organizationId ?? null
  const bugVersionOptions = useMemo(() => {
    const organizationId = activeManagedSpace?.organizationId ?? null
    const versions = spaceSettings.spaces
      .filter((space) => (space.organizationId ?? null) === organizationId)
      .map((space) => space.versionLabel?.trim() ?? '')
      .filter(Boolean)
    if (activeSpace?.versionLabel?.trim()) versions.push(activeSpace.versionLabel.trim())
    return Array.from(new Set(versions))
  }, [activeManagedSpace?.organizationId, activeSpace?.versionLabel, spaceSettings.spaces])
  const testSpaceOrganizationGroups = useMemo<TestSpaceOrganizationGroup[]>(() => {
    const visibleSpaceIds = new Set(data.spaces.map((space) => space.id))
    const groups = new Map<string, TestSpaceOrganizationGroup>()

    for (const organization of spaceSettings.organizations) {
      groups.set(`organization:${organization.id}`, {
        id: `organization:${organization.id}`,
        name: organization.name,
        spaces: [],
      })
    }

    for (const space of spaceSettings.spaces) {
      if (!visibleSpaceIds.has(space.id)) continue
      const groupId = space.organizationId
        ? `organization:${space.organizationId}`
        : 'personal'
      const group = groups.get(groupId) ?? {
        id: groupId,
        name: space.organizationName ?? '未归属组织',
        spaces: [],
      }
      group.spaces.push(space)
      groups.set(groupId, group)
    }

    return Array.from(groups.values())
      .filter((group) => group.spaces.length > 0)
      .map((group) => ({
        ...group,
        spaces: [...group.spaces].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
      }))
  }, [data.spaces, spaceSettings.organizations, spaceSettings.spaces])
  const activeSpaceReadOnly = activeSpace?.accessLevel === 'viewer'
  const subjects = data.subjects.filter((subject) => subject.testSpaceId === spaceId)
  const activeSubject = subjects.find((subject) => subject.id === subjectId)
  const spaceCases = data.cases.filter((testCase) => testCase.testSpaceId === spaceId)
  const cases = spaceCases.filter(
    (testCase) => testCase.testSpaceId === spaceId && (!subjectId || testCase.testSubjectId === subjectId),
  )
  const plans = data.plans.filter(
    (plan) => plan.testSpaceId === spaceId,
  )
  const testEnvironments = (data.testEnvironments ?? []).filter((environment) => (
    spaceId != null && environment.testSpaceIds.includes(spaceId)
  ))
  const bugs = data.bugs.filter(
    (bug) => bug.testSpaceId === spaceId,
  )
  const normalizedBugSearchQuery = bugSearchQuery.trim().toLocaleLowerCase('zh-CN')
  const filteredBugs = useMemo(() => bugs.filter((bug) => {
    if (!matchesBugFilterConditions(bug, bugFilterConditions, bugFilterJoin)) return false
    if (!normalizedBugSearchQuery) return true
    return [
      `bug-${bug.id}`,
      bug.title,
      bug.environment,
      bug.testSubjectName,
      bug.testPlanName,
      bug.reporterName,
      bug.assigneeName,
    ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('zh-CN').includes(normalizedBugSearchQuery))
  }), [bugFilterConditions, bugFilterJoin, bugs, normalizedBugSearchQuery])
  const bugFilterOptions = useMemo<BugFilterOptions>(() => ({
    assignees: uniqueBugFilterOptions(bugs, (bug) => bug.assigneeUserId && bug.assigneeName
      ? { label: bug.assigneeName, value: String(bug.assigneeUserId) }
      : undefined),
    plans: uniqueBugFilterOptions(bugs, (bug) => bug.testPlanId && bug.testPlanName
      ? { label: bug.testPlanName, value: String(bug.testPlanId) }
      : undefined),
    reporters: uniqueBugFilterOptions(bugs, (bug) => bug.reporterUserId && bug.reporterName
      ? { label: bug.reporterName, value: String(bug.reporterUserId) }
      : undefined),
    spaces: [],
    subjects: uniqueBugFilterOptions(bugs, (bug) => bug.testSubjectId && bug.testSubjectName
      ? { label: bug.testSubjectName, value: String(bug.testSubjectId) }
      : undefined),
  }), [bugs])
  const returnedBugs: BugReturnNotification[] = data.notifications.flatMap((notification) => {
    if (notification.kind !== 'test_bug_status_changed') return []
    const bug = data.bugs.find((candidate) => candidate.id === notification.sourceId)
    if (!bug || (bug.status !== 'pending_verification' && bug.status !== 'pending_confirmation')) return []
    return [{ bug, notification }]
  })
  const rejectedBugNotifications: BugReturnNotification[] = data.notifications.flatMap((notification) => {
    if (notification.kind !== 'test_bug_rejected') return []
    const bug = data.bugs.find((candidate) => candidate.id === notification.sourceId)
    if (!bug || bug.status !== 'rejected') return []
    return [{ bug, notification }]
  })
  const bugCommentNotifications: BugCommentNotification[] = data.notifications.flatMap((notification) => {
    if (notification.kind !== 'test_bug_comment_added') return []
    for (const bug of data.bugs) {
      const comment = bug.comments.find((candidate) => candidate.id === notification.sourceId)
      if (!comment) continue
      if (bug.status === 'closed' || bug.status === 'rejected') return []
      return [{ bug, comment, notification }]
    }
    return []
  })
  const planAssignmentNotifications: PlanAssignmentNotification[] = currentUserId
    ? data.notifications.flatMap((notification) => {
      if (notification.kind !== 'test_plan_assigned') return []
      const plan = data.plans.find((candidate) => candidate.id === notification.sourceId)
      if (
        !plan ||
        plan.ownerUserId !== currentUserId ||
        plan.createdByUserId === currentUserId ||
        plan.status === 'completed' ||
        plan.status === 'aborted'
      ) return []
      return [{ notification, plan }]
    })
    : []
  const packageEventCommentNotifications = data.notifications.filter(
    (notification) => notification.kind === 'package_event_comment_added',
  )
  const returnedBugUnreadCount = returnedBugs.filter(({ notification }) =>
    !readNotificationKeySet.has(getTestWorkbenchNotificationKey(notification)),
  ).length
  const rejectedBugUnreadCount = rejectedBugNotifications.filter(({ notification }) =>
    !readNotificationKeySet.has(getTestWorkbenchNotificationKey(notification)),
  ).length
  const planAssignmentUnreadCount = planAssignmentNotifications.filter(({ notification }) =>
    !readNotificationKeySet.has(getTestWorkbenchNotificationKey(notification)),
  ).length
  const bugCommentUnreadCount = bugCommentNotifications.filter(({ comment }) => !seenBugCommentIds.has(comment.id)).length
  const packageEventCommentUnreadCount = packageEventCommentNotifications.filter((notification) =>
    !readNotificationKeySet.has(getTestWorkbenchNotificationKey(notification)),
  ).length
  const notificationUnreadCount =
    spaceSettings.invitations.length +
    returnedBugUnreadCount +
    rejectedBugUnreadCount +
    bugCommentUnreadCount +
    planAssignmentUnreadCount +
    packageEventCommentUnreadCount

  function markBugCommentAsSeen(commentId?: number) {
    if (!commentId || !currentUserId) return
    setSeenBugCommentIds((current) => {
      if (current.has(commentId)) return current
      const next = new Set(current)
      next.add(commentId)
      writeSeenBugCommentIds(currentUserId, next)
      return next
    })
  }

  function markNotificationAsRead(key?: string) {
    if (!key || !currentUserId) return
    setReadNotificationKeySet((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      writeReadNotificationKeys(currentUserId, next)
      return next
    })
  }

  useEffect(() => {
    if (!spaceId || !data.spaces.some((space) => space.id === spaceId)) {
      setSpaceId(data.spaces[0]?.id)
      return
    }
    if (!subjectId || !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId(subjects[0]?.id)
    }
  }, [data.spaces, spaceId, subjectId, subjects])

  useEffect(() => {
    if (!cases.some((item) => item.id === selectedCaseId)) setSelectedCaseId(cases[0]?.id)
    if (!plans.some((item) => item.id === selectedPlanId)) setSelectedPlanId(plans[0]?.id)
    if (!filteredBugs.some((item) => item.id === selectedBugId)) setSelectedBugId(filteredBugs[0]?.id)
  }, [bugs, cases, filteredBugs, plans, selectedBugId, selectedCaseId, selectedPlanId])

  useEffect(() => {
    if (subjectDeleteDialogOpen || !subjectPendingDelete) return
    const cleanup = window.setTimeout(() => {
      setSubjectPendingDelete(undefined)
    }, 180)
    return () => window.clearTimeout(cleanup)
  }, [subjectDeleteDialogOpen, subjectPendingDelete])

  useEffect(() => {
    if (caseDeleteDialogOpen || !casePendingDelete) return
    const cleanup = window.setTimeout(() => {
      setCasePendingDelete(undefined)
    }, 180)
    return () => window.clearTimeout(cleanup)
  }, [caseDeleteDialogOpen, casePendingDelete])

  useEffect(() => {
    if (planDeleteDialogOpen || !planPendingDelete) return
    const cleanup = window.setTimeout(() => {
      setPlanPendingDelete(undefined)
    }, 180)
    return () => window.clearTimeout(cleanup)
  }, [planDeleteDialogOpen, planPendingDelete])

  async function mutate(operation: () => Promise<TestWorkbenchData>) {
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      setData(result)
      return true
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '保存失败，请稍后重试。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function refreshSpaceSettings() {
    try {
      const result = await fetchTestSpaceSettings()
      setSpaceSettings(result)
      return result
    } catch {
      return undefined
    }
  }

  async function refreshWorkbench(preferredSpaceId?: number) {
    const result = await fetchTestWorkbench()
    setData(result)
    setSpaceId((current) => {
      if (preferredSpaceId && result.spaces.some((space) => space.id === preferredSpaceId)) return preferredSpaceId
      if (current && result.spaces.some((space) => space.id === current)) return current
      return result.spaces[0]?.id
    })
    return result
  }

  async function selectTestSpace(nextSpaceId: number) {
    if (nextSpaceId === spaceId) return
    const nextSpace = spaceSettings.spaces.find((space) => space.id === nextSpaceId)
    if (!nextSpace) return
    const nextOrganizationId = nextSpace.organizationId ?? null
    if (tab === 'weekly_report' && activeWeeklyReportOrganizationId !== nextOrganizationId) {
      const prepared = await weeklyReportWorkbenchRef.current?.prepareOrganizationChange() ?? true
      if (!prepared) return
    }
    setSpaceId(nextSpaceId)
  }

  async function handleCreateSpace(name: string, versionLabel: string, organizationId?: number) {
    const normalizedName = name.trim()
    const normalizedVersion = versionLabel.trim()
    if (!normalizedName || !normalizedVersion || organizationId == null) return false
    setBusy(true)
    setError('')
    try {
      const result = await createTestSpace(normalizedName, normalizedVersion, organizationId)
      const createdSpace = result.spaces.find((space) => space.name === normalizedName) ?? result.spaces[0]
      setData(result)
      setSpaceId(createdSpace?.id)
      setTab('cases')
      setSpaceCreateOpen(false)
      await refreshSpaceSettings()
      return true
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : '测试空间创建失败。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAcceptInvitation(invitationSpaceId: number) {
    setBusy(true)
    setError('')
    try {
      const result = await acceptTestSpaceInvitation(invitationSpaceId)
      setSpaceSettings(result.settings)
      setData(result.workbench)
      setSpaceId(invitationSpaceId)
      setTab('cases')
      return true
    } catch (invitationError) {
      setError(invitationError instanceof Error ? invitationError.message : '邀请处理失败。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDeclineInvitation(invitationSpaceId: number) {
    setBusy(true)
    setError('')
    try {
      const result = await declineTestSpaceInvitation(invitationSpaceId)
      setSpaceSettings(result)
      return true
    } catch (invitationError) {
      setError(invitationError instanceof Error ? invitationError.message : '邀请处理失败。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function verifyInvitePassword() {
    const password = invitePasswordDraft.trim()
    if (!inviteToken || !password) return
    setInvitePasswordChecking(true)
    setInvitePasswordError('')
    try {
      await verifyTestSpaceInviteLink(inviteToken, password)
      setInvitePasswordVerified(true)
    } catch {
      setInvitePasswordError('邀请密码不正确，请检查后重试。')
    } finally {
      setInvitePasswordChecking(false)
    }
  }

  return (
    <main className="test-workbench-shell">
      <aside className="test-workbench-nav">
        <div className="test-workbench-space-header">
          <div className="brand-block">
            <img className="brand-mark" src="/favicon.svg" alt="Veges" />
            <div>
              <p className="eyebrow">Veges</p>
              <h1>测试工作台</h1>
            </div>
          </div>
          <button
            className="sidebar-notifications-button"
            type="button"
            aria-label="通知中心"
            title="通知中心"
            onClick={() => setTab('notifications')}
          >
            <Bell size={18} weight="duotone" />
            {notificationUnreadCount > 0 ? <span className="sidebar-notifications-dot" aria-hidden /> : null}
          </button>
        </div>
        <div className="test-space-switcher">
          <DropdownMenu
            open={spaceSwitcherOpen}
            onOpenChange={setSpaceSwitcherOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button className="test-space-cascade-trigger" type="button" variant="outline" aria-label="选择测试空间">
                <TestSpaceSelectLabel
                  name={activeSpace?.name ?? '选择测试空间'}
                  organizationName={activeManagedSpace?.organizationName ?? (activeManagedSpace ? '未归属组织' : undefined)}
                  versionLabel={activeManagedSpace?.versionLabel ?? activeSpace?.versionLabel}
                />
                <CaretDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="test-space-cascade-content">
              {testSpaceOrganizationGroups.map((group) => (
                <DropdownMenuSub key={group.id}>
                  <DropdownMenuSubTrigger className="test-space-organization-item">
                    <Buildings aria-hidden />
                    <span>{group.name}</span>
                    <small>{group.spaces.length}</small>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="test-space-cascade-space-content">
                    {group.spaces.map((space) => (
                      <DropdownMenuItem
                        key={space.id}
                        className="test-space-cascade-space-item"
                        onSelect={() => void selectTestSpace(space.id)}
                      >
                        {space.id === spaceId ? <Check aria-hidden /> : <span className="test-space-select-check-placeholder" />}
                        <TestSpaceSelectLabel
                          name={space.name}
                          organizationName={group.name}
                          versionLabel={space.versionLabel}
                        />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
              {testSpaceOrganizationGroups.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                onSelect={() => {
                  setSpaceSwitcherOpen(false)
                  setSpaceCreateOpen(true)
                }}
              >
                <Plus aria-hidden />
                新建测试空间
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setSpaceSwitcherOpen(false)
                  setSpaceAdministrationOpen(true)
                }}
              >
                <GearSix aria-hidden />
                管理测试空间
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
          <div className="test-workbench-nav-main">
            <nav className="test-workbench-nav-actions" aria-label="测试工作台模块">
              <button className={tab === 'cases' ? 'active' : ''} onClick={() => setTab('cases')}><ClipboardText /><span className="test-nav-label">用例管理</span><span className="test-nav-count">{cases.length}</span></button>
              <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}><ListChecks /><span className="test-nav-label">测试计划</span><span className="test-nav-count">{plans.length}</span></button>
              <button className={tab === 'bugs' ? 'active' : ''} onClick={() => setTab('bugs')}><Bug /><span className="test-nav-label">Bug 追踪</span><span className="test-nav-count">{bugs.length}</span></button>
              <button className={tab === 'weekly_report' ? 'active' : ''} onClick={() => setTab('weekly_report')}><FileText /><span className="test-nav-label">周报管理</span><span className="test-nav-count" /></button>
            </nav>
            {activeSpace && tab === 'cases' ? (
              <section className="test-subject-browser" aria-label="测试对象">
                <header className="test-subject-browser-header">
                  <span>测试对象</span>
                  {!activeSpaceReadOnly ? <Button className="test-subject-add" size="icon" variant="ghost" aria-label="新建测试对象" title="新建测试对象" onClick={() => { setEditingSubject(undefined); setSubjectDialogOpen(true) }}><Plus /></Button> : null}
                </header>
                <div className="test-subject-list">
                  {subjects.length ? subjects.map((subject) => (
                    <article key={subject.id} className={subject.id === subjectId ? 'active' : ''}>
                      <button
                        type="button"
                        className="test-subject-select"
                        aria-current={subject.id === subjectId ? 'true' : undefined}
                        onClick={() => setSubjectId(subject.id)}
                      >
                        <strong>{subject.name}</strong>
                        <small>{[subject.versionLabel, subject.environment].filter(Boolean).join(' / ') || '未设置版本与环境'}</small>
                      </button>
                      {!activeSpaceReadOnly && (subject.canEdit || subject.canDelete) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="test-subject-menu-trigger"
                              size="icon"
                              type="button"
                              variant="ghost"
                              aria-label={`测试对象 ${subject.name} 更多操作`}
                              title="更多操作"
                            >
                              <DotsThreeVertical aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="test-subject-menu-content" sideOffset={8}>
                            {subject.canEdit ? (
                              <DropdownMenuItem
                                className="test-subject-menu-item"
                                onSelect={() => { setEditingSubject(subject); setSubjectDialogOpen(true) }}
                              >
                                <PencilSimple />
                                编辑
                              </DropdownMenuItem>
                            ) : null}
                            {subject.canEdit && subject.canDelete ? <DropdownMenuSeparator /> : null}
                            {subject.canDelete ? (
                              <DropdownMenuItem
                                className="test-subject-menu-item"
                                variant="destructive"
                                onSelect={() => {
                                  setSubjectPendingDelete(subject)
                                  setSubjectDeleteDialogOpen(true)
                                }}
                              >
                                <Trash />
                                删除
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </article>
                  )) : <p className="test-subject-list-empty">暂无测试对象</p>}
                </div>
              </section>
            ) : null}
          </div>
          <div className="test-workbench-account">{accountMenu}</div>
      </aside>

      <section className="test-workbench-content">
          {loading ? (
            <div className="test-workbench-loading">正在加载测试工作台...</div>
          ) : tab === 'weekly_report' ? (
            <div className="test-workbench-weekly-report">
              <WeeklyReportWorkbench
                ref={weeklyReportWorkbenchRef}
                embedded
                organizationId={activeWeeklyReportOrganizationId}
                refreshToken={refreshToken}
              />
            </div>
          ) : tab === 'notifications' ? (
            <>
              <WorkspaceError message={error} />
              <NotificationsView
                busy={busy}
                data={data}
                bugCommentNotifications={bugCommentNotifications}
                invitations={spaceSettings.invitations}
                planAssignmentNotifications={planAssignmentNotifications}
                readNotificationKeys={readNotificationKeySet}
                rejectedBugNotifications={rejectedBugNotifications}
                returnedBugs={returnedBugs}
                seenBugCommentIds={seenBugCommentIds}
                onAcceptInvitation={(invitation) => void handleAcceptInvitation(invitation.spaceId)}
                onDeclineInvitation={(invitation) => void handleDeclineInvitation(invitation.spaceId)}
                onOpenBug={(bug, notification, commentId) => {
                  markNotificationAsRead(getTestWorkbenchNotificationKey(notification))
                  markBugCommentAsSeen(commentId)
                  setSpaceId(bug.testSpaceId)
                  setSubjectId(bug.testSubjectId)
                  setSelectedBugId(bug.id)
                  setTab('bugs')
                }}
                onOpenPlan={(plan, notification) => {
                  markNotificationAsRead(getTestWorkbenchNotificationKey(notification))
                  setSpaceId(plan.testSpaceId)
                  setSelectedPlanId(plan.id)
                  setTab('plans')
                }}
                onMarkNotificationRead={(notification) => markNotificationAsRead(getTestWorkbenchNotificationKey(notification))}
              />
            </>
          ) : data.spaces.length === 0 ? (
            <div className="test-workbench-empty">
              <Flask size={34} weight="duotone" />
              <h1>建立第一个测试空间</h1>
              <p>测试空间用于隔离测试对象、用例、计划和 Bug，不依赖现有项目。</p>
              <div className="test-empty-actions">
                <Button onClick={() => setSpaceCreateOpen(true)}><Plus /> 新增测试空间</Button>
              </div>
              <WorkspaceError message={error} />
            </div>
          ) : tab === 'cases' && !activeSubject ? (
            <div className="test-inline-empty">
              <WorkspaceError message={error} />
              <Flask size={30} />
              <h2>{activeSpaceReadOnly ? '暂无测试对象' : '先创建测试对象'}</h2>
              <p>{activeSpaceReadOnly ? '当前测试空间还没有测试对象。' : '测试对象可以是应用、服务或产品，也可以选择性关联现有项目。'}</p>
              {!activeSpaceReadOnly ? <div className="test-empty-actions">
                <Button onClick={() => { setEditingSubject(undefined); setSubjectDialogOpen(true) }}><Plus /> 新建测试对象</Button>
              </div> : null}
            </div>
          ) : tab === 'cases' ? (
            <>
              <WorkspaceError message={error} />
              <CasesView
                key={subjectId}
                cases={cases}
                data={data}
                readOnly={activeSpaceReadOnly}
                selectedId={selectedCaseId}
                onSelect={setSelectedCaseId}
                onCreate={() => { setEditingCase(undefined); setCaseDialogOpen(true) }}
                onCreateFolder={() => setFolderDialogOpen(true)}
                onDelete={(testCase) => {
                  setCasePendingDelete(testCase)
                  setCaseDeleteDialogOpen(true)
                }}
                onEdit={(testCase) => { setEditingCase(testCase); setCaseDialogOpen(true) }}
                onExport={() => downloadTestCaseCsv(cases, data.folders)}
                onImport={() => setCaseImportDialogOpen(true)}
                onArchive={(testCase) => void mutate(() => updateTestCase(testCase.testSpaceId, testCase.id, { caseKind: 'baseline', status: 'active' }))}
              />
            </>
          ) : tab === 'plans' ? (
            <>
              <WorkspaceError message={error} />
              <PlansView
                busy={busy}
                data={data}
                plans={plans}
                projects={projects}
                readOnly={activeSpaceReadOnly}
                selectedId={selectedPlanId}
                onSelect={setSelectedPlanId}
                onCreate={() => { setEditingPlan(undefined); setPlanDialogOpen(true) }}
                onDelete={(plan) => {
                  setPlanPendingDelete(plan)
                  setPlanDeleteDialogOpen(true)
                }}
                onEdit={(plan) => { setEditingPlan(plan); setPlanDialogOpen(true) }}
                onRemoveCase={(plan, planCaseId) => void mutate(() => removeTestPlanCase(plan.testSpaceId, plan.id, planCaseId))}
                onStatus={(plan, status) => void mutate(() => updateTestPlanStatus(plan.testSpaceId, plan.id, status))}
                onResult={(planCaseId, result) => void mutate(() => updateTestPlanCase(spaceId!, planCaseId, { result }))}
                onCreateBug={(plan, planCase) => {
                  setEditingBug(undefined)
                  setBugSeed({
                    actualResult: planCase.resultNote,
                    environment: plan.environment,
                    expectedResult: planCase.snapshotExpectedResult,
                    reproductionSteps: planCase.snapshotSteps,
                    testPlanCaseId: planCase.id,
                    testPlanId: plan.id,
                    testSubjectId: planCase.testSubjectId ?? plan.testSubjectId,
                    title: planCase.snapshotTitle,
                  })
                  setBugDialogOpen(true)
                }}
              />
            </>
          ) : (
            <>
              <WorkspaceError message={error} />
              <BugsView
                bugs={filteredBugs}
                busy={busy}
                data={data}
                versionOptions={bugVersionOptions}
                draftOwnerUserId={currentUserId}
                filterConditions={bugFilterConditions}
                onFilterOpenChange={setBugFilterDialogOpen}
                onFilterClear={() => setBugFilterConditions([])}
                searchQuery={bugSearchQuery}
                onSearchQueryChange={setBugSearchQuery}
                readOnly={activeSpaceReadOnly}
                selectedId={selectedBugId}
                onSelect={setSelectedBugId}
                onCreate={() => { setEditingBug(undefined); setBugSeed({ testSubjectId: subjectId }); setBugDialogOpen(true) }}
                onEdit={(bug) => { setEditingBug(bug); setBugSeed(bug); setBugDialogOpen(true) }}
                onDelete={(bug) => {
                  setBugPendingDelete(bug)
                  setBugDeleteDialogOpen(true)
                }}
                onStatus={(bug, status) => void mutate(() => updateTestBug(bug.testSpaceId, bug.id, { assigneeUserId: bug.assigneeUserId, status }))}
                onTransferSpace={(bug, targetSpaceId) => mutate(() => transferTestBugToSpace(bug.testSpaceId, bug.id, targetSpaceId))}
                onAssignee={(bug, assigneeUserId) => void mutate(() => updateTestBug(bug.testSpaceId, bug.id, { assigneeUserId, status: assigneeUserId ? 'pending_confirmation' : 'new' }))}
                onComment={(bug, content) => mutate(() => addTestBugComment(bug.testSpaceId, bug.id, content))}
                onUpdateComment={(bug, comment, content) => mutate(() => updateTestBugComment(bug.testSpaceId, bug.id, comment.id, content))}
                onDeleteComment={(bug, comment) => mutate(() => deleteTestBugComment(bug.testSpaceId, bug.id, comment.id))}
                onUpdateSpaceVersion={(bug, versionLabel) => mutate(() => updateTestSpaceVersion(bug.testSpaceId, versionLabel))}
              />
            </>
          )}
      </section>

      <TestSpaceSettingsDialog
        currentSpaceId={spaceId}
        open={spaceAdministrationOpen}
        onOpenChange={setSpaceAdministrationOpen}
        onCreateSpace={() => {
          setSpaceAdministrationOpen(false)
          setSpaceCreateOpen(true)
        }}
        onWorkbenchChange={async () => {
          await refreshWorkbench()
          await refreshSpaceSettings()
        }}
      />
      <BugFilterBuilderDialog
        conditions={bugFilterConditions}
        includeTestSpace={false}
        join={bugFilterJoin}
        open={bugFilterDialogOpen}
        options={bugFilterOptions}
        onOpenChange={setBugFilterDialogOpen}
        onApply={(next) => {
          setBugFilterConditions(next.conditions)
          setBugFilterJoin(next.join)
        }}
      />
      <TestSpaceCreateDialog
        busy={busy}
        organizations={spaceSettings.organizations}
        open={spaceCreateOpen}
        onOpenChange={setSpaceCreateOpen}
        onSubmit={handleCreateSpace}
      />
      <TestSpaceInvitePasswordDialog
        busy={invitePasswordChecking}
        error={invitePasswordError}
        open={Boolean(inviteToken && invitePasswordRequired && !invitePasswordVerified)}
        password={invitePasswordDraft}
        onCancel={() => {
          setInviteToken('')
          setInvitePasswordError('')
          clearTestSpaceInviteTokenFromUrl()
        }}
        onPasswordChange={(value) => {
          setInvitePasswordDraft(value)
          setInvitePasswordError('')
        }}
        onSubmit={() => void verifyInvitePassword()}
      />
      <SubjectDialog
        busy={busy}
        open={subjectDialogOpen}
        subject={editingSubject}
        onOpenChange={(nextOpen) => {
          setSubjectDialogOpen(nextOpen)
          if (!nextOpen) setEditingSubject(undefined)
        }}
        onSubmit={async (payload) => {
          const saved = editingSubject
            ? await mutate(() => updateTestSubject(spaceId!, editingSubject.id, payload))
            : await mutate(() => createTestSubject(spaceId!, payload))
          if (saved) setEditingSubject(undefined)
          return saved
        }}
      />
      <Dialog
        open={subjectDeleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setSubjectDeleteDialogOpen(nextOpen)
        }}
      >
        <DialogContent fixedHeader className="test-workbench-dialog">
          <DialogHeader>
            <DialogTitle>删除测试对象</DialogTitle>
            <DialogDescription>
              删除“{subjectPendingDelete?.name}”后，其用例、测试计划、Bug 和评论也会永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubjectDeleteDialogOpen(false)}>取消</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !subjectPendingDelete}
              onClick={async () => {
                if (!subjectPendingDelete) return
                const saved = await mutate(() => deleteTestSubject(subjectPendingDelete.testSpaceId, subjectPendingDelete.id))
                if (saved) setSubjectDeleteDialogOpen(false)
              }}
            ><Trash /> 删除测试对象</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FolderDialog
        busy={busy}
        cases={data.cases.filter((item) => item.testSpaceId === spaceId && item.testSubjectId === subjectId)}
        folders={data.folders.filter((folder) => folder.testSpaceId === spaceId && folder.testSubjectId === subjectId)}
        open={folderDialogOpen}
        subject={data.subjects.find((candidate) => candidate.id === subjectId)}
        onCreate={async (name) => mutate(() => createTestCaseFolder(spaceId!, { name, testSubjectId: subjectId! }))}
        onDelete={async (folder) => mutate(() => deleteTestCaseFolder(spaceId!, folder.id))}
        onOpenChange={setFolderDialogOpen}
        onRename={async (folder, name) => mutate(() => updateTestCaseFolder(spaceId!, folder.id, { name }))}
      />
      <CaseDialog
        busy={busy}
        data={data}
        open={caseDialogOpen}
        testCase={editingCase}
        subjectId={subjectId}
        spaceId={spaceId}
        onOpenChange={setCaseDialogOpen}
        onSubmit={async (payload) => {
          const saved = editingCase
            ? await mutate(() => updateTestCase(editingCase.testSpaceId, editingCase.id, payload))
            : await mutate(() => createTestCase(spaceId!, payload))
          if (saved) setCaseDialogOpen(false)
        }}
      />
      <Dialog open={caseDeleteDialogOpen} onOpenChange={setCaseDeleteDialogOpen}>
        <DialogContent fixedHeader className="test-workbench-dialog">
          <DialogHeader>
            <DialogTitle>删除测试用例</DialogTitle>
            <DialogDescription>
              删除“{casePendingDelete?.title}”后，源用例将永久移除；已加入测试计划的执行快照继续保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCaseDeleteDialogOpen(false)}>取消</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !casePendingDelete}
              onClick={async () => {
                if (!casePendingDelete) return
                const saved = await mutate(() => deleteTestCase(casePendingDelete.testSpaceId, casePendingDelete.id))
                if (saved) setCaseDeleteDialogOpen(false)
              }}
            ><Trash /> 删除测试用例</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportCasesDialog
        busy={busy}
        open={caseImportDialogOpen}
        spaceId={spaceId}
        subject={activeSubject}
        onOpenChange={setCaseImportDialogOpen}
        onSubmit={(csvText) => mutate(() => importTestCases(spaceId!, subjectId!, csvText))}
      />
      <PlanDialog
        key={`${planDialogOpen}-${editingPlan?.id ?? 'new'}`}
        busy={busy}
        cases={spaceCases}
        folders={data.folders}
        open={planDialogOpen}
        plan={editingPlan}
        planCases={data.planCases}
        projects={projects}
        subjects={subjects}
        users={data.users}
        onOpenChange={setPlanDialogOpen}
        onSubmit={async (payload) => {
          const saved = editingPlan
            ? await mutate(() => updateTestPlan(editingPlan.testSpaceId, editingPlan.id, payload))
            : await mutate(() => createTestPlan(spaceId!, payload))
          if (saved) setPlanDialogOpen(false)
        }}
      />
      <Dialog open={planDeleteDialogOpen} onOpenChange={setPlanDeleteDialogOpen}>
        <DialogContent fixedHeader className="test-workbench-dialog">
          <DialogHeader>
            <DialogTitle>删除测试计划</DialogTitle>
            <DialogDescription>
              删除“{planPendingDelete?.name}”后，执行快照将永久删除；已经创建的 Bug 会保留，但不再关联该计划。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanDeleteDialogOpen(false)}>取消</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !planPendingDelete}
              onClick={async () => {
                if (!planPendingDelete) return
                const saved = await mutate(() => deleteTestPlan(planPendingDelete.testSpaceId, planPendingDelete.id))
                if (saved) setPlanDeleteDialogOpen(false)
              }}
            ><Trash /> 删除测试计划</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BugDialog
        busy={busy}
        editing={Boolean(editingBug)}
        environments={testEnvironments}
        open={bugDialogOpen}
        seed={bugSeed}
        subjects={subjects}
        users={data.users}
        onOpenChange={(open) => {
          setBugDialogOpen(open)
          if (!open) setEditingBug(undefined)
        }}
        onSubmit={async (payload) => {
          const saved = editingBug
            ? await mutate(() => updateTestBug(editingBug.testSpaceId, editingBug.id, payload))
            : await mutate(() => createTestBug(spaceId!, payload))
          if (saved) {
            setBugDialogOpen(false)
            setEditingBug(undefined)
            if (!editingBug) setTab('bugs')
          }
        }}
      />
      <Dialog open={bugDeleteDialogOpen} onOpenChange={setBugDeleteDialogOpen}>
        <DialogContent fixedHeader className="test-workbench-dialog">
          <DialogHeader>
            <DialogTitle>删除 Bug</DialogTitle>
            <DialogDescription>
              删除“{bugPendingDelete?.title}”后，Bug 的评论、分享链接和时间线都会永久删除，无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBugDeleteDialogOpen(false)}>取消</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !bugPendingDelete}
              onClick={async () => {
                if (!bugPendingDelete) return
                const saved = await mutate(() => deleteTestBug(bugPendingDelete.testSpaceId, bugPendingDelete.id))
                if (saved) {
                  setBugDeleteDialogOpen(false)
                  setBugPendingDelete(undefined)
                }
              }}
            ><Trash /> 删除 Bug</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function NotificationsView({
  bugCommentNotifications,
  busy,
  data,
  invitations,
  onAcceptInvitation,
  onDeclineInvitation,
  onOpenBug,
  onOpenPlan,
  onMarkNotificationRead,
  planAssignmentNotifications,
  readNotificationKeys,
  rejectedBugNotifications,
  returnedBugs,
  seenBugCommentIds,
}: {
  bugCommentNotifications: BugCommentNotification[]
  busy: boolean
  data: TestWorkbenchData
  invitations: TestSpaceInvitation[]
  onAcceptInvitation: (invitation: TestSpaceInvitation) => void
  onDeclineInvitation: (invitation: TestSpaceInvitation) => void
  onOpenBug: (bug: TestBug, notification: TestWorkbenchNotification, commentId?: number) => void
  onOpenPlan: (plan: TestPlan, notification: TestWorkbenchNotification) => void
  onMarkNotificationRead: (notification: TestWorkbenchNotification) => void
  planAssignmentNotifications: PlanAssignmentNotification[]
  readNotificationKeys: Set<string>
  rejectedBugNotifications: BugReturnNotification[]
  returnedBugs: BugReturnNotification[]
  seenBugCommentIds: Set<number>
}) {
  const notificationItems = [
    ...invitations.map((invitation) => ({
      createdAt: invitation.createdAt,
      invitation,
      key: `invitation-${invitation.spaceId}`,
      kind: 'invitation' as const,
      sortAt: Date.parse(invitation.createdAt),
    })),
    ...returnedBugs.map(({ bug, notification }) => ({
      bug,
      createdAt: notification.createdAt,
      key: `bug-${bug.id}`,
      kind: 'bug_return' as const,
      notification,
      notificationKey: getTestWorkbenchNotificationKey(notification),
      sortAt: Date.parse(notification.createdAt),
    })),
    ...rejectedBugNotifications.map(({ bug, notification }) => ({
      bug,
      createdAt: notification.createdAt,
      key: `bug-rejected-${bug.id}`,
      kind: 'bug_rejected' as const,
      notification,
      notificationKey: getTestWorkbenchNotificationKey(notification),
      sortAt: Date.parse(notification.createdAt),
    })),
    ...bugCommentNotifications.map(({ bug, comment, notification }) => ({
      bug,
      comment,
      createdAt: notification.createdAt,
      key: `bug-comment-${comment.id}`,
      kind: 'bug_comment' as const,
      notification,
      notificationKey: getTestWorkbenchNotificationKey(notification),
      sortAt: getTimestampMs(notification.createdAt),
    })),
    ...planAssignmentNotifications.map(({ notification, plan }) => ({
      createdAt: notification.createdAt,
      key: `plan-assignment-${plan.id}`,
      kind: 'plan_assignment' as const,
      notification,
      notificationKey: getTestWorkbenchNotificationKey(notification),
      plan,
      sortAt: getTimestampMs(notification.createdAt),
    })),
    ...data.notifications
      .filter((notification) => notification.kind === 'package_event_comment_added')
      .map((notification) => ({
        createdAt: notification.createdAt,
        key: `package-comment-${notification.sourceId}`,
        kind: 'package_comment' as const,
        notification,
        notificationKey: getTestWorkbenchNotificationKey(notification),
        sortAt: getTimestampMs(notification.createdAt),
      })),
  ].sort((left, right) => {
    const rightTime = Number.isNaN(right.sortAt) ? 0 : right.sortAt
    const leftTime = Number.isNaN(left.sortAt) ? 0 : left.sortAt
    return rightTime - leftTime
  })
  const unreadCount = notificationItems.filter((item) => {
    if (item.kind === 'invitation') return true
    if (item.kind === 'bug_comment') return !seenBugCommentIds.has(item.comment.id)
    return !readNotificationKeys.has(item.notificationKey)
  }).length
  const readCount = Math.max(0, notificationItems.length - unreadCount)

  return (
    <div className="test-module-view test-notifications-view">
      <div className="test-module-toolbar">
        <div>
          <span>协作消息</span>
          <h1>通知中心</h1>
        </div>
      </div>
      <section className="test-notification-board">
        {notificationItems.length ? (
          <>
          <header>
            <div>
              <strong>待处理通知</strong>
              <small>测试空间邀请、测试计划指派、Bug 返回和协作回复会按时间倒序排列。</small>
            </div>
            <div className="test-notification-counts" aria-label="通知已读状态统计">
              {unreadCount > 0 ? <Badge className="test-notification-unread-badge">{unreadCount} 未读</Badge> : null}
              <Badge variant="outline">{readCount} 已读 / {notificationItems.length} 总计</Badge>
            </div>
          </header>
          <div className="test-notification-list">
            {notificationItems.map((item) => {
              if (item.kind === 'invitation') {
                const invitation = item.invitation
                return (
                  <article key={item.key} className="test-notification-card unread">
                    <div className="test-notification-copy">
                      <span className="test-notification-kind unread">邀请</span>
                      <div>
                        <strong>{invitation.spaceName}</strong>
                        <p>{invitation.invitedByName} 邀请你加入测试空间。</p>
                        <small>{invitation.accessLevel === 'editor' ? '可编辑' : '只读'} · {formatTimestamp(invitation.createdAt)}</small>
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" disabled={busy} onClick={() => onDeclineInvitation(invitation)}><XCircle /> 拒绝</Button>
                      <Button disabled={busy} onClick={() => onAcceptInvitation(invitation)}><CheckCircle /> 接受</Button>
                    </div>
                  </article>
                )
              }
              if (item.kind === 'plan_assignment') {
                const plan = item.plan
                const spaceName = data.spaces.find((space) => space.id === plan.testSpaceId)?.name ?? '未知测试空间'
                const subjectNames = (plan.testSubjectIds.length ? plan.testSubjectIds : [plan.testSubjectId])
                  .map((id) => data.subjects.find((subject) => subject.id === id)?.name)
                  .filter(Boolean)
                  .join('、') || '未关联测试对象'
                const read = readNotificationKeys.has(item.notificationKey)
                return (
                  <article key={item.key} className={read ? 'test-notification-card read' : 'test-notification-card unread'}>
                    <div className="test-notification-copy">
                      <span className={read ? 'test-notification-kind' : 'test-notification-kind unread'}>计划指派</span>
                      <div>
                        <strong>PLAN-{plan.id} · {plan.name}</strong>
                        <p>这个测试计划已指派给你，需要跟进执行。</p>
                        <small>{spaceName} · {subjectNames} · {formatTimestamp(item.createdAt)}</small>
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => onOpenPlan(plan, item.notification)}><ListChecks /> 查看计划</Button>
                    </div>
                  </article>
                )
              }
              if (item.kind === 'package_comment') {
                const notification = item.notification
                const read = readNotificationKeys.has(item.notificationKey)
                return (
                  <article key={item.key} className={read ? 'test-notification-card read' : 'test-notification-card unread'}>
                    <div className="test-notification-copy">
                      <span className={read ? 'test-notification-kind' : 'test-notification-kind unread'}>交付反馈</span>
                      <div>
                        <strong>{notification.eventTitle || '交付事件'}</strong>
                        <p>{notification.authorName} 在交付反馈中提到了你{notification.commentPreview ? `：“${notification.commentPreview}”` : '。'}</p>
                        <small>{notification.projectName || '项目' } · {formatTimestamp(item.createdAt)}</small>
                      </div>
                    </div>
                    <div>
                      <Button
                        disabled={read}
                        variant="outline"
                        onClick={() => onMarkNotificationRead(notification)}
                      >
                        <CheckCircle /> {read ? '已读' : '标记已读'}
                      </Button>
                    </div>
                  </article>
                )
              }
              const bug = item.bug
              const spaceName = data.spaces.find((space) => space.id === bug.testSpaceId)?.name ?? '未知测试空间'
              const subjectName = data.subjects.find((subject) => subject.id === bug.testSubjectId)?.name ?? '未关联测试对象'
              if (item.kind === 'bug_comment') {
                const comment = item.comment
                const read = seenBugCommentIds.has(comment.id)
                return (
                  <article key={item.key} className={read ? 'test-notification-card read' : 'test-notification-card unread'}>
                    <div className="test-notification-copy">
                      <span className={read ? 'test-notification-kind' : 'test-notification-kind unread'}>Bug 回复</span>
                      <div>
                        <strong>BUG-{bug.id} · {bug.title}</strong>
                        <p>{comment.authorName} 添加了协作备注，需要测试侧查看。</p>
                        <small>{spaceName} · {subjectName} · {formatTimestamp(item.createdAt)}</small>
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => onOpenBug(bug, item.notification, comment.id)}><Bug /> 查看 Bug</Button>
                    </div>
                  </article>
                )
              }
              if (item.kind === 'bug_rejected') {
                const read = readNotificationKeys.has(item.notificationKey)
                return (
                  <article key={item.key} className={read ? 'test-notification-card read' : 'test-notification-card unread'}>
                    <div className="test-notification-copy">
                      <span className={read ? 'test-notification-kind' : 'test-notification-kind unread'}>Bug 驳回</span>
                      <div>
                        <strong>BUG-{bug.id} · {bug.title}</strong>
                        <p>开发工程师驳回了这个 Bug，需要测试侧处理。</p>
                        <small>{spaceName} · {subjectName} · {formatTimestamp(item.createdAt)}</small>
                      </div>
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => onOpenBug(bug, item.notification)}><Bug /> 查看 Bug</Button>
                    </div>
                  </article>
                )
              }
              const read = readNotificationKeys.has(item.notificationKey)
              return (
                <article key={item.key} className={read ? 'test-notification-card read' : 'test-notification-card unread'}>
                  <div className="test-notification-copy">
                    <span className={read ? 'test-notification-kind' : 'test-notification-kind unread'}>Bug 返回</span>
                    <div>
                      <strong>BUG-{bug.id} · {bug.title}</strong>
                      <p>{bugStatusLabel[bug.status]}，需要测试侧回看。</p>
                      <small>{spaceName} · {subjectName} · {formatTimestamp(item.createdAt)}</small>
                    </div>
                  </div>
                  <div>
                    <Button variant="outline" onClick={() => onOpenBug(bug, item.notification)}><Bug /> 查看 Bug</Button>
                  </div>
                </article>
              )
            })}
          </div>
          </>
        ) : (
          <div className="test-notification-empty">
            <Bell size={30} />
            <strong>暂时没有需要处理的通知。</strong>
            <p>收到测试空间邀请、Bug 返回或协作回复后，会在这里按时间展示。</p>
          </div>
        )}
      </section>
    </div>
  )
}

function CasesView({ cases, data, readOnly, selectedId, onArchive, onCreate, onCreateFolder, onDelete, onEdit, onExport, onImport, onSelect }: {
  cases: TestCase[]
  data: TestWorkbenchData
  readOnly: boolean
  selectedId?: number
  onArchive: (testCase: TestCase) => void
  onCreate: () => void
  onCreateFolder: () => void
  onDelete: (testCase: TestCase) => void
  onEdit: (testCase: TestCase) => void
  onExport: () => void
  onImport: () => void
  onSelect: (id: number) => void
}) {
  const listPanelRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(6)
  const [searchQuery, setSearchQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const availableFolders = useMemo(() => data.folders.filter((folder) => (
    cases.some((testCase) => testCase.folderId === folder.id)
  )), [cases, data.folders])
  const filteredCases = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('zh-CN')
    return cases.filter((item) => {
      const folder = data.folders.find((candidate) => candidate.id === item.folderId)
      const matchesSearch = !normalizedQuery || [
        `CASE-${item.id}`,
        item.title,
        folder?.name ?? '未分类',
        item.preconditions,
        item.steps,
        item.expectedResult,
        item.remarks,
        item.customTags.join(' '),
      ].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
      const matchesFolder = folderFilter === 'all'
        || (folderFilter === 'uncategorized' ? !item.folderId : String(item.folderId) === folderFilter)
      return matchesSearch
        && matchesFolder
        && (typeFilter === 'all' || item.caseType === typeFilter)
        && (priorityFilter === 'all' || item.priority === priorityFilter)
        && (kindFilter === 'all' || item.caseKind === kindFilter)
    })
  }, [cases, data.folders, folderFilter, kindFilter, priorityFilter, searchQuery, typeFilter])
  const selected = filteredCases.find((item) => item.id === selectedId)
  const selectedIndex = filteredCases.findIndex((item) => item.id === selectedId)
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize))
  const visibleCases = filteredCases.slice(page * pageSize, (page + 1) * pageSize)
  const visibleStart = filteredCases.length === 0 ? 0 : page * pageSize + 1
  const visibleEnd = Math.min((page + 1) * pageSize, filteredCases.length)
  const hasFilters = Boolean(searchQuery.trim()) || folderFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all' || kindFilter !== 'all'

  useEffect(() => {
    const panel = listPanelRef.current
    if (!panel) return
    const updatePageSize = () => {
      const availableHeight = panel.getBoundingClientRect().height - 46
      const nextPageSize = Math.max(2, Math.min(20, Math.floor(availableHeight / 104)))
      setPageSize((current) => current === nextPageSize ? current : nextPageSize)
    }
    updatePageSize()
    const observer = new ResizeObserver(updatePageSize)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1))
  }, [totalPages])

  useEffect(() => {
    setPage(0)
  }, [folderFilter, kindFilter, priorityFilter, searchQuery, typeFilter])

  useEffect(() => {
    if (filteredCases.length > 0 && selectedIndex < 0) onSelect(filteredCases[0].id)
  }, [filteredCases, onSelect, selectedIndex])

  useEffect(() => {
    if (selectedIndex < 0) return
    setPage(Math.floor(selectedIndex / pageSize))
  }, [pageSize, selectedIndex])

  function changePage(nextPage: number) {
    const normalizedPage = Math.max(0, Math.min(totalPages - 1, nextPage))
    setPage(normalizedPage)
    const firstCase = filteredCases[normalizedPage * pageSize]
    if (firstCase) onSelect(firstCase.id)
  }

  return (
    <div className="test-module-view test-cases-module-view">
      <div className="test-module-toolbar">
        <div><span>用例库</span><h1>用例管理</h1></div>
        {!readOnly ? <div><Button variant="outline" disabled={!cases.length} onClick={onExport}><DownloadSimple /> 导出用例</Button><Button variant="outline" onClick={onImport}><UploadSimple /> 导入用例</Button><Button variant="outline" onClick={onCreateFolder}><FolderPlus /> 模块</Button><Button onClick={onCreate}><Plus /> 新建用例</Button></div> : null}
      </div>
      <div className="test-case-filters" aria-label="用例搜索与筛选">
        <label className="test-case-search">
          <MagnifyingGlass />
          <Input
            type="search"
            aria-label="搜索用例"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索编号、标题、模块或用例内容"
          />
        </label>
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger aria-label="所属模块筛选"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模块</SelectItem>
            <SelectItem value="uncategorized">未分类</SelectItem>
            {availableFolders.map((folder) => <SelectItem key={folder.id} value={String(folder.id)}>{folder.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="用例类型筛选"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部类型</SelectItem>{Object.entries(caseTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger aria-label="用例等级筛选"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部等级</SelectItem><SelectItem value="high">P0</SelectItem><SelectItem value="medium">P1</SelectItem><SelectItem value="low">P2</SelectItem></SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger aria-label="用例分类筛选"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部分类</SelectItem><SelectItem value="functional">功能用例</SelectItem><SelectItem value="baseline">基线用例</SelectItem></SelectContent>
        </Select>
        <Button
          className="test-case-clear-filters"
          variant="outline"
          aria-label="清除用例筛选"
          disabled={!hasFilters}
          onClick={() => {
            setSearchQuery('')
            setFolderFilter('all')
            setTypeFilter('all')
            setPriorityFilter('all')
            setKindFilter('all')
          }}
        ><XCircle /> 清除</Button>
      </div>
      <div className="test-split-view test-cases-split-view">
        <div ref={listPanelRef} className="test-record-list-panel">
          <div
            className="test-record-list test-case-record-list"
            style={{ gridTemplateRows: `repeat(${Math.max(visibleCases.length, 1)}, minmax(0, 1fr))` }}
          >
            {filteredCases.length ? visibleCases.map((item) => (
              <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => onSelect(item.id)}>
                <div><code>CASE-{item.id}</code><Badge variant="outline">{caseTypeLabel[item.caseType]}</Badge></div>
                <strong>{item.title}</strong>
                <small>{caseLevelLabel[item.priority]} · {data.folders.find((folder) => folder.id === item.folderId)?.name || '未分类'} · {caseKindLabel[item.caseKind]}{item.customTags.length ? ` · ${item.customTags.join('、')}` : ''}</small>
              </button>
            )) : <p className="test-list-empty">{cases.length ? '没有符合条件的用例。' : '当前测试对象还没有用例。'}</p>}
          </div>
          <nav className="test-case-pagination" aria-label="用例分页">
            <span className="test-case-pagination-summary">
              <strong>{visibleStart}-{visibleEnd}</strong> / {filteredCases.length}
              <small>每页 {pageSize} 条</small>
            </span>
            <div>
              <Button aria-label="第一页" title="第一页" size="icon" variant="ghost" disabled={page === 0} onClick={() => changePage(0)}><CaretDoubleLeft /></Button>
              <Button aria-label="上一页" title="上一页" size="icon" variant="ghost" disabled={page === 0} onClick={() => changePage(page - 1)}><CaretLeft /></Button>
              <span className="test-case-page-index">{page + 1} / {totalPages}</span>
              <Button aria-label="下一页" title="下一页" size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={() => changePage(page + 1)}><CaretRight /></Button>
              <Button aria-label="最后一页" title="最后一页" size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={() => changePage(totalPages - 1)}><CaretDoubleRight /></Button>
            </div>
          </nav>
        </div>
        <div className="test-record-detail">
          {selected ? (
            <>
              <div className="test-detail-heading">
                <div>
                  <code>CASE-{selected.id}</code>
                  <h2>{selected.title}</h2>
                  <p className="test-case-folder">
                    <span>所属模块</span>
                    <strong>{data.folders.find((folder) => folder.id === selected.folderId)?.name || '未分类'}</strong>
                  </p>
                </div>
                {!readOnly ? <div><Button variant="outline" onClick={() => onEdit(selected)}>编辑</Button>{selected.caseKind !== 'baseline' ? <Button variant="outline" onClick={() => onArchive(selected)}>归档为基线</Button> : null}{selected.canDelete ? <Button variant="destructive" onClick={() => onDelete(selected)}><Trash /> 删除</Button> : null}</div> : null}
              </div>
              <div className="test-detail-meta test-case-detail-meta"><span>分类 <strong>{caseKindLabel[selected.caseKind]}</strong></span><span>类型 <strong>{caseTypeLabel[selected.caseType]}</strong></span><span>等级 <strong>{caseLevelLabel[selected.priority]}</strong></span></div>
              {selected.customTags.length ? <div className="test-case-tags">{selected.customTags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div> : null}
              <DetailBlock title="前置条件" content={selected.preconditions} />
              <DetailBlock title="测试步骤" content={selected.steps} />
              <DetailBlock title="预期结果" content={selected.expectedResult} />
              <DetailBlock title="备注" content={selected.remarks} />
            </>
          ) : <div className="test-detail-empty"><ClipboardText size={28} /><p>选择一个用例查看完整内容。</p></div>}
        </div>
      </div>
    </div>
  )
}

function PlansView({ busy, data, onCreate, onCreateBug, onDelete, onEdit, onRemoveCase, onResult, onSelect, onStatus, plans, projects, readOnly, selectedId }: {
  busy: boolean
  data: TestWorkbenchData
  onCreate: () => void
  onCreateBug: (plan: TestPlan, planCase: TestWorkbenchData['planCases'][number]) => void
  onDelete: (plan: TestPlan) => void
  onEdit: (plan: TestPlan) => void
  onRemoveCase: (plan: TestPlan, planCaseId: number) => void
  onResult: (planCaseId: number, result: TestResult) => void
  onSelect: (id: number) => void
  onStatus: (plan: TestPlan, status: TestPlan['status']) => void
  plans: TestPlan[]
  projects: TestWorkbenchProjectOption[]
  readOnly: boolean
  selectedId?: number
}) {
  const [executionPage, setExecutionPage] = useState(0)
  const [executionPageSize, setExecutionPageSize] = useState(6)
  const [detailExecutionId, setDetailExecutionId] = useState<number>()
  const executionListRef = useRef<HTMLDivElement>(null)
  const selected = plans.find((item) => item.id === selectedId)
  const executions = data.planCases.filter((item) => item.testPlanId === selectedId)
  const detailExecution = executions.find((item) => item.id === detailExecutionId)
  const passed = executions.filter((item) => item.result === 'passed').length
  const executionTotalPages = Math.max(1, Math.ceil(executions.length / executionPageSize))
  const visibleExecutions = executions.slice(
    executionPage * executionPageSize,
    (executionPage + 1) * executionPageSize,
  )
  const executionStart = executions.length === 0 ? 0 : executionPage * executionPageSize + 1
  const executionEnd = Math.min((executionPage + 1) * executionPageSize, executions.length)

  useEffect(() => {
    const list = executionListRef.current
    if (!list || !selectedId) return
    const updatePageSize = () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        setExecutionPageSize(5)
        return
      }
      const availableHeight = list.getBoundingClientRect().height
      const nextPageSize = Math.max(3, Math.min(20, Math.floor((availableHeight + 8) / PLAN_EXECUTION_ROW_BLOCK_SIZE)))
      setExecutionPageSize((current) => current === nextPageSize ? current : nextPageSize)
    }
    updatePageSize()
    const observer = new ResizeObserver(updatePageSize)
    observer.observe(list)
    return () => observer.disconnect()
  }, [selectedId])

  useEffect(() => {
    setExecutionPage(0)
  }, [selectedId])

  useEffect(() => {
    setExecutionPage((current) => Math.min(current, executionTotalPages - 1))
  }, [executionTotalPages])

  function changeExecutionPage(nextPage: number) {
    setExecutionPage(Math.max(0, Math.min(executionTotalPages - 1, nextPage)))
  }

  return (
    <div className="test-module-view">
      <div className="test-module-toolbar"><div><span>执行与回归</span><h1>测试计划</h1></div>{!readOnly ? <Button onClick={onCreate}><Plus /> 新建计划</Button> : null}</div>
      <div className="test-split-view">
        <div className="test-record-list">
          {plans.length ? plans.map((plan) => {
            const rows = data.planCases.filter((item) => item.testPlanId === plan.id)
            const complete = rows.filter((item) => item.result !== 'untested').length
            return <button key={plan.id} className={plan.id === selectedId ? 'active' : ''} onClick={() => onSelect(plan.id)}><div><code>PLAN-{plan.id}</code><Badge variant="outline">{planStatusLabel[plan.status]}</Badge></div><strong>{plan.name}</strong><small>{complete}/{rows.length} 已执行 · {plan.environment || '未设置环境'}</small></button>
          }) : <p className="test-list-empty">当前测试空间还没有测试计划。</p>}
        </div>
        <div className={selected ? 'test-record-detail test-plan-detail' : 'test-record-detail'}>
          {selected ? <>
            {(() => {
              const planSubjectNames = (selected.testSubjectIds.length ? selected.testSubjectIds : [selected.testSubjectId])
                .map((id) => data.subjects.find((subject) => subject.id === id)?.name)
                .filter(Boolean)
              const ownerName = data.users.find((user) => user.id === selected.ownerUserId)?.displayName || '未分配'
              const projectName = selected.projectId
                ? projects.find((project) => project.id === selected.projectId)?.name || '未知项目'
                : '未关联项目'
              return (
            <div className="test-detail-heading">
              <div>
                <code>PLAN-{selected.id}</code>
                <h2>{selected.name}</h2>
                <p className="test-plan-subtitle">
                  <span>{planSubjectNames.join('、') || '未关联测试对象'}</span>
                  <span>关联项目：{projectName}</span>
                  <span>负责人：{ownerName}</span>
                </p>
              </div>
              <div className="test-plan-heading-actions">
                <Select value={selected.status} onValueChange={(value) => onStatus(selected, value as TestPlan['status'])} disabled={busy || readOnly}>
                  <SelectTrigger className="test-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="in_progress">执行中</SelectItem><SelectItem value="completed">已完成</SelectItem><SelectItem value="aborted">已终止</SelectItem></SelectContent>
                </Select>
                {selected.canManage && !readOnly ? <>
                  <Button variant="outline" disabled={busy} onClick={() => onEdit(selected)}><PencilSimple /> 编辑</Button>
                  <Button variant="destructive" disabled={busy} onClick={() => onDelete(selected)}><Trash /> 删除</Button>
                </> : null}
              </div>
            </div>
              )
            })()}
            <div className="test-plan-progress"><div><strong>{passed}</strong><span>通过</span></div><div><strong>{executions.filter((item) => item.result === 'failed').length}</strong><span>失败</span></div><div><strong>{executions.filter((item) => item.result === 'blocked').length}</strong><span>阻塞</span></div><div><strong>{executions.length ? Math.round((executions.filter((item) => item.result !== 'untested').length / executions.length) * 100) : 0}%</strong><span>进度</span></div></div>
            <div ref={executionListRef} className="test-execution-list">
              {visibleExecutions.map((row) => <article key={row.id}>
                <div className="test-execution-copy"><code>CASE-{row.testCaseId ?? 'SNAPSHOT'}</code><strong>{row.snapshotTitle}</strong><small>{data.subjects.find((subject) => subject.id === row.testSubjectId)?.name || '未知测试对象'}</small></div>
                <Select value={row.result} onValueChange={(value) => onResult(row.id, value as TestResult)} disabled={busy || readOnly}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(resultLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <div className="test-execution-actions">
                  <Button variant="outline" onClick={() => setDetailExecutionId(row.id)}><ClipboardText /> 详情</Button>
                  {row.result === 'failed' && !readOnly ? <Button variant="outline" onClick={() => onCreateBug(selected, row)}><Bug /> 创建 Bug</Button> : null}
                  {selected.canManage && !readOnly && row.result === 'untested' ? <Button
                    aria-label={`从计划移除 ${row.snapshotTitle}`}
                    className="test-plan-case-remove"
                    disabled={busy}
                    size="icon"
                    title="从计划移除"
                    variant="ghost"
                    onClick={() => onRemoveCase(selected, row.id)}
                  ><Trash /></Button> : null}
                </div>
              </article>)}
            </div>
            <nav className="test-case-pagination test-plan-pagination" aria-label="计划用例分页">
              <span className="test-case-pagination-summary">
                <strong>{executionStart}-{executionEnd}</strong> / {executions.length}
                <small>每页 {executionPageSize} 条</small>
              </span>
              <div>
                <Button aria-label="第一页" title="第一页" size="icon" variant="ghost" disabled={executionPage === 0} onClick={() => changeExecutionPage(0)}><CaretDoubleLeft /></Button>
                <Button aria-label="上一页" title="上一页" size="icon" variant="ghost" disabled={executionPage === 0} onClick={() => changeExecutionPage(executionPage - 1)}><CaretLeft /></Button>
                <span className="test-case-page-index">{executionPage + 1} / {executionTotalPages}</span>
                <Button aria-label="下一页" title="下一页" size="icon" variant="ghost" disabled={executionPage >= executionTotalPages - 1} onClick={() => changeExecutionPage(executionPage + 1)}><CaretRight /></Button>
                <Button aria-label="最后一页" title="最后一页" size="icon" variant="ghost" disabled={executionPage >= executionTotalPages - 1} onClick={() => changeExecutionPage(executionTotalPages - 1)}><CaretDoubleRight /></Button>
              </div>
            </nav>
          </> : <div className="test-detail-empty"><ListChecks size={28} /><p>选择一个计划开始执行。</p></div>}
        </div>
      </div>
      <PlanCaseDetailDialog planCase={detailExecution} onClose={() => setDetailExecutionId(undefined)} />
    </div>
  )
}

function PlanCaseDetailDialog({ onClose, planCase }: {
  onClose: () => void
  planCase?: TestWorkbenchData['planCases'][number]
}) {
  if (!planCase) return null
  const caseCode = planCase.testCaseId ? `CASE-${planCase.testCaseId}` : `快照-${planCase.id}`
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent fixedHeader className="test-wide-dialog test-plan-case-detail-dialog">
        <DialogHeader>
          <DialogTitle>{caseCode} 用例详情</DialogTitle>
        <DialogDescription>计划创建时保存的执行快照，后续用例修改不会影响本次执行。</DialogDescription>
        </DialogHeader>
        <div className="test-plan-case-snapshot">
          <DetailBlock title="用例名称" content={planCase.snapshotTitle} />
          <DetailBlock title="前置条件" content={planCase.snapshotPreconditions} />
          <DetailBlock title="测试步骤" content={planCase.snapshotSteps} />
          <DetailBlock title="预期结果" content={planCase.snapshotExpectedResult} />
          {planCase.resultNote ? <DetailBlock title="执行备注" content={planCase.resultNote} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BugsView({ bugs, busy, data, draftOwnerUserId, filterConditions, onAssignee, onComment, onCreate, onDelete, onDeleteComment, onEdit, onFilterClear, onFilterOpenChange, onSelect, onStatus, onTransferSpace, onUpdateComment, onUpdateSpaceVersion, readOnly, searchQuery, onSearchQueryChange, selectedId, versionOptions }: {
  bugs: TestBug[]
  busy: boolean
  data: TestWorkbenchData
  versionOptions: string[]
  draftOwnerUserId?: number
  filterConditions: BugFilterCondition[]
  onAssignee: (bug: TestBug, assigneeUserId?: number) => void
  onComment?: (bug: TestBug, content: string) => Promise<boolean>
  onCreate: () => void
  onDelete: (bug: TestBug) => void
  onDeleteComment: (bug: TestBug, comment: TestBugComment) => Promise<boolean>
  onEdit: (bug: TestBug) => void
  onFilterClear: () => void
  onFilterOpenChange: (open: boolean) => void
  onSearchQueryChange: (value: string) => void
  onSelect: (id: number) => void
  onStatus: (bug: TestBug, status: BugStatus) => void
  onTransferSpace: (bug: TestBug, targetSpaceId: number) => Promise<boolean>
  onUpdateComment: (bug: TestBug, comment: TestBugComment, content: string) => Promise<boolean>
  onUpdateSpaceVersion: (bug: TestBug, versionLabel: string) => Promise<boolean>
  readOnly: boolean
  searchQuery: string
  selectedId?: number
}) {
  const selected = bugs.find((item) => item.id === selectedId)
  return (
    <div className="test-module-view test-bugs-module-view">
      <div className="test-module-toolbar">
        <div><span>缺陷闭环</span><h1>Bug 追踪</h1></div>
        <div className="test-bug-toolbar-actions">
          <label className="test-bug-search">
            <MagnifyingGlass aria-hidden />
            <Input
              aria-label="搜索 Bug"
              placeholder="搜索 Bug 标题、编号或关联信息"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </label>
          <Button
            className={filterConditions.length > 0 ? 'todo-filter-open-button active' : 'todo-filter-open-button'}
            type="button"
            variant="outline"
            onClick={() => onFilterOpenChange(true)}
          >
            <FunnelSimple />
            筛选
            {filterConditions.length > 0 ? <span className="test-bug-filter-count">{filterConditions.length}</span> : null}
          </Button>
          {!readOnly ? <Button onClick={onCreate}><Plus /> 新建 Bug</Button> : null}
        </div>
      </div>
      {filterConditions.length > 0 || searchQuery.trim() ? (
        <div className="test-bug-filter-summary">
          <span>当前显示 {bugs.length} 条 Bug</span>
          {filterConditions.length > 0 ? <Button type="button" variant="ghost" onClick={onFilterClear}>清除筛选</Button> : null}
          {searchQuery.trim() ? <Button type="button" variant="ghost" onClick={() => onSearchQueryChange('')}>清除搜索</Button> : null}
        </div>
      ) : null}
      <div className="test-split-view">
          <div className="test-record-list">
            {bugs.length ? bugs.map((bug) => <button key={bug.id} className={bug.id === selectedId ? 'active' : ''} onClick={() => onSelect(bug.id)}><div><code>BUG-{bug.id}</code><Badge className={`test-bug-status ${bug.status}`} variant="outline">{bugStatusLabel[bug.status]}</Badge></div><strong>{bug.title}</strong><small>{formatTimestamp(bug.updatedAt)} · <UserName departedUserIds={data.departedUserIds} name={bug.assigneeName || '未分配'} userId={bug.assigneeUserId} />{bug.assigneeTransferSource === 'offboarding' ? '（离职转移）' : null}</small></button>) : <div className="test-list-empty">{filterConditions.length > 0 || searchQuery.trim() ? <><FunnelSimple size={24} /><span>没有符合当前条件的 Bug。</span>{filterConditions.length > 0 ? <Button type="button" variant="outline" onClick={onFilterClear}>清除筛选</Button> : null}{searchQuery.trim() ? <Button type="button" variant="outline" onClick={() => onSearchQueryChange('')}>清除搜索</Button> : null}</> : '当前测试对象还没有 Bug。'}</div>}
        </div>
        <div className="test-record-detail">
          {selected ? <BugDetail bug={selected} busy={busy} departedUserIds={data.departedUserIds} draftOwnerUserId={draftOwnerUserId} readOnly={readOnly} users={data.users} versionOptions={versionOptions} onAssignee={onAssignee} onComment={readOnly ? undefined : onComment} onDelete={onDelete} onDeleteComment={readOnly ? undefined : onDeleteComment} onEdit={onEdit} onStatus={onStatus} onTransferSpace={onTransferSpace} onUpdateComment={readOnly ? undefined : onUpdateComment} onUpdateSpaceVersion={onUpdateSpaceVersion} /> : <div className="test-detail-empty"><Bug size={28} /><p>选择一个 Bug 查看和流转。</p></div>}
        </div>
      </div>
    </div>
  )
}

function BugDetail({ bug, busy, departedUserIds, draftOwnerUserId, onAssignee, onComment, onDelete, onDeleteComment, onEdit, onStatus, onTransferSpace, onUpdateComment, onUpdateSpaceVersion, readOnly, users, versionOptions }: {
  bug: TestBug
  busy: boolean
  departedUserIds: readonly number[]
  draftOwnerUserId?: number
  onAssignee: (bug: TestBug, assigneeUserId?: number) => void
  onComment?: (bug: TestBug, content: string) => Promise<boolean>
  onDelete: (bug: TestBug) => void
  onDeleteComment?: (bug: TestBug, comment: TestBugComment) => Promise<boolean>
  onEdit: (bug: TestBug) => void
  onStatus: (bug: TestBug, status: BugStatus) => void
  onTransferSpace: (bug: TestBug, targetSpaceId: number) => Promise<boolean>
  onUpdateComment?: (bug: TestBug, comment: TestBugComment, content: string) => Promise<boolean>
  onUpdateSpaceVersion: (bug: TestBug, versionLabel: string) => Promise<boolean>
  readOnly: boolean
  users: TestWorkbenchData['users']
  versionOptions: string[]
}) {
  const developers = users.filter((user) => user.roles.includes('developer'))
  const [shareOpen, setShareOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [transferSpaceOpen, setTransferSpaceOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [versionLabelDraft, setVersionLabelDraft] = useState(bug.testSpaceVersionLabel ?? '')
  const [environmentCopyState, setEnvironmentCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const environmentValue = bug.testEnvironmentAccessUrl || bug.environment

  useEffect(() => {
    setEnvironmentCopyState('idle')
  }, [environmentValue, bug.id])

  useEffect(() => {
    setVersionLabelDraft(bug.testSpaceVersionLabel ?? '')
  }, [bug.id, bug.testSpaceVersionLabel])

  async function copyEnvironment() {
    try {
      await navigator.clipboard.writeText(environmentValue)
      setEnvironmentCopyState('copied')
    } catch {
      setEnvironmentCopyState('failed')
    }
  }

  return <>
    <div className="test-detail-heading">
      <div><code>BUG-{bug.id}</code><h2>{bug.title}</h2></div>
      <div className="test-detail-heading-actions">
        {bug.canTransferSpace ? <Button aria-label="转移空间" disabled={busy} onClick={() => setTransferSpaceOpen(true)} size="icon-sm" title="转移空间" variant="outline"><ArrowsLeftRight /></Button> : null}
        <Button aria-label="时间线" onClick={() => setTimelineOpen(true)} size="icon-sm" title="时间线" variant="outline"><Clock /></Button>
        {(bug.status === 'rejected' || bug.status === 'closed') ? <Button variant="outline" disabled={busy || readOnly} onClick={() => onStatus(bug, 'pending_confirmation')}><ArrowCounterClockwise /> 重新打开</Button> : null}
        {bug.canShare ? <Button aria-label="分享 Bug" disabled={busy} onClick={() => setShareOpen(true)} size="icon-sm" title="分享 Bug" variant="outline"><LinkSimple /></Button> : null}
        {bug.canEdit && !readOnly ? <Button aria-label="编辑" disabled={busy} onClick={() => onEdit(bug)} size="icon-sm" title="编辑" variant="outline"><PencilSimple /></Button> : null}
        {bug.canDelete ? <Button aria-label="删除 Bug" disabled={busy} onClick={() => onDelete(bug)} size="icon-sm" title="删除 Bug" variant="destructive"><Trash /></Button> : null}
      </div>
    </div>
    <div className="test-bug-controls"><Label>状态<Select value={visibleBugStatus(bug.status)} onValueChange={(value) => onStatus(bug, selectedBugStatus(bug, value as BugStatus))} disabled={busy || readOnly}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bugStatusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Label><Label>负责人<Select value={bug.assigneeUserId ? String(bug.assigneeUserId) : 'none'} onValueChange={(value) => onAssignee(bug, value === 'none' ? undefined : Number(value))} disabled={busy || readOnly}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未分配</SelectItem>{developers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.displayName}</SelectItem>)}</SelectContent></Select></Label></div>
    <div className="test-detail-meta test-bug-detail-meta">
      <span>测试对象 <strong>{bug.testSubjectName || '未记录'}</strong></span>
      <span>空间版本 <span className="test-detail-meta-label"><strong>{bug.testSpaceVersionLabel || '未指定'}</strong>{bug.canEditSpaceVersion ? <Button aria-label="修改空间版本" className="test-detail-meta-copy" disabled={busy} onClick={() => setVersionDialogOpen(true)} size="icon-xs" title="修改空间版本" variant="ghost"><PencilSimple /></Button> : null}</span></span>
      <span>严重程度 <strong>{severityLabel[bug.severity]}</strong></span>
      <span>优先级 <strong>{priorityLabel[bug.priority]}</strong></span>
      <span>
        <span className="test-detail-meta-label">
          环境{bug.testEnvironmentName ? ` · ${bug.testEnvironmentName}` : ''}
          <Button aria-label={environmentCopyState === 'copied' ? '已复制环境链接' : '复制环境链接'} className="test-detail-meta-copy" disabled={!environmentValue} onClick={() => void copyEnvironment()} size="icon-xs" title={environmentCopyState === 'copied' ? '已复制' : environmentCopyState === 'failed' ? '复制失败' : '复制环境链接'} variant="ghost">{environmentCopyState === 'copied' ? <CheckCircle weight="bold" /> : <CopySimple />}</Button>
        </span>
        {bug.testEnvironmentAccessUrl ? <a className="test-environment-link" href={bug.testEnvironmentAccessUrl} rel="noreferrer" target="_blank">{environmentValue}<LinkSimple aria-hidden /></a> : <strong>{environmentValue || '未记录'}</strong>}
      </span>
      <span>更新时间 <strong>{formatTimestamp(bug.updatedAt)}</strong></span>
    </div>
    <DetailBlock title="复现步骤" content={bug.reproductionSteps} /><DetailBlock title="预期结果" content={bug.expectedResult} /><DetailBlock title="实际结果" content={bug.actualResult} />
    <BugCommentsSection
      bug={bug}
      busy={busy}
      departedUserIds={departedUserIds}
      draftOwnerUserId={draftOwnerUserId}
      placeholder="补充验证信息或处理记录，支持粘贴、拖入或上传图片和视频。"
      onComment={onComment}
      onDeleteComment={onDeleteComment}
      onUpdateComment={onUpdateComment}
    />
    <BugShareDialog bugId={bug.id} open={shareOpen} onOpenChange={setShareOpen} />
    <BugSpaceTransferDialog bug={bug} busy={busy} open={transferSpaceOpen} onOpenChange={setTransferSpaceOpen} onSubmit={onTransferSpace} />
    <BugTimelineDialog bug={bug} departedUserIds={departedUserIds} open={timelineOpen} onOpenChange={setTimelineOpen} />
    <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
      <DialogContent fixedHeader className="test-workbench-dialog">
        <DialogHeader>
          <DialogTitle>修改空间版本</DialogTitle>
          <DialogDescription>此版本号会应用到“{bug.testSpaceName ?? '当前测试空间'}”的测试记录。</DialogDescription>
        </DialogHeader>
        <form className="test-dialog-form" onSubmit={async (event) => {
          event.preventDefault()
          const saved = await onUpdateSpaceVersion(bug, versionLabelDraft.trim())
          if (saved) setVersionDialogOpen(false)
        }}>
          <Label>
            版本号
            <Select value={versionLabelDraft} onValueChange={setVersionLabelDraft}>
              <SelectTrigger aria-label="选择空间版本"><SelectValue placeholder="选择版本" /></SelectTrigger>
              <SelectContent>
                {versionOptions.map((version) => <SelectItem key={version} value={version}>{version}</SelectItem>)}
              </SelectContent>
            </Select>
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVersionDialogOpen(false)}>取消</Button>
            <Button disabled={busy || versionLabelDraft.trim() === (bug.testSpaceVersionLabel ?? '')}><PencilSimple /> 保存版本</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
}

function BugSpaceTransferDialog({ bug, busy, onOpenChange, onSubmit, open }: {
  bug: TestBug
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (bug: TestBug, targetSpaceId: number) => Promise<boolean>
  open: boolean
}) {
  const [targetSpaceId, setTargetSpaceId] = useState('')

  useEffect(() => {
    if (open) setTargetSpaceId('')
  }, [bug.id, open])

  async function submit() {
    if (!targetSpaceId) return
    const transferred = await onSubmit(bug, Number(targetSpaceId))
    if (transferred) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-workbench-dialog">
        <DialogHeader>
          <DialogTitle>转移 Bug 到其他空间</DialogTitle>
          <DialogDescription>选择目标测试空间后，Bug 编号、评论、分享链接和时间线都会保留。</DialogDescription>
        </DialogHeader>
        {(bug.transferSpaceCandidates?.length ?? 0) > 0 ? (
          <Label>目标测试空间
            <Select value={targetSpaceId} onValueChange={setTargetSpaceId}>
              <SelectTrigger aria-label="目标测试空间"><SelectValue placeholder="选择测试空间" /></SelectTrigger>
              <SelectContent>
                {bug.transferSpaceCandidates?.map((space) => (
                  <SelectItem key={space.id} value={String(space.id)}>
                    {space.name}{space.versionLabel ? ` · ${space.versionLabel}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        ) : <p className="test-list-empty">名下没有其他可用的测试空间。</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={busy || !targetSpaceId} onClick={() => void submit()}><ArrowsLeftRight />{busy ? '转移中...' : '确认转移'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BugTimelineDialog({ bug, departedUserIds, onOpenChange, open }: {
  bug: TestBug
  departedUserIds: readonly number[]
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const hasCreatedEvent = bug.events.some((event) => event.eventType === 'created')
  const isNamedTransferComment = (comment: TestBugComment) => (
    comment.kind === 'transfer' && /转移给「([^」]+)」/u.test(comment.content)
  )
  const timeline: Array<{
    actorUserId?: number
    actorName?: string
    assigneeUserId?: number
    assigneeName?: string
    createdAt: string
    eventType: TestBugEvent['eventType'] | 'rejected'
    id: number
    nextSpaceName?: string
    nextStatus?: BugStatus
    previousSpaceName?: string
    previousStatus?: BugStatus
    transferSource?: 'manual' | 'offboarding'
  }> = [
    ...(hasCreatedEvent ? [] : [{ eventType: 'created' as const, actorName: bug.reporterName, actorUserId: bug.reporterUserId, createdAt: bug.createdAt, id: 0 }]),
    ...bug.comments
      .filter((comment) => comment.kind === 'reject' || isNamedTransferComment(comment))
      .map((comment) => ({
        actorName: comment.authorName,
        actorUserId: comment.authorUserId,
        assigneeName: comment.kind === 'transfer'
          ? (comment.content.match(/转移给「([^」]+)」/u)?.[1] ?? undefined)
          : undefined,
        createdAt: comment.createdAt,
        eventType: comment.kind === 'reject' ? 'rejected' as const : 'transferred' as const,
        id: -comment.id,
      })),
    ...bug.events.map((event) => ({ ...event, actorUserId: event.actorUserId, assigneeUserId: event.assigneeUserId })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bug-timeline-dialog">
        <DialogHeader>
          <DialogTitle>Bug 时间线</DialogTitle>
          <DialogDescription>BUG-{bug.id} · {bug.title}</DialogDescription>
        </DialogHeader>
        <div className="bug-timeline-list">
          {timeline.length === 0 ? (
            <div className="bug-timeline-empty">暂无记录</div>
          ) : timeline.map((event) => (
            <div className="bug-timeline-item" key={event.id}>
              <span className="bug-timeline-icon">{event.eventType === 'created' ? <Plus size={15} /> : event.eventType === 'assigned' ? <UserPlus size={15} /> : event.eventType === 'transferred' || event.eventType === 'space_transferred' ? <ArrowsLeftRight size={15} /> : event.eventType === 'rejected' ? <XCircle size={15} /> : <ArrowCounterClockwise size={15} />}</span>
              <div className="bug-timeline-content">
                {event.eventType === 'created' ? (
                  <strong>创建了 Bug</strong>
                ) : event.eventType === 'assigned' ? (
                  <strong>指派给 <UserName departedUserIds={departedUserIds} name={event.assigneeName ?? '未分配'} userId={event.assigneeUserId} /></strong>
                ) : event.eventType === 'transferred' ? (
                  <strong>转移给 <UserName departedUserIds={departedUserIds} name={event.assigneeName ?? '未分配'} userId={event.assigneeUserId} />{event.transferSource === 'offboarding' ? '（离职转移）' : null}</strong>
                ) : event.eventType === 'space_transferred' ? (
                  <strong>从「{event.previousSpaceName ?? '未知空间'}」转移到「{event.nextSpaceName ?? '未知空间'}」</strong>
                ) : event.eventType === 'rejected' ? (
                  <strong>驳回了该 Bug</strong>
                ) : (
                  <strong>状态从「{event.previousStatus ? bugStatusLabel[event.previousStatus] : '未知'}」改为「{event.nextStatus ? bugStatusLabel[event.nextStatus] : '未知'}」</strong>
                )}
                <UserName departedUserIds={departedUserIds} name={event.actorName ?? '未知用户'} userId={event.actorUserId} />
              </div>
              <time>{formatTimestamp(event.createdAt)}</time>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type BugCommentComposerDraft = {
  context: string
  publishedDraftClearFailed: boolean
  storageFailed: boolean
  value: string
}

function getBugCommentDraftContext(userId: number | undefined, bugId: number) {
  return `${userId ?? 'anonymous'}:${bugId}`
}

function didBugCommentDraftStorageFail(userId: number | undefined, result: { ok: boolean }) {
  return typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0 && !result.ok
}

function BugCommentsSection({ bug, busy, currentUserId, departedUserIds = [], draftOwnerUserId, mentionMembers, onComment, onDeleteComment, onUpdateComment, placeholder }: {
  bug: TestBug
  busy: boolean
  currentUserId?: number
  departedUserIds?: readonly number[]
  draftOwnerUserId?: number
  mentionMembers?: MentionMember[]
  onComment?: (bug: TestBug, content: string) => Promise<boolean>
  onDeleteComment?: (bug: TestBug, comment: TestBugComment) => Promise<boolean>
  onUpdateComment?: (bug: TestBug, comment: TestBugComment, content: string) => Promise<boolean>
  placeholder: string
}) {
  const draftContext = getBugCommentDraftContext(draftOwnerUserId, bug.id)
  const draftMemoryRef = useRef(new Map<string, string>())
  const draftRevisionRef = useRef(new Map<string, number>())
  const failedDraftContextsRef = useRef(new Set<string>())
  const publishedDraftClearFailedContextsRef = useRef(new Set<string>())
  const previousDraftOwnerUserIdRef = useRef(draftOwnerUserId)
  const mountedRef = useRef(false)
  const [composerDraft, setComposerDraft] = useState<BugCommentComposerDraft>({
    context: '',
    publishedDraftClearFailed: false,
    storageFailed: false,
    value: '',
  })
  const [uploading, setUploading] = useState(false)
  const comment = composerDraft.context === draftContext ? composerDraft.value : ''
  const publishedDraftClearFailed = composerDraft.context === draftContext && composerDraft.publishedDraftClearFailed
  const draftStorageFailed = composerDraft.context === draftContext && composerDraft.storageFailed

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (previousDraftOwnerUserIdRef.current !== draftOwnerUserId) {
      draftMemoryRef.current.clear()
      draftRevisionRef.current.clear()
      failedDraftContextsRef.current.clear()
      publishedDraftClearFailedContextsRef.current.clear()
      previousDraftOwnerUserIdRef.current = draftOwnerUserId
    }

    const cachedDraft = draftMemoryRef.current.get(draftContext)
    if (cachedDraft !== undefined) {
      if (!draftRevisionRef.current.has(draftContext)) draftRevisionRef.current.set(draftContext, 0)
      setComposerDraft({
        context: draftContext,
        publishedDraftClearFailed: publishedDraftClearFailedContextsRef.current.has(draftContext),
        storageFailed: failedDraftContextsRef.current.has(draftContext),
        value: cachedDraft,
      })
    } else {
      const loaded = loadBugCommentDraft(draftOwnerUserId, bug.id)
      draftMemoryRef.current.set(draftContext, loaded.value)
      draftRevisionRef.current.set(draftContext, loaded.revision)
      const storageFailed = didBugCommentDraftStorageFail(draftOwnerUserId, loaded)
      if (storageFailed) failedDraftContextsRef.current.add(draftContext)
      else failedDraftContextsRef.current.delete(draftContext)
      setComposerDraft({
        context: draftContext,
        publishedDraftClearFailed: false,
        storageFailed,
        value: loaded.value,
      })
    }
    setUploading(false)
  }, [bug.id, draftContext, draftOwnerUserId])

  useEffect(() => subscribeBugCommentDraftChanges((changedUserId, changedBugId) => {
    if (changedUserId !== draftOwnerUserId || changedBugId !== bug.id) return
    const loaded = loadBugCommentDraft(draftOwnerUserId, bug.id)
    draftMemoryRef.current.set(draftContext, loaded.value)
    draftRevisionRef.current.set(draftContext, loaded.revision)
    const storageFailed = didBugCommentDraftStorageFail(draftOwnerUserId, loaded)
    if (storageFailed) failedDraftContextsRef.current.add(draftContext)
    else failedDraftContextsRef.current.delete(draftContext)
    publishedDraftClearFailedContextsRef.current.delete(draftContext)
    if (!mountedRef.current) return
    setComposerDraft((current) => current.context === draftContext
      ? {
          context: draftContext,
          publishedDraftClearFailed: false,
          storageFailed,
          value: loaded.value,
        }
      : current)
  }), [bug.id, draftContext, draftOwnerUserId])

  function updateCommentDraft(nextValue: string) {
    const nextRevision = (draftRevisionRef.current.get(draftContext) ?? 0) + 1
    const saved = saveBugCommentDraft(draftOwnerUserId, bug.id, nextValue, nextRevision)
    draftMemoryRef.current.set(draftContext, saved.value)
    draftRevisionRef.current.set(draftContext, saved.revision)
    if (didBugCommentDraftStorageFail(draftOwnerUserId, saved)) failedDraftContextsRef.current.add(draftContext)
    else failedDraftContextsRef.current.delete(draftContext)
    publishedDraftClearFailedContextsRef.current.delete(draftContext)

    setComposerDraft((current) => current.context === draftContext
      ? {
          context: draftContext,
          publishedDraftClearFailed: false,
          storageFailed: failedDraftContextsRef.current.has(draftContext),
          value: nextValue,
        }
      : current)
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submittedContent = comment
    const submittedContext = draftContext
    const submittedBug = bug
    const submittedUserId = draftOwnerUserId
    const submittedRevision = draftRevisionRef.current.get(submittedContext) ?? 0
    if (!submittedContent.trim() || !onComment) return
    if (!(await onComment(submittedBug, submittedContent))) return
    if (draftRevisionRef.current.get(submittedContext) !== submittedRevision) return

    const cleared = clearBugCommentDraftIfMatches(
      submittedUserId,
      submittedBug.id,
      submittedContent,
      submittedRevision,
    )

    failedDraftContextsRef.current.delete(submittedContext)
    if (cleared.status === 'kept') {
      draftMemoryRef.current.set(submittedContext, cleared.value)
      draftRevisionRef.current.set(submittedContext, cleared.revision)
      publishedDraftClearFailedContextsRef.current.delete(submittedContext)
      if (mountedRef.current) setComposerDraft((current) => current.context === submittedContext && current.value === submittedContent
        ? {
            context: submittedContext,
            publishedDraftClearFailed: false,
            storageFailed: false,
            value: cleared.value,
          }
        : current)
      return
    }

    const clearFailed = didBugCommentDraftStorageFail(submittedUserId, cleared)
    draftMemoryRef.current.set(submittedContext, '')
    draftRevisionRef.current.set(submittedContext, submittedRevision + 1)
    if (clearFailed) publishedDraftClearFailedContextsRef.current.add(submittedContext)
    else publishedDraftClearFailedContextsRef.current.delete(submittedContext)
    if (mountedRef.current) setComposerDraft((current) => current.context === submittedContext && current.value === submittedContent
      ? {
          context: submittedContext,
          publishedDraftClearFailed: clearFailed,
          storageFailed: false,
          value: '',
        }
      : current)
  }

  return (
    <section className="test-comments">
      <h3>协作记录</h3>
      {bug.comments.map((item) => (
        <BugCommentArticle
          key={item.id}
          bug={bug}
          busy={busy}
          comment={item}
          currentUserId={currentUserId}
          departedUserIds={departedUserIds}
          onDeleteComment={onDeleteComment}
          onUpdateComment={onUpdateComment}
        />
      ))}
      {onComment ? <form
        className="test-comment-composer"
        onSubmit={submitComment}
      >
        <BugEvidenceEditor
          key={draftContext}
          label="添加评论"
          mentionMembers={mentionMembers}
          value={comment}
          placeholder={placeholder}
          onChange={updateCommentDraft}
          onUploadingChange={setUploading}
        />
        {publishedDraftClearFailed ? <p aria-live="polite" className="test-form-error" role="status">评论已发布，但浏览器草稿未能清除；刷新后如再次出现，请勿重复提交。</p> : null}
        {!publishedDraftClearFailed && draftStorageFailed ? <p aria-live="polite" className="test-form-error" role="status">评论草稿无法保存到浏览器，切换页面或刷新前请先复制内容。</p> : null}
        <Button disabled={busy || uploading || !comment.trim()}>{uploading ? '附件上传中...' : '添加评论'}</Button>
      </form> : null}
    </section>
  )
}

function BugCommentArticle({ bug, busy, comment, currentUserId, departedUserIds = [], onDeleteComment, onUpdateComment }: {
  bug: TestBug
  busy: boolean
  comment: TestBugComment
  currentUserId?: number
  departedUserIds?: readonly number[]
  onDeleteComment?: (bug: TestBug, comment: TestBugComment) => Promise<boolean>
  onUpdateComment?: (bug: TestBug, comment: TestBugComment, content: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [uploading, setUploading] = useState(false)
  const canManage = comment.kind !== 'transfer' && comment.kind !== 'reject' && Boolean((onUpdateComment || onDeleteComment) && (comment.canEdit || (
    currentUserId != null && comment.authorUserId === currentUserId
  )))
  const canEdit = Boolean(onUpdateComment && canManage)
  const canDelete = Boolean(onDeleteComment && canManage)
  const edited = comment.updatedAt
    ? new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000
    : false

  useEffect(() => {
    if (!editing) setDraft(comment.content)
  }, [comment.content, editing])

  return (
    <article className="test-comment-item">
      <div className="test-comment-header">
        <div className="test-comment-byline">
          <UserName departedUserIds={departedUserIds} name={comment.authorName} userId={comment.authorUserId} />
          {comment.kind === 'transfer' ? <Badge variant="outline">转移记录</Badge> : null}
          {comment.kind === 'reject' ? <Badge variant="outline">驳回记录</Badge> : null}
          <span aria-hidden="true">·</span>
          <time>{formatTimestamp(comment.createdAt)}{edited ? ` · 编辑于 ${formatTimestamp(comment.updatedAt)}` : ''}</time>
        </div>
        {(canEdit || canDelete) && !editing ? (
          <div className="test-comment-actions">
            {canEdit ? (
              <Button
                aria-label="编辑协作记录"
                size="icon"
                title="编辑协作记录"
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <PencilSimple />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                aria-label="删除协作记录"
                className="test-comment-delete-button"
                disabled={busy}
                size="icon"
                title="删除协作记录"
                type="button"
                variant="outline"
                onClick={() => {
                  if (!onDeleteComment) return
                  if (window.confirm('确定删除这条协作记录吗？')) {
                    void onDeleteComment(bug, comment)
                  }
                }}
              >
                <Trash />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing ? (
        <form
          className="test-comment-editor"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!onUpdateComment || !draft.trim()) return
            const saved = await onUpdateComment(bug, comment, draft)
            if (saved) setEditing(false)
          }}
        >
          <BugEvidenceEditor
            label="编辑评论"
            value={draft}
            placeholder="更新协作记录，支持粘贴、拖入或上传图片和视频。"
            onChange={setDraft}
            onUploadingChange={setUploading}
          />
          <div className="test-comment-editor-actions">
            <Button type="button" variant="outline" onClick={() => { setDraft(comment.content); setEditing(false) }}>取消</Button>
            <Button disabled={busy || uploading || !draft.trim()}>{uploading ? '附件上传中...' : '保存'}</Button>
          </div>
        </form>
      ) : (
        <BugEvidenceContent content={comment.content} emptyText="未填写" />
      )}
    </article>
  )
}

type BugEvidenceAttachment = {
  alt: string
  src: string
  type: 'image' | 'video'
  uploading?: boolean
}

const bugEvidenceAttachmentPattern = /!\[([^\]]*)\]\(([^)\n]+)\)|\[视频：([^\]]*)\]\(([^)\n]+)\)/g

function normalizeBugEvidenceAttachment(attachment: BugEvidenceAttachment, index: number) {
  const fallback = attachment.type === 'video' ? `录屏 ${index + 1}` : `截图 ${index + 1}`
  return {
    ...attachment,
    alt: sanitizeBugEvidenceAlt(attachment.alt) || fallback,
  }
}

function normalizeBugEvidenceAttachments(attachments: BugEvidenceAttachment[]) {
  return attachments
    .filter((attachment) => attachment.src.trim())
    .map(normalizeBugEvidenceAttachment)
}

function parseBugEvidenceContent(content: string) {
  const attachments: BugEvidenceAttachment[] = []
  const textParts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = bugEvidenceAttachmentPattern.exec(content)

  while (match) {
    textParts.push(content.slice(lastIndex, match.index))
    const imageAlt = match[1]
    const imageSrc = match[2]
    const videoAlt = match[3]
    const videoSrc = match[4]
    attachments.push({
      alt: imageAlt ?? videoAlt ?? '',
      src: imageSrc ?? videoSrc ?? '',
      type: imageSrc ? 'image' : 'video',
    })
    lastIndex = bugEvidenceAttachmentPattern.lastIndex
    match = bugEvidenceAttachmentPattern.exec(content)
  }

  textParts.push(content.slice(lastIndex))
  bugEvidenceAttachmentPattern.lastIndex = 0

  return {
    attachments: normalizeBugEvidenceAttachments(attachments),
    text: attachments.length > 0
      ? textParts.join('').replace(/\n{3,}/g, '\n\n').replace(/\n{2,}$/g, '')
      : textParts.join(''),
  }
}

function sanitizeBugEvidenceAlt(value: string) {
  return value.replace(/[\]\n\r]/g, ' ').trim()
}

function serializeBugEvidenceContent(text: string, attachments: BugEvidenceAttachment[]) {
  const normalizedAttachments = normalizeBugEvidenceAttachments(attachments)
  const attachmentMarkdown = normalizedAttachments
    .map((attachment) => attachment.type === 'video'
      ? `[视频：${attachment.alt}](${attachment.src})`
      : `![${attachment.alt}](${attachment.src})`)
    .join('\n\n')
  const hasText = text.trim().length > 0

  if (hasText && attachmentMarkdown) return `${text}\n\n${attachmentMarkdown}`
  return hasText ? text : attachmentMarkdown
}

function isSupportedBugEvidenceFile(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

function bugEvidenceFileType(file: File): BugEvidenceAttachment['type'] {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

function BugEvidenceEditor({ label, mentionMembers, onChange, onUploadingChange, placeholder, value }: {
  label: string
  mentionMembers?: MentionMember[]
  onChange: (value: string) => void
  onUploadingChange?: (uploading: boolean) => void
  placeholder: string
  value: string
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { attachments, text } = useMemo(() => parseBugEvidenceContent(value), [value])
  const [textDraft, setTextDraft] = useState(text)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [uploadingAttachmentSrcs, setUploadingAttachmentSrcs] = useState<string[]>([])
  const latestValueRef = useRef(value)
  const lastSerializedValueRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const previewAttachment = previewIndex == null ? null : attachments[previewIndex] ?? null
  const uploadingSrcSet = useMemo(() => new Set(uploadingAttachmentSrcs), [uploadingAttachmentSrcs])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    if (lastSerializedValueRef.current === value) return
    setTextDraft(text)
  }, [text, value])

  useEffect(() => {
    onUploadingChange?.(uploadingAttachmentSrcs.length > 0)
  }, [onUploadingChange, uploadingAttachmentSrcs.length])

  useEffect(() => {
    if (previewIndex != null && !attachments[previewIndex]) setPreviewIndex(null)
  }, [attachments, previewIndex])

  function commitValue(nextValue: string) {
    latestValueRef.current = nextValue
    lastSerializedValueRef.current = nextValue
    if (mountedRef.current) {
      onChange(nextValue)
      return true
    }
    return false
  }

  function updateEvidence(nextText: string, nextAttachments: BugEvidenceAttachment[]) {
    return commitValue(serializeBugEvidenceContent(nextText, nextAttachments))
  }

  async function handleFiles(files: File[]) {
    const supportedFiles = files.filter(isSupportedBugEvidenceFile)
    if (supportedFiles.length === 0) {
      window.alert('仅支持上传图片或视频文件。')
      return
    }
    if (supportedFiles.length !== files.length) {
      window.alert('已忽略不支持的文件，仅保留图片和视频。')
    }

    const currentContent = parseBugEvidenceContent(latestValueRef.current)
    const pendingAttachments = supportedFiles.map((file, index) => ({
      alt: sanitizeBugEvidenceAlt(file.name) || (file.type.startsWith('video/') ? `录屏 ${currentContent.attachments.length + index + 1}` : `截图 ${currentContent.attachments.length + index + 1}`),
      src: URL.createObjectURL(file),
      type: bugEvidenceFileType(file),
      uploading: true,
    }))
    const pendingSrcs = pendingAttachments.map((attachment) => attachment.src)
    const pendingSrcSet = new Set(pendingSrcs)
    setUploadingAttachmentSrcs((current) => [...new Set([...current, ...pendingSrcs])])
    updateEvidence(currentContent.text, [...currentContent.attachments, ...pendingAttachments])

    try {
      const uploads = await Promise.all(supportedFiles.map(uploadWorkbenchAttachment))
      if (!mountedRef.current) return
      const uploadedAttachmentsByPendingSrc = new Map(
        pendingAttachments.map((pendingAttachment, index) => [
          pendingAttachment.src,
          {
            alt: pendingAttachment.alt,
            src: uploads[index]?.attachmentUrl ?? uploads[index]?.imageUrl ?? '',
            type: pendingAttachment.type,
          },
        ]),
      )
      const latestContent = parseBugEvidenceContent(latestValueRef.current)
      const nextAttachments = latestContent.attachments.flatMap((attachment) => {
        const uploadedAttachment = uploadedAttachmentsByPendingSrc.get(attachment.src)
        return uploadedAttachment?.src ? [uploadedAttachment] : [attachment]
      })
      updateEvidence(latestContent.text, nextAttachments)
    } catch (error) {
      if (!mountedRef.current) return
      const latestContent = parseBugEvidenceContent(latestValueRef.current)
      const changed = updateEvidence(
        latestContent.text,
        latestContent.attachments.filter((attachment) => !pendingSrcSet.has(attachment.src)),
      )
      console.error('Bug evidence attachment upload failed', error)
      if (mountedRef.current && changed) {
        window.alert(error instanceof Error && error.message
          ? `附件上传失败：${error.message}`
          : '附件上传失败，请稍后重试。')
      }
    } finally {
      if (mountedRef.current) {
        setUploadingAttachmentSrcs((current) => current.filter((src) => !pendingSrcSet.has(src)))
      }
      pendingAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.src))
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/')))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (files.length === 0) return
    event.preventDefault()
    await handleFiles(files)
  }

  async function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    event.preventDefault()
    await handleFiles(files)
  }

  return (
    <section className={attachments.length > 0 ? 'test-evidence-editor has-attachments' : 'test-evidence-editor'}>
      <div className="test-evidence-editor-header">
        <span>{label}</span>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadSimple /> 上传图片/视频
        </Button>
      </div>
      <div className="test-evidence-composer">
        {attachments.length > 0 ? (
          <div className="test-evidence-attachments" aria-label={`${label}包含 ${attachments.length} 个附件`}>
            {attachments.map((attachment, index) => {
              const uploading = uploadingSrcSet.has(attachment.src) || attachment.uploading
              return (
                <figure className="test-evidence-attachment" key={`${attachment.src.slice(0, 48)}-${index}`}>
                  <button
                    aria-label={`查看${attachment.type === 'video' ? '视频' : '图片'} ${index + 1}`}
                    className={uploading ? 'test-evidence-attachment-preview uploading' : 'test-evidence-attachment-preview'}
                    disabled={uploading}
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                  >
                    {attachment.type === 'video' ? (
                      <>
                        <video src={attachment.src} muted preload="metadata" />
                        <span className="test-evidence-video-chip">视频</span>
                      </>
                    ) : (
                      <img src={attachment.src} alt={attachment.alt} loading="lazy" />
                    )}
                    {uploading ? <span className="test-evidence-uploading-chip">上传中</span> : null}
                  </button>
                  <button
                    aria-label={`删除附件 ${index + 1}`}
                    className="test-evidence-attachment-remove"
                    type="button"
                    onClick={() => updateEvidence(
                      textDraft,
                      attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
                  )}
                >
                    <X size={13} />
                  </button>
                </figure>
              )
            })}
          </div>
        ) : null}
        <MentionTextarea
          className="test-evidence-textarea"
          members={mentionMembers}
          placeholder={placeholder}
          value={textDraft}
          onChange={(nextText) => {
            setTextDraft(nextText)
            updateEvidence(nextText, attachments)
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDrop={(event) => {
            void handleDrop(event)
          }}
          onPaste={(event) => {
            void handlePaste(event)
          }}
        />
        <input
          ref={fileInputRef}
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="test-evidence-file-input"
          multiple
          type="file"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            void handleFiles(files)
          }}
        />
      </div>
      <EvidencePreviewDialog
        attachment={previewAttachment}
        onClose={() => setPreviewIndex(null)}
      />
    </section>
  )
}

function EvidencePreviewDialog({ attachment, onClose }: {
  attachment: BugEvidenceAttachment | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="test-evidence-preview-dialog" showCloseButton={false}>
        <DialogTitle className="test-evidence-preview-title">附件预览</DialogTitle>
        {attachment ? (
          <div className="test-evidence-preview-shell">
            {attachment.type === 'video' ? (
              <video className="test-evidence-preview-media" controls src={attachment.src} />
            ) : (
              <img className="test-evidence-preview-media" src={attachment.src} alt={attachment.alt} />
            )}
            <button
              aria-label="关闭附件预览"
              className="test-evidence-preview-close"
              type="button"
              onClick={onClose}
            >
              <XCircle size={18} weight="fill" />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function BugEvidenceContent({ content, emptyText = '未填写', title = '附件' }: {
  content: string
  emptyText?: string
  title?: string
}) {
  const { attachments, text } = useMemo(() => parseBugEvidenceContent(content), [content])
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const previewAttachment = previewIndex == null ? null : attachments[previewIndex] ?? null

  useEffect(() => {
    if (previewIndex != null && !attachments[previewIndex]) setPreviewIndex(null)
  }, [attachments, previewIndex])

  return (
    <div className="test-evidence-content">
      {text.trim() ? <p>{text}</p> : attachments.length === 0 ? <p>{emptyText}</p> : null}
      {attachments.length > 0 ? (
        <div className="test-evidence-viewer-attachments" aria-label={`${title}包含 ${attachments.length} 个附件`}>
          {attachments.map((attachment, index) => (
            <figure className="test-evidence-viewer-attachment" key={`${attachment.src.slice(0, 48)}-${index}`}>
              <button
                aria-label={`查看${attachment.type === 'video' ? '视频' : '图片'} ${index + 1}`}
                className="test-evidence-attachment-preview"
                type="button"
                onClick={() => setPreviewIndex(index)}
              >
                {attachment.type === 'video' ? (
                  <>
                    <video src={attachment.src} muted preload="metadata" />
                    <span className="test-evidence-video-chip">视频</span>
                  </>
                ) : (
                  <img src={attachment.src} alt={attachment.alt} loading="lazy" />
                )}
              </button>
            </figure>
          ))}
        </div>
      ) : null}
      <EvidencePreviewDialog attachment={previewAttachment} onClose={() => setPreviewIndex(null)} />
    </div>
  )
}

function DetailBlock({ content, title }: { content: string; title: string }) {
  return (
    <section className="test-detail-block">
      <h3>{title}</h3>
      <BugEvidenceContent content={content} title={title} />
    </section>
  )
}

function TestSpaceCreateDialog({ busy, onOpenChange, onSubmit, open, organizations }: {
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string, versionLabel: string, organizationId?: number) => Promise<boolean>
  open: boolean
  organizations: TestSpaceSettings['organizations']
}) {
  const [name, setName] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [organizationValue, setOrganizationValue] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
      setVersionLabel('')
      setOrganizationValue('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-workbench-dialog">
        <DialogHeader>
          <DialogTitle>新建测试空间</DialogTitle>
          <DialogDescription>测试空间用于隔离测试对象、用例、计划和 Bug，也可以归属到你所在的组织。</DialogDescription>
        </DialogHeader>
        <form
          className="test-dialog-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const saved = await onSubmit(
              name,
              versionLabel,
              organizationValue ? Number(organizationValue) : undefined,
            )
            if (saved) {
              setName('')
              setVersionLabel('')
              setOrganizationValue('')
            }
          }}
        >
          <Label>
            空间名称
            <Input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Sealos Pro 测试组" />
          </Label>
          <Label>
            版本号
            <Input maxLength={80} value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="例如：v1.2.3" />
          </Label>
          <Label>
            归属组织
            <Select value={organizationValue} onValueChange={setOrganizationValue}>
              <SelectTrigger aria-label="测试空间归属组织"><SelectValue placeholder="选择归属组织" /></SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={String(organization.id)}>{organization.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={busy || !name.trim() || !versionLabel.trim() || !organizationValue}><Plus /> 创建空间</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TestSpaceDataImportDialog({ busy, error, onOpenChange, onSubmit, open, spaces, targetSpaceId }: {
  busy: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onSubmit: (sources: TestSpaceImportSource[]) => Promise<TestSpaceDataImportResult | null>
  open: boolean
  spaces: TestSpaceSettings['spaces']
  targetSpaceId: number
}) {
  const [selections, setSelections] = useState<Record<number, TestSpaceImportCategory[]>>({})
  const [status, setStatus] = useState('')
  const sourceSpaces = spaces.filter((space) => space.accessLevel === 'owner' && space.id !== targetSpaceId)
  const options: Array<{ category: TestSpaceImportCategory; label: string; action: string }> = [
    { action: '复制到当前空间', category: 'cases', label: '全部用例' },
    { action: '复制到当前空间', category: 'plans', label: '全部测试计划' },
  ]

  useEffect(() => {
    if (open) {
      setSelections({})
      setStatus('')
    }
  }, [open, targetSpaceId])

  function toggleCategory(spaceId: number, category: TestSpaceImportCategory, checked: boolean) {
    setSelections((current) => {
      const categories = new Set(current[spaceId] ?? [])
      if (checked) categories.add(category)
      else categories.delete(category)
      return { ...current, [spaceId]: Array.from(categories) }
    })
  }

  function toggleSpace(spaceId: number, checked: boolean) {
    setSelections((current) => ({
      ...current,
      [spaceId]: checked ? options.map((option) => option.category) : [],
    }))
  }

  async function submit() {
    const sources = Object.entries(selections)
      .map(([spaceId, categories]) => ({ categories, spaceId: Number(spaceId) }))
      .filter((source) => source.categories.length > 0)
    if (sources.length === 0) return
    const result = await onSubmit(sources)
    if (!result) return
    setStatus(`已复制 ${result.copiedCases} 个用例、${result.copiedPlans} 个测试计划`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-space-data-import-dialog">
        <DialogHeader>
          <DialogTitle>数据转入</DialogTitle>
          <DialogDescription>选择来源测试空间和要转入的数据。</DialogDescription>
        </DialogHeader>
        <WorkspaceError message={error} />
        <div className="test-space-import-list">
          {sourceSpaces.length === 0 ? <p className="test-list-empty">没有可用的来源测试空间。</p> : sourceSpaces.map((space) => {
            const selected = selections[space.id] ?? []
            return (
              <section className="test-space-import-source" key={space.id}>
                <div className="test-space-import-source-heading">
                  <label><Checkbox aria-label={`选择${space.name}`} checked={selected.length === options.length ? true : selected.length > 0 ? 'indeterminate' : false} onCheckedChange={(checked) => toggleSpace(space.id, checked === true)} /><strong>{space.name}</strong></label>
                  <small>{space.versionLabel || '未指定版本号'}</small>
                </div>
                <div className="test-space-import-options">
                  {options.map((option) => (
                    <label key={option.category}>
                      <Checkbox checked={selected.includes(option.category)} onCheckedChange={(checked) => toggleCategory(space.id, option.category, checked === true)} />
                      <span>{option.label}</span>
                      <Badge variant="outline">{option.action}</Badge>
                    </label>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
        {status ? <p className="test-space-import-status">{status}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button disabled={busy || Object.values(selections).every((categories) => categories.length === 0)} onClick={() => void submit()}><DownloadSimple />{busy ? '转入中...' : '开始转入'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TestSpaceSettingsDialog({ currentSpaceId, onCreateSpace, onOpenChange, onWorkbenchChange, open }: {
  currentSpaceId?: number
  onCreateSpace: () => void
  onOpenChange: (open: boolean) => void
  onWorkbenchChange: () => Promise<void>
  open: boolean
}) {
  const [settings, setSettings] = useState<TestSpaceSettings>(emptyTestSpaceSettings)
  const [selectedSpaceId, setSelectedSpaceId] = useState<number>()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [organizationValue, setOrganizationValue] = useState('none')
  const [inviteUsername, setInviteUsername] = useState('')
  const [memberAccess, setMemberAccess] = useState<'editor' | 'viewer'>('editor')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [inviteLinkAccess, setInviteLinkAccess] = useState<'editor' | 'viewer'>('editor')
  const [inviteExpiresInMinutes, setInviteExpiresInMinutes] = useState(10)
  const [encryptedInviteShare, setEncryptedInviteShare] = useState(false)
  const [inviteLinkStatus, setInviteLinkStatus] = useState('')
  const [dataImportOpen, setDataImportOpen] = useState(false)
  const [dataImportBusy, setDataImportBusy] = useState(false)
  const [dataImportError, setDataImportError] = useState('')
  const selectedSpace = settings.spaces.find((space) => space.id === selectedSpaceId)
  const isOwner = selectedSpace?.accessLevel === 'owner'

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    fetchTestSpaceSettings()
      .then((result) => {
        setSettings(result)
        setSelectedSpaceId((current) => {
          if (result.spaces.some((space) => space.id === current)) return current
          if (result.spaces.some((space) => space.id === currentSpaceId)) return currentSpaceId
          return result.spaces[0]?.id
        })
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '测试空间加载失败。'))
      .finally(() => setLoading(false))
  }, [currentSpaceId, open])

  useEffect(() => {
    setRenameValue(selectedSpace?.name ?? '')
    setVersionLabel(selectedSpace?.versionLabel ?? '')
    setOrganizationValue(selectedSpace?.organizationId ? String(selectedSpace.organizationId) : 'none')
    setDeleteConfirmation('')
    setInviteUsername('')
    setInviteLinkStatus('')
  }, [selectedSpace?.id, selectedSpace?.name, selectedSpace?.organizationId, selectedSpace?.versionLabel])

  async function mutateSettings(
    operation: () => Promise<TestSpaceSettings>,
    onSuccess?: (result: TestSpaceSettings) => void,
  ) {
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      setSettings(result)
      onSuccess?.(result)
      await onWorkbenchChange()
      return true
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '测试空间保存失败。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function copyInviteLink() {
    if (!selectedSpace || !isOwner) return
    setBusy(true)
    setInviteLinkStatus('')
    try {
      const password = encryptedInviteShare ? generateTestSpaceInvitePassword() : undefined
      const inviteLink = await createTestSpaceInviteLink(selectedSpace.id, {
        accessLevel: inviteLinkAccess,
        expiresInMinutes: inviteExpiresInMinutes,
        password,
      })
      const inviteUrl = buildTestSpaceInviteUrl(inviteLink.token)
      const shareText = password
        ? `邀请你加入 ${selectedSpace.name} 测试空间，请点击此链接进入：${inviteUrl}，密码：${password}`
        : inviteUrl
      if (!navigator.clipboard) throw new Error('Clipboard is not available')
      await navigator.clipboard.writeText(shareText)
      setInviteLinkStatus(`已复制，${formatInviteDuration(inviteLink.expiresInMinutes)}内有效`)
    } catch {
      setInviteLinkStatus('复制失败，请稍后再试。')
    } finally {
      setBusy(false)
    }
  }

  async function importData(sources: TestSpaceImportSource[]) {
    if (!selectedSpace || !isOwner) return null
    setDataImportBusy(true)
    setDataImportError('')
    try {
      const result = await importTestSpaceData(selectedSpace.id, sources)
      setSettings(result.settings)
      await onWorkbenchChange()
      return result.result
    } catch (mutationError) {
      setDataImportError(mutationError instanceof Error ? mutationError.message : '数据转入失败。')
      return null
    } finally {
      setDataImportBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent fixedHeader className="test-space-admin-dialog">
        <DialogHeader>
          <DialogTitle>管理测试空间</DialogTitle>
          <DialogDescription>维护测试空间信息、组织归属、成员与协作权限。</DialogDescription>
        </DialogHeader>
        <WorkspaceError message={error} />
        {loading ? <p className="test-list-empty">正在加载测试空间...</p> : (
          <div className="test-space-admin-layout">
            <section className="test-space-admin-list-pane">
              <div className="test-space-admin-list-toolbar">
                <strong>我的测试空间</strong>
                <Button type="button" variant="outline" onClick={onCreateSpace}><Plus /> 新建</Button>
              </div>
              <div className="test-space-admin-list">
                {settings.spaces.map((space) => (
                  <button key={space.id} type="button" className={space.id === selectedSpaceId ? 'active' : ''} onClick={() => setSelectedSpaceId(space.id)}>
                    <strong>{space.name}</strong>
                    <small>{space.accessLevel === 'owner' ? '所有者' : space.accessLevel === 'editor' ? '可编辑' : '只读'} · {space.members.filter((member) => member.status === 'active').length} 位成员 · {space.organizationName ?? '无组织'}</small>
                  </button>
                ))}
                {settings.spaces.length === 0 ? <p className="test-list-empty">还没有已加入的测试空间。</p> : null}
              </div>
            </section>

            <section className="test-space-admin-detail">
              {selectedSpace ? (
                <>
                  {isOwner ? (
                    <form className="test-space-settings-row" onSubmit={(event) => {
                      event.preventDefault()
                      void mutateSettings(() => updateTestSpace(selectedSpace.id, {
                        name: renameValue,
                        organizationId: organizationValue === 'none' ? undefined : Number(organizationValue),
                        versionLabel,
                      }))
                    }}>
                      <Label>空间名称<Input maxLength={80} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></Label>
                      <Label>版本号<Input maxLength={80} value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} /></Label>
                      <Label>归属组织
                        <Select value={organizationValue} onValueChange={setOrganizationValue}>
                          <SelectTrigger aria-label="测试空间归属组织"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不归属组织</SelectItem>
                            {settings.organizations.map((organization) => (
                              <SelectItem key={organization.id} value={String(organization.id)}>{organization.name}</SelectItem>
                            ))}
                            {selectedSpace.organizationId && !settings.organizations.some((organization) => organization.id === selectedSpace.organizationId) ? (
                              <SelectItem disabled value={String(selectedSpace.organizationId)}>{selectedSpace.organizationName ?? '当前组织'}</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </Label>
                      <Button variant="outline" disabled={busy || !renameValue.trim() || (
                        renameValue.trim() === selectedSpace.name
                        && versionLabel.trim() === (selectedSpace.versionLabel ?? '')
                        && organizationValue === (selectedSpace.organizationId ? String(selectedSpace.organizationId) : 'none')
                      )}><PencilSimple /> 保存修改</Button>
                    </form>
                  ) : <div className="test-space-readonly-heading">
                    <div><span>空间名称</span><strong>{selectedSpace.name}</strong></div>
                    <div><span>版本号</span><strong>{selectedSpace.versionLabel || '未指定'}</strong></div>
                    <div><span>归属组织</span><strong>{selectedSpace.organizationName ?? '不归属组织'}</strong></div>
                    <Badge variant="outline">{selectedSpace.accessLevel === 'editor' ? '可编辑' : '只读'}</Badge>
                  </div>}

                  {isOwner ? <section className="test-space-data-import-entry">
                    <div><span>数据转入</span><small>用例、测试计划复制</small></div>
                    <Button type="button" variant="outline" disabled={busy || dataImportBusy} onClick={() => { setDataImportError(''); setDataImportOpen(true) }}><DownloadSimple /> 数据转入</Button>
                  </section> : null}

                  <section className="test-space-members-section">
                    <div className="test-space-admin-section-heading">
                      <div>
                        <span>成员与邀请</span>
                        <strong>{selectedSpace.members.length}</strong>
                      </div>
                    </div>
                    {isOwner ? <form
                      className="test-space-member-add-row"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        if (!inviteUsername.trim()) return
                        const saved = await mutateSettings(() => inviteTestSpaceMember(selectedSpace.id, inviteUsername.trim(), memberAccess))
                        if (saved) setInviteUsername('')
                      }}
                    >
                      <Input autoComplete="username" value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} placeholder="输入测试工程师用户名" />
                      <Select value={memberAccess} onValueChange={(value) => setMemberAccess(value as 'editor' | 'viewer')}>
                        <SelectTrigger aria-label="成员权限"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="editor">可编辑</SelectItem><SelectItem value="viewer">只读</SelectItem></SelectContent>
                      </Select>
                      <Button size="icon" variant="outline" aria-label="邀请空间成员" title="邀请空间成员" disabled={busy || !inviteUsername.trim()}><UserPlus /></Button>
                    </form> : null}
                    <div className="test-space-member-list">
                      {selectedSpace.members.map((member) => (
                        <article key={member.userId}>
                          <div><strong>{member.displayName}</strong><small>{member.username} · {member.status === 'pending' ? '待接受' : '已加入'}</small></div>
                          {member.accessLevel === 'owner' ? <Badge variant="outline">所有者</Badge> : (
                            isOwner ? <Select value={member.accessLevel} onValueChange={(value) => void mutateSettings(() => updateTestSpaceMember(selectedSpace.id, member.userId, value as 'editor' | 'viewer'))} disabled={busy}>
                              <SelectTrigger aria-label={`${member.displayName}的空间权限`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">可编辑</SelectItem><SelectItem value="viewer">只读</SelectItem></SelectContent>
                            </Select> : <Badge variant="outline">{member.accessLevel === 'editor' ? '可编辑' : '只读'}</Badge>
                          )}
                          {member.accessLevel === 'owner' || !isOwner ? <span /> : (
                            <Button size="icon" variant="ghost" aria-label={`移除成员${member.displayName}`} title="移除成员" disabled={busy} onClick={() => void mutateSettings(() => removeTestSpaceMember(selectedSpace.id, member.userId))}><Trash /></Button>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>

                  {isOwner ? <section className="test-space-invite-link-section">
                    <div className="test-space-admin-section-heading"><div><span>邀请链接</span><strong>{inviteLinkAccess === 'editor' ? '可编辑' : '只读'}</strong></div></div>
                    <p>{selectedSpace.organizationId ? '复制给组织成员，对方登录并切换到测试工程师身份后即可加入。' : '复制给测试工程师，对方登录并切换到测试工程师身份后即可加入。'}</p>
                    <div className="test-space-invite-link-controls">
                      <Select value={String(inviteExpiresInMinutes)} onValueChange={(value) => { setInviteExpiresInMinutes(Number(value)); setInviteLinkStatus('') }}>
                        <SelectTrigger aria-label="邀请链接有效时长"><SelectValue /></SelectTrigger>
                        <SelectContent>{[10, 30, 60, 240, 1440].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{formatInviteDuration(minutes)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={inviteLinkAccess} onValueChange={(value) => { setInviteLinkAccess(value as 'editor' | 'viewer'); setInviteLinkStatus('') }}>
                        <SelectTrigger aria-label="邀请链接成员权限"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="editor">可编辑</SelectItem><SelectItem value="viewer">只读</SelectItem></SelectContent>
                      </Select>
                      <label><input type="checkbox" checked={encryptedInviteShare} onChange={(event) => { setEncryptedInviteShare(event.target.checked); setInviteLinkStatus('') }} /> 加密分享</label>
                      <Button variant="outline" disabled={busy} onClick={() => void copyInviteLink()}><CopySimple /> {inviteLinkStatus.startsWith('已复制') ? '已复制' : '复制链接'}</Button>
                    </div>
                    {inviteLinkStatus ? <small>{inviteLinkStatus}</small> : null}
                  </section> : null}

                  {isOwner ? <form
                    className="test-space-danger-zone"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      await mutateSettings(
                        () => deleteTestSpace(selectedSpace.id, deleteConfirmation),
                        (result) => setSelectedSpaceId(result.spaces[0]?.id),
                      )
                    }}
                  >
                    <div><strong>删除测试空间</strong><small>将永久删除空间内全部测试对象、用例、计划、Bug 和评论。</small></div>
                    <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={`输入“${selectedSpace.name}”确认`} />
                    <Button variant="destructive" disabled={busy || deleteConfirmation !== selectedSpace.name}><Trash /> 删除</Button>
                  </form> : null}
                </>
              ) : <div className="test-detail-empty"><GearSix size={28} /><p>创建测试空间后即可维护成员和权限。</p></div>}
            </section>
          </div>
        )}
        </DialogContent>
      </Dialog>
      {selectedSpace ? <TestSpaceDataImportDialog
        busy={dataImportBusy}
        error={dataImportError}
        onOpenChange={setDataImportOpen}
        onSubmit={importData}
        open={dataImportOpen && Boolean(isOwner)}
        spaces={settings.spaces}
        targetSpaceId={selectedSpace.id}
      /> : null}
    </>
  )
}

function TestSpaceInvitePasswordDialog({ busy, error, onCancel, onPasswordChange, onSubmit, open, password }: {
  busy: boolean
  error: string
  onCancel: () => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  open: boolean
  password: string
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel() }}>
      <DialogContent fixedHeader className="test-workbench-dialog">
        <DialogHeader><DialogTitle>输入测试空间邀请密码</DialogTitle><DialogDescription>该邀请链接已开启加密分享，验证后会加入测试空间。</DialogDescription></DialogHeader>
        <form className="test-dialog-form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <Label>邀请密码<Input autoFocus type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} /></Label>
          {error ? <WorkspaceError message={error} /> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>取消</Button><Button disabled={busy || !password.trim()}>{busy ? '验证中...' : '验证并加入'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SubjectDialog({
  busy,
  onOpenChange,
  onSubmit,
  open,
  subject,
}: {
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { description: string; environment: string; name: string; versionLabel: string }) => Promise<boolean>
  open: boolean
  subject?: TestSubject
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [environment, setEnvironment] = useState('')
  useEffect(() => {
    if (!open) return
    setName(subject?.name ?? '')
    setDescription(subject?.description ?? '')
    setVersionLabel(subject?.versionLabel ?? '')
    setEnvironment(subject?.environment ?? '')
  }, [open, subject?.description, subject?.environment, subject?.id, subject?.name, subject?.versionLabel])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-wide-dialog">
        <DialogHeader>
          <DialogTitle>{subject ? '编辑测试对象' : '新建测试对象'}</DialogTitle>
          <DialogDescription>测试对象独立存在，用于承载对象版本、环境和用例。</DialogDescription>
        </DialogHeader>
        <form className="test-dialog-form" onSubmit={async (event) => {
          event.preventDefault()
          if (!name.trim()) return
          const saved = await onSubmit({ description, environment, name, versionLabel })
          if (saved) onOpenChange(false)
        }}>
          <Label>名称<Input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Label>
          <Label>说明<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Label>
          <div className="test-form-grid">
            <Label>当前版本<Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="v1.0.0" /></Label>
            <Label>默认环境<Input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="测试环境" /></Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={busy || !name.trim()}>{busy ? (subject ? '保存中...' : '创建中...') : (subject ? '保存' : '创建')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FolderDialog({
  busy,
  cases,
  folders,
  onCreate,
  onDelete,
  onOpenChange,
  onRename,
  open,
  subject,
}: {
  busy: boolean
  cases: TestCase[]
  folders: TestWorkbenchData['folders']
  onCreate: (name: string) => Promise<boolean>
  onDelete: (folder: TestWorkbenchData['folders'][number]) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  onRename: (folder: TestWorkbenchData['folders'][number], name: string) => Promise<boolean>
  open: boolean
  subject?: TestSubject
}) {
  const [newName, setNewName] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!open) return
    setDrafts(Object.fromEntries(folders.map((folder) => [folder.id, folder.name])))
    setNewName('')
  }, [folders, open])

  const caseCountByFolder = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of cases) {
      if (item.folderId) counts.set(item.folderId, (counts.get(item.folderId) ?? 0) + 1)
    }
    return counts
  }, [cases])

  async function createFolder() {
    const saved = await onCreate(newName)
    if (saved) setNewName('')
  }

  async function renameFolder(folder: TestWorkbenchData['folders'][number]) {
    const nextName = (drafts[folder.id] ?? '').trim()
    if (!nextName || nextName === folder.name) return
    await onRename(folder, nextName)
  }

  async function deleteFolder(folder: TestWorkbenchData['folders'][number]) {
    const count = caseCountByFolder.get(folder.id) ?? 0
    const suffix = count > 0
      ? `该模块下 ${count} 条用例会变为“未分类”，用例本身不会删除。`
      : '该模块下没有用例。'
    if (!window.confirm(`确定删除模块“${folder.name}”吗？${suffix}`)) return
    await onDelete(folder)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-wide-dialog test-folder-dialog">
        <DialogHeader>
          <DialogTitle>管理用例模块</DialogTitle>
          <DialogDescription>
            管理“{subject?.name || '当前测试对象'}”下的模块路径。删除模块不会删除用例，只会清空这些用例的模块归属。
          </DialogDescription>
        </DialogHeader>
        <div className="test-folder-create-row">
          <Input
            autoFocus
            maxLength={240}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (!busy && newName.trim()) void createFolder()
              }
            }}
            placeholder="例如：/DevBox/业务/创建"
          />
          <Button type="button" disabled={busy || !newName.trim()} onClick={() => void createFolder()}><Plus /> 新增模块</Button>
        </div>
        <div className="test-folder-list">
          {folders.length ? folders.map((folder) => {
            const draft = drafts[folder.id] ?? folder.name
            const unchanged = draft.trim() === folder.name
            return (
              <article key={folder.id} className="test-folder-row">
                <div className="test-folder-row-meta">
                  <Input
                    maxLength={240}
                    value={draft}
                    onChange={(event) => setDrafts((current) => ({ ...current, [folder.id]: event.target.value }))}
                  />
                  <small>{caseCountByFolder.get(folder.id) ?? 0} 条用例</small>
                </div>
                <div className="test-folder-row-actions">
                  <Button type="button" variant="outline" disabled={busy || !draft.trim() || unchanged} onClick={() => void renameFolder(folder)}><PencilSimple /> 保存</Button>
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => void deleteFolder(folder)}><Trash /> 删除</Button>
                </div>
              </article>
            )
          }) : (
            <div className="test-folder-empty">当前测试对象还没有模块，创建用例或导入用例时也会自动生成模块。</div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type TestCaseFormPayload = {
  caseKind?: TestCase['caseKind']
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
}

function CaseDialog({ busy, data, onOpenChange, onSubmit, open, spaceId, subjectId, testCase }: { busy: boolean; data: TestWorkbenchData; onOpenChange: (open: boolean) => void; onSubmit: (payload: TestCaseFormPayload) => void; open: boolean; spaceId?: number; subjectId?: number; testCase?: TestCase }) {
  const key = `${open}-${testCase?.id ?? 'new'}`
  return <CaseDialogForm key={key} {...{ busy, data, onOpenChange, onSubmit, open, spaceId, subjectId, testCase }} />
}

function CaseDialogForm({ busy, data, onOpenChange, onSubmit, open, spaceId, subjectId, testCase }: Parameters<typeof CaseDialog>[0]) {
  const folders = data.folders.filter((folder) => folder.testSpaceId === spaceId && folder.testSubjectId === subjectId)
  const initialModule = folders.find((folder) => folder.id === testCase?.folderId)?.name ?? ''
  const [title, setTitle] = useState(testCase?.title ?? '')
  const [modulePath, setModulePath] = useState(initialModule)
  const [preconditions, setPreconditions] = useState(testCase?.preconditions ?? '')
  const [steps, setSteps] = useState(testCase?.steps ?? '')
  const [expectedResult, setExpectedResult] = useState(testCase?.expectedResult ?? '')
  const [remarks, setRemarks] = useState(testCase?.remarks ?? '')
  const [priority, setPriority] = useState<Priority>(testCase?.priority ?? 'medium')
  const [caseKind, setCaseKind] = useState<TestCase['caseKind']>(testCase?.caseKind ?? 'functional')
  const [caseType, setCaseType] = useState<TestCaseType>(testCase?.caseType ?? 'functional')
  const [customTagsInput, setCustomTagsInput] = useState(testCase?.customTags.join('、') ?? '')
  const [modulePickerOpen, setModulePickerOpen] = useState(false)
  const moduleSuggestions = useMemo(() => {
    const keyword = modulePath.trim().toLowerCase()
    const matched = keyword
      ? folders.filter((folder) => folder.name.toLowerCase().includes(keyword))
      : folders
    return matched.slice(0, 12)
  }, [folders, modulePath])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-wide-dialog test-case-dialog">
        <DialogHeader>
          <DialogTitle>{testCase ? `编辑 CASE-${testCase.id}` : '新建测试用例'}</DialogTitle>
          <DialogDescription>按执行顺序记录用例，加入测试计划后会保留不可变快照。</DialogDescription>
        </DialogHeader>
        <form
          className="test-dialog-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({
              caseKind,
              caseType,
              customTags: Array.from(new Set(customTagsInput.split(/[,，;；、\s]+/).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12),
              expectedResult,
              modulePath: modulePath.trim(),
              preconditions,
              priority,
              remarks,
              steps,
              testSubjectId: subjectId!,
              title,
            })
          }}
        >
          <fieldset className="test-dialog-section">
            <legend>基础信息</legend>
            <Label>用例名称<Input autoFocus maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></Label>
            <Label>
              所属模块
              <div className="test-module-combobox">
                <Input
                  maxLength={240}
                  value={modulePath}
                  onBlur={() => window.setTimeout(() => setModulePickerOpen(false), 120)}
                  onChange={(event) => {
                    setModulePath(event.target.value)
                    setModulePickerOpen(true)
                  }}
                  onFocus={() => setModulePickerOpen(true)}
                  placeholder="例如：/DevBox/业务/创建"
                />
                <button
                  type="button"
                  className="test-module-combobox-toggle"
                  aria-label={modulePickerOpen ? '收起模块列表' : '展开模块列表'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setModulePickerOpen((current) => !current)}
                >
                  <CaretDown size={18} weight="bold" />
                </button>
                {modulePickerOpen && folders.length ? (
                  <div className="test-module-suggestions" role="listbox">
                    {moduleSuggestions.length ? moduleSuggestions.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className="test-module-suggestion"
                        role="option"
                        aria-selected={folder.name === modulePath}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setModulePath(folder.name)
                          setModulePickerOpen(false)
                        }}
                      >
                        {folder.name}
                      </button>
                    )) : (
                      <div className="test-module-suggestion-empty">没有匹配的模块，可直接输入新模块。</div>
                    )}
                  </div>
                ) : null}
              </div>
            </Label>
            <div className="test-form-grid test-case-classification-grid">
              <Label>用例分类<Select value={caseKind} onValueChange={(value) => setCaseKind(value as TestCase['caseKind'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="functional">功能用例</SelectItem><SelectItem value="baseline">基线用例</SelectItem></SelectContent></Select></Label>
              <Label>用例等级<Select value={priority} onValueChange={(value) => setPriority(value as Priority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">P0</SelectItem><SelectItem value="medium">P1</SelectItem><SelectItem value="low">P2</SelectItem></SelectContent></Select></Label>
              <Label>类型<Select value={caseType} onValueChange={(value) => setCaseType(value as TestCaseType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(caseTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Label>
            </div>
            <Label>自定义标签<Input maxLength={500} value={customTagsInput} onChange={(event) => setCustomTagsInput(event.target.value)} placeholder="例如：核心流程、兼容性、支付" /></Label>
          </fieldset>
          <fieldset className="test-dialog-section">
            <legend>执行内容</legend>
            <Label>前置条件<Textarea maxLength={5000} value={preconditions} onChange={(event) => setPreconditions(event.target.value)} /></Label>
            <Label>步骤描述<Textarea maxLength={10000} value={steps} onChange={(event) => setSteps(event.target.value)} /></Label>
            <Label>预期结果<Textarea maxLength={10000} value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} /></Label>
            <Label>备注<Textarea maxLength={5000} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></Label>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy || !title.trim() || !modulePath.trim()}>{testCase ? '保存修改' : '创建用例'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/gu, '""')}"`
}

function downloadTestCaseCsv(cases: TestCase[], folders: TestCaseFolder[]) {
  const rows = cases.map((testCase) => [
    testCase.title,
    folders.find((folder) => folder.id === testCase.folderId)?.name || '未分类',
    testCase.preconditions,
    testCase.steps,
    testCase.expectedResult,
    testCase.remarks,
    caseLevelLabel[testCase.priority],
    testCase.customTags.join('、'),
  ])
  const csvContent = `\uFEFF${[testCaseCsvTemplateHeaders, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '测试用例.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadTestCaseCsvTemplate() {
  const csvContent = `\uFEFF${testCaseCsvTemplateHeaders.join(',')}\r\n`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '测试用例导入模板.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function ImportCasesDialog({ busy, onOpenChange, onSubmit, open, spaceId, subject }: {
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (csvText: string) => Promise<boolean>
  open: boolean
  spaceId?: number
  subject?: TestWorkbenchData['subjects'][number]
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<TestCaseImportPreview>()
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setFileName('')
    setCsvText('')
    setPreview(undefined)
    setPreviewing(false)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !spaceId || !subject) return
    setError('')
    setPreview(undefined)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('请选择 CSV 文件。')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('CSV 文件不能超过 2 MB。')
      return
    }
    setFileName(file.name)
    setPreviewing(true)
    try {
      const content = await file.text()
      const result = await previewTestCaseImport(spaceId, subject.id, content)
      setCsvText(content)
      setPreview(result.preview)
    } catch (previewError) {
      setCsvText('')
      setError(previewError instanceof Error ? previewError.message : 'CSV 校验失败。')
    } finally {
      setPreviewing(false)
    }
  }

  async function confirmImport() {
    if (!csvText || !preview) return
    const imported = await onSubmit(csvText)
    if (imported) changeOpen(false)
    else setError('导入失败，请根据工作台中的错误提示检查文件。')
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent fixedHeader className="test-wide-dialog test-import-dialog">
        <DialogHeader>
          <DialogTitle>导入用例</DialogTitle>
          <DialogDescription>CSV 中的用例将导入到“{subject?.name || '当前测试对象'}”，新模块会自动创建。</DialogDescription>
        </DialogHeader>
        <div className="test-import-picker">
          <input ref={fileInputRef} hidden accept=".csv,text/csv" type="file" onChange={(event) => void selectFile(event)} />
          <FileCsv size={28} weight="duotone" />
          <div className="test-import-picker-copy"><strong>{fileName || '选择 CSV 文件'}</strong><small>支持 UTF-8、最多 1000 条、文件不超过 2 MB</small></div>
          <div className="test-import-picker-actions">
            <Button type="button" variant="outline" onClick={downloadTestCaseCsvTemplate}><DownloadSimple /> 下载模板</Button>
            <Button type="button" variant="outline" disabled={previewing || busy} onClick={() => fileInputRef.current?.click()}><UploadSimple /> {fileName ? '重新选择' : '选择文件'}</Button>
          </div>
        </div>
        {previewing ? <p className="test-import-status">正在校验字段与内容...</p> : null}
        {error ? <div className="test-workbench-error"><WarningCircle /> {error}</div> : null}
        {preview ? (
          <div className="test-import-preview">
            <div className="test-import-metrics">
              <span><strong>{preview.rowCount}</strong> 条用例</span>
              <span><strong>{preview.moduleCount}</strong> 个模块</span>
              <span><strong>{preview.levelCounts.P0}</strong> P0</span>
              <span><strong>{preview.levelCounts.P1}</strong> P1</span>
              <span><strong>{preview.levelCounts.P2}</strong> P2</span>
            </div>
            <div className="test-import-samples">
              <span>内容预览</span>
              {preview.sampleTitles.map((title, index) => <p key={`${title}-${index}`}><code>{index + 1}</code>{title}</p>)}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>取消</Button>
          <Button type="button" disabled={busy || previewing || !preview} onClick={() => void confirmImport()}>{busy ? '导入中...' : preview ? `导入 ${preview.rowCount} 条用例` : '确认导入'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type TestPlanFormPayload = {
  caseIds: number[]
  endsOn?: string
  environment: string
  name: string
  ownerUserId?: number
  projectId?: number
  startsOn?: string
  testSubjectIds: number[]
  versionLabel: string
}

function PlanDialog({ busy, cases, folders, onOpenChange, onSubmit, open, plan, planCases, projects, subjects, users }: {
  busy: boolean
  cases: TestCase[]
  folders: TestWorkbenchData['folders']
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: TestPlanFormPayload) => void
  open: boolean
  plan?: TestPlan
  planCases: TestWorkbenchData['planCases']
  projects: TestWorkbenchProjectOption[]
  subjects: TestWorkbenchData['subjects']
  users: TestWorkbenchData['users']
}) {
  const [name, setName] = useState(plan?.name ?? '')
  const [versionLabel, setVersionLabel] = useState(plan?.versionLabel ?? '')
  const [environment, setEnvironment] = useState(plan?.environment ?? '')
  const [startsOn, setStartsOn] = useState(plan?.startsOn?.slice(0, 10) ?? '')
  const [endsOn, setEndsOn] = useState(plan?.endsOn?.slice(0, 10) ?? '')
  const [ownerUserId, setOwnerUserId] = useState(plan?.ownerUserId ? String(plan.ownerUserId) : 'none')
  const [projectId, setProjectId] = useState(plan?.projectId ? String(plan.projectId) : 'none')
  const [subjectIds, setSubjectIds] = useState<number[]>(plan?.testSubjectIds ?? [])
  const [caseIds, setCaseIds] = useState<number[]>([])
  const [caseSearchQuery, setCaseSearchQuery] = useState('')
  const [caseFolderFilter, setCaseFolderFilter] = useState('all')
  const [caseTypeFilter, setCaseTypeFilter] = useState('all')
  const [casePriorityFilter, setCasePriorityFilter] = useState('all')
  const [caseKindFilter, setCaseKindFilter] = useState('all')
  const [step, setStep] = useState<1 | 2>(1)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const existingCaseIds = new Set(planCases
    .filter((item) => item.testPlanId === plan?.id && item.testCaseId)
    .map((item) => item.testCaseId as number))
  const available = cases.filter((item) => subjectIds.includes(item.testSubjectId) && item.status === 'active' && !existingCaseIds.has(item.id))
  const availableFolders = folders.filter((folder) => available.some((item) => item.folderId === folder.id))
  const normalizedCaseQuery = caseSearchQuery.trim().toLocaleLowerCase('zh-CN')
  const filteredAvailable = available.filter((item) => {
    const folder = folders.find((candidate) => candidate.id === item.folderId)
    const matchesSearch = !normalizedCaseQuery || [
      `CASE-${item.id}`,
      item.title,
      folder?.name ?? '未分类',
      item.preconditions,
      item.steps,
      item.expectedResult,
      item.remarks,
      item.customTags.join(' '),
    ].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalizedCaseQuery))
    const matchesFolder = caseFolderFilter === 'all'
      || (caseFolderFilter === 'uncategorized' ? !item.folderId : String(item.folderId) === caseFolderFilter)
    return matchesSearch
      && matchesFolder
      && (caseTypeFilter === 'all' || item.caseType === caseTypeFilter)
      && (casePriorityFilter === 'all' || item.priority === casePriorityFilter)
      && (caseKindFilter === 'all' || item.caseKind === caseKindFilter)
  })
  const filteredCaseIds = filteredAvailable.map((item) => item.id)
  const selectedFilteredCount = filteredCaseIds.filter((id) => caseIds.includes(id)).length
  const allFilteredSelected = filteredCaseIds.length > 0 && selectedFilteredCount === filteredCaseIds.length
  const hasCaseFilters = Boolean(caseSearchQuery.trim())
    || caseFolderFilter !== 'all'
    || caseTypeFilter !== 'all'
    || casePriorityFilter !== 'all'
    || caseKindFilter !== 'all'
  const invalidDateRange = Boolean(startsOn && endsOn && startsOn > endsOn)
  const selectedSubjects = subjects.filter((subject) => subjectIds.includes(subject.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedFilteredCount > 0 && !allFilteredSelected
    }
  }, [allFilteredSelected, selectedFilteredCount])

  useEffect(() => {
    if (open) setStep(1)
  }, [open, plan?.id])

  const canGoNext = name.trim().length > 0 && !invalidDateRange
  const canSubmit = canGoNext && subjectIds.length > 0 && (Boolean(plan) || caseIds.length > 0)

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent fixedHeader className={`test-wide-dialog test-plan-dialog ${step === 2 ? 'test-plan-dialog-fixed' : 'test-plan-dialog-auto'}`}>
      <DialogHeader>
        <DialogTitle>{plan ? `编辑 PLAN-${plan.id}` : '新建测试计划'}</DialogTitle>
        <DialogDescription>{plan ? '先修改计划基础信息，再追加测试对象或活动用例。已有快照不会改变。' : '先填写计划基础信息，再选择测试对象和要纳入计划的用例。'}</DialogDescription>
      </DialogHeader>
      <form className="test-dialog-form test-plan-dialog-form" onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        onSubmit({
          caseIds,
          endsOn: endsOn || undefined,
          environment,
          name,
          ownerUserId: ownerUserId === 'none' ? undefined : Number(ownerUserId),
          projectId: projectId === 'none' ? undefined : Number(projectId),
          startsOn: startsOn || undefined,
          testSubjectIds: subjectIds,
          versionLabel,
        })
      }}>
        <div className="test-plan-stepper" aria-label="新建测试计划步骤">
          <button className={step === 1 ? 'active' : 'done'} type="button" onClick={() => setStep(1)}>
            <span>1</span>
            <strong>基础信息</strong>
          </button>
          <i aria-hidden="true" />
          <button className={step === 2 ? 'active' : ''} type="button" disabled={!canGoNext} onClick={() => setStep(2)}>
            <span>2</span>
            <strong>测试对象与用例</strong>
          </button>
        </div>
        {step === 1 ? (
          <section className="test-plan-step-panel test-plan-basic-panel" aria-label="计划基础信息">
            <Label>计划名称<Input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Label>
            <div className="test-form-grid test-plan-basic-grid">
              <Label>版本<Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} /></Label>
              <Label>环境<Input value={environment} onChange={(event) => setEnvironment(event.target.value)} /></Label>
              <Label>
                开始日期
                <JournalDatePicker
                  ariaLabel="选择测试计划开始日期"
                  datesWithEntries={[]}
                  displayValue={startsOn || '选择日期'}
                  value={startsOn}
                  onChange={setStartsOn}
                />
              </Label>
              <Label>
                结束日期
                <JournalDatePicker
                  ariaLabel="选择测试计划结束日期"
                  datesWithEntries={[]}
                  displayValue={endsOn || '选择日期'}
                  value={endsOn}
                  onChange={setEndsOn}
                />
              </Label>
            </div>
            <Label>负责人<Select value={ownerUserId} onValueChange={setOwnerUserId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未分配</SelectItem>{users.filter((user) => user.roles.includes('tester')).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.displayName}</SelectItem>)}</SelectContent></Select></Label>
            <Label>关联项目<Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">不关联项目</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent></Select></Label>
            {invalidDateRange ? <p className="test-form-error">结束日期不能早于开始日期。</p> : null}
          </section>
        ) : (
          <section className="test-plan-step-panel test-plan-scope-panel" aria-label="计划范围与用例">
            <div className="test-plan-scope-grid">
              <fieldset className="test-plan-subject-picker">
                <legend>测试对象</legend>
                <div className="test-plan-subject-list">
                  {subjects.length ? subjects.map((subject) => (
                    <label key={subject.id}>
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(subject.id)}
                        onChange={(event) => {
                          setSubjectIds((current) => event.target.checked
                            ? Array.from(new Set([...current, subject.id]))
                            : current.filter((id) => id !== subject.id))
                          if (!event.target.checked) {
                            setCaseIds((current) => current.filter((id) => cases.find((testCase) => testCase.id === id)?.testSubjectId !== subject.id))
                          }
                        }}
                      />
                      <span>
                        <strong>{subject.name}</strong>
                        <small>{[subject.versionLabel, subject.environment].filter(Boolean).join(' / ') || '未设置版本与环境'}</small>
                      </span>
                    </label>
                  )) : <p className="test-list-empty">当前测试空间还没有测试对象。</p>}
                </div>
                {selectedSubjects.length ? <small className="test-plan-subject-summary">已选 {selectedSubjects.map((subject) => subject.name).join('、')}</small> : null}
              </fieldset>
              <fieldset className="test-plan-case-picker">
                <legend>{plan ? '追加用例' : '选择用例'}</legend>
                <div className="test-plan-case-tools">
                  <div className="test-plan-case-search-row">
                    <label className="test-case-search">
                      <MagnifyingGlass />
                      <Input
                        type="search"
                        aria-label="搜索计划用例"
                        value={caseSearchQuery}
                        onChange={(event) => setCaseSearchQuery(event.target.value)}
                        placeholder="搜索编号、标题、模块或用例内容"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="清除计划用例筛选"
                      disabled={!hasCaseFilters}
                      onClick={() => {
                        setCaseSearchQuery('')
                        setCaseFolderFilter('all')
                        setCaseTypeFilter('all')
                        setCasePriorityFilter('all')
                        setCaseKindFilter('all')
                      }}
                    ><XCircle /> 清除</Button>
                  </div>
                  <div className="test-plan-case-filter-row">
                    <Select value={caseFolderFilter} onValueChange={setCaseFolderFilter}>
                      <SelectTrigger aria-label="计划用例所属模块筛选"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部模块</SelectItem>
                        <SelectItem value="uncategorized">未分类</SelectItem>
                        {availableFolders.map((folder) => <SelectItem key={folder.id} value={String(folder.id)}>{folder.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                      <SelectTrigger aria-label="计划用例类型筛选"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">全部类型</SelectItem>{Object.entries(caseTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={casePriorityFilter} onValueChange={setCasePriorityFilter}>
                      <SelectTrigger aria-label="计划用例等级筛选"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">全部等级</SelectItem><SelectItem value="high">P0</SelectItem><SelectItem value="medium">P1</SelectItem><SelectItem value="low">P2</SelectItem></SelectContent>
                    </Select>
                    <Select value={caseKindFilter} onValueChange={setCaseKindFilter}>
                      <SelectTrigger aria-label="计划用例分类筛选"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">全部分类</SelectItem><SelectItem value="functional">功能用例</SelectItem><SelectItem value="baseline">基线用例</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="test-plan-case-selection-bar">
                    <label>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allFilteredSelected}
                        disabled={filteredCaseIds.length === 0}
                        onChange={(event) => {
                          const filteredIds = new Set(filteredCaseIds)
                          setCaseIds((current) => event.target.checked
                            ? Array.from(new Set([...current, ...filteredCaseIds]))
                            : current.filter((id) => !filteredIds.has(id)))
                        }}
                      />
                      <span>{allFilteredSelected ? '取消全选当前结果' : '全选当前结果'}</span>
                    </label>
                    <small>{filteredAvailable.length} 条结果 · 已选 {caseIds.length} 条</small>
                  </div>
                </div>
                <div className="test-case-checklist" role="group" aria-label={plan ? '可追加用例' : '可选择用例'}>
                  {filteredAvailable.length ? filteredAvailable.map((item) => {
                    const folder = folders.find((candidate) => candidate.id === item.folderId)
                    return <label key={item.id}>
                      <input type="checkbox" checked={caseIds.includes(item.id)} onChange={(event) => setCaseIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                      <span className="test-plan-case-option">
                        <span><code>CASE-{item.id}</code><strong>{item.title}</strong></span>
                        <small>{subjects.find((subject) => subject.id === item.testSubjectId)?.name || '未知对象'} · {folder?.name || '未分类'} · {caseKindLabel[item.caseKind]} · {caseTypeLabel[item.caseType]} · {caseLevelLabel[item.priority]}</small>
                      </span>
                    </label>
                  }) : <p className="test-list-empty">{available.length ? '没有符合条件的可选用例。' : '没有可追加的活动用例。'}</p>}
                </div>
              </fieldset>
            </div>
          </section>
        )}
        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="button" disabled={!canGoNext} onClick={() => setStep(2)}>下一步</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>上一步</Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button disabled={busy || !canSubmit}>{plan ? '保存修改' : '创建计划'}</Button>
            </>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

type BugDialogPayload = {
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
}

function BugDialog({ busy, editing, environments, onOpenChange, onSubmit, open, seed, subjects, users }: { busy: boolean; editing: boolean; environments: TestEnvironment[]; onOpenChange: (open: boolean) => void; onSubmit: (payload: BugDialogPayload) => void; open: boolean; seed: Partial<TestBug>; subjects: TestSubject[]; users: TestWorkbenchData['users'] }) {
  return <BugDialogForm key={`${open}-${editing ? seed.id : seed.testPlanCaseId ?? 'new'}`} {...{ busy, editing, environments, onOpenChange, onSubmit, open, seed, subjects, users }} />
}

function BugDialogForm({ busy, editing, environments, onOpenChange, onSubmit, open, seed, subjects, users }: Parameters<typeof BugDialog>[0]) {
  const [title, setTitle] = useState(seed.title ?? '')
  const [severity, setSeverity] = useState<BugSeverity>(seed.severity ?? 'major')
  const [priority, setPriority] = useState<Priority>(seed.priority ?? 'medium')
  const [environment, setEnvironment] = useState(seed.environment ?? '')
  const [testEnvironmentId, setTestEnvironmentId] = useState(() => (
    seed.testEnvironmentId && environments.some((item) => item.id === seed.testEnvironmentId)
      ? String(seed.testEnvironmentId)
      : 'manual'
  ))
  const [reproductionSteps, setReproductionSteps] = useState(seed.reproductionSteps ?? '')
  const [expectedResult, setExpectedResult] = useState(seed.expectedResult ?? '')
  const [actualResult, setActualResult] = useState(seed.actualResult ?? '')
  const [assigneeUserId, setAssigneeUserId] = useState(seed.assigneeUserId ? String(seed.assigneeUserId) : 'none')
  const [testSubjectId, setTestSubjectId] = useState(seed.testSubjectId ? String(seed.testSubjectId) : '')
  const [reproductionUploading, setReproductionUploading] = useState(false)
  const [expectedUploading, setExpectedUploading] = useState(false)
  const [actualUploading, setActualUploading] = useState(false)
  const evidenceUploading = reproductionUploading || expectedUploading || actualUploading
  const selectedTestEnvironment = testEnvironmentId === 'manual'
    ? undefined
    : environments.find((item) => item.id === Number(testEnvironmentId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader className="test-wide-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑 Bug' : '创建 Bug'}</DialogTitle>
          <DialogDescription>{editing ? '仅 Bug 创建者可以修改缺陷信息。' : seed.testPlanCaseId ? '已从失败用例带入执行上下文。' : '记录可复现、可分派、可验证的缺陷。'}</DialogDescription>
        </DialogHeader>
        <form
          className="test-dialog-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({
              actualResult,
              assigneeUserId: assigneeUserId === 'none' ? undefined : Number(assigneeUserId),
              environment,
              expectedResult,
              priority,
              reproductionSteps,
              severity,
              ...(testEnvironmentId === 'manual' ? {} : { testEnvironmentId: Number(testEnvironmentId) }),
              testPlanCaseId: seed.testPlanCaseId,
              testPlanId: seed.testPlanId,
              testSubjectId: Number(testSubjectId),
              title,
            })
          }}
        >
          <Label>
            Bug 标题
            <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
          </Label>
          <div className="test-form-grid">
            <Label>
              严重程度
              <Select value={severity} onValueChange={(value) => setSeverity(value as BugSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(severityLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Label>
            <Label>
              优先级
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">高</SelectItem><SelectItem value="medium">中</SelectItem><SelectItem value="low">低</SelectItem></SelectContent>
              </Select>
            </Label>
            <Label>
              负责人
              <Select value={assigneeUserId} onValueChange={setAssigneeUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">未分配</SelectItem>{users.filter((user) => user.roles.includes('developer')).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.displayName}</SelectItem>)}</SelectContent>
              </Select>
            </Label>
            <Label>
              测试对象
              <Select value={testSubjectId} onValueChange={setTestSubjectId} disabled={editing}>
                <SelectTrigger><SelectValue placeholder="选择测试对象" /></SelectTrigger>
                <SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={String(subject.id)}>{subject.name}</SelectItem>)}</SelectContent>
              </Select>
            </Label>
            <Label>
              测试环境
              <Select
                value={testEnvironmentId}
                onValueChange={(value) => {
                  setTestEnvironmentId(value)
                  const selected = environments.find((item) => String(item.id) === value)
                  if (selected) setEnvironment(selected.accessUrl)
                }}
              >
                <SelectTrigger aria-label="选择测试环境"><SelectValue placeholder="选择已配置环境" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手工填写环境</SelectItem>
                  {environments.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedTestEnvironment ? (
                <span className="test-environment-preview">
                  <span><strong>{selectedTestEnvironment.name}</strong>{selectedTestEnvironment.accessUrl}</span>
                  <a href={selectedTestEnvironment.accessUrl} rel="noreferrer" target="_blank" title="打开测试环境"><LinkSimple aria-hidden /></a>
                </span>
              ) : <Input aria-label="手工填写测试环境" placeholder="例如：https://staging.example.com" value={environment} onChange={(event) => setEnvironment(event.target.value)} />}
            </Label>
          </div>
          <BugEvidenceEditor
            label="复现步骤"
            onChange={setReproductionSteps}
            onUploadingChange={setReproductionUploading}
            placeholder="记录复现路径，支持粘贴、拖入或上传图片和视频。"
            value={reproductionSteps}
          />
          <BugEvidenceEditor
            label="预期结果"
            onChange={setExpectedResult}
            onUploadingChange={setExpectedUploading}
            placeholder="描述预期表现，支持补充截图或录屏。"
            value={expectedResult}
          />
          <BugEvidenceEditor
            label="实际结果"
            onChange={setActualResult}
            onUploadingChange={setActualUploading}
            placeholder="描述实际表现，支持补充截图或录屏。"
            value={actualResult}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={busy || evidenceUploading || !title.trim() || !testSubjectId}>
              {evidenceUploading ? '附件上传中...' : editing ? '保存修改' : '创建 Bug'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BugTransferDialog({ bug, busy, onOpenChange, onSubmit, open }: {
  bug?: TestBug
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (bug: TestBug, assigneeUserId: number, reason: string) => Promise<boolean>
  open: boolean
}) {
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setAssigneeUserId('')
    setReason('')
  }, [bug?.id, open])

  const assigning = !bug?.assigneeUserId
  const normalizedReason = reason.trim()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader>
        <DialogHeader>
          <DialogTitle>{assigning ? '分配 Bug' : '转移 Bug'}</DialogTitle>
          <DialogDescription>{bug ? `BUG-${bug.id} · ${bug.title}` : ''}</DialogDescription>
        </DialogHeader>
        <form
          className="test-dialog-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!bug || !assigneeUserId || (!assigning && !normalizedReason)) return
            if (await onSubmit(bug, Number(assigneeUserId), normalizedReason)) onOpenChange(false)
          }}
        >
          <Label>
            新负责人
            <Select value={assigneeUserId} onValueChange={setAssigneeUserId} disabled={busy}>
              <SelectTrigger><SelectValue placeholder="选择组织成员" /></SelectTrigger>
              <SelectContent>
                {(bug?.transferCandidates ?? []).map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          {!assigning ? (
            <Label>
              转移理由
              <Textarea
                autoFocus
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={busy || !assigneeUserId || (!assigning && !normalizedReason)}>
              {busy ? (assigning ? '分配中...' : '转移中...') : (assigning ? '确认分配' : '确认转移')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BugRejectDialog({ bug, busy, onOpenChange, onSubmit, open }: {
  bug?: TestBug
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (bug: TestBug, reason: string) => Promise<boolean>
  open: boolean
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
  }, [bug?.id, open])

  const normalizedReason = reason.trim()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeader>
        <DialogHeader>
          <DialogTitle>驳回 Bug</DialogTitle>
          <DialogDescription>{bug ? `BUG-${bug.id} · ${bug.title}` : ''}</DialogDescription>
        </DialogHeader>
        <form
          className="test-dialog-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!bug || !normalizedReason) return
            if (await onSubmit(bug, normalizedReason)) onOpenChange(false)
          }}
        >
          <Label>
            驳回理由
            <Textarea
              autoFocus
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="填写驳回理由，将记录到 Bug 评论区并通知提出该 Bug 的测试工程师。"
            />
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button variant="destructive" disabled={busy || !normalizedReason}>
              {busy ? '驳回中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AssignedTestBugs({
  currentUserId,
  initialBugId,
  organizationId,
  embedded = false,
  onBugSeen,
  onBugsChange,
  onExit,
}: {
  currentUserId?: number
  initialBugId?: number | null
  organizationId: OrganizationContext
  embedded?: boolean
  onBugSeen?: (bug: TestBug) => void
  onBugsChange?: (bugs: TestBug[]) => void
  onExit?: () => void
}) {
  const [bugs, setBugs] = useState<TestBug[]>([])
  const [mentionMembers, setMentionMembers] = useState<MentionMember[]>([])
  const [departedUserIds, setDepartedUserIds] = useState<number[]>([])
  const [selectedId, setSelectedId] = useState<number>()
  const [shareOpen, setShareOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [transferBug, setTransferBug] = useState<TestBug>()
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [rejectBug, setRejectBug] = useState<TestBug>()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [filterJoin, setFilterJoin] = useState<BugFilterJoin>('and')
  const [filterConditions, setFilterConditions] = useState<BugFilterCondition[]>(createDefaultBugFilterConditions)
  const [selectedSpaceId, setSelectedSpaceId] = useState<number>()
  const [searchQuery, setSearchQuery] = useState('')
  const refreshInFlightRef = useRef(false)
  const onBugsChangeRef = useRef(onBugsChange)

  useEffect(() => {
    onBugsChangeRef.current = onBugsChange
  }, [onBugsChange])

  const spaceOptions = useMemo(() => uniqueBugFilterOptions(bugs, (bug) => bug.testSpaceName
    ? {
      label: `${bug.testSpaceName}${bug.testSpaceVersionLabel ? ` · ${bug.testSpaceVersionLabel}` : ''}`,
      value: String(bug.testSpaceId),
    }
    : undefined), [bugs])

  function selectAssignedBugSpace(value: string) {
    const nextId = Number(value)
    if (!Number.isSafeInteger(nextId) || nextId <= 0) return
    setSelectedSpaceId(nextId)
    window.localStorage.setItem(getAssignedBugSpaceStorageKey(currentUserId, organizationId), String(nextId))
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchAssignedTestBugs(organizationId)
      .then((result) => {
        if (!active) return
        setBugs(result.bugs)
        setDepartedUserIds(result.departedUserIds)
        setMentionMembers(result.members ?? [])
        onBugsChangeRef.current?.(result.bugs)
        const rememberedSpaceId = readAssignedBugSpaceId(currentUserId, organizationId)
        const initialBug = initialBugId ? result.bugs.find((bug) => bug.id === initialBugId) : undefined
        const nextSpaceId = initialBug?.testSpaceId
          ?? (rememberedSpaceId && result.bugs.some((bug) => bug.testSpaceId === rememberedSpaceId)
            ? rememberedSpaceId
            : result.bugs[0]?.testSpaceId)
        setSelectedSpaceId(nextSpaceId)
        if (nextSpaceId) {
          window.localStorage.setItem(
            getAssignedBugSpaceStorageKey(currentUserId, organizationId),
            String(nextSpaceId),
          )
        }
        setSelectedId(initialBugId && result.bugs.some((bug) => bug.id === initialBugId)
          ? initialBugId
          : result.bugs[0]?.id)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Bug 加载失败。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [currentUserId, initialBugId, organizationId])

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (refreshInFlightRef.current) return
      refreshInFlightRef.current = true
      fetchAssignedTestBugs(organizationId)
        .then((result) => {
          if (!active) return
          setBugs(result.bugs)
          setDepartedUserIds(result.departedUserIds)
          setMentionMembers(result.members ?? [])
          onBugsChangeRef.current?.(result.bugs)
          setSelectedSpaceId((current) => {
            if (current && result.bugs.some((bug) => bug.testSpaceId === current)) return current
            const remembered = readAssignedBugSpaceId(currentUserId, organizationId)
            return remembered && result.bugs.some((bug) => bug.testSpaceId === remembered)
              ? remembered
              : result.bugs[0]?.testSpaceId
          })
          setSelectedId((current) => (
            current && result.bugs.some((bug) => bug.id === current)
              ? current
              : result.bugs[0]?.id
          ))
        })
        .catch(() => undefined)
        .then(() => {
          refreshInFlightRef.current = false
        })
    }
    const interval = window.setInterval(refresh, notificationRefreshIntervalMs)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [currentUserId, organizationId])

  const spaceBugs = useMemo(() => bugs.filter((bug) => bug.testSpaceId === selectedSpaceId), [bugs, selectedSpaceId])
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('zh-CN')
  const filteredBugs = useMemo(() => spaceBugs.filter((bug) => (
    matchesBugFilterConditions(bug, filterConditions, filterJoin) && (
      !normalizedSearchQuery || [
        `bug-${bug.id}`,
        bug.title,
        bug.environment,
        bug.testSubjectName,
        bug.testPlanName,
        bug.reporterName,
        bug.assigneeName,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('zh-CN').includes(normalizedSearchQuery))
    )
  )), [filterConditions, filterJoin, normalizedSearchQuery, spaceBugs])
  const selected = useMemo(
    () => filteredBugs.find((bug) => bug.id === selectedId),
    [filteredBugs, selectedId],
  )
  const filterOptions = useMemo<BugFilterOptions>(() => ({
    assignees: uniqueBugFilterOptions(spaceBugs, (bug) => bug.assigneeUserId && bug.assigneeName
      ? { label: bug.assigneeName, value: String(bug.assigneeUserId) }
      : undefined),
    plans: uniqueBugFilterOptions(spaceBugs, (bug) => bug.testPlanId && bug.testPlanName
      ? { label: bug.testPlanName, value: String(bug.testPlanId) }
      : undefined),
    reporters: uniqueBugFilterOptions(spaceBugs, (bug) => bug.reporterUserId && bug.reporterName
      ? { label: bug.reporterName, value: String(bug.reporterUserId) }
      : undefined),
    spaces: [],
    subjects: uniqueBugFilterOptions(spaceBugs, (bug) => bug.testSubjectId && bug.testSubjectName
      ? { label: bug.testSubjectName, value: String(bug.testSubjectId) }
      : undefined),
  }), [spaceBugs])

  useEffect(() => {
    setSelectedId((current) => (
      current && filteredBugs.some((bug) => bug.id === current)
        ? current
        : filteredBugs[0]?.id
    ))
  }, [filteredBugs])

  useEffect(() => {
    if (selected) onBugSeen?.(selected)
  }, [onBugSeen, selected])

  useEffect(() => {
    if (transferDialogOpen || !transferBug) return
    const cleanup = window.setTimeout(() => {
      setTransferBug(undefined)
    }, 180)
    return () => window.clearTimeout(cleanup)
  }, [transferBug, transferDialogOpen])

  async function mutate(operation: () => Promise<{ bugs: TestBug[] }>) {
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      setBugs(result.bugs)
      setSelectedId((current) => (
        current && result.bugs.some((bug) => bug.id === current)
          ? current
          : result.bugs[0]?.id
      ))
      onBugsChangeRef.current?.(result.bugs)
      return true
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '操作失败。')
      return false
    } finally {
      setBusy(false)
    }
  }

  const Root = embedded ? 'section' : 'main'

  return (
    <Root className={embedded ? 'assigned-bugs-workspace' : 'assigned-bugs-shell'}>
      {!embedded ? (
        <header>
          <Button size="icon" variant="ghost" onClick={onExit}><ArrowLeft /></Button>
          <div><h1>Bug 工作台</h1></div>
        </header>
      ) : null}
      <WorkspaceError message={error} />
      {!loading && bugs.length > 0 ? (
        <div className="assigned-bugs-filter-toolbar">
          <Select value={selectedSpaceId ? String(selectedSpaceId) : ''} onValueChange={selectAssignedBugSpace}>
            <SelectTrigger className="assigned-bugs-space-select" aria-label="选择测试空间">
              <SelectValue placeholder="选择测试空间" />
            </SelectTrigger>
            <SelectContent>
              {spaceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="test-bug-search assigned-bugs-search">
            <MagnifyingGlass aria-hidden />
            <Input
              aria-label="搜索 Bug"
              placeholder="搜索 Bug 标题、编号或关联信息"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <Button
            className={filterConditions.length > 0 ? 'todo-filter-open-button active' : 'todo-filter-open-button'}
            type="button"
            variant="outline"
            onClick={() => setFilterDialogOpen(true)}
          >
            <FunnelSimple />
            筛选
            {filterConditions.length > 0 ? (
              <span className="assigned-bugs-filter-count">{filterConditions.length}</span>
            ) : null}
          </Button>
          <span className="assigned-bugs-filter-summary">
            {filterConditions.length > 0 || searchQuery.trim()
              ? `${filteredBugs.length} / ${spaceBugs.length} 条 Bug`
              : `共 ${spaceBugs.length} 条 Bug`}
          </span>
          {searchQuery.trim() ? <Button type="button" variant="ghost" onClick={() => setSearchQuery('')}>清除搜索</Button> : null}
        </div>
      ) : null}
      {loading ? (
        <p className="test-list-empty">正在加载...</p>
      ) : bugs.length === 0 ? (
        <div className="test-inline-empty"><CheckCircle size={32} /><h2>没有可查看的 Bug</h2></div>
      ) : filteredBugs.length === 0 ? (
        <div className="test-inline-empty assigned-bugs-filter-empty">
          <FunnelSimple size={32} />
          <h2>没有符合筛选条件的 Bug</h2>
          <Button type="button" variant="outline" onClick={() => setFilterConditions([])}>
            清除筛选
          </Button>
        </div>
      ) : (
        <div className="test-split-view">
                <div className="test-record-list">
            {filteredBugs.map((bug) => (
              <button key={bug.id} className={bug.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(bug.id)}>
                <div><code>BUG-{bug.id}</code><Badge className={`test-bug-status ${bug.status}`} variant="outline">{bugStatusLabel[bug.status]}</Badge></div>
                <strong>{bug.title}</strong>
                <small>版本号 {bug.testSpaceVersionLabel || '未指定'} · {formatTimestamp(bug.updatedAt)} · {bug.assigneeName || '未分配'}{bug.assigneeTransferSource === 'offboarding' ? '（离职转移）' : null}</small>
              </button>
            ))}
          </div>
          <div className="test-record-detail">
            {selected ? (
              <>
                <div className="test-detail-heading">
                  <div><code>BUG-{selected.id}</code><h2>{selected.title}</h2></div>
                  <div className="test-detail-heading-actions">
                    {selected.canShare ? <Button variant="outline" disabled={busy} onClick={() => setShareOpen(true)}><LinkSimple /> 分享 Bug</Button> : null}
                    {selected.canTransfer && (selected.transferCandidates?.length ?? 0) > 0 ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setTransferBug(selected)
                          setTransferDialogOpen(true)
                        }}
                      >
                        {selected.assigneeUserId ? <ArrowsLeftRight /> : <UserPlus />}
                        {selected.assigneeUserId ? '转移' : '分配'}
                      </Button>
                    ) : null}
                    {selected.canManage && (
                      selected.status === 'pending_confirmation' || selected.status === 'assigned'
                    ) ? (
                      <Button disabled={busy} onClick={() => void mutate(() => updateAssignedTestBug(organizationId, selected.id, 'in_progress'))}>开始修复</Button>
                    ) : null}
                    {selected.canManage && (
                      selected.status === 'pending_confirmation' || selected.status === 'assigned'
                    ) ? (
                      <Button
                        className="test-bug-reject-button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                          setRejectBug(selected)
                          setRejectDialogOpen(true)
                        }}
                      >
                        驳回
                      </Button>
                    ) : null}
                    {selected.canManage && selected.status === 'in_progress' ? (
                      <>
                        <Button className="test-bug-reject-button" variant="destructive" disabled>驳回</Button>
                        <Button disabled={busy} onClick={() => void mutate(() => updateAssignedTestBug(organizationId, selected.id, 'pending_verification'))}>提交验证</Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="test-detail-meta assigned-bug-detail-meta">
                  <span>负责人 <UserName departedUserIds={departedUserIds} name={selected.assigneeName || '未分配'} userId={selected.assigneeUserId} /></span>
                  <span>测试对象 <strong>{selected.testSubjectName}</strong></span>
                  <span>版本号 <strong>{selected.testSpaceVersionLabel || '未指定'}</strong></span>
                  <span>严重程度 <strong>{severityLabel[selected.severity]}</strong></span>
                </div>
                <DetailBlock title="复现步骤" content={selected.reproductionSteps} />
                <DetailBlock title="预期结果" content={selected.expectedResult} />
                <DetailBlock title="实际结果" content={selected.actualResult} />
                <BugCommentsSection
                  bug={selected}
                  busy={busy}
                  currentUserId={currentUserId}
                  departedUserIds={departedUserIds}
                  draftOwnerUserId={currentUserId}
                  mentionMembers={selected.organizationMembers ?? mentionMembers}
                  placeholder="说明修复内容或提交版本，支持粘贴、拖入或上传图片和视频。"
                  onComment={selected.canComment
                    ? (bug, content) => mutate(() => addAssignedTestBugComment(organizationId, bug.id, content))
                    : undefined}
                  onDeleteComment={selected.canComment
                    ? (bug, comment) => mutate(() => deleteAssignedTestBugComment(organizationId, bug.id, comment.id))
                    : undefined}
                  onUpdateComment={selected.canComment
                    ? (bug, comment, content) => mutate(() => updateAssignedTestBugComment(organizationId, bug.id, comment.id, content))
                    : undefined}
                />
              </>
            ) : null}
          </div>
        </div>
      )}
      <BugTransferDialog
        bug={transferBug}
        busy={busy}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onSubmit={(bug, assigneeUserId, reason) => mutate(() => transferAssignedTestBug(organizationId, bug.id, {
          assigneeUserId,
          reason,
        }))}
      />
      <BugRejectDialog
        bug={rejectBug}
        busy={busy}
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onSubmit={(bug, reason) => mutate(() => rejectAssignedTestBug(organizationId, bug.id, reason))}
      />
      {selected ? <BugShareDialog bugId={selected.id} open={shareOpen} onOpenChange={setShareOpen} /> : null}
      <BugFilterBuilderDialog
        conditions={filterConditions}
        includeTestSpace={false}
        join={filterJoin}
        open={filterDialogOpen}
        options={filterOptions}
        onOpenChange={setFilterDialogOpen}
        onApply={(next) => {
          setFilterConditions(next.conditions)
          setFilterJoin(next.join)
        }}
      />
    </Root>
  )
}
