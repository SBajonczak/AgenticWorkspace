/** @jest-environment node */

jest.mock('@/graph/auth', () => ({
  createGraphAuth: jest.fn(() => ({
    getAccessToken: jest.fn().mockResolvedValue('token-from-auth'),
  })),
}))

jest.mock('@/graph/meetings', () => ({
  MeetingsClient: jest.fn(),
}))

jest.mock('@/graph/transcripts', () => ({
  TranscriptsClient: jest.fn(),
}))

jest.mock('@/db/repositories/meetingRepository', () => ({
  MeetingRepository: jest.fn(),
}))

jest.mock('@/db/repositories/todoRepository', () => ({
  TodoRepository: jest.fn(() => ({
    findByMeetingId: jest.fn().mockResolvedValue([]),
  })),
}))

jest.mock('@/db/repositories/jiraSyncRepository', () => ({
  JiraSyncRepository: jest.fn(() => ({
    markSynced: jest.fn(),
    markFailed: jest.fn(),
  })),
}))

jest.mock('@/db/repositories/meetingMinutesRepository', () => ({
  MeetingMinutesRepository: jest.fn(),
}))

jest.mock('@/db/repositories/projectStatusRepository', () => ({
  ProjectStatusRepository: jest.fn(),
}))

jest.mock('@/ai/llmClient', () => ({
  createLLMClient: jest.fn(),
}))

jest.mock('@/agent/meetingProcessor', () => ({
  MeetingProcessor: jest.fn(() => ({
    processMeeting: jest.fn(),
  })),
}))

jest.mock('@/jira/client', () => ({
  createJiraClient: jest.fn(() => null),
}))

import { AgentRunner } from '@/agent/runner'
import { MeetingsClient } from '@/graph/meetings'
import { TranscriptsClient } from '@/graph/transcripts'

describe('AgentRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('skips meetings that have not ended yet', async () => {
    ;(MeetingsClient as jest.Mock).mockImplementation(() => ({
      getLatestMeeting: jest.fn().mockResolvedValue([
        {
          id: 'future-online-meeting-id',
          subject: 'Future Recurring Meeting',
          organizer: {
            emailAddress: {
              name: 'Alice',
              address: 'alice@example.com',
            },
          },
          start: { dateTime: '2099-05-08T08:00:00Z', timeZone: 'UTC' },
          end: { dateTime: '2099-05-08T09:00:00Z', timeZone: 'UTC' },
          participants: ['alice@example.com'],
        },
      ]),
    }))

    const transcriptGetMock = jest.fn().mockResolvedValue('should never be used')
    ;(TranscriptsClient as jest.Mock).mockImplementation(() => ({
      getTranscript: transcriptGetMock,
    }))

    const runner = new AgentRunner(true, {
      accessToken: 'pre-acquired-token',
      targetUserId: 'user-1',
    })

    const result = await runner.run()

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
    expect(TranscriptsClient).not.toHaveBeenCalled()
    expect(transcriptGetMock).not.toHaveBeenCalled()
  })
})
