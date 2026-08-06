// 提供用户隔离的 GitHub 镜像同步任务 API，并封装固定目标的 GitHub Actions 请求。
import OSS from 'ali-oss'
import { Router } from 'express'
import type { PoolClient } from 'pg'
import { decryptText, encryptText } from './crypto.ts'
import { pool, query } from './db.ts'
import { normalizeOssEndpoint } from './package-market.ts'
import { getAuthenticatedRoleSession } from './roles.ts'

export const imageSyncArchitectures = ['amd64', 'arm64'] as const
export type ImageSyncArchitecture = (typeof imageSyncArchitectures)[number]
export type ImageSyncRunStatus = 'dispatching' | 'queued' | 'in_progress' | 'completed' | 'failed'
export type ImageSyncRunGroup = 'failure' | 'running' | 'success'

type ImageSyncProgressStep = {
  completedAt: string | null
  conclusion: string | null
  name: string
  number: number
  startedAt: string | null
  status: string
}

type ImageSyncProgressJob = {
  completedAt: string | null
  conclusion: string | null
  id: number
  name: string
  startedAt: string | null
  status: string
  steps: ImageSyncProgressStep[]
}

type ImageSyncRunRow = {
  architecture: ImageSyncArchitecture
  completed_at: string | null
  conclusion: string | null
  created_at: string
  dispatch_key: string
  error_code: string | null
  error_message: string | null
  github_run_id: string | null
  github_run_url: string | null
  id: string
  image_ref_encrypted: string
  last_synced_at: string | null
  next_sync_at: string
  progress: unknown
  status: ImageSyncRunStatus
  updated_at: string
  user_id: string
}

type GitHubWorkflowRun = {
  conclusion?: unknown
  created_at?: unknown
  html_url?: unknown
  id?: unknown
  name?: unknown
  status?: unknown
  updated_at?: unknown
}

type ImageSyncStoredProgress = {
  jobs: ImageSyncProgressJob[]
  runCreatedAt: string | null
}

type GitHubWorkflowJob = {
  completed_at?: unknown
  conclusion?: unknown
  id?: unknown
  name?: unknown
  started_at?: unknown
  status?: unknown
  steps?: unknown
}

const githubApiVersion = '2026-03-10'
const githubOwner = 'labring'
const githubRepo = 'sealos-pro'
const githubWorkflow = 'sync-images-tar-oss.yml'
const githubRef = 'main'
const githubApiRoot = `https://api.github.com/repos/${githubOwner}/${githubRepo}`
const activeStatuses: readonly ImageSyncRunStatus[] = ['dispatching', 'queued', 'in_progress']
const dispatchReconciliationWindowMs = 5 * 60 * 1000
const defaultImageSyncDownloadExpireSeconds = 30 * 60
const maxImageSyncDownloadExpireSeconds = 7 * 24 * 60 * 60

export class ImageSyncWorkflowError extends Error {
  code: string
  retryAfterSeconds: number | null
  status: number

