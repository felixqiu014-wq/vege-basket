// 呈现当前用户的镜像同步任务，并仅轮询当前选中的活动运行。
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowSquareOut,
  CheckCircle,
  Circle,
  CloudArrowUp,
  CopySimple,
  SpinnerGap,
  Trash,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import {
  createImageSyncRun,
  deleteImageSyncRun,
  fetchImageSyncRun,
  fetchImageSyncRunDownloadUrl,
  fetchImageSyncRuns,
} from '@/api'
import type {
  ImageSyncArchitecture,
  ImageSyncRun,
  ImageSyncRunStatus,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import './image-sync-workbench.css'

const statusLabels: Record<ImageSyncRunStatus, string> = {
  completed: '已完成',
  dispatching: '等待 GitHub 确认',
  failed: '提交失败',
  in_progress: '执行中',
  queued: '排队中',
}

const conclusionLabels: Record<string, string> = {
  action_required: '需要处理',
  cancelled: '已取消',
  failure: '失败',
  neutral: '无结果',
  skipped: '已跳过',
  stale: '已失效',
  success: '成功',
  timed_out: '超时',
}

type ImageSyncFilter = 'all' | 'failure' | 'running' | 'success'

const filterLabels: Record<ImageSyncFilter, string> = {
  all: '全部',
  failure: '失败',
  running: '运行中',
  success: '成功',
}

function isActive(run: ImageSyncRun) {
  return run.status === 'dispatching' || run.status === 'queued' || run.status === 'in_progress'
}

function runGroup(run: ImageSyncRun): Exclude<ImageSyncFilter, 'all'> {
  if (isActive(run)) return 'running'
  if (run.status === 'completed' && run.conclusion === 'success') return 'success'
  return 'failure'
}

function runResultLabel(run: ImageSyncRun) {
  if (run.status !== 'completed') return statusLabels[run.status]
  return run.conclusion ? conclusionLabels[run.conclusion] ?? run.conclusion : '已完成'
}

function formatDateTime(value: string | null) {
  if (!value) return '尚未同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  }).format(date)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function StepIcon({ conclusion, status }: { conclusion: string | null; status: string }) {
  if (status === 'in_progress') return <SpinnerGap className="image-sync-spin" weight="bold" />
  if (status !== 'completed') return <Circle weight="regular" />
  if (conclusion === 'success') return <CheckCircle className="is-success" weight="fill" />
  if (conclusion === 'skipped') return <Circle className="is-muted" weight="fill" />
  return <XCircle className="is-failure" weight="fill" />
}

export function ImageSyncWorkbench() {
  const [arch, setArch] = useState<ImageSyncArchitecture>('amd64')
  const [busy, setBusy] = useState(false)
  const [copiedUri, setCopiedUri] = useState('')
  const [downloadCopyRunId, setDownloadCopyRunId] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteRun, setDeleteRun] = useState<ImageSyncRun | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<ImageSyncFilter>('all')
  const [image, setImage] = useState('docker.io/library/nginx:latest')
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<ImageSyncRun[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? null,
    [runs, selectedId],
  )
  const hasActiveRun = runs.some(isActive)
  const filterCounts = useMemo(() => ({
    all: runs.length,
    failure: runs.filter((run) => runGroup(run) === 'failure').length,
    running: runs.filter((run) => runGroup(run) === 'running').length,
    success: runs.filter((run) => runGroup(run) === 'success').length,
  }), [runs])
  const filteredRuns = useMemo(
    () => filter === 'all' ? runs : runs.filter((run) => runGroup(run) === filter),
    [filter, runs],
  )

  const replaceRun = useCallback((nextRun: ImageSyncRun) => {
    setRuns((current) => {
      const exists = current.some((run) => run.id === nextRun.id)
      const next = exists
        ? current.map((run) => run.id === nextRun.id ? nextRun : run)
        : [nextRun, ...current]
      return next.sort((left, right) => right.id - left.id)
    })
  }, [])

  const loadRuns = useCallback(async () => {
    try {
      const result = await fetchImageSyncRuns()
      setRuns(result.runs)
      setSelectedId((current) => (
        current != null && result.runs.some((run) => run.id === current)
          ? current
          : result.runs[0]?.id ?? null
      ))
      setError('')
    } catch (loadError) {
      setError(errorMessage(loadError, '无法读取镜像同步任务。'))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshRun = useCallback(async (runId: number, silent = false) => {
    if (!silent) setBusy(true)
    try {
      const result = await fetchImageSyncRun(runId, true)
      replaceRun(result.run)
      setError('')
    } catch (refreshError) {
      if (!silent) setError(errorMessage(refreshError, '无法刷新任务状态。'))
    } finally {
      if (!silent) setBusy(false)
    }
  }, [replaceRun])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (selectedId != null && filteredRuns.some((run) => run.id === selectedId)) return
    setSelectedId(filteredRuns[0]?.id ?? null)
  }, [filteredRuns, selectedId])

  useEffect(() => {
    if (!selectedRun || !isActive(selectedRun)) return
    const timer = window.setInterval(() => {
      void refreshRun(selectedRun.id, true)
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [refreshRun, selectedRun])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await createImageSyncRun({ arch, image: image.trim() })
      replaceRun(result.run)
      setSelectedId(result.run.id)
    } catch (submitError) {
      const message = errorMessage(submitError, '镜像同步任务提交失败。')
      await loadRuns()
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function copyArtifact(uri: string) {
    try {
      await navigator.clipboard.writeText(uri)
      setCopiedUri(uri)
      window.setTimeout(() => setCopiedUri((current) => current === uri ? '' : current), 1_500)
    } catch {
      setError('复制失败，请手动选择对象存储地址。')
    }
  }

  async function copyDownloadUrl(runId: number) {
    setDownloadCopyRunId(runId)
    setError('')
    try {
      const { downloadUrl } = await fetchImageSyncRunDownloadUrl(runId)
      await navigator.clipboard.writeText(downloadUrl)
      const copiedKey = `download-${runId}`
      setCopiedUri(copiedKey)
      window.setTimeout(() => setCopiedUri((current) => current === copiedKey ? '' : current), 1_500)
    } catch (copyError) {
      setError(errorMessage(copyError, '下载地址复制失败，请稍后重试。'))
    } finally {
      setDownloadCopyRunId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteRun) return
    setDeleteBusy(true)
    setError('')
    try {
      await deleteImageSyncRun(deleteRun.id)
      setRuns((current) => current.filter((run) => run.id !== deleteRun.id))
      setDeleteRun(null)
    } catch (deleteError) {
      setError(errorMessage(deleteError, '失败任务清理失败。'))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="image-sync-workbench">
      <form className="image-sync-submit" onSubmit={submit}>
        <Label htmlFor="image-sync-reference">镜像地址</Label>
        <div className="image-sync-submit-row">
          <Input
            id="image-sync-reference"
            maxLength={512}
            placeholder="docker.io/library/nginx:1.27"
            spellCheck={false}
            value={image}
            onChange={(event) => setImage(event.target.value)}
          />
          <Tabs
            className="image-sync-arch"
            value={arch}
            onValueChange={(value) => setArch(value as ImageSyncArchitecture)}
          >
            <TabsList aria-label="目标架构">
              <TabsTrigger value="amd64">amd64</TabsTrigger>
              <TabsTrigger value="arm64">arm64</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            className="solid-button image-sync-submit-button"
            disabled={busy || hasActiveRun || !image.trim()}
            type="submit"
          >
            {busy ? <SpinnerGap className="image-sync-spin" /> : <CloudArrowUp />}
            {hasActiveRun ? '已有任务执行中' : '开始同步'}
          </Button>
        </div>
      </form>

      {error ? <div className="image-sync-error" role="alert"><WarningCircle /> {error}</div> : null}

      <div className="image-sync-layout">
        <aside className="image-sync-list" aria-label="我的镜像同步任务">
          <div className="image-sync-pane-heading">
            <strong>我的任务</strong>
            <Tabs
              className="image-sync-filters"
              value={filter}
              onValueChange={(value) => setFilter(value as ImageSyncFilter)}
            >
              <TabsList aria-label="任务状态筛选">
                {(Object.keys(filterLabels) as ImageSyncFilter[]).map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {filterLabels[value]} <span>{filterCounts[value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          {loading ? <p className="image-sync-empty">正在读取任务...</p> : null}
          {!loading && filteredRuns.length === 0 ? <p className="image-sync-empty">当前筛选下暂无任务</p> : null}
          {filteredRuns.map((run) => (
            <button
              className={run.id === selectedId ? 'active' : ''}
              key={run.id}
              type="button"
              onClick={() => setSelectedId(run.id)}
            >
              <span className="image-sync-list-topline">
                <strong>#{run.id}</strong>
                <Badge data-status={run.status}>{runResultLabel(run)}</Badge>
              </span>
              <code title={run.image}>{run.image}</code>
              <small>{run.arch} · {formatDateTime(run.createdAt)}</small>
            </button>
          ))}
        </aside>

        <section className="image-sync-detail">
          {!selectedRun ? <p className="image-sync-empty">选择一个任务查看进度</p> : (
            <>
              <div className="image-sync-detail-heading">
                <div>
                  <span>任务 #{selectedRun.id}</span>
                  <h3>{selectedRun.image}</h3>
                  <p>{selectedRun.arch} · 更新于 {formatDateTime(selectedRun.lastSyncedAt ?? selectedRun.updatedAt)}</p>
                </div>
                <div className="image-sync-detail-actions">
                  {runGroup(selectedRun) === 'failure' ? (
                    <Button
                      aria-label="清理失败任务"
                      size="sm"
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteRun(selectedRun)}
                    >
                      <Trash /> 清理
                    </Button>
                  ) : null}
                  {selectedRun.githubRunUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={selectedRun.githubRunUrl} rel="noreferrer" target="_blank">
                        <ArrowSquareOut /> GitHub
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => void refreshRun(selectedRun.id)}
                  >
                    {busy ? <SpinnerGap className="image-sync-spin" /> : null}
                    刷新
                  </Button>
                </div>
              </div>

              {selectedRun.error ? (
                <div className="image-sync-run-error">
                  <XCircle weight="fill" />
                  <div><strong>{selectedRun.error.message}</strong><code>{selectedRun.error.code}</code></div>
                </div>
              ) : null}

              <div className="image-sync-run-summary">
                <div><span>状态</span><strong>{runResultLabel(selectedRun)}</strong></div>
                <div><span>GitHub Run</span><strong>{selectedRun.githubRunId ?? '尚未分配'}</strong></div>
                <div><span>开始时间</span><strong>{formatDateTime(selectedRun.createdAt)}</strong></div>
                <div><span>完成时间</span><strong>{formatDateTime(selectedRun.completedAt)}</strong></div>
              </div>

              {selectedRun.artifacts ? (
                <section className="image-sync-artifacts" aria-label="对象存储地址">
                  <header><strong>对象存储地址</strong><span>GitHub Run UTC 日期</span></header>
                  {([
                    ['镜像归档', selectedRun.artifacts.tarUri],
                    ['MD5 校验', selectedRun.artifacts.md5Uri],
                  ] as const).map(([label, uri]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <code title={uri}>{uri}</code>
                      {label === '镜像归档' ? (
                        <Button
                          aria-label={copiedUri === `download-${selectedRun.id}` ? '已复制下载地址' : '复制下载地址'}
                          disabled={downloadCopyRunId === selectedRun.id}
                          size="icon"
                          title="复制下载地址"
                          type="button"
                          variant="ghost"
                          onClick={() => void copyDownloadUrl(selectedRun.id)}
                        >
                          {downloadCopyRunId === selectedRun.id
                            ? <SpinnerGap className="image-sync-spin" />
                            : copiedUri === `download-${selectedRun.id}` ? <CheckCircle weight="fill" /> : <CopySimple />}
                        </Button>
                      ) : (
                        <Button
                          aria-label={`复制${label}地址`}
                          size="icon"
                          title={`复制${label}地址`}
                          type="button"
                          variant="ghost"
                          onClick={() => void copyArtifact(uri)}
                        >
                          {copiedUri === uri ? <CheckCircle weight="fill" /> : <CopySimple />}
                        </Button>
                      )}
                    </div>
                  ))}
                </section>
              ) : null}

              <div className="image-sync-jobs">
                {selectedRun.jobs.length === 0 ? (
                  <div className="image-sync-pending">
                    {isActive(selectedRun) ? <SpinnerGap className="image-sync-spin" /> : <Circle />}
                    {isActive(selectedRun) ? '等待 GitHub 返回步骤进度' : '没有可显示的步骤'}
                  </div>
                ) : selectedRun.jobs.map((job) => (
                  <section className="image-sync-job" key={job.id}>
                    <header>
                      <strong>{job.name}</strong>
                      <Badge variant="outline">{job.conclusion ? conclusionLabels[job.conclusion] ?? job.conclusion : statusLabels[job.status as ImageSyncRunStatus] ?? job.status}</Badge>
                    </header>
                    <ol>
                      {job.steps.map((step) => (
                        <li key={`${job.id}-${step.number}`}>
                          <StepIcon conclusion={step.conclusion} status={step.status} />
                          <span>{step.name}</span>
                          <small>{step.conclusion ? conclusionLabels[step.conclusion] ?? step.conclusion : step.status}</small>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={deleteRun != null} onOpenChange={(open) => {
        if (!open && !deleteBusy) setDeleteRun(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理失败任务</DialogTitle>
            <DialogDescription>
              只会删除任务 #{deleteRun?.id} 的本地记录，不会删除 GitHub Action、OSS 文件或日志。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleteBusy} type="button" variant="outline" onClick={() => setDeleteRun(null)}>
              取消
            </Button>
            <Button disabled={deleteBusy} type="button" variant="destructive" onClick={() => void confirmDelete()}>
              {deleteBusy ? <SpinnerGap className="image-sync-spin" /> : <Trash />}
              {deleteBusy ? '正在清理' : '清理本地记录'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
