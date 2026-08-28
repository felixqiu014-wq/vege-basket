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
  excluded: '仅禁止指定安装包',
  selected: '仅显示指定安装包',
}

const emptyRuleIds: string[] = []

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
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OrganizationPackageMarketCategory>('all')
  const [onlyConfigured, setOnlyConfigured] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<OrganizationPackageMarketPageSize>(12)

  const selectableRules = useMemo(
    () => selectableOrganizationPackageMarketRules(catalog),
    [catalog],
  )
  const configuredRuleIds = policy?.selection.ruleIds ?? emptyRuleIds
  const configuredRuleIdSet = useMemo(() => new Set(configuredRuleIds), [configuredRuleIds])
  const configuredCount = selectableRules.filter((rule) => configuredRuleIdSet.has(rule.canonicalId)).length
  const isExclusionMode = policy?.selection.mode === 'excluded'
  const configuredLabel = isExclusionMode ? '已禁止' : '已选'
  const ruleActionLabel = isExclusionMode ? '禁止' : '选择'
  const showsRuleSelector = policy?.selection.mode === 'selected' || isExclusionMode
  const filteredRules = useMemo(
    () => filterOrganizationPackageMarketRules(catalog, {
      category,
      onlySelected: onlyConfigured,
      query,
      selectedIds: configuredRuleIds,
    }),
    [catalog, category, configuredRuleIds, onlyConfigured, query],
  )
  const pagedRules = useMemo(
    () => paginateOrganizationPackageMarketRules(filteredRules, page, pageSize),
    [filteredRules, page, pageSize],
  )
  const filteredRuleIdSet = useMemo(
    () => new Set(filteredRules.map((rule) => rule.canonicalId)),
    [filteredRules],
  )
  const allFilteredConfigured = filteredRules.length > 0 && filteredRules.every((rule) => configuredRuleIdSet.has(rule.canonicalId))
  const configuredFilteredCount = filteredRules.filter((rule) => configuredRuleIdSet.has(rule.canonicalId)).length
  const wouldExcludeEverySelectable = isExclusionMode && selectableRules.length > 0 && selectableRules.every((rule) => (
    configuredRuleIdSet.has(rule.canonicalId) || filteredRuleIdSet.has(rule.canonicalId)
  ))
  const hasFilters = Boolean(query.trim()) || category !== 'all' || onlyConfigured
  const hasChanges = policy != null && !organizationPackageMarketPoliciesEqual(policy, detail.packageMarketPolicy)
  const canEdit = detail.canManage
  const marketEnabled = policy?.enabled ?? false
  const hasEnabledChannel = channels.some((channel) => policy?.channels[channel].enabled)
  const selectionDisabled = !canEdit || policySaving

  useEffect(() => {
    setPage(1)
  }, [category, onlyConfigured, pageSize, query])

  useEffect(() => {
    if (page !== pagedRules.page) setPage(pagedRules.page)
  }, [page, pagedRules.page])

  function updateSelection(
    patch: Partial<OrganizationPackageMarketPolicy['selection']>,
  ) {
    onPolicyChange((current) => ({
      ...current,
      selection: { ...current.selection, ...patch },
    }))
  }

  function toggleRule(ruleId: string) {
    updateSelection({ ruleIds: toggleOrganizationPackageMarketRule(configuredRuleIds, ruleId) })
  }

  function selectAllFiltered() {
    if (filteredRules.length === 0) return
    const nextIds = new Set(configuredRuleIds)
    filteredRules.forEach((rule) => nextIds.add(rule.canonicalId))
    updateSelection({ ruleIds: [...nextIds] })
  }

  function clearFilteredRules() {
    if (configuredFilteredCount === 0) return
    const filteredIds = new Set(filteredRules.map((rule) => rule.canonicalId))
    updateSelection({ ruleIds: configuredRuleIds.filter((id) => !filteredIds.has(id)) })
  }

  function updateSelectionMode(mode: OrganizationPackageMarketSelectionMode) {
    if (policy?.selection.mode === mode) return
    updateSelection({ mode, ruleIds: [] })
  }

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setOnlyConfigured(false)
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
    <section className="organization-package-market-panel">
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
                return (
                  <div className="organization-package-market-channel-toggle-row" key={channel}>
                    <div>
                      <strong>{channelLabels[channel]}</strong>
                      <small>{channelDescriptions[channel]}</small>
                    </div>
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
            <p>可见范围同时作用于已开启渠道。CI 不支持的安装包不会在 CI 中出现，依赖包跟随其父安装包。</p>
          </div>
        </aside>

        <section
          className="organization-package-market-catalog"
          id="organization-package-market-catalog-panel"
          aria-labelledby="organization-package-market-catalog-heading"
        >
          <div className="organization-package-market-catalog-header">
            <div className="organization-package-market-catalog-copy">
              <span className="organization-package-market-eyebrow">成员访问范围</span>
              <h2 id="organization-package-market-catalog-heading">安装包可见范围</h2>
              <p>
                {!marketEnabled
                  ? '市场当前关闭；此处的配置会保留，重新开启后生效。'
                  : !hasEnabledChannel
                    ? 'Release 和 CI 均已关闭；可先完成范围配置后再开启渠道。'
                    : policy.selection.mode === 'selected'
                      ? '仅勾选的安装包会出现在已开启渠道，选择状态会跨页保留。'
                      : isExclusionMode
                        ? '除已禁止的安装包外，所有已开启渠道都对组织成员开放可用安装包。'
                        : '所有已开启渠道都对组织成员开放可用安装包。'}
              </p>
            </div>
            <div className="organization-package-market-header-actions">
              <div className="organization-package-market-header-summary">
                <span className="organization-package-market-catalog-count">
                  {policy.selection.mode === 'selected'
                    ? `${configuredCount} / ${selectableRules.length} 个已选`
                    : isExclusionMode
                      ? `${configuredCount} / ${selectableRules.length} 个已禁止`
                      : `${selectableRules.length} 个可用`}
                </span>
                <span aria-live="polite" className="organization-package-market-save-state">
                  {hasChanges ? '有未保存的更改' : '当前配置已保存'}
                </span>
              </div>
              <div className="organization-package-market-header-buttons">
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
            </div>
          </div>

          <div className="organization-package-market-mode-row">
            <div className="organization-package-market-mode-copy">
              <label htmlFor="organization-package-market-mode">成员可见范围</label>
              <p id="organization-package-market-mode-help">
                决定成员进入已开启渠道后可以浏览哪些安装包。切换范围会清空当前指定列表。
              </p>
            </div>
            <div className="organization-package-market-mode-control">
              <Select
                value={policy.selection.mode}
                onValueChange={(value) => updateSelectionMode(value as OrganizationPackageMarketSelectionMode)}
                disabled={!canEdit || policySaving}
              >
                <SelectTrigger
                  id="organization-package-market-mode"
                  aria-describedby="organization-package-market-mode-help"
                  aria-label="成员可见范围"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{selectionModeLabels.all}</SelectItem>
                  <SelectItem value="selected">{selectionModeLabels.selected}</SelectItem>
                  <SelectItem value="excluded">{selectionModeLabels.excluded}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showsRuleSelector ? (
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
                  aria-pressed={onlyConfigured}
                  className={onlyConfigured ? 'organization-package-market-filter-button active' : 'organization-package-market-filter-button'}
                  disabled={selectionDisabled}
                  type="button"
                  variant="outline"
                  onClick={() => setOnlyConfigured((current) => !current)}
                >
                  <Funnel aria-hidden="true" size={15} /> 仅看{configuredLabel}
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
                    disabled={selectionDisabled || allFilteredConfigured || filteredRules.length === 0 || wouldExcludeEverySelectable}
                    type="button"
                    variant="ghost"
                    onClick={selectAllFiltered}
                  >
                    <CheckSquare aria-hidden="true" size={15} /> {isExclusionMode ? '禁止当前筛选结果' : '全选当前筛选结果'}
                  </Button>
                  <Button
                    disabled={selectionDisabled || configuredFilteredCount === 0}
                    type="button"
                    variant="ghost"
                    onClick={clearFilteredRules}
                  >
                    {isExclusionMode ? '取消禁止当前筛选' : '清除当前筛选'}
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
                    const configured = configuredRuleIdSet.has(rule.canonicalId)
                    const preventsLastExclusion = isExclusionMode && !configured && configuredCount >= selectableRules.length - 1
                    return (
                      <label
                        className={configured
                          ? `organization-package-market-rule ${isExclusionMode ? 'prohibited' : 'selected'}`
                          : 'organization-package-market-rule'}
                        key={rule.canonicalId}
                        role="listitem"
                      >
                        <input
                          aria-label={`${ruleActionLabel}${rule.name}`}
                          checked={configured}
                          disabled={selectionDisabled || preventsLastExclusion}
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
                    <strong>{onlyConfigured ? `当前筛选没有${configuredLabel}安装包` : '没有匹配的安装包'}</strong>
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
              <strong>当前范围显示全部安装包</strong>
              <span>如需限制范围，可切换为“仅显示指定安装包”或“仅禁止指定安装包”。</span>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