  constructor(code: string, message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'ImageSyncWorkflowError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRetryAfterSeconds(response: Response) {
  const retryAfter = response.headers.get('retry-after')?.trim() ?? ''
  const numeric = Number(retryAfter)
  if (Number.isFinite(numeric) && numeric >= 0) return Math.min(Math.ceil(numeric), 3600)
  const date = Date.parse(retryAfter)
  if (Number.isFinite(date)) return Math.min(Math.max(Math.ceil((date - Date.now()) / 1000), 0), 3600)
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  if (Number.isFinite(reset) && reset > Date.now() / 1000) {
    return Math.min(Math.ceil(reset - Date.now() / 1000), 3600)
  }
  return 60
}

function boundedString(value: unknown, maxLength = 160) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function nullableString(value: unknown, maxLength = 160) {
  const normalized = boundedString(value, maxLength)
  return normalized || null
}

export function buildImageSyncRunName(dispatchKey: string) {
  return `Sync image tar [${dispatchKey}]`
}

function normalizeIsoDate(value: unknown) {
  const candidate = nullableString(value, 40)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function positiveInteger(value: unknown) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

export function selectGitHubWorkflowRun(value: unknown, dispatchKey: string) {
  if (!isRecord(value) || !Array.isArray(value.workflow_runs)) return null
  const expectedName = buildImageSyncRunName(dispatchKey)
  return value.workflow_runs
    .flatMap((candidate) => {
      if (!isRecord(candidate)) return []
      const run = candidate as GitHubWorkflowRun
      const runId = positiveInteger(run.id)
      const runName = boundedString(run.name, 240)
      const runUrl = boundedString(run.html_url, 500)
      if (
        runId == null ||
        runName !== expectedName ||
        !runUrl.startsWith(`https://github.com/${githubOwner}/${githubRepo}/actions/runs/`)
      ) {
        return []
      }
      return [{
        runCreatedAt: normalizeIsoDate(run.created_at),
        runId,
        runUrl,
      }]
    })
    .sort((left, right) => {
      const leftTime = left.runCreatedAt ? Date.parse(left.runCreatedAt) : 0
      const rightTime = right.runCreatedAt ? Date.parse(right.runCreatedAt) : 0
      return rightTime - leftTime
    })[0] ?? null
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  return octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
}

function hasUnsafeRegistry(imageBody: string) {
  const firstSegment = imageBody.split('/')[0].toLowerCase()
  if (!firstSegment.includes('.') && !firstSegment.includes(':')) return false
  const hostname = firstSegment.replace(/:\d+$/, '')
  return hostname === 'localhost' || hostname.endsWith('.local') || isPrivateIpv4(hostname)
}

export function normalizeImageSyncInput(input: { arch?: unknown; image?: unknown }) {
  const arch = String(input.arch ?? '').trim().toLowerCase()
  if (!imageSyncArchitectures.includes(arch as ImageSyncArchitecture)) {
    throw new ImageSyncWorkflowError('INVALID_ARCHITECTURE', '目标架构必须是 amd64 或 arm64。', 400)
  }

  const image = String(input.image ?? '').trim()
  const imageBody = image.startsWith('docker://') ? image.slice('docker://'.length) : image
  if (
    image.length === 0 ||
    image.length > 512 ||
    imageBody.length === 0 ||
    imageBody.includes('://') ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/.test(imageBody) ||
    imageBody.endsWith('/') ||
    hasUnsafeRegistry(imageBody)
  ) {
    throw new ImageSyncWorkflowError(
      'INVALID_IMAGE_REFERENCE',
      '请输入有效的完整镜像引用，且长度不能超过 512 个字符。',
      400,
    )
  }

  return { arch: arch as ImageSyncArchitecture, image }
}

export function mapGitHubRunStatus(status: unknown, conclusion: unknown): {
  conclusion: string | null
  status: ImageSyncRunStatus
} {
  const normalizedStatus = boundedString(status, 40).toLowerCase()
  const normalizedConclusion = nullableString(conclusion, 40)?.toLowerCase() ?? null
  if (normalizedStatus === 'completed') {
    return { conclusion: normalizedConclusion, status: 'completed' }
  }
  if (normalizedStatus === 'in_progress') {
    return { conclusion: normalizedConclusion, status: 'in_progress' }
  }
  return { conclusion: normalizedConclusion, status: 'queued' }
}

export function normalizeGitHubJobs(value: unknown): ImageSyncProgressJob[] {
  if (!isRecord(value) || !Array.isArray(value.jobs)) return []
  return value.jobs.slice(0, 20).flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const job = candidate as GitHubWorkflowJob
    const id = positiveInteger(job.id)
    const name = boundedString(job.name, 160)
    if (id == null || !name) return []
    const rawSteps = Array.isArray(job.steps) ? job.steps : []
    const steps = rawSteps.slice(0, 50).flatMap((rawStep) => {
      if (!isRecord(rawStep)) return []
      const number = positiveInteger(rawStep.number)
      const stepName = boundedString(rawStep.name, 160)
      if (number == null || !stepName) return []
      return [{
        completedAt: nullableString(rawStep.completed_at, 40),
        conclusion: nullableString(rawStep.conclusion, 40),
        name: stepName,
        number,
        startedAt: nullableString(rawStep.started_at, 40),
        status: boundedString(rawStep.status, 40) || 'queued',
      }]
    })
    return [{
      completedAt: nullableString(job.completed_at, 40),
      conclusion: nullableString(job.conclusion, 40),
      id,
      name,
      startedAt: nullableString(job.started_at, 40),
      status: boundedString(job.status, 40) || 'queued',
      steps,
    }]
  })
}

