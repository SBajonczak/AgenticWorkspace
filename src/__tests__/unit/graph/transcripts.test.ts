import { TranscriptsClient } from '@/graph/transcripts'
import { UserTokenService, ReauthRequiredError } from '@/graph/userTokenService'
import { Client } from '@microsoft/microsoft-graph-client'

// Mock the Graph client
jest.mock('@microsoft/microsoft-graph-client')

describe('TranscriptsClient', () => {
  let mockClient: jest.Mocked<Client>
  let mockTokenService: jest.Mocked<UserTokenService>
  const accessToken = 'test-token-123'
  const userId = 'user-123'
  const meetingId = 'meeting-abc'

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock Graph client
    mockClient = {
      api: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      get: jest.fn(),
    } as any

    ;(Client.init as jest.Mock).mockReturnValue(mockClient)

    // Setup mock TokenService
    mockTokenService = {
      getValidAccessTokenForUser: jest.fn(),
    } as any
  })

  describe('constructor', () => {
    it('should initialize without userId and tokenService', () => {
      const client = new TranscriptsClient(accessToken)
      expect(Client.init).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: expect.any(Function),
        })
      )
    })

    it('should initialize with userId and tokenService', () => {
      const client = new TranscriptsClient(accessToken, userId, mockTokenService)
      expect(Client.init).toHaveBeenCalled()
    })
  })

  describe('getTranscript', () => {
    it('should fetch transcript successfully', async () => {
      const mockTranscriptContent = 'VTT content here'
      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({
          value: [
            {
              id: 'transcript-1',
              transcriptContentUrl: 'https://example.com/transcript.vtt',
            },
          ],
        }),
      } as any)

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockTranscriptContent),
      } as any)

      const client = new TranscriptsClient(accessToken, userId, mockTokenService)
      const result = await client.getTranscript(meetingId)

      expect(result).toBe(mockTranscriptContent)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/transcript.vtt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        })
      )
    })

    it('should return null when no transcripts found', async () => {
      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({ value: [] }),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.getTranscript(meetingId)

      expect(result).toBeNull()
    })

    it('should fall back to /content endpoint when transcriptContentUrl fails', async () => {
      const fallbackContent = 'Fallback VTT content'

      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({
          value: [
            {
              id: 'transcript-1',
              transcriptContentUrl: 'https://example.com/transcript.vtt',
            },
          ],
        }),
      } as any)

      // Mock the transcriptContentUrl fetch to fail
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as any)

      // Mock the /content endpoint to succeed
      mockClient.api.mockReturnValueOnce({
        header: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValueOnce(fallbackContent),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.getTranscript(meetingId)

      expect(result).toBe(fallbackContent)
    })

    describe('token refresh on 403', () => {
      it('should refresh token and retry when 403 occurs and tokenService is available', async () => {
        const newToken = 'refreshed-token-456'
        const mockTranscriptContent = 'Transcript after refresh'

        // First call returns 403
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockRejectedValueOnce({
            statusCode: 403,
            message: 'Access denied',
          }),
        } as any)

        // After token refresh, second call succeeds
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockResolvedValueOnce({
            value: [
              {
                id: 'transcript-1',
                transcriptContentUrl: 'https://example.com/transcript.vtt',
              },
            ],
          }),
        } as any)

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(mockTranscriptContent),
        } as any)

        mockTokenService.getValidAccessTokenForUser.mockResolvedValueOnce(newToken)

        const client = new TranscriptsClient(accessToken, userId, mockTokenService)
        const result = await client.getTranscript(meetingId)

        expect(result).toBe(mockTranscriptContent)
        expect(mockTokenService.getValidAccessTokenForUser).toHaveBeenCalledWith(userId)
        // Should reinitialize client with new token
        expect(Client.init).toHaveBeenCalledTimes(2)
      })

      it('should throw ReauthRequiredError when token refresh fails', async () => {
        const reauthError = new ReauthRequiredError('No refresh token available')

        // First call returns 403
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockRejectedValueOnce({
            statusCode: 403,
            message: 'Access denied',
          }),
        } as any)

        mockTokenService.getValidAccessTokenForUser.mockRejectedValueOnce(reauthError)

        const client = new TranscriptsClient(accessToken, userId, mockTokenService)

        await expect(client.getTranscript(meetingId)).rejects.toThrow(ReauthRequiredError)
      })

      it('should return null when token refresh throws non-ReauthRequiredError', async () => {
        const refreshError = new Error('Network error during refresh')

        // First call returns 403
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockRejectedValueOnce({
            statusCode: 403,
            message: 'Access denied',
          }),
        } as any)

        mockTokenService.getValidAccessTokenForUser.mockRejectedValueOnce(refreshError)

        const client = new TranscriptsClient(accessToken, userId, mockTokenService)
        const result = await client.getTranscript(meetingId)

        expect(result).toBeNull()
      })

      it('should NOT retry if 403 without tokenService', async () => {
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockRejectedValueOnce({
            statusCode: 403,
            message: 'Access denied',
          }),
        } as any)

        const client = new TranscriptsClient(accessToken) // No tokenService
        const result = await client.getTranscript(meetingId)

        expect(result).toBeNull()
        expect(mockTokenService.getValidAccessTokenForUser).not.toHaveBeenCalled()
      })

      it('should NOT retry if 403 without userId', async () => {
        mockClient.api.mockReturnValueOnce({
          get: jest.fn().mockRejectedValueOnce({
            statusCode: 403,
            message: 'Access denied',
          }),
        } as any)

        const client = new TranscriptsClient(accessToken, undefined, mockTokenService) // No userId
        const result = await client.getTranscript(meetingId)

        expect(result).toBeNull()
        expect(mockTokenService.getValidAccessTokenForUser).not.toHaveBeenCalled()
      })
    })

    it('should parse transcript array content', async () => {
      const arrayContent = [
        { speaker: 'Alice', text: 'Hello', timestamp: '0:00' },
        { speaker: 'Bob', text: 'Hi there', timestamp: '0:05' },
      ]

      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({
          value: [
            {
              id: 'transcript-1',
              transcriptContentUrl: null,
            },
          ],
        }),
      } as any)

      mockClient.api.mockReturnValueOnce({
        header: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValueOnce(arrayContent),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.getTranscript(meetingId)

      expect(result).toContain('[0:00] Alice: Hello')
      expect(result).toContain('[0:05] Bob: Hi there')
    })
  })

  describe('hasTranscript', () => {
    it('should return true when transcripts exist', async () => {
      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({
          value: [{ id: 'transcript-1' }],
        }),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.hasTranscript(meetingId)

      expect(result).toBe(true)
    })

    it('should return false when no transcripts exist', async () => {
      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({ value: [] }),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.hasTranscript(meetingId)

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockClient.api.mockReturnValueOnce({
        get: jest.fn().mockRejectedValueOnce(new Error('Network error')),
      } as any)

      const client = new TranscriptsClient(accessToken)
      const result = await client.hasTranscript(meetingId)

      expect(result).toBe(false)
    })
  })
})
