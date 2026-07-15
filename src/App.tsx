import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import {
  Archive,
  AddressBook,
  Bell,
  Check,
  CopySimple,
  CornersIn,
  CornersOut,
  DotsThree,
  CaretDown,
  ImageSquare,
  PencilSimple,
  DownloadSimple,
  FileText,
  FunnelSimple,
  LinkSimple,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  ShoppingCartSimple,
  SignIn,
  SignOut,
  Sparkle,
  Sun,
  Target,
  Tray,
  Trash,
  WarningCircle,
  ArrowLeft,
  X,
} from '@phosphor-icons/react'
import { JournalDatePicker } from '@/components/journal-date-picker'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  addProjectPackageItems,
  archiveDraft,
  acceptProjectInvitation,
  createProjectModule,
  createDraft,
  createJournalEntry,
  createProjectPackageEvent,
  createProjectPackageOperation,
  createFeishuOAuthUrl,
  createProject,
  createRiskFromJournal,
  createSummary,
  createSummaryFromContent,
  createTodo,
  createTodoNote,
  exportProjectPackageTimeline,
  fetchPackageMarketBaseDetail,
  fetchPackageMarketBaseReleaseVersions,
  fetchPackageMarketCiVersions,
  fetchPackageMarketDetail,
  fetchPackageMarketReleaseVersions,
  fetchPackageMarketRules,
  fetchProjectPackageTimeline,
  fetchWorkspace,
  fetchAiSettings,
  fetchCurrentUser,
  fetchNotifications,
  getAuthToken,
  getProjectInviteLink,
  inviteProjectMember,
  markNotificationRead,
  loginAccount,
  registerAccount,
  clearAuthToken,
  removeDraft,
  removeJournalEntry,
  removeProjectPackageEvent,
  removeProjectPackageGroup,
  removeProjectPackageOperation,
  removeProject,
  removeProjectModule,
  removeProjectMember,
  removeTodo,
  acceptProjectInviteLink,
  resolveRiskFromJournal,
  declineProjectInvitation,
  disconnectFeishuAccount,
  updateJournalEntry,
  updateProjectPackageEvent,
  updateProjectPackageOperation,
  updateProject,
  updateProjectFeishuSettings,
  updateTodo,
  updateTodoNote,
  uploadTodoImage,
  updateAiSettings,
  updateCurrentPassword,
  setAuthToken,
  sendAiChat,
  updateCurrentUser,
  type AiAgentType,
  type AiChatMessage,
  type AiSettings,
  type AuthUser,
  type WorkspaceData,
} from './api'
import type {
  InboxItem,
  JournalVisibility,
  PackageMarketChannel,
  PackageMarketDetail,
  PackageMarketRule,
  PackageMarketVersion,
  NotificationCenterData,
  Priority,
  Project,
  ProjectModule,
  ProjectPackageEventStatus,
  ProjectPackageOperationStatus,
  ProjectPackageTimeline,
  ProjectPackageEventType,
  ProjectPackageOperationKind,
  ProjectMembership,
  ProjectStatus,
  Summary,
  Todo,
  TodoNotification,
  TodoNote,
} from './types'
import {
  ProjectPackageWorkbench,
  type ProjectPackageWorkbenchHandle,
} from './components/project-package-workbench'
import {
  removePackageEventNotification,
  removeTodoNotifications,
  startNotificationRefreshSchedule,
} from './notifications'
import './App.css'

