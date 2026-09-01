export const bugCommentDraftStoragePrefix = 'veges.testBugCommentDraft.v1'

export type BugCommentDraftStorage = {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

export type BugCommentDraftLoadResult = {
  ok: boolean
  revision: number
  status: 'failed' | 'loaded' | 'missing' | 'unavailable'
  value: string
}

export type BugCommentDraftSaveResult = {
  ok: boolean
  revision: number
  status: 'cleared' | 'failed' | 'saved' | 'unavailable'
  value: string
}

export type BugCommentDraftClearResult = {
  ok: boolean
  status: 'cleared' | 'failed' | 'unavailable'
}

export type BugCommentDraftConditionalClearResult = {
  ok: boolean
  revision: number
  status: 'cleared' | 'failed' | 'kept' | 'missing' | 'unavailable'
  value: string
}

export type BugCommentDraftStore = {
  clear: (userId: number | null | undefined, bugId: number | null | undefined) => BugCommentDraftClearResult
  clearIfMatches: (
    userId: number | null | undefined,
    bugId: number | null | undefined,
    submittedContent: unknown,
    revision: number,
  ) => BugCommentDraftConditionalClearResult
  load: (userId: number | null | undefined, bugId: number | null | undefined) => BugCommentDraftLoadResult
  save: (
    userId: number | null | undefined,
    bugId: number | null | undefined,
    content: unknown,
    revision: number,
  ) => BugCommentDraftSaveResult
}

type StorageResolution =
  | { status: 'available'; storage: BugCommentDraftStorage }
  | { status: 'failed' | 'unavailable' }

type BugCommentDraftSnapshot = {
  content: string
  revision: number
}

type BugCommentDraftChangeListener = (userId: number, bugId: number) => void

const markdownLinkWithDestinationPattern = /!?\[[^\]\r\n]*\]\(\s*(?:<([^>\r\n]*)>|([^\s)\r\n]+))(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^)\r\n]*\)))?\s*\)/gu
const bugCommentDraftChangeListeners = new Set<BugCommentDraftChangeListener>()

