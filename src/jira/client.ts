import fetch from 'isomorphic-fetch'

export interface JiraConfig {
  host: string
  email: string
  apiToken: string
  projectKey: string
}

export interface JiraIssue {
  id: string
  key: string
  self: string
}

export interface CreateTaskInput {
  summary: string
  description: string
  assignee?: string
}

export class JiraClient {
  private config: JiraConfig
  private authHeader: string

  constructor(config: JiraConfig) {
    this.config = config
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    this.authHeader = `Basic ${auth}`
  }

  async createTask(input: CreateTaskInput): Promise<JiraIssue> {
    const url = `${this.config.host}/rest/api/3/issue`

    const payload = {
      fields: {
        project: {
          key: this.config.projectKey,
        },
        summary: input.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: input.description,
                },
              ],
            },
          ],
        },
        issuetype: {
          name: 'Task',
        },
      },
    }

    // Add assignee if provided
    if (input.assignee) {
      const accountId = await this.findUserAccountId(input.assignee)
      if (accountId) {
        ;(payload.fields as any).assignee = { accountId }
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create Jira task: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      key: data.key,
      self: data.self,
    }
  }

  async findUserAccountId(nameOrEmail: string): Promise<string | null> {
    try {
      const url = `${this.config.host}/rest/api/3/user/search?query=${encodeURIComponent(nameOrEmail)}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      const users = await response.json()
      if (users.length > 0) {
        return users[0].accountId
      }

      return null
    } catch (error) {
      console.error('Failed to find user:', error)
      return null
    }
  }

  async getIssue(issueKey: string): Promise<any> {
    const url = `${this.config.host}/rest/api/3/issue/${issueKey}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get Jira issue: ${response.status}`)
    }

    return response.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config.host}/rest/api/3/myself`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      console.error('Jira connection test failed:', error)
      return false
    }
  }
}

export function createJiraClient(): JiraClient | null {
  const host = process.env.JIRA_HOST
  const email = process.env.JIRA_EMAIL
  const apiToken = process.env.JIRA_API_TOKEN
  const projectKey = process.env.JIRA_PROJECT_KEY

  if (!host || !email || !apiToken || !projectKey) {
    console.warn('Jira configuration incomplete. Jira integration will be disabled.')
    return null
  }

  return new JiraClient({
    host,
    email,
    apiToken,
    projectKey,
  })
}
