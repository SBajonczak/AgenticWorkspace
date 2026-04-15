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

type MeetingWithDetails = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        ticketSync: true
        project: true
      }
    }
    projectStatuses: true
    minutes: true
  }
}>

type MeetingWithPreparationData = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        ticketSync: true
      }
    }
    projectStatuses: true
    minutes: true
  }
}>

export class MeetingRepository {
  private buildUserScope(userEmail?: string, tenantId?: string): Prisma.MeetingWhereInput {
    if (!userEmail) {
      return tenantId ? { tenantId } : {}
    }

    const normalizedEmail = userEmail.toLowerCase()
    return {
      ...(tenantId ? { tenantId } : {}),
      OR: [
        { organizerEmail: normalizedEmail },
        { participants: { contains: `"${normalizedEmail}"` } },
      ],
    }
  }

  async create(data: Prisma.MeetingCreateInput): Promise<Meeting> {
    return prisma.meeting.create({ data })
  }

  async findById(id: string): Promise<MeetingWithDetails | null> {
    return prisma.meeting.findUnique({
      where: { id },
      include: {
        todos: { include: { ticketSync: true, project: true } },
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
  async findLatest(limit: number = 10, tenantId?: string, userEmail?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: this.buildUserScope(userEmail, tenantId),
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        todos: { include: { ticketSync: true } },
      },
    })
  }

  async findLatestProcessed(limit: number = 10, tenantId?: string, userEmail?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        ...this.buildUserScope(userEmail, tenantId),
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

  async findUpcoming(limit: number = 10, fromDate: Date = new Date(), tenantId?: string, userEmail?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        ...this.buildUserScope(userEmail, tenantId),
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

  async findRelatedPastMeetings(
    options: {
      title: string
      organizerEmail?: string | null
      before: Date
      excludeInternalMeetingId: string
      limit?: number
      tenantId?: string
      userEmail?: string
    }
  ): Promise<MeetingWithPreparationData[]> {
    const searchTerms = options.title
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4)
      .slice(0, 3)

    const titleFilters: Prisma.MeetingWhereInput[] = searchTerms.map((term) => ({
      title: {
        contains: term,
      },
    }))

    const relationSignals: Prisma.MeetingWhereInput[] = []
    if (titleFilters.length > 0) {
      relationSignals.push(...titleFilters)
    }
    if (options.organizerEmail) {
      relationSignals.push({ organizerEmail: options.organizerEmail.toLowerCase() })
    }

    return prisma.meeting.findMany({
      where: {
        ...this.buildUserScope(options.userEmail, options.tenantId),
        id: { not: options.excludeInternalMeetingId },
        processedAt: { not: null },
        startTime: { lt: options.before },
        ...(relationSignals.length > 0 ? { OR: relationSignals } : {}),
      },
      orderBy: { startTime: 'desc' },
      take: options.limit ?? 5,
      include: {
        todos: { include: { ticketSync: true } },
        projectStatuses: true,
        minutes: true,
      },
    })
  }

  async update(id: string, data: Prisma.MeetingUpdateInput): Promise<Meeting> {
    return prisma.meeting.update({ where: { id }, data })
  }

  /** Update only the delta-sync tracking fields without touching processing state. */
  async updateSyncMeta(id: string, graphLastModifiedAt: Date | null, lastSyncedAt: Date): Promise<Meeting> {
    return prisma.meeting.update({
      where: { id },
      data: {
        lastSyncedAt,
        ...(graphLastModifiedAt !== null ? { graphLastModifiedAt } : {}),
      },
    })
  }

  async getLatestProcessed(tenantId?: string): Promise<MeetingWithDetails | null> {
    return prisma.meeting.findFirst({
      where: {
        processedAt: { not: null },
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { processedAt: 'desc' },
      include: {
        todos: { include: { ticketSync: true, project: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }
}