function isPositiveId(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function normalizeRevision(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function isBugCommentDraftStorage(value: unknown): value is BugCommentDraftStorage {
  if (!value || typeof value !== 'object') return false
  const storage = value as Partial<BugCommentDraftStorage>
  return (
    typeof storage.getItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.setItem === 'function'
  )
}

function resolveStorage(storage: BugCommentDraftStorage | null | undefined): StorageResolution {
  if (storage === null) return { status: 'unavailable' }
  if (storage) return { status: 'available', storage }

  try {
    const browserStorage = (globalThis as { localStorage?: unknown }).localStorage
    return isBugCommentDraftStorage(browserStorage)
      ? { status: 'available', storage: browserStorage }
      : { status: 'unavailable' }
  } catch {
    return { status: 'failed' }
  }
}

function readDraftSnapshot(value: unknown): BugCommentDraftSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const snapshot = value as { content?: unknown; revision?: unknown }
  if (typeof snapshot.content !== 'string') return undefined
  if (snapshot.revision !== undefined && normalizeRevision(snapshot.revision) !== snapshot.revision) return undefined
  return { content: snapshot.content, revision: normalizeRevision(snapshot.revision) }
}

function notifyBugCommentDraftChange(userId: number | null | undefined, bugId: number | null | undefined) {
  if (!isPositiveId(userId) || !isPositiveId(bugId)) return
  bugCommentDraftChangeListeners.forEach((listener) => {
    try {
      listener(userId, bugId)
    } catch {
      // Storage mutation has already completed; one stale listener must not change its result.
    }
  })
}

export function subscribeBugCommentDraftChanges(listener: BugCommentDraftChangeListener) {
  bugCommentDraftChangeListeners.add(listener)
  return () => {
    bugCommentDraftChangeListeners.delete(listener)
  }
}

export function getBugCommentDraftStorageKey(
  userId: number | null | undefined,
  bugId: number | null | undefined,
) {
  if (!isPositiveId(userId) || !isPositiveId(bugId)) return undefined
  return `${bugCommentDraftStoragePrefix}.${userId}.${bugId}`
}

export function sanitizeBugCommentDraftContent(content: string) {
  return content.replace(markdownLinkWithDestinationPattern, (match, angleDestination: string | undefined, bareDestination: string | undefined) => {
    const destination = (angleDestination ?? bareDestination ?? '').trim()
    const isEvidenceAttachment = match.startsWith('![') || /^\[\u89c6\u9891\uFF1A/u.test(match)
    return isEvidenceAttachment || /^blob:/iu.test(destination) ? '' : match
  })
}

function sanitizeBugCommentDraft(content: unknown) {
  return typeof content === 'string' ? sanitizeBugCommentDraftContent(content) : ''
}

export function loadBugCommentDraft(
  userId: number | null | undefined,
  bugId: number | null | undefined,
  storage?: BugCommentDraftStorage | null,
): BugCommentDraftLoadResult {
  const key = getBugCommentDraftStorageKey(userId, bugId)
  if (!key) return { ok: false, revision: 0, status: 'unavailable', value: '' }

  const resolvedStorage = resolveStorage(storage)
  if (resolvedStorage.status !== 'available') {
    return { ok: false, revision: 0, status: resolvedStorage.status, value: '' }
  }

  try {
    const raw = resolvedStorage.storage.getItem(key)
    if (!raw) return { ok: true, revision: 0, status: 'missing', value: '' }
    const snapshot = readDraftSnapshot(JSON.parse(raw))
    if (!snapshot) return { ok: false, revision: 0, status: 'failed', value: '' }

    const sanitized = sanitizeBugCommentDraft(snapshot.content)
    return sanitized.trim()
      ? { ok: true, revision: snapshot.revision, status: 'loaded', value: sanitized }
      : { ok: true, revision: snapshot.revision, status: 'missing', value: '' }
  } catch {
    return { ok: false, revision: 0, status: 'failed', value: '' }
  }
}

export function saveBugCommentDraft(
  userId: number | null | undefined,
  bugId: number | null | undefined,
  content: unknown,
  revision: number = 0,
  storage?: BugCommentDraftStorage | null,
): BugCommentDraftSaveResult {
  const rawContent = typeof content === 'string' ? content : ''
  const sanitized = sanitizeBugCommentDraft(rawContent)
  const normalizedRevision = normalizeRevision(revision)
  const key = getBugCommentDraftStorageKey(userId, bugId)
  if (!key) return { ok: false, revision: normalizedRevision, status: 'unavailable', value: sanitized }

  const resolvedStorage = resolveStorage(storage)
  if (resolvedStorage.status !== 'available') {
    return { ok: false, revision: normalizedRevision, status: resolvedStorage.status, value: sanitized }
  }

  try {
    if (!sanitized.trim() && !rawContent.trim()) {
      resolvedStorage.storage.removeItem(key)
      return { ok: true, revision: normalizedRevision, status: 'cleared', value: '' }
    }
    resolvedStorage.storage.setItem(key, JSON.stringify({ content: sanitized, revision: normalizedRevision }))
    return { ok: true, revision: normalizedRevision, status: 'saved', value: sanitized }
  } catch {
    return { ok: false, revision: normalizedRevision, status: 'failed', value: sanitized }
  }
}

export function clearBugCommentDraft(
  userId: number | null | undefined,
  bugId: number | null | undefined,
  storage?: BugCommentDraftStorage | null,
): BugCommentDraftClearResult {
  const key = getBugCommentDraftStorageKey(userId, bugId)
  if (!key) return { ok: false, status: 'unavailable' }

  const resolvedStorage = resolveStorage(storage)
  if (resolvedStorage.status !== 'available') {
    return { ok: false, status: resolvedStorage.status }
  }

  try {
    resolvedStorage.storage.removeItem(key)
    notifyBugCommentDraftChange(userId, bugId)
    return { ok: true, status: 'cleared' }
  } catch {
    return { ok: false, status: 'failed' }
  }
}

export function clearBugCommentDraftIfMatches(
  userId: number | null | undefined,
  bugId: number | null | undefined,
  submittedContent: unknown,
  submittedRevision: number = 0,
  storage?: BugCommentDraftStorage | null,
): BugCommentDraftConditionalClearResult {
  const submittedValue = sanitizeBugCommentDraft(submittedContent)
  const normalizedSubmittedRevision = normalizeRevision(submittedRevision)
  const key = getBugCommentDraftStorageKey(userId, bugId)
  if (!key) return { ok: false, revision: normalizedSubmittedRevision, status: 'unavailable', value: submittedValue }

  const resolvedStorage = resolveStorage(storage)
  if (resolvedStorage.status !== 'available') {
    return { ok: false, revision: normalizedSubmittedRevision, status: resolvedStorage.status, value: submittedValue }
  }

  try {
    const raw = resolvedStorage.storage.getItem(key)
    if (!raw) {
      notifyBugCommentDraftChange(userId, bugId)
      return { ok: true, revision: normalizedSubmittedRevision, status: 'missing', value: '' }
    }
    const snapshot = readDraftSnapshot(JSON.parse(raw))
    if (!snapshot) return { ok: false, revision: 0, status: 'failed', value: '' }

    const storedValue = sanitizeBugCommentDraft(snapshot.content)
    if (storedValue !== submittedValue || snapshot.revision !== normalizedSubmittedRevision) {
      return { ok: true, revision: snapshot.revision, status: 'kept', value: storedValue }
    }

    resolvedStorage.storage.removeItem(key)
    notifyBugCommentDraftChange(userId, bugId)
    return { ok: true, revision: normalizedSubmittedRevision, status: 'cleared', value: '' }
  } catch {
    return { ok: false, revision: normalizedSubmittedRevision, status: 'failed', value: submittedValue }
  }
}

export function createBugCommentDraftStore(storage?: BugCommentDraftStorage | null): BugCommentDraftStore {
  return {
    clear: (userId, bugId) => clearBugCommentDraft(userId, bugId, storage),
    clearIfMatches: (userId, bugId, submittedContent, revision) => (
      clearBugCommentDraftIfMatches(userId, bugId, submittedContent, revision, storage)
    ),
    load: (userId, bugId) => loadBugCommentDraft(userId, bugId, storage),
    save: (userId, bugId, content, revision) => saveBugCommentDraft(userId, bugId, content, revision, storage),
  }
}
