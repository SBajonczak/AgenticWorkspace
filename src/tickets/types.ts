export type TicketProviderType = 'jira' | 'github' | 'azuredevops' | 'none'

export interface TicketInput {
  title: string
  description: string
  assigneeHint?: string | null   // name or email; provider resolves to its own ID
  priority: 'high' | 'medium' | 'low'
  dueDate?: Date | null
  /** Human-readable label attached to the ticket, e.g. the meeting title */
  meetingTitle?: string
  /** Deep-link back into the AgenticWorkspace meeting detail */
  meetingUrl?: string
}

export interface TicketResult {
  /** Provider-internal numeric/string ID */
  id: string
  /** Human-readable reference, e.g. "PROJ-123", "#42", "AB#1234" */
  key: string
  /** Direct URL to the created ticket in the provider's UI */
  url: string
  provider: TicketProviderType
}

/**
 * Uniform interface every ticket provider must implement.
 * Add new providers by implementing this interface and registering in factory.ts.
 */
export interface ITicketProvider {
  readonly type: TicketProviderType
  createTicket(input: TicketInput): Promise<TicketResult>
  /** Resolve a free-text name/email to the provider's assignee ID. Returns null if not found. */
  findAssignee(nameOrEmail: string): Promise<string | null>
  testConnection(): Promise<boolean>
}

/** Per-tenant configuration stored as JSON in Tenant.ticketConfig */
export interface JiraProviderConfig {
  type: 'jira'
  host: string            // https://your-org.atlassian.net
  email: string
  apiToken: string
  projectKey: string
}

export interface GitHubProviderConfig {
  type: 'github'
  token: string           // personal access token or GitHub App installation token
  owner: string           // org or user
  repo: string            // repository name
}

export interface AzureDevOpsProviderConfig {
  type: 'azuredevops'
  organization: string    // https://dev.azure.com/{organization}
  project: string
  personalAccessToken: string
}

export type TicketProviderConfig =
  | JiraProviderConfig
  | GitHubProviderConfig
  | AzureDevOpsProviderConfig
  | { type: 'none' }
