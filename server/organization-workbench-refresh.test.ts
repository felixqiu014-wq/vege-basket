import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workbenchSource = readFileSync(
  new URL('../src/components/organization-workbench.tsx', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const packageWorkbenchSource = readFileSync(
  new URL('../src/components/project-package-workbench.tsx', import.meta.url),
  'utf8',
)

test('organization weekly collection does not reload from whole detail object refreshes', () => {
  assert.match(workbenchSource, /const weeklyOrganizationId = detail\?\.id \?\? 0/u)
  assert.match(workbenchSource, /const canManageWeeklyReports = detail\?\.canManageWeeklyReports \?\? false/u)
  assert.match(workbenchSource, /fetchWeeklyReportCollection\(weeklyOrganizationId, weekStart\)/u)
  assert.match(workbenchSource, /\}, \[canManageWeeklyReports, weekStart, weeklyOrganizationId\]\)/u)
  assert.match(workbenchSource, /weeklyCollectionLoading && !weeklyCollection/u)
  assert.doesNotMatch(workbenchSource, /weeklyCollectionLoading \? <EmptyRow/u)
})

test('organization detail loading cannot render the empty organization state early', () => {
  assert.match(workbenchSource, /const \[detailLoading, setDetailLoading\] = useState\(false\)/u)
  assert.match(workbenchSource, /setDetailLoading\(nextId !== 0\)/u)
  assert.match(workbenchSource, /if \(!detail && \(loading \|\| detailLoading\)\)/u)
})

test('global package market uses the selected sidebar organization as its only context', () => {
  assert.match(appSource, /const activePackageMarketOrganization = selectedOrganizationId == null/u)
  assert.match(
    appSource,
    /organization\.id === selectedOrganizationId && organization\.packageMarketEnabled/u,
  )
  assert.match(appSource, /const packageMarketVisible = activePackageMarketOrganization !== null/u)
  assert.match(appSource, /view === 'package_market' && !packageMarketVisible/u)
  assert.match(
    appSource,
    /\}, \[authUserId, loggedIn, organizationRefreshVersion, workspaceRefreshVersion\]\)/u,
  )
  assert.match(
    appSource,
    /<PackageMarketBrowser[\s\S]*?organizationId=\{activePackageMarketOrganization\.id\}/u,
  )
  assert.doesNotMatch(appSource, /packageMarketOrganizations/u)
  assert.doesNotMatch(appSource, /loadPackageMarketOrganizations/u)

  assert.match(packageWorkbenchSource, /organizationId: number/u)
  assert.match(
    packageWorkbenchSource,
    /loadMarketRulesRef\.current\(\{ organizationId: contextOrganizationId \}\)/u,
  )
  assert.match(packageWorkbenchSource, /const requestContext: PackageMarketRequestContext = \{ organizationId \}/u)
  assert.match(packageWorkbenchSource, /void loadMarketContext\(organizationId, requestId\)/u)
  assert.match(packageWorkbenchSource, /contextOrganizationId !== currentOrganizationIdRef\.current/u)
  assert.doesNotMatch(packageWorkbenchSource, /组织上下文/u)
  assert.doesNotMatch(packageWorkbenchSource, /marketOrganizationId/u)
  assert.doesNotMatch(packageWorkbenchSource, /onLoadPackageMarketOrganizations/u)
})

test('organization weekly reports use the previous week until its deadline', () => {
  assert.match(workbenchSource, /getWeeklyReportTargetWeekStart\(\{ now, rules, weekStartsOn \}\)/u)
  assert.match(workbenchSource, /const weekStart = reportWeekStart\(/u)
})
