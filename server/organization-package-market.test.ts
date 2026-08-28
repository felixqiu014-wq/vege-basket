import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isPackageMarketObjectKeyAllowedForRule, type PackageMarketRule } from './package-market.ts'
import {
  normalizePackageMarketPolicyInput,
  validatePackageMarketPolicyInput,
} from './organization-package-market.ts'
import {
  canonicalPackageMarketRuleId,
  defaultOrganizationPackageMarketPolicy,
  filterPackageMarketRules,
  isPackageMarketRuleVisible,
  mergeOrganizationPackageMarketPolicy,
  normalizeOrganizationPackageMarketRuleIds,
  organizationPackageMarketPolicyHasVisibleChannel,
  packageMarketDependencyChannel,
  packageMarketRuleSupportsChannel,
  type OrganizationPackageMarketPolicy,
} from '../shared/organization-package-market.ts'
import { schemaSql } from './schema.ts'

const organizationPackageMarketMigrationSql = readFileSync(
  new URL('./migrations/20260828_organization_package_market_policy.sql', import.meta.url),
  'utf8',
)

const organizationPackageMarketExcludedModeMigrationSql = readFileSync(
  new URL('./migrations/20260828_organization_package_market_policy_excluded_mode.sql', import.meta.url),
  'utf8',
)

const organizationPackageMarketSharedSelectionMigrationSql = readFileSync(
  new URL('./migrations/20260828_organization_package_market_policy_shared_selection.sql', import.meta.url),
  'utf8',
)

const rules = [
  { id: 'sealos-pro', category: 'apps' as const, parent: '' },
  { id: 'sealos-oss', category: 'apps' as const, parent: '' },
  { id: 'offline-center', category: 'apps' as const, parent: '' },
  { id: 'devbox-runtime', category: 'dependency' as const, parent: 'devbox' },
  { id: 'devbox', category: 'apps' as const, parent: '' },
]

function policy(overrides: Partial<OrganizationPackageMarketPolicy> = {}): OrganizationPackageMarketPolicy {
  return {
    ...defaultOrganizationPackageMarketPolicy,
    ...overrides,
    channels: {
      ...defaultOrganizationPackageMarketPolicy.channels,
      ...overrides.channels,
    },
  }
}

function packageMarketPolicyRule(id: string): PackageMarketRule {
  return {
    id,
    name: id,
    category: 'apps',
    mode: 'release',
    releaseRoots: [],
    flatFileRoots: [],
    dependencyRoots: [],
    dependencyFilePatterns: [],
    fileNameFormats: [],
    ciFileNameFormats: [],
    flatFileNamePrefix: '',
    flatFileNameSuffix: '',
    flatFileNameSuffixes: [],
    parent: '',
  }
}

test('canonicalizes base package rule ids for organization selections', () => {
  assert.equal(canonicalPackageMarketRuleId('sealos-pro'), 'base-pro')
  assert.equal(canonicalPackageMarketRuleId('sealos-oss'), 'base-oss')
  assert.deepEqual(normalizeOrganizationPackageMarketRuleIds(['sealos-pro', 'base-pro', 'devbox']), [
    'base-pro',
    'devbox',
  ])
})

test('one selected range controls every enabled channel', () => {
  const next = policy({
    selection: { mode: 'selected', ruleIds: ['devbox'] },
  })
  assert.deepEqual(
    filterPackageMarketRules(rules, next, 'release').map((rule) => rule.id),
    ['devbox-runtime', 'devbox'],
  )
  assert.deepEqual(
    filterPackageMarketRules(rules, next, 'ci').map((rule) => rule.id),
    ['devbox'],
  )
  assert.equal(isPackageMarketRuleVisible(rules[0], next, 'release'), false)
})

test('one excluded range hides named packages from every enabled channel', () => {
  const next = policy({
    selection: { mode: 'excluded', ruleIds: ['sealos-pro'] },
  })
  assert.deepEqual(
    filterPackageMarketRules(rules, next, 'release').map((rule) => rule.id),
    ['sealos-oss', 'offline-center', 'devbox-runtime', 'devbox'],
  )
  assert.equal(isPackageMarketRuleVisible(rules[0], next, 'release'), false)
  assert.equal(isPackageMarketRuleVisible(rules[0], next, 'ci'), false)
  assert.equal(isPackageMarketRuleVisible(rules[4], next, 'release'), true)
  assert.equal(organizationPackageMarketPolicyHasVisibleChannel(next), true)
  assert.equal(
    organizationPackageMarketPolicyHasVisibleChannel(next, { release: [], ci: [] }),
    false,
  )
})

test('release and CI switches remain independent from the shared range', () => {
  const next = policy({
    channels: {
      release: { enabled: true },
      ci: { enabled: false },
    },
    selection: { mode: 'selected', ruleIds: ['sealos-pro'] },
  })
  assert.equal(isPackageMarketRuleVisible(rules[0], next, 'release'), true)
  assert.equal(isPackageMarketRuleVisible(rules[0], next, 'ci'), false)
  assert.equal(isPackageMarketRuleVisible(rules[2], next, 'release'), false)
})

