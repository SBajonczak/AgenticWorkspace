import fetch from 'isomorphic-fetch'
import { ITicketProvider, TicketInput, TicketResult, GitHubProviderConfig } from '../types'

const PRIORITY_LABELS: Record<string, string> = {
  high: 'priority:high',
  medium: 'priority:medium',
  low: 'priority:low',
}

export class GitHubTicketProvider implements ITicketProvider {
  readonly type = 'github' as const
  private baseUrl: string
  private headers: Record<string, string>

  constructor(private config: GitHubProviderConfig) {
    this.baseUrl = `https://api.github.com/repos/${config.owner}/${config.repo}`
    this.headers = {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    }
  }

  async createTicket(input: TicketInput): Promise<TicketResult> {
    const assignee = input.assigneeHint
      ? await this.findAssignee(input.assigneeHint)
      : null

    const body = [
      input.description,
      input.meetingTitle ? `\n\n**Meeting:** ${input.meetingTitle}` : '',
      input.meetingUrl ? `\n**Link:** ${input.meetingUrl}` : '',
    ]
      .join('')
      .trim()

    const payload: Record<string, unknown> = {
      title: input.title,
      body,
      labels: [PRIORITY_LABELS[input.priority]].filter(Boolean),
      ...(assignee ? { assignees: [assignee] } : {}),
    }

    const res = await fetch(`${this.baseUrl}/issues`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`GitHub createTicket failed ${res.status}: ${err}`)
    }

    const data = await res.json()
    return {
      id: String(data.id),
      key: `#${data.number}`,
      url: data.html_url,
      provider: 'github',
    }
  }

  async findAssignee(nameOrEmail: string): Promise<string | null> {
    try {
      // Try exact username match first, then search by name
      const searchTerm = nameOrEmail.includes('@')
        ? nameOrEmail.split('@')[0]
        : nameOrEmail.replace(/\s+/g, '')

      const res = await fetch(
        `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/collaborators`,
        { headers: this.headers }
      )

      if (!res.ok) return null
      const collaborators: Array<{ login: string; name?: string }> = await res.json()

      // Case-insensitive match on login or name
      const match = collaborators.find(
        (c) =>
          c.login.toLowerCase() === searchTerm.toLowerCase() ||
          c.name?.toLowerCase().includes(nameOrEmail.toLowerCase())
      )

      return match?.login ?? null
    } catch {
      return null
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }
}
