import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Buildings,
  Bug,
  CalendarBlank,
  CaretDown,
  CheckCircle,
  ClipboardText,
  CopySimple,
  Flask,
  FolderSimple,
  GearSix,
  Heartbeat,
  PencilSimple,
  PaperPlaneTilt,
  Package as PackageIcon,
  Plus,
  Sparkle,
  Target,
  Trash,
  Users,
  Warning,
} from '@phosphor-icons/react'
import {
  attachProjectToOrganization,
  attachTestSpaceToOrganization,
  createProject,
  createOrganizationInviteLink,
  createOrganizationProjectMilestone,
  createOrganization,
  deleteOrganization,
  fetchOrganization,
  fetchOrganizationPackageMarketCatalog,
  fetchOrganizations,
  fetchWeeklyReportCollection,
  generateOrganizationWeeklySummary,
  addOrganizationProjectMember,
  inviteOrganizationMemberByUsername,
  removeOrganizationProjectMember,
  removeOrganizationMember,
  remindWeeklyReportMembers,
  saveOrganizationWeeklyReport,
  updateOrganization,
  updateOrganizationPackageMarketPolicy,
  updateOrganizationWeeklyReportRules,
  updateOrganizationMemberRole,
  updateOrganizationProjectGovernance,
  updateOrganizationProjectMilestone,
  updateOrganizationProjectMilestoneStatus,
  type AuthUser,
  type OrganizationProjectMilestonePayload,
} from '../api'
import type {
  OrganizationDetail,
  OrganizationListItem,
  OrganizationProject,
  OrganizationProjectHealthStatus,
  OrganizationProjectMilestone,
  OrganizationProjectMilestoneStatus,
  OrganizationProjectStatus,
  OrganizationTask,
  OrganizationPackageMarketCatalogRule,
  WeeklyReportCollection,
  WeeklyReportRules,
} from '../organization-types'
import type {
  OrganizationPackageMarketPolicy,
} from '../../shared/organization-package-market'
import { organizationPackageMarketPolicyHasVisibleChannel } from '../../shared/organization-package-market'
import {
  defaultWeeklyReportRules,
  getShanghaiDateTime,
  getWeeklyReportTargetWeekStart,
  normalizeWeeklyReportRules,
} from '../../shared/weekly-report-availability'
import { userRoleLabel } from '../user-roles'
import { Button } from './ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Input } from './ui/input'
import { JournalDatePicker } from './journal-date-picker'
import { MarkdownPreview } from './markdown-preview'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'
import { UserName } from './user-name'
import { OrganizationPackageMarketPanel } from './organization-package-market-panel'
import './organization-workbench.css'

type OrganizationTab = 'overview' | 'projects' | 'testSpaces' | 'members' | 'reports' | 'packageMarket'

const organizationTabs: Array<{
  icon: typeof Buildings
  id: OrganizationTab
  label: string
}> = [
  { icon: Buildings, id: 'overview', label: '概览' },
  { icon: FolderSimple, id: 'projects', label: '项目管理' },
  { icon: Flask, id: 'testSpaces', label: '测试空间管理' },
  { icon: Users, id: 'members', label: '成员' },
  { icon: Sparkle, id: 'reports', label: '周报' },
  { icon: PackageIcon, id: 'packageMarket', label: '安装包市场' },
]

const organizationRoleLabel = {
  admin: '管理员',
  member: '成员',
  owner: '所有者',
} as const

const organizationWeekdayOptions = [
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
  { label: '周日', value: '7' },
] as const

const weeklyReportDayOptions = Array.from({ length: 7 }, (_, index) => ({
  label: `第 ${index + 1} 天`,
  value: String(index + 1),
}))

function clonePackageMarketPolicy(policy: OrganizationPackageMarketPolicy): OrganizationPackageMarketPolicy {
  return {
    enabled: policy.enabled,
    revision: policy.revision,
    channels: {
      release: { ...policy.channels.release },
      ci: { ...policy.channels.ci },
    },
    selection: { ...policy.selection, ruleIds: [...policy.selection.ruleIds] },
  }
}

function packageMarketPolicyHasVisibleChannel(policy: OrganizationPackageMarketPolicy) {
  return organizationPackageMarketPolicyHasVisibleChannel(policy)
}

const taskKindLabel: Record<OrganizationTask['kind'], string> = {
  bug: 'Bug',
  delivery: '交付',
  todo: '待办',
}

const taskStatusLabel: Record<string, string> = {
  assigned: '已指派',
  closed: '已关闭',
  completed: '已完成',
  confirmed: '已确认',
  delivered: '已交付',
  delivering: '交付中',
  draft: '草稿',
  duplicate: '重复',
  failed: '失败',
  in_progress: '进行中',
  new: '新建',
  open: '待处理',
  pending: '待处理',
  pending_verification: '待验证',
  rejected: '已拒绝',
  reopened: '重新打开',
  success: '成功',
}

const projectStatusLabel: Record<OrganizationProjectStatus, string> = {
  active: '进行中',
  paused: '暂停',
  completed: '已完成',
  archived: '已归档',
}

const projectHealthLabel: Record<OrganizationProjectHealthStatus, string> = {
  on_track: '正常',
  at_risk: '有风险',
  off_track: '已失控',
}

const milestoneStatusLabel: Record<OrganizationProjectMilestoneStatus, string> = {
  pending: '待达成',
  in_review: '待验收',
  achieved: '已达成',
  cancelled: '已取消',
}

const weeklyReportStateLabel = {
  draft: '草稿',
  empty: '未填写',
  modified: '有未提交修改',
  submitted: '已提交',
} as const

function todayDateOnly() {
  return getShanghaiDateTime().slice(0, 10)
}

function defaultMilestoneDate() {
  return shiftDateOnly(todayDateOnly(), 14)
}

function milestoneTiming(milestone: OrganizationProjectMilestone) {
  if (milestone.status === 'achieved' || milestone.status === 'cancelled') return 'settled'
  const today = todayDateOnly()
  if (milestone.targetDate < today) return 'overdue'
  if (milestone.targetDate <= shiftDateOnly(today, 7)) return 'due_soon'
  return 'normal'
}

function milestoneTimingLabel(milestone: OrganizationProjectMilestone) {
  const timing = milestoneTiming(milestone)
  if (timing === 'overdue') return '已逾期'
  if (timing === 'due_soon') return '临期'
  return milestoneStatusLabel[milestone.status]
}

function nextProjectMilestone(project: OrganizationProject) {
  return project.milestones.find((milestone) => (
    milestone.status !== 'achieved' && milestone.status !== 'cancelled'
  )) ?? null
}