test('dependency visibility follows its own channel and the parent selection', () => {
  const ciDependency = { ...rules[3], dependencyRoots: ['offline/ci/'] }
  assert.equal(packageMarketDependencyChannel(ciDependency), 'ci')
  const releaseOnly = policy({
    channels: {
      release: { enabled: true },
      ci: { enabled: false },
    },
    selection: { mode: 'selected', ruleIds: ['devbox'] },
  })
  assert.equal(isPackageMarketRuleVisible(ciDependency, releaseOnly, 'release'), false)
  assert.equal(isPackageMarketRuleVisible(ciDependency, releaseOnly, 'ci'), false)
  const ciSelected = policy({
    channels: {
      release: { enabled: true },
      ci: { enabled: true },
    },
    selection: { mode: 'selected', ruleIds: ['devbox'] },
  })
  assert.equal(isPackageMarketRuleVisible(ciDependency, ciSelected, 'ci'), true)
})

test('an empty selected policy has no visible channel', () => {
  const next = policy({
    channels: {
      release: { enabled: true },
      ci: { enabled: false },
    },
    selection: { mode: 'selected', ruleIds: [] },
  })
  assert.equal(organizationPackageMarketPolicyHasVisibleChannel(next), false)
})

test('base OSS does not advertise a CI channel', () => {
  assert.equal(packageMarketRuleSupportsChannel('base-oss', 'release'), true)
  assert.equal(packageMarketRuleSupportsChannel('base-oss', 'ci'), false)
})

test('rule selection input is bounded and rejects unsafe identifiers', () => {
  assert.equal(normalizeOrganizationPackageMarketRuleIds('devbox'), null)
  assert.equal(normalizeOrganizationPackageMarketRuleIds(['bad/id']), null)
  assert.equal(normalizeOrganizationPackageMarketRuleIds(Array.from({ length: 501 }, () => 'devbox')), null)
})

test('organization package-market schema keeps channel switches and shared visibility separate', () => {
  assert.match(schemaSql, /create table if not exists organization_feature_settings/u)
  assert.match(schemaSql, /create table if not exists organization_package_market_channel_policies/u)
  assert.match(schemaSql, /create table if not exists organization_package_market_selections/u)
  assert.match(schemaSql, /create table if not exists organization_package_market_selection_policies/u)
  assert.match(schemaSql, /create table if not exists organization_package_market_selection_rules/u)
  assert.match(schemaSql, /channel in \('release', 'ci'\)/u)
  assert.match(schemaSql, /mode in \('all', 'selected', 'excluded'\)/u)
})

test('organization package-market baseline migration remains an immutable table and index definition', () => {
  assert.match(organizationPackageMarketMigrationSql, /^begin;$/mu)
  assert.match(organizationPackageMarketMigrationSql, /^commit;$/mu)
  const tableNames = [
    'organization_feature_settings',
    'organization_package_market_selections',
  ]
  for (const tableName of tableNames) {
    const pattern = new RegExp(
      `create table if not exists ${tableName} \\([\\s\\S]*?\\n\\);`,
      'u',
    )
    const schemaStatement = schemaSql.match(pattern)?.[0]
    const migrationStatement = organizationPackageMarketMigrationSql.match(pattern)?.[0]
    assert.ok(schemaStatement, `schemaSql is missing the ${tableName} definition`)
    assert.ok(migrationStatement, `migration is missing the ${tableName} definition`)
    assert.equal(
      migrationStatement?.replace(/\s+/gu, ' ').trim().toLowerCase(),
      schemaStatement?.replace(/\s+/gu, ' ').trim().toLowerCase(),
    )
  }
  const indexPattern =
    /create index if not exists idx_organization_package_market_selections_lookup[\s\S]*?\);/u
  const schemaIndex = schemaSql.match(indexPattern)?.[0]
  const migrationIndex = organizationPackageMarketMigrationSql.match(indexPattern)?.[0]
  assert.ok(schemaIndex, 'schemaSql is missing the package-market selection index')
  assert.ok(migrationIndex, 'migration is missing the package-market selection index')
  assert.equal(
    migrationIndex?.replace(/\s+/gu, ' ').trim().toLowerCase(),
    schemaIndex?.replace(/\s+/gu, ' ').trim().toLowerCase(),
  )
  assert.match(organizationPackageMarketMigrationSql, /channel in \('release', 'ci'\)/u)
  assert.match(organizationPackageMarketMigrationSql, /mode in \('all', 'selected'\)/u)
  assert.match(organizationPackageMarketMigrationSql, /jsonb_typeof\(config\) = 'object'/u)
})

test('organization package-market excluded-mode migration evolves the existing check constraint', () => {
  assert.match(organizationPackageMarketExcludedModeMigrationSql, /^begin;$/mu)
  assert.match(organizationPackageMarketExcludedModeMigrationSql, /^commit;$/mu)
  assert.match(
    organizationPackageMarketExcludedModeMigrationSql,
    /drop constraint if exists organization_package_market_channel_policies_mode_check/u,
  )
  assert.match(
    organizationPackageMarketExcludedModeMigrationSql,
    /add constraint organization_package_market_channel_policies_mode_check[\s\S]*mode in \('all', 'selected', 'excluded'\)/u,
  )
})

