// 验证镜像同步输入边界和 GitHub Run/Job DTO 的有界归一化。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildImageSyncArtifactUris,
  buildImageSyncTarObjectKey,
  classifyImageSyncRun,
  getImageSyncDownloadExpireSeconds,
  ImageSyncWorkflowError,
  isImageSyncRunTerminal,
  mapGitHubRunStatus,
  normalizeGitHubJobs,
  normalizeImageSyncInput,
} from './image-sync-workflows.ts'

test('normalizes supported image references and architectures', () => {
  assert.deepEqual(
    normalizeImageSyncInput({ arch: 'AMD64', image: 'docker.io/library/nginx:1.27' }),
    { arch: 'amd64', image: 'docker.io/library/nginx:1.27' },
  )
  assert.deepEqual(
    normalizeImageSyncInput({ arch: 'arm64', image: 'docker://ghcr.io/labring/example@sha256:abc123' }),
    { arch: 'arm64', image: 'docker://ghcr.io/labring/example@sha256:abc123' },
  )
})

test('rejects unsupported architectures and unsafe image input', () => {
  assert.throws(
    () => normalizeImageSyncInput({ arch: 's390x', image: 'nginx:latest' }),
    (error) => error instanceof ImageSyncWorkflowError && error.code === 'INVALID_ARCHITECTURE',
  )
  for (const image of ['', 'https://example.com/image', 'nginx:latest --quiet', 'nginx\n:latest']) {
    assert.throws(
      () => normalizeImageSyncInput({ arch: 'amd64', image }),
      (error) => error instanceof ImageSyncWorkflowError && error.code === 'INVALID_IMAGE_REFERENCE',
    )
  }
  for (const image of ['localhost:5000/example:latest', '127.0.0.1/example', '10.0.0.8/app:v1', 'registry.local/app:v1']) {
    assert.throws(
      () => normalizeImageSyncInput({ arch: 'amd64', image }),
      (error) => error instanceof ImageSyncWorkflowError && error.code === 'INVALID_IMAGE_REFERENCE',
    )
  }
})

test('maps GitHub run states without trusting arbitrary conclusions', () => {
  assert.deepEqual(mapGitHubRunStatus('queued', null), { conclusion: null, status: 'queued' })
  assert.deepEqual(mapGitHubRunStatus('waiting', null), { conclusion: null, status: 'queued' })
  assert.deepEqual(mapGitHubRunStatus('in_progress', null), { conclusion: null, status: 'in_progress' })
  assert.deepEqual(mapGitHubRunStatus('completed', 'SUCCESS'), {
    conclusion: 'success',
    status: 'completed',
  })
  assert.equal(isImageSyncRunTerminal('completed'), true)
  assert.equal(isImageSyncRunTerminal('failed'), true)
  assert.equal(isImageSyncRunTerminal('queued'), false)
})

test('normalizes bounded GitHub jobs and steps', () => {
  assert.deepEqual(normalizeGitHubJobs({
    jobs: [{
      completed_at: null,
      conclusion: null,
      id: 42,
      name: 'sync-source-image-tar-oss',
      started_at: '2026-08-03T01:00:00Z',
      status: 'in_progress',
      steps: [{
        completed_at: '2026-08-03T01:00:02Z',
        conclusion: 'success',
        name: 'Checkout',
        number: 1,
        started_at: '2026-08-03T01:00:00Z',
        status: 'completed',
      }],
    }],
  }), [{
    completedAt: null,
    conclusion: null,
    id: 42,
    name: 'sync-source-image-tar-oss',
    startedAt: '2026-08-03T01:00:00Z',
    status: 'in_progress',
    steps: [{
      completedAt: '2026-08-03T01:00:02Z',
      conclusion: 'success',
      name: 'Checkout',
      number: 1,
      startedAt: '2026-08-03T01:00:00Z',
      status: 'completed',
    }],
  }])
  assert.deepEqual(normalizeGitHubJobs({ jobs: [{ id: 'invalid' }] }), [])
})

