import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  filterOrganizationPackageMarketRules,
  organizationPackageMarketCategoryState,
  organizationPackageMarketPoliciesEqual,
  paginateOrganizationPackageMarketRules,
  toggleOrganizationPackageMarketCategory,
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
  const page = paginateOrganizationPackageMarketRules(['a', 'b', 'c'], 4, 2)
  assert.deepEqual(page, {
    items: ['c'],
    page: 2,
    pageSize: 2,
    totalItems: 3,
    totalPages: 2,
  })
  assert.equal(paginateOrganizationPackageMarketRules(['a'], 1, 0).pageSize, 12)
})

test('component channel settings use their own paged top-level component list', () => {
  assert.match(panelSource, /const \[componentPage, setComponentPage\] = useState\(1\)/u)
  assert.match(panelSource, /const \[componentPageSize, setComponentPageSize\] = useState<OrganizationPackageMarketPageSize>\(12\)/u)
  assert.match(
    panelSource,
    /paginateOrganizationPackageMarketRules\(\s*componentTableRules,\s*componentPage,\s*componentPageSize,?\s*\)/u,
  )
  assert.match(panelSource, /pagedComponentRules\.items\.map\(\(rule\)/u)
  assert.match(panelSource, /aria-label="组件上一页"/u)
  assert.match(panelSource, /aria-label="组件下一页"/u)
})

test('package market selection toggles one stable rule id at a time', () => {
  assert.deepEqual(toggleOrganizationPackageMarketRule([], 'terminal'), ['terminal'])
  assert.deepEqual(toggleOrganizationPackageMarketRule(['terminal', 'registry'], 'terminal'), ['registry'])
})

test('package market category toggles expand selected mode across the whole category', () => {
  assert.equal(
    organizationPackageMarketCategoryState(['terminal'], ['terminal', 'base-oss'], 'selected'),
    'mixed',
  )
  assert.deepEqual(
    toggleOrganizationPackageMarketCategory(['terminal', 'registry'], ['terminal', 'base-oss'], 'selected'),
    ['terminal', 'registry', 'base-oss'],
  )
  assert.deepEqual(
    toggleOrganizationPackageMarketCategory(['terminal', 'base-oss', 'registry'], ['terminal', 'base-oss'], 'selected'),
    ['registry'],
  )
})

test('package market category toggles invert excluded mode without touching other categories', () => {
  assert.equal(
    organizationPackageMarketCategoryState(['terminal'], ['terminal', 'base-oss'], 'excluded'),
    'mixed',
  )
  assert.deepEqual(
    toggleOrganizationPackageMarketCategory(['terminal', 'registry'], ['terminal', 'base-oss'], 'excluded'),
    ['registry'],
  )
  assert.deepEqual(
    toggleOrganizationPackageMarketCategory(['registry'], ['terminal', 'base-oss'], 'excluded'),
    ['registry', 'terminal', 'base-oss'],
  )
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
