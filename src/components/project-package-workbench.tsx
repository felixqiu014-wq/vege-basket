import {
  Component,
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  Copy,
  DotsThree,
  Eye,
  EyeSlash,
  FunnelSimple,
  LinkSimple,
  Package,
  PencilSimple,
  Plus,
  ShoppingCartSimple,
  SortAscending,
  SortDescending,
  TerminalWindow,
  Trash,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MentionTextarea, type MentionMember } from '@/components/mention-textarea'
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
import { JournalDatePicker } from '@/components/journal-date-picker'
import { getProjectPackageOperationTitle } from '@/lib/project-package-operation'
import { createWgetDownloadCommand } from '@/lib/download-command'
import {
  TodoFilterBuilderDialog,
  matchesTodoFilterConditions,
  type TodoFilterCondition,
  type TodoFilterJoin,
} from '@/components/todo-filter-builder-dialog'
import { PackageEventFilterBuilderDialog } from '@/components/package-event-filter-builder-dialog'
import { claimMarkdownEditorRecovery } from './markdown-editor-recovery'
import {
  matchesPackageEventFilterConditions,
  type PackageEventFilterCondition,
  type PackageEventFilterJoin,
} from '@/components/package-event-filter'
import type {
  PackageMarketChannel,
  PackageMarketCiBranch,
  PackageMarketDetail,
  PackageMarketRule,
  PackageMarketVersion,
  Project,
  ProjectMembership,
  ProjectPackageEvent,
  ProjectPackageEventComment,
  ProjectPackageEventSavePayload,
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
import { resolveExistingOperationInteraction } from '@/project-package-operation-access'

type PackageWorkbenchProps = {
  onAddEventComment: (eventId: number, content: string) => Promise<boolean>
  onCompleteEvent: (eventId: number) => Promise<boolean>
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
  onDeleteEvent: (eventId: number) => Promise<boolean>
  onDeleteEventComment: (eventId: number, commentId: number) => Promise<boolean>
  onDeleteGroup: (groupId: number) => Promise<void>
  onDeleteOperation: (operationId: number) => Promise<void>
  onExportTimeline: (eventId?: number) => Promise<{ fileName: string; markdown: string }>
  onLoadPackageMarketDetail: (payload: {
    arch: string
    channel: PackageMarketChannel
    ciBranch?: string
    ciVersion?: string
    deployType?: 'pro' | 'oss'
    expireMinutes?: number
    includeAll?: boolean
    packageId: string
    releaseVersion?: string
  }) => Promise<PackageMarketDetail>
  onLoadPackageItemDownloadUrl: (itemId: number) => Promise<string>
  onLoadPackageMarketCiBranches: (packageId: string) => Promise<PackageMarketCiBranch[]>
  onLoadPackageMarketRules: () => Promise<{
    expireMinutes: number
    rules: PackageMarketRule[]
  }>
  onLoadPackageMarketVersions: (payload: {
    arch: string
    ciBranch?: string
    kind: 'ci' | 'release'
    deployType?: 'pro' | 'oss'
    includeAll?: boolean
    packageId: string
  }) => Promise<PackageMarketVersion[]>
  onSaveEvent: (
    eventId: number | null,
    payload: ProjectPackageEventSavePayload,
  ) => Promise<ProjectPackageEvent | null>
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
  onUpdateEventComment: (eventId: number, commentId: number, content: string) => Promise<boolean>
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

class MarkdownEditorLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; retrying: boolean }
> {
  state = { failed: false, retrying: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    if (!claimMarkdownEditorRecovery()) return
    this.setState({ failed: true, retrying: true })
    window.setTimeout(() => window.location.reload(), 0)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="markdown-wysiwyg-loading is-error" role="alert">
          <strong>{this.state.retrying ? '正在恢复编辑器…' : '编辑器加载失败'}</strong>
          {!this.state.retrying ? (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          ) : null}
        </div>
      )
    }
    return this.props.children
  }
}

export type ProjectPackageWorkbenchHandle = {
  exportTimeline: () => void
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

type TimelineExportScope = 'current' | 'all'

type EventDocumentDraftValue = {
  content: string
  relatedTodoIds: number[]
  title: string
}

type PackageMarketDetailContext = {
  arch: 'amd64' | 'arm64'
  channel: PackageMarketChannel
  ciBranch: string
  ciVersion: string
  packageId: string
  releaseVersion: string
}

type PackageMarketDependencyState = {
  context: PackageMarketDetailContext | null
  detail: PackageMarketDetail | null
  error: string
  loading: boolean
  rule: PackageMarketRule
  selectedVersion: string
  versions: PackageMarketVersion[]
}

type PackageMarketBrowserProps = {
  onLoadPackageMarketCiBranches: PackageWorkbenchProps['onLoadPackageMarketCiBranches']
  onLoadPackageMarketDetail: PackageWorkbenchProps['onLoadPackageMarketDetail']
  onLoadPackageMarketRules: PackageWorkbenchProps['onLoadPackageMarketRules']
  onLoadPackageMarketVersions: PackageWorkbenchProps['onLoadPackageMarketVersions']
}

function eventTypeLabel(type: ProjectPackageEventType) {
  return type === 'init' ? '初始化安装' : '升级'
}

function eventStatusLabel(status: ProjectPackageEventStatus) {
  if (status === 'delivered') return '已交付'
  if (status === 'delivering') return '交付中'
  return '草稿'
}

function eventDisplayStatus(event: ProjectPackageEvent): ProjectPackageEventStatus {
  if (!event.publishedAt) return 'draft'
  return event.status === 'delivered' ? 'delivered' : 'delivering'
}

function getShanghaiDateTimeLocalStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`
}

function getShanghaiDateStamp(date = new Date()) {
  return getShanghaiDateTimeLocalStamp(date).slice(0, 10)
}

function normalizeDateTimeLocalStamp(value: string | undefined, fallback = '') {
  const match = String(value ?? '').trim().match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::\d{2})?$/,
  )
  if (!match) return fallback
  const [, year, month, day, hour, minute] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}`
}

function dateTimeLocalToUtcTimestamp(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return Number.NaN
  const [, year, month, day, hour, minute] = match
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  const date = new Date(timestamp)
  return date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day) &&
      date.getUTCHours() === Number(hour) &&
      date.getUTCMinutes() === Number(minute)
    ? timestamp
    : Number.NaN
}

function dateTimeLocalDateStamp(value: string) {
  return normalizeDateTimeLocalStamp(value).slice(0, 10)
}

function getEventDeliveryStartAt(event: ProjectPackageEvent) {
  return normalizeDateTimeLocalStamp(event.deliveryStartAt, `${getEventDeliveryDate(event)}T00:00`)
}

function getEventDeliveryEndAt(event: ProjectPackageEvent) {
  return normalizeDateTimeLocalStamp(event.deliveryEndAt, `${getEventDeliveryDate(event)}T23:59`)
}

function formatEventDeliveryWindow(event: ProjectPackageEvent) {
  return formatDateTimeLocalWindow(getEventDeliveryStartAt(event), getEventDeliveryEndAt(event))
}

function formatDateTimeLocalWindow(startAt: string, endAt: string) {
  const formattedStartAt = startAt.replace('T', ' ')
  const formattedEndAt = endAt.replace('T', ' ')
  return `${formattedStartAt} ~ ${formattedEndAt}`
}

function getExpireMinutesUntil(value: string) {
  const remaining = Math.ceil(
    (dateTimeLocalToUtcTimestamp(value) -
      dateTimeLocalToUtcTimestamp(getShanghaiDateTimeLocalStamp())) /
      60000,
  )
  return Number.isFinite(remaining)
    ? Math.min(packageMarketExpireMaxMinutes, Math.max(1, remaining))
    : 1
}

function formatExpireDuration(minutes: number) {
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  const parts = []
  if (days > 0) parts.push(`${days} 天`)
  if (hours > 0) parts.push(`${hours} 小时`)
  if (parts.length === 0) parts.push('不足 1 小时')
  return parts.join(' ')
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

const packageMarketExpireMaxMinutes = 365 * 24 * 60

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

function packageItemFileName(item: Pick<ProjectPackageItem, 'objectKey' | 'packageName'>) {
  return item.objectKey.split('/').filter(Boolean).at(-1) || item.packageName
}

function summarizeGroupDetails(group: ProjectPackageGroup) {
  return Array.from(
    new Set(
      group.items
        .map((item) =>
          [itemChannelLabel(item), item.arch, item.version || '未知版本'].filter(Boolean).join(' · '),
        )
        .filter(Boolean),
    ),
  )
}

function summarizeGroup(group: ProjectPackageGroup) {
  return summarizeGroupDetails(group).join('；')
}

function summarizeGroupFileNames(group: ProjectPackageGroup) {
  return Array.from(
    new Set(group.items.map((item) => packageItemFileName(item)).filter(Boolean)),
  )
}

function operationHeading(operation: ProjectPackageOperation) {
  return getProjectPackageOperationTitle(
    operation,
    operation.kind === 'document' ? '未命名文档' : '操作事件',
  )
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
  const watcherNames = Array.isArray(todo.watcherNames) && todo.watcherNames.length > 0
    ? todo.watcherNames
    : todo.watcherName
      ? [todo.watcherName]
      : []
  return [
    todo.title,
    todo.moduleName ?? '',
    todo.assigneeName ?? '',
    watcherNames.join(' '),
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

function packageMarketSearchMeta(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
}

function getPackageMarketBaseRules(): PackageMarketRule[] {
  return [
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
  ]
}

function PackageMarketRuleList({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollbar, setScrollbar] = useState({ height: 0, scrollable: false, top: 0, value: 0 })

  function syncScrollbar() {
    const viewport = viewportRef.current
    if (!viewport) return
    const trackHeight = Math.max(0, viewport.clientHeight - 8)
    const maxScroll = viewport.scrollHeight - viewport.clientHeight
    if (maxScroll <= 0 || trackHeight <= 0) {
      setScrollbar({ height: 0, scrollable: false, top: 0, value: 0 })
      return
    }
    const height = Math.max(32, Math.round(trackHeight * viewport.clientHeight / viewport.scrollHeight))
    const travel = Math.max(0, trackHeight - height)
    const top = 4 + travel * viewport.scrollTop / maxScroll
    setScrollbar({
      height,
      scrollable: true,
      top,
      value: Math.round(viewport.scrollTop * 100 / maxScroll),
    })
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(syncScrollbar)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    syncScrollbar()
    return () => observer.disconnect()
  }, [children])

  function startScrollbarDrag(event: PointerEvent<HTMLButtonElement>) {
    const viewport = viewportRef.current
    if (!viewport) return
    const activeViewport = viewport
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const startY = event.clientY
    const startScrollTop = activeViewport.scrollTop
    const trackTravel = activeViewport.clientHeight - 8 - scrollbar.height
    const maxScroll = activeViewport.scrollHeight - activeViewport.clientHeight
    if (trackTravel <= 0 || maxScroll <= 0) return

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      activeViewport.scrollTop = startScrollTop + (moveEvent.clientY - startY) * maxScroll / trackTravel
    }

    function stopPointerDrag() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopPointerDrag)
      window.removeEventListener('pointercancel', stopPointerDrag)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopPointerDrag)
    window.addEventListener('pointercancel', stopPointerDrag)
  }

  function handleScrollbarKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const viewport = viewportRef.current
    if (!viewport) return
    const increments: Partial<Record<string, number>> = {
      ArrowDown: 40,
      ArrowUp: -40,
      PageDown: viewport.clientHeight * 0.8,
      PageUp: viewport.clientHeight * -0.8,
    }
    const increment = increments[event.key]
    if (increment == null) return
    event.preventDefault()
    viewport.scrollBy({ behavior: 'smooth', top: increment })
  }

  return (
    <div className="package-market-rule-list">
      <div className="package-market-rule-scroll" onScroll={syncScrollbar} ref={viewportRef}>
        <div className="package-market-rule-scroll-content">{children}</div>
      </div>
      {scrollbar.scrollable ? (
        <button
          aria-label="滚动安装包列表"
          aria-orientation="vertical"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={scrollbar.value}
          className="package-market-scrollbar-thumb"
          onKeyDown={handleScrollbarKeyDown}
          onPointerDown={startScrollbarDrag}
          role="scrollbar"
          style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }}
          type="button"
        />
      ) : null}
    </div>
  )
}