test('organization package-market shared-selection migration creates and backfills the canonical range', () => {
  assert.match(organizationPackageMarketSharedSelectionMigrationSql, /^begin;$/mu)
  assert.match(organizationPackageMarketSharedSelectionMigrationSql, /^commit;$/mu)
  assert.match(
    organizationPackageMarketSharedSelectionMigrationSql,
    /create table if not exists organization_package_market_selection_policies/u,
  )
  assert.match(
    organizationPackageMarketSharedSelectionMigrationSql,
    /create table if not exists organization_package_market_selection_rules/u,
  )
  assert.match(
    organizationPackageMarketSharedSelectionMigrationSql,
    /insert into organization_package_market_selection_policies/u,
  )
  assert.match(
    organizationPackageMarketSharedSelectionMigrationSql,
    /insert into organization_package_market_selection_rules/u,
  )
  assert.match(
    organizationPackageMarketSharedSelectionMigrationSql,
    /never makes a package newly visible/u,
  )
})

test('missing policy fields resolve to enabled all-channel defaults', () => {
  const merged = mergeOrganizationPackageMarketPolicy({
    channels: { release: { enabled: false } },
  })
  assert.equal(merged.enabled, true)
  assert.equal(merged.channels.release.enabled, false)
  assert.equal(merged.channels.ci.enabled, true)
  assert.equal(merged.selection.mode, 'all')
})

test('shared excluded mode rejects settings that leave an enabled channel with no package', () => {
  const input = normalizePackageMarketPolicyInput({
    featureEnabled: true,
    revision: 0,
    channels: {
      release: { enabled: true },
      ci: { enabled: false },
    },
    selection: { mode: 'excluded', ruleIds: ['base-pro', 'devbox'] },
  })
  assert.throws(
    () => validatePackageMarketPolicyInput(input, [
      packageMarketPolicyRule('base-pro'),
      packageMarketPolicyRule('devbox'),
    ]),
    /没有可用安装包/u,
  )
})

test('shared selection rejects a Release-only package when only CI is enabled', () => {
  const input = normalizePackageMarketPolicyInput({
    featureEnabled: true,
    revision: 0,
    channels: {
      release: { enabled: false },
      ci: { enabled: true },
    },
    selection: { mode: 'selected', ruleIds: ['base-oss'] },
  })
  assert.throws(
    () => validatePackageMarketPolicyInput(input, [packageMarketPolicyRule('base-oss')]),
    /没有可用安装包/u,
  )
})

test('package item object keys stay bound to the claimed package rule and channel', () => {
  const allowedRule: PackageMarketRule = {
    id: 'allowed',
    name: 'allowed',
    category: 'apps',
    mode: 'release',
    releaseRoots: ['offline/sealos-apps/allowed/release/'],
    flatFileRoots: [],
    dependencyRoots: [],
    dependencyFilePatterns: [],
    fileNameFormats: ['allowed-cluster-%s-%s.tar.gz'],
    ciFileNameFormats: ['allowed-cluster-main-%s-%s.tar.gz'],
    flatFileNamePrefix: '',
    flatFileNameSuffix: '',
    flatFileNameSuffixes: [],
    parent: '',
  }
  const hiddenRule: PackageMarketRule = {
    ...allowedRule,
    id: 'hidden',
    name: 'hidden',
    releaseRoots: ['offline/sealos-apps/hidden/release/'],
    fileNameFormats: ['hidden-cluster-%s-%s.tar.gz'],
  }
  const rules = [allowedRule, hiddenRule]
  assert.equal(
    isPackageMarketObjectKeyAllowedForRule({
      channel: 'release',
      objectKey: 'offline/sealos-apps/allowed/release/v5.1.2/allowed-cluster-v5.1.2-amd64.tar.gz',
      packageId: 'allowed',
      rules,
    }),
    true,
  )
  assert.equal(
    isPackageMarketObjectKeyAllowedForRule({
      channel: 'release',
      objectKey: 'offline/sealos-apps/hidden/release/v5.1.2/hidden-cluster-v5.1.2-amd64.tar.gz',
      packageId: 'allowed',
      rules,
    }),
    false,
  )
  assert.equal(
    isPackageMarketObjectKeyAllowedForRule({
      channel: 'ci',
      objectKey: 'offline/sealos-apps/allowed/ci/main/882f04e/allowed-cluster-main-882f04e-amd64.tar.gz',
      packageId: 'allowed',
      rules,
    }),
    true,
  )
  assert.equal(
    isPackageMarketObjectKeyAllowedForRule({
      channel: 'release',
      objectKey: 'offline/sealos-apps/allowed/ci/main/882f04e/allowed-cluster-main-882f04e-amd64.tar.gz',
      packageId: 'allowed',
      rules,
    }),
    false,
  )
})
