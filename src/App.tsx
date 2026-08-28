import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type ComponentProps,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import { MarkdownWysiwygEditor } from '@/components/markdown-wysiwyg-editor'
import {
  parseTodoDeepLink,
  removeTodoDeepLink,
  resolveTodoDeepLinkTarget,
  shouldDeferTodoDeepLinkForInvite,
} from '@/todo-deep-link'
import {
  parseAiTodoBatchDeepLink,
  removeAiTodoBatchDeepLink,
} from '@/ai-todo-deep-link'
import {
  parseWeeklyReportDeepLink,
  removeWeeklyReportDeepLink,
} from '../shared/weekly-report-deep-link'
import {
  Archive,
  AddressBook,
  At,
  Bell,
  Buildings,
  Bug,
  CalendarBlank,
  Check,
  ChatCircleDots,
  CloudArrowUp,
  CopySimple,
  CornersIn,
  CornersOut,
  DotsThree,
  CaretDown,
  ClockCounterClockwise,
  ImageSquare,
  PencilSimple,
  DownloadSimple,
  FileText,
  Flask,
  FunnelSimple,
  GearSix,
  LinkSimple,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  Paperclip,
  PaperPlaneTilt,
  Plus,
  Question,
  ShoppingCartSimple,
  SignIn,
  SignOut,
  SidebarSimple,
  Sparkle,
  SpinnerGap,
  Sun,
  Target,
  Tray,
  Trash,
  WarningCircle,
  ArrowLeft,
  X,
  UserSwitch,
} from '@phosphor-icons/react'
import { JournalDatePicker } from '@/components/journal-date-picker'
import { AccountSettingsDialog } from '@/components/account-settings-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  acceptOrganizationInviteLink,
  acceptProjectInvitation,
  archiveDraft,
  createProjectModule,
  createDraft,
  createJournalEntry,
  createProjectPackageEvent,
  createProjectPackageOperation,
  createFeishuOAuthUrl,
  createProject,
  createRiskFromJournal,
  createAiTurnDocument,
  createSummary,
  createTodo,
  createTodoNote,
  declineProjectInvitation,
  exportProjectPackageTimeline,
  fetchPackageMarketBaseDetail,
  fetchPackageMarketBaseReleaseVersions,
  fetchPackageMarketCiBranches,
  fetchPackageMarketCiVersions,
  fetchPackageMarketDetail,
  fetchPackageMarketReleaseVersions,
  fetchPackageMarketRules,
  fetchProjectPackageItemDownloadUrl,
  fetchProjectPackageTimeline,
  fetchWorkspace,
  fetchAiStatus,
  fetchAiConversations,
  fetchAiConversationTurns,
  fetchMyWork,
  fetchOrganization,
  fetchOrganizations,
  fetchTodoProposalBatch,
  fetchCurrentUser,
  fetchNotifications,
  ApiError,
  AiTurnStreamTerminalError,
  fetchProjectInviteLinkInfo,
  formatApiErrorDiagnostic,
  getAuthToken,
  getProjectInviteLink,
  inviteProjectMember,
  markAllNotificationsRead,
  loginAccount,
  registerAccount,
  clearAuthToken,
  completeProjectPackageEvent,
  addPackageEventComment,
  updatePackageEventComment,
  deletePackageEventComment,
  removeDraft,
  removeJournalEntry,
  removeProjectPackageEvent,
  removeProjectPackageGroup,
  removeProjectPackageOperation,
  removeProject,
  removeProjectModule,
  removeProjectMember,
  removeTodo,
  requestProjectTransfer,
  respondToProjectTransfer,
  acceptProjectInviteLink,
  resolveRiskFromJournal,
  disconnectFeishuAccount,
  updateJournalEntry,
  updateProjectPackageOperation,
  updateProject,
  updateProjectFeishuSettings,
  updateTodo,
  updateTodoNote,
  uploadTodoImage,
  setAuthToken,
  classifyAiConversationTurnIntent,
  sendAiConversationTurn,
  saveProjectPackageEventDraft,
  retryAiConversationTurn,
  cancelAiConversationTurn,
  reconcileAiConversationTurn,
  renameAiConversation,
  deleteAiConversation,
  switchActiveRole,
  updateCurrentUser,
  type AiStatus,
  type AiTurnStreamHandlers,
  type AiTurnStreamPhase,
  verifyProjectInviteLink,
  type AuthUser,
  type PackageMarketRequestContext,
  type PackageMarketRulesResponse,
  type UserRole,
  type WorkspaceData,
} from './api'
import type { OrganizationListItem, OrganizationMember } from './organization-types'
import type {
  InboxItem,
  JournalVisibility,
  PackageMarketChannel,
  PackageMarketCiBranch,
  PackageMarketDetail,
  PackageMarketVersion,
  NotificationCenterData,
  Priority,
  Project,
  ProjectModule,
  ProjectPackageEvent,
  ProjectPackageEventSavePayload,
  ProjectPackageOperationStatus,
  ProjectPackageTimeline,
  ProjectPackageOperationKind,
  ProjectMembership,
  ProjectStatus,
  Summary,
  SummaryPeriodType,
  AiConversation,
  AiConversationContextKind,
  AiTurn,
  AiTurnOutcome,
  AiTurnRunResponse,
  Todo,
  TodoNote,
} from './types'
import { TodoActivityPanel } from './components/todo-activity-panel'
import { UserName } from './components/user-name'
import {
  TodoProposalWorkflow,
  type TodoProposalWorkflowHandle,
} from './components/todo-proposal-workflow'
import { AiConversationHistoryPanel } from './components/ai-conversation-history-panel'
import {
  GENERAL_AI_CONVERSATION_CONTEXT,
  aiConversationHistoryReducer,
  canonicalProcessingAiTurn,
  createAiConversationHistoryState,
  currentAiConversationId,
  isAiTurnCanonicalStateUnknown,
  latestRetryableAiTurnId,
  mergeAiTurns,
  nextAiTurnNumber,
  type AiConversationContext,
  type AiConversationHistoryState,
  type AiConversationListItem,
} from './ai-conversation-state'
import {
  PackageMarketBrowser,
  ProjectPackageWorkbench,
  type ProjectPackageWorkbenchHandle,
} from './components/project-package-workbench'
import {
  startNotificationRefreshSchedule,
  workspaceRefreshIntervalMs,
} from './notifications'
import {
  buildAiClassificationContent,
  deriveAiIntentTargetContext,
  type AiIntentClassification,
} from './ai-input-intent'
import { aiTurnFailureDetail } from './ai-turn-error'
import { aiIntentRequestErrorMessage } from './ai-intent-error'
import {
  AI_ATTACHMENT_MAX_BYTES,
  AI_ATTACHMENT_MAX_CHARACTERS,
  AI_ATTACHMENT_MAX_COUNT,
  buildAiMessageContent,
  formatAttachmentSize,
  isSupportedAiAttachment,
  totalAttachmentCharacters,
  type AiTextAttachment,
} from './ai-attachments'
import { AssignedTestBugs, TestWorkbench } from './components/test-workbench'
import { BugShareView } from './components/bug-share-view'
import { getBugShareTokenFromPath } from './bug-share-deep-link'
import { TodoShareDialog } from './components/todo-share-dialog'
import { TodoShareView } from './components/todo-share-view'
import { getTodoShareTokenFromPath } from './todo-share-deep-link'
import { fetchAssignedTestBugs } from './test-workbench-api'
import type { TestBug } from './test-workbench-types'
import { OrganizationWorkbench } from './components/organization-workbench'
import { ChangelogWorkbench } from './components/changelog-workbench'
import { ImageSyncWorkbench } from './components/image-sync-workbench'
import { MarkdownPreview } from './components/markdown-preview'
import { WeeklyReportWorkbench } from './components/weekly-report-workbench'
import { MyWorkWorkbench } from './components/my-work-workbench'
import { stripMarkdownLinksToText } from './markdown-preview-policy'
import {
  ManageRolesMenuLabel,
  UserRoleManagementDialog,
  UserRoleSelectionDialog,
} from './components/user-role-dialogs'
import {
  getSwitchableUserRoles,
  hasOrganizationAdminRole,
  userRoleLabel,
  type SwitchableUserRole,
} from './user-roles'
import './App.css'

const SHOW_DEVELOPER_ASSIGNED_BUGS_MODULE = true
const unresolvedAssignedBugStatuses = new Set<string>(['assigned', 'in_progress', 'reopened'])

class TodoMarkdownEditorLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // Keep the current project and draft in place when an editor error occurs.
    // A full reload here loses the selected project and makes opening a todo
    // appear to navigate to another project.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="markdown-wysiwyg-loading is-error" role="alert">
          <strong>编辑器加载失败</strong>
          <Button
            type="button"
            variant="outline"
            onClick={() => this.setState({ failed: false })}
          >
            重试
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

type View =
  | 'project'
  | 'inbox'
  | 'my_work'
  | 'notifications'
  | 'organization'
  | 'weekly_report'
  | 'package_market'
  | 'image_sync'
  | 'changelog'
  | 'search'
  | 'ai'
  | 'testing'
  | 'assigned_bugs'
type DetailEntrySource = 'project' | 'notifications' | 'my_work'
type DisplayAiAttachment = {
  id: number | string
  name: string
  size: number
}
type DisplayAiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: DisplayAiAttachment[]
  createdAt: string
  outcome?: AiTurnOutcome
  turnId: string
  turnStatus: AiTurn['status']
  statusDetail?: string
  statusKind?: 'cancelled' | 'failed' | 'processing' | 'reconciling'
  statusTitle?: string
}
type AiTurnLiveState = {
  connection: 'connected' | 'reconciling'
  content: string
  error?: string
  mode: 'progress' | 'text'
  phase: AiTurnStreamPhase
}
type ThemeMode = 'dark' | 'light'
type AiMobilePane = 'workspace' | 'history' | 'artifacts'

function getDefaultAiPane(): AiMobilePane {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1101px)').matches
    ? 'artifacts'
    : 'workspace'
}
type AiMessageRoute = {
  attachments?: AiTextAttachment[]
  content?: string
  contextKind?: AiConversationContextKind
  intent: AiIntentClassification
  turnId: string
}

function aiTurnProgressTitle(turn: AiTurn, phase: AiTurnStreamPhase) {
  if (turn.intentKind === 'todo-extraction') {
    if (phase === 'validating') return '正在校验待办候选'
    if (phase === 'saving') return '正在保存待办候选'
    return phase === 'preparing' ? '正在读取内容' : '正在提取待办'
  }
  if (turn.intentKind === 'project-summary') {
    return phase === 'saving' ? '正在保存项目总结' : '正在生成项目总结'
  }
  if (turn.intentKind === 'conversation-analysis') {
    return phase === 'saving' ? '正在保存分析结果' : '正在分析对话'
  }
  if (turn.intentKind === 'workspace-review') {
    return phase === 'saving' ? '正在保存工作区复盘' : '正在整理工作区进展'
  }
  return phase === 'saving' ? '正在保存回复' : '正在回复'
}

function displayMessagesFromAiTurn(
  turn: AiTurn,
  liveState?: AiTurnLiveState,
): DisplayAiChatMessage[] {
  const attachments = turn.attachments.map(({ id, name, size }) => ({ id, name, size }))
  const messages: DisplayAiChatMessage[] = [{
    attachments,
    content: turn.userContent || '请阅读附件内容。',
    createdAt: turn.createdAt,
    id: `${turn.id}:user`,
    role: 'user',
    turnId: turn.id,
    turnStatus: turn.status,
  }]
  const statusKind = turn.status === 'processing'
    ? liveState?.connection === 'reconciling' ? 'reconciling' : 'processing'
    : turn.status === 'failed' || turn.status === 'cancelled' ? turn.status : undefined
  const statusTitle = statusKind === 'reconciling'
    ? '正在确认回复结果'
    : statusKind === 'processing'
      ? aiTurnProgressTitle(turn, liveState?.phase ?? 'preparing')
      : statusKind === 'failed'
        ? '回复失败'
        : statusKind === 'cancelled'
          ? '回复已停止'
          : undefined
  const statusDetail = statusKind === 'reconciling'
    ? '连接已中断，正在从服务端恢复这条回复。'
    : statusKind === 'failed'
      ? liveState?.error || aiTurnFailureDetail(turn.errorCode)
      : statusKind === 'cancelled'
        ? '你可以重试这条消息。'
        : undefined
  const assistantContent = turn.status === 'completed'
    ? turn.assistantContent
    : turn.status === 'processing' && liveState?.mode === 'text'
      ? liveState.content
      : ''
  if (assistantContent || statusTitle) {
    messages.push({
      content: assistantContent || '',
      createdAt: turn.completedAt ?? turn.updatedAt,
      id: `${turn.id}:assistant`,
      outcome: turn.outcome,
      role: 'assistant',
      turnId: turn.id,
      turnStatus: turn.status,
      statusDetail,
      statusKind,
      statusTitle,
    })
  }
  return messages
}

function toAiConversationListItem(conversation: AiConversation): AiConversationListItem {
  return {
    contextType: conversation.contextKind,
    createdAt: conversation.createdAt,
    id: conversation.id,
    lastTurnAt: conversation.lastTurnAt,
    projectId: conversation.projectId,
    projectName: conversation.projectName,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
  }
}

function aiConversationContext(
  contextKind: AiConversationContextKind,
  projectId: number | null,
  projects: Project[],
): AiConversationContext {
  return {
    contextType: contextKind,
    projectId: contextKind === 'project' ? projectId : null,
    projectName: contextKind === 'project'
      ? projects.find((project) => project.id === projectId)?.name ?? null
      : null,
  }
}

function formatAiMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
type TodoUpdatePayload = Omit<
  Partial<Todo>,
  'assigneeUserId' | 'moduleId' | 'reviewerUserId' | 'watcherUserId' | 'watcherUserIds'
> & {
  assigneeUserId?: number | null
  createdAt?: string
  acceptanceNote?: string
  moduleId?: number | null
  rejectionReason?: string
  reviewerUserId?: number | null
  watcherUserId?: number | null
  watcherUserIds?: number[]
}
type AdaptivePageSizeOptions = {
  compact: boolean
  defaultPageSize: number
  itemHeight: number
  maxPageSize: number
  minPageSize: number
  pagerHeight?: number
  reservedHeight?: (viewportHeight: number) => number
}
type MentionOption = {
  id: number
  name: string
  role: string
}
type ProjectDetailTab = 'journal' | 'activity' | 'packages'
type TodoFilterJoin = 'and' | 'or'
type TodoFilterField =
  | 'title'
  | 'module'
  | 'assignee'
  | 'watcher'
  | 'creator'
  | 'priority'
  | 'done'
  | 'confirmationStatus'
  | 'dueDate'
  | 'createdAt'
type TodoFilterOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'is_empty'
  | 'is_not_empty'
  | 'before'
  | 'after'
  | 'between'
type TodoFilterCondition = {
  field: TodoFilterField
  id: string
  operator: TodoFilterOperator
  value: string
}

const themeStorageKey = 'veges.theme'
const viewStorageKey = 'veges.activeView.v1'
const selectedProjectStorageKey = 'veges.selectedProject.v1'
const selectedOrganizationStorageKey = 'veges.selectedOrganization.v1'
const todoCreateDraftStoragePrefix = 'veges.todoCreateDraft.v1'
const todoFilterPreferenceStoragePrefix = 'veges.todoFilterPreference.v1'
const assignedBugCommentReadStoragePrefix = 'veges.assignedBugCommentReadAt.v1'
const appViews = [
  'project',
  'inbox',
  'my_work',
  'notifications',
  'organization',
  'weekly_report',
  'package_market',
  'image_sync',
  'changelog',
  'search',
  'ai',
  'testing',
  'assigned_bugs',
] as const

type TodoCreateDraftSnapshot = {
  assigneeUserId: number | null
  watcherUserIds: number[]
  reviewerUserId: number | null
  createdAt: string
  detail: string
  draft: string
  dueDate: string
  moduleId: number | null
  priority: Priority
}

function getInviteTokenFromUrl() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('invite')?.trim() ?? ''
}

function getOrganizationInviteTokenFromUrl() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('organizationInvite')?.trim() ?? ''
}

function isAppView(value: unknown): value is View {
  return typeof value === 'string' && appViews.includes(value as View)
}

function getInitialView(): View {
  if (typeof window === 'undefined') return 'search'
  try {
    const storedView = window.localStorage.getItem(viewStorageKey)
    if (storedView === 'notifications') return 'my_work'
    return isAppView(storedView) ? storedView : 'search'
  } catch {
    return 'search'
  }
}

function loadStoredSelectedProjectId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = Number(window.localStorage.getItem(selectedProjectStorageKey))
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

function loadStoredSelectedOrganizationId(userId: number): number | null | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = window.localStorage.getItem(`${selectedOrganizationStorageKey}.${userId}`)
    if (stored == null) return undefined
    if (stored === 'personal') return null
    const parsed = Number(stored)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

function persistSelectedOrganizationId(userId: number, organizationId: number | null) {
  try {
    window.localStorage.setItem(
      `${selectedOrganizationStorageKey}.${userId}`,
      organizationId == null ? 'personal' : String(organizationId),
    )
  } catch {
    // The active selection remains available for this browser session.
  }
}

function hasStoredInitialView() {
  if (typeof window === 'undefined') return false
  try {
    return isAppView(window.localStorage.getItem(viewStorageKey))
  } catch {
    return false
  }
}

function getRoleLandingView(role: UserRole): View {
  if (role === 'tester') return 'testing'
  return 'search'
}

function canUseViewForUser(view: View, user: AuthUser) {
  if (view === 'testing') return user.activeRole === 'tester'
  if (view === 'assigned_bugs') {
    return user.activeRole === 'developer' && SHOW_DEVELOPER_ASSIGNED_BUGS_MODULE
  }
  if (view === 'organization') return hasOrganizationAdminRole(user.roles)
  return true
}

function clearInviteTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('invite')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function clearOrganizationInviteTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('organizationInvite')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function getTodoDeepLinkIdFromUrl() {
  if (typeof window === 'undefined') return null
  return parseTodoDeepLink(window.location.search).todoId
}

function clearTodoDeepLinkFromUrl() {
  if (typeof window === 'undefined') return
  window.history.replaceState({}, '', removeTodoDeepLink({
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
  }))
}

const todoNotesReadStoragePrefix = 'veges.todoNotesReadAt.v1'

function getDefaultTodoCreateDraft(): TodoCreateDraftSnapshot {
  return {
    assigneeUserId: null,
    watcherUserIds: [],
    reviewerUserId: null,
    createdAt: '',
    detail: '',
    draft: '',
    dueDate: today,
    moduleId: null,
    priority: 'medium',
  }
}

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low'
}

function getTodoCreateDraftStorageKey(projectId: number, userId?: number) {
  return `${todoCreateDraftStoragePrefix}.${userId ?? 'anonymous'}.${projectId}`
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeNumberArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeNullableNumber(entry))
        .filter((entry): entry is number => entry != null && Number.isSafeInteger(entry) && entry > 0),
    ),
  )
}

function getTodoWatcherUserIds(todo?: Todo | null) {
  if (!todo) return []
  const ids = normalizeNumberArray(todo.watcherUserIds)
  if (ids.length > 0) return ids
  return todo.watcherUserId ? [todo.watcherUserId] : []
}

function getTodoWatcherNames(todo: Todo) {
  const names = Array.isArray(todo.watcherNames)
    ? todo.watcherNames.filter((name) => Boolean(name.trim()))
    : []
  if (names.length > 0) return names
  return todo.watcherName ? [todo.watcherName] : []
}

function formatTodoWatcherNames(todo: Todo) {
  const names = getTodoWatcherNames(todo)
  if (names.length === 0) return ''
  if (names.length <= 3) return names.map((name) => `@${name}`).join('、')
  return `${names.slice(0, 3).map((name) => `@${name}`).join('、')} 等 ${names.length} 人`
}

function loadTodoCreateDraft(projectId: number, userId?: number) {
  if (typeof window === 'undefined') return getDefaultTodoCreateDraft()
  try {
    const raw = window.localStorage.getItem(getTodoCreateDraftStorageKey(projectId, userId))
    if (!raw) return getDefaultTodoCreateDraft()
    const parsed = JSON.parse(raw) as Partial<TodoCreateDraftSnapshot>
    const legacyWatcherUserId = normalizeNullableNumber((parsed as { watcherUserId?: unknown }).watcherUserId)
    return {
      assigneeUserId: normalizeNullableNumber(parsed.assigneeUserId),
      watcherUserIds: normalizeNumberArray(
        parsed.watcherUserIds ?? (legacyWatcherUserId == null ? [] : [legacyWatcherUserId]),
      ),
      reviewerUserId: normalizeNullableNumber(parsed.reviewerUserId),
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      detail: typeof parsed.detail === 'string' ? parsed.detail : '',
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
      dueDate: typeof parsed.dueDate === 'string' && parsed.dueDate ? parsed.dueDate : today,
      moduleId: normalizeNullableNumber(parsed.moduleId),
      priority: isPriority(parsed.priority) ? parsed.priority : 'medium',
    }
  } catch {
    return getDefaultTodoCreateDraft()
  }
}

function isTodoCreateDraftEmpty(draft: TodoCreateDraftSnapshot) {
  return (
    !draft.draft.trim() &&
    !draft.detail.trim() &&
    !draft.createdAt &&
    draft.dueDate === today &&
    draft.priority === 'medium' &&
    draft.assigneeUserId == null &&
    draft.watcherUserIds.length === 0 &&
    draft.reviewerUserId == null &&
    draft.moduleId == null
  )
}

function saveTodoCreateDraft(projectId: number, userId: number | undefined, draft: TodoCreateDraftSnapshot) {
  if (typeof window === 'undefined') return
  const key = getTodoCreateDraftStorageKey(projectId, userId)
  try {
    if (isTodoCreateDraftEmpty(draft)) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    window.localStorage.removeItem(key)
  }
}

function clearTodoCreateDraft(projectId: number, userId?: number) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getTodoCreateDraftStorageKey(projectId, userId))
}

function getTodoNotesReadStorageKey(userId?: number) {
  return `${todoNotesReadStoragePrefix}.${userId ?? 'anonymous'}`
}

function loadTodoNotesReadAt(userId?: number) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(getTodoNotesReadStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([key, value]) => [Number(key), value])
        .filter(([key]) => Number.isFinite(key)),
    ) as Record<number, string>
  } catch {
    return {}
  }
}

function saveTodoNotesReadAt(userId: number | undefined, value: Record<number, string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getTodoNotesReadStorageKey(userId), JSON.stringify(value))
}

function parseTodoNoteTimestamp(value: string) {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}+08:00`
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getAssignedBugCommentReadStorageKey(userId?: number) {
  return `${assignedBugCommentReadStoragePrefix}.${userId ?? 'anonymous'}`
}

function loadAssignedBugCommentReadAt(userId?: number) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(getAssignedBugCommentReadStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([key, value]) => [Number(key), value])
        .filter(([key]) => Number.isFinite(key)),
    ) as Record<number, string>
  } catch {
    return {}
  }
}

function saveAssignedBugCommentReadAt(userId: number | undefined, value: Record<number, string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getAssignedBugCommentReadStorageKey(userId), JSON.stringify(value))
}

function getLatestExternalBugCommentTimestamp(bug: Pick<TestBug, 'comments'>, currentUserId?: number) {
  if (currentUserId == null) return 0
  return bug.comments.reduce((latest, comment) => {
    if (comment.authorUserId == null || comment.authorUserId === currentUserId) return latest
    return Math.max(latest, parseTodoNoteTimestamp(comment.updatedAt || comment.createdAt))
  }, 0)
}

function hasUnreadExternalBugComment(
  bug: Pick<TestBug, 'comments' | 'id'>,
  currentUserId: number | undefined,
  readAtByBugId: Record<number, string>,
) {
  const latestExternalCommentAt = getLatestExternalBugCommentTimestamp(bug, currentUserId)
  if (latestExternalCommentAt === 0) return false
  const readAt = readAtByBugId[bug.id] ? parseTodoNoteTimestamp(readAtByBugId[bug.id]) : 0
  return latestExternalCommentAt > readAt
}

function useTodoNoteReadState(currentUserId?: number) {
  const [readAtByTodoId, setReadAtByTodoId] = useState<Record<number, string>>(() =>
    loadTodoNotesReadAt(currentUserId),
  )

  useEffect(() => {
    setReadAtByTodoId(loadTodoNotesReadAt(currentUserId))
  }, [currentUserId])

  const markTodoNotesRead = useCallback((todo: Todo) => {
    const nextReadAt = new Date().toISOString()
    setReadAtByTodoId((current) => {
      const next = { ...current, [todo.id]: nextReadAt }
      saveTodoNotesReadAt(currentUserId, next)
      return next
    })
  }, [currentUserId])

  const getTodoNoteBadge = useCallback((todo: Todo) => {
    const total = todo.notes.length
    const readAtTimestamp = readAtByTodoId[todo.id]
      ? parseTodoNoteTimestamp(readAtByTodoId[todo.id])
      : 0
    const unread = todo.notes.filter((note) => {
      if (currentUserId != null && note.authorUserId === currentUserId) return false
      return parseTodoNoteTimestamp(note.updatedAt || note.createdAt) > readAtTimestamp
    }).length
    return { total, unread }
  }, [currentUserId, readAtByTodoId])

  return { getTodoNoteBadge, markTodoNotesRead }
}

function buildProjectInviteUrl(token: string) {
  if (typeof window === 'undefined') return `?invite=${encodeURIComponent(token)}`
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('invite', token)
  return url.toString()
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'

  try {
    return window.localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function getShanghaiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    time: `${pick('hour')}:${pick('minute')}:${pick('second')}`,
  }
}

function getTodayStamp() {
  return getShanghaiDateParts().date
}

function getPreviousDateStamp(dateStamp = getTodayStamp()) {
  const date = new Date(`${dateStamp}T00:00:00+08:00`)
  date.setDate(date.getDate() - 1)
  return getShanghaiDateParts(date).date
}

function getProjectJournalSortKey(project: Project) {
  return project.journals[0]?.createdAt ?? project.updatedAt ?? project.createdAt
}

function useAdaptivePageSize({
  compact,
  defaultPageSize,
  itemHeight,
  maxPageSize,
  minPageSize,
  pagerHeight = 0,
  reservedHeight,
}: AdaptivePageSizeOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(defaultPageSize)

  useEffect(() => {
    if (!compact) return
    const containerElement = containerRef.current
    if (!containerElement) return

    function updatePageSize() {
      const viewportHeight = window.innerHeight
      const containerRect = containerElement!.getBoundingClientRect()
      const parentRect = containerElement!.parentElement?.getBoundingClientRect()
      const containerTop = containerRect.top
      const availableBottom = parentRect?.bottom && parentRect.bottom > containerTop
        ? Math.min(parentRect.bottom, viewportHeight)
        : viewportHeight
      const availableHeight = Math.max(
        itemHeight * minPageSize,
        availableBottom - containerTop - (reservedHeight?.(viewportHeight) ?? 0) - pagerHeight,
      )
      const nextItemsPerPage = Math.max(
        minPageSize,
        Math.min(maxPageSize, Math.floor(availableHeight / itemHeight)),
      )
      setItemsPerPage(nextItemsPerPage)
    }

    const resizeObserver = new ResizeObserver(updatePageSize)
    resizeObserver.observe(containerElement)
    if (containerElement.parentElement) resizeObserver.observe(containerElement.parentElement)
    updatePageSize()
    window.addEventListener('resize', updatePageSize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePageSize)
    }
  }, [compact, itemHeight, maxPageSize, minPageSize, pagerHeight, reservedHeight])

  return { containerRef, itemsPerPage }
}

const today = getTodayStamp()
const todoTitleMaxLength = 50
const todoCode = (id: number) => `TD-${id}`

const statusCopy: Record<ProjectStatus, string> = {
  active: '进行中',
  paused: '暂停',
  completed: '已结束',
  archived: '归档',
}

const priorityCopy: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const todoConfirmationCopy: Record<Todo['confirmationStatus'], string> = {
  confirmed: '已确认',
  pending_review: '待验收',
  rejected: '已驳回',
  acceptance_failed: '验收未通过',
}

type TodoAcceptanceDecision = 'passed' | 'failed'

function TodoAcceptanceDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (decision: TodoAcceptanceDecision, note: string) => Promise<boolean> | boolean | void
}) {
  const [decision, setDecision] = useState<TodoAcceptanceDecision>('passed')
  const [note, setNote] = useState('')
  const normalizedNote = note.trim()

  useEffect(() => {
    if (open) {
      setDecision('passed')
      setNote('')
    }
  }, [open])

  async function submit() {
    if (decision === 'failed' && !normalizedNote) return
    const saved = await onSubmit(decision, normalizedNote)
    if (saved !== false) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>验收待办</DialogTitle>
          <DialogDescription>请选择验收结果，并补充验收备注。</DialogDescription>
        </DialogHeader>
        <div className="todo-acceptance-decision" role="radiogroup" aria-label="验收结果">
          {([
            ['passed', '通过'],
            ['failed', '不通过'],
          ] as const).map(([value, label]) => (
            <label
              className={decision === value ? 'todo-acceptance-choice is-selected' : 'todo-acceptance-choice'}
              key={value}
            >
              <input
                checked={decision === value}
                name="todo-acceptance-decision"
                type="radio"
                value={value}
                onChange={() => setDecision(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <Label className="todo-acceptance-note-field">
          验收备注{decision === 'failed' ? '（必填）' : '（可选）'}
          <Textarea
            autoFocus={decision === 'failed'}
            placeholder={decision === 'failed' ? '请填写未通过原因...' : '可补充验收说明...'}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className={decision === 'failed' ? 'destructive-button' : 'solid-button'}
            disabled={decision === 'failed' && !normalizedNote}
            type="button"
            onClick={() => { void submit() }}
          >
            提交验收
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TodoConfirmSelect({
  done,
  status,
  disabled = false,
  onChange,
  onReject,
  onRequestAcceptance,
}: {
  done: boolean
  status: Todo['confirmationStatus']
  disabled?: boolean
  onChange: (status: Todo['confirmationStatus']) => void
  onReject: (reason: string) => void
  onRequestAcceptance: () => void
}) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const normalizedRejectReason = rejectReason.trim()

  function handleStatusChange(nextStatus: Todo['confirmationStatus']) {
    if (nextStatus === 'rejected') {
      setRejectReason('')
      setRejectDialogOpen(true)
      return
    }
    if (nextStatus === 'acceptance_failed' || (nextStatus === 'confirmed' && status === 'pending_review')) {
      onRequestAcceptance()
      return
    }
    onChange(nextStatus)
  }

  if (done) {
    return (
      <span className="todo-confirm-select completed" aria-label="状态：已完成">
        已完成
      </span>
    )
  }

  return (
    <>
      <Select
        disabled={disabled}
        value={status}
        onValueChange={(value) => handleStatusChange(value as Todo['confirmationStatus'])}
      >
        <SelectTrigger className={`todo-confirm-select ${status}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="confirmed">{todoConfirmationCopy.confirmed}</SelectItem>
          <SelectItem value="pending_review">{todoConfirmationCopy.pending_review}</SelectItem>
          <SelectItem value="rejected">{todoConfirmationCopy.rejected}</SelectItem>
          <SelectItem value="acceptance_failed">{todoConfirmationCopy.acceptance_failed}</SelectItem>
        </SelectContent>
      </Select>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>填写驳回理由</DialogTitle>
            <DialogDescription>需求不合理时可以驳回，请说明驳回原因。</DialogDescription>
          </DialogHeader>
          <Label className="todo-reject-reason-field">
            驳回理由（必填）
            <Textarea
              autoFocus
              placeholder="请填写驳回原因..."
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="destructive-button"
              disabled={!normalizedRejectReason}
              type="button"
              onClick={() => {
                onReject(normalizedRejectReason)
                setRejectDialogOpen(false)
              }}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function compareCreatedAtDesc<T extends { createdAt: string; id: number }>(left: T, right: T) {
  const createdAtDelta = right.createdAt.localeCompare(left.createdAt)
  if (createdAtDelta !== 0) return createdAtDelta
  return right.id - left.id
}

function compareTodoStatusThenCreatedAtDesc<T extends { createdAt: string; done: boolean; id: number }>(
  left: T,
  right: T,
) {
  if (left.done !== right.done) return left.done ? 1 : -1
  return compareCreatedAtDesc(left, right)
}

const todoFilterFieldLabels: Record<TodoFilterField, string> = {
  title: '待办内容',
  module: '所属模块',
  assignee: '负责人',
  watcher: '关注人',
  creator: '创建人',
  priority: '优先级',
  done: '完成状态',
  confirmationStatus: '确认状态',
  dueDate: '截止日期',
  createdAt: '创建日期',
}

const todoFilterOperatorLabels: Record<TodoFilterOperator, string> = {
  contains: '包含',
  not_contains: '不包含',
  equals: '等于',
  not_equals: '不等于',
  is_empty: '为空',
  is_not_empty: '不为空',
  before: '早于',
  after: '晚于',
  between: '介于',
}

const todoFilterFields: TodoFilterField[] = [
  'title',
  'module',
  'assignee',
  'watcher',
  'creator',
  'priority',
  'done',
  'confirmationStatus',
  'dueDate',
  'createdAt',
]

const todoFilterOperatorsByField: Record<TodoFilterField, TodoFilterOperator[]> = {
  title: ['contains', 'not_contains', 'equals', 'not_equals'],
  module: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  assignee: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  watcher: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  creator: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  priority: ['equals', 'not_equals'],
  done: ['equals', 'not_equals'],
  confirmationStatus: ['equals', 'not_equals'],
  dueDate: ['equals', 'not_equals', 'before', 'after', 'between'],
  createdAt: ['equals', 'not_equals', 'before', 'after', 'between'],
}

function createTodoFilterCondition(field: TodoFilterField = 'done'): TodoFilterCondition {
  const operator = todoFilterOperatorsByField[field][0]
  return {
    field,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operator,
    value: getDefaultTodoFilterValue(field, operator),
  }
}

function getDefaultTodoFilterValue(field: TodoFilterField, operator: TodoFilterOperator) {
  if (operator === 'is_empty' || operator === 'is_not_empty') return ''
  if ((field === 'dueDate' || field === 'createdAt') && operator === 'between') {
    return `${today}..${today}`
  }
  if (field === 'priority') return 'medium'
  if (field === 'done') return 'open'
  if (field === 'confirmationStatus') return 'confirmed'
  if (field === 'dueDate' || field === 'createdAt') return today
  return ''
}

function parseTodoFilterDateRange(value: string) {
  const [rawStart, rawEnd] = value.split('..')
  const start = rawStart || today
  const end = rawEnd || start
  return start <= end ? { start, end } : { start: end, end: start }
}

function isTodoFilterDateRangeCondition(condition: TodoFilterCondition) {
  return (condition.field === 'dueDate' || condition.field === 'createdAt') && condition.operator === 'between'
}

function normalizeTodoFilterCondition(condition: TodoFilterCondition): TodoFilterCondition {
  const allowedOperators = todoFilterOperatorsByField[condition.field]
  const operator = allowedOperators.includes(condition.operator)
    ? condition.operator
    : allowedOperators[0]
  const value = condition.value || getDefaultTodoFilterValue(condition.field, operator)
  return { ...condition, operator, value }
}

type TodoFilterPreference = {
  conditions: TodoFilterCondition[]
  join: TodoFilterJoin
}

function getTodoFilterPreferenceStorageKey(projectId: number, userId?: number) {
  return `${todoFilterPreferenceStoragePrefix}.${userId ?? 'anonymous'}.${projectId}`
}

function isStoredTodoFilterCondition(value: unknown): value is TodoFilterCondition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TodoFilterCondition>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.field !== 'string' ||
    typeof candidate.operator !== 'string' ||
    typeof candidate.value !== 'string'
  ) return false
  if (!todoFilterFields.includes(candidate.field as TodoFilterField)) return false
  return todoFilterOperatorsByField[candidate.field as TodoFilterField].includes(
    candidate.operator as TodoFilterOperator,
  )
}

function loadTodoFilterPreference(projectId: number, userId?: number): TodoFilterPreference | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getTodoFilterPreferenceStorageKey(projectId, userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      conditions?: unknown
      join?: unknown
      persist?: unknown
      version?: unknown
    }
    if (parsed.version !== 1 || parsed.persist !== true || !Array.isArray(parsed.conditions)) return null
    return {
      conditions: parsed.conditions
        .filter(isStoredTodoFilterCondition)
        .map((condition) => normalizeTodoFilterCondition(condition)),
      join: parsed.join === 'or' ? 'or' : 'and',
    }
  } catch {
    return null
  }
}

function saveTodoFilterPreference(projectId: number, userId: number | undefined, preference: TodoFilterPreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      getTodoFilterPreferenceStorageKey(projectId, userId),
      JSON.stringify({ ...preference, persist: true, version: 1 }),
    )
  } catch {
    // Keep filtering usable when browser storage is unavailable.
  }
}

function clearTodoFilterPreference(projectId: number, userId?: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getTodoFilterPreferenceStorageKey(projectId, userId))
  } catch {
    // Keep filtering usable when browser storage is unavailable.
  }
}

function getTodoFilterFieldValue(todo: Todo, field: TodoFilterField) {
  if (field === 'title') return todo.title
  if (field === 'module') return todo.moduleId ? String(todo.moduleId) : ''
  if (field === 'assignee') return todo.assigneeUserId ? String(todo.assigneeUserId) : ''
  if (field === 'watcher') return getTodoWatcherUserIds(todo).join(',')
  if (field === 'creator') return todo.createdByUserId ? String(todo.createdByUserId) : ''
  if (field === 'priority') return todo.priority
  if (field === 'done') return todo.done ? 'done' : 'open'
  if (field === 'confirmationStatus') return todo.confirmationStatus
  if (field === 'dueDate') return todo.dueDate
  return todo.createdAt.slice(0, 10)
}

function matchesTodoFilterCondition(todo: Todo, condition: TodoFilterCondition) {
  const normalized = normalizeTodoFilterCondition(condition)
  const targetValue = normalized.value
  const fieldValue = getTodoFilterFieldValue(todo, normalized.field)

  if (normalized.field === 'watcher') {
    const watcherIds = getTodoWatcherUserIds(todo)
    if (normalized.operator === 'is_empty') return watcherIds.length === 0
    if (normalized.operator === 'is_not_empty') return watcherIds.length > 0
    if (normalized.operator === 'contains') {
      return watcherIds.some((id) => String(id).includes(targetValue.trim()))
    }
    if (normalized.operator === 'not_contains') {
      return watcherIds.every((id) => !String(id).includes(targetValue.trim()))
    }
    if (normalized.operator === 'equals') {
      return watcherIds.includes(Number(targetValue))
    }
    if (normalized.operator === 'not_equals') {
      return !watcherIds.includes(Number(targetValue))
    }
  }

  if (normalized.operator === 'is_empty') return !fieldValue
  if (normalized.operator === 'is_not_empty') return Boolean(fieldValue)
  if (normalized.operator === 'contains') {
    return fieldValue.toLowerCase().includes(targetValue.trim().toLowerCase())
  }
  if (normalized.operator === 'not_contains') {
    return !fieldValue.toLowerCase().includes(targetValue.trim().toLowerCase())
  }
  if (normalized.operator === 'equals') return fieldValue === targetValue
  if (normalized.operator === 'not_equals') return fieldValue !== targetValue
  if (normalized.operator === 'before') return Boolean(fieldValue) && fieldValue < targetValue
  if (normalized.operator === 'after') return Boolean(fieldValue) && fieldValue > targetValue
  if (normalized.operator === 'between') {
    const range = parseTodoFilterDateRange(targetValue)
    return Boolean(fieldValue) && fieldValue >= range.start && fieldValue <= range.end
  }
  return true
}

function matchesTodoFilterConditions(
  todo: Todo,
  conditions: TodoFilterCondition[],
  join: TodoFilterJoin,
) {
  const activeConditions = conditions.filter((condition) => {
    const normalized = normalizeTodoFilterCondition(condition)
    return (
      normalized.operator === 'is_empty' ||
      normalized.operator === 'is_not_empty' ||
      Boolean(normalized.value.trim())
    )
  })
  if (activeConditions.length === 0) return true
  return join === 'and'
    ? activeConditions.every((condition) => matchesTodoFilterCondition(todo, condition))
    : activeConditions.some((condition) => matchesTodoFilterCondition(todo, condition))
}

function getDefaultProjectTodoFilterState(project: Project, currentUserId?: number) {
  if (project.readOnly || project.accessRole !== 'member' || currentUserId == null) {
    return {
      conditions: [] as TodoFilterCondition[],
      join: 'and' as TodoFilterJoin,
    }
  }
  return {
    conditions: [
      {
        ...createTodoFilterCondition('assignee'),
        value: String(currentUserId),
      },
      {
        ...createTodoFilterCondition('creator'),
        value: String(currentUserId),
      },
      {
        ...createTodoFilterCondition('watcher'),
        value: String(currentUserId),
      },
    ],
    join: 'or' as TodoFilterJoin,
  }
}

const initialProjects: Project[] = [
  {
    id: 1,
    accessRole: 'owner',
    name: 'AIGC 内容工作台',
    description: '',
    ownerName: 'Felix',
    ownerUserId: 1,
    status: 'active',
    createdAt: '2026-05-12 09:40',
    updatedAt: '今天 15:20',
    tags: ['AI', '内容生产', 'MVP'],
    risks: ['模型输出质量波动，需要确认评估标准'],
    riskJournalEntryIds: [101],
    modules: [],
    journals: [
      {
        id: 101,
        createdAt: `${today} 15:20:00`,
        authorUserId: 1,
        speakerName: 'Felix',
        visibility: 'private',
        content:
          '确认第一版以批量生成和人工精修为核心，不做复杂团队协作。下一步需要整理内容模板和评估维度。',
      },
      {
        id: 102,
        createdAt: '2026-05-14 18:40:00',
        authorUserId: 1,
        speakerName: 'Felix',
        visibility: 'private',
        content:
          '和设计侧讨论了编辑器结构，决定先保留单栏写作体验，把素材面板放到右侧抽屉。',
      },
    ],
  },
  {
    id: 2,
    accessRole: 'owner',
    name: '数据看板重构',
    description: '',
    ownerName: 'Felix',
    ownerUserId: 1,
    status: 'active',
    createdAt: '2026-05-10 14:20',
    updatedAt: '今天 11:05',
    tags: ['数据', '体验优化'],
    risks: ['旧指标口径不一致，可能影响上线验收'],
    riskJournalEntryIds: [201],
    modules: [],
    journals: [
      {
        id: 201,
        createdAt: `${today} 11:05:00`,
        authorUserId: 1,
        speakerName: 'Felix',
        visibility: 'private',
        content:
          '梳理了核心指标口径，发现转化漏斗和留存报表的数据源不一致，需要约业务方统一定义。',
      },
    ],
  },
  {
    id: 3,
    accessRole: 'owner',
    name: '内部知识库迁移',
    description: '',
    ownerName: 'Felix',
    ownerUserId: 1,
    status: 'paused',
    createdAt: '2026-05-08 10:15',
    updatedAt: '昨天 18:40',
    tags: ['知识库', '迁移'],
    risks: ['历史文档质量参差，自动整理前需要抽样检查'],
    riskJournalEntryIds: [301],
    modules: [],
    journals: [
      {
        id: 301,
        createdAt: '2026-05-14 19:06:00',
        authorUserId: 1,
        speakerName: 'Felix',
        visibility: 'private',
        content:
          '导入了第一批历史 Markdown。暂时不做结构化解析，先进入草稿箱，后续用 AI 帮助归类。',
      },
    ],
  },
  {
    id: 4,
    accessRole: 'owner',
    name: '支付链路稳定性',
    description: '',
    ownerName: 'Felix',
    ownerUserId: 1,
    status: 'completed',
    createdAt: '2026-05-01 16:30',
    updatedAt: '05-12 17:30',
    tags: ['交易', '稳定性'],
    risks: [],
    riskJournalEntryIds: [],
    modules: [],
    journals: [
      {
        id: 401,
        createdAt: '2026-05-12 17:30:00',
        authorUserId: 1,
        speakerName: 'Felix',
        visibility: 'private',
        content: '完成异常重试策略复盘，产出上线后监控清单。',
      },
    ],
  },
]

const initialTodos: Todo[] = [
  {
    id: 1,
    projectId: 1,
    createdAt: `${today} 16:10:00`,
    title: '整理内容模板的评估维度',
    detail: '',
    dueDate: today,
    priority: 'high',
    done: false,
    confirmationStatus: 'confirmed',
    linkedToDeliveryEvent: false,
    notes: [],
  },
  {
    id: 2,
    projectId: 2,
    createdAt: `${today} 11:40:00`,
    title: '约业务方确认转化漏斗口径',
    detail: '',
    dueDate: today,
    priority: 'high',
    done: false,
    confirmationStatus: 'confirmed',
    linkedToDeliveryEvent: false,
    notes: [],
  },
  {
    id: 3,
    projectId: 3,
    createdAt: '2026-05-15 09:30:00',
    title: '抽样检查 20 篇迁移文档',
    detail: '',
    dueDate: '2026-05-17',
    priority: 'medium',
    done: false,
    confirmationStatus: 'confirmed',
    linkedToDeliveryEvent: false,
    notes: [],
  },
  {
    id: 4,
    projectId: 4,
    createdAt: '2026-05-12 16:20:00',
    title: '补充监控清单归档链接',
    detail: '',
    dueDate: '2026-05-13',
    priority: 'low',
    done: true,
    confirmationStatus: 'confirmed',
    linkedToDeliveryEvent: false,
    notes: [],
  },
]

const initialMemberships: ProjectMembership[] = []
const emptyNotifications: NotificationCenterData = {
  accountOffboardingReceived: [],
  assignedPackageEvents: [],
  assignedTodos: [],
  watchedTodos: [],
  dueTomorrowTodos: [],
  noteMentions: [],
  invites: [],
  packageEventCommentMentions: [],
  projectTransfers: [],
}

const initialInbox: InboxItem[] = [
  {
    id: 1,
    source: 'manual',
    itemType: 'journal',
    content:
      '想到一个 AIGC 工作台的关键点：生成结果需要能按品牌语气做二次筛选，不只是批量产出。',
    createdAt: '今天 14:42',
    suggestedProjectId: 1,
    processed: false,
  },
  {
    id: 2,
    source: 'feishu',
    itemType: 'journal',
    content:
      '飞书群转发：业务方反馈数据看板里“激活用户”的口径和周报不一致，希望本周先统一。',
    createdAt: '今天 10:18',
    suggestedProjectId: 2,
    processed: false,
  },
  {
    id: 3,
    source: 'manual',
    itemType: 'journal',
    content: '知识库迁移可以先用 AI 做主题聚类，但不要自动改原文。',
    createdAt: '昨天 19:06',
    suggestedProjectId: 3,
    processed: true,
  },
]

const initialSummaries: Summary[] = [
  {
    id: 1,
    projectId: 1,
    type: 'weekly',
    title: '第 20 周周总结',
    period: '2026-05-11 至 2026-05-15',
    createdAt: '今天 15:35',
    content:
      '本周明确了 AIGC 内容工作台的第一版边界：批量生成、人工精修、模板评估。主要风险是模型输出质量稳定性，建议下周先建立小样本评估表。',
  },
]

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme)
  const [loggedIn, setLoggedIn] = useState(Boolean(getAuthToken()))
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const authUserId = authUser?.id
  const bugShareToken = getBugShareTokenFromPath()
  const todoShareToken = getTodoShareTokenFromPath(window.location.pathname)
  const [bugShareLoginRequested, setBugShareLoginRequested] = useState(false)
  const [todoShareLoginRequested, setTodoShareLoginRequested] = useState(false)
  const [authError, setAuthError] = useState('')
  const [roleSelectionOpen, setRoleSelectionOpen] = useState(false)
  const [roleSelectionBusy, setRoleSelectionBusy] = useState(false)
  const [displayNameOnboardingOpen, setDisplayNameOnboardingOpen] = useState(false)
  const [displayNameOnboardingDraft, setDisplayNameOnboardingDraft] = useState('')
  const [displayNameOnboardingError, setDisplayNameOnboardingError] = useState('')
  const [displayNameOnboardingBusy, setDisplayNameOnboardingBusy] = useState(false)
  const [inviteToken, setInviteToken] = useState(getInviteTokenFromUrl)
  const [organizationInviteToken, setOrganizationInviteToken] = useState(
    getOrganizationInviteTokenFromUrl,
  )
  const [settledInviteToken, setSettledInviteToken] = useState('')
  const [invitePasswordChecking, setInvitePasswordChecking] = useState(false)
  const [invitePasswordDraft, setInvitePasswordDraft] = useState('')
  const [invitePasswordError, setInvitePasswordError] = useState('')
  const [invitePasswordRequired, setInvitePasswordRequired] = useState(false)
  const [invitePasswordVerified, setInvitePasswordVerified] = useState(false)
  const [view, setView] = useState<View>(getInitialView)
  const [changelogCanManage, setChangelogCanManage] = useState(false)
  const [changelogEditorOpen, setChangelogEditorOpen] = useState(false)
  const [changelogCreateRequest, setChangelogCreateRequest] = useState(0)

  useEffect(() => {
    if (view === 'changelog') return
    setChangelogCanManage(false)
    setChangelogEditorOpen(false)
    setChangelogCreateRequest(0)
  }, [view])

  const [projects, setProjects] = useState(initialProjects)
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null)
  const [organizationContextReady, setOrganizationContextReady] = useState(false)
  const [organizationContextError, setOrganizationContextError] = useState('')
  const [todos, setTodos] = useState(initialTodos)
  const [memberships, setMemberships] = useState(initialMemberships)
  const [departedUserIds, setDepartedUserIds] = useState<number[]>([])
  const [notifications, setNotifications] = useState(emptyNotifications)
  const [openTodoCount, setOpenTodoCount] = useState(0)
  const [assignedBugCount, setAssignedBugCount] = useState(0)
  const [assignedBugCommentReadAtByBugId, setAssignedBugCommentReadAtByBugId] = useState<Record<number, string>>(() =>
    loadAssignedBugCommentReadAt(authUser?.id),
  )
  const [inbox, setInbox] = useState(initialInbox)
  const [summaries, setSummaries] = useState(initialSummaries)
  const [projectPackageTimelines, setProjectPackageTimelines] = useState<Record<number, ProjectPackageTimeline>>({})
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() =>
    loadStoredSelectedProjectId(),
  )
  const [pendingTodoDeepLinkId, setPendingTodoDeepLinkId] = useState(getTodoDeepLinkIdFromUrl)
  const [requestedAiTodoBatchId, setRequestedAiTodoBatchId] = useState<number | null>(() => {
    const parsed = parseAiTodoBatchDeepLink(window.location.search)
    return parsed.status === 'valid' ? parsed.batchId : null
  })
  const [requestedWeeklyReport, setRequestedWeeklyReport] = useState(() => parseWeeklyReportDeepLink(window.location.search))
  const [requestedTodoDetailId, setRequestedTodoDetailId] = useState<number | null>(null)
  const [requestedPackageEventId, setRequestedPackageEventId] = useState<number | null>(null)
  const [requestedAssignedBugId, setRequestedAssignedBugId] = useState<number | null>(null)
  const [detailEntrySource, setDetailEntrySource] = useState<DetailEntrySource>('project')
  const [isProjectTodoDetailActive, setIsProjectTodoDetailActive] = useState(false)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workspaceRefreshVersion, setWorkspaceRefreshVersion] = useState(0)
  const [organizationRefreshVersion, setOrganizationRefreshVersion] = useState(0)
  const [workspaceError, setWorkspaceError] = useState('')
  const [projectDetailTab, setProjectDetailTab] = useState<ProjectDetailTab>('journal')
  const [journalDraft, setJournalDraft] = useState('')
  const [inboxDraft, setInboxDraft] = useState('')
  const [todoDraft, setTodoDraft] = useState('')
  const [todoDetailDraft, setTodoDetailDraft] = useState('')
  const [todoDueDate, setTodoDueDate] = useState(today)
  const [todoCreatedAt, setTodoCreatedAt] = useState('')
  const [todoPriority, setTodoPriority] = useState<Priority>('medium')
  const [todoAssigneeUserId, setTodoAssigneeUserId] = useState<number | null>(null)
  const [todoWatcherUserIds, setTodoWatcherUserIds] = useState<number[]>([])
  const [todoReviewerUserId, setTodoReviewerUserId] = useState<number | null>(null)
  const [todoModuleId, setTodoModuleId] = useState<number | null>(null)
  const isLoadingTodoCreateDraftRef = useRef(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectTags, setNewProjectTags] = useState('')
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false)
  const [isProjectMembersDialogOpen, setIsProjectMembersDialogOpen] = useState(false)
  const [isProjectModulesDialogOpen, setIsProjectModulesDialogOpen] = useState(false)
  const [projectModuleDraft, setProjectModuleDraft] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [tagFilter, setTagFilter] = useState('全部')
  const [aiHistory, dispatchAiHistory] = useReducer(
    aiConversationHistoryReducer,
    GENERAL_AI_CONVERSATION_CONTEXT,
    createAiConversationHistoryState,
  )
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([])
  const [aiTurnLiveStates, setAiTurnLiveStates] = useState<Record<string, AiTurnLiveState>>({})
  const [aiTurnsLoading, setAiTurnsLoading] = useState(false)
  const [aiTurnsError, setAiTurnsError] = useState('')
  const [aiNextBeforeTurn, setAiNextBeforeTurn] = useState<number | null>(null)
  const [aiDraft, setAiDraft] = useState('')
  const [aiMobilePane, setAiMobilePane] = useState<AiMobilePane>(getDefaultAiPane)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiReconcileAttempt, setAiReconcileAttempt] = useState(0)
  const packageWorkbenchRef = useRef<ProjectPackageWorkbenchHandle>(null)
  const acceptingInviteTokenRef = useRef('')
  const acceptingOrganizationInviteTokenRef = useRef('')
  const notificationRefreshRequestIdRef = useRef(0)
  const notificationRefreshPromiseRef = useRef<Promise<NotificationCenterData | false> | null>(null)
  const workspaceRefreshRequestIdRef = useRef(0)
  const workspaceRefreshPromiseRef = useRef<Promise<boolean> | null>(null)
  const workspaceHydratedRef = useRef(false)
  const organizationContextReadyRef = useRef(false)
  const workspaceMutationEpochRef = useRef(0)
  const aiRequestIdRef = useRef(0)
  const authSessionGenerationRef = useRef(0)
  const aiHistoryRequestIdRef = useRef(0)
  const aiTurnsRequestIdRef = useRef(0)
  const deletingAiConversationIdsRef = useRef(new Set<string>())
  const summariesRef = useRef(summaries)
  summariesRef.current = summaries
  const activeAiTurnRef = useRef<{
    awaitingCanonical?: boolean
    conversationId: string
    localRequestId: number | null
    stopRequested?: boolean
    turnId: string
    userContent?: string
  } | null>(null)
  const aiSelectionRef = useRef(aiHistory.selection)
  aiSelectionRef.current = aiHistory.selection
  const aiProjectId = aiHistory.selection.context.projectId
  const selectedAiConversationId = currentAiConversationId(aiHistory.selection)
  const aiMessages = useMemo(
    () => aiTurns.flatMap((turn) => displayMessagesFromAiTurn(turn, aiTurnLiveStates[turn.id])),
    [aiTurnLiveStates, aiTurns],
  )

  const replaceAiConversationTurns = useCallback((
    result: Awaited<ReturnType<typeof fetchAiConversationTurns>>,
    mode: 'merge' | 'replace' = 'replace',
  ) => {
    dispatchAiHistory({
      type: 'conversation/upserted',
      conversation: toAiConversationListItem(result.conversation),
    })
    setAiTurns((current) => mode === 'merge'
      ? mergeAiTurns(current, result.turns)
      : result.turns)
    setAiTurnLiveStates((current) => {
      const terminalIds = new Set(
        result.turns.filter((turn) => turn.status !== 'processing').map((turn) => turn.id),
      )
      if (terminalIds.size === 0) return current
      return Object.fromEntries(
        Object.entries(current).filter(([turnId]) => !terminalIds.has(turnId)),
      )
    })
    if (mode === 'replace') setAiNextBeforeTurn(result.nextBeforeTurn)
    setAiTurnsError('')
    const processing = canonicalProcessingAiTurn(result.turns)
    if (processing) {
      const currentActive = activeAiTurnRef.current
      activeAiTurnRef.current = currentActive?.turnId === processing.id
        ? currentActive
        : {
            conversationId: result.conversation.id,
            localRequestId: null,
            turnId: processing.id,
          }
      setAiBusy(true)
    } else if (activeAiTurnRef.current?.conversationId === result.conversation.id) {
      activeAiTurnRef.current = null
      setAiBusy(false)
    }
  }, [])
  const selectRoleAfterSessionLoadRef = useRef(false)
  const hasStoredInitialViewRef = useRef(hasStoredInitialView())
  const isOrganizationAdmin = Boolean(authUser && hasOrganizationAdminRole(authUser.roles))
  const isDeveloperRole = authUser?.activeRole === 'developer'
  const canShowDeveloperAssignedBugs = isDeveloperRole && SHOW_DEVELOPER_ASSIGNED_BUGS_MODULE
  const canNavigateToDeveloperBugs = SHOW_DEVELOPER_ASSIGNED_BUGS_MODULE && (
    isDeveloperRole || isOrganizationAdmin
  )
  const canNavigateToTestWorkbench = authUser?.activeRole === 'tester'

  useEffect(() => {
    setAssignedBugCommentReadAtByBugId(loadAssignedBugCommentReadAt(authUser?.id))
  }, [authUser?.id])

  const updateAssignedBugCount = useCallback((bugs: Pick<TestBug, 'comments' | 'id' | 'status'>[]) => {
    setAssignedBugCount(bugs.filter((bug) => (
      unresolvedAssignedBugStatuses.has(bug.status)
        || hasUnreadExternalBugComment(bug, authUser?.id, assignedBugCommentReadAtByBugId)
    )).length)
  }, [assignedBugCommentReadAtByBugId, authUser?.id])

  const markAssignedBugCommentsRead = useCallback((bug: Pick<TestBug, 'comments' | 'id'>) => {
    const latestExternalCommentAt = getLatestExternalBugCommentTimestamp(bug, authUser?.id)
    if (latestExternalCommentAt === 0) return
    const nextReadAt = new Date(latestExternalCommentAt).toISOString()
    setAssignedBugCommentReadAtByBugId((current) => {
      const currentReadAt = current[bug.id] ? parseTodoNoteTimestamp(current[bug.id]) : 0
      if (currentReadAt >= latestExternalCommentAt) return current
      const next = { ...current, [bug.id]: nextReadAt }
      saveAssignedBugCommentReadAt(authUser?.id, next)
      return next
    })
  }, [authUser?.id])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
    document.documentElement.dataset.theme = themeMode

    try {
      window.localStorage.setItem(themeStorageKey, themeMode)
    } catch {
      // Ignore storage failures so theme switching still works for the session.
    }
  }, [themeMode])

  useEffect(() => {
    if (parseTodoDeepLink(window.location.search).status === 'invalid') {
      clearTodoDeepLinkFromUrl()
    }
    if (parseAiTodoBatchDeepLink(window.location.search).status === 'invalid') {
      window.history.replaceState({}, '', removeAiTodoBatchDeepLink(window.location))
    }
    if (parseWeeklyReportDeepLink(window.location.search).status === 'invalid') {
      const search = removeWeeklyReportDeepLink(window.location.search)
      window.history.replaceState({}, '', `${window.location.pathname}${search}${window.location.hash}`)
    }
  }, [])

  useEffect(() => {
    if (!loggedIn || requestedAiTodoBatchId == null) return
    setAiMobilePane(getDefaultAiPane())
    setView('ai')
  }, [loggedIn, requestedAiTodoBatchId])

  useEffect(() => {
    if (!loggedIn || requestedWeeklyReport.status !== 'valid') return
    setView('weekly_report')
    const search = removeWeeklyReportDeepLink(window.location.search)
    window.history.replaceState({}, '', `${window.location.pathname}${search}${window.location.hash}`)
  }, [loggedIn, requestedWeeklyReport])

  useEffect(() => {
    try {
      window.localStorage.setItem(viewStorageKey, view)
    } catch {
      // Keep navigation usable even when localStorage is unavailable.
    }
  }, [view])

  useEffect(() => {
    if (selectedProjectId == null) return
    try {
      window.localStorage.setItem(selectedProjectStorageKey, String(selectedProjectId))
    } catch {
      // Keep project navigation usable when localStorage is unavailable.
    }
  }, [selectedProjectId])

  useEffect(() => {
    if (!authUser) return
    if (!hasStoredInitialViewRef.current && view === 'search') {
      hasStoredInitialViewRef.current = true
      const roleLandingView = getRoleLandingView(authUser.activeRole)
      if (roleLandingView !== 'search') {
        setView(roleLandingView)
        return
      }
    }
    if (!canUseViewForUser(view, authUser)) {
      setView(getRoleLandingView(authUser.activeRole))
    }
  }, [authUser, view])

  useEffect(() => {
    if (!loggedIn || !canShowDeveloperAssignedBugs) {
      setAssignedBugCount(0)
      return
    }

    let alive = true
    fetchAssignedTestBugs()
      .then((result) => {
        if (alive) updateAssignedBugCount(result.bugs)
      })
      .catch(() => {
        if (alive) setAssignedBugCount(0)
      })

    return () => {
      alive = false
    }
  }, [canShowDeveloperAssignedBugs, loggedIn, updateAssignedBugCount])

  const applyWorkspace = useCallback((data: WorkspaceData) => {
    setProjects(data.projects)
    setTodos(data.todos)
    setMemberships(data.memberships)
    setDepartedUserIds(data.departedUserIds)
    setInbox(data.inbox)
    setSummaries(data.summaries)
    setProjectPackageTimelines((current) => {
      const next: Record<number, ProjectPackageTimeline> = {}
      for (const project of data.projects) {
        if (current[project.id]) next[project.id] = current[project.id]
      }
      return next
    })
    setSelectedProjectId((current) => {
      const preferredProjectId = current ?? loadStoredSelectedProjectId()
      if (
        preferredProjectId != null &&
        data.projects.some((project) => project.id === preferredProjectId)
      ) {
        return preferredProjectId
      }
      return data.projects[0]?.id ?? null
    })
  }, [])

  const applyAiRunOutcome = useCallback(async (outcome: AiTurnRunResponse['outcome']) => {
    if (
      outcome?.type !== 'summary' ||
      summariesRef.current.some((summary) => summary.id === outcome.summaryId)
    ) return
    const sessionGeneration = authSessionGenerationRef.current
    try {
      const workspace = await fetchWorkspace()
      if (authSessionGenerationRef.current !== sessionGeneration) return
      applyWorkspace(workspace)
    } catch {
      if (authSessionGenerationRef.current !== sessionGeneration) return
      setAiError('AI 文档已保存，但工作区刷新失败，请重新载入页面。')
    }
  }, [applyWorkspace])

  const applyCanonicalAiTurnOutcome = useCallback(async (turn: AiTurn | null | undefined) => {
    if (turn?.status !== 'completed') return
    setAiError('')
    await applyAiRunOutcome(turn.outcome)
  }, [applyAiRunOutcome])

  const applyAiWorkspaceForSession = useCallback((
    data: WorkspaceData,
    sessionGeneration: number,
  ) => {
    if (authSessionGenerationRef.current !== sessionGeneration) return
    applyWorkspace(data)
  }, [applyWorkspace])

  const refreshNotifications = useCallback(async () => {
    const existing = notificationRefreshPromiseRef.current
    if (existing) return existing

    const requestId = notificationRefreshRequestIdRef.current + 1
    notificationRefreshRequestIdRef.current = requestId
    const promise = (async () => {
      try {
        const result = await fetchNotifications()
        if (notificationRefreshRequestIdRef.current === requestId) {
          setNotifications(result.notifications)
        }
        return result.notifications
      } catch {
        return false
      }
    })()
    notificationRefreshPromiseRef.current = promise
    promise.then(
      () => {
        if (notificationRefreshPromiseRef.current === promise) {
          notificationRefreshPromiseRef.current = null
        }
      },
      () => {
        if (notificationRefreshPromiseRef.current === promise) {
          notificationRefreshPromiseRef.current = null
        }
      },
    )
    return promise
  }, [])

  const refreshWorkspace = useCallback(async () => {
    const existing = workspaceRefreshPromiseRef.current
    if (existing) return existing

    const requestId = workspaceRefreshRequestIdRef.current + 1
    workspaceRefreshRequestIdRef.current = requestId
    const sessionGeneration = authSessionGenerationRef.current
    const mutationEpoch = workspaceMutationEpochRef.current
    const promise = (async () => {
      try {
        const data = await fetchWorkspace()
        if (
          authSessionGenerationRef.current !== sessionGeneration ||
          workspaceRefreshRequestIdRef.current !== requestId ||
          workspaceMutationEpochRef.current !== mutationEpoch
        ) return false
        applyWorkspace(data)
        setWorkspaceRefreshVersion((current) => current + 1)
        return true
      } catch {
        // Background refresh is best-effort; the existing view remains usable.
        return false
      }
    })()
    workspaceRefreshPromiseRef.current = promise
    promise.then(
      () => {
        if (workspaceRefreshPromiseRef.current === promise) {
          workspaceRefreshPromiseRef.current = null
        }
      },
      () => {
        if (workspaceRefreshPromiseRef.current === promise) {
          workspaceRefreshPromiseRef.current = null
        }
      },
    )
    return promise
  }, [applyWorkspace])

  useEffect(() => {
    if (!loggedIn) return

    const sessionGeneration = authSessionGenerationRef.current
    fetchCurrentUser()
      .then((data) => {
        if (authSessionGenerationRef.current !== sessionGeneration) return
        setAuthUser(data.user)
        if (
          selectRoleAfterSessionLoadRef.current &&
          getSwitchableUserRoles(data.user.roles).length > 1
        ) {
          setRoleSelectionOpen(true)
        }
        selectRoleAfterSessionLoadRef.current = false
        applyWorkspace(data.workspace)
        void refreshNotifications()
        setWorkspaceError('')
      })
      .catch(() => {
        if (authSessionGenerationRef.current !== sessionGeneration) return
        authSessionGenerationRef.current += 1
        notificationRefreshPromiseRef.current = null
        workspaceRefreshPromiseRef.current = null
        workspaceHydratedRef.current = false
        clearAuthToken()
        setLoggedIn(false)
        setWorkspaceError('')
        setAuthError('登录状态已失效，请重新登录。')
      })
      .finally(() => {
        if (authSessionGenerationRef.current === sessionGeneration) setWorkspaceLoaded(true)
      })
  }, [applyWorkspace, loggedIn, refreshNotifications])

  useEffect(() => {
    if (!loggedIn || !authUserId) {
      organizationContextReadyRef.current = false
      setOrganizations([])
      setSelectedOrganizationId(null)
      setOrganizationContextReady(false)
      setOrganizationContextError('')
      return
    }

    let active = true
    setOrganizationContextError('')
    fetchOrganizations()
      .then(({ organizations: nextOrganizations }) => {
        if (!active) return
        const storedOrganizationId = loadStoredSelectedOrganizationId(authUserId)
        setOrganizations(nextOrganizations)
        setSelectedOrganizationId((current) => {
          if (
            storedOrganizationId !== undefined &&
            (storedOrganizationId == null || nextOrganizations.some((item) => item.id === storedOrganizationId))
          ) {
            return storedOrganizationId
          }
          if (current != null && nextOrganizations.some((item) => item.id === current)) {
            return current
          }
          return nextOrganizations[0]?.id ?? null
        })
        organizationContextReadyRef.current = true
        setOrganizationContextReady(true)
      })
      .catch((error) => {
        if (!active) return
        setOrganizationContextError(
          error instanceof Error && error.message
            ? error.message
            : '组织列表读取失败，请刷新页面重试。',
        )
        if (!organizationContextReadyRef.current) setOrganizationContextReady(false)
      })
    return () => {
      active = false
    }
  }, [authUserId, loggedIn, organizationRefreshVersion, workspaceRefreshVersion])

  useEffect(() => {
    if (!loggedIn || !authUser) return

    const historyRequestId = aiHistoryRequestIdRef.current + 1
    aiHistoryRequestIdRef.current = historyRequestId
    dispatchAiHistory({ type: 'history/load-started', mode: 'initial' })
    fetchAiConversations()
      .then(async (page) => {
        if (aiHistoryRequestIdRef.current !== historyRequestId) return
        const conversations = page.conversations
          .filter((conversation) => !deletingAiConversationIdsRef.current.has(conversation.id))
          .map(toAiConversationListItem)
        dispatchAiHistory({
          type: 'history/load-succeeded',
          conversations,
          mode: 'initial',
          nextCursor: page.nextCursor,
        })
        const latest = conversations[0]
        if (!latest) {
          setAiTurns([])
          setAiTurnLiveStates({})
          setAiNextBeforeTurn(null)
          setAiTurnsError('')
          dispatchAiHistory({
            type: 'conversation/blanked',
            context: GENERAL_AI_CONVERSATION_CONTEXT,
          })
          return
        }

        const turnsRequestId = aiTurnsRequestIdRef.current + 1
        aiTurnsRequestIdRef.current = turnsRequestId
        setAiTurnsLoading(true)
        setAiTurnsError('')
        try {
          const result = await fetchAiConversationTurns(latest.id)
          if (
            aiHistoryRequestIdRef.current !== historyRequestId ||
            aiTurnsRequestIdRef.current !== turnsRequestId
          ) return
          replaceAiConversationTurns(result)
          await applyCanonicalAiTurnOutcome(
            [...result.turns].reverse().find((turn) =>
              turn.status === 'completed' && turn.outcome?.type === 'summary'),
          )
        } catch (error) {
          if (
            aiHistoryRequestIdRef.current !== historyRequestId ||
            aiTurnsRequestIdRef.current !== turnsRequestId
          ) return
          setAiTurnsError(
            error instanceof Error && error.message
              ? error.message
              : '无法恢复最近的对话。',
          )
        }
      })
      .catch((error) => {
        if (aiHistoryRequestIdRef.current !== historyRequestId) return
        const message = error instanceof Error && error.message
          ? error.message
          : '无法读取历史对话。'
        dispatchAiHistory({ type: 'history/load-failed', error: message })
        setAiTurnsError(message)
      })
      .finally(() => {
        if (aiHistoryRequestIdRef.current === historyRequestId) setAiTurnsLoading(false)
      })

    return () => {
      if (aiHistoryRequestIdRef.current === historyRequestId) {
        aiHistoryRequestIdRef.current += 1
        aiTurnsRequestIdRef.current += 1
      }
    }
  }, [applyCanonicalAiTurnOutcome, authUser, loggedIn, replaceAiConversationTurns])

  useEffect(() => {
    const processing = canonicalProcessingAiTurn(aiTurns)
    const active = activeAiTurnRef.current
    const conversationId = selectedAiConversationId ?? (
      active && processing && active.turnId === processing.id ? active.conversationId : null
    )
    if (!loggedIn || !conversationId || !processing) return

    if (
      !active ||
      active.conversationId !== conversationId ||
      active.turnId !== processing.id
    ) {
      activeAiTurnRef.current = {
        conversationId,
        localRequestId: null,
        turnId: processing.id,
      }
    }
    setAiBusy(true)

    let cancelled = false
    const sessionGeneration = authSessionGenerationRef.current
    const isCurrentRequest = () => {
      if (cancelled || authSessionGenerationRef.current !== sessionGeneration) return false
      const currentConversationId = currentAiConversationId(aiSelectionRef.current)
      const currentActive = activeAiTurnRef.current
      return currentConversationId === conversationId || (
        currentActive?.conversationId === conversationId &&
        currentActive.turnId === processing.id
      )
    }
    const timeout = window.setTimeout(() => {
      reconcileAiConversationTurn(conversationId, processing.id)
        .then(async (result) => {
          if (!isCurrentRequest()) return
          dispatchAiHistory({
            type: 'conversation/upserted',
            conversation: toAiConversationListItem(result.conversation),
          })
          setAiTurns((current) => mergeAiTurns(current, [result.turn]))
          setAiTurnsError('')
          if (result.turn.status !== 'processing') {
            clearAiTurnLiveState(result.turn.id)
            if (activeAiTurnRef.current?.turnId === result.turn.id) {
              activeAiTurnRef.current = null
            }
            setAiBusy(false)
            await applyCanonicalAiTurnOutcome(result.turn)
          }
        })
        .catch((error) => {
          if (!isCurrentRequest()) return
          const activeTurn = activeAiTurnRef.current
          if (
            error instanceof ApiError &&
            error.status === 404 &&
            activeTurn?.localRequestId === null
          ) {
            hideUnavailableAiConversation(conversationId)
            return
          }
          if (activeTurn?.localRequestId === null) {
            markAiTurnReconciling(
              processing.id,
              processing.intentKind === 'chat' || processing.intentKind === 'conversation-analysis'
                ? 'text'
                : 'progress',
            )
          }
          setAiReconcileAttempt((current) => current + 1)
        })
    }, 1_500)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    aiReconcileAttempt,
    aiTurns,
    applyCanonicalAiTurnOutcome,
    loggedIn,
    selectedAiConversationId,
  ])

  useEffect(() => {
    if (!loggedIn) return
    return startNotificationRefreshSchedule({
      clearInterval: (handle) => window.clearInterval(handle),
      isVisible: () => document.visibilityState === 'visible',
      onFocus: (listener) => {
        window.addEventListener('focus', listener)
        return () => window.removeEventListener('focus', listener)
      },
      onVisibilityChange: (listener) => {
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
      },
      refresh: () => refreshNotifications().then((result) => result !== false),
      setInterval: (listener, delay) => window.setInterval(listener, delay),
    })
  }, [loggedIn, refreshNotifications])

  useEffect(() => {
    if (!loggedIn) return
    return startNotificationRefreshSchedule({
      clearInterval: (handle) => window.clearInterval(handle),
      intervalMs: workspaceRefreshIntervalMs,
      isVisible: () => document.visibilityState === 'visible',
      onFocus: (listener) => {
        window.addEventListener('focus', listener)
        return () => window.removeEventListener('focus', listener)
      },
      onVisibilityChange: (listener) => {
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
      },
      refresh: () => refreshWorkspace(),
      setInterval: (listener, delay) => window.setInterval(listener, delay),
    })
  }, [loggedIn, refreshWorkspace])

  const activePackageMarketOrganization = selectedOrganizationId == null
    ? null
    : organizations.find(
      (organization) => organization.id === selectedOrganizationId && organization.packageMarketEnabled,
    ) ?? null
  const packageMarketVisible = activePackageMarketOrganization !== null

  useEffect(() => {
    if (view === 'package_market' && !packageMarketVisible) {
      setView('search')
    }
  }, [packageMarketVisible, view])

  useEffect(() => {
    if (!loggedIn || !workspaceLoaded) return
    if (!workspaceHydratedRef.current) {
      workspaceHydratedRef.current = true
      return
    }
    void refreshWorkspace()
  }, [loggedIn, view, workspaceLoaded, refreshWorkspace])

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
    fetchProjectInviteLinkInfo(inviteToken)
      .then((data) => {
        if (cancelled) return
        setInvitePasswordRequired(data.passwordRequired)
        setInvitePasswordVerified(!data.passwordRequired)
        setInvitePasswordError('')
      })
      .catch(() => {
        if (cancelled) return
        setInvitePasswordError('项目邀请链接无效或已失效。')
      })
      .finally(() => {
        if (!cancelled) setInvitePasswordChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [inviteToken])

  useEffect(() => {
    const url = new URL(window.location.href)
    const fragmentParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '')
    const hasFeishuAuthFragment =
      fragmentParams.has('feishuAuth') ||
      fragmentParams.has('token') ||
      fragmentParams.has('feishuAuthMessage')
    const feishuAuthStatus = fragmentParams.get('feishuAuth') ?? url.searchParams.get('feishuAuth')
    if (feishuAuthStatus) {
      const token = fragmentParams.get('token') ?? url.searchParams.get('token') ?? ''
      const message = fragmentParams.get('feishuAuthMessage') ?? url.searchParams.get('feishuAuthMessage')
      url.searchParams.delete('feishuAuth')
      url.searchParams.delete('token')
      url.searchParams.delete('feishuAuthMessage')
      if (hasFeishuAuthFragment) {
        fragmentParams.delete('feishuAuth')
        fragmentParams.delete('token')
        fragmentParams.delete('feishuAuthMessage')
        url.hash = fragmentParams.toString()
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)

      if (feishuAuthStatus === 'success' && token) {
        selectRoleAfterSessionLoadRef.current = true
        setAuthToken(token)
        setLoggedIn(true)
        setAuthError('')
        if (inviteToken) {
          setInviteToken('')
          clearInviteTokenFromUrl()
        }
        if (organizationInviteToken) {
          setOrganizationInviteToken('')
          clearOrganizationInviteTokenFromUrl()
        }
      } else {
        setAuthError(message || '飞书登录失败，请稍后重试。')
      }
      return
    }

    const hasFeishuBindFragment =
      fragmentParams.has('feishuBind') || fragmentParams.has('feishuBindMessage')
    const feishuBindStatus = fragmentParams.get('feishuBind') ?? url.searchParams.get('feishuBind')
    if (!feishuBindStatus) return

    const message = fragmentParams.get('feishuBindMessage') ?? url.searchParams.get('feishuBindMessage')
    if (feishuBindStatus !== 'success') {
      setWorkspaceError(message || '飞书账号绑定失败，请稍后重试。')
    }
    url.searchParams.delete('feishuBind')
    url.searchParams.delete('feishuBindMessage')
    if (hasFeishuBindFragment) {
      fragmentParams.delete('feishuBind')
      fragmentParams.delete('feishuBindMessage')
      url.hash = fragmentParams.toString()
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [inviteToken, organizationInviteToken])

  const scopedProjects = useMemo(
    () => organizationContextReady
      ? projects.filter((project) => (project.organizationId ?? null) === selectedOrganizationId)
      : [],
    [organizationContextReady, projects, selectedOrganizationId],
  )
  const selectedProject =
    scopedProjects.find((project) => project.id === selectedProjectId) ?? scopedProjects[0]
  const selectedOrganizationName = selectedOrganizationId == null
    ? '个人项目'
    : organizations.find((organization) => organization.id === selectedOrganizationId)?.name ?? '组织项目'
  const selectedProjectDraftId = selectedProject?.id
  const activeInvitePassword =
    inviteToken && invitePasswordRequired && invitePasswordVerified
      ? invitePasswordDraft.trim()
      : undefined

  useEffect(() => {
    setSelectedProjectId((current) => {
      if (current != null && scopedProjects.some((project) => project.id === current)) {
        return current
      }
      return scopedProjects[0]?.id ?? null
    })
  }, [scopedProjects])

  useEffect(() => {
    if (aiProjectId == null || projects.some((project) => project.id === aiProjectId)) return

    aiRequestIdRef.current += 1
    aiHistoryRequestIdRef.current += 1
    aiTurnsRequestIdRef.current += 1
    activeAiTurnRef.current = null
    dispatchAiHistory({
      type: 'conversation/blanked',
      context: GENERAL_AI_CONVERSATION_CONTEXT,
    })
    setAiTurns([])
    setAiTurnLiveStates({})
    setAiTurnsLoading(false)
    setAiNextBeforeTurn(null)
    setAiTurnsError('当前项目已不可访问，已开始新的普通对话。')
    setAiDraft('')
    setAiBusy(false)
    setAiError('')
  }, [aiProjectId, projects])

  useEffect(() => {
    if (view !== 'project' || requestedTodoDetailId == null) return
    const frame = window.requestAnimationFrame(() => setRequestedTodoDetailId(null))
    return () => window.cancelAnimationFrame(frame)
  }, [requestedTodoDetailId, view])

  useEffect(() => {
    if (
      view !== 'project' ||
      projectDetailTab !== 'packages' ||
      requestedPackageEventId == null ||
      !selectedProject ||
      !projectPackageTimelines[selectedProject.id]
    ) return
    const frame = window.requestAnimationFrame(() => {
      packageWorkbenchRef.current?.selectEvent(requestedPackageEventId)
      setRequestedPackageEventId(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [
    projectDetailTab,
    projectPackageTimelines,
    requestedPackageEventId,
    selectedProject,
    view,
  ])

  useEffect(() => {
    if (!selectedProjectDraftId) return
    isLoadingTodoCreateDraftRef.current = true
    const draft = loadTodoCreateDraft(selectedProjectDraftId, authUser?.id)
    setTodoDraft(draft.draft)
    setTodoDetailDraft(draft.detail)
    setTodoDueDate(draft.dueDate)
    setTodoCreatedAt(draft.createdAt)
    setTodoPriority(draft.priority)
    setTodoAssigneeUserId(draft.assigneeUserId)
    setTodoWatcherUserIds(draft.watcherUserIds)
    setTodoReviewerUserId(draft.reviewerUserId)
    setTodoModuleId(draft.moduleId)
  }, [authUser?.id, selectedProjectDraftId])

  useEffect(() => {
    if (!selectedProjectDraftId) return
    if (isLoadingTodoCreateDraftRef.current) {
      isLoadingTodoCreateDraftRef.current = false
      return
    }
    saveTodoCreateDraft(selectedProjectDraftId, authUser?.id, {
      assigneeUserId: todoAssigneeUserId,
      watcherUserIds: todoWatcherUserIds,
      reviewerUserId: todoReviewerUserId,
      createdAt: todoCreatedAt,
      detail: todoDetailDraft,
      draft: todoDraft,
      dueDate: todoDueDate,
      moduleId: todoModuleId,
      priority: todoPriority,
    })
  }, [
    authUser?.id,
    selectedProjectDraftId,
    todoAssigneeUserId,
    todoWatcherUserIds,
    todoReviewerUserId,
    todoCreatedAt,
    todoDetailDraft,
    todoDraft,
    todoDueDate,
    todoModuleId,
    todoPriority,
  ])

  useEffect(() => {
    if (!loggedIn || !selectedProject || projectDetailTab !== 'packages') return

    fetchProjectPackageTimeline(selectedProject.id)
      .then((timeline) => {
        setProjectPackageTimelines((current) => ({
          ...current,
          [selectedProject.id]: timeline,
        }))
      })
      .catch(() => {
        setWorkspaceError('安装升级时间线读取失败，请确认后端服务和 OSS 配置正常。')
      })
  }, [loggedIn, projectDetailTab, selectedProject?.id, workspaceRefreshVersion])

  useEffect(() => {
    if (!loggedIn || !workspaceLoaded || !authUser || !inviteToken) return
    if (invitePasswordRequired && !invitePasswordVerified) return
    if (acceptingInviteTokenRef.current === inviteToken) return

    acceptingInviteTokenRef.current = inviteToken
    acceptProjectInviteLink(inviteToken, { password: activeInvitePassword })
      .then(({ workspace }) => {
        applyWorkspace(workspace)
        setWorkspaceError('')
        setInviteToken('')
        clearInviteTokenFromUrl()
      })
      .catch(() => {
        setSettledInviteToken(inviteToken)
        setWorkspaceError('项目邀请链接无效或已失效。')
      })
      .finally(() => {
        acceptingInviteTokenRef.current = ''
      })
  }, [
    activeInvitePassword,
    applyWorkspace,
    authUser,
    invitePasswordRequired,
    invitePasswordVerified,
    inviteToken,
    loggedIn,
    workspaceLoaded,
  ])

  useEffect(() => {
    if (!loggedIn || !workspaceLoaded || !authUser || !organizationInviteToken) return
    if (acceptingOrganizationInviteTokenRef.current === organizationInviteToken) return

    acceptingOrganizationInviteTokenRef.current = organizationInviteToken
    acceptOrganizationInviteLink(organizationInviteToken)
      .then(() => {
        setWorkspaceError('')
        setOrganizationInviteToken('')
        clearOrganizationInviteTokenFromUrl()
        setWorkspaceRefreshVersion((current) => current + 1)
        setOrganizationRefreshVersion((current) => current + 1)
      })
      .catch(() => {
        setWorkspaceError('组织邀请链接无效或已失效。')
      })
      .finally(() => {
        acceptingOrganizationInviteTokenRef.current = ''
      })
  }, [authUser, loggedIn, organizationInviteToken, workspaceLoaded])

  useEffect(() => {
    if (
      !loggedIn ||
      !workspaceLoaded ||
      !authUser ||
      !organizationContextReady ||
      shouldDeferTodoDeepLinkForInvite(inviteToken, settledInviteToken) ||
      pendingTodoDeepLinkId == null
    ) return

    const todo = resolveTodoDeepLinkTarget({
      projectIds: projects.map((project) => project.id),
      todoId: pendingTodoDeepLinkId,
      todos,
    })
    setPendingTodoDeepLinkId(null)
    clearTodoDeepLinkFromUrl()
    if (!todo) {
      setWorkspaceError('待办不存在或你无权访问')
      return
    }

    const targetProject = projects.find((project) => project.id === todo.projectId)
    if (targetProject) {
      const targetOrganizationId = targetProject.organizationId ?? null
      if (
        targetOrganizationId === null ||
        organizations.some((organization) => organization.id === targetOrganizationId)
      ) {
        setSelectedOrganizationId(targetOrganizationId)
        persistSelectedOrganizationId(authUser.id, targetOrganizationId)
      }
    }

    setDetailEntrySource('project')
    setRequestedTodoDetailId(todo.id)
    setRequestedPackageEventId(null)
    setSelectedProjectId(todo.projectId)
    setJournalDraft('')
    setProjectDetailTab('journal')
    setView('project')
  }, [
    authUser,
    inviteToken,
    loggedIn,
    organizationContextReady,
    organizations,
    pendingTodoDeepLinkId,
    projects,
    settledInviteToken,
    todos,
    workspaceLoaded,
  ])

  const toggleThemeMode = useCallback(() => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const projectTodos = selectedProject
    ? todos.filter((todo) => todo.projectId === selectedProject.id)
    : []
  const allTags = ['全部', ...Array.from(new Set(scopedProjects.flatMap((p) => p.tags)))]

  const filteredResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    return scopedProjects
      .filter((project) => {
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter
        const matchesTag = tagFilter === '全部' || project.tags.includes(tagFilter)
        const projectText = [
          project.name,
          project.description,
          project.tags.join(' '),
          project.journals.map((entry) => entry.content).join(' '),
          todos
            .filter((todo) => todo.projectId === project.id)
            .map((todo) => todo.title)
            .join(' '),
          summaries
            .filter((summary) => summary.projectId === project.id)
            .map((summary) => summary.content)
            .join(' '),
        ]
          .join(' ')
          .toLowerCase()
        const matchesQuery = !query || projectText.includes(query)
        return matchesStatus && matchesTag && matchesQuery
      })
      .sort((left, right) => {
        const journalDiff = getProjectJournalSortKey(right).localeCompare(
          getProjectJournalSortKey(left),
        )
        if (journalDiff !== 0) return journalDiff
        return right.id - left.id
      })
  }, [scopedProjects, search, statusFilter, summaries, tagFilter, todos])

  const openNotificationCount = useMemo(
    () =>
      notifications.invites.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.projectTransfers.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.accountOffboardingReceived.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.assignedPackageEvents.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.assignedTodos.filter((item) => !item.dismissedAt && !item.readAt && !item.done).length +
      notifications.watchedTodos.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.dueTomorrowTodos.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.noteMentions.filter((item) => !item.dismissedAt && !item.readAt).length +
      notifications.packageEventCommentMentions.filter((item) => !item.dismissedAt && !item.readAt).length,
    [notifications],
  )
  useEffect(() => {
    if (!loggedIn || !workspaceLoaded || !authUser?.id) {
      setOpenTodoCount(0)
      return
    }
    let active = true
    void fetchMyWork({ kind: 'todo', limit: 500, status: 'open' })
      .then((result) => {
        if (active) setOpenTodoCount(result.items.length)
      })
      .catch(() => {
        if (active) setOpenTodoCount(0)
      })
    return () => {
      active = false
    }
  }, [authUser?.id, loggedIn, todos, workspaceLoaded])
  async function submitInvitePassword() {
    if (!inviteToken) return
    const password = invitePasswordDraft.trim()
    if (!password) {
      setInvitePasswordError('请输入邀请密码。')
      return
    }

    setInvitePasswordChecking(true)
    setInvitePasswordError('')
    try {
      await verifyProjectInviteLink(inviteToken, { password })
      setInvitePasswordRequired(true)
      setInvitePasswordVerified(true)
    } catch {
      setInvitePasswordVerified(false)
      setInvitePasswordError('邀请密码不正确，请检查后重试。')
    } finally {
      setInvitePasswordChecking(false)
    }
  }

  async function signIn(username: string, password: string, mode: 'login' | 'register') {
    setAuthError('')
    if (inviteToken && invitePasswordRequired && !invitePasswordVerified) {
      setAuthError('请先输入邀请密码。')
      return
    }
    try {
      const result =
        mode === 'register'
          ? await registerAccount({
              username,
              password,
              inviteToken: inviteToken || undefined,
              invitePassword: activeInvitePassword,
              organizationInviteToken: organizationInviteToken || undefined,
            })
          : await loginAccount({
              username,
              password,
              inviteToken: inviteToken || undefined,
              invitePassword: activeInvitePassword,
              organizationInviteToken: organizationInviteToken || undefined,
            })
      setAuthToken(result.token)
      setAuthUser(result.user)
      setRoleSelectionOpen(getSwitchableUserRoles(result.user.roles).length > 1)
      if (result.isNewUser) {
        setDisplayNameOnboardingDraft('')
        setDisplayNameOnboardingError('')
        setDisplayNameOnboardingOpen(true)
      }
      applyWorkspace(result.workspace)
      setLoggedIn(true)
      setWorkspaceLoaded(true)
      if (inviteToken) {
        setInviteToken('')
        clearInviteTokenFromUrl()
      }
      if (organizationInviteToken) {
        setOrganizationInviteToken('')
        clearOrganizationInviteTokenFromUrl()
      }
      void refreshNotifications()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (mode === 'register' && message.includes('active project or organization invite')) {
        setAuthError('系统已启用共享 AI，请通过有效项目或组织邀请，也可以使用飞书登录创建账号。')
      } else {
        setAuthError(
          mode === 'register'
            ? '注册失败，请确认用户名未被使用且密码不少于 6 位。'
            : '登录失败，请检查用户名和密码。',
        )
      }
    }
  }

  async function signInWithFeishu() {
    setAuthError('')
    setRoleSelectionOpen(false)
    if (inviteToken && invitePasswordRequired && !invitePasswordVerified) {
      setAuthError('请先输入邀请密码。')
      return
    }
    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const result = await createFeishuOAuthUrl({
        inviteToken: inviteToken || undefined,
        invitePassword: activeInvitePassword,
        organizationInviteToken: organizationInviteToken || undefined,
        returnTo,
      })
      window.location.href = result.url
    } catch (error) {
      setAuthError(
        error instanceof Error && error.message
          ? error.message
          : '飞书登录入口暂时不可用，请稍后重试。',
      )
    }
  }

  function signOut() {
    authSessionGenerationRef.current += 1
    notificationRefreshRequestIdRef.current += 1
    workspaceRefreshRequestIdRef.current += 1
    notificationRefreshPromiseRef.current = null
    workspaceRefreshPromiseRef.current = null
    workspaceHydratedRef.current = false
    workspaceMutationEpochRef.current += 1
    aiRequestIdRef.current += 1
    aiHistoryRequestIdRef.current += 1
    aiTurnsRequestIdRef.current += 1
    activeAiTurnRef.current = null
    deletingAiConversationIdsRef.current.clear()
    clearAuthToken()
    setLoggedIn(false)
    setAuthUser(null)
    setAuthError('')
    setRoleSelectionOpen(false)
    setDisplayNameOnboardingOpen(false)
    setDisplayNameOnboardingDraft('')
    setDisplayNameOnboardingError('')
    setWorkspaceError('')
    setWorkspaceLoaded(false)
    setNotifications(emptyNotifications)
    dispatchAiHistory({ type: 'session/reset' })
    setAiTurns([])
    setAiTurnLiveStates({})
    setAiTurnsLoading(false)
    setAiTurnsError('')
    setAiNextBeforeTurn(null)
    setAiDraft('')
    setAiBusy(false)
    setAiError('')
    setAiMobilePane(getDefaultAiPane())
  }

  async function updateAccountSettings(payload: {
    displayName: string
  }) {
    const nextDisplayName = payload.displayName.trim()
    if (!nextDisplayName) return

    try {
      const result = await updateCurrentUser({
        displayName: nextDisplayName,
      })
      setAuthUser(result.user)
      setWorkspaceError('')
    } catch (error) {
      setWorkspaceError('账户设置保存失败，请稍后再试。')
      throw error
    }
  }

  async function changeActiveUserRole(role: SwitchableUserRole, targetView?: View) {
    if (!authUser) return

    const roleLandingView = targetView ?? getRoleLandingView(role)
    if (authUser.activeRole === role) {
      setRoleSelectionOpen(false)
      setView(roleLandingView)
      return
    }
    setRoleSelectionBusy(true)
    setWorkspaceError('')
    try {
      await switchActiveRole(role)
      setAuthUser((current) => current ? { ...current, activeRole: role } : current)
      setRoleSelectionOpen(false)
      setView(roleLandingView)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : '身份切换失败，请稍后重试。')
    } finally {
      setRoleSelectionBusy(false)
    }
  }

  function openAssignedBugFromShare(bugId: number) {
    setRequestedAssignedBugId(bugId)
    setBugShareLoginRequested(false)
    window.history.replaceState({}, '', `/?assignedBug=${bugId}`)
    void changeActiveUserRole('developer', 'assigned_bugs')
  }

  function returnToVegesFromShare() {
    window.history.replaceState({}, '', '/')
    setBugShareLoginRequested(false)
    setTodoShareLoginRequested(false)
    setView('search')
  }

  function openTodoFromShare(todoId: number) {
    window.history.replaceState({}, '', `/?todo=${todoId}`)
    setTodoShareLoginRequested(false)
    setPendingTodoDeepLinkId(todoId)
  }

  async function saveOnboardingDisplayName() {
    const nextDisplayName = displayNameOnboardingDraft.trim()
    if (!nextDisplayName) {
      setDisplayNameOnboardingError('请填写真实姓名。')
      return
    }
    if (authUser && nextDisplayName === authUser.username) {
      setDisplayNameOnboardingError('请填写真实姓名，不要继续使用登录用户名。')
      return
    }

    setDisplayNameOnboardingBusy(true)
    setDisplayNameOnboardingError('')
    try {
      const result = await updateCurrentUser({
        displayName: nextDisplayName,
      })
      setAuthUser(result.user)
      setDisplayNameOnboardingOpen(false)
      setDisplayNameOnboardingDraft('')
      setWorkspaceError('')
    } catch {
      setDisplayNameOnboardingError('昵称保存失败，请稍后再试。')
    } finally {
      setDisplayNameOnboardingBusy(false)
    }
  }

  async function disconnectFeishuBinding() {
    const result = await disconnectFeishuAccount()
    setAuthUser(result.user)
    setWorkspaceError('')
    return result.user
  }

  async function runMutation(operation: () => Promise<WorkspaceData>) {
    workspaceMutationEpochRef.current += 1
    try {
      const data = await operation()
      applyWorkspace(data)
      setWorkspaceRefreshVersion((current) => current + 1)
      void refreshNotifications()
      setWorkspaceError('')
      return data
    } catch (error) {
      setWorkspaceError(error instanceof Error && error.message
        ? error.message
        : '操作没有写入数据库，请确认后端服务和数据库连接正常。')
      return null
    }
  }

  function setOrganizationContextForProject(projectId: number) {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return
    const nextOrganizationId = project.organizationId ?? null
    if (
      nextOrganizationId !== null &&
      !organizations.some((organization) => organization.id === nextOrganizationId)
    ) return
    setSelectedOrganizationId(nextOrganizationId)
    if (authUser) persistSelectedOrganizationId(authUser.id, nextOrganizationId)
  }

  function changeOrganization(value: string) {
    const nextOrganizationId = value === 'personal' ? null : Number(value)
    if (
      nextOrganizationId !== null &&
      (!Number.isSafeInteger(nextOrganizationId) ||
        !organizations.some((organization) => organization.id === nextOrganizationId))
    ) return

    setSelectedOrganizationId(nextOrganizationId)
    if (authUser) persistSelectedOrganizationId(authUser.id, nextOrganizationId)
    setSelectedProjectId(null)
    setRequestedTodoDetailId(null)
    setRequestedPackageEventId(null)
    setIsProjectTodoDetailActive(false)
    setDetailEntrySource('project')
    setProjectDetailTab('journal')
    if (view === 'project') setView('search')
  }

  function selectProject(projectId: number) {
    setDetailEntrySource('project')
    setRequestedTodoDetailId(null)
    setRequestedPackageEventId(null)
    setOrganizationContextForProject(projectId)
    setSelectedProjectId(projectId)
    setJournalDraft('')
    setProjectDetailTab('journal')
    setView('project')
  }

  function selectMyWorkTodo(projectId: number, todoId: number) {
    setDetailEntrySource('my_work')
    setRequestedTodoDetailId(todoId)
    setRequestedPackageEventId(null)
    setOrganizationContextForProject(projectId)
    setSelectedProjectId(projectId)
    setJournalDraft('')
    setProjectDetailTab('journal')
    setView('project')
  }

  function selectMyWorkPackageEvent(projectId: number, eventId: number) {
    setDetailEntrySource('my_work')
    setRequestedTodoDetailId(null)
    setOrganizationContextForProject(projectId)
    setRequestedPackageEventId(eventId)
    setSelectedProjectId(projectId)
    setJournalDraft('')
    setProjectDetailTab('packages')
    setView('project')
  }

  function returnToNotifications() {
    setRequestedTodoDetailId(null)
    setRequestedPackageEventId(null)
    setIsProjectTodoDetailActive(false)
    setDetailEntrySource('project')
    setView('notifications')
    void refreshNotifications()
  }

  function returnToMyWork() {
    setRequestedTodoDetailId(null)
    setRequestedPackageEventId(null)
    setIsProjectTodoDetailActive(false)
    setDetailEntrySource('project')
    setView('my_work')
  }

  async function openNotificationCenter() {
    setDetailEntrySource('project')
    setView('notifications')
    const readAt = new Date().toISOString()
    setNotifications((current) => ({
      accountOffboardingReceived: current.accountOffboardingReceived.map((item) => ({ ...item, readAt })),
      invites: current.invites.map((item) => ({ ...item, readAt })),
      assignedPackageEvents: current.assignedPackageEvents.map((item) => ({ ...item, readAt })),
      assignedTodos: current.assignedTodos.map((item) => ({ ...item, readAt })),
      watchedTodos: current.watchedTodos.map((item) => ({ ...item, readAt })),
      dueTomorrowTodos: current.dueTomorrowTodos.map((item) => ({ ...item, readAt })),
      noteMentions: current.noteMentions.map((item) => ({ ...item, readAt })),
      packageEventCommentMentions: current.packageEventCommentMentions.map((item) => ({ ...item, readAt })),
      projectTransfers: current.projectTransfers.map((item) => ({ ...item, readAt })),
    }))
    try {
      const result = await markAllNotificationsRead()
      setNotifications(result.notifications)
    } catch {
      void refreshNotifications()
    }
  }

  function openMyWork() {
    setDetailEntrySource('project')
    setView('my_work')
  }

  function changeNewProjectDialogOpen(open: boolean) {
    setIsNewProjectDialogOpen(open)
    if (!open) {
      setNewProjectName('')
      setNewProjectTags('')
    }
  }

  async function addProject() {
    const name = newProjectName.trim()
    if (!name) return

    const tags = newProjectTags
      .split(/[\s,，、]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)

    const data = await runMutation(() =>
      createProject({
        name,
        organizationId: selectedOrganizationId ?? undefined,
        tags: tags.length > 0 ? tags : ['新项目'],
      }),
    )
    if (!data) return
    const createdProject = data?.projects.find((project) => project.name === name)
    if (createdProject) setSelectedProjectId(createdProject.id)
    setNewProjectName('')
    setNewProjectTags('')
    setJournalDraft('')
    setIsNewProjectDialogOpen(false)
    setView(createdProject ? 'project' : 'search')
  }

  async function saveJournal(createdAt?: string) {
    const content = journalDraft.trim()
    if (!content || !selectedProject) return false

    const draftAtSubmit = journalDraft
    const data = await runMutation(() => createJournalEntry(selectedProject.id, content, createdAt))
    if (!data) return false
    setJournalDraft((current) => current === draftAtSubmit ? '' : current)
    return true
  }

  async function renameProject(projectId: number, name: string) {
    const nextName = name.trim()
    if (!nextName) return

    await runMutation(() => updateProject(projectId, { name: nextName }))
  }

  async function updateProjectDescription(projectId: number, description: string) {
    await runMutation(() => updateProject(projectId, { description: description.trim() }))
  }

  async function updateProjectStatus(projectId: number, status: ProjectStatus) {
    await runMutation(() => updateProject(projectId, { status }))
  }

  async function deleteProject(projectId: number) {
    const nextProject = scopedProjects.find((project) => project.id !== projectId)
    await runMutation(() => removeProject(projectId))
    clearTodoCreateDraft(projectId, authUser?.id)
    setSelectedProjectId(nextProject?.id ?? 0)
    setJournalDraft('')
    setTodoDraft('')
    setTodoDueDate(today)
    setTodoCreatedAt('')
    setTodoPriority('medium')
    setTodoAssigneeUserId(null)
    setTodoWatcherUserIds([])
    setTodoReviewerUserId(null)
    setTodoModuleId(null)
    setView('project')
  }

  async function deleteJournalEntry(projectId: number, entryId: number) {
    await runMutation(() => removeJournalEntry(projectId, entryId))
  }

  async function editJournalEntry(projectId: number, entryId: number, content: string) {
    const nextContent = content.trim()
    if (!nextContent) return

    await runMutation(() => updateJournalEntry(projectId, entryId, { content: nextContent }))
  }

  async function updateJournalVisibility(
    projectId: number,
    entryId: number,
    visibility: JournalVisibility,
  ) {
    await runMutation(() => updateJournalEntry(projectId, entryId, { visibility }))
  }

  async function toggleJournalRisk(projectId: number, entryId: number, isRiskEntry: boolean) {
    await runMutation(() =>
      isRiskEntry
        ? resolveRiskFromJournal(projectId, entryId)
        : createRiskFromJournal(projectId, entryId),
    )
  }

  async function addInboxItem() {
    const content = inboxDraft.trim()
    if (!content) return
    await runMutation(() =>
      createDraft({ content, suggestedProjectId: selectedProject?.id }),
    )
    setInboxDraft('')
  }

  async function inviteMember(projectId: number, username: string) {
    const nextUsername = username.trim()
    if (!nextUsername) return
    await runMutation(() => inviteProjectMember(projectId, { username: nextUsername }))
  }

  async function deleteMember(projectId: number, membershipId: number) {
    await runMutation(() => removeProjectMember(projectId, membershipId))
  }

  async function saveProjectFeishuSettings(projectId: number, payload: {
    feishuChatEnabled: boolean
    feishuChatId: string
  }) {
    await runMutation(() => updateProjectFeishuSettings(projectId, payload))
  }

  async function copyProjectInviteLink(
    projectId: number,
    payload: {
      encryptedShare: boolean
      expiresInMinutes: number
      password?: string
    },
  ) {
    const inviteLink = await getProjectInviteLink(projectId, {
      expiresInMinutes: payload.expiresInMinutes,
      password: payload.password,
      rotate: true,
    })
    const { token } = inviteLink
    const inviteUrl = buildProjectInviteUrl(token)
    if (!navigator.clipboard) throw new Error('Clipboard is not available')
    const project = projects.find((item) => item.id === projectId)
    const inviterName = authUser?.displayName || authUser?.username || '项目成员'
    const projectName = project?.name || 'Veges'
    const shareText =
      payload.encryptedShare && payload.password
        ? `${inviterName} 邀请你加入 ${projectName} 项目，请点击此链接进入：${inviteUrl}，密码：${payload.password}`
        : inviteUrl
    await navigator.clipboard.writeText(shareText)
    return {
      ...inviteLink,
      password: payload.password,
      url: inviteUrl,
    }
  }

  async function createModule(projectId: number, rawName: string): Promise<ProjectModule | null> {
    const name = rawName.trim()
    if (!name) return null
    const data = await runMutation(() => createProjectModule(projectId, { name }))
    if (!data) return null
    const project = data.projects.find((item) => item.id === projectId)
    return project?.modules.find((module) => module.name === name) ?? null
  }

  async function addProjectModule(projectId: number) {
    const module = await createModule(projectId, projectModuleDraft)
    if (!module) return
    setProjectModuleDraft('')
  }

  async function deleteProjectModule(projectId: number, moduleId: number) {
    const data = await runMutation(() => removeProjectModule(projectId, moduleId))
    if (!data) return
    if (todoModuleId === moduleId) {
      setTodoModuleId(null)
    }
  }

  async function archiveInboxItem(item: InboxItem, projectId: number) {
    await runMutation(() => archiveDraft(item.id, projectId))
  }

  async function deleteInboxItem(itemId: number) {
    await runMutation(() => removeDraft(itemId))
  }

  async function addTodo(projectId?: number) {
    const targetProjectId = projectId ?? selectedProject?.id
    const title = stripTodoMentions(todoDraft, getProjectMentionOptions(targetProjectId, scopedProjects, memberships)).trim()
    if (!title || !targetProjectId) return
    const data = await runMutation(() =>
      createTodo({
        assigneeUserId: todoAssigneeUserId ?? undefined,
        watcherUserIds: todoWatcherUserIds,
        reviewerUserId: todoReviewerUserId ?? undefined,
        detail: todoDetailDraft,
        moduleId: todoModuleId ?? undefined,
        projectId: targetProjectId,
        title,
        createdAt: todoCreatedAt || undefined,
        dueDate: todoDueDate,
        priority: todoPriority,
      }),
    )
    if (!data) return
    clearTodoCreateDraft(projectId ?? targetProjectId, authUser?.id)
    setTodoDraft('')
    setTodoDetailDraft('')
    setTodoDueDate(today)
    setTodoCreatedAt('')
    setTodoPriority('medium')
    setTodoAssigneeUserId(null)
    setTodoWatcherUserIds([])
    setTodoReviewerUserId(null)
    setTodoModuleId(null)
  }

  function clearTodoCreateDraftState(projectId?: number) {
    const targetProjectId = projectId ?? selectedProject?.id
    if (targetProjectId) {
      clearTodoCreateDraft(targetProjectId, authUser?.id)
    }
    setTodoDraft('')
    setTodoDetailDraft('')
    setTodoDueDate(today)
    setTodoCreatedAt('')
    setTodoPriority('medium')
    setTodoAssigneeUserId(null)
    setTodoWatcherUserIds([])
    setTodoReviewerUserId(null)
    setTodoModuleId(null)
  }

  async function updateTodoDetails(todoId: number, payload: TodoUpdatePayload) {
    return Boolean(await runMutation(() => updateTodo(todoId, payload)))
  }

  async function addTodoNote(todoId: number, content: string) {
    await runMutation(() => createTodoNote(todoId, { content }))
  }

  async function editTodoNote(todoId: number, noteId: number, content: string) {
    await runMutation(() => updateTodoNote(todoId, noteId, { content }))
  }

  async function acceptInvitation(membershipId: number) {
    try {
      const result = await acceptProjectInvitation(membershipId)
      applyWorkspace(result.workspace)
      setNotifications(result.notifications)
      setWorkspaceRefreshVersion((current) => current + 1)
      setWorkspaceError('')
    } catch {
      setWorkspaceError('邀请处理失败，请稍后再试。')
    }
  }

  async function ignoreInvitation(membershipId: number) {
    try {
      const result = await declineProjectInvitation(membershipId)
      applyWorkspace(result.workspace)
      setNotifications(result.notifications)
      setWorkspaceRefreshVersion((current) => current + 1)
      setWorkspaceError('')
    } catch {
      setWorkspaceError('邀请处理失败，请稍后再试。')
    }
  }

  async function respondProjectTransfer(transferId: number, action: 'accept' | 'decline') {
    try {
      const result = await respondToProjectTransfer(transferId, action)
      applyWorkspace(result.workspace)
      setNotifications(result.notifications)
      setWorkspaceRefreshVersion((current) => current + 1)
      setWorkspaceError('')
    } catch {
      setWorkspaceError('项目转移处理失败，请刷新后重试。')
    }
  }

  async function deleteTodo(todoId: number) {
    await runMutation(() => removeTodo(todoId))
  }

  async function generateSummary(projectId: number, type: SummaryPeriodType) {
    const data = await runMutation(() => createSummary(projectId, type))
    if (data) {
      setAiMobilePane('artifacts')
      setView('ai')
    }
    return Boolean(data)
  }

  async function saveInstallEvent(
    eventId: number | null,
    payload: ProjectPackageEventSavePayload,
  ) {
    if (!selectedProject) return null
    try {
      const timeline = eventId == null
        ? await createProjectPackageEvent(selectedProject.id, payload)
        : await saveProjectPackageEventDraft(selectedProject.id, eventId, payload)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      if (payload.action === 'publish') await refreshNotifications()
      setWorkspaceError('')
      return eventId == null
        ? [...timeline.events].sort((left, right) => right.id - left.id)[0] ?? null
        : timeline.events.find((event) => event.id === eventId) ?? null
    } catch {
      setWorkspaceError(payload.action === 'publish'
        ? '交付事件发布失败，请检查必填内容后重试。'
        : '交付事件草稿保存失败，请稍后再试。')
      return null
    }
  }

  async function completeInstallEvent(eventId: number) {
    if (!selectedProject) return false
    try {
      const timeline = await completeProjectPackageEvent(selectedProject.id, eventId)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      await refreshNotifications()
      setWorkspaceError('')
      return true
    } catch {
      setWorkspaceError('交付事件状态更新失败，请稍后再试。')
      return false
    }
  }

  async function addInstallEventComment(eventId: number, content: string) {
    if (!selectedProject) return false
    try {
      const timeline = await addPackageEventComment(selectedProject.id, eventId, content)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
      return true
    } catch {
      setWorkspaceError('交付反馈发送失败，请稍后再试。')
      return false
    }
  }

  async function updateInstallEventComment(eventId: number, commentId: number, content: string) {
    if (!selectedProject) return false
    try {
      const timeline = await updatePackageEventComment(selectedProject.id, eventId, commentId, content)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
      return true
    } catch {
      setWorkspaceError('交付反馈更新失败，请稍后再试。')
      return false
    }
  }

  async function deleteInstallEventComment(eventId: number, commentId: number) {
    if (!selectedProject) return false
    try {
      const timeline = await deletePackageEventComment(selectedProject.id, eventId, commentId)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
      return true
    } catch {
      setWorkspaceError('交付反馈删除失败，请稍后再试。')
      return false
    }
  }

  async function deleteInstallEvent(eventId: number) {
    if (!selectedProject) return false
    try {
      const timeline = await removeProjectPackageEvent(selectedProject.id, eventId)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      try {
        const workspace = await fetchWorkspace()
        applyWorkspace(workspace)
      } catch {
        // The event is already deleted, so keep the timeline result if workspace refresh fails.
      }
      setWorkspaceError('')
      return true
    } catch {
      setWorkspaceError('安装事件删除失败，请稍后再试。')
      return false
    }
  }

  async function loadInstallItemDownloadUrl(itemId: number) {
    if (!selectedProject) throw new Error('Project not found')
    try {
      const result = await fetchProjectPackageItemDownloadUrl(selectedProject.id, itemId)
      setWorkspaceError('')
      return result.downloadUrl
    } catch (error) {
      setWorkspaceError(formatApiErrorDiagnostic(error, '安装包链接生成失败，请稍后再试。'))
      throw error
    }
  }

  async function deleteInstallGroup(groupId: number) {
    if (!selectedProject) return
    try {
      const timeline = await removeProjectPackageGroup(selectedProject.id, groupId)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      try {
        const workspace = await fetchWorkspace()
        applyWorkspace(workspace)
      } catch {
        // The package group is already deleted, so keep the timeline result if workspace refresh fails.
      }
      setWorkspaceError('')
    } catch {
      setWorkspaceError('安装包删除失败，请稍后再试。')
    }
  }

  async function createInstallOperation(payload: {
    eventId: number
    groupId?: number | null
    kind: ProjectPackageOperationKind
    title?: string
    label?: string
    content?: string
    completed?: boolean
    status?: ProjectPackageOperationStatus
    relatedTodoIds?: number[]
    relatedTodoNotes?: Record<number, string>
  }) {
    if (!selectedProject) return false
    try {
      const timeline = await createProjectPackageOperation(selectedProject.id, payload)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
      try {
        const workspace = await fetchWorkspace()
        applyWorkspace(workspace)
      } catch {
        // The install record has already been persisted, so a follow-up
        // workspace refresh failure should not surface as a save failure.
      }
      if (payload.completed === true) {
        await refreshNotifications()
      }
      return true
    } catch {
      setWorkspaceError('安装记录保存失败，请稍后再试。')
      return false
    }
  }

  async function updateInstallOperation(
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
    if (!selectedProject) return false
    try {
      const timeline = await updateProjectPackageOperation(selectedProject.id, operationId, payload)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
      try {
        const workspace = await fetchWorkspace()
        applyWorkspace(workspace)
      } catch {
        // Keep the successful mutation result on screen even if the
        // background workspace sync temporarily fails.
      }
      if (payload.completed !== undefined) {
        await refreshNotifications()
      }
      return true
    } catch {
      setWorkspaceError('安装记录更新失败，请稍后再试。')
      return false
    }
  }

  async function deleteInstallOperation(operationId: number) {
    if (!selectedProject) return
    try {
      const timeline = await removeProjectPackageOperation(selectedProject.id, operationId)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      try {
        const workspace = await fetchWorkspace()
        applyWorkspace(workspace)
      } catch {
        // The operation is already deleted, so keep the timeline result if workspace refresh fails.
      }
      setWorkspaceError('')
    } catch {
      setWorkspaceError('安装记录删除失败，请稍后再试。')
    }
  }

  async function exportInstallTimeline(eventId?: number) {
    if (!selectedProject) return { fileName: '项目时间线.md', markdown: '' }
    try {
      const result = await exportProjectPackageTimeline(selectedProject.id, eventId)
      setWorkspaceError('')
      return result
    } catch {
      setWorkspaceError('安装升级时间线导出失败，请稍后再试。')
      throw new Error('安装升级时间线导出失败')
    }
  }

  async function loadPackageMarketRules(
    context?: PackageMarketRequestContext,
  ): Promise<PackageMarketRulesResponse> {
    return fetchPackageMarketRules(context)
  }

  async function loadPackageMarketDetail(payload: {
    arch: string
    channel: PackageMarketChannel
    ciBranch?: string
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    expireMinutes?: number
    includeAll?: boolean
    packageId: string
    releaseVersion?: string
    context?: PackageMarketRequestContext
  }): Promise<PackageMarketDetail> {
    if (payload.packageId === 'base-pro' || payload.packageId === 'base-oss') {
      return fetchPackageMarketBaseDetail({
        arch: payload.arch,
        channel: payload.channel,
        ciBranch: payload.ciBranch,
        ciVersion: payload.ciVersion,
        deployType: payload.packageId === 'base-oss' ? 'oss' : 'pro',
        expireMinutes: payload.expireMinutes,
        includeAll: payload.includeAll,
        releaseVersion: payload.releaseVersion,
        context: payload.context,
      })
    }
    return fetchPackageMarketDetail(payload)
  }

  async function loadPackageMarketCiBranches(
    packageId: string,
    context?: PackageMarketRequestContext,
  ): Promise<PackageMarketCiBranch[]> {
    return (await fetchPackageMarketCiBranches({ context, packageId })).branches
  }

  async function loadPackageMarketVersions(payload: {
    arch: string
    ciBranch?: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    includeAll?: boolean
    packageId: string
    context?: PackageMarketRequestContext
  }): Promise<PackageMarketVersion[]> {
    if (payload.kind === 'ci') {
      return (await fetchPackageMarketCiVersions({
        arch: payload.arch,
        ciBranch: payload.ciBranch,
        includeAll: payload.includeAll,
        packageId: payload.packageId,
        context: payload.context,
      })).versions
    }

    if (payload.packageId === 'base-pro' || payload.packageId === 'base-oss') {
      return (await fetchPackageMarketBaseReleaseVersions({
        arch: payload.arch,
        deployType: payload.packageId === 'base-oss' ? 'oss' : 'pro',
        includeAll: payload.includeAll,
        context: payload.context,
      })).versions
    }

    return (await fetchPackageMarketReleaseVersions(payload)).versions
  }

  async function stopActiveAiTurn() {
    const active = activeAiTurnRef.current
    if (!active) return

    const requestId = aiRequestIdRef.current
    activeAiTurnRef.current = { ...active, localRequestId: null, stopRequested: true }
    setAiBusy(true)
    setAiError('')
    try {
      const result = await cancelAiConversationTurn(active.conversationId, active.turnId)
      if (aiRequestIdRef.current !== requestId) return
      aiRequestIdRef.current += 1
      if (result.pending) {
        activeAiTurnRef.current = null
        setAiTurns((current) => current.filter((turn) => turn.id !== active.turnId))
        clearAiTurnLiveState(active.turnId)
        if (active.userContent) setAiDraft((current) => current || active.userContent || '')
        setAiBusy(false)
        setAiTurnsError('')
        return
      }
      dispatchAiHistory({
        type: 'conversation/upserted',
        conversation: toAiConversationListItem(result.conversation),
      })
      setAiTurns((current) => mergeAiTurns(current, [result.turn]))
      if (result.turn.status !== 'processing') {
        activeAiTurnRef.current = null
        setAiBusy(false)
        clearAiTurnLiveState(active.turnId)
      }
    } catch {
      if (aiRequestIdRef.current !== requestId) return
      try {
        const restored = await fetchAiConversationTurns(active.conversationId)
        if (aiRequestIdRef.current !== requestId) return
        const canonicalTurn = restored.turns.find((turn) => turn.id === active.turnId)
        if (!canonicalTurn) {
          markAiTurnReconciling(active.turnId, 'text')
          return
        }
        aiRequestIdRef.current += 1
        replaceAiConversationTurns(restored, 'merge')
        await applyCanonicalAiTurnOutcome(canonicalTurn)
        return
      } catch {
        if (aiRequestIdRef.current !== requestId) return
      }
      if (activeAiTurnRef.current) {
        markAiTurnReconciling(active.turnId, 'text')
      }
    }
  }

  async function loadAiHistoryPage(mode: 'initial' | 'more' = 'initial') {
    if (mode === 'more' && !aiHistory.nextCursor) return null
    const requestId = aiHistoryRequestIdRef.current + 1
    aiHistoryRequestIdRef.current = requestId
    dispatchAiHistory({ type: 'history/load-started', mode })
    try {
      const page = await fetchAiConversations(
        mode === 'more' ? aiHistory.nextCursor ?? undefined : undefined,
      )
      if (aiHistoryRequestIdRef.current !== requestId) return null
      const conversations = page.conversations
        .filter((conversation) => !deletingAiConversationIdsRef.current.has(conversation.id))
        .map(toAiConversationListItem)
      dispatchAiHistory({
        type: 'history/load-succeeded',
        conversations,
        mode,
        nextCursor: page.nextCursor,
      })
      return conversations
    } catch (error) {
      if (aiHistoryRequestIdRef.current !== requestId) return
      dispatchAiHistory({
        type: 'history/load-failed',
        error: error instanceof Error && error.message
          ? error.message
          : '无法读取历史对话。',
      })
      return null
    }
  }

  async function retryAiHistory() {
    const conversations = await loadAiHistoryPage('initial')
    if (!conversations) return
    const currentId = currentAiConversationId(aiSelectionRef.current)
    const target = conversations.find((conversation) => conversation.id === currentId)
      ?? conversations[0]
    if (target) await selectAiConversationHistory(target, true)
    else setAiTurnsError('')
  }

  async function selectAiConversationHistory(
    conversation: AiConversationListItem,
    force = false,
  ) {
    if (deletingAiConversationIdsRef.current.has(conversation.id)) return
    if (!force && currentAiConversationId(aiSelectionRef.current) === conversation.id) {
      if (window.matchMedia('(max-width: 1100px)').matches) setAiMobilePane('workspace')
      return
    }
    await stopActiveAiTurn()
    if (activeAiTurnRef.current) return
    aiRequestIdRef.current += 1
    aiHistoryRequestIdRef.current += 1
    dispatchAiHistory({ type: 'history/load-cancelled' })
    const requestId = aiTurnsRequestIdRef.current + 1
    aiTurnsRequestIdRef.current = requestId
    setAiTurnsLoading(true)
    setAiTurnsError('')
    try {
      const result = await fetchAiConversationTurns(conversation.id)
      if (
        aiTurnsRequestIdRef.current !== requestId ||
        deletingAiConversationIdsRef.current.has(conversation.id)
      ) return
      replaceAiConversationTurns(result)
      await applyCanonicalAiTurnOutcome(
        [...result.turns].reverse().find((turn) =>
          turn.status === 'completed' && turn.outcome?.type === 'summary'),
      )
      if (aiTurnsRequestIdRef.current !== requestId) return
      setAiDraft('')
      setAiError('')
      if (window.matchMedia('(max-width: 1100px)').matches) setAiMobilePane('workspace')
    } catch (error) {
      if (aiTurnsRequestIdRef.current !== requestId) return
      setAiTurnsError(
        error instanceof Error && error.message
          ? error.message
          : '无法读取这段对话。',
      )
    } finally {
      if (aiTurnsRequestIdRef.current === requestId) setAiTurnsLoading(false)
    }
  }

  async function loadEarlierAiTurns() {
    const conversationId = currentAiConversationId(aiHistory.selection)
    if (!conversationId || aiNextBeforeTurn == null || aiTurnsLoading) return
    const requestId = aiTurnsRequestIdRef.current + 1
    aiTurnsRequestIdRef.current = requestId
    setAiTurnsLoading(true)
    setAiTurnsError('')
    try {
      const result = await fetchAiConversationTurns(conversationId, aiNextBeforeTurn)
      if (aiTurnsRequestIdRef.current !== requestId) return
      setAiTurns((current) => mergeAiTurns(result.turns, current))
      setAiNextBeforeTurn(result.nextBeforeTurn)
      await applyCanonicalAiTurnOutcome(
        [...result.turns].reverse().find((turn) =>
          turn.status === 'completed' && turn.outcome?.type === 'summary'),
      )
    } catch (error) {
      if (aiTurnsRequestIdRef.current !== requestId) return
      setAiTurnsError(
        error instanceof Error && error.message
          ? error.message
          : '无法加载更早的消息。',
      )
    } finally {
      if (aiTurnsRequestIdRef.current === requestId) setAiTurnsLoading(false)
    }
  }

  async function renameAiConversationHistory(conversationId: string, title: string) {
    if (deletingAiConversationIdsRef.current.has(conversationId)) return
    const result = await renameAiConversation(conversationId, title)
    if (deletingAiConversationIdsRef.current.has(conversationId)) return
    const conversation = toAiConversationListItem(result.conversation)
    dispatchAiHistory({
      type: 'conversation/renamed',
      conversationId,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    })
  }

  async function deleteAiConversationHistory(conversationId: string) {
    if (deletingAiConversationIdsRef.current.has(conversationId)) return
    deletingAiConversationIdsRef.current.add(conversationId)
    const deletedCurrent = currentAiConversationId(aiSelectionRef.current) === conversationId
    const deletingActive = activeAiTurnRef.current?.conversationId === conversationId
    if (deletedCurrent || deletingActive) {
      aiTurnsRequestIdRef.current += 1
      setAiTurnsLoading(false)
    }
    aiHistoryRequestIdRef.current += 1
    dispatchAiHistory({ type: 'history/load-cancelled' })
    if (deletingActive) await stopActiveAiTurn()
    if (activeAiTurnRef.current?.conversationId === conversationId) {
      deletingAiConversationIdsRef.current.delete(conversationId)
      return
    }
    if (deletedCurrent) aiRequestIdRef.current += 1
    try {
      await deleteAiConversation(conversationId)
    } catch (error) {
      deletingAiConversationIdsRef.current.delete(conversationId)
      throw error
    }
    dispatchAiHistory({ type: 'conversation/deleted', conversationId })
    if (deletedCurrent) {
      aiTurnsRequestIdRef.current += 1
      setAiTurns([])
      setAiTurnLiveStates({})
      setAiNextBeforeTurn(null)
      setAiTurnsError('')
      setAiDraft('')
      setAiError('')
    }
  }

  function clearAiTurnLiveState(turnId: string) {
    setAiTurnLiveStates((current) => {
      if (!current[turnId]) return current
      const next = { ...current }
      delete next[turnId]
      return next
    })
  }

  function hideUnavailableAiConversation(conversationId: string) {
    dispatchAiHistory({ type: 'conversation/deleted', conversationId })
    const selected = currentAiConversationId(aiSelectionRef.current) === conversationId
    const active = activeAiTurnRef.current?.conversationId === conversationId
    if (!selected && !active) return
    setAiTurns([])
    setAiTurnLiveStates({})
    setAiNextBeforeTurn(null)
    setAiTurnsError('')
    setAiError('')
    if (active) activeAiTurnRef.current = null
    setAiBusy(false)
  }

  function markAiTurnReconciling(turnId: string, fallbackMode: AiTurnLiveState['mode']) {
    setAiTurnLiveStates((current) => ({
      ...current,
      [turnId]: {
        connection: 'reconciling',
        content: current[turnId]?.content ?? '',
        mode: current[turnId]?.mode ?? fallbackMode,
        phase: current[turnId]?.phase ?? 'preparing',
      },
    }))
  }

  function aiTurnStreamHandlers(
    turnId: string,
    requestId: number,
    fallbackMode: AiTurnLiveState['mode'],
  ): AiTurnStreamHandlers {
    const update = (patch: Partial<AiTurnLiveState>) => {
      if (aiRequestIdRef.current !== requestId) return
      setAiTurnLiveStates((current) => {
        const existing = current[turnId] ?? {
          connection: 'connected',
          content: '',
          mode: fallbackMode,
          phase: 'preparing',
        }
        return {
          ...current,
          [turnId]: {
            ...existing,
            ...patch,
          },
        }
      })
    }
    return {
      onDelta: (append) => {
        if (aiRequestIdRef.current !== requestId) return
        setAiTurnLiveStates((current) => ({
          ...current,
          [turnId]: {
            connection: 'connected',
            content: `${current[turnId]?.content ?? ''}${append}`,
            mode: 'text',
            phase: 'generating',
          },
        }))
      },
      onHeartbeat: () => update({ connection: 'connected' }),
      onProgress: (phase) => update({ connection: 'connected', phase }),
      onStarted: ({ conversation, mode, turn }) => {
        if (aiRequestIdRef.current !== requestId) return
        if (conversation) {
          dispatchAiHistory({
            type: 'conversation/upserted',
            conversation: toAiConversationListItem(conversation),
          })
        }
        if (turn) setAiTurns((current) => mergeAiTurns(current, [turn]))
        update({ connection: 'connected', mode })
      },
    }
  }

  async function recoverAiTurnRequest(params: {
    conversationId: string
    error: unknown
    failureMessage: string
    missingTurnPolicy: 'always-remove' | 'preserve-while-unknown'
    requestId: number
    restoreDraft?: string
    restoreDraftOnConversationMissing?: boolean
    streamMode: AiTurnLiveState['mode']
    turnId: string
  }): Promise<AiTurnRunResponse | false> {
    const {
      conversationId,
      error,
      failureMessage,
      missingTurnPolicy,
      requestId,
      restoreDraft,
      restoreDraftOnConversationMissing = false,
      streamMode,
      turnId,
    } = params
    if (aiRequestIdRef.current !== requestId) return false

    const terminalError = error instanceof AiTurnStreamTerminalError ? error : null
    const transportStateUnknown = !terminalError && isAiTurnCanonicalStateUnknown(
      error instanceof ApiError ? error.status : null,
    )
    if (transportStateUnknown) {
      if (activeAiTurnRef.current?.turnId === turnId) {
        activeAiTurnRef.current = {
          ...activeAiTurnRef.current,
          awaitingCanonical: true,
          localRequestId: null,
        }
      }
      markAiTurnReconciling(turnId, streamMode)
    } else {
      if (activeAiTurnRef.current?.turnId === turnId) activeAiTurnRef.current = null
      setAiBusy(false)
      setAiTurns((current) => current.map((turn) => turn.id === turnId
        ? {
            ...turn,
            errorCode: terminalError?.code ?? 'AI_REQUEST_FAILED',
            status: terminalError?.event === 'cancelled' ? 'cancelled' : 'failed',
            updatedAt: new Date().toISOString(),
          }
        : turn))
      setAiTurnLiveStates((current) => ({
        ...current,
        [turnId]: {
          connection: 'connected',
          content: '',
          error: terminalError
            ? undefined
            : error instanceof Error && error.message
            ? error.message
            : failureMessage,
          mode: streamMode,
          phase: 'preparing',
        },
      }))
    }

    try {
      const restored = await fetchAiConversationTurns(conversationId)
      if (aiRequestIdRef.current !== requestId) return false
      const canonicalTurn = restored.turns.find((turn) => turn.id === turnId)
      if (canonicalTurn) {
        replaceAiConversationTurns(restored, 'merge')
      } else if (
        missingTurnPolicy === 'always-remove' ||
        !transportStateUnknown
      ) {
        dispatchAiHistory({
          type: 'conversation/upserted',
          conversation: toAiConversationListItem(restored.conversation),
        })
        setAiTurns((current) => current.filter((turn) => turn.id !== turnId))
        clearAiTurnLiveState(turnId)
        if (activeAiTurnRef.current?.turnId === turnId) activeAiTurnRef.current = null
        setAiBusy(false)
        if (restoreDraft) setAiDraft((current) => current || restoreDraft)
      }
      if (canonicalTurn?.status === 'processing') {
        activeAiTurnRef.current = { conversationId, localRequestId: null, turnId }
        setAiBusy(true)
        markAiTurnReconciling(turnId, streamMode)
        return false
      }
      if (!canonicalTurn) return false

      if (activeAiTurnRef.current?.turnId === turnId) activeAiTurnRef.current = null
      setAiBusy(false)
      clearAiTurnLiveState(turnId)
      setAiError('')
      if (canonicalTurn.status !== 'completed') return false
      await applyAiRunOutcome(canonicalTurn.outcome)
      return {
        conversation: restored.conversation,
        outcome: canonicalTurn.outcome,
        turn: canonicalTurn,
      }
    } catch (restoreError) {
      if (restoreError instanceof ApiError && restoreError.status === 404) {
        if (restoreDraftOnConversationMissing && restoreDraft) {
          setAiDraft((current) => current || restoreDraft)
        }
        hideUnavailableAiConversation(conversationId)
      }
      return false
    }
  }

  async function sendAgentMessage(
    route: AiMessageRoute,
  ): Promise<AiTurnRunResponse | false> {
    const content = (route.content ?? aiDraft).trim()
    const attachments = route.attachments ?? []
    if ((!content && attachments.length === 0) || aiBusy || aiTurnsLoading) return false

    const currentContext = aiHistory.selection.context
    const contextKind = route.contextKind ?? currentContext.contextType
    const projectId = contextKind === 'project' ? currentContext.projectId : null
    const targetContext = aiConversationContext(contextKind, projectId, projects)
    const contextChanged =
      currentContext.contextType !== targetContext.contextType ||
      currentContext.projectId !== targetContext.projectId
    const existingConversationId = contextChanged
      ? null
      : currentAiConversationId(aiHistory.selection)
    const conversationId = existingConversationId ?? crypto.randomUUID()
    const turnId = route.turnId
    const now = new Date().toISOString()
    const optimisticTurn: AiTurn = {
      assistantContent: null,
      attachments: attachments.map((attachment, index) => ({
        id: -(index + 1),
        mediaType: 'text/plain',
        name: attachment.name,
        ordinal: index,
        size: attachment.size,
      })),
      attemptCount: 1,
      completedAt: null,
      createdAt: now,
      errorCode: null,
      id: turnId,
      intentKind: route.intent.kind,
      outcome: null,
      status: 'processing',
      turnNo: nextAiTurnNumber(aiTurns),
      updatedAt: now,
      userContent: content,
    }

    aiHistoryRequestIdRef.current += 1
    dispatchAiHistory({ type: 'history/load-cancelled' })
    if (!existingConversationId) {
      dispatchAiHistory({ type: 'conversation/blanked', context: targetContext })
      setAiTurns([optimisticTurn])
      setAiNextBeforeTurn(null)
    } else {
      setAiTurns((current) => mergeAiTurns(current, [optimisticTurn]))
    }
    const requestId = aiRequestIdRef.current + 1
    aiRequestIdRef.current = requestId
    activeAiTurnRef.current = {
      conversationId,
      localRequestId: requestId,
      turnId,
      userContent: content,
    }
    setAiDraft('')
    setAiBusy(true)
    setAiError('')
    setAiTurnsError('')
    const streamMode = route.intent.kind === 'chat' ||
      route.intent.kind === 'conversation-analysis'
      ? 'text'
      : 'progress'
    setAiTurnLiveStates((current) => ({
      ...current,
      [turnId]: {
        connection: 'connected',
        content: '',
        mode: streamMode,
        phase: 'preparing',
      },
    }))
    try {
      const result = await sendAiConversationTurn({
        attachments: attachments.map(({ content: attachmentContent, name, size }) => ({
          content: attachmentContent,
          mediaType: 'text/plain',
          name,
          size,
        })),
        content,
        contextKind,
        conversationId,
        projectId,
        turnId,
      }, aiTurnStreamHandlers(turnId, requestId, streamMode))
      if (aiRequestIdRef.current !== requestId) return false
      if (result.conversation) {
        dispatchAiHistory({
          type: 'conversation/upserted',
          conversation: toAiConversationListItem(result.conversation),
        })
      }
      setAiTurns((current) => mergeAiTurns(current, [result.turn]))
      if (result.turn.status === 'processing') {
        activeAiTurnRef.current = { conversationId, localRequestId: null, turnId }
        markAiTurnReconciling(turnId, streamMode)
      } else if (activeAiTurnRef.current?.turnId === turnId) {
        activeAiTurnRef.current = null
        setAiBusy(false)
        clearAiTurnLiveState(turnId)
      }
      await applyAiRunOutcome(result.outcome)
      return result
    } catch (error) {
      return recoverAiTurnRequest({
        conversationId,
        error,
        failureMessage: 'AI 暂时没有响应，可以重试这条消息。',
        missingTurnPolicy: 'preserve-while-unknown',
        requestId,
        restoreDraft: content,
        restoreDraftOnConversationMissing: !existingConversationId,
        streamMode,
        turnId,
      })
    } finally {
      if (
        aiRequestIdRef.current === requestId &&
        activeAiTurnRef.current?.localRequestId === requestId
      ) {
        activeAiTurnRef.current = null
        setAiBusy(false)
      }
    }
  }

  async function retryAiTurn(turnId: string): Promise<AiTurnRunResponse | false> {
    const conversationId = currentAiConversationId(aiHistory.selection)
    if (!conversationId || aiBusy || aiTurnsLoading) return false
    const retryingTurn = aiTurns.find((turn) => turn.id === turnId)
    const streamMode = retryingTurn?.intentKind === 'chat' ||
      retryingTurn?.intentKind === 'conversation-analysis'
      ? 'text'
      : 'progress'
    const requestId = aiRequestIdRef.current + 1
    aiRequestIdRef.current = requestId
    activeAiTurnRef.current = { conversationId, localRequestId: requestId, turnId }
    setAiTurns((current) => current.map((turn) =>
      turn.id === turnId
        ? {
          ...turn,
          errorCode: null,
          status: 'processing',
          updatedAt: new Date().toISOString(),
        }
        : turn,
    ))
    setAiBusy(true)
    setAiError('')
    setAiTurnLiveStates((current) => ({
      ...current,
      [turnId]: {
        connection: 'connected',
        content: '',
        mode: streamMode,
        phase: 'preparing',
      },
    }))
    try {
      const result = await retryAiConversationTurn(
        conversationId,
        turnId,
        aiTurnStreamHandlers(turnId, requestId, streamMode),
      )
      if (aiRequestIdRef.current !== requestId) return false
      dispatchAiHistory({
        type: 'conversation/upserted',
        conversation: toAiConversationListItem(result.conversation),
      })
      setAiTurns((current) => mergeAiTurns(current, [result.turn]))
      if (result.turn.status === 'processing') {
        activeAiTurnRef.current = { conversationId, localRequestId: null, turnId }
        markAiTurnReconciling(turnId, streamMode)
      } else if (activeAiTurnRef.current?.turnId === turnId) {
        activeAiTurnRef.current = null
        setAiBusy(false)
        clearAiTurnLiveState(turnId)
      }
      await applyAiRunOutcome(result.outcome)
      return result
    } catch (error) {
      return recoverAiTurnRequest({
        conversationId,
        error,
        failureMessage: '重试失败，请稍后再试。',
        missingTurnPolicy: 'always-remove',
        requestId,
        streamMode,
        turnId,
      })
    } finally {
      if (
        aiRequestIdRef.current === requestId &&
        activeAiTurnRef.current?.localRequestId === requestId
      ) {
        activeAiTurnRef.current = null
        setAiBusy(false)
      }
    }
  }

  async function resetAiConversation() {
    await stopActiveAiTurn()
    if (activeAiTurnRef.current) return
    aiRequestIdRef.current += 1
    aiHistoryRequestIdRef.current += 1
    aiTurnsRequestIdRef.current += 1
    setAiTurnsLoading(false)
    dispatchAiHistory({
      type: 'conversation/blanked',
      context: aiHistory.selection.context,
    })
    setAiTurns([])
    setAiTurnLiveStates({})
    setAiNextBeforeTurn(null)
    setAiTurnsError('')
    setAiDraft('')
    setAiError('')
  }

  async function changeAiProjectContext(projectId: number | null) {
    if (projectId === aiProjectId && aiHistory.selection.context.contextType !== 'conversation-analysis') {
      return
    }
    await stopActiveAiTurn()
    if (activeAiTurnRef.current) return
    aiRequestIdRef.current += 1
    aiHistoryRequestIdRef.current += 1
    aiTurnsRequestIdRef.current += 1
    setAiTurnsLoading(false)
    dispatchAiHistory({
      type: 'conversation/blanked',
      context: aiConversationContext(projectId == null ? 'general' : 'project', projectId, projects),
    })
    setAiTurns([])
    setAiTurnLiveStates({})
    setAiNextBeforeTurn(null)
    setAiTurnsError('')
    setAiError('')
  }

  async function exportMarkdown(projectId?: number) {
    const targets = projectId
      ? scopedProjects.filter((project) => project.id === projectId)
      : scopedProjects.filter((project) => project.accessRole === 'owner')
    const sections = await Promise.all(
      targets.map(async (project) => {
        const projectTodosText = todos
          .filter((todo) => todo.projectId === project.id)
          .map((todo) => `- [${todo.done ? 'x' : ' '}] ${todo.title}`)
          .join('\n')
        const journalsText = project.journals
          .map((entry) => `### ${entry.speakerName} · ${entry.createdAt} · ${entry.visibility === 'public' ? '公开' : '私有'}\n\n${entry.content}`)
          .join('\n\n')
        const summariesText = summaries
          .filter((summary) => summary.projectId === project.id)
          .map((summary) => `### ${summary.title}\n\n${summary.content}`)
          .join('\n\n')
        const packageTimelineText = await (async () => {
          try {
            return (await exportProjectPackageTimeline(project.id)).markdown.trim()
          } catch {
            return '安装升级时间线导出失败，请检查后端服务和 OSS 配置。'
          }
        })()

        return `# ${project.name}

状态：${statusCopy[project.status]}
标签：${project.tags.join('、')}
最近更新：${project.updatedAt}

## 日记

${journalsText || '暂无日记'}

## 待办

${projectTodosText || '暂无待办'}

## 总结

${summariesText || '暂无总结'}

## 安装升级时间线

${packageTimelineText}`
      }),
    )
    const body = sections.join('\n\n---\n\n')

    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = projectId ? `${targets[0]?.name}.md` : `Veges-${selectedOrganizationName}驾驶舱导出.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (bugShareToken && !loggedIn && bugShareLoginRequested) {
    return (
      <LoginScreen
        error={authError}
        hasOrganizationInvite={Boolean(organizationInviteToken)}
        hasProjectInvite={Boolean(inviteToken)}
        invitePasswordChecking={invitePasswordChecking}
        invitePasswordDraft={invitePasswordDraft}
        invitePasswordError={invitePasswordError}
        invitePasswordRequired={invitePasswordRequired}
        invitePasswordVerified={invitePasswordVerified}
        onBackToShare={() => setBugShareLoginRequested(false)}
        onClearError={() => setAuthError('')}
        onFeishuSignIn={signInWithFeishu}
        onInvitePasswordChange={(value) => {
          setInvitePasswordDraft(value)
          setInvitePasswordError('')
          setAuthError('')
        }}
        onVerifyInvitePassword={submitInvitePassword}
        onSignIn={signIn}
      />
    )
  }

  if (bugShareToken) {
    return <BugShareView
      authUser={authUser}
      onBackToVeges={authUser ? returnToVegesFromShare : undefined}
      onLogin={() => setBugShareLoginRequested(true)}
      onOpenAssignedBug={openAssignedBugFromShare}
      token={bugShareToken}
    />
  }

  if (todoShareToken && !loggedIn && todoShareLoginRequested) {
    return (
      <LoginScreen
        error={authError}
        hasOrganizationInvite={Boolean(organizationInviteToken)}
        hasProjectInvite={Boolean(inviteToken)}
        invitePasswordChecking={invitePasswordChecking}
        invitePasswordDraft={invitePasswordDraft}
        invitePasswordError={invitePasswordError}
        invitePasswordRequired={invitePasswordRequired}
        invitePasswordVerified={invitePasswordVerified}
        onBackToShare={() => setTodoShareLoginRequested(false)}
        onClearError={() => setAuthError('')}
        onFeishuSignIn={signInWithFeishu}
        onInvitePasswordChange={(value) => {
          setInvitePasswordDraft(value)
          setInvitePasswordError('')
          setAuthError('')
        }}
        onVerifyInvitePassword={submitInvitePassword}
        onSignIn={signIn}
        shareBackLabel="返回待办分享"
      />
    )
  }

  if (todoShareToken) {
    return (
      <TodoShareView
        authUser={authUser}
        onLogin={() => setTodoShareLoginRequested(true)}
        onOpenTodo={openTodoFromShare}
        token={todoShareToken}
      />
    )
  }

  if (!loggedIn) {
    return (
        <LoginScreen
          error={authError}
          hasOrganizationInvite={Boolean(organizationInviteToken)}
          hasProjectInvite={Boolean(inviteToken)}
          invitePasswordChecking={invitePasswordChecking}
          invitePasswordDraft={invitePasswordDraft}
          invitePasswordError={invitePasswordError}
          invitePasswordRequired={invitePasswordRequired}
          invitePasswordVerified={invitePasswordVerified}
          onClearError={() => setAuthError('')}
          onFeishuSignIn={signInWithFeishu}
          onInvitePasswordChange={(value) => {
            setInvitePasswordDraft(value)
            setInvitePasswordError('')
            setAuthError('')
          }}
          onVerifyInvitePassword={submitInvitePassword}
          onSignIn={signIn}
        />
    )
  }

  if (!workspaceLoaded || !organizationContextReady) {
    return <WorkspaceBootScreen message={organizationContextError || undefined} />
  }

  const roleSelectionDialog = authUser ? (
    <UserRoleSelectionDialog
      busy={roleSelectionBusy}
      open={roleSelectionOpen}
      user={authUser}
      onOpenOrganization={() => {
        setRoleSelectionOpen(false)
        setView('organization')
      }}
      onSelect={(role) => void changeActiveUserRole(role)}
    />
  ) : null

  if (view === 'testing' && authUser?.activeRole === 'tester') {
    return (
      <>
        {roleSelectionDialog}
        <TestWorkbench
          accountMenu={(
            <AccountMenu
              user={authUser}
              themeMode={themeMode}
              onDisconnectFeishu={disconnectFeishuBinding}
              onSaveAccountSettings={updateAccountSettings}
              onRoleChange={(role) => void changeActiveUserRole(role)}
              onOpenChangelog={() => setView('changelog')}
              onSignOut={signOut}
              onToggleTheme={toggleThemeMode}
            />
          )}
          currentUserId={authUser.id}
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          refreshToken={workspaceRefreshVersion}
        />
      </>
    )
  }

  const hideSidebar = view === 'project' && projectDetailTab === 'packages'

  return (
    <main className={hideSidebar ? 'app-shell sidebar-hidden' : 'app-shell'}>
      {roleSelectionDialog}
      {!hideSidebar && (
        <aside className="sidebar" aria-label="主导航">
          <div className="brand-block">
            <img className="brand-mark" src="/favicon.svg" alt="Veges" />
            <div>
              <p className="eyebrow">Veges</p>
              <h1>项目篮子</h1>
            </div>
            <button className="sidebar-notifications-button" type="button" aria-label="消息" title="消息" onClick={openNotificationCenter}>
              <Bell size={18} weight="duotone" />
              {openNotificationCount > 0 ? <span className="sidebar-notifications-dot" aria-hidden /> : null}
            </button>
          </div>
          <OrganizationSwitcher
            error={organizationContextError}
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onChange={changeOrganization}
          />
          <nav className="nav-list">
            <NavGroup label="日常工作" id="nav-group-daily">
              <NavButton active={view === 'search'} onClick={() => setView('search')}>
                <Target size={18} weight="duotone" /> 项目篮子
              </NavButton>
              <NavButton active={view === 'my_work'} onClick={openMyWork}>
                <ListChecks size={18} weight="duotone" /> 我的待办
                {openTodoCount > 0 && (
                  <Badge className="nav-badge">{openTodoCount}</Badge>
                )}
              </NavButton>
              <NavButton active={view === 'inbox'} onClick={() => setView('inbox')}>
                <Tray size={18} weight="duotone" /> 草稿箱
              </NavButton>
              <NavButton active={view === 'weekly_report'} onClick={() => setView('weekly_report')}>
                <FileText size={18} weight="duotone" /> 周报管理
              </NavButton>
              <NavButton
                active={view === 'ai'}
                onClick={() => {
                  setAiMobilePane(getDefaultAiPane())
                  setView('ai')
                }}
              >
                <Sparkle size={18} weight="duotone" /> Veges AI
              </NavButton>
            </NavGroup>
            <NavGroup label="协作与交付" id="nav-group-delivery">
              {canNavigateToDeveloperBugs ? (
                <NavButton
                  active={view === 'assigned_bugs'}
                  onClick={() => void changeActiveUserRole('developer', 'assigned_bugs')}
                >
                  <Bug size={18} weight="duotone" /> Bug 工作台
                  {assignedBugCount > 0 && (
                    <Badge className="nav-badge">{assignedBugCount}</Badge>
                  )}
                </NavButton>
              ) : null}
              {canNavigateToTestWorkbench ? (
                <NavButton
                  active={view === 'testing'}
                  onClick={() => void changeActiveUserRole('tester', 'testing')}
                >
                  <Flask size={18} weight="duotone" /> 测试工作台
                </NavButton>
              ) : null}
              {packageMarketVisible ? (
                <NavButton active={view === 'package_market'} onClick={() => setView('package_market')}>
                  <ShoppingCartSimple size={18} weight="duotone" /> 安装包市场
                </NavButton>
              ) : null}
              <NavButton active={view === 'image_sync'} onClick={() => setView('image_sync')}>
                <CloudArrowUp size={18} weight="duotone" /> 镜像同步
              </NavButton>
            </NavGroup>
            {isOrganizationAdmin ? (
              <NavGroup label="组织与治理" id="nav-group-organization">
                <NavButton active={view === 'organization'} onClick={() => setView('organization')}>
                  <Buildings size={18} weight="duotone" /> 组织管理
                </NavButton>
              </NavGroup>
            ) : null}
          </nav>
          <AccountMenu
            user={authUser}
            themeMode={themeMode}
            onDisconnectFeishu={disconnectFeishuBinding}
            onSaveAccountSettings={updateAccountSettings}
            onRoleChange={(role) => void changeActiveUserRole(role)}
            onOpenChangelog={() => setView('changelog')}
            onSignOut={signOut}
            onToggleTheme={toggleThemeMode}
          />
        </aside>
      )}

      <Dialog
        open={displayNameOnboardingOpen}
        onOpenChange={(open) => {
          if (open) setDisplayNameOnboardingOpen(true)
        }}
      >
        <DialogContent className="display-name-onboarding-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>请设置真实姓名</DialogTitle>
            <DialogDescription>
              Veges 会把你的姓名展示在待办、交付事件和飞书通知里。为了协作时能准确识别，请先把昵称改成真实姓名。
            </DialogDescription>
          </DialogHeader>
          <form
            className="new-project-dialog-form display-name-onboarding-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveOnboardingDisplayName()
            }}
          >
            <Label>
              真实姓名
              <Input
                autoFocus
                maxLength={32}
                placeholder="例如：张三"
                required
                value={displayNameOnboardingDraft}
                onChange={(event) => {
                  setDisplayNameOnboardingDraft(event.target.value)
                  setDisplayNameOnboardingError('')
                }}
              />
            </Label>
            {displayNameOnboardingError ? (
              <p className="form-error">{displayNameOnboardingError}</p>
            ) : (
              <p className="form-note">设置后也可以在左下角账户设置中修改。</p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={displayNameOnboardingBusy || !displayNameOnboardingDraft.trim()}
              >
                {displayNameOnboardingBusy ? '保存中...' : '保存并进入'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(loggedIn && inviteToken && invitePasswordRequired && !invitePasswordVerified)}
        onOpenChange={(open) => {
          if (open) return
          setInviteToken('')
          setInvitePasswordDraft('')
          setInvitePasswordError('')
          clearInviteTokenFromUrl()
        }}
      >
        <DialogContent className="invite-password-dialog">
          <DialogHeader>
            <DialogTitle>输入邀请密码</DialogTitle>
            <DialogDescription>
              这个项目邀请链接开启了加密分享。请输入分享文本中的密码，验证通过后会自动加入项目。
            </DialogDescription>
          </DialogHeader>
          <form
            className="new-project-dialog-form invite-password-dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitInvitePassword()
            }}
          >
            <Label>
              邀请密码
              <Input
                autoFocus
                autoComplete="one-time-code"
                placeholder="输入分享文本中的密码"
                type="password"
                value={invitePasswordDraft}
                onChange={(event) => {
                  setInvitePasswordDraft(event.target.value)
                  setInvitePasswordError('')
                }}
              />
            </Label>
            {invitePasswordError ? (
              <p className="form-error">{invitePasswordError}</p>
            ) : (
              <p className="form-note">密码只用于本次邀请验证，不会保存在浏览器本地。</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteToken('')
                  setInvitePasswordDraft('')
                  setInvitePasswordError('')
                  clearInviteTokenFromUrl()
                }}
              >
                取消
              </Button>
              <Button type="submit" disabled={invitePasswordChecking || !invitePasswordDraft.trim()}>
                {invitePasswordChecking ? '验证中...' : '验证并加入'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section className={view === 'project'
        ? 'workspace cockpit-workspace'
        : view === 'weekly_report'
          ? 'workspace embedded-module-workspace weekly-report-shell'
          : view === 'assigned_bugs' || view === 'package_market' || view === 'image_sync' || view === 'changelog'
          ? view === 'changelog'
            ? 'workspace embedded-module-workspace changelog-shell'
            : 'workspace embedded-module-workspace'
          : 'workspace'}>
        {!(view === 'project' && isProjectTodoDetailActive) ? (
          <header className="topbar">
            <div>
              <div className="topbar-title-row">
                {view === 'project' && (
                  <Button
                    className={detailEntrySource !== 'project'
                      ? 'ghost-button summary-back-button'
                      : 'detail-back-button'}
                    type="button"
                    variant={detailEntrySource !== 'project' ? 'outline' : 'ghost'}
                    size={detailEntrySource !== 'project' ? 'sm' : 'icon'}
                    aria-label={detailEntrySource === 'notifications'
                      ? '返回消息'
                      : detailEntrySource === 'my_work' ? '返回我的待办'
                      : projectDetailTab !== 'journal' ? '返回项目日记' : '返回项目篮子'}
                    title={detailEntrySource === 'notifications'
                      ? '返回消息'
                      : detailEntrySource === 'my_work' ? '返回我的待办'
                      : projectDetailTab !== 'journal' ? '返回项目日记' : '返回项目篮子'}
                    onClick={() => {
                      if (detailEntrySource === 'notifications') {
                        returnToNotifications()
                        return
                      }
                      if (detailEntrySource === 'my_work') {
                        returnToMyWork()
                        return
                      }
                      if (projectDetailTab !== 'journal') {
                        setProjectDetailTab('journal')
                        return
                      }
                      setView('search')
                    }}
                  >
                    <ArrowLeft size={18} />
                    {detailEntrySource !== 'project' ? '返回' : null}
                  </Button>
                )}
                <h2>{getViewTitle(view, selectedProject?.name ?? '项目篮子')}</h2>
                {view === 'project' && selectedProject && (
                  <ProjectTags tags={selectedProject.tags} />
                )}
              </div>
            </div>
            <div
              className={view === 'project' ? 'topbar-actions project-topbar-actions' : 'topbar-actions'}
              id={view === 'organization'
                ? 'organization-topbar-actions'
                : view === 'weekly_report' ? 'weekly-report-topbar-actions' : undefined}
            >
              {view === 'project' && projectDetailTab === 'packages' ? (
                <>
                  <Button
                    className="ghost-button"
                    variant="outline"
                    type="button"
                    onClick={() => packageWorkbenchRef.current?.exportTimeline()}
                  >
                    <DownloadSimple size={17} /> 导出时间线
                  </Button>
                </>
              ) : (
                <>
                  {view === 'changelog' && changelogCanManage && !changelogEditorOpen ? (
                    <Button
                      className="solid-button"
                      type="button"
                      onClick={() => setChangelogCreateRequest((current) => current + 1)}
                    >
                      <Plus size={17} /> 新增日志
                    </Button>
                  ) : null}
                  {view === 'project' && selectedProject && (
                    <Button
                      className={projectDetailTab === 'activity' ? 'solid-button' : 'ghost-button'}
                      type="button"
                      variant={projectDetailTab === 'activity' ? 'default' : 'outline'}
                      onClick={() => setProjectDetailTab(
                        projectDetailTab === 'activity' ? 'journal' : 'activity',
                      )}
                    >
                      <ClockCounterClockwise size={17} />
                      {projectDetailTab === 'activity' ? '返回项目日记' : '待办动态'}
                    </Button>
                  )}
                  {view === 'project' && selectedProject && (
                    <Button
                      className="ghost-button"
                      type="button"
                      variant="outline"
                      onClick={() => setProjectDetailTab('packages')}
                    >
                      交付工作台
                    </Button>
                  )}
                  {view === 'project' && selectedProject?.accessRole === 'owner' && (
                    <Dialog
                      open={isProjectModulesDialogOpen}
                      onOpenChange={setIsProjectModulesDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button className="ghost-button project-modules-trigger" type="button" variant="outline">
                          <ListChecks size={16} /> 项目模块
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>项目模块</DialogTitle>
                          <DialogDescription>
                            给当前项目配置自定义模块，后续新增或编辑待办时都可以直接归属到对应模块。
                          </DialogDescription>
                        </DialogHeader>
                        <ProjectModulesPanel
                          modules={selectedProject.modules}
                          onCreate={() => addProjectModule(selectedProject.id)}
                          onDelete={(moduleId) => deleteProjectModule(selectedProject.id, moduleId)}
                          onDraftChange={setProjectModuleDraft}
                          draft={projectModuleDraft}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                  {view === 'project' && selectedProject?.accessRole === 'owner' && (
                    <Dialog
                      open={isProjectMembersDialogOpen}
                      onOpenChange={setIsProjectMembersDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button className="ghost-button project-members-trigger" type="button" variant="outline">
                          <AddressBook size={16} /> 邀请成员
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="project-members-dialog">
                        <DialogHeader>
                          <DialogTitle>邀请成员</DialogTitle>
                          <DialogDescription>
                            管理成员、邀请链接和项目群通知。
                          </DialogDescription>
                        </DialogHeader>
                        <ProjectMembersPanel
                          departedUserIds={departedUserIds}
                          memberships={memberships.filter(
                            (membership) => membership.projectId === selectedProject.id,
                          )}
                          onCopyInviteLink={(payload) =>
                            copyProjectInviteLink(selectedProject.id, payload)
                          }
                          onSaveFeishuSettings={(payload) =>
                            saveProjectFeishuSettings(selectedProject.id, payload)
                          }
                          onInvite={(email) => inviteMember(selectedProject.id, email)}
                          onRemove={(membershipId) => deleteMember(selectedProject.id, membershipId)}
                          project={selectedProject}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                  {view !== 'ai' && view !== 'organization' && view !== 'weekly_report' && view !== 'assigned_bugs' && view !== 'package_market' && view !== 'image_sync' && view !== 'changelog' ? (
                    <Button
                      className="ghost-button"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        exportMarkdown(view === 'project' ? selectedProject?.id : undefined)
                      }
                    >
                      <DownloadSimple size={17} /> 批量导出
                    </Button>
                  ) : null}
                </>
              )}
              {view === 'search' ? (
                <Dialog
                  open={isNewProjectDialogOpen}
                  onOpenChange={changeNewProjectDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="solid-button" type="button">
                      <Plus size={17} /> 新建项目
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新建项目</DialogTitle>
                      <DialogDescription>
                        先建立一个新的项目篮子，之后可以继续补充日记、待办和风险。
                      </DialogDescription>
                    </DialogHeader>
                    <NewProjectForm
                      newProjectName={newProjectName}
                      newProjectTags={newProjectTags}
                      onCancel={() => changeNewProjectDialogOpen(false)}
                      onNewProjectNameChange={setNewProjectName}
                      onNewProjectTagsChange={setNewProjectTags}
                      onSubmit={addProject}
                    />
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </header>
        ) : null}

        {(!workspaceLoaded || workspaceError) && (
          <div className={workspaceError ? 'sync-banner error' : 'sync-banner'}>
            <span className="sync-banner-content">
              {workspaceError || '正在从数据库同步工作区...'}
            </span>
            {workspaceError ? (
              <button
                className="sync-banner-dismiss"
                type="button"
                aria-label="关闭错误提示"
                onClick={() => setWorkspaceError('')}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        )}

        {view === 'project' && selectedProject && (
          <ProjectDetail
            key={selectedProject.id}
            initialTodoId={requestedTodoDetailId}
            notificationDetailActive={detailEntrySource !== 'project'}
            journalDraft={journalDraft}
            packageTimeline={projectPackageTimelines[selectedProject.id] ?? null}
            departedUserIds={departedUserIds}
            packageWorkbenchRef={packageWorkbenchRef}
            projectDetailTab={projectDetailTab}
            onAddTodo={addTodo}
            onAddInstallEventComment={addInstallEventComment}
            onCompleteInstallEvent={completeInstallEvent}
            onCreateInstallOperation={createInstallOperation}
            onDeleteInstallEvent={deleteInstallEvent}
            onDeleteInstallEventComment={deleteInstallEventComment}
            onDeleteInstallGroup={deleteInstallGroup}
            onDeleteInstallOperation={deleteInstallOperation}
            onDraftChange={setJournalDraft}
            onExportInstallTimeline={exportInstallTimeline}
            onInstallLoadMarketDetail={loadPackageMarketDetail}
            onInstallLoadItemDownloadUrl={loadInstallItemDownloadUrl}
            onInstallLoadMarketCiBranches={loadPackageMarketCiBranches}
            onInstallLoadMarketRules={loadPackageMarketRules}
            onInstallLoadMarketVersions={loadPackageMarketVersions}
            onSaveInstallEvent={saveInstallEvent}
            onUpdateInstallEventComment={updateInstallEventComment}
            onTodoDetailViewChange={setIsProjectTodoDetailActive}
            onReturnToNotifications={detailEntrySource === 'my_work' ? returnToMyWork : returnToNotifications}
            onUpdateInstallOperation={updateInstallOperation}
            onSaveJournal={saveJournal}
            onDeleteJournalEntry={deleteJournalEntry}
            onEditJournalEntry={editJournalEntry}
            onToggleJournalRisk={toggleJournalRisk}
            onUpdateJournalVisibility={updateJournalVisibility}
            onDeleteTodo={deleteTodo}
            onCreateTodoNote={addTodoNote}
            onCreateTodoModule={createModule}
            onUpdateTodo={updateTodoDetails}
            onUpdateTodoNote={editTodoNote}
            onTodoCreateDraftClear={clearTodoCreateDraftState}
            onTodoAssigneeChange={setTodoAssigneeUserId}
            onTodoWatcherChange={setTodoWatcherUserIds}
            onTodoReviewerChange={setTodoReviewerUserId}
            onTodoCreatedAtChange={setTodoCreatedAt}
            onTodoDueDateChange={setTodoDueDate}
            onTodoDetailDraftChange={setTodoDetailDraft}
            onTodoDraftChange={setTodoDraft}
            onTodoModuleChange={setTodoModuleId}
            onTodoPriorityChange={setTodoPriority}
            project={selectedProject}
            currentUser={authUser}
            memberships={memberships}
            projects={scopedProjects}
            projectTodos={projectTodos}
            todoAssigneeUserId={todoAssigneeUserId}
            todoWatcherUserIds={todoWatcherUserIds}
            todoReviewerUserId={todoReviewerUserId}
            todoCreatedAt={todoCreatedAt}
            todoDueDate={todoDueDate}
            todoDetailDraft={todoDetailDraft}
            todoDraft={todoDraft}
            todoModuleId={todoModuleId}
            todoPriority={todoPriority}
          />
        )}

        {view === 'project' && !selectedProject && (
          <EmptyWorkspace
            isNewProjectDialogOpen={isNewProjectDialogOpen}
            newProjectName={newProjectName}
            newProjectTags={newProjectTags}
            scopeLabel={selectedOrganizationName}
            onAddProject={addProject}
            onNewProjectDialogOpenChange={changeNewProjectDialogOpen}
            onNewProjectNameChange={setNewProjectName}
            onNewProjectTagsChange={setNewProjectTags}
          />
        )}

        {view === 'inbox' && (
          <InboxView
            archiveInboxItem={archiveInboxItem}
            memberships={memberships}
            inbox={inbox}
            inboxDraft={inboxDraft}
            onAddInboxItem={addInboxItem}
            onDeleteInboxItem={deleteInboxItem}
            onDraftChange={setInboxDraft}
            projects={scopedProjects}
          />
        )}

        {view === 'my_work' && (
          <MyWorkWorkbench
            projects={projects}
            refreshToken={workspaceRefreshVersion}
            onTodoClick={selectMyWorkTodo}
            onDeliveryClick={selectMyWorkPackageEvent}
            onBugClick={(bugId) => {
              setRequestedAssignedBugId(bugId)
              void changeActiveUserRole('developer', 'assigned_bugs')
            }}
            onMilestoneClick={selectProject}
          />
        )}

        {view === 'notifications' && (
          <NotificationCenterView
            notifications={notifications}
            onAcceptInvitation={acceptInvitation}
            onIgnoreInvitation={ignoreInvitation}
            onRespondProjectTransfer={respondProjectTransfer}
          />
        )}

        {view === 'search' && (
          <SearchView
            allTags={allTags}
            filteredResults={filteredResults}
            search={search}
            statusFilter={statusFilter}
            tagFilter={tagFilter}
            exportMarkdown={exportMarkdown}
            generateSummary={generateSummary}
            onDeleteProject={deleteProject}
            onEditProjectDescription={updateProjectDescription}
            onProjectClick={selectProject}
            onRenameProject={renameProject}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onTagChange={setTagFilter}
            onUpdateProjectStatus={updateProjectStatus}
          />
        )}

        {view === 'organization' && authUser ? (
          <OrganizationWorkbench
            currentUser={authUser}
            onOrganizationsChanged={() => setOrganizationRefreshVersion((current) => current + 1)}
            onPackageMarketVisibilityChange={(organizationId, enabled) => {
              setOrganizations((current) => current.map((organization) => (
                organization.id === organizationId
                  ? { ...organization, packageMarketEnabled: enabled }
                  : organization
              )))
            }}
            refreshToken={workspaceRefreshVersion}
          />
        ) : null}

        {view === 'weekly_report' ? (
          <WeeklyReportWorkbench
            initialOrganizationId={requestedWeeklyReport.status === 'valid'
              ? requestedWeeklyReport.organizationId
              : null}
            initialWeekStart={requestedWeeklyReport.status === 'valid'
              ? requestedWeeklyReport.weekStart
              : null}
            refreshToken={workspaceRefreshVersion}
            onInitialContextConsumed={() => setRequestedWeeklyReport({
              organizationId: null,
              status: 'absent',
              weekStart: null,
            })}
          />
        ) : null}

        {view === 'assigned_bugs' && canShowDeveloperAssignedBugs ? (
          <AssignedTestBugs
            currentUserId={authUser?.id}
            initialBugId={requestedAssignedBugId}
            embedded
            onBugSeen={markAssignedBugCommentsRead}
            onBugsChange={updateAssignedBugCount}
          />
        ) : null}

        {view === 'package_market' && activePackageMarketOrganization ? (
          <PackageMarketBrowser
            organizationId={activePackageMarketOrganization.id}
            onLoadPackageMarketCiBranches={loadPackageMarketCiBranches}
            onLoadPackageMarketDetail={loadPackageMarketDetail}
            onLoadPackageMarketRules={loadPackageMarketRules}
            onLoadPackageMarketVersions={loadPackageMarketVersions}
          />
        ) : null}

        {view === 'image_sync' ? <ImageSyncWorkbench /> : null}

        {view === 'changelog' ? (
          <ChangelogWorkbench
            createRequest={changelogCreateRequest}
            onCanManageChange={setChangelogCanManage}
            onEditorModeChange={setChangelogEditorOpen}
          />
        ) : null}

        {view === 'ai' && (
          <VegesAiView
            aiBusy={aiBusy}
            aiDraft={aiDraft}
            aiError={aiError}
            aiHistory={aiHistory}
            aiMessages={aiMessages}
            aiNextBeforeTurn={aiNextBeforeTurn}
            aiTurnsError={aiTurnsError}
            aiTurnsLoading={aiTurnsLoading}
            retryableAiTurnId={latestRetryableAiTurnId(aiTurns)}
            memberships={memberships}
            mobilePane={aiMobilePane}
            onAiDraftChange={setAiDraft}
            onDeleteConversation={deleteAiConversationHistory}
            onExportWorkspace={() => exportMarkdown()}
            onLoadEarlierTurns={loadEarlierAiTurns}
            onLoadHistory={async (mode) => {
              await loadAiHistoryPage(mode)
            }}
            onMobilePaneChange={setAiMobilePane}
            onRenameConversation={renameAiConversationHistory}
            onResetAiChat={resetAiConversation}
            onRetryHistory={retryAiHistory}
            onRetryTurn={retryAiTurn}
            onSelectConversation={selectAiConversationHistory}
            onSendAgentMessage={sendAgentMessage}
            onSelectedProjectIdChange={changeAiProjectContext}
            onStopAiTurn={stopActiveAiTurn}
            onWorkspace={applyAiWorkspaceForSession}
            projects={projects}
            requestedTodoBatchId={requestedAiTodoBatchId}
            sessionGeneration={authSessionGenerationRef.current}
            selectedProjectId={aiProjectId}
            summaries={summaries}
            onRequestedTodoBatchHandled={() => {
              setRequestedAiTodoBatchId(null)
              window.history.replaceState({}, '', removeAiTodoBatchDeepLink(window.location))
            }}
          />
        )}
      </section>
    </main>
  )
}

function WorkspaceBootScreen({ message }: { message?: string }) {
  return (
    <main className="workspace-boot-screen" aria-busy="true">
      <div className="workspace-boot-panel">
        <img className="brand-mark" src="/favicon.svg" alt="Veges" />
        <div>
          <p className="eyebrow">Veges - 个人项目驾驶舱</p>
          <h1>{message ? '组织列表读取失败' : '正在同步工作区'}</h1>
          <p>{message || '稍等一下，正在连接线上数据。'}</p>
        </div>
      </div>
    </main>
  )
}

function OrganizationSwitcher({
  error,
  organizations,
  selectedOrganizationId,
  onChange,
}: {
  error: string
  organizations: OrganizationListItem[]
  selectedOrganizationId: number | null
  onChange: (value: string) => void
}) {
  const value = selectedOrganizationId == null ? 'personal' : String(selectedOrganizationId)
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId)

  return (
    <div className="sidebar-organization-switcher">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="sidebar-organization-select" aria-label="切换组织">
          <span className="sidebar-organization-select-value">
            <Buildings size={16} weight="duotone" aria-hidden />
            <SelectValue placeholder="个人项目">
              {selectedOrganization?.name || '个人项目'}
            </SelectValue>
          </span>
        </SelectTrigger>
        <SelectContent className="sidebar-organization-content">
          <SelectItem value="personal">个人项目</SelectItem>
          {organizations.length > 0 ? <SelectSeparator /> : null}
          {organizations.map((organization) => (
            <SelectItem key={organization.id} value={String(organization.id)}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="sidebar-organization-error" role="alert">{error}</p> : null}
    </div>
  )
}

function LoginScreen({
  error,
  hasOrganizationInvite,
  hasProjectInvite,
  invitePasswordChecking,
  invitePasswordDraft,
  invitePasswordError,
  invitePasswordRequired,
  invitePasswordVerified,
  onClearError,
  onBackToShare,
  onFeishuSignIn,
  onInvitePasswordChange,
  onVerifyInvitePassword,
  onSignIn,
  shareBackLabel = '返回 Bug 分享',
}: {
  error: string
  hasOrganizationInvite: boolean
  hasProjectInvite: boolean
  invitePasswordChecking: boolean
  invitePasswordDraft: string
  invitePasswordError: string
  invitePasswordRequired: boolean
  invitePasswordVerified: boolean
  onClearError: () => void
  onBackToShare?: () => void
  onFeishuSignIn: () => Promise<void>
  onInvitePasswordChange: (value: string) => void
  onVerifyInvitePassword: () => Promise<void>
  onSignIn: (username: string, password: string, mode: 'login' | 'register') => void
  shareBackLabel?: string
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [feishuBusy, setFeishuBusy] = useState(false)

  function switchMode(nextMode: 'login' | 'register') {
    if (nextMode === mode) return
    setMode(nextMode)
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setFormError('')
    onClearError()
  }

  function clearErrors() {
    setFormError('')
    onClearError()
  }

  async function handleFeishuSignIn() {
    setFeishuBusy(true)
    clearErrors()
    try {
      await onFeishuSignIn()
    } finally {
      setFeishuBusy(false)
    }
  }

  const shouldGateInvitePassword =
    hasProjectInvite && invitePasswordRequired && !invitePasswordVerified
  const shouldWaitInviteCheck =
    hasProjectInvite && invitePasswordChecking && !invitePasswordRequired && !invitePasswordVerified
  const shouldHideAuthForm = shouldGateInvitePassword || shouldWaitInviteCheck

  return (
    <main className="login-screen">
      <section className="login-panel">
        {onBackToShare ? <Button className="login-back-share" type="button" variant="ghost" onClick={onBackToShare}><ArrowLeft /> {shareBackLabel}</Button> : null}
        <div className="login-copy">
          <div className="login-brand-title">Veges</div>
          <div className="login-copy-body">
            <p className="eyebrow">Personal project cockpit</p>
            <h1>每天重新接上每个项目的上下文。</h1>
            <p>
              把不同项目的进展、决策、风险、待办和聊天线索放回对应篮子里，让你从早上打开产品的第一分钟就知道今天该推进什么。
            </p>
          </div>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (shouldGateInvitePassword) {
              if (!invitePasswordChecking && invitePasswordDraft.trim()) {
                void onVerifyInvitePassword()
              }
              return
            }
            if (mode === 'register' && password !== confirmPassword) {
              setFormError('两次输入的密码不一致。')
              return
            }
            onSignIn(username, password, mode)
          }}
        >
          <div className="login-form-heading">
            <strong>{mode === 'register' ? '注册账号' : '登录'}</strong>
            <span>{mode === 'register' ? '设置用户名和密码后进入工作区。' : '优先使用飞书，也可以用用户名和密码继续。'}</span>
          </div>
          {hasProjectInvite && (
            <div className="login-invite-note">
              <LinkSimple size={16} />
              <span>
                {shouldGateInvitePassword
                  ? '检测到加密项目邀请链接，请先输入邀请密码。'
                  : '检测到项目邀请链接，注册或登录后会自动加入项目。'}
              </span>
            </div>
          )}
          {!hasProjectInvite && hasOrganizationInvite ? (
            <div className="login-invite-note">
              <LinkSimple size={16} />
              <span>检测到组织邀请链接，注册或登录后会自动加入组织。</span>
            </div>
          ) : null}
          {shouldGateInvitePassword ? (
            <div className="invite-password-gate">
              <Label>
                邀请密码
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="输入分享文本中的密码"
                  type="password"
                  value={invitePasswordDraft}
                  onChange={(event) => onInvitePasswordChange(event.target.value)}
                />
              </Label>
              {invitePasswordError || error ? (
                <p className="form-error">{invitePasswordError || error}</p>
              ) : null}
              <Button
                className="solid-button wide"
                type="button"
                disabled={invitePasswordChecking || !invitePasswordDraft.trim()}
                onClick={() => void onVerifyInvitePassword()}
              >
                {invitePasswordChecking ? '验证中...' : '验证邀请密码'}
              </Button>
            </div>
          ) : null}
          {shouldWaitInviteCheck ? (
            <p className="form-note">正在检查邀请链接...</p>
          ) : null}
          {!shouldHideAuthForm && (
            <>
          <Label>
            用户名
            <Input
              autoComplete="username"
              placeholder="输入用户名"
              required
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                clearErrors()
              }}
            />
          </Label>
          <Label>
            密码
            <Input
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={6}
              placeholder="至少 6 位"
              required
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearErrors()
              }}
            />
          </Label>
          {mode === 'register' && (
            <Label>
              确认密码
              <Input
                autoComplete="new-password"
                minLength={6}
                placeholder="再次输入密码"
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  clearErrors()
                }}
              />
            </Label>
          )}
          {(formError || error) && <p className="form-error">{formError || error}</p>}
          <Button className="solid-button wide" type="submit">
            <SignIn size={18} /> {mode === 'register' ? '创建账号' : '进入驾驶舱'}
          </Button>
          <div className="auth-divider">
            <span>或</span>
          </div>
          <Button
            className="feishu-auth-button wide"
            type="button"
            variant="outline"
            disabled={feishuBusy}
            onClick={handleFeishuSignIn}
          >
            <LinkSimple size={18} /> {feishuBusy ? '正在打开飞书...' : '用飞书继续'}
          </Button>
          <p className="form-note">
            {mode === 'register'
              ? (
                  <>
                    已有账号？{' '}
                    <button className="inline-text-button" type="button" onClick={() => switchMode('login')}>
                      返回登录
                    </button>
                    。{hasProjectInvite || hasOrganizationInvite
                      ? `注册后会创建个人工作区并加入受邀${hasProjectInvite ? '项目' : '组织'}，密码会加密保存。`
                      : '共享 AI 环境下，密码注册需要项目或组织邀请；也可以使用公司飞书账号继续。'}
                  </>
                )
              : (
                  <>
                    使用你{' '}
                    <button className="inline-text-button" type="button" onClick={() => switchMode('register')}>
                      注册
                    </button>
                    {' '}时设置的用户名和密码登录；也可以直接使用飞书账号登录或注册。
                  </>
                )}
          </p>
            </>
          )}
        </form>
      </section>
    </main>
  )
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      className={active ? 'nav-button active' : 'nav-button'}
      variant="ghost"
      onClick={onClick}
      type="button"
    >
      {children}
    </Button>
  )
}

function NavGroup({
  children,
  id,
  label,
}: {
  children: ReactNode
  id: string
  label: string
}) {
  return (
    <div className="nav-group" role="group" aria-labelledby={id}>
      <div className="nav-group-label" id={id}>{label}</div>
      {children}
    </div>
  )
}

function ProjectTags({
  compact = false,
  tags,
}: {
  compact?: boolean
  tags: string[]
}) {
  if (tags.length === 0) return null

  return (
    <span className={compact ? 'project-tags compact' : 'project-tags'}>
      {tags.slice(0, compact ? 2 : 3).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      {tags.length > (compact ? 2 : 3) && <span>+{tags.length - (compact ? 2 : 3)}</span>}
    </span>
  )
}

function getUserDisplayName(user: AuthUser | null) {
  if (!user) return 'Veges'
  return user.displayName || user.username
}

function AccountMenu({
  onDisconnectFeishu,
  user,
  themeMode,
  onSaveAccountSettings,
  onRoleChange,
  onOpenChangelog,
  onSignOut,
  onToggleTheme,
}: {
  onDisconnectFeishu: () => Promise<AuthUser>
  user: AuthUser | null
  themeMode: ThemeMode
  onSaveAccountSettings: (payload: {
    displayName: string
  }) => Promise<void>
  onRoleChange: (role: SwitchableUserRole) => void
  onOpenChangelog: () => void
  onSignOut: () => void
  onToggleTheme: () => void
}) {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const [roleManagementDialogOpen, setRoleManagementDialogOpen] = useState(false)
  const displayName = getUserDisplayName(user)
  const availableRoles = user ? getSwitchableUserRoles(user.roles) : []
  const accountMeta = user
    ? userRoleLabel[user.activeRole]
    : '尚未登录'

  return (
    <div className="sidebar-footer">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={accountTriggerRef} className="account-trigger" variant="outline" type="button">
            <span className="account-status-dot" aria-hidden />
            <span className="account-copy">
              <strong>{displayName}</strong>
              <small>{accountMeta}</small>
            </span>
            <CaretDown size={16} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="account-menu-content">
          <DropdownMenuItem
            onSelect={() => setAccountDialogOpen(true)}
          >
            <GearSix /> 账户设置
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenChangelog}>
            <FileText /> 更新日志
          </DropdownMenuItem>
          {user && availableRoles.length > 1 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <UserSwitch /> 选择角色
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="account-role-submenu">
                  {availableRoles.map((role) => (
                    <DropdownMenuItem key={role} onSelect={() => onRoleChange(role)}>
                      {user.activeRole === role ? <Check /> : <span className="account-role-placeholder" />}
                      {userRoleLabel[role]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          ) : null}
          {user?.isSystemAdmin ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setRoleManagementDialogOpen(true)
              }}
            >
              <ManageRolesMenuLabel />
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="theme-menu-item"
            onSelect={(event) => {
              event.preventDefault()
              onToggleTheme()
            }}
          >
            <span className="theme-menu-label">
              <Sun /> 亮色模式
            </span>
            <span
              className={themeMode === 'light' ? 'theme-toggle is-on' : 'theme-toggle'}
              aria-hidden
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut} variant="destructive">
            <SignOut /> 退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDialog
        open={accountDialogOpen}
        returnFocusRef={accountTriggerRef}
        user={user}
        onDisconnectFeishu={onDisconnectFeishu}
        onOpenChange={setAccountDialogOpen}
        onSaveProfile={onSaveAccountSettings}
      />

      <UserRoleManagementDialog
        open={roleManagementDialogOpen}
        onOpenChange={setRoleManagementDialogOpen}
      />
    </div>
  )
}

function EmptyWorkspace({
  isNewProjectDialogOpen,
  newProjectName,
  newProjectTags,
  scopeLabel,
  onAddProject,
  onNewProjectDialogOpenChange,
  onNewProjectNameChange,
  onNewProjectTagsChange,
}: {
  isNewProjectDialogOpen: boolean
  newProjectName: string
  newProjectTags: string
  scopeLabel: string
  onAddProject: () => void
  onNewProjectDialogOpenChange: (open: boolean) => void
  onNewProjectNameChange: (value: string) => void
  onNewProjectTagsChange: (value: string) => void
}) {
  return (
    <Card className="panel empty-workspace">
      <p className="eyebrow">{scopeLabel}工作区</p>
      <h3>先创建第一个项目篮子。</h3>
      <p>
        每个项目都会拥有自己的日记、待办、风险和总结。创建后就可以开始记录今天的上下文。
      </p>
      <Dialog
        open={isNewProjectDialogOpen}
        onOpenChange={onNewProjectDialogOpenChange}
      >
        <DialogTrigger asChild>
          <Button className="solid-button" type="button">
            <Plus size={17} /> 创建第一个项目
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              先建立一个新的项目篮子，之后可以继续补充日记、待办和风险。
            </DialogDescription>
          </DialogHeader>
          <NewProjectForm
            newProjectName={newProjectName}
            newProjectTags={newProjectTags}
            onCancel={() => onNewProjectDialogOpenChange(false)}
            onNewProjectNameChange={onNewProjectNameChange}
            onNewProjectTagsChange={onNewProjectTagsChange}
            onSubmit={onAddProject}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function NewProjectForm({
  newProjectName,
  newProjectTags,
  onCancel,
  onNewProjectNameChange,
  onNewProjectTagsChange,
  onSubmit,
}: {
  newProjectName: string
  newProjectTags: string
  onCancel: () => void
  onNewProjectNameChange: (value: string) => void
  onNewProjectTagsChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="new-project-dialog-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Label>
        项目名称
        <Input
          autoFocus
          aria-label="新项目名称"
          placeholder="例如：增长实验复盘"
          required
          value={newProjectName}
          onChange={(event) => onNewProjectNameChange(event.target.value)}
        />
      </Label>
      <Label>
        标签
        <Input
          aria-label="项目标签"
          placeholder="可选，用逗号或空格分隔"
          value={newProjectTags}
          onChange={(event) => onNewProjectTagsChange(event.target.value)}
        />
      </Label>
      <DialogFooter>
        <Button className="ghost-button" variant="outline" type="button" onClick={onCancel}>
          取消
        </Button>
        <Button className="solid-button" type="submit">
          <Plus size={15} /> 创建项目
        </Button>
      </DialogFooter>
    </form>
  )
}

function ProjectDetail({
  departedUserIds,
  initialTodoId,
  journalDraft,
  notificationDetailActive,
  packageTimeline,
  packageWorkbenchRef,
  projectDetailTab,
  onAddTodo,
  onAddInstallEventComment,
  onCompleteInstallEvent,
  onCreateInstallOperation,
  onDeleteInstallEvent,
  onDeleteInstallEventComment,
  onDeleteInstallGroup,
  onDeleteInstallOperation,
  onDraftChange,
  onExportInstallTimeline,
  onInstallLoadMarketCiBranches,
  onInstallLoadMarketDetail,
  onInstallLoadItemDownloadUrl,
  onInstallLoadMarketRules,
  onInstallLoadMarketVersions,
  onSaveInstallEvent,
  onUpdateInstallEventComment,
  onUpdateInstallOperation,
  onSaveJournal,
  onDeleteJournalEntry,
  onEditJournalEntry,
  onToggleJournalRisk,
  onUpdateJournalVisibility,
  onCreateTodoNote,
  onCreateTodoModule,
  onDeleteTodo,
  onUpdateTodo,
  onUpdateTodoNote,
  onTodoCreateDraftClear,
  onTodoAssigneeChange,
  onTodoWatcherChange,
  onTodoReviewerChange,
  onTodoCreatedAtChange,
  onTodoDueDateChange,
  onTodoDetailDraftChange,
  onTodoDraftChange,
  onTodoModuleChange,
  onTodoPriorityChange,
  onTodoDetailViewChange,
  onReturnToNotifications,
  project,
  currentUser,
  memberships,
  projects,
  projectTodos,
  todoAssigneeUserId,
  todoWatcherUserIds,
  todoReviewerUserId,
  todoCreatedAt,
  todoDueDate,
  todoDetailDraft,
  todoDraft,
  todoModuleId,
  todoPriority,
}: {
  departedUserIds: readonly number[]
  initialTodoId?: number | null
  journalDraft: string
  notificationDetailActive: boolean
  packageTimeline: ProjectPackageTimeline | null
  packageWorkbenchRef: RefObject<ProjectPackageWorkbenchHandle | null>
  projectDetailTab: ProjectDetailTab
  onAddTodo: (projectId: number) => void | Promise<void>
  onAddInstallEventComment: (eventId: number, content: string) => Promise<boolean>
  onCompleteInstallEvent: (eventId: number) => Promise<boolean>
  onCreateInstallOperation: (payload: {
    eventId: number
    groupId?: number | null
    kind: ProjectPackageOperationKind
    title?: string
    label?: string
    content?: string
    completed?: boolean
    status?: ProjectPackageOperationStatus
    relatedTodoIds?: number[]
    relatedTodoNotes?: Record<number, string>
  }) => Promise<boolean>
  onDeleteInstallEvent: (eventId: number) => Promise<boolean>
  onDeleteInstallEventComment: (eventId: number, commentId: number) => Promise<boolean>
  onDeleteInstallGroup: (groupId: number) => Promise<void>
  onDeleteInstallOperation: (operationId: number) => Promise<void>
  onDraftChange: (value: string) => void
  onExportInstallTimeline: () => Promise<{ fileName: string; markdown: string }>
  onInstallLoadMarketDetail: (payload: {
    arch: string
    channel: PackageMarketChannel
    ciBranch?: string
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    includeAll?: boolean
    packageId: string
    releaseVersion?: string
    context?: PackageMarketRequestContext
  }) => Promise<PackageMarketDetail>
  onInstallLoadItemDownloadUrl: (itemId: number) => Promise<string>
  onInstallLoadMarketCiBranches: (packageId: string, context?: PackageMarketRequestContext) => Promise<PackageMarketCiBranch[]>
  onInstallLoadMarketRules: (context?: PackageMarketRequestContext) => Promise<PackageMarketRulesResponse>
  onInstallLoadMarketVersions: (payload: {
    arch: string
    ciBranch?: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    includeAll?: boolean
    packageId: string
    context?: PackageMarketRequestContext
  }) => Promise<PackageMarketVersion[]>
  onSaveInstallEvent: (
    eventId: number | null,
    payload: ProjectPackageEventSavePayload,
  ) => Promise<ProjectPackageEvent | null>
  onUpdateInstallOperation: (
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
  ) => Promise<boolean>
  onUpdateInstallEventComment: (eventId: number, commentId: number, content: string) => Promise<boolean>
  onSaveJournal: (createdAt?: string) => Promise<boolean>
  onDeleteJournalEntry: (projectId: number, entryId: number) => void
  onEditJournalEntry: (
    projectId: number,
    entryId: number,
    content: string,
  ) => void
  onToggleJournalRisk: (
    projectId: number,
    entryId: number,
    isRiskEntry: boolean,
  ) => void
  onUpdateJournalVisibility: (
    projectId: number,
    entryId: number,
    visibility: JournalVisibility,
  ) => void
  onCreateTodoNote: (todoId: number, content: string) => void
  onCreateTodoModule: (projectId: number, name: string) => Promise<ProjectModule | null>
  onDeleteTodo: (todoId: number) => void
  onUpdateTodo: (id: number, payload: TodoUpdatePayload) => Promise<boolean>
  onUpdateTodoNote: (todoId: number, noteId: number, content: string) => void
  onTodoCreateDraftClear: (projectId?: number) => void
  onTodoAssigneeChange: (id: number | null) => void
  onTodoWatcherChange: (ids: number[]) => void
  onTodoReviewerChange: (id: number | null) => void
  onTodoCreatedAtChange: (value: string) => void
  onTodoDueDateChange: (value: string) => void
  onTodoDetailDraftChange: (value: string) => void
  onTodoDraftChange: (value: string) => void
  onTodoModuleChange: (id: number | null) => void
  onTodoPriorityChange: (value: Priority) => void
  onTodoDetailViewChange?: (active: boolean) => void
  onReturnToNotifications: () => void
  project: Project
  currentUser: AuthUser | null
  memberships: ProjectMembership[]
  projects: Project[]
  projectTodos: Todo[]
  todoAssigneeUserId: number | null
  todoWatcherUserIds: number[]
  todoReviewerUserId: number | null
  todoCreatedAt: string
  todoDueDate: string
  todoDetailDraft: string
  todoDraft: string
  todoModuleId: number | null
  todoPriority: Priority
}) {
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null)
  const [journalEditDraft, setJournalEditDraft] = useState('')
  const [isJournalComposing, setIsJournalComposing] = useState(false)
  const [isTodoCreateDialogOpen, setIsTodoCreateDialogOpen] = useState(false)
  const initialTodoExists = initialTodoId != null && projectTodos.some((todo) => todo.id === initialTodoId)
  const [isProjectTodoDetailOpen, setIsProjectTodoDetailOpen] = useState(initialTodoExists)
  const [pastJournalDialogOpen, setPastJournalDialogOpen] = useState(false)
  const [pastJournalDate, setPastJournalDate] = useState(getPreviousDateStamp())
  const isProjectTodoFocusOpen = isProjectTodoDetailOpen || isTodoCreateDialogOpen
  const journalDates = useMemo(
    () =>
      Array.from(new Set(project.journals.map((entry) => entry.createdAt.slice(0, 10))))
        .sort((left, right) => right.localeCompare(left)),
    [project.journals],
  )
  const defaultJournalDate = journalDates.includes(today)
    ? today
    : journalDates[0] ?? today
  const [selectedJournalDate, setSelectedJournalDate] = useState(defaultJournalDate)
  const activeJournalDate = journalDates.includes(selectedJournalDate)
    ? selectedJournalDate
    : defaultJournalDate
  const visibleJournals = project.journals.filter((entry) =>
    entry.createdAt.startsWith(activeJournalDate),
  )
  const selectedJournalDateIndex = journalDates.indexOf(activeJournalDate)
  const previousJournalDate =
    selectedJournalDateIndex >= 0
      ? journalDates[selectedJournalDateIndex + 1]
      : undefined
  const nextJournalDate =
    selectedJournalDateIndex > 0
      ? journalDates[selectedJournalDateIndex - 1]
      : undefined
  const projectMembers = getProjectAssignableUsers(project, memberships)
  const projectModules = project.modules
  const canWriteProject = !project.readOnly
  const isOwner = project.accessRole === 'owner'
  const hasTodoCreateDraft = Boolean(
    todoDraft.trim() ||
      todoDetailDraft.trim() ||
      todoCreatedAt ||
      todoDueDate !== today ||
      todoPriority !== 'medium' ||
      todoAssigneeUserId != null ||
      todoWatcherUserIds.length > 0 ||
      todoReviewerUserId != null ||
      todoModuleId != null,
  )
  const riskJournalEntryIds = useMemo(
    () => new Set(project.riskJournalEntryIds),
    [project.riskJournalEntryIds],
  )

  function handleJournalKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    save: () => void,
  ) {
    const nativeEvent = event.nativeEvent as KeyboardEvent
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      isJournalComposing ||
      nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    save()
  }

  function openPastJournalDialog() {
    setPastJournalDate((current) => current < today ? current : getPreviousDateStamp())
    setPastJournalDialogOpen(true)
  }

  async function savePastJournal() {
    if (!journalDraft.trim()) return
    const saved = await onSaveJournal(pastJournalDate)
    if (saved) {
      setSelectedJournalDate(pastJournalDate)
      setPastJournalDialogOpen(false)
    }
  }

  async function saveTodayJournal() {
    const saved = await onSaveJournal()
    if (saved) setSelectedJournalDate(today)
  }

  function closeTodoCreateDialog() {
    setIsTodoCreateDialogOpen(false)
  }

  async function handleAddTodo() {
    const hasDraft = Boolean(todoDraft.trim())
    await Promise.resolve(onAddTodo(project.id))
    if (hasDraft) {
      closeTodoCreateDialog()
    }
  }

  useEffect(() => {
    if (projectDetailTab !== 'journal') {
      setIsProjectTodoDetailOpen(false)
      setIsTodoCreateDialogOpen(false)
    }
  }, [projectDetailTab])

  useEffect(() => {
    onTodoDetailViewChange?.(isProjectTodoFocusOpen)
    return () => {
      onTodoDetailViewChange?.(false)
    }
  }, [isProjectTodoFocusOpen, onTodoDetailViewChange])

  return (
    <div
      className={
        projectDetailTab === 'packages'
          ? 'detail-layout packages-mode'
          : projectDetailTab === 'activity'
            ? 'detail-layout activity-mode'
          : isProjectTodoFocusOpen
            ? 'detail-layout todo-detail-focus'
            : 'detail-layout'
      }
    >
      <div className="project-detail-main">
        {projectDetailTab === 'activity' ? (
          <TodoActivityPanel departedUserIds={departedUserIds} projectId={project.id} />
        ) : projectDetailTab === 'packages' ? (
          <ProjectPackageWorkbench
            ref={packageWorkbenchRef}
            onAddEventComment={onAddInstallEventComment}
            onCompleteEvent={onCompleteInstallEvent}
            onCreateOperation={onCreateInstallOperation}
            onDeleteEvent={onDeleteInstallEvent}
            onDeleteEventComment={onDeleteInstallEventComment}
            onDeleteGroup={onDeleteInstallGroup}
            onDeleteOperation={onDeleteInstallOperation}
            onExportTimeline={onExportInstallTimeline}
            onLoadPackageMarketDetail={onInstallLoadMarketDetail}
            onLoadPackageMarketCiBranches={onInstallLoadMarketCiBranches}
            onLoadPackageItemDownloadUrl={onInstallLoadItemDownloadUrl}
            onLoadPackageMarketRules={onInstallLoadMarketRules}
            onLoadPackageMarketVersions={onInstallLoadMarketVersions}
            onSaveEvent={onSaveInstallEvent}
            onUpdateEventComment={onUpdateInstallEventComment}
            onUpdateOperation={onUpdateInstallOperation}
            onUpdateTodo={onUpdateTodo}
            currentUserId={currentUser?.id}
            memberships={memberships}
            project={project}
            todos={projectTodos}
            timeline={packageTimeline}
          />
        ) : !isProjectTodoFocusOpen ? (
          <Card className="panel journal-panel">
            <PanelTitle icon={<FileText size={18} />} title="项目日记" />
            {canWriteProject ? <><Label className="textarea-label journal-entry-label">
              <MentionTextarea
                members={projectMembers}
                placeholder="记录今天的进展、决策、问题或方案..."
                value={journalDraft}
                onChange={onDraftChange}
                onCompositionEnd={() => setIsJournalComposing(false)}
                onCompositionStart={() => setIsJournalComposing(true)}
                onKeyDown={(event) => handleJournalKeyDown(event, saveTodayJournal)}
              />
            </Label>
            <div className="journal-save-actions">
              <Button className="solid-button" type="button" onClick={saveTodayJournal}>
                <NotePencil size={17} /> 保存到今日日记
              </Button>
              <Button className="ghost-button" variant="outline" type="button" onClick={openPastJournalDialog}>
                保存到既往日期日记
              </Button>
            </div>
            <Dialog open={pastJournalDialogOpen} onOpenChange={setPastJournalDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>保存到既往日期日记</DialogTitle>
                  <DialogDescription>
                    选择今天之前的日期，当前输入内容会保存为该日期的项目日记。
                  </DialogDescription>
                </DialogHeader>
                <div className="past-journal-date-dialog-body">
                  <span>日记日期</span>
                  <JournalDatePicker
                    ariaLabel="选择既往日记日期"
                    className="past-journal-date-trigger"
                    datesWithEntries={journalDates}
                    maxDate={getPreviousDateStamp()}
                    value={pastJournalDate}
                    onChange={setPastJournalDate}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setPastJournalDialogOpen(false)}>
                    取消
                  </Button>
                  <Button className="solid-button" type="button" disabled={!journalDraft.trim()} onClick={savePastJournal}>
                    保存日记
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog></> : null}

            <div className="history-list">
              {visibleJournals.length > 0 ? (
                visibleJournals.map((entry) => {
                  const canEditEntry = canWriteProject && (
                    entry.authorUserId === currentUser?.id ||
                    (!entry.authorUserId && isOwner)
                  )
                  const canDeleteEntry = isOwner || canEditEntry
                  const isRiskEntry = riskJournalEntryIds.has(entry.id)
                  return (
                    <article
                      className={isRiskEntry ? 'history-item is-risk' : 'history-item'}
                      key={entry.id}
                    >
                      <div className="history-item-header">
                        <div className="history-speaker">
                          <time>{entry.createdAt}</time>
                          <span>{entry.speakerName}</span>
                          <Badge className={entry.visibility === 'public' ? 'visibility-pill public' : 'visibility-pill'}>
                            {entry.visibility === 'public' ? '公开' : '私有'}
                          </Badge>
                        </div>
                        <span className="history-actions">
                          {canEditEntry && (
                            <Button
                              className="history-visibility-button"
                              variant="ghost"
                              type="button"
                              aria-label={entry.visibility === 'public' ? '改为私有日记' : '公开日记'}
                              title={entry.visibility === 'public' ? '改为私有日记' : '公开日记'}
                              onClick={() =>
                                onUpdateJournalVisibility(
                                  project.id,
                                  entry.id,
                                  entry.visibility === 'public' ? 'private' : 'public',
                                )
                              }
                            >
                              {entry.visibility === 'public' ? '设私有' : '公开'}
                            </Button>
                          )}
                          {canEditEntry && (
                            <Button
                              className="history-edit-button"
                              variant="ghost"
                              size="icon"
                              type="button"
                              aria-label="编辑日记"
                              title="编辑日记"
                              onClick={() => {
                                setEditingJournalId(entry.id)
                                setJournalEditDraft(entry.content)
                              }}
                            >
                              <PencilSimple size={15} />
                            </Button>
                          )}
                          {canEditEntry && (
                            <Button
                              className={isRiskEntry ? 'history-risk-button is-active' : 'history-risk-button'}
                              variant="ghost"
                              size="icon"
                              type="button"
                              aria-pressed={isRiskEntry}
                              aria-label={isRiskEntry ? '取消风险标记' : '标记为项目风险'}
                              title={isRiskEntry ? '取消风险标记' : '标记为项目风险'}
                              onClick={() => onToggleJournalRisk(project.id, entry.id, isRiskEntry)}
                            >
                              <WarningCircle size={15} />
                            </Button>
                          )}
                          {canDeleteEntry && (
                            <ConfirmDialog
                              confirmLabel="删除日记"
                              description={`这条 ${entry.createdAt} 的日记删除后将无法在当前预览数据中恢复。`}
                              onConfirm={() => onDeleteJournalEntry(project.id, entry.id)}
                              title="确认删除这条日记？"
                              trigger={
                                <Button
                                  className="history-delete-button"
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  aria-label="删除日记"
                                >
                                  <Trash size={15} />
                                </Button>
                              }
                            />
                          )}
                        </span>
                      </div>
                      {editingJournalId === entry.id ? (
                        <form
                          className="journal-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault()
                            const nextContent = journalEditDraft.trim()
                            if (!nextContent) return
                            onEditJournalEntry(project.id, entry.id, nextContent)
                            setEditingJournalId(null)
                            setJournalEditDraft('')
                          }}
                        >
                          <Textarea
                            autoFocus
                            aria-label="编辑日记内容"
                            value={journalEditDraft}
                            onChange={(event) => setJournalEditDraft(event.target.value)}
                            onCompositionEnd={() => setIsJournalComposing(false)}
                            onCompositionStart={() => setIsJournalComposing(true)}
                            onKeyDown={(event) =>
                              handleJournalKeyDown(event, () => {
                                const nextContent = journalEditDraft.trim()
                                if (!nextContent) return
                                onEditJournalEntry(project.id, entry.id, nextContent)
                                setEditingJournalId(null)
                                setJournalEditDraft('')
                              })
                            }
                          />
                          <div className="journal-edit-actions">
                            <Button
                              className="ghost-button"
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditingJournalId(null)
                                setJournalEditDraft('')
                              }}
                            >
                              取消
                            </Button>
                            <Button
                              className="solid-button"
                              type="submit"
                              disabled={!journalEditDraft.trim()}
                            >
                              保存修改
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <MarkdownPreview content={entry.content} compact />
                      )}
                    </article>
                  )
                })
              ) : (
                <p className="empty-state">这一天还没有日记记录。</p>
              )}
            </div>
            <div className="journal-pagination" aria-label="日记日期选择">
              <Button
                className="ghost-button"
                disabled={!previousJournalDate}
                type="button"
                variant="outline"
                onClick={() => {
                  if (!previousJournalDate) return
                  setSelectedJournalDate(previousJournalDate)
                  setEditingJournalId(null)
                  setJournalEditDraft('')
                }}
              >
                上一天
              </Button>
              <JournalDatePicker
                key={activeJournalDate}
                datesWithEntries={journalDates}
                value={activeJournalDate}
                onChange={(date) => {
                  setSelectedJournalDate(date)
                  setEditingJournalId(null)
                  setJournalEditDraft('')
                }}
              />
              <span>{visibleJournals.length} 条</span>
              <Button
                className="ghost-button"
                disabled={!nextJournalDate}
                type="button"
                variant="outline"
                onClick={() => {
                  if (!nextJournalDate) return
                  setSelectedJournalDate(nextJournalDate)
                  setEditingJournalId(null)
                  setJournalEditDraft('')
                }}
              >
                下一天
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      {projectDetailTab === 'journal' ? (
          <Card className={isProjectTodoFocusOpen ? 'side-panel todo-focus-panel' : 'panel side-panel'}>
            <div className="todo-panel-header">
              {!isProjectTodoFocusOpen ? (
                <>
                  <PanelTitle icon={<Check size={18} />} title="项目待办" />
                  {canWriteProject ? <div className="project-todo-header-actions">
                    <Button
                      className="todo-create-trigger"
                      type="button"
                      onClick={() => setIsTodoCreateDialogOpen(true)}
                    >
                      <Plus size={16} /> 添加待办
                    </Button>
                  </div> : null}
                </>
              ) : null}
            </div>
            <div className="side-panel-scroll-area">
              {isTodoCreateDialogOpen ? (
                <TodoEditorDialog
                  departedUserIds={departedUserIds}
                  assigneeUserId={todoAssigneeUserId}
                  watcherUserIds={todoWatcherUserIds}
                  reviewerUserId={todoReviewerUserId}
                  createdAt={todoCreatedAt}
                  detail={todoDetailDraft}
                  dueDate={todoDueDate}
                  members={projectMembers}
                  mode="create"
                  moduleId={todoModuleId}
                  modules={projectModules}
                  canCreateModule={isOwner}
                  open={isTodoCreateDialogOpen}
                  priority={todoPriority}
                  project={project}
                  submitDisabled={!todoDraft.trim()}
                  title={todoDraft}
                  onAssigneeUserIdChange={onTodoAssigneeChange}
                  onWatcherUserIdsChange={onTodoWatcherChange}
                  onReviewerUserIdChange={onTodoReviewerChange}
                  clearDisabled={!hasTodoCreateDraft}
                  onClear={() => onTodoCreateDraftClear(project.id)}
                  onCreatedAtChange={onTodoCreatedAtChange}
                  onCreateModule={(name) => onCreateTodoModule(project.id, name)}
                  onDetailChange={onTodoDetailDraftChange}
                  onDueDateChange={onTodoDueDateChange}
                  onModuleIdChange={onTodoModuleChange}
                  onOpenChange={(open) => {
                    if (!open) closeTodoCreateDialog()
                  }}
                  onPriorityChange={onTodoPriorityChange}
                  onSubmit={handleAddTodo}
                  onTitleChange={onTodoDraftChange}
                />
              ) : (
                <TodoList
                  canManageOrganizationTodos={project.canManageOrganizationTodos}
                  departedUserIds={departedUserIds}
                  key={`project-todos-${project.id}-${project.accessRole}-${currentUser?.id ?? 'anonymous'}`}
                  currentUserId={currentUser?.id}
                  detailBackLabel={notificationDetailActive ? '返回' : undefined}
                  initialTodoId={initialTodoId}
                  memberships={memberships}
                  onCreateTodoNote={canWriteProject ? onCreateTodoNote : undefined}
                  onDeleteTodo={canWriteProject ? onDeleteTodo : undefined}
                  onDetailModeChange={setIsProjectTodoDetailOpen}
                  onDetailBack={notificationDetailActive ? onReturnToNotifications : undefined}
                  onUpdateTodo={canWriteProject || project.canManageOrganizationTodos ? onUpdateTodo : undefined}
                  onUpdateTodoNote={canWriteProject ? onUpdateTodoNote : undefined}
                  project={project}
                  projects={projects}
                  todos={projectTodos}
                  compact
                />
              )}
            </div>
          </Card>
      ) : null}
    </div>
  )
}

function formatInviteDurationLabel(minutes: number) {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} 天`
  if (minutes >= 60) return `${Math.round(minutes / 60)} 小时`
  return `${minutes} 分钟`
}

function generateInviteSharePassword(length = 8) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const values = new Uint32Array(length)
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values)
  } else {
    values.forEach((_, index) => {
      values[index] = Math.floor(Math.random() * alphabet.length)
    })
  }
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

function ProjectMembersPanel({
  departedUserIds,
  memberships,
  onCopyInviteLink,
  onInvite,
  onRemove,
  onSaveFeishuSettings,
  project,
}: {
  departedUserIds: readonly number[]
  memberships: ProjectMembership[]
  onCopyInviteLink: (payload: {
    encryptedShare: boolean
    expiresInMinutes: number
    password?: string
  }) => Promise<{
    expiresAt: string
    expiresInMinutes: number
    password?: string
    token: string
    url: string
  }>
  onInvite: (username: string) => void
  onRemove: (membershipId: number) => void
  onSaveFeishuSettings: (payload: {
    feishuChatEnabled: boolean
    feishuChatId: string
  }) => Promise<void>
  project: Project
}) {
  const memberPageSize = 4
  const [username, setUsername] = useState('')
  const [memberPage, setMemberPage] = useState(0)
  const [inviteLinkStatus, setInviteLinkStatus] = useState('')
  const [inviteExpiresInMinutes, setInviteExpiresInMinutes] = useState(10)
  const [encryptedInviteShare, setEncryptedInviteShare] = useState(false)
  const [isCopyingInviteLink, setIsCopyingInviteLink] = useState(false)
  const [feishuChatId, setFeishuChatId] = useState(project.feishuChatId ?? '')
  const [feishuChatEnabled, setFeishuChatEnabled] = useState(Boolean(project.feishuChatEnabled))
  const [feishuStatus, setFeishuStatus] = useState('')
  const [isSavingFeishu, setIsSavingFeishu] = useState(false)
  const memberTotalPages = Math.max(1, Math.ceil(memberships.length / memberPageSize))
  const safeMemberPage = Math.min(memberPage, memberTotalPages - 1)
  const visibleMemberships = memberships.slice(
    safeMemberPage * memberPageSize,
    (safeMemberPage + 1) * memberPageSize,
  )

  useEffect(() => {
    setFeishuChatId(project.feishuChatId ?? '')
    setFeishuChatEnabled(Boolean(project.feishuChatEnabled))
    setFeishuStatus('')
    setMemberPage(0)
  }, [project.feishuChatEnabled, project.feishuChatId, project.id])

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextUsername = username.trim()
    if (!nextUsername) return
    onInvite(nextUsername)
    setUsername('')
    setMemberPage(Math.floor(memberships.length / memberPageSize))
  }

  async function copyInviteLink() {
    setIsCopyingInviteLink(true)
    setInviteLinkStatus('')
    try {
      const password = encryptedInviteShare ? generateInviteSharePassword() : undefined
      const inviteLink = await onCopyInviteLink({
        encryptedShare: encryptedInviteShare,
        expiresInMinutes: inviteExpiresInMinutes,
        password,
      })
      setInviteLinkStatus(
        encryptedInviteShare && inviteLink.password
          ? `已复制加密分享文本，${formatInviteDurationLabel(inviteLink.expiresInMinutes)}内有效`
          : `已复制，${formatInviteDurationLabel(inviteLink.expiresInMinutes)}内有效`,
      )
    } catch {
      setInviteLinkStatus('复制失败，请稍后再试')
    } finally {
      setIsCopyingInviteLink(false)
    }
  }

  async function saveFeishuSettings() {
    const nextChatId = feishuChatId.trim()
    if (feishuChatEnabled && !nextChatId) {
      setFeishuStatus('开启群通知前，请先填写项目群 chat_id。')
      return
    }

    setIsSavingFeishu(true)
    setFeishuStatus('')
    try {
      await onSaveFeishuSettings({
        feishuChatEnabled,
        feishuChatId: nextChatId,
      })
      setFeishuChatId(nextChatId)
      setFeishuStatus('已保存')
    } catch {
      setFeishuStatus('保存失败，请稍后再试')
    } finally {
      setIsSavingFeishu(false)
    }
  }

  return (
    <div className="project-members-panel">
      <section className="project-config-section project-members-roster">
        <div className="project-config-section-head">
          <strong>项目成员</strong>
          <p>成员可以新增自己的日记和项目待办，但不能修改项目状态或名称。</p>
        </div>
        <form className="member-invite-form" onSubmit={submitInvite}>
          <Input
            autoComplete="username"
            type="text"
            placeholder="输入用户名邀请"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Button className="solid-button" type="submit" disabled={!username.trim()}>
            邀请
          </Button>
        </form>
        <div className="member-list">
          {memberships.length === 0 ? (
            <p className="empty-state">还没有邀请成员。</p>
          ) : (
            visibleMemberships.map((membership) => (
              <article className="member-item" key={membership.id}>
                <span>
                  <UserName departedUserIds={departedUserIds} name={membership.memberName} userId={membership.invitedUserId} />
                  <small>
                    {membership.invitedUsername} · {membership.status === 'pending'
                      ? '待确认'
                      : membership.status === 'declined'
                        ? '已拒绝'
                        : '已加入'}
                  </small>
                </span>
                <Button
                  className="todo-delete-button"
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="移除成员"
                  title="移除成员"
                  onClick={() => onRemove(membership.id)}
                >
                  <Trash size={14} />
                </Button>
              </article>
            ))
          )}
        </div>
        {memberTotalPages > 1 ? (
          <SidePager
            label="项目成员翻页"
            page={safeMemberPage}
            totalPages={memberTotalPages}
            onPrevious={() => setMemberPage((current) => Math.max(0, current - 1))}
            onNext={() => setMemberPage((current) => Math.min(memberTotalPages - 1, current + 1))}
          />
        ) : null}
      </section>

      <div className="project-members-settings">
        <section className="project-config-section">
          <div className="project-config-section-head">
            <strong>项目邀请链接</strong>
            <p>复制给新成员，TA 注册或登录后会自动加入这个项目。链接默认 10 分钟后失效。</p>
          </div>
          <div className="project-invite-link-actions">
            <label className="project-invite-expiry-field">
              <span>有效时长</span>
              <Select
                value={String(inviteExpiresInMinutes)}
                onValueChange={(value) => setInviteExpiresInMinutes(Number(value))}
              >
                <SelectTrigger aria-label="选择邀请链接有效时长">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 30, 60, 240, 1440].map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {formatInviteDurationLabel(minutes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="project-invite-copy-group">
              <label className="project-invite-encrypted-share">
                <input
                  type="checkbox"
                  checked={encryptedInviteShare}
                  onChange={(event) => {
                    setEncryptedInviteShare(event.target.checked)
                    setInviteLinkStatus('')
                  }}
                />
                <span>加密分享</span>
              </label>
              <Button
                className="solid-button"
                type="button"
                disabled={isCopyingInviteLink}
                onClick={copyInviteLink}
              >
                <CopySimple size={15} />
                {isCopyingInviteLink
                  ? '复制中'
                  : inviteLinkStatus.startsWith('已复制') ? '已复制' : '复制链接'}
              </Button>
            </div>
          </div>
          {inviteLinkStatus ? (
            <p className="project-invite-link-status">{inviteLinkStatus}</p>
          ) : null}
        </section>

        <section className="project-config-section project-feishu-card">
          <div className="project-config-section-head">
            <strong>项目群通知</strong>
            <p>默认关闭；开启后，负责人未配置飞书邮箱的项目通知会兜底发送到这个项目群。</p>
          </div>
          <label className="project-feishu-toggle">
            <span>
              <input
                type="checkbox"
                checked={feishuChatEnabled}
                onChange={(event) => {
                  setFeishuChatEnabled(event.target.checked)
                  setFeishuStatus('')
                }}
              />
              启用群通知
            </span>
            <small>{feishuChatEnabled ? '已开启，需填写项目群 chat_id' : '关闭状态，不会发送项目群消息'}</small>
          </label>
          {feishuChatEnabled ? (
            <div className="project-feishu-row">
              <Input
                type="text"
                placeholder="输入项目群 chat_id，例如 oc_xxx"
                value={feishuChatId}
                onChange={(event) => {
                  setFeishuChatId(event.target.value)
                  setFeishuStatus('')
                }}
              />
              <Button
                className="solid-button"
                type="button"
                disabled={isSavingFeishu || !feishuChatId.trim()}
                onClick={saveFeishuSettings}
              >
                {isSavingFeishu ? '保存中' : '保存'}
              </Button>
            </div>
          ) : (
            <div className="project-feishu-save-row">
              <Button
                className="solid-button"
                type="button"
                disabled={isSavingFeishu}
                onClick={saveFeishuSettings}
              >
                {isSavingFeishu ? '保存中' : '保存关闭状态'}
              </Button>
            </div>
          )}
          {feishuStatus ? <p className="project-feishu-status">{feishuStatus}</p> : null}
        </section>
      </div>
    </div>
  )
}

function ProjectModulesPanel({
  draft,
  modules,
  onCreate,
  onDelete,
  onDraftChange,
}: {
  draft: string
  modules: ProjectModule[]
  onCreate: () => void
  onDelete: (moduleId: number) => void
  onDraftChange: (value: string) => void
}) {
  const modulePageSize = 5
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(modules.length / modulePageSize))
  const safePage = Math.min(page, totalPages - 1)
  const visibleModules = modules.slice(
    safePage * modulePageSize,
    safePage * modulePageSize + modulePageSize,
  )

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  return (
    <div className="project-modules-panel">
      <form
        className="member-invite-form"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate()
        }}
      >
        <Input
          type="text"
          placeholder="输入模块名称，例如：支付、登录、部署"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <Button className="solid-button" type="submit" disabled={!draft.trim()}>
          新增
        </Button>
      </form>
      <div className="member-list">
        {modules.length === 0 ? (
          <p className="empty-state">还没有配置模块。</p>
        ) : (
          <>
            {visibleModules.map((module) => (
              <article className="member-item" key={module.id}>
                <span>
                  <strong>{module.name}</strong>
                  <small>创建于 {module.createdAt.slice(0, 16)}</small>
                </span>
                <ConfirmDialog
                  confirmLabel="删除模块"
                  description={`删除「${module.name}」后，已关联待办会保留，但模块归属会被清空。`}
                  onConfirm={() => onDelete(module.id)}
                  title="确认删除这个项目模块？"
                  trigger={
                    <Button
                      className="todo-delete-button"
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label="删除模块"
                      title="删除模块"
                    >
                      <Trash size={14} />
                    </Button>
                  }
                />
              </article>
            ))}
            {totalPages > 1 ? (
              <div className="module-pagination" aria-label="项目模块翻页">
                <Button
                  className="ghost-button"
                  disabled={safePage === 0}
                  type="button"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  上一页
                </Button>
                <span>{safePage + 1} / {totalPages}</span>
                <Button
                  className="ghost-button"
                  disabled={safePage >= totalPages - 1}
                  type="button"
                  variant="outline"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                >
                  下一页
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  title,
  trigger,
}: {
  confirmLabel: string
  description: string
  onConfirm: () => void
  title: string
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            className="destructive-button"
            type="button"
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectActionsMenu({
  exportProject,
  generateDailySummary,
  generateWeeklySummary,
  onDeleteProject,
  onEditDescriptionClick,
  onRenameClick,
  onTransferClick,
  projectName,
}: {
  exportProject: () => void
  generateDailySummary: () => void
  generateWeeklySummary: () => void
  onDeleteProject: () => void
  onEditDescriptionClick: () => void
  onRenameClick: () => void
  onTransferClick: () => void
  projectName: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="project-menu-trigger"
          variant="outline"
          size="icon"
          type="button"
          aria-label="打开项目操作菜单"
        >
          <DotsThree size={19} weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="project-actions-menu-content">
        <DropdownMenuItem onSelect={onRenameClick}>
          <PencilSimple /> 重命名
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEditDescriptionClick}>
          <NotePencil /> 编辑简介
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTransferClick}>
          <UserSwitch /> 项目转移
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportProject}>
          <DownloadSimple /> 导出项目
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={generateWeeklySummary}>
          <Sparkle /> 生成周总结
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={generateDailySummary}>
          <CalendarBlank /> 生成日总结
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmDialog
          confirmLabel="删除项目"
          description={`删除「${projectName}」后，这个项目下的日记、待办和总结都会从当前工作区移除。`}
          onConfirm={onDeleteProject}
          title="确认删除这个项目？"
          trigger={
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              variant="destructive"
            >
              <Trash /> 删除项目
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationCenterView({
  notifications,
  onAcceptInvitation,
  onIgnoreInvitation,
  onRespondProjectTransfer,
}: {
  notifications: NotificationCenterData
  onAcceptInvitation: (membershipId: number) => Promise<void>
  onIgnoreInvitation: (membershipId: number) => Promise<void>
  onRespondProjectTransfer: (transferId: number, action: 'accept' | 'decline') => Promise<void>
}) {
  type NotificationFeedItem = {
    id: string
    inviteId?: number
    inviteProjectName?: string
    transferId?: number
    transferProjectName?: string
    message: string
    sortAt: number
    time?: string
  }

  const [processingItemId, setProcessingItemId] = useState<string | null>(null)

  const items = useMemo<NotificationFeedItem[]>(() => {
    const sortTime = (item: { assignedAt?: string; createdAt?: string; dueDate?: string; sortAt?: string }) => {
      const value = item.sortAt ?? item.assignedAt ?? item.createdAt ?? item.dueDate ?? ''
      const parsed = Date.parse(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }
    const result: NotificationFeedItem[] = []
    const visible = <T extends { dismissedAt?: string }>(entries: T[]) => entries.filter((entry) => !entry.dismissedAt)

    for (const invite of visible(notifications.invites)) {
      result.push({
        id: `project-invite-${invite.id}`,
        inviteId: invite.id,
        inviteProjectName: invite.projectName,
        message: `${invite.invitedByName} 邀请你加入项目「${invite.projectName}」。`,
        sortAt: sortTime(invite),
        time: invite.createdAt,
      })
    }
    for (const transfer of visible(notifications.projectTransfers)) {
      result.push({
        id: `project-transfer-${transfer.id}`,
        message: `${transfer.requestedByName} 想将项目「${transfer.projectName}」转移给你（共同组织：${transfer.organizationName}）。`,
        sortAt: sortTime(transfer),
        time: transfer.createdAt,
        transferId: transfer.id,
        transferProjectName: transfer.projectName,
      })
    }
    for (const notification of visible(notifications.accountOffboardingReceived)) {
      const organizationText = notification.organizations.map((organization) => {
        const assets = [
          organization.projectNames.length > 0 ? `项目 ${organization.projectNames.join('、')}` : '',
          organization.testSpaceNames.length > 0 ? `测试空间 ${organization.testSpaceNames.join('、')}` : '',
          organization.transferredTodoCount > 0 ? `待办 ${organization.transferredTodoCount} 条` : '',
          organization.bugCount > 0 ? `Bug ${organization.bugCount} 个` : '',
        ].filter(Boolean)
        return `${organization.name}：${assets.length > 0 ? assets.join('、') : '无可转移资产'}`
      }).join('；')
      result.push({
        id: `account-offboarding-${notification.id}`,
        message: `你已接收「${notification.departedUserName}」离职后的资产：${organizationText}。`,
        sortAt: sortTime(notification),
        time: notification.createdAt,
      })
    }
    for (const todo of visible(notifications.assignedTodos)) {
      result.push({
        id: `assigned-todo-${todo.id}`,
        message: `${todo.assignedByName ?? '有人'} 在「${todo.projectName}」中为你添加了一条待办「${todo.title}」，请及时前往待办列表查看。`,
        sortAt: sortTime(todo),
        time: todo.assignedAt,
      })
    }
    for (const todo of visible(notifications.watchedTodos)) {
      result.push({
        id: `watched-todo-${todo.id}`,
        message: `${todo.watchedByName ?? '有人'} 在「${todo.projectName}」中关注了待办「${todo.title}」。`,
        sortAt: sortTime(todo),
        time: todo.watchedAt,
      })
    }
    for (const event of visible(notifications.assignedPackageEvents)) {
      result.push({
        id: `package-event-${event.id}`,
        message: `${event.assignedByName ?? '有人'} 在「${event.projectName}」中为你安排了交付事件「${event.title}」，请及时查看。`,
        sortAt: sortTime(event),
        time: event.assignedAt,
      })
    }
    for (const comment of visible(notifications.packageEventCommentMentions)) {
      result.push({
        id: `package-event-comment-${comment.commentId}`,
        message: `${comment.authorName} 在「${comment.projectName}」的交付反馈中提到了你${comment.commentPreview ? `：“${comment.commentPreview}”` : '。'}`,
        sortAt: sortTime(comment),
        time: comment.createdAt,
      })
    }
    for (const todo of visible(notifications.dueTomorrowTodos)) {
      result.push({
        id: `due-tomorrow-${todo.id}`,
        message: `「${todo.projectName}」中的待办「${todo.title}」将于 ${todo.dueDate} 到期，请及时处理。`,
        sortAt: sortTime(todo),
        time: todo.dueDate,
      })
    }
    for (const note of visible(notifications.noteMentions)) {
      result.push({
        id: `note-mention-${note.noteId ?? note.id}`,
        message: `${note.noteAuthorName ?? '有人'} 在「${note.projectName}」的待办「${note.title}」备注中提到了你${note.notePreview ? `：“${note.notePreview}”` : '。'}`,
        sortAt: sortTime(note),
        time: note.createdAt,
      })
    }

    return result.sort((left, right) => right.sortAt - left.sortAt)
  }, [notifications])

  async function handleInvitation(inviteId: number, action: 'accept' | 'ignore') {
    if (processingItemId !== null) return
    setProcessingItemId(`invite:${inviteId}`)
    try {
      if (action === 'accept') {
        await onAcceptInvitation(inviteId)
      } else {
        await onIgnoreInvitation(inviteId)
      }
    } finally {
      setProcessingItemId(null)
    }
  }

  async function handleProjectTransfer(transferId: number, action: 'accept' | 'decline') {
    if (processingItemId !== null) return
    setProcessingItemId(`transfer:${transferId}`)
    try {
      await onRespondProjectTransfer(transferId, action)
    } finally {
      setProcessingItemId(null)
    }
  }

  return (
    <Card className="panel notification-center-panel">
      {items.length > 0 ? (
        <div className="notification-feed" aria-label="通知列表">
          {items.map((item) => (
            <article
              className={`notification-feed-item${item.inviteId || item.transferId ? ' has-actions' : ''}`}
              key={item.id}
            >
              <span className="notification-feed-dot" aria-hidden />
              <div className="notification-feed-content">
                <p>{item.message}</p>
                {item.time ? <time>{item.time}</time> : null}
              </div>
              {item.inviteId ? (
                <div className="notification-feed-actions">
                  <Button
                    aria-label={`忽略加入项目「${item.inviteProjectName}」的邀请`}
                    disabled={processingItemId !== null}
                    type="button"
                    variant="outline"
                    onClick={() => void handleInvitation(item.inviteId!, 'ignore')}
                  >
                    忽略
                  </Button>
                  <Button
                    aria-label={`同意加入项目「${item.inviteProjectName}」的邀请`}
                    className="solid-button"
                    disabled={processingItemId !== null}
                    type="button"
                    onClick={() => void handleInvitation(item.inviteId!, 'accept')}
                  >
                    同意
                  </Button>
                </div>
              ) : item.transferId ? (
                <div className="notification-feed-actions">
                  <Button
                    aria-label={`拒绝项目「${item.transferProjectName}」的转移申请`}
                    disabled={processingItemId !== null}
                    type="button"
                    variant="outline"
                    onClick={() => void handleProjectTransfer(item.transferId!, 'decline')}
                  >
                    拒绝
                  </Button>
                  <Button
                    aria-label={`同意项目「${item.transferProjectName}」的转移申请`}
                    className="solid-button"
                    disabled={processingItemId !== null}
                    type="button"
                    onClick={() => void handleProjectTransfer(item.transferId!, 'accept')}
                  >
                    同意
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">暂时没有新的通知。</p>
      )}
    </Card>
  )
}

function MentionInput({
  members,
  onChange,
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, 'onChange' | 'value'> & {
  members?: Array<{ id: number; name: string }>
  onChange: (value: string) => void
  value: string
}) {
  return (
    <MentionInputShell
      members={members}
      onChange={onChange}
      value={value}
      inputProps={props}
    />
  )
}

function MentionTextarea({
  members,
  onChange,
  value,
  ...props
}: Omit<ComponentProps<typeof Textarea>, 'onChange' | 'value'> & {
  members?: Array<{ id: number; name: string }>
  onChange: (value: string) => void
  value: string
}) {
  return (
    <MentionInputShell
      members={members}
      multiline
      onChange={onChange}
      value={value}
      inputProps={props}
    />
  )
}

type TodoDetailImageAttachment = {
  alt: string
  src: string
  uploading?: boolean
}

const todoDetailImagePattern = /!\[([^\]]*)\]\(([^)\n]+)\)/g

function normalizeTodoDetailImages(images: TodoDetailImageAttachment[]) {
  return images.map((image, index) => ({
    alt: image.alt.trim() || `粘贴图片 ${index + 1}`,
    src: image.src,
  }))
}

function parseTodoDetailContent(content: string) {
  const normalizedContent = stripMarkdownLinksToText(content)
  const images: TodoDetailImageAttachment[] = []
  const textParts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = todoDetailImagePattern.exec(normalizedContent)

  while (match) {
    textParts.push(normalizedContent.slice(lastIndex, match.index))
    images.push({
      alt: match[1] ?? '',
      src: match[2] ?? '',
      uploading: false,
    })
    lastIndex = todoDetailImagePattern.lastIndex
    match = todoDetailImagePattern.exec(normalizedContent)
  }

  textParts.push(normalizedContent.slice(lastIndex))
  todoDetailImagePattern.lastIndex = 0

  return {
    images: normalizeTodoDetailImages(images),
    text: images.length > 0
      ? textParts.join('').replace(/\n{3,}/g, '\n\n').replace(/\n{2,}$/g, '')
      : textParts.join(''),
  }
}

function serializeTodoDetailContent(text: string, images: TodoDetailImageAttachment[]) {
  const normalizedText = stripMarkdownLinksToText(text)
  const normalizedImages = normalizeTodoDetailImages(images)
  const hasText = normalizedText.trim().length > 0
  const imageMarkdown = normalizedImages
    .map((image) => `![${image.alt}](${image.src})`)
    .join('\n\n')

  if (hasText && imageMarkdown) return `${normalizedText}\n\n${imageMarkdown}`
  return hasText ? normalizedText : imageMarkdown
}

function getTodoContentIndicators(todo: Todo) {
  const detailContent = parseTodoDetailContent(todo.detail)
  const hasDetail = todo.detail.trim().length > 0
  const infoCount = (hasDetail ? 1 : 0) + todo.notes.length
  const imageCount = todo.notes.reduce(
    (total, note) => total + parseTodoDetailContent(note.content).images.length,
    detailContent.images.length,
  )

  return { imageCount, infoCount }
}

async function uploadImagesIntoTodoDetail(
  imageFiles: File[],
  getCurrentValue: () => string,
  onChange: (value: string) => void,
  setUploadingImageSrcs?: Dispatch<SetStateAction<string[]>>,
) {
  if (imageFiles.length === 0) return

  const currentContent = parseTodoDetailContent(getCurrentValue())
  const pendingImages = imageFiles.map((file, index) => ({
    alt: file.name || `粘贴图片 ${currentContent.images.length + index + 1}`,
    src: URL.createObjectURL(file),
    uploading: true,
  }))
  const pendingImageSrcs = pendingImages.map((image) => image.src)
  const pendingImageSrcSet = new Set(pendingImageSrcs)
  setUploadingImageSrcs?.((current) => [...new Set([...current, ...pendingImageSrcs])])
  onChange(serializeTodoDetailContent(
    currentContent.text,
    [...currentContent.images, ...pendingImages],
  ))

  try {
    const uploads = await Promise.all(imageFiles.map(uploadTodoImage))
    const uploadedImagesByPendingSrc = new Map(
      pendingImages.map((pendingImage, index) => [
        pendingImage.src,
        {
          alt: imageFiles[index]?.name ?? '',
          src: uploads[index]?.imageUrl ?? '',
        },
      ]),
    )
    const latestContent = parseTodoDetailContent(getCurrentValue())
    const nextImages = latestContent.images.flatMap((image) => {
      const uploadedImage = uploadedImagesByPendingSrc.get(image.src)
      return uploadedImage?.src ? [uploadedImage] : [image]
    })
    onChange(serializeTodoDetailContent(latestContent.text, nextImages))
  } catch (error) {
    const latestContent = parseTodoDetailContent(getCurrentValue())
    onChange(serializeTodoDetailContent(
      latestContent.text,
      latestContent.images.filter((image) => !pendingImageSrcSet.has(image.src)),
    ))
    console.error('Todo detail image paste failed', error)
    window.alert(error instanceof Error && error.message
      ? `图片上传失败：${error.message}`
      : '图片上传失败，请稍后重试。')
  } finally {
    setUploadingImageSrcs?.((current) =>
      current.filter((src) => !pendingImageSrcSet.has(src)),
    )
    pendingImages.forEach((image) => URL.revokeObjectURL(image.src))
  }
}

async function pasteImagesIntoTodoDetail(
  event: ClipboardEvent<HTMLTextAreaElement>,
  getCurrentValue: () => string,
  onChange: (value: string) => void,
  setUploadingImageSrcs?: Dispatch<SetStateAction<string[]>>,
) {
  const imageFiles = Array.from(event.clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
  if (imageFiles.length === 0) return

  event.preventDefault()
  const textarea = event.currentTarget
  const selectionStart = textarea.selectionStart ?? textarea.value.length
  const upload = uploadImagesIntoTodoDetail(
    imageFiles,
    getCurrentValue,
    onChange,
    setUploadingImageSrcs,
  )
  window.requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionStart)
  })
  await upload
}

function TodoDetailEditor({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const { images, text } = useMemo(() => parseTodoDetailContent(value), [value])
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const [uploadingImageSrcs, setUploadingImageSrcs] = useState<string[]>([])
  const latestValueRef = useRef(value)
  const previewImage = previewImageIndex == null ? null : images[previewImageIndex] ?? null
  const uploadingImageSrcSet = useMemo(() => new Set(uploadingImageSrcs), [uploadingImageSrcs])
  const editorClassName = images.length > 0 ? 'todo-detail-editor has-images' : 'todo-detail-editor'

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    if (previewImageIndex != null && !images[previewImageIndex]) {
      setPreviewImageIndex(null)
    }
  }, [images, previewImageIndex])

  function commitValue(nextValue: string) {
    latestValueRef.current = nextValue
    onChange(nextValue)
  }

  function updateTodoDetail(nextText: string, nextImages: TodoDetailImageAttachment[]) {
    commitValue(serializeTodoDetailContent(nextText, nextImages))
  }

  function updateTodoText(nextText: string) {
    const latestImages = parseTodoDetailContent(latestValueRef.current).images
    updateTodoDetail(nextText, latestImages)
  }

  async function handlePasteImages(imageFiles: File[]) {
    await uploadImagesIntoTodoDetail(
      imageFiles,
      () => latestValueRef.current,
      commitValue,
      setUploadingImageSrcs,
    )
  }

  return (
    <div className={editorClassName}>
      <div className="todo-detail-composer">
        {images.length > 0 ? (
          <div className="todo-detail-attachments" aria-label={`已插入 ${images.length} 张图片`}>
            {images.map((image, index) => {
              const uploading = uploadingImageSrcSet.has(image.src)
              return (
                <figure className="todo-detail-attachment" key={`${image.src.slice(0, 48)}-${index}`}>
                  <button
                    aria-label={`查看图片 ${index + 1}`}
                    className={uploading ? 'todo-detail-attachment-preview uploading' : 'todo-detail-attachment-preview'}
                    type="button"
                    disabled={uploading}
                    onClick={() => setPreviewImageIndex(index)}
                  >
                    <img src={image.src} alt={image.alt} loading="lazy" />
                    {uploading ? <span>上传中</span> : null}
                  </button>
                  <button
                    aria-label={`删除图片 ${index + 1}`}
                    className="todo-detail-attachment-remove"
                    type="button"
                    onClick={() => updateTodoDetail(
                      text,
                      images.filter((_, imageIndex) => imageIndex !== index),
                    )}
                  >
                    <X size={13} />
                  </button>
                </figure>
              )
            })}
          </div>
        ) : null}
        <TodoMarkdownEditorLoadBoundary>
          <MarkdownWysiwygEditor
            ariaLabel="待办详情"
            placeholder="补充背景、目标、交付标准，支持 Markdown 和直接粘贴图片。"
            value={text}
            onChange={updateTodoText}
            onPasteImages={(files) => {
              void handlePasteImages(files)
            }}
          />
        </TodoMarkdownEditorLoadBoundary>
      </div>
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => {
        if (!open) setPreviewImageIndex(null)
      }}>
        <DialogContent className="todo-detail-image-preview-dialog" showCloseButton={false}>
          <DialogTitle className="todo-detail-image-preview-title">图片预览</DialogTitle>
          {previewImage ? (
            <div className="todo-detail-image-preview-shell">
              <img
                className="todo-detail-image-preview"
                src={previewImage.src}
                alt={previewImage.alt}
              />
              <button
                aria-label="关闭图片预览"
                className="todo-detail-image-preview-close"
                type="button"
                onClick={() => setPreviewImageIndex(null)}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TodoDetailViewer({
  value,
}: {
  value: string
}) {
  const { images, text } = useMemo(() => parseTodoDetailContent(value), [value])
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const previewImage = previewImageIndex == null ? null : images[previewImageIndex] ?? null

  useEffect(() => {
    if (previewImageIndex != null && !images[previewImageIndex]) {
      setPreviewImageIndex(null)
    }
  }, [images, previewImageIndex])

  return (
    <div className="todo-detail-viewer">
      {text.trim() ? (
        <MarkdownPreview content={text} />
      ) : null}
      {images.length > 0 ? (
        <div className="todo-detail-viewer-attachments" aria-label={`待办详情包含 ${images.length} 张图片`}>
          {images.map((image, index) => (
            <figure className="todo-detail-viewer-attachment" key={`${image.src.slice(0, 48)}-${index}`}>
              <button
                aria-label={`查看图片 ${index + 1}`}
                className="todo-detail-attachment-preview"
                type="button"
                onClick={() => setPreviewImageIndex(index)}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => {
        if (!open) setPreviewImageIndex(null)
      }}>
        <DialogContent className="todo-detail-image-preview-dialog" showCloseButton={false}>
          <DialogTitle className="todo-detail-image-preview-title">图片预览</DialogTitle>
          {previewImage ? (
            <div className="todo-detail-image-preview-shell">
              <img
                className="todo-detail-image-preview"
                src={previewImage.src}
                alt={previewImage.alt}
              />
              <button
                aria-label="关闭图片预览"
                className="todo-detail-image-preview-close"
                type="button"
                onClick={() => setPreviewImageIndex(null)}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TodoNoteComposer({
  action,
  members,
  onChange,
  placeholder,
  value,
}: {
  action?: ReactNode
  members?: Array<{ id: number; name: string }>
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  const { images, text } = useMemo(() => parseTodoDetailContent(value), [value])
  const [textDraft, setTextDraft] = useState(text)
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const [uploadingImageSrcs, setUploadingImageSrcs] = useState<string[]>([])
  const lastSerializedValueRef = useRef<string | null>(null)
  const latestValueRef = useRef(value)
  const previewImage = previewImageIndex == null ? null : images[previewImageIndex] ?? null
  const uploadingImageSrcSet = useMemo(() => new Set(uploadingImageSrcs), [uploadingImageSrcs])

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    if (lastSerializedValueRef.current === value) return
    setTextDraft(text)
  }, [text, value])

  useEffect(() => {
    if (previewImageIndex != null && !images[previewImageIndex]) {
      setPreviewImageIndex(null)
    }
  }, [images, previewImageIndex])

  function commitValue(nextValue: string) {
    latestValueRef.current = nextValue
    lastSerializedValueRef.current = nextValue
    onChange(nextValue)
  }

  function updateNoteContent(nextText: string, nextImages: TodoDetailImageAttachment[]) {
    commitValue(serializeTodoDetailContent(nextText, nextImages))
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    await pasteImagesIntoTodoDetail(
      event,
      () => latestValueRef.current,
      commitValue,
      setUploadingImageSrcs,
    )
  }

  return (
    <div className={images.length > 0 ? 'todo-note-composer has-images' : 'todo-note-composer'}>
      <div className="todo-detail-composer todo-note-composer-surface">
        {images.length > 0 ? (
          <div className="todo-detail-attachments" aria-label={`已插入 ${images.length} 张图片`}>
            {images.map((image, index) => {
              const uploading = uploadingImageSrcSet.has(image.src)
              return (
                <figure className="todo-detail-attachment" key={`${image.src.slice(0, 48)}-${index}`}>
                  <button
                    aria-label={`查看图片 ${index + 1}`}
                    className={uploading ? 'todo-detail-attachment-preview uploading' : 'todo-detail-attachment-preview'}
                    type="button"
                    disabled={uploading}
                    onClick={() => setPreviewImageIndex(index)}
                  >
                    <img src={image.src} alt={image.alt} loading="lazy" />
                    {uploading ? <span>上传中</span> : null}
                  </button>
                  <button
                    aria-label={`删除图片 ${index + 1}`}
                    className="todo-detail-attachment-remove"
                    type="button"
                    onClick={() => updateNoteContent(
                      textDraft,
                      images.filter((_, imageIndex) => imageIndex !== index),
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
          className="todo-note-composer-textarea"
          members={members}
          placeholder={placeholder}
          value={textDraft}
          onChange={(nextText) => {
            setTextDraft(nextText)
            updateNoteContent(nextText, images)
          }}
          onPaste={(event) => {
            void handlePaste(event)
          }}
        />
        {action}
      </div>
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => {
        if (!open) setPreviewImageIndex(null)
      }}>
        <DialogContent className="todo-detail-image-preview-dialog" showCloseButton={false}>
          <DialogTitle className="todo-detail-image-preview-title">图片预览</DialogTitle>
          {previewImage ? (
            <div className="todo-detail-image-preview-shell">
              <img
                className="todo-detail-image-preview"
                src={previewImage.src}
                alt={previewImage.alt}
              />
              <button
                aria-label="关闭图片预览"
                className="todo-detail-image-preview-close"
                type="button"
                onClick={() => setPreviewImageIndex(null)}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TodoNoteContent({ value }: { value: string }) {
  const { images, text } = useMemo(() => parseTodoDetailContent(value), [value])
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const previewImage = previewImageIndex == null ? null : images[previewImageIndex] ?? null

  useEffect(() => {
    if (previewImageIndex != null && !images[previewImageIndex]) {
      setPreviewImageIndex(null)
    }
  }, [images, previewImageIndex])

  return (
    <div className="todo-note-content">
      {text.trim() ? <p>{text}</p> : null}
      {images.length > 0 ? (
        <div className="todo-detail-viewer-attachments todo-note-attachments" aria-label={`备注包含 ${images.length} 张图片`}>
          {images.map((image, index) => (
            <figure className="todo-detail-viewer-attachment" key={`${image.src.slice(0, 48)}-${index}`}>
              <button
                aria-label={`查看图片 ${index + 1}`}
                className="todo-detail-attachment-preview"
                type="button"
                onClick={() => setPreviewImageIndex(index)}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => {
        if (!open) setPreviewImageIndex(null)
      }}>
        <DialogContent className="todo-detail-image-preview-dialog" showCloseButton={false}>
          <DialogTitle className="todo-detail-image-preview-title">图片预览</DialogTitle>
          {previewImage ? (
            <div className="todo-detail-image-preview-shell">
              <img
                className="todo-detail-image-preview"
                src={previewImage.src}
                alt={previewImage.alt}
              />
              <button
                aria-label="关闭图片预览"
                className="todo-detail-image-preview-close"
                type="button"
                onClick={() => setPreviewImageIndex(null)}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MentionInputShell({
  inputProps,
  members = [],
  multiline = false,
  onChange,
  value,
}: {
  inputProps: Record<string, unknown>
  members?: Array<{ id: number; name: string }>
  multiline?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [mentionRange, setMentionRange] = useState<{ caret: number; index: number } | null>(null)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 260 })
  const shellRef = useRef<HTMLSpanElement | null>(null)
  const mentionMembers = useMemo(() => {
    const seen = new Set<string>()
    return members
      .filter((member) => {
        const key = member.name.trim()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: '项目成员',
      }))
  }, [members])
  const canMention = mentionMembers.length > 0
  const shouldShow = open && canMention

  function updateMentionMenu(
    element: HTMLInputElement | HTMLTextAreaElement,
    nextValue: string,
  ) {
    const caret = element.selectionStart ?? nextValue.length
    const mentionIndex = nextValue.slice(0, caret).endsWith('@') ? caret - 1 : -1
    const active = mentionIndex >= 0
    setOpen(active)
    setMentionRange(active ? { caret, index: mentionIndex } : null)
    if (active) {
      const relativePosition = getCaretMenuPosition(element, shellRef.current, caret, nextValue)
      setMenuPosition(
        getFloatingMentionMenuPosition(element, shellRef.current, relativePosition, mentionMembers.length),
      )
    }
  }

  function updateValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    nextValue: string,
  ) {
    onChange(nextValue)
    updateMentionMenu(element, nextValue)
  }

  function chooseMember(member: MentionOption) {
    const range = mentionRange
    const nextValue = range
      ? `${value.slice(0, range.index)}@${member.name} ${value.slice(range.caret)}`
      : `${value}@${member.name} `
    onChange(nextValue)
    setOpen(false)
    setMentionRange(null)
  }

  const mentionMenu = shouldShow ? (
    <span
      className="mention-menu mention-menu-floating"
      style={{
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width,
      } satisfies CSSProperties}
    >
      {mentionMembers.map((member) => (
        <button
          className="mention-option"
          key={member.id}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            chooseMember(member)
          }}
        >
          <strong>@{member.name}</strong>
          <small>{member.role}</small>
        </button>
      ))}
    </span>
  ) : null

  return (
    <span className="mention-input-shell" ref={shellRef}>
      {multiline ? (
        <Textarea
          {...(inputProps as ComponentProps<typeof Textarea>)}
          value={value}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => updateValue(event.currentTarget, event.target.value)}
          onFocus={(event) => updateMentionMenu(event.currentTarget, value)}
        />
      ) : (
        <Input
          {...(inputProps as ComponentProps<typeof Input>)}
          value={value}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => updateValue(event.currentTarget, event.target.value)}
          onFocus={(event) => updateMentionMenu(event.currentTarget, value)}
        />
      )}
      {mentionMenu && typeof document !== 'undefined'
        ? createPortal(mentionMenu, document.body)
        : mentionMenu}
    </span>
  )
}

function getCaretMenuPosition(
  element: HTMLInputElement | HTMLTextAreaElement,
  shell: HTMLSpanElement | null,
  caret: number,
  value: string,
) {
  if (!shell || typeof document === 'undefined') return { left: 0, top: 0 }

  const style = window.getComputedStyle(element)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const shellRect = shell.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.3 ||
    18

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.left = '-9999px'
  mirror.style.top = '0'
  mirror.style.boxSizing = style.boxSizing
  mirror.style.width = `${element.clientWidth}px`
  mirror.style.padding = style.padding
  mirror.style.border = style.border
  mirror.style.font = style.font
  mirror.style.letterSpacing = style.letterSpacing
  mirror.style.textTransform = style.textTransform
  mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre'
  mirror.style.overflowWrap = element instanceof HTMLTextAreaElement ? 'break-word' : 'normal'
  mirror.textContent = value.slice(0, caret)
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const left =
    elementRect.left - shellRect.left + marker.offsetLeft - element.scrollLeft
  const top =
    elementRect.top - shellRect.top + marker.offsetTop - element.scrollTop + lineHeight + 4
  document.body.removeChild(mirror)

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
  }
}

function getFloatingMentionMenuPosition(
  element: HTMLInputElement | HTMLTextAreaElement,
  shell: HTMLSpanElement | null,
  relativePosition: { left: number; top: number },
  optionCount: number,
) {
  if (!shell || typeof window === 'undefined') {
    return { left: relativePosition.left, top: relativePosition.top, width: 260 }
  }

  const viewportMargin = 8
  const shellRect = shell.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.3 ||
    18
  const menuWidth = Math.min(260, Math.max(120, shellRect.width || 260))
  const estimatedMenuHeight = Math.min(220, Math.max(46, optionCount * 46 + 12))
  const preferredLeft = shellRect.left + relativePosition.left
  const preferredTop = shellRect.top + relativePosition.top
  const maxLeft = Math.max(viewportMargin, window.innerWidth - menuWidth - viewportMargin)
  const shouldFlipUp = preferredTop + estimatedMenuHeight > window.innerHeight - viewportMargin
  const flippedTop = preferredTop - estimatedMenuHeight - lineHeight - 8
  const maxTop = Math.max(viewportMargin, window.innerHeight - estimatedMenuHeight - viewportMargin)

  return {
    left: Math.min(Math.max(viewportMargin, preferredLeft), maxLeft),
    top: Math.min(Math.max(viewportMargin, shouldFlipUp ? flippedTop : preferredTop), maxTop),
    width: menuWidth,
  }
}

function getProjectAssignableUsers(project: Project, memberships: ProjectMembership[]) {
  const users = new Map<number, string>()
  users.set(project.ownerUserId, `${project.ownerName}（Owner）`)
  memberships
    .filter(
      (membership) =>
        membership.projectId === project.id &&
        membership.status === 'active' &&
        membership.invitedUserId,
    )
    .forEach((membership) => {
      users.set(membership.invitedUserId!, membership.memberName)
    })
  return Array.from(users, ([id, name]) => ({ id, name }))
}

function dedupeMentionMembers(members: Array<{ id: number; name: string }>) {
  const seen = new Set<string>()
  return members.filter((member) => {
    const key = member.name.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getProjectMentionOptions(
  projectId: number | undefined,
  projects: Project[],
  memberships: ProjectMembership[],
) {
  if (!projectId) return []
  const project = projects.find((item) => item.id === projectId)
  if (!project) return []
  return dedupeMentionMembers(getProjectAssignableUsers(project, memberships))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripTodoMentions(value: string, mentionOptions: Array<{ name: string }>) {
  return mentionOptions.reduce((current, option) => {
    const name = option.name.trim()
    if (!name) return current
    return current.replace(new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=\\s|$)`, 'g'), '$1')
  }, value).replace(/\s{2,}/g, ' ')
}

function ProjectMemberPicker({
  compact = false,
  disabled = false,
  emptyLabel = '未指派',
  label = '待办指派对象',
  members,
  onChange,
  value,
}: {
  compact?: boolean
  disabled?: boolean
  emptyLabel?: string
  label?: string
  members: Array<{ id: number; name: string }>
  onChange: (id: number | null) => void
  value: number | null
}) {
  const selectedMember = members.find((member) => member.id === value)
  return (
    <span className={compact ? 'member-picker compact' : 'member-picker'}>
      <Select
        disabled={disabled}
        value={value ? String(value) : 'none'}
        onValueChange={(nextValue) =>
          onChange(nextValue === 'none' ? null : Number(nextValue))
        }
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="选择成员">
            {compact && selectedMember
              ? `@${selectedMember.name}`
              : compact
                ? emptyLabel
                : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{emptyLabel}</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={String(member.id)}>
              @{member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  )
}

function ProjectMemberMultiPicker({
  disabled = false,
  emptyLabel = '未关注',
  label = '待办关注人',
  members,
  onChange,
  values,
}: {
  disabled?: boolean
  emptyLabel?: string
  label?: string
  members: Array<{ id: number; name: string }>
  onChange: (ids: number[]) => void
  values: number[]
}) {
  const selectedIds = normalizeNumberArray(values)
  const selectedIdSet = new Set(selectedIds)
  const selectedMembers = members.filter((member) => selectedIdSet.has(member.id))
  const selectedLabel = selectedMembers.length === 0
    ? emptyLabel
    : selectedMembers.length <= 3
      ? selectedMembers.map((member) => `@${member.name}`).join('、')
      : `${selectedMembers.slice(0, 3).map((member) => `@${member.name}`).join('、')} 等 ${selectedMembers.length} 人`

  function toggleMember(memberId: number) {
    const nextIds = selectedIdSet.has(memberId)
      ? selectedIds.filter((id) => id !== memberId)
      : [...selectedIds, memberId]
    onChange(nextIds)
  }

  return (
    <span className="member-picker member-multi-picker">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={label}
            className="member-multi-trigger"
            disabled={disabled}
            type="button"
            variant="outline"
          >
            <span>{selectedLabel}</span>
            <CaretDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="member-multi-menu">
          <DropdownMenuItem
            className={selectedMembers.length === 0 ? 'member-multi-item selected' : 'member-multi-item'}
            onSelect={(event) => {
              event.preventDefault()
              onChange([])
            }}
          >
            <span className="member-multi-check">{selectedMembers.length === 0 ? <Check size={14} /> : null}</span>
            {emptyLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {members.map((member) => {
            const selected = selectedIdSet.has(member.id)
            return (
              <DropdownMenuItem
                className={selected ? 'member-multi-item selected' : 'member-multi-item'}
                key={member.id}
                onSelect={(event) => {
                  event.preventDefault()
                  toggleMember(member.id)
                }}
              >
                <span className="member-multi-check">{selected ? <Check size={14} /> : null}</span>
                @{member.name}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

function ProjectModulePicker({
  canCreate = false,
  compact = false,
  disabled = false,
  modules,
  onChange,
  onCreate,
  value,
}: {
  canCreate?: boolean
  compact?: boolean
  disabled?: boolean
  modules: ProjectModule[]
  onChange: (id: number | null) => void
  onCreate?: (name: string) => Promise<ProjectModule | null>
  value: number | null
}) {
  const [selectOpen, setSelectOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const selectedModule = modules.find((module) => module.id === value)
  const createModuleValue = '__create_module__'

  async function createInlineModule() {
    const nextName = moduleName.trim()
    if (!nextName || !onCreate || creating) return
    const existingModule = modules.find((module) => module.name === nextName)
    if (existingModule) {
      onChange(existingModule.id)
      setModuleName('')
      setCreateError('')
      setCreateOpen(false)
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      const createdModule = await onCreate(nextName)
      if (!createdModule) {
        setCreateError('模块创建失败，请重试。')
        return
      }
      onChange(createdModule.id)
      setModuleName('')
      setCreateOpen(false)
    } catch {
      setCreateError('模块创建失败，请重试。')
    } finally {
      setCreating(false)
    }
  }

  function selectModule(nextValue: string) {
    if (nextValue === createModuleValue) {
      setSelectOpen(false)
      setCreateOpen(true)
      setCreateError('')
      return
    }
    onChange(nextValue === 'none' ? null : Number(nextValue))
    setCreateOpen(false)
    setModuleName('')
    setCreateError('')
  }

  return (
    <span className={compact ? 'member-picker compact' : 'member-picker project-module-picker'}>
      <Select
        disabled={disabled}
        open={selectOpen}
        value={value ? String(value) : 'none'}
        onOpenChange={(open) => {
          setSelectOpen(open)
          if (open) {
            setCreateOpen(false)
            setModuleName('')
            setCreateError('')
          }
        }}
        onValueChange={selectModule}
      >
        <SelectTrigger aria-label="待办所属模块">
          <SelectValue placeholder="选择模块">
            {compact && selectedModule ? selectedModule.name : compact ? '无模块' : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {canCreate && onCreate ? (
            <>
              <SelectItem className="project-module-create-option" value={createModuleValue}>
                <span><Plus size={15} /> 新增模块</span>
              </SelectItem>
              <SelectSeparator />
            </>
          ) : null}
          <SelectItem value="none">无模块</SelectItem>
          {modules.map((module) => (
            <SelectItem key={module.id} value={String(module.id)}>
              {module.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canCreate && onCreate && createOpen ? (
        <span className="project-module-inline-create">
          <Input
            autoFocus
            aria-invalid={Boolean(createError)}
            aria-label="新模块名称"
            disabled={creating}
            maxLength={40}
            placeholder="输入模块名称"
            value={moduleName}
            onChange={(event) => {
              setModuleName(event.target.value)
              if (createError) setCreateError('')
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Enter') {
                event.preventDefault()
                void createInlineModule()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setCreateOpen(false)
                setModuleName('')
                setCreateError('')
              }
            }}
          />
          <Button
            className="project-module-inline-submit"
            type="button"
            disabled={!moduleName.trim() || creating}
            onClick={() => void createInlineModule()}
          >
            <Plus size={14} />
            {creating ? '新增中' : '新增'}
          </Button>
          <Button
            className="project-module-inline-cancel"
            type="button"
            variant="outline"
            aria-label="取消新增模块"
            title="取消新增模块"
            disabled={creating}
            onClick={() => {
              setCreateOpen(false)
              setModuleName('')
              setCreateError('')
            }}
          >
            <X size={14} />
          </Button>
          {createError ? <small role="alert">{createError}</small> : null}
        </span>
      ) : null}
    </span>
  )
}

function InboxView({
  archiveInboxItem,
  memberships,
  inbox,
  inboxDraft,
  onAddInboxItem,
  onDeleteInboxItem,
  onDraftChange,
  projects,
}: {
  archiveInboxItem: (item: InboxItem, projectId: number) => void
  memberships: ProjectMembership[]
  inbox: InboxItem[]
  inboxDraft: string
  onAddInboxItem: () => void
  onDeleteInboxItem: (itemId: number) => void
  onDraftChange: (value: string) => void
  projects: Project[]
}) {
  const [isComposing, setIsComposing] = useState(false)
  const mentionMembers = useMemo(
    () => dedupeMentionMembers(projects.flatMap((project) => getProjectAssignableUsers(project, memberships))),
    [memberships, projects],
  )

  function handleInboxKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      isComposing ||
      nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    onAddInboxItem()
  }

  return (
    <div className="inbox-layout">
      <Card className="panel capture-panel">
        <PanelTitle icon={<Tray size={18} />} title="快速捕捉" />
        <Label className="textarea-label capture-textarea-label">
          新线索
          <span className="capture-input-wrap">
            <MentionTextarea
              members={mentionMembers}
              placeholder="把会议记录、聊天片段、想法或解决方案先丢进来..."
              value={inboxDraft}
              onChange={onDraftChange}
              onCompositionEnd={() => setIsComposing(false)}
              onCompositionStart={() => setIsComposing(true)}
              onKeyDown={handleInboxKeyDown}
            />
            <Button className="solid-button capture-submit-button" type="button" onClick={onAddInboxItem}>
              <PaperPlaneTilt size={17} /> 放入今日草稿箱
            </Button>
          </span>
        </Label>
      </Card>

      <Card className="panel inbox-list-panel">
      <PanelTitle icon={<Archive size={18} />} title="待归档内容" />
        <div className="inbox-list">
          {inbox.map((item) => {
            const isAiAnalyzing = item.content.includes('AI 分析中')
            const isTodoDraft = item.itemType === 'todo'
            return (
              <article
                className={
                  item.processed
                    ? 'inbox-item processed'
                    : isAiAnalyzing
                      ? 'inbox-item is-ai-analyzing'
                      : 'inbox-item'
                }
                key={item.id}
              >
                <div className="inbox-meta">
                  <span>
                    {isTodoDraft
                      ? 'AI 待办草稿'
                      : item.source === 'feishu'
                        ? '飞书转发'
                        : '手动记录'}
                  </span>
                  <span className="inbox-meta-right">
                    {isAiAnalyzing && <Badge className="ai-analyzing-badge">AI 分析中</Badge>}
                    <span>{item.createdAt}</span>
                  </span>
                </div>
                {isTodoDraft ? (
                  <div className="inbox-todo-draft">
                    <strong>{item.todoTitle}</strong>
                    <div className="inbox-todo-draft-meta">
                      <span>项目：待确认</span>
                      <span>截止：{item.todoDueDate}</span>
                      <span>优先级：{item.todoPriority ? priorityCopy[item.todoPriority] : '中'}</span>
                    </div>
                    {item.content ? <MarkdownPreview content={item.content} compact /> : null}
                  </div>
                ) : (
                  <MarkdownPreview content={item.content} compact />
                )}
                {!item.processed && (
                  <ArchiveControl
                    item={item}
                    projects={projects}
                    onArchive={archiveInboxItem}
                    onDelete={onDeleteInboxItem}
                  />
                )}
              </article>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function ArchiveControl({
  item,
  onArchive,
  onDelete,
  projects,
}: {
  item: InboxItem
  onArchive: (item: InboxItem, projectId: number) => void
  onDelete: (itemId: number) => void
  projects: Project[]
}) {
  const suggestedProjectExists = projects.some(
    (project) => project.id === item.suggestedProjectId,
  )
  const defaultProjectId =
    suggestedProjectExists && item.suggestedProjectId
      ? item.suggestedProjectId
      : projects[0]?.id
  const [selectedProjectId, setSelectedProjectId] = useState(
    String(defaultProjectId ?? ''),
  )

  if (projects.length === 0) {
    return (
      <div className="archive-control empty">
        <p className="empty-state">
          {item.itemType === 'todo' ? '先创建项目后再创建待办。' : '先创建项目后再归档。'}
        </p>
        <ConfirmDialog
          confirmLabel="删除草稿"
          description="删除后，这条待归档内容会从今日草稿箱移除。"
          onConfirm={() => onDelete(item.id)}
          title="确认删除这条草稿？"
          trigger={
            <Button
              className="archive-delete-button"
              variant="ghost"
              type="button"
            >
              <Trash size={14} /> 删除
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="archive-control">
      <Label>
        {item.itemType === 'todo' ? '归属项目' : '归档项目'}
        <Select
          value={selectedProjectId}
          onValueChange={setSelectedProjectId}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Button
        className="archive-confirm-button"
        type="button"
        disabled={!selectedProjectId}
        onClick={() => onArchive(item, Number(selectedProjectId))}
      >
        {item.itemType === 'todo' ? '创建待办' : '确认归档'}
      </Button>
      <ConfirmDialog
        confirmLabel="删除草稿"
        description="删除后，这条待归档内容会从今日草稿箱移除。"
        onConfirm={() => onDelete(item.id)}
        title="确认删除这条草稿？"
        trigger={
          <Button
            className="archive-delete-button"
            variant="ghost"
            type="button"
          >
            <Trash size={14} /> 删除
          </Button>
        }
      />
    </div>
  )
}

function SearchView({
  allTags,
  exportMarkdown,
  filteredResults,
  generateSummary,
  onDeleteProject,
  onEditProjectDescription,
  onProjectClick,
  onRenameProject,
  onSearchChange,
  onStatusChange,
  onTagChange,
  onUpdateProjectStatus,
  search,
  statusFilter,
  tagFilter,
}: {
  allTags: string[]
  exportMarkdown: (projectId?: number) => Promise<void>
  filteredResults: Project[]
  generateSummary: (projectId: number, type: SummaryPeriodType) => Promise<boolean>
  onDeleteProject: (projectId: number) => void
  onEditProjectDescription: (projectId: number, description: string) => void
  onProjectClick: (id: number) => void
  onRenameProject: (projectId: number, name: string) => void
  onSearchChange: (value: string) => void
  onStatusChange: (value: ProjectStatus | 'all') => void
  onTagChange: (value: string) => void
  onUpdateProjectStatus: (projectId: number, status: ProjectStatus) => void
  search: string
  statusFilter: ProjectStatus | 'all'
  tagFilter: string
}) {
  const [renamingProject, setRenamingProject] = useState<Project | null>(null)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [editingDescriptionProject, setEditingDescriptionProject] = useState<Project | null>(null)
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState('')
  const [transferringProject, setTransferringProject] = useState<Project | null>(null)
  const [transferOrganizations, setTransferOrganizations] = useState<OrganizationListItem[]>([])
  const [transferOrganizationId, setTransferOrganizationId] = useState('')
  const [transferCandidates, setTransferCandidates] = useState<OrganizationMember[]>([])
  const [transferTargetUserId, setTransferTargetUserId] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferSuccess, setTransferSuccess] = useState('')
  const transferLoadRequestIdRef = useRef(0)

  function openRenameDialog(project: Project) {
    setProjectNameDraft(project.name)
    setRenamingProject(project)
  }

  function openDescriptionDialog(project: Project) {
    setProjectDescriptionDraft(project.description)
    setEditingDescriptionProject(project)
  }

  async function loadTransferOrganizationMembers(project: Project, organizationId: number) {
    setTransferOrganizationId(String(organizationId))
    setTransferCandidates([])
    setTransferTargetUserId('')
    setTransferError('')
    setTransferSuccess('')
    const requestId = transferLoadRequestIdRef.current + 1
    transferLoadRequestIdRef.current = requestId
    setTransferLoading(true)
    try {
      const organization = await fetchOrganization(organizationId)
      if (transferLoadRequestIdRef.current !== requestId) return
      const candidates = organization.members.filter((member) => member.id !== project.ownerUserId)
      setTransferCandidates(candidates)
      setTransferTargetUserId(candidates[0] ? String(candidates[0].id) : '')
      setTransferError(candidates.length ? '' : '这个组织中没有可接收项目的其他成员。')
    } catch (error) {
      if (transferLoadRequestIdRef.current !== requestId) return
      setTransferError(formatApiErrorDiagnostic(error, '组织成员加载失败，请稍后重试。'))
    } finally {
      if (transferLoadRequestIdRef.current === requestId) setTransferLoading(false)
    }
  }

  async function openTransferDialog(project: Project) {
    setTransferringProject(project)
    setTransferOrganizations([])
    setTransferOrganizationId('')
    setTransferCandidates([])
    setTransferTargetUserId('')
    setTransferError('')
    setTransferSuccess('')
    const requestId = transferLoadRequestIdRef.current + 1
    transferLoadRequestIdRef.current = requestId
    setTransferLoading(true)
    try {
      const result = await fetchOrganizations()
      if (transferLoadRequestIdRef.current !== requestId) return
      const organizations = result.organizations.filter(
        (organization) => Number.isSafeInteger(organization.id) && organization.id > 0,
      )
      setTransferOrganizations(organizations)
      if (organizations.length === 0) {
        setTransferError('你当前未加入任何组织，无法转移项目。')
        return
      }
      const organization = organizations.find((item) => item.id === project.organizationId)
        ?? organizations[0]
      await loadTransferOrganizationMembers(project, organization.id)
    } catch (error) {
      if (transferLoadRequestIdRef.current !== requestId) return
      setTransferError(formatApiErrorDiagnostic(error, '共同组织加载失败，请稍后重试。'))
    } finally {
      if (transferLoadRequestIdRef.current === requestId) setTransferLoading(false)
    }
  }

  async function submitProjectTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transferringProject || !transferOrganizationId || !transferTargetUserId) return
    const organizationId = Number(transferOrganizationId)
    const targetUserId = Number(transferTargetUserId)
    if (
      !Number.isSafeInteger(organizationId) || organizationId <= 0 ||
      !Number.isSafeInteger(targetUserId) || targetUserId <= 0
    ) return
    const target = transferCandidates.find((member) => member.id === targetUserId)
    setTransferSubmitting(true)
    setTransferError('')
    setTransferSuccess('')
    try {
      await requestProjectTransfer(transferringProject.id, { organizationId, targetUserId })
      setTransferSuccess(
        target
          ? `已向 ${target.displayName} 发送项目转移申请，对方可在通知中心确认。`
          : '已发送项目转移申请，对方可在通知中心确认。',
      )
    } catch (error) {
      setTransferError(formatApiErrorDiagnostic(error, '项目转移申请发送失败，请稍后重试。'))
    } finally {
      setTransferSubmitting(false)
    }
  }

  function closeTransferDialog(open: boolean) {
    if (open) return
    transferLoadRequestIdRef.current += 1
    setTransferringProject(null)
    setTransferOrganizations([])
    setTransferOrganizationId('')
    setTransferCandidates([])
    setTransferTargetUserId('')
    setTransferLoading(false)
    setTransferSubmitting(false)
    setTransferError('')
    setTransferSuccess('')
  }

  return (
    <Card className="panel search-panel">
      <div className="search-controls">
        <Label className="search-field">
          <span>关键词</span>
          <span className="search-input-wrap">
            <MagnifyingGlass size={16} />
            <Input
              placeholder="搜索项目、简介、日记、待办、总结..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </span>
        </Label>
        <Label>
          状态
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusChange(value as ProjectStatus | 'all')}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="paused">暂停</SelectItem>
              <SelectItem value="completed">已结束</SelectItem>
              <SelectItem value="archived">归档</SelectItem>
            </SelectContent>
          </Select>
        </Label>
        <Label>
          标签
          <Select value={tagFilter} onValueChange={onTagChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择标签" />
            </SelectTrigger>
            <SelectContent>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
      </div>
      <div className="search-results">
        {filteredResults.map((project) => (
          <article key={project.id} className="result-item">
            <button className="result-main" type="button" onClick={() => onProjectClick(project.id)}>
              <div>
                <div className="result-meta-row">
                  <Badge className={`status-pill ${project.status}`}>
                    {statusCopy[project.status]}
                  </Badge>
                  {project.accessRole === 'member' && (
                    <Badge className="access-pill">{project.readOnly ? '组织只读' : '协作'}</Badge>
                  )}
                  <span>创建于 {project.createdAt}</span>
                </div>
                <div className="result-title-row">
                  <h3>{project.name}</h3>
                  <ProjectTags tags={project.tags} compact />
                </div>
                {project.description.trim() ? <p>{project.description}</p> : null}
              </div>
            </button>
            {project.accessRole === 'owner' && (
              <div className="result-actions">
                <div className="project-status-control result-status-control">
                  <span>项目状态</span>
                  <Select
                    value={project.status}
                    onValueChange={(value) =>
                      onUpdateProjectStatus(project.id, value as ProjectStatus)
                    }
                  >
                    <SelectTrigger aria-label={`修改「${project.name}」项目状态`}>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">进行中</SelectItem>
                      <SelectItem value="paused">暂停</SelectItem>
                      <SelectItem value="completed">已结束</SelectItem>
                      <SelectItem value="archived">归档</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ProjectActionsMenu
                  exportProject={() => void exportMarkdown(project.id)}
                  generateDailySummary={() => void generateSummary(project.id, 'daily')}
                  generateWeeklySummary={() => generateSummary(project.id, 'weekly')}
                  onDeleteProject={() => onDeleteProject(project.id)}
                  onEditDescriptionClick={() => openDescriptionDialog(project)}
                  onRenameClick={() => openRenameDialog(project)}
                  onTransferClick={() => void openTransferDialog(project)}
                  projectName={project.name}
                />
              </div>
            )}
          </article>
        ))}
      </div>
      <Dialog
        open={Boolean(renamingProject)}
        onOpenChange={(open) => {
          if (!open) setRenamingProject(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription>
              修改后会同步更新项目列表和当前详情页标题。
            </DialogDescription>
          </DialogHeader>
          <form
            className="new-project-dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!renamingProject) return
              onRenameProject(renamingProject.id, projectNameDraft)
              setRenamingProject(null)
            }}
          >
            <Label>
              项目名称
              <Input
                autoFocus
                required
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.target.value)}
              />
            </Label>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setRenamingProject(null)}
              >
                取消
              </Button>
              <Button type="submit">保存名称</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editingDescriptionProject)}
        onOpenChange={(open) => {
          if (!open) setEditingDescriptionProject(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目简介</DialogTitle>
            <DialogDescription>
              简介会展示在项目列表卡片中；留空保存后列表不显示简介。
            </DialogDescription>
          </DialogHeader>
          <form
            className="new-project-dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!editingDescriptionProject) return
              onEditProjectDescription(editingDescriptionProject.id, projectDescriptionDraft)
              setEditingDescriptionProject(null)
            }}
          >
            <Label>
              项目简介
              <Textarea
                autoFocus
                rows={4}
                value={projectDescriptionDraft}
                onChange={(event) => setProjectDescriptionDraft(event.target.value)}
                placeholder="补充项目背景、目标或当前说明，可留空"
              />
            </Label>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingDescriptionProject(null)}
              >
                取消
              </Button>
              <Button type="submit">保存简介</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(transferringProject)}
        onOpenChange={closeTransferDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>项目转移</DialogTitle>
            <DialogDescription>
              选择你与新 Owner 共同加入的组织及成员。对方在通知中心同意后，项目归属权才会转移。
            </DialogDescription>
          </DialogHeader>
          <form className="new-project-dialog-form" onSubmit={(event) => void submitProjectTransfer(event)}>
            <Label>
              共同组织
              <Select
                value={transferOrganizationId}
                onValueChange={(value) => {
                  if (!transferringProject || !value.trim()) return
                  const organizationId = Number(value)
                  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) return
                  void loadTransferOrganizationMembers(transferringProject, organizationId)
                }}
                disabled={transferLoading || transferSubmitting || transferOrganizations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={transferLoading ? '正在加载组织...' : '选择共同组织'} />
                </SelectTrigger>
                <SelectContent>
                  {transferOrganizations.map((organization) => (
                    <SelectItem key={organization.id} value={String(organization.id)}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              新 Owner
              <Select
                value={transferTargetUserId}
                onValueChange={(value) => {
                  setTransferTargetUserId(value)
                  setTransferSuccess('')
                  setTransferError('')
                }}
                disabled={transferLoading || transferSubmitting || transferCandidates.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={transferLoading ? '正在加载组织成员...' : '选择成员'} />
                </SelectTrigger>
                <SelectContent>
                  {transferCandidates.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.displayName === member.username
                        ? member.displayName
                        : `${member.displayName}（${member.username}）`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            {transferError ? <p className="form-error" role="alert">{transferError}</p> : null}
            {transferSuccess ? <p className="form-success">{transferSuccess}</p> : null}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => closeTransferDialog(false)}
              >
                关闭
              </Button>
              <Button
                type="submit"
                disabled={
                  transferLoading ||
                  transferSubmitting ||
                  Boolean(transferSuccess) ||
                  !transferOrganizationId ||
                  !transferTargetUserId
                }
              >
                {transferSubmitting ? '发送中...' : '发送转移申请'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function VegesAiView({
  aiBusy,
  aiDraft,
  aiError,
  aiHistory,
  aiMessages,
  aiNextBeforeTurn,
  aiTurnsError,
  aiTurnsLoading,
  retryableAiTurnId,
  memberships,
  mobilePane,
  onAiDraftChange,
  onDeleteConversation,
  onExportWorkspace,
  onLoadEarlierTurns,
  onLoadHistory,
  onMobilePaneChange,
  onRenameConversation,
  onRequestedTodoBatchHandled,
  onResetAiChat,
  onRetryHistory,
  onRetryTurn,
  onSelectConversation,
  onSendAgentMessage,
  onSelectedProjectIdChange,
  onStopAiTurn,
  onWorkspace,
  projects,
  requestedTodoBatchId,
  sessionGeneration,
  selectedProjectId,
  summaries,
}: {
  aiBusy: boolean
  aiDraft: string
  aiError: string
  aiHistory: AiConversationHistoryState
  aiMessages: DisplayAiChatMessage[]
  aiNextBeforeTurn: number | null
  aiTurnsError: string
  aiTurnsLoading: boolean
  retryableAiTurnId: string | null
  memberships: ProjectMembership[]
  mobilePane: AiMobilePane
  onAiDraftChange: (value: string) => void
  onDeleteConversation: (conversationId: string) => Promise<void>
  onExportWorkspace: () => void
  onLoadEarlierTurns: () => Promise<void>
  onLoadHistory: (mode: 'initial' | 'more') => Promise<void>
  onMobilePaneChange: (pane: AiMobilePane) => void
  onRenameConversation: (conversationId: string, title: string) => Promise<void>
  onRequestedTodoBatchHandled: () => void
  onResetAiChat: () => Promise<void>
  onRetryHistory: () => Promise<void>
  onRetryTurn: (turnId: string) => Promise<AiTurnRunResponse | false>
  onSelectConversation: (conversation: AiConversationListItem) => Promise<void>
  onSendAgentMessage: (route: AiMessageRoute) => Promise<AiTurnRunResponse | false>
  onSelectedProjectIdChange: (projectId: number | null) => Promise<void>
  onStopAiTurn: () => Promise<void>
  onWorkspace: (workspace: WorkspaceData, sessionGeneration: number) => void
  projects: Project[]
  requestedTodoBatchId: number | null
  sessionGeneration: number
  selectedProjectId: number | null
  summaries: Summary[]
}) {
  const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null)
  const [isSummaryFullscreen, setIsSummaryFullscreen] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState('')
  const [projectMention, setProjectMention] = useState<{ end: number; start: number } | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [aiStatusLoading, setAiStatusLoading] = useState(true)
  const [aiStatusError, setAiStatusError] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [documentSavingTurnIds, setDocumentSavingTurnIds] = useState<Set<string>>(() => new Set())
  const [todoWorkflowBusy, setTodoWorkflowBusy] = useState(false)
  const [attachments, setAttachments] = useState<AiTextAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [attachmentReading, setAttachmentReading] = useState(false)
  const [intentClassifying, setIntentClassifying] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const attachmentReadRequestIdRef = useRef(0)
  const intentClassificationAbortControllerRef = useRef<AbortController | null>(null)
  const intentClassificationRequestIdRef = useRef(0)
  const composerRevisionRef = useRef(0)
  const documentRequestGenerationRef = useRef(0)
  const todoOutcomeRequestIdRef = useRef(0)
  const artifactsRef = useRef<HTMLDivElement>(null)
  const artifactsTriggerRef = useRef<HTMLButtonElement>(null)
  const historyRef = useRef<HTMLElement>(null)
  const historyTriggerRef = useRef<HTMLButtonElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const composerShellRef = useRef<HTMLDivElement>(null)
  const todoWorkflowRef = useRef<TodoProposalWorkflowHandle>(null)
  const selectedSummary =
    summaries.find((summary) => summary.id === selectedSummaryId) ?? null
  const documentIdBySourceTurn = useMemo(
    () => new Map(
      summaries.flatMap((summary) =>
        summary.sourceTurnId ? [[summary.sourceTurnId, summary.id] as const] : [],
      ),
    ),
    [summaries],
  )
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedDocumentProject = selectedSummary
    ? projects.find((project) => project.id === selectedSummary.projectId)
    : null
  const selectedDocumentOwner =
    selectedDocumentProject?.name ?? selectedSummary?.period ?? 'Veges AI'
  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLocaleLowerCase()
    if (!normalizedQuery) return projects
    return projects.filter((project) =>
      project.name.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [projectQuery, projects])
  const aiConfigured = Boolean(aiStatus?.configured)
  const workspaceBusy =
    aiBusy ||
    aiTurnsLoading ||
    attachmentReading ||
    intentClassifying ||
    documentSavingTurnIds.size > 0 ||
    todoWorkflowBusy
  const artifactsOpen = mobilePane === 'artifacts'
  const historyOpen = mobilePane === 'history'
  const auxiliaryOpen = artifactsOpen || historyOpen
  const documentFullscreen = isSummaryFullscreen && artifactsOpen
  const currentConversationId = currentAiConversationId(aiHistory.selection)
  const currentConversationIdRef = useRef(currentConversationId)
  const sessionGenerationRef = useRef(sessionGeneration)
  const currentConversation = aiHistory.conversations.find(
    (conversation) => conversation.id === currentConversationId,
  ) ?? null
  const currentConversationTitle = currentConversation?.title ?? (
    selectedProject ? `新对话 · ${selectedProject.name}` : '新对话'
  )

  useLayoutEffect(() => {
    if (
      currentConversationIdRef.current !== currentConversationId ||
      sessionGenerationRef.current !== sessionGeneration
    ) {
      documentRequestGenerationRef.current += 1
    }
    currentConversationIdRef.current = currentConversationId
    sessionGenerationRef.current = sessionGeneration
  }, [currentConversationId, sessionGeneration])

  const loadAiStatus = useCallback(async () => {
    setAiStatusLoading(true)
    setAiStatusError('')
    try {
      setAiStatus(await fetchAiStatus())
    } catch (error) {
      setAiStatus(null)
      setAiStatusError(
        error instanceof Error && error.message
          ? error.message
          : '无法读取系统 AI 状态。',
      )
    } finally {
      setAiStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAiStatus()
  }, [loadAiStatus])

  useEffect(() => () => {
    attachmentReadRequestIdRef.current += 1
    intentClassificationRequestIdRef.current += 1
    intentClassificationAbortControllerRef.current?.abort()
    intentClassificationAbortControllerRef.current = null
    todoOutcomeRequestIdRef.current += 1
  }, [])

  useEffect(() => {
    if (!artifactsOpen) return
    const frame = window.requestAnimationFrame(() => artifactsRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [artifactsOpen])

  useEffect(() => {
    if (!artifactsOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (documentFullscreen) {
          setIsSummaryFullscreen(false)
          return
        }
        onMobilePaneChange('workspace')
        window.requestAnimationFrame(() => artifactsTriggerRef.current?.focus())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [artifactsOpen, documentFullscreen, onMobilePaneChange])

  useEffect(() => {
    if (!historyOpen) return
    const frame = window.requestAnimationFrame(() => historyRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      onMobilePaneChange('workspace')
      window.requestAnimationFrame(() => historyTriggerRef.current?.focus())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [historyOpen, onMobilePaneChange])

  useEffect(() => {
    if (!projectPickerOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!composerShellRef.current?.contains(event.target as Node)) {
        setProjectPickerOpen(false)
        setProjectMention(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [projectPickerOpen])

  function openArtifacts() {
    setIsSummaryFullscreen(false)
    onMobilePaneChange('artifacts')
    window.requestAnimationFrame(() => artifactsRef.current?.focus())
  }

  async function convertReplyToDocument(message: DisplayAiChatMessage) {
    if (!currentConversationId || documentSavingTurnIds.has(message.turnId)) return
    const conversationId = currentConversationId
    const requestGeneration = documentRequestGenerationRef.current
    const requestSessionGeneration = sessionGeneration
    const isCurrentRequest = () =>
      documentRequestGenerationRef.current === requestGeneration &&
      currentConversationIdRef.current === conversationId &&
      sessionGenerationRef.current === requestSessionGeneration
    setGenerationError('')
    setDocumentSavingTurnIds((current) => new Set(current).add(message.turnId))
    try {
      const result = await createAiTurnDocument(conversationId, message.turnId)
      onWorkspace(result.workspace, requestSessionGeneration)
      if (!isCurrentRequest()) return
      setSelectedSummaryId(result.summaryId)
      openArtifacts()
    } catch (error) {
      if (!isCurrentRequest()) return
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : '无法将这条回复转为文档。',
      )
    } finally {
      setDocumentSavingTurnIds((current) => {
        const next = new Set(current)
        next.delete(message.turnId)
        return next
      })
    }
  }

  function closeArtifacts() {
    setIsSummaryFullscreen(false)
    onMobilePaneChange('workspace')
    window.requestAnimationFrame(() => artifactsTriggerRef.current?.focus())
  }

  function openHistory() {
    setIsSummaryFullscreen(false)
    onMobilePaneChange('history')
    window.requestAnimationFrame(() => historyRef.current?.focus())
  }

  function closeHistory() {
    onMobilePaneChange('workspace')
    window.requestAnimationFrame(() => historyTriggerRef.current?.focus())
  }

  async function openTodoProposalOutcome(batchId: number) {
    const requestId = todoOutcomeRequestIdRef.current + 1
    todoOutcomeRequestIdRef.current = requestId
    setGenerationError('')
    try {
      const result = await fetchTodoProposalBatch(batchId)
      if (todoOutcomeRequestIdRef.current !== requestId) return
      todoWorkflowRef.current?.openProposals(
        result.batchId,
        result.proposals,
        'AI 对话输入.md',
        result.status === 'confirmed' || result.status === 'discarded'
          ? result.status
          : 'pending',
      )
      return true
    } catch (error) {
      if (todoOutcomeRequestIdRef.current !== requestId) return
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : '无法读取这批待办候选。',
      )
      return false
    }
  }

  useEffect(() => {
    if (requestedTodoBatchId == null) return
    let cancelled = false
    void openTodoProposalOutcome(requestedTodoBatchId).finally(() => {
      if (!cancelled) onRequestedTodoBatchHandled()
    })
    return () => {
      cancelled = true
    }
  }, [onRequestedTodoBatchHandled, requestedTodoBatchId])

  async function retryTurn(turnId: string) {
    const result = await onRetryTurn(turnId)
    if (!result) return
    if (result.outcome?.type === 'todo-proposals') {
      await openTodoProposalOutcome(result.outcome.batchId)
    }
    if (result.outcome?.type === 'summary') {
      setSelectedSummaryId(result.outcome.summaryId)
      openArtifacts()
    }
  }

  function handleDraftChange(value: string, caret: number) {
    composerRevisionRef.current += 1
    onAiDraftChange(value)
    setGenerationError('')
    setAttachmentError('')
    const prefix = value.slice(0, caret)
    const match = prefix.match(/(?:^|\s)@([^\s@]*)$/)
    if (!match) {
      setProjectPickerOpen(false)
      setProjectMention(null)
      setProjectQuery('')
      return
    }

    const matchStart = match.index ?? 0
    const mentionStart = matchStart + match[0].lastIndexOf('@')
    setProjectMention({ end: caret, start: mentionStart })
    setProjectQuery(match[1])
    setProjectPickerOpen(true)
  }

  function cancelIntentClassification() {
    intentClassificationRequestIdRef.current += 1
    intentClassificationAbortControllerRef.current?.abort()
    intentClassificationAbortControllerRef.current = null
    setIntentClassifying(false)
  }

  function selectProjectContext(projectId: number) {
    let nextDraft = aiDraft
    if (projectMention) {
      nextDraft = `${aiDraft.slice(0, projectMention.start)}${aiDraft.slice(projectMention.end)}`
    }
    const shouldRestoreDraft = Boolean(projectMention) || selectedProjectId == null
    const isChangingProject = selectedProjectId != null && selectedProjectId !== projectId
    cancelIntentClassification()
    attachmentReadRequestIdRef.current += 1
    documentRequestGenerationRef.current += 1
    todoOutcomeRequestIdRef.current += 1
    setAttachmentReading(false)
    onSelectedProjectIdChange(projectId)
    if (shouldRestoreDraft) onAiDraftChange(nextDraft)
    if (isChangingProject) setAttachments([])
    setAttachmentError('')
    setGenerationError('')
    setProjectPickerOpen(false)
    setProjectMention(null)
    setProjectQuery('')
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  function removeProjectContext() {
    cancelIntentClassification()
    attachmentReadRequestIdRef.current += 1
    documentRequestGenerationRef.current += 1
    todoOutcomeRequestIdRef.current += 1
    setAttachmentReading(false)
    onSelectedProjectIdChange(null)
    setAttachments([])
    setAttachmentError('')
    setProjectPickerOpen(false)
    setProjectMention(null)
    setProjectQuery('')
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selectedFiles.length === 0) return

    if (attachments.length + selectedFiles.length > AI_ATTACHMENT_MAX_COUNT) {
      setAttachmentError(`最多添加 ${AI_ATTACHMENT_MAX_COUNT} 个附件。`)
      return
    }

    const requestId = attachmentReadRequestIdRef.current + 1
    attachmentReadRequestIdRef.current = requestId
    setAttachmentReading(true)
    const accepted: AiTextAttachment[] = []
    const rejected: string[] = []
    const duplicateKeys = new Set(
      attachments.map((attachment) => `${attachment.name}\u0000${attachment.size}`),
    )
    let characterCount = totalAttachmentCharacters(attachments)

    for (const file of selectedFiles) {
      const duplicateKey = `${file.name}\u0000${file.size}`
      if (duplicateKeys.has(duplicateKey)) {
        rejected.push(`${file.name} 已添加`)
        continue
      }
      if (!isSupportedAiAttachment(file.name, file.type)) {
        rejected.push(`${file.name} 不是支持的文本格式`)
        continue
      }
      if (file.size === 0) {
        rejected.push(`${file.name} 是空文件`)
        continue
      }
      if (file.size > AI_ATTACHMENT_MAX_BYTES) {
        rejected.push(`${file.name} 超过 64 KB`)
        continue
      }

      try {
        const content = await file.text()
        if (!content.trim()) {
          rejected.push(`${file.name} 没有可读内容`)
          continue
        }
        if (characterCount + content.length > AI_ATTACHMENT_MAX_CHARACTERS) {
          rejected.push(`${file.name} 会使附件内容超过 20,000 字符`)
          continue
        }
        accepted.push({
          content,
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
        })
        duplicateKeys.add(duplicateKey)
        characterCount += content.length
      } catch {
        rejected.push(`${file.name} 无法读取`)
      }
    }

    if (attachmentReadRequestIdRef.current !== requestId) return
    if (accepted.length > 0) setAttachments((current) => [...current, ...accepted])
    setAttachmentError(rejected.join('；'))
    setAttachmentReading(false)
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  function removeAttachment(id: string) {
    attachmentReadRequestIdRef.current += 1
    setAttachmentReading(false)
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
    setAttachmentError('')
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  async function sendComposerMessage(prompt = aiDraft) {
    const draftContent = prompt.trim()
    if ((!draftContent && attachments.length === 0) || workspaceBusy || !aiConfigured) return

    const modelContent = buildAiMessageContent(draftContent, attachments)
    const sourceContent = buildAiClassificationContent(draftContent, attachments)
    setGenerationError('')
    setAttachmentError('')

    const maxMessageLength = aiStatus?.maxMessageLength ?? 2_000
    if (modelContent.length > maxMessageLength) {
      setAttachmentError(
        `当前模型单条消息最多 ${maxMessageLength.toLocaleString()} 字符，请减少附件或输入内容。`,
      )
      return
    }

    const sourceContext = aiHistory.selection.context
    const turnId = crypto.randomUUID()
    const composerRevision = composerRevisionRef.current
    const classificationRequestId = intentClassificationRequestIdRef.current + 1
    intentClassificationRequestIdRef.current = classificationRequestId
    const classificationController = new AbortController()
    intentClassificationAbortControllerRef.current = classificationController
    setIntentClassifying(true)
    try {
      const { intent } = await classifyAiConversationTurnIntent({
        attachments: attachments.map(({ content, name, size }) => ({
          content,
          mediaType: 'text/plain',
          name,
          size,
        })),
        content: draftContent,
        contextKind: sourceContext.contextType,
        projectId: sourceContext.contextType === 'project' ? sourceContext.projectId : null,
        turnId,
      }, classificationController.signal)
      if (intentClassificationRequestIdRef.current !== classificationRequestId) return

      const classificationSourceContext = sourceContext.contextType === 'project'
        ? { contextKind: 'project' as const, projectId: sourceContext.projectId as number }
        : { contextKind: sourceContext.contextType, projectId: null }
      const targetContext = deriveAiIntentTargetContext(intent, classificationSourceContext)
      if (!targetContext.ok) {
        setGenerationError(
          targetContext.reason === 'project-required'
            ? '请先用 @ 选择一个项目，再生成项目总结。'
            : '工作区复盘不能绑定单个项目，请先移除 @ 项目。',
        )
        return
      }

      if (intent.kind === 'todo-extraction' && sourceContent.length > AI_ATTACHMENT_MAX_CHARACTERS) {
        setAttachmentError('待办提取内容最多 20,000 字符，请减少附件或输入内容。')
        return
      }
      if (intent.kind === 'project-summary' && attachments.length > 0) {
        setGenerationError('生成项目总结时不能同时添加附件。')
        return
      }
      if (intent.kind === 'workspace-review' && attachments.length > 0) {
        setGenerationError('梳理工作区进展时不能同时添加附件。')
        return
      }

      setIntentClassifying(false)
      const result = await onSendAgentMessage({
        attachments,
        content: draftContent,
        contextKind: targetContext.context.contextKind,
        intent,
        turnId,
      })
      if (!result) return

      setAttachments([])
      if (result.outcome?.type === 'todo-proposals') {
        await openTodoProposalOutcome(result.outcome.batchId)
      }
      if (result.outcome?.type === 'summary') {
        setSelectedSummaryId(result.outcome.summaryId)
        setIsSummaryFullscreen(false)
        openArtifacts()
      }
    } catch (error) {
      if (intentClassificationRequestIdRef.current !== classificationRequestId) return
      if (composerRevisionRef.current !== composerRevision) return
      setGenerationError(aiIntentRequestErrorMessage(error))
    } finally {
      if (intentClassificationRequestIdRef.current === classificationRequestId) {
        if (intentClassificationAbortControllerRef.current === classificationController) {
          intentClassificationAbortControllerRef.current = null
        }
        setIntentClassifying(false)
      }
    }
  }

  function resetConversation() {
    cancelIntentClassification()
    attachmentReadRequestIdRef.current += 1
    documentRequestGenerationRef.current += 1
    todoOutcomeRequestIdRef.current += 1
    setAttachmentReading(false)
    setGenerationError('')
    setAttachmentError('')
    setAttachments([])
    todoWorkflowRef.current?.reset()
    void onResetAiChat()
    if (historyOpen) closeHistory()
  }

  async function selectConversationHistory(conversation: AiConversationListItem) {
    if (conversation.id === currentConversationId) {
      if (historyOpen) closeHistory()
      return
    }
    cancelIntentClassification()
    attachmentReadRequestIdRef.current += 1
    documentRequestGenerationRef.current += 1
    todoOutcomeRequestIdRef.current += 1
    setAttachmentReading(false)
    setAttachments([])
    setAttachmentError('')
    setGenerationError('')
    todoWorkflowRef.current?.reset()
    await onSelectConversation(conversation)
  }

  async function deleteConversationHistory(conversationId: string) {
    if (conversationId === currentConversationId) {
      cancelIntentClassification()
      attachmentReadRequestIdRef.current += 1
      documentRequestGenerationRef.current += 1
      todoOutcomeRequestIdRef.current += 1
      setAttachmentReading(false)
      setAttachments([])
      setAttachmentError('')
      setGenerationError('')
      todoWorkflowRef.current?.reset()
    }
    await onDeleteConversation(conversationId)
  }

  const showPromptExamples =
    aiConfigured &&
    !aiStatusLoading &&
    aiMessages.length === 0 &&
    !aiDraft.trim() &&
    attachments.length === 0 &&
    !workspaceBusy
  const promptExamples = [
    {
      description: selectedProject
        ? '基于当前项目事实生成本周周报'
        : '把零散进展整理成周报与下一步',
      icon: <Sparkle aria-hidden size={18} weight="fill" />,
      label: selectedProject
        ? `总结 ${selectedProject.name} 本周进展`
        : '梳理本周进展和下一步',
      prompt: selectedProject
        ? '生成这个项目的周报'
        : '帮我梳理本周进展，并给出下一步行动建议。',
    },
    {
      description: '提炼结论、分歧和推进建议',
      icon: <ChatCircleDots aria-hidden size={19} weight="fill" />,
      label: '分析一段对话的结论和分歧',
      prompt: [
        '分析下面这段对话里的结论和分歧：',
        '',
        '小王：本周先上线搜索，导出功能下周再做。',
        '小李：我认为导出更影响交付，应该优先。',
        '小王：那先补导出，搜索顺延到下周。',
      ].join('\n'),
    },
    {
      description: '识别可执行事项并进入候选审核',
      icon: <ListChecks aria-hidden size={19} weight="fill" />,
      label: '从 Markdown 示例提取待办',
      prompt: [
        '从下面的 Markdown 示例中提取待办：',
        '',
        '## 发布准备',
        '- [ ] 完成移动端回归',
        '- [ ] 更新部署说明',
        '- [x] 确认版本号',
      ].join('\n'),
    },
  ]

  return (
    <div className={`veges-ai-layout${auxiliaryOpen ? ' has-artifacts' : ''}${documentFullscreen ? ' is-document-fullscreen' : ''}`}>
      <Card className="panel veges-ai-workspace">
        <header className="veges-ai-toolbar">
          <div className="veges-ai-conversation-title">
            <ChatCircleDots aria-hidden size={17} weight="duotone" />
            <strong title={currentConversationTitle}>{currentConversationTitle}</strong>
          </div>
          <div className="veges-ai-toolbar-actions">
            <Button
              aria-label="开始新对话"
              disabled={workspaceBusy || (aiMessages.length === 0 && !aiDraft && attachments.length === 0)}
              size="icon"
              title="开始新对话"
              type="button"
              variant="ghost"
              onClick={resetConversation}
            >
              <Plus size={17} weight="bold" />
            </Button>
            <Button
              ref={historyTriggerRef}
              aria-label={`历史对话 ${aiHistory.conversations.length}`}
              aria-expanded={historyOpen}
              className="ai-history-trigger"
              title="打开历史对话"
              type="button"
              variant="ghost"
              onClick={openHistory}
            >
              <ClockCounterClockwise size={17} />
              <span>历史</span>
              <small>{aiHistory.conversations.length}</small>
            </Button>
            <Button
              ref={artifactsTriggerRef}
              aria-label={`AI 文档 ${summaries.length}`}
              aria-controls="veges-ai-documents"
              aria-expanded={artifactsOpen}
              className="ai-artifacts-trigger"
              title="打开 AI 文档"
              type="button"
              variant="ghost"
              onClick={openArtifacts}
            >
              <SidebarSimple size={17} />
              <span>AI 文档</span>
              <small>{summaries.length}</small>
            </Button>
          </div>
        </header>

        {aiStatusError ? (
          <div className="veges-ai-notice is-error" role="alert">
            <WarningCircle size={19} weight="fill" />
            <div>
              <strong>无法确认模型状态</strong>
              <span>{aiStatusError}</span>
            </div>
            <Button size="sm" type="button" variant="outline" onClick={() => void loadAiStatus()}>
              重新检查
            </Button>
          </div>
        ) : !aiStatusLoading && !aiConfigured ? (
          <div className="veges-ai-notice" role="status">
            <WarningCircle size={19} weight="fill" />
            <div>
              <strong>Veges AI 暂不可用</strong>
              <span>管理员完成系统模型配置后，这里的能力会自动启用。</span>
            </div>
            <Button size="sm" type="button" variant="outline" onClick={() => void loadAiStatus()}>
              重新检查
            </Button>
          </div>
        ) : null}

        <section aria-label="Veges AI 对话" className="veges-ai-stage">
              <div
                aria-busy={aiBusy || intentClassifying}
                aria-live="polite"
                aria-relevant="additions text"
                className={`agent-messages${aiMessages.length === 0 ? ' is-empty' : ''}`}
                role="log"
              >
                {intentClassifying ? (
                  <span className="sr-only" role="status">正在理解请求</span>
                ) : null}
                {aiNextBeforeTurn != null ? (
                  <Button
                    className="ai-load-earlier"
                    disabled={aiTurnsLoading}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => void onLoadEarlierTurns()}
                  >
                    <ClockCounterClockwise aria-hidden size={14} />
                    {aiTurnsLoading ? '正在加载…' : '加载更早消息'}
                  </Button>
                ) : null}
                {showPromptExamples ? (
                  <div aria-label="示例提示" className="veges-ai-prompt-examples">
                    {promptExamples.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        onClick={() => void sendComposerMessage(example.prompt)}
                      >
                        <span className="veges-ai-prompt-icon">{example.icon}</span>
                        <span className="veges-ai-prompt-copy">
                          <strong>{example.label}</strong>
                          <small>{example.description}</small>
                        </span>
                        <PaperPlaneTilt
                          aria-hidden
                          className="veges-ai-prompt-send-icon"
                          size={15}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                {aiMessages.map((message) => (
                  <article
                    aria-busy={message.turnStatus === 'processing'}
                    className={`agent-message ${message.role} is-${message.turnStatus}`}
                    key={message.id}
                  >
                    {message.content ? (
                      <div
                        aria-live={message.turnStatus === 'processing' ? 'off' : undefined}
                        className="agent-message-content"
                      >
                        <MarkdownPreview content={message.content} compact />
                      </div>
                    ) : null}
                    {message.statusTitle && message.statusKind ? (
                      <div
                        aria-atomic="true"
                        className={`agent-message-state is-${message.statusKind}`}
                        role={message.statusKind === 'failed' ? 'alert' : 'status'}
                      >
                        {message.statusKind === 'processing' ? (
                          <SpinnerGap aria-hidden className="agent-message-state-spinner" size={17} />
                        ) : message.statusKind === 'reconciling' ? (
                          <ClockCounterClockwise aria-hidden size={17} />
                        ) : message.statusKind === 'failed' ? (
                          <WarningCircle aria-hidden size={17} weight="fill" />
                        ) : (
                          <X aria-hidden size={17} />
                        )}
                        <span>
                          <strong>{message.statusTitle}</strong>
                          {message.statusDetail ? <small>{message.statusDetail}</small> : null}
                        </span>
                      </div>
                    ) : null}
                    {message.attachments?.length ? (
                      <div className="agent-message-attachments" aria-label="消息附件">
                        {message.attachments.map((attachment) => (
                          <span key={attachment.id} title={attachment.name}>
                            <FileText size={13} aria-hidden />
                            <span>{attachment.name}</span>
                            <small>{formatAttachmentSize(attachment.size)}</small>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {message.role === 'assistant' ? (
                      <div className="agent-message-footer">
                        <time className="agent-message-time" dateTime={message.createdAt}>
                          {formatAiMessageTime(message.createdAt)}
                        </time>
                        <div className="agent-message-actions">
                          {message.turnId === retryableAiTurnId &&
                          (message.turnStatus === 'failed' || message.turnStatus === 'cancelled') ? (
                            <Button
                              disabled={workspaceBusy}
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => void retryTurn(message.turnId)}
                            >
                              <ClockCounterClockwise aria-hidden size={14} />
                              重试
                            </Button>
                          ) : null}
                          {message.turnStatus === 'processing' ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => void onStopAiTurn()}
                            >
                              <X aria-hidden size={14} />
                              停止
                            </Button>
                          ) : null}
                          {message.outcome?.type === 'todo-proposals' ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const outcome = message.outcome
                                if (outcome?.type === 'todo-proposals') {
                                  void openTodoProposalOutcome(outcome.batchId)
                                }
                              }}
                            >
                              <ListChecks aria-hidden size={14} />
                              查看待办候选
                            </Button>
                          ) : null}
                          {message.outcome?.type === 'summary' ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const outcome = message.outcome
                                if (outcome?.type === 'summary') {
                                  setSelectedSummaryId(outcome.summaryId)
                                  openArtifacts()
                                }
                              }}
                            >
                              <FileText aria-hidden size={14} />
                              打开 AI 文档
                            </Button>
                          ) : null}
                          {selectedProjectId && message.turnStatus === 'completed' && !message.outcome &&
                          documentIdBySourceTurn.has(message.turnId) ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const summaryId = documentIdBySourceTurn.get(message.turnId)
                                if (summaryId) {
                                  setSelectedSummaryId(summaryId)
                                  openArtifacts()
                                }
                              }}
                            >
                              <FileText aria-hidden size={14} />
                              打开文档
                            </Button>
                          ) : selectedProjectId && message.turnStatus === 'completed' && !message.outcome ? (
                            <Button
                              disabled={workspaceBusy}
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => void convertReplyToDocument(message)}
                            >
                              {documentSavingTurnIds.has(message.turnId) ? (
                                <SpinnerGap aria-hidden className="agent-message-state-spinner" size={14} />
                              ) : (
                                <FileText aria-hidden size={14} />
                              )}
                              {documentSavingTurnIds.has(message.turnId) ? '保存中' : '转为文档'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              {aiTurnsError || aiError ? (
                <div className="veges-ai-inline-notice" role="alert">
                  <WarningCircle aria-hidden size={16} weight="fill" />
                  <span>{aiTurnsError || aiError}</span>
                </div>
              ) : null}
              {generationError || attachmentError ? (
                <p className="form-error" role="alert">
                  {generationError || attachmentError}
                </p>
              ) : null}
              <div className="ai-todo-workflow-status">
                <TodoProposalWorkflow
                  ref={todoWorkflowRef}
                  memberships={memberships}
                  onBusyChange={setTodoWorkflowBusy}
                  onWorkspace={onWorkspace}
                  projects={projects}
                  sessionGeneration={sessionGeneration}
                />
              </div>
              <div className="agent-composer" ref={composerShellRef}>
                <input
                  ref={attachmentInputRef}
                  accept=".csv,.json,.log,.md,.markdown,.text,.txt,.yaml,.yml,application/json,application/yaml,application/x-yaml,text/csv,text/markdown,text/plain,text/x-log"
                  aria-label="选择文本附件"
                  className="ai-attachment-input"
                  multiple
                  type="file"
                  onChange={(event) => void handleAttachmentSelection(event)}
                />
                {projectPickerOpen ? (
                  <div aria-label="选择项目上下文" className="ai-project-picker" role="listbox">
                    {filteredProjects.length > 0 ? filteredProjects.map((project) => (
                      <button
                        aria-selected={project.id === selectedProjectId}
                        key={project.id}
                        role="option"
                        type="button"
                        onClick={() => selectProjectContext(project.id)}
                      >
                        <At size={15} weight="bold" />
                        <span>{project.name}</span>
                        {project.id === selectedProjectId ? <Check size={15} weight="bold" /> : null}
                      </button>
                    )) : (
                      <p>没有匹配的项目</p>
                    )}
                  </div>
                ) : null}
                <Textarea
                  ref={composerRef}
                  aria-label="Veges AI 消息"
                  disabled={aiTurnsLoading || intentClassifying || todoWorkflowBusy}
                  placeholder="输入消息，或粘贴需要处理的内容"
                  rows={2}
                  value={aiDraft}
                  onCompositionEnd={() => setIsComposing(false)}
                  onCompositionStart={() => setIsComposing(true)}
                  onChange={(event) => handleDraftChange(
                    event.target.value,
                    event.target.selectionStart ?? event.target.value.length,
                  )}
                  onKeyDown={(event) => {
                    const nativeEvent = event.nativeEvent as KeyboardEvent
                    if (event.key === 'Escape' && projectPickerOpen) {
                      event.preventDefault()
                      setProjectPickerOpen(false)
                      setProjectMention(null)
                      return
                    }
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !isComposing &&
                      !nativeEvent.isComposing &&
                      projectPickerOpen &&
                      filteredProjects[0]
                    ) {
                      event.preventDefault()
                      selectProjectContext(filteredProjects[0].id)
                      return
                    }
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !isComposing &&
                      !nativeEvent.isComposing &&
                      !workspaceBusy &&
                      aiConfigured
                    ) {
                      event.preventDefault()
                      void sendComposerMessage()
                    }
                  }}
                />
                {selectedProject || attachments.length > 0 ? (
                  <div className="ai-composer-context-row">
                    {selectedProject ? (
                      <span className="ai-project-chip">
                        <At size={14} weight="bold" aria-hidden />
                        <span>{selectedProject.name}</span>
                        <button
                          aria-label={`移除项目 ${selectedProject.name}`}
                          disabled={workspaceBusy}
                          title="移除项目"
                          type="button"
                          onClick={removeProjectContext}
                        >
                          <X size={13} weight="bold" />
                        </button>
                      </span>
                    ) : null}
                    {attachments.map((attachment) => (
                      <span className="ai-attachment-chip" key={attachment.id}>
                        <FileText size={14} aria-hidden />
                        <span title={attachment.name}>{attachment.name}</span>
                        <small>{formatAttachmentSize(attachment.size)}</small>
                        <button
                          aria-label={`移除附件 ${attachment.name}`}
                          disabled={workspaceBusy}
                          title="移除附件"
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <X size={13} weight="bold" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="ai-composer-toolbar">
                  <div className="ai-composer-tools">
                    <Button
                      aria-label="添加文本附件"
                      className="ai-attachment-trigger"
                      disabled={workspaceBusy || attachments.length >= AI_ATTACHMENT_MAX_COUNT}
                      size="icon"
                      title="添加文本附件"
                      type="button"
                      variant="ghost"
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      <Paperclip size={18} weight="bold" />
                    </Button>
                    <Button
                      aria-expanded={projectPickerOpen}
                      aria-haspopup="listbox"
                      aria-label="关联项目"
                      className="ai-project-trigger"
                      disabled={workspaceBusy}
                      size="icon"
                      title="关联项目"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setProjectMention(null)
                        setProjectQuery('')
                        setProjectPickerOpen((current) => !current)
                        window.requestAnimationFrame(() => composerRef.current?.focus())
                      }}
                    >
                      <At size={18} weight="bold" />
                    </Button>
                  </div>
                  <Button
                    aria-label={intentClassifying ? '正在理解请求' : aiBusy ? '停止回复' : '发送消息'}
                    className={`agent-send-button${aiBusy || intentClassifying ? ' is-stop' : ''}`}
                    disabled={
                      !aiConfigured || (
                        !aiBusy && !intentClassifying && (
                          aiTurnsLoading ||
                          attachmentReading ||
                          todoWorkflowBusy ||
                          (!aiDraft.trim() && attachments.length === 0)
                        )
                      )
                    }
                    size="icon"
                    title={intentClassifying ? '正在理解请求' : aiBusy ? '停止回复' : '发送消息'}
                    type="button"
                    onClick={() => {
                      if (intentClassifying) cancelIntentClassification()
                      else if (aiBusy) void onStopAiTurn()
                      else void sendComposerMessage()
                    }}
                  >
                    {aiBusy || intentClassifying
                      ? <X size={17} weight="bold" />
                      : <PaperPlaneTilt size={17} weight="fill" />}
                  </Button>
                </div>
              </div>
        </section>
      </Card>

      {historyOpen ? (
        <AiConversationHistoryPanel
          className="veges-ai-history"
          conversations={aiHistory.conversations}
          currentConversationId={currentConversationId}
          error={aiHistory.error || aiTurnsError}
          hasLoaded={aiHistory.hasLoaded}
          loadState={aiHistory.loadState}
          nextCursor={aiHistory.nextCursor}
          panelRef={historyRef}
          onClose={closeHistory}
          onCreateConversation={resetConversation}
          onDeleteConversation={deleteConversationHistory}
          onLoadMore={() => onLoadHistory('more')}
          onRenameConversation={onRenameConversation}
          onRetry={onRetryHistory}
          onSelectConversation={selectConversationHistory}
        />
      ) : null}

      {artifactsOpen ? (
        <Card
          ref={artifactsRef}
          aria-label="AI 文档"
          className={`panel summary-list veges-ai-artifacts${documentFullscreen ? ' is-fullscreen' : ''}`}
          id="veges-ai-documents"
          role="region"
          tabIndex={-1}
        >
          {selectedSummary ? (
            <SummaryDocumentDetail
              isFullscreen={documentFullscreen}
              projectName={selectedDocumentOwner}
              summary={selectedSummary}
              onBack={() => {
                setIsSummaryFullscreen(false)
                setSelectedSummaryId(null)
                window.requestAnimationFrame(() => artifactsRef.current?.focus())
              }}
              onClose={closeArtifacts}
              onToggleFullscreen={() => setIsSummaryFullscreen((current) => !current)}
            />
          ) : (
            <AiDocumentList
              onClose={closeArtifacts}
              onExport={onExportWorkspace}
              projects={projects}
              summaries={summaries}
              onSelect={(id) => {
                setSelectedSummaryId(id)
                window.requestAnimationFrame(() => artifactsRef.current?.focus())
              }}
            />
          )}
        </Card>
      ) : null}
    </div>
  )
}

function AiDocumentList({
  onClose,
  onExport,
  onSelect,
  projects,
  summaries,
}: {
  onClose: () => void
  onExport: () => void
  onSelect: (id: number) => void
  projects: Project[]
  summaries: Summary[]
}) {
  return (
    <>
      <header className="veges-ai-artifacts-header">
        <div>
          <FileText size={17} weight="duotone" />
          <h3>AI 文档</h3>
          <span>{summaries.length}</span>
        </div>
        <div className="veges-ai-artifacts-actions">
          <Button
            aria-label="导出工作区"
            disabled={projects.length === 0}
            size="icon"
            title="导出工作区"
            type="button"
            variant="ghost"
            onClick={onExport}
          >
            <DownloadSimple size={16} />
          </Button>
          <Button
            aria-label="关闭 AI 文档"
            size="icon"
            title="关闭"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
      </header>
      <div className="summary-doc-list">
        {summaries.length === 0 ? (
          <div className="veges-ai-artifacts-empty">
            <FileText size={22} />
            <strong>还没有 AI 文档</strong>
            <span>生成项目总结或将项目回复转为文档后，会显示在这里。</span>
          </div>
        ) : (
          summaries.map((summary) => {
            const project = projects.find((item) => item.id === summary.projectId)
            const ownerName = project?.name ?? (summary.period === '飞书对话分析' ? '飞书对话分析' : 'Veges AI')
            const documentLabel = summary.type === 'reply'
              ? '对话文档'
              : summary.period === 'AI 对话生成'
                ? '历史对话文档'
                : summary.period
            return (
              <button
                className="summary-doc-item"
                key={summary.id}
                type="button"
                onClick={() => onSelect(summary.id)}
              >
                <span className="summary-doc-item-icon" aria-hidden><FileText size={15} /></span>
                <span className="summary-doc-item-copy">
                  <strong>{summary.title}</strong>
                  <small>{ownerName} · {documentLabel}</small>
                </span>
                <time>{summary.createdAt}</time>
              </button>
            )
          })
        )}
      </div>
    </>
  )
}

function SummaryDocumentDetail({
  isFullscreen,
  onBack,
  onClose,
  onToggleFullscreen,
  projectName,
  summary,
}: {
  isFullscreen: boolean
  onBack: () => void
  onClose: () => void
  onToggleFullscreen: () => void
  projectName: string
  summary: Summary
}) {
  return (
    <article className="summary-doc-detail">
      <div className="summary-doc-header">
        <div className="summary-doc-toolbar">
          <Button className="ghost-button summary-back-button" variant="outline" type="button" onClick={onBack}>
            <ArrowLeft size={15} /> 返回列表
          </Button>
          <div className="veges-ai-artifacts-actions">
            <Button
              className="summary-fullscreen-button"
              variant="ghost"
              size="icon"
              type="button"
              aria-label={isFullscreen ? '退出展开阅读 AI 文档' : '展开阅读 AI 文档'}
              aria-pressed={isFullscreen}
              title={isFullscreen ? '退出展开阅读' : '展开阅读'}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <CornersIn size={17} /> : <CornersOut size={17} />}
            </Button>
            <Button
              aria-label="关闭 AI 文档"
              size="icon"
              title="关闭"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              <X size={16} />
            </Button>
          </div>
        </div>
        <div className="summary-doc-meta">
          <span>{projectName}</span>
          <span>{summary.createdAt}</span>
        </div>
        <h3>{summary.title}</h3>
        <small>{summary.period}</small>
      </div>
      <div className="summary-doc-body">
        <MarkdownPreview content={summary.content} />
      </div>
    </article>
  )
}

function TodoFilterBuilderDialog({
  assigneeOptions,
  conditions,
  creatorOptions,
  defaultConditions,
  defaultJoin,
  join,
  moduleOptions,
  watcherOptions,
  onApply,
  open,
  onOpenChange,
  persistFilters,
}: {
  assigneeOptions: Array<{ id: number; name: string }>
  conditions: TodoFilterCondition[]
  creatorOptions: Array<{ id: number; name: string }>
  defaultConditions: TodoFilterCondition[]
  defaultJoin: TodoFilterJoin
  join: TodoFilterJoin
  moduleOptions: Array<{ id: number; name: string }>
  watcherOptions: Array<{ id: number; name: string }>
  onApply: (next: { conditions: TodoFilterCondition[]; join: TodoFilterJoin; persist: boolean }) => void
  persistFilters: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draftJoin, setDraftJoin] = useState<TodoFilterJoin>(join)
  const [draftConditions, setDraftConditions] = useState<TodoFilterCondition[]>(conditions)
  const [draftPersistFilters, setDraftPersistFilters] = useState(persistFilters)

  useEffect(() => {
    if (!open) return
    setDraftJoin(join)
    setDraftConditions(conditions.length > 0 || persistFilters ? conditions : [createTodoFilterCondition()])
    setDraftPersistFilters(persistFilters)
  }, [conditions, join, open, persistFilters])

  function updateCondition(id: string, patch: Partial<TodoFilterCondition>) {
    setDraftConditions((current) =>
      current.map((condition) => {
        if (condition.id !== id) return condition
        const next = { ...condition, ...patch }
        if (patch.field) {
          next.operator = todoFilterOperatorsByField[patch.field][0]
          next.value = getDefaultTodoFilterValue(next.field, next.operator)
        } else if (patch.operator) {
          next.value = getDefaultTodoFilterValue(next.field, patch.operator)
        }
        return normalizeTodoFilterCondition(next)
      }),
    )
  }

  function addCondition(condition = createTodoFilterCondition()) {
    setDraftConditions((current) => [...current, condition])
  }

  function applyFilters() {
    onApply({
      conditions: draftConditions.map(normalizeTodoFilterCondition).filter((condition) => {
        return (
          condition.operator === 'is_empty' ||
          condition.operator === 'is_not_empty' ||
          Boolean(condition.value.trim())
        )
      }),
      join: draftJoin,
      persist: draftPersistFilters,
    })
    onOpenChange(false)
  }

  function restoreDefaultFilters() {
    onApply({
      conditions: defaultConditions,
      join: defaultJoin,
      persist: false,
    })
    onOpenChange(false)
  }

  function renderConditionValue(condition: TodoFilterCondition) {
    if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
      return <span className="todo-filter-value-hint">无需填写</span>
    }

    if (condition.field === 'title') {
      return (
        <Input
          aria-label="筛选值"
          className="todo-filter-value-input"
          placeholder="输入关键词"
          value={condition.value}
          onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
        />
      )
    }

    if (condition.field === 'module') {
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger aria-label="筛选模块" className="todo-filter-condition-select">
            <SelectValue placeholder="选择模块" />
          </SelectTrigger>
          <SelectContent>
            {moduleOptions.map((module) => (
              <SelectItem key={module.id} value={String(module.id)}>
                {module.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'assignee' || condition.field === 'watcher' || condition.field === 'creator') {
      const options = condition.field === 'assignee'
        ? assigneeOptions
        : condition.field === 'watcher'
          ? watcherOptions
          : creatorOptions
      const label = condition.field === 'assignee'
        ? '负责人'
        : condition.field === 'watcher'
          ? '关注人'
          : '创建人'
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger aria-label={`筛选${label}`} className="todo-filter-condition-select">
            <SelectValue placeholder={`选择${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                @{user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'priority') {
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger aria-label="筛选优先级" className="todo-filter-condition-select">
            <SelectValue placeholder="选择优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">高优先级</SelectItem>
            <SelectItem value="medium">中优先级</SelectItem>
            <SelectItem value="low">低优先级</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'done') {
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger aria-label="筛选完成状态" className="todo-filter-condition-select">
            <SelectValue placeholder="选择状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">未完成</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'confirmationStatus') {
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(condition.id, { value })}
        >
          <SelectTrigger aria-label="筛选确认状态" className="todo-filter-condition-select">
            <SelectValue placeholder="选择状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="pending_review">待验收</SelectItem>
            <SelectItem value="rejected">已驳回</SelectItem>
            <SelectItem value="acceptance_failed">验收未通过</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if ((condition.field === 'dueDate' || condition.field === 'createdAt') && condition.operator === 'between') {
      const range = parseTodoFilterDateRange(condition.value)
      return (
        <div className="todo-filter-date-range">
          <JournalDatePicker
            ariaLabel="选择开始日期"
            className="todo-filter-date-trigger"
            datesWithEntries={[]}
            displayValue={range.start || '开始日期'}
            value={range.start}
            onChange={(value) =>
              updateCondition(condition.id, { value: `${value}..${range.end}` })
            }
          />
          <span className="todo-filter-date-range-separator">至</span>
          <JournalDatePicker
            ariaLabel="选择结束日期"
            className="todo-filter-date-trigger"
            datesWithEntries={[]}
            displayValue={range.end || '结束日期'}
            value={range.end}
            onChange={(value) =>
              updateCondition(condition.id, { value: `${range.start}..${value}` })
            }
          />
        </div>
      )
    }

    return (
      <JournalDatePicker
        ariaLabel="选择筛选日期"
        className="todo-filter-date-trigger"
        datesWithEntries={[]}
        displayValue={condition.value || '选择日期'}
        value={condition.value || today}
        onChange={(value) => updateCondition(condition.id, { value })}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="todo-filter-dialog">
        <DialogHeader>
          <DialogTitle>筛选待办</DialogTitle>
          <DialogDescription>
            用条件组合筛选待办。搜索框仍保留在外层，适合快速查标题或关键词。
          </DialogDescription>
        </DialogHeader>
        <div className="todo-filter-join-row">
          <span>匹配方式</span>
          <Select value={draftJoin} onValueChange={(value) => setDraftJoin(value as TodoFilterJoin)}>
            <SelectTrigger aria-label="筛选匹配方式" className="todo-filter-join-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">全部满足（且）</SelectItem>
              <SelectItem value="or">任一满足（或）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="todo-filter-condition-list">
          {draftConditions.length === 0 ? (
            <div className="todo-filter-empty">还没有筛选条件。</div>
          ) : (
            draftConditions.map((condition, index) => (
              <div
                className={
                  isTodoFilterDateRangeCondition(condition)
                    ? 'todo-filter-condition-row date-range'
                    : 'todo-filter-condition-row'
                }
                key={condition.id}
              >
                <span className="todo-filter-condition-index">条件 {index + 1}</span>
                <Select
                  value={condition.field}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { field: value as TodoFilterField })
                  }
                >
                  <SelectTrigger aria-label="筛选字段" className="todo-filter-condition-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {todoFilterFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {todoFilterFieldLabels[field]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { operator: value as TodoFilterOperator })
                  }
                >
                  <SelectTrigger aria-label="筛选操作符" className="todo-filter-condition-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {todoFilterOperatorsByField[condition.field].map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {todoFilterOperatorLabels[operator]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="todo-filter-value-control">{renderConditionValue(condition)}</div>
                <Button
                  className="todo-filter-remove-button"
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="删除筛选条件"
                  onClick={() =>
                    setDraftConditions((current) =>
                      current.filter((item) => item.id !== condition.id),
                    )
                  }
                >
                  <Trash size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
        <Button
          className="todo-filter-add-condition ghost-button"
          type="button"
          variant="outline"
          onClick={() => addCondition()}
        >
          <Plus size={14} /> 添加条件
        </Button>
        <div className="todo-filter-persistence-row">
          <label className="todo-filter-persistence-toggle">
            <input
              type="checkbox"
              checked={draftPersistFilters}
              onChange={(event) => setDraftPersistFilters(event.target.checked)}
            />
            <span>返回项目列表时依然保存当前筛选</span>
          </label>
          {draftPersistFilters ? (
            <Button
              className="todo-filter-restore-button"
              type="button"
              variant="outline"
              onClick={restoreDefaultFilters}
            >
              <ClockCounterClockwise size={14} /> 恢复默认筛选
            </Button>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            className="ghost-button"
            type="button"
            variant="outline"
            onClick={() => {
              setDraftConditions([])
              setDraftJoin('and')
            }}
          >
            清空
          </Button>
          <Button className="ghost-button" type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="solid-button" type="button" onClick={applyFilters}>
            应用筛选
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TodoNotesPanel({
  departedUserIds,
  currentUserId,
  members,
  onCreateNote,
  onUpdateNote,
  todo,
}: {
  departedUserIds: readonly number[]
  currentUserId?: number
  members?: Array<{ id: number; name: string }>
  onCreateNote?: (todoId: number, content: string) => void
  onUpdateNote?: (todoId: number, noteId: number, content: string) => void
  todo: Todo
}) {
  const [draft, setDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingDrafts, setEditingDrafts] = useState<Record<number, string>>({})
  const notes = useMemo(
    () => [...todo.notes].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [todo.notes],
  )

  useEffect(() => {
    setDraft('')
    setEditingNoteId(null)
    setEditingDrafts({})
  }, [todo.id])

  function saveNewNote() {
    const content = draft.trim()
    if (!content || !onCreateNote) return
    onCreateNote(todo.id, content)
    setDraft('')
  }

  function saveExistingNote(note: TodoNote) {
    const nextContent = String(editingDrafts[note.id] ?? note.content).trim()
    if (!nextContent || !onUpdateNote) return
    onUpdateNote(todo.id, note.id, nextContent)
    setEditingNoteId(null)
  }

  return (
    <section className="todo-notes-panel" aria-label="待办备注">
      <div className="todo-notes-panel-header">
        <div>
          <strong>待办备注</strong>
        </div>
        <span className="todo-notes-panel-count">{notes.length} 条</span>
      </div>
      {onCreateNote ? (
        <div className="todo-note-composer-pane">
          <div className="todo-note-create">
            <TodoNoteComposer
              action={(
                <Button
                  className="todo-note-submit"
                  type="button"
                  disabled={!draft.trim()}
                  onClick={saveNewNote}
                >
                  添加备注
                </Button>
              )}
              members={members}
              placeholder="记录确认结果、未完成原因或其他补充说明..."
              value={draft}
              onChange={setDraft}
            />
          </div>
        </div>
      ) : null}
      <div className="todo-notes-list">
        {notes.length === 0 ? (
          <div className="todo-notes-empty">还没有备注，直接写第一条即可。</div>
        ) : (
          notes.map((note) => {
            const canEdit = Boolean(onUpdateNote) && currentUserId != null && (
              note.authorUserId === currentUserId || note.sourceOperationId != null
            )
            const isEditing = editingNoteId === note.id
            return (
              <article className="todo-note-card" key={note.id}>
                <header className="todo-note-card-header">
                  <div className="todo-note-card-meta">
                    <div className="todo-note-card-heading">
                      <UserName departedUserIds={departedUserIds} name={note.authorName} userId={note.authorUserId} />
                      <span>{note.createdAt}</span>
                      {note.kind === 'acceptance' ? (
                        <span className="todo-note-kind acceptance">验收备注</span>
                      ) : null}
                    </div>
                  </div>
                  {canEdit ? (
                    <Button
                      className="todo-note-inline-edit"
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setEditingNoteId(note.id)
                        setEditingDrafts((current) => ({
                          ...current,
                          [note.id]: note.content,
                        }))
                      }}
                    >
                      编辑
                    </Button>
                  ) : null}
                </header>
                {isEditing ? (
                  <div className="todo-note-editor">
                    <TodoNoteComposer
                      members={members}
                      value={editingDrafts[note.id] ?? note.content}
                      onChange={(value) =>
                        setEditingDrafts((current) => ({
                          ...current,
                          [note.id]: value,
                        }))
                      }
                    />
                    <div className="todo-note-editor-actions">
                      <Button variant="outline" type="button" onClick={() => setEditingNoteId(null)}>
                        取消
                      </Button>
                      <Button type="button" onClick={() => saveExistingNote(note)}>
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TodoNoteContent value={note.content} />
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

function TodoPropertiesPanel({
  assigneeUserId,
  canEdit,
  canRespondToTodo,
  createdAt,
  dueDate,
  members,
  moduleId,
  modules,
  onAssigneeUserIdChange,
  onCreatedAtChange,
  onDueDateChange,
  onInlineUpdate,
  onModuleIdChange,
  onPriorityChange,
  onReject,
  onRequestAcceptance,
  onReviewerUserIdChange,
  onWatcherUserIdsChange,
  priority,
  project,
  reviewerUserId,
  todo,
  watcherUserIds,
}: {
  assigneeUserId: number | null
  canEdit: boolean
  canRespondToTodo: boolean
  createdAt: string
  dueDate: string
  members: Array<{ id: number; name: string }>
  moduleId: number | null
  modules: ProjectModule[]
  onAssigneeUserIdChange: (value: number | null) => void
  onCreatedAtChange: (value: string) => void
  onDueDateChange: (value: string) => void
  onInlineUpdate: (payload: TodoUpdatePayload) => void
  onModuleIdChange: (value: number | null) => void
  onPriorityChange: (value: Priority) => void
  onReject: (reason: string) => void
  onRequestAcceptance: () => void
  onReviewerUserIdChange: (value: number | null) => void
  onWatcherUserIdsChange: (value: number[]) => void
  priority: Priority
  project: Project
  reviewerUserId: number | null
  todo: Todo
  watcherUserIds: number[]
}) {
  const creatorName = todo.creatorName ?? project.ownerName

  function updateDueDate(value: string) {
    onDueDateChange(value)
    onInlineUpdate({ dueDate: value })
  }

  function updateCreatedAt(value: string) {
    onCreatedAtChange(value)
    onInlineUpdate({ createdAt: value })
  }

  function updatePriority(value: Priority) {
    onPriorityChange(value)
    onInlineUpdate({ priority: value })
  }

  function updateModule(value: number | null) {
    onModuleIdChange(value)
    onInlineUpdate({ moduleId: value })
  }

  function updateAssignee(value: number | null) {
    onAssigneeUserIdChange(value)
    onInlineUpdate({ assigneeUserId: value })
  }

  function updateWatchers(value: number[]) {
    onWatcherUserIdsChange(value)
    onInlineUpdate({ watcherUserIds: value })
  }

  function updateReviewer(value: number | null) {
    onReviewerUserIdChange(value)
    onInlineUpdate({ reviewerUserId: value })
  }

  return (
    <aside className="todo-properties-panel" aria-label="待办属性">
      <div className="todo-properties-heading">
        <div>
          <span className="todo-properties-kicker">属性</span>
          <strong>待办信息</strong>
        </div>
        {canEdit ? <span className="todo-properties-editable">可直接编辑</span> : null}
      </div>
      <div className="todo-properties-list">
        <div className="todo-property-row">
          <span>项目</span>
          <strong>{project.name}</strong>
        </div>
        <div className="todo-property-row">
          <span>状态</span>
          <strong>{todo.done ? '已完成' : '未完成'}</strong>
        </div>
        <div className="todo-property-row">
          <span>截止日期</span>
          <JournalDatePicker
            ariaLabel="待办截止日期"
            className="todo-property-control"
            datesWithEntries={[]}
            disabled={!canEdit}
            value={dueDate}
            onChange={updateDueDate}
          />
        </div>
        <div className="todo-property-row">
          <span>优先级</span>
          <Select disabled={!canEdit} value={priority} onValueChange={(value) => updatePriority(value as Priority)}>
            <SelectTrigger aria-label="待办优先级" className="todo-property-control">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">高优先级</SelectItem>
              <SelectItem value="medium">中优先级</SelectItem>
              <SelectItem value="low">低优先级</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="todo-property-row">
          <span>所属模块</span>
          <ProjectModulePicker
            disabled={!canEdit}
            modules={modules}
            value={moduleId}
            onChange={updateModule}
          />
        </div>
        <div className="todo-property-row">
          <span>负责人</span>
          <ProjectMemberPicker
            disabled={!canEdit}
            members={members}
            value={assigneeUserId}
            onChange={updateAssignee}
          />
        </div>
        <div className="todo-property-row">
          <span>关注人</span>
          <ProjectMemberMultiPicker
            disabled={!canEdit}
            emptyLabel="未关注"
            label="待办关注人"
            members={members}
            values={watcherUserIds}
            onChange={updateWatchers}
          />
        </div>
        <div className="todo-property-row">
          <span>验收人</span>
          <ProjectMemberPicker
            disabled={!canEdit}
            emptyLabel="待办创建人"
            label="指定验收人"
            members={members}
            value={reviewerUserId}
            onChange={updateReviewer}
          />
        </div>
        <div className="todo-property-row">
          <span>创建人</span>
          <strong>{creatorName}</strong>
        </div>
        <div className="todo-property-row">
          <span>创建时间</span>
          {canEdit ? (
            <JournalDatePicker
              ariaLabel="待办创建日期"
              className="todo-property-control"
              datesWithEntries={[]}
              value={createdAt}
              onChange={updateCreatedAt}
            />
          ) : <strong>{createdAt}</strong>}
        </div>
        <div className="todo-property-row">
          <span>验收状态</span>
          <TodoConfirmSelect
            done={todo.done}
            status={todo.confirmationStatus}
            disabled={!canRespondToTodo}
            onChange={(confirmationStatus) => onInlineUpdate({ confirmationStatus })}
            onReject={onReject}
            onRequestAcceptance={onRequestAcceptance}
          />
        </div>
        {todo.done && todo.completedAt ? (
          <div className="todo-property-row">
            <span>完成信息</span>
            <strong>{todo.completedByName ?? '项目成员'} · {todo.completedAt.slice(0, 16)}</strong>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function TodoEditorDialog({
  assigneeUserId,
  departedUserIds,
  watcherUserIds,
  reviewerUserId,
  backLabel = '返回待办列表',
  canEdit = false,
  canEditProperties = canEdit,
  canRespondToTodo = false,
  canShare = false,
  canCreateModule = false,
  clearDisabled = false,
  createdAt,
  currentUserId,
  detail,
  members,
  mode,
  moduleId,
  modules,
  onAssigneeUserIdChange,
  onWatcherUserIdsChange,
  onReviewerUserIdChange,
  onBack,
  onCancelEdit,
  onClear,
  onCreateTodoNote,
  onCreateModule,
  onCreatedAtChange,
  onDetailChange,
  onDueDateChange,
  onModuleIdChange,
  onOpenChange,
  onPriorityChange,
  onReject,
  onRequestAcceptance,
  onStartEdit,
  onSubmit,
  onTitleChange,
  onUpdateTodoNote,
  onInlineUpdate,
  open,
  priority,
  project,
  isEditing = true,
  submitDisabled,
  title,
  todo,
  dueDate,
}: {
  assigneeUserId: number | null
  departedUserIds: readonly number[]
  watcherUserIds: number[]
  reviewerUserId: number | null
  backLabel?: string
  canEdit?: boolean
  canEditProperties?: boolean
  canRespondToTodo?: boolean
  canShare?: boolean
  canCreateModule?: boolean
  clearDisabled?: boolean
  createdAt: string
  currentUserId?: number
  detail: string
  members: Array<{ id: number; name: string }>
  mode: 'create' | 'detail'
  moduleId: number | null
  modules: ProjectModule[]
  onAssigneeUserIdChange: (value: number | null) => void
  onWatcherUserIdsChange: (value: number[]) => void
  onReviewerUserIdChange: (value: number | null) => void
  onBack?: () => void
  onCancelEdit?: () => void
  onClear?: () => void
  onCreateTodoNote?: (todoId: number, content: string) => void
  onCreateModule?: (name: string) => Promise<ProjectModule | null>
  onCreatedAtChange: (value: string) => void
  onDetailChange: (value: string) => void
  onDueDateChange: (value: string) => void
  onModuleIdChange: (value: number | null) => void
  onOpenChange: (open: boolean) => void
  onPriorityChange: (value: Priority) => void
  onReject?: (reason: string) => void
  onRequestAcceptance?: () => void
  onStartEdit?: () => void
  onSubmit: () => void
  onTitleChange: (value: string) => void
  onUpdateTodoNote?: (todoId: number, noteId: number, content: string) => void
  onInlineUpdate?: (payload: TodoUpdatePayload) => void
  open: boolean
  priority: Priority
  project: Project
  isEditing?: boolean
  submitDisabled: boolean
  title: string
  todo?: Todo | null
  dueDate: string
}) {
  const isCreateMode = mode === 'create'
  const isDetailMode = mode === 'detail'
  const editing = isCreateMode || isEditing
  const isDetailEditing = isDetailMode && editing
  const selectedModuleName = modules.find((item) => item.id === moduleId)?.name ?? '无模块'
  const showNotesSidebar = Boolean(isDetailMode && todo)
  const statusLabel = todo?.done ? '已完成' : '未完成'
  const showFooterActions = isCreateMode || editing
  const showDetailOverview = isDetailMode && !editing
  const titleCharacterCount = Array.from(title).length
  const [shareOpen, setShareOpen] = useState(false)
  if (!open) {
    return null
  }

  const form = (
    <form
      className={[
        'todo-editor-form',
        showNotesSidebar ? 'has-sidebar' : '',
        isCreateMode ? 'is-create-mode' : 'is-detail-mode',
        editing ? 'is-editing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onSubmit={(event) => {
        event.preventDefault()
        if (!editing || submitDisabled) return
        onSubmit()
      }}
    >
      {showDetailOverview ? (
        <section className="todo-detail-overview">
          <div className="todo-detail-overview-main">
            <div className="todo-detail-page-summary">
              {todo ? <code className="todo-code todo-detail-code">{todoCode(todo.id)}</code> : null}
              <div className="todo-detail-page-title-row">
                <h3 className="todo-detail-page-title">{title}</h3>
                <div className="todo-detail-page-badges">
                  {moduleId ? (
                    <Badge className="todo-module-badge">{selectedModuleName}</Badge>
                  ) : null}
                  <Badge className={`priority ${priority}`}>
                    {priorityCopy[priority]}
                  </Badge>
                  <span className={todo?.done ? 'todo-status-chip done detail-status-chip' : 'todo-status-chip detail-status-chip'}>
                    {statusLabel}
                  </span>
                  {todo?.offboardingTransferredFromName ? (
                    <Badge className="my-work-offboarding-badge" variant="outline">
                      {todo.offboardingTransferredFromName}-离职转移
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {todo && canShare ? (
            <div className="todo-detail-overview-actions">
              <Button
                className="todo-detail-share-button"
                type="button"
                onClick={() => setShareOpen(true)}
              >
                <LinkSimple size={16} /> 分享待办
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="todo-editor-main">
        {isCreateMode ? (
          <>
            <Label>
              待办标题
              <div className="todo-title-input-wrap">
                <MentionInput
                  autoFocus
                  members={members}
                  maxLength={todoTitleMaxLength}
                  placeholder="给这条待办起一个清晰的标题..."
                  value={title}
                  onChange={onTitleChange}
                />
                <span
                  aria-live="polite"
                  className={titleCharacterCount > todoTitleMaxLength
                    ? 'todo-title-counter over-limit'
                    : 'todo-title-counter'}
                >
                  {titleCharacterCount}/{todoTitleMaxLength}
                </span>
              </div>
            </Label>
            <div className="todo-editor-inline-grid">
              <Label className="todo-inline-field-half">
                截止日期
                <JournalDatePicker
                  ariaLabel="待办截止日期"
                  className="todo-form-field"
                  datesWithEntries={[]}
                  value={dueDate}
                  onChange={onDueDateChange}
                />
              </Label>
              <div className="todo-created-date-row todo-inline-field-half">
                <span>指定创建日期</span>
                <div className="todo-created-date-actions">
                  <JournalDatePicker
                    ariaLabel="指定创建日期"
                    className="todo-form-field"
                    datesWithEntries={[]}
                    displayValue={createdAt || '选择日期'}
                    value={createdAt || today}
                    onChange={onCreatedAtChange}
                  />
                </div>
              </div>
              <Label>
                优先级
                <Select
                  value={priority}
                  onValueChange={(value) => onPriorityChange(value as Priority)}
                >
                  <SelectTrigger aria-label="待办优先级" className="todo-form-field">
                    <SelectValue placeholder="优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">高优先级</SelectItem>
                    <SelectItem value="medium">中优先级</SelectItem>
                    <SelectItem value="low">低优先级</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <div className="todo-editor-field todo-inline-field-half">
                <span>所属模块</span>
                <ProjectModulePicker
                  canCreate={isCreateMode && canCreateModule}
                  modules={modules}
                  value={moduleId}
                  onChange={onModuleIdChange}
                  onCreate={onCreateModule}
                />
              </div>
              <Label className="todo-inline-field-half">
                负责人
                <ProjectMemberPicker
                  members={members}
                  value={assigneeUserId}
                  onChange={onAssigneeUserIdChange}
                />
              </Label>
              <Label className="todo-inline-field-half">
                关注人
                <ProjectMemberMultiPicker
                  emptyLabel="未关注"
                  label="待办关注人"
                  members={members}
                  values={watcherUserIds}
                  onChange={onWatcherUserIdsChange}
                />
              </Label>
              <Label className="todo-inline-field-half">
                <span className="todo-reviewer-field-label">
                  指定验收人
                  <span
                    aria-label="可以在此选择指定验收人，默认为待办创建人。"
                    className="todo-reviewer-help"
                    role="img"
                    tabIndex={0}
                  >
                    <Question size={14} weight="bold" />
                    <span className="todo-reviewer-tooltip" role="tooltip">
                      可以在此选择指定验收人，默认为待办创建人。
                    </span>
                  </span>
                </span>
                <ProjectMemberPicker
                  emptyLabel="待办创建人"
                  label="指定验收人"
                  members={members}
                  value={reviewerUserId}
                  onChange={onReviewerUserIdChange}
                />
              </Label>
            </div>
            <div className="todo-editor-detail-field">
              <span className="todo-editor-field-label">待办详情</span>
              <TodoDetailEditor
                value={detail}
                onChange={onDetailChange}
              />
            </div>
          </>
        ) : isDetailEditing ? (
          <>
            <section className="todo-detail-block todo-detail-block-editing">
              <div className="todo-detail-section-header todo-detail-editing-header">
                {todo ? <code className="todo-code todo-detail-code">{todoCode(todo.id)}</code> : null}
                <Label className="todo-detail-title-editor">
                  待办标题
                  <div className="todo-title-input-wrap">
                    <MentionInput
                      autoFocus
                      members={members}
                      maxLength={todoTitleMaxLength}
                      placeholder="给这条待办起一个清晰的标题..."
                      value={title}
                      onChange={onTitleChange}
                    />
                    <span
                      aria-live="polite"
                      className={titleCharacterCount > todoTitleMaxLength
                        ? 'todo-title-counter over-limit'
                        : 'todo-title-counter'}
                    >
                      {titleCharacterCount}/{todoTitleMaxLength}
                    </span>
                  </div>
                </Label>
              </div>
              <div className="todo-editor-detail-field">
                <span className="todo-editor-field-label">待办详情</span>
                <TodoDetailEditor
                  value={detail}
                  onChange={onDetailChange}
                />
              </div>
            </section>
            {showNotesSidebar && todo ? (
              <TodoNotesPanel
                currentUserId={currentUserId}
                departedUserIds={departedUserIds}
                members={members}
                onCreateNote={onCreateTodoNote}
                onUpdateNote={onUpdateTodoNote}
                todo={todo}
              />
            ) : null}
          </>
        ) : (
          <>
            <section className="todo-detail-block">
              <div className="todo-detail-section-header">
                <span className="todo-detail-section-label">待办详情</span>
                {canEdit ? (
                  <Button
                    className="ghost-button todo-detail-inline-edit"
                    type="button"
                    variant="outline"
                    onClick={onStartEdit}
                  >
                    编辑
                  </Button>
                ) : null}
              </div>
              {detail.trim() ? (
                <div className="todo-detail-rendered">
                  <TodoDetailViewer value={detail} />
                </div>
              ) : (
                <div className="todo-detail-empty">暂无详情</div>
              )}
            </section>
            {showNotesSidebar && todo ? (
              <TodoNotesPanel
                currentUserId={currentUserId}
                departedUserIds={departedUserIds}
                members={members}
                onCreateNote={onCreateTodoNote}
                onUpdateNote={onUpdateTodoNote}
                todo={todo}
              />
            ) : null}
          </>
        )}
      </div>
      {isDetailMode && todo ? (
        <div className="todo-editor-sidebar">
          <TodoPropertiesPanel
            assigneeUserId={assigneeUserId}
            canEdit={canEditProperties}
            canRespondToTodo={canRespondToTodo}
            createdAt={createdAt}
            dueDate={dueDate}
            members={members}
            moduleId={moduleId}
            modules={modules}
            onAssigneeUserIdChange={onAssigneeUserIdChange}
            onCreatedAtChange={onCreatedAtChange}
            onDueDateChange={onDueDateChange}
            onInlineUpdate={onInlineUpdate ?? (() => undefined)}
            onModuleIdChange={onModuleIdChange}
            onPriorityChange={onPriorityChange}
            onReject={onReject ?? (() => undefined)}
            onRequestAcceptance={onRequestAcceptance ?? (() => undefined)}
            onReviewerUserIdChange={onReviewerUserIdChange}
            onWatcherUserIdsChange={onWatcherUserIdsChange}
            priority={priority}
            project={project}
            reviewerUserId={reviewerUserId}
            todo={todo}
            watcherUserIds={watcherUserIds}
          />
        </div>
      ) : null}
      {showFooterActions || Boolean(isCreateMode && onClear) ? (
        <DialogFooter className="todo-editor-footer">
          {isCreateMode && onClear ? (
            <Button
              className="ghost-button"
              variant="outline"
              type="button"
              disabled={clearDisabled}
              onClick={onClear}
            >
              清空
            </Button>
          ) : null}
          {showFooterActions ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                if (isDetailMode && editing && onCancelEdit) {
                  onCancelEdit()
                  return
                }
                onOpenChange(false)
              }}
            >
              {isCreateMode ? '取消' : '取消编辑'}
            </Button>
          ) : null}
          {isCreateMode ? (
            <Button className="solid-button" type="submit" disabled={submitDisabled}>
              <Plus size={16} /> 添加待办
            </Button>
          ) : editing ? (
            <Button className="solid-button" type="submit" disabled={submitDisabled}>
              保存待办
            </Button>
          ) : null}
        </DialogFooter>
      ) : null}
    </form>
  )

  return (
    <article
      className={[
        'todo-detail-page',
        isCreateMode ? 'is-create-mode' : 'is-detail-mode',
        editing ? 'is-editing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="todo-detail-page-header">
        <Button
          className="ghost-button summary-back-button"
          variant="outline"
          type="button"
          onClick={() => onBack ? onBack() : onOpenChange(false)}
        >
          <ArrowLeft size={15} /> {backLabel}
        </Button>
      </div>
      <div className="todo-detail-surface">
        {form}
      </div>
      {isDetailMode && todo ? (
        <TodoShareDialog todoId={todo.id} open={shareOpen} onOpenChange={setShareOpen} />
      ) : null}
    </article>
  )
}

function TodoList({
  canManageOrganizationTodos = false,
  compact = false,
  currentUserId,
  departedUserIds,
  detailBackLabel,
  initialTodoId,
  onCreateTodoNote,
  onDetailBack,
  onDeleteTodo,
  onDetailModeChange,
  onUpdateTodoNote,
  onUpdateTodo,
  memberships,
  project,
  projects,
  todos,
}: {
  canManageOrganizationTodos?: boolean
  compact?: boolean
  currentUserId?: number
  departedUserIds: readonly number[]
  detailBackLabel?: string
  initialTodoId?: number | null
  onCreateTodoNote?: (todoId: number, content: string) => void
  onDetailBack?: () => void
  onDeleteTodo?: (id: number) => void
  onDetailModeChange?: (active: boolean) => void
  onUpdateTodoNote?: (todoId: number, noteId: number, content: string) => void
  onUpdateTodo?: (id: number, payload: TodoUpdatePayload) => Promise<boolean> | void
  memberships: ProjectMembership[]
  project: Project
  projects: Project[]
  todos: Todo[]
}) {
  const defaultTodoFilterState = useMemo(
    () => getDefaultProjectTodoFilterState(project, currentUserId),
    [currentUserId, project],
  )
  const storedTodoFilterPreference = useMemo(
    () => loadTodoFilterPreference(project.id, currentUserId),
    [currentUserId, project.id],
  )
  const initialTodo = initialTodoId == null
    ? null
    : todos.find((todo) => todo.id === initialTodoId) ?? null
  const [page, setPage] = useState(0)
  const [todoSearchQuery, setTodoSearchQuery] = useState('')
	  const [todoFilterDialogOpen, setTodoFilterDialogOpen] = useState(false)
	  const [todoPendingReviewTarget, setTodoPendingReviewTarget] = useState<Todo | null>(null)
	  const [todoAcceptanceTarget, setTodoAcceptanceTarget] = useState<Todo | null>(null)
	  const [todoFilterJoin, setTodoFilterJoin] = useState<TodoFilterJoin>(
    storedTodoFilterPreference?.join ?? defaultTodoFilterState.join,
  )
  const [todoFilterConditions, setTodoFilterConditions] = useState<TodoFilterCondition[]>(() =>
    storedTodoFilterPreference?.conditions ?? defaultTodoFilterState.conditions,
  )
  const [todoFilterPersistenceEnabled, setTodoFilterPersistenceEnabled] = useState(
    Boolean(storedTodoFilterPreference),
  )
  const [editingTodoId, setEditingTodoId] = useState<number | null>(initialTodo?.id ?? null)
  const [todoEditDraft, setTodoEditDraft] = useState(initialTodo?.title ?? '')
  const [todoEditDetail, setTodoEditDetail] = useState(initialTodo?.detail ?? '')
  const [todoEditCreatedAt, setTodoEditCreatedAt] = useState(initialTodo?.createdAt.slice(0, 10) ?? today)
  const [todoEditDueDate, setTodoEditDueDate] = useState(initialTodo?.dueDate ?? today)
  const [todoEditPriority, setTodoEditPriority] = useState<Priority>(initialTodo?.priority ?? 'medium')
  const [todoEditAssigneeUserId, setTodoEditAssigneeUserId] = useState<number | null>(
    initialTodo?.assigneeUserId ?? null,
  )
  const [todoEditWatcherUserIds, setTodoEditWatcherUserIds] = useState<number[]>(
    getTodoWatcherUserIds(initialTodo),
  )
  const [todoEditReviewerUserId, setTodoEditReviewerUserId] = useState<number | null>(
    initialTodo?.reviewerUserId ?? null,
  )
  const [todoEditModuleId, setTodoEditModuleId] = useState<number | null>(
    initialTodo?.moduleId ?? null,
  )
  const [isTodoDetailEditing, setIsTodoDetailEditing] = useState(false)
  const { markTodoNotesRead } = useTodoNoteReadState(currentUserId)
  const getTodoPagerReservedHeight = useCallback((viewportHeight: number) => {
    if (!compact) return viewportHeight < 820 ? 320 : 380
    return viewportHeight < 820 ? 18 : 24
  }, [compact])
  const { containerRef, itemsPerPage } = useAdaptivePageSize({
    compact,
    defaultPageSize: compact ? 6 : 6,
    itemHeight: compact ? 70 : 64,
    maxPageSize: compact ? 14 : 5,
    minPageSize: 2,
    pagerHeight: compact ? 48 : 0,
    reservedHeight: getTodoPagerReservedHeight,
  })

  const sortedTodos = useMemo(
    () => [...todos].sort(compareTodoStatusThenCreatedAtDesc),
    [todos],
  )
  const moduleFilterOptions = useMemo(() => {
    const modules = new Map<number, string>()
    let hasUnassignedModule = false
    for (const todo of todos) {
      if (todo.moduleId && todo.moduleName) {
        modules.set(todo.moduleId, todo.moduleName)
      } else {
        hasUnassignedModule = true
      }
    }
    return {
      hasUnassignedModule,
      modules: Array.from(modules, ([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    }
  }, [todos])
  const assigneeFilterOptions = useMemo(() => {
    const assignees = new Map<number, string>()
    let hasUnassignedAssignee = false
    for (const todo of todos) {
      if (todo.assigneeUserId && todo.assigneeName) {
        assignees.set(todo.assigneeUserId, todo.assigneeName)
      } else {
        hasUnassignedAssignee = true
      }
    }
    return {
      assignees: Array.from(assignees, ([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
      hasUnassignedAssignee,
    }
  }, [todos])
  const watcherFilterOptions = useMemo(
    () => getProjectAssignableUsers(project, memberships),
    [memberships, project],
  )
  const creatorFilterOptions = useMemo(
    () => getProjectAssignableUsers(project, memberships),
    [memberships, project],
  )
  const filteredTodos = useMemo(() => {
    const query = todoSearchQuery.trim().toLowerCase()
    return sortedTodos.filter((todo) => {
      const matchesSearch = !query || [
        todo.title,
        todoCode(todo.id),
        todo.moduleName ?? '',
        todo.assigneeName ?? '',
        getTodoWatcherNames(todo).join(' '),
        todo.creatorName ?? '',
        todo.priority,
        priorityCopy[todo.priority],
        todo.dueDate,
        todo.createdAt,
        `${todoConfirmationCopy[todo.confirmationStatus]} ${todo.confirmationStatus}`,
        todo.done ? '已完成 完成 done' : '未完成 待办 open',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
      return (
        matchesSearch &&
        matchesTodoFilterConditions(todo, todoFilterConditions, todoFilterJoin)
      )
    })
  }, [sortedTodos, todoFilterConditions, todoFilterJoin, todoSearchQuery])
  const totalPages = Math.max(1, Math.ceil(filteredTodos.length / itemsPerPage))
  const safePage = Math.min(page, totalPages - 1)
  const visibleTodos = compact
    ? filteredTodos.slice(safePage * itemsPerPage, safePage * itemsPerPage + itemsPerPage)
    : filteredTodos
  const activeFilterCount = todoFilterConditions.length
  const filterSummary = activeFilterCount > 0
    ? `已筛选 ${activeFilterCount} 条件`
    : '筛选'

  function applyTodoFilterState(next: {
    conditions: TodoFilterCondition[]
    join: TodoFilterJoin
    persist: boolean
  }) {
    setTodoFilterConditions(next.conditions)
    setTodoFilterJoin(next.join)
    setTodoFilterPersistenceEnabled(next.persist)
    if (next.persist) {
      saveTodoFilterPreference(project.id, currentUserId, {
        conditions: next.conditions,
        join: next.join,
      })
    } else {
      clearTodoFilterPreference(project.id, currentUserId)
    }
  }
  const editingTodo = editingTodoId
    ? sortedTodos.find((todo) => todo.id === editingTodoId) ?? null
    : null
  const editingProject = editingTodo
    ? projects.find((project) => project.id === editingTodo.projectId) ?? null
    : null
  const editingProjectMembers = editingProject
    ? getProjectAssignableUsers(editingProject, memberships)
    : []
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )
  const editingCanManageTodo = Boolean(
    editingTodo &&
      editingProject &&
      !editingProject.readOnly &&
      currentUserId != null &&
      editingTodo.createdByUserId === currentUserId,
  )
  const editingCanManageTodoFields = Boolean(
    editingTodo && editingProject && (
      canManageOrganizationTodos || editingCanManageTodo
    ),
  )
  const editingCanRespondToTodo = editingTodo ? canRespondToTodo(editingTodo) : false

  function canShareTodo(todo: Todo) {
    const project = projectById.get(todo.projectId)
    return Boolean(currentUserId != null && project)
  }

  function canManageTodo(todo: Todo) {
    const project = projectById.get(todo.projectId)
    return !project?.readOnly && (
      project?.accessRole === 'owner' || todo.createdByUserId === currentUserId
    )
  }

  function canRespondToTodo(todo: Todo) {
    const project = projectById.get(todo.projectId)
    return Boolean(
      currentUserId != null &&
      !project?.readOnly &&
      (
        project?.accessRole === 'owner' ||
        todo.assigneeUserId === currentUserId ||
        todo.reviewerUserId === currentUserId
      ),
    )
  }

  function canSubmitTodoForReview(todo: Todo) {
    return !todo.done && todo.confirmationStatus !== 'rejected' && canRespondToTodo(todo)
  }

  function canToggleTodoDone(todo: Todo) {
    const project = projectById.get(todo.projectId)
    const effectiveReviewerUserId = todo.reviewerUserId ?? todo.createdByUserId ?? project?.ownerUserId
    const isTodoCreator = currentUserId != null && (
      todo.createdByUserId === currentUserId ||
      (todo.createdByUserId == null && project?.ownerUserId === currentUserId)
    )
    const isReviewer = currentUserId != null && (
      isTodoCreator || effectiveReviewerUserId === currentUserId
    )
    return (
      (isTodoCreator || isReviewer && (
        todo.reviewerUserId == null ||
        todo.confirmationStatus === 'pending_review' ||
        todo.done
      ))
    ) && todo.confirmationStatus !== 'rejected' && todo.confirmationStatus !== 'acceptance_failed'
  }

  function canUseTodoCheckbox(todo: Todo) {
    return canToggleTodoDone(todo) || canSubmitTodoForReview(todo)
  }

  useEffect(() => {
    setPage(0)
  }, [todoFilterConditions, todoFilterJoin, todoSearchQuery])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1))
  }, [totalPages])

  useEffect(() => {
    onDetailModeChange?.(Boolean(editingTodoId))
    return () => {
      onDetailModeChange?.(false)
    }
  }, [editingTodoId, onDetailModeChange])

  function handleTodoCheckboxClick(todo: Todo) {
    if (canToggleTodoDone(todo)) {
      if (!todo.done && todo.confirmationStatus === 'pending_review') {
        setTodoAcceptanceTarget(todo)
        return
      }
      onUpdateTodo?.(todo.id, { done: !todo.done })
      return
    }
    if (canSubmitTodoForReview(todo)) {
      setTodoPendingReviewTarget(todo)
    }
  }

  function closeEditDialog() {
    setEditingTodoId(null)
    setTodoEditDraft('')
    setTodoEditDetail('')
    setTodoEditCreatedAt(today)
    setTodoEditDueDate(today)
    setTodoEditPriority('medium')
    setTodoEditAssigneeUserId(null)
    setTodoEditWatcherUserIds([])
    setTodoEditReviewerUserId(null)
    setTodoEditModuleId(null)
    setIsTodoDetailEditing(false)
  }

  function syncTodoEditState(todo: Todo) {
    setTodoEditDraft(todo.title)
    setTodoEditDetail(todo.detail)
    setTodoEditCreatedAt(todo.createdAt.slice(0, 10))
    setTodoEditDueDate(todo.dueDate)
    setTodoEditPriority(todo.priority)
    setTodoEditAssigneeUserId(todo.assigneeUserId ?? null)
    setTodoEditWatcherUserIds(getTodoWatcherUserIds(todo))
    setTodoEditReviewerUserId(todo.reviewerUserId ?? null)
    setTodoEditModuleId(todo.moduleId ?? null)
  }

  function openTodoEditDialog(todo: Todo) {
    setEditingTodoId(todo.id)
    syncTodoEditState(todo)
    setIsTodoDetailEditing(false)
    markTodoNotesRead(todo)
  }

  function cancelTodoEdit() {
    if (!editingTodo) return
    syncTodoEditState(editingTodo)
    setIsTodoDetailEditing(false)
  }

  async function saveTodoEdit() {
    if (!editingTodo || !editingProject || !editingCanManageTodo || !onUpdateTodo) return
    const nextTitle = stripTodoMentions(
      todoEditDraft,
      getProjectMentionOptions(editingProject.id, projects, memberships),
    ).trim()
    if (!nextTitle) return
    const updated = await onUpdateTodo(editingTodo.id, {
      detail: todoEditDetail,
      title: nextTitle,
      createdAt: todoEditCreatedAt,
      dueDate: todoEditDueDate,
      priority: todoEditPriority,
      assigneeUserId: todoEditAssigneeUserId,
      watcherUserIds: todoEditWatcherUserIds,
      reviewerUserId: todoEditReviewerUserId,
      moduleId: todoEditModuleId,
    })
    if (updated === false) return
    setIsTodoDetailEditing(false)
  }

  if (editingProject && editingTodo) {
    return (
      <div
        className={compact ? 'todo-list-shell compact todo-detail-shell' : 'todo-list-shell todo-detail-shell'}
        ref={containerRef}
      >
        <TodoAcceptanceDialog
          open={Boolean(todoAcceptanceTarget)}
          onOpenChange={(open) => {
            if (!open) setTodoAcceptanceTarget(null)
          }}
          onSubmit={async (decision, note) => {
            if (!todoAcceptanceTarget || !onUpdateTodo) return false
            const passed = decision === 'passed'
            const saved = await onUpdateTodo(todoAcceptanceTarget.id, {
              done: passed,
              confirmationStatus: passed ? 'confirmed' : 'acceptance_failed',
              ...(passed ? {} : { acceptanceNote: note }),
            })
            return saved !== false
          }}
        />
        <TodoEditorDialog
          departedUserIds={departedUserIds}
          assigneeUserId={todoEditAssigneeUserId}
          watcherUserIds={todoEditWatcherUserIds}
          reviewerUserId={todoEditReviewerUserId}
          backLabel={detailBackLabel}
          createdAt={todoEditCreatedAt}
          detail={todoEditDetail}
          dueDate={todoEditDueDate}
          members={editingProjectMembers}
          mode="detail"
          moduleId={todoEditModuleId}
          modules={editingProject.modules}
          open
          priority={todoEditPriority}
          project={editingProject}
          canEdit={editingCanManageTodo}
          canEditProperties={editingCanManageTodoFields}
          canRespondToTodo={editingCanRespondToTodo}
          canShare={canShareTodo(editingTodo)}
          currentUserId={currentUserId}
          isEditing={isTodoDetailEditing}
          submitDisabled={!todoEditDraft.trim()}
          title={todoEditDraft}
          todo={editingTodo}
          onAssigneeUserIdChange={setTodoEditAssigneeUserId}
          onWatcherUserIdsChange={setTodoEditWatcherUserIds}
          onReviewerUserIdChange={setTodoEditReviewerUserId}
          onBack={onDetailBack}
          onCancelEdit={cancelTodoEdit}
          onCreateTodoNote={onCreateTodoNote}
          onCreatedAtChange={setTodoEditCreatedAt}
          onDetailChange={setTodoEditDetail}
          onDueDateChange={setTodoEditDueDate}
          onModuleIdChange={setTodoEditModuleId}
          onOpenChange={(open) => {
            if (!open) closeEditDialog()
          }}
          onPriorityChange={setTodoEditPriority}
          onReject={(rejectionReason) => {
            void onUpdateTodo?.(editingTodo.id, {
              confirmationStatus: 'rejected',
              rejectionReason,
            })
          }}
          onRequestAcceptance={() => {
            if (canToggleTodoDone(editingTodo)) setTodoAcceptanceTarget(editingTodo)
          }}
          onStartEdit={() => setIsTodoDetailEditing(true)}
          onSubmit={saveTodoEdit}
          onTitleChange={setTodoEditDraft}
          onInlineUpdate={(payload) => {
            if ((!editingCanManageTodoFields && !editingCanRespondToTodo) || !onUpdateTodo) return
            onUpdateTodo(editingTodo.id, payload)
          }}
          onUpdateTodoNote={onUpdateTodoNote}
        />
      </div>
    )
  }

  return (
    <div className={compact ? 'todo-list-shell compact' : 'todo-list-shell'} ref={containerRef}>
      <div className="todo-list-filters" aria-label="待办筛选">
        <div className="todo-search-field">
          <MagnifyingGlass size={14} />
          <Input
            aria-label="搜索待办"
            placeholder="搜索编号、标题或待办信息..."
            value={todoSearchQuery}
            onChange={(event) => setTodoSearchQuery(event.target.value)}
          />
        </div>
        <Button
          className={activeFilterCount > 0 ? 'todo-filter-open-button active' : 'todo-filter-open-button'}
          type="button"
          variant="outline"
          onClick={() => setTodoFilterDialogOpen(true)}
        >
          <FunnelSimple size={14} />
          {filterSummary}
        </Button>
        {activeFilterCount > 0 ? (
          <Button
            className="todo-filter-clear-button"
            type="button"
            variant="ghost"
            onClick={() => {
              applyTodoFilterState({
                conditions: [],
                join: 'and',
                persist: todoFilterPersistenceEnabled,
              })
            }}
          >
            清除
          </Button>
        ) : null}
        <TodoFilterBuilderDialog
          assigneeOptions={assigneeFilterOptions.assignees}
          conditions={todoFilterConditions}
          creatorOptions={creatorFilterOptions}
          defaultConditions={defaultTodoFilterState.conditions}
          defaultJoin={defaultTodoFilterState.join}
          join={todoFilterJoin}
          moduleOptions={moduleFilterOptions.modules}
          watcherOptions={watcherFilterOptions}
          open={todoFilterDialogOpen}
          onOpenChange={setTodoFilterDialogOpen}
          persistFilters={todoFilterPersistenceEnabled}
          onApply={applyTodoFilterState}
        />
      </div>
      <Dialog
        open={Boolean(todoPendingReviewTarget)}
        onOpenChange={(open) => {
          if (!open) setTodoPendingReviewTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交验收？</DialogTitle>
            <DialogDescription>
              非待办创建人不能完成任务，只能提交验收，是否确认提交？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setTodoPendingReviewTarget(null)}
            >
              取消
            </Button>
            <Button
              className="solid-button"
              type="button"
              onClick={() => {
                if (!todoPendingReviewTarget) return
                onUpdateTodo?.(todoPendingReviewTarget.id, { confirmationStatus: 'pending_review' })
                setTodoPendingReviewTarget(null)
              }}
            >
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TodoAcceptanceDialog
        open={Boolean(todoAcceptanceTarget)}
        onOpenChange={(open) => {
          if (!open) setTodoAcceptanceTarget(null)
        }}
        onSubmit={async (decision, note) => {
          if (!todoAcceptanceTarget || !onUpdateTodo) return false
          const passed = decision === 'passed'
          const saved = await onUpdateTodo(todoAcceptanceTarget.id, {
            done: passed,
            confirmationStatus: passed ? 'confirmed' : 'acceptance_failed',
            ...(passed ? {} : { acceptanceNote: note }),
          })
          return saved !== false
        }}
      />
      {sortedTodos.length === 0 ? (
        <p className="empty-state">暂时没有待办。</p>
      ) : filteredTodos.length === 0 ? (
        <p className="empty-state">没有符合筛选条件的待办。</p>
      ) : (
        <div className={compact ? 'todo-list compact' : 'todo-list'}>
          {visibleTodos.map((todo) => {
            const project = projects.find((item) => item.id === todo.projectId)
            const rowCanManageTodo = canManageTodo(todo)
            const rowCanRespondToTodo = canRespondToTodo(todo)
            const isCheckboxDisabled = !canUseTodoCheckbox(todo)
            const checkboxLabel = canToggleTodoDone(todo)
              ? (todo.done ? '标记为未完成' : '标记为已完成')
              : '提交验收'
            const indicators = getTodoContentIndicators(todo)
            return (
              <article
                className={[
                  'todo-item',
                  todo.moduleName ? 'has-module' : '',
                  todo.done ? 'done' : '',
                ].filter(Boolean).join(' ')}
                key={todo.id}
              >
                <button
                  className={[
                    'checkmark',
                    'todo-select-checkbox',
                    todo.done ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  type="button"
                  role="checkbox"
                  aria-checked={todo.done}
                  disabled={isCheckboxDisabled}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleTodoCheckboxClick(todo)
                  }}
                  aria-label={checkboxLabel}
                >
                  {todo.done ? <Check size={14} /> : null}
                </button>
                <button className="todo-main" type="button" onClick={() => openTodoEditDialog(todo)}>
                  <span className="todo-title-row">
                    <code className="todo-code">{todoCode(todo.id)}</code>
                    <strong>{todo.title}</strong>
                  </span>
                  <small>
                    <span className="todo-created-at">
                      {todo.creatorName ? <><UserName departedUserIds={departedUserIds} name={todo.creatorName} userId={todo.createdByUserId} /> 创建于 {todo.createdAt.slice(0, 16)}</> : `创建于 ${todo.createdAt.slice(0, 16)}`}
                    </span>
                    {compact ? `截止 ${todo.dueDate}` : `${project?.name} · 截止 ${todo.dueDate}`}
                    {todo.assigneeName && (
                      <span className="todo-assignee-inline">@<UserName departedUserIds={departedUserIds} name={todo.assigneeName} userId={todo.assigneeUserId} /></span>
                    )}
                    {getTodoWatcherNames(todo).length > 0 && (
                      <span className="todo-watcher-inline">
                        {formatTodoWatcherNames(todo)}
                      </span>
                    )}
                  </small>
                </button>
                <span
                  className={[
                    'todo-actions',
                    todo.linkedToDeliveryEvent ? 'has-delivery' : '',
                    rowCanManageTodo ? 'can-delete' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="todo-content-indicators-slot">
                    {indicators.infoCount > 0 || indicators.imageCount > 0 ? (
                      <button
                        className="todo-content-indicators"
                        type="button"
                        aria-label="查看待办详情、备注和图片"
                        title="查看待办详情"
                        onClick={() => openTodoEditDialog(todo)}
                      >
                        {indicators.infoCount > 0 ? (
                          <span
                            className="todo-content-indicator"
                            aria-label={`包含 ${indicators.infoCount} 条详情或备注`}
                            title={`详情/备注 ${indicators.infoCount}`}
                          >
                            <FileText size={15} />
                            <span>{indicators.infoCount}</span>
                          </span>
                        ) : null}
                        {indicators.imageCount > 0 ? (
                          <span
                            className="todo-content-indicator"
                            aria-label={`包含 ${indicators.imageCount} 张图片`}
                            title={`图片 ${indicators.imageCount}`}
                          >
                            <ImageSquare size={15} />
                            <span>{indicators.imageCount}</span>
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                  </span>
                  {todo.linkedToDeliveryEvent ? (
                    <span className="todo-delivery-tag-slot">
                      <Badge className="todo-delivery-tag">交付</Badge>
                    </span>
                  ) : null}
                  <Badge className={`priority ${todo.priority}`}>
                    {priorityCopy[todo.priority]}
                  </Badge>
                  <TodoConfirmSelect
                    done={todo.done}
                    status={todo.confirmationStatus}
                    disabled={!rowCanRespondToTodo}
                    onChange={(confirmationStatus) => onUpdateTodo?.(todo.id, { confirmationStatus })}
                    onReject={(rejectionReason) =>
                      onUpdateTodo?.(todo.id, {
                        confirmationStatus: 'rejected',
                        rejectionReason,
                      })
                    }
                    onRequestAcceptance={() => {
                      if (canToggleTodoDone(todo)) setTodoAcceptanceTarget(todo)
                    }}
                  />
                  {rowCanManageTodo ? (
                    <span className="todo-delete-slot">
                      <ConfirmDialog
                        confirmLabel="删除待办"
                        description={`删除「${todo.title}」后，这条待办将从当前项目移除。`}
                        onConfirm={() => onDeleteTodo?.(todo.id)}
                        title="确认删除这条待办？"
                        trigger={
                          <Button
                            className="todo-delete-button"
                            variant="ghost"
                            size="icon"
                            type="button"
                            aria-label="删除待办"
                          >
                            <Trash size={14} />
                          </Button>
                        }
                      />
                    </span>
                  ) : null}
                </span>
                {todo.moduleName ? (
                  <Badge className="todo-module-badge todo-module-corner">{todo.moduleName}</Badge>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
      {compact && totalPages > 1 && (
        <SidePager
          label="待办翻页"
          page={safePage}
          totalPages={totalPages}
          onPrevious={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
        />
      )}
    </div>
  )
}

function SidePager({
  label,
  onNext,
  onPrevious,
  page,
  totalPages,
}: {
  label: string
  onNext: () => void
  onPrevious: () => void
  page: number
  totalPages: number
}) {
  return (
    <div className="side-pager" aria-label={label}>
      <Button
        className="ghost-button side-pager-button"
        disabled={page === 0}
        type="button"
        variant="outline"
        onClick={onPrevious}
      >
        上一页
      </Button>
      <span>
        {page + 1} / {totalPages}
      </span>
      <Button
        className="ghost-button side-pager-button"
        disabled={page >= totalPages - 1}
        type="button"
        variant="outline"
        onClick={onNext}
      >
        下一页
      </Button>
    </div>
  )
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <h3>{title}</h3>
    </div>
  )
}

function getViewTitle(view: View, projectName: string) {
  if (view === 'project') return projectName
  if (view === 'my_work') return '我的待办'
  if (view === 'notifications') return '通知中心'
  if (view === 'inbox') return '草稿箱'
  if (view === 'search') return '项目篮子'
  if (view === 'organization') return '组织管理'
  if (view === 'weekly_report') return '周报管理'
  if (view === 'package_market') return '安装包市场'
  if (view === 'image_sync') return '镜像同步'
  if (view === 'changelog') return '更新日志'
  if (view === 'testing') return '测试工作台'
  if (view === 'assigned_bugs') return 'Bug 工作台'
  return 'Veges AI'
}

export default App
