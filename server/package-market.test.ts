import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatPackageMarketTimestamp,
  isAllowedPackageMarketObjectKey,
  listPackageMarketRules,
  matchesPackageMarketCiFileName,
  matchesPackageMarketReleaseFileName,
  normalizeOssEndpoint,
  normalizePackageMarketExpireMinutes,
  resolvePackageMarketAppRuleId,
} from './package-market.ts'

test('accepts custom package link validity in minutes within the bounded range', () => {
  const defaultMinutes = normalizePackageMarketExpireMinutes(undefined)
  assert.equal(normalizePackageMarketExpireMinutes(24 * 60), 24 * 60)
  assert.equal(normalizePackageMarketExpireMinutes(365 * 24 * 60), 365 * 24 * 60)
  assert.equal(normalizePackageMarketExpireMinutes(0), defaultMinutes)
  assert.equal(normalizePackageMarketExpireMinutes(365 * 24 * 60 + 1), defaultMinutes)
})

test('keeps base package ids while resolving their reads through apps rules', () => {
  assert.equal(resolvePackageMarketAppRuleId('base-pro'), 'sealos-pro')
  assert.equal(resolvePackageMarketAppRuleId('base-oss'), 'sealos-oss')
  assert.equal(resolvePackageMarketAppRuleId('offline-center'), '')
})

test('formats package market timestamps in Shanghai time', () => {
  assert.equal(
    formatPackageMarketTimestamp('2026-08-02T22:36:00.000Z'),
    '2026-08-03 06:36',
  )
})

test('uses configured release formats by default and exposes the fallback only on request', () => {
  const rule = { fileNameFormats: ['devbox-v2-cluster-%s-%s.tar'] }
  const legacyName = 'devbox-v1-cluster-v5.1.2-amd64.tar'
  assert.equal(matchesPackageMarketReleaseFileName(rule, legacyName, 'v5.1.2', 'amd64'), false)
  assert.equal(matchesPackageMarketReleaseFileName(rule, legacyName, 'v5.1.2', 'amd64', true), true)
  assert.equal(
    matchesPackageMarketReleaseFileName(rule, 'devbox-v2-cluster-v5.1.2-amd64.tar', 'v5.1.2', 'amd64'),
    true,
  )
})

test('uses configured CI formats by default and exposes the fallback only on request', () => {
  const rule = {
    ciFileNameFormats: ['devbox-v2-cluster-main-%s-%s.tar'],
    fileNameFormats: ['devbox-v2-cluster-%s-%s.tar'],
  }
  const legacyName = 'devbox-v1-cluster-main-882202f-amd64.tar'
  assert.equal(matchesPackageMarketCiFileName(rule, legacyName, '882202f', 'amd64'), false)
  assert.equal(matchesPackageMarketCiFileName(rule, legacyName, '882202f', 'amd64', true), true)
  assert.equal(
    matchesPackageMarketCiFileName(rule, 'devbox-v2-cluster-main-882202f-amd64.tar', '882202f', 'amd64'),
    true,
  )
})

test('upgrades legacy Alibaba OSS HTTP endpoints to HTTPS', () => {
  assert.equal(
    normalizeOssEndpoint('http://oss-cn-hangzhou.aliyuncs.com'),
    'https://oss-cn-hangzhou.aliyuncs.com',
  )
})

test('keeps HTTPS OSS endpoints unchanged', () => {
  assert.equal(
    normalizeOssEndpoint('https://oss-cn-hangzhou.aliyuncs.com'),
    'https://oss-cn-hangzhou.aliyuncs.com',
  )
})

test('rejects HTTP endpoints outside Alibaba OSS', () => {
  assert.throws(
    () => normalizeOssEndpoint('http://example.com'),
    /OSS_ENDPOINT must be an HTTPS origin/,
  )
})

test('allows package cache-cluster attachments under matching app release roots', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-desktop-cache-cluster-v5.1.2-alpha4.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-vscode-cache-cluster-v5.1.2-alpha4.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/kite/releases/v5.1.2-alpha4/kite-vscode-cache-cluster-v5.1.2-alpha4.tar.gz',
    ),
    true,
  )
})

test('allows cache-cluster attachments under matching app CI roots', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-desktop-cache-cluster-main-882f04e.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-vscode-cache-cluster-main-882f04e.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-vscode-plugins-cache-cluster-main-882f04e.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/kite/ci/main/882f04e/kite-vscode-cache-cluster-main-882f04e.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-vscode-plugins-cache-cluster-latest-882f04e.tar.gz',
    ),
    true,
  )
})

test('allows offline-center release package objects from bundled rules', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-cluster-v5.1.2-alpha4-amd64.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-v5.1.2-alpha4-amd64.tar.gz',
    ),
    false,
  )
})

test('allows configured package objects under dynamically named CI branches', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/admin/ci/v2/a6e0651/admin-v2-cluster-latest-a6e0651-amd64.tar',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/admin/ci/feature/nested/a6e0651/admin-v2-cluster-latest-a6e0651-amd64.tar',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/admin/ci/v2/a6e0651/unconfigured-a6e0651-amd64.tar',
    ),
    false,
  )
})

test('returns bundled package market rules without OSS credentials', async () => {
  const keys = ['OSS_ENDPOINT', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    const rules = await listPackageMarketRules()
    assert.ok(rules.some((rule) => rule.id === 'offline-center'))
    assert.ok(rules.some((rule) => rule.id === 'state-metrics'))
    assert.equal(rules.some((rule) => rule.id === 'devbox-cache'), false)
    assert.equal(rules.find((rule) => rule.id === 'sealos-pro')?.category, 'apps')
    assert.equal(rules.find((rule) => rule.id === 'sealos-pro')?.fileNameFormats.includes('sealos-pro-%s-%s.tar'), true)
    assert.equal(rules.find((rule) => rule.id === 'sealos-oss')?.category, 'apps')
  } finally {
    for (const key of keys) {
      if (previous[key] == null) {
        delete process.env[key]
      } else {
        process.env[key] = previous[key]
      }
    }
  }
})

test('allows sealos base packages through the APPS release rules', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/pro/release/v5.1.2/sealos-pro-v5.1.2-amd64.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/oss/release/v5.1.2/sealos-oss-v5.1.2-arm64.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/pro/release/v5.1.2/unconfigured-package-v5.1.2-amd64.tar.gz',
    ),
    false,
  )
})

test('allows sealos base packages through standard APPS CI rules', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/pro/ci/main/882f04e/sealos-pro-main-882f04e-amd64.tar.gz',
    ),
    true,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/oss/ci/main/882f04e/sealos-oss-main-882f04e-amd64.tar.gz',
    ),
    true,
  )
})

test('rejects cache-cluster attachments with mismatched app names or versions', () => {
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/kite-vscode-cache-cluster-v5.1.2-alpha4.tar.gz',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-vscode-cache-cluster-v5.1.1.tar.gz',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/release/v5.1.2-alpha4/offline-center-vscode-cache-v5.1.2-alpha4.tar.gz',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/kite-vscode-cache-cluster-main-882f04e.tar.gz',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-vscode-plugins-cache-cluster-main-1234567.tar.gz',
    ),
    false,
  )
  assert.equal(
    isAllowedPackageMarketObjectKey(
      'offline/sealos-apps/offline-center/ci/main/882f04e/offline-center-vscode-plugins-cache-cluster-feature-882f04e.tar.gz',
    ),
    false,
  )
})
