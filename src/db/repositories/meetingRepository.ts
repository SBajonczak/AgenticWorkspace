import { prisma } from '../prisma'
import { Meeting, Prisma } from '@prisma/client'

type MeetingWithTodos = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        assigneeUser: true
        ticketSync: true
      }
    }
  }
}>

type MeetingWithDetails = Prisma.MeetingGetPayload<{
  include: {
    todos: {
      include: {
        assigneeUser: true
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
        assigneeUser: true
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
        todos: { include: { assigneeUser: true, ticketSync: true, project: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }

  async findByMeetingId(meetingId: string): Promise<MeetingWithTodos | null> {
    // Returns the most recent occurrence when multiple rows share the same meetingId
    // (recurring meeting series). Use findByMeetingIdAndStartTime for exact-match lookups.
    return prisma.meeting.findFirst({
      where: { meetingId },
      orderBy: { startTime: 'desc' },
      include: { todos: { include: { assigneeUser: true, ticketSync: true } } },
    })
  }

  async findByMeetingIdAndStartTime(meetingId: string, startTime: Date): Promise<MeetingWithTodos | null> {
    return prisma.meeting.findUnique({
      where: { meetingId_startTime: { meetingId, startTime } },
      include: { todos: { include: { assigneeUser: true, ticketSync: true } } },
    })
  }

  /** List meetings, optionally scoped to a tenant. */
  async findLatest(limit: number = 10, tenantId?: string, userEmail?: string): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: this.buildUserScope(userEmail, tenantId),
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        todos: { include: { assigneeUser: true, ticketSync: true } },
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
        todos: { include: { assigneeUser: true, ticketSync: true } },
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
        todos: { include: { assigneeUser: true, ticketSync: true } },
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
        todos: { include: { assigneeUser: true, ticketSync: true } },
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
        todos: { include: { assigneeUser: true, ticketSync: true, project: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }

  async findProcessedInWindow(options: {
    from: Date
    to: Date
    tenantId?: string
    userEmail?: string
    limit?: number
  }): Promise<MeetingWithTodos[]> {
    return prisma.meeting.findMany({
      where: {
        ...this.buildUserScope(options.userEmail, options.tenantId),
        processedAt: { not: null },
        startTime: {
          gte: options.from,
          lte: options.to,
        },
      },
      orderBy: { startTime: 'desc' },
      take: options.limit ?? 200,
      include: {
        todos: { include: { assigneeUser: true, ticketSync: true } },
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
    transcript: string | null
    summary: string | null
    decisions: string | null
    graphLastModifiedAt: Date | null
    isIndexing: boolean
    indexingStartedAt: Date | null
    organizer: string
    organizerEmail: string | null
    participants: string | null
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
        transcript: true,
        summary: true,
        decisions: true,
        graphLastModifiedAt: true,
        isIndexing: true,
        indexingStartedAt: true,
        organizer: true,
        organizerEmail: true,
        participants: true,
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
        todos: { include: { assigneeUser: true, ticketSync: true, project: true } },
        minutes: true,
        projectStatuses: true,
      },
    })
  }

  /**
   * List all meetings for a tenant without any user-scope filter.
   * Supports optional filtering by name, transcript presence, and indexing status.
   */
  async findAllForTenant(
    tenantId: string,
    filters: {
      nameSearch?: string
      hasTranscript?: boolean
      indexingStatus?: 'not_indexed' | 'indexed' | 'processing'
    } = {},
    limit: number = 100
  ): Promise<MeetingWithTodos[]> {
    const where: Prisma.MeetingWhereInput = { tenantId }

    if (filters.nameSearch) {
      where.title = { contains: filters.nameSearch, mode: 'insensitive' }
    }

    if (filters.hasTranscript === true) {
      where.transcript = { not: null }
    } else if (filters.hasTranscript === false) {
      where.transcript = null
    }

    if (filters.indexingStatus === 'indexed') {
      where.processedAt = { not: null }
    } else if (filters.indexingStatus === 'not_indexed') {
      where.processedAt = null
      where.isIndexing = false
    } else if (filters.indexingStatus === 'processing') {
      where.isIndexing = true
    }

    return prisma.meeting.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: limit,
      include: { todos: { include: { assigneeUser: true, ticketSync: true } } },
    })
  }

  /**
   * Atomically acquire the indexing lock for a meeting.
   * Returns true if the lock was acquired, false if another process holds a fresh lock.
   * A lock is considered stale after INDEXING_LOCK_TIMEOUT_MS and can be overwritten.
   */
  async acquireIndexingLock(meetingId: string): Promise<boolean> {
    const STALE_AFTER_MS = 10 * 60 * 1000 // 10 minutes
    const staleThreshold = new Date(Date.now() - STALE_AFTER_MS)

    const result = await prisma.meeting.updateMany({
      where: {
        id: meetingId,
        OR: [
          { isIndexing: false },
          { indexingStartedAt: { lt: staleThreshold } },
        ],
      },
      data: {
        isIndexing: true,
        indexingStartedAt: new Date(),
      },
    })

    return result.count > 0
  }

  /** Release the indexing lock for a meeting. */
  async releaseIndexingLock(meetingId: string): Promise<void> {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        isIndexing: false,
        indexingStartedAt: null,
      },
    })
  }
}