export function PackageMarketBrowser({
  onLoadPackageMarketCiBranches,
  onLoadPackageMarketDetail,
  onLoadPackageMarketRules,
  onLoadPackageMarketVersions,
}: PackageMarketBrowserProps) {
  const [copiedValue, setCopiedValue] = useState('')
  const [marketRules, setMarketRules] = useState<PackageMarketRule[]>([])
  const [marketExpireMinutes, setMarketExpireMinutes] = useState(packageMarketExpireOptions[0].value)
  const [marketSelectedPackage, setMarketSelectedPackage] = useState('base-pro')
  const [marketChannel, setMarketChannel] = useState<PackageMarketChannel>('release')
  const [marketArch, setMarketArch] = useState<'amd64' | 'arm64'>('amd64')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketReleaseVersion, setMarketReleaseVersion] = useState('')
  const [marketCiBranch, setMarketCiBranch] = useState('')
  const [marketCiVersion, setMarketCiVersion] = useState('')
  const [marketIncludeAll, setMarketIncludeAll] = useState(false)
  const [marketCiBranches, setMarketCiBranches] = useState<PackageMarketCiBranch[]>([])
  const [marketReleaseVersions, setMarketReleaseVersions] = useState<PackageMarketVersion[]>([])
  const [marketCiVersions, setMarketCiVersions] = useState<PackageMarketVersion[]>([])
  const [marketDetail, setMarketDetail] = useState<PackageMarketDetail | null>(null)
  const [marketDetailContext, setMarketDetailContext] = useState<PackageMarketDetailContext | null>(null)
  const [marketDependencyDetails, setMarketDependencyDetails] = useState<PackageMarketDependencyState[]>([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [marketExpandedGroups, setMarketExpandedGroups] = useState<Record<'base' | 'apps' | 'middleware', boolean>>({
    base: true,
    apps: true,
    middleware: true,
  })
  const marketDetailRequestIdRef = useRef(0)
  const loadMarketRulesRef = useRef(onLoadPackageMarketRules)
  const refreshMarketDetailRef = useRef<(
    nextOverrides?: Partial<{
      arch: 'amd64' | 'arm64'
      channel: PackageMarketChannel
      ciVersion: string
      expireMinutes: number
      includeAll: boolean
      marketRules: PackageMarketRule[]
      packageId: string
      releaseVersion: string
      dependencyVersions: Record<string, string>
    }>,
  ) => Promise<void>>(async () => undefined)

  const filteredRules = useMemo(() => {
    const query = packageMarketSearchMeta(marketSearch)
    const baseRules = [...getPackageMarketBaseRules(), ...marketRules]
    return baseRules.filter((rule) => {
      if (!query) return true
      return packageMarketSearchMeta(`${rule.id} ${rule.name}`).includes(query)
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

  const selectedMarketDependencyRules = useMemo(
    () => marketRules.filter((rule) => rule.category === 'dependency' && rule.parent === marketSelectedPackage),
    [marketRules, marketSelectedPackage],
  )

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

  async function refreshMarketDependencyDetails(params: {
    arch: 'amd64' | 'arm64'
    expireMinutes: number
    includeAll: boolean
    requestId: number
    rules: PackageMarketRule[]
    selectedVersions?: Record<string, string>
  }) {
    const { arch, expireMinutes, includeAll, requestId, rules, selectedVersions = {} } = params
    if (rules.length === 0) {
      setMarketDependencyDetails([])
      return
    }

    setMarketDependencyDetails(rules.map((rule) => ({
      context: null,
      detail: null,
      error: '',
      loading: true,
      rule,
      selectedVersion: selectedVersions[rule.id] ?? '',
      versions: [],
    })))

    const nextDetails = await Promise.all(rules.map(async (rule): Promise<PackageMarketDependencyState> => {
      const dependencyChannel: PackageMarketChannel = rule.dependencyRoots?.length ? 'ci' : 'release'
      try {
        const versions = await onLoadPackageMarketVersions({
          arch,
          kind: dependencyChannel,
          includeAll,
          packageId: rule.id,
        })
        const selectedVersion =
          selectedVersions[rule.id] ||
          (dependencyChannel === 'ci' ? versions[0]?.hash : versions[0]?.version) ||
          ''
        const detail = await onLoadPackageMarketDetail({
          packageId: rule.id,
          channel: dependencyChannel,
          arch,
          expireMinutes,
          includeAll,
          ciVersion: dependencyChannel === 'ci' ? selectedVersion : '',
          releaseVersion: dependencyChannel === 'release' ? selectedVersion : '',
        })
        return {
          context: {
            arch,
            channel: dependencyChannel,
            ciBranch: '',
            ciVersion: dependencyChannel === 'ci' ? selectedVersion : '',
            packageId: rule.id,
            releaseVersion: dependencyChannel === 'release' ? selectedVersion : '',
          },
          detail,
          error: '',
          loading: false,
          rule,
          selectedVersion,
          versions,
        }
      } catch (error) {
        return {
          context: null,
          detail: null,
          error: error instanceof Error ? error.message : '附属包详情加载失败',
          loading: false,
          rule,
          selectedVersion: selectedVersions[rule.id] ?? '',
          versions: [],
        }
      }
    }))

    if (requestId !== marketDetailRequestIdRef.current) return
    setMarketDependencyDetails(nextDetails)
  }

  async function refreshMarketDetail(nextOverrides?: Partial<{
    arch: 'amd64' | 'arm64'
    channel: PackageMarketChannel
    ciBranch: string
    ciVersion: string
    expireMinutes: number
    includeAll: boolean
    marketRules: PackageMarketRule[]
    packageId: string
    releaseVersion: string
    dependencyVersions: Record<string, string>
  }>) {
    const packageId = nextOverrides?.packageId ?? marketSelectedPackage
    const channel = nextOverrides?.channel ?? marketChannel
    const arch = nextOverrides?.arch ?? marketArch
    const releaseVersion = nextOverrides?.releaseVersion ?? marketReleaseVersion
    const requestedCiBranch = nextOverrides?.ciBranch ?? marketCiBranch
    const ciVersion = nextOverrides?.ciVersion ?? marketCiVersion
    const expireMinutes = nextOverrides?.expireMinutes ?? marketExpireMinutes
    const includeAll = nextOverrides?.includeAll ?? marketIncludeAll
    const rules = nextOverrides?.marketRules ?? marketRules
    const requestId = ++marketDetailRequestIdRef.current
    setMarketLoading(true)
    setMarketError('')
    setMarketDetail(null)
    setMarketDetailContext(null)
    setMarketDependencyDetails([])
    try {
      const ciBranches = channel === 'ci'
        ? await onLoadPackageMarketCiBranches(packageId)
        : []
      if (requestId !== marketDetailRequestIdRef.current) return
      const ciBranch = requestedCiBranch && ciBranches.some((item) => item.name === requestedCiBranch)
        ? requestedCiBranch
        : ciBranches[0]?.name ?? ''
      const context: PackageMarketDetailContext = {
        arch,
        channel,
        ciBranch,
        ciVersion,
        packageId,
        releaseVersion,
      }
      const [versions, detail] = await Promise.all([
        channel === 'ci'
          ? onLoadPackageMarketVersions({
              arch,
              ciBranch,
              kind: 'ci',
              includeAll,
              packageId,
            })
          : onLoadPackageMarketVersions({
              arch,
              kind: 'release',
              deployType: packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
              includeAll,
              packageId,
            }),
        onLoadPackageMarketDetail({
          packageId,
          channel,
          arch,
          ciBranch,
          deployType: packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
          expireMinutes,
          includeAll,
          releaseVersion,
          ciVersion,
        }),
      ])
      if (requestId !== marketDetailRequestIdRef.current) return
      if (channel === 'ci') {
        setMarketCiBranch(ciBranch)
        setMarketCiBranches(ciBranches)
        setMarketCiVersions(versions)
      } else {
        setMarketCiBranch('')
        setMarketCiBranches([])
        setMarketReleaseVersions(versions)
      }
      setMarketDetail(detail)
      setMarketDetailContext(context)
      const dependencyRules =
        rules.filter((rule) => rule.category === 'dependency' && rule.parent === packageId)
      void refreshMarketDependencyDetails({
        arch,
        expireMinutes,
        includeAll,
        requestId,
        rules: dependencyRules,
        selectedVersions: nextOverrides?.dependencyVersions,
      })
    } catch (error) {
      if (requestId !== marketDetailRequestIdRef.current) return
      setMarketError(error instanceof Error ? error.message : '包详情加载失败')
    } finally {
      if (requestId === marketDetailRequestIdRef.current) {
        setMarketLoading(false)
      }
    }
  }

  useEffect(() => {
    loadMarketRulesRef.current = onLoadPackageMarketRules
    refreshMarketDetailRef.current = refreshMarketDetail
  })

  function renderMarketLinkCard(
    detail: PackageMarketDetail,
    context: PackageMarketDetailContext | null,
    link: PackageMarketDetail['links'][number],
  ) {
    const fileName = link.objectKey.split('/').filter(Boolean).at(-1) || link.name
    const canDownload = Boolean(link.downloadUrl)
    return (
      <article className="package-market-link-card" key={`${context?.packageId ?? detail.title}-${link.objectKey}-${link.version}`}>
        <div className="package-market-link-head">
          <div className="package-market-link-meta">
            <strong>{fileName}</strong>
            {link.size ? <small>{formatBytes(link.size)}</small> : null}
          </div>
          <div className="package-market-link-actions">
            {canDownload ? <Button
              className="ghost-button"
              variant="outline"
              type="button"
              onClick={() =>
                void copyToClipboard(
                  link.downloadUrl,
                  `browser-copy-download-url-${link.objectKey}`,
                )
              }
            >
              <Copy size={15} /> {copiedLabel(`browser-copy-download-url-${link.objectKey}`, '链接')}
            </Button> : null}
            {canDownload ? <Button
              className="ghost-button"
              variant="outline"
              type="button"
              onClick={() =>
                void copyToClipboard(
                  createWgetDownloadCommand(link.downloadUrl, fileName),
                  `browser-copy-download-command-${link.objectKey}`,
                )
              }
            >
              <TerminalWindow size={15} /> {copiedLabel(`browser-copy-download-command-${link.objectKey}`, '命令')}
            </Button> : null}
            <Button
              className="ghost-button"
              variant="outline"
              type="button"
              onClick={() =>
                void copyToClipboard(link.objectKey, `browser-copy-object-key-${link.objectKey}`)
              }
            >
              <Copy size={15} /> {copiedLabel(`browser-copy-object-key-${link.objectKey}`, 'Key')}
            </Button>
          </div>
        </div>
        <code>{link.objectKey}</code>
        <div className="package-market-link-footer">
          {canDownload ? (
            <a href={link.downloadUrl} target="_blank" rel="noreferrer">
              查看临时链接
            </a>
          ) : (
            <span className="package-market-link-readonly">当前规则不允许下载此对象</span>
          )}
        </div>
      </article>
    )
  }

  useEffect(() => {
    const requestId = ++marketDetailRequestIdRef.current
    setMarketDetail(null)
    setMarketDetailContext(null)
    setMarketLoading(true)
    setMarketError('')
    void loadMarketRulesRef.current()
      .then((rulesPayload) => {
        if (requestId !== marketDetailRequestIdRef.current) return
        setMarketRules(rulesPayload.rules)
        const expireMinutes = packageMarketExpireOptions.some(
          (option) => option.value === rulesPayload.expireMinutes,
        )
          ? rulesPayload.expireMinutes
          : packageMarketExpireOptions[0].value
        setMarketExpireMinutes(expireMinutes)
        void refreshMarketDetailRef.current({
          expireMinutes,
          marketRules: rulesPayload.rules,
        })
      })
      .catch((error) => {
        if (requestId !== marketDetailRequestIdRef.current) return
        setMarketError(error instanceof Error ? error.message : '包市场读取失败')
        setMarketLoading(false)
      })
  }, [])

  return (
    <section className="package-market-workspace" aria-label="安装包市场">
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
            <Button
              className="package-market-show-all"
              variant={marketIncludeAll ? 'default' : 'outline'}
              type="button"
              aria-pressed={marketIncludeAll}
              title={marketIncludeAll ? '关闭全部包展示' : '展示全部包'}
              onClick={() => {
                const nextIncludeAll = !marketIncludeAll
                setMarketIncludeAll(nextIncludeAll)
                void refreshMarketDetail({ includeAll: nextIncludeAll })
              }}
            >
              {marketIncludeAll ? <EyeSlash size={15} /> : <Eye size={15} />}
              {marketIncludeAll ? '仅展示规则包' : '展示全部包'}
            </Button>
            <PackageMarketRuleList>
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
                              const nextChannel = rule.id === 'base-oss' ? 'release' : marketChannel
                              setMarketSelectedPackage(rule.id)
                              setMarketChannel(nextChannel)
                              setMarketReleaseVersion('')
                              setMarketCiBranch('')
                              setMarketCiVersion('')
                              void refreshMarketDetail({
                                packageId: rule.id,
                                channel: nextChannel,
                                releaseVersion: '',
                                ciBranch: '',
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
            </PackageMarketRuleList>
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
                    setMarketCiBranch('')
                    setMarketCiVersion('')
                    setMarketReleaseVersion('')
                    void refreshMarketDetail({ channel: next, ciBranch: '', ciVersion: '', releaseVersion: '' })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="release">正式包</SelectItem>
                    {marketSelectedPackage !== 'base-oss' ? (
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
                    setMarketCiBranch('')
                    setMarketCiVersion('')
                    setMarketReleaseVersion('')
                    void refreshMarketDetail({ arch: next, ciBranch: '', ciVersion: '', releaseVersion: '' })
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
              {marketChannel === 'ci' && marketCiBranches.length > 0 ? (
                <Label className="package-market-version-control">
                  CI 分支
                  <Select
                    value={marketCiBranch || marketCiBranches[0]?.name || ''}
                    onValueChange={(value) => {
                      setMarketCiBranch(value)
                      setMarketCiVersion('')
                      void refreshMarketDetail({ ciBranch: value, ciVersion: '' })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分支" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketCiBranches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.label}
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
                    marketDetail.links.map((link) => renderMarketLinkCard(marketDetail, marketDetailContext, link))
                  )}
                  {selectedMarketDependencyRules.length > 0 ? (
                    marketDependencyDetails.map((dependency) => (
                      <section className="package-market-dependency" key={dependency.rule.id}>
                        <div className="package-market-dependency-head">
                          <div>
                            <strong>{dependency.rule.name}</strong>
                            <small>附属包 · {dependency.rule.id}</small>
                          </div>
                          {dependency.versions.length > 0 ? (
                            <Label className="package-market-dependency-version">
                              版本
                              <Select
                                value={dependency.selectedVersion}
                                onValueChange={(value) => {
                                  const selectedVersions = Object.fromEntries(
                                    marketDependencyDetails.map((item) => [item.rule.id, item.selectedVersion]),
                                  )
                                  selectedVersions[dependency.rule.id] = value
                                    void refreshMarketDependencyDetails({
                                      arch: marketArch,
                                      expireMinutes: marketExpireMinutes,
                                      includeAll: marketIncludeAll,
                                      requestId: marketDetailRequestIdRef.current,
                                    rules: selectedMarketDependencyRules,
                                    selectedVersions,
                                  })
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择版本" />
                                </SelectTrigger>
                                <SelectContent>
                                  {dependency.versions.map((version) => (
                                    <SelectItem
                                      key={version.hash ?? version.version ?? version.label}
                                      value={version.hash ?? version.version ?? version.label}
                                    >
                                      {version.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Label>
                          ) : null}
                        </div>
                        {dependency.error ? <p className="form-error">{dependency.error}</p> : null}
                        {dependency.loading ? (
                          <p className="empty-state">正在读取附属包...</p>
                        ) : dependency.detail ? (
                          dependency.detail.links.length === 0 ? (
                            <p className="empty-state">当前参数下没有找到可用附属包对象。</p>
                          ) : (
                            <div className="package-market-link-list">
                              {dependency.detail.links.map((link) =>
                                renderMarketLinkCard(dependency.detail as PackageMarketDetail, dependency.context, link),
                              )}
                            </div>
                          )
                        ) : (
                          <p className="empty-state">当前包没有可用附属包对象。</p>
                        )}
                      </section>
                    ))
                  ) : null}
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
              <small>影响当前页面内“查看临时链接”和“复制下载链接”的有效期。</small>
            </div>
          </div>
      </div>
    </section>
  )
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
  onAddEventComment,
  onCompleteEvent,
  onCreateOperation,
  onDeleteEvent,
  onDeleteEventComment,
  onDeleteGroup,
  onDeleteOperation,
  onExportTimeline,
  onLoadPackageMarketCiBranches,
  onLoadPackageMarketDetail,
  onLoadPackageItemDownloadUrl,
  onLoadPackageMarketRules,
  onLoadPackageMarketVersions,
  onSaveEvent,
  onUpdateEventComment,
  onUpdateOperation,
  onUpdateTodo,
  project,
  todos,
  timeline,
}, ref) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false)
  const [eventEditorOpen, setEventEditorOpen] = useState(false)
  const [eventEditorEventId, setEventEditorEventId] = useState<number | null>(null)
  const [eventEditorStep, setEventEditorStep] = useState<1 | 2 | 3>(1)
  const [eventEditorDirty, setEventEditorDirty] = useState(false)
  const [eventDocumentTitle, setEventDocumentTitle] = useState('事件文档')
  const [eventDocumentContent, setEventDocumentContent] = useState('')
  const [eventDocumentRelatedTodoIds, setEventDocumentRelatedTodoIds] = useState<number[]>([])
  const [packageDocumentValues, setPackageDocumentValues] = useState<Record<string, EventDocumentDraftValue>>({})
  const [activeDocumentScope, setActiveDocumentScope] = useState('event')
  const documentTabsId = useId()
  const [documentTodoPickerOpen, setDocumentTodoPickerOpen] = useState(false)
  const [documentTodoSearch, setDocumentTodoSearch] = useState('')
  const [documentTodoFilterDialogOpen, setDocumentTodoFilterDialogOpen] = useState(false)
  const [documentTodoFilterJoin, setDocumentTodoFilterJoin] = useState<TodoFilterJoin>('and')
  const [documentTodoFilterConditions, setDocumentTodoFilterConditions] = useState<TodoFilterCondition[]>([])
  const [, setEventEditorReady] = useState(false)
  const [eventAssigneeUserId, setEventAssigneeUserId] = useState('')
  const [eventDeliveryStartAt, setEventDeliveryStartAt] = useState(() => `${getShanghaiDateStamp()}T00:00`)
  const [eventDeliveryEndAt, setEventDeliveryEndAt] = useState(() => `${getShanghaiDateStamp()}T23:59`)
  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState<ProjectPackageEventType>('upgrade')
  const [eventFilterDialogOpen, setEventFilterDialogOpen] = useState(false)
  const [eventFilterJoin, setEventFilterJoin] = useState<PackageEventFilterJoin>('and')
  const [eventFilterConditions, setEventFilterConditions] = useState<PackageEventFilterCondition[]>([])
  const [eventSortDirection, setEventSortDirection] = useState<'asc' | 'desc'>('desc')
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
  const [exportScopeDialogOpen, setExportScopeDialogOpen] = useState(false)
  const [exportScope, setExportScope] = useState<TimelineExportScope>('current')
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false)
  const [exportEditorReady, setExportEditorReady] = useState(false)
  const [exportFileName, setExportFileName] = useState('')
  const [exportContent, setExportContent] = useState('')
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketRules, setMarketRules] = useState<PackageMarketRule[]>([])
  const [marketExpireMinutes, setMarketExpireMinutes] = useState(packageMarketExpireOptions[0].value)
  const [marketExpireMode, setMarketExpireMode] = useState<'delivery-end' | 'custom'>('delivery-end')
  const [marketExpireDays, setMarketExpireDays] = useState('1')
  const [marketExpireHours, setMarketExpireHours] = useState('0')
  const [marketSelectedPackage, setMarketSelectedPackage] = useState('base-pro')
  const [marketChannel, setMarketChannel] = useState<PackageMarketChannel>('release')
  const [marketArch, setMarketArch] = useState<'amd64' | 'arm64'>('amd64')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketReleaseVersion, setMarketReleaseVersion] = useState('')
  const [marketCiBranch, setMarketCiBranch] = useState('')
  const [marketCiVersion, setMarketCiVersion] = useState('')
  const [marketIncludeAll, setMarketIncludeAll] = useState(false)
  const [marketCiBranches, setMarketCiBranches] = useState<PackageMarketCiBranch[]>([])
  const [marketReleaseVersions, setMarketReleaseVersions] = useState<PackageMarketVersion[]>([])
  const [marketCiVersions, setMarketCiVersions] = useState<PackageMarketVersion[]>([])
  const [marketDetail, setMarketDetail] = useState<PackageMarketDetail | null>(null)
  const [marketDetailContext, setMarketDetailContext] = useState<PackageMarketDetailContext | null>(null)
  const [marketDependencyDetails, setMarketDependencyDetails] = useState<PackageMarketDependencyState[]>([])
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
  const [copyingPackageItemId, setCopyingPackageItemId] = useState<number | null>(null)
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
  const activeEventFilterCount = eventFilterConditions.length
  const visibleEvents = useMemo(() => {
    const assignedEvents = assignedOnly && currentUserId
      ? events.filter((event) => event.assigneeUserId === currentUserId)
      : events
    return assignedEvents
      .filter((event) =>
        matchesPackageEventFilterConditions(event, eventFilterConditions, eventFilterJoin),
      )
      .sort((left, right) => {
        const deliveryDateComparison = getEventDeliveryDate(left)
          .localeCompare(getEventDeliveryDate(right))
        const createdAtComparison = left.createdAt.localeCompare(right.createdAt)
        const comparison = deliveryDateComparison || createdAtComparison || left.id - right.id
        return eventSortDirection === 'asc' ? comparison : -comparison
      })
  }, [
    assignedOnly,
    currentUserId,
    eventFilterConditions,
    eventFilterJoin,
    eventSortDirection,
    events,
  ])
  const todosById = useMemo(
    () => new Map(todos.map((todo) => [todo.id, todo])),
    [todos],
  )
  const selectableTodos = useMemo(
    () =>
      [...todos]
        .filter((todo) => todo.confirmationStatus !== 'rejected')
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
  const canManageProject = !project.readOnly && (
    project.accessRole === 'owner' || project.accessRole === 'member'
  )
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
  const todoDialogWatcherOptions = useMemo(() => {
    const watchers = new Map<number, string>()
    for (const todo of selectableTodos) {
      const watcherIds = Array.isArray(todo.watcherUserIds) && todo.watcherUserIds.length > 0
        ? todo.watcherUserIds
        : todo.watcherUserId
          ? [todo.watcherUserId]
          : []
      const watcherNames = Array.isArray(todo.watcherNames) && todo.watcherNames.length > 0
        ? todo.watcherNames
        : todo.watcherName
          ? [todo.watcherName]
          : []
      watcherIds.forEach((watcherId, index) => {
        const watcherName = watcherNames[index]
        if (watcherName) {
          watchers.set(watcherId, watcherName)
        }
      })
      if (watcherIds.length > 0 && watcherNames.length === 0 && todo.watcherName) {
        watchers.set(watcherIds[0], todo.watcherName)
      }
    }
    return Array.from(watchers, ([id, name]) => ({ id, name }))
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
  const canManageTimeline = canManageProject && Boolean(selectedEvent && !selectedEvent.publishedAt)
  const existingOperationInteraction = resolveExistingOperationInteraction(canManageTimeline)
  const operationDialogReadOnly = Boolean(
    pendingOperationTarget?.operation && existingOperationInteraction.readOnly,
  )

  const selectedGroup =
    selectedEvent?.groups.find((group) => group.id === selectedGroupId) ??
    selectedEvent?.groups[0] ??
    null

  useEffect(() => {
    const nextEvent =
      visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? null
    const nextGroup =
      nextEvent?.groups.find((group) => group.id === selectedGroupId) ??
      nextEvent?.groups[0] ??
      null
    if (nextEvent?.id !== selectedEventId) {
      setSelectedEventId(nextEvent?.id ?? null)
    }
    if (nextGroup?.id !== selectedGroupId) {
      setSelectedGroupId(nextGroup?.id ?? null)
    }
  }, [selectedEventId, selectedGroupId, visibleEvents])

  const selectedEventAddedObjectKeys = useMemo(() => {
    const next = new Set<string>()
    cartItems.forEach((item) => next.add(item.objectKey))
    return next
  }, [cartItems])
  const selectedEventProgress = selectedEvent
    ? getEventCompletionProgress(selectedEvent, todosById)
    : { completed: 0, percent: 0, total: 0 }
  const draftPackageNames = useMemo(
    () => Array.from(new Set(cartItems.map((item) => item.packageName))),
    [cartItems],
  )
  const documentScopes = useMemo(
    () => ['event', ...draftPackageNames.map((packageName) => `package:${packageName}`)],
    [draftPackageNames],
  )
  const resolvedDocumentScope = documentScopes.includes(activeDocumentScope)
    ? activeDocumentScope
    : 'event'
  const activePackageDocumentName = resolvedDocumentScope.startsWith('package:')
    ? resolvedDocumentScope.slice('package:'.length)
    : ''
  const activePackageDocument = activePackageDocumentName
    ? packageDocumentValues[activePackageDocumentName] ?? {
        content: '',
        relatedTodoIds: [],
        title: `${activePackageDocumentName} 安装包文档`,
      }
    : null
  const activeDocumentRelatedTodoIds = activePackageDocument
    ? activePackageDocument.relatedTodoIds
    : eventDocumentRelatedTodoIds
  const activeDocumentRelatedTodoIdSet = useMemo(
    () => new Set(activeDocumentRelatedTodoIds),
    [activeDocumentRelatedTodoIds],
  )
  const activeDocumentRelatedTodos = useMemo(
    () =>
      activeDocumentRelatedTodoIds
        .map((todoId) => selectableTodosById.get(todoId) ?? todosById.get(todoId))
        .filter((todo): todo is Todo => Boolean(todo)),
    [activeDocumentRelatedTodoIds, selectableTodosById, todosById],
  )
  const activeDocumentTodoFilterCount = documentTodoFilterConditions.length
  const documentTodoFilterSummary = activeDocumentTodoFilterCount > 0
    ? `已筛选 ${activeDocumentTodoFilterCount} 条件`
    : '筛选'
  const filteredDocumentTodos = useMemo(() => {
    const query = documentTodoSearch.trim().toLocaleLowerCase()
    return selectableTodos.filter((todo) => {
      const matchesSearch = !query ||
        `${todo.title} ${todoSearchMeta(todo)}`.toLocaleLowerCase().includes(query)
      return matchesSearch && matchesTodoFilterConditions(
        todo,
        documentTodoFilterConditions,
        documentTodoFilterJoin,
      )
    })
  }, [documentTodoFilterConditions, documentTodoFilterJoin, documentTodoSearch, selectableTodos])
  const eventBasicInformationValid = Boolean(
    eventTitle.trim() &&
      eventDeliveryStartAt &&
      eventDeliveryEndAt &&
      dateTimeLocalToUtcTimestamp(eventDeliveryEndAt) > dateTimeLocalToUtcTimestamp(eventDeliveryStartAt) &&
      Number(eventAssigneeUserId) > 0,
  )

  function updatePackageDocument(
    packageName: string,
    patch: Partial<EventDocumentDraftValue>,
  ) {
    setPackageDocumentValues((current) => ({
      ...current,
      [packageName]: {
        content: current[packageName]?.content ?? '',
        relatedTodoIds: current[packageName]?.relatedTodoIds ?? [],
        title: current[packageName]?.title || `${packageName} 安装包文档`,
        ...patch,
      },
    }))
    setEventEditorDirty(true)
  }

  function selectDocumentScope(scope: string) {
    setActiveDocumentScope(scope)
    setDocumentTodoPickerOpen(false)
    setDocumentTodoFilterDialogOpen(false)
    setDocumentTodoSearch('')
    setEventEditorReady(false)
  }

  function handleDocumentTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, scope: string) {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = documentScopes.indexOf(scope)
    if (currentIndex < 0) return
    const lastIndex = documentScopes.length - 1
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (currentIndex - 1 + documentScopes.length) % documentScopes.length
          : (currentIndex + 1) % documentScopes.length
    const nextScope = documentScopes[nextIndex]
    selectDocumentScope(nextScope)
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[nextIndex]?.focus()
  }

  useEffect(() => {
    if (documentScopes.includes(activeDocumentScope)) return
    setActiveDocumentScope('event')
    setDocumentTodoPickerOpen(false)
    setDocumentTodoFilterDialogOpen(false)
    setDocumentTodoSearch('')
    setEventEditorReady(false)
  }, [activeDocumentScope, documentScopes])

  function toggleActiveDocumentTodo(todoId: number) {
    const nextRelatedTodoIds = activeDocumentRelatedTodoIds.includes(todoId)
      ? activeDocumentRelatedTodoIds.filter((item) => item !== todoId)
      : [...activeDocumentRelatedTodoIds, todoId]
    if (activePackageDocumentName) {
      updatePackageDocument(activePackageDocumentName, { relatedTodoIds: nextRelatedTodoIds })
    } else {
      setEventDocumentRelatedTodoIds(nextRelatedTodoIds)
      setEventEditorDirty(true)
    }
  }

  function removeDraftPackageItem(objectKey: string) {
    setCartItems((current) => current.filter((item) => item.objectKey !== objectKey))
    setEventEditorDirty(true)
  }

  const filteredRules = useMemo(() => {
    const query = packageMarketSearchMeta(marketSearch)
    const baseRules: PackageMarketRule[] = [
      ...getPackageMarketBaseRules(),
      ...marketRules,
    ]
    return baseRules.filter((rule) => {
      if (!query) return true
      return packageMarketSearchMeta(`${rule.id} ${rule.name}`).includes(query)
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
  const selectedMarketDependencyRules = useMemo(
    () => marketRules.filter((rule) => rule.category === 'dependency' && rule.parent === marketSelectedPackage),
    [marketRules, marketSelectedPackage],
  )

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

  async function copyPackageItemDownloadLink(item: ProjectPackageItem) {
    setCopyingPackageItemId(item.id)
    try {
      const downloadUrl = await onLoadPackageItemDownloadUrl(item.id)
      await copyToClipboard(downloadUrl, `package-item-download-url-${item.id}`)
    } catch {
      return
    } finally {
      setCopyingPackageItemId((current) => (current === item.id ? null : current))
    }
  }

  async function copyPackageItemDownloadCommand(item: ProjectPackageItem) {
    setCopyingPackageItemId(item.id)
    try {
      const downloadUrl = await onLoadPackageItemDownloadUrl(item.id)
      await copyToClipboard(
        createWgetDownloadCommand(downloadUrl, packageItemFileName(item)),
        `package-item-download-command-${item.id}`,
      )
    } catch {
      return
    } finally {
      setCopyingPackageItemId((current) => (current === item.id ? null : current))
    }
  }

  function addMarketLinkToCart(
    context: PackageMarketDetailContext | null,
    detail: PackageMarketDetail,
    link: PackageMarketDetail['links'][number],
  ) {
    if (!context || selectedEventAddedObjectKeys.has(link.objectKey)) return
    setCartItems((current) => {
      if (current.some((item) => item.objectKey === link.objectKey)) return current
      return [
        ...current,
        {
          sourcePackageId: context.packageId,
          sourcePackageName: detail.title,
          packageName: link.name,
          channel: context.channel,
          channelLabel: channelLabel(context.channel),
          arch: context.arch,
          version: link.version,
          objectKey: link.objectKey,
          objectLastModified: link.lastModified,
          sizeBytes: link.size,
        },
      ]
    })
    setEventEditorDirty(true)
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
      const expireMinutes = getExpireMinutesUntil(eventDeliveryEndAt)
      const defaultDays = Math.floor(expireMinutes / (24 * 60))
      const defaultHours = Math.floor((expireMinutes % (24 * 60)) / 60)
      setMarketExpireMode('delivery-end')
      setMarketExpireDays(String(defaultDays))
      setMarketExpireHours(String(defaultHours))
      setMarketExpireMinutes(expireMinutes)
      return { expireMinutes, rules: rulesPayload.rules }
    } catch (error) {
      if (requestId !== marketDetailRequestIdRef.current) return null
      setMarketError(error instanceof Error ? error.message : '包市场读取失败')
      return null
    }
  }

  async function refreshMarketDependencyDetails(params: {
    arch: 'amd64' | 'arm64'
    expireMinutes: number
    includeAll: boolean
    requestId: number
    rules: PackageMarketRule[]
    selectedVersions?: Record<string, string>
  }) {
    const { arch, expireMinutes, includeAll, requestId, rules, selectedVersions = {} } = params
    if (rules.length === 0) {
      setMarketDependencyDetails([])
      return
    }

    setMarketDependencyDetails(rules.map((rule) => ({
      context: null,
      detail: null,
      error: '',
      loading: true,
      rule,
      selectedVersion: selectedVersions[rule.id] ?? '',
      versions: [],
    })))

    const nextDetails = await Promise.all(rules.map(async (rule): Promise<PackageMarketDependencyState> => {
      const dependencyChannel: PackageMarketChannel = rule.dependencyRoots?.length ? 'ci' : 'release'
      try {
        const versions = await onLoadPackageMarketVersions({
          arch,
          kind: dependencyChannel,
          includeAll,
          packageId: rule.id,
        })
        const selectedVersion =
          selectedVersions[rule.id] ||
          (dependencyChannel === 'ci' ? versions[0]?.hash : versions[0]?.version) ||
          ''
        const detail = await onLoadPackageMarketDetail({
          packageId: rule.id,
          channel: dependencyChannel,
          arch,
          expireMinutes,
          includeAll,
          ciVersion: dependencyChannel === 'ci' ? selectedVersion : '',
          releaseVersion: dependencyChannel === 'release' ? selectedVersion : '',
        })
        return {
          context: {
            arch,
            channel: dependencyChannel,
            ciBranch: '',
            ciVersion: dependencyChannel === 'ci' ? selectedVersion : '',
            packageId: rule.id,
            releaseVersion: dependencyChannel === 'release' ? selectedVersion : '',
          },
          detail,
          error: '',
          loading: false,
          rule,
          selectedVersion,
          versions,
        }
      } catch (error) {
        return {
          context: null,
          detail: null,
          error: error instanceof Error ? error.message : '附属包详情加载失败',
          loading: false,
          rule,
          selectedVersion: selectedVersions[rule.id] ?? '',
          versions: [],
        }
      }
    }))

    if (requestId !== marketDetailRequestIdRef.current) return
    setMarketDependencyDetails(nextDetails)
  }

  async function refreshMarketDetail(nextOverrides?: Partial<{
    arch: 'amd64' | 'arm64'
    channel: PackageMarketChannel
    ciBranch: string
    ciVersion: string
    expireMinutes: number
    includeAll: boolean
    marketRules: PackageMarketRule[]
    packageId: string
    releaseVersion: string
    dependencyVersions: Record<string, string>
  }>) {
    const packageId = nextOverrides?.packageId ?? marketSelectedPackage
    const channel = nextOverrides?.channel ?? marketChannel
    const arch = nextOverrides?.arch ?? marketArch
    const releaseVersion = nextOverrides?.releaseVersion ?? marketReleaseVersion
    const requestedCiBranch = nextOverrides?.ciBranch ?? marketCiBranch
    const ciVersion = nextOverrides?.ciVersion ?? marketCiVersion
    const expireMinutes = nextOverrides?.expireMinutes ?? marketExpireMinutes
    const includeAll = nextOverrides?.includeAll ?? marketIncludeAll
    const rules = nextOverrides?.marketRules ?? marketRules
    const requestId = ++marketDetailRequestIdRef.current
    setMarketLoading(true)
    setMarketError('')
    setMarketDetail(null)
    setMarketDetailContext(null)
    setMarketDependencyDetails([])
    try {
      const ciBranches = channel === 'ci'
        ? await onLoadPackageMarketCiBranches(packageId)
        : []
      if (requestId !== marketDetailRequestIdRef.current) return
      const ciBranch = requestedCiBranch && ciBranches.some((item) => item.name === requestedCiBranch)
        ? requestedCiBranch
        : ciBranches[0]?.name ?? ''
      const context: PackageMarketDetailContext = {
        arch,
        channel,
        ciBranch,
        ciVersion,
        packageId,
        releaseVersion,
      }
      const [versions, detail] = await Promise.all([
        channel === 'ci'
          ? onLoadPackageMarketVersions({
              arch,
              ciBranch,
              kind: 'ci',
              includeAll,
              packageId,
            })
          : onLoadPackageMarketVersions({
              arch,
              kind: 'release',
              deployType: packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
              includeAll,
              packageId,
            }),
        onLoadPackageMarketDetail({
          packageId,
          channel,
          arch,
          ciBranch,
          deployType: packageId === 'base-oss' ? 'oss' : packageId === 'base-pro' ? 'pro' : undefined,
          expireMinutes,
          includeAll,
          releaseVersion,
          ciVersion,
        }),
      ])
      if (requestId !== marketDetailRequestIdRef.current) return
      if (channel === 'ci') {
        setMarketCiBranch(ciBranch)
        setMarketCiBranches(ciBranches)
        setMarketCiVersions(versions)
      } else {
        setMarketCiBranch('')
        setMarketCiBranches([])
        setMarketReleaseVersions(versions)
      }
      setMarketDetail(detail)
      setMarketDetailContext(context)
      const dependencyRules =
        rules.filter((rule) => rule.category === 'dependency' && rule.parent === packageId)
      void refreshMarketDependencyDetails({
        arch,
        expireMinutes,
        includeAll,
        requestId,
        rules: dependencyRules,
        selectedVersions: nextOverrides?.dependencyVersions,
      })
    } catch (error) {
      if (requestId !== marketDetailRequestIdRef.current) return
      setMarketError(error instanceof Error ? error.message : '包详情加载失败')
    } finally {
      if (requestId === marketDetailRequestIdRef.current) {
        setMarketLoading(false)
      }
    }
  }

  function confirmDiscardEventChanges() {
    return !eventEditorDirty || window.confirm('当前事件有未保存修改，确认离开吗？')
  }

  function openCreateEventEditor() {
    if (!confirmDiscardEventChanges()) return
    setEventEditorEventId(null)
    setEventEditorStep(1)
    setEventTitle('')
    setEventType(events.length === 0 ? 'init' : 'upgrade')
    const startDate = getShanghaiDateStamp()
    setEventDeliveryStartAt(`${startDate}T00:00`)
    setEventDeliveryEndAt(`${startDate}T23:59`)
    setEventAssigneeUserId(
      String(
        memberOptions.find((member) => member.id === currentUserId)?.id ??
          memberOptions[0]?.id ??
          '',
      ),
    )
    setCartItems([])
    setEventDocumentTitle('事件文档')
    setEventDocumentContent('')
    setEventDocumentRelatedTodoIds([])
    setPackageDocumentValues({})
    setActiveDocumentScope('event')
    setDocumentTodoPickerOpen(false)
    setDocumentTodoSearch('')
    setDocumentTodoFilterDialogOpen(false)
    setDocumentTodoFilterJoin('and')
    setDocumentTodoFilterConditions([])
    setEventEditorReady(false)
    setEventEditorDirty(false)
    setEventEditorOpen(true)
  }

  function openPackageMarket() {
    const openRequestId = ++marketDetailRequestIdRef.current
    setMarketDetail(null)
    setMarketDetailContext(null)
    setMarketLoading(true)
    setMarketError('')
    setMarketOpen(true)
    void loadMarketContext(openRequestId).then((context) => {
      if (openRequestId !== marketDetailRequestIdRef.current) return
      if (context == null) {
        setMarketLoading(false)
        return
      }
      void refreshMarketDetail({
        expireMinutes: context.expireMinutes,
        marketRules: context.rules,
      })
      })
  }

  function customMarketExpireMinutes(daysValue = marketExpireDays, hoursValue = marketExpireHours) {
    const days = Number(daysValue)
    const hours = Number(hoursValue)
    if (
      !Number.isInteger(days) ||
      !Number.isInteger(hours) ||
      days < 0 ||
      hours < 0 ||
      hours > 23
    ) {
      return null
    }
    const minutes = days * 24 * 60 + hours * 60
    if (minutes < 1 || minutes > packageMarketExpireMaxMinutes) return null
    return minutes
  }

  function refreshCustomMarketExpire(nextDays: string, nextHours: string) {
    const nextMinutes = customMarketExpireMinutes(nextDays, nextHours)
    if (nextMinutes == null) return
    setMarketExpireMinutes(nextMinutes)
    void refreshMarketDetail({ expireMinutes: nextMinutes })
  }

  function openDraftEventEditor(event: ProjectPackageEvent) {
    if (event.publishedAt || !confirmDiscardEventChanges()) return
    const eventDocument = event.operations.find((operation) => operation.kind === 'document')
    const packageDocuments = Object.fromEntries(
      event.groups.map((group) => {
        const document = group.operations.find((operation) => operation.kind === 'document')
        return [
          group.packageName,
          {
            content: document?.content ?? '',
            relatedTodoIds: document?.relatedTodoIds ?? [],
            title: document?.title || `${group.packageName} 安装包文档`,
          },
        ]
      }),
    )
    setEventEditorEventId(event.id)
    setEventEditorStep(1)
    setSelectedEventId(event.id)
    setEventTitle(event.title)
    setEventType(event.type)
    setEventDeliveryStartAt(`${dateTimeLocalDateStamp(getEventDeliveryStartAt(event))}T00:00`)
    setEventDeliveryEndAt(`${dateTimeLocalDateStamp(getEventDeliveryEndAt(event))}T23:59`)
    setEventAssigneeUserId(String(event.assigneeUserId ?? memberOptions[0]?.id ?? ''))
    setCartItems(event.groups.flatMap((group) => group.items.map((item) => ({
      arch: item.arch,
      channel: item.channel,
      channelLabel: item.channelLabel,
      objectKey: item.objectKey,
      objectLastModified: item.objectLastModified,
      packageName: item.packageName,
      sizeBytes: item.sizeBytes,
      sourcePackageId: item.sourcePackageId,
      sourcePackageName: item.sourcePackageName,
      version: item.version,
    }))))
    setEventDocumentTitle(eventDocument?.title || `${event.title} 事件文档`)
    setEventDocumentContent(eventDocument?.content ?? '')
    setEventDocumentRelatedTodoIds(eventDocument?.relatedTodoIds ?? [])
    setPackageDocumentValues(packageDocuments)
    setActiveDocumentScope('event')
    setDocumentTodoPickerOpen(false)
    setDocumentTodoSearch('')
    setDocumentTodoFilterDialogOpen(false)
    setDocumentTodoFilterJoin('and')
    setDocumentTodoFilterConditions([])
    setEventEditorReady(false)
    setEventEditorDirty(false)
    setEventEditorOpen(true)
  }

  function selectEventFromList(event: ProjectPackageEvent) {
    if (!confirmDiscardEventChanges()) return
    setEventEditorOpen(false)
    setEventEditorDirty(false)
    setSelectedEventId(event.id)
    setSelectedGroupId(event.groups[0]?.id ?? null)
  }

  async function deleteEventFromList(event: ProjectPackageEvent) {
    const deletedIndex = visibleEvents.findIndex((item) => item.id === event.id)
    const nextEvent = deletedIndex >= 0
      ? visibleEvents[deletedIndex + 1] ?? visibleEvents[deletedIndex - 1] ?? null
      : null
    const deletingActiveEvent = selectedEvent?.id === event.id || (
      eventEditorOpen && eventEditorEventId === event.id
    )
    const deleted = await onDeleteEvent(event.id)
    if (!deleted || !deletingActiveEvent) return

    setEventEditorOpen(false)
    setEventEditorDirty(false)
    setEventEditorEventId(null)
    setSelectedEventId(nextEvent?.id ?? null)
    setSelectedGroupId(nextEvent?.groups[0]?.id ?? null)
  }

  function openOperationDialog(target: PendingOperationTarget, kind: ProjectPackageOperationKind) {
    const normalizedTarget = target?.operation
      ? {
          ...target,
          eventId: target.operation.eventId,
          groupId: target.operation.groupId,
        }
      : target
    setOperationEditorReady(false)
    setPendingOperationTarget(normalizedTarget)
    setOperationKind(normalizedTarget?.operation?.kind ?? kind)
    setOperationTitle(
      normalizedTarget?.operation
        ? getProjectPackageOperationTitle(
            normalizedTarget.operation,
            normalizedTarget.defaultTitle ?? (kind === 'document' ? '操作文档' : '操作事件'),
          )
        : normalizedTarget?.defaultTitle ?? (kind === 'document' ? '操作文档' : '操作事件'),
    )
    setOperationContent(normalizedTarget?.operation?.content ?? '')
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

  async function saveEvent(action: 'publish' | 'save_draft') {
    const assigneeUserId = Number(eventAssigneeUserId)
    if (!eventBasicInformationValid || !Number.isInteger(assigneeUserId) || assigneeUserId <= 0) return
    if (action === 'publish' && (!eventDocumentTitle.trim() || !eventDocumentContent.trim())) {
      setEventEditorStep(3)
      return
    }
    setBusyAction('event')
    try {
      const packageNames = Array.from(new Set(cartItems.map((item) => item.packageName)))
      const packageDocuments = packageNames.flatMap((packageName) => {
        const document = packageDocumentValues[packageName]
        if (action === 'publish' && !document?.content.trim()) return []
        return [{
          content: document?.content ?? '',
          packageName,
          relatedTodoIds: document?.relatedTodoIds ?? [],
          scope: 'package' as const,
          title: document?.title.trim() || `${packageName} 安装包文档`,
        }]
      })
      const savedEvent = await onSaveEvent(eventEditorEventId, {
        action,
        assigneeUserId,
        deliveryDate: dateTimeLocalDateStamp(eventDeliveryEndAt),
        deliveryEndAt: eventDeliveryEndAt,
        deliveryStartAt: eventDeliveryStartAt,
        documents: [{
          content: eventDocumentContent,
          relatedTodoIds: eventDocumentRelatedTodoIds,
          scope: 'event',
          title: eventDocumentTitle.trim() || `${eventTitle.trim()} 事件文档`,
        }, ...packageDocuments],
        items: cartItems,
        title: eventTitle.trim(),
        type: eventType,
      })
      if (savedEvent) {
        setAssignedOnly(false)
        setEventFilterConditions([])
        setEventFilterJoin('and')
        setSelectedEventId(savedEvent.id)
        setSelectedGroupId(savedEvent.groups[0]?.id ?? null)
        setEventEditorOpen(false)
        setEventEditorDirty(false)
      }
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
    setMarketOpen(false)
    setEventEditorDirty(true)
  }

  function openExportScopeDialog() {
    setExportScope(selectedEvent ? 'current' : 'all')
    setExportScopeDialogOpen(true)
  }

  async function handleExport(scope: TimelineExportScope) {
    const eventId = scope === 'current' ? selectedEvent?.id : undefined
    if (scope === 'current' && eventId == null) return
    setExportScopeDialogOpen(false)
    setBusyAction('export')
    try {
      const result = await onExportTimeline(eventId)
      setExportEditorReady(false)
      setExportFileName(result.fileName)
      setExportContent(result.markdown)
      setExportPreviewOpen(true)
    } finally {
      setBusyAction('')
    }
  }

  function renderMarketLinkCard(
    detail: PackageMarketDetail,
    context: PackageMarketDetailContext | null,
    link: PackageMarketDetail['links'][number],
  ) {
    const fileName = link.objectKey.split('/').filter(Boolean).at(-1) || link.name
    const canDownload = Boolean(link.downloadUrl)
    const alreadyAdded = selectedEventAddedObjectKeys.has(link.objectKey)
    return (
      <article className="package-market-link-card" key={`${context?.packageId ?? detail.title}-${link.objectKey}-${link.version}`}>
        <div className="package-market-link-head">
          <div className="package-market-link-meta">
            <strong>{fileName}</strong>
            {link.size ? <small>{formatBytes(link.size)}</small> : null}
          </div>
          <div className="package-market-link-actions">
            {canDownload ? <Button
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
              <Copy size={15} /> {copiedLabel(`copy-download-url-${link.objectKey}`, '链接')}
            </Button> : null}
            {canDownload ? <Button
              className="ghost-button"
              variant="outline"
              type="button"
              onClick={() =>
                void copyToClipboard(
                  createWgetDownloadCommand(link.downloadUrl, fileName),
                  `copy-download-command-${link.objectKey}`,
                )
              }
            >
              <TerminalWindow size={15} /> {copiedLabel(`copy-download-command-${link.objectKey}`, '命令')}
            </Button> : null}
            <Button
              className="solid-button"
              type="button"
              disabled={!context || !canDownload || alreadyAdded}
              onClick={() => addMarketLinkToCart(context, detail, link)}
            >
              <Package size={16} /> {alreadyAdded ? '已添加' : '添加'}
            </Button>
          </div>
        </div>
        <code>{link.objectKey}</code>
        <div className="package-market-link-footer">
          {canDownload ? (
            <a href={link.downloadUrl} target="_blank" rel="noreferrer">
              查看临时链接
            </a>
          ) : (
            <span className="package-market-link-readonly">当前规则不允许下载此对象</span>
          )}
          <Button
            className="ghost-button"
            variant="outline"
            type="button"
            onClick={() =>
              void copyToClipboard(link.objectKey, `copy-object-key-${link.objectKey}`)
            }
          >
            <Copy size={15} /> {copiedLabel(`copy-object-key-${link.objectKey}`, 'Key')}
          </Button>
        </div>
      </article>
    )
  }

  useImperativeHandle(ref, () => ({
    exportTimeline: () => {
      openExportScopeDialog()
    },
    selectEvent: (eventId: number) => {
      const targetEvent = events.find((event) => event.id === eventId)
      setAssignedOnly(false)
      setEventFilterConditions([])
      setEventFilterJoin('and')
      setSelectedEventId(eventId)
      setSelectedGroupId(targetEvent?.groups[0]?.id ?? null)
      setEventEditorOpen(false)
      setEventEditorDirty(false)
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

  function renderEventEditor() {
    return (
      <section className="event-wizard" aria-label="交付事件编辑器">
        <header className="event-wizard-header">
          <div className="event-wizard-heading">
            <span className="event-wizard-eyebrow">
              {eventEditorEventId == null ? '新建交付事件' : '编辑事件草稿'}
            </span>
            <h3>{eventTitle.trim() || '未命名事件'}</h3>
          </div>
        </header>
        <div className="event-wizard-main">
          <div className="event-wizard-steps-row">
            <nav className="event-wizard-steps" aria-label="事件创建步骤">
              {([
                { label: '基本信息', step: 1 as const },
                { label: '选择安装包', step: 2 as const },
                { label: '填写文档', step: 3 as const },
              ]).map((item) => (
                <div className={item.step === 3 ? 'event-wizard-step-group documents' : 'event-wizard-step-group'} key={item.step}>
                  <button
                    aria-current={eventEditorStep === item.step ? 'step' : undefined}
                    className={[
                      'event-wizard-step',
                      item.step <= eventEditorStep ? 'reached' : '',
                      eventEditorStep === item.step ? 'active' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={item.step > 1 && !eventBasicInformationValid}
                    onClick={() => {
                      setEventEditorStep(item.step)
                      if (item.step === 3) setEventEditorReady(false)
                    }}
                    type="button"
                  >
                    <span>{item.step}</span>
                    {item.label}
                  </button>
                  {item.step === 3 && eventEditorStep === 3 ? (
                    <div className="event-wizard-document-nav" role="tablist" aria-label="填写文档子选项">
                      <button
                        aria-controls={`${documentTabsId}-panel`}
                        aria-selected={resolvedDocumentScope === 'event'}
                        className={resolvedDocumentScope === 'event' ? 'active' : ''}
                        id={`${documentTabsId}-event-tab`}
                        onKeyDown={(event) => handleDocumentTabKeyDown(event, 'event')}
                        onClick={() => selectDocumentScope('event')}
                        role="tab"
                        tabIndex={resolvedDocumentScope === 'event' ? 0 : -1}
                        type="button"
                      >
                        事件文档
                      </button>
                      {draftPackageNames.map((packageName, index) => {
                        const scope = `package:${packageName}`
                        return (
                          <button
                            aria-controls={`${documentTabsId}-panel`}
                            aria-selected={resolvedDocumentScope === scope}
                            className={resolvedDocumentScope === scope ? 'active' : ''}
                            id={`${documentTabsId}-package-${index}-tab`}
                            key={packageName}
                            onKeyDown={(event) => handleDocumentTabKeyDown(event, scope)}
                            onClick={() => selectDocumentScope(scope)}
                            role="tab"
                            tabIndex={resolvedDocumentScope === scope ? 0 : -1}
                            title={`${packageName} 安装包文档`}
                            type="button"
                          >
                            {packageName}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>
          </div>

          <div className="event-wizard-content">
          {eventEditorStep === 1 ? (
            <div className="event-wizard-form-grid">
              <Label>
                事件类型
                <Select
                  value={eventType}
                  onValueChange={(value) => {
                    setEventType(value as ProjectPackageEventType)
                    setEventEditorDirty(true)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="选择事件类型" /></SelectTrigger>
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
                  onChange={(event) => {
                    setEventTitle(event.target.value)
                    setEventEditorDirty(true)
                  }}
                  placeholder="例如：控制台升级到 v5.1.2"
                />
              </Label>
              <div className="event-wizard-date-fields">
                <Label>
                  交付开始日期
                  <JournalDatePicker
                    ariaLabel="交付开始日期"
                    datesWithEntries={[]}
                    displayValue={dateTimeLocalDateStamp(eventDeliveryStartAt).replaceAll('-', '/')}
                    value={dateTimeLocalDateStamp(eventDeliveryStartAt)}
                    onChange={(date) => {
                      setEventDeliveryStartAt(`${date}T00:00`)
                      setEventEditorDirty(true)
                    }}
                  />
                </Label>
                <Label>
                  预期交付完成日期
                  <JournalDatePicker
                    ariaLabel="预期交付完成日期"
                    datesWithEntries={[]}
                    displayValue={dateTimeLocalDateStamp(eventDeliveryEndAt).replaceAll('-', '/')}
                    value={dateTimeLocalDateStamp(eventDeliveryEndAt)}
                    onChange={(date) => {
                      setEventDeliveryEndAt(`${date}T23:59`)
                      setEventEditorDirty(true)
                    }}
                  />
                </Label>
              </div>
              <Label>
                交付人
                <Select
                  value={eventAssigneeUserId}
                  onValueChange={(value) => {
                    setEventAssigneeUserId(value)
                    setEventEditorDirty(true)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="选择交付人" /></SelectTrigger>
                  <SelectContent>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            </div>
          ) : null}

          {eventEditorStep === 2 ? (
            <div className="event-wizard-packages">
              <div className="event-wizard-section-head">
                <div>
                  <h4>安装包</h4>
                  <p>{cartItems.length > 0 ? `已选择 ${cartItems.length} 个安装包文件` : '当前事件不包含安装包'}</p>
                </div>
                <Button className="solid-button" type="button" onClick={openPackageMarket}>
                  <ShoppingCartSimple size={16} /> 从安装包市场选择
                </Button>
              </div>
              {cartItems.length > 0 ? (
                <div className="event-wizard-package-list">
                  {cartItems.map((item) => (
                    <div className="event-wizard-package-row" key={item.objectKey}>
                      <div>
                        <strong>{packageItemFileName(item)}</strong>
                        <span>{item.packageName} · {itemChannelLabel(item)} · {item.arch} · {item.version}</span>
                      </div>
                      <button
                        aria-label={`移除安装包 ${packageItemFileName(item)}`}
                        className="icon-button event-wizard-remove-button"
                        onClick={() => removeDraftPackageItem(item.objectKey)}
                        type="button"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {eventEditorStep === 3 ? (
            <div
              aria-labelledby={resolvedDocumentScope === 'event'
                ? `${documentTabsId}-event-tab`
                : `${documentTabsId}-package-${draftPackageNames.indexOf(activePackageDocumentName)}-tab`}
              className="event-wizard-documents"
              id={`${documentTabsId}-panel`}
              role="tabpanel"
            >
              <Label className="event-document-title-field">
                文档标题
                <Input
                  value={activePackageDocument ? activePackageDocument.title : eventDocumentTitle}
                  onChange={(event) => {
                    if (activePackageDocumentName) {
                      updatePackageDocument(activePackageDocumentName, { title: event.target.value })
                    } else {
                      setEventDocumentTitle(event.target.value)
                      setEventEditorDirty(true)
                    }
                  }}
                />
              </Label>
              <div className="event-document-todo-link">
                <div className="event-document-todo-link-copy">
                  <div>
                    <strong>关联待办</strong>
                    <span>可选</span>
                  </div>
                  <p>关联结果仅应用于当前文档。</p>
                </div>
                <DropdownMenu open={documentTodoPickerOpen} onOpenChange={setDocumentTodoPickerOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="operation-todo-picker-trigger event-document-todo-trigger"
                      disabled={selectableTodos.length === 0}
                      type="button"
                      variant="outline"
                    >
                      <LinkSimple size={15} />
                      <span className="operation-todo-picker-trigger-content">
                        {activeDocumentRelatedTodos.length === 0 ? (
                          <span className="operation-todo-picker-placeholder">
                            {selectableTodos.length === 0 ? '暂无可关联待办' : '选择关联待办'}
                          </span>
                        ) : (
                          <span className="operation-todo-picker-tags">
                            {activeDocumentRelatedTodos.slice(0, 2).map((todo) => (
                              <span className="operation-todo-picker-tag" key={todo.id}>
                                {todo.title}
                              </span>
                            ))}
                            {activeDocumentRelatedTodos.length > 2 ? (
                              <span className="operation-todo-picker-tag">
                                +{activeDocumentRelatedTodos.length - 2}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </span>
                      <CaretDown
                        className={documentTodoPickerOpen ? 'operation-todo-picker-caret open' : 'operation-todo-picker-caret'}
                        size={14}
                        weight="bold"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="operation-todo-picker-content event-document-todo-menu"
                    collisionPadding={20}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    sideOffset={8}
                  >
                    <div className="operation-todo-picker-search-row">
                      <Input
                        value={documentTodoSearch}
                        onChange={(event) => setDocumentTodoSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="搜索待办标题、负责人或模块"
                      />
                      <Button
                        className={
                          activeDocumentTodoFilterCount > 0
                            ? 'todo-filter-open-button operation-todo-filter-open-button active'
                            : 'todo-filter-open-button operation-todo-filter-open-button'
                        }
                        variant="outline"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDocumentTodoFilterDialogOpen(true)
                        }}
                      >
                        <FunnelSimple size={14} />
                        <span>{documentTodoFilterSummary}</span>
                      </Button>
                    </div>
                    <TodoFilterBuilderDialog
                      assigneeOptions={todoDialogAssigneeOptions}
                      conditions={documentTodoFilterConditions}
                      creatorOptions={todoDialogCreatorOptions}
                      join={documentTodoFilterJoin}
                      moduleOptions={todoDialogModuleOptions}
                      watcherOptions={todoDialogWatcherOptions}
                      open={documentTodoFilterDialogOpen}
                      onOpenChange={setDocumentTodoFilterDialogOpen}
                      onApply={({ conditions: nextConditions, join: nextJoin }) => {
                        setDocumentTodoFilterConditions(nextConditions)
                        setDocumentTodoFilterJoin(nextJoin)
                      }}
                    />
                    <div className="operation-todo-picker-options">
                      {filteredDocumentTodos.length === 0 ? (
                        <p className="operation-empty">没有搜索到匹配的待办。</p>
                      ) : (
                        filteredDocumentTodos.map((todo) => {
                          const selected = activeDocumentRelatedTodoIdSet.has(todo.id)
                          return (
                            <button
                              className={selected ? 'operation-todo-picker-option selected' : 'operation-todo-picker-option'}
                              key={todo.id}
                              onClick={() => toggleActiveDocumentTodo(todo.id)}
                              type="button"
                            >
                              <span className="operation-todo-picker-option-check" aria-hidden="true" />
                              <span className="operation-todo-picker-option-text">
                                <strong>
                                  <span className="operation-todo-dialog-item-title">{todo.title}</span>
                                  {todo.moduleName ? (
                                    <Badge className="todo-module-badge">{todo.moduleName}</Badge>
                                  ) : null}
                                </strong>
                                <small>{todoDialogMeta(todo, todo.done)}</small>
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <MarkdownEditorLoadBoundary>
                <Suspense fallback={<div className="markdown-wysiwyg-loading" role="status">正在加载编辑器…</div>}>
                  <MarkdownWysiwygEditor
                    ariaLabel={activePackageDocumentName ? `${activePackageDocumentName} 安装包文档内容` : '事件文档内容'}
                    key={`event-wizard-${resolvedDocumentScope}`}
                    onChange={(value) => {
                      if (activePackageDocumentName) {
                        updatePackageDocument(activePackageDocumentName, { content: value })
                      } else {
                        setEventDocumentContent(value)
                        setEventEditorDirty(true)
                      }
                    }}
                    onReady={() => setEventEditorReady(true)}
                    placeholder="输入交付步骤、命令或说明…"
                    value={activePackageDocument ? activePackageDocument.content : eventDocumentContent}
                  />
                </Suspense>
              </MarkdownEditorLoadBoundary>
            </div>
          ) : null}
          </div>
        </div>

        <footer className="event-wizard-footer">
          <div className="event-wizard-footer-actions">
            <div className="event-wizard-navigation">
              <Button
                disabled={eventEditorStep === 1}
                onClick={() => setEventEditorStep((eventEditorStep - 1) as 1 | 2)}
                type="button"
                variant="outline"
              >
                上一步
              </Button>
              <Button
                disabled={eventEditorStep === 3 || !eventBasicInformationValid}
                onClick={() => setEventEditorStep((eventEditorStep + 1) as 2 | 3)}
                type="button"
                variant="outline"
              >
                下一步
              </Button>
            </div>
            <div className="event-wizard-save-actions">
              <Button
                disabled={!eventBasicInformationValid || busyAction === 'event'}
                onClick={() => void saveEvent('save_draft')}
                type="button"
                variant="outline"
              >
                保存草稿
              </Button>
              <Button
                className="solid-button"
                disabled={!eventBasicInformationValid || busyAction === 'event'}
                onClick={() => void saveEvent('publish')}
                type="button"
              >
                发布
              </Button>
            </div>
          </div>
        </footer>
      </section>
    )
  }

  return (
    <div className="package-workbench">
      {events.length === 0 && !eventEditorOpen ? (
        <section className="package-empty-state">
          <div className="package-empty-panel">
            <h3>先创建一个项目事件</h3>
            <p>正确路径是「项目 - 事件 - 选购安装包 - 编辑对应文档」，请先创建一个事件再开始维护交付记录。</p>
              <div className="package-empty-actions">
              {canManageProject ? (
                <Button className="solid-button" type="button" onClick={openCreateEventEditor}>
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
              <div className="project-events-title-row">
                <h3>交付事件</h3>
                <Button
                  aria-label={activeEventFilterCount > 0
                    ? `筛选交付事件，已应用 ${activeEventFilterCount} 个条件`
                    : '筛选交付事件'}
                  aria-pressed={activeEventFilterCount > 0}
                  className={activeEventFilterCount > 0
                    ? 'project-events-filter-button active'
                    : 'project-events-filter-button'}
                  size="icon-sm"
                  title={activeEventFilterCount > 0
                    ? `已应用 ${activeEventFilterCount} 个筛选条件`
                    : '筛选交付事件'}
                  type="button"
                  variant="ghost"
                  onClick={() => setEventFilterDialogOpen(true)}
                >
                  <FunnelSimple size={14} />
                </Button>
              </div>
              {canManageProject ? (
                <Button className="solid-button" type="button" onClick={openCreateEventEditor}>
                  <Plus size={17} /> 新增事件
                </Button>
              ) : null}
            </div>
            <PackageEventFilterBuilderDialog
              assigneeOptions={memberOptions}
              conditions={eventFilterConditions}
              join={eventFilterJoin}
              open={eventFilterDialogOpen}
              onOpenChange={setEventFilterDialogOpen}
              onApply={({ conditions: nextConditions, join: nextJoin }) => {
                setEventFilterConditions(nextConditions)
                setEventFilterJoin(nextJoin)
              }}
            />
            <div className="project-events-controls-row">
              <label className="project-events-assigned-toggle">
                <input
                  type="checkbox"
                  checked={assignedOnly}
                  onChange={(event) => setAssignedOnly(event.target.checked)}
                />
                <span>只看我被指派的事件</span>
              </label>
              <Button
                aria-label={eventSortDirection === 'asc'
                  ? '当前按交付日期正序排列，点击切换为倒序'
                  : '当前按交付日期倒序排列，点击切换为正序'}
                className="project-events-sort-button"
                size="icon-sm"
                title={eventSortDirection === 'asc' ? '切换为时间倒序' : '切换为时间正序'}
                type="button"
                variant="ghost"
                onClick={() => setEventSortDirection((current) =>
                  current === 'asc' ? 'desc' : 'asc'
                )}
              >
                {eventSortDirection === 'asc' ? (
                  <SortAscending size={14} />
                ) : (
                  <SortDescending size={14} />
                )}
              </Button>
            </div>
            <div className="project-event-items">
              {visibleEvents.length === 0 ? (
                <p className="project-events-empty">
                  {activeEventFilterCount > 0
                    ? '没有符合筛选条件的交付事件。'
                    : assignedOnly
                      ? '暂无指派给你的交付事件。'
                      : '暂无交付事件。'}
                </p>
              ) : visibleEvents.map((event) => (
                <div
                  className={event.id === selectedEvent?.id ? 'project-event-item active' : 'project-event-item'}
                  key={event.id}
                >
                  <button
                    className="project-event-tab-button"
                    type="button"
                    onClick={() => selectEventFromList(event)}
                  >
                    <strong>{event.title}</strong>
                    <span>{eventTypeLabel(event.type)} · {formatEventDeliveryWindow(event)}</span>
                    <span className="project-event-badges">
                      <span className="project-event-assignee">
                        交付人：{event.assigneeName || '未指派'}
                      </span>
                      <span className={`project-event-status-badge ${eventDisplayStatus(event)}`}>
                        {eventStatusLabel(eventDisplayStatus(event))}
                      </span>
                    </span>
                  </button>
                  {canManageProject ? (
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
                          {!event.publishedAt ? (
                            <DropdownMenuItem onSelect={() => openDraftEventEditor(event)}>
                              继续编辑
                            </DropdownMenuItem>
                          ) : null}
                          <DeleteConfirmDialog
                            confirmLabel="删除事件"
                            description={`删除「${event.title}」后，这个交付事件下的安装包、记录和文档都会一起移除。`}
                            onConfirm={() => deleteEventFromList(event)}
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

          {eventEditorOpen ? (
            renderEventEditor()
          ) : selectedEvent && !selectedEvent.publishedAt ? (
            <section className="event-workspace event-draft-summary">
              <div className="event-draft-summary-head">
                <div>
                  <span>草稿</span>
                  <h3>{selectedEvent.title}</h3>
                  <p>{eventTypeLabel(selectedEvent.type)} · {formatEventDeliveryWindow(selectedEvent)} · {selectedEvent.assigneeName || '未指派'}</p>
                </div>
                {canManageProject ? (
                  <Button className="solid-button" onClick={() => openDraftEventEditor(selectedEvent)} type="button">
                    继续编辑
                  </Button>
                ) : null}
              </div>
              <dl className="event-draft-summary-metrics">
                <div><dt>安装包</dt><dd>{selectedEvent.groups.flatMap((group) => group.items).length}</dd></div>
                <div><dt>事件文档</dt><dd>{selectedEvent.operations.filter((operation) => operation.kind === 'document').length}</dd></div>
                <div><dt>安装包文档</dt><dd>{selectedEvent.groups.reduce((total, group) => total + group.operations.filter((operation) => operation.kind === 'document').length, 0)}</dd></div>
              </dl>
            </section>
          ) : selectedEvent ? (
          <section className="event-workspace">
            <div className="event-workspace-body">
              <section className="project-operations-panel">
                <section className="operation-area">
                  <div className="operation-area-head">
                    <div>
                      <h4>操作文档</h4>
                      <p className="operation-area-meta">
                        {selectedEvent.title} · {eventTypeLabel(selectedEvent.type)} · {formatEventDeliveryWindow(selectedEvent)}
                        <span className="event-progress-pill">
                          已完成 {selectedEventProgress.completed}/{selectedEventProgress.total} 个子事件 - 完成进度：{selectedEventProgress.percent}%
                        </span>
                      </p>
                      <p className="package-workbench-readonly">
                        事件发布后，基本信息、安装包和文档保持只读。
                      </p>
                    </div>
                    <div className="operation-actions">
                      <Button
                        className="package-feedback-button"
                        type="button"
                        variant="outline"
                        onClick={() => setCommentsDrawerOpen(true)}
                      >
                        <ChatCircleDots size={15} /> 交付反馈
                      </Button>
                      {canManageProject && selectedEvent.status !== 'delivered' ? (
                        <Button
                          className="solid-button"
                          type="button"
                          disabled={busyAction === `complete-event-${selectedEvent.id}`}
                          onClick={() => {
                            setBusyAction(`complete-event-${selectedEvent.id}`)
                            void onCompleteEvent(selectedEvent.id).finally(() => setBusyAction(''))
                          }}
                        >
                          <Check size={14} weight="bold" /> 标记已交付
                        </Button>
                      ) : null}
                    </div>
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
                              openOperationDialog(
                                { eventId: selectedEvent.id, operation },
                                operation.kind,
                              )
                            }
                            disabled={existingOperationInteraction.disabled}
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
                          {canManageProject ? (
                            <div className="operation-entry-actions">
                              <button
                                className="icon-button operation-action-button"
                                type="button"
                                aria-label="关联待办"
                                onClick={() => openOperationTodoDialog(operation)}
                              >
                                关联待办
                              </button>
                              {canManageTimeline ? (
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
                              ) : null}
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
                          <div className="project-package-entry">
                            <button
                              className="project-package-tab-button"
                              type="button"
                              onClick={() => setSelectedGroupId(group.id)}
                            >
                              <strong>{group.packageName}</strong>
                              <span className="package-meta-text">
                                {summarizeGroup(group) || `${group.items.length} 条记录`}
                              </span>
                            </button>
                            {group.items.length > 0 ? (
                              <div className="package-file-list">
                                {group.items.map((item) => {
                                  const fileName = packageItemFileName(item)
                                  const feedbackKey = `package-item-download-url-${item.id}`
                                  const copied = copiedValue === feedbackKey
                                  return (
                                    <div className="package-file-list-row" key={item.id}>
                                      <span className="package-file-list-text">{fileName}</span>
                                      <button
                                        aria-label={copied ? `已复制 ${fileName} 的下载链接` : `复制 ${fileName} 的下载链接`}
                                        className={copied ? 'package-file-copy-button is-copied' : 'package-file-copy-button'}
                                        disabled={copyingPackageItemId === item.id}
                                        onClick={() => void copyPackageItemDownloadLink(item)}
                                        title={copied ? '已复制' : '复制安装包链接'}
                                        type="button"
                                      >
                                        {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                                      </button>
                                      <button
                                        aria-label={copiedValue === `package-item-download-command-${item.id}`
                                          ? `已复制 ${fileName} 的 Linux 下载命令`
                                          : `复制 ${fileName} 的 Linux 下载命令`}
                                        className={copiedValue === `package-item-download-command-${item.id}`
                                          ? 'package-file-copy-button is-copied'
                                          : 'package-file-copy-button'}
                                        disabled={copyingPackageItemId === item.id}
                                        onClick={() => void copyPackageItemDownloadCommand(item)}
                                        title={copiedValue === `package-item-download-command-${item.id}` ? '已复制' : '复制 Linux 下载命令'}
                                        type="button"
                                      >
                                        {copiedValue === `package-item-download-command-${item.id}`
                                          ? <Check size={13} weight="bold" />
                                          : <TerminalWindow size={13} />}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
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
                          <div className="package-meta-block">
                            <p className="package-meta-text">{summarizeGroup(selectedGroup)}</p>
                            {summarizeGroupFileNames(selectedGroup).length > 0 ? (
                              <div className="package-file-list">
                                {summarizeGroupFileNames(selectedGroup).map((fileName) => (
                                  <p className="package-file-list-text" key={fileName}>
                                    {fileName}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
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
                                    openOperationDialog(
                                      {
                                        eventId: selectedEvent.id,
                                        groupId: selectedGroup.id,
                                        operation,
                                      },
                                      operation.kind,
                                    )
                                  }
                                  disabled={existingOperationInteraction.disabled}
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
                                {canManageProject ? (
                                  <div className="operation-entry-actions">
                                    <button
                                      className="icon-button operation-action-button"
                                      type="button"
                                      aria-label="关联待办"
                                      onClick={() => openOperationTodoDialog(operation)}
                                    >
                                      关联待办
                                    </button>
                                    {canManageTimeline ? (
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
                                    ) : null}
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
                {activeEventFilterCount > 0 ? (
                  <>
                    <h3>没有符合筛选条件的交付事件</h3>
                    <p>调整或清空筛选条件后，可以继续查看当前项目的交付事件。</p>
                  </>
                ) : (
                  <>
                    <h3>暂无指派给你的交付事件</h3>
                    <p>关闭「只看我被指派的事件」后，可以查看当前项目的全部交付事件。</p>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
        <DialogContent className="package-operation-dialog">
          <DialogHeader className="operation-doc-header">
            <DialogTitle>
              {operationDialogReadOnly
                ? operationKind === 'document'
                  ? '查看操作文档'
                  : '查看操作事件'
                : pendingOperationTarget?.operation
                ? operationKind === 'document'
                  ? '编辑操作文档'
                  : '编辑操作文档'
                : '添加操作文档'}
            </DialogTitle>
            <DialogDescription>
              {operationDialogReadOnly
                ? '事件发布后，文档内容仅供查看。'
                : '记录交付过程中需要保留的步骤、命令和说明。'}
            </DialogDescription>
          </DialogHeader>
          <div className="operation-doc-form">
            <div className="operation-doc-meta-row">
              <Label className="operation-doc-title-field">
                文档标题
                <Input
                  value={operationTitle}
                  readOnly={operationDialogReadOnly}
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
                  readOnly={operationDialogReadOnly}
                />
              </Suspense>
            </MarkdownEditorLoadBoundary>
          </div>
          <DialogFooter className="operation-doc-footer">
            {operationDialogReadOnly ? (
              <Button variant="outline" type="button" onClick={() => setOperationDialogOpen(false)}>
                关闭
              </Button>
            ) : (
              <>
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportScopeDialogOpen} onOpenChange={setExportScopeDialogOpen}>
        <DialogContent className="package-export-scope-dialog">
          <DialogHeader>
            <DialogTitle>导出时间线</DialogTitle>
            <DialogDescription>
              选择需要导出的时间线范围，确认后可以在预览中继续编辑内容。
            </DialogDescription>
          </DialogHeader>
          <fieldset className="package-export-scope-options">
            <legend>导出范围</legend>
            <label className={exportScope === 'current' ? 'package-export-scope-option active' : 'package-export-scope-option'}>
              <input
                checked={exportScope === 'current'}
                disabled={!selectedEvent}
                name="timeline-export-scope"
                type="radio"
                value="current"
                onChange={() => setExportScope('current')}
              />
              <span>
                <strong>导出当前事件时间线</strong>
                <small>
                  {selectedEvent ? `仅导出「${selectedEvent.title}」及其操作文档、安装包记录。` : '当前没有可导出的交付事件。'}
                </small>
              </span>
            </label>
            <label className={exportScope === 'all' ? 'package-export-scope-option active' : 'package-export-scope-option'}>
              <input
                checked={exportScope === 'all'}
                name="timeline-export-scope"
                type="radio"
                value="all"
                onChange={() => setExportScope('all')}
              />
              <span>
                <strong>导出完整事件线</strong>
                <small>导出当前项目下的全部交付事件和时间线记录。</small>
              </span>
            </label>
          </fieldset>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setExportScopeDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleExport(exportScope)}>
              继续导出
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
        <DialogContent className="package-operation-dialog operation-todo-link-dialog">
          <DialogHeader>
            <DialogTitle>关联待办</DialogTitle>
            <DialogDescription>
              在这里统一管理待办关联、完成状态和备注说明；复选框会与外部待办列表的勾选状态保持同步。
            </DialogDescription>
          </DialogHeader>
          <div className={selectableTodos.length > 0 ? 'operation-todo-dialog-body has-picker' : 'operation-todo-dialog-body'}>
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
                      watcherOptions={todoDialogWatcherOptions}
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
                                  <span className="operation-todo-dialog-item-title">{todo.title}</span>
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
                  <span>当前项目还没有可供关联的待办。</span>
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
                      <div className="operation-todo-dialog-item-head">
                        <div className="operation-todo-dialog-item-text">
                          <strong>
                            <span className="operation-todo-dialog-item-title">{todo.title}</span>
                          </strong>
                          {todo.moduleName ? (
                            <Badge className="todo-module-badge">{todo.moduleName}</Badge>
                          ) : null}
                          <small>{meta}</small>
                        </div>
                        <div className="operation-todo-dialog-item-controls">
                          <label className="operation-todo-dialog-done-toggle">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleTodoDialogDone(todo.id)}
                            />
                            <span>完成待办</span>
                          </label>
                        </div>
                      </div>
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
              为项目「{project.name}」当前事件选择安装包。当前链接有效期：{formatExpireDuration(marketExpireMinutes)}。
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
            <Button
              className="package-market-show-all"
              variant={marketIncludeAll ? 'default' : 'outline'}
              type="button"
              aria-pressed={marketIncludeAll}
              title={marketIncludeAll ? '关闭全部包展示' : '展示全部包'}
              onClick={() => {
                const nextIncludeAll = !marketIncludeAll
                setMarketIncludeAll(nextIncludeAll)
                void refreshMarketDetail({ includeAll: nextIncludeAll })
              }}
            >
              {marketIncludeAll ? <EyeSlash size={15} /> : <Eye size={15} />}
              {marketIncludeAll ? '仅展示规则包' : '展示全部包'}
            </Button>
              <PackageMarketRuleList>
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
                                const nextChannel = rule.id === 'base-oss' ? 'release' : marketChannel
                                setMarketSelectedPackage(rule.id)
                                setMarketChannel(nextChannel)
                                setMarketReleaseVersion('')
                                setMarketCiBranch('')
                                setMarketCiVersion('')
                                void refreshMarketDetail({
                                  packageId: rule.id,
                                  channel: nextChannel,
                                  releaseVersion: '',
                                  ciBranch: '',
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
              </PackageMarketRuleList>
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
                      setMarketCiBranch('')
                      setMarketCiVersion('')
                      setMarketReleaseVersion('')
                      void refreshMarketDetail({ channel: next, ciBranch: '', ciVersion: '', releaseVersion: '' })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="release">正式包</SelectItem>
                      {marketSelectedPackage !== 'base-oss' ? (
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
                      setMarketCiBranch('')
                      setMarketCiVersion('')
                      setMarketReleaseVersion('')
                      void refreshMarketDetail({ arch: next, ciBranch: '', ciVersion: '', releaseVersion: '' })
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
                {marketChannel === 'ci' && marketCiBranches.length > 0 ? (
                  <Label className="package-market-version-control">
                    CI 分支
                    <Select
                      value={marketCiBranch || marketCiBranches[0]?.name || ''}
                      onValueChange={(value) => {
                        setMarketCiBranch(value)
                        setMarketCiVersion('')
                        void refreshMarketDetail({ ciBranch: value, ciVersion: '' })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择分支" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketCiBranches.map((branch) => (
                          <SelectItem key={branch.name} value={branch.name}>
                            {branch.label}
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
                      marketDetail.links.map((link) => renderMarketLinkCard(marketDetail, marketDetailContext, link))
                    )}
                    {selectedMarketDependencyRules.length > 0 ? (
                      marketDependencyDetails.map((dependency) => (
                        <section className="package-market-dependency" key={dependency.rule.id}>
                          <div className="package-market-dependency-head">
                            <div>
                              <strong>{dependency.rule.name}</strong>
                              <small>附属包 · {dependency.rule.id}</small>
                            </div>
                            {dependency.versions.length > 0 ? (
                              <Label className="package-market-dependency-version">
                                版本
                                <Select
                                  value={dependency.selectedVersion}
                                  onValueChange={(value) => {
                                    const selectedVersions = Object.fromEntries(
                                      marketDependencyDetails.map((item) => [item.rule.id, item.selectedVersion]),
                                    )
                                    selectedVersions[dependency.rule.id] = value
                                    void refreshMarketDependencyDetails({
                                      arch: marketArch,
                                      expireMinutes: marketExpireMinutes,
                                      includeAll: marketIncludeAll,
                                      requestId: marketDetailRequestIdRef.current,
                                      rules: selectedMarketDependencyRules,
                                      selectedVersions,
                                    })
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="选择版本" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dependency.versions.map((version) => (
                                      <SelectItem
                                        key={version.hash ?? version.version ?? version.label}
                                        value={version.hash ?? version.version ?? version.label}
                                      >
                                        {version.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Label>
                            ) : null}
                          </div>
                          {dependency.error ? <p className="form-error">{dependency.error}</p> : null}
                          {dependency.loading ? (
                            <p className="empty-state">正在读取附属包...</p>
                          ) : dependency.detail ? (
                            dependency.detail.links.length === 0 ? (
                              <p className="empty-state">当前参数下没有找到可用附属包对象。</p>
                            ) : (
                              <div className="package-market-link-list">
                                {dependency.detail.links.map((link) =>
                                  renderMarketLinkCard(dependency.detail as PackageMarketDetail, dependency.context, link),
                                )}
                              </div>
                            )
                          ) : (
                            <p className="empty-state">当前包没有可用附属包对象。</p>
                          )}
                        </section>
                      ))
                    ) : null}
                  </div>
                ) : (
                  <p className="empty-state">选择一个包后查看详情。</p>
                )}
              </div>
              <div className="package-market-expire-row">
                <Label>
                  配置链接有效期
                  <Select
                    value={marketExpireMode}
                    onValueChange={(value) => {
                      const nextMode = value as 'delivery-end' | 'custom'
                      setMarketExpireMode(nextMode)
                      if (nextMode === 'delivery-end') {
                        const nextExpireMinutes = getExpireMinutesUntil(eventDeliveryEndAt)
                        setMarketExpireMinutes(nextExpireMinutes)
                        void refreshMarketDetail({ expireMinutes: nextExpireMinutes })
                      } else {
                        refreshCustomMarketExpire(marketExpireDays, marketExpireHours)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery-end">至预期交付完成时间（{formatDateTimeLocalWindow(
                        eventDeliveryStartAt,
                        eventDeliveryEndAt,
                      )}）</SelectItem>
                      <SelectItem value="custom">自定义时长</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
                {marketExpireMode === 'custom' ? (
                  <div className="package-market-expire-custom">
                    <Label>
                      天
                      <Input
                        min="0"
                        max="365"
                        step="1"
                        type="number"
                        value={marketExpireDays}
                        onChange={(event) => {
                          const nextDays = event.target.value
                          setMarketExpireDays(nextDays)
                          refreshCustomMarketExpire(nextDays, marketExpireHours)
                        }}
                      />
                    </Label>
                    <Label>
                      时
                      <Input
                        min="0"
                        max="23"
                        step="1"
                        type="number"
                        value={marketExpireHours}
                        onChange={(event) => {
                          const nextHours = event.target.value
                          setMarketExpireHours(nextHours)
                          refreshCustomMarketExpire(marketExpireDays, nextHours)
                        }}
                      />
                    </Label>
                  </div>
                ) : null}
                <small>影响当前弹窗内“查看临时链接”和“复制下载链接”的有效期。自定义时长至少 1 小时，最长 365 天。</small>
              </div>
            </div>
          </div>
          <div className="package-cart-strip">
            <div>
              <strong>当前草稿已选择：{cartItems.length} 项</strong>
              <small>
                {cartItems.map((item) => `${item.packageName} · ${item.version}`).join('；') || '还没有选择安装包'}
              </small>
            </div>
            <div className="package-cart-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setCartItems([])
                  setEventEditorDirty(true)
                }}
                disabled={cartItems.length === 0}
              >
                清空
              </Button>
              <Button type="button" onClick={() => void submitCart()}>
                <Check size={16} /> 确认选择
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PackageEventCommentsDrawer
        currentUserId={currentUserId}
        event={selectedEvent}
        mentionMembers={timeline?.mentionableMembers ?? memberOptions}
        open={commentsDrawerOpen && selectedEvent != null}
        onAddComment={(eventId, content) => onAddEventComment(eventId, content)}
        onDeleteComment={(comment) => onDeleteEventComment(selectedEvent!.id, comment.id)}
        onOpenChange={setCommentsDrawerOpen}
        onUpdateComment={(comment, content) => onUpdateEventComment(selectedEvent!.id, comment.id, content)}
      />
    </div>
  )
})

function PackageEventCommentItem({
  comment,
  currentUserId,
  disabled,
  mentionMembers,
  onDelete,
  onUpdate,
}: {
  comment: ProjectPackageEventComment
  currentUserId?: number
  disabled: boolean
  mentionMembers: MentionMember[]
  onDelete: (comment: ProjectPackageEventComment) => Promise<boolean>
  onUpdate: (comment: ProjectPackageEventComment, content: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const canManage = comment.canEdit || (
    currentUserId != null && comment.authorUserId === currentUserId
  )
  const edited = comment.updatedAt !== comment.createdAt

  useEffect(() => {
    if (!editing) setDraft(comment.content)
  }, [comment.content, editing])

  return (
    <article className="package-event-comment-item">
      <div className="package-event-comment-header">
        <div className="package-event-comment-byline">
          <strong>{comment.authorName}</strong>
          <span aria-hidden="true">·</span>
          <time>{comment.createdAt}{edited ? ` · 编辑于 ${comment.updatedAt}` : ''}</time>
        </div>
        {canManage && !editing ? (
          <div className="package-event-comment-actions">
            <Button
              aria-label="编辑反馈"
              size="icon-sm"
              title="编辑反馈"
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <PencilSimple />
            </Button>
            <Button
              aria-label="删除反馈"
              className="package-event-comment-delete"
              disabled={disabled}
              size="icon-sm"
              title="删除反馈"
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm('确定删除这条交付反馈吗？')) void onDelete(comment)
              }}
            >
              <Trash />
            </Button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <form
          className="package-event-comment-editor"
          onSubmit={async (formEvent) => {
            formEvent.preventDefault()
            if (!draft.trim() || disabled) return
            if (await onUpdate(comment, draft)) setEditing(false)
          }}
        >
          <MentionTextarea
            aria-label="编辑反馈"
            members={mentionMembers}
            menuPlacement="above"
            maxLength={5000}
            onChange={setDraft}
            value={draft}
          />
          <div className="package-event-comment-editor-actions">
            <Button type="button" variant="outline" onClick={() => { setDraft(comment.content); setEditing(false) }}>
              取消
            </Button>
            <Button disabled={disabled || !draft.trim()}>保存</Button>
          </div>
        </form>
      ) : (
        <p className="package-event-comment-content">{comment.content}</p>
      )}
    </article>
  )
}

function PackageEventCommentsDrawer({
  currentUserId,
  event,
  mentionMembers,
  onAddComment,
  onDeleteComment,
  onOpenChange,
  onUpdateComment,
  open,
}: {
  currentUserId?: number
  event: ProjectPackageEvent | null
  mentionMembers: MentionMember[]
  onAddComment: (eventId: number, content: string) => Promise<boolean>
  onDeleteComment: (comment: ProjectPackageEventComment) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  onUpdateComment: (comment: ProjectPackageEventComment, content: string) => Promise<boolean>
  open: boolean
}) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setDraft('')
  }, [event?.id, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="package-event-comments-drawer fixed inset-y-0 right-0 left-auto z-50 h-full w-[min(92vw,430px)] translate-x-0 translate-y-0 gap-0 rounded-none border-l p-0 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
      >
        <DialogHeader className="package-event-comments-header">
          <DialogTitle>交付反馈</DialogTitle>
          <DialogDescription>
            {event ? `${event.title} · ${eventTypeLabel(event.type)}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="package-event-comments-body">
          {(event?.comments ?? []).length === 0 ? (
            <div className="package-event-comments-empty">
              还没有反馈，写下这次交付的情况或 @ 相关成员吧。
            </div>
          ) : (
            (event?.comments ?? []).map((comment) => (
              <PackageEventCommentItem
                comment={comment}
                currentUserId={currentUserId}
                disabled={submitting}
                key={comment.id}
                mentionMembers={mentionMembers}
                onDelete={onDeleteComment}
                onUpdate={onUpdateComment}
              />
            ))
          )}
        </div>
        <form
          className="package-event-comments-composer"
          onSubmit={async (formEvent) => {
            formEvent.preventDefault()
            if (!event || !draft.trim() || submitting) return
            setSubmitting(true)
            const saved = await onAddComment(event.id, draft)
            setSubmitting(false)
            if (saved) setDraft('')
          }}
        >
          <MentionTextarea
            aria-label="交付反馈"
            members={mentionMembers}
            menuPlacement="above"
            maxLength={5000}
            onChange={setDraft}
            placeholder="写下交付反馈，输入 @ 可提及组织成员。"
            value={draft}
          />
          <div className="package-event-comments-composer-actions">
            <Button disabled={submitting || !draft.trim()}>
              {submitting ? '发送中...' : '发送反馈'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
