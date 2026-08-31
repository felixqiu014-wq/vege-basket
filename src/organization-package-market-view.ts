import type { OrganizationPackageMarketPolicy } from '../shared/organization-package-market'
import type { OrganizationPackageMarketCatalogRule } from './organization-types'

export const organizationPackageMarketPageSizes = [12, 24, 48] as const
export type OrganizationPackageMarketPageSize = (typeof organizationPackageMarketPageSizes)[number]
export type OrganizationPackageMarketCategory = 'all' | OrganizationPackageMarketCatalogRule['category']

function packageMarketCategoryCode(rule: Pick<OrganizationPackageMarketCatalogRule, 'category' | 'pageKind'>) {
  return rule.pageKind?.code ?? rule.category
}

export function selectableOrganizationPackageMarketRules(
  rules: readonly OrganizationPackageMarketCatalogRule[],
) {
  return rules.filter((rule) => rule.selectable)
}

export function filterOrganizationPackageMarketRules(
  rules: readonly OrganizationPackageMarketCatalogRule[],
  options: {
    category?: OrganizationPackageMarketCategory
    onlySelected?: boolean
    query?: string
    selectedIds?: readonly string[]
  },
) {
  const query = options.query?.trim().toLocaleLowerCase() ?? ''
  const category = options.category ?? 'all'
  const selectedIds = new Set(options.selectedIds ?? [])
  return selectableOrganizationPackageMarketRules(rules).filter((rule) => {
    const matchesCategory = category === 'all' || packageMarketCategoryCode(rule) === category
    const matchesQuery = !query || [rule.name, rule.id, rule.canonicalId]
      .some((value) => value.toLocaleLowerCase().includes(query))
    const matchesSelection = !options.onlySelected || selectedIds.has(rule.canonicalId)
    return matchesCategory && matchesQuery && matchesSelection
  })
}

export function paginateOrganizationPackageMarketRules<T>(
  items: readonly T[],
  requestedPage: number,
  requestedPageSize: number,
) {
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
    ? requestedPageSize
    : organizationPackageMarketPageSizes[0]
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(Number.isSafeInteger(requestedPage) ? requestedPage : 1, 1), totalPages)
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
  }
}

export function toggleOrganizationPackageMarketRule(
  selectedIds: readonly string[],
  ruleId: string,
) {
  return selectedIds.includes(ruleId)
    ? selectedIds.filter((id) => id !== ruleId)
    : [...selectedIds, ruleId]
}

export function organizationPackageMarketPoliciesEqual(
  left: OrganizationPackageMarketPolicy,
  right: OrganizationPackageMarketPolicy,
) {
  if (left.enabled !== right.enabled) return false
  if (left.selection.mode !== right.selection.mode) return false
  if (
    [...left.selection.ruleIds].sort().join('\u0000') !==
    [...right.selection.ruleIds].sort().join('\u0000')
  ) return false
  return (['release', 'ci'] as const).every((channel) => (
    left.channels[channel].enabled === right.channels[channel].enabled
  ))
}
