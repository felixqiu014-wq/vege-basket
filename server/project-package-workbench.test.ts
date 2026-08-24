import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveExistingOperationInteraction } from '../src/project-package-operation-access.ts'

const workbenchSource = readFileSync(
  new URL('../src/components/project-package-workbench.tsx', import.meta.url),
  'utf8',
)
const timelineSource = readFileSync(
  new URL('./project-package-timeline.ts', import.meta.url),
  'utf8',
)
const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('published event and package documents remain openable for read-only viewing', () => {
  assert.deepEqual(resolveExistingOperationInteraction(false), {
    disabled: false,
    readOnly: true,
  })
})

test('package market rule-outside objects keep download actions', () => {
  assert.doesNotMatch(workbenchSource, /当前规则不允许下载此对象/u)
  assert.match(indexSource, /isSafePackageMarketObjectKey/u)
  assert.doesNotMatch(indexSource, /isAllowedPackageMarketObjectKey/u)
})

test('draft event documents remain openable for editing', () => {
  assert.deepEqual(resolveExistingOperationInteraction(true), {
    disabled: false,
    readOnly: false,
  })
})

test('published operation documents keep todo management without restoring document mutations', () => {
  const todoActionPattern = /\{canManageProject \? \(\s*<div className="operation-entry-actions">[\s\S]*?aria-label="关联待办"[\s\S]*?\{canManageTimeline \? \(\s*<DeleteConfirmDialog/gu
  assert.equal([...workbenchSource.matchAll(todoActionPattern)].length, 2)
  assert.match(
    timelineSource,
    /const operation = await findOperationMeta\([\s\S]*?if \(!operation\)[\s\S]*?if \(operation\.published_at && updates\.length > 0\)[\s\S]*?Published events are read-only/u,
  )
})

test('existing operation todo management opens without a default filter', () => {
  const openTodoDialogSource = workbenchSource.slice(
    workbenchSource.indexOf('function openOperationTodoDialog'),
    workbenchSource.indexOf('function clearOperationTodoDialogState'),
  )
  assert.match(openTodoDialogSource, /setTodoDialogSearch\(''\)/u)
  assert.match(openTodoDialogSource, /setTodoFilterConditions\(\[\]\)/u)
  assert.match(openTodoDialogSource, /setTodoFilterJoin\('and'\)/u)
  assert.doesNotMatch(openTodoDialogSource, /createTodoFilterCondition/u)
})

test('event wizard keeps the stepper below its compact header without a return-list action', () => {
  const headerSource = workbenchSource.slice(
    workbenchSource.indexOf('<header className="event-wizard-header">'),
    workbenchSource.indexOf('<div className="event-wizard-steps-row">'),
  )
  const editorTopSource = workbenchSource.slice(
    workbenchSource.indexOf('<header className="event-wizard-header">'),
    workbenchSource.indexOf('<div className="event-wizard-content">'),
  )
  assert.match(headerSource, /event-wizard-heading/u)
  assert.doesNotMatch(headerSource, /event-wizard-steps/u)
  assert.match(editorTopSource, /<\/header>[\s\S]*event-wizard-main[\s\S]*event-wizard-steps-row[\s\S]*event-wizard-steps/u)
  assert.match(editorTopSource, /item\.step <= eventEditorStep \? 'reached'/u)
  assert.doesNotMatch(headerSource, /返回列表/u)
})

test('selecting a draft event opens its summary instead of the editor', () => {
  const listSelectionSource = workbenchSource.slice(
    workbenchSource.indexOf('function selectEventFromList'),
    workbenchSource.indexOf('function openOperationDialog'),
  )
  const imperativeSelectionSource = workbenchSource.slice(
    workbenchSource.indexOf('selectEvent: (eventId: number) => {'),
    workbenchSource.indexOf('  }))', workbenchSource.indexOf('selectEvent: (eventId: number) => {')),
  )
  assert.doesNotMatch(listSelectionSource, /openDraftEventEditor/u)
  assert.match(listSelectionSource, /setEventEditorOpen\(false\)/u)
  assert.doesNotMatch(imperativeSelectionSource, /openDraftEventEditor/u)
})

test('deleting the edited event closes its editor and advances to the next visible event', () => {
  const deletionSource = workbenchSource.slice(
    workbenchSource.indexOf('async function deleteEventFromList'),
    workbenchSource.indexOf('function openOperationDialog'),
  )
  assert.match(deletionSource, /visibleEvents\[deletedIndex \+ 1\]/u)
  assert.match(deletionSource, /visibleEvents\[deletedIndex - 1\]/u)
  assert.match(deletionSource, /const deleted = await onDeleteEvent\(event\.id\)/u)
  assert.match(deletionSource, /if \(!deleted \|\| !deletingActiveEvent\) return/u)
  assert.match(deletionSource, /setEventEditorOpen\(false\)/u)
  assert.match(deletionSource, /setEventEditorEventId\(null\)/u)
  assert.match(workbenchSource, /onConfirm=\{\(\) => deleteEventFromList\(event\)\}/u)
})

test('event wizard keeps optional todo associations scoped to each step-three document', () => {
  const stepThreeSource = workbenchSource.slice(
    workbenchSource.indexOf('{eventEditorStep === 3 ? ('),
    workbenchSource.indexOf('<footer className="event-wizard-footer">'),
  )
  assert.match(stepThreeSource, /<strong>关联待办<\/strong>/u)
  assert.match(stepThreeSource, /关联结果仅应用于当前文档/u)
  assert.match(stepThreeSource, /documentTodoFilterSummary/u)
  assert.match(stepThreeSource, /<TodoFilterBuilderDialog/u)
  assert.match(stepThreeSource, /conditions=\{documentTodoFilterConditions\}/u)
  assert.match(
    workbenchSource,
    /documentTodoFilterConditions, setDocumentTodoFilterConditions\] = useState<TodoFilterCondition\[\]>\(\[\]\)/u,
  )
  assert.match(workbenchSource, /relatedTodoIds: eventDocumentRelatedTodoIds/u)
  assert.match(workbenchSource, /relatedTodoIds: document\?\.relatedTodoIds \?\? \[\]/u)
  assert.match(workbenchSource, /event-wizard-footer-actions[\s\S]*event-wizard-navigation[\s\S]*event-wizard-save-actions/u)
})

test('event wizard document navigation keeps tab semantics and valid scope state', () => {
  const documentNavigationSource = workbenchSource.slice(
    workbenchSource.indexOf('<div className="event-wizard-document-nav"'),
    workbenchSource.indexOf('<Label className="event-document-title-field">'),
  )
  assert.match(documentNavigationSource, /role="tablist"/u)
  assert.match(documentNavigationSource, /aria-controls=\{`\$\{documentTabsId\}-panel`\}/u)
  assert.match(documentNavigationSource, /tabIndex=\{resolvedDocumentScope ===/u)
  assert.match(documentNavigationSource, /onKeyDown=\{\(event\) => handleDocumentTabKeyDown/u)
  assert.match(documentNavigationSource, /role="tabpanel"/u)
  assert.match(documentNavigationSource, /aria-labelledby=/u)
  assert.match(workbenchSource, /if \(documentScopes\.includes\(activeDocumentScope\)\) return/u)
  assert.match(workbenchSource, /const resolvedDocumentScope = documentScopes\.includes\(activeDocumentScope\)/u)
  assert.match(workbenchSource, /setActiveDocumentScope\('event'\)/u)
})

test('event wizard keeps long package document navigation inside the desktop sidebar', () => {
  const appCssSource = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(
    appCssSource,
    /\.event-wizard-main \{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/u,
  )
  assert.match(
    appCssSource,
    /\.event-wizard-steps-row \{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/u,
  )
  assert.match(
    appCssSource,
    /\.event-wizard-step-group\.documents \{[\s\S]*?grid-template-rows: 58px minmax\(0, 1fr\);[\s\S]*?overflow: hidden;/u,
  )
  assert.match(
    appCssSource,
    /\.event-wizard-document-nav \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/u,
  )
  const mobileCssSource = appCssSource.slice(appCssSource.indexOf('@media (max-width: 760px)'))
  assert.match(
    mobileCssSource,
    /\.event-wizard-document-nav \{[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden;/u,
  )
})

test('aggregate event save validates and persists document todo links transactionally', () => {
  assert.match(indexSource, /relatedTodoIds: Array\.isArray\(value\.relatedTodoIds\)/u)
  assert.match(
    timelineSource,
    /return withTransaction\(async \(client\) => \{\s*await ensureProjectTodoIds\([\s\S]*?let eventId = params\.eventId/u,
  )
  assert.match(
    timelineSource,
    /insert into project_package_operations[\s\S]*?returning id[\s\S]*?replaceOperationTodoLinks\(/u,
  )
})

test('delivery events expose per-event comments with author names', () => {
  assert.match(timelineSource, /comments: commentsByEvent\.get\(Number\(row\.id\)\) \?\? \[\]/u)
  assert.match(timelineSource, /from project_package_event_comments c/u)
  assert.match(timelineSource, /content: decryptText\(row\.content\)/u)
  assert.match(timelineSource, /authorName: displayUserName\(/u)
  assert.match(timelineSource, /mentionableMembers,/u)
  assert.match(timelineSource, /organization_memberships om on om\.organization_id = p\.organization_id/u)
})

test('package event comments support encrypted author-only updates and deletes', () => {
  const commentSource = timelineSource.slice(
    timelineSource.indexOf('export async function createProjectPackageEventComment'),
  )
  assert.match(commentSource, /insert into project_package_event_comments \(project_package_event_id, author_user_id, content\)/u)
  assert.match(commentSource, /values \(\$1, \$2, \$3\)\s*returning id/u)
  assert.match(commentSource, /encryptText\(params\.content\)/u)
  assert.match(commentSource, /mentionedUserIds: number\[\]/u)
  assert.match(commentSource, /insert into notification_deliveries/u)
  assert.match(commentSource, /where kind = 'package_event_comment_added' and source_id = \$1/u)
  assert.match(commentSource, /for update of c/u)
  assert.match(commentSource, /Only the comment author can change it/u)
  assert.match(commentSource, /delete from project_package_event_comments where id = \$1/u)
  assert.match(timelineSource, /readonly status: 400 \| 403 \| 404 \| 409/u)
})

test('delivery comment mention resolution covers organization and project members', () => {
  const resolver = timelineSource.slice(
    timelineSource.indexOf('export async function resolvePackageEventMentionUserIds'),
    timelineSource.indexOf('export async function createProjectPackageEventComment'),
  )
  assert.match(resolver, /lower\(coalesce\(nullif\(u\.display_name, ''\), u\.email\)\) = any\(\$2::text\[\]\)/u)
  assert.match(resolver, /u\.id = \(select p\.user_id from projects p where p\.id = \$1\)/u)
  assert.match(resolver, /project_memberships pm[\s\S]*pm\.status = 'active'/u)
  assert.match(resolver, /organization_memberships om[\s\S]*om\.status = 'active'/u)
})

test('package event comment routes require project write access and valid content', () => {
  const commentRoutes = indexSource.slice(
    indexSource.indexOf("app.post('/api/projects/:projectId/package-timeline/events/:eventId/comments'"),
    indexSource.indexOf("app.get('/api/projects/:projectId/package-timeline/export'"),
  )
  assert.match(commentRoutes, /getProjectAccess\(projectId, userId\)/u)
  assert.match(commentRoutes, /Comment is required/u)
  assert.match(commentRoutes, /createProjectPackageEventComment/u)
  assert.match(commentRoutes, /resolvePackageEventMentionUserIds\(projectId, content\)/u)
  assert.match(commentRoutes, /enqueuePackageEventCommentAddedDelivery/u)
  assert.match(commentRoutes, /updateProjectPackageEventComment/u)
  assert.match(commentRoutes, /deleteProjectPackageEventComment/u)
})

test('delivery workbench offers a feedback drawer next to the delivered action', () => {
  assert.match(workbenchSource, /交付反馈/u)
  assert.match(workbenchSource, /ChatCircleDots/u)
  assert.match(workbenchSource, /setCommentsDrawerOpen\(true\)/u)
  assert.match(workbenchSource, /PackageEventCommentsDrawer/u)
  assert.match(workbenchSource, /slide-in-from-right/u)
  assert.match(workbenchSource, /MentionTextarea/u)
  assert.match(workbenchSource, /onAddEventComment\(eventId, content\)/u)
  assert.match(workbenchSource, /标记已交付/u)
  assert.match(workbenchSource, /发送反馈/u)
  assert.equal((workbenchSource.match(/menuPlacement="above"/g) ?? []).length, 2)
  const mentionSource = readFileSync(
    new URL('../src/components/mention-textarea.tsx', import.meta.url),
    'utf8',
  )
  assert.match(mentionSource, /menuPlacement\?: 'above' \| 'auto'/u)
  assert.match(mentionSource, /menuPlacement === 'above'/u)
  assert.match(mentionSource, /const mentionMenuMaxHeight = 220/u)
  assert.match(mentionSource, /Math\.min\(filteredMembers\.length \* 46 \+ 12, mentionMenuMaxHeight\)/u)
  assert.match(mentionSource, /maxHeight: mentionMenuMaxHeight/u)
  assert.match(mentionSource, /overflowY: 'auto'/u)
  assert.match(mentionSource, /closest<HTMLElement>\('\[data-slot="dialog-content"\]'\)/u)
  assert.match(mentionSource, /menuPortalHost === document\.body \? 'fixed' : 'absolute'/u)
  assert.doesNotMatch(mentionSource, /onMouseDownCapture/u)
  assert.match(mentionSource, /closest\('\.mention-menu-floating'\)/u)
  const appCssSource = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(
    appCssSource,
    /\.mention-menu-floating \{[\s\S]*?position: fixed;[\s\S]*?max-height: 220px;[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;[\s\S]*?scrollbar-color: transparent transparent;/u,
  )
  assert.match(appCssSource, /\.mention-menu-floating:hover[\s\S]*?scrollbar-color:/u)
  assert.match(appCssSource, /\.mention-menu-floating:hover::-webkit-scrollbar-thumb[\s\S]*?background:/u)
})
