/** @jest-environment node */
/**
 * Integration tests for the worker agent cycle (unit-style with all deps mocked).
 */

jest.mock('@/graph/appAuth')
jest.mock('@/graph/meetings')
jest.mock('@/graph/transcripts')
jest.mock('@/ai/llmClient')
jest.mock('@/db/repositories/meetingRepository')
jest.mock('@/db/repositories/todoRepository')
jest.mock('@/db/repositories/meetingMinutesRepository')
jest.mock('@/db/repositories/projectStatusRepository')
jest.mock('@/db/repositories/ticketSyncRepository')
jest.mock('@/db/repositories/tenantRepository')
jest.mock('@/tickets/factory')
jest.mock('node-cron', () => ({ schedule: jest.fn() }))  // prevent real cron timer

import { createAppGraphAuth } from '@/graph/appAuth'
import { MeetingsClient } from '@/graph/meetings'
import { TranscriptsClient } from '@/graph/transcripts'
import { createLLMClient } from '@/ai/llmClient'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { TicketSyncRepository } from '@/db/repositories/ticketSyncRepository'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { createTicketProvider, createTicketProviderFromEnv } from '@/tickets/factory'

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

const mockAgentResponse = {
  meetingSummary: { summary: 'Planned Q3.', decisions: [] },
  todos: [{ title: 'Write spec', description: 'Write the spec doc', assigneeHint: null, confidence: 0.9, priority: 'medium', dueDate: null }],
  projectStatuses: [],
  meetingMinutes: { en: '# Minutes' },
}

function setupMocks() {
  ;(createAppGraphAuth as jest.Mock).mockReturnValue({ getAccessToken: jest.fn().mockResolvedValue('mock-token') })
  ;(MeetingsClient as jest.Mock).mockImplementation(() => ({ getLatestMeeting: jest.fn().mockResolvedValue(mockMeetings) }))
  ;(TranscriptsClient as jest.Mock).mockImplementation(() => ({ getTranscript: jest.fn().mockResolvedValue('Transcript text here') }))
  ;(createLLMClient as jest.Mock).mockReturnValue({ processTranscript: jest.fn().mockResolvedValue(mockAgentResponse) })
  ;(MeetingRepository as jest.Mock).mockImplementation(() => ({
    findByMeetingId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'db-meeting-1', meetingId: 'ms-meeting-1', title: 'Q3 Planning', tenantId: 'tenant-1' }),
    update: jest.fn().mockImplementation((id: string, data: any) => Promise.resolve({ id, ...data })),
  }))
  ;(TodoRepository as jest.Mock).mockImplementation(() => ({
    createMany: jest.fn().mockResolvedValue(1),
    findByMeetingId: jest.fn().mockResolvedValue([{ id: 'todo-1', title: 'Write spec', description: '...', assigneeHint: null, priority: 'medium', dueDate: null }]),
  }))
  ;(MeetingMinutesRepository as jest.Mock).mockImplementation(() => ({ upsert: jest.fn().mockResolvedValue({}) }))
  ;(ProjectStatusRepository as jest.Mock).mockImplementation(() => ({
    deleteByMeetingId: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(0),
  }))
  ;(TicketSyncRepository as jest.Mock).mockImplementation(() => ({
    markSynced: jest.fn().mockResolvedValue({}),
    markFailed: jest.fn().mockResolvedValue({}),
  }))
  ;(TenantRepository as jest.Mock).mockImplementation(() => ({
    findOrCreate: jest.fn().mockResolvedValue({ id: 'tenant-1', ticketProvider: 'none', ticketConfig: null }),
    getTicketConfig: jest.fn().mockResolvedValue(null),
  }))
  ;(createTicketProvider as jest.Mock).mockReturnValue({ type: 'none', createTicket: jest.fn(), findAssignee: jest.fn(), testConnection: jest.fn() })
  ;(createTicketProviderFromEnv as jest.Mock).mockReturnValue({ type: 'none', createTicket: jest.fn(), findAssignee: jest.fn(), testConnection: jest.fn() })
}

describe('Worker scheduler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
    process.env = {
      ...originalEnv,
      GRAPH_TARGET_USER_ID: 'alice@example.com',
      AZURE_TENANT_ID: 'azure-tenant-id',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('startWorker is exported and cron is scheduled', async () => {
    const cron = require('node-cron')
    const { startWorker } = await import('@/worker/scheduler')
    startWorker(30)
    expect(cron.schedule).toHaveBeenCalledWith('*/30 * * * *', expect.any(Function))
  })

  it('MeetingsClient is constructed with target user ID', async () => {
    const { startWorker } = await import('@/worker/scheduler')
    startWorker(30)
    // Give the initial async cycle a chance to start
    await new Promise((r) => setTimeout(r, 100))
    expect(MeetingsClient).toHaveBeenCalledWith('mock-token', 'alice@example.com')
  })

  it('skips already-processed meetings without calling LLM', async () => {
    ;(MeetingRepository as jest.Mock).mockImplementation(() => ({
      findByMeetingId: jest.fn().mockResolvedValue({ id: 'db-1', processedAt: new Date() }),
      create: jest.fn(),
      update: jest.fn(),
    }))
    const llmClientMock = { processTranscript: jest.fn() }
    ;(createLLMClient as jest.Mock).mockReturnValue(llmClientMock)

    const { startWorker } = await import('@/worker/scheduler')
    startWorker(30)
    await new Promise((r) => setTimeout(r, 100))

    expect(llmClientMock.processTranscript).not.toHaveBeenCalled()
  })
})
