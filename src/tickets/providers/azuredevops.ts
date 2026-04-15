import fetch from 'isomorphic-fetch'
import { ITicketProvider, TicketInput, TicketResult, AzureDevOpsProviderConfig } from '../types'

const API_VERSION = '7.1'

const PRIORITY_MAP: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
}

export class AzureDevOpsTicketProvider implements ITicketProvider {
  readonly type = 'azuredevops' as const
  private baseUrl: string
  private headers: Record<string, string>

  constructor(private config: AzureDevOpsProviderConfig) {
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}`
    const token = Buffer.from(`:${config.personalAccessToken}`).toString('base64')
    this.headers = {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json-patch+json',
      Accept: 'application/json',
    }
  }

  async createTicket(input: TicketInput): Promise<TicketResult> {
    const assigneeId = input.assigneeHint
      ? await this.findAssignee(input.assigneeHint)
      : null

    const description = [
      input.description,
      input.meetingTitle ? `<br/><b>Meeting:</b> ${input.meetingTitle}` : '',
      input.meetingUrl ? `<br/><b>Link:</b> <a href="${input.meetingUrl}">${input.meetingUrl}</a>` : '',
    ]
      .join('')
      .trim()

    const patchDoc = [
      { op: 'add', path: '/fields/System.Title', value: input.title },
      { op: 'add', path: '/fields/System.Description', value: description },
      { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: PRIORITY_MAP[input.priority] ?? 2 },
      ...(assigneeId ? [{ op: 'add', path: '/fields/System.AssignedTo', value: assigneeId }] : []),
    ]

    const res = await fetch(
      `${this.baseUrl}/_apis/wit/workitems/$Task?api-version=${API_VERSION}`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(patchDoc),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Azure DevOps createTicket failed ${res.status}: ${err}`)
    }

    const data = await res.json()
    return {
      id: String(data.id),
      key: `AB#${data.id}`,
      url: data._links?.html?.href ?? `${this.baseUrl}/_workitems/edit/${data.id}`,
      provider: 'azuredevops',
    }
  }

  async findAssignee(nameOrEmail: string): Promise<string | null> {
    try {
      const encoded = encodeURIComponent(nameOrEmail)
      const url =
        `https://vssps.dev.azure.com/${this.config.organization}/_apis/` +
        `identities?searchFilter=General&filterValue=${encoded}&api-version=${API_VERSION}`

      const res = await fetch(url, {
        headers: { ...this.headers, 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      const data = await res.json()
      const identity = (data.value ?? [])[0]
      return identity?.providerDisplayName ?? identity?.subjectDescriptor ?? null
    } catch {
      return null
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/_apis/projects?api-version=${API_VERSION}`,
        { headers: { ...this.headers, 'Content-Type': 'application/json' } }
      )
      return res.ok
    } catch {
      return false
    }
  }
}
