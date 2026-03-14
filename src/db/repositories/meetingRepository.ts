import { prisma } from '../prisma'
import { Meeting, Prisma } from '@prisma/client'

type MeetingWithTodos = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        ticketSync: true
      }
    }
  }
}>

type MeetingWithTodosAndJira = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        jiraSync: true
      }
    }
  }
}>

export class MeetingRepository {
  async create(data: Prisma.MeetingCreateInput): Promise<Meeting> {
    return prisma.meeting.create({ data })
  }

  async findById(id: string): Promise<MeetingWithTodosAndJira | null> {
    return prisma.meeting.findUnique({
      where: { id },
      include: {
        todos: { include: { ticketSync: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }

  async findByMeetingId(meetingId: string): Promise<MeetingWithTodos | null> {
    return prisma.meeting.findUnique({
      where: { meetingId },
      include: { todos: { include: { ticketSync: true } } },
    })
  }

  /** List meetings, optionally scoped to a tenant. */
  async findLatest(limit: number = 10, tenantId?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        todos: { include: { ticketSync: true } },
      },
    })
  }

  async findLatestProcessed(limit: number = 10, tenantId?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        processedAt: {
          not: null,
        },
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
      include: {
        todos: { include: { ticketSync: true } },
      },
    })
  }

  async findUpcoming(limit: number = 10, fromDate: Date = new Date(), tenantId?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        startTime: {
          gte: fromDate,
        },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
      include: {
        todos: { include: { ticketSync: true } },
      },
    })
  }

  async update(id: string, data: Prisma.MeetingUpdateInput): Promise<Meeting> {
    return prisma.meeting.update({ where: { id }, data })
  }

  async getLatestProcessed(tenantId?: string): Promise<MeetingWithTodosAndJira | null> {
    return prisma.meeting.findFirst({
      where: {
        processedAt: { not: null },
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { processedAt: 'desc' },
      include: {
        todos: { include: { ticketSync: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }
}
