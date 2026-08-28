export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type Priority = 'high' | 'medium' | 'low'
export type TodoConfirmationStatus = 'confirmed' | 'pending_review' | 'rejected' | 'acceptance_failed'
export type ProjectAccessRole = 'owner' | 'member'
export type JournalVisibility = 'private' | 'public'
export type { UserAccountStatus } from '../shared/user-lifecycle'

export type ImageSyncArchitecture = 'amd64' | 'arm64'
export type ImageSyncArtifactKind = 'tar' | 'md5'
export type ImageSyncRunStatus = 'dispatching' | 'queued' | 'in_progress' | 'completed' | 'failed'

export type ImageSyncRunStep = {
  completedAt: string | null
  conclusion: string | null
  name: string
  number: number
  startedAt: string | null
  status: string
}

export type ImageSyncRunJob = {
  completedAt: string | null
  conclusion: string | null
  id: number
  name: string
  startedAt: string | null
  status: string
  steps: ImageSyncRunStep[]
}

export type ImageSyncRun = {
  arch: ImageSyncArchitecture
  artifacts: { md5Uri: string; tarUri: string } | null
  completedAt: string | null
  conclusion: string | null
  createdAt: string
  error: { code: string; message: string } | null
  githubRunId: number | null
  githubRunUrl: string | null
  id: number
  image: string
  jobs: ImageSyncRunJob[]
  lastSyncedAt: string | null
  status: ImageSyncRunStatus
  updatedAt: string
}

export type ImageSyncDownloadLink = {
  downloadUrl: string
  expiresAt: string
  expiresInSeconds: number
}

export type JournalEntry = {
  id: number
  createdAt: string
  content: string
  authorUserId?: number
  speakerName: string
  visibility: JournalVisibility
}

export type Todo = {
  id: number
  projectId: number
  createdAt: string
  createdByUserId?: number
  creatorName?: string
  assigneeUserId?: number
  assigneeName?: string
  watcherUserId?: number
  watcherName?: string
  watcherUserIds?: number[]
  watcherNames?: string[]
  reviewerUserId?: number
  reviewerName?: string
  assignedByUserId?: number
  assignedByName?: string
  offboardingTransferredFromName?: string
  title: string
  detail: string
  dueDate: string
  priority: Priority
  done: boolean
  completedAt?: string
  completedByUserId?: number
  completedByName?: string
  confirmationStatus: TodoConfirmationStatus
  linkedToDeliveryEvent: boolean
  moduleId?: number
  moduleName?: string
  notes: TodoNote[]
}

export type ProjectModule = {
  id: number
  projectId: number
  name: string
  createdAt: string
}

export type TodoNote = {
  id: number
  todoId: number
  authorUserId?: number
  authorName: string
  content: string
  kind?: 'normal' | 'acceptance'
  createdAt: string
  updatedAt: string
  sourceOperationId?: number
}

export type ProjectMembership = {
  id: number
  projectId: number
  invitedUsername: string
  invitedUserId?: number
  role: ProjectAccessRole
  status: 'pending' | 'active' | 'declined'
  memberName: string
  createdAt: string
}

export type NotificationState = {
  readAt?: string
  dismissedAt?: string
  sortAt?: string
}

export type ProjectInviteNotification = NotificationState & {
  id: number
  projectId: number
  projectName: string
  invitedByName: string
  createdAt: string
}

export type ProjectTransferNotification = NotificationState & {
  id: number
  projectId: number
  projectName: string
  organizationName: string
  requestedByName: string
  createdAt: string
  expiresAt: string
}

export type TodoNotification = NotificationState & {
  id: number
  projectId: number
  projectName: string
  moduleName?: string
  title: string
  dueDate: string
  priority: Priority
  done?: boolean
  assignedAt?: string
  assignedByName?: string
  noteId?: number
  noteAuthorName?: string
  notePreview?: string
  createdAt?: string
  watchedAt?: string
  watchedByName?: string
  watcherName?: string
  type?: 'assigned' | 'watched' | 'due_tomorrow' | 'note_mention'
}

