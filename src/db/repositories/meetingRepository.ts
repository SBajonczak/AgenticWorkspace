import { prisma } from '../prisma'
import { Meeting, Prisma } from '@prisma/client'

type MeetingWithTodos = Prisma.MeetingGetPayload<{
  include: {
    todos: true
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
        todos: {
          include: {
            jiraSync: true,
          },
        },
      },
    })
  }

  async findByMeetingId(meetingId: string): Promise<MeetingWithTodos | null> {
    return prisma.meeting.findUnique({
      where: { meetingId },
      include: {
        todos: true,
      },
    })
  }

  async findLatest(limit: number = 10): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        todos: true,
      },
    })
  }

  async findLatestProcessed(limit: number = 10): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        processedAt: {
          not: null,
        },
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
      include: {
        todos: true,
      },
    })
  }

  async findUpcoming(limit: number = 10, fromDate: Date = new Date()): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        startTime: {
          gte: fromDate,
        },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
      include: {
        todos: true,
      },
    })
  }

  async update(id: string, data: Prisma.MeetingUpdateInput): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data,
    })
  }

  async getLatestProcessed(): Promise<MeetingWithTodosAndJira | null> {
    return prisma.meeting.findFirst({
      where: {
        processedAt: {
          not: null,
        },
      },
      orderBy: { processedAt: 'desc' },
      include: {
        todos: {
          include: {
            jiraSync: true,
          },
        },
      },
    })
  }
}