type View = 'project' | 'inbox' | 'notifications' | 'search' | 'summaries'
type DetailEntrySource = 'project' | 'notifications'
type DisplayAiChatMessage = AiChatMessage & { createdAt: string }
type ThemeMode = 'dark' | 'light'
type TodoUpdatePayload = Omit<Partial<Todo>, 'assigneeUserId' | 'moduleId'> & {
  assigneeUserId?: number | null
  createdAt?: string
  moduleId?: number | null
  rejectionReason?: string
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
type ProjectDetailTab = 'journal' | 'packages'
type TodoFilterJoin = 'and' | 'or'
type TodoFilterField =
  | 'title'
  | 'module'
  | 'assignee'
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

const aiAgentMeta: Record<AiAgentType, { avatar: string; subtitle: string; title: string }> = {
  'project-summary': {
    avatar: 'V',
    subtitle: 'Veges AI Agent',
    title: '项目总结助理',
  },
  'conversation-analysis': {
    avatar: '析',
    subtitle: '群聊对话分析 Agent',
    title: '对话分析助理',
  },
}

const themeStorageKey = 'veges.theme'
const todoCreateDraftStoragePrefix = 'veges.todoCreateDraft.v1'

type TodoCreateDraftSnapshot = {
  assigneeUserId: number | null
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

function clearInviteTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('invite')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const todoNotesReadStoragePrefix = 'veges.todoNotesReadAt.v1'

function getDefaultTodoCreateDraft(): TodoCreateDraftSnapshot {
  return {
    assigneeUserId: null,
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

function loadTodoCreateDraft(projectId: number, userId?: number) {
  if (typeof window === 'undefined') return getDefaultTodoCreateDraft()
  try {
    const raw = window.localStorage.getItem(getTodoCreateDraftStorageKey(projectId, userId))
    if (!raw) return getDefaultTodoCreateDraft()
    const parsed = JSON.parse(raw) as Partial<TodoCreateDraftSnapshot>
    return {
      assigneeUserId: normalizeNullableNumber(parsed.assigneeUserId),
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

function getCurrentDateTimeStamp() {
  const parts = getShanghaiDateParts()
  return `${parts.date} ${parts.time}`
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

function TodoConfirmSelect({
  status,
  disabled = false,
  onChange,
  onReject,
}: {
  status: Todo['confirmationStatus']
  disabled?: boolean
  onChange: (status: Todo['confirmationStatus']) => void
  onReject: (reason: string) => void
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
    onChange(nextStatus)
  }

  function submitRejectReason() {
    if (!normalizedRejectReason) return
    onReject(normalizedRejectReason)
    setRejectReason('')
    setRejectDialogOpen(false)
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
          <SelectItem value="confirmed">已确认</SelectItem>
          <SelectItem value="rejected">已驳回</SelectItem>
        </SelectContent>
      </Select>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>填写驳回理由</DialogTitle>
            <DialogDescription>
              提交后，这条待办会被标记为已驳回，理由会保存到待办备注里。
            </DialogDescription>
          </DialogHeader>
          <Label className="todo-reject-reason-field">
            驳回理由
            <Textarea
              autoFocus
              placeholder="请输入驳回原因..."
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </Label>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setRejectReason('')
                setRejectDialogOpen(false)
              }}
            >
              取消
            </Button>
            <Button
              className="destructive-button"
              type="button"
              disabled={!normalizedRejectReason}
              onClick={submitRejectReason}
            >
              提交驳回
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

function getTodoFilterFieldValue(todo: Todo, field: TodoFilterField) {
  if (field === 'title') return todo.title
  if (field === 'module') return todo.moduleId ? String(todo.moduleId) : ''
  if (field === 'assignee') return todo.assigneeUserId ? String(todo.assigneeUserId) : ''
  if (field === 'creator') return todo.createdByUserId ? String(todo.createdByUserId) : ''
  if (field === 'priority') return todo.priority
  if (field === 'done') return todo.done ? 'done' : 'open'
  if (field === 'confirmationStatus') return todo.confirmationStatus
  if (field === 'dueDate') return todo.dueDate
  return todo.createdAt.slice(0, 10)
}

function matchesTodoFilterCondition(todo: Todo, condition: TodoFilterCondition) {
  const normalized = normalizeTodoFilterCondition(condition)
  const fieldValue = getTodoFilterFieldValue(todo, normalized.field)
  const targetValue = normalized.value

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
  if (project.accessRole !== 'member' || currentUserId == null) {
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
  assignedPackageEvents: [],
  assignedTodos: [],
  dueTomorrowTodos: [],
  noteMentions: [],
  invites: [],
}

const initialInbox: InboxItem[] = [
  {
    id: 1,
    source: 'manual',
    content:
      '想到一个 AIGC 工作台的关键点：生成结果需要能按品牌语气做二次筛选，不只是批量产出。',
    createdAt: '今天 14:42',
    suggestedProjectId: 1,
    processed: false,
  },
  {
    id: 2,
    source: 'feishu',
    content:
      '飞书群转发：业务方反馈数据看板里“激活用户”的口径和周报不一致，希望本周先统一。',
    createdAt: '今天 10:18',
    suggestedProjectId: 2,
    processed: false,
  },
  {
    id: 3,
    source: 'manual',
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
  const [authError, setAuthError] = useState('')
  const [inviteToken, setInviteToken] = useState(getInviteTokenFromUrl)
  const [view, setView] = useState<View>('search')
  const [projects, setProjects] = useState(initialProjects)
  const [todos, setTodos] = useState(initialTodos)
  const [memberships, setMemberships] = useState(initialMemberships)
  const [notifications, setNotifications] = useState(emptyNotifications)
  const [inbox, setInbox] = useState(initialInbox)
  const [summaries, setSummaries] = useState(initialSummaries)
  const [projectPackageTimelines, setProjectPackageTimelines] = useState<Record<number, ProjectPackageTimeline>>({})
  const [selectedProjectId, setSelectedProjectId] = useState(1)
  const [requestedTodoDetailId, setRequestedTodoDetailId] = useState<number | null>(null)
  const [requestedPackageEventId, setRequestedPackageEventId] = useState<number | null>(null)
  const [detailEntrySource, setDetailEntrySource] = useState<DetailEntrySource>('project')
  const [isProjectTodoDetailActive, setIsProjectTodoDetailActive] = useState(false)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
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
  const initialAiMessages: DisplayAiChatMessage[] = []
  const [aiMessages, setAiMessages] = useState<DisplayAiChatMessage[]>(initialAiMessages)
  const [aiDraft, setAiDraft] = useState('')
  const [activeAiAgent, setActiveAiAgent] = useState<AiAgentType>('project-summary')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const packageWorkbenchRef = useRef<ProjectPackageWorkbenchHandle>(null)
  const acceptingInviteTokenRef = useRef('')
  const notificationRefreshRequestIdRef = useRef(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
    document.documentElement.dataset.theme = themeMode

    try {
      window.localStorage.setItem(themeStorageKey, themeMode)
    } catch {
      // Ignore storage failures so theme switching still works for the session.
    }
  }, [themeMode])

  const applyWorkspace = useCallback((data: WorkspaceData) => {
    setProjects(data.projects)
    setTodos(data.todos)
    setMemberships(data.memberships)
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
      if (data.projects.some((project) => project.id === current)) return current
      return data.projects[0]?.id ?? current
    })
  }, [])

  const refreshNotifications = useCallback(async () => {
    const requestId = notificationRefreshRequestIdRef.current + 1
    notificationRefreshRequestIdRef.current = requestId
    try {
      const result = await fetchNotifications()
      if (notificationRefreshRequestIdRef.current === requestId) {
        setNotifications(result.notifications)
      }
      return result.notifications
    } catch {
      return emptyNotifications
    }
  }, [])

  useEffect(() => {
    if (!loggedIn) return

    fetchCurrentUser()
      .then((data) => {
        setAuthUser(data.user)
        applyWorkspace(data.workspace)
        void refreshNotifications()
        setWorkspaceError('')
      })
      .catch(() => {
        clearAuthToken()
        setLoggedIn(false)
        setWorkspaceError('')
        setAuthError('登录状态已失效，请重新登录。')
      })
      .finally(() => setWorkspaceLoaded(true))
  }, [applyWorkspace, loggedIn, refreshNotifications])

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
      refresh: () => {
        void refreshNotifications()
      },
      setInterval: (listener, delay) => window.setInterval(listener, delay),
    })
  }, [loggedIn, refreshNotifications])

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
        setAuthToken(token)
        setLoggedIn(true)
        setAuthError('')
        if (inviteToken) {
          setInviteToken('')
          clearInviteTokenFromUrl()
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
  }, [inviteToken])

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const selectedProjectDraftId = selectedProject?.id

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
    todoCreatedAt,
    todoDetailDraft,
    todoDraft,
    todoDueDate,
    todoModuleId,
    todoPriority,
  ])

  useEffect(() => {
    if (!loggedIn || !selectedProject || projectDetailTab !== 'packages') return
    if (projectPackageTimelines[selectedProject.id]) return

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
  }, [loggedIn, projectDetailTab, projectPackageTimelines, selectedProject])

  useEffect(() => {
    if (!loggedIn || !workspaceLoaded || !authUser || !inviteToken) return
    if (acceptingInviteTokenRef.current === inviteToken) return

    acceptingInviteTokenRef.current = inviteToken
    acceptProjectInviteLink(inviteToken)
      .then(({ workspace }) => {
        applyWorkspace(workspace)
        setWorkspaceError('')
        setInviteToken('')
        clearInviteTokenFromUrl()
      })
      .catch(() => {
        setWorkspaceError('项目邀请链接无效或已失效。')
      })
      .finally(() => {
        acceptingInviteTokenRef.current = ''
      })
  }, [applyWorkspace, authUser, inviteToken, loggedIn, workspaceLoaded])

  const toggleThemeMode = useCallback(() => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const projectTodos = selectedProject
    ? todos.filter((todo) => todo.projectId === selectedProject.id)
    : []
  const allTags = ['全部', ...Array.from(new Set(projects.flatMap((p) => p.tags)))]

  const filteredResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects
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
  }, [projects, search, statusFilter, summaries, tagFilter, todos])

  const openNotificationCount = useMemo(
    () =>
      notifications.invites.filter((item) => !item.dismissedAt).length +
      notifications.assignedPackageEvents.filter((item) => !item.dismissedAt).length +
      notifications.assignedTodos.filter((item) => !item.dismissedAt && !item.done).length +
      notifications.dueTomorrowTodos.filter((item) => !item.dismissedAt).length +
      notifications.noteMentions.filter((item) => !item.dismissedAt).length,
    [notifications],
  )

  async function signIn(username: string, password: string, mode: 'login' | 'register') {
    setAuthError('')
    try {
      const result =
        mode === 'register'
          ? await registerAccount({ username, password, inviteToken: inviteToken || undefined })
          : await loginAccount({ username, password, inviteToken: inviteToken || undefined })
      setAuthToken(result.token)
      setAuthUser(result.user)
      applyWorkspace(result.workspace)
      setLoggedIn(true)
      setWorkspaceLoaded(true)
      if (inviteToken) {
        setInviteToken('')
        clearInviteTokenFromUrl()
      }
      void refreshNotifications()
    } catch {
      setAuthError(mode === 'register' ? '注册失败，请确认用户名未被使用且密码不少于 6 位。' : '登录失败，请检查用户名和密码。')
    }
  }

  async function signInWithFeishu() {
    setAuthError('')
    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const result = await createFeishuOAuthUrl({
        inviteToken: inviteToken || undefined,
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
    notificationRefreshRequestIdRef.current += 1
    clearAuthToken()
    setLoggedIn(false)
    setAuthUser(null)
    setAuthError('')
    setWorkspaceError('')
    setWorkspaceLoaded(false)
    setNotifications(emptyNotifications)
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
    } catch {
      setWorkspaceError('账户设置保存失败，请稍后再试。')
    }
  }

  async function disconnectFeishuBinding() {
    const result = await disconnectFeishuAccount()
    setAuthUser(result.user)
    setWorkspaceError('')
    return result.user
  }

  async function runMutation(operation: () => Promise<WorkspaceData>) {
    try {
      const data = await operation()
      applyWorkspace(data)
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

  function selectProject(projectId: number) {
    setDetailEntrySource('project')
    setRequestedTodoDetailId(null)
    setRequestedPackageEventId(null)
    setSelectedProjectId(projectId)
    setJournalDraft('')
    setProjectDetailTab('journal')
    setView('project')
  }

  function selectNotificationTodo(projectId: number, todoId: number) {
    setDetailEntrySource('notifications')
    setRequestedTodoDetailId(todoId)
    setRequestedPackageEventId(null)
    setSelectedProjectId(projectId)
    setJournalDraft('')
    setProjectDetailTab('journal')
    setView('project')
  }

  function selectNotificationPackageEvent(projectId: number, eventId: number) {
    setDetailEntrySource('notifications')
    setRequestedTodoDetailId(null)
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

  function openNotificationCenter() {
    setDetailEntrySource('project')
    setView('notifications')
    void refreshNotifications()
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
    if (!content || !selectedProject) return

    await runMutation(() => createJournalEntry(selectedProject.id, content, createdAt))
    setJournalDraft('')
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
    const nextProject = projects.find((project) => project.id !== projectId)
    await runMutation(() => removeProject(projectId))
    clearTodoCreateDraft(projectId, authUser?.id)
    setSelectedProjectId(nextProject?.id ?? 0)
    setJournalDraft('')
    setTodoDraft('')
    setTodoDueDate(today)
    setTodoCreatedAt('')
    setTodoPriority('medium')
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

  async function copyProjectInviteLink(projectId: number) {
    const { token } = await getProjectInviteLink(projectId)
    const inviteUrl = buildProjectInviteUrl(token)
    if (!navigator.clipboard) throw new Error('Clipboard is not available')
    await navigator.clipboard.writeText(inviteUrl)
    return inviteUrl
  }

  async function addProjectModule(projectId: number) {
    const name = projectModuleDraft.trim()
    if (!name) return
    const data = await runMutation(() => createProjectModule(projectId, { name }))
    if (!data) return
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
    const title = stripTodoMentions(todoDraft, getProjectMentionOptions(targetProjectId, projects, memberships)).trim()
    if (!title || !targetProjectId) return
    const data = await runMutation(() =>
      createTodo({
        assigneeUserId: todoAssigneeUserId ?? undefined,
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
    setTodoModuleId(null)
  }

  async function toggleTodo(todoId: number) {
    const todo = todos.find((item) => item.id === todoId)
    if (!todo) return
    const completed = !todo.done
    const data = await runMutation(() => updateTodo(todoId, { done: completed }))
    if (data && completed) {
      setNotifications((current) => removeTodoNotifications(current, todoId))
    }
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
      setWorkspaceError('')
    } catch {
      setWorkspaceError('邀请处理失败，请稍后再试。')
    }
  }

  async function declineInvitation(membershipId: number) {
    try {
      const result = await declineProjectInvitation(membershipId)
      applyWorkspace(result.workspace)
      setNotifications(result.notifications)
      setWorkspaceError('')
    } catch {
      setWorkspaceError('邀请处理失败，请稍后再试。')
    }
  }

  async function dismissNotification(
    kind: 'project_invite' | 'assigned_todo' | 'package_event_assigned' | 'todo_due_tomorrow' | 'todo_note_mention',
    sourceId: number,
  ) {
    try {
      const result = await markNotificationRead(kind, sourceId, true)
      setNotifications(result.notifications)
      setWorkspaceError('')
    } catch {
      setWorkspaceError('通知状态更新失败，请稍后再试。')
    }
  }

  async function deleteTodo(todoId: number) {
    await runMutation(() => removeTodo(todoId))
  }

  async function generateSummary(projectId: number, type: Summary['type']) {
    await runMutation(() => createSummary(projectId, type))
    setView('summaries')
  }

  async function createInstallEvent(payload: {
    assigneeUserId: number
    deliveryDate: string
    title: string
    type: ProjectPackageEventType
  }) {
    if (!selectedProject) return
    try {
      const timeline = await createProjectPackageEvent(selectedProject.id, payload)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      await refreshNotifications()
      setWorkspaceError('')
    } catch {
      setWorkspaceError('安装事件创建失败，请稍后再试。')
    }
  }

  async function updateInstallEvent(
    eventId: number,
    payload: Partial<{
      assigneeUserId: number
      deliveryDate: string
      status: ProjectPackageEventStatus
      title: string
      type: ProjectPackageEventType
    }>,
  ) {
    if (!selectedProject) return
    try {
      const timeline = await updateProjectPackageEvent(selectedProject.id, eventId, payload)
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      if (payload.status && payload.status !== 'draft') {
        setNotifications((current) => removePackageEventNotification(current, eventId))
      }
      if (payload.status) {
        await refreshNotifications()
      }
      setWorkspaceError('')
    } catch {
      setWorkspaceError('安装事件更新失败，请稍后再试。')
    }
  }

  async function deleteInstallEvent(eventId: number) {
    if (!selectedProject) return
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
    } catch {
      setWorkspaceError('安装事件删除失败，请稍后再试。')
    }
  }

  async function addInstallItems(
    eventId: number,
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
    }>,
  ) {
    if (!selectedProject) return
    try {
      const timeline = await addProjectPackageItems(selectedProject.id, eventId, { items })
      setProjectPackageTimelines((current) => ({
        ...current,
        [selectedProject.id]: timeline,
      }))
      setWorkspaceError('')
    } catch {
      setWorkspaceError('安装包记录保存失败，请稍后再试。')
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

  async function exportInstallTimeline() {
    if (!selectedProject) return { fileName: '项目时间线.md', markdown: '' }
    try {
      const result = await exportProjectPackageTimeline(selectedProject.id)
      setWorkspaceError('')
      return result
    } catch {
      setWorkspaceError('安装升级时间线导出失败，请稍后再试。')
      throw new Error('安装升级时间线导出失败')
    }
  }

  async function loadPackageMarketRules(): Promise<{
    expireMinutes: number
    rules: PackageMarketRule[]
  }> {
    return fetchPackageMarketRules()
  }

  async function loadPackageMarketDetail(payload: {
    arch: string
    channel: PackageMarketChannel
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    expireMinutes?: number
    packageId: string
    releaseVersion?: string
  }): Promise<PackageMarketDetail> {
    if (payload.packageId === 'base-pro' || payload.packageId === 'base-oss') {
      return fetchPackageMarketBaseDetail({
        arch: payload.arch,
        channel: payload.channel,
        deployType: payload.packageId === 'base-oss' ? 'oss' : 'pro',
        expireMinutes: payload.expireMinutes,
        releaseVersion: payload.releaseVersion,
      })
    }

    return fetchPackageMarketDetail(payload)
  }

  async function loadPackageMarketVersions(payload: {
    arch: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    packageId: string
  }): Promise<PackageMarketVersion[]> {
    if (payload.kind === 'ci') {
      return (await fetchPackageMarketCiVersions({
        arch: payload.arch,
        packageId: payload.packageId,
      })).versions
    }

    if (payload.packageId === 'base-pro' || payload.packageId === 'base-oss') {
      return (await fetchPackageMarketBaseReleaseVersions({
        arch: payload.arch,
        deployType: payload.packageId === 'base-oss' ? 'oss' : 'pro',
      })).versions
    }

    return (await fetchPackageMarketReleaseVersions(payload)).versions
  }

  async function generateSummaryFromAiMessage(message: DisplayAiChatMessage) {
    const content = message.content.trim()
    const projectId = selectedProject?.id ?? projects[0]?.id
    if (!content || !projectId) return

    await runMutation(() =>
      createSummaryFromContent({
        content,
        projectId,
        title: `${message.createdAt.slice(0, 10)} AI 生成总结`,
        type: 'weekly',
      }),
    )
  }

  async function sendAgentMessage() {
    const content = aiDraft.trim()
    if (!content || aiBusy) return

    const nextMessages: DisplayAiChatMessage[] = [
      ...aiMessages,
      { role: 'user', content, createdAt: getCurrentDateTimeStamp() },
    ]
    setAiMessages(nextMessages)
    setAiDraft('')
    setAiBusy(true)
    setAiError('')

	    try {
	      const scopedProjectId =
	        activeAiAgent === 'project-summary' && selectedProject?.accessRole === 'member'
	          ? selectedProject.id
	          : undefined
	      const result = await sendAiChat(
	        nextMessages.map(({ role, content: messageContent }) => ({
	          role,
	          content: messageContent,
	        })),
	        activeAiAgent,
	        scopedProjectId,
	      )
      setAiMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: result.message,
          createdAt: getCurrentDateTimeStamp(),
        },
      ])
    } catch {
      setAiError('AI Agent 暂时没有响应，请先在左下角账号菜单的「AI 配置」里填写 Base URL、API Key 和模型。')
    } finally {
	    setAiBusy(false)
	  }
	}

	function changeActiveAiAgent(agentType: AiAgentType) {
	  setActiveAiAgent(agentType)
	  setAiMessages([])
	  setAiDraft('')
	  setAiError('')
	}

  async function exportMarkdown(projectId?: number) {
    const targets = projectId
      ? projects.filter((project) => project.id === projectId)
      : projects.filter((project) => project.accessRole === 'owner')
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
    link.download = projectId ? `${targets[0]?.name}.md` : 'Veges-个人项目驾驶舱导出.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        error={authError}
        hasProjectInvite={Boolean(inviteToken)}
        onClearError={() => setAuthError('')}
        onFeishuSignIn={signInWithFeishu}
        onSignIn={signIn}
      />
    )
  }

  if (!workspaceLoaded && !authUser) {
    return <WorkspaceBootScreen />
  }

  const hideSidebar = view === 'project' && projectDetailTab === 'packages'

  return (
    <main className={hideSidebar ? 'app-shell sidebar-hidden' : 'app-shell'}>
      {!hideSidebar && (
        <aside className="sidebar" aria-label="主导航">
          <div className="brand-block">
            <img className="brand-mark" src="/favicon.svg" alt="Veges" />
            <div>
              <p className="eyebrow">Veges</p>
              <h1>项目篮子</h1>
            </div>
          </div>
          <nav className="nav-list">
            <NavButton active={view === 'search'} onClick={() => setView('search')}>
              <Target size={18} weight="duotone" /> 项目篮子
            </NavButton>
            <NavButton active={view === 'notifications'} onClick={openNotificationCenter}>
              <Bell size={18} weight="duotone" /> 通知中心
              {openNotificationCount > 0 && (
                <Badge className="nav-badge">{openNotificationCount}</Badge>
              )}
            </NavButton>
            <NavButton active={view === 'inbox'} onClick={() => setView('inbox')}>
              <Tray size={18} weight="duotone" /> 草稿箱
            </NavButton>
            <NavButton active={view === 'summaries'} onClick={() => setView('summaries')}>
              <FileText size={18} weight="duotone" /> AI 总结
            </NavButton>
          </nav>
          <AccountMenu
            user={authUser}
            themeMode={themeMode}
            onSaveAiSettings={updateAiSettings}
            onLoadAiSettings={fetchAiSettings}
            onDisconnectFeishu={disconnectFeishuBinding}
            onSaveAccountSettings={updateAccountSettings}
            onSignOut={signOut}
            onToggleTheme={toggleThemeMode}
          />
        </aside>
      )}

      <section className={view === 'project' ? 'workspace cockpit-workspace' : 'workspace'}>
        {!(view === 'project' && isProjectTodoDetailActive) ? (
          <header className="topbar">
            <div>
              <div className="topbar-title-row">
                {view === 'project' && (
                  <Button
                    className={detailEntrySource === 'notifications'
                      ? 'ghost-button summary-back-button'
                      : 'detail-back-button'}
                    type="button"
                    variant={detailEntrySource === 'notifications' ? 'outline' : 'ghost'}
                    size={detailEntrySource === 'notifications' ? 'sm' : 'icon'}
                    aria-label={detailEntrySource === 'notifications'
                      ? '返回通知中心'
                      : projectDetailTab === 'packages' ? '返回项目日记' : '返回项目篮子'}
                    title={detailEntrySource === 'notifications'
                      ? '返回通知中心'
                      : projectDetailTab === 'packages' ? '返回项目日记' : '返回项目篮子'}
                    onClick={() => {
                      if (detailEntrySource === 'notifications') {
                        returnToNotifications()
                        return
                      }
                      if (projectDetailTab === 'packages') {
                        setProjectDetailTab('journal')
                        return
                      }
                      setView('search')
                    }}
                  >
                    <ArrowLeft size={18} />
                    {detailEntrySource === 'notifications' ? '返回' : null}
                  </Button>
                )}
                <h2>{getViewTitle(view, selectedProject?.name ?? '项目篮子')}</h2>
                {view === 'project' && selectedProject && (
                  <ProjectTags tags={selectedProject.tags} />
                )}
              </div>
            </div>
            <div className={view === 'project' ? 'topbar-actions project-topbar-actions' : 'topbar-actions'}>
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
                  {selectedProject && (
                    <Button
                      className="solid-button"
                      type="button"
                      disabled={
                        (projectPackageTimelines[selectedProject.id]?.events.length ?? 0) === 0
                      }
                      onClick={() => packageWorkbenchRef.current?.openPackageMarket()}
                    >
                      <ShoppingCartSimple size={17} /> 添加事件安装包
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {view === 'project' && selectedProject && (
                    <Button
                      className="solid-button"
                      type="button"
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
                          memberships={memberships.filter(
                            (membership) => membership.projectId === selectedProject.id,
                          )}
                          onCopyInviteLink={() => copyProjectInviteLink(selectedProject.id)}
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
            {workspaceError || '正在从数据库同步工作区...'}
          </div>
        )}

        {view === 'project' && selectedProject && (
          <ProjectDetail
            key={selectedProject.id}
            initialTodoId={requestedTodoDetailId}
            notificationDetailActive={detailEntrySource === 'notifications'}
            journalDraft={journalDraft}
            packageTimeline={projectPackageTimelines[selectedProject.id] ?? null}
            packageWorkbenchRef={packageWorkbenchRef}
            projectDetailTab={projectDetailTab}
            onAddTodo={addTodo}
            onCreateInstallEvent={createInstallEvent}
            onCreateInstallOperation={createInstallOperation}
            onDeleteInstallEvent={deleteInstallEvent}
            onDeleteInstallGroup={deleteInstallGroup}
            onDeleteInstallOperation={deleteInstallOperation}
            onDraftChange={setJournalDraft}
            onExportInstallTimeline={exportInstallTimeline}
            onInstallLoadMarketDetail={loadPackageMarketDetail}
            onInstallLoadMarketRules={loadPackageMarketRules}
            onInstallLoadMarketVersions={loadPackageMarketVersions}
            onInstallSelectPackages={addInstallItems}
            onTodoDetailViewChange={setIsProjectTodoDetailActive}
            onReturnToNotifications={returnToNotifications}
            onUpdateInstallEvent={updateInstallEvent}
            onUpdateInstallOperation={updateInstallOperation}
            onSaveJournal={saveJournal}
            onDeleteJournalEntry={deleteJournalEntry}
            onEditJournalEntry={editJournalEntry}
            onToggleJournalRisk={toggleJournalRisk}
            onUpdateJournalVisibility={updateJournalVisibility}
            onDeleteTodo={deleteTodo}
            onCreateTodoNote={addTodoNote}
            onUpdateTodo={updateTodoDetails}
            onUpdateTodoNote={editTodoNote}
            onTodoCreateDraftClear={clearTodoCreateDraftState}
            onTodoAssigneeChange={setTodoAssigneeUserId}
            onTodoCreatedAtChange={setTodoCreatedAt}
            onTodoDueDateChange={setTodoDueDate}
            onTodoDetailDraftChange={setTodoDetailDraft}
            onTodoDraftChange={setTodoDraft}
            onTodoModuleChange={setTodoModuleId}
            onTodoPriorityChange={setTodoPriority}
            project={selectedProject}
            currentUser={authUser}
            memberships={memberships}
            projects={projects}
            projectTodos={projectTodos}
            todoAssigneeUserId={todoAssigneeUserId}
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
            projects={projects}
          />
        )}

        {view === 'notifications' && (
          <NotificationCenterView
            currentUserId={authUser?.id}
            notifications={notifications}
            onAcceptInvitation={acceptInvitation}
            onDeclineInvitation={declineInvitation}
            onDismissNotification={dismissNotification}
            onPackageEventClick={selectNotificationPackageEvent}
            onTodoClick={selectNotificationTodo}
            onToggleTodo={toggleTodo}
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

	        {view === 'summaries' && (
	          <SummaryView
	            activeAiAgent={activeAiAgent}
	            aiBusy={aiBusy}
	            aiDraft={aiDraft}
	            aiError={aiError}
	            aiMessages={aiMessages}
	            onAiDraftChange={setAiDraft}
	            onAgentChange={changeActiveAiAgent}
	            onCreateSummaryFromAiMessage={generateSummaryFromAiMessage}
            onResetAiChat={() => {
              setAiMessages(initialAiMessages)
              setAiDraft('')
              setAiError('')
            }}
            onSendAgentMessage={sendAgentMessage}
            projects={projects}
            summaries={summaries}
          />
        )}
      </section>
    </main>
  )
}

function WorkspaceBootScreen() {
  return (
    <main className="workspace-boot-screen" aria-busy="true">
      <div className="workspace-boot-panel">
        <img className="brand-mark" src="/favicon.svg" alt="Veges" />
        <div>
          <p className="eyebrow">Veges - 个人项目驾驶舱</p>
          <h1>正在同步工作区</h1>
          <p>稍等一下，正在连接线上数据。</p>
        </div>
      </div>
    </main>
  )
}

function LoginScreen({
  error,
  hasProjectInvite,
  onClearError,
  onFeishuSignIn,
  onSignIn,
}: {
  error: string
  hasProjectInvite: boolean
  onClearError: () => void
  onFeishuSignIn: () => Promise<void>
  onSignIn: (username: string, password: string, mode: 'login' | 'register') => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>(hasProjectInvite ? 'register' : 'login')
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

  return (
    <main className="login-screen">
      <section className="login-panel">
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
            if (mode === 'register' && password !== confirmPassword) {
              setFormError('两次输入的密码不一致。')
              return
            }
            onSignIn(username, password, mode)
          }}
        >
          <div className="auth-mode-switch">
            <Button
              className={mode === 'login' ? 'auth-mode active' : 'auth-mode'}
              type="button"
              variant="ghost"
              onClick={() => switchMode('login')}
            >
              登录
            </Button>
            <Button
              className={mode === 'register' ? 'auth-mode active' : 'auth-mode'}
              type="button"
              variant="ghost"
              onClick={() => switchMode('register')}
            >
              注册
            </Button>
          </div>
          {hasProjectInvite && (
            <div className="login-invite-note">
              <LinkSimple size={16} />
              <span>检测到项目邀请链接，注册或登录后会自动加入项目。</span>
            </div>
          )}
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
              ? '注册后会创建你的个人工作区，密码会加密保存。'
              : '使用你注册时设置的用户名和密码登录；也可以直接使用飞书账号登录或注册。'}
          </p>
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
  onLoadAiSettings,
  onDisconnectFeishu,
  user,
  themeMode,
  onSaveAccountSettings,
  onSaveAiSettings,
  onSignOut,
  onToggleTheme,
}: {
  onLoadAiSettings: () => Promise<{ settings: AiSettings }>
  onDisconnectFeishu: () => Promise<AuthUser>
  user: AuthUser | null
  themeMode: ThemeMode
  onSaveAccountSettings: (payload: {
    displayName: string
  }) => Promise<void>
  onSaveAiSettings: (payload: {
    apiKey?: string
    baseUrl: string
    model: string
  }) => Promise<{ settings: AiSettings }>
  onSignOut: () => void
  onToggleTheme: () => void
}) {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState(getUserDisplayName(user))
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState('')
  const [nextPasswordDraft, setNextPasswordDraft] = useState('')
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [feishuBindingBusy, setFeishuBindingBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [aiBaseUrlDraft, setAiBaseUrlDraft] = useState('')
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('')
  const [aiModelDraft, setAiModelDraft] = useState('')
  const [aiHasApiKey, setAiHasApiKey] = useState(false)
  const [aiSettingsBusy, setAiSettingsBusy] = useState(false)
  const [aiSettingsError, setAiSettingsError] = useState('')
  const displayName = getUserDisplayName(user)
  const accountMeta = user?.username ?? '尚未登录'

  function syncAccountDrafts() {
    setDisplayNameDraft(displayName)
    setAccountError('')
  }

  function resetPasswordForm() {
    setCurrentPasswordDraft('')
    setNextPasswordDraft('')
    setConfirmPasswordDraft('')
    setPasswordBusy(false)
  }

  function changeAccountDialogOpen(open: boolean) {
    setAccountDialogOpen(open)
    if (open) {
      syncAccountDrafts()
      return
    }
    resetPasswordForm()
    setAccountError('')
  }

  async function saveAccountSettings() {
    const displayNameValue = displayNameDraft.trim()
    if (!displayNameValue) {
      setAccountError('昵称不能为空。')
      return
    }

    const wantsPasswordChange =
      Boolean(currentPasswordDraft || nextPasswordDraft || confirmPasswordDraft)
    if (wantsPasswordChange && (!currentPasswordDraft || nextPasswordDraft.length < 6)) {
      setAccountError('请输入旧密码，并确保新密码不少于 6 位。')
      return
    }
    if (wantsPasswordChange && nextPasswordDraft !== confirmPasswordDraft) {
      setAccountError('两次输入的新密码不一致。')
      return
    }

    setAccountBusy(true)
    setPasswordBusy(wantsPasswordChange)
    setAccountError('')
    try {
      await onSaveAccountSettings({
        displayName: displayNameValue,
      })
      if (wantsPasswordChange) {
        await updateCurrentPassword({
          currentPassword: currentPasswordDraft,
          nextPassword: nextPasswordDraft,
        })
      }
      setAccountDialogOpen(false)
      resetPasswordForm()
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message
          ? error.message
          : wantsPasswordChange ? '保存失败，请确认旧密码是否正确。' : '保存失败，请稍后重试。',
      )
    } finally {
      setAccountBusy(false)
      setPasswordBusy(false)
    }
  }

  async function bindFeishuAccount() {
    setFeishuBindingBusy(true)
    setAccountError('')
    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const result = await createFeishuOAuthUrl({ returnTo })
      window.location.href = result.url
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message
          ? error.message
          : '飞书授权链接生成失败，请稍后重试。',
      )
      setFeishuBindingBusy(false)
    }
  }

  async function disconnectFeishu() {
    setFeishuBindingBusy(true)
    setAccountError('')
    try {
      const result = await onDisconnectFeishu()
      setDisplayNameDraft(result.displayName || result.username)
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message
          ? error.message
          : '解除飞书绑定失败，请稍后重试。',
      )
    } finally {
      setFeishuBindingBusy(false)
    }
  }

  async function openAiSettingsDialog() {
    setAiSettingsError('')
    setAiDialogOpen(true)
    setAiSettingsBusy(true)
    try {
      const result = await onLoadAiSettings()
      setAiBaseUrlDraft(result.settings.baseUrl)
      setAiApiKeyDraft('')
      setAiModelDraft(result.settings.model)
      setAiHasApiKey(result.settings.hasApiKey)
    } catch {
      setAiSettingsError('AI 配置读取失败，请稍后重试。')
    } finally {
      setAiSettingsBusy(false)
    }
  }

  async function saveAiSettings() {
    const baseUrl = aiBaseUrlDraft.trim()
    const apiKey = aiApiKeyDraft.trim()
    const model = aiModelDraft.trim()
    if (!baseUrl || !model || (!apiKey && !aiHasApiKey)) {
      setAiSettingsError('请填写 Base URL、API Key 和模型。')
      return
    }

    setAiSettingsBusy(true)
    setAiSettingsError('')
    try {
      const result = await onSaveAiSettings({
        baseUrl,
        model,
        ...(apiKey ? { apiKey } : {}),
      })
      setAiBaseUrlDraft(result.settings.baseUrl)
      setAiApiKeyDraft('')
      setAiModelDraft(result.settings.model)
      setAiHasApiKey(result.settings.hasApiKey)
      setAiDialogOpen(false)
    } catch {
      setAiSettingsError('AI 配置保存失败，请确认信息后重试。')
    } finally {
      setAiSettingsBusy(false)
    }
  }

  return (
    <div className="sidebar-footer">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="account-trigger" variant="outline" type="button">
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
            onSelect={(event) => {
              event.preventDefault()
              changeAccountDialogOpen(true)
            }}
          >
            <PencilSimple /> 账户设置
          </DropdownMenuItem>
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
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              openAiSettingsDialog()
            }}
          >
            <Sparkle /> AI 配置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut} variant="destructive">
            <SignOut /> 退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={accountDialogOpen} onOpenChange={changeAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>账户设置</DialogTitle>
            <DialogDescription>
              统一维护昵称、飞书通知身份和登录密码。绑定飞书账号后，可以接收 Veges 个人通知和群内 @。
            </DialogDescription>
          </DialogHeader>
          <form
            autoComplete="off"
            className="new-project-dialog-form account-settings-form"
            data-1p-ignore="true"
            data-lpignore="true"
            data-protonpass-ignore="true"
            onSubmit={(event) => {
              event.preventDefault()
              saveAccountSettings()
            }}
          >
            <div aria-hidden="true" className="autofill-decoys">
              <input autoComplete="username" name="username" tabIndex={-1} type="text" />
              <input autoComplete="current-password" name="password" tabIndex={-1} type="password" />
              <input autoComplete="new-password" name="new-password" tabIndex={-1} type="password" />
            </div>
            <Label>
              昵称
              <Input
                autoFocus
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-protonpass-ignore="true"
                maxLength={32}
                name="veges-account-display-name"
                required
                spellCheck={false}
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
              />
            </Label>
            <section className="feishu-binding-panel" aria-label="飞书账号绑定">
              <div>
                <strong>飞书账号</strong>
                <p>
                  {user?.feishuLinked
                    ? `已绑定${user.feishuEmail ? `：${user.feishuEmail}` : '，后续个人通知会发送到飞书。'}`
                    : '未绑定。绑定后，Veges 会通过 OAuth 自动获取你的飞书 open_id。'}
                </p>
              </div>
              <div className="feishu-binding-actions">
                <Button
                  type="button"
                  variant={user?.feishuLinked ? 'outline' : 'default'}
                  disabled={feishuBindingBusy}
                  onClick={bindFeishuAccount}
                >
                  <LinkSimple />
                  {feishuBindingBusy ? '处理中...' : user?.feishuLinked ? '重新绑定' : '绑定飞书账号'}
                </Button>
                {user?.feishuLinked && (
                  <Button
                    className="feishu-disconnect-button"
                    type="button"
                    variant="destructive"
                    disabled={feishuBindingBusy}
                    onClick={disconnectFeishu}
                  >
                    解除绑定
                  </Button>
                )}
              </div>
            </section>
            <p className="form-note">
              绑定过程会跳转到飞书授权页；授权成功后自动回到 Veges，并保存当前飞书用户的 open_id。
            </p>
            <div className="account-password-section">
              <strong>修改密码</strong>
              <p>可选项。需要修改密码时再填写下面三项。</p>
            </div>
            <Label>
              旧密码
              <Input
                autoComplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
                data-protonpass-ignore="true"
                name="veges-account-current-secret"
                type="password"
                value={currentPasswordDraft}
                onChange={(event) => setCurrentPasswordDraft(event.target.value)}
              />
            </Label>
            <Label>
              新密码
              <Input
                autoComplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
                data-protonpass-ignore="true"
                minLength={6}
                name="veges-account-next-secret"
                type="password"
                value={nextPasswordDraft}
                onChange={(event) => setNextPasswordDraft(event.target.value)}
              />
            </Label>
            <Label>
              确认新密码
              <Input
                autoComplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
                data-protonpass-ignore="true"
                minLength={6}
                name="veges-account-confirm-secret"
                type="password"
                value={confirmPasswordDraft}
                onChange={(event) => setConfirmPasswordDraft(event.target.value)}
              />
            </Label>
            {accountError && <p className="form-error">{accountError}</p>}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => changeAccountDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={accountBusy || passwordBusy}>
                {accountBusy || passwordBusy ? '保存中...' : '保存设置'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 配置</DialogTitle>
            <DialogDescription>
              配置后才可以使用 AI 总结。API Key 只会保存在你的账号配置里，重新打开时不会明文展示。
            </DialogDescription>
          </DialogHeader>
          <form
            className="new-project-dialog-form ai-settings-form"
            onSubmit={(event) => {
              event.preventDefault()
              saveAiSettings()
            }}
          >
            <Label>
              Base URL
              <Input
                autoFocus
                placeholder="https://api.openai.com"
                required
                value={aiBaseUrlDraft}
                onChange={(event) => setAiBaseUrlDraft(event.target.value)}
              />
            </Label>
            <Label>
              API Key
              <Input
                placeholder={aiHasApiKey ? '已保存，留空则继续使用原 Key' : '请输入 API Key'}
                required={!aiHasApiKey}
                type="password"
                value={aiApiKeyDraft}
                onChange={(event) => setAiApiKeyDraft(event.target.value)}
              />
            </Label>
            <Label>
              模型
              <Input
                placeholder="例如：gpt-4.1-mini"
                required
                value={aiModelDraft}
                onChange={(event) => setAiModelDraft(event.target.value)}
              />
            </Label>
            {aiSettingsError && <p className="form-error">{aiSettingsError}</p>}
            {aiHasApiKey && !aiApiKeyDraft && (
              <p className="form-note">当前已有 API Key，保存时留空会继续使用原 Key。</p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setAiDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={aiSettingsBusy}>
                {aiSettingsBusy ? '保存中...' : '保存配置'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyWorkspace({
  isNewProjectDialogOpen,
  newProjectName,
  newProjectTags,
  onAddProject,
  onNewProjectDialogOpenChange,
  onNewProjectNameChange,
  onNewProjectTagsChange,
}: {
  isNewProjectDialogOpen: boolean
  newProjectName: string
  newProjectTags: string
  onAddProject: () => void
  onNewProjectDialogOpenChange: (open: boolean) => void
  onNewProjectNameChange: (value: string) => void
  onNewProjectTagsChange: (value: string) => void
}) {
  return (
    <Card className="panel empty-workspace">
      <p className="eyebrow">新的个人工作区</p>
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
  initialTodoId,
  journalDraft,
  notificationDetailActive,
  packageTimeline,
  packageWorkbenchRef,
  projectDetailTab,
  onAddTodo,
  onCreateInstallEvent,
  onCreateInstallOperation,
  onDeleteInstallEvent,
  onDeleteInstallGroup,
  onDeleteInstallOperation,
  onDraftChange,
  onExportInstallTimeline,
  onInstallLoadMarketDetail,
  onInstallLoadMarketRules,
  onInstallLoadMarketVersions,
  onInstallSelectPackages,
  onUpdateInstallEvent,
  onUpdateInstallOperation,
  onSaveJournal,
  onDeleteJournalEntry,
  onEditJournalEntry,
  onToggleJournalRisk,
  onUpdateJournalVisibility,
  onCreateTodoNote,
  onDeleteTodo,
  onUpdateTodo,
  onUpdateTodoNote,
  onTodoCreateDraftClear,
  onTodoAssigneeChange,
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
  todoCreatedAt,
  todoDueDate,
  todoDetailDraft,
  todoDraft,
  todoModuleId,
  todoPriority,
}: {
  initialTodoId?: number | null
  journalDraft: string
  notificationDetailActive: boolean
  packageTimeline: ProjectPackageTimeline | null
  packageWorkbenchRef: RefObject<ProjectPackageWorkbenchHandle | null>
  projectDetailTab: ProjectDetailTab
  onAddTodo: () => void
  onCreateInstallEvent: (payload: {
    assigneeUserId: number
    deliveryDate: string
    title: string
    type: ProjectPackageEventType
  }) => Promise<void>
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
  onDeleteInstallEvent: (eventId: number) => Promise<void>
  onDeleteInstallGroup: (groupId: number) => Promise<void>
  onDeleteInstallOperation: (operationId: number) => Promise<void>
  onDraftChange: (value: string) => void
  onExportInstallTimeline: () => Promise<{ fileName: string; markdown: string }>
  onInstallLoadMarketDetail: (payload: {
    arch: string
    channel: PackageMarketChannel
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    packageId: string
    releaseVersion?: string
  }) => Promise<PackageMarketDetail>
  onInstallLoadMarketRules: () => Promise<{
    expireMinutes: number
    rules: PackageMarketRule[]
  }>
  onInstallLoadMarketVersions: (payload: {
    arch: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    packageId: string
  }) => Promise<PackageMarketVersion[]>
  onInstallSelectPackages: (
    eventId: number,
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
    }>,
  ) => Promise<void>
  onUpdateInstallEvent: (
    eventId: number,
    payload: Partial<{
      assigneeUserId: number
      deliveryDate: string
      status: ProjectPackageEventStatus
      title: string
      type: ProjectPackageEventType
    }>,
  ) => Promise<void>
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
  onSaveJournal: (createdAt?: string) => void
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
  onDeleteTodo: (todoId: number) => void
  onUpdateTodo: (id: number, payload: TodoUpdatePayload) => Promise<boolean>
  onUpdateTodoNote: (todoId: number, noteId: number, content: string) => void
  onTodoCreateDraftClear: (projectId?: number) => void
  onTodoAssigneeChange: (id: number | null) => void
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
  const isOwner = project.accessRole === 'owner'
  const hasTodoCreateDraft = Boolean(
    todoDraft.trim() ||
      todoDetailDraft.trim() ||
      todoCreatedAt ||
      todoDueDate !== today ||
      todoPriority !== 'medium' ||
      todoAssigneeUserId != null ||
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

  function savePastJournal() {
    if (!journalDraft.trim()) return
    onSaveJournal(pastJournalDate)
    setPastJournalDialogOpen(false)
  }

  function closeTodoCreateDialog() {
    setIsTodoCreateDialogOpen(false)
  }

  async function handleAddTodo() {
    const hasDraft = Boolean(todoDraft.trim())
    await Promise.resolve(onAddTodo())
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
          : isProjectTodoFocusOpen
            ? 'detail-layout todo-detail-focus'
            : 'detail-layout'
      }
    >
      <div className="project-detail-main">
        {projectDetailTab === 'packages' ? (
          <ProjectPackageWorkbench
            ref={packageWorkbenchRef}
            onAddItems={onInstallSelectPackages}
            onCreateEvent={onCreateInstallEvent}
            onCreateOperation={onCreateInstallOperation}
            onDeleteEvent={onDeleteInstallEvent}
            onDeleteGroup={onDeleteInstallGroup}
            onDeleteOperation={onDeleteInstallOperation}
            onExportTimeline={onExportInstallTimeline}
            onLoadPackageMarketDetail={onInstallLoadMarketDetail}
            onLoadPackageMarketRules={onInstallLoadMarketRules}
            onLoadPackageMarketVersions={onInstallLoadMarketVersions}
            onUpdateEvent={onUpdateInstallEvent}
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
            <Label className="textarea-label journal-entry-label">
              <MentionTextarea
                members={projectMembers}
                placeholder="记录今天的进展、决策、问题或方案..."
                value={journalDraft}
                onChange={onDraftChange}
                onCompositionEnd={() => setIsJournalComposing(false)}
                onCompositionStart={() => setIsJournalComposing(true)}
                onKeyDown={(event) => handleJournalKeyDown(event, onSaveJournal)}
              />
            </Label>
            <div className="journal-save-actions">
              <Button className="solid-button" type="button" onClick={() => onSaveJournal()}>
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
            </Dialog>

            <div className="history-list">
              {visibleJournals.length > 0 ? (
                visibleJournals.map((entry) => {
                  const canEditEntry =
                    entry.authorUserId === currentUser?.id ||
                    (!entry.authorUserId && isOwner)
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
                  <div className="project-todo-header-actions">
                    <Button
                      className="todo-create-trigger"
                      type="button"
                      onClick={() => setIsTodoCreateDialogOpen(true)}
                    >
                      <Plus size={16} /> 添加待办
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
            <div className="side-panel-scroll-area">
              {isTodoCreateDialogOpen ? (
                <TodoEditorDialog
                  assigneeUserId={todoAssigneeUserId}
                  createdAt={todoCreatedAt}
                  detail={todoDetailDraft}
                  dueDate={todoDueDate}
                  members={projectMembers}
                  mode="create"
                  moduleId={todoModuleId}
                  modules={projectModules}
                  open={isTodoCreateDialogOpen}
                  priority={todoPriority}
                  project={project}
                  submitDisabled={!todoDraft.trim()}
                  title={todoDraft}
                  onAssigneeUserIdChange={onTodoAssigneeChange}
                  clearDisabled={!hasTodoCreateDraft}
                  onClear={() => onTodoCreateDraftClear(project.id)}
                  onCreatedAtChange={onTodoCreatedAtChange}
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
                  key={`project-todos-${project.id}-${project.accessRole}`}
                  currentUserId={currentUser?.id}
                  detailBackLabel={notificationDetailActive ? '返回' : undefined}
                  initialTodoId={initialTodoId}
                  memberships={memberships}
                  onCreateTodoNote={onCreateTodoNote}
                  onDeleteTodo={onDeleteTodo}
                  onDetailModeChange={setIsProjectTodoDetailOpen}
                  onDetailBack={notificationDetailActive ? onReturnToNotifications : undefined}
                  onUpdateTodo={onUpdateTodo}
                  onUpdateTodoNote={onUpdateTodoNote}
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

function ProjectMembersPanel({
  memberships,
  onCopyInviteLink,
  onInvite,
  onRemove,
  onSaveFeishuSettings,
  project,
}: {
  memberships: ProjectMembership[]
  onCopyInviteLink: () => Promise<string>
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
      await onCopyInviteLink()
      setInviteLinkStatus('已复制')
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
                  <strong>{membership.memberName}</strong>
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
            <p>复制给新成员，TA 注册或登录后会自动加入这个项目。</p>
          </div>
          <div className="project-invite-link-actions">
            <Button
              className="solid-button"
              type="button"
              disabled={isCopyingInviteLink}
              onClick={copyInviteLink}
            >
              <CopySimple size={15} />
              {isCopyingInviteLink ? '复制中' : inviteLinkStatus === '已复制' ? '已复制' : '复制链接'}
            </Button>
          </div>
          {inviteLinkStatus && inviteLinkStatus !== '已复制' ? (
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
    <div className="project-members-panel">
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
  generateWeeklySummary,
  onDeleteProject,
  onEditDescriptionClick,
  onRenameClick,
  projectName,
}: {
  exportProject: () => void
  generateWeeklySummary: () => void
  onDeleteProject: () => void
  onEditDescriptionClick: () => void
  onRenameClick: () => void
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
        <DropdownMenuItem onSelect={exportProject}>
          <DownloadSimple /> 导出项目
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={generateWeeklySummary}>
          <Sparkle /> 生成周总结
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
  currentUserId,
  notifications,
  onAcceptInvitation,
  onDeclineInvitation,
  onDismissNotification,
  onPackageEventClick,
  onTodoClick,
  onToggleTodo,
}: {
  currentUserId?: number
  notifications: NotificationCenterData
  onAcceptInvitation: (membershipId: number) => void
  onDeclineInvitation: (membershipId: number) => void
  onDismissNotification: (
    kind: 'project_invite' | 'assigned_todo' | 'package_event_assigned' | 'todo_due_tomorrow' | 'todo_note_mention',
    sourceId: number,
  ) => void
  onPackageEventClick: (projectId: number, eventId: number) => void
  onTodoClick: (projectId: number, todoId: number) => void
  onToggleTodo: (todoId: number) => void
}) {
  type NotificationFilter =
    | 'all'
    | 'invites'
    | 'assignedTodos'
    | 'assignedPackageEvents'
    | 'dueTomorrowTodos'
    | 'noteMentions'
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all')
  const visibleInvites = notifications.invites.filter((item) => !item.dismissedAt)
  const visibleAssignedPackageEvents = notifications.assignedPackageEvents.filter(
    (item) => !item.dismissedAt,
  )
  const visibleAssignedTodos = notifications.assignedTodos.filter(
    (item) => !item.dismissedAt && !item.done,
  )
  const visibleDueTomorrowTodos = notifications.dueTomorrowTodos.filter(
    (item) => !item.dismissedAt,
  )
  const visibleNoteMentions = notifications.noteMentions.filter(
    (item) => !item.dismissedAt,
  )
  const isEmpty =
    visibleInvites.length === 0 &&
    visibleAssignedPackageEvents.length === 0 &&
    visibleAssignedTodos.length === 0 &&
    visibleDueTomorrowTodos.length === 0 &&
    visibleNoteMentions.length === 0
  const showInvites = notificationFilter === 'all' || notificationFilter === 'invites'
  const showAssignedTodos = notificationFilter === 'all' || notificationFilter === 'assignedTodos'
  const showAssignedPackageEvents =
    notificationFilter === 'all' || notificationFilter === 'assignedPackageEvents'
  const showDueTomorrowTodos = notificationFilter === 'all' || notificationFilter === 'dueTomorrowTodos'
  const showNoteMentions = notificationFilter === 'all' || notificationFilter === 'noteMentions'
  const filteredEmpty =
    (showInvites ? visibleInvites.length : 0) +
      (showAssignedTodos ? visibleAssignedTodos.length : 0) +
      (showAssignedPackageEvents ? visibleAssignedPackageEvents.length : 0) +
      (showDueTomorrowTodos ? visibleDueTomorrowTodos.length : 0) +
      (showNoteMentions ? visibleNoteMentions.length : 0) ===
    0
  const toggleNotificationFilter = (filter: Exclude<NotificationFilter, 'all'>) => {
    setNotificationFilter((current) => (current === filter ? 'all' : filter))
  }

  function renderTodoNotificationProjectMeta(todo: TodoNotification, suffix: string) {
    return (
      <>
        {todo.projectName}
        {todo.moduleName ? (
          <Badge className="todo-module-badge notification-module-badge">{todo.moduleName}</Badge>
        ) : null}
        {suffix}
      </>
    )
  }

  return (
    <Card className="panel notification-center-panel">
      <div className="current-todos-header">
        <PanelTitle icon={<Bell size={18} />} title="通知中心" />
        <div className="current-todos-metrics" aria-label="通知统计">
          <button
            className={notificationFilter === 'invites' ? 'todo-metric active' : 'todo-metric'}
            type="button"
            aria-pressed={notificationFilter === 'invites'}
            onClick={() => toggleNotificationFilter('invites')}
          >
            <strong>{visibleInvites.length}</strong>
            邀请
          </button>
          <button
            className={notificationFilter === 'assignedTodos' ? 'todo-metric active' : 'todo-metric'}
            type="button"
            aria-pressed={notificationFilter === 'assignedTodos'}
            onClick={() => toggleNotificationFilter('assignedTodos')}
          >
            <strong>{visibleAssignedTodos.length}</strong>
            指派
          </button>
          <button
            className={
              notificationFilter === 'assignedPackageEvents' ? 'todo-metric active' : 'todo-metric'
            }
            type="button"
            aria-pressed={notificationFilter === 'assignedPackageEvents'}
            onClick={() => toggleNotificationFilter('assignedPackageEvents')}
          >
            <strong>{visibleAssignedPackageEvents.length}</strong>
            交付事件
          </button>
          <button
            className={notificationFilter === 'dueTomorrowTodos' ? 'todo-metric active' : 'todo-metric'}
            type="button"
            aria-pressed={notificationFilter === 'dueTomorrowTodos'}
            onClick={() => toggleNotificationFilter('dueTomorrowTodos')}
          >
            <strong>{visibleDueTomorrowTodos.length}</strong>
            明日到期
          </button>
          <button
            className={notificationFilter === 'noteMentions' ? 'todo-metric active' : 'todo-metric'}
            type="button"
            aria-pressed={notificationFilter === 'noteMentions'}
            onClick={() => toggleNotificationFilter('noteMentions')}
          >
            <strong>{visibleNoteMentions.length}</strong>
            备注提及
          </button>
        </div>
      </div>

      {isEmpty || filteredEmpty ? (
        <p className="empty-state">
          {isEmpty ? '暂时没有需要处理的通知。' : '没有符合筛选条件的通知。'}
        </p>
      ) : (
        <div className="notification-sections">
          {showInvites && visibleInvites.length > 0 && (
            <section className="notification-section">
              <h3 className="notification-section-title">
                项目邀请
                <span className="notification-kind">邀请</span>
              </h3>
              <div className="notification-list">
                {visibleInvites.map((invite) => (
                  <article className="notification-item" key={invite.id}>
                    <div>
                      <strong>{invite.projectName}</strong>
                      <p>{invite.invitedByName} 邀请你加入项目。</p>
                      <small>{invite.createdAt}</small>
                    </div>
                    <div className="notification-actions">
                      <Button
                        className="ghost-button"
                        type="button"
                        variant="outline"
                        onClick={() => onDeclineInvitation(invite.id)}
                      >
                        拒绝
                      </Button>
                      <Button
                        className="solid-button"
                        type="button"
                        onClick={() => onAcceptInvitation(invite.id)}
                      >
                        接受
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showAssignedTodos && visibleAssignedTodos.length > 0 && (
            <section className="notification-section">
              <h3 className="notification-section-title">
                指派给我
                <span className="notification-kind">待办</span>
              </h3>
              <div className="notification-list">
                {visibleAssignedTodos.map((todo) => (
                  <article className="notification-item" key={todo.id}>
                    <div>
                      <strong>{todo.title}</strong>
                      <p className="notification-meta-line">
                        {renderTodoNotificationProjectMeta(todo, ` · 截止 ${todo.dueDate}`)}
                        {todo.assignedByName ? ` · ${todo.assignedByName} 指派` : ''}
                        <span className={`notification-priority ${todo.priority}`}>
                          {priorityCopy[todo.priority]}
                        </span>
                      </p>
                    </div>
                    <div className="notification-actions">
                      <Button
                        className="ghost-button"
                        type="button"
                        variant="outline"
                        onClick={() => onTodoClick(todo.projectId, todo.id)}
                      >
                        查看待办
                      </Button>
                      <Button
                        className="solid-button"
                        type="button"
                        disabled={!currentUserId}
                        onClick={() => onToggleTodo(todo.id)}
                      >
                        完成
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showAssignedPackageEvents && visibleAssignedPackageEvents.length > 0 && (
            <section className="notification-section">
              <h3 className="notification-section-title">
                指派给我的交付事件
                <span className="notification-kind">事件</span>
              </h3>
              <div className="notification-list">
                {visibleAssignedPackageEvents.map((event) => (
                  <article className="notification-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <p className="notification-meta-line">
                        {event.projectName} · {event.eventType === 'init' ? '初始化安装' : '升级'}
                        {event.assignedByName ? ` · ${event.assignedByName} 指派` : ''}
                        <span className={`notification-priority ${event.eventStatus === 'delivered' ? 'low' : 'medium'}`}>
                          {event.eventStatus === 'delivered'
                            ? '已交付'
                            : event.eventStatus === 'delivering'
                              ? '交付中'
                              : '草稿'}
                        </span>
                      </p>
                    </div>
                    <div className="notification-actions">
                      <Button
                        className="ghost-button"
                        type="button"
                        variant="outline"
                        onClick={() => onPackageEventClick(event.projectId, event.id)}
                      >
                        查看交付事件
                      </Button>
                      <Button
                        className="solid-button"
                        type="button"
                        onClick={() => onDismissNotification('package_event_assigned', event.id)}
                      >
                        知道了
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showDueTomorrowTodos && visibleDueTomorrowTodos.length > 0 && (
            <section className="notification-section">
              <h3 className="notification-section-title">
                明日到期
                <span className="notification-kind">提醒</span>
              </h3>
              <div className="notification-list">
                {visibleDueTomorrowTodos.map((todo) => (
                  <article className="notification-item" key={todo.id}>
                    <div>
                      <strong>{todo.title}</strong>
                      <p className="notification-meta-line">
                        {renderTodoNotificationProjectMeta(todo, ' · 明天截止')}
                        <span className={`notification-priority ${todo.priority}`}>
                          {priorityCopy[todo.priority]}
                        </span>
                      </p>
                    </div>
                    <div className="notification-actions">
                      <Button
                        className="ghost-button"
                        type="button"
                        variant="outline"
                        onClick={() => onDismissNotification('todo_due_tomorrow', todo.id)}
                      >
                        忽略
                      </Button>
                      <Button
                        className="solid-button"
                        type="button"
                        onClick={() => onTodoClick(todo.projectId, todo.id)}
                      >
                        查看待办
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showNoteMentions && visibleNoteMentions.length > 0 && (
            <section className="notification-section">
              <h3 className="notification-section-title">
                备注提及我
                <span className="notification-kind">备注</span>
              </h3>
              <div className="notification-list">
                {visibleNoteMentions.map((note) => (
                  <article className="notification-item" key={`note-${note.noteId}`}>
                    <div>
                      <div className="notification-title-line">
                        <strong>{note.title}</strong>
                        <p className="notification-meta-line">
                          {renderTodoNotificationProjectMeta(note, '')}
                          {note.noteAuthorName ? ` · ${note.noteAuthorName} 提及了你` : ''}
                          <span className={`notification-priority ${note.priority}`}>
                            {priorityCopy[note.priority]}
                          </span>
                        </p>
                      </div>
                      {note.notePreview ? <p>{note.notePreview}</p> : null}
                      {note.createdAt ? <small>{note.createdAt}</small> : null}
                    </div>
                    <div className="notification-actions">
                      <Button
                        className="ghost-button"
                        type="button"
                        variant="outline"
                        onClick={() => note.noteId && onDismissNotification('todo_note_mention', note.noteId)}
                      >
                        忽略
                      </Button>
                      <Button
                        className="solid-button"
                        type="button"
                        onClick={() => onTodoClick(note.projectId, note.id)}
                      >
                        查看待办
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
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
  const images: TodoDetailImageAttachment[] = []
  const textParts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = todoDetailImagePattern.exec(content)

  while (match) {
    textParts.push(content.slice(lastIndex, match.index))
    images.push({
      alt: match[1] ?? '',
      src: match[2] ?? '',
      uploading: false,
    })
    lastIndex = todoDetailImagePattern.lastIndex
    match = todoDetailImagePattern.exec(content)
  }

  textParts.push(content.slice(lastIndex))
  todoDetailImagePattern.lastIndex = 0

  return {
    images: normalizeTodoDetailImages(images),
    text: images.length > 0
      ? textParts.join('').replace(/\n{3,}/g, '\n\n').replace(/\n{2,}$/g, '')
      : textParts.join(''),
  }
}

function serializeTodoDetailContent(text: string, images: TodoDetailImageAttachment[]) {
  const normalizedImages = normalizeTodoDetailImages(images)
  const hasText = text.trim().length > 0
  const imageMarkdown = normalizedImages
    .map((image) => `![${image.alt}](${image.src})`)
    .join('\n\n')

  if (hasText && imageMarkdown) return `${text}\n\n${imageMarkdown}`
  return hasText ? text : imageMarkdown
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
  window.requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionStart)
  })

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

function TodoDetailEditor({
  onChange,
  value,
}: {
  onChange: (value: string) => void
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
  const editorClassName = images.length > 0 ? 'todo-detail-editor has-images' : 'todo-detail-editor'

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

  function updateTodoDetail(nextText: string, nextImages: TodoDetailImageAttachment[]) {
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
        <Textarea
          className="todo-detail-textarea"
          placeholder="补充背景、目标、交付标准，支持直接粘贴图片。"
          value={textDraft}
          onChange={(event) => {
            const nextText = event.target.value
            setTextDraft(nextText)
            updateTodoDetail(nextText, images)
          }}
          onPaste={(event) => {
            void handlePaste(event)
          }}
        />
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
  members,
  onChange,
  placeholder,
  value,
}: {
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
  members,
  onChange,
  value,
}: {
  compact?: boolean
  disabled?: boolean
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
        <SelectTrigger aria-label="待办指派对象">
          <SelectValue placeholder="选择成员">
            {compact && selectedMember
              ? `@${selectedMember.name}`
              : compact
                ? '未指派'
                : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">未指派</SelectItem>
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

function ProjectModulePicker({
  compact = false,
  disabled = false,
  modules,
  onChange,
  value,
}: {
  compact?: boolean
  disabled?: boolean
  modules: ProjectModule[]
  onChange: (id: number | null) => void
  value: number | null
}) {
  const selectedModule = modules.find((module) => module.id === value)
  return (
    <span className={compact ? 'member-picker compact' : 'member-picker'}>
      <Select
        disabled={disabled}
        value={value ? String(value) : 'none'}
        onValueChange={(nextValue) => onChange(nextValue === 'none' ? null : Number(nextValue))}
      >
        <SelectTrigger aria-label="待办所属模块">
          <SelectValue placeholder="选择模块">
            {compact && selectedModule ? selectedModule.name : compact ? '无模块' : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">无模块</SelectItem>
          {modules.map((module) => (
            <SelectItem key={module.id} value={String(module.id)}>
              {module.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
                  <span>{item.source === 'feishu' ? '飞书转发' : '手动记录'}</span>
                  <span className="inbox-meta-right">
                    {isAiAnalyzing && <Badge className="ai-analyzing-badge">AI 分析中</Badge>}
                    <span>{item.createdAt}</span>
                  </span>
                </div>
                <MarkdownPreview content={item.content} compact />
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
        <p className="empty-state">先创建项目后再归档。</p>
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
        归档项目
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
        确认归档
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
  generateSummary: (projectId: number, type: Summary['type']) => void
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

  function openRenameDialog(project: Project) {
    setProjectNameDraft(project.name)
    setRenamingProject(project)
  }

  function openDescriptionDialog(project: Project) {
    setProjectDescriptionDraft(project.description)
    setEditingDescriptionProject(project)
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
                    <Badge className="access-pill">协作</Badge>
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
                  generateWeeklySummary={() => generateSummary(project.id, 'weekly')}
                  onDeleteProject={() => onDeleteProject(project.id)}
                  onEditDescriptionClick={() => openDescriptionDialog(project)}
                  onRenameClick={() => openRenameDialog(project)}
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
    </Card>
  )
}

function SummaryView({
  activeAiAgent,
  aiBusy,
  aiDraft,
  aiError,
  aiMessages,
  onAiDraftChange,
  onAgentChange,
  onCreateSummaryFromAiMessage,
  onResetAiChat,
  onSendAgentMessage,
  projects,
  summaries,
}: {
  activeAiAgent: AiAgentType
  aiBusy: boolean
  aiDraft: string
  aiError: string
  aiMessages: DisplayAiChatMessage[]
  onAiDraftChange: (value: string) => void
  onAgentChange: (agentType: AiAgentType) => void
  onCreateSummaryFromAiMessage: (message: DisplayAiChatMessage) => void
  onResetAiChat: () => void
  onSendAgentMessage: () => void
  projects: Project[]
  summaries: Summary[]
}) {
  const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null)
  const [isSummaryFullscreen, setIsSummaryFullscreen] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const activeAgentMeta = aiAgentMeta[activeAiAgent]
  const selectedSummary =
    summaries.find((summary) => summary.id === selectedSummaryId) ?? null
  const selectedProject = selectedSummary
    ? projects.find((project) => project.id === selectedSummary.projectId)
    : null
  const selectedDocumentOwner = selectedProject?.name ?? selectedSummary?.period ?? 'AI 总结文档'

  useEffect(() => {
    if (!isSummaryFullscreen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSummaryFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSummaryFullscreen])

  return (
    <div className={isSummaryFullscreen ? 'summary-layout is-document-fullscreen' : 'summary-layout'}>
      <Card className="panel ai-agent-panel">
	        <div className="agent-hero">
	          <div className="agent-orb">
	            {activeAgentMeta.avatar}
	          </div>
	          <div>
	            <h3>{activeAgentMeta.title}</h3>
	            <p>{activeAgentMeta.subtitle}</p>
	          </div>
	          <DropdownMenu>
	            <DropdownMenuTrigger asChild>
	              <Button
	                className="agent-new-chat-button"
	                type="button"
	                variant="ghost"
	                size="icon"
	                aria-label="选择 AI 助理"
	                title="选择 AI 助理"
	              >
	                <Plus size={28} />
	              </Button>
	            </DropdownMenuTrigger>
	            <DropdownMenuContent align="end" className="agent-menu-content">
	              <DropdownMenuItem
	                data-selected={activeAiAgent === 'project-summary'}
	                onSelect={() => onAgentChange('project-summary')}
	              >
	                <span className="agent-menu-check">
	                  {activeAiAgent === 'project-summary' && <Check size={13} weight="bold" />}
	                </span>
	                <span>
	                  <strong>项目总结助理</strong>
	                  <small>整理项目、待办、风险与总结</small>
	                </span>
	              </DropdownMenuItem>
	              <DropdownMenuItem
	                data-selected={activeAiAgent === 'conversation-analysis'}
	                onSelect={() => onAgentChange('conversation-analysis')}
	              >
	                <span className="agent-menu-check">
	                  {activeAiAgent === 'conversation-analysis' && <Check size={13} weight="bold" />}
	                </span>
	                <span>
	                  <strong>对话分析助理</strong>
	                  <small>分析群聊中其他人的对话</small>
	                </span>
	              </DropdownMenuItem>
	              <DropdownMenuSeparator />
	              <DropdownMenuItem onSelect={onResetAiChat}>
	                <span className="agent-menu-spacer" />
	                <span>
	                  <strong>清空当前对话</strong>
	                  <small>保留当前助理类型</small>
	                </span>
	              </DropdownMenuItem>
	            </DropdownMenuContent>
	          </DropdownMenu>
	        </div>
        <div className="agent-messages">
          {aiMessages.map((message, index) => (
            <article
              className={`agent-message ${message.role}`}
              key={`${message.role}-${index}`}
            >
              <div className="agent-message-content">
                <MarkdownPreview content={message.content} compact />
              </div>
              {message.role === 'assistant' && (
                <div className="agent-message-footer">
                  <time className="agent-message-time">{message.createdAt}</time>
                  {index > 0 && (
                    <Button
                      className="agent-summary-button"
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="生成总结文档"
                      title="生成总结文档"
                      onClick={() => onCreateSummaryFromAiMessage(message)}
                    >
                      <FileText size={14} weight="bold" />
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
          {aiBusy && (
            <article className="agent-message assistant">
              <div className="agent-message-content">
                <MarkdownPreview content="正在整理项目上下文..." compact />
              </div>
            </article>
          )}
        </div>
        {aiError && <p className="form-error">{aiError}</p>}
        <div className="agent-composer">
          <Textarea
            placeholder="例如：帮我生成本周所有进行中项目的总结，并列出下周最关键的 3 个动作..."
            value={aiDraft}
            onCompositionEnd={() => setIsComposing(false)}
            onCompositionStart={() => setIsComposing(true)}
            onChange={(event) => onAiDraftChange(event.target.value)}
            onKeyDown={(event) => {
              const nativeEvent = event.nativeEvent as KeyboardEvent
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !isComposing &&
                !nativeEvent.isComposing
              ) {
                event.preventDefault()
                onSendAgentMessage()
              }
            }}
          />
          <Button
            className="agent-send-button"
            type="button"
            disabled={aiBusy || !aiDraft.trim()}
            variant="ghost"
            size="icon"
            aria-label="发送消息"
            onClick={onSendAgentMessage}
          >
            <PaperPlaneTilt size={18} weight="bold" />
          </Button>
        </div>
      </Card>
      <Card className={isSummaryFullscreen ? 'panel summary-list is-fullscreen' : 'panel summary-list'}>
        {selectedSummary ? (
          <SummaryDocumentDetail
            isFullscreen={isSummaryFullscreen}
            projectName={selectedDocumentOwner}
            summary={selectedSummary}
            onBack={() => {
              setIsSummaryFullscreen(false)
              setSelectedSummaryId(null)
            }}
            onToggleFullscreen={() => setIsSummaryFullscreen((current) => !current)}
          />
        ) : (
          <SummaryDocumentList
            projects={projects}
            summaries={summaries}
            onSelect={setSelectedSummaryId}
          />
        )}
      </Card>
    </div>
  )
}

function SummaryDocumentList({
  onSelect,
  projects,
  summaries,
}: {
  onSelect: (id: number) => void
  projects: Project[]
  summaries: Summary[]
}) {
  return (
    <>
      <PanelTitle icon={<FileText size={18} />} title="总结文档" />
      <div className="summary-doc-list">
        {summaries.length === 0 ? (
          <p className="empty-state">还没有总结文档。</p>
        ) : (
          summaries.map((summary) => {
            const project = projects.find((item) => item.id === summary.projectId)
            const ownerName = project?.name ?? (summary.period === '飞书对话分析' ? '飞书对话分析' : 'AI 总结文档')
            return (
              <button
                className="summary-doc-item"
                key={summary.id}
                type="button"
                onClick={() => onSelect(summary.id)}
              >
                <span>{ownerName}</span>
                <strong>{summary.title}</strong>
                <small>{summary.period} · {summary.createdAt}</small>
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
  onToggleFullscreen,
  projectName,
  summary,
}: {
  isFullscreen: boolean
  onBack: () => void
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
          <Button
            className="summary-fullscreen-button"
            variant="ghost"
            size="icon"
            type="button"
            aria-label={isFullscreen ? '退出全屏展示总结文档' : '全屏展示总结文档'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏展示'}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <CornersIn size={17} /> : <CornersOut size={17} />}
          </Button>
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

function MarkdownPreview({
  compact = false,
  content,
}: {
  compact?: boolean
  content: string
}) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let nextOrderedListStart = 1
  let canContinueOrderedList = false

  function resetOrderedListSequence() {
    nextOrderedListStart = 1
    canContinueOrderedList = false
  }

  function parseTableCells(text: string) {
    if (!text.startsWith('|') || !text.endsWith('|')) return null
    const cells = text
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
    return cells.length >= 2 ? cells : null
  }

  function isMarkdownTableDivider(text: string) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(text)
  }

  function parseInline(text: string) {
    const parts: ReactNode[] = []
    const tokenPattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
    let lastIndex = 0
    let match: RegExpExecArray | null = tokenPattern.exec(text)

    while (match) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
      }
      if (match[1] !== undefined && match[2] !== undefined) {
        parts.push(
          <img
            key={`image-${match.index}`}
            src={match[2]}
            alt={match[1] || '图片'}
            loading="lazy"
          />,
        )
      } else if (match[3] !== undefined && match[4] !== undefined) {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={match[4]}
            target="_blank"
            rel="noreferrer"
          >
            {match[3]}
          </a>,
        )
      } else if (match[5] !== undefined) {
        parts.push(<strong key={`bold-${match.index}`}>{match[5]}</strong>)
      }
      lastIndex = tokenPattern.lastIndex
      match = tokenPattern.exec(text)
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
    }

    return parts.length > 0 ? parts : [<span key="text-empty">{text}</span>]
  }

  function renderHeading(level: number, text: string, key: number) {
    if (level <= 1) return <h3 key={key}>{parseInline(text)}</h3>
    if (level === 2) return <h4 key={key}>{parseInline(text)}</h4>
    return <h5 key={key}>{parseInline(text)}</h5>
  }

  while (index < lines.length) {
    const text = lines[index].trim()

    if (!text) {
      index += 1
      continue
    }

    if (/^---+$/.test(text)) {
      blocks.push(<hr key={index} />)
      index += 1
      resetOrderedListSequence()
      continue
    }

    const heading = text.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push(renderHeading(heading[1].length, heading[2], index))
      index += 1
      resetOrderedListSequence()
      continue
    }

    const tableCells = parseTableCells(text)
    if (tableCells) {
      const tableItems: ReactNode[] = []
      while (index < lines.length) {
        const rowText = lines[index].trim()
        if (!rowText) {
          index += 1
          continue
        }
        if (isMarkdownTableDivider(rowText)) {
          index += 1
          continue
        }
        const rowCells = parseTableCells(rowText)
        if (!rowCells) break
        const item = rowCells.length >= 3
          ? `${rowCells[0]}：${rowCells[1]}；${rowCells.slice(2).join('；')}`
          : rowCells.join('：')
        tableItems.push(<li key={index}>{parseInline(item)}</li>)
        index += 1
      }
      blocks.push(<ul key={`table-${index}`}>{tableItems}</ul>)
      resetOrderedListSequence()
      continue
    }

    if (/^[-*]\s+/.test(text)) {
      const items: ReactNode[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const item = lines[index].trim().replace(/^[-*]\s+/, '')
        items.push(<li key={index}>{parseInline(item)}</li>)
        index += 1
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>)
      continue
    }

    const orderedListMatch = text.match(/^(\d+)[.)]\s+/)
    if (orderedListMatch) {
      const items: ReactNode[] = []
      const sourceStart = Number(orderedListMatch[1])
      const listStart = canContinueOrderedList && sourceStart === 1 ? nextOrderedListStart : sourceStart
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        const item = lines[index].trim().replace(/^\d+[.)]\s+/, '')
        items.push(<li key={index}>{parseInline(item)}</li>)
        index += 1
      }
      blocks.push(
        <ol key={`ol-${index}`} start={listStart}>
          {items}
        </ol>,
      )
      nextOrderedListStart = listStart + items.length
      canContinueOrderedList = true
      continue
    }

    if (/^[^：:]{2,12}[：:]/.test(text)) {
      const [title, ...rest] = text.split(/[：:]/)
      blocks.push(
        <section className="markdown-section" key={index}>
          <h4>{parseInline(title)}</h4>
          {rest.join('：').trim() && <p>{parseInline(rest.join('：').trim())}</p>}
        </section>,
      )
      index += 1
      resetOrderedListSequence()
      continue
    }

    blocks.push(<p key={index}>{parseInline(text)}</p>)
    index += 1
    resetOrderedListSequence()
  }

  return <div className={compact ? 'markdown-preview compact' : 'markdown-preview'}>{blocks}</div>
}

function TodoFilterBuilderDialog({
  assigneeOptions,
  conditions,
  creatorOptions,
  join,
  moduleOptions,
  onApply,
  open,
  onOpenChange,
}: {
  assigneeOptions: Array<{ id: number; name: string }>
  conditions: TodoFilterCondition[]
  creatorOptions: Array<{ id: number; name: string }>
  join: TodoFilterJoin
  moduleOptions: Array<{ id: number; name: string }>
  onApply: (next: { conditions: TodoFilterCondition[]; join: TodoFilterJoin }) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draftJoin, setDraftJoin] = useState<TodoFilterJoin>(join)
  const [draftConditions, setDraftConditions] = useState<TodoFilterCondition[]>(conditions)

  useEffect(() => {
    if (!open) return
    setDraftJoin(join)
    setDraftConditions(conditions.length > 0 ? conditions : [createTodoFilterCondition()])
  }, [conditions, join, open])

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

    if (condition.field === 'assignee' || condition.field === 'creator') {
      const options = condition.field === 'assignee' ? assigneeOptions : creatorOptions
      const label = condition.field === 'assignee' ? '负责人' : '创建人'
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
            <SelectItem value="rejected">已驳回</SelectItem>
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
  currentUserId,
  members,
  onCreateNote,
  onUpdateNote,
  todo,
}: {
  currentUserId?: number
  members?: Array<{ id: number; name: string }>
  onCreateNote: (todoId: number, content: string) => void
  onUpdateNote: (todoId: number, noteId: number, content: string) => void
  todo: Todo
}) {
  const [draft, setDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingDrafts, setEditingDrafts] = useState<Record<number, string>>({})
  const notes = useMemo(
    () => [...todo.notes].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [todo.notes],
  )

  useEffect(() => {
    setDraft('')
    setEditingNoteId(null)
    setEditingDrafts({})
  }, [todo.id])

  function saveNewNote() {
    const content = draft.trim()
    if (!content) return
    onCreateNote(todo.id, content)
    setDraft('')
  }

  function saveExistingNote(note: TodoNote) {
    const nextContent = String(editingDrafts[note.id] ?? note.content).trim()
    if (!nextContent) return
    onUpdateNote(todo.id, note.id, nextContent)
    setEditingNoteId(null)
  }

  return (
    <section className="todo-notes-panel" aria-label="待办备注">
      <div className="todo-notes-panel-header">
        <div>
          <strong>待办备注</strong>
          <small>记录确认结果、进展说明和需要同步的补充信息。</small>
        </div>
        <span className="todo-notes-panel-count">{notes.length} 条</span>
      </div>
      <div className="todo-notes-list">
        {notes.length === 0 ? (
          <div className="todo-notes-empty">还没有备注，直接写第一条即可。</div>
        ) : (
          notes.map((note) => {
            const canEdit = currentUserId != null && (
              note.authorUserId === currentUserId || note.sourceOperationId != null
            )
            const isEditing = editingNoteId === note.id
            return (
              <article className="todo-note-card" key={note.id}>
                <header className="todo-note-card-header">
                  <div className="todo-note-card-meta">
                    <div className="todo-note-card-heading">
                      <strong>{note.authorName}</strong>
                      <span>{note.createdAt}</span>
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
      <Label className="todo-note-create">
        新增备注
        <TodoNoteComposer
          members={members}
          placeholder="记录确认结果、未完成原因或其他补充说明..."
          value={draft}
          onChange={setDraft}
        />
      </Label>
      <div className="todo-note-panel-actions">
        <Button type="button" disabled={!draft.trim()} onClick={saveNewNote}>
          添加备注
        </Button>
      </div>
    </section>
  )
}

function TodoEditorDialog({
  assigneeUserId,
  backLabel = '返回待办列表',
  canEdit = false,
  clearDisabled = false,
  createdAt,
  currentUserId,
  detail,
  members,
  mode,
  moduleId,
  modules,
  onAssigneeUserIdChange,
  onBack,
  onCancelEdit,
  onClear,
  onCreateTodoNote,
  onCreatedAtChange,
  onDetailChange,
  onDueDateChange,
  onModuleIdChange,
  onOpenChange,
  onPriorityChange,
  onStartEdit,
  onSubmit,
  onTitleChange,
  onUpdateTodoNote,
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
  backLabel?: string
  canEdit?: boolean
  clearDisabled?: boolean
  createdAt: string
  currentUserId?: number
  detail: string
  members: Array<{ id: number; name: string }>
  mode: 'create' | 'detail'
  moduleId: number | null
  modules: ProjectModule[]
  onAssigneeUserIdChange: (value: number | null) => void
  onBack?: () => void
  onCancelEdit?: () => void
  onClear?: () => void
  onCreateTodoNote?: (todoId: number, content: string) => void
  onCreatedAtChange: (value: string) => void
  onDetailChange: (value: string) => void
  onDueDateChange: (value: string) => void
  onModuleIdChange: (value: number | null) => void
  onOpenChange: (open: boolean) => void
  onPriorityChange: (value: Priority) => void
  onStartEdit?: () => void
  onSubmit: () => void
  onTitleChange: (value: string) => void
  onUpdateTodoNote?: (todoId: number, noteId: number, content: string) => void
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
  const selectedModuleName = modules.find((item) => item.id === moduleId)?.name ?? '无模块'
  const selectedAssigneeName = members.find((item) => item.id === assigneeUserId)?.name ?? '未指派'
  const creatorName = todo?.creatorName ?? project.ownerName
  const showNotesSidebar = Boolean(
    isDetailMode && !editing && todo && onCreateTodoNote && onUpdateTodoNote,
  )
  const statusLabel = todo?.done ? '已完成' : '未完成'
  const confirmLabel = todo?.confirmationStatus === 'rejected' ? '已驳回' : '已确认'
  const showFooterActions = isCreateMode || editing
  const showDetailOverview = isDetailMode && !editing

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
                </div>
              </div>
              <div className="todo-detail-page-summary-row">
                <div className="todo-detail-page-info">
                  <span>{project.name}</span>
                  <span>截止 {dueDate}</span>
                  <span>{selectedAssigneeName === '未指派' ? selectedAssigneeName : `@${selectedAssigneeName}`}</span>
                  <span>{creatorName} 创建</span>
                  <span>{confirmLabel}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="todo-detail-overview-actions">
            <span
              className="todo-detail-edit-button-wrap"
            >
              <Button
                className="solid-button todo-detail-edit-button"
                type="button"
                disabled={!canEdit}
                onClick={onStartEdit}
              >
                编辑待办
              </Button>
              {!canEdit ? (
                <span className="todo-detail-edit-tooltip" role="tooltip">
                  非待办创建者不支持编辑待办
                </span>
              ) : null}
            </span>
          </div>
        </section>
      ) : null}
      <div className="todo-editor-main">
        {editing ? (
          <>
            <Label>
              待办标题
              <MentionInput
                autoFocus
                members={members}
                placeholder="给这条待办起一个清晰的标题..."
                value={title}
                onChange={onTitleChange}
              />
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
              {modules.length > 0 ? (
                <Label>
                  所属模块
                  <ProjectModulePicker
                    modules={modules}
                    value={moduleId}
                    onChange={onModuleIdChange}
                  />
                </Label>
              ) : null}
              <Label>
                负责人
                <ProjectMemberPicker
                  members={members}
                  value={assigneeUserId}
                  onChange={onAssigneeUserIdChange}
                />
              </Label>
            </div>
            <div className="todo-editor-detail-field">
              <span className="todo-editor-field-label">待办详情</span>
              <TodoDetailEditor value={detail} onChange={onDetailChange} />
              <small className="todo-detail-hint">
                支持直接粘贴图片，图片会显示在输入区上方。
              </small>
            </div>
          </>
        ) : (
          <>
            <section className="todo-detail-block">
              <div className="todo-detail-section-header">
                <span className="todo-detail-section-label">待办详情</span>
              </div>
              {detail.trim() ? (
                <div className="todo-detail-rendered">
                  <TodoDetailViewer value={detail} />
                </div>
              ) : (
                <div className="todo-detail-empty">暂无详情</div>
              )}
            </section>
          </>
        )}
      </div>
      {showNotesSidebar && todo && onCreateTodoNote && onUpdateTodoNote ? (
        <aside className="todo-editor-sidebar">
          <TodoNotesPanel
            currentUserId={currentUserId}
            members={members}
            onCreateNote={onCreateTodoNote}
            onUpdateNote={onUpdateTodoNote}
            todo={todo}
          />
        </aside>
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
    </article>
  )
}

function TodoList({
  compact = false,
  currentUserId,
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
  compact?: boolean
  currentUserId?: number
  detailBackLabel?: string
  initialTodoId?: number | null
  onCreateTodoNote: (todoId: number, content: string) => void
  onDetailBack?: () => void
  onDeleteTodo: (id: number) => void
  onDetailModeChange?: (active: boolean) => void
  onUpdateTodoNote: (todoId: number, noteId: number, content: string) => void
  onUpdateTodo: (id: number, payload: TodoUpdatePayload) => void
  memberships: ProjectMembership[]
  project: Project
  projects: Project[]
  todos: Todo[]
}) {
  const defaultTodoFilterState = useMemo(
    () => getDefaultProjectTodoFilterState(project, currentUserId),
    [currentUserId, project],
  )
  const initialTodo = initialTodoId == null
    ? null
    : todos.find((todo) => todo.id === initialTodoId) ?? null
  const [page, setPage] = useState(0)
  const [todoSearchQuery, setTodoSearchQuery] = useState('')
  const [todoFilterDialogOpen, setTodoFilterDialogOpen] = useState(false)
  const [todoFilterJoin, setTodoFilterJoin] = useState<TodoFilterJoin>(defaultTodoFilterState.join)
  const [todoFilterConditions, setTodoFilterConditions] = useState<TodoFilterCondition[]>(() =>
    defaultTodoFilterState.conditions,
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
  const creatorFilterOptions = useMemo(
    () => getProjectAssignableUsers(project, memberships),
    [memberships, project],
  )
  const filteredTodos = useMemo(() => {
    const query = todoSearchQuery.trim().toLowerCase()
    return sortedTodos.filter((todo) => {
      const matchesSearch = !query || [
        todo.title,
        todo.moduleName ?? '',
        todo.assigneeName ?? '',
        todo.creatorName ?? '',
        todo.priority,
        priorityCopy[todo.priority],
        todo.dueDate,
        todo.createdAt,
        todo.confirmationStatus === 'confirmed' ? '已确认 confirmed' : '已驳回 rejected',
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
  const editingTodo = editingTodoId
    ? sortedTodos.find((todo) => todo.id === editingTodoId) ?? null
    : null
  const editingProject = editingTodo
    ? projects.find((project) => project.id === editingTodo.projectId) ?? null
    : null
  const editingProjectMembers = editingProject
    ? getProjectAssignableUsers(editingProject, memberships)
    : []
  const editingCanManageTodo = Boolean(
    editingTodo &&
      editingProject &&
      currentUserId != null &&
      editingTodo.createdByUserId === currentUserId,
  )
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )

  function canManageTodo(todo: Todo) {
    const project = projectById.get(todo.projectId)
    return project?.accessRole === 'owner' || todo.createdByUserId === currentUserId
  }

  function canRespondToTodo(todo: Todo) {
    const project = projectById.get(todo.projectId)
    return Boolean(
      currentUserId != null &&
      (project?.accessRole === 'owner' || todo.assigneeUserId === currentUserId),
    )
  }

  function canToggleTodoDone(todo: Todo) {
    return todo.confirmationStatus === 'confirmed' && canRespondToTodo(todo)
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
    if (!canToggleTodoDone(todo)) return
    onUpdateTodo(todo.id, { done: !todo.done })
  }

  function closeEditDialog() {
    setEditingTodoId(null)
    setTodoEditDraft('')
    setTodoEditDetail('')
    setTodoEditCreatedAt(today)
    setTodoEditDueDate(today)
    setTodoEditPriority('medium')
    setTodoEditAssigneeUserId(null)
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

  function saveTodoEdit() {
    if (!editingTodo || !editingProject || !editingCanManageTodo) return
    const nextTitle = stripTodoMentions(
      todoEditDraft,
      getProjectMentionOptions(editingProject.id, projects, memberships),
    ).trim()
    if (!nextTitle) return
    onUpdateTodo(editingTodo.id, {
      detail: todoEditDetail,
      title: nextTitle,
      createdAt: todoEditCreatedAt,
      dueDate: todoEditDueDate,
      priority: todoEditPriority,
      assigneeUserId: todoEditAssigneeUserId,
      moduleId: todoEditModuleId,
    })
    closeEditDialog()
  }

  if (editingProject && editingTodo) {
    return (
      <div
        className={compact ? 'todo-list-shell compact todo-detail-shell' : 'todo-list-shell todo-detail-shell'}
        ref={containerRef}
      >
        <TodoEditorDialog
          assigneeUserId={todoEditAssigneeUserId}
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
          currentUserId={currentUserId}
          isEditing={isTodoDetailEditing}
          submitDisabled={!todoEditDraft.trim()}
          title={todoEditDraft}
          todo={editingTodo}
          onAssigneeUserIdChange={setTodoEditAssigneeUserId}
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
          onStartEdit={() => setIsTodoDetailEditing(true)}
          onSubmit={saveTodoEdit}
          onTitleChange={setTodoEditDraft}
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
            placeholder="搜索待办..."
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
              setTodoFilterConditions([])
              setTodoFilterJoin('and')
            }}
          >
            清除
          </Button>
        ) : null}
        <TodoFilterBuilderDialog
          assigneeOptions={assigneeFilterOptions.assignees}
          conditions={todoFilterConditions}
          creatorOptions={creatorFilterOptions}
          join={todoFilterJoin}
          moduleOptions={moduleFilterOptions.modules}
          open={todoFilterDialogOpen}
          onOpenChange={setTodoFilterDialogOpen}
          onApply={({ conditions: nextConditions, join: nextJoin }) => {
            setTodoFilterConditions(nextConditions)
            setTodoFilterJoin(nextJoin)
          }}
        />
      </div>
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
            const isCheckboxDisabled = !canToggleTodoDone(todo)
            const checkboxLabel = todo.done ? '标记为未完成' : '标记为已完成'
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
                    <strong>{todo.title}</strong>
                  </span>
                  <small>
                    <span className="todo-created-at">
                      {todo.creatorName
                        ? `${todo.creatorName} 创建于 ${todo.createdAt.slice(0, 16)}`
                        : `创建于 ${todo.createdAt.slice(0, 16)}`}
                    </span>
                    {compact ? `截止 ${todo.dueDate}` : `${project?.name} · 截止 ${todo.dueDate}`}
                    {todo.assigneeName && (
                      <span className="todo-assignee-inline">@{todo.assigneeName}</span>
                    )}
                  </small>
                </button>
                <span
                  className={todo.linkedToDeliveryEvent ? 'todo-actions has-delivery' : 'todo-actions'}
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
                    status={todo.confirmationStatus}
                    disabled={!rowCanRespondToTodo}
                    onChange={(confirmationStatus) => onUpdateTodo(todo.id, { confirmationStatus })}
                    onReject={(rejectionReason) =>
                      onUpdateTodo(todo.id, {
                        confirmationStatus: 'rejected',
                        rejectionReason,
                      })
                    }
                  />
                  <span className="todo-delete-slot">
                    {rowCanManageTodo && (
                      <ConfirmDialog
                        confirmLabel="删除待办"
                        description={`删除「${todo.title}」后，这条待办将从当前项目移除。`}
                        onConfirm={() => onDeleteTodo(todo.id)}
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
                    )}
                  </span>
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
  if (view === 'notifications') return '通知中心'
  if (view === 'inbox') return '草稿箱'
  if (view === 'search') return '项目篮子'
  return 'AI 总结文档'
}

export default App