export type PackageEventNotification = NotificationState & {
  assignedAt?: string
  assignedByName?: string
  eventStatus: ProjectPackageEventStatus
  eventType: ProjectPackageEventType
  id: number
  projectId: number
  projectName: string
  title: string
}

export type PackageEventCommentMentionNotification = NotificationState & {
  authorName: string
  commentId: number
  commentPreview: string
  createdAt: string
  eventId: number
  eventTitle: string
  projectId: number
  projectName: string
}

export type AccountOffboardingNotificationOrganization = {
  bugCount: number
  name: string
  projectNames: string[]
  testSpaceNames: string[]
  transferredTodoCount: number
}

export type AccountOffboardingNotification = NotificationState & {
  createdAt: string
  departedUserName: string
  id: number
  organizations: AccountOffboardingNotificationOrganization[]
}

export type NotificationCenterData = {
  accountOffboardingReceived: AccountOffboardingNotification[]
  assignedPackageEvents: PackageEventNotification[]
  assignedTodos: TodoNotification[]
  watchedTodos: TodoNotification[]
  dueTomorrowTodos: TodoNotification[]
  noteMentions: TodoNotification[]
  invites: ProjectInviteNotification[]
  packageEventCommentMentions: PackageEventCommentMentionNotification[]
  projectTransfers: ProjectTransferNotification[]
}

export type InboxItem = {
  id: number
  source: 'manual' | 'feishu'
  itemType: 'journal' | 'todo'
  todoTitle?: string
  content: string
  todoDueDate?: string
  todoPriority?: Priority
  createdAt: string
  suggestedProjectId?: number
  processed: boolean
}

export type Summary = {
  id: number
  projectId?: number
  sourceTurnId?: string
  type: SummaryPeriodType | 'monthly' | 'reply'
  title: string
  period: string
  content: string
  createdAt: string
}

export type SummaryPeriodType = 'daily' | 'weekly'

export type ChangelogEntry = {
  content: string
  createdAt: string
  createdByUserId: number | null
  id: number
  publishedAt: string
  title: string
  updatedAt: string
  updatedByUserId: number | null
  version: string
}

export type {
  AiConversation,
  AiConversationContextKind,
  AiTurn,
  AiTurnAttachment,
  AiTurnIntentKind,
  AiTurnOutcome,
  AiTurnStatus,
} from '../shared/ai-conversation-wire'
import type {
  AiConversation,
  AiTurn,
  AiTurnOutcome,
} from '../shared/ai-conversation-wire'

export type AiConversationPage = {
  conversations: AiConversation[]
  nextCursor: string | null
}

export type AiTurnPage = {
  conversation: AiConversation
  nextBeforeTurn: number | null
  turns: AiTurn[]
}

export type AiTurnRunOutcome =
  Exclude<AiTurnOutcome, null>

export type { AiTurnRunResponse } from '../shared/ai-conversation-wire'

export type TodoActivityEvent = {
  id: number
  todoId?: number
  projectId: number
  eventType: 'created' | 'completed' | 'reopened' | 'assigned' | 'confirmed' | 'rejected' | 'acceptance_failed'
  todoTitle: string
  actorUserId?: number
  actorName: string
  assigneeUserId?: number
  assigneeName?: string
  dueDate?: string
  priority?: Priority
  occurredAt: string
}

export type NotificationSubscription = {
  enabled: boolean
  localSendTime: string
  timezone: string
}

export type TodoProposal = {
  projectId: number | null
  moduleId: number | null
  assigneeUserId: number | null
  title: string
  detail: string
  dueDate: string | null
  priority: Priority
  confidence: number
  sourceExcerpt: string
}

