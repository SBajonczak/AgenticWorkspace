import { prisma } from '../prisma'
import { Meeting, Prisma } from '@prisma/client'

export class MeetingRepository {
  async create(data: Prisma.MeetingCreateInput): Promise<Meeting> {
    return prisma.meeting.create({ data })
  }

  async findById(id: string): Promise<Meeting | null> {
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

  async findByMeetingId(meetingId: string): Promise<Meeting | null> {
    return prisma.meeting.findUnique({
      where: { meetingId },
      include: {
        todos: true,
      },
    })
  }

  async findLatest(limit: number = 10): Promise<Meeting[]> {
    return prisma.meeting.findMany({
      orderBy: { startTime: 'desc' },
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

  async getLatestProcessed(): Promise<Meeting | null> {
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