function shiftDateOnly(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatWeekRange(weekStart: string) {
  const weekEnd = shiftDateOnly(weekStart, 6)
  return `${weekStart.replaceAll('-', '/')} - ${weekEnd.replaceAll('-', '/')}`
}

function reportWeekStart(
  weekStartsOn = 1,
  rules = defaultWeeklyReportRules,
  now = getShanghaiDateTime(),
) {
  return getWeeklyReportTargetWeekStart({ now, rules, weekStartsOn })
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
}

function parseProjectTags(value: string) {
  return value
    .split(/[\s,，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function formatInviteDuration(minutes: number) {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} 天`
  if (minutes >= 60) return `${Math.round(minutes / 60)} 小时`
  return `${minutes} 分钟`
}

function buildOrganizationInviteUrl(token: string) {
  if (typeof window === 'undefined') {
    return `?organizationInvite=${encodeURIComponent(token)}`
  }
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('organizationInvite', token)
  return url.toString()
}

export function OrganizationWorkbench({
  currentUser,
  onPackageMarketVisibilityChange,
  refreshToken = 0,
}: {
  currentUser: AuthUser
  onPackageMarketVisibilityChange?: (organizationId: number, enabled: boolean) => void
  refreshToken?: number
}) {
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(0)
  const [detail, setDetail] = useState<OrganizationDetail | null>(null)
  const [canCreate, setCanCreate] = useState(false)
  const [tab, setTab] = useState<OrganizationTab>('overview')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [organizationSettingsError, setOrganizationSettingsError] = useState('')
  const [packageMarketCatalog, setPackageMarketCatalog] = useState<OrganizationPackageMarketCatalogRule[]>([])
  const [packageMarketPolicyDraft, setPackageMarketPolicyDraft] = useState<OrganizationPackageMarketPolicy | null>(null)
  const [packageMarketCatalogLoading, setPackageMarketCatalogLoading] = useState(false)
  const [packageMarketPolicySaving, setPackageMarketPolicySaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [organizationRenameDraft, setOrganizationRenameDraft] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [ownerUsername, setOwnerUsername] = useState(currentUser.username)
  const [memberInviteOpen, setMemberInviteOpen] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteExpiresInMinutes, setInviteExpiresInMinutes] = useState(10)
  const [inviteDialogError, setInviteDialogError] = useState('')
  const [inviteLinkStatus, setInviteLinkStatus] = useState('')
  const [isCopyingInviteLink, setIsCopyingInviteLink] = useState(false)
  const [projectQuery, setProjectQuery] = useState('')
  const [projectStatus, setProjectStatus] = useState<'all' | OrganizationProjectStatus>('all')
  const [projectHealth, setProjectHealth] = useState<'all' | OrganizationProjectHealthStatus>('all')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectTags, setNewProjectTags] = useState('')
  const [topbarActionHost, setTopbarActionHost] = useState<HTMLElement | null>(null)
  const [weeklyCollection, setWeeklyCollection] = useState<WeeklyReportCollection | null>(null)
  const [weeklyCollectionLoading, setWeeklyCollectionLoading] = useState(false)
  const [weeklyReminderNotice, setWeeklyReminderNotice] = useState('')
  const [weeklyRulesOpen, setWeeklyRulesOpen] = useState(false)
  const [weeklyRulesError, setWeeklyRulesError] = useState('')
  const [weeklyRulesDraft, setWeeklyRulesDraft] = useState<WeeklyReportRules>(defaultWeeklyReportRules)
  const [weeklyRulesWeekStartsOn, setWeeklyRulesWeekStartsOn] = useState(1)
  const packageMarketDraftOrganizationId = useRef(0)

  useEffect(() => {
    setTopbarActionHost(document.getElementById('organization-topbar-actions'))
    return () => setTopbarActionHost(null)
  }, [])

  const loadOrganizations = useCallback(async (preferredId?: number) => {
    const result = await fetchOrganizations()
    setOrganizations(result.organizations)
    setCanCreate(result.canCreate)
    const nextId = preferredId && result.organizations.some((item) => item.id === preferredId)
      ? preferredId
      : result.organizations[0]?.id ?? 0
    setSelectedOrganizationId(nextId)
    setDetailLoading(nextId !== 0)
    return nextId
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    loadOrganizations(selectedOrganizationId || undefined)
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadOrganizations, refreshToken, selectedOrganizationId])

  useEffect(() => {
    if (!selectedOrganizationId) {
      setDetail(null)
      setDetailLoading(false)
      return
    }
    let active = true
    setDetailLoading(true)
    setLoading(true)
    fetchOrganization(selectedOrganizationId)
      .then((nextDetail) => {
        if (active) {
          setDetail(nextDetail)
          setError('')
        }
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [refreshToken, selectedOrganizationId])

  useEffect(() => {
    setOrganizationRenameDraft(detail?.name ?? '')
  }, [detail?.id, detail?.name])

  useEffect(() => {
    if (!detail) {
      packageMarketDraftOrganizationId.current = 0
      setPackageMarketCatalog([])
      setPackageMarketPolicyDraft(null)
      return
    }
    const organizationChanged = packageMarketDraftOrganizationId.current !== detail.id
    const nextRevision = detail.packageMarketPolicy.revision
    packageMarketDraftOrganizationId.current = detail.id
    setPackageMarketPolicyDraft((current) => (
      !organizationChanged && current?.revision === nextRevision
        ? current
        : clonePackageMarketPolicy(detail.packageMarketPolicy)
    ))
  }, [detail])

  const packageMarketOrganizationId = detail?.id ?? 0
  useEffect(() => {
    if (tab !== 'packageMarket' || !packageMarketOrganizationId) return
    let active = true
    setPackageMarketCatalogLoading(true)
    setOrganizationSettingsError('')
    fetchOrganizationPackageMarketCatalog(packageMarketOrganizationId)
      .then((result) => {
        if (!active) return
        setPackageMarketCatalog(result.rules)
        // Catalog refreshes can happen when returning to this tab. Preserve an
        // unsaved draft for the same server revision; a newer revision means
        // another save won the race and the draft must be rebased.
        setPackageMarketPolicyDraft((current) => (
          !current || current.revision !== result.policy.revision
            ? clonePackageMarketPolicy(result.policy)
            : current
        ))
      })
      .catch((catalogError) => {
        if (active) setOrganizationSettingsError(errorMessage(catalogError))
      })
      .finally(() => {
        if (active) setPackageMarketCatalogLoading(false)
      })
    return () => {
      active = false
    }
  }, [packageMarketOrganizationId, refreshToken, tab])

  useEffect(() => {
    if (detail) {
      setWeeklyRulesDraft(detail.weeklyReportRules)
      setWeeklyRulesWeekStartsOn(detail.weekStartsOn)
    }
  }, [detail])

  async function mutate(operation: () => Promise<OrganizationDetail>) {
    setBusy(true)
    setError('')
    setOrganizationSettingsError('')
    try {
      const nextDetail = await operation()
      setDetail(nextDetail)
      return true
    } catch (mutationError) {
      setError(errorMessage(mutationError))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitOrganization(event: FormEvent) {
    event.preventDefault()
    if (!organizationName.trim() || !ownerUsername.trim()) return
    setBusy(true)
    setError('')
    try {
      const created = await createOrganization({
        name: organizationName.trim(),
        ownerUsername: ownerUsername.trim(),
      })
      setOrganizationName('')
      setCreateOpen(false)
      await loadOrganizations(created.id)
      setDetail(created)
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setBusy(false)
    }
  }

  async function submitOrganizationRename(event: FormEvent) {
    event.preventDefault()
    const name = organizationRenameDraft.trim()
    if (!detail || !name || name === detail.name) return
    setBusy(true)
    setError('')
    setOrganizationSettingsError('')
    try {
      const nextDetail = await updateOrganization(detail.id, name)
      setDetail(nextDetail)
      setOrganizations((current) => current.map((organization) => (
        organization.id === nextDetail.id
          ? { ...organization, name: nextDetail.name }
          : organization
      )))
      setSettingsOpen(false)
    } catch (renameError) {
      setOrganizationSettingsError(errorMessage(renameError))
    } finally {
      setBusy(false)
    }
  }

  function updatePackageMarketPolicyDraft(
    updater: (current: OrganizationPackageMarketPolicy) => OrganizationPackageMarketPolicy,
  ) {
    setPackageMarketPolicyDraft((current) => current ? updater(current) : current)
  }

  function resetPackageMarketPolicyDraft() {
    if (!detail) return
    setPackageMarketPolicyDraft(clonePackageMarketPolicy(detail.packageMarketPolicy))
    setOrganizationSettingsError('')
  }

  async function submitPackageMarketPolicy() {
    if (!detail || !packageMarketPolicyDraft) return
    setPackageMarketPolicySaving(true)
    setOrganizationSettingsError('')
    try {
      const nextDetail = await updateOrganizationPackageMarketPolicy(detail.id, {
        featureEnabled: packageMarketPolicyDraft.enabled,
        revision: packageMarketPolicyDraft.revision,
        channels: packageMarketPolicyDraft.channels,
        selection: packageMarketPolicyDraft.selection,
      })
      setDetail(nextDetail)
      setOrganizations((current) => current.map((organization) => (
        organization.id === nextDetail.id
          ? {
              ...organization,
              packageMarketEnabled: packageMarketPolicyHasVisibleChannel(nextDetail.packageMarketPolicy),
            }
          : organization
      )))
      onPackageMarketVisibilityChange?.(
        nextDetail.id,
        packageMarketPolicyHasVisibleChannel(nextDetail.packageMarketPolicy),
      )
    } catch (policyError) {
      setOrganizationSettingsError(errorMessage(policyError))
    } finally {
      setPackageMarketPolicySaving(false)
    }
  }

  async function submitOrganizationDelete(event: FormEvent) {
    event.preventDefault()
    if (!detail || deleteConfirmation !== detail.name) return
    setBusy(true)
    setError('')
    setOrganizationSettingsError('')
    try {
      await deleteOrganization(detail.id, deleteConfirmation)
      setDeleteOpen(false)
      setDeleteConfirmation('')
      setDetail(null)
      setSelectedOrganizationId(0)
      await loadOrganizations()
    } catch (deleteError) {
      setOrganizationSettingsError(errorMessage(deleteError))
    } finally {
      setBusy(false)
    }
  }

  async function submitWeeklyReportRules(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    const rules = normalizeWeeklyReportRules(weeklyRulesDraft)
    if (!rules) {
      setWeeklyRulesError('截止时间必须早于下一轮开放时间，请重新设置日期和时间。')
      return
    }
    setBusy(true)
    setWeeklyRulesError('')
    setError('')
    try {
      const nextDetail = await updateOrganizationWeeklyReportRules(detail.id, {
        weekStartsOn: weeklyRulesWeekStartsOn,
        weeklyReportRules: rules,
      })
      setDetail(nextDetail)
      setWeeklyRulesOpen(false)
    } catch (saveError) {
      setWeeklyRulesError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function submitUsernameInvitation(event: FormEvent) {
    event.preventDefault()
    if (!detail || !inviteUsername.trim()) return
    setBusy(true)
    setInviteDialogError('')
    try {
      setDetail(await inviteOrganizationMemberByUsername(detail.id, inviteUsername.trim()))
      setInviteUsername('')
    } catch (inviteError) {
      setInviteDialogError(errorMessage(inviteError))
    } finally {
      setBusy(false)
    }
  }

  async function copyOrganizationInviteLink() {
    if (!detail) return
    setIsCopyingInviteLink(true)
    setInviteDialogError('')
    setInviteLinkStatus('')
    try {
      const inviteLink = await createOrganizationInviteLink(detail.id, inviteExpiresInMinutes)
      await navigator.clipboard.writeText(buildOrganizationInviteUrl(inviteLink.token))
      setInviteLinkStatus(`已复制，${formatInviteDuration(inviteLink.expiresInMinutes)}内有效`)
    } catch (inviteError) {
      setInviteDialogError(errorMessage(inviteError))
    } finally {
      setIsCopyingInviteLink(false)
    }
  }

  async function submitOrganizationProject(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    const name = newProjectName.trim()
    if (!name) return
    const tags = parseProjectTags(newProjectTags)
    const success = await mutate(async () => {
      await createProject({
        name,
        organizationId: detail.id,
        tags: tags.length > 0 ? tags : ['新项目'],
      })
      return fetchOrganization(detail.id)
    })
    if (success) {
      setNewProjectName('')
      setNewProjectTags('')
      setNewProjectOpen(false)
    }
  }

  const filteredProjects = useMemo(() => {
    if (!detail) return []
    const query = projectQuery.trim().toLowerCase()
    return detail.projects.filter((project) => (
      (projectStatus === 'all' || project.status === projectStatus) &&
      (projectHealth === 'all' || project.healthStatus === projectHealth) &&
      (!query || [
        project.name,
        project.ownerName,
        project.healthNote,
        ...project.milestones.map((milestone) => milestone.title),
      ].some((value) => value.toLowerCase().includes(query)))
    ))
  }, [detail, projectHealth, projectQuery, projectStatus])

  const weekStart = reportWeekStart(
    detail?.weekStartsOn ?? 1,
    detail?.weeklyReportRules ?? defaultWeeklyReportRules,
  )
  const submittedReports = detail?.reports.filter((report) => (
    report.weekStart === weekStart && report.status === 'submitted'
  )) ?? []
  const weeklyReportMemberCount = weeklyCollection?.members.length
    ?? detail?.members.filter((member) => member.username.toLowerCase() !== 'admin').length
    ?? 0
  const currentSummary = detail?.summaries.find((summary) => summary.weekStart === weekStart)

  const weeklyOrganizationId = detail?.id ?? 0
  const canManageWeeklyReports = detail?.canManageWeeklyReports ?? false
  const loadWeeklyCollection = useCallback(async () => {
    if (!canManageWeeklyReports || !weeklyOrganizationId) {
      setWeeklyCollection(null)
      return
    }
    setWeeklyCollectionLoading(true)
    try {
      setWeeklyCollection(await fetchWeeklyReportCollection(weeklyOrganizationId, weekStart))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setWeeklyCollectionLoading(false)
    }
  }, [canManageWeeklyReports, weekStart, weeklyOrganizationId])

  useEffect(() => {
    if (tab !== 'reports') return
    void loadWeeklyCollection()
  }, [loadWeeklyCollection, tab])

  async function remindWeeklyReportUsers(userIds: number[]) {
    if (!detail || userIds.length === 0) return
    setBusy(true)
    setError('')
    setWeeklyReminderNotice('')
    try {
      const result = await remindWeeklyReportMembers(detail.id, weekStart, userIds)
      setWeeklyReminderNotice([
        result.sent ? `已发送 ${result.sent} 人` : '',
        result.skipped ? `跳过 ${result.skipped} 人` : '',
        result.failed ? `失败 ${result.failed} 人` : '',
      ].filter(Boolean).join('，') || '没有需要提醒的成员')
      await loadWeeklyCollection()
    } catch (reminderError) {
      setError(errorMessage(reminderError))
    } finally {
      setBusy(false)
    }
  }
  const organizationCreateAction = topbarActionHost
    && canCreate
    && currentUser.roles.includes('organization_admin')
    ? createPortal(
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button className="solid-button" type="button">
            <Plus size={17} /> 新建组织
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建组织</DialogTitle>
          </DialogHeader>
          <OrganizationCreateForm
            busy={busy}
            name={organizationName}
            onNameChange={setOrganizationName}
            onOwnerChange={setOwnerUsername}
            onSubmit={submitOrganization}
            ownerUsername={ownerUsername}
          />
        </DialogContent>
      </Dialog>,
      topbarActionHost,
    )
    : null

  if (!currentUser.roles.includes('organization_admin')) {
    return (
      <div className="organization-state organization-empty-state">
        <Buildings size={30} weight="duotone" />
        <strong>当前账号没有组织管理员角色</strong>
        <span>组织管理看板仅对由系统 admin 指定的组织管理员开放。</span>
      </div>
    )
  }

  if (!detail && (loading || detailLoading)) {
    return <>{organizationCreateAction}<div className="organization-state">正在加载组织...</div></>
  }

  if (!detail) {
    return (
      <>
        {organizationCreateAction}
        <div className="organization-state organization-empty-state">
          <Buildings size={30} weight="duotone" />
          <strong>当前账号还没有加入组织</strong>
        </div>
      </>
    )
  }

  return (
    <div className="organization-workbench">
      {organizationCreateAction}
      <div className="organization-toolbar">
        <div className="organization-switcher-group">
          <Select
            value={String(selectedOrganizationId)}
            onValueChange={(value) => setSelectedOrganizationId(Number(value))}
          >
            <SelectTrigger className="organization-switcher" aria-label="选择组织">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={String(organization.id)}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {detail.canManage ? (
            <Dialog open={settingsOpen} onOpenChange={(open) => {
              setSettingsOpen(open)
              setOrganizationSettingsError('')
              if (open) setOrganizationRenameDraft(detail.name)
            }}>
              <DialogTrigger asChild>
                <Button
                  aria-label="组织设置"
                  title="组织设置"
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <GearSix size={17} />
                </Button>
              </DialogTrigger>
              <DialogContent className="organization-settings-dialog">
                <DialogHeader>
                  <DialogTitle>组织设置</DialogTitle>
                  <DialogDescription>修改组织名称，或处理不可逆的组织删除操作。</DialogDescription>
                </DialogHeader>
                {organizationSettingsError ? (
                  <div className="organization-error" role="alert">{organizationSettingsError}</div>
                ) : null}
                <form className="organization-settings-form" onSubmit={submitOrganizationRename}>
                  <Label htmlFor="organization-name-edit">组织名称</Label>
                  <div className="organization-settings-name-row">
                    <Input
                      id="organization-name-edit"
                      maxLength={80}
                      value={organizationRenameDraft}
                      onChange={(event) => setOrganizationRenameDraft(event.target.value)}
                    />
                    <Button
                      className="organization-settings-action"
                      disabled={busy || !organizationRenameDraft.trim() || organizationRenameDraft.trim() === detail.name}
                      size="lg"
                      type="submit"
                    >
                      保存名称
                    </Button>
                  </div>
                </form>
                <section className="organization-danger-zone" aria-labelledby="organization-danger-title">
                  <div>
                    <strong id="organization-danger-title">删除组织</strong>
                    <span>删除成员关系、邀请、组织周报与汇总，项目和测试空间将解除组织归属并保留。</span>
                  </div>
                  <Button
                    className="organization-settings-action"
                    disabled={busy}
                    size="lg"
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setSettingsOpen(false)
                      setDeleteConfirmation('')
                      setOrganizationSettingsError('')
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash size={16} /> 删除组织
                  </Button>
                </section>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(open) => {
        if (!busy) {
          setDeleteOpen(open)
          if (!open) {
            setDeleteConfirmation('')
            setOrganizationSettingsError('')
          }
        }
      }}>
        <DialogContent
          className="organization-delete-dialog"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault()
          }}
          showCloseButton={!busy}
        >
          <DialogHeader>
            <div className="organization-delete-heading-icon" aria-hidden="true">
              <Warning size={20} weight="fill" />
            </div>
            <DialogTitle>确认删除组织</DialogTitle>
            <DialogDescription>
              这是不可逆操作。组织成员关系、邀请、周报与汇总会被永久删除。
            </DialogDescription>
          </DialogHeader>
          {organizationSettingsError ? (
            <div className="organization-error" role="alert">{organizationSettingsError}</div>
          ) : null}
          <div className="organization-delete-impact">
            <strong>业务数据不会被删除</strong>
            <span>
              {detail.projects.length} 个项目和 {detail.testSpaces.length} 个测试空间会解除组织归属，
              其中的待办、交付、测试记录与 Bug 均会保留。
            </span>
          </div>
          <form className="organization-delete-form" onSubmit={submitOrganizationDelete}>
            <Label htmlFor="organization-delete-confirmation">
              输入完整组织名称 <strong>{detail.name}</strong> 以确认
            </Label>
            <Input
              id="organization-delete-confirmation"
              autoComplete="off"
              spellCheck={false}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={busy} type="button" variant="outline">取消</Button>
              </DialogClose>
              <Button
                className="organization-delete-confirm-button"
                disabled={busy || deleteConfirmation !== detail.name}
                type="submit"
                variant="destructive"
              >
                <Trash size={16} /> {busy ? '正在删除...' : '永久删除组织'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="organization-tabs-row">
        <div className="organization-tabs" role="tablist" aria-label="组织模块">
          {organizationTabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={tab === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                <Icon size={17} /> {item.label}
              </button>
            )
          })}
        </div>
        <span className="organization-access-badge">
          {organizationRoleLabel[detail.accessRole]}
        </span>
      </div>

      {error ? <div className="organization-error" role="alert">{error}</div> : null}

      <div className="organization-content">
        {tab === 'overview' ? (
          <div className="organization-overview">
            <div className="organization-metrics">
              <Metric label="成员" value={detail.members.length} />
              <Metric label="组织项目" value={detail.projects.length} />
              <Metric label="测试空间" value={detail.testSpaces.length} />
              <Metric label="未完成任务" value={detail.tasks.filter((task) => !['completed', 'closed', 'delivered'].includes(task.status)).length} />
            </div>
            <section className="organization-section">
              <header><h3>最近任务</h3></header>
              <TaskTable departedUserIds={detail.departedUserIds} tasks={detail.tasks.slice(0, 8)} />
            </section>
          </div>
        ) : null}

        {tab === 'projects' ? (
          <section className="organization-section organization-resource-panel">
            <header>
              <div className="organization-section-heading">
                <h3>组织项目</h3>
                <span>{filteredProjects.length} / {detail.projects.length}</span>
              </div>
              {detail.canManageProjects ? (
                <Dialog open={newProjectOpen} onOpenChange={(open) => {
                  setNewProjectOpen(open)
                  if (!open) {
                    setNewProjectName('')
                    setNewProjectTags('')
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="solid-button" disabled={busy} type="button">
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
                    <OrganizationProjectCreateForm
                      busy={busy}
                      name={newProjectName}
                      tags={newProjectTags}
                      onCancel={() => {
                        setNewProjectName('')
                        setNewProjectTags('')
                        setNewProjectOpen(false)
                      }}
                      onNameChange={setNewProjectName}
                      onSubmit={submitOrganizationProject}
                      onTagsChange={setNewProjectTags}
                    />
                  </DialogContent>
                </Dialog>
              ) : null}
            </header>
            <div className="organization-project-filters">
              <Input
                aria-label="搜索组织项目"
                placeholder="搜索项目、负责人或里程碑"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
              />
              <Select value={projectStatus} onValueChange={(value) => setProjectStatus(value as typeof projectStatus)}>
                <SelectTrigger aria-label="筛选项目状态"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
              <Select value={projectHealth} onValueChange={(value) => setProjectHealth(value as typeof projectHealth)}>
                <SelectTrigger aria-label="筛选项目健康度"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部健康度</SelectItem>
                  <SelectItem value="on_track">正常</SelectItem>
                  <SelectItem value="at_risk">有风险</SelectItem>
                  <SelectItem value="off_track">已失控</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="organization-project-list">
              {filteredProjects.map((project) => (
                <OrganizationProjectRow
                  busy={busy}
                  canManage={detail.canManageProjects}
                  detail={detail}
                  key={project.id}
                  onMutate={mutate}
                  project={project}
                />
              ))}
              {filteredProjects.length === 0 ? (
                <EmptyRow text={detail.projects.length === 0 ? '暂无组织项目' : '没有符合条件的项目'} />
              ) : null}
            </div>
            {detail.attachableProjects.length > 0 ? (
              <div className="organization-project-footer">
                <div className="organization-attach-list">
                  {detail.attachableProjects.map((project) => (
                    <Button
                      disabled={busy}
                      key={project.id}
                      type="button"
                      variant="outline"
                      onClick={() => void mutate(() => attachProjectToOrganization(detail.id, project.id))}
                    >
                      <Plus size={15} /> {project.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'testSpaces' ? (
          <section className="organization-section organization-resource-panel">
            <header><h3>组织测试空间</h3><span>{detail.testSpaces.length}</span></header>
            <div className="organization-list">
              {detail.testSpaces.map((space) => (
                <div className="organization-resource-row" key={space.id}>
                  <div><strong>{space.name}</strong><span>{space.ownerName}</span></div>
                  <div className="organization-resource-counts">
                    <span>{space.planCount} 计划</span><span>{space.bugCount} Bug</span>
                  </div>
                </div>
              ))}
              {detail.testSpaces.length === 0 ? <EmptyRow text="暂无组织测试空间" /> : null}
            </div>
            {detail.attachableTestSpaces.length > 0 ? (
              <div className="organization-attach-list">
                {detail.attachableTestSpaces.map((space) => (
                  <Button
                    disabled={busy}
                    key={space.id}
                    type="button"
                    variant="outline"
                    onClick={() => void mutate(() => attachTestSpaceToOrganization(detail.id, space.id))}
                  >
                    <Plus size={15} /> {space.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'members' ? (
          <section className="organization-section organization-members-section">
            <header>
              <h3>组织成员</h3>
              <div className="organization-member-header-actions">
                <span className="organization-member-count">{detail.members.length}</span>
                {detail.canManage ? (
                  <Dialog
                    open={memberInviteOpen}
                    onOpenChange={(open) => {
                      setMemberInviteOpen(open)
                      setInviteDialogError('')
                      setInviteLinkStatus('')
                      if (!open) setInviteUsername('')
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="solid-button" type="button">
                        <Plus size={16} /> 邀请成员
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="organization-member-invite-dialog">
                      <DialogHeader>
                        <DialogTitle>邀请成员</DialogTitle>
                        <DialogDescription>
                          直接添加已有账号，或复制链接邀请成员注册或登录后加入组织。
                        </DialogDescription>
                      </DialogHeader>
                      {inviteDialogError ? <p className="form-error">{inviteDialogError}</p> : null}
                      <div className="organization-member-invite-grid">
                        <section className="organization-member-invite-section">
                          <div className="organization-member-invite-copy">
                            <strong>直接添加</strong>
                            <span>输入已有账号的用户名，提交后立即加入组织。</span>
                          </div>
                          <form className="organization-member-direct-form" onSubmit={submitUsernameInvitation}>
                            <Input
                              aria-label="组织成员用户名"
                              autoComplete="username"
                              placeholder="输入账号用户名"
                              value={inviteUsername}
                              onChange={(event) => {
                                setInviteUsername(event.target.value)
                                setInviteDialogError('')
                              }}
                            />
                            <Button
                              className="solid-button"
                              disabled={busy || !inviteUsername.trim()}
                              type="submit"
                            >
                              <Plus size={16} /> 直接加入
                            </Button>
                          </form>
                        </section>
                        <section className="organization-member-invite-section">
                          <div className="organization-member-invite-copy">
                            <strong>邀请链接</strong>
                            <span>复制给新成员，链接到期后自动失效。</span>
                          </div>
                          <div className="organization-member-link-actions">
                            <Label>
                              有效时长
                              <Select
                                value={String(inviteExpiresInMinutes)}
                                onValueChange={(value) => {
                                  setInviteExpiresInMinutes(Number(value))
                                  setInviteDialogError('')
                                  setInviteLinkStatus('')
                                }}
                              >
                                <SelectTrigger aria-label="选择组织邀请链接有效时长">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[10, 30, 60, 240, 1440].map((minutes) => (
                                    <SelectItem key={minutes} value={String(minutes)}>
                                      {formatInviteDuration(minutes)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Label>
                            <Button
                              className="solid-button"
                              disabled={isCopyingInviteLink}
                              type="button"
                              onClick={() => void copyOrganizationInviteLink()}
                            >
                              <CopySimple size={16} />
                              {isCopyingInviteLink
                                ? '复制中'
                                : inviteLinkStatus.startsWith('已复制') ? '已复制' : '复制链接'}
                            </Button>
                          </div>
                          {inviteLinkStatus ? (
                            <p className="organization-member-invite-status">{inviteLinkStatus}</p>
                          ) : null}
                        </section>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </header>
            <div className="organization-member-list">
              {detail.members.map((member) => (
                <div className="organization-member-row" key={member.id}>
                  <div className="organization-member-identity">
                    <UserName departedUserIds={detail.departedUserIds} name={member.displayName} userId={member.id} />
                    <span>{member.username}</span>
                  </div>
                  <div className="organization-professions">
                    {member.roles.map((role) => <span key={role}>{userRoleLabel[role]}</span>)}
                  </div>
                  {detail.canManage && member.accessRole !== 'owner' ? (
                    <Select
                      value={member.accessRole}
                      onValueChange={(value) => void mutate(() => updateOrganizationMemberRole(
                        detail.id,
                        member.id,
                        value as 'admin' | 'member',
                      ))}
                    >
                      <SelectTrigger className="organization-role-select" aria-label={`${member.displayName}的组织角色`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">成员</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <span className="organization-owner-label">{organizationRoleLabel[member.accessRole]}</span>}
                  {detail.canManage && member.accessRole !== 'owner' ? (
                    <Button
                      aria-label={`移除${member.displayName}`}
                      disabled={busy}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => void mutate(() => removeOrganizationMember(detail.id, member.id))}
                    >
                      <Trash size={17} />
                    </Button>
                  ) : <span className="organization-row-spacer" />}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'reports' ? (
          <section className="organization-section organization-report-summary">
            <header>
              <div>
                <h3>组织周报</h3>
                <span>{formatWeekRange(weekStart)}</span>
              </div>
              <div className="organization-report-header-actions">
                {detail.canManageWeeklyReports ? (
                  <Dialog open={weeklyRulesOpen} onOpenChange={(open) => {
                    setWeeklyRulesOpen(open)
                    setWeeklyRulesError('')
                    if (open) {
                      setWeeklyRulesDraft(detail.weeklyReportRules)
                      setWeeklyRulesWeekStartsOn(detail.weekStartsOn)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={busy}
                        type="button"
                        variant="outline"
                      >
                        <GearSix size={16} /> 配置周报规则
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="organization-weekly-rules-dialog">
                      <DialogHeader>
                        <DialogTitle>配置周报规则</DialogTitle>
                        <DialogDescription>
                          设置组织周起始日和周报可填写时段，时间均按北京时间计算。
                        </DialogDescription>
                      </DialogHeader>
                      {weeklyRulesError ? <div className="organization-error" role="alert">{weeklyRulesError}</div> : null}
                      <form className="organization-weekly-rules-form" onSubmit={submitWeeklyReportRules}>
                        <Label>
                          周起始日
                          <Select
                            value={String(weeklyRulesWeekStartsOn)}
                            onValueChange={(value) => setWeeklyRulesWeekStartsOn(Number(value))}
                          >
                            <SelectTrigger aria-label="选择周起始日"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {organizationWeekdayOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Label>
                        <div className="organization-weekly-rule-row">
                          <Label>
                            开放时间
                            <span className="organization-weekly-rule-control">
                              <span>T 周</span>
                              <Select
                                value={String(weeklyRulesDraft.openDay)}
                                onValueChange={(value) => setWeeklyRulesDraft((current) => ({ ...current, openDay: Number(value) }))}
                              >
                                <SelectTrigger aria-label="选择周报开放日"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {weeklyReportDayOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input
                                aria-label="设置周报开放时间"
                                type="time"
                                value={weeklyRulesDraft.openTime}
                                onChange={(event) => setWeeklyRulesDraft((current) => ({ ...current, openTime: event.target.value }))}
                              />
                            </span>
                          </Label>
                          <Label>
                            截止时间
                            <span className="organization-weekly-rule-control">
                              <span>T+1 周</span>
                              <Select
                                value={String(weeklyRulesDraft.closeDay)}
                                onValueChange={(value) => setWeeklyRulesDraft((current) => ({ ...current, closeDay: Number(value) }))}
                              >
                                <SelectTrigger aria-label="选择周报截止日"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {weeklyReportDayOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input
                                aria-label="设置周报截止时间"
                                type="time"
                                value={weeklyRulesDraft.closeTime}
                                onChange={(event) => setWeeklyRulesDraft((current) => ({ ...current, closeTime: event.target.value }))}
                              />
                            </span>
                          </Label>
                        </div>
                        <p className="organization-weekly-rules-hint">
                          截止时间必须早于下一轮周报的开放时间，避免两个填写时段重叠。
                        </p>
                        <DialogFooter>
                          <DialogClose asChild><Button disabled={busy} type="button" variant="outline">取消</Button></DialogClose>
                          <Button disabled={busy} type="submit">保存规则</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : null}
                <Button
                  disabled={busy || submittedReports.length === 0 || !detail.canManageWeeklyReports}
                  type="button"
                  onClick={() => void mutate(() => generateOrganizationWeeklySummary(detail.id, weekStart))}
                ><Sparkle size={16} /> AI 汇总</Button>
              </div>
            </header>
            {detail.canManageWeeklyReports ? (
              <>
                <div className="organization-report-collection-toolbar">
                  <div>
                    <strong>
                      已提交 {weeklyCollection?.members.filter((member) => member.revision != null).length ?? 0}
                      {' / '}{weeklyReportMemberCount}
                    </strong>
                    <span>{weeklyReminderNotice || '草稿正文仅成员本人可见'}</span>
                  </div>
                  <Button
                    disabled={busy || weeklyCollectionLoading || !weeklyCollection?.members.some((member) => member.revision == null)}
                    type="button"
                    variant="outline"
                    onClick={() => void remindWeeklyReportUsers(
                      weeklyCollection?.members
                        .filter((member) => member.revision == null)
                        .map((member) => member.userId) ?? [],
                    )}
                  ><PaperPlaneTilt size={16} /> 提醒未提交成员</Button>
                </div>
                <div className="organization-weekly-collection">
                  {weeklyCollectionLoading && !weeklyCollection ? <EmptyRow text="正在加载周报收集状态..." /> : null}
                  {weeklyCollection?.members.map((member) => (
                    <details className="organization-weekly-member" key={member.userId}>
                      <summary>
                        <span>
                          <UserName departedUserIds={detail.departedUserIds} name={member.memberName} userId={member.userId} />
                          <small>{member.submittedAt ? `最近提交 ${formatDateTime(member.submittedAt)}` : '尚未提交本周周报'}</small>
                        </span>
                        <span className={`organization-weekly-state ${member.state}`}>
                          {weeklyReportStateLabel[member.state]}
                        </span>
                        <span className="organization-weekly-revision">
                          {member.revision ? `第 ${member.revision} 版` : '无提交版本'}
                        </span>
                        {member.revision == null ? (
                          <Button
                            disabled={busy || !member.feishuBound}
                            size="sm"
                            title={member.feishuBound ? '发送飞书私信提醒' : '该成员未绑定飞书'}
                            type="button"
                            variant="outline"
                            onClick={(event) => {
                              event.preventDefault()
                              void remindWeeklyReportUsers([member.userId])
                            }}
                          >{member.feishuBound ? '提醒填写' : '未绑定飞书'}</Button>
                        ) : <span className="organization-row-spacer" />}
                        <CaretDown size={16} />
                      </summary>
                      {member.content ? (
                        <div className="organization-weekly-content">
                          <MarkdownPreview content={member.content} />
                        </div>
                      ) : <EmptyRow text="该成员还没有可查看的提交版本" />}
                    </details>
                  ))}
                </div>
              </>
            ) : (
              <EmptyRow text="需要组织管理员身份才能管理周报收集" />
            )}
            <div className="organization-summary-band">
              <div>
                <strong>组织汇总</strong>
                <span>仅使用成员已确认提交的版本</span>
              </div>
              {currentSummary ? (
                <div className="organization-summary-content">
                  <MarkdownPreview content={currentSummary.content} />
                </div>
              ) : <EmptyRow text="本周暂无组织周报汇总" />}
            </div>
          </section>
        ) : null}

        {tab === 'packageMarket' ? (
          <OrganizationPackageMarketPanel
            catalog={packageMarketCatalog}
            catalogLoading={packageMarketCatalogLoading}
            detail={detail}
            error={organizationSettingsError}
            onPolicyChange={updatePackageMarketPolicyDraft}
            onReset={resetPackageMarketPolicyDraft}
            onSave={() => void submitPackageMarketPolicy()}
            policy={packageMarketPolicyDraft}
            policySaving={packageMarketPolicySaving}
          />
        ) : null}
      </div>
    </div>
  )
}

function OrganizationProjectRow({
  busy,
  canManage,
  detail,
  onMutate,
  project,
}: {
  busy: boolean
  canManage: boolean
  detail: OrganizationDetail
  onMutate: (operation: () => Promise<OrganizationDetail>) => Promise<boolean>
  project: OrganizationProject
}) {
  const [expanded, setExpanded] = useState(false)
  const [governanceOpen, setGovernanceOpen] = useState(false)
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<OrganizationProjectMilestone | null>(null)
  const nextMilestone = nextProjectMilestone(project)
  const projectTodos = detail.tasks.filter((task) => (
    task.kind === 'todo' && task.projectId === project.id
  ))

  function openMilestoneEditor(milestone?: OrganizationProjectMilestone) {
    setEditingMilestone(milestone ?? null)
    setMilestoneOpen(true)
  }

  function changeMilestoneStatus(
    milestone: OrganizationProjectMilestone,
    status: OrganizationProjectMilestoneStatus,
  ) {
    if (status === milestone.status) return
    void onMutate(() => updateOrganizationProjectMilestoneStatus(
      detail.id,
      project.id,
      milestone.id,
      status,
    ))
  }

  return (
    <article className={`organization-project-item${expanded ? ' expanded' : ''}`}>
      <div className="organization-project-summary">
        <button
          aria-expanded={expanded}
          className="organization-project-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="organization-project-identity">
            <span className="organization-project-title-line">
              <strong>{project.name}</strong>
              <span className={`organization-project-status ${project.status}`}>
                {projectStatusLabel[project.status]}
              </span>
              <span className={`organization-project-health ${project.healthStatus}`}>
                <i aria-hidden="true" /> {projectHealthLabel[project.healthStatus]}
              </span>
            </span>
            <small>执行负责人：{project.ownerName}</small>
          </span>
          <span className="organization-project-next-milestone">
            <small>下一里程碑</small>
            {nextMilestone ? (
              <span>
                <strong>{nextMilestone.title}</strong>
                <time dateTime={nextMilestone.targetDate}>{nextMilestone.targetDate.replaceAll('-', '/')}</time>
                <em className={milestoneTiming(nextMilestone)}>{milestoneTimingLabel(nextMilestone)}</em>
              </span>
            ) : <span className="empty">尚未设置</span>}
          </span>
          <span className="organization-project-counts">
            <strong>{project.openTodoCount}</strong><small>未完成</small>
            <strong>{project.todoCount}</strong><small>待办</small>
          </span>
          <CaretDown className="organization-project-caret" size={18} aria-hidden="true" />
        </button>
        {canManage ? (
          <div className="organization-project-row-actions">
            <Button
              aria-label={`管理${project.name}的项目状态`}
              disabled={busy}
              size="icon"
              title="项目治理设置"
              type="button"
              variant="ghost"
              onClick={() => setGovernanceOpen(true)}
            >
              <PencilSimple size={17} />
            </Button>
            <ProjectMemberDialog
              busy={busy}
              detail={detail}
              project={project}
              onMutate={onMutate}
            />
          </div>
        ) : null}
      </div>

      <div className={`organization-project-reveal${expanded ? ' open' : ''}`}>
        <div>
          <div className="organization-project-detail">
            <div className="organization-project-detail-heading">
              <div>
                <Target size={17} weight="duotone" />
                <div><strong>项目里程碑</strong><span>{project.milestones.length} 个关键检查点</span></div>
              </div>
              {canManage ? (
                <Button disabled={busy} size="sm" type="button" variant="outline" onClick={() => openMilestoneEditor()}>
                  <Plus size={15} /> 新建里程碑
                </Button>
              ) : null}
            </div>
            {project.healthNote ? (
              <div className={`organization-project-health-note ${project.healthStatus}`}>
                <Heartbeat size={16} />
                <span><strong>{projectHealthLabel[project.healthStatus]}</strong>{project.healthNote}</span>
              </div>
            ) : null}
            <div className="organization-milestone-list">
              {project.milestones.map((milestone) => {
                const completedTodoCount = milestone.linkedTodos.filter((todo) => todo.done).length
                const timing = milestoneTiming(milestone)
                return (
                  <div className={`organization-milestone-row ${milestone.status} ${timing}`} key={milestone.id}>
                    <span className="organization-milestone-marker" aria-hidden="true">
                      {milestone.status === 'achieved' ? <CheckCircle size={16} weight="fill" /> : <span />}
                    </span>
                    <div className="organization-milestone-main">
                      <div>
                        <strong>{milestone.title}</strong>
                        {canManage ? (
                          <Select
                            disabled={busy}
                            value={milestone.status}
                            onValueChange={(value) => changeMilestoneStatus(
                              milestone,
                              value as OrganizationProjectMilestoneStatus,
                            )}
                          >
                            <SelectTrigger
                              aria-label={`更改里程碑${milestone.title}的状态`}
                              className={`organization-milestone-status-control ${milestone.status}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">待达成</SelectItem>
                              <SelectItem value="in_review">待验收</SelectItem>
                              <SelectItem value="achieved">已达成</SelectItem>
                              <SelectItem value="cancelled">已取消</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`organization-milestone-status ${milestone.status}`}>
                            {milestoneStatusLabel[milestone.status]}
                          </span>
                        )}
                        {timing === 'overdue' || timing === 'due_soon' ? (
                          <span className={`organization-milestone-timing ${timing}`}>
                            {timing === 'overdue' ? '已逾期' : '临期'}
                          </span>
                        ) : null}
                      </div>
                      <p>{milestone.acceptanceCriteria}</p>
                      <small>
                        {milestone.responsibleName ? `负责人：${milestone.responsibleName}` : '未指定负责人'}
                        {milestone.linkedTodos.length > 0
                          ? ` · 关联待办 ${completedTodoCount}/${milestone.linkedTodos.length}`
                          : ' · 未关联待办'}
                      </small>
                    </div>
                    <div className="organization-milestone-date">
                      <CalendarBlank size={15} />
                      <time dateTime={milestone.targetDate}>{milestone.targetDate.replaceAll('-', '/')}</time>
                      {milestone.baselineDate !== milestone.targetDate ? (
                        <small>原定 {milestone.baselineDate.replaceAll('-', '/')}</small>
                      ) : null}
                    </div>
                    {canManage ? (
                      <Button
                        aria-label={`编辑里程碑${milestone.title}`}
                        disabled={busy}
                        size="icon"
                        title="编辑里程碑"
                        type="button"
                        variant="ghost"
                        onClick={() => openMilestoneEditor(milestone)}
                      >
                        <PencilSimple size={16} />
                      </Button>
                    ) : null}
                  </div>
                )
              })}
              {project.milestones.length === 0 ? (
                <div className="organization-milestone-empty">还没有里程碑，先定义第一个可验收的阶段结果。</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ProjectGovernanceDialog
        busy={busy}
        open={governanceOpen}
        project={project}
        onOpenChange={setGovernanceOpen}
        onSave={(payload) => onMutate(() => updateOrganizationProjectGovernance(detail.id, project.id, payload))}
      />
      <ProjectMilestoneDialog
        busy={busy}
        editing={editingMilestone}
        members={detail.members}
        open={milestoneOpen}
        project={project}
        projectTodos={projectTodos}
        onOpenChange={setMilestoneOpen}
        onSave={(payload) => onMutate(() => editingMilestone
          ? updateOrganizationProjectMilestone(detail.id, project.id, editingMilestone.id, payload)
          : createOrganizationProjectMilestone(detail.id, project.id, payload))}
      />
    </article>
  )
}

