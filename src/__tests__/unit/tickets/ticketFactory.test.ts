/** @jest-environment node */
import { createTicketProvider } from '@/tickets/factory'
import { JiraTicketProvider } from '@/tickets/providers/jira'
import { GitHubTicketProvider } from '@/tickets/providers/github'
import { AzureDevOpsTicketProvider } from '@/tickets/providers/azuredevops'
import { NoneTicketProvider } from '@/tickets/providers/none'

describe('createTicketProvider', () => {
  it('returns NoneTicketProvider for null config', () => {
    expect(createTicketProvider(null)).toBeInstanceOf(NoneTicketProvider)
  })

  it('returns NoneTicketProvider for undefined config', () => {
    expect(createTicketProvider(undefined)).toBeInstanceOf(NoneTicketProvider)
  })

  it('returns NoneTicketProvider for { type: none }', () => {
    expect(createTicketProvider({ type: 'none' })).toBeInstanceOf(NoneTicketProvider)
  })

  it('returns JiraTicketProvider for jira config', () => {
    const provider = createTicketProvider({
      type: 'jira',
      host: 'https://test.atlassian.net',
      email: 'bot@test.com',
      apiToken: 'token',
      projectKey: 'TEST',
    })
    expect(provider).toBeInstanceOf(JiraTicketProvider)
    expect(provider.type).toBe('jira')
  })

  it('returns GitHubTicketProvider for github config', () => {
    const provider = createTicketProvider({
      type: 'github',
      token: 'ghp_test',
      owner: 'my-org',
      repo: 'my-repo',
    })
    expect(provider).toBeInstanceOf(GitHubTicketProvider)
    expect(provider.type).toBe('github')
  })

  it('returns AzureDevOpsTicketProvider for azuredevops config', () => {
    const provider = createTicketProvider({
      type: 'azuredevops',
      organization: 'my-org',
      project: 'my-project',
      personalAccessToken: 'pat',
    })
    expect(provider).toBeInstanceOf(AzureDevOpsTicketProvider)
    expect(provider.type).toBe('azuredevops')
  })
})

describe('NoneTicketProvider', () => {
  const provider = new NoneTicketProvider()

  it('createTicket returns empty result without calling any API', async () => {
    const result = await provider.createTicket({
      title: 'Test',
      description: 'Test',
      priority: 'low',
    })
    expect(result.key).toBe('')
    expect(result.provider).toBe('none')
  })

  it('findAssignee always returns null', async () => {
    expect(await provider.findAssignee('anyone')).toBeNull()
  })

  it('testConnection always returns true', async () => {
    expect(await provider.testConnection()).toBe(true)
  })
})
