/** @jest-environment node */

jest.mock('@/db/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
  },
}))

import { registerWriteTools } from '@/mcp/tools/writeTools'
import { prisma } from '@/db/prisma'

describe('registerWriteTools', () => {
  const toolHandlers = new Map<string, Function>()

  const mockServer = {
    tool: jest.fn((name: string, _description: string, _schema: unknown, handler: Function) => {
      toolHandlers.set(name, handler)
    }),
  }

  const deps = {
    meetingRepo: {
      update: jest.fn(),
      findById: jest.fn(),
    },
    todoRepo: {
      deleteByMeetingId: jest.fn(),
      createMany: jest.fn(),
      findByMeetingId: jest.fn(),
      assignProject: jest.fn(),
    },
    minutesRepo: {
      deleteByMeetingId: jest.fn(),
      upsert: jest.fn(),
    },
    projectStatusRepo: {
      deleteByMeetingId: jest.fn(),
      createMany: jest.fn(),
    },
    projectRepo: {
      findOrCreateByNameOrAlias: jest.fn(),
    },
  }

  const mockPrisma = prisma as any

  beforeEach(() => {
    jest.clearAllMocks()
    toolHandlers.clear()
    registerWriteTools(mockServer as any, deps as any)
  })

  it('save_todos resolves assigneeUserId from assigneeHint email', async () => {
    deps.meetingRepo.findById.mockResolvedValue({
      id: 'meeting-1',
      tenantId: 'tenant-1',
      participants: JSON.stringify(['bob@example.com']),
    })
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-2' })
    deps.todoRepo.findByMeetingId.mockResolvedValue([{ id: 'todo-1' }])

    const handler = toolHandlers.get('save_todos')
    expect(handler).toBeDefined()

    const result = await handler({
      meetingDbId: 'meeting-1',
      todos: [
        {
          title: 'Task',
          description: 'Desc',
          assigneeHint: 'bob@example.com',
          confidence: 0.8,
          priority: 'high',
          dueDate: null,
        },
      ],
    })

    expect(deps.todoRepo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        meetingId: 'meeting-1',
        assigneeUserId: 'user-2',
        assigneeHint: 'bob@example.com',
      }),
    ])
    expect(result.content[0].text).toBe('["todo-1"]')
  })
})
