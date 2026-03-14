import { ITicketProvider, TicketProviderConfig, TicketProviderType } from './types'
import { JiraTicketProvider } from './providers/jira'
import { GitHubTicketProvider } from './providers/github'
import { AzureDevOpsTicketProvider } from './providers/azuredevops'
import { NoneTicketProvider } from './providers/none'

/**
 * Create the appropriate ticket provider from a tenant's stored config.
 * Returns a NoneTicketProvider when the tenant has no provider configured.
 */
export function createTicketProvider(config: TicketProviderConfig | null | undefined): ITicketProvider {
  if (!config || config.type === 'none') {
    return new NoneTicketProvider()
  }

  switch (config.type) {
    case 'jira':
      return new JiraTicketProvider(config)
    case 'github':
      return new GitHubTicketProvider(config)
    case 'azuredevops':
      return new AzureDevOpsTicketProvider(config)
    default:
      return new NoneTicketProvider()
  }
}

/**
 * Build a TicketProviderConfig from environment variables (single-tenant / worker mode).
 * Prefer this only when no Tenant record is available; per-tenant config takes precedence.
 */
export function createTicketProviderFromEnv(): ITicketProvider {
  const type = (process.env.TICKET_PROVIDER ?? 'none') as TicketProviderType

  if (type === 'jira') {
    const host = process.env.JIRA_HOST
    const email = process.env.JIRA_EMAIL
    const apiToken = process.env.JIRA_API_TOKEN
    const projectKey = process.env.JIRA_PROJECT_KEY
    if (host && email && apiToken && projectKey) {
      return new JiraTicketProvider({ type: 'jira', host, email, apiToken, projectKey })
    }
  }

  if (type === 'github') {
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER
    const repo = process.env.GITHUB_REPO
    if (token && owner && repo) {
      return new GitHubTicketProvider({ type: 'github', token, owner, repo })
    }
  }

  if (type === 'azuredevops') {
    const organization = process.env.AZDO_ORGANIZATION
    const project = process.env.AZDO_PROJECT
    const personalAccessToken = process.env.AZDO_PAT
    if (organization && project && personalAccessToken) {
      return new AzureDevOpsTicketProvider({ type: 'azuredevops', organization, project, personalAccessToken })
    }
  }

  return new NoneTicketProvider()
}
