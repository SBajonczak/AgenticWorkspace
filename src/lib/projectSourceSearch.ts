type SourceType = 'confluence' | 'jira' | 'github' | 'sharepoint'

interface SourceLinkRecord {
  id: string
  type: string
  label: string | null
  identifier: string
  config: string | null
}

interface SearchInput {
  projectName: string
  meetingTitle: string
  agendaTitles: string[]
  sourceLinks: SourceLinkRecord[]
}

export interface ProjectSourceResultItem {
  title: string
  excerpt: string
  url: string
  updatedAt?: string
  score: number
  matchedTerms: string[]
  matchScore: number
  freshnessScore: number
}

export interface ProjectSourceResult {
  sourceType: SourceType
  sourceLabel: string
  identifier: string
  query: string
  score: number
  items: ProjectSourceResultItem[]
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3)
}

function computeTextScore(query: string, title: string, excerpt: string): {
  score: number
  matchedTerms: string[]
} {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) {
    return {
      score: 20,
      matchedTerms: [],
    }
  }

  const titleTokens = tokenize(title)
  const excerptTokens = tokenize(excerpt)
  const titleSet = new Set(titleTokens)
  const excerptSet = new Set(excerptTokens)

  const matchedTerms: string[] = []
  let score = 0
  for (const token of queryTokens) {
    if (titleSet.has(token)) {
      score += 16
      matchedTerms.push(token)
    } else if (excerptSet.has(token)) {
      score += 8
      matchedTerms.push(token)
    }
  }

  return {
    score: Math.min(80, score),
    matchedTerms: [...new Set(matchedTerms)].slice(0, 6),
  }
}

function computeFreshnessScore(updatedAt?: string): number {
  if (!updatedAt) return 8
  const updated = new Date(updatedAt)
  if (Number.isNaN(updated.getTime())) return 8

  const ageDays = Math.max(0, (Date.now() - updated.getTime()) / (24 * 60 * 60 * 1000))
  if (ageDays <= 1) return 20
  if (ageDays <= 7) return 16
  if (ageDays <= 30) return 10
  if (ageDays <= 90) return 6
  return 3
}

type RawSourceItem = {
  title: string
  excerpt: string
  url: string
  updatedAt?: string
}

function attachScores(query: string, items: RawSourceItem[]): ProjectSourceResultItem[] {
  return items
    .map((item) => {
      const textScoreResult = computeTextScore(query, item.title, item.excerpt)
      const freshnessScore = computeFreshnessScore(item.updatedAt)
      const score = Math.max(1, Math.min(100, textScoreResult.score + freshnessScore))
      return {
        ...item,
        score,
        matchedTerms: textScoreResult.matchedTerms,
        matchScore: textScoreResult.score,
        freshnessScore,
      }
    })
    .sort((a, b) => b.score - a.score)
}

function scoreSource(items: ProjectSourceResultItem[]): number {
  if (items.length === 0) return 0
  const weighted = items
    .slice(0, 3)
    .reduce((acc, item, index) => {
      const weight = index === 0 ? 0.5 : index === 1 ? 0.3 : 0.2
      return acc + item.score * weight
    }, 0)

  return Math.round(Math.max(1, Math.min(100, weighted)))
}

function parseConfig(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, value as string])
    )
  } catch {
    return {}
  }
}

function buildQuery(projectName: string, meetingTitle: string, agendaTitles: string[]): string {
  const pieces = [projectName, meetingTitle, ...agendaTitles.slice(0, 2)]
    .map((part) => part.trim())
    .filter(Boolean)
  const query = pieces.join(' ').replace(/\s+/g, ' ').trim()
  return query.slice(0, 120)
}

function normalizeSourceType(value: string): SourceType | null {
  if (value === 'confluence' || value === 'jira' || value === 'github' || value === 'sharepoint') {
    return value
  }
  return null
}

function withTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function searchGitHub(
  source: SourceLinkRecord,
  query: string,
  config: Record<string, string>
): Promise<ProjectSourceResultItem[]> {
  const [owner, repo] = source.identifier.split('/')
  if (!owner || !repo) return []

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }

  const searchQuery = encodeURIComponent(`${query} repo:${owner}/${repo} in:title,body`)
  const response = await withTimeout(
    `https://api.github.com/search/issues?q=${searchQuery}&per_page=3&sort=updated&order=desc`,
    { headers }
  )

  if (!response.ok) return []

  const payload = (await response.json()) as {
    items?: Array<{
      title?: string
      html_url?: string
      updated_at?: string
      body?: string
      state?: string
      number?: number
    }>
  }

  return (payload.items ?? []).slice(0, 3).map((item) => ({
    title: item.title ?? `Issue #${item.number ?? '?'}`,
    excerpt: `${item.state ?? 'unknown'} · ${(item.body ?? '').replace(/\s+/g, ' ').slice(0, 140)}`,
    url: item.html_url ?? `https://github.com/${owner}/${repo}`,
    updatedAt: item.updated_at,
  }))
}

