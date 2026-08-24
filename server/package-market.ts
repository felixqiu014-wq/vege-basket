import OSS from 'ali-oss'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'

export type PackageMarketRule = {
  category: 'apps' | 'middleware' | 'dependency'
  ciFileNameFormats: string[]
  dependencyFilePatterns: string[]
  dependencyRoots: string[]
  fileNameFormats: string[]
  flatFileNamePrefix: string
  flatFileNameSuffix: string
  flatFileNameSuffixes: string[]
  flatFileRoots: string[]
  id: string
  mode: 'release' | 'flat' | 'mixed' | 'pro-middleware'
  name: string
  parent: string
  releaseRoots: string[]
}

export type PackageMarketLink = {
  downloadUrl: string
  expiresAt: string
  expiresInSeconds: number
  lastModified?: string
  name: string
  objectKey: string
  size?: number
  version: string
}

export type PackageMarketVersion = {
  hash?: string
  label: string
  lastModified?: string
  version?: string
}

export type PackageMarketCiBranch = {
  label: string
  name: string
}

export type PackageMarketDetail = {
  ciVersions?: PackageMarketVersion[]
  links: PackageMarketLink[]
  meta: Array<{ label: string; value: string }>
  releaseVersions?: PackageMarketVersion[]
  selectedHash?: string
  title: string
  type: string
}

type OssObject = {
  lastModified?: string
  lastModifiedTime?: string
  name: string
  size?: number
  LastModified?: string
}

const downloadExpireSeconds = Number(
  process.env.PACKAGE_MARKET_DOWNLOAD_EXPIRE_SECONDS ??
    process.env.OSS_UI_DOWNLOAD_EXPIRE_SECONDS ??
    30 * 60,
)
export const packageMarketExpireMinuteOptions = [30, 60, 90, 120, 300, 600] as const
export const packageMarketExpireMaxMinutes = 365 * 24 * 60
const defaultMiddlewareRoot = 'offline/sealos-pro/'
const middlewareRoots = normalizeList([
  process.env.PACKAGE_MARKET_MIDDLEWARE_ROOT,
  process.env.OSS_UI_MIDDLEWARE_ROOT,
  defaultMiddlewareRoot,
]).map(normalizePrefix)
const baseObjectTemplate = normalizeString(
  process.env.PACKAGE_MARKET_BASE_OBJECT_TEMPLATE ?? process.env.OSS_UI_BASE_OBJECT_TEMPLATE,
)
const baseListPrefixTemplate = normalizeString(
  process.env.PACKAGE_MARKET_BASE_LIST_PREFIX_TEMPLATE ??
    process.env.OSS_UI_BASE_LIST_PREFIX_TEMPLATE,
)
const serverDir = path.dirname(fileURLToPath(import.meta.url))
const bundledRulesFile = path.join(serverDir, 'trial-combo-package-rules.yaml')
const rulesFile = normalizeString(
  process.env.PACKAGE_MARKET_RULES_FILE ??
    process.env.TRIAL_COMBO_PACKAGE_RULES_FILE ??
    bundledRulesFile,
)

let cachedRules: PackageMarketRule[] | null = null
let cachedRulesMtimeMs = -1

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function normalizePrefix(value: unknown) {
  const normalized = normalizeString(value)
  return normalized && !normalized.endsWith('/') ? `${normalized}/` : normalized
}

export function normalizeOssEndpoint(value: unknown) {
  const rawEndpoint = normalizeString(value)
  if (!rawEndpoint) return ''
  const endpointWithProtocol = /^https?:\/\//i.test(rawEndpoint)
    ? rawEndpoint
    : `https://${rawEndpoint}`

  let endpoint: URL
  try {
    endpoint = new URL(endpointWithProtocol)
  } catch {
    throw new Error('OSS_ENDPOINT must be a valid HTTP or HTTPS endpoint')
  }
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.pathname && endpoint.pathname !== '/')
  ) {
    throw new Error('OSS_ENDPOINT must be an HTTP or HTTPS origin without credentials, path, query, or fragment')
  }
  if (
    endpoint.protocol === 'http:' &&
    endpoint.hostname.toLowerCase().endsWith('.aliyuncs.com')
  ) {
    endpoint.protocol = 'https:'
  }
  if (endpoint.protocol !== 'https:') {
    throw new Error('OSS_ENDPOINT must be an HTTPS origin without credentials, path, query, or fragment')
  }
  return endpoint.origin
}

function normalizeVersion(value: unknown) {
  const version = normalizeString(value).toLowerCase()
  if (!version || version === '无') return version
  return version.startsWith('v') ? version : `v${version}`
}

function normalizeList(values: unknown[]) {
  const seen = new Set<string>()
  const list: string[] = []
  for (const value of values) {
    const normalized = normalizeString(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    list.push(normalized)
  }
  return list
}

function renderTemplate(template: string, values: Record<string, string>) {
  return normalizeString(template).replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function templateMatcher(
  template: string,
  prefixOnly = false,
  fixedValues: Record<string, string> = {},
) {
  const normalized = normalizeString(template)
  if (!normalized) return null
  let pattern = ''
  let cursor = 0
  for (const match of normalized.matchAll(/\{(\w+)\}/g)) {
    const offset = match.index ?? 0
    pattern += escapeRegExp(normalized.slice(cursor, offset))
    pattern += match[1] in fixedValues ? escapeRegExp(fixedValues[match[1]]) : '[^/]+'
    cursor = offset + match[0].length
  }
  pattern += escapeRegExp(normalized.slice(cursor))
  return new RegExp(`^${pattern}${prefixOnly ? '' : '$'}`)
}

function splitVersionPart(part: string) {
  const match = String(part).match(/^([a-zA-Z]+)(\d+)$/)
  if (!match) return null
  return { prefix: match[1], number: Number(match[2]) }
}

function compareVersionParts(left: string, right: string) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) {
    return Math.sign(leftNumber - rightNumber)
  }

  const leftSplit = splitVersionPart(left)
  const rightSplit = splitVersionPart(right)
  if (leftSplit && rightSplit && leftSplit.prefix === rightSplit.prefix) {
    return Math.sign(leftSplit.number - rightSplit.number)
  }

  return left.localeCompare(right)
}

