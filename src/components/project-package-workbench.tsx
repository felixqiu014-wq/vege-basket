import {
  Component,
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  CaretDown,
  CaretRight,
  Copy,
  DotsThree,
  FunnelSimple,
  Package,
  Plus,
  ShoppingCartSimple,
  Trash,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JournalDatePicker } from '@/components/journal-date-picker'
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
  TodoFilterBuilderDialog,
  matchesTodoFilterConditions,
  type TodoFilterCondition,
  type TodoFilterJoin,
} from '@/components/todo-filter-builder-dialog'
import type {
  PackageMarketChannel,
  PackageMarketDetail,
  PackageMarketRule,
  PackageMarketVersion,
  Project,
  ProjectMembership,
  ProjectPackageEvent,
  ProjectPackageEventStatus,
  ProjectPackageGroup,
  ProjectPackageItem,
  ProjectPackageEventType,
  ProjectPackageOperation,
  ProjectPackageOperationKind,
  ProjectPackageOperationStatus,
  ProjectPackageTimeline,
  Todo,
} from '@/types'

type PackageWorkbenchProps = {
  onAddItems: (
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
  onCreateEvent: (payload: {
    assigneeUserId: number
    deliveryDate: string
    title: string
    type: ProjectPackageEventType
  }) => Promise<void>
  onCreateOperation: (payload: {
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
  onDeleteEvent: (eventId: number) => Promise<void>
  onDeleteGroup: (groupId: number) => Promise<void>
  onDeleteOperation: (operationId: number) => Promise<void>
  onExportTimeline: () => Promise<{ fileName: string; markdown: string }>
  onLoadPackageMarketDetail: (payload: {
    arch: string
    channel: PackageMarketChannel
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    expireMinutes?: number
    packageId: string
    releaseVersion?: string
  }) => Promise<PackageMarketDetail>
  onLoadPackageMarketRules: () => Promise<{
    expireMinutes: number
    rules: PackageMarketRule[]
  }>
  onLoadPackageMarketVersions: (payload: {
    arch: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    packageId: string
  }) => Promise<PackageMarketVersion[]>
  onUpdateEvent: (
    eventId: number,
    payload: Partial<{
      assigneeUserId: number
      deliveryDate: string
      status: ProjectPackageEventStatus
      title: string
      type: ProjectPackageEventType
    }>,
  ) => Promise<void>
  onUpdateOperation: (
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
  onUpdateTodo: (
    todoId: number,
    payload: Partial<Pick<Todo, 'done'>>,
  ) => Promise<boolean>
  currentUserId?: number
  memberships: ProjectMembership[]
  project: Project
  todos: Todo[]
  timeline: ProjectPackageTimeline | null
}

const MarkdownWysiwygEditor = lazy(() =>
  import('@/components/markdown-wysiwyg-editor').then((module) => ({
    default: module.MarkdownWysiwygEditor,
  })),
)

class MarkdownEditorLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="markdown-wysiwyg-loading is-error" role="alert">
          <strong>编辑器加载失败</strong>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export type ProjectPackageWorkbenchHandle = {
  exportTimeline: () => void
  openPackageMarket: () => void
  selectEvent: (eventId: number) => void
}

type PendingOperationTarget =
  | {
      defaultTitle?: string
      eventId: number
      groupId?: number | null
      operation?: ProjectPackageOperation | null
    }
  | null

type PackageMarketDetailContext = {
  arch: 'amd64' | 'arm64'
  channel: PackageMarketChannel
  ciVersion: string
  packageId: string
  releaseVersion: string
}

function eventTypeLabel(type: ProjectPackageEventType) {
  return type === 'init' ? '初始化安装' : '升级'
}

function eventStatusLabel(status: ProjectPackageEventStatus) {
  if (status === 'delivered') return '已交付'
  if (status === 'delivering') return '交付中'
  return '草稿'
}

function getTodayDateStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(new Date())
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function getEventDeliveryDate(event: ProjectPackageEvent) {
  return event.deliveryDate || event.createdAt.slice(0, 10)
}

function channelLabel(channel: PackageMarketChannel) {
  return channel === 'ci' ? '测试包' : '正式包'
}

const packageMarketExpireOptions = [
  { label: '30 分钟', value: 30 },
  { label: '60 分钟（1 小时）', value: 60 },
  { label: '90 分钟', value: 90 },
  { label: '2 小时', value: 120 },
  { label: '5 小时', value: 300 },
  { label: '10 小时', value: 600 },
]

function isOperationEffectivelyCompleted(
  operation: ProjectPackageOperation,
  todosById: Map<number, Todo>,
) {
  if (operation.completed) return true
  if (operation.relatedTodoIds.length === 0) return false

  const relatedTodos = operation.relatedTodoIds
    .map((todoId) => todosById.get(todoId))

  return relatedTodos.every((todo) => Boolean(todo?.done))
}

function getEventCompletionProgress(event: ProjectPackageEvent, todosById: Map<number, Todo>) {
  const childOperations = [
    ...event.operations,
    ...event.groups.flatMap((group) => group.operations),
  ]
  const total = childOperations.length
  const completed = childOperations.filter((operation) =>
    isOperationEffectivelyCompleted(operation, todosById)
  ).length
  return {
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    total,
  }
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function itemChannelLabel(item: Pick<ProjectPackageItem, 'channel' | 'channelLabel'>) {
  if (item.channelLabel) return item.channelLabel
  return item.channel === 'ci' ? '测试包' : '正式包'
}

function summarizeGroup(group: ProjectPackageGroup) {
  return group.items
    .map((item) =>
      [itemChannelLabel(item), item.arch, item.version || '未知版本'].filter(Boolean).join(' · '),
    )
    .join('；')
}

function operationHeading(operation: ProjectPackageOperation) {
  return operation.kind === 'document' ? operation.title || '未命名文档' : operation.label || '操作事件'
}

function summarizeTodoNote(note?: string, limit = 42) {
  const normalized = String(note ?? '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function todoCreatedDateLabel(todo: Todo) {
  return todo.createdAt.slice(0, 10)
}

function todoDialogMeta(todo: Todo, done: boolean) {
  return [
    done ? '已完成' : '未完成',
    `创建日期 ${todoCreatedDateLabel(todo)}`,
    `截止 ${todo.dueDate}`,
    priorityLabel(todo.priority),
    todo.assigneeName ? `@${todo.assigneeName}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function todoSearchMeta(todo: Todo) {
  return [
    todo.title,
    todo.moduleName ?? '',
    todo.assigneeName ?? '',
    todo.creatorName ?? '',
    todo.priority,
    todo.createdAt,
    todoCreatedDateLabel(todo),
    `创建日期 ${todoCreatedDateLabel(todo)}`,
    todo.done ? '已完成 完成 done' : '未完成 未做 open pending',
  ]
    .join(' ')
    .toLowerCase()
}

function renderOperationTodoChips(
  operation: ProjectPackageOperation,
  todosById: Map<number, Todo>,
) {
  if (operation.relatedTodoIds.length === 0) return null
  return (
    <div className="operation-entry-todos">
      {operation.relatedTodoIds
        .map((todoId) => todosById.get(todoId))
        .filter((todo): todo is Todo => Boolean(todo))
        .map((todo) => (
          <span className="operation-entry-todo-chip" key={todo.id}>
            {todo.done ? '已完成' : '待办'} · {todo.title}
            {summarizeTodoNote(operation.relatedTodoNotes[todo.id])
              ? ` · ${summarizeTodoNote(operation.relatedTodoNotes[todo.id])}`
              : ''}
          </span>
        ))}
    </div>
  )
}

function getOperationCardClassName(
  operation: ProjectPackageOperation,
  todosById: Map<number, Todo>,
) {
  return isOperationEffectivelyCompleted(operation, todosById)
    ? 'operation-entry completed'
    : 'operation-entry'
}

function priorityLabel(priority: Todo['priority']) {
  if (priority === 'high') return '高优先级'
  if (priority === 'low') return '低优先级'
  return '中优先级'
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[], direction: 'asc' | 'desc' = 'asc') {
  return [...items].sort((left, right) => {
    const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return direction === 'asc' ? delta : -delta
  })
}

function downloadMarkdownFile(fileName: string, markdown: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function DeleteConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  title,
  trigger,
}: {
  confirmLabel: string
  description: string
  onConfirm: () => void | Promise<void>
  title: string
  trigger: React.ReactNode
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
              void Promise.resolve(onConfirm()).finally(() => setOpen(false))
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const operationEventOptions: Array<{
  label: string
  type: ProjectPackageEventType
}> = [
  { label: '初始化安装', type: 'init' },
  { label: '升级', type: 'upgrade' },
]

export const ProjectPackageWorkbench = forwardRef<ProjectPackageWorkbenchHandle, PackageWorkbenchProps>(function ProjectPackageWorkbench({
  currentUserId,
  memberships,
  onAddItems,
  onCreateEvent,
  onCreateOperation,
  onDeleteEvent,
  onDeleteGroup,
  onDeleteOperation,
  onExportTimeline,
  onLoadPackageMarketDetail,
  onLoadPackageMarketRules,
  onLoadPackageMarketVersions,
  onUpdateEvent,
  onUpdateOperation,
  onUpdateTodo,
  project,
  todos,
  timeline,
}, ref) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [eventDialogMode, setEventDialogMode] = useState<'create' | 'edit'>('create')
  const [eventAssigneeUserId, setEventAssigneeUserId] = useState('')
  const [eventDeliveryDate, setEventDeliveryDate] = useState(getTodayDateStamp)
  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState<ProjectPackageEventType>('upgrade')
  const [operationDialogOpen, setOperationDialogOpen] = useState(false)
  const [operationEditorReady, setOperationEditorReady] = useState(false)
  const [operationTitle, setOperationTitle] = useState('')
  const [operationContent, setOperationContent] = useState('')
  const [operationKind, setOperationKind] = useState<ProjectPackageOperationKind>('document')
  const [pendingOperationTarget, setPendingOperationTarget] = useState<PendingOperationTarget>(null)
  const [operationTodoDialogOpen, setOperationTodoDialogOpen] = useState(false)
  const [todoDialogOperationId, setTodoDialogOperationId] = useState<number | null>(null)
  const [todoDialogRelatedTodoIds, setTodoDialogRelatedTodoIds] = useState<number[]>([])
  const [todoDialogRelatedTodoNotes, setTodoDialogRelatedTodoNotes] = useState<Record<number, string>>({})
  const [todoDialogTodoDoneMap, setTodoDialogTodoDoneMap] = useState<Record<number, boolean>>({})
  const [todoDialogSearch, setTodoDialogSearch] = useState('')
  const [todoFilterDialogOpen, setTodoFilterDialogOpen] = useState(false)
  const [todoFilterJoin, setTodoFilterJoin] = useState<TodoFilterJoin>('and')
  const [todoFilterConditions, setTodoFilterConditions] = useState<TodoFilterCondition[]>([])
  const [todoPickerOpen, setTodoPickerOpen] = useState(false)
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false)
  const [exportEditorReady, setExportEditorReady] = useState(false)
  const [exportFileName, setExportFileName] = useState('')
  const [exportContent, setExportContent] = useState('')
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketRules, setMarketRules] = useState<PackageMarketRule[]>([])
  const [marketExpireMinutes, setMarketExpireMinutes] = useState(packageMarketExpireOptions[0].value)
  const [marketSelectedPackage, setMarketSelectedPackage] = useState('base-pro')
  const [marketChannel, setMarketChannel] = useState<PackageMarketChannel>('release')
  const [marketArch, setMarketArch] = useState<'amd64' | 'arm64'>('amd64')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketReleaseVersion, setMarketReleaseVersion] = useState('')
  const [marketCiVersion, setMarketCiVersion] = useState('')
  const [marketReleaseVersions, setMarketReleaseVersions] = useState<PackageMarketVersion[]>([])
  const [marketCiVersions, setMarketCiVersions] = useState<PackageMarketVersion[]>([])
  const [marketDetail, setMarketDetail] = useState<PackageMarketDetail | null>(null)
  const [marketDetailContext, setMarketDetailContext] = useState<PackageMarketDetailContext | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [marketExpandedGroups, setMarketExpandedGroups] = useState<Record<'base' | 'apps' | 'middleware', boolean>>({
    base: true,
    apps: true,
    middleware: true,
  })
  const [cartItems, setCartItems] = useState<
    Array<{
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
  >([])
  const [busyAction, setBusyAction] = useState('')
  const [copiedValue, setCopiedValue] = useState('')
  const marketDetailRequestIdRef = useRef(0)
  const todoPickerSearchRef = useRef<HTMLInputElement | null>(null)
  const todoPickerOptionsRef = useRef<HTMLDivElement | null>(null)
  const [todoPickerOptionsOverflowing, setTodoPickerOptionsOverflowing] = useState(false)

  const events = useMemo(() => timeline?.events ?? [], [timeline])
  const memberOptions = useMemo(() => {
    const options = new Map<number, string>()
    options.set(project.ownerUserId, project.ownerName || '项目 Owner')
    memberships
      .filter((membership) => membership.projectId === project.id && membership.status === 'active' && membership.invitedUserId)
      .forEach((membership) => {
        options.set(
          Number(membership.invitedUserId),
          membership.memberName || membership.invitedUsername || `成员 ${membership.invitedUserId}`,
        )
      })
    return [...options.entries()].map(([id, name]) => ({ id, name }))
  }, [memberships, project.id, project.ownerName, project.ownerUserId])
  const [assignedOnly, setAssignedOnly] = useState(false)
  const visibleEvents = useMemo(
    () =>
      assignedOnly && currentUserId
        ? events.filter((event) => event.assigneeUserId === currentUserId)
        : events,
    [assignedOnly, currentUserId, events],
  )
  const todosById = useMemo(
    () => new Map(todos.map((todo) => [todo.id, todo])),
    [todos],
  )
  const selectableTodos = useMemo(
    () =>
      [...todos]
        .filter((todo) => todo.confirmationStatus === 'confirmed')
        .sort((left, right) => {
        if (left.done !== right.done) return Number(left.done) - Number(right.done)
        if (left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate)
        return left.id - right.id
      }),
    [todos],
  )
  const selectableTodosById = useMemo(
    () => new Map(selectableTodos.map((todo) => [todo.id, todo])),
    [selectableTodos],
  )
  const canManageTimeline = project.accessRole === 'owner' || project.accessRole === 'member'
  const todoDialogOperation = useMemo(
    () =>
      todoDialogOperationId == null
        ? null
        : events
          .flatMap((event) => [
            ...event.operations,
            ...event.groups.flatMap((group) => group.operations),
          ])
          .find((operation) => operation.id === todoDialogOperationId) ?? null,
    [events, todoDialogOperationId],
  )
  const todoDialogSelectedIds = useMemo(
    () => new Set(todoDialogRelatedTodoIds),
    [todoDialogRelatedTodoIds],
  )
  const todoDialogModuleOptions = useMemo(() => {
    const modules = new Map<number, string>()
    for (const todo of selectableTodos) {
      if (todo.moduleId && todo.moduleName) {
        modules.set(todo.moduleId, todo.moduleName)
      }
    }
    return Array.from(modules, ([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }, [selectableTodos])
  const todoDialogAssigneeOptions = useMemo(() => {
    const assignees = new Map<number, string>()
    for (const todo of selectableTodos) {
      if (todo.assigneeUserId && todo.assigneeName) {
        assignees.set(todo.assigneeUserId, todo.assigneeName)
      }
    }
    return Array.from(assignees, ([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }, [selectableTodos])
  const todoDialogCreatorOptions = useMemo(() => {
    const creators = new Map<number, string>()
    for (const todo of selectableTodos) {
      if (todo.createdByUserId && todo.creatorName) {
        creators.set(todo.createdByUserId, todo.creatorName)
      }
    }
    return Array.from(creators, ([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }, [selectableTodos])
  const activeTodoFilterCount = todoFilterConditions.length
  const todoFilterSummary = activeTodoFilterCount > 0
    ? `已筛选 ${activeTodoFilterCount} 条件`
    : '筛选'
  const filteredTodoDialogTodos = useMemo(() => {
    const query = todoDialogSearch.trim().toLowerCase()
    return selectableTodos.filter((todo) => {
      const matchesSearch = !query || todoSearchMeta(todo).includes(query)
      return (
        matchesSearch &&
        matchesTodoFilterConditions(todo, todoFilterConditions, todoFilterJoin)
      )
    })
  }, [selectableTodos, todoDialogSearch, todoFilterConditions, todoFilterJoin])
  const todoDialogSelectedTodos = useMemo(
    () =>
      todoDialogRelatedTodoIds
        .map((todoId) => selectableTodosById.get(todoId) ?? todosById.get(todoId))
        .filter((todo): todo is Todo => Boolean(todo)),
    [selectableTodosById, todoDialogRelatedTodoIds, todosById],
  )

  const selectedEvent =
    visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? null

  const selectedGroup =
    selectedEvent?.groups.find((group) => group.id === selectedGroupId) ??
    selectedEvent?.groups[0] ??
    null
  const selectedEventProgress = selectedEvent
    ? getEventCompletionProgress(selectedEvent, todosById)
    : { completed: 0, percent: 0, total: 0 }

  const filteredRules = useMemo(() => {
    const query = marketSearch.trim().toLowerCase()
    const baseRules: PackageMarketRule[] = [
      {
        id: 'base-pro',
        name: 'sealos-pro',
        category: 'apps',
        mode: 'release',
        releaseRoots: [],
        flatFileRoots: [],
        fileNameFormats: [],
        ciFileNameFormats: [],
      },
      {
        id: 'base-oss',
        name: 'sealos-oss',
        category: 'apps',
        mode: 'release',
        releaseRoots: [],
        flatFileRoots: [],
        fileNameFormats: [],
        ciFileNameFormats: [],
      },
      ...marketRules,
    ]
    return baseRules.filter((rule) => {
      if (!query) return true
      return `${rule.id} ${rule.name}`.toLowerCase().includes(query)
    })
  }, [marketRules, marketSearch])

  const groupedMarketRules = useMemo(() => {
    const base = filteredRules.filter((rule) => rule.id === 'base-pro' || rule.id === 'base-oss')
    const apps = filteredRules.filter(
      (rule) => rule.category === 'apps' && rule.id !== 'base-pro' && rule.id !== 'base-oss',
    )
    const middleware = filteredRules.filter((rule) => rule.category === 'middleware')
    return { apps, base, middleware }
  }, [filteredRules])

  async function copyToClipboard(value: string, feedbackKey: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedValue(feedbackKey)
    window.setTimeout(() => {
      setCopiedValue((current) => (current === feedbackKey ? '' : current))
    }, 1200)
  }

  function copiedLabel(feedbackKey: string, fallback: string) {
    return copiedValue === feedbackKey ? '已复制' : fallback
  }

  useEffect(() => {
    if (!todoPickerOpen) return
    const frameId = window.requestAnimationFrame(() => {
      todoPickerSearchRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [todoPickerOpen])

  useEffect(() => {
    if (!todoPickerOpen) {
      setTodoPickerOptionsOverflowing(false)
      return
    }
    const optionsElement = todoPickerOptionsRef.current
    if (!optionsElement) return

    const updateOverflowState = () => {
      setTodoPickerOptionsOverflowing(optionsElement.scrollHeight > optionsElement.clientHeight + 1)
    }

    const frameId = window.requestAnimationFrame(updateOverflowState)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflowState)
    resizeObserver?.observe(optionsElement)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
    }
  }, [filteredTodoDialogTodos.length, todoPickerOpen])

  async function loadMarketContext(requestId: number) {
    setMarketError('')
    try {
      const rulesPayload = await onLoadPackageMarketRules()
      if (requestId !== marketDetailRequestIdRef.current) return null
      setMarketRules(rulesPayload.rules)
      const expireMinutes = packageMarketExpireOptions.some(
        (option) => option.value === rulesPayload.expireMinutes,
      )
        ? rulesPayload.expireMinutes
        : packageMarketExpireOptions[0].value
      setMarketExpireMinutes(expireMinutes)
      return expireMinutes
    } catch (error) {
      if (requestId !== marketDetailRequestIdRef.current) return null
      setMarketError(error instanceof Error ? error.message : '包市场读取失败')
      return null
    }
  }

  async function refreshMarketDetail(nextOverrides?: Partial<{
    arch: 'amd64' | 'arm64'
    channel: PackageMarketChannel
    ciVersion: string
    expireMinutes: number
    packageId: string
    releaseVersion: string
  }>) {
    const packageId = nextOverrides?.packageId ?? marketSelectedPackage
    const channel = nextOverrides?.channel ?? marketChannel
    const arch = nextOverrides?.arch ?? marketArch
    const releaseVersion = nextOverrides?.releaseVersion ?? marketReleaseVersion
    const ciVersion = nextOverrides?.ciVersion ?? marketCiVersion
    const expireMinutes = nextOverrides?.expireMinutes ?? marketExpireMinutes
    const requestId = ++marketDetailRequestIdRef.current
    const context: PackageMarketDetailContext = {
      arch,
      channel,
      ciVersion,
      packageId,
      releaseVersion,
    }
    setMarketLoading(true)
    setMarketError('')
    setMarketDetail(null)
    setMarketDetailContext(null)
    try {
      const [versions, detail] = await Promise.all([
        channel === 'ci'
          ? onLoadPackageMarketVersions({
              arch,
              kind: 'ci',
              packageId,
            })
          : onLoadPackageMarketVersions({
              arch,
              kind: 'release',
              packageId,
              deployType: packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
            }),
        onLoadPackageMarketDetail({
          packageId,
          channel,
          arch,
          deployType:
            packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
          expireMinutes,
          releaseVersion,
          ciVersion,
        }),
      ])
      if (requestId !== marketDetailRequestIdRef.current) return
      if (channel === 'ci') {
        setMarketCiVersions(versions)
      } else {
        setMarketReleaseVersions(versions)
      }
      setMarketDetail(detail)
      setMarketDetailContext(context)
    } catch (error) {
      if (requestId !== marketDetailRequestIdRef.current) return
      setMarketError(error instanceof Error ? error.message : '包详情加载失败')
    } finally {
      if (requestId === marketDetailRequestIdRef.current) {
        setMarketLoading(false)
      }
    }
  }

  function openCreateEventDialog() {
    setEventDialogMode('create')
    setEventTitle('')
    setEventType(events.length === 0 ? 'init' : 'upgrade')
    setEventDeliveryDate(getTodayDateStamp())
    setEventAssigneeUserId(
      String(
        memberOptions.find((member) => member.id === currentUserId)?.id ??
          memberOptions[0]?.id ??
          '',
      ),
    )
    setEventDialogOpen(true)
  }

  function openPackageMarket() {
    const openRequestId = ++marketDetailRequestIdRef.current
    setMarketDetail(null)
    setMarketDetailContext(null)
    setMarketLoading(true)
    setMarketError('')
    setMarketOpen(true)
    void loadMarketContext(openRequestId).then((expireMinutes) => {
      if (openRequestId !== marketDetailRequestIdRef.current) return
      if (expireMinutes == null) {
        setMarketLoading(false)
        return
      }
      void refreshMarketDetail({ expireMinutes })
    })
  }

  function openEditEventDialog(event: ProjectPackageEvent) {
    setEventDialogMode('edit')
    setSelectedEventId(event.id)
    setEventTitle(event.title)
    setEventType(event.type)
    setEventDeliveryDate(getEventDeliveryDate(event))
    setEventAssigneeUserId(String(event.assigneeUserId ?? memberOptions[0]?.id ?? ''))
    setEventDialogOpen(true)
  }

  function openOperationDialog(target: PendingOperationTarget, kind: ProjectPackageOperationKind) {
    setOperationEditorReady(false)
    setPendingOperationTarget(target)
    setOperationKind(target?.operation?.kind ?? kind)
    setOperationTitle(
      target?.operation?.title ??
        target?.operation?.label ??
        target?.defaultTitle ??
        (kind === 'document' ? '操作文档' : '操作事件'),
    )
    setOperationContent(target?.operation?.content ?? '')
    setOperationDialogOpen(true)
  }

  function openOperationTodoDialog(operation: ProjectPackageOperation) {
    setTodoDialogOperationId(operation.id)
    setTodoDialogRelatedTodoIds([...operation.relatedTodoIds])
    setTodoDialogRelatedTodoNotes({ ...(operation.relatedTodoNotes ?? {}) })
    setTodoDialogTodoDoneMap(
      Object.fromEntries(todos.map((todo) => [todo.id, todo.done] as const)),
    )
    setTodoDialogSearch('')
    setTodoFilterConditions([])
    setTodoFilterJoin('and')
    setTodoFilterDialogOpen(false)
    setTodoPickerOpen(false)
    setOperationTodoDialogOpen(true)
  }

  function clearOperationTodoDialogState() {
    setTodoDialogOperationId(null)
    setTodoDialogRelatedTodoIds([])
    setTodoDialogRelatedTodoNotes({})
    setTodoDialogTodoDoneMap({})
    setTodoDialogSearch('')
    setTodoFilterConditions([])
    setTodoFilterJoin('and')
    setTodoFilterDialogOpen(false)
    setTodoPickerOpen(false)
  }

  function toggleTodoDialogTodo(todoId: number) {
    setTodoDialogRelatedTodoIds((current) =>
      current.includes(todoId)
        ? current.filter((item) => item !== todoId)
        : [...current, todoId],
    )
    setTodoDialogRelatedTodoNotes((current) => {
      if (!(todoId in current)) return current
      return current
    })
  }

  function updateTodoDialogNote(todoId: number, note: string) {
    const normalized = note.trim()
    setTodoDialogRelatedTodoNotes((current) => ({
      ...current,
      [todoId]: note,
    }))
    if (normalized) {
      setTodoDialogRelatedTodoIds((current) =>
        current.includes(todoId) ? current : [...current, todoId],
      )
    }
  }

  async function saveOperationTodoDialog() {
    if (!todoDialogOperation) return
    setBusyAction(`operation-todo-link-${todoDialogOperation.id}`)
    try {
      const relatedTodoNotes = Object.fromEntries(
        todoDialogRelatedTodoIds.flatMap((todoId) => {
          const note = todoDialogRelatedTodoNotes[todoId]
          return note && note.trim() ? [[todoId, note] as const] : []
        }),
      )
      const operationUpdated = await onUpdateOperation(todoDialogOperation.id, {
        relatedTodoIds: todoDialogRelatedTodoIds,
        relatedTodoNotes,
      })
      if (!operationUpdated) return
      const changedTodos = todos.filter(
        (todo) => todo.done !== todoDialogTodoDoneMap[todo.id],
      )
      for (const todo of changedTodos) {
        const todoUpdated = await onUpdateTodo(todo.id, {
          done: todoDialogTodoDoneMap[todo.id],
        })
        if (!todoUpdated) return
      }
      setOperationTodoDialogOpen(false)
      clearOperationTodoDialogState()
    } finally {
      setBusyAction('')
    }
  }

  function toggleTodoDialogDone(todoId: number) {
    setTodoDialogTodoDoneMap((current) => ({
      ...current,
      [todoId]: !current[todoId],
    }))
  }

  async function submitEvent() {
    const assigneeUserId = Number(eventAssigneeUserId)
    if (!eventTitle.trim() || !Number.isInteger(assigneeUserId) || assigneeUserId <= 0) return
    setBusyAction('event')
    try {
      if (eventDialogMode === 'create') {
        await onCreateEvent({
          assigneeUserId,
          deliveryDate: eventDeliveryDate,
          title: eventTitle.trim(),
          type: eventType,
        })
      } else if (selectedEvent) {
        await onUpdateEvent(selectedEvent.id, {
          assigneeUserId,
          deliveryDate: eventDeliveryDate,
          title: eventTitle.trim(),
          type: eventType,
        })
      }
      setEventDialogOpen(false)
    } finally {
      setBusyAction('')
    }
  }

  async function submitOperation() {
    if (!pendingOperationTarget) return
    setBusyAction('operation')
    try {
      const trimmedTitle = operationTitle.trim()
      const trimmedContent = operationContent.trim()
      const saved = pendingOperationTarget.operation
        ? await onUpdateOperation(
          pendingOperationTarget.operation.id,
          operationKind === 'document'
            ? {
                title: trimmedTitle,
                content: trimmedContent,
              }
            : {
                label: trimmedTitle,
                ...(trimmedContent ? { content: trimmedContent } : {}),
              },
        )
        : await onCreateOperation({
          eventId: pendingOperationTarget.eventId,
          groupId: pendingOperationTarget.groupId ?? null,
          kind: operationKind,
          ...(operationKind === 'document'
            ? {
                title: trimmedTitle,
                content: trimmedContent,
              }
            : {
                label: trimmedTitle,
                ...(trimmedContent ? { content: trimmedContent } : {}),
              }),
        })
      if (!saved) return
      setOperationDialogOpen(false)
      setPendingOperationTarget(null)
    } finally {
      setBusyAction('')
    }
  }

  async function createPackageEventOperation(label: string) {
    if (!selectedEvent || !selectedGroup) return
    setBusyAction('operation')
    try {
      await onCreateOperation({
        eventId: selectedEvent.id,
        groupId: selectedGroup.id,
        kind: 'event',
        label,
        completed: false,
      })
    } finally {
      setBusyAction('')
    }
  }

  async function submitCart() {
    if (!selectedEvent || cartItems.length === 0) return
    setBusyAction('cart')
    try {
      await onAddItems(selectedEvent.id, cartItems)
      setCartItems([])
      setMarketOpen(false)
    } finally {
      setBusyAction('')
    }
  }

  async function handleExport() {
    setBusyAction('export')
    try {
      const result = await onExportTimeline()
      setExportEditorReady(false)
      setExportFileName(result.fileName)
      setExportContent(result.markdown)
      setExportPreviewOpen(true)
    } finally {
      setBusyAction('')
    }
  }

  useImperativeHandle(ref, () => ({
    exportTimeline: () => {
      void handleExport()
    },
    openPackageMarket,
    selectEvent: (eventId: number) => {
      const targetEvent = events.find((event) => event.id === eventId)
      setAssignedOnly(false)
      setSelectedEventId(eventId)
      setSelectedGroupId(targetEvent?.groups[0]?.id ?? null)
    },
  }))

  function confirmExport() {
    downloadMarkdownFile(exportFileName, exportContent)
    setExportPreviewOpen(false)
  }

  const packageTimelineNodes = useMemo(
    () => (selectedGroup ? sortByCreatedAt(selectedGroup.operations, 'asc') : []),
    [selectedGroup],
  )

  return (
    <div className="package-workbench">
      {events.length === 0 ? (
        <section className="package-empty-state">
          <div className="package-empty-panel">
            <h3>先创建一个项目事件</h3>
            <p>正确路径是「项目 - 事件 - 选购安装包 - 编辑对应文档」，请先创建一个事件再开始维护交付记录。</p>
              <div className="package-empty-actions">
              {canManageTimeline ? (
                <Button className="solid-button" type="button" onClick={openCreateEventDialog}>
                  <Plus size={16} /> 新增事件
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <div className="project-event-layout">
          <aside className="project-events-panel">
            <div className="project-events-head">
              <div>
                <h3>交付事件</h3>
              </div>
              {canManageTimeline ? (
                <Button className="solid-button" type="button" onClick={openCreateEventDialog}>
                  <Plus size={17} /> 新增事件
                </Button>
              ) : null}
            </div>
            <label className="project-events-assigned-toggle">
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={(event) => setAssignedOnly(event.target.checked)}
              />
              <span>只看我被指派的事件</span>
            </label>
            <div className="project-event-items">
              {visibleEvents.length === 0 ? (
                <p className="project-events-empty">
                  {assignedOnly ? '暂无指派给你的交付事件。' : '暂无交付事件。'}
                </p>
              ) : visibleEvents.map((event) => (
                <div
                  className={event.id === selectedEvent?.id ? 'project-event-item active' : 'project-event-item'}
                  key={event.id}
                >
                  <button
                    className="project-event-tab-button"
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id)
                      setSelectedGroupId(event.groups[0]?.id ?? null)
                    }}
                  >
                    <strong>{event.title}</strong>
                    <span>{eventTypeLabel(event.type)} · {getEventDeliveryDate(event)}</span>
                    <span className="project-event-badges">
                      <span className="project-event-assignee">
                        交付人：{event.assigneeName || '未指派'}
                      </span>
                      <span className={`project-event-status-badge ${event.status}`}>
                        {eventStatusLabel(event.status)}
                      </span>
                    </span>
                  </button>
                  {canManageTimeline ? (
                    <div className="project-event-item-actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="icon-button project-menu-trigger project-event-menu-button"
                            type="button"
                            aria-label={`更多事件操作 ${event.title}`}
                          >
                            <DotsThree size={18} weight="bold" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="project-actions-menu-content" sideOffset={8}>
                          <DropdownMenuItem onSelect={() => openEditEventDialog(event)}>
                            编辑事件
                          </DropdownMenuItem>
                          <DeleteConfirmDialog
                            confirmLabel="删除事件"
                            description={`删除「${event.title}」后，这个交付事件下的安装包、记录和文档都会一起移除。`}
                            onConfirm={() => onDeleteEvent(event.id)}
                            title="确认删除这个交付事件？"
                            trigger={(
                              <DropdownMenuItem
                                className="project-event-danger-menu-item"
                                onSelect={(selectEvent) => selectEvent.preventDefault()}
                                variant="destructive"
                              >
                                删除事件
                              </DropdownMenuItem>
                            )}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          {selectedEvent ? (
          <section className="event-workspace">
            <div className="event-workspace-body">
              <section className="project-operations-panel">
                <section className="operation-area">
                  <div className="operation-area-head">
                    <div>
                      <h4>操作文档</h4>
                      <p className="operation-area-meta">
                        {selectedEvent.title} · {eventTypeLabel(selectedEvent.type)} · {getEventDeliveryDate(selectedEvent)}
                        <span className="event-progress-pill">
                          已完成 {selectedEventProgress.completed}/{selectedEventProgress.total} 个子事件 - 完成进度：{selectedEventProgress.percent}%
                        </span>
                      </p>
                      {!canManageTimeline ? (
                        <p className="package-workbench-readonly">
                          当前为协作视角，你可以查看和导出时间线，安装记录由项目 Owner 统一维护。
                        </p>
                      ) : null}
                    </div>
                    {canManageTimeline ? (
                      <div className="operation-actions">
                        <Select
                          value={selectedEvent.status}
                          onValueChange={(value) =>
                            void onUpdateEvent(selectedEvent.id, {
                              status: value as ProjectPackageEventStatus,
                            })
                          }
                        >
                          <SelectTrigger
                            className="package-event-status-select"
                            aria-label={`选择事件状态 ${selectedEvent.title}`}
                          >
                            <SelectValue placeholder="事件状态" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">{eventStatusLabel('draft')}</SelectItem>
                            <SelectItem value="delivering">{eventStatusLabel('delivering')}</SelectItem>
                            <SelectItem value="delivered">{eventStatusLabel('delivered')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          className="solid-button"
                          type="button"
                          onClick={() =>
                            openOperationDialog(
                              { eventId: selectedEvent.id, operation: null },
                              'document',
                            )
                          }
                        >
                          <Plus size={14} weight="bold" /> 新建文档
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {selectedEvent.operations.length === 0 ? (
                    canManageTimeline ? (
                      <button
                        className="operation-empty-card"
                        type="button"
                        onClick={() =>
                          openOperationDialog({ eventId: selectedEvent.id, operation: null }, 'document')
                        }
                      >
                        <strong>点击开始编辑操作文档</strong>
                        <span>点击这里，直接开始编辑这个事件的文档内容。</span>
                      </button>
                    ) : (
                      <p className="operation-empty">还没有事件级文档。</p>
                    )
                  ) : (
                    <div className="operation-stream">
                      {sortByCreatedAt(selectedEvent.operations).map((operation) => (
                        <article className={getOperationCardClassName(operation, todosById)} key={operation.id}>
                          <button
                            className="operation-entry-main"
                            type="button"
                            onClick={() =>
                              canManageTimeline
                                ? openOperationDialog(
                                    { eventId: selectedEvent.id, operation },
                                    operation.kind,
                                  )
                                : undefined
                            }
                            disabled={!canManageTimeline}
                          >
                            <span className="operation-entry-kind">
                              {operation.kind === 'document' ? '文档' : '事件'}
                            </span>
                            <div className="operation-entry-headline">
                              <strong>{operationHeading(operation)}</strong>
                              <small>{operation.createdAt}</small>
                            </div>
                          </button>
                          {renderOperationTodoChips(operation, todosById)}
                          {canManageTimeline ? (
                            <div className="operation-entry-actions">
                              <button
                                className="icon-button operation-action-button"
                                type="button"
                                aria-label="关联待办"
                                onClick={() => openOperationTodoDialog(operation)}
                              >
                                关联待办
                              </button>
                              <DeleteConfirmDialog
                                confirmLabel="删除记录"
                                description={`删除「${operationHeading(operation)}」后，这条交付记录将从当前事件中移除。`}
                                onConfirm={() => onDeleteOperation(operation.id)}
                                title="确认删除这条交付记录？"
                                trigger={(
                                  <button
                                    className="icon-button operation-delete-button"
                                    type="button"
                                    aria-label="删除记录"
                                  >
                                    <Trash size={15} />
                                  </button>
                                )}
                              />
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </section>

              {selectedEvent.groups.length > 0 ? (
                <section className="project-detail-layout">
                  <aside className="project-package-list">
                    <div className="project-package-list-head">
                      <div>
                        <h3>安装包列表</h3>
                      </div>
                    </div>

                    <div className="project-package-items">
                      {selectedEvent.groups.map((group) => (
                        <div
                          className={group.id === selectedGroup?.id ? 'project-package-item active' : 'project-package-item'}
                          key={group.id}
                        >
                          <button
                            className="project-package-tab-button"
                            type="button"
                            onClick={() => setSelectedGroupId(group.id)}
                          >
                            <strong>{group.packageName}</strong>
                            <span className="package-meta-text">{summarizeGroup(group) || `${group.items.length} 条记录`}</span>
                          </button>
                          {canManageTimeline ? (
                            <DeleteConfirmDialog
                              confirmLabel="删除安装包"
                              description={`删除「${group.packageName}」后，这个安装包下的时间线记录会一起移除。`}
                              onConfirm={() => onDeleteGroup(group.id)}
                              title="确认删除这个安装包？"
                              trigger={(
                                <button
                                  className="icon-button project-package-delete-button"
                                  type="button"
                                  aria-label={`删除安装包 ${group.packageName}`}
                                >
                                  <Trash size={15} />
                                </button>
                              )}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </aside>

                  <section className="project-timeline-panel">
                    <div className="project-timeline-head">
                      <div>
                        <h3>{selectedGroup?.packageName ?? '包级时间线'}</h3>
                        {selectedGroup ? (
                          <p className="package-meta-text">{summarizeGroup(selectedGroup)}</p>
                        ) : null}
                      </div>
                      {canManageTimeline && selectedGroup ? (
                        <div className="operation-actions">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button className="solid-button" type="button">
                                添加操作文档 <CaretDown size={14} weight="bold" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8}>
                              <DropdownMenuItem
                                onSelect={() =>
                                  openOperationDialog(
                                    { eventId: selectedEvent.id, groupId: selectedGroup.id, operation: null },
                                    'document',
                                  )
                                }
                              >
                                空文档
                              </DropdownMenuItem>
                              {operationEventOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option.type}
                                  onSelect={() => void createPackageEventOperation(option.label)}
                                >
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>

                    <div className="timeline-list">
                      {packageTimelineNodes.length === 0 ? (
                        <p className="operation-empty">这个安装包还没有补充文档或事件记录。</p>
                      ) : (
                        packageTimelineNodes.map((operation, index) => (
                          <article
                            className={index === packageTimelineNodes.length - 1 ? 'timeline-card latest' : 'timeline-card'}
                            key={operation.id}
                          >
                            <div className="timeline-body operation-node">
                              <article className={getOperationCardClassName(operation, todosById)}>
                                <button
                                  className="operation-entry-main"
                                  type="button"
                                  onClick={() =>
                                    canManageTimeline
                                      ? openOperationDialog(
                                          {
                                            eventId: selectedEvent.id,
                                            groupId: selectedGroup.id,
                                            operation,
                                          },
                                          operation.kind,
                                        )
                                      : undefined
                                  }
                                  disabled={!canManageTimeline}
                                >
                                  <span className="operation-entry-kind">
                                    {operation.kind === 'document' ? '文档' : '事件'}
                                  </span>
                                  <div className="operation-entry-headline">
                                    <strong>{operationHeading(operation)}</strong>
                                    <small>{operation.createdAt}</small>
                                  </div>
                                </button>
                                {renderOperationTodoChips(operation, todosById)}
                                {canManageTimeline ? (
                                  <div className="operation-entry-actions">
                                    <button
                                      className="icon-button operation-action-button"
                                      type="button"
                                      aria-label="关联待办"
                                      onClick={() => openOperationTodoDialog(operation)}
                                    >
                                      关联待办
                                    </button>
                                    <DeleteConfirmDialog
                                      confirmLabel="删除记录"
                                      description={`删除「${operationHeading(operation)}」后，这条交付记录将从当前安装包时间线移除。`}
                                      onConfirm={() => onDeleteOperation(operation.id)}
                                      title="确认删除这条交付记录？"
                                      trigger={(
                                        <button
                                          className="icon-button operation-delete-button"
                                          type="button"
                                          aria-label="删除记录"
                                        >
                                          <Trash size={15} />
                                        </button>
                                      )}
                                    />
                                  </div>
                                ) : null}
                              </article>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </section>
              ) : null}
            </div>
          </section>
          ) : (
            <section className="event-workspace package-assigned-empty-workspace">
              <div className="package-empty-panel">
                <h3>暂无指派给你的交付事件</h3>
                <p>关闭「只看我被指派的事件」后，可以查看当前项目的全部交付事件。</p>
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{eventDialogMode === 'create' ? '新增安装事件' : '编辑安装事件'}</DialogTitle>
            <DialogDescription>事件是安装升级时间线的第一层分组，建议按一次初始化或一次升级来建立。</DialogDescription>
          </DialogHeader>
          <div className="package-dialog-form">
            <Label>
              事件类型
              <Select value={eventType} onValueChange={(value) => setEventType(value as ProjectPackageEventType)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择事件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="init">初始化安装</SelectItem>
                  <SelectItem value="upgrade">升级</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label>
              事件标题
              <Input
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="例如：控制台升级到 v5.1.2"
              />
            </Label>
            <Label>
              交付时间
              <JournalDatePicker
                ariaLabel="选择交付时间"
                className="package-event-date-trigger"
                datesWithEntries={[]}
                value={eventDeliveryDate}
                onChange={setEventDeliveryDate}
              />
            </Label>
            <Label>
              交付人
              <Select value={eventAssigneeUserId} onValueChange={setEventAssigneeUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择交付人" />
                </SelectTrigger>
                <SelectContent>
                  {memberOptions.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEventDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void submitEvent()}
              disabled={!eventTitle.trim() || !eventDeliveryDate || !eventAssigneeUserId || busyAction === 'event'}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
        <DialogContent className="package-operation-dialog">
          <DialogHeader className="operation-doc-header">
            <DialogTitle>
              {pendingOperationTarget?.operation
                ? operationKind === 'document'
                  ? '编辑操作文档'
                  : '编辑操作文档'
                : '添加操作文档'}
            </DialogTitle>
            <DialogDescription>
              记录交付过程中需要保留的步骤、命令和说明。
            </DialogDescription>
          </DialogHeader>
          <div className="operation-doc-form">
            <div className="operation-doc-meta-row">
              <Label className="operation-doc-title-field">
                文档标题
                <Input
                  value={operationTitle}
                  onChange={(event) => setOperationTitle(event.target.value)}
                  placeholder={operationKind === 'document' ? '例如：升级前检查事项' : '例如：初始化安装'}
                />
              </Label>
            </div>
            <MarkdownEditorLoadBoundary>
              <Suspense fallback={<div className="markdown-wysiwyg-loading" role="status">正在加载编辑器…</div>}>
                <MarkdownWysiwygEditor
                  key={`operation-${pendingOperationTarget?.operation?.id ?? `${pendingOperationTarget?.eventId ?? 'new'}-${pendingOperationTarget?.groupId ?? 'event'}`}`}
                  ariaLabel="操作文档内容"
                  value={operationContent}
                  onChange={setOperationContent}
                  onReady={() => setOperationEditorReady(true)}
                  placeholder="输入操作步骤、命令或说明…"
                />
              </Suspense>
            </MarkdownEditorLoadBoundary>
          </div>
          <DialogFooter className="operation-doc-footer">
            <Button variant="outline" type="button" onClick={() => setOperationDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void submitOperation()}
              disabled={
                busyAction === 'operation' ||
                !operationEditorReady ||
                !operationTitle.trim() ||
                (operationKind === 'document' && !operationContent.trim())
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportPreviewOpen} onOpenChange={setExportPreviewOpen}>
        <DialogContent className="package-operation-dialog">
          <DialogHeader className="operation-doc-header">
            <DialogTitle>导出 {project.name || '项目'} 时间线</DialogTitle>
            <DialogDescription>
              确认项目「{project.name || '未命名项目'}」的时间线内容无误后，再点击右下角确认导出。
            </DialogDescription>
          </DialogHeader>
          <div className="operation-doc-form">
            <MarkdownEditorLoadBoundary>
              <Suspense fallback={<div className="markdown-wysiwyg-loading" role="status">正在加载编辑器…</div>}>
                <MarkdownWysiwygEditor
                  key={`export-${exportFileName}`}
                ariaLabel="时间线导出内容"
                value={exportContent}
                onChange={setExportContent}
                onReady={() => setExportEditorReady(true)}
                placeholder="当前项目没有可导出的时间线内容"
                />
              </Suspense>
            </MarkdownEditorLoadBoundary>
          </div>
          <DialogFooter className="operation-doc-footer">
            <Button variant="outline" type="button" onClick={() => setExportPreviewOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={confirmExport} disabled={!exportEditorReady || !exportContent.trim()}>
              确认导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={operationTodoDialogOpen}
        onOpenChange={(open) => {
          setOperationTodoDialogOpen(open)
          if (!open) clearOperationTodoDialogState()
        }}
      >
        <DialogContent className="package-operation-dialog">
          <DialogHeader>
            <DialogTitle>关联待办</DialogTitle>
            <DialogDescription>
              在这里统一管理待办关联、完成状态和备注说明；复选框会与外部待办列表的勾选状态保持同步。
            </DialogDescription>
          </DialogHeader>
          {selectableTodos.length > 0 ? (
            <div className="operation-todo-picker">
              <span className="operation-todo-picker-label">选择待办</span>
              <DropdownMenu
                open={todoPickerOpen}
                onOpenChange={(open) => {
                  setTodoPickerOpen(open)
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button className="operation-todo-picker-trigger" variant="outline" type="button">
                    <span className="operation-todo-picker-trigger-content">
                      {todoDialogSelectedTodos.length === 0 ? (
                        <span className="operation-todo-picker-placeholder">搜索并选择待办</span>
                      ) : (
                        <span className="operation-todo-picker-tags">
                          {todoDialogSelectedTodos.slice(0, 3).map((todo) => (
                            <span className="operation-todo-picker-tag" key={todo.id}>
                              {todo.title}
                            </span>
                          ))}
                          {todoDialogSelectedTodos.length > 3 ? (
                            <span className="operation-todo-picker-tag">
                              +{todoDialogSelectedTodos.length - 3}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </span>
                    <CaretDown
                      className={todoPickerOpen ? 'operation-todo-picker-caret open' : 'operation-todo-picker-caret'}
                      size={14}
                      weight="bold"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={
                    todoPickerOptionsOverflowing
                      ? 'operation-todo-picker-content has-options-scrollbar'
                      : 'operation-todo-picker-content'
                  }
                  collisionPadding={20}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  sideOffset={8}
                >
                  <div className="operation-todo-picker-search-row">
                    <Input
                      ref={todoPickerSearchRef}
                      value={todoDialogSearch}
                      onChange={(event) => setTodoDialogSearch(event.target.value)}
                      onKeyDown={(event) => event.stopPropagation()}
                      placeholder="搜索标题、负责人、提交人、创建日期"
                    />
                    <Button
                      className={
                        activeTodoFilterCount > 0
                          ? 'todo-filter-open-button operation-todo-filter-open-button active'
                          : 'todo-filter-open-button operation-todo-filter-open-button'
                      }
                      variant="outline"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setTodoFilterDialogOpen(true)
                      }}
                    >
                      <FunnelSimple size={14} />
                      <span>{todoFilterSummary}</span>
                    </Button>
                  </div>
                  <TodoFilterBuilderDialog
                    assigneeOptions={todoDialogAssigneeOptions}
                    conditions={todoFilterConditions}
                    creatorOptions={todoDialogCreatorOptions}
                    join={todoFilterJoin}
                    moduleOptions={todoDialogModuleOptions}
                    open={todoFilterDialogOpen}
                    onOpenChange={setTodoFilterDialogOpen}
                    onApply={({ conditions: nextConditions, join: nextJoin }) => {
                      setTodoFilterConditions(nextConditions)
                      setTodoFilterJoin(nextJoin)
                    }}
                  />
                  <div className="operation-todo-picker-options" ref={todoPickerOptionsRef}>
                    {filteredTodoDialogTodos.length === 0 ? (
                      <p className="operation-empty">没有搜索到匹配的待办。</p>
                    ) : (
                      filteredTodoDialogTodos.map((todo) => {
                        const selected = todoDialogSelectedIds.has(todo.id)
                        const done = Boolean(todoDialogTodoDoneMap[todo.id])
                        const meta = todoDialogMeta(todo, done)
                        return (
                          <button
                            className={selected ? 'operation-todo-picker-option selected' : 'operation-todo-picker-option'}
                            key={todo.id}
                            type="button"
                            onClick={() => toggleTodoDialogTodo(todo.id)}
                          >
                            <span className="operation-todo-picker-option-check" aria-hidden="true" />
                            <span className="operation-todo-picker-option-text">
                              <strong>
                                {todo.title}
                                {todo.moduleName ? (
                                  <Badge className="todo-module-badge">{todo.moduleName}</Badge>
                                ) : null}
                              </strong>
                              <small>{meta}</small>
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
          <div className="operation-todo-dialog-list">
            {selectableTodos.length === 0 ? (
              <div className="operation-todo-dialog-empty-state">
                <strong>暂未关联待办</strong>
                <span>当前项目还没有已确认的待办可供关联。</span>
              </div>
            ) : todoDialogSelectedTodos.length === 0 ? (
              <div className="operation-todo-dialog-empty-state">
                <strong>暂未关联待办</strong>
                <span>先在上方搜索并选择待办，选择后再填写备注并同步完成状态。</span>
              </div>
            ) : (
              todoDialogSelectedTodos.map((todo) => {
                const done = Boolean(todoDialogTodoDoneMap[todo.id])
                const meta = todoDialogMeta(todo, done)
                return (
                  <article
                    className={done ? 'operation-todo-dialog-item selected done' : 'operation-todo-dialog-item selected'}
                    key={todo.id}
                  >
                    <span className="operation-todo-dialog-item-head">
                      <span className="operation-todo-dialog-item-text">
                        <strong>
                          {todo.title}
                          {todo.moduleName ? (
                            <Badge className="todo-module-badge">{todo.moduleName}</Badge>
                          ) : null}
                        </strong>
                        <small>{meta}</small>
                      </span>
                      <span className="operation-todo-dialog-item-controls">
                        <label className="operation-todo-dialog-done-toggle">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleTodoDialogDone(todo.id)}
                          />
                          <span>完成待办</span>
                        </label>
                      </span>
                    </span>
                    <Textarea
                      className="operation-todo-dialog-note"
                      placeholder="写一下未完成原因、完成情况或补充说明..."
                      value={todoDialogRelatedTodoNotes[todo.id] ?? ''}
                      onChange={(event) => updateTodoDialogNote(todo.id, event.target.value)}
                    />
                  </article>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setOperationTodoDialogOpen(false)
                clearOperationTodoDialogState()
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void saveOperationTodoDialog()}
              disabled={!todoDialogOperation || busyAction === `operation-todo-link-${todoDialogOperation.id}`}
            >
              保存操作
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={marketOpen} onOpenChange={setMarketOpen}>
        <DialogContent className="package-market-dialog">
          <DialogHeader>
            <DialogTitle>安装包市场</DialogTitle>
            <DialogDescription>
              为项目「{project.name}」当前事件选择安装包。临时下载链接有效期约 {marketExpireMinutes || '-'} 分钟。
            </DialogDescription>
          </DialogHeader>
          <div className="package-market-grid">
            <div className="package-market-sidebar">
              <Label>
                搜索
                <Input
                  value={marketSearch}
                  onChange={(event) => setMarketSearch(event.target.value)}
                  placeholder="sealos / db / app"
                />
              </Label>
              <div className="package-market-rule-list">
                {(
                  [
                    { id: 'base' as const, label: '基础包', rules: groupedMarketRules.base },
                    { id: 'apps' as const, label: 'APPS', rules: groupedMarketRules.apps },
                    { id: 'middleware' as const, label: 'SEALOS-PRO 中间件', rules: groupedMarketRules.middleware },
                  ] satisfies Array<{
                    id: 'base' | 'apps' | 'middleware'
                    label: string
                    rules: PackageMarketRule[]
                  }>
                ).map((group) => (
                  <section
                    className={marketExpandedGroups[group.id] ? 'package-market-group' : 'package-market-group collapsed'}
                    key={group.id}
                  >
                    <button
                      className="package-market-group-toggle"
                      type="button"
                      onClick={() =>
                        setMarketExpandedGroups((current) => ({
                          ...current,
                          [group.id]: !current[group.id],
                        }))
                      }
                    >
                      <span>{group.label}</span>
                      {marketExpandedGroups[group.id] ? (
                        <CaretDown size={14} weight="bold" />
                      ) : (
                        <CaretRight size={14} weight="bold" />
                      )}
                    </button>
                    {marketExpandedGroups[group.id] ? (
                      <div className="package-market-group-list">
                        {group.rules.length === 0 ? (
                          <p className="package-market-group-empty">当前分组没有匹配到安装包。</p>
                        ) : (
                          group.rules.map((rule) => (
                            <button
                              key={rule.id}
                              type="button"
                              className={rule.id === marketSelectedPackage ? 'package-market-rule active' : 'package-market-rule'}
                              onClick={() => {
                                const nextChannel =
                                  rule.id === 'base-pro' || rule.id === 'base-oss'
                                    ? 'release'
                                    : marketChannel
                                setMarketSelectedPackage(rule.id)
                                setMarketChannel(nextChannel)
                                setMarketReleaseVersion('')
                                setMarketCiVersion('')
                                void refreshMarketDetail({
                                  packageId: rule.id,
                                  channel: nextChannel,
                                  releaseVersion: '',
                                  ciVersion: '',
                                })
                              }}
                            >
                              <strong>{rule.name}</strong>
                              <small>{rule.id}</small>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
            <div className="package-market-main">
              <div className="package-market-controls">
                <Label>
                  渠道
                  <Select
                    value={marketChannel}
                    onValueChange={(value) => {
                      const next = value as PackageMarketChannel
                      setMarketChannel(next)
                      setMarketCiVersion('')
                      setMarketReleaseVersion('')
                      void refreshMarketDetail({ channel: next, ciVersion: '', releaseVersion: '' })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="release">正式包</SelectItem>
                      {marketSelectedPackage !== 'base-pro' && marketSelectedPackage !== 'base-oss' ? (
                        <SelectItem value="ci">测试包</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </Label>
                <Label>
                  架构
                  <Select
                    value={marketArch}
                    onValueChange={(value) => {
                      const next = value as 'amd64' | 'arm64'
                      setMarketArch(next)
                      setMarketCiVersion('')
                      setMarketReleaseVersion('')
                      void refreshMarketDetail({ arch: next, ciVersion: '', releaseVersion: '' })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amd64">amd64</SelectItem>
                      <SelectItem value="arm64">arm64</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
                {marketChannel === 'release' && marketReleaseVersions.length > 0 ? (
                  <Label className="package-market-version-control">
                    正式版本
                    <Select
                      value={marketReleaseVersion || marketReleaseVersions[0]?.version || ''}
                      onValueChange={(value) => {
                        setMarketReleaseVersion(value)
                        void refreshMarketDetail({ releaseVersion: value })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketReleaseVersions.map((version) => (
                          <SelectItem key={version.version ?? version.label} value={version.version ?? version.label}>
                            {version.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                ) : null}
                {marketChannel === 'ci' && marketCiVersions.length > 0 ? (
                  <Label className="package-market-version-control">
                    测试版本
                    <Select
                      value={marketCiVersion || marketCiVersions[0]?.hash || ''}
                      onValueChange={(value) => {
                        setMarketCiVersion(value)
                        void refreshMarketDetail({ ciVersion: value })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketCiVersions.map((version) => (
                          <SelectItem key={version.hash ?? version.label} value={version.hash ?? version.label}>
                            {version.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                ) : null}
              </div>
              <div className="package-market-detail-area">
                {marketError ? <p className="form-error">{marketError}</p> : null}
                {marketLoading ? (
                  <p className="empty-state">正在读取 OSS 包信息...</p>
                ) : marketDetail ? (
                  <div className="package-market-link-list">
                    {marketDetail.links.length === 0 ? (
                      <p className="empty-state">当前参数下没有找到可用对象。</p>
                    ) : (
                      marketDetail.links.map((link) => (
                        <article className="package-market-link-card" key={`${link.objectKey}-${link.version}`}>
                          <div className="package-market-link-head">
                            <div>
                              <strong>{link.name}</strong>
                              <small>{` · ${link.version}${link.size ? ` · ${formatBytes(link.size)}` : ''}`}</small>
                            </div>
                            <div className="package-market-link-actions">
                              <Button
                                className="ghost-button"
                                variant="outline"
                                type="button"
                                onClick={() =>
                                  void copyToClipboard(
                                    link.downloadUrl,
                                    `copy-download-url-${link.objectKey}`,
                                  )
                                }
                              >
                                <Copy size={15} /> {copiedLabel(`copy-download-url-${link.objectKey}`, '复制下载链接')}
                              </Button>
                              <Button
                                className="ghost-button"
                                variant="outline"
                                type="button"
                                disabled={!marketDetailContext}
                                onClick={() => {
                                  if (!marketDetailContext) return
                                  setCartItems((current) => [
                                    ...current,
                                    {
                                      sourcePackageId: marketDetailContext.packageId,
                                      sourcePackageName: marketDetail.title,
                                      packageName: link.name,
                                      channel: marketDetailContext.channel,
                                      channelLabel: channelLabel(marketDetailContext.channel),
                                      arch: marketDetailContext.arch,
                                      version: link.version,
                                      objectKey: link.objectKey,
                                      objectLastModified: link.lastModified,
                                      sizeBytes: link.size,
                                    },
                                  ])
                                }}
                              >
                                <Package size={16} /> 添加
                              </Button>
                            </div>
                          </div>
                          <code>{link.objectKey}</code>
                          <div className="package-market-link-footer">
                            <a href={link.downloadUrl} target="_blank" rel="noreferrer">
                              查看临时链接
                            </a>
                            <Button
                              className="ghost-button"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                void copyToClipboard(link.objectKey, `copy-object-key-${link.objectKey}`)
                              }
                            >
                              <Copy size={15} /> {copiedLabel(`copy-object-key-${link.objectKey}`, '复制 Key')}
                            </Button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="empty-state">选择一个包后查看详情。</p>
                )}
              </div>
              <div className="package-market-expire-row">
                <Label>
                  配置链接有效期
                  <Select
                    value={String(marketExpireMinutes)}
                    onValueChange={(value) => {
                      const nextExpireMinutes = Number(value)
                      setMarketExpireMinutes(nextExpireMinutes)
                      void refreshMarketDetail({ expireMinutes: nextExpireMinutes })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {packageMarketExpireOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <small>影响当前弹窗内“查看临时链接”和“复制下载链接”的有效期。</small>
              </div>
            </div>
          </div>
          <div className="package-cart-strip">
            <div>
              <strong>待加入当前事件：{cartItems.length} 项</strong>
              <small>
                {cartItems.map((item) => `${item.packageName} · ${item.version}`).join('；') || '还没有选择安装包'}
              </small>
            </div>
            <div className="package-cart-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => setCartItems([])}
                disabled={cartItems.length === 0}
              >
                清空
              </Button>
              <Button type="button" onClick={() => void submitCart()} disabled={cartItems.length === 0 || busyAction === 'cart'}>
                <ShoppingCartSimple size={16} /> 添加到当前事件
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
