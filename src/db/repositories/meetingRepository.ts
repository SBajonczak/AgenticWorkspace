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

  async findByIdAndTenant(id: string, tenantId?: string): Promise<MeetingWithDetails | null> {
    return prisma.meeting.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        todos: { include: { ticketSync: true, project: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }

  async listIndexedMeetingsForAdmin(options: {
    tenantId?: string
    userId?: string
    from?: Date
    to?: Date
    limit?: number
  }): Promise<Array<{
    id: string
    meetingId: string
    title: string
    startTime: Date
    endTime: Date
    indexedAt: Date | null
    indexedForUserId: string | null
    indexedForUserEmail: string | null
    indexedByUserId: string | null
    indexedByUserEmail: string | null
    processedAt: Date | null
    recrawlCount: number
    lastRecrawlAt: Date | null
  }>> {
    return prisma.meeting.findMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        ...(options.userId ? { indexedForUserId: options.userId } : {}),
        ...(options.from || options.to
          ? {
              indexedAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ indexedAt: 'desc' }, { startTime: 'desc' }],
      take: options.limit ?? 200,
      select: {
        id: true,
        meetingId: true,
        title: true,
        startTime: true,
        endTime: true,
        indexedAt: true,
        indexedForUserId: true,
        indexedForUserEmail: true,
        indexedByUserId: true,
        indexedByUserEmail: true,
        processedAt: true,
        recrawlCount: true,
        lastRecrawlAt: true,
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