function compareVersions(left: string, right: string) {
  const leftTokens = normalizeVersion(left).replace(/^v/, '').split(/[._-]/)
  const rightTokens = normalizeVersion(right).replace(/^v/, '').split(/[._-]/)
  const max = Math.max(leftTokens.length, rightTokens.length)

  for (let index = 0; index < max; index += 1) {
    let leftToken = leftTokens[index] || ''
    let rightToken = rightTokens[index] || ''
    if (!leftToken && rightToken) {
      if (splitVersionPart(rightToken)) return 1
      leftToken = '0'
    }
    if (leftToken && !rightToken) {
      if (splitVersionPart(leftToken)) return -1
      rightToken = '0'
    }
    const compared = compareVersionParts(leftToken, rightToken)
    if (compared !== 0) return compared
  }

  return 0
}

function objectTime(object: OssObject) {
  const value = object.lastModified || object.lastModifiedTime || object.LastModified
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

export function formatPackageMarketTimestamp(value?: string) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'unknown time'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}

function versionLabel(item: { lastModified?: string; version: string }) {
  return item.lastModified
    ? `${normalizeVersion(item.version)} · ${formatPackageMarketTimestamp(item.lastModified)}`
    : normalizeVersion(item.version)
}

function formatCiLabel(item: { hash: string; lastModified?: string }) {
  return `${formatPackageMarketTimestamp(item.lastModified)} ${item.hash}`
}

function formatFileName(format: string, version: string, arch: string) {
  return normalizeString(format).replace('%s', version).replace('%s', arch)
}

function candidateFileNames(formats: string[], version: string, arch: string) {
  const names = new Set<string>()
  for (const format of formats) {
    const name = formatFileName(format, version, arch)
    if (!name) continue
    names.add(name)
    if (name.endsWith('.tar')) {
      names.add(`${name}.gz`)
    }
  }
  return [...names]
}

function isArchiveObjectKey(key: string) {
  return /\.tar(\.gz)?$/.test(key) && !key.endsWith('.md5')
}

function objectMatchesArch(fileName: string, arch: string) {
  if (fileName.includes(`-${arch}.tar`)) return true
  const otherArch = arch === 'amd64' ? 'arm64' : 'amd64'
  return !fileName.includes(`-${otherArch}.tar`)
}

export function matchesPackageMarketReleaseFileName(
  rule: Pick<PackageMarketRule, 'fileNameFormats'>,
  fileName: string,
  version: string,
  arch: string,
  includeAll = false,
) {
  const expectedNames = candidateFileNames(rule.fileNameFormats, version, arch)
  if (expectedNames.includes(fileName)) return true
  if (!includeAll) return false
  return Boolean(
    fileName &&
    !fileName.includes('/') &&
    isArchiveObjectKey(fileName) &&
    fileName.includes(version) &&
    objectMatchesArch(fileName, arch),
  )
}

export function matchesPackageMarketCiFileName(
  rule: Pick<PackageMarketRule, 'ciFileNameFormats' | 'fileNameFormats'>,
  fileName: string,
  hash: string,
  arch: string,
  includeAll = false,
) {
  const formats = rule.ciFileNameFormats.length > 0 ? rule.ciFileNameFormats : rule.fileNameFormats
  const expectedNames = candidateFileNames(formats, hash, arch)
  if (expectedNames.includes(fileName)) return true
  if (!includeAll) return false
  return Boolean(
    fileName &&
    !fileName.includes('/') &&
    isArchiveObjectKey(fileName) &&
    (fileName.includes(hash) || fileName.includes('latest') || fileName.includes('main')) &&
    objectMatchesArch(fileName, arch),
  )
}

function fileNameMatchesFormats(fileName: string, formats: string[], expectedFirstValue?: string) {
  return formats.some((format) => {
    const candidates = format.endsWith('.tar') ? [format, `${format}.gz`] : [format]
    return candidates.some((candidate) => {
      let pattern = ''
      let cursor = 0
      let placeholderCount = 0
      for (const match of candidate.matchAll(/%s/g)) {
        const offset = match.index ?? 0
        pattern += escapeRegExp(candidate.slice(cursor, offset))
        pattern += '([^/]+)'
        cursor = offset + match[0].length
        placeholderCount += 1
      }
      pattern += escapeRegExp(candidate.slice(cursor))
      const matched = fileName.match(new RegExp(`^${pattern}$`))
      if (!matched || placeholderCount === 0) return false
      return expectedFirstValue == null || matched[1] === expectedFirstValue
    })
  })
}

function releaseObjectMatches(
  rule: PackageMarketRule,
  root: string,
  object: OssObject,
  version: string,
  arch: string,
  includeAll = false,
) {
  const prefix = `${root}${version}/`
  if (!object.name.startsWith(prefix)) return false
  const fileName = object.name.slice(prefix.length)
  return matchesPackageMarketReleaseFileName(rule, fileName, version, arch, includeAll)
}

function flatObjectMatches(
  rule: PackageMarketRule,
  fileName: string,
  version: string,
  arch: string,
  includeAll = false,
) {
  return matchesPackageMarketReleaseFileName(rule, fileName, version, arch, includeAll)
}

function ciObjectMatches(
  rule: PackageMarketRule,
  fileName: string,
  hash: string,
  arch: string,
  includeAll = false,
) {
  return matchesPackageMarketCiFileName(rule, fileName, hash, arch, includeAll)
}

function ruleAllowsObjectKey(rule: PackageMarketRule, objectKey: string) {
  for (const root of rule.releaseRoots) {
    if (!objectKey.startsWith(root)) continue
    const [version, fileName, ...extra] = objectKey.slice(root.length).split('/')
    if (!version || !fileName || extra.length > 0) continue
    if (fileNameMatchesFormats(fileName, rule.fileNameFormats, normalizeVersion(version))) return true
  }

  for (const root of rule.flatFileRoots) {
    if (!objectKey.startsWith(root)) continue
    const fileName = objectKey.slice(root.length)
    if (fileName && !fileName.includes('/') && fileNameMatchesFormats(fileName, rule.fileNameFormats)) {
      return true
    }
  }

  for (const root of ciBaseRootsForRule(rule)) {
    if (!objectKey.startsWith(root)) continue
    const [branch, hash, fileName, ...extra] = objectKey.slice(root.length).split('/')
    const formats = rule.ciFileNameFormats.length > 0 ? rule.ciFileNameFormats : rule.fileNameFormats
    if (
      isValidCiBranch(branch) &&
      hash &&
      fileName &&
      extra.length === 0 &&
      fileNameMatchesFormats(fileName, formats, hash)
    ) {
      return true
    }
  }
  return false
}