export function isImageSyncRunTerminal(status: ImageSyncRunStatus) {
  return status === 'completed' || status === 'failed'
}

export function classifyImageSyncRun(
  status: ImageSyncRunStatus,
  conclusion: string | null,
): ImageSyncRunGroup {
  if (status === 'dispatching' || status === 'queued' || status === 'in_progress') {
    return 'running'
  }
  if (status === 'completed' && conclusion === 'success') return 'success'
  return 'failure'
}

function normalizeOssBucket(value: unknown) {
  const bucket = String(value ?? '').trim().toLowerCase()
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ? bucket : null
}

export function buildImageSyncArtifactUris(input: {
  arch: ImageSyncArchitecture
  bucket: unknown
  image: string
  runCreatedAt: string
}) {
  const bucket = normalizeOssBucket(input.bucket)
  const date = new Date(input.runCreatedAt)
  if (!bucket || Number.isNaN(date.getTime())) return null
  const imageBody = input.image.startsWith('docker://')
    ? input.image.slice('docker://'.length)
    : input.image
  const safeBase = imageBody
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image'
  const datePath = date.toISOString().slice(0, 10).replaceAll('-', '/')
  const tarName = `${safeBase}-${input.arch}.tar`
  const tarUri = `oss://${bucket}/temp/${datePath}/${tarName}`
  return { md5Uri: `${tarUri}.md5`, tarUri }
}

export function getImageSyncDownloadExpireSeconds(value: unknown = process.env.IMAGE_SYNC_DOWNLOAD_EXPIRE_SECONDS) {
  const configured = String(value ?? '').trim()
  if (!configured) return defaultImageSyncDownloadExpireSeconds
  if (!/^\d+$/.test(configured)) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_DOWNLOAD_CONFIG_INVALID',
      '镜像同步下载地址有效期配置无效。',
      500,
    )
  }
  const seconds = Number(configured)
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > maxImageSyncDownloadExpireSeconds) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_DOWNLOAD_CONFIG_INVALID',
      '镜像同步下载地址有效期配置无效。',
      500,
    )
  }
  return seconds
}

export function buildImageSyncTarObjectKey(input: {
  arch: ImageSyncArchitecture
  bucket: unknown
  image: string
  runCreatedAt: string
}) {
  const bucket = normalizeOssBucket(input.bucket)
  const artifacts = buildImageSyncArtifactUris(input)
  if (!bucket || !artifacts) return null
  const prefix = `oss://${bucket}/`
  if (!artifacts.tarUri.startsWith(prefix)) return null
  const objectKey = artifacts.tarUri.slice(prefix.length)
  return /^temp\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9]+(?:-[a-z0-9]+)*-(?:amd64|arm64)\.tar$/.test(objectKey)
    ? objectKey
    : null
}

function imageSyncOssClient() {
  const endpoint = normalizeOssEndpoint(process.env.OSS_ENDPOINT)
  const accessKeyId = String(process.env.OSS_ACCESS_KEY_ID ?? '').trim()
  const accessKeySecret = String(process.env.OSS_ACCESS_KEY_SECRET ?? '').trim()
  const bucket = normalizeOssBucket(process.env.OSS_BUCKET)
  if (!endpoint || !accessKeyId || !accessKeySecret || !bucket) {
    throw new ImageSyncWorkflowError(
      'OSS_DOWNLOAD_UNAVAILABLE',
      '下载地址暂时不可用，请稍后重试。',
      503,
    )
  }
  return new OSS({
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint,
    secure: true,
  })
}