export type ProjectPackageEventType = 'init' | 'upgrade'
export type ProjectPackageEventStatus = 'draft' | 'delivering' | 'delivered'
export type ProjectPackageOperationStatus = 'failed' | 'pending' | 'success'
export type ProjectPackageOperationKind = 'document' | 'event'
export type PackageMarketChannel = 'release' | 'ci'

export type ProjectPackageItem = {
  id: number
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
  createdAt: string
}

export type ProjectPackageOperation = {
  eventId: number
  groupId: number | null
  id: number
  kind: ProjectPackageOperationKind
  status: ProjectPackageOperationStatus
  title: string
  label: string
  content: string
  relatedTodoIds: number[]
  relatedTodoNotes: Record<number, string>
  completed: boolean
  autoGenerated: boolean
  createdAt: string
  updatedAt: string
}

export type ProjectPackageGroup = {
  id: number
  packageName: string
  items: ProjectPackageItem[]
  operations: ProjectPackageOperation[]
}

export type ProjectPackageEventComment = {
  authorName: string
  authorUserId?: number
  canEdit?: boolean
  content: string
  createdAt: string
  id: number
  updatedAt: string
}

export type ProjectPackageEvent = {
  assignedAt?: string
  assignedByName?: string
  assignedByUserId?: number
  assigneeName?: string
  assigneeUserId?: number
  comments: ProjectPackageEventComment[]
  id: number
  type: ProjectPackageEventType
  status: ProjectPackageEventStatus
  title: string
  createdAt: string
  deliveryDate: string
  deliveryEndAt: string
  deliveryStartAt: string
  updatedAt: string
  operations: ProjectPackageOperation[]
  publishedAt?: string
  publishedByUserId?: number
  groups: ProjectPackageGroup[]
}

export type ProjectPackageEventDocumentInput = {
  content: string
  packageName?: string
  relatedTodoIds: number[]
  scope: 'event' | 'package'
  title: string
}

export type ProjectPackageEventSavePayload = {
  action: 'publish' | 'save_draft'
  assigneeUserId: number
  deliveryDate: string
  deliveryEndAt: string
  deliveryStartAt: string
  documents: ProjectPackageEventDocumentInput[]
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
  title: string
  type: ProjectPackageEventType
}

export type ProjectPackageTimeline = {
  departedUserIds: number[]
  projectId: number
  events: ProjectPackageEvent[]
  mentionableMembers: Array<{ id: number; name: string }>
}

export type PackageMarketRule = {
  id: string
  name: string
  category: 'apps' | 'middleware' | 'dependency'
  mode: 'release' | 'flat' | 'mixed' | 'pro-middleware'
  releaseRoots: string[]
  flatFileRoots: string[]
  dependencyRoots?: string[]
  dependencyFilePatterns?: string[]
  parent?: string
  fileNameFormats: string[]
  ciFileNameFormats: string[]
}

export type PackageMarketVersion = {
  version?: string
  hash?: string
  label: string
  lastModified?: string
}

export type PackageMarketCiBranch = {
  label: string
  name: string
}

export type PackageMarketLink = {
  name: string
  version: string
  objectKey: string
  size?: number
  lastModified?: string
  downloadUrl: string
  expiresAt?: string
  expiresInSeconds?: number
}

export type PackageMarketDetail = {
  title: string
  type: string
  meta: Array<{ label: string; value: string }>
  links: PackageMarketLink[]
  releaseVersions?: PackageMarketVersion[]
  ciVersions?: PackageMarketVersion[]
  selectedHash?: string
}

export type Project = {
  id: number
  accessRole: ProjectAccessRole
  name: string
  description: string
  ownerName: string
  ownerUserId: number
  organizationId?: number | null
  canManageOrganizationTodos?: boolean
  readOnly?: boolean
  status: ProjectStatus
  feishuChatEnabled?: boolean
  feishuChatId?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  journals: JournalEntry[]
  risks: string[]
  riskJournalEntryIds: number[]
  modules: ProjectModule[]
}