function middlewareRootAllowsObjectKey(objectKey: string) {
  for (const root of middlewareRoots) {
    if (!objectKey.startsWith(root)) continue
    const parts = objectKey.slice(root.length).split('/')
    if (parts.length !== 2 && parts.length !== 3) continue
    const fileName = parts.at(-1) ?? ''
    if (
      parts.every(Boolean) &&
      isArchiveObjectKey(fileName) &&
      /-[a-zA-Z0-9._-]+\.tar(?:\.gz)?$/.test(fileName)
    ) {
      return true
    }
  }
  return false
}

function cacheClusterPackageAllowsObjectKey(objectKey: string) {
  const releaseMatch = objectKey.match(
    /^offline\/sealos-apps\/([a-zA-Z0-9._-]+)\/releases?\/([^/]+)\/([^/]+)$/,
  )
  if (releaseMatch) {
    const [, packageName, rawVersion, fileName] = releaseMatch
    const version = normalizeVersion(rawVersion)
    if (!packageName || !version || !fileName) return false

    return new RegExp(
      `^${escapeRegExp(packageName)}-[a-zA-Z0-9._-]+-cache-cluster-${escapeRegExp(version)}\\.tar(?:\\.gz)?$`,
    ).test(fileName)
  }

  const ciMatch = objectKey.match(
    /^offline\/sealos-apps\/([a-zA-Z0-9._-]+)\/ci\/main\/([a-zA-Z0-9._-]+)\/([^/]+)$/,
  )
  if (!ciMatch) return false

  const [, packageName, rawHash, fileName] = ciMatch
  const hash = normalizeString(rawHash)
  if (!packageName || !hash || !fileName) return false

  return new RegExp(
    `^${escapeRegExp(packageName)}-[a-zA-Z0-9._-]+-cache-cluster-(?:main|latest)-${escapeRegExp(hash)}\\.tar(?:\\.gz)?$`,
  ).test(fileName)
}

export function isSafePackageMarketObjectKey(value: unknown) {
  const objectKey = normalizeString(value)
  if (
    !objectKey ||
    objectKey.length > 400 ||
    objectKey.startsWith('/') ||
    objectKey.includes('\\') ||
    Array.from(objectKey).some((char) => {
      const code = char.charCodeAt(0)
      return code <= 31 || code === 127
    }) ||
    objectKey.split('/').some((segment) => segment === '.' || segment === '..') ||
    !isArchiveObjectKey(objectKey)
  ) {
    return false
  }

  return true
}

export function isAllowedPackageMarketObjectKey(value: unknown) {
  const objectKey = normalizeString(value)
  if (!isSafePackageMarketObjectKey(objectKey)) return false

  const rules = parseRulesFile()
  if (rules.some((rule) => ruleAllowsObjectKey(rule, objectKey))) {
    return true
  }
  if (cacheClusterPackageAllowsObjectKey(objectKey)) return true
  if (middlewareRootAllowsObjectKey(objectKey)) return true

  for (const deployType of ['pro', 'oss']) {
    const appRuleId = deployType === 'oss' ? 'sealos-oss' : 'sealos-pro'
    if (rules.some((rule) => rule.id === appRuleId)) continue
    if (templateMatcher(baseObjectTemplate, false, { deployType })?.test(objectKey)) return true
    const prefixMatch = templateMatcher(baseListPrefixTemplate, true, { deployType })?.exec(objectKey)
    if (!prefixMatch) continue
    const [version, fileName, ...extra] = objectKey.slice(prefixMatch[0].length).split('/')
    if (
      version &&
      fileName &&
      extra.length === 0 &&
      /^sealos-(?:pro|commercial|oss)-[^/]+-[^/]+\.tar(?:\.gz)?$/.test(fileName)
    ) {
      return true
    }
  }
  return false
}

function ossClient() {
  const endpoint = normalizeOssEndpoint(process.env.OSS_ENDPOINT)
  const accessKeyId = normalizeString(process.env.OSS_ACCESS_KEY_ID)
  const accessKeySecret = normalizeString(process.env.OSS_ACCESS_KEY_SECRET)
  const bucket = normalizeString(process.env.OSS_BUCKET)
  if (!endpoint || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET must be set')
  }
  return new OSS({
    endpoint,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: endpoint.startsWith('https://'),
  })
}

export async function putOssObject(
  objectKey: string,
  content: Buffer,
  contentType: string,
) {
  return ossClient().put(objectKey, content, {
    headers: {
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Type': contentType,
    },
  })
}

export async function getOssObject(objectKey: string) {
  return ossClient().get(objectKey)
}

async function listAllObjects(client: OSS, prefix: string) {
  const objects: OssObject[] = []
  let marker: string | undefined
  do {
    const result = await client.list({ prefix, marker, 'max-keys': 1000 }, {})
    for (const object of result.objects || []) {
      if (object.name && !object.name.endsWith('/')) {
        objects.push(object)
      }
    }
    marker = result.nextMarker
  } while (marker)
  return objects
}

async function listCommonPrefixes(client: OSS, prefix: string) {
  const prefixes: string[] = []
  let marker: string | undefined
  do {
    const result = await client.list({ prefix, delimiter: '/', marker, 'max-keys': 1000 }, {})
    for (const item of result.prefixes || []) {
      prefixes.push(item)
    }
    marker = result.nextMarker
  } while (marker)
  return prefixes
}

function normalizeDownloadExpireSeconds(expireMinutes?: number) {
  const minutes = normalizePackageMarketExpireMinutes(expireMinutes)
  return minutes * 60
}

function signedDownloadUrl(client: OSS, objectKey: string, expireSeconds = downloadExpireSeconds) {
  return client.signatureUrl(objectKey, { expires: expireSeconds, method: 'GET' })
}

function objectToLink(
  client: OSS,
  name: string,
  version: string,
  object: OssObject,
  expireSeconds = downloadExpireSeconds,
  downloadable = true,
): PackageMarketLink {
  return {
    name,
    version,
    objectKey: object.name,
    size: object.size,
    lastModified: object.lastModified,
    downloadUrl: downloadable ? signedDownloadUrl(client, object.name, expireSeconds) : '',
    expiresAt: downloadable ? new Date(Date.now() + expireSeconds * 1000).toISOString() : '',
    expiresInSeconds: downloadable ? expireSeconds : 0,
  }
}