function readGitHubToken() {
  const token = String(process.env.GITHUB_ACTIONS_TOKEN ?? '').trim()
  if (!token) {
    throw new ImageSyncWorkflowError(
      'GITHUB_ACTIONS_NOT_CONFIGURED',
      '镜像同步服务尚未配置，请联系管理员。',
      503,
    )
  }
  return token
}

async function githubRequest(path: string, options: RequestInit = {}) {
  const token = readGitHubToken()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(`${githubApiRoot}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'veges-image-sync',
        'X-GitHub-Api-Version': githubApiVersion,
        ...options.headers,
      },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      const rateLimited = response.status === 429 || (
        response.status === 403 && (
          response.headers.has('retry-after') ||
          response.headers.get('x-ratelimit-remaining') === '0'
        )
      )
      if (rateLimited) {
        throw new ImageSyncWorkflowError(
          'GITHUB_ACTIONS_RATE_LIMITED',
          'GitHub Actions 请求受到限流，请稍后重试。',
          429,
          parseRetryAfterSeconds(response),
        )
      }
      if (response.status === 401 || response.status === 403) {
        throw new ImageSyncWorkflowError(
          'GITHUB_ACTIONS_FORBIDDEN',
          'GitHub Actions 鉴权失败或请求已受限，请联系管理员。',
          502,
        )
      }
      if (response.status === 404) {
        throw new ImageSyncWorkflowError(
          'GITHUB_WORKFLOW_NOT_FOUND',
          '目标 GitHub workflow 不存在或当前 Token 无权访问。',
          502,
        )
      }
      throw new ImageSyncWorkflowError(
        'GITHUB_ACTIONS_UNAVAILABLE',
        'GitHub Actions 暂时不可用，请稍后重试。',
        502,
      )
    }
    if (response.status === 204) return null
    return await response.json() as unknown
  } catch (error) {
    if (error instanceof ImageSyncWorkflowError) throw error
    throw new ImageSyncWorkflowError(
      'GITHUB_ACTIONS_UNAVAILABLE',
      '无法连接 GitHub Actions，请稍后重试。',
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function dispatchImageSyncWorkflow(input: {
  arch: ImageSyncArchitecture
  image: string
}, dispatchKey: string) {
  const result = await githubRequest(
    `/actions/workflows/${encodeURIComponent(githubWorkflow)}/dispatches`,
    {
      body: JSON.stringify({
        inputs: { arch: input.arch, image: input.image, request_id: dispatchKey },
        ref: githubRef,
      }),
      method: 'POST',
    },
  )
  if (!isRecord(result)) {
    throw new ImageSyncWorkflowError(
      'GITHUB_DISPATCH_UNCERTAIN',
      '正在确认 GitHub 是否已接收任务。',
      202,
    )
  }
  const runId = positiveInteger(result.workflow_run_id)
  const runUrl = boundedString(result.html_url, 500)
  if (runId == null || !runUrl.startsWith(`https://github.com/${githubOwner}/${githubRepo}/actions/runs/`)) {
    throw new ImageSyncWorkflowError(
      'GITHUB_DISPATCH_UNCERTAIN',
      '正在确认 GitHub 是否已接收任务。',
      202,
    )
  }
  return { runId, runUrl }
}

async function findGitHubWorkflowRun(dispatchKey: string, createdAt: string) {
  const created = new Date(createdAt)
  const createdAfter = Number.isNaN(created.getTime())
    ? new Date(Date.now() - dispatchReconciliationWindowMs).toISOString()
    : new Date(created.getTime() - 60 * 1000).toISOString()
  const params = new URLSearchParams({
    branch: githubRef,
    created: `>=${createdAfter}`,
    event: 'workflow_dispatch',
    per_page: '100',
  })
  const value = await githubRequest(
    `/actions/workflows/${encodeURIComponent(githubWorkflow)}/runs?${params.toString()}`,
  )
  return selectGitHubWorkflowRun(value, dispatchKey)
}

