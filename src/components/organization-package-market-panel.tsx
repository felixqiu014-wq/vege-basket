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
  OrganizationPackageMarketRuleOverride,
  OrganizationPackageMarketSelectionMode,
} from '../../shared/organization-package-market'
import {
  canonicalPackageMarketRuleId,
  defaultOrganizationPackageMarketPolicy,
  isPackageMarketRuleVisible,
  packageMarketDependencyChannel,
  packageMarketRuleSupportsChannel,
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

const categoryLabels: Record<string, string> = {
  apps: '应用',
  dependency: '依赖',
  middleware: '中间件',
}

function packageMarketCategoryCode(rule: OrganizationPackageMarketCatalogRule) {
  return rule.pageKind?.code ?? rule.category
}

function packageMarketCategoryLabel(rule: OrganizationPackageMarketCatalogRule) {
  return rule.pageKind?.labelZh ?? categoryLabels[rule.category] ?? rule.category
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
        aria-checked={checked}
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
  const [onlyClosedComponents, setOnlyClosedComponents] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<OrganizationPackageMarketPageSize>(organizationPackageMarketPageSizes[0])

  const selectableRules = useMemo(
    () => selectableOrganizationPackageMarketRules(catalog),
    [catalog],
  )
  const configuredRuleIds = policy?.selection.ruleIds ?? emptyRuleIds
  const effectivePolicy = policy ?? defaultOrganizationPackageMarketPolicy
  const configuredRuleIdSet = useMemo(() => new Set(configuredRuleIds), [configuredRuleIds])
  const configuredCount = selectableRules.filter((rule) => configuredRuleIdSet.has(rule.canonicalId)).length
  const categoryOptions = useMemo(() => {
    const groups = new Map<string, string>()
    selectableRules.forEach((rule) => {
      const code = packageMarketCategoryCode(rule)
      if (!groups.has(code)) groups.set(code, packageMarketCategoryLabel(rule))
    })
    return [...groups].map(([code, label]) => ({ code, label }))
  }, [selectableRules])
  const isExclusionMode = policy?.selection.mode === 'excluded'
  const configuredLabel = isExclusionMode ? '已禁止' : '已选'
  const ruleActionLabel = isExclusionMode ? '禁止' : '选择'
  const componentRules = useMemo(() => filterOrganizationPackageMarketRules(catalog, {
    category,
    query,
    onlySelected: onlyConfigured && policy?.selection.mode !== 'all',
    selectedIds: configuredRuleIds,
  }), [catalog, category, configuredRuleIds, onlyConfigured, policy?.selection.mode, query])
  const dependencyRulesByParent = useMemo(() => {
    const grouped = new Map<string, OrganizationPackageMarketCatalogRule[]>()
    catalog.forEach((rule) => {
      if (rule.category !== 'dependency' || !rule.parent) return
      const parent = canonicalPackageMarketRuleId(rule.parent)
      const current = grouped.get(parent) ?? []
      current.push(rule)
      grouped.set(parent, current)
    })
    return grouped
  }, [catalog])

  function ruleSupportsChannel(
    rule: OrganizationPackageMarketCatalogRule,
    channel: OrganizationPackageMarketChannel,
  ) {
    const dependencyChannel = packageMarketDependencyChannel(rule)
    return rule.category === 'dependency'
      ? dependencyChannel === channel
      : packageMarketRuleSupportsChannel(rule.canonicalId, channel)
  }

  function ruleStatus(rule: OrganizationPackageMarketCatalogRule) {
    const supportedChannels = channels.filter((channel) => ruleSupportsChannel(rule, channel))
    const visibleCount = supportedChannels.filter((channel) => (
      isPackageMarketRuleVisible(rule, effectivePolicy, channel)
    )).length
    if (visibleCount === 0) return 'closed' as const
    return visibleCount === supportedChannels.length ? 'available' as const : 'partial' as const
  }

  const componentTableRules = componentRules.filter((rule) => (
    !onlyClosedComponents || ruleStatus(rule) === 'closed'
  ))
  const pagedComponentRules = paginateOrganizationPackageMarketRules(componentTableRules, page, pageSize)
  const filteredRuleIdSet = new Set(componentTableRules.map((rule) => rule.canonicalId))
  const allFilteredConfigured = componentTableRules.length > 0 && componentTableRules.every((rule) => configuredRuleIdSet.has(rule.canonicalId))
  const configuredFilteredCount = componentTableRules.filter((rule) => configuredRuleIdSet.has(rule.canonicalId)).length
  const wouldExcludeEverySelectable = isExclusionMode && selectableRules.length > 0 && selectableRules.every((rule) => (
    configuredRuleIdSet.has(rule.canonicalId) || filteredRuleIdSet.has(rule.canonicalId)
  ))
  const hasFilters = Boolean(query.trim()) || category !== 'all' || (onlyConfigured && policy?.selection.mode !== 'all') || onlyClosedComponents
  const hasChanges = policy != null && !organizationPackageMarketPoliciesEqual(policy, detail.packageMarketPolicy)
  const canEdit = detail.canManage
  const marketEnabled = policy?.enabled ?? false
  const hasEnabledChannel = channels.some((channel) => policy?.channels[channel].enabled)
  const selectionDisabled = !canEdit || policySaving

  useEffect(() => {
    setPage(1)
  }, [category, onlyClosedComponents, onlyConfigured, pageSize, query])

  useEffect(() => {
    if (page !== pagedComponentRules.page) setPage(pagedComponentRules.page)
  }, [page, pagedComponentRules.page])

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
    if (componentTableRules.length === 0 || policy?.selection.mode === 'all') return
    const nextIds = new Set(configuredRuleIds)
    componentTableRules.forEach((rule) => nextIds.add(rule.canonicalId))
    updateSelection({ ruleIds: [...nextIds] })
  }

  function clearFilteredRules() {
    if (configuredFilteredCount === 0) return
    const filteredIds = new Set(componentTableRules.map((rule) => rule.canonicalId))
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
    setOnlyClosedComponents(false)
  }

  function updateRuleOverride(
    ruleId: string,
    channel: OrganizationPackageMarketChannel,
    enabled: boolean,
  ) {
    onPolicyChange((current) => {
      const canonicalRuleId = canonicalPackageMarketRuleId(ruleId)
      const currentOverride = current.ruleOverrides.find((override) => (
        override.ruleId === canonicalRuleId && override.channel === channel
      ))
      const ruleOverrides: OrganizationPackageMarketRuleOverride[] = currentOverride
        ? current.ruleOverrides.map((override) => (
          override === currentOverride ? { ...override, enabled } : override
        ))
        : [...current.ruleOverrides, { channel, enabled, ruleId: canonicalRuleId }]
      return { ...current, ruleOverrides }
    })
  }

  function resetRuleOverride(ruleId: string, channel: OrganizationPackageMarketChannel) {
    onPolicyChange((current) => ({
      ...current,
      ruleOverrides: current.ruleOverrides.filter((override) => !(
        canonicalPackageMarketRuleId(override.ruleId) === canonicalPackageMarketRuleId(ruleId)
          && override.channel === channel
      )),
    }))
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

          <div className="organization-package-market-dependency-toggle">
            <div>
              <strong>显示依赖组件</strong>
              <small>在组件详情中展示关联的运行时与附属包。</small>
            </div>
            <Toggle
              checked={policy.showDependencies}
              disabled={!canEdit || policySaving}
              label="显示依赖组件"
              onChange={(showDependencies) => onPolicyChange((current) => ({ ...current, showDependencies }))}
            />
          </div>
          <div className="organization-package-market-policy-note">
            <Info aria-hidden="true" size={15} />
            <p>市场和渠道总开关优先于组件设置。未单独配置的顶级组件继续继承成员可见范围；依赖组件始终受父组件约束。</p>
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

          <section className="organization-package-market-component-settings" aria-labelledby="organization-package-market-component-settings-heading">
            <div className="organization-package-market-component-settings-heading">
              <div>
                <h3 id="organization-package-market-component-settings-heading">组件可见渠道</h3>
                <p>统一管理成员范围与 Release、CI 渠道。渠道开关默认继承成员范围，单独配置后可覆盖，恢复默认即可撤销覆盖。</p>
              </div>
            </div>
            <div className="organization-package-market-filters">
              <div className="organization-package-market-search">
                <MagnifyingGlass aria-hidden="true" size={16} />
                <Input
                  aria-label="搜索组件名称或 ID"
                  placeholder="搜索组件名称或 ID"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Select value={category} onValueChange={(value) => setCategory(value as OrganizationPackageMarketCategory)}>
                <SelectTrigger aria-label="筛选组件分类"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                aria-pressed={onlyClosedComponents}
                className={onlyClosedComponents ? 'organization-package-market-filter-button active' : 'organization-package-market-filter-button'}
                disabled={selectionDisabled}
                type="button"
                variant="outline"
                onClick={() => setOnlyClosedComponents((current) => !current)}
              >
                <Funnel aria-hidden="true" size={15} /> 仅看已关闭
              </Button>
              <Button
                aria-pressed={onlyConfigured}
                className={onlyConfigured ? 'organization-package-market-filter-button active' : 'organization-package-market-filter-button'}
                disabled={selectionDisabled || policy.selection.mode === 'all'}
                type="button"
                variant="outline"
                onClick={() => setOnlyConfigured((current) => !current)}
              >
                <CheckSquare aria-hidden="true" size={15} /> 仅看{configuredLabel}
              </Button>
              <Button
                aria-label="清除组件筛选"
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
                {componentTableRules.length === selectableRules.length
                  ? `共 ${selectableRules.length} 个顶级组件`
                  : `当前筛选 ${componentTableRules.length} 个组件`}
              </span>
              <div>
                <Button
                  disabled={selectionDisabled || policy.selection.mode === 'all' || allFilteredConfigured || componentTableRules.length === 0 || wouldExcludeEverySelectable}
                  type="button"
                  variant="ghost"
                  onClick={selectAllFiltered}
                >
                  <CheckSquare aria-hidden="true" size={15} /> {isExclusionMode ? '禁止当前筛选' : '加入当前范围'}
                </Button>
                <Button
                  disabled={selectionDisabled || policy.selection.mode === 'all' || configuredFilteredCount === 0}
                  type="button"
                  variant="ghost"
                  onClick={clearFilteredRules}
                >
                  {isExclusionMode ? '取消禁止当前筛选' : '移出当前范围'}
                </Button>
              </div>
            </div>
            <div className="organization-package-market-component-summary">
              <span>{policy.selection.mode === 'all' ? '成员范围：全部组件' : `${configuredCount} 个组件已${isExclusionMode ? '禁止' : '加入范围'}`}</span>
              <span><i className="available" />可用 <i className="closed" />已关闭 <i className="dependency" />依赖</span>
            </div>
            <div className="organization-package-market-component-table" aria-busy={catalogLoading}>
              <div className="organization-package-market-component-table-head">
                <span>组件</span><span>类型</span><span>成员范围</span><span>Release</span><span>CI</span><span>状态</span>
              </div>
              {catalogLoading ? (
                <div className="organization-package-market-list-state">
                  <CircleNotch className="organization-package-market-spinner" size={20} />
                  <span>正在读取安装包目录...</span>
                </div>
              ) : pagedComponentRules.items.length > 0 ? pagedComponentRules.items.map((rule) => {
                const dependencies = dependencyRulesByParent.get(rule.canonicalId) ?? []
                const status = ruleStatus(rule)
                const statusLabel = status === 'available' ? '可用' : status === 'partial' ? '部分可用' : '已关闭'
                const configured = policy.selection.mode === 'all' || configuredRuleIdSet.has(rule.canonicalId)
                const preventsLastExclusion = isExclusionMode && !configured && configuredCount >= selectableRules.length - 1
                return (
                  <div className="organization-package-market-component-group" key={rule.canonicalId}>
                    <div className="organization-package-market-component-row">
                      <div className="organization-package-market-component-identity">
                        <PackageIcon aria-hidden="true" size={20} weight="duotone" />
                        <span><strong>{rule.name}</strong><small>{rule.canonicalId}</small></span>
                      </div>
                      <span className="organization-package-market-component-type">{packageMarketCategoryLabel(rule)}</span>
                      <label className="organization-package-market-component-range">
                        <input
                          aria-label={policy.selection.mode === 'all'
                            ? `${rule.name}成员范围为全部`
                            : `${configured ? '移出' : ruleActionLabel}${rule.name}的成员范围`}
                          checked={configured}
                          disabled={selectionDisabled || policy.selection.mode === 'all' || preventsLastExclusion}
                          type="checkbox"
                          onChange={() => toggleRule(rule.canonicalId)}
                        />
                        <span aria-hidden="true" />
                        <small>{policy.selection.mode === 'all' ? '继承全部' : configured ? (isExclusionMode ? '已禁止' : '已加入') : '未配置'}</small>
                      </label>
                      {channels.map((channel) => {
                        const override = policy.ruleOverrides.find((item) => item.ruleId === rule.canonicalId && item.channel === channel)
                        const supported = ruleSupportsChannel(rule, channel)
                        const visible = isPackageMarketRuleVisible(rule, policy, channel)
                        return supported ? (
                          <div className="organization-package-market-component-channel" key={channel}>
                            <Toggle
                              checked={visible}
                              disabled={selectionDisabled || !policy.enabled || !policy.channels[channel].enabled}
                              label={`${rule.name} ${channelLabels[channel]} ${visible ? '开放' : '关闭'}`}
                              onChange={(enabled) => updateRuleOverride(rule.canonicalId, channel, enabled)}
                            />
                            <span>{visible ? '开放' : '关闭'}</span>
                            {override ? (
                              <button
                                aria-label={`恢复${rule.name} ${channelLabels[channel]}默认范围`}
                                className="organization-package-market-reset-override"
                                disabled={selectionDisabled}
                                title="恢复默认范围"
                                type="button"
                                onClick={() => resetRuleOverride(rule.canonicalId, channel)}
                              >
                                <ArrowCounterClockwise aria-hidden="true" size={14} />
                              </button>
                            ) : null}
                          </div>
                        ) : <div className="organization-package-market-component-channel unavailable" key={channel}>不适用</div>
                      })}
                      <span className={`organization-package-market-component-status ${status}`}>{statusLabel}</span>
                    </div>
                    {dependencies.length > 0 ? (
                      <div className="organization-package-market-dependency-group">
                        <div className="organization-package-market-dependency-heading">依赖组件 {dependencies.length} 个 · 由父组件控制</div>
                        {dependencies.map((dependency) => {
                          const dependencyChannel = packageMarketDependencyChannel(dependency)
                          if (!dependencyChannel) return null
                          const visible = isPackageMarketRuleVisible(dependency, policy, dependencyChannel)
                          const override = policy.ruleOverrides.find((item) => (
                            item.ruleId === dependency.canonicalId && item.channel === dependencyChannel
                          ))
                          const dependencyStatus = policy.showDependencies
                            ? visible ? '可用' : '已关闭'
                            : '依赖组件隐藏'
                          return (
                            <div className="organization-package-market-component-row dependency" key={dependency.canonicalId}>
                              <div className="organization-package-market-component-identity">
                                <PackageIcon aria-hidden="true" size={18} weight="duotone" />
                                <span><strong>{dependency.name}</strong><small>由 {rule.name} 提供 · {dependency.canonicalId}</small></span>
                              </div>
                              <span className="organization-package-market-dependency-type">依赖 · {channelLabels[dependencyChannel]}</span>
                              <span className="organization-package-market-component-range inherited">继承父组件</span>
                              {channels.map((channel) => channel === dependencyChannel ? (
                                <div className="organization-package-market-component-channel" key={channel}>
                                  <Toggle
                                    checked={visible}
                                    disabled={selectionDisabled || !policy.enabled || !policy.channels[dependencyChannel].enabled || !policy.showDependencies}
                                    label={`${dependency.name} ${channelLabels[channel]} ${visible ? '开放' : '关闭'}`}
                                    onChange={(enabled) => updateRuleOverride(dependency.canonicalId, dependencyChannel, enabled)}
                                  />
                                  <span>{visible ? '开放' : '关闭'}</span>
                                  {override ? (
                                    <button
                                      aria-label={`恢复${dependency.name} ${channelLabels[channel]}默认范围`}
                                      className="organization-package-market-reset-override"
                                      disabled={selectionDisabled}
                                      title="恢复默认范围"
                                      type="button"
                                      onClick={() => resetRuleOverride(dependency.canonicalId, dependencyChannel)}
                                    >
                                      <ArrowCounterClockwise aria-hidden="true" size={14} />
                                    </button>
                                  ) : null}
                                </div>
                              ) : <div className="organization-package-market-component-channel unavailable" key={channel}>不适用</div>)}
                              <span className={`organization-package-market-component-status ${visible ? 'available' : 'closed'}`}>{dependencyStatus}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              }) : (
                <div className="organization-package-market-list-state">
                  <PackageIcon aria-hidden="true" size={22} weight="duotone" />
                  <strong>没有匹配的组件</strong>
                  <span>调整搜索、分类或“仅看已关闭”筛选后再试。</span>
                </div>
              )}
            </div>
            {!catalogLoading && pagedComponentRules.totalItems > 0 ? (
              <div className="organization-package-market-pagination">
                <div className="organization-package-market-page-size">
                  <span>每页</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value) as OrganizationPackageMarketPageSize)}
                  >
                    <SelectTrigger aria-label="选择每页组件数量"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {organizationPackageMarketPageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="organization-package-market-page-controls">
                  <span>第 {pagedComponentRules.page} / {pagedComponentRules.totalPages} 页</span>
                  <Button
                    aria-label="上一页"
                    disabled={pagedComponentRules.page <= 1}
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
                    disabled={pagedComponentRules.page >= pagedComponentRules.totalPages}
                    size="icon"
                    title="下一页"
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => Math.min(pagedComponentRules.totalPages, current + 1))}
                  >
                    <CaretRight aria-hidden="true" size={16} />
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </section>
  )
}