function implicitDependencyParent(id: string, rule: {
  dependencyRoots: string[]
  explicitCategory: string
  flatFileRoots: string[]
  parent: string
}) {
  if (rule.parent) return rule.parent
  if (rule.explicitCategory === 'dependency') return ''
  if (rule.dependencyRoots.length > 0) return ''
  if (id === 'devbox-cache') return 'devbox'
  return ''
}

function ruleCategory(rule: {
  dependencyRoots: string[]
  explicitCategory: string
  flatFileRoots: string[]
  parent: string
  releaseRoots: string[]
}) {
  if (rule.explicitCategory) return rule.explicitCategory as PackageMarketRule['category']
  if (rule.parent || rule.dependencyRoots.length > 0) return 'dependency' as const
  const roots = [...rule.releaseRoots, ...rule.flatFileRoots]
  if (roots.some((root) => middlewareRoots.some((middlewareRoot) => root.startsWith(middlewareRoot)))) {
    return 'middleware' as const
  }
  return 'apps' as const
}

function parseRulesFile() {
  if (!rulesFile) {
    throw new Error('PACKAGE_MARKET_RULES_FILE must be set')
  }
  const stat = fs.statSync(rulesFile)
  if (cachedRules && cachedRulesMtimeMs === stat.mtimeMs) return cachedRules

  const file = fs.readFileSync(rulesFile, 'utf8')
  const parsed = yaml.load(file) as { rules?: Record<string, Record<string, unknown>> } | undefined
  const rawRules = parsed?.rules ?? {}
  const rules: PackageMarketRule[] = []

  for (const [rawKey, rawRule] of Object.entries(rawRules)) {
    const id = normalizeString(rawKey).toLowerCase()
    if (!id) continue
    const rule = rawRule ?? {}
    const fileNameFormats = normalizeList([
      rule.file_name_format,
      ...(((rule.file_name_formats as unknown[]) ?? [])),
    ])
    const ciFileNameFormats = normalizeList((rule.ci_file_name_formats as unknown[]) ?? [])
    const releaseRoots = normalizeList((rule.release_roots as unknown[]) ?? [])
    const flatFileRoots = normalizeList((rule.flat_file_roots as unknown[]) ?? [])
    const dependencyRoots = normalizeList((rule.dependency_roots as unknown[]) ?? [])
    const dependencyFilePatterns = normalizeList((rule.dependency_file_patterns as unknown[]) ?? [])
    const explicitCategory = normalizeString(rule.category)
    const parent = implicitDependencyParent(id, {
      dependencyRoots,
      explicitCategory,
      flatFileRoots,
      parent: normalizeString(rule.parent),
    })
    rules.push({
      id,
      name: normalizeString(rule.name) || id,
      releaseRoots,
      flatFileRoots,
      dependencyRoots,
      dependencyFilePatterns,
      parent,
      fileNameFormats,
      ciFileNameFormats,
      flatFileNamePrefix: normalizeString(rule.flat_file_name_prefix),
      flatFileNameSuffix: normalizeString(rule.flat_file_name_suffix),
      flatFileNameSuffixes: normalizeList((rule.flat_file_name_suffixes as unknown[]) ?? []),
      category: ruleCategory({
        dependencyRoots,
        explicitCategory,
        flatFileRoots,
        parent,
        releaseRoots,
      }),
      mode: flatFileRoots.length > 0 && releaseRoots.length > 0
        ? 'mixed'
        : flatFileRoots.length > 0
          ? 'flat'
          : 'release',
    })
  }

  cachedRules = rules.sort((a, b) => a.id.localeCompare(b.id))
  cachedRulesMtimeMs = stat.mtimeMs
  return cachedRules
}

function publicRule(rule: PackageMarketRule): PackageMarketRule {
  return {
    ...rule,
    releaseRoots: [...rule.releaseRoots],
    flatFileRoots: [...rule.flatFileRoots],
    dependencyRoots: [...rule.dependencyRoots],
    dependencyFilePatterns: [...rule.dependencyFilePatterns],
    fileNameFormats: [...rule.fileNameFormats],
    ciFileNameFormats: [...rule.ciFileNameFormats],
    flatFileNameSuffixes: [...rule.flatFileNameSuffixes],
  }
}

function proMiddlewareNameFromId(packageId: string) {
  if (!packageId.startsWith('pro:')) return ''
  return normalizeString(packageId.slice('pro:'.length))
}

export function resolvePackageMarketAppRuleId(packageId: string) {
  if (packageId === 'base-pro') return 'sealos-pro'
  if (packageId === 'base-oss') return 'sealos-oss'
  return ''
}

function basePackageDeployType(packageId: string) {
  return packageId === 'base-oss' ? 'oss' : 'pro'
}

