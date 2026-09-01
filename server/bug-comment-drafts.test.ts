import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  bugCommentDraftStoragePrefix,
  clearBugCommentDraft,
  clearBugCommentDraftIfMatches,
  createBugCommentDraftStore,
  getBugCommentDraftStorageKey,
  loadBugCommentDraft,
  sanitizeBugCommentDraftContent,
  saveBugCommentDraft,
  subscribeBugCommentDraftChanges,
  type BugCommentDraftStorage,
} from '../src/bug-comment-drafts.ts'

const testWorkbenchSource = readFileSync(new URL('../src/components/test-workbench.tsx', import.meta.url), 'utf8')

class MemoryStorage implements BugCommentDraftStorage {
  values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

test('Bug comment drafts are scoped to one authenticated user and Bug', () => {
  const storage = new MemoryStorage()

  assert.equal(getBugCommentDraftStorageKey(7, 42), `${bugCommentDraftStoragePrefix}.7.42`)
  assert.equal(getBugCommentDraftStorageKey(undefined, 42), undefined)
  assert.equal(getBugCommentDraftStorageKey(7, 0), undefined)

  assert.deepEqual(saveBugCommentDraft(7, 42, 'user 7 Bug 42 draft', 3, storage), {
    ok: true,
    revision: 3,
    status: 'saved',
    value: 'user 7 Bug 42 draft',
  })
  saveBugCommentDraft(7, 43, 'user 7 other Bug draft', 4, storage)
  saveBugCommentDraft(8, 42, 'other user draft', 5, storage)

  assert.deepEqual(loadBugCommentDraft(7, 42, storage), {
    ok: true,
    revision: 3,
    status: 'loaded',
    value: 'user 7 Bug 42 draft',
  })
  assert.deepEqual(loadBugCommentDraft(7, 43, storage), {
    ok: true,
    revision: 4,
    status: 'loaded',
    value: 'user 7 other Bug draft',
  })
  assert.deepEqual(loadBugCommentDraft(8, 42, storage), {
    ok: true,
    revision: 5,
    status: 'loaded',
    value: 'other user draft',
  })
})

test('Bug comment drafts never persist for an anonymous or invalid scope', () => {
  const storage = new MemoryStorage()

  assert.deepEqual(saveBugCommentDraft(undefined, 42, 'not persisted', 3, storage), {
    ok: false,
    revision: 3,
    status: 'unavailable',
    value: 'not persisted',
  })
  assert.deepEqual(saveBugCommentDraft(7, undefined, 'not persisted', 4, storage), {
    ok: false,
    revision: 4,
    status: 'unavailable',
    value: 'not persisted',
  })
  assert.equal(storage.values.size, 0)
})

test('saving an empty Bug comment draft clears only that draft', () => {
  const storage = new MemoryStorage()
  saveBugCommentDraft(7, 42, 'pending content', 2, storage)
  saveBugCommentDraft(7, 43, 'other Bug content', 4, storage)

  assert.deepEqual(saveBugCommentDraft(7, 42, ' \n ', 3, storage), {
    ok: true,
    revision: 3,
    status: 'cleared',
    value: '',
  })
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: true, revision: 0, status: 'missing', value: '' })
  assert.deepEqual(loadBugCommentDraft(7, 43, storage), {
    ok: true,
    revision: 4,
    status: 'loaded',
    value: 'other Bug content',
  })
  assert.deepEqual(clearBugCommentDraft(7, 43, storage), { ok: true, status: 'cleared' })
})

test('an attachment-only draft preserves its revision without persisting attachment data', () => {
  const storage = new MemoryStorage()
  const attachmentOnlyContent = '![pending upload](blob:https://veges.example/temporary-image)'
  const key = getBugCommentDraftStorageKey(7, 42)!

  assert.deepEqual(saveBugCommentDraft(7, 42, attachmentOnlyContent, 2, storage), {
    ok: true,
    revision: 2,
    status: 'saved',
    value: '',
  })
  assert.equal(storage.getItem(key), JSON.stringify({ content: '', revision: 2 }))
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: true, revision: 2, status: 'missing', value: '' })
  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, attachmentOnlyContent, 1, storage), {
    ok: true,
    revision: 2,
    status: 'kept',
    value: '',
  })
})