async function searchJira(
  source: SourceLinkRecord,
  query: string,
  config: Record<string, string>
): Promise<ProjectSourceResultItem[]> {
  const host = (config.host ?? '').replace(/\/$/, '')
  if (!host) return []

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.email && (config.apiToken ?? config.token)) {
    const token = config.apiToken ?? config.token
    headers.Authorization = `Basic ${Buffer.from(`${config.email}:${token}`).toString('base64')}`
  }

  const jql = encodeURIComponent(`project = "${source.identifier}" AND text ~ "${query.replace(/"/g, '')}" ORDER BY updated DESC`)
  const response = await withTimeout(
    `${host}/rest/api/2/search?jql=${jql}&maxResults=3&fields=summary,updated,status`,
    { headers }
  )

  if (!response.ok) return []

  const payload = (await response.json()) as {
    issues?: Array<{
      key?: string
      fields?: {
        summary?: string
        updated?: string
        status?: { name?: string }
      }
    }>
  }

  return (payload.issues ?? []).slice(0, 3).map((issue) => ({
    title: `${issue.key ?? 'JIRA'} · ${issue.fields?.summary ?? 'Issue'}`,
    excerpt: issue.fields?.status?.name ?? 'status unknown',
    url: `${host}/browse/${issue.key ?? ''}`,
    updatedAt: issue.fields?.updated,
  }))
}

async function searchConfluence(
  source: SourceLinkRecord,
  query: string,
  config: Record<string, string>
): Promise<ProjectSourceResultItem[]> {
  const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '')
  if (!baseUrl) return []

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.email && (config.apiToken ?? config.token)) {
    const token = config.apiToken ?? config.token
    headers.Authorization = `Basic ${Buffer.from(`${config.email}:${token}`).toString('base64')}`
  }

  const cql = encodeURIComponent(`space = "${source.identifier}" AND text ~ "${query.replace(/"/g, '')}"`)
  const response = await withTimeout(
    `${baseUrl}/rest/api/search?cql=${cql}&limit=3`,
    { headers }
  )

  if (!response.ok) return []

  const payload = (await response.json()) as {
    results?: Array<{
      title?: string
      excerpt?: string
      url?: string
      _links?: { webui?: string; base?: string }
      lastModified?: string
    }>
  }

  return (payload.results ?? []).slice(0, 3).map((result) => {
    const webUrl = result.url
      ? result.url
      : result._links?.webui
        ? `${result._links.base ?? baseUrl}${result._links.webui}`
        : `${baseUrl}`

    return {
      title: result.title ?? 'Confluence page',
      excerpt: (result.excerpt ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
      url: webUrl,
      updatedAt: result.lastModified,
    }
  })
}

function searchSharePoint(source: SourceLinkRecord, query: string): ProjectSourceResultItem[] {
  const siteUrl = source.identifier.replace(/\/$/, '')
  if (!siteUrl.startsWith('http')) return []

  return [
    {
      title: 'SharePoint search',
      excerpt: `Search in site for: ${query}`,
      url: `${siteUrl}/search.aspx?q=${encodeURIComponent(query)}`,
    },
  ]
}

export async function searchProjectSources(input: SearchInput): Promise<ProjectSourceResult[]> {
  const query = buildQuery(input.projectName, input.meetingTitle, input.agendaTitles)
  if (!query) return []

  const results: ProjectSourceResult[] = []

  for (const source of input.sourceLinks) {
    const sourceType = normalizeSourceType(source.type)
    if (!sourceType) continue

    const config = parseConfig(source.config)
    const sourceLabel = source.label ?? `${sourceType}:${source.identifier}`

    try {
      let items: ProjectSourceResultItem[] = []

      if (sourceType === 'github') {
        items = await searchGitHub(source, query, config)
      } else if (sourceType === 'jira') {
        items = await searchJira(source, query, config)
      } else if (sourceType === 'confluence') {
        items = await searchConfluence(source, query, config)
      } else if (sourceType === 'sharepoint') {
        items = searchSharePoint(source, query)
      }

      const scoredItems = attachScores(query, items)

      if (scoredItems.length > 0) {
        results.push({
          sourceType,
          sourceLabel,
          identifier: source.identifier,
          query,
          score: scoreSource(scoredItems),
          items: scoredItems,
        })
      }
    } catch {
      continue
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
