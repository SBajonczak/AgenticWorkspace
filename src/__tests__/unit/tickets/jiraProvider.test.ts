/** @jest-environment node */
import { JiraTicketProvider } from '@/tickets/providers/jira'
import fetch from 'isomorphic-fetch'
import { JiraProviderConfig, TicketInput } from '@/tickets/types'

// isomorphic-fetch is mocked so providers do not make real HTTP calls
jest.mock('isomorphic-fetch', () => jest.fn())

const config: JiraProviderConfig = {
  type: 'jira',
  host: 'https://test.atlassian.net',
  email: 'bot@example.com',
  apiToken: 'test-token',
  projectKey: 'TEST',
}

const baseInput: TicketInput = {
  title: 'Fix login bug',
  description: 'Users cannot log in after the last deploy.',
  priority: 'high',
  assigneeHint: 'john.doe@example.com',
  meetingTitle: 'Sprint Review',
}

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response
}

describe('JiraTicketProvider', () => {
  let provider: JiraTicketProvider

  beforeEach(() => {
    provider = new JiraTicketProvider(config);
    (fetch as jest.Mock).mockReset()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('jira')
  })

  describe('createTicket', () => {
    it('creates a task and returns TicketResult', async () => {
      // findAssignee call
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse([{ accountId: 'acc-123' }]));
      // createIssue call
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ id: '10001', key: 'TEST-42', self: 'https://test.atlassian.net/rest/api/3/issue/10001' }))

      const result = await provider.createTicket(baseInput)

      expect(result.provider).toBe('jira')
      expect(result.key).toBe('TEST-42')
      expect(result.url).toBe('https://test.atlassian.net/browse/TEST-42')
      expect(result.id).toBe('10001')
    })

    it('creates a task without assignee when hint is not provided', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ id: '10002', key: 'TEST-43', self: '' }))

      const result = await provider.createTicket({ ...baseInput, assigneeHint: undefined })

      expect(result.key).toBe('TEST-43')
      expect(fetch as jest.Mock).toHaveBeenCalledTimes(1) // no findAssignee call
    })

    it('throws on HTTP error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ errorMessages: ['Not found'] }, 400))

      await expect(provider.createTicket({ ...baseInput, assigneeHint: undefined })).rejects.toThrow(
        'Jira createTicket failed 400'
      )
    })

    it('includes meeting title in description', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ id: '10003', key: 'TEST-44', self: '' }))

      await provider.createTicket({ ...baseInput, assigneeHint: undefined, meetingTitle: 'Q4 Planning' })

      const body = JSON.parse(((fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string)
      const textContent = body.fields.description.content[0].content[0].text
      expect(textContent).toContain('Q4 Planning')
    })

    it('maps priority correctly', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ id: '10004', key: 'TEST-45', self: '' }))

      await provider.createTicket({ ...baseInput, assigneeHint: undefined, priority: 'low' })

      const body = JSON.parse(((fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string)
      expect(body.fields.priority.name).toBe('Low')
    })
  })

  describe('findAssignee', () => {
    it('returns accountId when user is found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse([{ accountId: 'acc-456', displayName: 'Jane' }]))

      const id = await provider.findAssignee('jane@example.com')
      expect(id).toBe('acc-456')
    })

    it('returns null when no users match', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse([]))

      const id = await provider.findAssignee('ghost@example.com')
      expect(id).toBeNull()
    })

    it('returns null on fetch error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const id = await provider.findAssignee('anyone')
      expect(id).toBeNull()
    })
  })

  describe('testConnection', () => {
    it('returns true on successful API call', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ accountId: 'me' }))
      expect(await provider.testConnection()).toBe(true)
    })

    it('returns false on non-OK response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse({}, 401))
      expect(await provider.testConnection()).toBe(false)
    })

    it('returns false on network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'))
      expect(await provider.testConnection()).toBe(false)
    })
  })
})
