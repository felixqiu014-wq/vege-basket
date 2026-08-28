import { useEffect, useMemo, useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  CheckSquare,
  CircleNotch,
  Funnel,
  Info,
  MagnifyingGlass,
  Package as PackageIcon,
  X,
} from '@phosphor-icons/react'
import type {
  OrganizationPackageMarketChannel,
  OrganizationPackageMarketPolicy,
  OrganizationPackageMarketSelectionMode,
} from '../../shared/organization-package-market'
import type {
  OrganizationDetail,
  OrganizationPackageMarketCatalogRule,
} from '../organization-types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  filterOrganizationPackageMarketRules,
  organizationPackageMarketPageSizes,
  organizationPackageMarketPoliciesEqual,
  paginateOrganizationPackageMarketRules,
  selectableOrganizationPackageMarketRules,
  toggleOrganizationPackageMarketRule,
  type OrganizationPackageMarketCategory,
  type OrganizationPackageMarketPageSize,
} from '../organization-package-market-view'

type OrganizationPackageMarketPanelProps = {
  catalog: OrganizationPackageMarketCatalogRule[]
  catalogLoading: boolean
  detail: OrganizationDetail
  error: string
  policy: OrganizationPackageMarketPolicy | null
  policySaving: boolean
  onPolicyChange: (updater: (current: OrganizationPackageMarketPolicy) => OrganizationPackageMarketPolicy) => void
  onReset: () => void
  onSave: () => void
}

const channels: readonly OrganizationPackageMarketChannel[] = ['release', 'ci']

const channelLabels: Record<OrganizationPackageMarketChannel, string> = {
  release: 'Release',
  ci: 'CI',
}

const channelDescriptions: Record<OrganizationPackageMarketChannel, string> = {
  release: '正式包渠道',
  ci: '测试包渠道',
}

const categoryLabels: Record<OrganizationPackageMarketCatalogRule['category'], string> = {
  apps: '应用',
  dependency: '依赖',
  middleware: '中间件',
}

const selectionModeLabels: Record<OrganizationPackageMarketSelectionMode, string> = {
  all: '显示全部安装包',
  selected: '仅显示指定安装包',
}

const emptyRuleIds: string[] = []

function policyChannelSummary(
  policy: OrganizationPackageMarketPolicy,
  channel: OrganizationPackageMarketChannel,
  selectedCount: number,
) {
  const channelPolicy = policy.channels[channel]
  if (!policy.enabled) return '市场已关闭'
  if (!channelPolicy.enabled) return '渠道已关闭'
  if (channelPolicy.mode === 'all') return '全部安装包'
  return `${selectedCount} 个已选`
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="organization-package-market-toggle">
      <input
        aria-label={label}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
    </label>
  )
}

