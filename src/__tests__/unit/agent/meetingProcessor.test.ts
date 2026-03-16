/** @jest-environment node */
import { MeetingProcessor } from '@/agent/meetingProcessor'
import { NoneTicketProvider } from '@/tickets/providers/none'
import { AgentResponse } from '@/ai/llmClient'
import { ProjectRepository } from '@/db/repositories/projectRepository'

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
  deleteByMeetingId: jest.fn().mockResolvedValue(undefined),
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

const makeMockProjectRepo = () => ({
  findByNameOrAlias: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation(async ({ name, tenantId, description, confirmed, status }) => ({
    id: `project-${name.toLowerCase().replace(/\s+/g, '-')}`,
    tenantId,
    name,
    description: description ?? null,
    status: status ?? 'active',
    owner: null,
    archived: false,
    confirmed: confirmed ?? false,
    aliases: [],
    sourceLinks: [],
  })),
})

// ---------- Tests ----------

describe('MeetingProcessor', () => {
  const makeProcessor = (
    ticketProvider = new NoneTicketProvider(),
    projectRepo = makeMockProjectRepo()
  ) =>
    new MeetingProcessor(
      makeMockLLMClient() as any,
      makeMockMeetingRepo() as any,
      makeMockTodoRepo() as any,
      makeMockMinutesRepo() as any,
      makeMockProjectStatusRepo() as any,
      makeMockTicketSyncRepo() as any,
      ticketProvider,
      projectRepo as any
    )

  describe('processMeeting', () => {
    it('creates a new meeting and returns a result', async () => {
      const processor = makeProcessor()
      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
      )

      expect(result.meeting).toBeDefined()
      expect(result.todosCreated).toBe(1)
      expect(result.minutesCreated).toBe(2) // en + de
      expect(result.projectStatusesCreated).toBe(1)
    })

    it('deletes existing todos before creating new ones', async () => {
      const todoRepo = makeMockTodoRepo()
      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        todoRepo as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        makeMockTicketSyncRepo() as any,
        new NoneTicketProvider(),
        makeMockProjectRepo() as any
      )

      await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
      )

      expect(todoRepo.deleteByMeetingId).toHaveBeenCalledWith(mockMeeting.id)
      expect(todoRepo.createMany).toHaveBeenCalled()
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
        new NoneTicketProvider(),
        makeMockProjectRepo() as any
      )

      await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
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
        mockProvider,
        makeMockProjectRepo() as any
      )

      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
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
        mockProvider,
        makeMockProjectRepo() as any
      )

      const result = await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
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
        makeMockTicketSyncRepo() as any,
        new NoneTicketProvider(),
        makeMockProjectRepo() as any
      )

      await processor.processMeeting(
        'ms-teams-id', 'Q3 Planning', 'Alice', 'alice@example.com',
        new Date(), new Date(), 'transcript text', [], 'tenant-1'
      )

      expect(meetingRepo.create).not.toHaveBeenCalled()
      expect(meetingRepo.update).toHaveBeenCalled()
    })

    it('auto-creates unconfirmed projects and links matching todos', async () => {
      const todoRepo = makeMockTodoRepo()
      const projectRepo = makeMockProjectRepo()
      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        todoRepo as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        makeMockTicketSyncRepo() as any,
        new NoneTicketProvider(),
        projectRepo as any
      )

      await processor.processMeeting(
        'ms-teams-id',
        'Q3 Planning',
        'Alice',
        'alice@example.com',
        new Date('2026-03-14T09:00:00Z'),
        new Date('2026-03-14T10:00:00Z'),
        'transcript text',
        [],
        'tenant-1'
      )

      expect(projectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Atlas',
          confirmed: false,
        })
      )
      expect(todoRepo.createMany).toHaveBeenCalledWith([
        expect.objectContaining({
          meetingId: mockMeeting.id,
          projectId: 'project-atlas',
        }),
      ])
    })

    it('reuses an existing fuzzy-matched project without creating a duplicate', async () => {
      const todoRepo = makeMockTodoRepo()
      const projectRepo = makeMockProjectRepo()
      projectRepo.findByNameOrAlias.mockResolvedValue({
        id: 'project-atlas-existing',
        tenantId: 'tenant-1',
        name: 'Atlas Platform',
        description: null,
        status: 'active',
        owner: null,
        archived: false,
        confirmed: true,
        aliases: [],
        sourceLinks: [],
      })

      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        todoRepo as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        makeMockTicketSyncRepo() as any,
        new NoneTicketProvider(),
        projectRepo as any
      )

      await processor.processMeeting(
        'ms-teams-id',
        'Q3 Planning',
        'Alice',
        'alice@example.com',
        new Date(),
        new Date(),
        'transcript text',
        [],
        'tenant-1'
      )

      expect(projectRepo.create).not.toHaveBeenCalled()
      expect(todoRepo.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ projectId: 'project-atlas-existing' }),
      ])
    })

    it('auto-creates a project for extracted status even when tenantId is missing', async () => {
      const todoRepo = makeMockTodoRepo()
      const projectRepo = makeMockProjectRepo()
      const processor = new MeetingProcessor(
        makeMockLLMClient() as any,
        makeMockMeetingRepo() as any,
        todoRepo as any,
        makeMockMinutesRepo() as any,
        makeMockProjectStatusRepo() as any,
        makeMockTicketSyncRepo() as any,
        new NoneTicketProvider(),
        projectRepo as any
      )

      await processor.processMeeting(
        'ms-teams-id',
        'Q3 Planning',
        'Alice',
        'alice@example.com',
        new Date(),
        new Date(),
        'transcript text',
        []
      )

      expect(projectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          name: 'Atlas',
          confirmed: false,
        })
      )
      expect(todoRepo.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ projectId: 'project-atlas' }),
      ])
    })
  })
})