async function loadGitHubRun(githubRunId: number) {
  const [runValue, jobsValue] = await Promise.all([
    githubRequest(`/actions/runs/${githubRunId}`),
    githubRequest(`/actions/runs/${githubRunId}/jobs?per_page=100`),
  ])
  if (!isRecord(runValue)) {
    throw new ImageSyncWorkflowError(
      'GITHUB_RUN_INVALID',
      'GitHub 返回了无法识别的任务状态。',
      502,
    )
  }
  const run = runValue as GitHubWorkflowRun
  if (positiveInteger(run.id) !== githubRunId) {
    throw new ImageSyncWorkflowError(
      'GITHUB_RUN_INVALID',
      'GitHub 返回了无法识别的任务状态。',
      502,
    )
  }
  return {
    ...mapGitHubRunStatus(run.status, run.conclusion),
    runCreatedAt: normalizeIsoDate(run.created_at),
    progress: normalizeGitHubJobs(jobsValue),
    runUrl: boundedString(run.html_url, 500),
  }
}

function parseProgress(value: unknown): ImageSyncStoredProgress {
  if (Array.isArray(value)) return { jobs: value as ImageSyncProgressJob[], runCreatedAt: null }
  if (isRecord(value) && Array.isArray(value.jobs)) {
    return {
      jobs: value.jobs as ImageSyncProgressJob[],
      runCreatedAt: normalizeIsoDate(value.runCreatedAt),
    }
  }
  if (typeof value !== 'string') return { jobs: [], runCreatedAt: null }
  try {
    return parseProgress(JSON.parse(value))
  } catch {
    return { jobs: [], runCreatedAt: null }
  }
}

function serializeRun(row: ImageSyncRunRow) {
  const storedProgress = parseProgress(row.progress)
  const artifacts = classifyImageSyncRun(row.status, row.conclusion) === 'success'
    ? buildImageSyncArtifactUris({
        arch: row.architecture,
        bucket: process.env.OSS_BUCKET,
        image: decryptText(row.image_ref_encrypted),
        runCreatedAt: storedProgress.runCreatedAt ?? row.created_at,
      })
    : null
  return {
    arch: row.architecture,
    artifacts,
    completedAt: row.completed_at,
    conclusion: row.conclusion,
    createdAt: row.created_at,
    error: row.error_code && row.error_message
      ? { code: row.error_code, message: row.error_message }
      : null,
    githubRunId: row.github_run_id ? Number(row.github_run_id) : null,
    githubRunUrl: row.github_run_url,
    id: Number(row.id),
    image: decryptText(row.image_ref_encrypted),
    jobs: storedProgress.jobs,
    lastSyncedAt: row.last_synced_at,
    status: row.status,
    updatedAt: row.updated_at,
  }
}

function createImageSyncDownloadLink(row: ImageSyncRunRow) {
  if (classifyImageSyncRun(row.status, row.conclusion) !== 'success') {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_ARTIFACT_UNAVAILABLE',
      '该任务尚未生成可下载的镜像归档。',
      409,
    )
  }
  const storedProgress = parseProgress(row.progress)
  const objectKey = buildImageSyncTarObjectKey({
    arch: row.architecture,
    bucket: process.env.OSS_BUCKET,
    image: decryptText(row.image_ref_encrypted),
    runCreatedAt: storedProgress.runCreatedAt ?? row.created_at,
  })
  if (!objectKey) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_ARTIFACT_UNAVAILABLE',
      '该任务尚未生成可下载的镜像归档。',
      409,
    )
  }
  const expiresInSeconds = getImageSyncDownloadExpireSeconds()
  try {
    return {
      downloadUrl: imageSyncOssClient().signatureUrl(objectKey, { expires: expiresInSeconds, method: 'GET' }),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      expiresInSeconds,
    }
  } catch (error) {
    if (error instanceof ImageSyncWorkflowError) throw error
    throw new ImageSyncWorkflowError(
      'OSS_DOWNLOAD_UNAVAILABLE',
      '下载地址暂时不可用，请稍后重试。',
      503,
    )
  }
}

const runColumns = `
  id, user_id, dispatch_key, image_ref_encrypted, architecture, status, conclusion,
  github_run_id, github_run_url, progress, error_code, error_message,
  created_at, updated_at, last_synced_at, next_sync_at, completed_at
`

