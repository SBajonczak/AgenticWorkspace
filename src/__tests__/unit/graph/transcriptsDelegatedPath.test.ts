import { TranscriptsClient } from '@/graph/transcripts'
import { UserTokenService } from '@/graph/userTokenService'
import { Client } from '@microsoft/microsoft-graph-client'

jest.mock('@microsoft/microsoft-graph-client')

describe('TranscriptsClient delegated path handling', () => {
  const accessToken = 'test-token'
  const userId = 'user-123'
  const meetingId = 'meeting-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses /me endpoints when a delegated token service is present', async () => {
    const requestBuilder = {
      header: jest.fn().mockReturnThis(),
      get: jest.fn(),
    }
    const mockClient = {
      api: jest.fn().mockReturnValue(requestBuilder),
      header: jest.fn().mockReturnThis(),
      get: jest.fn(),
    } as any

    ;(Client.init as jest.Mock).mockReturnValue(mockClient)

    requestBuilder.get
      .mockResolvedValueOnce({
        value: [{ id: 'transcript-1', transcriptContentUrl: null }],
      })
      .mockResolvedValueOnce('WEBVTT')

    const tokenService = {
      getValidAccessTokenForUser: jest.fn(),
    } as unknown as UserTokenService

    const client = new TranscriptsClient(accessToken, userId, tokenService)
    const result = await client.getTranscript(meetingId)

    expect(result).toBe('WEBVTT')
    expect(mockClient.api).toHaveBeenNthCalledWith(1, `/me/onlineMeetings/${meetingId}/transcripts`)
    expect(mockClient.api).toHaveBeenNthCalledWith(2, `/me/onlineMeetings/${meetingId}/transcripts/transcript-1/content`)
  })
})