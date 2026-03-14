/** @jest-environment node */

jest.mock('node-cron', () => ({ schedule: jest.fn() }))
jest.mock('@/db/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))
jest.mock('@/graph/userTokenService')
jest.mock('@/graph/meetings')
jest.mock('@/graph/transcripts')
jest.mock('@/agent/meetingProcessor')
jest.mock('@/ai/llmClient')
jest.mock('@/db/repositories/meetingRepository')
jest.mock('@/db/repositories/todoRepository')
jest.mock('@/db/repositories/meetingMinutesRepository')
jest.mock('@/db/repositories/projectStatusRepository')
jest.mock('@/db/repositories/ticketSyncRepository')
jest.mock('@/db/repositories/tenantRepository')
jest.mock('@/db/repositories/userSyncStateRepository')
jest.mock('@/tickets/factory')

import { prisma } from '@/db/prisma'
import { UserTokenService } from '@/graph/userTokenService'
import { MeetingsClient } from '@/graph/meetings'
import { TranscriptsClient } from '@/graph/transcripts'
import { MeetingProcessor } from '@/agent/meetingProcessor'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { createTicketProviderFromEnv } from '@/tickets/factory'

const mockPrisma = prisma as any

const mockUsers = [
  { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' },
]

const mockMeetings = [
  {
    id: 'ms-meeting-1',
    subject: 'Q3 Planning',
    organizer: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
    start: { dateTime: '2026-03-01T09:00:00Z', timeZone: 'UTC' },
    end: { dateTime: '2026-03-01T10:00:00Z', timeZone: 'UTC' },
    participants: ['alice@example.com', 'bob@example.com'],
  },
]

describe('Worker scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockPrisma.user.findMany.mockResolvedValue(mockUsers)
    mockPrisma.user.findUnique.mockResolvedValue(mockUsers[0])

    ;(UserTokenService as jest.Mock).mockImplementation(() => ({
      getValidAccessTokenForUser: jest.fn().mockResolvedValue('delegated-token'),
    }))

    ;(MeetingsClient as jest.Mock).mockImplementation(() => ({
      getLatestMeeting: jest.fn().mockResolvedValue(mockMeetings),
    }))

    ;(TranscriptsClient as jest.Mock).mockImplementation(() => ({
      getTranscript: jest.fn().mockResolvedValue('Transcript text'),
    }))

    ;(MeetingProcessor as jest.Mock).mockImplementation(() => ({
      processMeeting: jest.fn().mockResolvedValue({ todosCreated: 1, ticketsSynced: 0 }),
    }))

    ;(MeetingRepository as jest.Mock).mockImplementation(() => ({
      findByMeetingId: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    }))

    ;(UserSyncStateRepository as jest.Mock).mockImplementation(() => ({
      markProcessing: jest.fn().mockResolvedValue({}),
      markRunSuccess: jest.fn().mockResolvedValue({}),
      markRunError: jest.fn().mockResolvedValue({}),
      setTokenState: jest.fn().mockResolvedValue({}),
    }))

    ;(TenantRepository as jest.Mock).mockImplementation(() => ({
      getTicketConfig: jest.fn().mockResolvedValue(null),
    }))

    ;(createTicketProviderFromEnv as jest.Mock).mockReturnValue({
      type: 'none',
      createTicket: jest.fn(),
      findAssignee: jest.fn(),
      testConnection: jest.fn(),
    })
  })

  it('startWorker schedules cron expression', async () => {
    const cron = require('node-cron')
    const { startWorker } = await import('@/worker/scheduler')

    startWorker(30)

    expect(cron.schedule).toHaveBeenCalledWith('*/30 * * * *', expect.any(Function))
  })

  it('runAgentCycle processes users with delegated token flow', async () => {
    const { runAgentCycle } = await import('@/worker/scheduler')

    await runAgentCycle()

    expect(UserTokenService).toHaveBeenCalled()
    expect(MeetingsClient).toHaveBeenCalledWith('delegated-token')
    expect(TranscriptsClient).toHaveBeenCalledWith('delegated-token')
    expect(MeetingProcessor).toHaveBeenCalled()
  })

  it('runAgentCycleForUser executes a direct user cycle', async () => {
    const { runAgentCycleForUser } = await import('@/worker/scheduler')

    await runAgentCycleForUser('user-1')

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, tenantId: true },
    })
    expect(MeetingProcessor).toHaveBeenCalled()
  })
})