export function OrganizationPackageMarketPanel({
  catalog,
  catalogLoading,
  detail,
  error,
  onPolicyChange,
  onReset,
  onSave,
  policy,
  policySaving,
}: OrganizationPackageMarketPanelProps) {
  const [activeChannel, setActiveChannel] = useState<OrganizationPackageMarketChannel>('release')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OrganizationPackageMarketCategory>('all')
  const [onlySelected, setOnlySelected] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<OrganizationPackageMarketPageSize>(12)

  const channelPolicy = policy?.channels[activeChannel]
  const selectableRules = useMemo(
    () => selectableOrganizationPackageMarketRules(catalog, activeChannel),
    [activeChannel, catalog],
  )
  const selectedIds = channelPolicy?.ruleIds ?? emptyRuleIds
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCount = selectableRules.filter((rule) => selectedIdSet.has(rule.canonicalId)).length
  const filteredRules = useMemo(
    () => filterOrganizationPackageMarketRules(catalog, {
      category,
      channel: activeChannel,
      onlySelected,
      query,
      selectedIds,
    }),
    [activeChannel, catalog, category, onlySelected, query, selectedIds],
  )
  const pagedRules = useMemo(
    () => paginateOrganizationPackageMarketRules(filteredRules, page, pageSize),
    [filteredRules, page, pageSize],
  )
  const allFilteredSelected = filteredRules.length > 0 && filteredRules.every((rule) => selectedIdSet.has(rule.canonicalId))
  const selectedFilteredCount = filteredRules.filter((rule) => selectedIdSet.has(rule.canonicalId)).length
  const hasFilters = Boolean(query.trim()) || category !== 'all' || onlySelected
  const hasChanges = policy != null && !organizationPackageMarketPoliciesEqual(policy, detail.packageMarketPolicy)
  const canEdit = detail.canManage
  const marketEnabled = policy?.enabled ?? false
  const channelEnabled = channelPolicy?.enabled ?? false
  const selectionDisabled = !canEdit || policySaving || !marketEnabled || !channelEnabled
  const releaseSelectedCount = policy
    ? selectableOrganizationPackageMarketRules(catalog, 'release')
      .filter((rule) => policy.channels.release.ruleIds.includes(rule.canonicalId)).length
    : 0
  const ciSelectedCount = policy
    ? selectableOrganizationPackageMarketRules(catalog, 'ci')
      .filter((rule) => policy.channels.ci.ruleIds.includes(rule.canonicalId)).length
    : 0

  useEffect(() => {
    setPage(1)
  }, [activeChannel, category, onlySelected, pageSize, query])

  useEffect(() => {
    if (page !== pagedRules.page) setPage(pagedRules.page)
  }, [page, pagedRules.page])

  function updateChannel(
    patch: Partial<OrganizationPackageMarketPolicy['channels'][OrganizationPackageMarketChannel]>,
  ) {
    onPolicyChange((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [activeChannel]: { ...current.channels[activeChannel], ...patch },
      },
    }))
  }

  function toggleRule(ruleId: string) {
    updateChannel({ ruleIds: toggleOrganizationPackageMarketRule(selectedIds, ruleId) })
  }

  function selectAllFiltered() {
    if (filteredRules.length === 0) return
    const nextIds = new Set(selectedIds)
    filteredRules.forEach((rule) => nextIds.add(rule.canonicalId))
    updateChannel({ ruleIds: [...nextIds] })
  }

  function clearFilteredSelection() {
    if (selectedFilteredCount === 0) return
    const filteredIds = new Set(filteredRules.map((rule) => rule.canonicalId))
    updateChannel({ ruleIds: selectedIds.filter((id) => !filteredIds.has(id)) })
  }

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setOnlySelected(false)
  }

  if (!policy) {
    return (
      <section className="organization-package-market-panel" aria-busy="true">
        <div className="organization-package-market-loading">
          <CircleNotch className="organization-package-market-spinner" size={22} />
          <span>正在读取安装包市场配置...</span>
        </div>
      </section>
    )
  }

  return (
    <section className="organization-package-market-panel" aria-labelledby="organization-package-market-heading">
      <header className="organization-package-market-panel-header">
        <div className="organization-package-market-heading-copy">
          <div className="organization-package-market-title-line">
            <PackageIcon aria-hidden="true" size={21} weight="duotone" />
            <h2 id="organization-package-market-heading">安装包市场</h2>
          </div>
          <p>配置 {detail.name} 的市场入口、渠道和可见安装包。</p>
        </div>
        <div className="organization-package-market-status" aria-live="polite">
          <span className={marketEnabled ? 'is-on' : 'is-off'}>
            <i aria-hidden="true" />
            {marketEnabled ? '市场已启用' : '市场已关闭'}
          </span>
          <span className="organization-package-market-status-divider" aria-hidden="true" />
          <span>Release {releaseSelectedCount} · CI {ciSelectedCount}</span>
          {hasChanges ? <em>有未保存的更改</em> : null}
        </div>
      </header>

      {error ? <div className="organization-error" role="alert">{error}</div> : null}

      <div className="organization-package-market-layout">
        <aside className="organization-package-market-policy-rail" aria-label="安装包市场策略">
          <div className="organization-package-market-master">
            <div>
              <strong>启用市场</strong>
              <span>关闭后，组织成员无法进入市场。</span>
            </div>
            <Toggle
              checked={policy.enabled}
              disabled={!canEdit || policySaving}
              label="启用安装包市场"
              onChange={(enabled) => onPolicyChange((current) => ({ ...current, enabled }))}
            />
          </div>

          <div className="organization-package-market-channel-section">
            <div className="organization-package-market-section-label">渠道状态</div>
            <div className="organization-package-market-channel-list" role="group" aria-label="安装包市场渠道">
              {channels.map((channel) => {
                const itemPolicy = policy.channels[channel]
                const itemSelectableRules = selectableOrganizationPackageMarketRules(catalog, channel)
                const itemSelectedCount = itemSelectableRules.filter((rule) => itemPolicy.ruleIds.includes(rule.canonicalId)).length
                return (
                  <div
                    className={activeChannel === channel
                      ? 'organization-package-market-channel-row active'
                      : 'organization-package-market-channel-row'}
                    key={channel}
                  >
                    <button
                      aria-pressed={activeChannel === channel}
                      className="organization-package-market-channel-select"
                      type="button"
                      onClick={() => setActiveChannel(channel)}
                    >
                      <span className="organization-package-market-channel-mark" aria-hidden="true" />
                      <span>
                        <strong>{channelLabels[channel]}</strong>
                        <small>{channelDescriptions[channel]} · {policyChannelSummary(policy, channel, itemSelectedCount)}</small>
                      </span>
                    </button>
                    <Toggle
                      checked={itemPolicy.enabled}
                      disabled={!canEdit || policySaving}
                      label={`启用${channelLabels[channel]}渠道`}
                      onChange={(enabled) => onPolicyChange((current) => ({
                        ...current,
                        channels: {
                          ...current.channels,
                          [channel]: { ...current.channels[channel], enabled },
                        },
                      }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="organization-package-market-policy-note">
            <Info aria-hidden="true" size={15} />
            <p>指定模式的选择会跨页保留。依赖包跟随其父安装包，不需要单独选择。</p>
          </div>
        </aside>

        <section className="organization-package-market-catalog" aria-labelledby="organization-package-market-catalog-heading">
          <div className="organization-package-market-catalog-header">
            <div>
              <span className="organization-package-market-eyebrow">{channelLabels[activeChannel]} 渠道</span>
              <h3 id="organization-package-market-catalog-heading">{channelLabels[activeChannel]} 安装包目录</h3>
              <p>
                {channelPolicy?.mode === 'selected'
                  ? '仅勾选的安装包会出现在该渠道，选择状态会跨页保留。'
                  : '当前渠道对组织成员开放全部可用安装包。'}
              </p>
            </div>
            <div className="organization-package-market-catalog-count">
              {channelPolicy?.mode === 'selected'
                ? `${selectedCount} / ${selectableRules.length} 个已选`
                : `${selectableRules.length} 个可用`}
            </div>
          </div>

          <div className="organization-package-market-mode-row">
            <div className="organization-package-market-mode-copy">
              <label htmlFor="organization-package-market-mode">成员可见范围</label>
              <p id="organization-package-market-mode-help">
                决定成员进入 {channelLabels[activeChannel]} 渠道后可以浏览哪些安装包。
              </p>
            </div>
            <div className="organization-package-market-mode-control">
              <Select
                value={channelPolicy?.mode ?? 'all'}
                onValueChange={(value) => updateChannel({ mode: value as OrganizationPackageMarketSelectionMode })}
                disabled={!canEdit || policySaving || !channelEnabled}
              >
                <SelectTrigger
                  id="organization-package-market-mode"
                  aria-describedby="organization-package-market-mode-help"
                  aria-label={`${channelLabels[activeChannel]}成员可见范围`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{selectionModeLabels.all}</SelectItem>
                  <SelectItem value="selected">{selectionModeLabels.selected}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {channelPolicy?.mode === 'selected' ? (
            <>
              <div className="organization-package-market-filters">
                <div className="organization-package-market-search">
                  <MagnifyingGlass aria-hidden="true" size={16} />
                  <Input
                    aria-label="搜索安装包名称或 ID"
                    placeholder="搜索安装包名称或 ID"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Select value={category} onValueChange={(value) => setCategory(value as OrganizationPackageMarketCategory)}>
                  <SelectTrigger aria-label="筛选安装包分类"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    {(['apps', 'middleware'] as const).map((option) => (
                      <SelectItem key={option} value={option}>{categoryLabels[option]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  aria-pressed={onlySelected}
                  className={onlySelected ? 'organization-package-market-filter-button active' : 'organization-package-market-filter-button'}
                  disabled={selectionDisabled}
                  type="button"
                  variant="outline"
                  onClick={() => setOnlySelected((current) => !current)}
                >
                  <Funnel aria-hidden="true" size={15} /> 仅看已选
                </Button>
                <Button
                  aria-label="清除安装包筛选"
                  className="organization-package-market-clear-button"
                  disabled={!hasFilters}
                  size="icon"
                  title="清除筛选"
                  type="button"
                  variant="ghost"
                  onClick={clearFilters}
                >
                  <X aria-hidden="true" size={16} />
                </Button>
              </div>

              <div className="organization-package-market-selection-toolbar">
                <span>
                  {filteredRules.length === selectableRules.length
                    ? `共 ${selectableRules.length} 个可选择安装包`
                    : `当前筛选 ${filteredRules.length} 个`}
                </span>
                <div>
                  <Button
                    disabled={selectionDisabled || allFilteredSelected || filteredRules.length === 0}
                    type="button"
                    variant="ghost"
                    onClick={selectAllFiltered}
                  >
                    <CheckSquare aria-hidden="true" size={15} /> 全选当前筛选结果
                  </Button>
                  <Button
                    disabled={selectionDisabled || selectedFilteredCount === 0}
                    type="button"
                    variant="ghost"
                    onClick={clearFilteredSelection}
                  >
                    清除当前筛选
                  </Button>
                </div>
              </div>

              <div className="organization-package-market-rule-list" aria-busy={catalogLoading} role="list">
                {catalogLoading ? (
                  <div className="organization-package-market-list-state" role="listitem">
                    <CircleNotch className="organization-package-market-spinner" size={20} />
                    <span>正在读取安装包目录...</span>
                  </div>
                ) : pagedRules.items.length > 0 ? (
                  pagedRules.items.map((rule) => {
                    const selected = selectedIdSet.has(rule.canonicalId)
                    return (
                      <label
                        className={selected
                          ? 'organization-package-market-rule selected'
                          : 'organization-package-market-rule'}
                        key={`${activeChannel}-${rule.canonicalId}`}
                        role="listitem"
                      >
                        <input
                          aria-label={`选择${rule.name}`}
                          checked={selected}
                          disabled={selectionDisabled}
                          type="checkbox"
                          onChange={() => toggleRule(rule.canonicalId)}
                        />
                        <span className="organization-package-market-rule-check" aria-hidden="true" />
                        <span className="organization-package-market-rule-name">
                          <strong>{rule.name}</strong>
                          <small>{categoryLabels[rule.category]}</small>
                        </span>
                        <code>{rule.canonicalId}</code>
                      </label>
                    )
                  })
                ) : (
                  <div className="organization-package-market-list-state" role="listitem">
                    <PackageIcon aria-hidden="true" size={22} weight="duotone" />
                    <strong>{onlySelected ? '当前筛选没有已选安装包' : '没有匹配的安装包'}</strong>
                    <span>{hasFilters ? '调整搜索或筛选条件后再试。' : '当前目录没有可配置的安装包。'}</span>
                  </div>
                )}
              </div>

              <div className="organization-package-market-pagination">
                <div className="organization-package-market-page-size">
                  <span>每页</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value) as OrganizationPackageMarketPageSize)}
                  >
                    <SelectTrigger aria-label="选择每页安装包数量"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {organizationPackageMarketPageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="organization-package-market-page-controls">
                  <span>第 {pagedRules.page} / {pagedRules.totalPages} 页</span>
                  <Button
                    aria-label="上一页"
                    disabled={pagedRules.page <= 1}
                    size="icon"
                    title="上一页"
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <CaretLeft aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label="下一页"
                    disabled={pagedRules.page >= pagedRules.totalPages}
                    size="icon"
                    title="下一页"
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => Math.min(pagedRules.totalPages, current + 1))}
                  >
                    <CaretRight aria-hidden="true" size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="organization-package-market-all-mode">
              <PackageIcon aria-hidden="true" size={28} weight="duotone" />
              <strong>该渠道显示全部安装包</strong>
              <span>如果只需要开放部分安装包，将显示模式切换为“仅显示指定安装包”。</span>
            </div>
          )}
        </section>
      </div>

      <footer className="organization-package-market-save-bar">
        <div>
          <strong>
            {channelPolicy?.mode === 'selected'
              ? `当前渠道已选择 ${selectedCount} 个安装包`
              : '当前渠道显示全部安装包'}
          </strong>
          <span>{hasChanges ? '保存后才会应用到组织成员和项目选择器。' : '当前配置已保存。'}</span>
        </div>
        <div>
          <Button
            disabled={!hasChanges || policySaving || !canEdit}
            type="button"
            variant="outline"
            onClick={onReset}
          >
            <ArrowCounterClockwise aria-hidden="true" size={16} /> 恢复已保存
          </Button>
          <Button
            className="solid-button"
            disabled={!hasChanges || policySaving || !canEdit}
            type="button"
            onClick={onSave}
          >
            {policySaving ? <CircleNotch className="organization-package-market-spinner" aria-hidden="true" size={16} /> : null}
            {policySaving ? '保存中...' : '保存市场设置'}
          </Button>
        </div>
      </footer>
    </section>
  )
}