function isRecoverableGitHubError(error: unknown): boolean {
  return error instanceof ImageSyncWorkflowError && (
    error.code === 'GITHUB_ACTIONS_UNAVAILABLE' ||
    error.code === 'GITHUB_ACTIONS_RATE_LIMITED' ||
    error.code === 'GITHUB_DISPATCH_UNCERTAIN'
  )
}

function isDispatchReconciliationExpired(row: ImageSyncRunRow) {
  const createdAt = new Date(row.created_at).getTime()
  return Number.isFinite(createdAt) && Date.now() - createdAt >= dispatchReconciliationWindowMs
}

async function deferOwnedRunSync(row: ImageSyncRunRow, delaySeconds = 5) {
  const delay = Math.max(1, Math.min(Math.ceil(delaySeconds), 3600))
  const updated = await query<ImageSyncRunRow>(
    `update image_sync_workflow_runs
     set last_synced_at = now(), next_sync_at = clock_timestamp() + ($1::integer * interval '1 second'),
         updated_at = now()
     where id = $2 and user_id = $3 and status in ('dispatching', 'queued', 'in_progress')
     returning ${runColumns}`,
    [delay, row.id, row.user_id],
  )
  return updated.rows[0] ?? row
}

async function findOwnedRun(userId: number, runId: number) {
  const result = await query<ImageSyncRunRow>(
    `select ${runColumns} from image_sync_workflow_runs where id = $1 and user_id = $2`,
    [runId, userId],
  )
  return result.rows[0] ?? null
}

async function bindOwnedRunToGitHub(
  row: ImageSyncRunRow,
  matched: { runCreatedAt: string | null; runId: number; runUrl: string },
) {
  const storedProgress = parseProgress(row.progress)
  const updated = await query<ImageSyncRunRow>(
    `update image_sync_workflow_runs
     set status = 'queued', github_run_id = $1,
         github_run_url = coalesce(nullif($2, ''), github_run_url),
         progress = $3::jsonb, last_synced_at = now(), next_sync_at = clock_timestamp(), updated_at = now()
     where id = $4 and user_id = $5 and status = 'dispatching'
     returning ${runColumns}`,
    [
      matched.runId,
      matched.runUrl,
      JSON.stringify({ jobs: storedProgress.jobs, runCreatedAt: matched.runCreatedAt }),
      row.id,
      row.user_id,
    ],
  )
  return updated.rows[0] ?? row
}

async function syncOwnedRunFromGitHub(row: ImageSyncRunRow, githubRunId: number) {
  const current = await loadGitHubRun(githubRunId)
  const updated = await query<ImageSyncRunRow>(
    `update image_sync_workflow_runs
     set status = $1, conclusion = $2, github_run_id = $3,
         github_run_url = coalesce(nullif($4, ''), github_run_url),
         progress = $5::jsonb, last_synced_at = now(), next_sync_at = clock_timestamp(), updated_at = now(),
         completed_at = case when $1 = 'completed' then coalesce(completed_at, now()) else completed_at end
     where id = $6 and user_id = $7
     returning ${runColumns}`,
    [
      current.status,
      current.conclusion,
      githubRunId,
      current.runUrl,
      JSON.stringify({ jobs: current.progress, runCreatedAt: current.runCreatedAt }),
      row.id,
      row.user_id,
    ],
  )
  return updated.rows[0] ?? row
}

