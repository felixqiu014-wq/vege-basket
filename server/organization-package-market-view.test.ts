import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  filterOrganizationPackageMarketRules,
  organizationPackageMarketPageSizes,
  organizationPackageMarketPoliciesEqual,
  paginateOrganizationPackageMarketRules,
  toggleOrganizationPackageMarketRule,
} from '../src/organization-package-market-view.ts'
import type { OrganizationPackageMarketCatalogRule } from '../src/organization-types.ts'
import { defaultOrganizationPackageMarketPolicy } from '../shared/organization-package-market.ts'

const panelSource = readFileSync(
  new URL('../src/components/organization-package-market-panel.tsx', import.meta.url),
  'utf8',
)

const rules: OrganizationPackageMarketCatalogRule[] = [
  {
    canonicalId: 'terminal',
    category: 'apps',
    ciFileNameFormats: [],
    ciSupported: true,
    ciVisible: true,
    dependencyFilePatterns: [],
    dependencyRoots: [],
    fileNameFormats: [],
    roots: [],
    id: 'terminal',
    mode: 'release',
    name: 'Sealos Terminal',
    releaseVisible: true,
    selectable: true,
  },
  {
    canonicalId: 'registry',
    category: 'middleware',
    ciFileNameFormats: [],
    ciSupported: true,
    ciVisible: true,
    dependencyFilePatterns: [],
    dependencyRoots: [],
    fileNameFormats: [],
    roots: [],
    id: 'registry',
    mode: 'release',
    name: 'Sealos Registry',
    releaseVisible: true,
    selectable: true,
  },
  {
    canonicalId: 'base-oss',
    category: 'apps',
    ciFileNameFormats: [],
    ciSupported: false,
    ciVisible: false,
    dependencyFilePatterns: [],
    dependencyRoots: [],
    fileNameFormats: [],
    roots: [],
    id: 'sealos-oss',
    mode: 'release',
    name: 'Sealos OSS',
    releaseVisible: true,
    selectable: true,
  },
  {
    canonicalId: 'terminal-runtime',
    category: 'dependency',
    ciFileNameFormats: [],
    ciSupported: true,
    ciVisible: true,
    dependencyFilePatterns: [],
    dependencyRoots: ['offline/ci/'],
    fileNameFormats: [],
    roots: [],
    id: 'terminal-runtime',
    mode: 'release',
    name: 'Terminal Runtime',
    parent: 'terminal',
    releaseVisible: true,
    selectable: false,
  },
]

test('package market catalog filters one shared range by category, query, and selection', () => {
  assert.deepEqual(
    filterOrganizationPackageMarketRules(rules, {}).map((rule) => rule.canonicalId),
    ['terminal', 'registry', 'base-oss'],
  )
  assert.deepEqual(
    filterOrganizationPackageMarketRules(rules, {
      category: 'middleware',
      query: 'REGISTRY',
    }).map((rule) => rule.canonicalId),
    ['registry'],
  )
  assert.deepEqual(
    filterOrganizationPackageMarketRules(rules, {
      onlySelected: true,
      selectedIds: ['terminal'],
    }).map((rule) => rule.canonicalId),
    ['terminal'],
  )
})

test('package market pagination clamps the requested page and keeps a stable page size', () => {
  assert.deepEqual(organizationPackageMarketPageSizes, [5, 10, 15])
  const page = paginateOrganizationPackageMarketRules(['a', 'b', 'c'], 4, 2)
  assert.deepEqual(page, {
    items: ['c'],
    page: 2,
    pageSize: 2,
    totalItems: 3,
    totalPages: 2,
  })
  assert.equal(paginateOrganizationPackageMarketRules(['a'], 1, 0).pageSize, 5)
})

test('package market uses one component workbench for filtering, selection, and channels', () => {
  assert.match(
    panelSource,
    /const \[pageSize, setPageSize\] = useState<OrganizationPackageMarketPageSize>\(organizationPackageMarketPageSizes\[0\]\)/u,
  )
  assert.match(
    panelSource,
    /paginateOrganizationPackageMarketRules\(componentTableRules, page, pageSize\)/u,
  )
  assert.match(panelSource, /pagedComponentRules\.items\.map\(\(rule\)/u)
  assert.match(panelSource, /成员范围/u)
  assert.match(panelSource, /加入当前范围/u)
  assert.doesNotMatch(panelSource, /按类别快速设置/u)
  assert.doesNotMatch(panelSource, /organization-package-market-rule-list/u)
})

test('package market selection toggles one stable rule id at a time', () => {
  assert.deepEqual(toggleOrganizationPackageMarketRule([], 'terminal'), ['terminal'])
  assert.deepEqual(toggleOrganizationPackageMarketRule(['terminal', 'registry'], 'terminal'), ['registry'])
})

test('package market policy equality ignores selection ordering', () => {
  const left = {
    ...defaultOrganizationPackageMarketPolicy,
    selection: { mode: 'selected' as const, ruleIds: ['registry', 'terminal'] },
  }
  const right = {
    ...left,
    selection: { ...left.selection, ruleIds: ['terminal', 'registry'] },
  }
  assert.equal(organizationPackageMarketPoliciesEqual(left, right), true)
})

test('package market policy equality compares dependency and component channel overrides', () => {
  const left = {
    ...defaultOrganizationPackageMarketPolicy,
    ruleOverrides: [{ channel: 'release' as const, enabled: false, ruleId: 'devbox' }],
  }
  const changedDependencySetting = { ...left, showDependencies: false }
  const changedOverride = {
    ...left,
    ruleOverrides: [{ channel: 'release' as const, enabled: true, ruleId: 'devbox' }],
  }
  assert.equal(organizationPackageMarketPoliciesEqual(left, changedDependencySetting), false)
  assert.equal(organizationPackageMarketPoliciesEqual(left, changedOverride), false)
})