test('conditional clear preserves newer text typed while a comment request is in flight', () => {
  const storage = new MemoryStorage()
  saveBugCommentDraft(7, 42, 'submitted content', 10, storage)
  saveBugCommentDraft(7, 42, 'newer content', 11, storage)

  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, 'submitted content', 10, storage), {
    ok: true,
    revision: 11,
    status: 'kept',
    value: 'newer content',
  })
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), {
    ok: true,
    revision: 11,
    status: 'loaded',
    value: 'newer content',
  })

  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, 'newer content', 11, storage), {
    ok: true,
    revision: 11,
    status: 'cleared',
    value: '',
  })
})

test('draft sanitization keeps text and ordinary links while dropping evidence attachments', () => {
  const content = [
    'draft text remains',
    '![uploading image](blob:https://veges.example/temporary-image)',
    '![completed image](https://oss.example/attachment.png?sig=abc)',
    '[\u89c6\u9891\uFF1Auploading](blob:https://veges.example/temporary-video)',
    '[related document](https://docs.example/bug)',
  ].join('\n\n')

  const sanitized = sanitizeBugCommentDraftContent(content)
  assert.match(sanitized, /draft text remains/u)
  assert.match(sanitized, /\[related document\]\(https:\/\/docs\.example\/bug\)/u)
  assert.doesNotMatch(sanitized, /attachment\.png/u)
  assert.doesNotMatch(sanitized, /blob:/u)

  const storage = new MemoryStorage()
  assert.deepEqual(saveBugCommentDraft(7, 42, content, 6, storage), {
    ok: true,
    revision: 6,
    status: 'saved',
    value: sanitized,
  })
  assert.equal(storage.getItem(getBugCommentDraftStorageKey(7, 42)!), JSON.stringify({ content: sanitized, revision: 6 }))
})

test('invalid stored snapshots and unavailable storage do not throw or restore content', () => {
  const storage = new MemoryStorage()
  const key = getBugCommentDraftStorageKey(7, 42)!
  storage.setItem(key, '{not valid json')
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: false, revision: 0, status: 'failed', value: '' })

  storage.setItem(key, JSON.stringify({ content: 42 }))
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: false, revision: 0, status: 'failed', value: '' })
  storage.setItem(key, JSON.stringify({ content: 'legacy draft' }))
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: true, revision: 0, status: 'loaded', value: 'legacy draft' })
  storage.setItem(key, JSON.stringify({ content: 'bad revision', revision: -1 }))
  assert.deepEqual(loadBugCommentDraft(7, 42, storage), { ok: false, revision: 0, status: 'failed', value: '' })
  assert.deepEqual(loadBugCommentDraft(7, 42, null), { ok: false, revision: 0, status: 'unavailable', value: '' })
})

test('storage operation failures are distinguishable so the UI can retain the in-memory draft', () => {
  const storage: BugCommentDraftStorage = {
    getItem: () => {
      throw new Error('read failed')
    },
    removeItem: () => {
      throw new Error('remove failed')
    },
    setItem: () => {
      throw new Error('write failed')
    },
  }
  const store = createBugCommentDraftStore(storage)

  assert.deepEqual(store.load(7, 42), { ok: false, revision: 0, status: 'failed', value: '' })
  assert.deepEqual(store.save(7, 42, 'in-memory draft', 3), {
    ok: false,
    revision: 3,
    status: 'failed',
    value: 'in-memory draft',
  })
  assert.deepEqual(store.clear(7, 42), { ok: false, status: 'failed' })
  assert.deepEqual(store.clearIfMatches(7, 42, 'published content', 3), {
    ok: false,
    revision: 3,
    status: 'failed',
    value: 'published content',
  })
})

