import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedPackageMarketObjectKey,
  listPackageMarketRules,
  normalizeOssEndpoint,
} from './package-market.ts'

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
    true,
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
    assert.ok(rules.some((rule) => rule.id === 'offline-center-desktop-cache'))
    assert.ok(rules.some((rule) => rule.id === 'offline-center-vscode-cache'))
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