async function createDispatchingRun(
  client: PoolClient,
  userId: number,
  input: ReturnType<typeof normalizeImageSyncInput>,
) {
  await client.query(
    `select pg_advisory_xact_lock(hashtextextended('image-sync:' || $1::text, 0))`,
    [userId],
  )
  await client.query(
    `update image_sync_workflow_runs
     set status = 'failed', error_code = 'DISPATCH_LEASE_EXPIRED',
         error_message = '任务提交超时，请重新发起。', updated_at = now(), completed_at = now()
     where user_id = $1 and status = 'dispatching' and created_at < now() - interval '5 minutes'`,
    [userId],
  )
  const recent = await client.query<{ active: boolean; cooling_down: boolean; hourly_count: string }>(
    `select
       exists(select 1 from image_sync_workflow_runs where user_id = $1 and status = any($2::text[])) as active,
       exists(select 1 from image_sync_workflow_runs where user_id = $1 and created_at > now() - interval '10 seconds') as cooling_down,
       (select count(*) from image_sync_workflow_runs where user_id = $1 and created_at > now() - interval '1 hour') as hourly_count`,
    [userId, activeStatuses],
  )
  if (recent.rows[0]?.active) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_ALREADY_ACTIVE',
      '你已有一个镜像同步任务正在执行，请等待其结束。',
      409,
    )
  }
  if (recent.rows[0]?.cooling_down) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_COOLDOWN',
      '提交过于频繁，请稍后重试。',
      429,
    )
  }
  if (Number(recent.rows[0]?.hourly_count ?? 0) >= 10) {
    throw new ImageSyncWorkflowError(
      'IMAGE_SYNC_RATE_LIMITED',
      '你在最近一小时提交的镜像同步任务过多，请稍后重试。',
      429,
    )
  }
  const inserted = await client.query<ImageSyncRunRow>(
    `insert into image_sync_workflow_runs (
       user_id, image_ref_encrypted, architecture, status
     ) values ($1, $2, $3, 'dispatching')
     returning ${runColumns}`,
    [userId, encryptText(input.image), input.arch],
  )
  return inserted.rows[0]
}

export const imageSyncWorkflowRouter = Router()

imageSyncWorkflowRouter.post('/image-sync-runs', async (request, response, next) => {
  try {
    const session = await getAuthenticatedRoleSession(request)
    if (!session) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    const input = normalizeImageSyncInput(request.body)
    readGitHubToken()
    const client = await pool.connect()
    let localRun: ImageSyncRunRow
    try {
      await client.query('begin')
      localRun = await createDispatchingRun(client, session.userId, input)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }

    try {
      const dispatched = await dispatchImageSyncWorkflow(input, localRun.dispatch_key)
      const updated = await query<ImageSyncRunRow>(
        `update image_sync_workflow_runs
         set status = 'queued', github_run_id = $1, github_run_url = $2, updated_at = now()
         where id = $3 and user_id = $4 and status = 'dispatching'
         returning ${runColumns}`,
        [dispatched.runId, dispatched.runUrl, localRun.id, session.userId],
      )
      response.status(201).json({ run: serializeRun(updated.rows[0] ?? localRun) })
    } catch (error) {
      if (error instanceof ImageSyncWorkflowError && isRecoverableGitHubError(error)) {
        const deferred = await deferOwnedRunSync(localRun, error.retryAfterSeconds ?? 5)
        response.status(202).json({ run: serializeRun(deferred) })
        return
      }
      if (!(error instanceof ImageSyncWorkflowError)) throw error
      const safeError = error
      const failed = await query<ImageSyncRunRow>(
        `update image_sync_workflow_runs
         set status = 'failed', error_code = $1, error_message = $2,
             updated_at = now(), completed_at = now()
         where id = $3 and user_id = $4 and status = 'dispatching'
         returning ${runColumns}`,
        [safeError.code, safeError.message, localRun.id, session.userId],
      )
      response.status(safeError.status).json({
        code: safeError.code,
        error: safeError.message,
        run: serializeRun(failed.rows[0] ?? localRun),
      })
    }
  } catch (error) {
    if (error instanceof ImageSyncWorkflowError) {
      response.status(error.status).json({ code: error.code, error: error.message })
      return
    }
    next(error)
  }
})

imageSyncWorkflowRouter.get('/image-sync-runs', async (request, response, next) => {
  try {
    const session = await getAuthenticatedRoleSession(request)
    if (!session) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    const result = await query<ImageSyncRunRow>(
      `select ${runColumns}
       from image_sync_workflow_runs
       where user_id = $1
       order by created_at desc, id desc
       limit 100`,
      [session.userId],
    )
    response.json({ runs: result.rows.map(serializeRun) })
  } catch (error) {
    next(error)
  }
})

