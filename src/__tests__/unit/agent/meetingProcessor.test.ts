/** @jest-environment node */
import { MeetingProcessor } from '@/agent/meetingProcessor'
import { NoneTicketProvider } from '@/tickets/providers/none'
import { AgentResponse } from '@/ai/llmClient'

// ---------- Mocks ----------

const mockAgentResponse: AgentResponse = {
  meetingSummary: {
    summary: 'Key decisions were made about Q3 roadmap.',
    decisions: ['Ship feature A in July', 'Postpone feature B'],
  },
  todos: [
    {
      title: 'Draft Q3 roadmap doc',
      description: 'Create Confluence page with roadmap details.',
      assigneeHint: 'bob@example.com',
      confidence: 0.88,
      priority: 'high',
      dueDate: '2026-07-01',
    },
  ],
  projectStatuses: [
    { projectName: 'Atlas', status: 'on_track', summary: 'On schedule.' },
  ],
  meetingMinutes: {
    en: '# Meeting Minutes',
    de: '# Sitzungsprotokoll',
  },
}

const mockMeeting = {
  id: 'meeting-db-id',
  meetingId: 'ms-teams-id',
  title: 'Q3 Planning',
  organizer: 'Alice',
  organizerEmail: 'alice@example.com',
  startTime: new Date('2026-03-01T09:00:00Z'),
  endTime: new Date('2026-03-01T10:00:00Z'),
  transcript: null,
  summary: null,
  decisions: null,
  participants: '[]',
  processedAt: null,
  tenantId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const makeMockLLMClient = () => ({
  processTranscript: jest.fn().mockResolvedValue(mockAgentResponse),
})

const makeMockMeetingRepo = (existing: typeof mockMeeting | null = null) => ({
  findByMeetingId: jest.fn().mockResolvedValue(existing),
  create: jest.fn().mockResolvedValue(mockMeeting),
  update: jest.fn().mockImplementation((id, data) => Promise.resolve({ ...mockMeeting, ...data })),
})

const makeMockTodoRepo = () => ({
  createMany: jest.fn().mockResolvedValue(1),
  findByMeetingId: jest.fn().mockResolvedValue([
    { id: 'todo-1', title: 'Draft Q3 roadmap doc', description: '...', assigneeHint: 'bob@example.com', priority: 'high', dueDate: null },
  ]),
})

const makeMockMinutesRepo = () => ({
  upsert: jest.fn().mockResolvedValue({}),
})

const makeMockProjectStatusRepo = () => ({
  deleteByMeetingId: jest.fn().mockResolvedValue(undefined),
  createMany: jest.fn().mockResolvedValue(1),
})

const makeMockTicketSyncRepo = () => ({
  markSynced: jest.fn().mockResolvedValue({}),
  markFailed: jest.fn().mockResolvedValue({}),
})

// ---------- Tests ----------

describe('MeetingProcessor', () => {
  const makeProcessor = (ticketProvider = new NoneTicketProvider()) =>
    new MeetingProcessor(
      makeMockLLMClient() as any,
      makeMockMeetingRepo() as any,
      makeMockTodoRepo() as any,
      makeMockMinutesRepo() as any,
      makeMockProjectStatusRepo() as any,
      makeMockTicketSyncRepo() as any,
      ticketProvider
    )

  describe('processMeeting', () => {
    it('creates a new meeting and returns a result', async () => {
      const processor = makeProcessor()
      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text'
      )

      expect(result.meeting).toBeDefined()
      expect(result.todosCreated).toBe(1)
      expect(result.minutesCreated).toBe(2) // en + de
      expect(result.projectStatusesCreated).toBe(1)
    })

    it('does not create ticket syncs when provider is none', async () => {
      const ticketSyncRepo = makeMockTicketSyncRepo()
      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        makeMockTodoRepo() as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        ticketSyncRepo as any,
        new NoneTicketProvider()
      )

      await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text'
      )

      expect(ticketSyncRepo.markSynced).not.toHaveBeenCalled()
    })

    it('syncs todos when a real ticket provider is configured', async () => {
      const mockProvider = {
        type: 'jira' as const,
        createTicket: jest.fn().mockResolvedValue({ id: '1', key: 'TEST-1', url: 'https://jira.test/TEST-1', provider: 'jira' }),
        findAssignee: jest.fn().mockResolvedValue(null),
        testConnection: jest.fn().mockResolvedValue(true),
      }
      const ticketSyncRepo = makeMockTicketSyncRepo()

      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        makeMockTodoRepo() as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        ticketSyncRepo as any,
        mockProvider
      )

      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text'
      )

      expect(mockProvider.createTicket).toHaveBeenCalledTimes(1)
      expect(ticketSyncRepo.markSynced).toHaveBeenCalledTimes(1)
      expect(result.ticketsSynced).toBe(1)
      expect(result.ticketsFailed).toBe(0)
    })

    it('records ticket sync failures without throwing', async () => {
      const mockProvider = {
        type: 'jira' as const,
        createTicket: jest.fn().mockRejectedValue(new Error('Jira unavailable')),
        findAssignee: jest.fn(),
        testConnection: jest.fn(),
      }
      const ticketSyncRepo = makeMockTicketSyncRepo()

      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        makeMockTodoRepo() as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        ticketSyncRepo as any,
        mockProvider
      )

      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text'
      )

      expect(ticketSyncRepo.markFailed).toHaveBeenCalledWith('todo-1', 'jira', 'Jira unavailable')
      expect(result.ticketsFailed).toBe(1)
      expect(result.ticketsSynced).toBe(0)
    })

    it('reuses existing meeting record', async () => {
      const meetingRepo = makeMockMeetingRepo(mockMeeting as any)
      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        meetingRepo as any,
        makeMockTodoRepo() as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        makeMockTicketSyncRepo() as any
      )

      await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text'
      )

      expect(meetingRepo.create).not.toHaveBeenCalled()
      expect(meetingRepo.update).toHaveBeenCalled()
    })
  })
})
