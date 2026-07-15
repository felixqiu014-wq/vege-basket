import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOssEndpoint } from './package-market.ts'

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