async function publicProMiddlewareRules(client: OSS, excludedNames = new Set<string>()) {
  const items: PackageMarketRule[] = []
  const seenNames = new Set<string>()

  for (const root of middlewareRoots) {
    const prefixes = await listCommonPrefixes(client, root)
    for (const prefix of prefixes) {
      const name = prefix.slice(root.length).replace(/\/$/, '')
      if (!name || excludedNames.has(name) || seenNames.has(name)) continue
      seenNames.add(name)
      items.push({
        id: `pro:${name}`,
        name,
        category: 'middleware' as const,
        mode: 'pro-middleware' as const,
        releaseRoots: [prefix],
        flatFileRoots: [],
        dependencyRoots: [],
        dependencyFilePatterns: [],
        fileNameFormats: [],
        ciFileNameFormats: [],
        flatFileNamePrefix: '',
        flatFileNameSuffix: '',
        flatFileNameSuffixes: [],
        parent: '',
      })
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

async function proMiddlewareRootForName(client: OSS, name: string) {
  for (const root of middlewareRoots) {
    const prefixes = await listCommonPrefixes(client, root)
    if (prefixes.includes(`${root}${name}/`)) return `${root}${name}/`
  }
  return `${middlewareRoots[0] ?? defaultMiddlewareRoot}${name}/`
}

function extractProMiddlewareVersion(name: string, fileName: string) {
  const suffixMatch = fileName.match(/-(amd64|arm64)\.tar(?:\.gz)?$/)
  if (!suffixMatch) return ''
  let version = fileName.slice(0, suffixMatch.index)
  const prefixes = [`${name}-`, `${name}`]
  for (const prefix of prefixes) {
    if (version.startsWith(prefix)) {
      version = version.slice(prefix.length)
      break
    }
  }
  version = version.replace(/^-+/, '')
  return version || 'latest'
}

function proMiddlewareHashFromObject(root: string, objectKey: string) {
  const rest = objectKey.slice(root.length)
  const parts = rest.split('/')
  return parts.length > 1 ? normalizeString(parts[0]) : ''
}

function releaseVersionFromObject(root: string, objectKey: string) {
  const rest = objectKey.slice(root.length)
  const parts = rest.split('/')
  return parts.length > 1 ? normalizeVersion(parts[0]) : ''
}

function ciBaseRootsForRule(rule: PackageMarketRule) {
  const roots = new Set<string>()
  for (const root of rule.releaseRoots) {
    const normalized = root.replace(/\/+$/, '/')
    const match = normalized.match(/^(.*)\/releases?\/$/)
    if (match) {
      roots.add(`${match[1]}/ci/`)
    }
  }
  return [...roots]
}

function isValidCiBranch(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value) && value !== '.' && value !== '..'
}

function compareCiBranches(left: string, right: string) {
  if (left === 'main') return right === 'main' ? 0 : -1
  if (right === 'main') return 1
  return left.localeCompare(right)
}

async function listCiBranches(client: OSS, rule: PackageMarketRule): Promise<PackageMarketCiBranch[]> {
  const branches = new Set<string>()
  for (const root of ciBaseRootsForRule(rule)) {
    const prefixes = await listCommonPrefixes(client, root)
    for (const prefix of prefixes) {
      const branch = prefix.slice(root.length).replace(/\/$/, '')
      if (isValidCiBranch(branch) && !branch.includes('/')) branches.add(branch)
    }
  }
  return [...branches]
    .sort(compareCiBranches)
    .map((name) => ({ label: name, name }))
}

async function resolveCiRoots(client: OSS, rule: PackageMarketRule, requestedBranch: string) {
  const branches = await listCiBranches(client, rule)
  const branch = normalizeString(requestedBranch) || branches[0]?.name || ''
  if (!branch || !branches.some((item) => item.name === branch)) {
    throw new Error(`unknown CI branch: ${branch || '(empty)'}`)
  }
  return {
    branch,
    roots: ciBaseRootsForRule(rule).map((root) => `${root}${branch}/`),
  }
}

function ciHashFromObject(root: string, objectKey: string) {
  const rest = objectKey.slice(root.length)
  const parts = rest.split('/')
  return parts.length > 1 ? normalizeString(parts[0]) : ''
}

function dependencyHashFromObject(root: string, objectKey: string) {
  const rest = objectKey.slice(root.length)
  const parts = rest.split('/')
  return parts.length > 1 ? normalizeString(parts[0]) : ''
}

function dependencyObjectMatches(
  rule: PackageMarketRule,
  fileName: string,
  hash: string,
  arch: string,
  includeAll = false,
) {
  if (!fileName || fileName.includes('/')) return false
  const expectedNames = candidateFileNames(rule.dependencyFilePatterns, hash, arch)
  if (expectedNames.includes(fileName)) return true
  if (!includeAll) return false
  if (fileName.endsWith('.xlsx')) return true
  if (fileName.endsWith(`.${arch}.txt`)) return true
  return isArchiveObjectKey(fileName) && fileName.includes(hash) && objectMatchesArch(fileName, arch)
}

async function listDependencyVersions(client: OSS, rule: PackageMarketRule, arch: string, includeAll = false) {
  const versions = new Map<string, { hash: string; object: OssObject }>()
  for (const root of rule.dependencyRoots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const hash = dependencyHashFromObject(root, object.name)
      if (!hash) continue
      const fileName = object.name.slice(`${root}${hash}/`.length)
      if (!dependencyObjectMatches(rule, fileName, hash, arch, includeAll)) continue
      const current = versions.get(hash)
      if (!current || objectTime(object) > objectTime(current.object)) {
        versions.set(hash, { hash, object })
      }
    }
  }

  return [...versions.values()]
    .sort((a, b) => objectTime(b.object) - objectTime(a.object))
    .map((item) => ({
      hash: item.hash,
      label: formatCiLabel({ hash: item.hash, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function buildDependencyPackage(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  requestedHash: string,
  includeAll = false,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  const versions = await listDependencyVersions(client, rule, arch, includeAll)
  const hash = normalizeString(requestedHash) || versions[0]?.hash || ''
  const matched: OssObject[] = []
  if (hash) {
    for (const root of rule.dependencyRoots) {
      const objects = await listAllObjects(client, `${root}${hash}/`)
      for (const object of objects) {
        const fileName = object.name.slice(`${root}${hash}/`.length)
        if (dependencyObjectMatches(rule, fileName, hash, arch, includeAll)) {
          matched.push(object)
        }
      }
    }
  }
  const selected = versions.find((item) => item.hash === hash)

  return {
    title: rule.name,
    type: 'dependency package',
    meta: [
      { label: '规则 key', value: rule.id },
      { label: '依赖版本', value: selected?.label || '未找到' },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    ciVersions: versions,
    selectedHash: hash,
    links: matched.map((object) =>
      objectToLink(
        client,
        rule.name,
        selected?.label || hash,
        object,
        expireSeconds,
      ),
    ),
  }
}

function flatSuffixes(
  rule: PackageMarketRule,
  arch: string,
) {
  const suffixes = normalizeList([
    rule.flatFileNameSuffix,
    ...rule.flatFileNameSuffixes,
  ]).map((suffix) => formatFileName(suffix, arch, arch))
  return normalizeList(suffixes.flatMap((suffix) => (
    suffix.endsWith('.tar') ? [suffix, `${suffix}.gz`] : [suffix]
  )))
}

function extractFlatVersion(
  rule: PackageMarketRule,
  fileName: string,
  arch: string,
) {
  const prefix = normalizeString(rule.flatFileNamePrefix)
  if (!prefix || !fileName.startsWith(prefix)) return ''
  const suffixes = flatSuffixes(rule, arch).sort((a, b) => b.length - a.length)
  for (const suffix of suffixes) {
    if (!suffix || !fileName.endsWith(suffix)) continue
    return normalizeVersion(fileName.slice(prefix.length, fileName.length - suffix.length))
  }
  return ''
}

function newestVersion(objects: Array<{ version: string }>) {
  const versions = [...new Set(objects.map((item) => item.version).filter(Boolean))]
  versions.sort((a, b) => compareVersions(b, a))
  return versions[0] || ''
}

async function listProMiddlewareReleaseVersions(client: OSS, name: string, arch: string) {
  const root = await proMiddlewareRootForName(client, name)
  const objects = await listAllObjects(client, root)
  const versions = new Map<string, { object: OssObject; version: string }>()

  for (const object of objects) {
    const fileName = object.name.slice(root.length)
    if (!fileName || fileName.includes('/') || !isArchiveObjectKey(fileName) || !fileName.includes(`-${arch}.tar`)) {
      continue
    }
    const version = extractProMiddlewareVersion(name, fileName)
    const current = versions.get(version)
    if (!current || objectTime(object) > objectTime(current.object)) {
      versions.set(version, { version, object })
    }
  }

  return [...versions.values()]
    .sort((a, b) => objectTime(b.object) - objectTime(a.object))
    .map((item) => ({
      version: item.version,
      label: versionLabel({ version: item.version, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function buildProMiddlewarePackage(
  client: OSS,
  name: string,
  arch: string,
  requestedVersion: string,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  const versions = await listProMiddlewareReleaseVersions(client, name, arch)
  const version = normalizeString(requestedVersion) || versions[0]?.version || ''
  const root = await proMiddlewareRootForName(client, name)
  const objects = await listAllObjects(client, root)
  const matched = objects.filter((object) => {
    const fileName = object.name.slice(root.length)
    return (
      fileName &&
      !fileName.includes('/') &&
      isArchiveObjectKey(fileName) &&
      fileName.includes(`-${arch}.tar`) &&
      extractProMiddlewareVersion(name, fileName) === version
    )
  })

  return {
    title: name,
    type: 'pro middleware',
    meta: [
      { label: '目录', value: root },
      { label: '正式版本', value: version || '未找到' },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    releaseVersions: versions,
    links: matched.map((object) => objectToLink(client, name, version, object, expireSeconds)),
  }
}

async function listProMiddlewareCiVersions(client: OSS, name: string, arch: string) {
  const root = await proMiddlewareRootForName(client, name)
  const objects = await listAllObjects(client, root)
  const versions = new Map<string, { hash: string; object: OssObject }>()

  for (const object of objects) {
    const hash = proMiddlewareHashFromObject(root, object.name)
    if (!hash) continue
    const fileName = object.name.slice(`${root}${hash}/`.length)
    if (!fileName || fileName.includes('/') || !isArchiveObjectKey(fileName) || !fileName.includes(`-${arch}.tar`)) {
      continue
    }
    const current = versions.get(hash)
    if (!current || objectTime(object) > objectTime(current.object)) {
      versions.set(hash, { hash, object })
    }
  }

  return [...versions.values()]
    .sort((a, b) => objectTime(b.object) - objectTime(a.object))
    .map((item) => ({
      hash: item.hash,
      label: formatCiLabel({ hash: item.hash, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function buildProMiddlewareCiPackage(
  client: OSS,
  name: string,
  arch: string,
  requestedHash: string,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  const versions = await listProMiddlewareCiVersions(client, name, arch)
  const hash = normalizeString(requestedHash) || versions[0]?.hash || ''
  const root = await proMiddlewareRootForName(client, name)
  const objects = hash ? await listAllObjects(client, `${root}${hash}/`) : []
  const matched = objects.filter((object) => {
    const fileName = object.name.slice(`${root}${hash}/`.length)
    return fileName && !fileName.includes('/') && isArchiveObjectKey(fileName) && fileName.includes(`-${arch}.tar`)
  })
  const selected = versions.find((item) => item.hash === hash)

  return {
    title: name,
    type: 'pro middleware ci',
    meta: [
      { label: '目录', value: root },
      { label: '测试版本', value: selected?.label || '未找到' },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    ciVersions: versions,
    links: matched.map((object) => objectToLink(client, name, selected?.label || hash, object, expireSeconds)),
  }
}

async function listBaseVersions(client: OSS, deployType: string, arch: string) {
  const normalizedDeployType = normalizeString(deployType || 'pro').toLowerCase()
  if (!baseListPrefixTemplate) return []
  const packageNames =
    normalizedDeployType === 'pro' ? ['sealos-pro', 'sealos-commercial'] : [`sealos-${normalizedDeployType}`]
  const listPrefix = normalizePrefix(renderTemplate(baseListPrefixTemplate, { deployType: normalizedDeployType, arch }))
  const objects = await listAllObjects(client, listPrefix)
  const versions = new Map<string, { object: OssObject; version: string }>()

  for (const object of objects) {
    const rest = object.name.slice(listPrefix.length)
    const parts = rest.split('/')
    if (parts.length < 2) continue
    const version = normalizeVersion(parts[0])
    const fileName = parts[1]
    const expectedNames = packageNames.flatMap((packageName) =>
      candidateFileNames([`${packageName}-%s-%s.tar`], version, arch),
    )
    if (!expectedNames.includes(fileName)) continue
    const current = versions.get(version)
    if (!current || objectTime(object) > objectTime(current.object)) {
      versions.set(version, { version, object })
    }
  }

  return [...versions.values()]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((item) => ({
      version: item.version,
      label: versionLabel({ version: item.version, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function buildBasePackage(
  client: OSS,
  deployType: string,
  releaseVersion: string,
  arch: string,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  if (!baseObjectTemplate) throw new Error('PACKAGE_MARKET_BASE_OBJECT_TEMPLATE must be set')
  const versions = await listBaseVersions(client, deployType, arch)
  const version = normalizeVersion(releaseVersion) || versions[0]?.version || ''
  const normalizedDeployType = normalizeString(deployType || 'pro').toLowerCase()
  if (!version || !arch || !normalizedDeployType) {
    throw new Error('deployType, releaseVersion and arch are required')
  }

  const packageNames =
    normalizedDeployType === 'pro' ? ['sealos-pro', 'sealos-commercial'] : [`sealos-${normalizedDeployType}`]
  const links: PackageMarketLink[] = []

  for (const packageName of packageNames) {
    for (const fileName of candidateFileNames([`${packageName}-%s-%s.tar`], version, arch)) {
      const key = renderTemplate(baseObjectTemplate, {
        deployType: normalizedDeployType,
        version,
        fileName,
        arch,
        packageName,
      })
      try {
        const head = await client.head(key)
        const headers = head.res.headers as Record<string, string | number | undefined>
        links.push(
          objectToLink(client, packageName, version, {
            name: key,
            size: Number(headers['content-length']),
            lastModified: String(headers['last-modified'] ?? ''),
          }, expireSeconds),
        )
        break
      } catch (error) {
        const ossError = error as { code?: string; status?: number }
        if (ossError.code !== 'NoSuchKey' && ossError.status !== 404) throw error
      }
    }
  }

  return {
    title: '基础包',
    type: 'main package',
    meta: [
      { label: '部署类型', value: normalizedDeployType.toUpperCase() },
      { label: '基础包版本', value: version },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    releaseVersions: versions,
    links,
  }
}

async function listReleaseVersions(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  includeAll = false,
) {
  const versions = new Map<string, { object: OssObject; version: string }>()

  for (const root of rule.releaseRoots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const version = releaseVersionFromObject(root, object.name)
      if (!version) continue
      if (!releaseObjectMatches(rule, root, object, version, arch, includeAll)) continue
      const current = versions.get(version)
      if (!current || objectTime(object) > objectTime(current.object)) {
        versions.set(version, { version, object })
      }
    }
  }

  for (const root of rule.flatFileRoots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const fileName = object.name.slice(root.length)
      if (!fileName || fileName.includes('/')) continue
      const version = extractFlatVersion(rule, fileName, arch)
      if (!version) continue
      if (!flatObjectMatches(rule, fileName, version, arch, includeAll)) continue
      const current = versions.get(version)
      if (!current || objectTime(object) > objectTime(current.object)) {
        versions.set(version, { version, object })
      }
    }
  }

  return [...versions.values()]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((item) => ({
      version: item.version,
      label: versionLabel({ version: item.version, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function listCiVersionsFromRoots(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  roots: string[],
  includeAll = false,
) {
  const versions = new Map<string, { hash: string; object: OssObject }>()

  for (const root of roots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const hash = ciHashFromObject(root, object.name)
      if (!hash) continue
      const fileName = object.name.slice(`${root}${hash}/`.length)
      if (!ciObjectMatches(rule, fileName, hash, arch, includeAll)) continue
      const current = versions.get(hash)
      if (!current || objectTime(object) > objectTime(current.object)) {
        versions.set(hash, { hash, object })
      }
    }
  }

  return [...versions.values()]
    .sort((a, b) => objectTime(b.object) - objectTime(a.object))
    .map((item) => ({
      hash: item.hash,
      label: formatCiLabel({ hash: item.hash, lastModified: item.object.lastModified }),
      lastModified: item.object.lastModified,
    }))
}

async function listCiVersions(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  ciBranch: string,
  includeAll = false,
) {
  const { roots } = await resolveCiRoots(client, rule, ciBranch)
  return listCiVersionsFromRoots(client, rule, arch, roots, includeAll)
}

async function buildCiPackage(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  requestedBranch: string,
  requestedHash: string,
  includeAll = false,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  const { branch, roots } = await resolveCiRoots(client, rule, requestedBranch)
  const versions = await listCiVersionsFromRoots(client, rule, arch, roots, includeAll)
  const hash = normalizeString(requestedHash) || versions[0]?.hash || ''
  const matched: OssObject[] = []

  if (hash) {
    for (const root of roots) {
      const objects = await listAllObjects(client, `${root}${hash}/`)
      for (const object of objects) {
        const fileName = object.name.slice(`${root}${hash}/`.length)
        if (ciObjectMatches(rule, fileName, hash, arch, includeAll)) {
          matched.push(object)
        }
      }
    }
  }

  const selected = versions.find((item) => item.hash === hash)
  return {
    title: rule.name,
    type: 'ci package',
    meta: [
      { label: '规则 key', value: rule.id },
      { label: 'CI 分支', value: branch },
      { label: '测试版本', value: selected?.label || '未找到' },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    ciVersions: versions,
    links: matched.map((object) =>
      objectToLink(
        client,
        rule.name,
        selected?.label || hash,
        object,
        expireSeconds,
      ),
    ),
  }
}

async function buildComboPackage(
  client: OSS,
  rule: PackageMarketRule,
  arch: string,
  releaseVersion: string,
  channel: 'release' | 'ci',
  ciBranch: string,
  ciVersion: string,
  includeAll = false,
  expireSeconds = downloadExpireSeconds,
): Promise<PackageMarketDetail> {
  if (channel === 'ci') {
    if (rule.category === 'dependency' && rule.dependencyRoots.length > 0) {
      return buildDependencyPackage(client, rule, arch, ciVersion, includeAll, expireSeconds)
    }
    return buildCiPackage(client, rule, arch, ciBranch, ciVersion, includeAll, expireSeconds)
  }

  const matched: Array<{ object: OssObject; version: string }> = []
  for (const root of rule.releaseRoots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const version = releaseVersionFromObject(root, object.name)
      if (!version) continue
      if (releaseObjectMatches(rule, root, object, version, arch, includeAll)) {
        matched.push({ version, object })
      }
    }
  }

  for (const root of rule.flatFileRoots) {
    const objects = await listAllObjects(client, root)
    for (const object of objects) {
      const fileName = object.name.slice(root.length)
      if (!fileName || fileName.includes('/')) continue
      const version = extractFlatVersion(rule, fileName, arch)
      if (!version) continue
      if (flatObjectMatches(rule, fileName, version, arch, includeAll)) {
        matched.push({ version, object })
      }
    }
  }

  const releaseVersions = await listReleaseVersions(client, rule, arch, includeAll)
  const latest =
    normalizeVersion(releaseVersion) || releaseVersions[0]?.version || newestVersion(matched)
  const latestObjects = matched.filter((item) => item.version === latest)

  return {
    title: rule.name,
    type: 'combo package',
    meta: [
      { label: '规则 key', value: rule.id },
      { label: '最新版本', value: latest || '未找到' },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
    releaseVersions,
    links: latestObjects.map((item) =>
      objectToLink(
        client,
        rule.name,
        item.version,
        item.object,
        expireSeconds,
      ),
    ),
  }
}

export function getPackageMarketExpireMinutes() {
  return Math.round(downloadExpireSeconds / 60)
}

export function normalizePackageMarketExpireMinutes(value: unknown) {
  const minutes = Number(value)
  return Number.isSafeInteger(minutes) && minutes > 0 && minutes <= packageMarketExpireMaxMinutes
    ? minutes
    : getPackageMarketExpireMinutes()
}

export async function listPackageMarketRules() {
  const yamlRules = parseRulesFile().map(publicRule)
  try {
    const client = ossClient()
    const yamlMiddlewareNames = new Set(
      yamlRules.filter((rule) => rule.category === 'middleware').map((rule) => rule.name),
    )
    const middlewareRules = await publicProMiddlewareRules(client, yamlMiddlewareNames)
    return [...yamlRules, ...middlewareRules]
  } catch (error) {
    if (yamlRules.length > 0) return yamlRules
    throw error
  }
}

export async function getPackageMarketDetail(params: {
  arch: string
  channel: 'release' | 'ci'
  ciBranch?: string
  ciVersion?: string
  expireMinutes?: number
  includeAll?: boolean
  packageId: string
  releaseVersion?: string
}) {
  const client = ossClient()
  const arch = normalizeString(params.arch || 'amd64').toLowerCase()
  const expireSeconds = normalizeDownloadExpireSeconds(params.expireMinutes)
  const includeAll = params.includeAll === true
  const appRuleId = resolvePackageMarketAppRuleId(params.packageId)

  const middlewareName = proMiddlewareNameFromId(params.packageId)
  if (middlewareName) {
    return params.channel === 'ci'
      ? buildProMiddlewareCiPackage(client, middlewareName, arch, params.ciVersion || '', expireSeconds)
      : buildProMiddlewarePackage(client, middlewareName, arch, params.releaseVersion || '', expireSeconds)
  }

  const rule = parseRulesFile().find((item) => item.id === (appRuleId || params.packageId))
  if (!rule) {
    if (appRuleId) {
      return buildBasePackage(
        client,
        basePackageDeployType(params.packageId),
        params.releaseVersion || '',
        arch,
        expireSeconds,
      )
    }
    throw new Error(`unknown package: ${params.packageId}`)
  }

  const detail = await buildComboPackage(
    client,
    rule,
    arch,
    params.releaseVersion || '',
    params.channel,
    params.ciBranch || '',
    params.ciVersion || '',
    includeAll,
    expireSeconds,
  )
  if (!appRuleId) return detail
  const version = normalizeVersion(params.releaseVersion) || detail.releaseVersions?.[0]?.version || '未找到'
  return {
    ...detail,
    title: '基础包',
    type: 'main package',
    meta: [
      { label: '部署类型', value: basePackageDeployType(params.packageId).toUpperCase() },
      { label: '基础包版本', value: version },
      { label: '下载有效期', value: `${Math.round(expireSeconds / 60)} 分钟` },
    ],
  }
}

export async function listPackageMarketReleaseVersions(params: {
  arch: string
  includeAll?: boolean
  packageId: string
}) {
  const client = ossClient()
  const arch = normalizeString(params.arch || 'amd64').toLowerCase()
  const appRuleId = resolvePackageMarketAppRuleId(params.packageId)

  const middlewareName = proMiddlewareNameFromId(params.packageId)
  if (middlewareName) {
    return listProMiddlewareReleaseVersions(client, middlewareName, arch)
  }

  const rule = parseRulesFile().find((item) => item.id === (appRuleId || params.packageId))
  if (!rule) {
    if (appRuleId) {
      return listBaseVersions(client, basePackageDeployType(params.packageId), arch)
    }
    throw new Error(`unknown package: ${params.packageId}`)
  }
  if (rule.category === 'dependency' && rule.dependencyRoots.length > 0) {
    return []
  }
  return listReleaseVersions(client, rule, arch, params.includeAll === true)
}

export async function listPackageMarketCiVersions(params: {
  arch: string
  ciBranch?: string
  includeAll?: boolean
  packageId: string
}) {
  const client = ossClient()
  const arch = normalizeString(params.arch || 'amd64').toLowerCase()
  const appRuleId = resolvePackageMarketAppRuleId(params.packageId)
  const middlewareName = proMiddlewareNameFromId(params.packageId)
  if (middlewareName) {
    return listProMiddlewareCiVersions(client, middlewareName, arch)
  }

  const rule = parseRulesFile().find((item) => item.id === (appRuleId || params.packageId))
  if (!rule) {
    throw new Error(`unknown package: ${params.packageId}`)
  }
  if (rule.category === 'dependency' && rule.dependencyRoots.length > 0) {
    return listDependencyVersions(client, rule, arch, params.includeAll === true)
  }
  return listCiVersions(client, rule, arch, params.ciBranch || '', params.includeAll === true)
}

export async function listPackageMarketCiBranches(params: { packageId: string }) {
  const client = ossClient()
  if (proMiddlewareNameFromId(params.packageId)) return []
  const appRuleId = resolvePackageMarketAppRuleId(params.packageId)
  const rule = parseRulesFile().find((item) => item.id === (appRuleId || params.packageId))
  if (!rule) throw new Error(`unknown package: ${params.packageId}`)
  if (rule.category === 'dependency') return []
  return listCiBranches(client, rule)
}

export function createPackageItemDownloadUrl(objectKey: string, expireMinutes?: number) {
  if (!isSafePackageMarketObjectKey(objectKey)) {
    throw new Error('Package object key is not allowed')
  }
  return signedDownloadUrl(ossClient(), objectKey, normalizeDownloadExpireSeconds(expireMinutes))
}

export function createPackageItemDownloadLink(objectKey: string, expireMinutes?: number) {
  if (!isSafePackageMarketObjectKey(objectKey)) {
    throw new Error('Package object key is not allowed')
  }
  const expiresInSeconds = normalizeDownloadExpireSeconds(expireMinutes)
  return {
    downloadUrl: signedDownloadUrl(ossClient(), objectKey, expiresInSeconds),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    expiresInSeconds,
  }
}