test('conditional clearing notifies a remounted composer only when its revision was cleared', () => {
  const storage = new MemoryStorage()
  const changes: Array<[number, number]> = []
  const unsubscribe = subscribeBugCommentDraftChanges((userId, bugId) => changes.push([userId, bugId]))

  saveBugCommentDraft(7, 42, 'draft text', 4, storage)
  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, 'draft text', 3, storage), {
    ok: true,
    revision: 4,
    status: 'kept',
    value: 'draft text',
  })
  assert.deepEqual(changes, [])

  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, 'draft text', 4, storage), {
    ok: true,
    revision: 4,
    status: 'cleared',
    value: '',
  })
  unsubscribe()
  assert.deepEqual(changes, [[7, 42]])
})

test('a stale draft listener cannot turn a successful clear into a failure', () => {
  const storage = new MemoryStorage()
  const unsubscribe = subscribeBugCommentDraftChanges(() => {
    throw new Error('stale listener')
  })

  saveBugCommentDraft(7, 42, 'draft text', 2, storage)
  assert.deepEqual(clearBugCommentDraftIfMatches(7, 42, 'draft text', 2, storage), {
    ok: true,
    revision: 2,
    status: 'cleared',
    value: '',
  })
  unsubscribe()
})

test('both new-comment composers use the shared per-user per-Bug draft flow', () => {
  assert.match(testWorkbenchSource, /<BugsView[\s\S]*?draftOwnerUserId=\{currentUserId\}/u)
  assert.match(testWorkbenchSource, /function BugDetail[\s\S]*?draftOwnerUserId\?: number/u)
  assert.match(testWorkbenchSource, /<BugCommentsSection[\s\S]*?draftOwnerUserId=\{draftOwnerUserId\}/u)
  assert.match(testWorkbenchSource, /<BugCommentsSection[\s\S]*?currentUserId=\{currentUserId\}[\s\S]*?draftOwnerUserId=\{currentUserId\}/u)
  assert.match(testWorkbenchSource, /loadBugCommentDraft\(draftOwnerUserId, bug\.id\)/u)
  assert.match(testWorkbenchSource, /saveBugCommentDraft\(draftOwnerUserId, bug\.id, nextValue, nextRevision\)/u)
  assert.match(testWorkbenchSource, /clearBugCommentDraftIfMatches\(\s*submittedUserId,\s*submittedBug\.id,\s*submittedContent,\s*submittedRevision,/u)
  assert.match(testWorkbenchSource, /subscribeBugCommentDraftChanges/u)
  assert.doesNotMatch(testWorkbenchSource, /clearBugCommentDraft\(submittedUserId, submittedBug\.id\)/u)
  assert.match(testWorkbenchSource, /key=\{draftContext\}/u)
  assert.match(testWorkbenchSource, /return commitValue\(serializeBugEvidenceContent\(nextText, nextAttachments\)\)/u)
  assert.match(testWorkbenchSource, /评论已发布，但浏览器草稿未能清除/u)
  assert.match(testWorkbenchSource, /draftMemoryRef\.current\.set\(draftContext, saved\.value\)/u)
  assert.match(testWorkbenchSource, /const draftRevisionRef = useRef\(new Map<string, number>\(\)\)/u)
  assert.match(testWorkbenchSource, /draftRevisionRef\.current\.set\(draftContext, loaded\.revision\)/u)
  assert.match(testWorkbenchSource, /const submittedRevision = draftRevisionRef\.current\.get\(submittedContext\) \?\? 0/u)
  assert.match(testWorkbenchSource, /if \(draftRevisionRef\.current\.get\(submittedContext\) !== submittedRevision\) return/u)
  assert.doesNotMatch(testWorkbenchSource, /setComment\(''\)/u)
  assert.match(testWorkbenchSource, /const mountedRef = useRef\(false\)/u)
  assert.match(testWorkbenchSource, /if \(!mountedRef\.current\) return/u)
})
