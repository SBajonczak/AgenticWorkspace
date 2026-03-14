import fetch from 'isomorphic-fetch'
import { ITicketProvider, TicketInput, TicketResult, JiraProviderConfig } from '../types'

export class JiraTicketProvider implements ITicketProvider {
  readonly type = 'jira' as const
  private authHeader: string

  constructor(private config: JiraProviderConfig) {
    const raw = `${config.email}:${config.apiToken}`
    this.authHeader = `Basic ${Buffer.from(raw).toString('base64')}`
  }

  async createTicket(input: TicketInput): Promise<TicketResult> {
    const assigneeAccountId = input.assigneeHint
      ? await this.findAssignee(input.assigneeHint)
      : null

    const priorityMap: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    }

    const descriptionText = [
      input.description,
      input.meetingTitle ? `\n\nMeeting: ${input.meetingTitle}` : '',
      input.meetingUrl ? `\nLink: ${input.meetingUrl}` : '',
    ]
      .join('')
      .trim()

    const payload: Record<string, unknown> = {
      fields: {
        project: { key: this.config.projectKey },
        summary: input.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: descriptionText }],
            },
          ],
        },
        issuetype: { name: 'Task' },
        priority: { name: priorityMap[input.priority] ?? 'Medium' },
        ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
      },
    }

    const res = await fetch(`${this.config.host}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Jira createTicket failed ${res.status}: ${err}`)
    }

    const data = await res.json()
    return {
      id: data.id,
      key: data.key,
      url: `${this.config.host}/browse/${data.key}`,
      provider: 'jira',
    }
  }

  async findAssignee(nameOrEmail: string): Promise<string | null> {
    try {
      const url = `${this.config.host}/rest/api/3/user/search?query=${encodeURIComponent(nameOrEmail)}`
      const res = await fetch(url, {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
      })
      if (!res.ok) return null
      const users = await res.json()
      return users[0]?.accountId ?? null
    } catch {
      return null
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.host}/rest/api/3/myself`, {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