test('classifies success, failure, and running groups', () => {
  assert.equal(classifyImageSyncRun('dispatching', null), 'running')
  assert.equal(classifyImageSyncRun('queued', null), 'running')
  assert.equal(classifyImageSyncRun('in_progress', null), 'running')
  assert.equal(classifyImageSyncRun('completed', 'success'), 'success')
  assert.equal(classifyImageSyncRun('completed', 'failure'), 'failure')
  assert.equal(classifyImageSyncRun('completed', null), 'failure')
  assert.equal(classifyImageSyncRun('failed', null), 'failure')
})

test('builds workflow-compatible OSS artifact URIs from the UTC run date', () => {
  assert.deepEqual(buildImageSyncArtifactUris({
    arch: 'arm64',
    bucket: 'veges-artifacts',
    image: 'docker://GHCR.io/Labring/My_Image:v1.2.3',
    runCreatedAt: '2026-08-03T23:59:59.000Z',
  }), {
    md5Uri: 'oss://veges-artifacts/temp/2026/08/03/ghcr-io-labring-my-image-v1-2-3-arm64.tar.md5',
    tarUri: 'oss://veges-artifacts/temp/2026/08/03/ghcr-io-labring-my-image-v1-2-3-arm64.tar',
  })
  assert.equal(buildImageSyncArtifactUris({
    arch: 'amd64',
    bucket: 'Invalid_Bucket',
    image: 'nginx:latest',
    runCreatedAt: '2026-08-03T00:00:00Z',
  }), null)
  assert.equal(buildImageSyncArtifactUris({
    arch: 'amd64',
    bucket: 'valid-bucket',
    image: 'nginx:latest',
    runCreatedAt: 'invalid',
  }), null)
})

test('derives only the fixed tar object key for image sync downloads', () => {
  assert.equal(buildImageSyncTarObjectKey({
    arch: 'amd64',
    bucket: 'veges-artifacts',
    image: 'docker.io/library/nginx:1.27',
    runCreatedAt: '2026-08-04T01:02:03Z',
  }), 'temp/2026/08/04/docker-io-library-nginx-1-27-amd64.tar')
  assert.equal(buildImageSyncTarObjectKey({
    arch: 'amd64',
    bucket: 'invalid_bucket',
    image: 'docker.io/library/nginx:1.27',
    runCreatedAt: '2026-08-04T01:02:03Z',
  }), null)
})

test('uses a 30-minute download expiry by default and rejects unsafe configuration', () => {
  assert.equal(getImageSyncDownloadExpireSeconds(''), 30 * 60)
  assert.equal(getImageSyncDownloadExpireSeconds('3600'), 3600)
  for (const value of ['0', '-1', '1.5', '604801', 'invalid']) {
    assert.throws(
      () => getImageSyncDownloadExpireSeconds(value),
      (error) => error instanceof ImageSyncWorkflowError && error.code === 'IMAGE_SYNC_DOWNLOAD_CONFIG_INVALID',
    )
  }
})

test('download route remains owner-scoped and derives the tar key server-side', () => {
  const source = readFileSync(new URL('./image-sync-workflows.ts', import.meta.url), 'utf8')
  const route = source.slice(source.indexOf("imageSyncWorkflowRouter.get('/image-sync-runs/:runId/download-url'"))
  assert.match(route, /findOwnedRun\(session\.userId, runId\)/)
  assert.match(route, /createImageSyncDownloadLink\(row\)/)
  assert.doesNotMatch(route, /request\.(?:body|query).*objectKey/)
})

test('failed-run cleanup is owner-scoped and never calls GitHub or OSS deletion', () => {
  const source = readFileSync(new URL('./image-sync-workflows.ts', import.meta.url), 'utf8')
  const deleteRoute = source.slice(source.indexOf("imageSyncWorkflowRouter.delete('/image-sync-runs/:runId'"))
  assert.match(deleteRoute, /where id = \$1 and user_id = \$2/)
  assert.match(deleteRoute, /status = 'failed'/)
  assert.match(deleteRoute, /status = 'completed' and conclusion is distinct from 'success'/)
  assert.doesNotMatch(deleteRoute, /githubRequest\([^)]*delete/i)
  assert.doesNotMatch(deleteRoute, /deleteObject|deleteMulti/)
})