function OrganizationProjectCreateForm({
  busy,
  name,
  onCancel,
  onNameChange,
  onSubmit,
  onTagsChange,
  tags,
}: {
  busy: boolean
  name: string
  onCancel: () => void
  onNameChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onTagsChange: (value: string) => void
  tags: string
}) {
  return (
    <form className="new-project-dialog-form" onSubmit={onSubmit}>
      <Label>
        项目名称
        <Input
          autoFocus
          aria-label="新项目名称"
          placeholder="例如：增长实验复盘"
          required
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Label>
      <Label>
        标签
        <Input
          aria-label="项目标签"
          placeholder="可选，用逗号或空格分隔"
          value={tags}
          onChange={(event) => onTagsChange(event.target.value)}
        />
      </Label>
      <DialogFooter>
        <Button className="ghost-button" disabled={busy} variant="outline" type="button" onClick={onCancel}>
          取消
        </Button>
        <Button className="solid-button" disabled={busy || !name.trim()} type="submit">
          <Plus size={15} /> 创建项目
        </Button>
      </DialogFooter>
    </form>
  )
}

function ProjectMemberDialog({
  busy,
  detail,
  onMutate,
  project,
}: {
  busy: boolean
  detail: OrganizationDetail
  onMutate: (operation: () => Promise<OrganizationDetail>) => Promise<boolean>
  project: OrganizationProject
}) {
  const [open, setOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const activeMemberships = project.memberships.filter((membership) => membership.status === 'active')
  const activeMemberIds = new Set(
    activeMemberships.flatMap((membership) => (
      membership.invitedUserId == null ? [] : [membership.invitedUserId]
    )),
  )
  const availableMembers = detail.members.filter((member) => (
    member.id !== project.ownerUserId && !activeMemberIds.has(member.id)
  ))

  async function submitMember(event: FormEvent) {
    event.preventDefault()
    const memberUserId = Number(selectedMemberId)
    if (!Number.isSafeInteger(memberUserId) || memberUserId <= 0) return
    const success = await onMutate(() => addOrganizationProjectMember(
      detail.id,
      project.id,
      memberUserId,
    ))
    if (success) setSelectedMemberId('')
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && setOpen(nextOpen)}>
      <DialogTrigger asChild>
        <Button
          aria-label={`管理${project.name}的项目成员`}
          disabled={busy}
          size="icon"
          title="管理项目成员"
          type="button"
          variant="ghost"
        >
          <Users size={17} />
        </Button>
      </DialogTrigger>
      <DialogContent className="project-members-dialog organization-project-members-dialog">
        <DialogHeader>
          <DialogTitle>项目成员管理</DialogTitle>
          <DialogDescription>
            从组织成员中选择人员直接加入项目，无需对方确认。
          </DialogDescription>
        </DialogHeader>
        <div className="project-members-panel organization-project-members-panel">
          <section className="project-config-section project-members-roster">
            <div className="project-config-section-head">
              <strong>当前项目成员</strong>
              <p>成员可以新增自己的日记和项目待办，但不能修改项目状态或名称。</p>
            </div>
            <form className="organization-project-member-add-form" onSubmit={submitMember}>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger aria-label="选择要加入项目的组织成员">
                  <SelectValue placeholder={availableMembers.length > 0 ? '选择组织成员' : '所有组织成员均已加入'} />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.displayName}（{member.username}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="solid-button" disabled={busy || !selectedMemberId} type="submit">
                <Plus size={15} /> 加入项目
              </Button>
            </form>
            <div className="member-list organization-project-member-list">
              <article className="member-item organization-project-owner-item">
                <span>
                  <strong>{project.ownerName}</strong>
                  <small>项目所有者</small>
                </span>
              </article>
              {activeMemberships.length > 0 ? (
                activeMemberships.map((membership) => (
                  <article className="member-item" key={membership.id}>
                    <span>
                      <strong>{membership.memberName}</strong>
                      <small>{membership.invitedUsername} · 项目成员</small>
                    </span>
                    <Button
                      aria-label="移除成员"
                      className="todo-delete-button"
                      disabled={busy}
                      size="icon"
                      title="移除成员"
                      type="button"
                      variant="ghost"
                      onClick={() => void onMutate(() => removeOrganizationProjectMember(
                        detail.id,
                        project.id,
                        membership.id,
                      ))}
                    >
                      <Trash size={14} />
                    </Button>
                  </article>
                ))
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProjectGovernanceDialog({
  busy,
  onOpenChange,
  onSave,
  open,
  project,
}: {
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (payload: {
    healthNote: string
    healthStatus: OrganizationProjectHealthStatus
    status: OrganizationProjectStatus
  }) => Promise<boolean>
  open: boolean
  project: OrganizationProject
}) {
  const [status, setStatus] = useState(project.status)
  const [healthStatus, setHealthStatus] = useState(project.healthStatus)
  const [healthNote, setHealthNote] = useState(project.healthNote)

  useEffect(() => {
    if (!open) return
    setStatus(project.status)
    setHealthStatus(project.healthStatus)
    setHealthNote(project.healthNote)
  }, [open, project.healthNote, project.healthStatus, project.status])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const saved = await onSave({ healthNote: healthNote.trim(), healthStatus, status })
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="organization-governance-dialog">
        <DialogHeader>
          <DialogTitle>{project.name} · 项目治理</DialogTitle>
          <DialogDescription>生命周期描述项目阶段，健康度反映当前计划是否可控。</DialogDescription>
        </DialogHeader>
        <form className="organization-governance-form" onSubmit={submit}>
          <div className="organization-governance-fields">
            <Label>
              生命周期状态
              <Select value={status} onValueChange={(value) => setStatus(value as OrganizationProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label>
              项目健康度
              <Select value={healthStatus} onValueChange={(value) => setHealthStatus(value as OrganizationProjectHealthStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">正常</SelectItem>
                  <SelectItem value="at_risk">有风险</SelectItem>
                  <SelectItem value="off_track">已失控</SelectItem>
                </SelectContent>
              </Select>
            </Label>
          </div>
          <Label>
            健康度说明{healthStatus === 'on_track' ? '（可选）' : ''}
            <Textarea
              maxLength={1_000}
              placeholder={healthStatus === 'on_track' ? '记录当前判断依据' : '说明风险、影响和需要的决策'}
              value={healthNote}
              onChange={(event) => setHealthNote(event.target.value)}
            />
          </Label>
          <DialogFooter>
            <DialogClose asChild><Button disabled={busy} type="button" variant="outline">取消</Button></DialogClose>
            <Button disabled={busy || (healthStatus !== 'on_track' && !healthNote.trim())} type="submit">
              保存治理状态
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectMilestoneDialog({
  busy,
  editing,
  members,
  onOpenChange,
  onSave,
  open,
  project,
  projectTodos,
}: {
  busy: boolean
  editing: OrganizationProjectMilestone | null
  members: OrganizationDetail['members']
  onOpenChange: (open: boolean) => void
  onSave: (payload: OrganizationProjectMilestonePayload) => Promise<boolean>
  open: boolean
  project: OrganizationProject
  projectTodos: OrganizationTask[]
}) {
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState(defaultMilestoneDate())
  const [responsibleUserId, setResponsibleUserId] = useState<number | null>(project.ownerUserId)
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [executionNote, setExecutionNote] = useState('')
  const [selectedTodoIds, setSelectedTodoIds] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    setTitle(editing?.title ?? '')
    setTargetDate(editing?.targetDate ?? defaultMilestoneDate())
    setResponsibleUserId(editing?.responsibleUserId ?? project.ownerUserId)
    setAcceptanceCriteria(editing?.acceptanceCriteria ?? '')
    setExecutionNote(editing?.executionNote ?? '')
    setSelectedTodoIds(editing?.linkedTodos.map((todo) => todo.id) ?? [])
  }, [editing, open, project.ownerUserId])

  function toggleTodo(todoId: number, selected: boolean) {
    setSelectedTodoIds((current) => selected
      ? Array.from(new Set([...current, todoId]))
      : current.filter((id) => id !== todoId))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const saved = await onSave({
      acceptanceCriteria: acceptanceCriteria.trim(),
      executionNote: executionNote.trim(),
      linkedTodoIds: selectedTodoIds,
      responsibleUserId,
      targetDate,
      title: title.trim(),
    })
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="organization-milestone-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑里程碑' : '新建里程碑'}</DialogTitle>
          <DialogDescription>{project.name} · 用一个可验收结果定义阶段完成。</DialogDescription>
        </DialogHeader>
        <form className="organization-milestone-form" onSubmit={submit}>
          <Label>
            里程碑名称
            <Input maxLength={120} placeholder="例如：Beta 版本通过验收" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Label>
          <div className="organization-milestone-form-grid">
            <Label>
              目标日期
              <JournalDatePicker
                ariaLabel="选择里程碑目标日期"
                className="organization-milestone-date-trigger"
                datesWithEntries={[]}
                displayValue={targetDate.replaceAll('-', '/')}
                value={targetDate}
                onChange={setTargetDate}
              />
            </Label>
            <Label>
              负责人
              <Select
                value={responsibleUserId == null ? 'unassigned' : String(responsibleUserId)}
                onValueChange={(value) => setResponsibleUserId(value === 'unassigned' ? null : Number(value))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">暂不指定</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
          </div>
          {editing && editing.baselineDate !== targetDate ? (
            <div className="organization-milestone-baseline">
              原始目标日期为 {editing.baselineDate.replaceAll('-', '/')}，本次调整会保留原计划记录。
            </div>
          ) : null}
          <Label>
            验收标准
            <Textarea
              maxLength={5_000}
              placeholder="描述什么结果出现时，可以确认这个里程碑已经达成"
              value={acceptanceCriteria}
              onChange={(event) => setAcceptanceCriteria(event.target.value)}
            />
          </Label>
          <Label>
            执行说明（可选）
            <Textarea
              maxLength={5_000}
              placeholder="补充当前进展、验收材料或需要协调的问题"
              value={executionNote}
              onChange={(event) => setExecutionNote(event.target.value)}
            />
          </Label>
          <fieldset className="organization-milestone-todos">
            <legend>关联待办 <span>{selectedTodoIds.length}</span></legend>
            <div>
              {projectTodos.map((todo) => (
                <label key={todo.id}>
                  <input
                    checked={selectedTodoIds.includes(todo.id)}
                    type="checkbox"
                    onChange={(event) => toggleTodo(todo.id, event.target.checked)}
                  />
                  <span>{todo.title}</span>
                  <small>{taskStatusLabel[todo.status] ?? todo.status}</small>
                </label>
              ))}
              {projectTodos.length === 0 ? <p>当前项目还没有可关联的待办。</p> : null}
            </div>
          </fieldset>
          <DialogFooter>
            <DialogClose asChild><Button disabled={busy} type="button" variant="outline">取消</Button></DialogClose>
            <Button disabled={busy || !title.trim() || !targetDate || !acceptanceCriteria.trim()} type="submit">
              {editing ? '保存里程碑' : '创建里程碑'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function OrganizationWeeklyReportView({ currentUser }: { currentUser: AuthUser }) {
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(0)
  const [detail, setDetail] = useState<OrganizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reportDraft, setReportDraft] = useState('')
  const weekStart = reportWeekStart(
    detail?.weekStartsOn ?? 1,
    detail?.weeklyReportRules ?? defaultWeeklyReportRules,
  )

  const loadOrganizations = useCallback(async () => {
    const result = await fetchOrganizations()
    setOrganizations(result.organizations)
    const nextId = result.organizations[0]?.id ?? 0
    setSelectedOrganizationId(nextId)
    return nextId
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    loadOrganizations()
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadOrganizations])

  useEffect(() => {
    if (!selectedOrganizationId) {
      setDetail(null)
      return
    }
    let active = true
    setLoading(true)
    fetchOrganization(selectedOrganizationId)
      .then((nextDetail) => {
        if (active) {
          setDetail(nextDetail)
          setError('')
        }
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedOrganizationId])

  useEffect(() => {
    const ownReport = detail?.reports.find((report) => (
      report.userId === currentUser.id && report.weekStart === weekStart
    ))
    setReportDraft(ownReport?.content ?? '')
  }, [currentUser.id, detail, weekStart])

  async function saveReport(status: 'draft' | 'submitted') {
    if (!detail || (status === 'submitted' && !reportDraft.trim())) return
    setBusy(true)
    setError('')
    try {
      const nextDetail = await saveOrganizationWeeklyReport(
        detail.id,
        weekStart,
        { content: reportDraft, status },
      )
      setDetail(nextDetail)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  const ownReport = detail?.reports.find((report) => (
    report.userId === currentUser.id && report.weekStart === weekStart
  ))

  if (loading && organizations.length === 0 && !detail) {
    return <div className="organization-state">正在加载组织...</div>
  }

  if (organizations.length === 0) {
    return (
      <div className="organization-state organization-empty-state">
        <ClipboardText size={30} weight="duotone" />
        <strong>当前账号还没有加入组织</strong>
        <span>加入组织后，就可以在这里提交个人周报。</span>
      </div>
    )
  }

  return (
    <div className="organization-workbench organization-weekly-submit">
      <div className="organization-toolbar">
        <Select
          value={String(selectedOrganizationId)}
          onValueChange={(value) => setSelectedOrganizationId(Number(value))}
        >
          <SelectTrigger className="organization-switcher" aria-label="选择组织">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((organization) => (
              <SelectItem key={organization.id} value={String(organization.id)}>
                {organization.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <div className="organization-error" role="alert">{error}</div> : null}

      <section className="organization-section organization-report-editor organization-weekly-submit-panel">
        <header>
          <h3>提交周报</h3>
          {ownReport ? <span>{ownReport.status === 'submitted' ? '已提交' : '草稿'}</span> : null}
        </header>
        <div className="organization-report-period">
          <span>周报周期</span>
          <strong>{formatWeekRange(weekStart)}</strong>
        </div>
        <Textarea
          placeholder="写下本周完成事项、风险阻塞、协作事项和下周计划"
          value={reportDraft}
          onChange={(event) => setReportDraft(event.target.value)}
        />
        <div className="organization-report-actions">
          <Button
            disabled={busy}
            type="button"
            variant="outline"
            onClick={() => void saveReport('draft')}
          >保存草稿</Button>
          <Button
            disabled={busy || !reportDraft.trim()}
            type="button"
            onClick={() => void saveReport('submitted')}
          ><CheckCircle size={16} /> 提交周报</Button>
        </div>
      </section>
    </div>
  )
}

function OrganizationCreateForm(props: {
  busy: boolean
  name: string
  onNameChange: (value: string) => void
  onOwnerChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  ownerUsername: string
}) {
  return (
    <form className="organization-create-form" onSubmit={props.onSubmit}>
      <Label>组织名称<Input autoFocus maxLength={80} value={props.name} onChange={(event) => props.onNameChange(event.target.value)} /></Label>
      <Label>所有者账号<Input value={props.ownerUsername} onChange={(event) => props.onOwnerChange(event.target.value)} /></Label>
      <DialogFooter>
        <Button disabled={props.busy || !props.name.trim() || !props.ownerUsername.trim()} type="submit">
          创建组织
        </Button>
      </DialogFooter>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function EmptyRow({ text }: { text: string }) {
  return <div className="organization-empty-row">{text}</div>
}

function TaskTable({ departedUserIds, tasks }: { departedUserIds: number[]; tasks: OrganizationTask[] }) {
  if (tasks.length === 0) return <EmptyRow text="暂无任务" />
  return (
    <div className="organization-task-table">
      {tasks.map((task) => (
        <div className="organization-task-row" key={`${task.kind}-${task.id}`}>
          <span className={`organization-task-kind ${task.kind}`}>
            {task.kind === 'bug' ? <Bug size={14} /> : null}{taskKindLabel[task.kind]}
          </span>
          <div><strong>{task.title}</strong><span>{task.projectName}</span></div>
          <UserName departedUserIds={departedUserIds} name={task.assigneeName || '未分配'} userId={task.assigneeUserId} />
          <span>{taskStatusLabel[task.status] ?? task.status}</span>
          <time>{formatDateTime(task.updatedAt)}</time>
        </div>
      ))}
    </div>
  )
}
