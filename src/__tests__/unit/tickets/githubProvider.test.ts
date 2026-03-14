/** @jest-environment node */
import { GitHubTicketProvider } from '@/tickets/providers/github'
import fetch from 'isomorphic-fetch'
import { GitHubProviderConfig, TicketInput } from '@/tickets/types'

jest.mock('isomorphic-fetch', () => jest.fn())

const config: GitHubProviderConfig = {
  type: 'github',
  token: 'ghp_test',
  owner: 'my-org',
  repo: 'my-repo',
}

const baseInput: TicketInput = {
  title: 'Implement dark mode',
  description: 'Add dark mode toggle to settings.',
  priority: 'medium',
}

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response
}

describe('GitHubTicketProvider', () => {
  let provider: GitHubTicketProvider

  beforeEach(() => {
    provider = new GitHubTicketProvider(config);
    (fetch as jest.Mock).mockReset()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('github')
  })

  describe('createTicket', () => {
    it('creates an issue and returns TicketResult', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ id: 9876, number: 42, html_url: 'https://github.com/my-org/my-repo/issues/42' })
      )

      const result = await provider.createTicket(baseInput)

      expect(result.provider).toBe('github')
      expect(result.key).toBe('#42')
      expect(result.url).toBe('https://github.com/my-org/my-repo/issues/42')
    })

    it('adds priority label to issue', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ id: 1, number: 1, html_url: 'https://github.com/my-org/my-repo/issues/1' })
      )

      await provider.createTicket({ ...baseInput, priority: 'high' })

      const body = JSON.parse(((fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string)
      expect(body.labels).toContain('priority:high')
    })

    it('throws on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, 404))
      await expect(provider.createTicket(baseInput)).rejects.toThrow('GitHub createTicket failed 404')
    })
  })

  describe('testConnection', () => {
    it('returns true when repo is accessible', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ full_name: 'my-org/my-repo' }))
      expect(await provider.testConnection()).toBe(true)
    })

    it('returns false on 404', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, 404))
      expect(await provider.testConnection()).toBe(false)
    })
  })
})