imageSyncWorkflowRouter.delete('/image-sync-runs/:runId', async (request, response, next) => {
  try {
    const session = await getAuthenticatedRoleSession(request)
    if (!session) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    const runId = positiveInteger(request.params.runId)
    if (runId == null) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    const deleted = await query<{ id: string }>(
      `delete from image_sync_workflow_runs
       where id = $1 and user_id = $2
         and (
           status = 'failed'
           or (status = 'completed' and conclusion is distinct from 'success')
         )
       returning id`,
      [runId, session.userId],
    )
    if (deleted.rows[0]) {
      response.json({ deleted: true })
      return
    }
    const existing = await findOwnedRun(session.userId, runId)
    if (!existing) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    response.status(409).json({ error: '只能清理已失败任务的本地记录。' })
  } catch (error) {
    next(error)
  }
})

imageSyncWorkflowRouter.get('/image-sync-runs/:runId/download-url', async (request, response, next) => {
  try {
    const session = await getAuthenticatedRoleSession(request)
    if (!session) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    const runId = positiveInteger(request.params.runId)
    if (runId == null) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    const row = await findOwnedRun(session.userId, runId)
    if (!row) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    response.json(createImageSyncDownloadLink(row))
  } catch (error) {
    if (error instanceof ImageSyncWorkflowError) {
      response.status(error.status).json({ code: error.code, error: error.message })
      return
    }
    next(error)
  }
})

imageSyncWorkflowRouter.get('/image-sync-runs/:runId', async (request, response, next) => {
  try {
    const session = await getAuthenticatedRoleSession(request)
    if (!session) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    const runId = positiveInteger(request.params.runId)
    if (runId == null) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    let row = await findOwnedRun(session.userId, runId)
    if (!row) {
      response.status(404).json({ error: '镜像同步任务不存在。' })
      return
    }
    const shouldRefresh = request.query.refresh === 'true'
    let githubRunId = row.github_run_id ? Number(row.github_run_id) : null
    if (shouldRefresh && !isImageSyncRunTerminal(row.status)) {
      const nextSyncAt = Date.parse(row.next_sync_at)
      if (Number.isFinite(nextSyncAt) && nextSyncAt > Date.now()) {
        response.json({ run: serializeRun(row) })
        return
      }
      try {
        if (githubRunId == null && row.status === 'dispatching') {
          if (isDispatchReconciliationExpired(row)) {
            const expired = await query<ImageSyncRunRow>(
              `update image_sync_workflow_runs
               set status = 'failed', error_code = 'DISPATCH_RECONCILIATION_TIMEOUT',
                   error_message = '未能确认 GitHub 是否已接收任务，请重新发起。',
                   updated_at = now(), completed_at = now()
               where id = $1 and user_id = $2 and status = 'dispatching'
               returning ${runColumns}`,
              [runId, session.userId],
            )
            row = expired.rows[0] ?? row
          } else {
            const matched = await findGitHubWorkflowRun(row.dispatch_key, row.created_at)
            if (matched) {
              githubRunId = matched.runId
              row = await bindOwnedRunToGitHub(row, matched)
              row = await syncOwnedRunFromGitHub(row, matched.runId)
            } else {
              const touched = await query<ImageSyncRunRow>(
                `update image_sync_workflow_runs
                 set last_synced_at = now(), next_sync_at = clock_timestamp() + interval '5 seconds',
                     updated_at = now()
                 where id = $1 and user_id = $2 and status = 'dispatching'
                 returning ${runColumns}`,
                [runId, session.userId],
              )
              row = touched.rows[0] ?? row
            }
          }
        } else if (githubRunId != null) {
          row = await syncOwnedRunFromGitHub(row, githubRunId)
        }
      } catch (error) {
        if (!(error instanceof ImageSyncWorkflowError)) throw error
        if (isRecoverableGitHubError(error)) {
          row = await deferOwnedRunSync(row, error.retryAfterSeconds ?? 5)
          response.json({ run: serializeRun(row) })
          return
        }
        response.status(error.status).json({
          code: error.code,
          error: error.message,
          run: serializeRun(row),
        })
        return
      }
    }
    response.json({ run: serializeRun(row) })
  } catch (error) {
    next(error)
  }
})
