import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canDeleteTestCase,
  canDeleteTestBug,
  canDeleteTestSubject,
  canEditTestBug,
  canEditTestSpaceVersion,
  canEditTestSubject,
  canDeveloperRejectBug,
  canDeveloperSetBugStatus,
  canManageTestPlan,
  canRemoveTestPlanCase,
  isBugStatus,
  isBugSeverity,
  isTestResult,
  isTestSpaceMembershipStatus,
  normalizeTestSpaceInviteExpiresInMinutes,
  parseOptionalTestSpaceOrganizationId,
} from './test-workbench-policy.ts'

const schemaSource = readFileSync(new URL('./schema.ts', import.meta.url), 'utf8')
const testWorkbenchClientSource = readFileSync(new URL('../src/components/test-workbench.tsx', import.meta.url), 'utf8')
const testWorkbenchApiSource = readFileSync(new URL('../src/test-workbench-api.ts', import.meta.url), 'utf8')
const testWorkbenchSource = readFileSync(new URL('./test-workbench.ts', import.meta.url), 'utf8')

test('test spaces persist and expose an optional version label', () => {
  assert.match(schemaSource, /add column if not exists version_label text/u)
  assert.match(testWorkbenchSource, /select s\.id, s\.owner_user_id, s\.name, s\.version_label/u)
  assert.match(testWorkbenchSource, /select ts\.id, ts\.owner_user_id, ts\.name, ts\.version_label/u)
  assert.match(testWorkbenchSource, /insert into test_spaces \(owner_user_id, name, version_label, organization_id\)/u)
  assert.match(testWorkbenchSource, /set name = \$1, version_label = \$2, organization_id = \$3/u)
  assert.match(testWorkbenchSource, /versionLabel: row\.version_label \? decryptText\(row\.version_label\) : undefined/u)
  assert.match(testWorkbenchClientSource, /createTestSpace\(normalizedName, versionLabel\.trim\(\)/u)
  assert.match(testWorkbenchClientSource, /TestSpaceSelectLabel/u)
  assert.match(testWorkbenchClientSource, /<span>版本号<\/span><strong>\{selectedSpace\.versionLabel \|\| '未指定'\}<\/strong>/u)
})

test('test-space member settings do not show unrelated departed accounts', () => {
  assert.doesNotMatch(testWorkbenchSource, /getDepartedUsers/u)
  assert.doesNotMatch(testWorkbenchClientSource, /departedUsers.*TestSpaceSettingsDialog/u)
  assert.match(testWorkbenchClientSource, /<span>成员与邀请<\/span>/u)
  assert.match(testWorkbenchClientSource, /selectedSpace\.members\.length/u)
})

test('Bug scope stays within the current space while its subject is returned as detail metadata', () => {
  assert.match(testWorkbenchSource, /join test_subjects subject on subject\.id = b\.test_subject_id/u)
  assert.match(testWorkbenchSource, /subject\.name as test_subject_name/u)
  assert.match(testWorkbenchSource, /testSubjectName: decryptText\(row\.test_subject_name\)/u)
  assert.match(testWorkbenchClientSource, /const bugs = data\.bugs\.filter\(\s*\(bug\) => bug\.testSpaceId === spaceId,/u)
  assert.doesNotMatch(testWorkbenchClientSource, /const bugs = data\.bugs\.filter\(\s*\(bug\) => bug\.testSpaceId === spaceId && \(!subjectId/u)
  assert.match(testWorkbenchClientSource, /activeSpace && tab === 'cases' \?/u)
  assert.match(testWorkbenchClientSource, /tab === 'cases' && !activeSubject \?/u)
  assert.match(testWorkbenchClientSource, /test-bug-detail-meta/u)
  assert.match(testWorkbenchClientSource, /测试对象\s*<strong>\{bug\.testSubjectName/u)
  assert.match(testWorkbenchClientSource, /<Label>\s*测试对象[\s\S]*subjects\.map/u)
})

test('assigned Bug details include their test subject and space version label', () => {
  assert.match(testWorkbenchSource, /space\.version_label as test_space_version_label/u)
  assert.match(testWorkbenchSource, /testSpaceVersionLabel: row\.test_space_version_label\s*\? decryptText\(row\.test_space_version_label\)\s*:\s*undefined/u)
  assert.match(testWorkbenchClientSource, /selected\.testSubjectName/u)
  assert.match(testWorkbenchClientSource, /selected\.testSpaceVersionLabel \|\| '未指定'/u)
  assert.match(testWorkbenchClientSource, /<small>版本号 \{bug\.testSpaceVersionLabel \|\| '未指定'\}/u)
  assert.match(testWorkbenchClientSource, /label: `\$\{bug\.testSpaceName\}\$\{bug\.testSpaceVersionLabel \? ` · \$\{bug\.testSpaceVersionLabel\}` : ''\}`/u)
})

test('assigned Bugs use the selected organization for reads, mutations, and local space selection', () => {
  assert.match(testWorkbenchSource, /requireAssignedBugOrganizationContext/u)
  assert.match(testWorkbenchSource, /space\.organization_id is not distinct from \$2::bigint/u)
  assert.match(testWorkbenchSource, /space\.organization_id is not distinct from \$3::bigint/u)
  assert.match(testWorkbenchSource, /space\.organization_id is not distinct from \$4::bigint/u)
  assert.match(testWorkbenchSource, /getAssignedBugs\(session\.userId, organizationId\)/u)
  assert.match(testWorkbenchApiSource, /function withOrganizationContext/u)
  assert.match(testWorkbenchApiSource, /serializeOrganizationContext\(organizationId\)/u)
  assert.match(testWorkbenchApiSource, /fetchAssignedTestBugs\(organizationId: OrganizationContext\)/u)
  assert.match(testWorkbenchClientSource, /fetchAssignedTestBugs\(organizationId\)/u)
  assert.match(testWorkbenchClientSource, /getAssignedBugSpaceStorageKey\(currentUserId, organizationId\)/u)
})

test('developer bug transitions stop at pending verification', () => {
  assert.equal(canDeveloperSetBugStatus('assigned', 'in_progress'), true)
  assert.equal(canDeveloperSetBugStatus('pending_confirmation', 'in_progress'), true)
  assert.equal(canDeveloperSetBugStatus('in_progress', 'pending_verification'), true)
  assert.equal(canDeveloperSetBugStatus('pending_verification', 'closed'), false)
  assert.equal(canDeveloperSetBugStatus('new', 'rejected'), false)
  assert.equal(canDeveloperSetBugStatus('pending_confirmation', 'pending_verification'), false)
})

test('developer can reject only Bugs that are not yet being fixed', () => {
  assert.equal(canDeveloperRejectBug('pending_confirmation'), true)
  assert.equal(canDeveloperRejectBug('assigned'), true)
  assert.equal(canDeveloperRejectBug('in_progress'), false)
  assert.equal(canDeveloperRejectBug('pending_verification'), false)
  assert.equal(canDeveloperRejectBug('rejected'), false)
  assert.equal(canDeveloperRejectBug('closed'), false)
})

test('bug status and comment kind checks include pending confirmation and reject', () => {
  assert.match(schemaSource, /update test_bugs[\s\S]*where status in \('confirmed', 'reopened'\)/u)
  assert.match(schemaSource, /update test_bugs[\s\S]*where status = 'duplicate'/u)
  assert.match(schemaSource, /check \(status in \('new', 'pending_confirmation', 'assigned', 'in_progress', 'pending_verification', 'closed', 'rejected'\)\)/u)
  assert.match(schemaSource, /check \(kind in \('comment', 'transfer', 'reject'\)\)/u)
})

test('returning a Bug to pending confirmation keeps the status change notification', () => {
  assert.match(testWorkbenchSource, /(status|lockedStatus) === 'pending_verification'\s*\|\|\s*\((?:status|lockedStatus) === 'pending_confirmation'\s*&&\s*(?:currentBug|lockedBug)\.status\s*!==\s*'new'\)/u)
  assert.match(testWorkbenchSource, /b\.status not in \('closed', 'rejected'\)/u)
  assert.match(testWorkbenchSource, /!\[['"]closed['"], ['"]rejected['"]\]\.includes\(row\.status\)/u)
})

test('assigned Bugs start in pending confirmation and reject writes a system comment', () => {
  assert.match(testWorkbenchSource, /const status(?:: BugStatus)? = assigneeUserId \? 'pending_confirmation' : 'new'/u)
  assert.match(testWorkbenchSource, /status = 'pending_confirmation', updated_at = now\(\)/u)
  const rejectRouteStart = testWorkbenchSource.indexOf("router.post('/test-bugs/:bugId/assigned/reject'")
  assert.ok(rejectRouteStart >= 0)
  const rejectRoute = testWorkbenchSource.slice(rejectRouteStart)
  assert.match(rejectRoute, /canDeveloperRejectBug\(bug\.status\)/u)
  assert.match(rejectRoute, /status = 'rejected', updated_at = now\(\)/u)
  assert.match(rejectRoute, /values \(\$1, \$2, \$3, 'reject'\)/u)
  assert.match(rejectRoute, /onTestBugRejected\(/u)
  assert.match(rejectRoute, /for update of b/u)
})

test('developer workbench offers start and reject for pending confirmation Bugs', () => {
  assert.match(testWorkbenchClientSource, /pending_confirmation: '待确认'/u)
  assert.match(testWorkbenchClientSource, /selected\.status === 'pending_confirmation'/u)
  assert.match(testWorkbenchClientSource, /<DialogTitle>驳回 Bug<\/DialogTitle>/u)
  assert.match(testWorkbenchClientSource, /rejectAssignedTestBug\(organizationId, bug\.id, reason\)/u)
  assert.match(testWorkbenchClientSource, /驳回记录/u)
})

test('reopening a rejected or closed Bug is a dedicated button next to share that returns it to pending confirmation', () => {
  assert.match(testWorkbenchClientSource, /\(bug\.status === 'rejected' \|\| bug\.status === 'closed'\) \? <Button/u)
  assert.match(testWorkbenchClientSource, /onStatus\(bug, 'pending_confirmation'\)/u)
  assert.match(testWorkbenchClientSource, /<ArrowCounterClockwise \/> 重新打开/u)
  assert.doesNotMatch(testWorkbenchClientSource, /\[['"]reopened['"], '重新打开'\]/u)
  assert.doesNotMatch(testWorkbenchClientSource, /if \(status === 'reopened'\)/u)
  assert.doesNotMatch(testWorkbenchClientSource, /updateTestBug\(selected\.testSpaceId, selected\.id, \{ status: 'pending_confirmation' \}\)/u)
})

test('Bug timeline records creation, assignment, transfer and status changes without comments', () => {
  assert.match(schemaSource, /create table if not exists test_bug_events/u)
  assert.match(schemaSource, /transfer_source text/u)
  assert.match(schemaSource, /test_bug_events_transfer_source_check/u)
  assert.match(schemaSource, /event_type text not null\s+check \(event_type in \('created', 'assigned', 'transferred', 'status_changed', 'space_transferred'\)\)/u)
  assert.match(schemaSource, /create index if not exists idx_test_bug_events_bug/u)
  assert.match(schemaSource, /on test_bug_events\(test_bug_id, created_at, id\)/u)

  assert.match(testWorkbenchSource, /async function recordTestBugEvent\(/u)
  assert.match(testWorkbenchSource, /insert into test_bug_events/u)
  assert.match(testWorkbenchSource, /eventType: 'created'/u)
  assert.match(testWorkbenchSource, /eventType: 'assigned'/u)
  assert.match(testWorkbenchSource, /eventType: 'transferred'/u)
  assert.match(testWorkbenchSource, /transferSource: 'manual'/u)
  assert.match(testWorkbenchSource, /transferSource: row\.transfer_source \?\? undefined/u)
  assert.match(testWorkbenchSource, /eventType: 'status_changed'/u)
  assert.match(testWorkbenchSource, /eventType: 'space_transferred'/u)
  assert.match(testWorkbenchSource, /previous_test_space_id, next_test_space_id/u)
  assert.match(testWorkbenchSource, /events: eventsByBug\.get\(Number\(row\.id\)\) \?\? \[\]/u)
  assert.match(testWorkbenchSource, /reporter\.display_name as reporter_display_name/u)
  assert.match(testWorkbenchSource, /reporterName: row\.reporter_display_name \|\| row\.reporter_email \|\| undefined/u)
  assert.match(testWorkbenchSource, /assigneeName: row\.assignee_display_name \|\| row\.assignee_email \|\| undefined/u)
  assert.match(testWorkbenchClientSource, /assigneeTransferSource === 'offboarding' \? '（离职转移）' : null/u)
})

test('Bug detail header actions use icon-only buttons with accessible labels', () => {
  assert.match(testWorkbenchClientSource, /aria-label="转移空间"[\s\S]*?size="icon-sm"[\s\S]*?title="转移空间"[\s\S]*?<ArrowsLeftRight \/><\/Button>/u)
  assert.match(testWorkbenchClientSource, /aria-label="时间线"[\s\S]*?size="icon-sm"[\s\S]*?title="时间线"[\s\S]*?<Clock \/><\/Button>/u)
  assert.match(testWorkbenchClientSource, /aria-label="分享 Bug"[\s\S]*?size="icon-sm"[\s\S]*?title="分享 Bug"[\s\S]*?<LinkSimple \/><\/Button>/u)
  assert.match(testWorkbenchClientSource, /aria-label="编辑"[\s\S]*?size="icon-sm"[\s\S]*?title="编辑"[\s\S]*?<PencilSimple \/><\/Button>/u)
  assert.match(testWorkbenchClientSource, /function BugTimelineDialog/u)
  assert.match(testWorkbenchClientSource, /<DialogTitle>Bug 时间线<\/DialogTitle>/u)
  assert.match(testWorkbenchClientSource, /eventType === 'created' \? \(/u)
  assert.match(testWorkbenchClientSource, /创建了 Bug/u)
  assert.match(testWorkbenchClientSource, /指派给 <UserName/u)
  assert.match(testWorkbenchClientSource, /转移给 <UserName/u)
  assert.match(testWorkbenchClientSource, /状态从「\{event\.previousStatus \? bugStatusLabel\[event\.previousStatus\] : '未知'\}」改为「\{event\.nextStatus \? bugStatusLabel\[event\.nextStatus\] : '未知'\}」/u)
  assert.match(testWorkbenchClientSource, /hasCreatedEvent = bug\.events\.some\(\(event\) => event\.eventType === 'created'\)/u)
  assert.match(testWorkbenchClientSource, /isNamedTransferComment/u)
  assert.match(testWorkbenchClientSource, /comment\.kind === 'transfer' && \/转移给「\(\[\^」\]\+\)」\/u\.test\(comment\.content\)/u)
  assert.match(testWorkbenchClientSource, /eventType: comment\.kind === 'reject' \? 'rejected' as const : 'transferred' as const/u)
  assert.match(testWorkbenchClientSource, /转移给「\(\[\^」\]\+\)」/u)
  assert.match(testWorkbenchClientSource, /驳回了该 Bug/u)
  assert.match(testWorkbenchClientSource, /eventType === 'space_transferred'/u)
  assert.match(testWorkbenchClientSource, /previousSpaceName/u)
  assert.match(testWorkbenchClientSource, /nextSpaceName/u)
})

test('test-space data import supports copied cases and plans only', () => {
  assert.match(schemaSource, /create table if not exists test_space_data_imports/u)
  assert.match(schemaSource, /unique \(target_test_space_id, source_test_space_id, data_type, source_record_id\)/u)
  assert.match(testWorkbenchSource, /router\.post\('\/test-spaces\/:spaceId\/data-import'/u)
  assert.match(testWorkbenchSource, /requireSpaceOwner\(response, targetSpaceId, session\.userId\)/u)
  assert.match(testWorkbenchSource, /category === 'cases' \|\| category === 'plans'/u)
  assert.match(testWorkbenchClientSource, /复制到当前空间/u)
  assert.match(testWorkbenchClientSource, /全部用例/u)
  assert.match(testWorkbenchClientSource, /全部测试计划/u)
  assert.doesNotMatch(testWorkbenchClientSource, /全部复制到当前空间/u)
  assert.doesNotMatch(testWorkbenchClientSource, /转移到当前空间/u)
  assert.doesNotMatch(testWorkbenchClientSource, /movedBugs/u)
  assert.match(testWorkbenchClientSource, /<Checkbox/u)
  assert.match(testWorkbenchClientSource, /importTestSpaceData\(selectedSpace\.id, sources\)/u)
})

test('case workbench exports the current test-object cases and labels import as cases', () => {
  assert.match(testWorkbenchClientSource, /function downloadTestCaseCsv\(/u)
  assert.match(testWorkbenchClientSource, /onExport=\{\(\) => downloadTestCaseCsv\(cases, data\.folders\)\}/u)
  assert.match(testWorkbenchClientSource, /<DownloadSimple \/> 导出用例/u)
  assert.match(testWorkbenchClientSource, /<UploadSimple \/> 导入用例/u)
  assert.match(testWorkbenchClientSource, /testCaseCsvTemplateHeaders, \.\.\.rows/u)
})

test('Bug details offer owner-only single-space transfer with the existing transfer transaction', () => {
  assert.match(testWorkbenchSource, /router\.post\('\/test-spaces\/:spaceId\/bugs\/:bugId\/transfer-space'/u)
  assert.match(testWorkbenchSource, /bugIds: \[bugId\], categories: \['bugs'\], spaceId/u)
  assert.match(testWorkbenchSource, /canTransferSpace: ownedSpaces\.some/u)
  assert.match(testWorkbenchSource, /transferSpaceCandidates: ownedSpaces/u)
  assert.match(testWorkbenchClientSource, /bug\.canTransferSpace/u)
  assert.match(testWorkbenchClientSource, /<BugSpaceTransferDialog/u)
  assert.match(testWorkbenchClientSource, /<DialogTitle>转移 Bug 到其他空间<\/DialogTitle>/u)
  assert.match(testWorkbenchClientSource, /transferTestBugToSpace\(bug\.testSpaceId, bug\.id, targetSpaceId\)/u)
})

test('assigned Bug selection keeps the current item when parent callbacks refresh counts', () => {
  assert.match(testWorkbenchClientSource, /const onBugsChangeRef = useRef\(onBugsChange\)/u)
  assert.match(testWorkbenchClientSource, /onBugsChangeRef\.current\?\.\(result\.bugs\)/u)
  assert.match(testWorkbenchClientSource, /useEffect\(\(\) => \{\s+onBugsChangeRef\.current = onBugsChange\s+\}, \[onBugsChange\]\)/u)
  assert.doesNotMatch(testWorkbenchClientSource, /useEffect\(\(\) => \{\s+fetchAssignedTestBugs\(\)[\s\S]*\}, \[currentUserId, initialBugId, onBugsChange\]\)/u)
})

test('test result and bug status guards reject unknown values', () => {
  assert.equal(isTestResult('blocked'), true)
  assert.equal(isTestResult('success'), false)
  assert.equal(isBugStatus('pending_verification'), true)
  assert.equal(isBugStatus('confirmed'), false)
  assert.equal(isBugStatus('fixed'), false)
  assert.equal(isBugSeverity('major'), true)
  assert.equal(isBugSeverity('fixed'), false)
})

test('test workbench restores the last visited tab, space and selection after refresh', () => {
  assert.match(testWorkbenchClientSource, /testWorkbenchViewStatePrefix = 'veges\.testWorkbench\.viewState\.v1'/u)
  assert.match(testWorkbenchClientSource, /function readTestWorkbenchViewState/u)
  assert.match(testWorkbenchClientSource, /function writeTestWorkbenchViewState/u)
  assert.match(testWorkbenchClientSource, /const saved = readTestWorkbenchViewState\(currentUserId\)/u)
  assert.match(testWorkbenchClientSource, /setSpaceId\(savedSpaceId \?\? result\.spaces\[0\]\?\.id\)/u)
  assert.match(testWorkbenchClientSource, /setTab\(saved\?\.tab \?\? 'cases'\)/u)
  assert.match(testWorkbenchClientSource, /viewStateReadyRef\.current = true/u)
  assert.match(testWorkbenchClientSource, /if \(!viewStateReadyRef\.current\) return/u)
  assert.match(testWorkbenchClientSource, /writeTestWorkbenchViewState\(currentUserId, \{/u)
})

test('only the Bug creator can edit Bug details', () => {
  assert.equal(canEditTestBug(42, 42), true)
  assert.equal(canEditTestBug(42, 7), false)
  assert.equal(canEditTestBug(null, 7), false)
})

test('Bug deletion and test-space version editing stay creator/owner scoped', () => {
  assert.equal(canDeleteTestBug(42, 42), true)
  assert.equal(canDeleteTestBug(42, 7), false)
  assert.equal(canDeleteTestBug(null, 42), false)
  assert.equal(canEditTestSpaceVersion(7, null, 7), true)
  assert.equal(canEditTestSpaceVersion(7, 42, 42), true)
  assert.equal(canEditTestSpaceVersion(7, 42, 8), false)
  assert.equal(canEditTestSpaceVersion(null, 42, 42), true)
})

test('Bug deletion and version routes recheck direct membership and keep mutations scoped', () => {
  const versionStart = testWorkbenchSource.indexOf("router.patch('/test-spaces/:spaceId/version'")
  const spaceDeleteStart = testWorkbenchSource.indexOf("router.delete('/test-spaces/:spaceId'", versionStart)
  const bugDeleteStart = testWorkbenchSource.indexOf("router.delete('/test-spaces/:spaceId/bugs/:bugId'")
  const commentsStart = testWorkbenchSource.indexOf("router.post('/test-spaces/:spaceId/bugs/:bugId/comments'", bugDeleteStart)
  assert.ok(versionStart >= 0)
  assert.ok(spaceDeleteStart > versionStart)
  assert.ok(bugDeleteStart >= 0)
  assert.ok(commentsStart > bugDeleteStart)
  const versionRoute = testWorkbenchSource.slice(versionStart, spaceDeleteStart)
  const bugDeleteRoute = testWorkbenchSource.slice(bugDeleteStart, commentsStart)
  assert.match(versionRoute, /requireActiveRole\(request, response, 'tester'\)/u)
  assert.match(versionRoute, /getDirectSpaceAccess\(spaceId, session\.userId, client\)/u)
  assert.match(versionRoute, /from test_bugs[\s\S]*reporter_user_id = \$2[\s\S]*for share/u)
  assert.match(versionRoute, /canEditTestSpaceVersion/u)
  assert.match(versionRoute, /set version_label = \$1, updated_at = now\(\)/u)
  assert.match(bugDeleteRoute, /getDirectSpaceAccess\(spaceId, session\.userId, client\)/u)
  assert.match(bugDeleteRoute, /canDeleteTestBug/u)
  assert.match(bugDeleteRoute, /delete from notification_deliveries/u)
  assert.match(bugDeleteRoute, /delete from notification_states/u)
  assert.match(bugDeleteRoute, /delete from test_bugs where id = \$1 and test_space_id = \$2/u)
})

test('configured test environments are restricted to assigned spaces and preserve Bug snapshots', () => {
  assert.match(schemaSource, /create table if not exists test_environments/u)
  assert.match(schemaSource, /create table if not exists test_environment_spaces/u)
  assert.match(schemaSource, /test_environment_id bigint references test_environments\(id\)/u)
  assert.match(schemaSource, /foreign key \(test_environment_id, test_space_id\)\s+references test_environment_spaces/u)
  assert.match(testWorkbenchSource, /getAssignedTestEnvironment\(/u)
  assert.match(testWorkbenchSource, /Test environment is not configured for this test space/u)
  assert.match(testWorkbenchSource, /environmentSnapshot\(/u)
  assert.match(testWorkbenchClientSource, /environments\.map\(\(item\) => <SelectItem/u)
  assert.match(testWorkbenchClientSource, /手工填写环境/u)
})

test('only the test subject creator can edit or delete it', () => {
  assert.equal(canEditTestSubject(7, 7), true)
  assert.equal(canEditTestSubject(7, 8), false)
  assert.equal(canEditTestSubject(null, 7), false)
  assert.equal(canDeleteTestSubject(7, 7), true)
  assert.equal(canDeleteTestSubject(7, 8), false)
  assert.equal(canDeleteTestSubject(null, 7), false)
})

test('only the test case creator can delete it', () => {
  assert.equal(canDeleteTestCase(7, 7), true)
  assert.equal(canDeleteTestCase(7, 8), false)
  assert.equal(canDeleteTestCase(null, 7), false)
})

test('test case deletion stays creator-scoped and preserves plan snapshots', () => {
  const deleteRouteStart = testWorkbenchSource.indexOf("router.delete('/test-spaces/:spaceId/cases/:caseId'")
  const createPlanRouteStart = testWorkbenchSource.indexOf("router.post('/test-spaces/:spaceId/plans'", deleteRouteStart)

  assert.ok(deleteRouteStart >= 0)
  assert.ok(createPlanRouteStart > deleteRouteStart)

  const deleteRoute = testWorkbenchSource.slice(deleteRouteStart, createPlanRouteStart)
  assert.match(deleteRoute, /requireActiveRole\(request, response, 'tester'\)/u)
  assert.match(deleteRoute, /requireSpaceAccess\(response, spaceId, session\.userId, true\)/u)
  assert.match(deleteRoute, /canDeleteTestCase\(createdByUserId, session\.userId\)/u)
  assert.match(deleteRoute, /where id = \$1 and test_space_id = \$2 and created_by_user_id = \$3/u)
  assert.match(schemaSource, /test_case_id bigint references test_cases\(id\) on delete set null/u)
})

test('test case deletion is exposed only when allowed and requires confirmation', () => {
  assert.match(testWorkbenchClientSource, /selected\.canDelete/u)
  assert.match(testWorkbenchClientSource, /<DialogTitle>删除测试用例<\/DialogTitle>/u)
  assert.match(testWorkbenchClientSource, /已加入测试计划的执行快照继续保留/u)
  assert.match(testWorkbenchClientSource, /deleteTestCase\(casePendingDelete\.testSpaceId, casePendingDelete\.id\)/u)
  assert.match(testWorkbenchClientSource, /<Dialog open=\{caseDeleteDialogOpen\} onOpenChange=\{setCaseDeleteDialogOpen\}>/u)
  assert.match(testWorkbenchClientSource, /if \(caseDeleteDialogOpen \|\| !casePendingDelete\) return[\s\S]*setTimeout[\s\S]*setCasePendingDelete\(undefined\)/u)
  assert.doesNotMatch(testWorkbenchClientSource, /open=\{Boolean\(casePendingDelete\)\}/u)
  assert.match(testWorkbenchClientSource, /<Dialog open=\{planDeleteDialogOpen\} onOpenChange=\{setPlanDeleteDialogOpen\}>/u)
  assert.match(testWorkbenchClientSource, /if \(planDeleteDialogOpen \|\| !planPendingDelete\) return[\s\S]*setTimeout[\s\S]*setPlanPendingDelete\(undefined\)/u)
  assert.doesNotMatch(testWorkbenchClientSource, /open=\{Boolean\(planPendingDelete\)\}/u)
  assert.match(testWorkbenchClientSource, /<Button variant="outline" onClick=\{\(\) => onArchive\(selected\)\}>归档为基线<\/Button>/u)
})

test('test subject editing uses a dedicated patch route and updates all metadata fields', () => {
  const patchRouteStart = testWorkbenchSource.indexOf("router.patch('/test-spaces/:spaceId/subjects/:subjectId'")
  const deleteRouteStart = testWorkbenchSource.indexOf("router.delete('/test-spaces/:spaceId/subjects/:subjectId'")

  assert.ok(patchRouteStart >= 0)
  assert.ok(deleteRouteStart > patchRouteStart)

  const patchRoute = testWorkbenchSource.slice(patchRouteStart, deleteRouteStart)
  assert.match(patchRoute, /Only the test subject creator can edit it/u)
  assert.match(patchRoute, /set name = \$1,\s+name_lookup = \$2,\s+description = \$3,\s+version_label = \$4,\s+environment = \$5/u)
})

test('test space invitation policy accepts only supported states and expiries', () => {
  assert.equal(isTestSpaceMembershipStatus('pending'), true)
  assert.equal(isTestSpaceMembershipStatus('active'), true)
  assert.equal(isTestSpaceMembershipStatus('removed'), false)
  assert.equal(normalizeTestSpaceInviteExpiresInMinutes(60), 60)
  assert.equal(normalizeTestSpaceInviteExpiresInMinutes(15), 10)
  assert.equal(normalizeTestSpaceInviteExpiresInMinutes('1440'), 1440)
})

test('test space organization selection accepts an active id or no organization', () => {
  assert.deepEqual(parseOptionalTestSpaceOrganizationId(null), { valid: true, value: null })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId(''), { valid: true, value: null })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId('12'), { valid: true, value: 12 })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId(12), { valid: true, value: 12 })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId(0), { valid: false })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId(true), { valid: false })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId('1.5'), { valid: false })
  assert.deepEqual(parseOptionalTestSpaceOrganizationId('invalid'), { valid: false })
})

test('test space organization changes validate membership before updating', () => {
  const membershipLock = testWorkbenchSource.indexOf('lockActiveOrganizationMembership(client, nextOrganizationId')
  const memberValidation = testWorkbenchSource.indexOf('everyCurrentTestSpaceMemberBelongsToOrganization(client, spaceId, nextOrganizationId)')
  const update = testWorkbenchSource.indexOf('set name = $1, version_label = $2, organization_id = $3, updated_at = now()')

  assert.notEqual(membershipLock, -1)
  assert.notEqual(memberValidation, -1)
  assert.notEqual(update, -1)
  assert.ok(membershipLock < memberValidation)
  assert.ok(memberValidation < update)
  assert.match(testWorkbenchSource, /status in \('pending', 'active'\)[\s\S]*for share of membership/u)
  assert.match(testWorkbenchSource, /update test_space_invite_links set revoked_at = now\(\)/u)
  assert.match(testWorkbenchSource, /hasOwnProperty\.call\(request\.body \?\? \{\}, 'organizationId'\)/u)
})

test('organization test-space invite links can be created and require member access on acceptance', () => {
  const createRouteStart = testWorkbenchSource.indexOf("router.post('/test-spaces/:spaceId/invite-link'")
  const deleteRouteStart = testWorkbenchSource.indexOf("router.delete('/test-spaces/:spaceId/invite-link'")
  const acceptRouteStart = testWorkbenchSource.indexOf("router.post('/test-space-invite-links/:token/accept'")
  assert.ok(createRouteStart >= 0)
  assert.ok(deleteRouteStart > createRouteStart)
  assert.ok(acceptRouteStart > deleteRouteStart)

  const createRoute = testWorkbenchSource.slice(createRouteStart, deleteRouteStart)
  const acceptRoute = testWorkbenchSource.slice(acceptRouteStart)
  assert.doesNotMatch(createRoute, /Organization test spaces do not use public invite links/u)
  assert.match(acceptRoute, /lockActiveOrganizationMembership\(client, organizationId, session\.userId\)/u)
  assert.match(acceptRoute, /Organization test space invites require active organization membership/u)
})

test('only the plan creator can manage it and remove unexecuted cases', () => {
  assert.equal(canManageTestPlan(7, 7), true)
  assert.equal(canManageTestPlan(7, 8), false)
  assert.equal(canRemoveTestPlanCase(7, 7, 'untested'), true)
  assert.equal(canRemoveTestPlanCase(7, 7, 'passed'), false)
  assert.equal(canRemoveTestPlanCase(7, 8, 'untested'), false)
})
